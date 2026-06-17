# Capability: registry-collision

> **Source:** `src/registry.js` (the world-entity store + per-frame broadphase),
> `src/spatialGrid.js` (uniform spatial-hash), `src/main.js#resolveCollision`
> (`:1177-1264`) + the approach-damage constants. The chunkKey lifecycle is driven
> by `world-streaming`; crowd consumers by `crowd-ai`; the cart by `carts`.

One shared registry stores every "thing in the world" that has a footprint,
collider, or attractor. Crowd AI queries it for avoidance and points of interest; the
collision system queries it for hard colliders. A per-frame spatial-hash broadphase
makes neighborhood queries cheap, and the collision resolver distinguishes a damaging
high-speed hit from a gentle overlap nudge.

## ADDED Requirements

### Requirement: Registry entry shape

`registry.add(entry)` SHALL accept an entry with `kind`, `position` (Vector3,
defaulted if absent), optional `footprint` (NPC-avoidance radius), optional `collider`
(`{ radius, damage }` — a hard collider for the cart), optional `attractor`
(`{ radius, weight }` — a crowd magnet), and optional `chunkKey`. It SHALL assign and
return a unique id and index the entry by kind. There SHALL be exactly one shared
registry instance for the whole game (`registry.js:25-42,160-161`).

#### Scenario: An entry is indexed by kind and id

- **WHEN** `add({ kind: 'truck', collider: { radius, damage } })` is called
- **THEN** it returns a new id and the entry is retrievable both by id and in the
  `byKind('truck')` set

### Requirement: chunkKey-scoped removal

`registry.removeChunk(chunkKey)` SHALL remove every entry tagged with that key.
Entries with no `chunkKey` (lakes, worldgen-persistent features) SHALL survive any
`removeChunk` call (`registry.js:51-63`).

#### Scenario: Chunk unload removes only its entries

- **WHEN** `removeChunk(key)` runs
- **THEN** entries tagged with `key` are removed and entries with no chunkKey remain

### Requirement: Typed world queries

The registry SHALL expose generator queries: `colliders()` (entries with a collider —
yielding position/radius/damage/kind), `footprints()` (entries NPCs avoid),
`attractors()` (crowd POIs), `pickAttractor(rng)` (weighted-random selection), and
`closestBuilding(pos, radius, excludeKinds)` (nearest footprint, excluding `tree` by
default) (`registry.js:65-157`).

#### Scenario: Collision system reads colliders

- **WHEN** the per-frame collision pass runs
- **THEN** it iterates `registry.colliders()` for the hard colliders to test against

### Requirement: Per-frame spatial broadphase

`registry.rebuildSpatialIndex()` SHALL re-insert every footprint/collider entry from
its CURRENT position into two ~8m-cell spatial grids once per frame (called from
`main.js` before any consumer), tracking the largest footprint/collider radius to pad
query reach. `footprintsNear` / `collidersNear` SHALL visit a SUPERSET of the truly
in-range entries (padded by the max radius), leaving the exact distance test to the
callback. Rebuilding from live positions means moving entries (Lurleen, drifting
hula-hoopers) need no invalidation bookkeeping. The grids consume no rng, so
determinism is untouched (`registry.js:81-118`, `spatialGrid.js:1-15`).

#### Scenario: Neighborhood query returns a superset

- **WHEN** `collidersNear(x, z, reach, fn)` is called
- **THEN** `fn` is invoked for every entry within `reach` (and possibly some just
  outside), never missing one in range

#### Scenario: Moving entries stay correctly placed

- **WHEN** Lurleen moves and the index is rebuilt next frame
- **THEN** she is re-inserted at her new cell with no stale entry left behind

### Requirement: Spatial grid is a correctness-neutral accelerator

`SpatialGrid` SHALL be a pure query accelerator: it consumes no rng, feeds no
generation, and changes no placement, so results match a full linear scan exactly. Its
packed cell key SHALL be 1:1 (no double-visits) within tens of km of origin; beyond
that a collision could only ADD extra distance-tested candidates, never drop a real
one. `clear()` SHALL drop buckets that stayed empty so the map can't grow unbounded as
the player roams (`spatialGrid.js:1-61`).

#### Scenario: Grid results equal a linear scan

- **WHEN** the same in-radius query is answered by the grid and by a full scan
- **THEN** the exact-tested results are identical

### Requirement: Approach-speed collision model

`resolveCollision(zerble, colliders)` SHALL, for each collider closer than
`collider.radius + zerble.radius`, compute the approach speed as the dot of the cart's
velocity with the contact direction. If approach speed exceeds
`APPROACH_DAMAGE_THRESHOLD` (1.2 m/s) it SHALL be a **damaging hit** — apply knockback
via `zerble.applyHit`, and for a person collider call `crowd.onZerbleHit` to panic and
infect neighbors — returning whether smiles should be deducted (`damage > 0`).
Otherwise it SHALL be a **silent overlap-resolve** — project the cart out of the
radius and bleed off the small approach speed with no score change. This lets the
player brush people at a crawl without penalty while punishing full-speed crowd
plows (`main.js:1126,1212-1264`).

#### Scenario: Fast plow damages

- **WHEN** the cart drives into a collider with approach speed above 1.2 m/s
- **THEN** the cart is knocked back, a person victim panics, and smiles are deducted
  if the collider's damage is positive

#### Scenario: Slow brush resolves silently

- **WHEN** the cart overlaps a collider with approach speed at or below 1.2 m/s
- **THEN** the cart is nudged out of overlap with no score change

### Requirement: Passive and parked-cart exclusions

`resolveCollision` SHALL skip `passive` colliders entirely (proximity triggers like
the wook's dose approach, which must not physically block the cart from entering
trigger range), and SHALL skip the non-damaging nudge for soft "people" kinds when the
cart is effectively parked, so a stationary cart can be crowded without being shoved
(`main.js:1224-1228`).

#### Scenario: Passive trigger doesn't block the cart

- **WHEN** a passive collider overlaps the cart
- **THEN** the cart is neither pushed nor damaged, so the proximity trigger can fire
