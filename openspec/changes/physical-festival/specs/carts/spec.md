## MODIFIED Requirements

### Requirement: Invulnerability window on hit

Legacy Zerble.applyHit(pushDir) SHALL retain knockback and its brief invulnerability window so one collision does not repeatedly deduct damage. Physical contact adapters SHALL honor penalty immunity without stopping simulation, support contacts or settling. The cart SHALL have one movement-response authority per contact. Star-power ghost behavior SHALL remain a distinct explicit collision-filter policy, with safe transitions when enabling or disabling it.

#### Scenario: A legacy hit grants brief immunity

- **WHEN** applyHit runs for a legacy collision
- **THEN** the cart is knocked back and is immune to repeated damage until the window expires

#### Scenario: Furniture moves during immunity

- **WHEN** a chair remains in physical contact while the cart has damage immunity
- **THEN** physics continues coherently without repeated penalties or legacy double response

#### Scenario: Ghost mode ends in an overlap

- **WHEN** ghost collision filtering is removed while the cart overlaps a prop
- **THEN** the configured bounded separation policy restores valid contacts without an explosive correction
