## ADDED Requirements

> These requirements are **measurement-gated**: each ships only if the B0 draw/tri
> instrumentation (see `frame-budget`) shows the targeted cost is real on the tier
> in question. Items the numbers don't justify are deferred to ROADMAP, not forced.

### Requirement: Distance- and visibility-tiered crowd updates

NPC simulation cost SHALL scale down with distance from the player and with being
outside the camera view, without a perceptible change to nearby on-screen crowd
behavior.

#### Scenario: Distant NPCs update on a reduced cadence

- **WHEN** an NPC is beyond the near-interaction range (well outside the
  smile/eye-contact radius)
- **THEN** its full state-machine update runs on a reduced cadence (round-robin
  across frames) with position extrapolation between updates
- **AND** NPCs within the near range continue to update every frame.

#### Scenario: Off-screen NPCs freeze and wake without popping

- **WHEN** an NPC is behind the chase camera and beyond near range, and is not in
  an active state (fleeing, riding)
- **THEN** its simulation is parked until the camera turns toward it, and on wake
  it resumes without a visible teleport or mid-stride snap.

### Requirement: Fog-bounded far culling

The camera far plane and chunk residency SHALL be bounded by the fog distance so
geometry fully obscured by fog is not rendered. The bound MAY remain farther than
the fog wall where a shared visual backdrop requires it.

#### Scenario: Geometry past the fog wall is culled, not drawn-then-fogged

- **WHEN** fog fully obscures geometry beyond a distance D
- **THEN** the camera far plane is the shortest range that still contains the
  non-fogged sky, stars, mountains, and ground envelope
- **AND** the frustum drops fog-hidden retained world geometry beyond that range
  with no visible pop-out.

### Requirement: Static-decor geometry merge at chunk completion

Static, same-material decor within a completed chunk SHALL be mergeable into
fewer draw calls without breaking disposal safety.

#### Scenario: Merged decor disposes correctly on chunk unload

- **WHEN** a chunk's static decor has been merged into a combined geometry and the
  chunk later unloads
- **THEN** the merged geometry is disposed exactly once and pooled/shared
  resources tagged `userData.shared` are skipped, with no shader-recompile storm
  in other chunks.

### Requirement: Faked atmosphere stays cheap and tier-aware

Atmospheric mood effects (stage-light shafts, lake reflections, ambient sparkle) SHALL be cheap fakes that add no shadow-casting lights and MUST shed gracefully under load.

#### Scenario: Stage-light shafts and lake glints add no real lights or shadows

- **WHEN** night stage-light shafts or lake-surface glints are shown
- **THEN** they are billboard/additive or screen-space fakes, add zero
  shadow-casting lights, and respect the per-tier draw budget.

#### Scenario: Ambient sparkle sheds first under load

- **WHEN** the running frame-time estimate indicates the budget is slipping
- **THEN** the ambient sparkle (string-light/firefly/ember sprites) count reduces
  before any structural geometry is dropped, and recovers when budget returns.
