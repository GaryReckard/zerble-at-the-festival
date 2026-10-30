## ADDED Requirements

### Requirement: Single person authority

An opted-in physical reaction SHALL borrow movement and optional rendering through the current person activity claim. Population ownership and stable person identity SHALL remain intact; stale claims SHALL NOT publish motion.

#### Scenario: An old reaction resumes

- **WHEN** a reaction callback runs after its person was retired or its claim replaced
- **THEN** it cannot move the replacement person or release the replacement claim

### Requirement: Occupied support and continuous release

Each occupied seat SHALL track independent support and load. Release SHALL update seat availability, load, collision filtering and person motion coherently. Person departure velocity SHALL include support translation and rotation without duplicate impulses.

#### Scenario: Loveseat occupant leaves

- **WHEN** one of two sitters dismounts
- **THEN** only that support claim and load are released while the other occupant remains valid

#### Scenario: Trapped sitter falls

- **WHEN** an unavoidable tip occurs with no valid walking exit
- **THEN** the person can leave support into the fall state without remaining glued to the chair indefinitely

### Requirement: Graduated reaction and recovery

Eligible encounters SHALL select bracing, controlled dismount, stumble or fall from contact and stability evidence. Recovery SHALL start from the actual landing pose, require a clear stand-up placement and return movement authority once. Repeat impacts SHALL update the current reaction rather than create conflicting owners.

#### Scenario: Second hit during recovery

- **WHEN** an opted-in person is struck while standing up
- **THEN** the current reaction is interrupted or updated coherently and no second movement publisher is created

### Requirement: Seat validity follows furniture

Moving, unstable, overturned or obstructed furniture SHALL be unavailable for new seating. A restored seat SHALL use updated world transforms and validated approach clearance.

#### Scenario: Upright chair moved

- **WHEN** a chair settles upright at a new location
- **THEN** a person can reserve it only after the seat and approach at the new location are validated

### Requirement: Bounded aftermath tasks

Chair righting and drink retrieval SHALL reserve one live target generation and obey eligibility, reachability, interruption and owner teardown. Signs SHALL default to no repair task.

#### Scenario: Target moves during retrieval

- **WHEN** a cup moves after an NPC claims it
- **THEN** the activity performs a bounded replan or releases its claim without snapping the cup or leaking the reservation

### Requirement: Occupied resource adoption

Before an occupied origin disappears, the adapter SHALL synchronously acquire a valid replacement support resource through current activity preparation and rollback. It SHALL preserve stable seat/person identity and independent loads without weakening existing slot/token guards. Failure SHALL preserve valid ownership until bounded dismount/release resolves it; stale original cleanup SHALL NOT release a replacement claim.

#### Scenario: Occupied loveseat origin unloads

- **WHEN** an occupied loveseat is adopted and its campsite unloads, followed by delayed original-owner cleanup
- **THEN** each remaining sitter has valid independent replacement support and the delayed release cannot free a newer claim
