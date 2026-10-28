## ADDED Requirements

### Requirement: Registered population participation

The people runtime SHALL register controllers with unique keys, explicit scheduling,
diagnostics, idempotent cleanup, and declared optional interaction/query capabilities.
Adding a registered population SHALL NOT require character-specific orchestration
branches in the main loop, collision collection, honk dispatch, or debug inspection.

#### Scenario: Add a specialized population

- **WHEN** a controller with supported capabilities is registered
- **THEN** it participates in its declared phases and common inspection without new
  character-specific branches in main orchestration
- **AND** unsupported reactions remain absent rather than inheriting unrelated behavior

### Requirement: Single lifetime owner and safe identity

Each interactive person SHALL have exactly one lifetime owner and a handle that
distinguishes successive occupants of reused storage. Queries and commands SHALL
reject handles whose person lifetime has ended.

#### Scenario: A pooled slot is reused

- **WHEN** a person despawns and another person occupies its previous storage slot
- **THEN** commands or releases using the old handle cannot affect the new person

### Requirement: Renderer-independent identity

Identity and behavior SHALL NOT require a particular scene graph or rendering
strategy. Existing crowd instancing SHALL remain supported without one scene node
or a newly allocated query wrapper per person per frame.

#### Scenario: An activity substitutes a visible rig

- **WHEN** a person joins and later leaves an activity with a custom model
- **THEN** the same person handle remains valid, only one visible binding is active,
  and its ordinary binding is restored after release

### Requirement: Explicit movement and activity authority

A person SHALL have at most one movement authority at a time. Activity and group
membership SHALL be distinct from lifetime ownership. Activities SHALL release
their own resource and renderer claims on completion, interruption, owner unload,
or person removal, without releasing a later owner's claims.

#### Scenario: An activity place disappears

- **WHEN** a place unloads while a person approaches or participates
- **THEN** its activity and reservations are released exactly once and the person
  retains a valid lifetime or follows its own owner's removal policy

#### Scenario: A stale activity release arrives

- **WHEN** an old activity releases after the person has acquired another activity
- **THEN** the later activity's movement, resource, and render claims remain intact

### Requirement: Ordered scheduling with one execution owner

Every controller and activity phase SHALL have exactly one scheduling owner.
Structural migration SHALL preserve existing update order until an explicit
dependency change is verified. Simulation time SHALL be supplied explicitly to
extracted actor behavior and animation, separately from profiling and audio clocks.

#### Scenario: A nested controller moves to runtime scheduling

- **WHEN** a party update is migrated out of its former parent update
- **THEN** its old invocation is removed and it executes once in the declared slot

### Requirement: Compatible spatial and collision publication

People views SHALL expose eligible participants across different internal storage
types. Collision publication SHALL preserve candidate order, existing exclusions,
damage classification, and single publication of movers already in the world
registry. Spatial publication SHALL NOT transfer person lifetime to chunk ownership.

#### Scenario: Registry and actor providers overlap

- **WHEN** a mover already publishes a collision body through the world registry
- **THEN** the actor provider does not append it a second time and the selected hit
  matches the characterized candidate order

### Requirement: Idempotent owner cleanup

Controller removal SHALL release owned person claims, group membership, spatial
registrations, render attachments, and audio handles. Repeating cleanup SHALL be
safe and SHALL NOT dispose geometry or materials marked as shared.

#### Scenario: Disposal repeats after unload

- **WHEN** a controller is disposed after its place or session already released it
- **THEN** no owned registrations or claims remain and unrelated shared resources survive

### Requirement: Preserve behavioral and random-stream contracts

Structural extraction SHALL preserve supported reactions, movement policies,
population caps, smile reset rules, and existing RNG draw order. Identical helper
rules SHALL be shared only when their differences are represented explicitly.

#### Scenario: Adult and child share smile eligibility

- **WHEN** both use the extracted cooldown and distance-reset rule
- **THEN** their eligibility matches their baselines while distinct gain functions
  and bubble-chasing behavior remain unchanged

### Requirement: Production-backed verification surface

Every migrated controller SHALL have executable contract checks and an applicable
production-backed sandbox or integration fixture. Full-game verification SHALL
cover the real boot, collision, streaming, and cleanup paths before implementation
is declared complete.

#### Scenario: A model sandbox passes

- **WHEN** a controller's isolated rendering fixture succeeds
- **THEN** that result does not substitute for real-game boot and lifecycle checks
