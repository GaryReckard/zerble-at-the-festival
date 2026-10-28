# Capability: people-runtime

## Purpose

Define person ownership, compatible participation and activity/resource handoffs
without replacing specialized population behavior or existing frame barriers.
Implemented in `src/people/`, composed by `src/main.js`, and verified by the mandatory
ownership/runtime contracts plus the real-game evidence in
[acceptance](../../changes/people-npc-architecture/acceptance.md).

## Requirements

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
reject handles whose person lifetime has ended. Identity SHALL include a runtime-issued
registration-lifetime owner token and slot generation, so readable controller-key
reuse or full runtime replacement cannot revive an old handle.

#### Scenario: A pooled slot is reused

- **WHEN** a person despawns and another person occupies its previous storage slot
- **THEN** commands or releases using the old handle cannot affect the new person

#### Scenario: Registration key and pooled slot are both reused

- **WHEN** a controller is disposed and a replacement uses the same logical key and slot
- **THEN** its owner token differs and every former handle, tick, hit callback, and
  activity release fails to affect the replacement

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
or person removal, without releasing a later owner's claims. Acquisition SHALL validate
person eligibility and resource ownership, prepare tentative resources, and preserve
the existing activity on failure. Commit SHALL revoke outgoing write authority before
cleanup and incoming activation. Every movement write, tick, and new binding SHALL
require the active current claim. A revoking claim SHALL retain permission only to
release its own still-owned resources/bindings, validating person lifetime and
claim/resource ownership; the population owner SHALL commit fallback/resume.
Reentrant acquisition during a transition
SHALL be rejected; ordinary/group resume and protected-state precedence SHALL retain
the characterized policy.

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
The runtime SHALL consume accepted main-loop delta, SHALL NOT own RAF, timers,
visibility scheduling, or catch-up, and SHALL preserve non-person frame barriers.
Multiple documented integration slots SHALL remain permitted when required for
behavioral equivalence. Clock-domain changes SHALL convert stored deadlines and
comparisons together.

#### Scenario: A nested controller moves to runtime scheduling

- **WHEN** a party update is migrated out of its former parent update
- **THEN** its old invocation is removed and it executes once in the declared slot

### Requirement: Compatible spatial and collision publication

People views SHALL expose eligible participants across different internal storage
types while retaining consumer-specific eligibility and locality. Collision
publication SHALL preserve candidate order, existing exclusions,
damage classification, and single publication of movers already in the world
registry. Spatial publication SHALL NOT transfer person lifetime to chunk ownership.

#### Scenario: Registry and actor providers overlap

- **WHEN** a mover already publishes a collision body through the world registry
- **THEN** the actor provider does not append it a second time and the selected hit
  matches the characterized candidate order

### Requirement: Idempotent owner cleanup

Controller removal SHALL first stop participation and new acquisition, revoke
write authority, release borrowers while required metadata and fallback renderers
remain live, detach bindings/publications, and only then destroy exclusively owned
resources. Both crowd removal paths SHALL use one ownership-aware release core.
Cleanup SHALL release owned person claims, group membership, spatial
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

Mandatory non-browser contract suites SHALL be wired into the routine check command.
Nested source modules SHALL be discovered by the importmap checker with negative
omission/stale-entry fixtures for all required pages before extraction begins.
Every migrated controller SHALL have executable contract checks and an applicable
production-backed sandbox or integration fixture. Full-game verification SHALL
cover the real boot, collision, streaming, and cleanup paths before implementation
is declared complete.

#### Scenario: A model sandbox passes

- **WHEN** a controller's isolated rendering fixture succeeds
- **THEN** that result does not substitute for real-game boot and lifecycle checks

### Requirement: Atomic activity handoff and claim-checked motion

The population owner SHALL validate each acquisition and movement authority, while
resource owners retain reservation ownership and activity-specific movement algorithms
remain behind validated claims. Group membership SHALL NOT imply movement authority
while an activity holds it.

#### Scenario: Acquisition fails after tentative reservations

- **WHEN** an incoming activity fails preparation
- **THEN** only that attempt's tentative work is rolled back and the prior activity,
  its bindings, and movement authority remain valid

#### Scenario: Activities contend and an old tick arrives

- **WHEN** two activities request one person in a frame and a replaced activity ticks
- **THEN** existing selection order determines the winning claim and the old tick
  cannot move the person, change bindings, or release the winner's resources

#### Scenario: Group boarding is interrupted

- **WHEN** a permitted interruption cancels boarding during partial group acquisition
- **THEN** only that acquisition's reservations are released, protected-state policy
  is preserved, and the population owner's characterized resume policy applies

### Requirement: Activity motion independent of display execution

Healing Arts trajectory and constraint calculation SHALL be activity-owned and
renderers SHALL consume its pose outputs. Extraction SHALL preserve bootstrap pose,
prior-sample consumption, activity-before-sampling order, and existing near/night-transition
sampling cadence as explicit activity policy, independently of display execution.
Current-sample alignment SHALL NOT be an implicit structural-refactor change.

#### Scenario: Healing Arts runs with display updates skipped

- **WHEN** the same controlled activity runs with rendering enabled and skipped
- **THEN** its sampler follows the same characterized cadence and person/claim traces
  match through entry, dusk/dawn, distance transitions, unload, and display resumption
- **AND** its retained prior-sample offset is explicit and no model output supplies
  authoritative person position

### Requirement: Frame-level behavior and render publication

Scheduling SHALL preserve adult emission before pickup aging/collection/coalesced
scoring and child emission afterward, plus streaming, star-love, and contact barriers.
Render-binding operations SHALL dirty affected matrix/attribute ranges independently
of early Crowd execution, with valid publication after allowed same-frame writers.
Packed active counts, accessory pools, shared resources, and visual distance gates
SHALL retain their existing behavior.

#### Scenario: Equivalent frame has adult and child smile emission

- **WHEN** both populations emit during a characterized gameplay frame
- **THEN** pickup ages, collection callback frames, coalescing, and score/combo event
  order match the baseline rather than merely matching aggregate smile counts

#### Scenario: A late activity release restores an avatar

- **WHEN** release, hit interruption, or unload changes a binding after the crowd slot
- **THEN** affected slots publish before render submission without stale accessory
  instances or a second full-population preparation pass

#### Scenario: Frames are skipped or visibility changes

- **WHEN** accepted and skipped frames cross visible/hidden/visible scheduling
- **THEN** each registered phase executes once per accepted invocation, actor time
  advances once per accepted gameplay frame, and no extra autonomous update occurs

### Requirement: Group policy and ordered removal

Groups SHALL be allowed to request collective lifetime policy through the person
owner, while only that owner executes removal and invalidates identity. Cleanup
SHALL reject reacquisition on owners being removed and validate both person and
resource lifetimes before releasing a claim.

#### Scenario: A monk party leaves collectively

- **WHEN** the party's characterized distance policy requests group removal
- **THEN** the population owner removes each member once, preserves ordinary party
  distance-sweep exemptions, and tolerates partial-spawn rollback and repeated clear

#### Scenario: Teardown order varies

- **WHEN** person-first, place-first, controller-first, and repeated removal are exercised
- **THEN** authority is revoked before callbacks, borrowers release before required
  resources are destroyed, and no callback reacquires or restores a removed binding

#### Scenario: A visual effect outlives its target

- **WHEN** a lost-smile effect's target person is removed and its slot is reused
- **THEN** the effect uses its last valid target position until expiry and never
  follows the replacement occupant

### Requirement: Bounded integration work

Controller/provider lists SHALL be stable between registration changes. Queries
SHALL retain consumer eligibility, locality, and caller scratch; adapters SHALL NOT
introduce per-person-per-frame identity/view/pose allocation, duplicate moving bodies,
population-sized pose copies, or repeated full renderer preparation. Comparable
scenes SHALL target zero additional scene/shadow draws and submitted triangles.

#### Scenario: An equivalent population runs after migration

- **WHEN** warmed runs use the same seed, population, poses, camera, tier, effective
  quality, dimensions, and lifecycle state
- **THEN** candidate visits, callbacks, matrix writes, allocations, spawn cost, and
  scene counters are compared and unexplained regressions are resolved

### Requirement: Population, activity, and role extension

The contributor contract SHALL demonstrate adding a population, adding an activity
to an existing eligible person, and adding a role/render variation without forking
identity. Explicit local selector/catalog registration SHALL be permitted; unrelated
activity edits, raw-record access, and central runtime role switches SHALL NOT be
required. Display-only participation SHALL NOT require interactive person identity.

#### Scenario: An activity and role use existing people

- **WHEN** test-only activity and role examples join through documented extension points
- **THEN** existing identity/lifetime remains singular and neither example needs
  unrelated activity internals, raw Crowd records, or a runtime role switch
