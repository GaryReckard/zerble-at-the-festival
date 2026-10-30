## ADDED Requirements

### Requirement: Deterministic useful placement

Signs SHALL be selected sparsely at verified route choices or meaningful entrances using independent deterministic planning inputs. Overlapping chunk queries SHALL agree on canonical sign identity and owner without perturbing existing placement streams.

#### Scenario: Different exploration order

- **WHEN** the same junction is generated through overlapping regions in different orders
- **THEN** sign identity, destination choices and pose agree and existing world descriptors remain unchanged

### Requirement: Truthful route and destination

Every sign blade SHALL reference a valid destination and an evidenced next route segment or clear direct approach. The planner SHALL omit a blade when connectivity, built destination or clearance cannot be established. It SHALL NOT infer a walkable route from bearing alone.

#### Scenario: Nearest destination lies across a lake

- **WHEN** a close POI has no verified connecting route in the bounded planning area
- **THEN** no blade points across the lake merely because it is nearest

#### Scenario: Built destination is omitted

- **WHEN** a planned target fails actual placement or loses validated access
- **THEN** the corresponding blade is rejected or invalidated before it advertises that route

### Requirement: Readable physical signage

Signs SHALL preserve road and access clearance, use a bounded label/texture strategy and remain readable in representative camera approaches. Blades and text SHALL follow the physical sign pose; map discovery SHALL remain independent.

#### Scenario: Sign falls sideways

- **WHEN** a sign topples
- **THEN** its text and arrows rotate with it and no destination discovery reward is granted

### Requirement: Damage without mandatory repair

A sign SHALL support its recipe-defined standing, fallen or flattened/folded state. Automatic recovery SHALL be disabled by default. Damage SHALL remain while the arrangement is locally retained and SHALL reset only through the physical-prop safe distance-reset contract.

#### Scenario: Sign settles flat

- **WHEN** a sign finishes falling
- **THEN** it remains flat until an explicitly configured external action or safe distance reset changes it

### Requirement: Destination validation independent of residency

The placement adapter SHALL publish unknown, accepted or rejected access evidence keyed by stable destination identity, epoch and revision. Missing render/registry residency SHALL NOT imply rejection. Unknown evidence SHALL defer blade publication until bounded validation succeeds, without requiring the destination's graphics to load. Planning and label caches SHALL have explicit work/storage bounds and epoch invalidation.

#### Scenario: Destination loads after its sign

- **WHEN** sign-first and destination-first exploration validate the same immutable destination and route
- **THEN** accepted sign intent agrees and subsequent destination unload does not remove a valid blade merely because its registry entry disappeared
