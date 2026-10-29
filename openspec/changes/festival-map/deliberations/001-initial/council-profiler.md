## The Profiler's Position

### Priority Sequence

1. Establish compact/expanded/hidden baselines and instrument main-thread map time, worker duration, worker response size, pending jobs, retained tiles/discovery blocks, and canvas backing pixels. The map's Canvas proposal adds no scene meshes, so Three.js draw counters alone cannot detect its cost (`openspec/changes/festival-map/design.md:11`, `:16`).
2. Prove one bounded cold geographic tile in the worker before building expanded rendering. Existing `queryRegion` always enumerates roads (`src/worldgen/index.js:82-89`), and the developer map deliberately skips that convenience query for macro views (`map-sandbox.html:308-312`). Keep sampling woodland coarse and bounded because each density sample invokes lake and nearest-heart work (`src/worldgen/density.js:57-74`).
3. Implement view-dependent tile resolution and scheduling with nearest tiles first, one active request, a bounded pending set, and stale-result rejection. Bound the complete visible tile set at maximum zoom-out before accepting the proposed 64-tile cache (`openspec/changes/festival-map/design.md:30`). Otherwise a viewport larger than its cache repeatedly evicts useful visible tiles and regenerates them.
4. Cache geographic imagery and fog separately, update static landmarks at 5 Hz or on membership changes, and update only the player/selected-pin layer each rendered frame. Verify that opacity transitions do not resize/reallocate canvas backing stores on every animation frame. Keep map controls responsive while geography is pending.
5. Stress extended driving, sudden zoom reversal, storage backlog, repeated visibility changes, and cold-cache rollover. Compare Low and Medium on an actual phone/integrated GPU before claiming negligible impact. Existing profile detection explicitly describes draw pressure that adaptive fill-rate changes cannot repair (`src/perf.js:40-47`), so the map must preserve headroom rather than consume it based on a green HUD alone.

### Performance Risks Identified

| Risk | Type | Severity | Trigger Condition |
| --- | --- | --- | --- |
| Worker removes main-thread blocking but still consumes CPU, battery, and shared memory bandwidth | Alloc / SteadyState | High | Continually submitting geographic work while driving or rapidly zooming; design requests off-thread generation at `design.md:12` |
| Tile cache can be smaller than the visible working set | Alloc / SteadyState | High | Maximum geographic radius with fixed fine tiles; the design independently proposes 1200m radius and 64 tiles at `design.md:30` |
| Main-thread response cloning, processing, and rasterization can recreate the stall moved off-thread | Alloc | High | A worker response returns an oversized feature/sample payload; `queryRegion` returns three full feature collections at `src/worldgen/index.js:84-89` |
| Full-screen translucent map still composites over the running game | SteadyState | Medium | Expanded driving at high device pixel ratio; bounded canvas resolution and no blur are already proposed at `design.md:16`, `:22`, `:30` |
| New worker duplicates generator memoization and existing caches have large all-clear thresholds | Alloc / SteadyState | Medium | Long exploration; heart cache clears beyond 250000 entries (`src/worldgen/hearts.js:30`) and arterial cache beyond 200000 (`src/worldgen/roads.js:276`) |
| Woodland sampling is much more than a noise lookup | Alloc | Medium | Dense sampling during cold tile rebuild; `treeDensity` queries water, nearby hearts, and lake-ring geometry (`src/worldgen/density.js:57-74`) |
| Persistent history can be sparse yet its in-memory load/index still grows | Alloc / SteadyState | Medium | Loading the whole discovery or landmark store before filtering; design promises local bounded loading at `design.md:13` |

### Budget Estimate

- **Draw delta:** expected +0 Three.js scene draws and +0 shadow draws, because the proposed implementation is Canvas/DOM and adds no geometry, lights, or render pass (`design.md:7`, `:16`). This does not establish zero browser/GPU cost.
- **Triangle delta:** expected +0 scene triangles. Low's 80 draw / 150k triangle guide, Medium's 200 / 400k, and High's 400 / 1.2M remain unchanged; existing world load is the baseline, not assumed available headroom. See `.claude/rules/performance.md` and current profile behavior at `src/perf.js:40-47`.
- **Cost type:** both allocation and steady-state. Cold generation, response transfer, tile creation, storage restoration, and resize allocate; moving map compositing and marker updates recur.
- **Low/mid-tier verdict:** At risk until measured, but the architecture is appropriate with the bounds below. Keep gameplay information and detection ranges identical across tiers while capping pixels/decorative density. Current architecture records Low pixel-ratio cap 1.25, Medium 1.5, High 2.0 (`ARCHITECTURE.md:575-583`); map backing resolution should have its own independent cap instead of inheriting scene dimensions blindly.

### Concrete Mitigations and Acceptance

- Set a maximum samples/features/bytes per tile response in addition to geographic extent. Prefer compact numeric payloads and transfer buffers when they materially reduce response overhead. Do not fall back to synchronous worldgen on the gameplay thread if worker creation fails; retain the player, fog, and live known markers with an explicit geography-unavailable state.
- Make pending jobs a bounded desired-tile set rather than an ever-growing queue. Logical cancellation must remove unsent work; allow at most one stale active result, then prioritize the new center. Suspend worker admissions when map rendering is hidden or the page is suspended, while keeping discovery tracking active when gameplay runs.
- Cap the visible working set using zoom-bucket tile sizes, and keep a margin within the cache limit for movement. A worker restart at a measured maintenance boundary can reclaim duplicate generator caches without changing world truth; it is an option if long-run retention exceeds the agreed memory envelope, not a mandatory per-tile operation.
- Draw tile backgrounds into cached surfaces, apply discovery via a separate low-resolution mask, and avoid rebuilding all terrain whenever a reveal bit changes. Never read back full canvas pixels per frame to determine fog or marker visibility; query discovery bits instead.
- Establish explicit provisional acceptance targets before profiling: map-owned main-thread steady-state work below 1ms p95 on the tested device, bounded commit/raster units below 4ms, zero map-originated tasks over 50ms, and no sustained cache/queue/memory growth during fixed-area driving and zoom cycles. These are proposed gates requiring device validation, not achieved measurements or universal guarantees. Capture baseline versus map distributions with identical seed/location/tier and report test hardware.
- Keep worker generation, main-thread commit/draw, persistence, and total frame time separate in the verification report. Include compact, expanded, hidden, reveal/cache rebuild, maximum zoom-out, rapid reversal, and BFCache/visibility resume. Do not spend effort optimizing unchanged shadow/geometry systems for this 2D feature.

### Verdict

- **Verdict:** Proceed with mitigations.
- **Key Concern:** Moving generation off-thread alone does not bound the visible tile working set, response handling, or sustained worker CPU demand.
- **Recommendation:** Proceed harness-first with bounded response payloads, zoom-dependent tile sizing, desired-set admission, and explicit measured gates. The same useful map information can reasonably ship across all tiers without new scene geometry, provided acceptance includes Canvas/compositing and long-run worker/storage costs.
