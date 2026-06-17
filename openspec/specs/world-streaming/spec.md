# Capability: world-streaming

> **Source:** `src/world.js` (global scene + per-player centering + the manager
> owners), `src/chunks.js` (80m chunk lifecycle, v1 themes, v2 consumption path),
> `src/forests.js` (3×3 forest blocks), `src/lakes.js` (macrocell lakes),
> `src/mountains.js` (backdrop ring). The render-agnostic generator the v2 path
> consumes is specified in `worldgen-layout` + `festival-composition`; star/moon
> content in `ambient-backdrop`; the entity store in `registry-collision`;
> determinism in `determinism`.

The world is built once and then streamed: three independent lifecycle systems —
chunks, forests, lakes — lazily generate content around the player and tear it down
as they drive away, all sharing one registry. Backdrops (sky, ground, mountains)
follow the player so the world feels infinite. A boot flag selects between the legacy
per-chunk theme world (v1) and the worldgen-v2 procedural festival.

## ADDED Requirements

### Requirement: One-shot world build with player-following backdrops

`buildWorld(scene, crowd)` SHALL construct the sky dome, starfield, moon, lights +
fog, ground plane, and mountain ring, attach the `TimeOfDay` clock, then create the
`LakeManager` and `ChunkManager` — building lakes BEFORE the first chunk pass so
chunks can consult lake footprints to avoid placing paths/props on water. Each frame
`updateWorld(playerPos, dt)` SHALL re-center the sky dome, starfield, ground plane,
mountains, and the sun's shadow frustum on the player so fixed-world chunks slide past
while backdrops stay a constant apparent distance (`world.js:41-144`).

#### Scenario: Lakes exist before chunks generate

- **WHEN** `buildWorld` runs
- **THEN** `lakeManager.update` is called at the origin before `chunkManager.update`,
  so the first chunks see lake footprints

#### Scenario: Backdrops track the player

- **WHEN** the player drives to a new position
- **THEN** the sky dome, ground plane, and mountains re-center on the player while
  chunk content stays at its fixed world coordinates

### Requirement: Flat terrain by contract

`terrainHeight(x, z)` SHALL return 0 (terrain is intentionally flat); the ground mesh
SHALL still re-sample heights at world coordinates when the player moves past a
threshold, so any future re-introduction of relief stays world-anchored rather than
translating with the player (`world.js:115-157`, `rng.js:82-84`).

#### Scenario: Ground stays at y=0

- **WHEN** terrain height is queried anywhere
- **THEN** it returns 0 and the cart sits at y=0

### Requirement: Chunk lifecycle on an 80m grid

`ChunkManager` SHALL lazily generate chunks within `PERF.chunkLoadRadius` of the
player's chunk (keyed `"${cx}_${cz}"`, `CHUNK_SIZE = 80`), generating at most a bounded
number per frame, and SHALL **unload** chunks beyond `PERF.chunkUnloadRadius` — the
unload radius being larger than the load radius, so straddling a boundary does not
thrash (hysteresis). Unloading SHALL go through `disposeChunkByKey`, which removes the
chunk's group, calls `registry.removeChunk(key)`, `crowd.unloadChunk(key)`, and sweeps
every `chunkKey`-tagged side-list (stage performers/music/lenses/beams, sugar-shack
cooks, forest animatables/drum circles/drum music) (`chunks.js:48-50,280-356,540-592`).

#### Scenario: A distant chunk unloads

- **WHEN** the player moves so a loaded chunk is beyond `chunkUnloadRadius`
- **THEN** that chunk is disposed and all entities/side-list entries tagged with its
  `chunkKey` are removed

#### Scenario: Boundary straddling does not thrash

- **WHEN** the player oscillates across a chunk boundary
- **THEN** the smaller load radius vs larger unload radius prevents repeated
  load/unload of the same chunk

### Requirement: Boot flag selects v1 or v2 generation

`_generate(cx, cz)` SHALL branch ONCE on `USE_WORLDGEN_V2`: when on it runs
`_generateWorldgen(ctx)`, when off it runs the legacy path — `pickTheme(cx, cz)` from
the `(cx,cz)` hash (`main_stage` only at origin, plus `side_stage`/`food_plaza`/
`vendor_row`/`drum_circle`/`grove`/`open_lawn`), dispatched through `THEME_BUILDERS`,
unless the chunk falls in a forest or lake (`chunks.js:362-429,599-680`).

#### Scenario: Default boot uses worldgen v2

- **WHEN** the page loads with the default flag (`USE_WORLDGEN_V2 === true`)
- **THEN** each chunk generates via `_generateWorldgen`, not the legacy theme path

#### Scenario: Legacy path is selectable

- **WHEN** `?worldgen=0` is set
- **THEN** chunks use `pickTheme` + `THEME_BUILDERS`, and the origin chunk is `main_stage`

### Requirement: v2 consumption pipeline in chunks.js

When v2 is on, `_generateWorldgen(ctx)` SHALL run the build pipeline: place worldgen
roads → dispatch each festival descriptor through `buildWorldgenKind` (stage / food
court / vendor row / drum circle + access path / camp village / bubble vendor / potty
bank / entrance arch) → density-driven tree scatter (with thicket gradient, posted
hammocks, shrub undergrowth) → heart-influence-weighted ambient crowd → bubble-jug
scatter → outskirts campsites → seam hedges. All model variation SHALL derive from
each descriptor's `clusterSeed`, never from the chunk's `ctx.rng`, so descriptor-count
changes never desync a chunk's other consumers (`chunks.js:464-533,1245,1291`,
`ARCHITECTURE.md:167`).

#### Scenario: Cluster build is seed-stable

- **WHEN** a festival cluster is built from its descriptor
- **THEN** its model variation is seeded from `descriptor.clusterSeed`, so adding a
  later descriptor to the chunk does not change this cluster's appearance

### Requirement: Forests as 3×3 chunk blocks

`forests.js` SHALL pin a forest to the center chunk (offset 2,2) of every 5×5 chunk
block, guaranteeing ≥2 chunks of clear space between forests, and SHALL skip blocks
whose center is within `ORIGIN_SAFE_BLOCKS` of origin. A forest's center chunk hosts
the body; the 8 neighbors form the canopy. Some forests open a path on one cardinal
side to an interior clearing that may host a campsite or a LEAF-style drum circle;
forest entries SHALL register edge colliders with a gap only on the path side so the
cart cannot drive through the trees. Forests are part of the legacy (v1) world; v2
replaces them with scattered density-driven woods (`forests.js:4-104`).

#### Scenario: Forests are spaced and origin-safe

- **WHEN** the forest field is evaluated across many chunks
- **THEN** at most one forest exists per 5×5 block and none sit within
  `ORIGIN_SAFE_BLOCKS` of the origin

### Requirement: Lakes on a 320m macrocell grid, chunk-independent

`lakes.js` SHALL place lakes on a 320m macrocell grid (~45% density), each an
irregular elongated/lobed body, loading within `LOAD_RADIUS` (720m) of the player and
unloading beyond `UNLOAD_RADIUS` (1500m) by lake **center** (offset by the lake's max
radius so a large lake loads while only its shore is in range). Lakes SHALL register
their footprint and a sealed collider ring **without a `chunkKey`**, so a chunk unload
never tears down a lake's colliders. Lakes own canoes, beaches, and lakeside
campsites, and SHALL load/unload identically under `?worldgen=0` (byte-for-byte
preserved) (`lakes.js:14-16,64-79,121-222`).

#### Scenario: Lake colliders survive host-chunk unload

- **WHEN** the chunk overlapping a lake unloads
- **THEN** the lake's collider ring persists because its registry entries carry no
  `chunkKey`

#### Scenario: Large lake loads from its shore

- **WHEN** a lake's center is beyond `LOAD_RADIUS` but its shore is within it
- **THEN** the lake still loads, offset by its max radius

### Requirement: Disposal skips shared resources

Chunk and lake disposal walks SHALL skip any geometry or material tagged
`userData.shared = true` (module-pooled resources reused across chunks). Disposing a
shared resource is forbidden because it silently triggers a shader recompile the next
frame any other chunk references it (`chunks.js:832-833`, the `userData.shared`
convention).

#### Scenario: Pooled material is not freed on unload

- **WHEN** a chunk holding a `userData.shared` material unloads
- **THEN** the disposal walk leaves that material allocated for the chunks still using it
