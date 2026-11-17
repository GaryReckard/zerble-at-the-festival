## ADDED Requirements

### Requirement: Floating stick ownership
A lower-left world-canvas touch SHALL be eligible to start a floating stick,
while the visible stick remains usable above the expanded map. HUD, map and
button touches SHALL retain their own interactions. All identifiers in batched
starts/moves/ends SHALL update their respective owners, including stick and pinch.

#### Scenario: Steer and inspect
- **WHEN** one finger drives and two other fingers pinch the camera
- **THEN** simultaneous changed touches update throttle, steer and zoom
- **AND** cancellation and modal input clear release their owners cleanly
