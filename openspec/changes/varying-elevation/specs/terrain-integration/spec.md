## ADDED Requirements

### Requirement: Deterministic shared graded surface

The game SHALL derive bounded rolling relief and canonical complete venue/camp pads, road approaches and level lakes from existing layout using a separate terrain salt. Height queries MUST be independent of render state, request order, cache eviction and owning chunk load state, and MUST preserve existing X/Z layout fixtures and RNG draws. Descriptor discovery and sampling MUST use bounded spatial caches rather than invoke full festival planning per sample.

#### Scenario: Repeated and reordered sampling
- **WHEN** the same seed and coordinates are sampled in different orders, after tile eviction, at negative coordinates and across region boundaries
- **THEN** terrain descriptors and heights are identical and existing layout goldens remain unchanged.

#### Scenario: Seed reset
- **WHEN** the seed or worldgen epoch changes and then returns to its original value
- **THEN** caches invalidate and the original surface is reproduced exactly.

### Requirement: Render and contact agreement

Ground rendering and physical sampling MUST use one fixed world lattice and identical triangle interpolation, with absolute heights that do not change on recentering. Supported wheel contact error SHALL be at most 2cm, and an ownership boundary MUST introduce no physical step greater than 1cm. Occupied pad interiors MUST remain level, and roads and shore approaches MUST meet their shared anchors within those tolerances.

#### Scenario: Boundary and recenter traversal
- **WHEN** the cart crosses a chunk boundary, tile edge, graded transition or 40m ground recenter threshold repeatedly
- **THEN** contact agrees with rendered triangles, world landmarks retain their elevation and no seam step appears.

### Requirement: Complete world grounding

All world-height consumers SHALL use the shared surface or a canonical pad/lake level, including real cluster contents, satellite camps, roads/decals, forests, registry/interaction anchors, walking people, secondary vehicles, near/far proxies, cameras and cart attachments. Model-local animation and sitting/hammock/cart attachment states MUST retain their own offsets. Lakes MUST remain planar and retain lifecycle ownership independent of host chunks.

#### Scenario: Raised hub and adjacent lake
- **WHEN** a complete hub with camps, roads, people and a neighboring lake is built, unloaded and revisited
- **THEN** footprint corners, feet, seats, interaction points, canoe bobbing and proxies agree with visible elevations, lake colliders survive host unload, and resource/registry counts return to their expected baseline.

### Requirement: Grounded playable driving and camera clearance

The live cart SHALL use terrain tangent motion and wheel support while preserving baseline powered acceleration/boost on flat ground. Uphill load, downhill coasting, braking, parking hold, reverse and boost SHALL remain predictable, and no supported route SHALL require airborne physics. Camera modes and teleport MUST retain terrain clearance.

#### Scenario: Repeatable hill driving
- **WHEN** replay inputs exercise flat ground, ascent, descent, cross-slope, reverse, parking and boost at 30/60/120Hz
- **THEN** contact stays within tolerance, braking and parking hold work, over-limit faces cannot be climbed by alternate steering/input paths, and final speed/position differences are bounded by recorded tolerances.

#### Scenario: Crest and teleport cameras
- **WHEN** every camera mode follows the cart across a crest or immediately after teleport
- **THEN** the camera remains above terrain and terrain along the camera-target segment does not conceal the cart unexpectedly.

### Requirement: Evidence before default enablement

Rolling terrain SHALL retain a flat fallback during integration and MUST be verified in the real game before default enablement. Checks SHALL cover deterministic fixtures, map/driving/real hub harnesses, title gesture through mode-plank boot, streaming/disposal, Low/Mid/High and Noon/Midnight. Allocation/streaming cost MUST be reported separately from steady state, and unavailable mobile/iOS checks MUST remain explicit acceptance limitations.

#### Scenario: Release candidate validation
- **WHEN** the integrated feature is considered ready
- **THEN** npm check and importmap checks pass, recorded browser evidence covers actual game paths, CHANGELOG and ROADMAP match delivered behavior, and no unperformed device check is reported passed.
