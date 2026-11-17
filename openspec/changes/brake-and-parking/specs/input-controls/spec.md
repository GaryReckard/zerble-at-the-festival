## ADDED Requirements

### Requirement: Brake and parking bindings

Space SHALL hold the service brake, E SHALL honk, and R SHALL toggle parking.
Shift boost, Ctrl keyboard precision, W/S forward/reverse and B/H specific horns
SHALL remain available. Touch Brake SHALL replace Slow, with a separate Park
toggle and simultaneous steering. Clearing input MUST clear brake holds and
parking edges, and controls MUST not leak into typing or modified shortcuts.

#### Scenario: Steer and brake
- **WHEN** the player holds Space or touch Brake while steering
- **THEN** propulsion is suppressed, steering remains and no honk is emitted

#### Scenario: Touch Park and honk
- **WHEN** a player taps Park or Honk
- **THEN** the corresponding R or E action fires once, without a camera gesture
