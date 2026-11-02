## MODIFIED Requirements

### Requirement: Invulnerability window on hit

Legacy person-contact Zerble.applyHit(pushDir) SHALL retain knockback and its brief invulnerability window so one collision does not repeatedly deduct damage. Physical contact adapters SHALL honor penalty immunity without stopping simulation, support contacts or settling. The cart SHALL have one movement-response authority per contact. Star-power ghost behavior SHALL remain a distinct explicit collision-filter policy, with safe transitions when enabling or disabling it.

#### Scenario: A legacy hit grants brief immunity

- **WHEN** applyHit runs for a legacy person collision
- **THEN** the cart is knocked back and is immune to repeated damage until the window expires

#### Scenario: Furniture moves during immunity

- **WHEN** a chair remains in physical contact while the cart has damage immunity
- **THEN** physics continues coherently without repeated penalties or legacy double response

#### Scenario: Ghost mode ends in an overlap

- **WHEN** ghost collision filtering is removed while the cart overlaps a prop
- **THEN** the configured bounded separation policy restores valid contacts without an explosive correction

### Requirement: Distinct object response and consequences

Empty-object contact SHALL NOT deduct smiles, break the combo, or display a punitive hit flash/toast. Movable props SHALL resist according to their physical response, while fixed solids SHALL resolve overlap and incoming motion without the person-hit reverse kick. Collision sound MAY remain. Damage cooldown SHALL NOT disable solid-object contact.

#### Scenario: Empty chair impact

- **WHEN** Zerble strikes an empty chair
- **THEN** its physical contact response is retained without smile loss or person-hit punishment

#### Scenario: Person affected by occupied support

- **WHEN** occupied-support integration identifies an actual person incident
- **THEN** that incident is evaluated separately from the furniture contact under the person consequence policy
