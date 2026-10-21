# Adaptive quality telemetry and controlled experiment

## Delivered behavior

Ordinary Auto keeps its existing thresholds, while hidden-tab samples and resume
gaps no longer influence quality decisions. A guided Low capture can select
`--quality sustained` to remove p95-only downgrade pressure while preserving
sustained-average, severe-consecutive-hitch and recovery protection. The guided
capture label and serialized quality policy identify the experiment.

Automatic gameplay transitions preserve the existing downgrade event and add
named rungs, trigger, frame statistics, settings and an opaque per-game-start
identifier. Recoveries and outcomes are separate events. Outcomes use the fresh
90-frame window after at least five seconds, or explicitly identify interruption
or supersession. Settings changes invalidate pending observations. Session
summaries are cumulative snapshots, with foreground observed time, degraded
time, counts and worst rung. They must be grouped by quality_run_id rather than
summed across repeated page-hide reports.

## Verification

- `npm run check` exited 0 on the final implementation. [Full output](check.log).
- `bin/test-quality-telemetry` drives the real governor with a deterministic
  clock: p95-only jitter drops Auto but not Sustained; sustained average and
  consecutive hitches still drop Sustained; recoveries, observations,
  supersession, hidden-time exclusion, manual/settings interruption, new-run
  reset, event names, backward-compatible payload fields, and event parameter
  budgets are checked.
- `bin/test-perf-server` checks policy URL equivalence and Low-tier validation;
  `bin/test-device-capture-flow` exercises the real report serializer for all
  three policies. Both run in the full check.
- In-app browser smoke checks used the existing localhost:8765 server, with
  mute=1: Low and High title cards loaded, clicking Just Cruisin' entered the
  game, and console inspection returned no warnings or errors. The explicit
  Low/Sustained guided drive boot displayed `LOW SUSTAINED · SETTLE` and its
  capture controls, with no warnings or errors. This was a startup check, not
  a completed performance comparison.

## Remaining acceptance

No iPhone FPS or heat improvement is claimed. Run comparable moving Auto and
Sustained captures on the phone, preferably in both orders, and record clarity,
stutters and warmth before changing the shipping p95 policy. Baseline remains
available as a control. [Capture instructions](../../../DEBUGGING.md#controlled-governor-comparison).

The code emits GA parameters but does not configure custom definitions in the
GA property or verify remote ingestion. Local dev hosts do not load gtag; the
analytics regression uses an intercepted gtag function. Verification ran against the local working tree before deployment. Chunk construction optimization is outside this
telemetry/governor experiment and remains tracked in ROADMAP.
