## Why

Recent desktop slowdowns required manually assembled parked probes, which found real rendering and crowd costs but could not establish repeatable driving performance. Gary can reserve his Mac for unattended testing, so a bounded real-game lab can make investigations repeatable without asking him to drive every comparison.

## What Changes

- Add two versioned, real-game scenarios: a dense parked festival with gameplay alive, and a controller-driven streaming route with observable completion milestones.
- Add a local runner for foreground, hardware-GPU Chrome with fixed quality/render dimensions, immutable source snapshots, bounded execution and verified cleanup.
- Extend the existing capture/report path with versioned run manifests, explicit completion, route/workload evidence and deterministic offline analysis. Preserve existing guided phone/desktop capture behavior.
- Establish unchanged-source repeatability, detect a known diagnostic CPU cost, then compare alternating baseline/candidate runs. Produce `improved`, `regressed`, `no detectable change`, or `comparison invalid` with evidence and reasons.
- Add a repository skill that invokes verified commands and interprets their outputs, without duplicating the analyzer's calculations or validity rules.
- Treat a quiet Mac as an explicit operator-provided condition, not a claim that the tool can prove the absence of competing OS activity. No automatic scheduling is included.

## Capabilities

### New Capabilities

- `performance-lab`: real-game scenarios, controlled execution, capture provenance, offline comparison, failure safety and agent operating protocol.

### Modified Capabilities

None. Existing production input, renderer, world ownership, physics and guided captures retain their contracts; new diagnostic-only integration is opt-in.

## Impact

Internal development workflow only; there is no new player-facing feature. Implementation updates CHANGELOG, ROADMAP, DEBUGGING and the performance playbook. Expected boundaries are `src/main.js`, `src/input.js`, existing capture timing in `src/debug.js`/`src/perfTelemetry.js`, opt-in lab modules, local runner/analyzer scripts and tests. The lab observes renderer, crowd, world-streaming and physical-driving costs without optimizing those systems as part of this change.

Risk signatures: diagnostic module loading and loop/input integration, synchronous title-gesture audio, cleanup of temporary GPU probes and browser ownership, and repeatability across asynchronous streaming. A real council reviews the plan. Existing RNG salts/order, world lifecycle/disposal, Three shim, geometry/shadows and production physics cadence must not change. Current AGENTS and `.claude/rules/no-build.md` supersede stale no-build/importmap language injected by OpenSpec; use Vite and ordinary imports.

## Scope Check

| Existing parallel path | Treatment and verified source |
| --- | --- |
| Guided device capture and one-file summary | Extend shared parsing/evidence rather than replacing manual workflows: `docs/performance-playtests.md:76`, `bin/report-perf-playtest:40`; regression-test legacy reports. |
| Local upload/build server | Reuse transport where suitable, with per-run namespaces and exact completion acknowledgement; inspect `bin/playtest-perf:11` and Vite capture middleware during implementation. Do not start a competing server on Gary's play port. |
| Parked method-level CPU baseline | Keep as attribution only, not the ordinary timing loop: wrappers add cost and inject spawn probes (`src/people/baseline.js:1`, `src/main.js:1231`). |
| Paused render probe | Reuse bounded GPU-query cleanup, not its paused alternate render loop (`src/sceneProbe.js:24`, `src/sceneProbe.js:59`). |
| Driving sandbox replay | Use real controller input in the live game; sandbox's straight eight-second replay still mixes live boost/slow (`src/playerDrivingSandbox.js:78`). It is not the lab route. |
| Main/physics clocks | Record outer-clamped and physics-discarded time separately; never hide low progress behind favorable frame times (`src/main.js:1207`, `src/physics/fixedStep.js:9`). |
| Browser verification tools | Honor shared-tab versus standalone-process ownership and local cleanup restrictions (`docs/browser-verification.md:12`, `AGENTS.override.md`). No software-WebGL performance verdicts. |

A general flight recorder, user-control recording, whole-world determinism, scenario language, automatic scheduling, mobile automation, cold-start matrix and Auto-policy study are outside this milestone. They can build on the validated contract later.
