## ADDED Requirements

### Requirement: Opt-in real-game scenarios

The lab SHALL provide versioned dense-parked and streaming-drive scenarios in the real game, with normal crowd, bubble, world, collision and rendering updates alive. It MUST remain inactive during ordinary play, preserve synchronous title-gesture audio initialization, and use the normal player controller for measured driving. Scenario data SHALL declare seed, start pose, camera/time policy, progression, workload bounds, deadlines and quality/render configuration before execution.

#### Scenario: Dense festival measurement
- **WHEN** the dense-parked scenario starts through the ready title button
- **THEN** it measures an active festival at its declared pose and camera after a separately recorded settling phase, without pausing the world or injecting attribution spawn probes

#### Scenario: Streaming drive
- **WHEN** the streaming-drive scenario runs
- **THEN** normal controller input exercises acceleration, boost, turning, outbound streaming and a return segment, and the report records ordered checkpoints and load/unload evidence without corrective teleports during measurement

#### Scenario: Ordinary play
- **WHEN** the lab is not enabled
- **THEN** no lab input source, periodic sampler, GPU query, scenario timer or CPU injection is active

### Requirement: Exclusive input and truthful progress

The lab SHALL own all logical driving, camera, zoom, touch-delta and edge-action channels during its scenario, retain only an explicit emergency abort, and restore input on every exit. Settings/HUD interactions that change conditions SHALL abort or invalidate measurement. It SHALL record wall elapsed, accepted gameplay elapsed, physics steps, outer-loop time removed, physics time discarded, support-blocked progress and route completion separately. Simulation progression MUST NOT replace wall-clock frame-delivery measurements.

#### Scenario: A slow or blocked drive
- **WHEN** the game executes fewer physics steps because of long frames or missing support
- **THEN** the report preserves wall delay, discarded time and incomplete route progress, and MUST NOT classify the run as faster merely because it rendered less travel

#### Scenario: Physical controls during automation
- **WHEN** live keyboard or touch input could conflict with the lab
- **THEN** the diagnostic input source prevents mixing, provides an abort path, and releases all held logical controls when it exits

### Requirement: Reproducible identity and fixed settings

Each run SHALL identify the exact app source snapshot including tracked and relevant untracked changes, build hash, harness/scenario/schema/analysis policy versions, seed, browser/GPU, actual graphics configuration, physical render sizes, timing mode and workload observations. Primary comparisons SHALL pin a tier, quality rung and render dimensions. Different source identities are expected for baseline/candidate, but harness and scenario changes MUST be rejected unless explicitly validated compatible. User profile progress and preferences SHALL NOT leak into the run's initial state or be modified by the lab. Isolated test state and suppressed production publication sinks SHALL be installed before enabling the ready title gesture, without an asynchronous hop inside the audio initialization path.

#### Scenario: HMR or resizing
- **WHEN** source, quality policy or physical render dimensions change during a measurement
- **THEN** the run is retained with the contamination reason and excluded from a valid improvement verdict

#### Scenario: Dirty checkout
- **WHEN** a baseline is prepared from uncommitted work
- **THEN** a content-addressed snapshot and manifest preserve it without checking out another branch, discarding edits or requiring a commit

### Requirement: Quiet hardware-backed execution

The runner SHALL use a foreground real-GPU Chrome session and record the operator's quiet-Mac attestation, visibility interruptions and known competing game sessions. It SHALL reject software rendering and background measurement, and MUST NOT claim proof of OS-wide isolation. Existing user tabs/processes SHALL remain untouched unless their use or modification is explicitly authorized. Missing/disjoint GPU timer results SHALL be reported as unavailable without fabricating durations or invalidating an otherwise valid CPU/frame comparison.

#### Scenario: Reserved Mac
- **WHEN** Gary assigns a performance task during a quiet window
- **THEN** the operator records that condition once for the experiment, with no recurring permission prompt required for its runs

#### Scenario: Foreground lost or competing play session
- **WHEN** a run becomes hidden or a known active game session competes for resources
- **THEN** the run is invalid or preflight refuses to start, preserving an actionable reason rather than closing the user session automatically

### Requirement: Independent deadlines and resource ownership

A host supervisor or bounded resource lease SHALL enforce deadlines independently of game JavaScript and survive control-worker termination, stop after failures and verify cleanup. It SHALL own at most one test browser session at a time. For a shared-browser adapter it SHALL close and verify disappearance of its exact tab; for a standalone adapter it SHALL track and verify the exit of all task-created browser/daemon/GPU processes. Pre-existing processes and servers MUST NOT be killed. A cleanup failure SHALL abort the suite and be prominent in the final report.

#### Scenario: Blocked page thread
- **WHEN** the page cannot run its own finally handler or answer control requests
- **THEN** the surviving host supervisor closes the owned browser resources and saves an incomplete run, or reports cleanup failure and stops further launches

#### Scenario: Controller termination
- **WHEN** the control worker terminates unexpectedly
- **THEN** the surviving supervisor or lease closes only owned resources, verifies exit, preserves the interrupted manifest and prevents further launches on cleanup failure

#### Scenario: Owned server
- **WHEN** a controller starts an isolated snapshot server
- **THEN** it stops that exact server on every exit and leaves Gary's port-8765 server unchanged

### Requirement: Durable bounded capture

The lab SHALL extend the existing capture/report path with versioned bounded data, per-run identities, explicit lifecycle states and acknowledged atomic completion. Ordinary timing and intrusive attribution SHALL have distinct identities. Missing metrics MUST remain null/unavailable. Primary lab capture SHALL export bounded exact frame timings sufficient for run-level quantiles, not only one-second summaries. Buffer overflow or missing required frames SHALL invalidate the run rather than silently truncate it. The host SHALL retain manifests and partial evidence even if the browser exits before export. Existing guided captures SHALL remain readable under their original semantics.

#### Scenario: Interrupted upload
- **WHEN** final export fails or acknowledgement is lost
- **THEN** identical retries are idempotent and the run remains incomplete until the saved final artifact is validated and acknowledged

#### Scenario: Attribution enabled
- **WHEN** method wrappers or extra GPU probes are enabled for diagnosis
- **THEN** the report labels that mode and the analyzer does not compare it against ordinary timing as though instrumentation were equal

### Requirement: Comparable content and bounded collector perturbation

The lab SHALL distinguish semantic workload invariants, including route/content policy and required streaming coverage, from implementation cost outcomes such as draw calls, submitted triangles and resource counts. It SHALL permit cost reductions with retained semantic work, and reject undeclared reduced content from equal-work claims. The collector SHALL use bounded buffers, one owner for destructive counter reads and no per-frame serialization, disk/network writes or scene traversal. Before calibration, an incremental collector-overhead experiment SHALL use the same minimal timing sentinel in both modes and report whether additional instrumentation materially perturbs the scenario.

#### Scenario: Rendering optimization
- **WHEN** identical semantic content and route are rendered with fewer submissions
- **THEN** lower draw counts remain an eligible performance outcome rather than a comparability failure

#### Scenario: Undeclared reduced crowd
- **WHEN** a candidate reduces crowd/content policy outside the frozen variation envelope
- **THEN** it cannot receive an equal-work improvement verdict; an explicit tradeoff needs a separate experiment identity

#### Scenario: Collector changes frame delivery
- **WHEN** additional collection materially changes the sentinel timings or scenario work under the declared overhead policy
- **THEN** the collector fails acceptance before baseline calibration and the overhead evidence is retained

### Requirement: Deterministic offline analysis

A versioned offline analyzer SHALL emit stable JSON and readable reports from explicit run paths without browser access. It SHALL validate completeness, identity, settings, visibility, measurement coverage and comparable scenario work before computing verdicts. It SHALL report per-run and per-segment frame distributions, stall counts/rates, completion time, time loss and relevant workload differences without pooling frames across runs to inflate sample size. Legacy summaries and new raw timings MUST NOT be treated as interchangeable samples.

#### Scenario: Incompatible runs
- **WHEN** inputs are incomplete, malformed, duplicated, differently instrumented or materially different in scenario work or configuration
- **THEN** the analyzer emits `comparison invalid` with machine-readable reasons, preserves every run and does not silently drop unfavorable observations

#### Scenario: Same data twice
- **WHEN** the same run bundle and policy are analyzed twice
- **THEN** the analytical JSON is identical except separately identified presentation metadata, and no capture is mutated

### Requirement: Calibrated conservative verdicts

Before performance claims, the lab SHALL establish unchanged-source variation with repeated runs, freeze its acceptance policy, validate it on fresh unchanged-source holdout runs not used to set thresholds, and verify detection of a declared diagnostic-only CPU cost. Failed holdouts SHALL invalidate calibration acceptance; thresholds MUST NOT be widened retrospectively. Injection sensitivity SHALL verify actual added CPU work separately from wall-frame delivery, with a predeclared bounded dose that crosses frame headroom while preserving semantic work and deadlines. Baseline/candidate runs SHALL alternate order, retain independent-run results and use a policy whose thresholds exceed observed noise and declared practical minima. Verdicts SHALL be exactly `improved`, `regressed`, `no detectable change`, or `comparison invalid`; mixed outcomes SHALL not be called improved while a protected metric materially regresses. Frame-time distributions alone MUST NOT be claimed to prove subjective smoothness or mobile performance.

#### Scenario: Known regression
- **WHEN** a declared CPU injection crosses the calibrated detection floor and frame headroom while completing comparable work
- **THEN** the comparison reports regressed, identifies the injected variant and retains the calibration and per-run evidence

#### Scenario: Added work within spare headroom
- **WHEN** injected work is measurable in CPU time but does not change wall delivery beyond the frozen threshold
- **THEN** the report retains that distinction and sensitivity acceptance remains unproven; a new dose trial requires an explicit versioned declaration, not changed workload bounds

#### Scenario: Fresh holdout fails
- **WHEN** fresh unchanged-source holdouts produce a directional claim or unacceptable drift under frozen rules
- **THEN** calibration acceptance fails, the evidence is retained, and later candidate claims do not proceed under that calibration

#### Scenario: Unstable unchanged build
- **WHEN** unchanged-source repeats exceed the declared noise or workload bounds
- **THEN** calibration fails and no candidate improvement verdict is issued until the experiment is revised and recalibrated

### Requirement: Script authority and operating skill

The repository SHALL provide a skill that orchestrates the verified runner/analyzer, describes prerequisites and cleanup, and cites generated evidence. Calculations, compatibility and verdict rules SHALL reside in tested scripts rather than prose instructions or model judgment. The skill SHALL distinguish diagnostic hypotheses from measured findings and scope claims to the tested hardware and scenario.

#### Scenario: Another agent resumes
- **WHEN** an agent follows the lab skill
- **THEN** it can execute the documented experiment and regenerate its report from saved paths without reimplementing statistics or requesting Gary to drive
