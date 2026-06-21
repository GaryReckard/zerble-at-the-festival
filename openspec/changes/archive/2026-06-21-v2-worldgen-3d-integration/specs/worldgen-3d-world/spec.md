## ADDED Requirements

### Requirement: Chunk content is selected by worldgen, not a per-chunk dice roll
When a chunk generates, the game SHALL determine its content by sampling the `src/worldgen/`
generator over the chunk's world bounds (`queryRegion`) and at points within it (`queryPoint`),
rather than by `pickTheme` + `THEME_BUILDERS`. The chunk system SHALL remain the streaming/LOD
engine (load ring, 1-chunk/frame budget, chunkKey lifecycle unchanged).

#### Scenario: A chunk samples worldgen for its cell
- **WHEN** `ChunkManager._generate(cx, cz)` runs with the v2 flag enabled
- **THEN** it queries worldgen for the chunk's AABB and places only the roads, lakes, themed
  props, trees, and crowd that worldgen says belong within that 80m cell
- **AND** it does not call `pickTheme` or `THEME_BUILDERS` for that chunk

### Requirement: No structures on roads or in water
Themed structures (stages, trucks, vendors, potties, campsites, trees) SHALL NOT be placed where
worldgen reports `noBuild` (on a road corridor or in a lake), and SHALL face the nearest road via
the worldgen `facing` hint where applicable.

#### Scenario: A candidate point on a road or in water is rejected
- **WHEN** placement samples a point whose `queryPoint(...).noBuild` is true
- **THEN** no structure is placed at that point
- **AND** a stage placed near a road is rotated to face that road (`facing`)

### Requirement: A heart's anchor structures are owned by exactly one chunk
A heart's single anchor structures (main/side stage, entrance arch, food-truck court) SHALL be
built by exactly the one chunk whose cell contains the heart center, tagged with that chunk's
`chunkKey`, and SHALL regenerate identically when that chunk reloads.

#### Scenario: Only the heart-center chunk builds the anchor
- **WHEN** a heart center lies in chunk `(cx,cz)`
- **THEN** chunk `(cx,cz)` builds the heart's anchor; neighboring chunks in the same district
  build only scattered district props (camps/vendors/potties/trees), not a second anchor

### Requirement: Roads are rendered from worldgen arterials, seam-free and passable
Roads SHALL be rendered as chunk-clipped ribbons of the worldgen arterial polylines (replacing the
`+`-path grid). Adjacent chunks SHALL meet at the shared boundary with no kink (the arterial is one
deterministic pair-owned curve). Roads SHALL be passable (no hard collider) and registered as a
crowd path attractor.

#### Scenario: An arterial crosses a chunk boundary
- **WHEN** an arterial polyline passes from chunk A into chunk B
- **THEN** each chunk renders its clipped portion and the two portions join at the boundary
  without a visible kink or gap
- **AND** the player can drive across the road without taking collision damage

### Requirement: Lakes are placed by worldgen and their colliders persist across chunk unload
`LakeManager` SHALL enumerate lakes from worldgen (`lakesInBounds`/`lakeInCell`, lobed outlines)
instead of its own macrocell placement, while keeping its mesh, sealed-perimeter colliders,
beaches, and distance-based lifecycle. Lake colliders SHALL carry **no chunkKey** so they survive
when a host chunk unloads (footgun #5).

#### Scenario: A host chunk unloads but the lake collider remains
- **WHEN** the player drives far enough that a chunk overlapping a lake unloads, but the lake is
  still within the lake load radius
- **THEN** the lake's water mesh and edge colliders remain present and the player still cannot
  drive into the water

### Requirement: Forests are scattered by worldgen tree density
Trees SHALL be scattered per chunk at a count proportional to `worldgen treeDensity` over the
chunk (scaled by `PERF.forestTreeDensityMul`), reusing the existing tree models, pooled
geometry/materials (`userData.shared`), and lowest-tier-only castShadow discipline. The 5x5
forest-block system SHALL be replaced.

#### Scenario: Dense-density cell grows a forest; cleared cell does not
- **WHEN** a chunk's cells report high `treeDensity` (organic mass or lakeshore ring)
- **THEN** that chunk scatters many trees there
- **AND** cells inside a heart core (treeDensity 0) and cells in water grow no trees

### Requirement: Crowd density follows heart influence
Ambient crowd count per chunk SHALL scale with the heart influence / role tier sampled in that
chunk (more NPCs near heart cores, fewer in outskirts), and NPCs SHALL cluster at registered heart
attractors and drift along roads. The registry attractor/footprint/collision contracts are unchanged.

#### Scenario: More NPCs near a major heart core than in the outskirts
- **WHEN** a chunk overlaps a major heart core vs a chunk in deep outskirts
- **THEN** the core chunk spawns substantially more ambient NPCs, and they congregate at the
  heart's attractor

### Requirement: The new world is behind a feature flag
The v2 worldgen world SHALL be gated by `USE_WORLDGEN_V2` (overridable with `?worldgen=0`), so the
previously shipped world is restored instantly for rollback and the game remains bootable at every
commit during the change.

#### Scenario: Disabling the flag restores the old world
- **WHEN** the game loads with `?worldgen=0`
- **THEN** it generates the previously shipped per-chunk-theme world with no worldgen-driven placement

### Requirement: The world is deterministic and the determinism harness stays green
The same seed SHALL produce the same world. New placement randomness SHALL use fresh `rng.js`
salts (never reorder existing `rng()` calls — footgun #4). The worldgen self-test SHALL remain
20/20 green, and the contract tuple SHALL remain append-only.

#### Scenario: Same seed, same world
- **WHEN** the game is loaded twice with the same `?seed=`
- **THEN** hearts, roads, lakes, forests, and placed anchors are identical
- **AND** `runSelfTest()` reports pass with all checks green

### Requirement: Per-tier perf budgets hold and the game boots clean
With v2 enabled, the game SHALL boot with no uncaught JS errors and hold the per-tier HUD budgets
(low 80 draws/150k tris, mid 200/400k, high 400/1.2M), without reflexively adding shadow casters.
Every `src/worldgen/*` module SHALL appear in the importmap `mods` array of **both** `index.html`
and `sandbox.html`.

#### Scenario: Boot smoke test passes at low and mid tiers
- **WHEN** the game boots at `?perf=low` and `?perf=mid`, clicks start, and runs a few seconds
- **THEN** the console shows no `TypeError`/`ReferenceError`/shader-compile failure
- **AND** the backtick HUD shows draws and triangles within the tier budget
