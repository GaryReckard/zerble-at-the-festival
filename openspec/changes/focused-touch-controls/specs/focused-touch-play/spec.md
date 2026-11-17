## ADDED Requirements

### Requirement: Focused touch layout
Touch play SHALL prioritize Brake/Honk/Boost, retain contextual Park, and expose
camera/music and existing sheets through one compact menu with unread feedback.

#### Scenario: Short landscape
- **WHEN** the game and map styles load at phone landscape sizes
- **THEN** driving/menu/map targets do not overlap or leave the viewport

### Requirement: Paused menu navigation
The compact menu SHALL pause gameplay/progress while remaining beneath its child
sheets. Child close SHALL return focus to the menu; Resume SHALL clear held input.
Camera/music actions SHALL execute once after input clear, and wheel events on
the menu MUST NOT zoom the game camera.

#### Scenario: Read and resume
- **WHEN** a player opens the menu, reads a child sheet and returns
- **THEN** gameplay remains paused until Resume without physical catch-up
- **AND** stale stick, brake, camera and toggle input cannot replay

### Requirement: Touch chase return
Only touch-originated orbit SHALL arm chase assistance. Active camera gestures,
stopped/parked/reversing motion, other views, intro and debug locks MUST inhibit
return. Forward driving SHALL resume assistance only after a grace interval,
using shortest-arc frame-rate-independent easing without changing zoom.

#### Scenario: Inspect while parked
- **WHEN** the player looks around while parked or stopped
- **THEN** the chosen offsets remain unchanged until eligible driving resumes

#### Scenario: Hybrid control
- **WHEN** the player switches from touch orbit to mouse or arrow orbit
- **THEN** automatic return disarms and desktop manual offsets persist
