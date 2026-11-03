## MODIFIED Requirements

### Requirement: Arcade driving physics
Zerble SHALL retain forgiving throttle, steering, boost, reverse and braking controls, with normal road target18m/s and boost target27.9m/s. In ordinary play the shared physical chassis SHALL own movement and finite wheel suspension SHALL apply terrain-dependent grip and resistance. The legacy controller SHALL remain available to isolated historical fixtures and explicit physics-disabled diagnostics.
#### Scenario: Boost raises the speed cap
- **WHEN** throttle and boost are held on supporting road
- **THEN** propulsion SHALL target the higher powered speed without erasing downhill momentum.
#### Scenario: Coasting decays speed
- **WHEN** throttle is released
- **THEN** rolling resistance SHALL follow actual wheel support without damping airborne vertical motion.

### Requirement: The drivable world is infinite
The cart position SHALL NOT be clamped, and the world SHALL stream around its motion. Physical vertical position and rotation SHALL follow gravity, suspension and collision rather than being pinned to zero.
#### Scenario: Driving outward keeps streaming new world
- **WHEN** the player drives outward or falls off a ridge
- **THEN** bounded collision reservations SHALL protect every accepted physics step and no world clamp SHALL halt travel.

### Requirement: Invulnerability window on hit
Person-collision consequences SHALL preserve their brief immunity window. Physical chassis motion SHALL remain solver-owned, and a separate incident-based damage meter SHALL count substantial collisions and hard landings once per impact episode.
#### Scenario: A hit grants brief immunity
- **WHEN** a person-hit reaction is eligible
- **THEN** repeated smile penalties SHALL be suppressed during the immunity window without disabling terrain contact or repositioning the physical chassis.
