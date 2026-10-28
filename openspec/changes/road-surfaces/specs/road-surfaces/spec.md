## ADDED Requirements

### Requirement: Planned road surfaces
The layout SHALL assign one deterministic surface and visible width to each canonical road edge, reflecting the planned hub access role without adding or moving road routes or consuming existing RNG streams.

#### Scenario: Endpoint and query order
- **WHEN** an edge is queried from either endpoint, through bounds, approach or point queries, or after a different seed was visited
- **THEN** its surface, width and route SHALL agree for the restored seed.

### Requirement: Footprint agreement
The detailed renderer, distant renderer and map SHALL consume the same planned width and surface, and placement checks SHALL clear the rendered half-width plus the applicable shoulder.

#### Scenario: Wider paved approach
- **WHEN** a road is paved near a stage, campsite, tree, water edge or food court
- **THEN** its complete visible ribbon SHALL remain inside the planned clear corridor and SHALL NOT overlap occupied venue footprints.

### Requirement: Stable textured appearance
Dirt and asphalt SHALL have distinct, subtle procedural textures with consistent world scale, mipmaps and shared resource ownership across chunks. Dirt access paths SHALL use the same dirt finish. Both surfaces SHALL remain visible in Low and Mid at Noon and Midnight.

#### Scenario: Streaming boundary and unload
- **WHEN** the camera crosses a chunk boundary and an adjacent chunk unloads and reloads
- **THEN** texture phase and density SHALL remain continuous, shared textures/materials SHALL remain live, and no additional texture or material SHALL be allocated per frame.

### Requirement: Terrain and integration safety
Roads SHALL retain terrain conformity and the distant-road ordering fix, fixed distant buffer limits, existing frame/scoring barriers and synchronous start-gesture audio initialization.

#### Scenario: Reported terrain crease
- **WHEN** the reported road at seed 3248888364 near x176.19 z-674.37 is rendered
- **THEN** the distant surface SHALL remain beneath the detailed road across triangle interiors, with no black polygon appearing through it.
