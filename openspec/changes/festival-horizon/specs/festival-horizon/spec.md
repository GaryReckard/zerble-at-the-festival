## ADDED Requirements

### Requirement: Deterministic semantic horizon

The game SHALL derive far-field festival silhouettes and roads from the existing
public worldgen descriptors without consuming or reordering existing RNG calls,
changing worldgen output, or constructing full cluster models.

#### Scenario: A fixed seed rebuilds the same horizon

- **WHEN** the horizon is rebuilt repeatedly for the same seed, player cell, tier,
  and time of day
- **THEN** proxy kinds, transforms, colors, ownership keys, and road vertices are
  byte-identical.

#### Scenario: The experiment does not change the real world

- **WHEN** the same fixed-seed travel path runs once with the horizon disabled and
  once with it enabled
- **THEN** worldgen golden hashes, registry dumps, cluster RNG draw counts, and real
  chunk ownership remain identical.

#### Scenario: Cached worldgen inputs are not mutated

- **WHEN** the horizon plans or rebuilds from memoized `festivalPlan` and road
  polyline data
- **THEN** a hash of those cached inputs taken before and after the rebuild is
  identical, because the layer copies descriptors into its own compact records
  and never mutates shared worldgen arrays in place.

### Requirement: Render-only ownership

The horizon SHALL create no registry entries, colliders, NPCs, audio handles,
pickups, real lights, shadow casters, or per-prop animation, and SHALL not call a
real world cluster builder.

#### Scenario: A proxy hub is visible outside the live chunk ring

- **WHEN** a planned hub lies within the tier horizon but its owning chunk is not
  loaded
- **THEN** its semantic stage and bounded supporting silhouettes can render
- **AND** registry, crowd, collision, audio, and chunk lifecycle counts do not
  change because of that proxy.

#### Scenario: The layer is disposed

- **WHEN** the hub sandbox rebuilds or the FarField instance is explicitly disposed
- **THEN** its owned instance buffers, geometries, and materials are disposed once
- **AND** no chunk or lake shared resource is disposed.

### Requirement: Bounded batched rendering

The first horizon slice SHALL use fixed-capacity batched geometry with no more than
12 additional representative-view scene draws, no real lights or shadows, and no
steady-state allocation churn while the player remains in the same 80m cell.

#### Scenario: The horizon radius grows

- **WHEN** a higher tier selects a wider proxy radius
- **THEN** active instance counts may increase within fixed capacities
- **AND** the number of horizon draw batches remains approximately constant.

#### Scenario: A dense seed exceeds a pool

- **WHEN** candidate proxies exceed a fixed pool capacity
- **THEN** the nearest candidates are retained deterministically
- **AND** the omitted count is exposed through debug statistics without allocating
  a larger steady-state pool.

#### Scenario: Night lights activate

- **WHEN** nightness crosses the configured dusk threshold
- **THEN** the shared warm and colored marker batches become visible without adding
  real Light objects, shadow casters, transparent sorting, or per-marker animation.

#### Scenario: A rewrite moves the horizon

- **WHEN** a committed pool rewrite repositions active instances or road geometry
- **THEN** the affected instanced bounding volumes and road geometry bounds are
  recomputed, or frustum culling is explicitly disabled for that batch
- **AND** the new horizon remains visible from every camera direction, including
  after a second distant rewrite.

### Requirement: Tier-aware distance bands

The horizon SHALL use tier-owned radius, density, and pool limits while preserving
the existing fog and camera range.

#### Scenario: Low tier renders a sparse horizon

- **WHEN** the game runs on the low performance tier
- **THEN** the horizon uses the low tier's sparser capacity and approximately
  320-360m outer radius
- **AND** the camera far plane, fog end, and full chunk load radius are unchanged.

#### Scenario: Mid and high render toward fog

- **WHEN** the game runs on mid or high
- **THEN** the proxy layer may extend toward the existing 520m fog limit within its
  fixed draw and resource budgets.

### Requirement: Real-chunk handoff

Cluster proxy visibility SHALL follow actual completion of the descriptor's owning
full chunk (a proxy hides only after the owning chunk's required cluster props
exist), using one owner-cell helper exported from worldgen placement and a narrow
`ChunkManager` completion predicate, never the mutable loaded map, the private
chunk-key format, or a re-derived ownership rule.

#### Scenario: A full chunk finishes

- **WHEN** the `ChunkManager` completion predicate begins reporting the cluster's
  owning chunk as fully built (its required cluster props exist, not merely
  generation having started)
- **THEN** only the proxy fades out over approximately 0.3 seconds using an opaque,
  depth-writing, sorting-safe dither
- **AND** no real chunk material is made transparent or otherwise modified.

#### Scenario: A full chunk unloads

- **WHEN** the owning chunk leaves the unload ring
- **THEN** the already-planned proxy becomes visible again without rebuilding or
  taking over the chunk's gameplay resources.

#### Scenario: Ownership is correct at negative boundaries

- **WHEN** a cluster descriptor sits on or near an 80m cell boundary at negative
  world coordinates
- **THEN** the exported owner-cell helper and the chunk system agree on the owning
  chunk, locked by fixtures covering positive, negative, edge, and corner cases.

#### Scenario: Reduced motion is active

- **WHEN** proxy ownership changes while reduced motion is enabled
- **THEN** the proxy snaps to its target visibility without the timed dissolve.

#### Scenario: A real arterial road loads over its proxy

- **WHEN** a full chunk's road ribbon appears
- **THEN** it cleanly covers the aligned narrower far-field underlay without
  z-fighting or requiring per-segment transparency
- **AND** the underlay sits at an explicit elevation constant strictly between
  the ground plane (y=0) and the real road (y=0.06), opaque and depth-writing,
  verified at both grazing and top-down angles.

### Requirement: Boundary-triggered lifecycle

The horizon SHALL recompute candidates only when the player crosses its coarse
80m cell boundary or when an explicit debug rebuild is requested, and SHALL retain
the previous complete snapshot until any replacement is ready.

#### Scenario: The player remains inside one cell

- **WHEN** ordinary game frames advance without crossing an 80m boundary
- **THEN** candidate plans and road geometry are not rebuilt
- **AND** steady-state work is limited to active handoff and shared time-of-day
  state.

#### Scenario: A cold rebuild exceeds the shared streaming deadline

- **WHEN** candidate planning would exceed the single world-owned per-frame
  streaming deadline, of which full chunk work consumes its share first and the
  horizon receives only the remainder
- **THEN** planning proceeds incrementally by coarse cell across later frames
  while the prior snapshot stays visible
- **AND** the completed replacement is applied atomically.

#### Scenario: A rapid teleport supersedes pending work

- **WHEN** the player crosses additional 80m cells while an incremental plan is
  still pending
- **THEN** the newer cell's versioned job supersedes the older one and a stale
  snapshot never commits.

### Requirement: Isolated inspection and promotion gate

The implementation SHALL provide an isolated hub-sandbox horizon view and local
debug controls that can compare proxy-only, real-only, handoff, disabled, and
enabled states at fixed seeds, tiers, camera poses, and times of day.

#### Scenario: An agent inspects a handoff

- **WHEN** the hub sandbox selects handoff mode and changes simulated distance or
  owning-chunk state
- **THEN** the actual FarField implementation transitions against the same hub
  descriptor while live draw, triangle, resource, overflow, and rebuild statistics
  remain visible.

#### Scenario: The experimental flag is absent before promotion

- **WHEN** the initial implementation boots without `?farField=1`
- **THEN** player-visible behavior remains unchanged until the documented visual,
  determinism, lifecycle, performance, mobile, reduced-motion, and console gates
  pass
- **AND** the disabled path allocates no FarField GPU resources, shader programs,
  or planning work.

#### Scenario: Legacy worldgen forces a no-op

- **WHEN** the game boots with `?worldgen=0&farField=1`
- **THEN** effective enablement resolves false (`farFieldRequested &&
  USE_WORLDGEN_V2`) and the horizon performs zero allocation, because a horizon
  of v2 hearts over the legacy v1 world would never hand off.

#### Scenario: The feature earns promotion

- **WHEN** fixed-pose Noon and Midnight A/B captures pass on low, mid, and high;
  the draw delta is at most 12; marginal triangle deltas stay within the pinned
  per-tier caps (provisionally +5k on low, +10k on mid/high); rebuild timing fits
  within the shared streaming deadline; resource and shader counts plateau across
  long travel; and full-game logs remain clean
- **THEN** the default may be enabled while `?farField=0` remains a one-variable
  diagnostic control.

#### Scenario: A disabled baseline already exceeds an absolute budget

- **WHEN** the captured flag-off baseline on a tier already exceeds that tier's
  absolute HUD draw or triangle budget
- **THEN** that tier's promotion gate is re-keyed to marginal delta plus
  no-regression plus explicit human sign-off, and the re-keying is recorded,
  rather than leaving an unsatisfiable absolute test in place.
