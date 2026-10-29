## ADDED Requirements

### Requirement: Exploration persistence

The map SHALL reveal geography only within explored cells and persist discovery per seed/layout/schema, with bounded active memory and safe failure behavior.

#### Scenario: A resumed or concurrent exploration session
- **WHEN** the player revisits negative-coordinate cells or another tab writes discovery
- **THEN** discovery bits union without loss; changed seeds and reset epochs cannot resurrect unrelated or cleared discovery

### Requirement: Live expanded map

The map SHALL provide a compact and smoothly expanded translucent view, centered on the player with zoom but no pan, while driving and timers remain active.

#### Scenario: Driving while browsing
- **WHEN** the player holds driving input while expanding or zooming
- **THEN** driving continues and map gestures do not steal driving-owned touches

### Requirement: Known and live destinations

The map SHALL retain discovered actual static landmarks across unloading and show characters and pickups only while nearby and currently available.

#### Scenario: Target leaves or is collected
- **WHEN** a selected moving character leaves range or a pickup disappears
- **THEN** the stale live marker and its tracking disappear without disclosing a remote position

### Requirement: Objective fog exception

The map SHALL support stable explicit objective markers in unexplored territory without disclosing geography and without depending on loaded scene objects.

#### Scenario: Unloaded mission destination
- **WHEN** an explicit objective is outside explored or loaded terrain
- **THEN** only its pin is shown and its identity survives chunk unload

### Requirement: Selected boundary pin

The map SHALL place a selected destination at its geographic position or clamp it to the minimap boundary in its bearing, with monotonic bounded distance scaling.

#### Scenario: Destination is far away
- **WHEN** the selected destination lies outside the map extent
- **THEN** a readable directional boundary pin indicates its bearing and becomes larger as distance decreases within its configured size range

### Requirement: Controls and preferences

M SHALL toggle the expanded map, J SHALL toggle MIDI music, the touch music button SHALL retain its behavior, and settings SHALL persist compact-map visibility. Clicking a pin SHALL toggle tracking. Mouse wheel and map pinch SHALL zoom; Escape and a tap on empty map space SHALL close expansion. The expanded map SHALL omit the heading, destination dropdown, visible zoom/close buttons, idle caption, scale and north indicator. A named distance SHALL appear only for a selected pin or a pin receiving keyboard focus.

#### Scenario: Hidden minimap
- **WHEN** the compact map is disabled in settings and the player presses M
- **THEN** the expanded map opens and discovery continues while compact rendering is hidden

#### Scenario: Direct destination interaction
- **WHEN** the player selects a visible pin and selects it again
- **THEN** tracking toggles on and off without opening a menu; an empty-space tap closes expansion

### Requirement: Bounded generation and lifecycle

The map SHALL bound geographic work, cache and pixel sizes, perform cold worldgen outside the gameplay thread, and suspend/resume separately from final disposal.

#### Scenario: Stale work after reset or suspension
- **WHEN** an old worker or storage result arrives after world/reset changes
- **THEN** it cannot replace current state; BFCache restoration resumes valid map controls
