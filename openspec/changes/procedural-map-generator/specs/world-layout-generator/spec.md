## ADDED Requirements

### Requirement: Deterministic, order-independent layout
The generator SHALL produce identical layout output for a given (seed, world
coordinate) regardless of evaluation order, call history, or which neighboring
regions have been queried. Shared features that span region boundaries (road
segments crossing a chunk edge, rivers between lakes) SHALL be seeded from the
shared feature's own identity (edge id / endpoint-pair hash) — never passed forward
from one region's output into another's input.

#### Scenario: Same seed and coordinate yield identical output
- **WHEN** the generator is queried for the same (seed, x, z) twice in any order
- **THEN** every field of the returned layout tuple is byte-identical

#### Scenario: Boundary feature agrees from both sides
- **WHEN** a road segment or river crosses the boundary between region A and region B
- **THEN** A and B independently compute the same crossing point and curve, with no dependence on which region was generated first

#### Scenario: Different seeds yield different worlds
- **WHEN** the generator is queried for the same coordinate under two different seeds
- **THEN** the heart field, road network, and water layout differ

### Requirement: Render-agnostic output
The generator module SHALL NOT import `three`, touch the DOM, or perform any
rendering. It SHALL return plain data structures only, so that the 2D sandbox, the
future 3D world, and a future in-game map view can each consume the identical output.

#### Scenario: No rendering dependencies
- **WHEN** the generator module is imported in an environment with no `three` and no DOM
- **THEN** it loads and produces layout data without error

### Requirement: Heart field with rank hierarchy
The generator SHALL place "hearts" (festival anchors) on a coarse macrocell grid with
jittered positions, rank-weighted so that most macrocells have no heart and hearts
are distributed by rank: minor, major, and a rare **mega** rank. A mega-heart SHALL
occupy a 2×2 macrocell block and suppress lesser hearts within its footprint. A
heart's rank SHALL determine its domain radius and the scale of what spawns there.

> **Deferred this change:** the **mega** rank + its 2×2 suppression are NOT
> implemented yet (minor/major only). The multi-cell suppression is a determinism
> hot-spot; mega lands with the 3D-integration follow-up. See the proposal Decision
> Record and questions-for-human Q4. This requirement describes the target.

#### Scenario: Hearts are sparse and rank-distributed
- **WHEN** the heart field is sampled across a large region
- **THEN** most macrocells contain no heart, minor hearts are common, major hearts are uncommon, and mega-hearts are rare

#### Scenario: Mega-heart claims its block
- **WHEN** a macrocell rolls a mega-heart
- **THEN** it occupies a 2×2 block, has the largest domain radius, and no lesser heart is placed inside that block

### Requirement: Per-location role derived from nearest heart
For any location the generator SHALL compute its nearest heart and the
distance/angle to it, and from that derive a role tier (core → district → outskirts)
that governs density and theme. Locations far from every heart SHALL resolve to
sparse outskirts, so sparsity emerges as the space between hearts rather than being
added separately.

#### Scenario: Inner tier near a heart
- **WHEN** a location is within a heart's core radius
- **THEN** its role tier is "core" with high density and stage/vendor/food themes

#### Scenario: Outskirts far from any heart
- **WHEN** a location is beyond every heart's domain
- **THEN** its role tier is "outskirts" with low density and open/forest themes

### Requirement: Road network with hierarchy
The generator SHALL produce a road network of distinct tiers — arterials connecting
hearts, collectors branching toward mid-tier clusters, and local footpaths — such
that roads exist to connect destinations rather than to tile space. The network SHALL
be connected (no orphan arterial segments) and computable from a bounded local
neighborhood of macrocells.

#### Scenario: Arterials connect hearts
- **WHEN** two neighboring hearts exist
- **THEN** an arterial road of a deterministic, meandering curve connects them

#### Scenario: Road tiers are distinguishable
- **WHEN** the road network is queried at a point on a road
- **THEN** the result identifies the road tier (arterial / collector / footpath)

### Requirement: Lakes and rivers
The generator SHALL place lakes and SHALL place rivers as deterministic meandering
curves that connect lakes and are routed to avoid heart cores. A river SHALL carry a
no-build corridor: no prop, road-side placement, or heart core may occupy a river's
footprint. Rivers SHALL never pass through a heart core.

> **Deferred this change:** lakes ARE implemented (elongated/lobed). **Rivers are
> NOT** — river-around-heart avoidance can depend on a heart outside the local
> window, which would non-deterministically violate "never through a heart core";
> it needs a window-invariance gate first. `onRiver` ships as an always-false
> contract stub. Rivers land with the 3D-integration follow-up. See Q4 / Decision
> Record. This clause describes the target.

#### Scenario: River connects lakes and avoids hearts
- **WHEN** a river is generated between two lakes
- **THEN** its curve avoids every heart core and stays within the water layer

#### Scenario: Nothing spawns on a river
- **WHEN** a location falls inside a river's footprint
- **THEN** the generator reports it as no-build (water) and places no prop there

### Requirement: Bridges at road–river crossings
Where a road crosses a river the generator SHALL produce a deterministic bridge
marker at the crossing point, so that roads remain traversable across rivers.

> **Deferred this change:** depends on rivers (above), so also NOT implemented.
> `bridge` ships as an always-false contract stub; arterials simply don't cross
> open water this change. Lands with rivers in the 3D-integration follow-up.

#### Scenario: Crossing produces a bridge
- **WHEN** a road segment intersects a river curve
- **THEN** a bridge marker is produced at the intersection, deterministically positioned

### Requirement: Tree-density field
The generator SHALL expose a continuous tree-density field that is high far from
hearts and reduced (cleared) near heart cores and within water/road footprints, so
"forest" emerges where the field is high rather than as discrete blocks.

#### Scenario: Density clears near a heart
- **WHEN** tree density is sampled inside a heart core
- **THEN** it is at or near zero

#### Scenario: Density rises in the outskirts
- **WHEN** tree density is sampled far from any heart and clear of water
- **THEN** it is high enough to read as forest

### Requirement: Point-query API
The generator SHALL expose a single query that, given (seed, x, z), returns a layout
tuple describing that location: nearest heart and rank, role tier, on-road state and
road tier, on-river / bridge state, tree density, and in-lake state.

#### Scenario: Point inspector returns a complete tuple
- **WHEN** the query is called for an arbitrary (seed, x, z)
- **THEN** it returns all of: nearest-heart+rank, role tier, road state+tier, river/bridge state, tree density, lake state
