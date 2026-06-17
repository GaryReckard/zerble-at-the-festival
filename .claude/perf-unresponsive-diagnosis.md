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

## Status

Diagnosis only — **no fixes committed yet.** Ordering when picked up: root
cause 1 fix #1 (`checkShaderErrors=false`) first (highest leverage, lowest risk),
then root cause 2 throttling, then the pooling/disposal audit. Each verified by
re-capturing a trace and reading the perf-log `prog`/`heapMB` trend.
