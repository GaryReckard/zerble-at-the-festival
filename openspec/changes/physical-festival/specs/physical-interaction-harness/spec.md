## ADDED Requirements

### Requirement: Production-backed repeatable encounters

A dedicated interaction fixture SHALL use production models, cart/contact adapters, prop ownership and person claims. It SHALL provide seeded encounters, speed/angle controls, reset, slow motion, single-step and inspection of bodies, sockets, claims and incident history.

#### Scenario: Replay glancing contact

- **WHEN** the same pinned recipe, seed, input sequence and step settings are replayed
- **THEN** the fixture exposes comparable trajectories and invariant results without relying on wall-clock randomness

### Requirement: Adversarial lifecycle coverage

The fixture SHALL exercise unload during motion, origin regeneration, duplicate teardown, failed transfer, occupied supports, exhaustion, pause/resume, teleports and stale person handles. It SHALL assert owned resource counts after repeated cycles.

#### Scenario: Repeated resets

- **WHEN** the full encounter is reset repeatedly
- **THEN** body, collider, joint, claim, render-slot and retained-state counts return to their declared baseline without monotonic growth

### Requirement: Measured integration acceptance

A sandbox pass SHALL NOT establish production acceptance. Implementation SHALL pass repository checks/build, the affected main-game path, visual Noon/Midnight and relevant tier checks, plus recorded physical-device timing and iOS gesture verification for boot changes.

#### Scenario: Desktop software rendering passes

- **WHEN** the fixture runs successfully in an automated software renderer
- **THEN** the report does not claim phone performance or iOS audio acceptance

### Requirement: Owned browser lifecycle

Any automated browser verification SHALL use bounded execution and explicit teardown. Standalone sessions SHALL be uniquely named with recorded process ownership and post-run orphan assertions before expanding coverage.

#### Scenario: Automation stalls

- **WHEN** a standalone browser command makes no useful progress for 60 seconds
- **THEN** the task stops its owned browser resources and reports cleanup rather than launching another WebGL session

### Requirement: Accepted-frame integration proof

Physics SHALL consume the existing accepted gameplay clock with an explicit documented contact/publication schedule. The fixture SHALL distinguish solved query poses from interpolated display poses, exercise zero/one/multiple substeps and prove that pose-only republishing does not tick activities twice. Hidden timer execution, genuine suspension and gameplay pause SHALL be tested separately.

#### Scenario: Same-frame ghost pickup

- **WHEN** star power activates on a frame where the cart reaches a physical chair
- **THEN** ghost eligibility is applied before that contact and the frame trace shows no obsolete non-ghost response

#### Scenario: Wall correction beside furniture

- **WHEN** a legacy wall corrects cart movement before physical contacts
- **THEN** the proxy uses the reconciled trajectory without interpreting positional correction as an extra high-speed impulse
