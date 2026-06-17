# Capability: analytics

> **Source:** `src/analytics.js` (the `gtag` wrapper). GA4 (`G-CY1FNMY8H8`) loads
> inline in `index.html`. Treat the production deploy as observed by real players.

A thin, fail-safe GA4 wrapper. Every gameplay event flows through it; it no-ops if the
tag is missing and never throws into game code.

## ADDED Requirements

### Requirement: Fail-safe event sending

`Analytics.send` SHALL wrap every `gtag` call in try/catch and no-op when
`window.gtag` is absent (ad blockers, offline dev, local hosts), so analytics failures
never break gameplay (`analytics.js:1-2,33-41`).

#### Scenario: A blocked tag doesn't crash the game

- **WHEN** `window.gtag` is undefined and an event is sent
- **THEN** the call returns silently and gameplay continues

### Requirement: Variant-parameterized, never-per-frame events

Events SHALL use one event name with a variant parameter (e.g. `collision{kind}`,
`refuel{source}`, `feature_used{feature}`) rather than a name per variant, to stay well
under GA4's 500-name cap. High-frequency things SHALL be edge-detected by the caller,
reported once per session, or rolled up into `session_end`; nothing SHALL fire per frame.
`time_in_run_s` SHALL ride along on most events (`analytics.js:4-10`).

#### Scenario: Collisions report by kind, not per-frame

- **WHEN** the player hits a truck
- **THEN** a single `collision` event with the `truck` kind is sent, not a per-frame stream

### Requirement: Session context and per-run rollup

`gameStart(context)` SHALL reset per-run state and tag the session with
`{ perf_tier, touch, seeded, returning }`. Once-per-run discovery flags (`firsts`,
`features`) and a per-run rollup (jugs, vendor refuels, ran-dry, trips, passengers,
blast-used) SHALL reset each `gameStart` and feed `session_end`. Smile milestones
(10/25/50/100/250/500/1000/2500) and field exceptions (capped at 8/load) SHALL be
reported once each (`analytics.js:12-56`).

#### Scenario: A smile milestone fires once

- **WHEN** the player crosses 100 smiles in a run
- **THEN** the `100` milestone is reported a single time that run
