# Capability: worldgen-layout

> **Source:** `src/worldgen/index.js` (the `queryPoint`/`queryRegion` contract),
> `hearts.js`, `roads.js`, `water.js`, `density.js`, `roles.js`, `constants.js`
> (named tunables), `selftest.js` (determinism goldens). The 3D consumption of this
> data lives in `world-streaming`; the per-heart POI plan + seam grammar in
> `festival-composition`; the seeding primitives in `determinism`; the 2D/3D viewers
> in `sandbox-harness`.
>
> This capability promotes and reconciles the delta specs
> `world-layout-generator`, `worldgen-3d-world`, and `worldgen-road-junctions`.
> **Reconciliation against shipped code:** roads ship as **arterials only**
> (collectors/footpaths parked — `roads.js:9`); **rivers, bridges, and the mega
> heart rank are NOT implemented** and ship as contract stubs / target-only
> (`index.js:54-55,70-71`, `hearts.js:9`); the road junction-merge pass is not in
> `roads.js` and remains an in-flight refinement, not canonical.

The worldgen layer is a render-agnostic, deterministic generator that replaces the
legacy per-chunk theme dice-roll with one coherent infinite festival layout. It
imports no `three` and touches no DOM — it returns plain data so the 2D map sandbox,
the live 3D world, and a future in-game map can all consume identical output.

## ADDED Requirements

### Requirement: Render-agnostic point-query contract

`worldgen/index.js` SHALL expose `queryPoint(x, z)` returning a plain-data layout
tuple and `queryRegion(bounds)` returning the discrete features (hearts, lakes, roads)
intersecting a rectangle. The module SHALL NOT import `three` or touch the DOM. The
tuple SHALL include: quantized `x,z`; nearest `heart` + `heartDist` + continuous
`heartInfluence` (0..1); `roleTier`; `onRoad` + `roadTier`; a `facing` suggestion;
suggested `footprint`; `inLake`; `onRiver`/`bridge` (stubs); `noBuild`; `treeDensity`;
`lifecycle: 'persistent'`; `groundY` (`index.js:48-90`).

#### Scenario: No render dependencies

- **WHEN** `worldgen/index.js` is imported in an environment with no `three` and no DOM
- **THEN** it loads and `queryPoint` returns layout data without error

#### Scenario: The point tuple is complete

- **WHEN** `queryPoint(x, z)` is called for any coordinate
- **THEN** it returns all of nearest-heart+influence, role tier, road state+tier,
  river/bridge state, lake state, tree density, footprint, and facing

### Requirement: Single module-global seed (one door)

The seed SHALL be module-global, set only through `setSeed → setSessionSeed` — the
same door `?seed=` uses — never threaded as a per-query parameter. This is why a
seed tuned in the 2D map sandbox reproduces the identical world in the 3D game
(`index.js:5-9,44-46`).

#### Scenario: Sandbox and game agree under one seed

- **WHEN** the same seed is set in the map sandbox and in the game
- **THEN** `queryPoint` returns identical tuples for the same coordinates in both

### Requirement: Append-only tuple across the 2D→3D boundary

The 3D port MAY add fields to the layout tuple but SHALL NOT reorder or re-salt the
draws that produce existing fields, because that would regenerate worlds differently
(`index.js:11-13`).

#### Scenario: Adding a field doesn't move the world

- **WHEN** a new field is added to the tuple
- **THEN** every previously-existing field's value at a given coordinate is unchanged

### Requirement: Quantized, order-independent determinism

Every field SHALL be a pure function of `(seed, quantized x, quantized z)`,
identical across evaluation order, call history, and which neighbors were queried.
Float inputs SHALL be `quantize`d to integer meters before any hash or threshold so
the layout is bit-identical across JS engines. Shared boundary features SHALL be
seeded from their own identity (`pairHash`/`edgeHash`), never forwarded between
regions (`index.js:48-49`, `determinism` capability).

#### Scenario: Same coordinate yields identical output

- **WHEN** `queryPoint` is called twice for the same coordinate in any order
- **THEN** every field of the returned tuple is identical

### Requirement: Rank-weighted heart field

`hearts.js` SHALL place hearts on a coarse macrocell grid with jittered positions,
rank-rolled per cell: most cells have no heart, `minor` is common, `major` is
uncommon (~4% of cells). A heart's rank SHALL set its `core` and `district` radii.
The **mega** rank and its 2×2-block suppression are NOT implemented — the generator
ships minor/major only (`hearts.js:1-52`).

#### Scenario: Hearts are sparse and rank-distributed

- **WHEN** the heart field is sampled across a large region
- **THEN** most cells contain no heart, minor hearts are common, and major hearts are rare

### Requirement: Per-location role from nearest heart

`roles.js` SHALL derive a `roleTier` (`core` → `district` → `outskirts`) from the
nearest heart and the distance to it: within the core radius → `core`; within the
district → `district`; beyond every heart's domain → `outskirts`. Sparsity SHALL
emerge as the space between hearts, not be added separately. `heartInfluence` SHALL
ramp continuously from 1 at a core center to 0 at the district edge
(`index.js:50-51,63`, `hearts.js:101-105`).

#### Scenario: Outskirts emerge between hearts

- **WHEN** a location is beyond every heart's district
- **THEN** its role tier is `outskirts` with low density

### Requirement: Arterial road network

`roads.js` SHALL produce arterials as pair-hash-seeded meanders owned end-to-end by
the unordered heart pair (so adjacent chunks meet with no seam-kink), with the edge
set being the symmetric union of each heart's K-nearest neighbors. `queryPoint` SHALL
report `onRoad` and `roadTier` for points on an arterial, and `facing` SHALL suggest
the bearing toward the nearest road when one is within `HEART_CELL`. Roads SHALL be
passable (no hard collider) and registered as a crowd-path attractor by the 3D
consumer. Collectors and footpaths are parked (arterials only)
(`index.js:52,58,65-66`, `roads.js:1-9,154-313`).

#### Scenario: An arterial joins seamlessly across a boundary

- **WHEN** an arterial passes from chunk A into chunk B
- **THEN** both sides compute the identical pair-owned curve, joining with no kink

#### Scenario: A placement faces its road

- **WHEN** a point has a road within `HEART_CELL`
- **THEN** its `facing` suggests the bearing toward that road

### Requirement: Lakes with no-build containment; rivers stubbed

`water.js` SHALL place lobed, jittered lakes with point-in-polygon containment, and
`queryPoint().inLake` SHALL be true inside one. `noBuild` SHALL be true in a lake, on
a river, or on a road corridor. Rivers and their bridges are NOT implemented:
`onRiver` and `bridge` SHALL always be false (contract slots kept for a future river
layer) (`index.js:53-55,69-72`, `water.js`).

#### Scenario: Nothing builds in water

- **WHEN** a point falls inside a lake
- **THEN** `inLake` and `noBuild` are true and no structure is placed there

#### Scenario: River state is always false

- **WHEN** `queryPoint` is called anywhere
- **THEN** `onRiver` and `bridge` are false

### Requirement: Continuous tree-density field

`density.js` SHALL expose a continuous `treeDensity` (0..1) that is high in organic
woodland and along a lakeshore ring, and ramps to 0 at a heart core (and within
water/road footprints), so forest emerges where the field is high rather than as
discrete blocks (`index.js:73`, `density.js`).

#### Scenario: Density clears at a core, rises in outskirts

- **WHEN** `treeDensity` is sampled inside a heart core vs in clear outskirts
- **THEN** it is ~0 at the core and high in the outskirts

### Requirement: Persistent lifecycle (no chunkKey)

Every worldgen feature SHALL carry `lifecycle: 'persistent'` — like lakes, worldgen
features hold NO `chunkKey`, so the 3D consumer must register them to survive
host-chunk unload (`index.js:29-32,74`).

#### Scenario: Worldgen feature survives chunk unload

- **WHEN** the chunk hosting a worldgen feature unloads
- **THEN** the feature's registration (carrying no chunkKey) is not torn down

### Requirement: Frozen determinism goldens + self-test

`selftest.js` SHALL expose `runSelfTest(seeds)` covering round-trip purity, road
window-invariance, and a negative control, and SHALL freeze two golden hashes: a
**queryPoint golden** (FNV-1a over the existence layer — roads/water/hearts/density —
which MUST stay frozen across any layout change) and a **separate POI golden** (the
festival plan layer, which may move deliberately and is re-recorded when it does)
(`selftest.js:1-69,140-180`).

#### Scenario: The existence golden stays frozen

- **WHEN** a layout change touches the festival POI plan but not roads/water/hearts/density
- **THEN** the queryPoint golden hash is unchanged and the POI golden may change
