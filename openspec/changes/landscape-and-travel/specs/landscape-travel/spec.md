## ADDED Requirements

### Requirement: Bounded deterministic landscape ownership

The system SHALL derive complete district and stream plans from stable seed/version/owner inputs, with finite influence and query halos. Query order, window, cache eviction and chunk residency MUST NOT change committed plans. Existing generation SHALL remain unchanged until an explicit new version is enabled.

#### Scenario: Revisit through different windows
- **WHEN** overlapping bounds query a district in reverse order after cache eviction
- **THEN** its foundations, routes, crossing elevations and stable identities are identical.

### Requirement: Occupied mountain district access

An occupied district SHALL derive elevated camping ground, steep banks and feasible access from one coordinated plan. The authored reference SHALL demonstrate broad lower and upper camping shelves, a side-road ascent and a wooded descending connection to a separate drum/fire clearing. Generated districts SHALL vary their structural forms and seeded layout, rather than repeat that authored map. Optional clearings and social landmarks MAY differ by form. Admission MUST follow full-width approach/turn/join validation of the final surface. Infeasible candidates SHALL use finite declared alternatives then reject with a reason.

#### Scenario: Different generated mountain districts
- **WHEN** distinct seed/owner inputs admit mountain districts across a declared survey
- **THEN** their meadow geometry, elevation or route structure varies within validated form families; varying only prop colors or rotation of one identical map does not satisfy the requirement.

#### Scenario: No feasible switchback
- **WHEN** the real cart sweep or outside road edge violates supported ground for every declared approach
- **THEN** no inaccessible occupied district is published and planning terminates with a rejection diagnostic.

### Requirement: Terrain use and natural slope resistance

Structural foundations, activity ground and wilderness SHALL have separate support/access policies. Unreachable regions MUST NOT host ordinary actors, occupied tents, stages or activities. A vehicle MUST NOT reject supported terrain solely because its grade exceeds the walking/placement threshold. Engine force, normal-load traction, gravity and momentum SHALL determine uphill progress, including gradual slowing, stalling and rollback. Supported downhill travel SHALL always remain available regardless of grade. All relocation and collision corrections MUST preserve actual support, water and declared deck-edge restrictions.

#### Scenario: Insufficient power on a steep bank
- **WHEN** Zerble drives uphill onto a supported slope beyond the available propulsion and traction
- **THEN** momentum carries him uphill until gravity slows the climb, and he can roll back or drive downhill without contacting an invisible grade wall.

#### Scenario: A run-up helps
- **WHEN** Zerble reaches the same steep bank with greater initial speed
- **THEN** the additional momentum carries him farther uphill without changing the terrain's support eligibility.

#### Scenario: Dense lower camping and sparse upper camping
- **WHEN** an occupied Mountain Top is planned
- **THEN** lower meadows use closely packed irregular sleeping pitches with clear driving lanes, while the upper meadow retains scattered camps and an open central lawn; real tent, door, furniture and walking clearances remain mandatory.

### Requirement: Layered support selection

Terrain and bridge decks SHALL have distinct support identities, geometry and legal approach connections. Selection MUST honor current surface/elevation and finite input validation; it MUST NOT choose a deck solely because it is the highest surface at X/Z. Repeated support samples SHALL permit caller-owned scratch/output and MUST NOT mutate shared descriptors.

#### Scenario: Underneath the bridge
- **WHEN** a terrain-supported actor passes beneath a deck without traversing its approach
- **THEN** the actor stays terrain-supported while a deck-supported actor at the same X/Z remains on the deck.

#### Scenario: Deck exit
- **WHEN** a deck-supported actor reaches a declared approach whose ground elevation agrees with the deck
- **THEN** support can transfer continuously to terrain; an undeclared edge does not silently drop the actor.

### Requirement: Layered solids and interactions

Contacts SHALL use vertical extent or actual solid geometry after X/Z broadphase. Different support IDs MUST NOT exempt a tall solid spanning both layers. Navigation, attraction, seating, boarding and participating physical props SHALL obey reachable surface connections.

#### Scenario: Object below the deck
- **WHEN** cart and object overlap in X/Z but their declared solid intervals are vertically separate
- **THEN** they do not contact; a solid spanning cart height remains eligible regardless of support identity.

### Requirement: Complete stream and crossing

A stream SHALL have a bounded canonical owner, declared receiver, coherent downstream levels and a real channel/banks matching support geometry. A crossing SHALL provide a deck, continuous supported approaches and correct collision boundaries. Initial streams MUST NOT imply unimplemented global drainage.

#### Scenario: Crossing and revisit
- **WHEN** the player drives over a stream, unloads the district and returns from the opposite side
- **THEN** water/deck/approach levels agree, support is retained while occupied, and no duplicate or stale collision remains.

### Requirement: Cheap production-backed verification and rollout

The existing terrain sandbox SHALL exercise shared support/geometry and the real cart with reproducible starts, ray/contact checks, surface diagnostics and Noon/Midnight inspection. Production enablement SHALL require real-game boot, consumer/lifecycle verification, check/build and recorded tier evidence. Physical-device and player-recognition checks SHALL remain explicitly unmeasured until observed; the project owner MAY authorize rollout before those follow-ups. No near-spawn encounter or Barn/first-aid implementation is required.

#### Scenario: Isolated proof passes
- **WHEN** the authored fixture passes contact tests but production actors or device evidence remain unverified
- **THEN** the change reports the outstanding checks and does not claim device acceptance; any owner-authorized rollout is recorded separately.

### Requirement: Default landscape selection and fallback

Modern-world gameplay with terrain enabled SHALL select landscape generation 2 when the URL omits a landscape override. `landscape=1` SHALL select the previous layout without overwriting its map exploration namespace. Explicit flat terrain or legacy world generation SHALL retain landscape generation 1. Graphics quality SHALL NOT select the landscape version.

#### Scenario: Ordinary release startup
- **WHEN** a player opens the game without a landscape parameter
- **THEN** the modern terrain world uses generation 2 and prepares its access reservations before the ready mode plank.

#### Scenario: Previous-layout fallback
- **WHEN** a developer opens the same seed with `landscape=1`
- **THEN** generation 1 is selected and its prior map exploration remains separate from generation 2.
