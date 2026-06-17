## Auditor's Position

Lens: conventions, no-build/importmap completeness, pooling + dispose-safety,
`castShadow` discipline, CHANGELOG/ROADMAP hygiene, and mechanical correctness of
the proposed wiring. I am not re-litigating the diagnosis; I am auditing whether
the *fixes* will land as clean, conventional, verifiable code that honors the
project's hard rules.

### Priority Sequence

1. **1a — `checkShaderErrors = false`, gated on the existing debug flag.** Lowest
   surface area, no new module, no importmap touch, no determinism exposure. It's
   one renderer property set after construction. Highest leverage per the
   diagnosis (kills the 88 % sync stall). Ship first.
2. **2a — throttle/stagger per-NPC separation.** A behavioral change confined to
   `crowd.js` (and possibly `spatialGrid.js`), no new files, no importmap. Second
   because it's the steady-state floor the player feels even parked
   (`spatialGrid.js:48`, `crowd.js:1015`).
3. **1b — instrument the program-count leak (cacheKey dump/diff).** This is
   *diagnostic*, not a fix — it should be a `__dbg`/backtick affordance, not a
   silent always-on cost. Sequence it after 1a so the dump runs against a build
   where the sync-stall noise is already gone, isolating the true mint source.
4. **2b — audit `_maxFp`/`_maxCol` query-radius inflation** (`registry.js:112/117`).
   Cheap read-only audit; the fix (bucket-by-size or cap reach) only justifies
   itself if 2a doesn't already flatten the curve. Re-measure between.
5. **1c — pooling / mis-disposed-shared fix / `compileAsync` pre-warm.** Gated on
   what 1b's dump actually finds. Do **not** do speculative pooling work here
   (see "Is 1c the real leak suspect" below) — it is the lowest-confidence item
   and risks churning correct code.

### Is 1c the actual leak suspect? — No, and the convention is already honored

The diagnosis names "mis-disposed shared materials" as a candidate for the
program-COUNT leak (`prog` 54→691, monotonic). I audited every disposal site that
could plausibly free a `userData.shared` resource, and the dispose-safety
convention (`.claude/rules/perf-pooling.md`) is **honored at both real
teardown paths**:

- `disposeChunkByKey` (`chunks.js:543` geo, `chunks.js:546/548` mats) skips any
  geometry/material tagged `userData.shared` — both the array and scalar branches
  guard it. ✓
- Lake unload (`lakes.js:866` geo, and its material branch) carries the identical
  guard. ✓
- Pooled resources are tagged: `_roadMat` (`chunks.js:847`), `_DRUM_PATH_MAT`
  (`chunks.js:2131`), `BLANKET_GEO` (`chunks.js:2595`) and bucket mats
  (`chunks.js:2602`), plus the model pools cited in the rules file. ✓

The other `.dispose()` callsites are **not** chunk-teardown of shared pools — they
are build-time merge-temporary frees (`tent.js:133`, `picnicTable.js:77`,
`shrub.js:42`, `portaPotty.js:61/92`, and the crowd merge temporaries
`crowd.js:135–167`). Those geometries were just merged into a result and are
correctly disposed; they were never tagged shared. No leak there.

One callsite *does* skip the shared-check — `main.js:1560`, the `showColliders`
teardown: `this._fpGroup.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); })`.
But that group holds debug wire-ring viz built fresh each toggle, not chunk
content, and it's dev-only behind `?debug`/the C key. Not a production leak path.
**Worth a one-line `userData.shared` guard for hygiene, but out of scope here.**

**Mechanical conclusion:** a mis-disposed shared material is a *recompile-storm /
sync-stall* signature (the same material re-links repeatedly), which 1a already
suppresses — it is **not** a mechanism for a monotonically *growing distinct*
program count. A re-disposed-then-recreated material reuses the same cache-key, so
`prog` would oscillate, not climb. The 54→691 monotonic climb requires *new
distinct cache-keys*. The diagnosis already cleared the three color-keyed pools
(`tent.js` `_CLOTH_MATS`, `puppet.js` `_npcMatPool`, `foodTruck.js` `_bodyMatPool`
— color is a uniform → one shared program) and the constant-key tie-dye/star
patches. I independently confirm the star patch is **not** the source:
`patchStarPowerMaterial` is idempotent (`starPower.js:75` `_starPatched` guard)
and its key is constant (`starPower.js:92` `'…|starpower-v1'`); `crowd.js:230` and
`wook.js:83` are likewise constant keys. So 1c-as-disposal-fix is chasing a leak
the evidence already exonerates. **Do not ship 1c on spec.** Let 1b's cacheKey
dump name the real mint source first; only then decide whether the fix is pooling,
a `customProgramCacheKey`, or a `#define` collapse.

### Hygiene / process obligations per fix

| Fix | CHANGELOG | ROADMAP | Notes |
|---|---|---|---|
| 1a | **Required** — `### Performance`. Player-visible (kills hangs) + dev-workflow (shader errors now gated). | Trim the "(1) shader storms" half of the Bugs bullet (`ROADMAP.md:9–21`) once it lands. | Same-commit per `.claude/rules/changelog-and-roadmap.md`. |
| 2a | **Required** — `### Performance`. Moves the `forEachNear` self-time HUD number. | Trim the "(2) `forEachNear`" half of the same bullet. | Don't delete the whole bullet until both halves ship. |
| 1b | **Optional/skip** — pure dev instrumentation. If it adds a backtick/`__dbg` affordance (like the perf-log recorder precedent, CHANGELOG 2026-06-17), write a one-liner under `### Added` (dev workflow); if it's a throwaway console snippet, skip. | No trim. | Mirror the `recordPerf` documentation pattern (DEBUGGING.md) if it's a kept tool. |
| 2b | Required only if it changes observable behavior (it shouldn't if it's an audit; required if it caps query reach). | Trim only if it completes the `forEachNear` half. | A pure read-only audit needs neither. |
| 1c | Required if anything ships. | n/a | Only after 1b; pre-warm via `compileAsync` is a `### Performance` boot-behavior note. |

The Bugs bullet (`ROADMAP.md:9–21`) is a single entry covering *both* root
causes. Per the ROADMAP rule, a partial completion **trims**, not deletes —
remove the shipped half's prose, keep the unshipped half, until both land.

### Does gating `checkShaderErrors` need new wiring, and is it clean?

**No new wiring needed — the flag already exists and is clean.** `main.js:539–542`
already constructs `_params = new URLSearchParams(location.search)` and computes a
debug-enabled boolean from `_params.has('debug')` + the `zerble.debug`
localStorage key. The renderer is constructed at `main.js:103`. The correct,
convention-honoring landing is a single line right after construction:

```js
renderer.debug.checkShaderErrors = _params.has('debug') /* or the shared flag */;
```

Mechanical cautions:
- `_params` is currently declared at `:539`, *after* the renderer at `:103`. The
  clean move is to lift the debug-flag computation to module scope (it's already
  a stateless URL read) or duplicate the cheap `URLSearchParams` read at `:103`.
  Either is fine; do **not** reach the `:539` local from the `:103` construction
  scope by accident — verify it's hoisted, not referenced before init.
- This is **not** a `THREE.X = Y`-after-import mutation — it sets a property on a
  renderer *instance*, not on the frozen `three` module namespace. It does not go
  near `threeShim.js` and does not trip tripwire #2. ✓
- Default-off in production is the entire point of the gate; `?debug` keeps
  authoring errors visible. Mechanically sound.

### Production question for 1a: ship to the live deploy, or dev-only?

**Ship `checkShaderErrors = false` to production; keep it `true` only under the
debug flag.** From my lens this is the correct convention:

- `checkShaderErrors = false` is standard three.js production guidance; the
  per-link `getProgramInfoLog` sync-stall is exactly what it disables, and that
  stall is the documented player-facing hang.
- The cost of shipping it: a *genuinely* broken shader fails silently (black/no
  draw) instead of logging. But the production shader set is fixed and already
  ships green — there is no shader authoring happening against the live deploy.
  Authoring always happens locally where `?debug` (or the localStorage key) is
  set, so errors still surface during development.
- Gating it the way the diagnosis proposes (`true` on `?debug`) means the safety
  net is present exactly where shaders change and absent exactly where it costs
  players frames. That's the right split.

**Verification gate before shipping:** boot clean at `?perf=low`, `?perf=mid`,
`?perf=high` (the threeShim Lambert swap on low is a different material path —
`threeShim.js:52` — and is precisely the kind of tier-specific breakage that a
disabled error log would now hide). Re-capture a trace and confirm the
`getProgramInfoLog` spikes are gone, per the diagnosis's own verify step. Boot the
main game (not just sandbox) since this touches renderer construction, which the
sandbox doesn't exercise identically (CLAUDE.md "Sandbox-pass ≠ game-pass").

### Mechanical correctness of 1b (program-leak instrumentation)

The instrument is sound and the precedent exists. Specifics:

- `renderer.info.programs` is the right surface; each entry exposes `.cacheKey`.
  The diff approach (snapshot keys periodically, set-diff to find newly-minted
  distinct keys) is the only way to name the mint source — the diagnosis is
  correct that guessing without the dump is forbidden.
- **Make it a gated affordance, not always-on.** `renderer.info` reads are cheap,
  but a periodic full dump + diff of up to ~691 keys is steady-state allocation
  the production loop shouldn't carry. Wire it behind `__dbg`/backtick like the
  existing `recordPerf` recorder (debug.js / main.js, CHANGELOG 2026-06-17) — that
  recorder *already* samples `prog` (`renderer.info.programs.length`), so 1b is a
  natural extension of an existing surface, not a new subsystem.
- If 1b becomes a kept `src/` helper module (unlikely — it's more naturally a
  `__dbg` method), it must hit the importmap in **both** `index.html` and
  `sandbox.html` and pass `bin/check-importmaps` (no-build rule). If it's a method
  on the existing debug API, no importmap change. Prefer the latter.
- Determinism is untouched — this is read-only instrumentation, no `rng()`.

### Mechanical Assertions

| Check                          | Status    | Notes |
| ------------------------------ | --------- | ----- |
| Importmap in BOTH html files   | PASS / N/A | 1a/2a/2b touch no new module. 1b should be a `__dbg` method → no importmap. Only a *new* `src/` module would require it (×2 + `bin/check-importmaps`). |
| Sandbox entry complete         | N/A       | No new model. No `src/models/` file added by any fix. |
| userData.shared tagging        | PASS      | Both teardown walks guard it (`chunks.js:543/546/548`, `lakes.js:866`); pools tagged (`chunks.js:847/2131/2595/2602`). No fix adds an untagged pooled resource. |
| castShadow discipline          | PASS      | No fix adds geometry or a new caster. Audit holds at 56. |
| InstancedMesh needsUpdate      | N/A       | No fix writes instance matrices. 2a throttles *queries*, not InstancedMesh writes — but if staggering touches any instanced crowd buffer, re-flag `instanceMatrix.needsUpdate` (tripwire #7). Verify in review. |
| Determinism (fresh salt)       | PASS      | No fix touches `rng()` / hash inputs. 2a staggering must use a frame counter / index round-robin, **not** `Math.random()` and **not** a reorder of any seeded call. |
| CHANGELOG/ROADMAP in commit    | PENDING   | 1a + 2a each require a same-commit `### Performance` entry and a *trim* (not delete) of the two-cause Bugs bullet `ROADMAP.md:9–21`. |

### Quality Deficiencies Found

- **1c shipped on spec would churn correct code** — the disposal convention is
  already honored at every real teardown path; "fix mis-disposed shared
  materials" has no target. Severity: Medium (wasted/risky work, not a live bug).
- **`main.js:1560` showColliders teardown lacks the `userData.shared` guard** —
  dev-only, debug-gated, low blast radius, but it's the one disposal walk that
  deviates from the convention. Severity: Low (hygiene; fix opportunistically,
  not in this change).
- **2a determinism footgun** — if NPC separation is staggered, the partition
  must be a deterministic round-robin (frame index / NPC index), never
  `Math.random()`, or two clients diverge and crowd behavior stops being
  reproducible. Severity: Medium if mishandled; flag in review.

### Verdict

-   **Verdict**: Proceed with mitigations.
-   **Key Concern**: 1c ("fix mis-disposed shared materials") targets a leak the
    evidence already exonerates — the dispose-safety convention is honored at
    every real teardown path (`chunks.js:543`, `lakes.js:866`), and a re-disposed
    material reuses its cache-key, so it cannot produce the monotonic `prog`
    climb. Don't ship 1c on spec; let 1b's cacheKey dump name the true mint source
    first.
-   **Recommendation**: Ship 1a first (one clean line off the *existing* debug
    flag at `main.js:539–542`; production-default `false` is correct), then 2a
    (deterministic round-robin, not `Math.random()`), then 1b as a gated `__dbg`
    affordance, then 2b audit. Both 1a and 2a carry a mandatory same-commit
    `### Performance` CHANGELOG entry and a *trim* (not delete) of the two-cause
    Bugs bullet at `ROADMAP.md:9–21`. Gate 1c on what 1b finds.

## Round 2 — Reactions

My Round-1 plan audited the four fixes as briefed (1a/1b/1c, 2a/2b) and concluded
1c was the only hygiene hazard. Round 1 surfaced a **fifth fix nobody briefed** —
the `closestBuilding` O(n) → `_fpGrid` broadphase port (Pragmatist Finding 1,
Profiler "under-weighted in the plan," Adversary "2b can shift the world,"
Architect "preserve the superset-not-subset contract"). That moved me. It is now
the centerpiece of Slice 1, and from my lens it carries **real same-commit
obligations that none of the four spelled out in full**. I'm adding them.

### (a) The `closestBuilding` broadphase rewrite — hygiene/convention audit

**Conceded — this belongs in Slice 1, and it's cleaner than 2a.** Pragmatist is
right that one ~10-line change converts 20+ O(n) sites at once, and that it's
*lower-risk* than per-NPC throttling. I verified the call shape myself:
`closestBuilding` (`registry.js:143-157`) is a bare linear scan over
`entries.values()`, and it's used as a **boolean placement guard inside seeded
`rng()` loops** — confirmed at `chunks.js:1068` (`if (registry.closestBuilding(...)) continue/return false`
inside a `rng()`-driven scatter at `chunks.js:1071-1073`). So this is not a steering
query like 2a; it sits *directly on the determinism-critical placement path*. That
changes the audit obligations.

**The dispose guard does NOT attach — clearance.** This is a query-path refactor,
not a pooled-resource change. It mints no module-scope geometry/material, so
`userData.shared` is N/A. The `_fpGrid` it routes through is rebuilt every frame
from live positions (`registry.js:88-104`, no invalidation bookkeeping), so there's
no new disposal walk and no teardown-skip obligation. **PASS, no new tagging.**

**The determinism guard DOES attach — and it's the load-bearing one.** Four
personas asserted "the grid guarantees a superset, so results are identical"
(Pragmatist `:53`, Architect `:90-94`, Profiler `:120`). That is true *only if the
port is superset-faithful*, and `closestBuilding` has a subtraction the siblings
don't: it computes `d = hypot(dx,dz) - e.footprint` (`registry.js:150`) and selects
the **minimum `d`**, where `footprintsNear` only pads the query reach. A naive port
that calls `_fpGrid.forEachNear(x, z, radius, fn)` would visit a **subset** — it
would miss a large-footprint building whose *center* sits outside `radius` but whose
*edge* (center − footprint) reaches inside. That building is exactly what the guard
exists to catch. The result: `closestBuilding` returns `null` where it used to
return a hit, the boolean **flips**, and a prop/tree/camp spawns where it previously
didn't — a silent determinism regression routed through query order, precisely
Adversary's warning (`:41`) but applied to the *grid port* rather than 2b's
bucketing. **The mandatory guard: the port must query `_fpGrid.forEachNear(x, z,
radius + this._maxFp, fn)` — pad by `_maxFp` exactly as `footprintsNear` does
(`registry.js:112`) — and keep the `- e.footprint` min-selection inside `fn`
unchanged.** With that padding it is a true superset; without it, it's a subset and
the world shifts. This is the one assertion in the four convergent positions that
was stated as already-true but is actually a *precondition the implementer must
honor*. I'm flagging it as a Critical review-gate item.

**Same-commit obligations now that Slice 1 has two fixes:**
- **CHANGELOG** — one `### Performance` entry with two sub-bullets (1a sync-stall
  kill; `closestBuilding` O(n)→O(cells) broadphase). Same commit, per
  `changelog-and-roadmap.md`.
- **ROADMAP trim** — the two-cause Bugs bullet (`ROADMAP.md:9-21`) covers *both*
  root causes. Slice 1 ships 1a (cause 1, sync stall) **and** the
  `closestBuilding` half of cause 2 (the gen-time O(n) grind) — but NOT the
  `forEachNear` steady-state half (2a/2b) and NOT the program-count leak (1b).
  So this is a **trim, not a delete**: strike the shader-storm prose and the
  `closestBuilding`/gen-jank prose; keep the residual `forEachNear` steady-grind
  line and the `prog`-leak line until 2a/2b and 1b land. My Round-1 table assumed
  Slice 1 trimmed only the "(1) shader storms" half — that's now stale; Slice 1
  trims (1) **plus** the gen-time portion of (2). Revised below.
- **Verify gate** — full game boot at `?perf=low/mid/high` (sandbox can't exercise
  `chunks.js` gen, and the Lambert-swap low tier mints a different program set).
  This is the *same single trace re-capture* that verifies 1a, so bundling them
  costs no extra measurement (Pragmatist `:158-159` is right). One commit, one boot
  sweep, one perf-log — clean.

**Is it clean to ship in the first slice? Yes — with the `_maxFp` padding as a
hard review-gate.** It adds no module, no importmap entry (`bin/check-importmaps`
N/A), no `castShadow`, no InstancedMesh write, no pooled resource. Its entire risk
surface is the superset-faithfulness of one query. Gate on that and it's the
cleanest high-leverage line in the plan.

### (b) Adversary's `compileAsync` coupling to 1a vs. the bare-flip-plus-tri-tier-boot — which is lighter / more auditable?

**The bare flip + tri-tier visual boot verify is the lighter, more auditable
footprint. I side with Architect/Profiler/Pragmatist over Adversary here.**

Adversary's mechanism is real — `checkShaderErrors=false` makes a genuinely broken
shader fail *silently* on Safari Metal, the runtime with the least telemetry and
the most GLSL-divergence history (`threeShim.js:13-17`), and that's a High concern I
don't dismiss. But the *mitigation* Adversary attaches — pull 1c's
`renderer.compileAsync(scene, camera)` forward as the enabler, validate-then-flip
at boot — is the **heavier and less auditable** of the two options, for three
mechanical reasons:

1. **It couples a parked, lowest-confidence item (1c) into the must-ship Slice 1.**
   Architect (`:122-131`) and Profiler (`:53-58`) both established `compileAsync`
   does nothing for an *unbounded* keyspace — it pre-warms only the materials
   *currently in the scene at boot*, and the leak mints new keys from chunks that
   don't exist yet (`prog` 54→691 monotonic). So the validation it buys covers the
   boot-resident program set, **not** the streaming programs that appear as you
   drive — which is exactly where a Safari-divergent shader would surface. The
   coupling buys partial coverage at the cost of dragging 1c onto the critical path.
2. **It's the harder thing to verify in review.** A bare `renderer.debug.checkShaderErrors =`
   `<debugPredicate>` after `main.js:114` is a one-line diff an auditor confirms by
   inspection: instance property, not namespace mutation (no tripwire #2), reuses
   the `main.js:540-542` debug predicate (no new flag), defaults off in prod. The
   `compileAsync` form adds an async boot hop — and CLAUDE.md tripwire #3 is
   emphatic that **nothing async may sit between the title-card gesture and
   `Sound.init()`**; a boot-time `await renderer.compileAsync(...)` placed wrong
   risks the iOS AudioContext-suspended-forever class of bug. That's a much larger
   thing to audit than a property set.
3. **The lighter mitigation already achieves Adversary's actual goal.** Adversary
   wants "every program that exists at boot validated once on the real device."
   The **tri-tier visual boot check** that Architect (`:163-169`), Profiler
   (`:172-176`), Pragmatist (`:142-145`) and I (Round 1, "Verification gate") all
   independently require *is* a validate-on-real-device gate — it confirms the scene
   *renders* (not just clean console) at low/mid/high. For the streaming programs
   that `compileAsync` can't reach anyway, the visual boot sweep is the only thing
   that catches them, and it's a process gate with zero code cost.

**Refinement, not a full rebuttal:** I keep Adversary's underlying point that
console-clean ≠ correct under `checkShaderErrors=false`. So the boot verify must be
explicitly **visual** (screenshot the scene rendered at each tier, per CLAUDE.md
"ALWAYS boot the main game"), not just `preview_console_logs`. That's the auditable
substitute for the validation Adversary wanted — same safety goal, no async boot
hop, no 1c-coupling, no tripwire-#3 exposure. **Verdict on this sub-question: bare
flip + visual tri-tier boot verify is the cleaner, more auditable footprint; the
`compileAsync` coupling is heavier and only partially closes the gap it claims to.**

### Revised CHANGELOG / ROADMAP obligations (supersedes my Round-1 table)

Now that Slice 1 = **1a + `closestBuilding` broadphase** (per Pragmatist's bundle,
which I endorse):

| Item | CHANGELOG | ROADMAP |
|---|---|---|
| **Slice 1 (1a + closestBuilding)** | **Required, one commit** — `### Performance`, two sub-bullets: sync-stall kill (the 88% `getProgramInfoLog`), and `closestBuilding` O(n)→O(cells) across 20+ gen sites. | **Trim** the two-cause Bugs bullet (`ROADMAP.md:9-21`): strike the shader-storm prose AND the gen-time/`closestBuilding` portion of cause 2; **keep** the residual `forEachNear` steady-grind line and the `prog`-leak line. |
| **Slice 2 (2a and/or 2b, measure-gated)** | Required if anything ships — `### Performance`. | Trim the residual `forEachNear` line **only when both** the steady-grind work and Slice 1's gen-time work are done. |
| **1b (leak hunt)** | Optional/skip as instrumentation; one-liner `### Added` if it becomes a kept `__dbg` affordance (mirror the `recordPerf` precedent, CHANGELOG 2026-06-17). | Trim the `prog`-leak line only when the *fix* (not the dump) ships. |
| **1c** | Required only if it ships a real fix, gated on 1b. | n/a |

The Round-1 table's "Slice 1 trims only the (1) shader-storms half" is **revised**:
Slice 1 now also trims the gen-time half of cause (2), because `closestBuilding`
is that half. The steady-state `forEachNear` half and the `prog`-leak line survive
to later slices. Partial completion **trims, never deletes** — the bullet stays
alive until its last sub-cause ships (`changelog-and-roadmap.md`, ROADMAP section).

### Mechanical Assertions (delta from Round 1 — only changed rows)

| Check | Status | Notes |
| --- | --- | --- |
| Determinism (fresh salt) | **PASS w/ Critical gate** | `closestBuilding`→grid port must query `forEachNear(x, z, radius + this._maxFp, fn)` (pad by `_maxFp`, `registry.js:112` pattern) and keep the `- e.footprint` min-select in `fn`. Without the pad it returns a SUBSET, flips a boolean placement guard inside `rng()` loops (`chunks.js:1068`), and silently shifts the deterministic world. 2a still uses round-robin (`(idx+frame)%N`), never `Math.random()`. |
| userData.shared tagging | PASS | `closestBuilding` port mints no pooled resource; N/A. Unchanged from R1: every real teardown path guards the flag. |
| CHANGELOG/ROADMAP in commit | PENDING | Slice 1 = one `### Performance` commit, two sub-bullets, **trim** (not delete) of the two-cause bullet covering 1a + the gen-time half of cause 2. |

### Revised Verdict

-   **Verdict**: Proceed with mitigations. (unchanged)
-   **What moved me**: The `closestBuilding` broadphase port (surfaced by all four
    peers) is a genuinely cleaner, higher-leverage Slice-1 fix than the briefed 2a,
    and I now lead Slice 1 with **1a + closestBuilding**, not 1a + 2a. But the four
    peers stated the grid port's superset-safety as already-true; my audit finds it
    is a **precondition the implementer must honor** — the port must pad the query
    by `_maxFp` and preserve the `- e.footprint` min-selection, or it becomes a
    subset query that flips a seeded placement guard and shifts the world. That is
    the one Critical review-gate item to attach. On the production sub-question I
    side against Adversary's `compileAsync` coupling: a bare flip off the existing
    debug predicate + a **visual** tri-tier boot verify is the lighter, more
    auditable footprint and avoids dragging parked 1c (and a tripwire-#3 async boot
    hop) onto the critical path.
-   **Recommendation**: Ship Slice 1 = 1a (bare flip, production-default `false`,
    `true` under the existing `?debug` predicate) **+** `closestBuilding`→`_fpGrid`
    broadphase, in **one commit**, with the `_maxFp`-padding superset gate as a hard
    review item and a **visual** boot screenshot at `?perf=low/mid/high`. One
    `### Performance` CHANGELOG entry (two sub-bullets) and a **trim** of the
    two-cause Bugs bullet covering both shipped halves. Then 2b/2a measure-gated
    (Slice 2), 1b as a gated `__dbg` diagnostic, 1c only if 1b names a real
    mint-source. 1c stays parked — do NOT pull `compileAsync` forward to enable 1a.
