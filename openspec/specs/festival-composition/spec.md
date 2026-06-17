# Capability: festival-composition

> **Source:** `src/worldgen/festival.js` (the per-heart POI plan + cross-hub seam
> grammar), `placement.js` (per-chunk cluster-center ownership filter),
> `constants.js` + `tuning.js` (`CONFIG` / `FESTIVAL_TUNING` named tunables). The
> render-agnostic substrate (hearts/roads/water/density) is `worldgen-layout`; the
> 3D build of these descriptors is `world-streaming`; the hub viewer + linter are in
> `sandbox-harness`.
>
> Promotes the delta specs `festival-zone-grammar`, `builder-layout-extraction`,
> and `festival-tuning`. **Reconciliation:** these describe the shipped headless
> planner (the layout work is complete in the in-flight `festival-zone-grammar`
> change; remaining tasks there are feel/visual/human-gated polish, not the grammar
> itself). The change-process "baseline burndown" requirement is omitted here as a
> process artifact, not a system capability.

On top of the worldgen substrate sits the festival composer: for each heart it plans
a complete festival hub as pure data descriptors, resolves clashes where two dense
hubs meet, and lets the chunk system own and build exactly the clusters whose centers
fall in each chunk.

## ADDED Requirements

### Requirement: Per-heart POI zone-slotter

`festival.js` SHALL compute, for each heart, a single-pass priority plan that slots
the stage at the heart (facing the driest road gap), then vendor aisles, food courts
off side roads, a rear-biased drum circle, porta-potty banks, a welfare-station bubble
vendor, and a major-hub entrance arch. The plan output SHALL be pure descriptors
(`{ kind, x, z, yaw, scale, clusterSeed, … }`) with no `three` and no DOM. Camp
villages SHALL be planned on a separate coarse grid (the "back of the festival")
(`festival.js:1-13`, `ARCHITECTURE.md:164`).

#### Scenario: A heart becomes a planned hub

- **WHEN** the festival plan is computed for a heart
- **THEN** it returns descriptors for the stage and the supporting POIs, each a plain
  data object carrying a `clusterSeed`

### Requirement: Non-overlapping oriented zones with graceful omission

The planner SHALL slot each cluster as a non-overlapping **oriented zone** whose
extent is derived from the same `FESTIVAL_TUNING` constants the builders use (true
per-kind extents, not scalar radii), and SHALL run overlap, road, water, and
dancefloor checks against those shapes. Where a zone cannot be placed without overlap,
the planner SHALL **omit** it (graceful degradation) rather than place it clipping
(`festival-zone-grammar` spec; `festival.js`).

#### Scenario: A zone that can't fit is dropped, not clipped

- **WHEN** a hub is too dense to place every planned cluster clear of the others
- **THEN** the lowest-priority zone is omitted and the rest stay clear, rather than
  all zones placed interpenetrating

### Requirement: Placement rules per zone kind

The plan SHALL enforce, per kind: the stage reserves a hard-clear front wedge
(dancefloor) along its front axis against all placement; vendor rows straddle a road
with booths on both sides facing the aisle and full campsites reserved behind; food
courts sit off-road at least `COURT_MIN_STAGE_DIST` from any stage (a road may cross
the open court but never a truck); the drum circle sits in a treed pocket with a
cart-wide access path and its center clear of other envelopes; porta-potty banks
attach to a parent zone's edge facing it; the entrance arch sits over the spawn road
as a threshold with the main stage beyond it; and no zone center sits in a lake nor
opens a dancefloor onto water (`festival-zone-grammar` spec; `festival.js:110-254`).

#### Scenario: Trucks never sit on a road

- **WHEN** a food court is planned near an arterial
- **THEN** no truck descriptor lands on the driving surface, and the court center is
  at least `COURT_MIN_STAGE_DIST` from any stage

#### Scenario: Arch frames the approach

- **WHEN** a major hub is planned
- **THEN** the arch sits on the spawn road outside every dancefloor with the main
  stage beyond it, so the player drives through the arch toward the stage

### Requirement: Probability-gated sparse features

Bubble-vendor presence and the Sugar-Shack-in-a-food-court SHALL be tunable
probabilities in `FESTIVAL_TUNING`, not guaranteed once-per-hub
(`festival-zone-grammar` spec).

#### Scenario: Not every hub has a bubble vendor

- **WHEN** hubs are inspected across seeds
- **THEN** bubble vendors appear in a minority of hubs, probability-gated

### Requirement: Cross-hub seam grammar resolved without communication

Where two dense hubs' fronts meet, `festival.js` SHALL classify the clash by an
**integer** hub-priority (`getHubPriority(cx, cz)` — pure uint32 from cell + session
seed, exact-equality ties broken by `(cx,cz)`) and resolve it identically from both
hubs with no communication: the higher-priority hub keeps, the lower yields. The
responses SHALL be `merged_court` (food+food → one court), `shared_street` (vendor
rows fuse/trim), `yield` (a drum cedes to a neighbor stage), and `soft_buffer` (loud
meets quiet → dress with a shrub hedge, don't delete). The seam substrate SHALL be
integer-only so no float gates a feature's existence, and SHALL be load-order
independent (canonicalized by `(cx,cz)` so pair `(A,B) === (B,A)`)
(`festival.js:257-291`).

#### Scenario: Both hubs resolve a seam the same way

- **WHEN** hubs A and B seam and A has higher integer priority
- **THEN** A is the keeper and B yields, computed identically whether evaluated from
  A's chunk or B's chunk

### Requirement: Cluster-center ownership filter

`placement.js` SHALL select, per chunk, the clusters whose **center** falls within
that chunk, so the owning chunk builds the whole cluster (which may spill into
neighbors) and a cluster can never appear or vanish based on which overlapping chunk
asks (window-invariance) (`placement.js`, `ARCHITECTURE.md:165`).

#### Scenario: One chunk owns a spilling cluster

- **WHEN** a cluster's geometry spills across a chunk boundary but its center is in
  chunk A
- **THEN** chunk A builds the entire cluster and chunk B builds none of it

### Requirement: FESTIVAL_TUNING is the single tunable source

Named tunables in `constants.js` (`CONFIG`) and `tuning.js` (`FESTIVAL_TUNING`) SHALL
be the single source consumed by BOTH the planner (zone extents, spacing minimums,
probabilities) and the 3D builders (cluster dimensions), so plan and build agree and
a tuning slider rebuilds both coherently (`constants.js`, `tuning.js`,
`festival.js:105-116`).

#### Scenario: One constant drives plan and build

- **WHEN** a `FESTIVAL_TUNING` extent constant changes
- **THEN** both the planner's overlap check and the builder's geometry use the new
  value, staying consistent
