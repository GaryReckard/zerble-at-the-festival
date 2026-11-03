## ADDED Requirements

### Requirement: Continuous physical vehicle
The player SHALL use one dynamic chassis and bounded wheel suspension under the shared fixed-step world.
#### Scenario: Ridge departure
- **WHEN** the ground recedes beyond wheel reach
- **THEN** momentum and gravity SHALL determine flight until real collision without terrain snapping.
#### Scenario: Clock and cleanup
- **WHEN** render frequency changes or the owner is disposed
- **THEN** accepted-time replay SHALL remain equivalent and all owned vehicle resources SHALL be released.

### Requirement: Surface response and rational engine
Grass, dirt, asphalt, bridge and wet terrain SHALL have explicit traction/resistance profiles and engine feedback SHALL use throttle/load/contact rather than vertical falling speed.
#### Scenario: Different surfaces
- **WHEN** identical controls drive across dry road, grass and shallow water
- **THEN** grip and resistance SHALL follow the sampled physical support and water depth.

### Requirement: Water depth and consequences
Water SHALL have a bed and surface, shallow immersion SHALL resist motion, and sustained critical immersion SHALL end play exactly once.
#### Scenario: Creek and lake
- **WHEN** Zerble crosses shallow water or enters deep lake water
- **THEN** shallow water SHALL remain physically passable and critical submersion SHALL use the existing end screen without changing pedestrian water admission.

### Requirement: Vehicle damage
A visible bounded damage meter SHALL increase from meaningful chassis impacts and hard landings, with incident deduplication; saturation SHALL end play exactly once.
#### Scenario: Tree crash
- **WHEN** Zerble hits a solid obstacle at substantial closing speed
- **THEN** the meter SHALL increase according to severity while parked contact and persistent resting contact SHALL not accumulate damage.
#### Scenario: Future restoration
- **WHEN** a caller restores a specified amount
- **THEN** damage SHALL decrease within bounds without introducing a repair shop in this change.
