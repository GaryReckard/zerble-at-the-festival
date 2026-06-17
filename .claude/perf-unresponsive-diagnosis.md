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

**Slice 1B — SHIPPED (the corrected, LIVE-grid version).** `add()` now inserts
into `_fpGrid`/`_colGrid` and grows `_maxFp`/`_maxCol` monotonically; `remove()`
removes via a new `SpatialGrid.remove(x,z,item)`; the once-per-frame
`rebuildSpatialIndex()` stays (moving entries + resets `_maxFp` to the exact frame
max). `closestBuilding` queries `_fpGrid.forEachNear(x, z, radius + _maxFp, fn)`
and keeps the `- e.footprint` min-select + `excludeKinds` in the callback, so it
returns the same set the old O(n) scan did. The change adds only grid side-effects
(no rng, no change to `entries` insertion order or the boolean guards) → the rng
stream and gen order are untouched → byte-identical world.

Verification (all green):
- **`bin/test-registry-grid`** (node, committed) — imports the REAL `registry.js`
  and fuzzes 6000 randomized registries / 36000 queries (varied kinds incl `tree`,
  footprints 0–15, colliders, **random removals**, post-rebuild states): grid
  `closestBuilding` == linear scan on **both** boolean result and exact min
  edge-distance, zero mismatches. Stronger than any single-seed snapshot — it
  proves equivalence for arbitrary states, including the chunk-unload removal path
  the council's naive "drop-in" lacked.
- **Worldgen self-test** — 23/24, byte-identical with my edits stashed vs applied
  (the 1 miss is a pre-existing road negative-control sample quirk for seed 0;
  `worldgen/` doesn't import `registry.js`, so it's outside this change's graph).
- **Game boot** (`?perf=low`, real `chunks.js` gen path) — `__dbg.start()` →
  world generated **1839 entries** (closestBuilding ran hundreds of times as a
  placement guard without throwing), **0 console errors**, renders coherently
  (no clipping/overlap) at low tier (Lambert path).
- **NOT run here: the `bin/layout-snapshot` self-diff** — agent-browser cannot
  load the heavy `?worldgen=1&perf=high` snapshot page headless in this Codespace
  (`agent-browser open` times out; documented limitation). The node fuzz proof
  stands in for it (strictly stronger); recommend Gary run the snapshot diff once
  in a real browser as belt-and-suspenders: `bin/layout-snapshot capture 1234`
  then `bin/layout-snapshot --diff verification/snapshots/baseline/1234.json
  verification/snapshots/1234.json` → expect EMPTY.

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
explore and never releases them.

**RESOLVED 2026-06-17 (the dump + a controlled repro).** Built the diagnostic the
last paragraph asked for — `__dbg.dumpPrograms()` (groups `renderer.info.programs`
by material family, surfaces the varying cacheKey token). Findings:
- **The default path is NOT clean (correction).** An early `gotoHub(0..7)` teleport
  tour read flat ~130–131, which suggested the default was leak-free — but that was
  a discrete teleport sample (not sustained driving) on an unreliable headless
  renderer, so don't trust it. The reason it's NOT clean: **stage beams
  ([stage.js:192](../src/models/stage.js#L192)) and drum-circle fires
  ([leafDrumCircle.js:200](../src/models/leafDrumCircle.js#L200)) call
  `registerContextLight` UNCONDITIONALLY** — no `PERF.contextLights` gate (unlike
  campsite/Sugar-Shack/campfire, which are gated). So `contextLights.update()`
  distance-culls those stage/drum lights by toggling `.visible` even in the shipped
  default, churning `NUM_SPOT/POINT_LIGHTS` during sustained driving past hubs. The
  opt-in feature just *adds more* sources (campsite/shack), making the worst case
  (13→220) — but the default churns too, more slowly.
- **Ruled out** (static + dump): unguarded `onBeforeCompile` (all three —
  crowd/wook/star — carry a constant/bounded `customProgramCacheKey`), `defines`
  (none in `src/`), varying `customProgramCacheKey`, and the color-keyed pools
  (`color` is a uniform). Cart lights (headlight/disco/wheel) never toggle
  `.visible`.
- **The climb is the opt-in `contextLights` culler — CONFIRMED LIVE.** The old
  `contextLights.update()` culled cluster lights via `light.visible = false/true`.
  In three.js an invisible light is dropped from the scene's light list →
  `NUM_POINT_LIGHTS` / `NUM_SPOT_LIGHTS` changes → **every material recompiles**,
  and each new (light-count × material-config) combo is cached forever. Driving
  past clusters oscillates the count → the monotonic program climb. `PERF.contextLights`
  is **off by default** ([perf.js:126](../src/perf.js#L126)); the 691 was captured
  with it enabled. Gary confirmed in a real browser (Lights ON): `dumpPrograms`
  showed `physical #56` climb **13 → 21 → 220** across a `gotoHub` tour — exactly
  the one-family-many-variants recompile signature.
- **FIX SHIPPED 2026-06-17 — a CONSTANT scene light count.** `contextLights.js`
  now keeps a **fixed pool of 6 PointLights + 6 SpotLights**, always in the scene,
  always visible, so `NUM_*_LIGHTS` never changes and the cache stops growing. The
  model-owned lights become invisible param/transform carriers; each frame the
  nearest few are copied (position, colour, intensity, spot aim) into the pool
  slots, unused slots dimmed to intensity 0. Constant cost = the 12-light pool
  (the budget this system always meant to cap at, held steady not wobbling).
  Every `register()` call site is untouched. Opt-in-only path, so it never
  affected the shipped default. (ON-case empirical re-confirm with the fix is a
  manual gate for Gary — agent-browser can't set `localStorage`/boot the WebGL
  page headless.)
- Secondary `tex 44→147`: per-cluster CanvasTextures (campsite tapestry) — but
  those are chunk-unload-disposed (not `userData.shared`) and `leafBanner` caches
  by color key, so it's bounded by resident clusters, not an unbounded leak.

Original note retained for context — it is **NOT** the color-keyed material pools
(`tent.js` `_CLOTH_MATS`, `puppet.js` `_npcMatPool`, `foodTruck.js`
`_bodyMatPool`) nor the crowd/wook tie-dye (constant `customProgramCacheKey`).

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

- **Slice 1 — SHIPPED.** (A) `checkShaderErrors = false` bare-flip, debug-gated
  (commit `84569fb`); (B) `closestBuilding`→`_fpGrid` LIVE broadphase with the
  `_maxFp` superset guard above — see the "Slice 1B — SHIPPED" block earlier for
  the full design + verification (node fuzz gate `bin/test-registry-grid`,
  worldgen self-test parity, clean game boot). The browser `layout-snapshot`
  self-diff is the one remaining manual confirmation (headless agent-browser can't
  load the snapshot page here).
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
