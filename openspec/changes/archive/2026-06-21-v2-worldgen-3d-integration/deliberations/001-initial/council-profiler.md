## The Profiler's Position

I prioritize runtime cost on the target device, especially low/mid tiers. The
plan does not introduce a single obviously-fatal draw/tri blowup — roads are a
few ribbons, lakes already pay their cost, the tree models are pooled — but it
shifts a meaningful chunk of new **CPU allocation-time cost into the generation
hot path** (the 1-chunk/frame budget) that is *not* visible in the
draws/tris/heap HUD, and it removes the only hard cap that currently bounds
forest tree counts. Both are spawn-stall risks on boost into new territory at
exactly the low/mid tiers the budget panel is least equipped to flag.

### Priority Sequence

1. **Baseline the HUD per tier with `?worldgen=0` BEFORE writing any v2 code.**
   Per `.claude/rules/performance.md` audit step 1 ("you can't tune what you
   can't see") record draws/tris/geometries/textures/heap AND `chunkGenStats`
   (`chunks.js:250-261`, already instrumented with an 8 ms `SLOW_THRESHOLD_MS`)
   at `?perf=low` and `?perf=mid` on the shipped world. Every v2 milestone is a
   delta against this, not a vibe. The flag (D-G) makes the A/B free.

2. **Instrument the worldgen sampler cost first, geometry second.** The novel
   risk here is *CPU per-chunk*, not GPU per-frame. Add a timer around the
   `queryRegion` + per-point `queryPoint` sampling in `_generate` and watch
   `chunkGenStats.slowest` / `slowCount`. The draws/tris HUD will look green
   while a heart-anchor or high-density-forest chunk blows past 8 ms and
   stutters the cart mid-boost. Match the fix to the symptom: this is
   **allocation cost** (frame stalls on spawn), not steady-state FPS.

3. **Roads (Task 4) — cheapest, do early to validate the seam + draw cost.**
   Each chunk-clipped arterial ribbon is one `buildCurvedPath` mesh
   (`chunks.js:671`, 16 segments, ~34 verts) — comparable to today's
   `placePaths` which already builds 2 ribbons + a `CircleGeometry` pad per
   chunk (`chunks.js:631-655`). Net draw delta should be roughly *neutral to
   negative* (most chunks have 0–1 arterials vs today's guaranteed `+`). Verify
   in the HUD; this is the low-risk win.

4. **Forests (Task 6) — the single biggest budget risk; gate it hard.** See
   "Budget Estimate" below. The current 5×5 system has a built-in cap:
   `FOREST_TREE_TARGET_DENSITY = 0.022` → "~80 placed → ~400 meshes/chunk …
   Going higher than this requires InstancedMesh" (`forests.js:765-770`). D-F's
   `count ∝ density × cellArea × PERF.forestTreeDensityMul` must reproduce that
   ceiling explicitly, or worldgen `treeDensity` near 1.0 over a full 80×80 cell
   will scatter far more than 80 trees. Test `?perf=low`/`?perf=mid` per Task
   6.3.

5. **Lakes (Task 5) — mostly a placement swap; watch density + tree rings.**
   `LakeManager` keeps its mesh/collider cost (`lakes.js:57-71`, `WATER_MAT`
   shared). The risk is *count*: worldgen `LAKE_CELL=1050` @ `LAKE_PROB=0.60`
   (`constants.js:21-22`) vs today's `LAKE_CELL=320` @ `LAKE_DENSITY=0.45`
   (`lakes.js:32-33`) — far fewer, larger lakes. That's fewer water draws but
   **bigger lakeshore tree rings** (`density.js:41-55`, `LAKE_RING_BAND=70`),
   which feeds back into the forest tree budget. Re-budget forests AFTER lakes
   land, not before.

6. **Themes/anchors (Task 7) — verify the heart-anchor chunk doesn't stall.**
   D-C builds a heart's whole anchor (main/side stage + court + arch) in one
   chunk. A `main_stage` build today is already the heaviest theme; doing
   stage + food court + arch together in one `_generate` is the realistic
   spike. Confirm against `chunkGenStats.slowest`.

7. **Crowd (Task 8) — bounded by `PERF.crowdMax`, low concern.** Per-chunk
   counts scale with heart influence, but the global cap (`perf.js`: low 180 /
   mid 320 / high 500) already bounds steady-state. Just don't let a core chunk
   try to spawn hundreds at once (allocation spike).

8. **Shadow-caster audit hold (Task 9.3).** No new caster types are proposed;
   trees already follow lowest-tier-only discipline (`tree.js:185,220,271` cast
   only the lowest tier/main crown). The audit holds at 56 *as long as forest
   tree counts don't balloon* — every forest tree carries 1 caster, so a count
   regression is also a shadow-cost regression on mid/high (shadows on there).

### Performance Risks Identified

| Risk | Type | Severity | Trigger Condition |
| ---- | ---- | -------- | ----------------- |
| Per-chunk `queryPoint` sampling cost in the 1-chunk/frame budget | Alloc / SteadyState-CPU | **High** | Many candidate points sampled per chunk; each `queryPoint` is 2× `nearestHeart` (81-cell window) + `nearestRoad` (81-cell × `neighborsOf` 81-cell each) + `lakeAt` + `nearestLake`. Manifests as `chunkGenStats.slowest` > 8 ms → cart stutter on boost into new territory. |
| Forest tree-count blowup vs the old 0.022 hard cap | Draws/Tris/Shadow | **High** | D-F density formula (`density × cellArea × mul`) over a `treeDensity≈1.0` cell scatters >> the ~80 trees/chunk the old system capped at; ~5 meshes/tree (`forests.js:765`) → draws + tris + shadow casters all regress on low/mid. |
| `nearestRoad` re-scanning windows per call (not just memoized arterials) | Alloc-CPU | **Medium** | `arterialsNear` (roads.js:207) and `neighborsOf` (roads.js:26) re-iterate 81-cell windows + sort on every `queryPoint`, even though `arterial()` polylines are memoized. The expensive part (window scan + neighbor sort) is NOT cached. |
| Heart-anchor chunk single-frame spike | Alloc | **Medium** | D-C builds stage + court + arch in one `_generate`; rare (~1 per ≥440 m, `HEART_CELL=440`) but a real spike when it lands mid-boost. design.md risk acknowledges "split across frames if a stall shows." |
| Lakeshore tree-ring feedback into forest budget | Draws/Tris | **Medium** | Larger worldgen lakes (1050 m cell) × `LAKE_RING_BAND=70` (`density.js:54`) boost `treeDensity` to 0.62 around every shore → dense tree rings the old 320 m lakes didn't produce at this scale. |
| Lake count/feel shift hides a fill-rate change | SteadyState | **Low** | Fewer, much larger water meshes (`ShapeGeometry`, DoubleSide, transparent — `lakes.js:57-70`). Transparent water = per-frame sort; a single huge lake on screen is more transparent fill than several small ones. Low because transparency cost is already paid today. |
| `_arterialCache` / heart `_cache` unbounded-ish growth | Heap | **Low** | Caches clear at 200k/250k entries (`roads.js:189`, `hearts.js:30`) — fine for a session, but the game path will populate them faster than the sandbox. Watch heap in the HUD over a long boost run; not a frame-time issue unless memory-bound. |
| New `src/worldgen/*` modules missing from BOTH importmaps | Boot/dev | **Low** (correctness) | Task 3.2 + tripwire; not perf but a boot risk that masquerades as "edits don't reload." Flagged because it gates verification of every perf claim. |

### Budget Estimate

-   **Draw delta**:
    - **Roads**: roughly **neutral to negative**. Today every non-lake chunk
      builds 2 ribbon meshes + 1 pad = 3 draws (`placePaths`,
      `chunks.js:631-655`); most v2 chunks will render 0–1 arterial ribbons.
    - **Forests**: **the swing factor.** Old system ceiling is ~80 trees ×
      ~5 meshes ≈ 400 draws/chunk, "~3600 draw calls across 9 loaded chunks …
      the renderer absorbs without dropping frames" (`forests.js:768-770`).
      D-F MUST reproduce that ~80/chunk ceiling. Uncapped at `treeDensity≈1`
      over 6400 m² this can multiply. Closest tier after: **low (80-draw
      budget)** — a single dense forest chunk alone is many multiples of the
      low draw budget *unless* trees instance. The old system survives only
      because trees are tiny shared geo and the GPU eats the count; the budget
      panel's 80-draw "low" marker is already exceeded by a forest chunk today.
      This means: **the HUD draw budget is not the real gate for forests —
      instancing is the open question (ROADMAP defers "variant-bucketed
      InstancedMesh" — do NOT silently rely on it landing here).**
    - **Anchors/themes**: net **neutral**. Same models, same registry contract;
      placement source changes, not mesh count. Stages-on-roads removal may
      slightly *reduce* wasted draws.
-   **Triangle delta**: dominated by forest tree count (each forest tree is
    trunk + 3–4 cones/icospheres). Tracks the draw delta — **forests are the
    only category that can move tris materially**; roads (flat ribbons,
    ~32 tris each) and water (`ShapeGeometry`) are negligible. Closest tier:
    **low (150k tris)** — a dense forest cell is the squeeze.
-   **Cost type**: **Both, but the novel cost is allocation.** The new
    per-chunk `queryRegion`/`queryPoint` work and any forest-count increase are
    **allocation stalls** (spawn-time, shown in `chunkGenStats`, invisible in
    the draws/tris HUD). Steady-state FPS is only at risk if forest counts
    regress (more casters on mid/high, more fill on low).
-   **Low/mid-tier verdict**: **Needs instancing/pooling + an explicit forest
    count cap.** Specifically: (a) cap per-chunk tree count to the old ~80
    ceiling and keep `PERF.forestTreeDensityMul` in the formula (D-F says it
    does — verify in code); (b) bound per-chunk `queryPoint` call count and lean
    on the cell memos (don't sample per-square-meter); (c) measure
    `chunkGenStats` at low/mid every milestone, not just draws/tris. With those,
    low/mid is **Safe**; without the forest cap, **At risk**.

### Verdict

-   **Verdict**: **Proceed with mitigations**
-   **Key Concern**: The two costs that *won't show up in the draws/tris/heap
    HUD* — (1) per-chunk worldgen sampling pushing `chunkGenStats` past the
    8 ms slow threshold (spawn stall on boost), and (2) the loss of the old
    `FOREST_TREE_TARGET_DENSITY=0.022` hard cap, which is the only thing keeping
    forest tree counts (and therefore draws, tris, AND shadow casters)
    bounded today. The HUD is the wrong instrument for both; `chunkGenStats`
    and an explicit per-chunk tree cap are the right ones.
-   **Recommendation**: The plan's perf posture (D-J) is sound in spirit — flag,
    memoized cells, "measure in the HUD at low/mid every milestone" — but it
    under-weights allocation-time cost relative to the draws/tris budget panel
    it keeps pointing at. Make three mitigations binding before apply:
    (1) **Forest count cap** — D-F's formula must clamp to the proven ~80
    trees/chunk ceiling (`forests.js:765`) and keep `forestTreeDensityMul`;
    add InstancedMesh only if the cap still busts low (ROADMAP's
    variant-bucket idea, not assumed). (2) **Sampler budget** — bound the
    number of `queryPoint` calls per chunk, reuse `queryRegion` results, and
    add a `chunkGenStats`-style timer around the sampler; treat >8 ms as the
    gate, with anchor-build frame-splitting (design.md already names this
    fallback) as the escape hatch. (3) **Gate on `chunkGenStats`, not just the
    HUD, at `?perf=low` and `?perf=mid`** at every milestone (Tasks 4.3, 6.3,
    7.4, 9.3). With those three, Proceed.
