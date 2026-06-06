## ADDED Requirements

### Requirement: Standalone top-down map page
The sandbox SHALL be a standalone page, separate from the existing 3D entity
sandbox, that renders the `world-layout-generator` output as a top-down 2D map using
the Canvas 2D API (not three.js), so it carries no material-tier, post-process, or
shadow-budget concerns.

#### Scenario: Page loads and draws a map
- **WHEN** the map sandbox page is opened in a browser
- **THEN** it renders a top-down view of the generated layout without requiring the 3D game or three.js

### Requirement: Seed control with deterministic re-roll
The sandbox SHALL accept a seed (via input and/or URL param) and re-render the layout
for that seed. The same seed SHALL always produce the same map; changing the seed
SHALL produce a different map.

#### Scenario: Same seed reproduces the map
- **WHEN** the user enters a seed, notes the map, reloads with the same seed
- **THEN** the rendered map is identical

#### Scenario: New seed changes the map
- **WHEN** the user changes the seed
- **THEN** the heart field, roads, and water visibly change

### Requirement: Pan and zoom across kilometers
The sandbox SHALL let the user pan and zoom the view so that multi-kilometer extents
of the infinite layout can be inspected at once — the global structure the
chunk-loaded 3D game cannot show.

#### Scenario: Zoom out reveals macro structure
- **WHEN** the user zooms out
- **THEN** the view shows kilometers of layout, with hearts, arterials, and water visible at the macro scale

#### Scenario: Pan to arbitrary coordinates
- **WHEN** the user pans the view
- **THEN** the layout for the newly visible coordinates is generated and drawn on demand

### Requirement: Per-layer visibility toggles
The sandbox SHALL provide toggles to show or hide each layout layer independently:
hearts (by rank), roads (by tier), water (lakes + rivers + bridges), tree-density
field, and per-location role tiers.

#### Scenario: Toggling a layer
- **WHEN** the user toggles a layer off
- **THEN** that layer is hidden and the others remain, so layers can be tuned in isolation

### Requirement: Point inspector
The sandbox SHALL let the user click (or hover) a point on the map and display the
generator's full layout tuple for that world coordinate (nearest heart + rank, role
tier, road state + tier, river/bridge state, tree density, lake state).

#### Scenario: Inspect a clicked point
- **WHEN** the user clicks a location on the map
- **THEN** the sandbox shows the computed layout tuple for that world coordinate

### Requirement: Local hot-reload (no-build)
Any new `src/` module the sandbox loads SHALL be registered in the page's
cache-buster list so that local edits hot-reload, per the project's no-build rule.
The page SHALL run with no bundler or transpiler.

#### Scenario: Edited module reloads locally
- **WHEN** a developer edits a generator module and reloads the sandbox on the dev server
- **THEN** the edit takes effect (the module URL is cache-busted) with no build step
