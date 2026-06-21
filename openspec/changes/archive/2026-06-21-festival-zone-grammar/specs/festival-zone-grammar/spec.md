# festival-zone-grammar

> The hub-scale layout grammar. Requirements are graded against
> `../worldgen-layout-harness/verification/baseline.md` (registry mode is the
> authority) and Gary's in-game 3D judgment. "Drive to zero" means the named
> linter rule reports **0 error-severity** violations across the 10 baseline
> seeds (warns may remain if justified, recorded in the burndown table).

## ADDED Requirements

### Requirement: Non-overlapping oriented zones
The planner SHALL slot each hub's clusters as non-overlapping **oriented zones**
whose extents are derived from the same `FESTIVAL_TUNING` constants the builders
use (true per-kind extents, not scalar `KIND_FOOTPRINT` radii). Overlap, road,
water, and dancefloor checks SHALL run against those shapes. Where a zone cannot
be placed without overlap, the planner SHALL omit it (graceful degradation)
rather than place it clipping.

#### Scenario: Trucks no longer clip booths
- **WHEN** the 10 baseline seeds are linted in registry mode after the change
- **THEN** the `overlap` rule reports 0 error-severity violations (baseline: 48),
  including the seed `0xf7ef2a3c` tent×truck case (was 5.8 m) and the seed `1234`
  worst offender (was 7.5 m)

#### Scenario: A zone that can't fit is dropped, not clipped
- **WHEN** a hub is too dense to place every planned cluster without overlap
- **THEN** the lowest-priority zone is omitted and the remaining zones are clear,
  rather than all zones placed with interpenetration

### Requirement: Hard-reserved stage front wedge
Each stage SHALL reserve a clear front wedge along its front axis F as a **hard
reservation against all placement** (not merely tree-repellent). The planner's
dancefloor depth and `buildStage`'s internal dancefloor SHALL be unified to one
owner (the D8 "two owners, do NOT merge" pair becomes a legal merge here).

#### Scenario: Dancefloor stays clear
- **WHEN** the baseline seeds are linted in registry mode after the change
- **THEN** `dancefloor-clear` reports 0 error-severity violations (baseline: 10
  warn) — no cluster sub-component sits inside any stage's front wedge

### Requirement: Cross-hub stage spacing
Stages across neighbouring hubs SHALL be at least `STAGE_MIN_SPACING` apart
(today there is no such rule). The constraint lives in `FESTIVAL_TUNING`.

#### Scenario: No two stages crowd each other
- **WHEN** plan-mode lint runs over a multi-hub window
- **THEN** `stage-spacing` reports 0 violations across the baseline seeds

### Requirement: Road-straddling vendor aisles with camps behind
Vendor rows SHALL place booths on **both sides of a road, facing the aisle**,
with full campsites auto-reserved **behind** the booths (not bare tents). Booths
straddle the road; they do not sit *on* the driving surface.

#### Scenario: Booths line the road, not block it
- **WHEN** the baseline seeds are linted after the change
- **THEN** `booth-on-road` reports 0 error-severity violations (baseline: 74
  warn — the largest single rule) and booths render on both sides facing the aisle

### Requirement: Food courts respect stages and roads
Food courts SHALL sit **off-road at least `COURT_MIN_STAGE_DIST` from any
stage**. A road MAY pass through a court's open space but NEVER through a truck;
when off-road, the court MAY get a **mini spur road to its center**. Sugar
Shacks SHALL appear in a tunable **percentage** of food-truck clusters (today:
courts only).

#### Scenario: Trucks never sit on the road
- **WHEN** the baseline seeds are linted after the change
- **THEN** `truck-off-road` reports 0 error-severity violations and no court
  center sits within `COURT_MIN_STAGE_DIST` of a stage

### Requirement: Drum circle in a forest clearing with an access path
The large LEAF drum circle SHALL sit in a treed pocket (a clearing in dense
trees) with an **access path wide enough for the cart to drive in**, and its
center SHALL NOT lie inside another cluster's envelope.

#### Scenario: Drums belong to the forest
- **WHEN** the baseline seeds are linted after the change
- **THEN** `drum-in-trees` reports 0 error-severity violations (it caught a drum
  inside a food-truck ring at baseline), and the clearing renders with a
  drivable path in the hub viewer

### Requirement: Potties attached to a parent zone
Porta-potty banks SHALL attach to a parent zone's edge (stage / court / vendor
row), **facing it**, rather than scattering.

#### Scenario: Potties read as serving something
- **WHEN** the baseline seeds are linted after the change
- **THEN** `potty-attached` reports 0 error-severity violations (baseline: 8 warn)

### Requirement: Arrival composition — arch as a road threshold
The spawn SHALL be **on a road**; the festival **arch** SHALL sit out on that
road as a **threshold** (over the road, outside every dancefloor, at least
`ARCH_MIN_STAGE_DIST` from the stage), with the **main stage beyond it** so the
player drives through the arch toward the stage scene.

#### Scenario: Arch frames the approach
- **WHEN** the baseline seeds are linted after the change
- **THEN** `arch-placement` reports 0 error-severity violations (baseline: fires
  on ~every seed — the arch lands ~15·scale off-road in the lit dancefloor today)

#### Scenario: Spawn faces the festival
- **WHEN** the game spawns the player at seed 1234
- **THEN** the cart is on a road with the arch ahead and the main stage beyond
  it (verified in-game; `spawn-arrival` plan rule passes)

### Requirement: Zones clear of water
No zone center SHALL sit in a lake and no stage dancefloor mouth SHALL open onto
water (lakes survive chunk unload — a zone in water is a hard bug).

#### Scenario: Shoreline hubs stay dry
- **WHEN** the baseline seeds are linted after the change
- **THEN** `water-clear` reports 0 error-severity violations (baseline: 58 — the
  worst seeds were `256` ×29 and `99` ×28)

### Requirement: Sparse bubble vendors
Bubble-vendor presence SHALL be a **tunable probability** in `FESTIVAL_TUNING`,
not a guaranteed 1-per-hub.

#### Scenario: Not every hub has a bubble vendor
- **WHEN** the baseline seeds are inspected after the change
- **THEN** bubble vendors appear in a minority of hubs (probability-gated), not
  exactly once per hub

### Requirement: Baseline burndown is recorded
The change SHALL record a **before/after per-rule table** (Gary-legible) in the
change's verification notes, citing `worldgen-layout-harness`'s baseline as the
"before," and SHALL keep the worst-offender seeds (`1234`, `0xf7ef2a3c`, `99`,
`256`) as named regression checks.

#### Scenario: The fix is provable
- **WHEN** the change is verified
- **THEN** a before/after table shows every error-severity rule at 0 (or a
  recorded justification) and 3 before/after hub-viewer screenshots of the
  worst offenders are attached
