## Why

The November iPad captures leave much of each frame unattributed, so another production optimization would be a guess. Follow the [November 15 council](deliberations/001-next-levers/results.md) by improving capture evidence, preparing one four-run device session, and choosing the next lever only afterward.

## What Changes

- Add capture-gated frame-section sums, aligned wall-minus-work, physics summaries, horizon freshness, and device environment metadata.
- Add bounded horizon-off and physics-off launcher controls and a matched Low-tier procedure.
- Require desktop instrumentation validation, overhead evidence, a draw census, and pre-registered device thresholds before the session.
- Correct stale terrain/toolchain documentation and distinguish historical desktop results from missing device before/after evidence.

## Capabilities

### New Capabilities

- `capture-attribution`: bounded, opt-in frame attribution and reproducible guided capture controls.

### Modified Capabilities

None. The world-streaming terrain wording is a factual correction to match existing behavior, not a terrain implementation change.

## Impact

The capture path touches main-loop timers, debug export/reporting, the physics statistics reader, and guided CLI/server code. It brushes render timing and boot integration but must preserve RNG order, Three.js aliases, synchronous iOS audio, resource ownership, and production tier/quality/physics/population defaults. It adds no geometry or dependencies. The observable development workflow requires a CHANGELOG entry.

## Scope Check

Existing timing surfaces include `src/worldTimings.js`, `src/perfTelemetry.js`, `src/main.js`, `src/debug.js`, and `bin/report-perf-playtest`; the new measurements must flow through those capture/export/report paths. `bin/playtest-perf` and `.claude/serve_nocache.py` share argument validation. The desktop-only people tracer is not a device substitute. Existing calibrated performance-lab semantics remain separate, and far-field optimization, render-pipeline rewrites, crowd reduction, and physics tuning are excluded pending device evidence.
