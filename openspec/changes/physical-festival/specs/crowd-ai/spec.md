## MODIFIED Requirements

### Requirement: Hit response panics and infects

Non-participating crowd contacts SHALL retain the existing scripted knockback/flee response and nearby panic behavior within 6m. Opted-in ordinary crowd members SHALL use the physical-person reaction contract to brace, dismount, stumble or fall according to contact evidence before recovering into an eligible behavior. Their reaction SHALL preserve person identity, protected activity policy and single movement authority. Nearby social reactions SHALL be bounded and SHALL NOT recursively create unlimited physical reactions or penalties.

#### Scenario: A legacy plow scatters the crowd

- **WHEN** the player damages a non-participating crowd member at speed
- **THEN** the existing victim and nearby panic response applies

#### Scenario: An occupied physical chair tips

- **WHEN** an opted-in sitter loses support
- **THEN** its current claim transfers coherently into dismount/fall recovery and the person does not simultaneously walk or retain an invalid seat reservation
