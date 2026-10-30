## ADDED Requirements

### Requirement: Stable identity and singular ownership

Each physical prop SHALL have a stable logical identity independent of its current engine handle, render slot and registry ID. Exactly one lifetime owner SHALL coordinate origin, adopted residency and retirement. Regenerating an origin SHALL NOT duplicate an adopted prop.

#### Scenario: Origin reload while prop is displaced

- **WHEN** the origin unloads and reloads while its chair remains active elsewhere
- **THEN** one chair exists and its current pose, claims and render binding remain coherent

### Requirement: Bounded simulation and support residency

Simulation SHALL use a fixed-step policy with bounded catch-up, explicit capacities and protected active/supporting objects. Sleeping SHALL NOT be treated as released storage. Ground and static contact proxies SHALL exist before an active object can reach them.

#### Scenario: A settled support is still needed

- **WHEN** an upper object rests on a settled lower object at the retirement boundary
- **THEN** the lower collision support remains valid or an equivalent static support is installed before its body is removed

#### Scenario: Capacity is exhausted

- **WHEN** a new optional object would exceed a configured limit
- **THEN** the admission policy rejects or simplifies it without deleting an observed or support-critical body

### Requirement: Render and registry agreement

A prop SHALL publish its solved pose, conservative bounds, avoidance footprint and socket transforms consistently. Moving batched parts SHALL retain correct parent transforms and dirty-buffer flags. Representation changes SHALL leave exactly one visible object.

#### Scenario: Campsite unloads during flight

- **WHEN** a chair moves outside its origin batch and that owner unloads
- **THEN** its active representation survives or retires through the documented unobserved policy without a duplicate, stale collider or disposal of shared resources

### Requirement: Support and attachment recipes

Chair, cooler and sign recipes SHALL distinguish physical support/attachment from material grouping. Cooler holders SHALL follow the actual supporting part; articulation SHALL move only mechanically attached parts.

#### Scenario: Cooler lid moves

- **WHEN** an articulated cooler opens
- **THEN** cup wells follow the lid while body handles and badge remain attached to the body

### Requirement: Safe distance reset

Displaced/damaged state SHALL exist only for the live neighborhood and currently adopted objects. An arrangement SHALL reset only beyond a configured distance boundary with hysteresis, outside observation and after relevant support/holder/activity dependencies are safely released or transferred. Historical displacement records SHALL NOT be serialized or restored. Stable procedural regeneration SHALL recreate original arrangements after reset while suppressing duplicates of still-live adopted items. Lasting progress and reward eligibility SHALL retain their independent policies.

#### Scenario: Nearby consequences remain

- **WHEN** the player looks away or makes a short departure inside the retention boundary
- **THEN** an overturned chair or flattened sign remains changed

#### Scenario: Distant return restores the arrangement

- **WHEN** an arrangement completes safe distance-reset teardown and the player later returns
- **THEN** its original deterministic props regenerate without resetting lasting progress or reward eligibility

#### Scenario: Player follows a displaced chair

- **WHEN** the original campsite qualifies for reset but the player follows its chair or carries its cup nearby
- **THEN** that adopted object remains live and its origin cannot regenerate a duplicate until its temporary ownership ends

### Requirement: Idempotent teardown

Removal, reset, failed initialization and disposal SHALL release owned bodies, colliders, constraints, claims, render slots, terrain references and event records exactly once. Shared resources SHALL survive individual prop removal.

#### Scenario: Two teardown paths coincide

- **WHEN** origin removal and a world reset both attempt to release the same prop
- **THEN** the second release is harmless and resource counts return to the declared baseline

### Requirement: Canonical generation clearance

Procedural placement SHALL retain its established canonical blocker geometry and ordering independently of moved prop footprints or newly added decoration. Runtime avoidance SHALL use current poses. A newly loaded canonical solid intersecting a displaced prop SHALL trigger bounded runtime reconciliation rather than silently change established generated content. Reconciliation SHALL NOT visibly reset a prop; unsafe publication SHALL wait in bounded pending work while optional regional admissions are held.

#### Scenario: Motion does not regenerate scenery

- **WHEN** the same seed and load order are replayed with different prop displacement and sign publication timing
- **THEN** preexisting generated descriptors and downstream established RNG results remain equal to their matched baseline

### Requirement: Capacity includes work and release liability

Admission SHALL bound resident storage, queued work, per-frame creation work, contact-event processing and suppression/dormant metadata. Supported assemblies SHALL reserve body/collider/render/event capacity for mandatory releases before admission. Optional content SHALL NOT consume that reserve. Preparation SHALL share the world streaming allowance rather than create an independent full allowance.

#### Scenario: Saturated loveseat loses support

- **WHEN** both occupants and their cups lose support while optional capacity is exhausted
- **THEN** reserved capacity enables all required releases with singular representations, released claims and no configured capacity overflow

#### Scenario: Distant arrangement resets

- **WHEN** safe distance-reset teardown releases an arrangement
- **THEN** obsolete suppression metadata is released coherently while keys for still-live adopted objects remain protected
