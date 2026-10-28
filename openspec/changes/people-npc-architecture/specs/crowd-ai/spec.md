## MODIFIED Requirements

### Requirement: Roaming obstacle groups on placed loops

Focused population controllers SHALL own the puppet parade, brass band, kid gaggle,
and wooks and SHALL participate through the people-runtime contracts. Loop-based
groups SHALL preserve their existing placed-loop movement and relocation policies;
children SHALL preserve their gaggle, bubble-chasing, scattering, and recycling
behavior. Each controller SHALL publish its existing collision metadata
`{ position, radius, damage, kind }` through an ordered collision source. Geometry
SHALL remain in `src/models/`; controllers SHALL own behavior. The puppet parade
SHALL retain honk-scatter, where puppets ahead of a parked, honking player dodge
laterally while their loop continues marching.

#### Scenario: A parade marches across the field, not just origin

- **WHEN** a roaming loop group spawns or recycles
- **THEN** its loop is placed at a random anchor according to its existing policy
  and its members are exposed as collision candidates

#### Scenario: Honking scatters puppets ahead

- **WHEN** the player honks while parked in front of the puppet parade
- **THEN** the puppets in front dodge laterally for a moment while the parade loop continues

#### Scenario: Children remain behaviorally distinct

- **WHEN** the child controller participates through the common runtime
- **THEN** children retain gaggle movement and bubble chasing without receiving
  adult-only boarding or amenity behavior merely through registration
