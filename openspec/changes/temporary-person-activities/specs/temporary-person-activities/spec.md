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

### Requirement: Activity motion preserves the original person

Frisbee participants SHALL use articulated throwing and catching arms on their
population-owned bodies, with a held disc attached to the rendered hand. Arm
writes SHALL require current authority and stop synchronously on interruption.
Hula body motion and the offset revolving hoop SHALL share accepted activity time,
including pauses during interruption, while keeping the person's complete appearance.

#### Scenario: A throwing pair is interrupted

- **GIVEN** two people are playing with a hand-attached disc and articulated arms
- **WHEN** a cart reaction revokes either participant's claim
- **THEN** both borrowed arm poses are released, stale hand/arm writes fail and the disc is safely settled before either activity resumes

#### Scenario: A hooper resumes

- **GIVEN** a person has paused hooping to react to a cart
- **WHEN** the same person safely resumes at the valid place
- **THEN** coordinated body motion and visible hoop revolution resume from accepted session time without replacing the body or collider
