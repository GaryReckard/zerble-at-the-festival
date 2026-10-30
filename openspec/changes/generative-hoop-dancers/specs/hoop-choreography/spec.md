## ADDED Requirements

### Requirement: Classic and flow styles coexist
The system SHALL retain classic waist hooping and add an opt-in flow style through the existing Crowd-owned activity contract, within an explicit bounded participant and prop capacity.

#### Scenario: Mixed activity styles
- **WHEN** classic and flow slots are active together
- **THEN** waist mode retains continuous waist hooping with shared expressive body articulation and each participant has exactly one current activity claim and one Crowd-owned identity.

### Requirement: Bounded composition with recognizable motifs
The composer SHALL create seeded phrases using validated movement/contact compatibility, performer profiles, bounded recent history and a motif/variation/resolution structure. Each complete score MUST have an entrance, motif development, flourish and resolution, with at most 32 segments and 16 candidate checks per segment. Sampling MUST perform no stochastic planning; exhaustion MUST select a validated safe bridge or decline the performance.

#### Scenario: Returning motif
- **WHEN** a seeded phrase completes its variations
- **THEN** its recorded score includes a recognizable return or resolution and exposes its choices for inspection.

#### Scenario: No compatible candidate
- **WHEN** the candidate budget is exhausted by reach or clearance rejection
- **THEN** the score takes a validated safe bridge or ends the performance safely without an unbounded search.

### Requirement: Unified contact and pose sampling
The session SHALL populate a complete generation/version-tagged sample before any synchronous person-pose publication, and the hoop renderer MUST consume that same version. Every provider MUST write an explicit classic/flow discriminator and reset optional fields in caller scratch. The session SHALL expose one coordinated sample for hoop poses, spin, contacts, body offsets and both arms. Hand contacts MUST agree with CPU forward kinematics matching the rendered shader transform, within recorded tested tolerances across supported heading, scale, lean and terrain fixtures. Transitions MUST preserve position/orientation continuity and meet recorded velocity tolerances at contact changes.

#### Scenario: Isolation to transfer
- **WHEN** a hoop held in an isolation transfers between hands
- **THEN** the ring remains continuous and both required hand/rim contact windows satisfy the recorded tolerance without stretching the arms.

### Requirement: Reproducible accepted-time performances
Composition SHALL use an isolated seeded stream and versioned vocabulary derived from an injected activity root seed, stable slot identity and flow-session generation without changing existing worldgen or classic random draw sequences. Sampling MUST be read-only, and score progression MUST follow accepted actor time with bounded boundary processing.

#### Scenario: Replay and seeking
- **WHEN** the same seed, profile, vocabulary version and accepted event timeline are replayed or sought to the same time
- **THEN** the phrase choices and sampled pose match within recorded numerical tolerances regardless of sample-reader order.

#### Scenario: Equivalent frame partitions
- **WHEN** an uninterrupted score advances through different valid frame partitions reaching the same accepted time
- **THEN** the same score boundaries and contact changes occur and the final sample agrees within recorded tolerances.

### Requirement: Complete constrained movement vocabulary
The flow vocabulary SHALL support body/hand orbits, isolations, hand transfers, supported rolls and flight/catch through validated connections. Airborne motion MUST be planned with a reachable catch before release; performance envelopes MUST include the hoop sweep rather than only the dancer's body.

#### Scenario: Toss boundary crossing
- **WHEN** a valid accepted step crosses a release or catch boundary
- **THEN** the contact state changes exactly once and the hoop follows the planned continuous trajectory.

### Requirement: Safe activity interruption and resource ownership
Honk, dodge, person loss, place loss and disposal SHALL invalidate current contacts and airborne props without stale writes. Reacquisition MUST use a fresh claim and a validated entrance. The activity SHALL release its reservations and owned prop resources exactly once without disposing resources shared by another owner.

#### Scenario: Interrupted flight
- **WHEN** the performer is interrupted during a toss
- **THEN** the hoop hides immediately, no stale claim can move the person, and safe resumption begins from a reachable entrance rather than restoring an obsolete catch.

### Requirement: Bounded multiple-hoop and partner phrases
Multiple-hoop phrases SHALL validate hand occupancy and hoop separation jointly. A distinct partner session SHALL require non-stealing eligibility checked during acquisition, two revalidated current claims, a reserved clear corridor and exactly one authoritative airborne hoop owner, with rollback on partial acquisition and reentrant-safe cancellation if either participant becomes unavailable. Both people MUST count within the eight-participant cap, with at most two hoops per participant and 16 activity hoops in total, including exchange props.

#### Scenario: Second partner unavailable
- **WHEN** the coordinator cannot acquire its second participant
- **THEN** it releases the first temporary acquisition and any corridor reservation without disturbing unrelated activities.

### Requirement: Production-path inspection and measured acceptance
A deep-linkable muted workshop SHALL use the same sampler, rendered Crowd arms and activity lifecycle as the live behavior, and expose seed/profile, pause/step/seek, phrase history, contact/reach inspection and replay input. Acceptance MUST include classic comparison, Noon/Midnight captures, tier comparisons, allocation/steady-state measurements and a real-game boot.

#### Scenario: Inspecting a contact failure
- **WHEN** a replay seed produces a hand/hoop mismatch
- **THEN** the workshop can pause and seek that score, display its contact/reach error and export enough inputs to reproduce it.

### Requirement: Publication and scratch isolation
All sampled outputs SHALL have finite required fields, an explicit style and a current session generation/version. Readers MUST NOT retain caller scratch or use old optional fields as capability detection.

#### Scenario: Mixed styles share scratch
- **WHEN** one reused buffer samples flow, classic, inactive and another flow performer, including a recycled slot
- **THEN** waist mode receives only its own articulated body sample and no inactive or new performer receives the prior flow arm/contact state.

#### Scenario: Synchronous publication crosses a boundary
- **WHEN** an accepted step crosses a contact boundary and writeActivityPose synchronously publishes Crowd matrices
- **THEN** the rendered hands and all hoops use the already completed sample with the same generation, version and accepted score time.

### Requirement: Bounded flow restarts
Flow SHALL retain a monotonic active-participation timer independently of score-local time and score generation. Entrance time MUST count toward the existing session duration, interrupted waiting MUST retain its timeout, and classic elapsed behavior MUST remain unchanged.

#### Scenario: Repeated interruptions near completion
- **WHEN** a flow performer repeatedly interrupts and reacquires near its duration limit
- **THEN** each restart uses only the remaining active time and either enters a valid concluding score or ends safely, without resetting participation duration.

### Requirement: Owned clearance and environmental replay
HulaActivity SHALL own bounded generation-bound envelope/corridor reservations and release them on every completion, cancellation and partial acquisition path. They MUST NOT create solid hoop colliders or imply that bystanders are excluded. Encounter replay MUST record environmental decisions that alter score branching, while pure score replay remains independent of the live registry.

#### Scenario: Obstruction changes the score
- **WHEN** a bystander or changed venue makes the reserved score envelope unsafe at a boundary
- **THEN** the activity takes a validated safe exit or cancels, records the decision for encounter replay and releases the envelope without manipulating unrelated people.

#### Scenario: Preview seeks in isolation
- **WHEN** the workshop seeks an exported score
- **THEN** it finds the target sample within at most 32 segments without altering live claims, reservations, participation timers or global cooldowns, and retained events are capped at 256 per active session, and overflow safely ends flow and marks the export incomplete with an explicit error.

### Requirement: Production Low material acceptance
Low-tier acceptance SHALL verify the actual Lambert material path in the live game, since the entity sandbox intentionally bypasses that replacement. The same feature MUST also retain Mid/High material and normal/depth/shadow articulation correctness.

#### Scenario: Low game boot
- **WHEN** the muted production-path game starts on Low and displays flow choreography
- **THEN** inspection confirms the expected Lambert material and no shader/publication errors, independently of any successful Low sandbox capture.

### Requirement: Performance reads as intentional
A reproducible seed set SHALL be reviewed at normal game-camera distance as well as in close inspection for recognizable motif return, distinct profile silhouettes/pacing and held stillness between flourishes. Compilation/allocation and steady-state sampling costs MUST be measured separately against matched baselines.

#### Scenario: Two profiles perform
- **WHEN** two profiles perform the first orbit/isolation/transfer/return phrase under matched camera and lighting conditions
- **THEN** the recorded review assesses their visible pacing and silhouette differences and the recognizable return of their motif, rather than inferring quality from unique seed counts.

### Requirement: Dance accompanies the hoop phrase
Flow performers SHALL use coordinated leg strides, traveling steps, torso turns,
weight shifts and head motion rather than keeping the body stationary beneath
animated arms. Travel MUST use claim-checked positions within the admitted
performance envelope, share the accepted score clock and remain seekable.
The feet MUST retain ground support with explicit stance/swing contacts and flow-only articulated legs;
head, eyes, hair and mouth MUST share their head transform. Planted feet MUST retain
world position and orientation until lift, with terrain sampled at foot contacts.
Isolations MUST retain a fixed session-space hoop while the body moves. Tosses MUST
retain inertial flight and reachable release/catch while preparation and recovery
use accepted-time body motion.

#### Scenario: A moving orbit phrase
- **WHEN** a flow performer develops an orbit or answer motif
- **THEN** its sampled travel, turn and alternating leg motion produce visible dancing, while hands and hoop retain the same published presentation frame.

#### Scenario: Grounded turning step
- **WHEN** a score step combines stride, body lean, heading and scale
- **THEN** the transformed shoe geometry remains supported at ground height within the recorded tolerance, and heading/travel seek to the same pose without advancing the participation timer.

#### Scenario: Forward-facing performance
- **WHEN** a held front-plane isolation or hand orbit is sampled
- **THEN** its hands and hoop lie on the character's actual face-and-shoe forward side, which is local negative Z.

#### Scenario: Planted traveling dance
- **WHEN** the root travels, leans or turns within a declared stance interval
- **THEN** the supporting shoe retains its position and orientation within the recorded tolerance, its two leg segments remain connected without stretching, and the swinging shoe clears the ground.

#### Scenario: Moving isolation
- **WHEN** a performer shifts weight and turns during an isolation
- **THEN** the hoop center and plane remain fixed in the session frame while the exact rendered hand remains on its declared rim contact.

#### Scenario: Dance around an airborne hoop
- **WHEN** an aerial phrase releases, moves beneath and catches its hoop
- **THEN** the world trajectory retains gravitational acceleration independently of root motion, and preparation/recovery meet release/catch position and velocity continuously.

#### Scenario: Directional waist groove
- **WHEN** the body-orbit phrase is sampled
- **THEN** directional pelvis motion follows the hoop contact cycle with supported feet and continuous entry/exit rather than an unrelated idle oscillation.

#### Scenario: Varied aerial height
- **WHEN** an aerial score is compiled
- **THEN** an isolated seeded choice SHALL determine the toss rise, launch speed and flight duration, with a substantially higher maximum than the earlier shallow toss
- **AND** replay SHALL retain that choice while the catch follows the derived gravity trajectory and remains reachable.

#### Scenario: Momentum through ordinary joins
- **WHEN** two ordinary phrases connect
- **THEN** the visible hoop trajectory SHALL carry motion through the join rather than easing every phrase to a complete stop
- **AND** deliberate isolation accents MAY retain stillness while hand contact, reach and trajectory continuity remain valid.

#### Scenario: Full chest roll
- **WHEN** a single-hoop performance chooses the chest-roll phrase
- **THEN** both arms SHALL extend into a readable receiving pose and the hoop SHALL maintain supported travel from one hand across the arms and upper chest into the other hand
- **AND** rolling spin, limb reach, entry/catch continuity and actual head/torso clearance SHALL be verified independently of the sampler.
