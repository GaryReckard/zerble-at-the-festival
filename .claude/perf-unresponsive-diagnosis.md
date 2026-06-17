# Perf — "page unresponsive" diagnosis + fix plan

Date: 2026-06-17
Trigger: Gary reported the live game becoming unresponsive during play — "typing
in the console gets impossible, then the page goes unresponsive after a while,"
with browser "page unresponsive" alerts. He captured **three Chrome DevTools
Performance traces** (one during star power) for analysis.

> **Project rule context:** follows
> [.claude/rules/performance.md](rules/performance.md) — match the fix to the
> symptom (allocation stall vs steady-state grind), measure before tuning. The
> instrument for confirming these over time is the **perf-log recorder**
> (`__dbg.recordPerf()` / backtick → Perf log, shipped 2026-06-17, commit
> `ed57cc6`) — watch `prog`, `geo`, `tex`, `heapMB`.

---

## Council deliberation outcome (2026-06-17)

A Tier-3 debate-mode council (`/deliberate --debate`) stress-tested this fix plan
— full record in
[deliberations/001-perf-unresponsive-fixes/results.md](deliberations/001-perf-unresponsive-fixes/results.md).
It reshaped the plan in three ways:

- **A fix not in the original plan became the slice-1 root-cause-2 win:**
  `registry.closestBuilding` (`registry.js:143-157`) is a full **O(n) scan that
  bypasses the spatial grid**, called as a placement guard from ~24 chunk-gen
  sites. Since the crowd is hard-capped (`MAX_NPCS` 180/320/500, `crowd.js:30`),
  the per-NPC separation throttle (2a) *can't* be the cost that grows "after a
  while" — `closestBuilding` is. Port it onto the existing `_fpGrid` broadphase.
- **Fix 1c is exonerated, not deferred.** Dispose-safety is honored at every
  teardown (`chunks.js:543/546/548`, `lakes.js:866`); a re-disposed material
  reuses its cache-key, so it can only cause a sync-stall (which 1a kills), never
  the *monotonic* `prog` climb. Don't ship the disposal "fix" on spec. The
  `compileAsync` pre-warm is also parked — wrong tool for an *unbounded* keyspace.
- **The `checkShaderErrors=false` production form is settled:** ship to live as a
  **bare flip**, gated `true` only under `?debug`/localStorage — *not* dev-only,
  *not* the `compileAsync` form. Safety net is a drive-across-≥4-chunks
  **screenshot at `?perf=low` AND `?perf=high`**, because with errors off a clean
  console no longer proves correctness and low tier swaps to the Lambert path
  (`threeShim.js:46-62`) = a different program population.

**CRITICAL implementation precondition for the `closestBuilding`→grid port:**
`closestBuilding` selects on `d = hypot(...) − e.footprint`, so a naive
`forEachNear(x, z, radius)` returns a **subset** and would silently drop a
large-footprint building whose center sits outside `radius` but whose edge reaches
in — flipping a seeded placement boolean and **shifting the deterministic world**.
The port MUST query `forEachNear(x, z, radius + this._maxFp, fn)` (the
`footprintsNear` pattern, `registry.js:111-112`) and keep the `- e.footprint`
min-select + `excludeKinds` inside the callback. All 26 call sites use the result
purely as a boolean guard (verified), so a set-equivalent superset-padded port is
determinism-safe.

**SECOND precondition — found during implementation, INVALIDATES the council's
"~10-line drop-in":** `registry.add()` (`registry.js:34-42`) does NOT maintain
the spatial grids; `_fpGrid`/`_colGrid` are rebuilt only ONCE PER FRAME by
`rebuildSpatialIndex()` (`registry.js:88`), whose consumers are all *post-gen*
(crowd steering, kid push-out, Zerble collision). But `closestBuilding` is called
*during* chunk generation as a placement guard against buildings added EARLIER IN
THE SAME GEN PASS (e.g. `chunks.js:1240/1243/1657` — drum circle / camp vs
clusters built moments before in the same hub). Those same-pass buildings aren't
in the once-per-frame grid yet, so a naive grid-backed `closestBuilding` returns a
SUBSET (misses them) → a placement guard wrongly passes → overlapping buildings →
a different deterministic world. The existing grid-backed `footprintsNear`/
`collidersNear` are safe only because their callers run post-gen with a fresh
grid; `closestBuilding` does not.

**Corrected Slice 1B (bigger than the council scoped):** make the grid LIVE —
`add()` inserts into `_fpGrid`/`_colGrid` and grows `_maxFp`/`_maxCol`; `remove()`
removes (needs a new `SpatialGrid.remove(x,z,item)`); the once-per-frame
`rebuildSpatialIndex()` stays for moving entries + to recompute `_maxFp` downward.
Then `closestBuilding` sees the same live set as the old linear scan →
byte-identical world. This is determinism-critical infra; gate it on the worldgen
self-test (20/20) AND a `bin/layout-snapshot` self-diff that comes back EMPTY,
not just a boot check.

## How the traces were read

`Trace-*.json.gz` (gitignored — large) decompressed and parsed with a throwaway
node script that (1) pulls the longest top-level `RunTask` events and (2)
aggregates CPU-profile self-time per function, then attributes each long task's
samples back to functions. Two independent costs fell out, both reproduced
across all three sessions.

| Session | `forEachNear` (steady) | `getProgramInfoLog` (storms) | worst single task |
|---|---|---|---|
| 205426 (longest) | **15.1 %** (9.1 s) — #1 | not in top 5 | 928 ms |
| 205630 | **21.7 %** (6.6 s) — #1 | 8.4 % (2.5 s) | 565 ms |
| 210835 (star power) | 18.6 % (6.0 s) | **12.6 %** (4.0 s) | **3× ~1000 ms** |

---

## Confirmation — 160 s foreground perf-log capture (2026-06-17)

Gary ran the perf-log recorder for ~160 s of real play (foreground, real GPU —
so frame numbers are healthy, 35–50 fps, unlike the headless traces). It
confirms both root causes and **sharpens #1 from "first-compile stalls" into a
genuine shader-program *leak*:**

- **`prog` (live shader-program count): 54 → 691, monotonic, never recovers.**
  Each jump (+30 to +60 in one second) lands exactly on a frame spike — `prog`
  55→115 at t=6 s with `fMax` 313.8 ms; →401 at t=33 s with 245 ms; 538→601 at
  t=126–127 s with 207/199 ms. ~691 *distinct* shader cache-keys alive and still
  climbing at capture end.
- **`geo` oscillates 4027 ↔ 9638** with chunk load/unload and returns —
  **geometry disposal is healthy; the leak is materials/programs, not geometry.**
- **`heapMB`: 97 → 416** with GC sawtooth (drops to ~180/238) but a *rising
  floor* → a partial heap leak riding along.
- **`tex`: 44 → 147**, climbing, doesn't recover (secondary).
- **`fAvg` ~20–32 ms even parked**, at ~3000–4100 colliders — the steady floor
  that is root cause 2 (`forEachNear`).

**Implication for the fix:** `checkShaderErrors = false` (below) kills the
per-link *sync stall* — the spike mechanism — regardless. But the program-*count*
leak is a **separate bug**: something mints new distinct shader cache-keys as you
explore and never releases them. It is **NOT** the color-keyed material pools
(`tent.js` `_CLOTH_MATS`, `puppet.js` `_npcMatPool`, `foodTruck.js`
`_bodyMatPool`) — those vary only `color`, a *uniform*, so they share one
program — nor the crowd/wook tie-dye (constant `customProgramCacheKey`). Finding
the real source needs its own pass: dump `renderer.info.programs[].cacheKey`
periodically and diff to see which configs proliferate (suspect a `#define`-level
variation — `flatShading`/`vertexColors`/map-presence/light-count mix — or an
`onBeforeCompile` whose cache-key varies). Don't guess without that dump.

## Root cause 1 — the freezes: synchronous shader compile/link storms

**Evidence:** every main-thread task over 150 ms is **~88 % `getProgramInfoLog` +
`getShaderInfoLog`**, with `replaceLightNums` / `cloneUniforms` / `shaderSource`
underneath (= three.js assembling brand-new `WebGLProgram`s). These are the
synchronous "block the main thread until the GPU driver finishes linking this
program" calls. A 1-second task is a back-to-back wave of program links.

**Why it's happening:** `renderer.debug.checkShaderErrors` is **never set
anywhere in `src/` → it defaults to `true`.** With it on, three.js calls
`getProgramParameter(LINK_STATUS)` + `getProgramInfoLog` synchronously after
*every* program link, forcing a GPU sync-stall per program. Ruled out:
light-count-change recompiles — `PERF.contextLights` is off by default
([perf.js:126](../src/perf.js#L126)), so the campfire/star `PointLight`s that
would bump `NUM_POINT_LIGHTS` and recompile the whole scene aren't being added
unless Gary toggled the Lights opt-in.

**Why star power is worst:** it introduces extra material churn (the rainbow
`onBeforeCompile` patch's `customProgramCacheKey` variant on the cart materials,
plus whatever new clusters stream in during the run) — more first-render program
compiles, each paying the sync stall.

### Fix plan (highest leverage first)

1. **`renderer.debug.checkShaderErrors = false`** after boot — kills the
   synchronous `getProgramInfoLog`/`getShaderInfoLog` stall outright (the 88 %).
   Cheap, reversible, well-trodden three.js production guidance. Keep it `true`
   on a dev flag (`?debug`) so shader authoring still surfaces compile errors.
   - **Risk/verify:** a genuinely broken shader now fails silently (black/no
     draw) instead of logging. Mitigate by gating on the existing debug flag.
     Verify on `?perf=low/mid/high`; re-capture a trace and confirm the
     `getProgramInfoLog` spikes are gone.
2. **Cut the *number* of new programs.** Pool materials so identical clusters
   share a cached program (the pooling rule —
   [.claude/rules/perf-pooling.md](rules/perf-pooling.md)). Audit for
   **mis-disposed shared materials** (footgun in
   [rules/performance.md](rules/performance.md)): a chunk unload disposing a
   `userData.shared` material forces a recompile when the next chunk reuses it.
3. **Optional:** `renderer.compileAsync(scene, camera)` / pre-warm the common
   programs at boot so the first-encounter stalls happen behind the title card,
   not mid-drive.

---

## Root cause 2 — the grind: `forEachNear` neighbor queries

**Evidence:** `forEachNear` ([spatialGrid.js:48](../src/spatialGrid.js#L48)) is
the **#1 CPU cost in all three sessions (15–22 %)** — independent of the freezes.
Callers:
- [crowd.js:1015](../src/crowd.js#L1015) — per-NPC separation steering, run for
  every NPC every frame → O(n·k).
- [registry.js:112](../src/registry.js#L112) / [:117](../src/registry.js#L117) —
  per-frame collision + `closestBuilding` queries.

**Why it degrades over time:** cost scales with resident entity count, which
climbs as you drive — the captured sessions hit **~3000 registry entries /
~2867 colliders**. The world never gets lighter while you explore, so the main
thread saturates progressively. That's the "console gets impossible to type in
after a while" symptom — not a leak, a *grind* that grows with world residency.

**Amplifier to check:** the registry query radius is `reach + this._maxFp` /
`reach + this._maxCol` ([registry.js:112–117](../src/registry.js#L112)). A single
oversized footprint/collider inflates `_maxFp`/`_maxCol`, which widens the
scanned cell block (`cr = ceil(radius / cellSize)`) for *every* query. Worth
auditing the largest footprint in the registry.

### Fix plan

1. **Throttle per-NPC separation.** Don't run a full neighbor scan for every NPC
   every frame — stagger across frames (round-robin a fraction of the crowd per
   frame), and/or skip NPCs far from the player / off-screen.
2. **Audit `_maxFp` / `_maxCol`.** If one giant cluster footprint is inflating
   every query radius, bucket colliders by size or cap the query reach.
3. **Re-measure after each** with the perf-log recorder — `forEachNear` self-time
   should drop in a fresh trace; confirm the crowd still separates / collides.

---

## Secondary (not the unresponsiveness cause)

The `[chunk slow]` console spam ([chunks.js:339](../src/chunks.js#L339)) is a
gen-time warning when a chunk exceeds the 8 ms budget (`SLOW_THRESHOLD_MS`).
Real, and it contributes to driving jank — but chunk-gen does **not** appear in
the CPU top, and it is *not* the freeze. The freeze is the shader storm that
fires at first-render of the new chunk's materials, right after the gen the
warning measures. Reduce it eventually (cluster build cost), but it's downstream
of root cause 1.

---

## Status — council-resolved sequencing

- **Slice 1 (ship now, two commits, one wave):** (A) `checkShaderErrors = false`
  bare-flip, debug-gated; (B) `closestBuilding`→`_fpGrid` broadphase with the
  `_maxFp` superset guard above. Two commits so each verifies off a different
  line of the same trace re-capture (`fMax` vs `closestBuilding`/`[chunk slow]`).
- **Slice 2 (measure-gated):** `_maxFp` audit (2b), then the separation throttle
  (2a) — only if Slice 1's trace still shows `forEachNear`/`crowd.js:1015` hot.
  The throttle must split the load-bearing hard-overlap push (`crowd.js:1010`,
  every frame) from the soft steering (stagger), and use a deterministic
  round-robin (`(idx+frame)%N`), never `Math.random()`.
- **Group 3 (un-parkable, own track):** the program-count leak (1b). Stand up a
  gated `__dbg` `renderer.info.programs[].cacheKey` dump now (extends the
  `recordPerf` recorder); investigate with star power OFF first to isolate. 1a
  removes the player-visible stall today, but the leak is a long-session OOM
  vector on low/mid/mobile that high-tier desktop hides — release-tracked.
- **Parked on ROADMAP:** both `1c` variants (disposal "fix" exonerated;
  `compileAsync` pre-warm is the wrong tool for an unbounded keyspace).

Verify everything off the **perf-log recorder + a DevTools trace**, never the
draw/tri HUD budget markers — neither root cause is a geometry-budget problem,
so those markers are green and were never the bottleneck.
