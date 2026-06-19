## ADDED Requirements

### Requirement: Accurate scene draw measurement under post-processing

The debug HUD and perf log SHALL report the draw-call and triangle counts of the
**scene render** (the `RenderPass`), not the value left in `renderer.info.render`
after the EffectComposer's fullscreen post-processing passes have run.

#### Scenario: HUD reports real draws while post-processing is active

- **WHEN** the game is running with the EffectComposer chain (RenderPass → bloom
  → trip → fxaa → output) and the backtick HUD is open
- **THEN** the `draws` and `tris` lines reflect the scene's actual per-frame draw
  calls and triangles (e.g. tens-to-hundreds of draws), not `1`
- **AND** the value is compared against the correct per-tier budget marker.

#### Scenario: Perf log carries true draws and a program-compile signal

- **WHEN** a perf recording is captured via `__dbg.recordPerf`
- **THEN** each sample's `draws`/`tris` fields carry the post-RenderPass snapshot
- **AND** a per-frame program-count delta is recorded so frames that compiled a
  new GL program (the shader-stall frames) are identifiable from the log alone.

### Requirement: Time-sliced chunk generation under a per-frame budget

Chunk generation SHALL be bounded by a per-frame **millisecond** budget rather
than a fixed chunk count, building a single chunk across multiple frames when it
exceeds the budget, without changing the generated result.

#### Scenario: An expensive chunk builds across frames instead of one stall

- **WHEN** a dense hub chunk whose full build would exceed the per-frame budget
  enters the load ring
- **THEN** its construction is spread across consecutive frames so no single
  frame pays the whole build cost
- **AND** all **collider-registering** work runs in the synchronous first phase
  (so the chunk is collision-coherent the instant it registers); only
  **collider-free** decor/scatter (trees, ambient props, campsites, crowd spawn)
  is deferred to later frames. No half-built chunk ever exposes a partial or
  missing collidable footprint.

#### Scenario: Generated world is byte-identical to the synchronous build

- **WHEN** the same seed and chunk coordinates are generated with time-slicing
  enabled versus the prior synchronous path
- **THEN** the resulting registry entries, prop placement, and rng-derived
  choices are identical — the `rng()` draw order is preserved, only the timing of
  the work changes.

#### Scenario: A chunk that leaves the load ring mid-build is cancelled cleanly

- **WHEN** the player moves such that a partially-built chunk falls outside the
  load radius before its build completes
- **THEN** the in-progress build is abandoned and any partial allocations are
  released, with no orphaned scene nodes, registry entries, or duplicate
  generation if the chunk is re-entered later.

### Requirement: Bounded shader compilation per frame

The renderer SHALL avoid linking more than one previously-unseen GL program in a
single frame during normal streaming, and SHALL prewarm known material/geometry
combinations off the critical path.

#### Scenario: Title-card prewarm compiles the known material set

- **WHEN** the player taps the title-card start button
- **THEN** audio initialization runs first and synchronously (the iOS gesture
  contract is preserved), and *after* that the known festival material/geometry
  combinations are compiled via `renderer.compileAsync()` through the tier-aware
  `threeShim` path so the warmed programs match what the world actually draws.

#### Scenario: Streamed decor reveals at most one new program per frame

- **WHEN** a newly-streamed chunk contains meshes whose materials have not yet
  been rendered (and were not prewarmed)
- **THEN** those meshes become visible at a rate of at most one new program link
  per frame, so the per-frame cost is a sliver rather than a single multi-hundred-
  millisecond compile wall.

### Requirement: Amortized shadow map

The directional sun shadow map SHALL be re-rendered on a reduced cadence (not
every frame), reusing the last rendered map between updates.

#### Scenario: Shadow map updates every N frames without going blank

- **WHEN** the game runs on a tier with shadows enabled
- **THEN** `renderer.shadowMap.autoUpdate` is `false` and the map is flagged for
  re-render every N frames (or when the sun angle has moved materially)
- **AND** between updates, shadow-receiving meshes sample the last *good* map (a
  slightly stale but correct shadow), never an empty/blank map.
