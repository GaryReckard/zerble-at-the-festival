# Temporary person activities

## ADDED Requirements

### Requirement: One person lifetime

Eligible participants SHALL retain their population-owned identity, personality and appearance while entering, performing, interrupting, resuming and leaving an activity. Exactly one visible body and one authoritative collider represent an unconstrained participant.

#### Scenario: Full hula cycle

- **GIVEN** an eligible ordinary person and a valid hula place
- **WHEN** the person starts hooping, dodges a charging and honking cart, safely resumes, finishes and departs
- **THEN** the same person and appearance persist throughout, and activity movement never overrides the urgent reaction

### Requirement: Validated interruption and return

The activity SHALL own its props and reservations, while movement and binding writes require valid authority. A reaction obtains priority subject to the person's physical constraints. Resumption requires current person, place, partner and resource validity, and a safe return route; otherwise the activity cancels and returns the person to ordinary behavior.

#### Scenario: Place disappears during a reaction

- **GIVEN** a participant has interrupted an activity to avoid a cart
- **WHEN** the place or its reserved resource is removed or replaced
- **THEN** the old activity cannot write or resume, and it releases its owned resources without affecting replacements

#### Scenario: Physically constrained person reacts

- **GIVEN** a person is inside a potty or aboard a vehicle
- **WHEN** the cart approaches or honks
- **THEN** the reaction respects the person's physical situation and does not force an unsafe exit or free-space flee

### Requirement: Coordinated frisbee interruption

Both participants and the disc SHALL belong to one session with explicit held, flying and landed interruption policies. The session resumes only when both people and its resources remain valid; otherwise it releases both participants and safely resolves the disc.

#### Scenario: Partner is lost during flight

- **GIVEN** a disc is flying between two participants
- **WHEN** one participant or the session's place becomes invalid during interruption
- **THEN** the disc is safely resolved, both claims and reservations are released, and neither participant resumes alone

### Requirement: Explicit eligibility and integration

Population and venue policies SHALL select eligible people deliberately. Existing frame, scoring, random-stream, audio initialization, nightness and shared-resource contracts remain intact.

#### Scenario: Unrelated populations remain excluded

- **GIVEN** a population without an explicit compatible activity policy
- **WHEN** a hula or frisbee place selects participants
- **THEN** it does not recruit that population merely because its people are queryable
