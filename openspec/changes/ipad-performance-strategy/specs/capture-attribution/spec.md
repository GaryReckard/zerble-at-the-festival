## ADDED Requirements

### Requirement: Capture-gated bounded frame attribution

Detailed guided captures SHALL partition callback work into disjoint named sections, preserve normal execution order, and aggregate section sums and sample counts over bounded windows. Ordinary gameplay SHALL retain its existing behavior without detailed capture hooks or buffers.

#### Scenario: Nested scene traversal

- **WHEN** the renderer performs its existing scene matrix update during a detailed capture
- **THEN** the traversal is measured once without adding another traversal, and its time is excluded from exclusive render time

#### Scenario: Ordinary launch

- **WHEN** the game loads without the detailed capture gate
- **THEN** detailed instrumentation is not attached and no section samples are accumulated

### Requirement: Aligned elapsed-time attribution

The capture SHALL pair each callback interval with the preceding callback's work and phase/quality identity, aggregate by phase and quality rung, and report shader-program changes. Unmatched, interrupted, or invalid intervals SHALL remain distinguishable from valid observations. Wall-minus-work SHALL NOT be labelled GPU execution time.

#### Scenario: Quality transition between callbacks

- **WHEN** quality changes between consecutive callbacks
- **THEN** the preceding callback's work and the corresponding interval are grouped under the same recorded quality identity

### Requirement: Physics and horizon health

Detailed capture SHALL report physics step counts and existing step timings without actor enumeration, and SHALL retain far-field supersession, publication-age/progress, and largest-unit evidence without changing publication behavior.

#### Scenario: Publications are superseded

- **WHEN** pending horizon work is repeatedly replaced
- **THEN** the export exposes supersessions and publication freshness so short call durations alone cannot establish success

### Requirement: Reproducible bounded harness controls

The launcher and server SHALL support explicit horizon and physics on/off controls, default both to on, validate manual device metadata, and preserve URL encoding, LAN asset restrictions, and capture-write authorization. Experimental quality policies SHALL continue to require explicit Low tier. No arbitrary URL-flag passthrough SHALL be added.

#### Scenario: Valid horizon-off capture

- **WHEN** a guided capture is launched with `--far-field off`
- **THEN** every generated/opened capture URL contains `farField=0` while its other controls and token remain intact

#### Scenario: Invalid metadata

- **WHEN** battery percentage is outside integer range 0 through 100 or metadata contains forbidden control characters
- **THEN** the launcher/server rejects it before building, binding, or opening a browser

### Requirement: Honest environment and compatibility evidence

Captures SHALL distinguish manual model/power/battery/thermal metadata from estimated title-card cadence, preserve unknown values, and allow old reports without these fields to remain readable.

#### Scenario: Missing device facts

- **WHEN** an old capture or a new capture omits manual environment facts
- **THEN** reporting treats those facts as unknown rather than inferring them from the user agent
