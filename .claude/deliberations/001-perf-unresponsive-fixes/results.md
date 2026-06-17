# Deliberation Summary

## Context

-   **Task**: Stress-test the *fix approach* for the live game's "page
    unresponsive" hang. Decide sequencing, what ships now vs. parks on ROADMAP,
    and the production form of `renderer.debug.checkShaderErrors = false`.
    Diagnosis (`.claude/perf-unresponsive-diagnosis.md`) is settled; only the fix
    plan was deliberated.
-   **Mode**: Tier-3 DEBATE (two rounds, five personas + Mediator). Round-2
    reactions are the resolved tensions; this synthesis uses each persona's
    *latest* verdict.
-   **Personas Consulted**: Profiler, Adversary, Architect, Pragmatist, Auditor
    + Mediator.
-   **Date**: 2026-06-17

---

## Synthesized Plan

The two root causes are **decoupled** (sync-link stall vs. registry-side O(n)
grind) — neither fix gates the other, so the plan ships the highest-leverage,
lowest-risk work first, measures with the already-shipped `__dbg.recordPerf()`
recorder (commit `ed57cc6`), and lets the trace decide whether the remaining,
riskier items are even needed.

### Change Group 1 — Slice 1: Stall kill + the registry O(n) grind (SHIP NOW)

**Scope**: The two highest-leverage fixes, one per root cause, shipped to the
live deploy. **Two commits, one ship wave**, verified by one trace re-capture.

**Estimated Effort**: Small. ~1 line (1a) + ~10 lines (broadphase). The
non-trivial cost is the tri-tier game boot + perf-log re-capture, and the
`_maxFp` correctness review — not the edits.

**Commit A — `1a`: `checkShaderErrors = false`, production, debug-gated (bare
flip form)**

1.  Set `renderer.debug.checkShaderErrors = <debugPredicate>` immediately after
    renderer construction (`main.js:103`; the renderer init block). Default
    `false` in production; `true` only under the existing `?debug` /
    `localStorage 'zerble.debug'` predicate already computed at
    `main.js:539–542`.
2.  **Reuse the existing debug predicate** — do not add a new flag. The predicate
    at `:539–542` is declared *after* the renderer at `:103`; hoist the stateless
    `URLSearchParams` read to module scope (or duplicate the cheap read at `:103`).
    Do **not** reference the `:539` local from the `:103` scope before init.
3.  This is an instance-property set, **not** `THREE.X = Y` on the frozen module
    namespace — it does not touch `threeShim.js` and does not trip tripwire #2.
    Confirm by inspection.
4.  **Form is the BARE FLIP — NOT a `compileAsync` pre-warm coupling** (see
    Conflict 1). Safety comes from the release gate below, not from a boot-time
    async compile.

**Commit B (immediate follow-up) — `closestBuilding` → `_fpGrid` broadphase**

5.  Route `registry.closestBuilding` (`registry.js:143–157`, currently a full
    linear scan over `this.entries.values()`) through the existing per-frame
    `_fpGrid` broadphase the way `footprintsNear`/`collidersNear`
    (`registry.js:111–118`) already do. This converts **24+ O(n) call sites**
    (18 in `chunks.js` — `:499/1068/1154/1240/1243/1363/1468/1657/1681/2035/2071/`
    `2086/2238/2461/2481/2504/2573/2960` — plus `forests.js:909`, `lakes.js:711`,
    `obstacles.js:1114`, `starPower.js:415`) from O(registry) to O(cells) in one
    change.
6.  **>>> CRITICAL MUST-DO — the `_maxFp` superset guard (highest-risk
    correctness item in the whole plan). <<<** `closestBuilding` computes
    `d = Math.hypot(dx,dz) - e.footprint` (`registry.js:150`) and selects the
    minimum `d` — its reach is inflated by the *candidate's own footprint*. A
    naive port that queries `_fpGrid.forEachNear(x, z, radius, fn)` visits a
    **SUBSET**: it drops a large-footprint building (stage/truck) whose *center*
    sits outside `radius` but whose *edge* (`center − footprint`) reaches in —
    exactly what the guard exists to catch. The port **must** query
    `_fpGrid.forEachNear(x, z, radius + this._maxFp, fn)` — pad by `_maxFp`
    exactly as `footprintsNear` does (`registry.js:112`) — and keep the
    `- e.footprint` min-selection **and** the `excludeKinds` filter (default
    excludes `'tree'`) **inside** the callback, unchanged. With the pad it is a
    documented superset (`spatialGrid.js:8–9`) → identical `best` → identical
    boolean. Without it, the boolean flips, a prop/tree/camp spawns where the
    linear scan blocked it, and **the deterministic world silently shifts for
    anyone playing across the change**. Gate this as a Critical review item.
7.  Why it's determinism-safe *with* the pad (Adversary's full concession,
    `council-adversary.md:114–124`): the superset guarantee makes the null/
    non-null result identical, **and** all 24 call sites are boolean placement
    guards (`if (registry.closestBuilding(...)) continue/return`) that never read
    *which* entry won — so even an exact-float tie is irrelevant. Two independent
    reasons it's safe. It consumes no `rng()` and the grid feeds no worldgen
    (`spatialGrid.js:4–6` header), so the 20/20 worldgen goldens and layout
    snapshots hold.

**Why two commits, not one** (Profiler's one-variable point, Pragmatist's
concession `council-pragmatist.md:208–226`): 1a is verified by `fMax` collapsing;
the broadphase by `closestBuilding`/`forEachNear` self-time falling. Those are
**different lines of the same single re-capture** — separate commits cost one
extra `git commit`, not one extra trace — and keeping them separate makes a boot
`TypeError` from the 24-site rewrite bisectable from the silent-shader risk of
1a, on the longest boot chain in the codebase where "a boot-time TypeError is
worse than a missing feature" (CLAUDE.md).

**Slice-1 verification (mandatory before declaring done)**:
-   **Visual, drive-and-screenshot release gate at `?perf=low` AND `?perf=high`**
    (the hardened form — see Conflict 1). `__dbg.start()` → drive across ≥4 chunk
    loads → screenshot the rendered scene at each tier. Boot-only smoke is
    **insufficient**: with `checkShaderErrors=false` a clean console no longer
    proves correctness, and the streamed program population (the actual
    Safari-Metal divergence surface) does not exist at the title card. Low tier
    is the iOS default (`perf.js:25`) and the Lambert program path
    (`threeShim.js:46,62`), so it is the highest-risk tier and must be exercised.
-   **One 160 s perf-log re-capture** reading both `fMax` (1a: the 314/245/207 ms
    spikes gone; `getProgramInfoLog` out of the CPU top-5) and `closestBuilding`/
    `forEachNear` self-time + `[chunk slow]` warning frequency while driving into
    fresh chunks (broadphase: it's a gen-time fix — verify on the gen-time
    instrument, **not** the parked `fAvg` floor).
-   **Full game boot, not sandbox** — the broadphase sits on
    `buildWorld → _generate → THEME_BUILDERS`, which `sandbox.html` does not
    exercise (CLAUDE.md "Sandbox-pass ≠ game-pass").

**Slice-1 CHANGELOG / ROADMAP**:
-   **CHANGELOG**: one `### Performance` block, two sub-bullets (1a sync-stall
    kill / the 88 % `getProgramInfoLog`; `closestBuilding` O(n)→O(cells) across
    24+ gen sites). Per-commit if split, or one block if reviewer prefers — both
    sub-bullets ship this wave regardless.
-   **ROADMAP**: **trim, do not delete**, the two-cause Bugs bullet
    (`ROADMAP.md:9–21`). Strike the shader-storm prose **and** the gen-time/
    `closestBuilding` portion of cause 2. **Keep** the residual `forEachNear`
    steady-grind line and the `prog`-leak line until Slice 2 and Group 3 land.

### Change Group 2 — Slice 2: Steady-state grind remnants (MEASURE-GATED)

**Scope**: Only runs **if Slice 1's trace still shows `forEachNear`-class cost.**
If the trace is green here, this slice may not exist at all.

**Estimated Effort**: Small (2b audit) to Medium (2a, the riskiest item in the
plan — high hidden effort, smallest payoff).

**Tasks (in order)**:
1.  **2b — `_maxFp`/`_maxCol` audit.** Dump the largest footprint/collider kind.
    If one oversized outlier is widening every grid query (and now the
    `closestBuilding` broadphase's shared pad too), it's cheap to fix. **Ship only
    the safe subset**: never cap the query reach *below* `radius + _maxFp` and
    never bucket oversized entries out of the queried grid — that turns the
    superset into a SUBSET and shifts placement (Conflict 4). A genuine
    size-bucketing optimization needs Architect's second-grid shape
    (`council-architect.md:94–98` — a separate grid for oversized entries, query
    both), or it stays parked.
2.  **2a — per-NPC separation throttle.** Only if `crowd.js:1015` is still hot.
    Bounded by `crowdMax` (180/320/500, `crowd.js:30`, `perf.js:59/79/94`), so
    it's the smallest remaining sliver. **Hard/soft split is mandatory** (Conflict
    3): the `HARD_SEPARATION` overlap floor (`crowd.js:89`, 0.85 m, the
    cluster-stack guard at `crowd.js:1010`) stays **every-frame for every NPC**;
    only the *soft steering* accumulation may be staggered. The partition must be
    a **deterministic `(idx+frame)%N` round-robin — never `Math.random()`** and
    never a reorder of a seeded call. Cull-by-distance (far/off-screen NPCs) is
    safe. If staggering touches any instanced crowd buffer, re-flag
    `instanceMatrix.needsUpdate = true` (tripwire #7).

**Slice-2 CHANGELOG / ROADMAP**: `### Performance` if anything ships; trim the
residual `forEachNear` steady-grind line **only when both** the steady-grind and
Slice-1 gen-time work are done.

### Change Group 3 — The real leak (1b): instrument now, fix when named (UN-PARKABLE)

**Scope**: The program-COUNT leak (`prog` 54→691 monotonic, `heapMB` 97→416
rising floor, `tex` 44→147) — the actual long-session bug. 1a *hides its symptom*
(the stall) but does not stop programs being minted. This is the
**low/mid/mobile OOM vector that high-tier desktop hides** — it cannot be parked
indefinitely (resolution of Conflict 2).

**Estimated Effort**: Instrumentation: small. Fix: **unbounded** until the dump
names the source — could be one `#define` outlier or an `onBeforeCompile`
cache-key bug. Never on the critical path of a shippable fix.

**Tasks**:
1.  Add a **gated `__dbg`/backtick affordance** (not always-on — a periodic dump+
    diff of up to ~691 keys is steady-state allocation the prod loop shouldn't
    carry) that snapshots `renderer.info.programs[].cacheKey` and set-diffs to
    name what mints unbounded distinct keys. Extend the existing `recordPerf`
    recorder, which already samples `prog` (`renderer.info.programs.length`) — no
    new `src/` module, **no importmap touch** (prefer a method on the existing
    debug API; only a new module would require `bin/check-importmaps` + both html
    files).
2.  Run the dump on a build where 1a has already silenced the sync-stall noise,
    on `?perf=low` AND `?perf=high` (the Lambert swap mints a different program
    set on low — a leak that only blooms under Lambert is missed on high).
3.  **Do not guess a fix before the dump** (diagnosis is explicit). Do **not**
    ship 1c's pooling/disposal fix on spec (Conflict 5).

**Scheduling resolution** (Adversary "release blocker" vs. Pragmatist "doesn't
block the ship"): Slice 1 ships **without** waiting on 1b's *fix* — 1a removes
the player-visible stall today and the leak does not block that. But 1b is **not
optional**: stand the instrumentation up immediately on its own track, treat the
leak as a tracked, un-parkable bug (the `prog`-leak ROADMAP line survives until
the *fix* — not the dump — ships), and verify the OOM vector specifically on
low/mobile, which is where it bites.

### Change Group 4 — Parked on ROADMAP

-   **1c — `compileAsync` pre-warm**: parked. It validates only the boot-resident
    program set; the leak is an unbounded keyspace minted from chunks that don't
    exist at boot, so it is **a non-fix for the leak and not a Safari-safety
    mechanism** (Architect + Profiler, decisive). May land *later* as a pure
    boot-stall smoother **only after 1b proves the keyspace is bounded.**
-   **1c — pooling / mis-disposed-shared fix**: **exonerated — do not ship on
    spec.** The dispose-safety convention is honored at every real teardown
    (`chunks.js:543/546/548`, `lakes.js:866`); a re-disposed material reuses its
    cache-key (oscillates, cannot climb monotonically). Shipping it would churn
    correct code (Auditor's audit, the round's strongest single finding).
-   **`main.js:1560` `showColliders` teardown** missing the `userData.shared`
    guard: dev-only hygiene nit, fix opportunistically, out of scope here.
-   **2b size-bucketing / reach-capping below `radius + _maxFp`**: parked unless
    built in Architect's second-grid shape (subset-producing = world-shifting).

## Final Recommendation

**Proceed with mitigations.** Ship Slice 1 (1a bare-flip to live, debug-gated +
the `closestBuilding`→`_fpGrid` broadphase with the `_maxFp` pad) as two commits
in one wave, verified by one drive-and-screenshot tri-tier (`?perf=low/high`)
release gate plus one 160 s perf-log re-capture. Stand up the 1b leak
instrumentation immediately on its own track — it is the un-parkable long-session
bug high-tier hides. Hold 2a/2b behind Slice 1's trace; park both `1c` variants.

---

## Convergence Points

-   **Verdict was unanimous: Proceed with mitigations** (all five, both rounds).
-   **Ship `checkShaderErrors=false` to the live deploy, gated `true` on the
    existing `?debug` predicate** — dev-only defeats the fix (the bug is live, on
    real GA4 players); this is standard three.js production guidance. (All five.)
-   **The `closestBuilding`→`_fpGrid` broadphase is the real root-cause-2 win** —
    a 24-site O(registry) linear scan, not the capped-crowd separation (2a). It
    was surfaced by all five and promoted into Slice 1. (All five by Round 2.)
-   **The `_maxFp` padding is a hard precondition, not an already-true fact** —
    the broadphase must pad by `_maxFp` and keep `- e.footprint` min-selection in
    the callback, or it becomes a subset query that shifts the world. (Architect +
    Auditor flagged it explicitly; Adversary confirmed it's the safe shape.)
-   **1a hides the symptom, not the leak** — the monotonic `prog`/`heap` climb is
    a separate, un-parkable long-session bug that bites low/mid/mobile and that
    high-tier hides. 1b is instrumentation-first; no fix before the cacheKey dump.
    (All five.)
-   **The pooling/disposal half of 1c is exonerated** — convention honored
    everywhere; re-disposed materials reuse cache-keys. Don't ship on spec.
    (Auditor's audit; adopted by Architect + Pragmatist.)
-   **2a, if it ships, splits hard-floor-every-frame / soft-steer-staggered with
    a deterministic round-robin** — never `Math.random()`. Nil golden-snapshot
    exposure (confirmed against `selftest.js` + `spatialGrid.js`). (All five.)
-   **Verify on the perf-log recorder + a re-captured trace, NOT the draw/tri HUD
    markers** — neither root cause is a draw/triangle budget problem; those
    markers are green and were never the bottleneck. (Profiler; uncontested.)

## Conflicts Resolved

| Conflict | Position A | Position B | Resolution | Rationale |
| --- | --- | --- | --- | --- |
| **1. Production form of 1a** | Adversary (R1): Block bare flip; couple a boot-time `compileAsync(scene,camera)` validate-then-flip as the enabler. | Architect/Profiler/Pragmatist/Auditor: bare flip + tri-tier visual boot check; `compileAsync` is the wrong tool. | **Bare flip + a hardened *drive-and-screenshot* tri-tier (`?perf=low/high`) release gate.** No `compileAsync` coupling. | Adversary **conceded** `compileAsync` in R2 (`council-adversary.md:96–108`): Architect's unbounded-keyspace argument (`:122–131`) proves it validates only the boot-resident set and leaves the larger streaming-minted keyspace — the real Safari divergence surface — silent. Adversary's hardening of "boot smoke" to "drive across ≥4 chunks" (`:102–106`) is adopted because the streamed program population doesn't exist at the title card. The async-boot form also risks tripwire #3 (no async hop before `Sound.init()`) — Auditor `:296–304`. |
| **2. Is the leak (1b) parkable?** | Pragmatist (R1): park behind a diagnostic, doesn't block the ship. | Profiler/Adversary: un-parkable — it's the actual long-session OOM bug high-tier hides; release-tracked, not optional. | **Slice 1 ships without waiting on 1b's *fix*; 1b instrumentation stands up immediately and the leak is a tracked, un-parkable bug** (the `prog`-leak ROADMAP line survives until the fix ships). | Both halves are right and don't actually conflict: 1a removes the *player-visible stall* today (so it ships now), but the leak is a distinct OOM vector on low/mid/mobile that high-tier desktop hides (Profiler `:141–147`), so it cannot be parked indefinitely. Architect (`:113–123`) named this a scheduling call, not a structural one. |
| **3. `closestBuilding` in Slice 1 vs. ROADMAP** | Profiler (R1): park to ROADMAP — bundling it breaks the one-variable rule. | Pragmatist/Architect/Auditor/Adversary: ship it in Slice 1 — it's the residency-growing O(n) grind. | **Ship in Slice 1, as its own commit** (two commits, one wave). | Profiler **conceded** in R2 (`council-profiler.md:226–281`): 1a and the broadphase touch *different instruments* (`fMax` vs. `closestBuilding` self-time) in the *same* re-capture, so bundling them does NOT confound attribution — bundling the broadphase with **2a** would (both move `forEachNear`-class self-time). Pragmatist conceded the commit boundary (`:208–226`): separate commits cost one `git commit`, not one trace. Profiler's own evidence — `starPower.js:415` runs it in a loop in the worst-trace session — makes parking it incoherent. |
| **4. 2a (separation throttle) priority** | Adversary (R1): ship 2a *first* (lowest blast radius, nil determinism). | Pragmatist/Profiler: 2a is the smallest, riskiest, capped-crowd sliver — demote to measure-gated. | **Demoted to measure-gated Slice 2**; only ships if Slice 1's trace still shows `crowd.js:1015` hot. | The crowd is hard-capped (`crowd.js:30`), so per-NPC separation cannot be the cost that grows "after a while" — the registry-side O(n) is. 2a also carries the cluster-stack regression risk (`crowd.js:1010`) the broadphase doesn't. All personas aligned on this by R2. |
| **5. 2b size-bucketing safety** | Adversary (R1): bucketing can flip a `closestBuilding` placement guard and shift the deterministic world. | (briefing framed 2b as a routine audit) | **Ship only the safe subset (find the fat footprint); bucketing/reach-capping below `radius + _maxFp` is parked** unless built as a *second grid* for oversized entries. | A subset-producing query makes a guard that should trip *not* trip → placement shifts mid-world. Adversary `:124`, Architect `:94–98`. This is the same `_maxFp` superset hazard as Conflict's CRITICAL must-do, viewed from the optimization side. |
| **6. Ship 1c pooling/disposal fix?** | (briefing listed it as a candidate) | Auditor: exonerate — convention honored everywhere; re-disposed mats reuse cache-keys. | **Do not ship on spec.** | A mis-disposed shared material is a recompile-*storm* (which 1a already suppresses), not a mechanism for monotonically *growing distinct* program count. Auditor `:31–74`; adopted by Architect + Pragmatist. |

## Risk Register

| Risk | Severity | Mitigation | Owner |
| --- | --- | --- | --- |
| Broadphase ported with a bare `forEachNear(x,z,radius)` → subset query → drops large-footprint buildings → flips a seeded placement guard → **silent deterministic world shift** | **Critical** | Pad query by `_maxFp` (`forEachNear(x, z, radius + this._maxFp, fn)`), keep `- e.footprint` min-select + `excludeKinds` in callback. Hard review-gate. 20/20 worldgen goldens + layout snapshots must hold. | Architect / Auditor |
| `checkShaderErrors=false` ships a silent black object on Safari/Metal (Chrome-green ≠ Metal-green — `threeShim.js:13–17` precedent), no console line, on the least-telemetry runtime | High | Drive-and-screenshot tri-tier release gate at `?perf=low/high` on every shader-touching change (standing process gate, not one-time); `?debug` keeps errors on for authoring. | Adversary / Profiler |
| Program-COUNT leak (`prog` 54→691, `heap` 97→416, `tex` 44→147) persists after 1a → OOM tab-reload on long low/mid/mobile sessions; **high-tier desktop hides it** | High | 1b instrumentation immediately (gated `__dbg` cacheKey dump+diff); verify on `?perf=low` AND `?perf=high`; track as un-parkable until the *fix* ships. | Profiler / Adversary |
| 2a stagger desyncs the hard-overlap floor → visible NPC stacking on `?perf=low` (cluster-stack bug, `crowd.js:1010`) | Medium | Hard-overlap push stays every-frame/every-NPC; only soft steering staggers, via deterministic `(idx+frame)%N`. Only ship if measured hot. | Adversary / Auditor |
| 2b bucketing/reach-cap turns the grid superset into a subset → world shift | Medium | Ship only the fat-footprint audit; bucketing needs a second-grid for oversized entries or stays parked. | Adversary / Architect |
| 1a verified off the wrong instrument (draw/tri HUD markers, which were always green) → false "done" | Medium | Verify on perf-log `fMax`/`fAvg`/`prog` + a fresh DevTools trace (`getProgramInfoLog` gone from top-5), not the budget panel. | Profiler |
| Boot `TypeError` from the 24-site `closestBuilding` rewrite on the longest boot chain | Medium | Separate commit from 1a (bisectable); mandatory full game boot at all three tiers (sandbox can't exercise `chunks.js` gen). | Pragmatist / Auditor |
| 1b leak hunt is unbounded scope → blocks the ship if mis-scheduled | Medium | Never on Slice 1's critical path; diagnostic-first, dump before any fix, runs on its own track. | Pragmatist |
| `_params` referenced before init when lifting the debug predicate to `main.js:103` | Low | Hoist the stateless `URLSearchParams` read to module scope or duplicate it at `:103`; don't reach the `:539` local. | Auditor |

## Verdicts Summary

| Persona | Key Concern | Verdict (latest) |
| --- | --- | --- |
| Profiler | 1a fixes the symptom (stall), not the leak; the `prog`/`heap` climb is the un-parkable long-session bug high-tier hides — schedule 1b as the second real fix. | Proceed with mitigations |
| Adversary | A bare flip trades a visible freeze for a *silent* black-screen/OOM class on Safari (least telemetry, most GLSL divergence); `compileAsync` dropped as blocker, replaced by a drive-and-screenshot tri-tier gate. | Proceed with mitigations |
| Architect | The `closestBuilding`→`_fpGrid` port is the cleaner registry-side lever — but its superset-safety is a **precondition** (reuse `+ _maxFp` padding + `excludeKinds`), not an already-true fact. | Proceed with mitigations |
| Pragmatist | The plan under-weights `closestBuilding` (24-site O(n) scan); lead root cause 2 with it, ship in its own commit, park the full `compileAsync` pre-warm. | Proceed with mitigations |
| Auditor | 1c-as-disposal-fix is exonerated (don't ship on spec); the `_maxFp` superset pad is the one Critical review-gate item; bare flip + visual tri-tier verify beats the `compileAsync` coupling. | Proceed with mitigations |
