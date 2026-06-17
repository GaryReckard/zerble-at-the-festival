# Profiler — Round 1 Position

## The Profiler's Position

I evaluate the fix plan against per-tier draw/tri budgets (low 80/150k, mid
200/400k, high 400/1.2M), the allocation-vs-steady-state model, and low/mid-tier
risk — and specifically **whether each fix will actually move a HUD number, and
by how much.**

The headline framing first: **neither root cause is a draw/triangle budget
problem.** The backtick HUD `draws`/`tris` markers are almost certainly *green*
in these sessions. The diagnosis is explicit — `geo` oscillates healthily
4027↔9638 (`perf-unresponsive-diagnosis.md:46`), so geometry/draw budgets are
fine. The two real costs are (1) **program/heap leak + sync-link stalls** (the
`prog` 54→691 climb and `getProgramInfoLog` storms) and (2) **a CPU steady-state
grind** (`forEachNear`, 15–22%). Both are *off-budget-panel* costs: the HUD draw/
tri markers won't show either. That matters for verification — see "Will it move
the HUD numbers" below. The right instrument here is the **perf-log recorder**
(`prog`/`heapMB`/`fAvg`), not the draw/tri budget markers.

### Priority Sequence

1. **1a — `renderer.debug.checkShaderErrors = false`, gated on `?debug`.**
   Highest leverage, lowest risk, zero geometry/draw delta. Kills the *sync
   stall* mechanism (the 88% `getProgramInfoLog`/`getShaderInfoLog` in every
   >150ms task) regardless of how many programs get compiled. This is the
   single change that most directly removes the "page unresponsive" alert,
   because the alert is fired by main-thread tasks blocking on GPU link sync,
   not by frame rate. Ship first, measure with a re-captured trace.

2. **2a — throttle/stagger per-NPC separation (`crowd.js:1015`).** This is the
   #1 CPU self-time cost (15–22% in *all three* sessions —
   `perf-unresponsive-diagnosis.md:26-30`) and it's a pure steady-state grind
   that grows with residency. It's the "console gets impossible to type in after
   a while" symptom. Round-robin a fraction of the crowd per frame and skip far/
   off-screen NPCs. Bounded crowd (`MAX_NPCS = PERF.crowdMax`, 180/320/500 —
   `perf.js:59/79/94`, `crowd.js:30`) so the win is bounded but real on low/mid.

3. **1b — hunt the program-count leak.** The `prog` 54→691 monotonic climb
   (`perf-unresponsive-diagnosis.md:41`) is the *long-session* killer; 1a hides
   its symptom (the stall) but the leak still bloats `heapMB` 97→416 with a
   rising GC floor and `tex` 44→147. On a long enough session, or on a
   memory-constrained mobile device, that heap floor is its own crash vector
   (iOS especially). Must be a separate pass — dump
   `renderer.info.programs[].cacheKey` and diff, exactly as proposed. Do NOT
   guess a fix before the dump.

4. **2b — audit `_maxFp`/`_maxCol` radius inflation (`registry.js:112/117`).**
   Cheap, high-upside if one oversized footprint exists, but verify it's real
   before acting (see below — I'm skeptical it's the dominant cost). One-variable
   rule: don't bundle this with 2a or you can't attribute the win.

5. **1c — `compileAsync` pre-warm / pooling audit.** Park to ROADMAP unless 1b
   surfaces a specific mis-disposed shared material. `compileAsync` only helps
   the *first-encounter* stall, which 1a already de-fangs; it does nothing for
   the *count* leak (the actual programs still get created). Lowest leverage of
   the set.

### Performance Risks Identified

| Risk | Type | Severity | Trigger Condition |
| ---- | ---- | -------- | ----------------- |
| `prog` 54→691 leak persists after 1a; heap floor 97→416 keeps climbing | SteadyState (memory) | High | Long session, esp. low-memory mobile / iOS — OOM crash, not just slowdown |
| 1a masks a genuinely broken shader → black/no-draw with no console error | Steady-state correctness | Medium | A future shader edit ships broken; only reproduces silently on production tier |
| `forEachNear` win from 2a is bounded by `crowdMax`, not by the 3000 colliders | SteadyState (CPU) | Medium | Crowd is capped; the residency growth is mostly *registry* entries, not NPCs — see note |
| 2b/`_maxFp` inflation may be a red herring; `closestBuilding` is the real O(n) | SteadyState (CPU) — alloc-time | Medium | Chunk gen, not steady drive — wrong-symptom fix risk |
| Heap leak + adaptiveQuality interaction: AdaptiveQuality drops pixel ratio chasing a CPU/GC stall it can't fix | SteadyState | Low | adaptiveQuality.js:136 hitch-detector fires on the 200ms+ link stalls and degrades visuals pointlessly |

### Will it actually move the HUD numbers? (per fix)

- **1a:** Moves **`fMax`/`fAvg`** in the perf-log recorder dramatically (kills the
  314/245/207ms spikes). Moves **nothing** on the draw/tri budget markers — and
  that's expected; don't look for it there. Verification instrument = perf-log
  `fMax` trend + a fresh DevTools trace showing `getProgramInfoLog` gone from the
  top-5. **Do not** declare it done off the backtick draw/tri panel; those were
  never the problem.

- **2a:** Moves **`fAvg`** (the steady floor, ~20–32ms parked,
  `perf-unresponsive-diagnosis.md:51`) down. Bounded by `crowdMax`: at low tier
  180 NPCs × ~9-cell scan, the absolute saving is smaller than at high (500), but
  low tier is *also* where the CPU headroom is thinnest, so proportionally it's
  the most valuable tier to fix. Verify via `forEachNear` self-time dropping in a
  re-captured trace, per the diagnosis's own success criterion
  (`perf-unresponsive-diagnosis.md:139`).

- **1b:** Moves **`prog`** (the leak metric) and **`heapMB`** floor — the two
  numbers that actually represent the long-session bug. This is the only fix that
  touches them. No draw/tri delta.

- **2b:** If real, moves **`fAvg`** by shrinking `cr = ceil(radius/cellSize)`
  (`spatialGrid.js:50`) for every collider/footprint query. If the oversized
  footprint doesn't exist, moves nothing — measure `_maxFp`/`_maxCol` live first.

### Allocation vs steady-state — matching fix to symptom

The diagnosis cleanly separates these and I concur, with **one sharpening the
plan should not miss**:

- **Steady-state grind (root cause 2):** the *named hot path* is
  `forEachNear` via the **grid** — `crowd.js:1015` (`_sepGrid`, NPC-only),
  `main.js:1041` (Zerble collision, `collidersNear`), `crowd.js:2146`
  (`footprintsNear`). These are bounded by crowd count and local cell density —
  the grid is doing its job. 2a + 2b target these correctly.

- **Allocation/gen-time cost — under-weighted in the plan:**
  `registry.closestBuilding` (`registry.js:143`) is a **full O(n) linear scan
  over `this.entries.values()`** — it does **not** use the spatial grid at all.
  It's called ~20 times across `chunks.js` worldgen (e.g.
  `chunks.js:499/1068/1240/2071/2481`), `forests.js:909`, `lakes.js:711`,
  `obstacles.js:1114`, `starPower.js:415`. At 3000+ entries, each
  `closestBuilding` is a 3000-iteration scan, and chunk gen calls it dozens of
  times per chunk. **This is the most likely real driver of the
  `[chunk slow]` >8ms spam** (`chunks.js:339`, flagged "secondary" in the
  diagnosis) — and `starPower.js:415` calls it in a loop during star power, which
  is exactly the worst-trace session (`perf-unresponsive-diagnosis.md:30`). This
  is an *allocation-time* O(n²)-ish cost that grows with residency, distinct from
  the steady `forEachNear` grind. The diagnosis names it as downstream/secondary;
  from a budget lens I'd flag it as a **strong ROADMAP candidate** (port
  `closestBuilding` to the existing `_fpGrid` broadphase — it's a drop-in, the
  grid already indexes footprints) but **not** part of this hang fix, because the
  hang is the link stall + the steady grind, not gen jank. Match the fix to the
  symptom: don't smuggle a `closestBuilding` rewrite into the hang patch.

### Low / mid-tier risk

- **1a is tier-neutral and *safest on low/mid*** — it removes work, adds none.
  No material-tier interaction (it's a renderer debug flag, orthogonal to the
  `threeShim.js` Lambert swap and to `MeshStandardMaterial`). No `castShadow`
  delta. No new draws. The only tier-specific concern is the broken-shader-goes-
  silent risk, which is *more* dangerous on low tier specifically: the Lambert
  swap (`threeShim.js:46-67`) means low tier compiles *different* programs than
  mid/high, so a shader that's broken only on the Lambert path would, post-1a,
  fail silently on exactly the tier least likely to be tested. The `?debug`
  gate plus "verify on `?perf=low/mid/high`" (already in the diagnosis,
  `perf-unresponsive-diagnosis.md:96`) covers this — make that an explicit
  acceptance check, not a suggestion.

- **2a helps low/mid most** — they have the least CPU headroom and the crowd is
  still 180/320 NPCs each running a full neighbor scan every frame.

- **The heap leak (1b deferred) is a low/mid-and-mobile risk, not a high-tier
  one** — `heapMB` 416 and `tex` 147 climbing is an OOM vector on integrated/
  mobile GPUs and iOS (the project already caps textures at 1024 for the iOS
  >2048 crash risk, `.claude/rules/performance.md`). High-tier desktop hides it.
  This is the classic "high tier hides the regression" trap — so 1b cannot be
  parked *indefinitely*; it's the real long-session bug for the players on the
  quiet tiers.

### Production question — ship `checkShaderErrors = false` to live, or dev-only?

**Ship it to production live, gated so it is `true` only under `?debug`.** This
is the correct call from a perf lens, and it is standard three.js production
guidance for exactly this reason. Reasoning:

1. **The cost is real and player-facing on the live deploy.** The diagnosis was
   captured against the live game; real GA4 players experience the
   "page unresponsive" alert. Keeping the sync-link stall on in production to
   preserve dev-only error logging would be optimizing for the developer at the
   player's expense — backwards.

2. **The downside is contained.** The only loss is that a *genuinely broken
   shader* fails silently (black/no-draw) instead of console-logging. In this
   codebase the shader surface is small and stable: the `threeShim.js` Lambert
   swap, the Trip `ShaderPass` (`main.js:133`), FXAA (`main.js:140`), the
   star-power `onBeforeCompile` rainbow patch. None of these change at runtime in
   production; they're authored and locked at ship time. The risk window is "a
   future shader edit ships broken," which is a *dev-time* event — and dev runs
   with `?debug` (or can), where `checkShaderErrors` stays `true`. The flag
   surfaces errors exactly when a human is authoring shaders, and suppresses the
   per-link sync stall exactly when a player is driving. That's the right split.

3. **Mitigation to make it bulletproof:** keep `true` under `?debug` (as
   proposed), and additionally run the existing `?perf=low/mid/high` boot smoke
   check as a *release gate* whenever a shader-touching change ships — because
   post-1a, the low-tier Lambert program path is the one place a silent break
   could hide. That's a process mitigation, not a code one.

I would **not** restrict this to dev-only. Dev-only would leave the production
players — the ones actually hitting the unresponsive alert — unprotected, which
defeats the entire fix.

### Budget Estimate

- **Draw delta:** **0** across all proposed fixes. None add geometry, meshes, or
  passes. The backtick draw markers are unaffected and were never the problem.
- **Triangle delta:** **0**. Same.
- **Cost type:** This whole plan targets **steady-state CPU** (`forEachNear`),
  **steady-state main-thread blocking** (sync shader link), and a
  **steady-state memory leak** (`prog`/`heapMB`). Zero allocation-stall-on-spawn
  content here — except the *separately-flagged* `closestBuilding` gen cost,
  which I recommend parking to ROADMAP, not folding in.
- **Low/mid-tier verdict:** **Safe to proceed.** 1a removes work tier-
  neutrally; 2a helps the quiet tiers most. The one watch-item is the heap leak
  (1b) being a low/mid-and-mobile OOM risk that high-tier hides — so 1b must be
  scheduled, not indefinitely parked. No instancing/pooling change is required
  for the hang fix itself; the existing crowd InstancedMesh
  (`crowd.js:234-240`) and material pools are not implicated by the diagnosis.

### Verdict

- **Verdict:** **Proceed with mitigations.**
- **Key Concern:** **1a fixes the *symptom* (the stall) but not the *leak*.**
  The `prog` 54→691 / `heapMB` 97→416 climb is a real long-session memory bug
  that 1a hides — and it bites hardest on low/mid/mobile, the tiers high-end
  desktop testing won't catch. 1b (the cache-key dump) cannot be parked
  indefinitely; schedule it as the second real fix, not an optional.
- **Recommendation:** Ship **1a to production** (gated `true` on `?debug`) —
  highest leverage, zero budget delta, correct dev/player split — and **2a**
  (crowd separation throttle) in the same wave, since it's the #1 steady-state
  CPU cost on exactly the tiers with the least headroom. Verify both via the
  **perf-log recorder** (`fMax`/`fAvg`/`prog`) and a re-captured trace, **not**
  the draw/tri HUD markers — those were never the bottleneck. Treat **1b** as the
  required follow-up (the actual leak), **2b** as a measure-first cheap audit,
  and **1c** + the `closestBuilding`→grid port as ROADMAP. Do not bundle the
  `closestBuilding` rewrite into the hang patch — it's an allocation-time fix for
  a different symptom (chunk-gen jank), and folding it in breaks the one-variable
  rule for verifying the steady-state win.

## Round 2 — Reactions

I read all four other positions. Two genuine conflicts land squarely in my
domain — the Pragmatist's `closestBuilding` re-sequencing vs. my 2a, and the
Adversary's `compileAsync` coupling on 1a. I concede on one, sharpen on the
other, and revise my sequencing.

### (a) Pragmatist Finding 1 + Critical-Path step 3 — `closestBuilding` belongs in the FIRST ship slice, and 2a is NOT the unbounded grind. **CONCEDED, and it strengthens a point I half-made myself.**

The Pragmatist (Finding 1, lines 34–54) and Adversary (line 41) both argue that
`closestBuilding` (`registry.js:143-157`) is a **full O(n) linear scan over
`this.entries.values()`** that does *not* touch the spatial grid — and that the
crowd is hard-capped (`MAX_NPCS = PERF.crowdMax` 180/320/500, `crowd.js:30`,
`perf.js:59/79/94`), so per-NPC separation **cannot** be the cost that grows
"after a while."

I verified both claims directly. `closestBuilding` at `registry.js:146` is
`for (const e of this.entries.values())` — a raw linear scan, confirmed; its
siblings `footprintsNear`/`collidersNear` (`registry.js:111-118`) go through
`_fpGrid`/`_colGrid.forEachNear`, it does not. And it's hit from **24 sites**
(`rg` count): 18 in `chunks.js`, plus `forests.js:909`, `lakes.js:711`,
`obstacles.js:1114`, `starPower.js:415` — exactly the placement-guard density
they describe.

**This breaks my own one-variable framing, in my favor.** In Round 1 I flagged
`closestBuilding` myself (lines 105–122) as "the most likely real driver of the
`[chunk slow]` spam" and "an allocation-time O(n²)-ish cost that grows with
residency" — but I parked it to ROADMAP and explicitly said "do not smuggle the
`closestBuilding` rewrite into the hang patch… folding it in breaks the
one-variable rule for verifying the steady-state win." The Pragmatist's
correction is that my one-variable objection points the *wrong* way: 1a and the
`closestBuilding` broadphase touch **different instruments** (1a → `fMax` spike
mechanism / `getProgramInfoLog`; `closestBuilding` → `forEachNear`-class
self-time + `[chunk slow]` warnings), so bundling them in one commit does NOT
confound attribution — each shows up in a different line of the re-captured
trace. The thing that *would* confound is bundling `closestBuilding` **with 2a**,
because both move `forEachNear`-class self-time and I couldn't tell which paid
off. So the correct split is the opposite of what I proposed: ship
`closestBuilding` in the first wave (it's the bigger, residency-growing O(n)
grind), and *defer 2a* until the trace proves NPC separation is still hot.

On "is 2a the unbounded grind" — **no, conceded.** A capped crowd is a bounded
cost; my Round-1 risk-table row already said as much ("`forEachNear` win from 2a
is bounded by `crowdMax`… the residency growth is mostly *registry* entries, not
NPCs"). The Pragmatist drew the obvious conclusion I didn't: if the cost that
grows monotonically with exploration is registry entries (~3000→4100), then the
O(n)-over-registry scan (`closestBuilding`) — not the O(capped-crowd) scan (2a) —
is the residency-driven grind. **2a moves to measure-gated.** It still has the
best *per-tier-headroom* profile on low/mid if it's hot, but the Pragmatist is
right that it's likely a small remaining sliver once the registry-side O(n) work
is gone, and it carries the cluster-stack regression risk
(`crowd.js:1010`) that the registry broadphase does not.

**One caveat I hold against the Pragmatist** (not a rebuttal, a budget refinement):
the `closestBuilding` broadphase is an **allocation-time / gen-time** fix
(`[chunk slow]` is chunk generation), not the steady-state-parked grind. My
Round-1 allocation-vs-steady-state separation still stands: it will NOT move
`fAvg` while *parked* — it moves the spawn-stall on boost into new territory and
the `starPower.js:415`-in-a-loop session (the worst trace). So the win is real
and belongs in slice 1, but verify it on the **right instrument**: `[chunk slow]`
warning frequency + `closestBuilding`/`forEachNear` self-time during *driving
into fresh chunks*, not the parked `fAvg` floor. Matching the fix to the symptom
cuts both ways — don't claim a parked-FPS win from a gen-time fix.

### (b) Adversary line 37/53–70 — 1a must NOT be a bare flag flip; couple it with a boot-time `compileAsync` pre-warm (with `checkShaderErrors` still true) before flipping to false. **PARTIALLY CONCEDED — the safety goal is right; the `compileAsync` mechanism is the wrong tool for it, and the Architect proves why.**

The Adversary's worry (line 33–37) is real and I share it: with
`checkShaderErrors=false`, a shader that compiles on Chrome/ANGLE but fails on
Safari Metal ships a **silent black object** to the runtime with the least
telemetry and the most GLSL divergence (`threeShim.js:13-17`). I agree the bare
flip is insufficient; I said so in Round 1 (the broken-shader-goes-silent risk,
"more dangerous on low tier specifically" because of the Lambert program path).

But the Adversary's *fix* — pull 1c's `compileAsync` forward as the enabler,
pre-warm the core program set with `checkShaderErrors` true, then set false — is
the wrong instrument, and the Architect (lines 122–131) and my own Round-1
analysis (lines 53–57) already establish why: **`compileAsync` validates only
the materials currently in the scene at boot.** The leak is an *unbounded,
streaming-minted* keyspace (`prog` 54→691 monotonic, minted from chunks that
don't exist at boot). So a boot-time pre-warm validates the spawn-hub program set
and nothing else — every program minted while *driving* (the ones most likely to
diverge on Metal, since they include streaming worldgen materials) still gets
created with `checkShaderErrors=false` and still fails silently. `compileAsync`
pre-warm closes the boot window and leaves the streaming window — which is the
larger window — wide open. It gives a *false sense* of Safari coverage.

So I **reject `compileAsync` as the mitigation** but **accept the underlying
requirement**. The right mitigation is the one three of us converged on
independently (my Round-1 lines 173–176, Architect 162–169, Auditor 131–137):
the **visual three-tier boot smoke check as a release gate** — boot
`?perf=low/mid/high` and confirm the scene *renders* (not just a clean console,
which is now mute on shader failure), every time a shader-touching change ships.
That actually covers the Lambert-path divergence the Adversary is worried about,
because it exercises the real low-tier program population, and it's a *process*
gate that doesn't ship a misleading partial-coverage code path. `compileAsync`
can still land later as a boot-stall smoother **once 1b proves the keyspace is
bounded** (Architect line 129) — but it is not a Safari safety mechanism and must
not be sequenced as 1a's enabler.

Net on the production question: I do not move off "ship 1a to production, gated
`true` on `?debug`." The Adversary's Block-without-`compileAsync` stance over-
indexes on a mechanism that doesn't cover the streaming case. The release-gate
smoke check is the correct, sufficient mitigation.

### Final sequencing call

Revised from Round 1 (the change is promoting `closestBuilding` into slice 1 and
demoting 2a to measure-gated):

1. **1a — `checkShaderErrors=false`, gated `true` on `?debug`, shipped to
   production.** Highest leverage, zero budget delta. Mitigation = visual
   three-tier (`?perf=low/mid/high`) boot render check as a release gate, NOT
   `compileAsync`. Verify via perf-log `fMax` + a fresh trace (`getProgramInfoLog`
   gone from the top-5).
2. **`closestBuilding` → `_fpGrid.forEachNear` broadphase.** *Promoted from
   ROADMAP into slice 1.* This is the residency-growing O(n) grind (24 call
   sites), the grid superset guarantee makes it determinism-safe, and it does not
   confound 1a's instrument (different trace lines). Bundle with 1a in one commit
   per the Pragmatist's slice-1 — they verify on one trace re-capture and don't
   confound each other. **Verify on the gen-time instrument** (`[chunk slow]`
   frequency + self-time while driving into fresh chunks), not the parked `fAvg`.
3. **1b — program-count leak hunt** (cacheKey dump/diff, `__dbg`-gated). Still the
   required follow-up — it's the only fix that touches `prog`/`heapMB`, the
   long-session OOM vector on low/mid/mobile that high-tier hides. Not a slice-1
   blocker; runs on its own track after 1a's trace.
4. **2b — `_maxFp`/`_maxCol` audit.** Measure-first, cheap. Only if slice-1's
   trace still shows `forEachNear`-class cost.
5. **2a — per-NPC separation throttle.** *Demoted to measure-gated.* Bounded by
   `crowdMax`, behaviorally risky (cluster-stack, `crowd.js:1010`). Only if the
   trace still shows `crowd.js:1015` hot after slice 1. If staggered, hard-overlap
   push stays every-frame, only soft steer round-robins, and the partition is a
   deterministic `(idx+frame)%N` — never `Math.random()`.
6. **1c — `compileAsync` pre-warm / pooling.** ROADMAP. Not a leak fix, not a
   Safari safety mechanism; ships as a boot-stall smoother only after 1b proves a
   bounded keyspace.

### Verdict (revised)

- **Verdict:** **Proceed with mitigations.** (Unchanged.)
- **Key Concern (revised):** My Round-1 sequencing under-weighted
  `closestBuilding`. The Pragmatist is right that it — not per-NPC separation
  (2a) — is the residency-growing O(n) grind, and that my one-variable objection
  to bundling it was aimed the wrong way (it shares no instrument with 1a, so
  bundling those two doesn't confound; bundling it with *2a* would). The leak
  (1b) remains the un-parkable long-session bug high-tier hides.
- **What moved me:** (1) The Pragmatist's `closestBuilding`-over-2a argument —
  **verified in code** (`registry.js:146` raw scan, 24 call sites) — moved it
  from my ROADMAP into slice 1 and demoted 2a to measure-gated. (2) The
  Adversary's coupling argument moved me halfway: it correctly identifies that 1a
  needs a Safari mitigation, but `compileAsync` is the wrong one (validates only
  the boot program set, leaves the larger streaming-minted keyspace silent) — the
  visual three-tier boot render gate is the right, sufficient mitigation. I did
  not move off "ship 1a to production, debug-gated."
