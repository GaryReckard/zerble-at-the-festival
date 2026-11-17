## ADDED Requirements

### Requirement: Contact-limited service brake

The brake SHALL override propulsion, decelerate either direction and oppose
gravity on supported ordinary hills using finite traction forces. It MUST NOT
freeze pose, suppress airborne gravity or guarantee hold beyond available grip.

#### Scenario: Stop and hold a supported hill
- **WHEN** a supported cart brakes uphill or downhill, including cross-slope
- **THEN** it stops and holds within measured settling tolerance
- **AND** release allows natural motion and insufficient grip permits sliding

### Requirement: Deliberate parking latch

Parking SHALL engage only near a supported upright stop and reject requests
elsewhere without queuing. It SHALL remain set without held input, expose its
state and release explicitly or on fresh throttle after neutral qualification.

#### Scenario: Parking with throttle already held
- **WHEN** the player parks while holding throttle and the service brake
- **THEN** held throttle cannot release parking
- **AND** neutral followed by fresh forward/reverse releases it and applies drive

#### Scenario: Input interruption
- **WHEN** a menu, blur or touch cancellation clears transient input
- **THEN** the service brake clears but parking remains set
- **AND** no stale park toggle fires on resume
