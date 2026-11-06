## Pragmatist's Position

### Critical Path

The critical path is **browser ownership proof → one ordinary live-game capture with exact frame data → repeatability → analyzer verdict → driving scenario**, not a complete analyzer followed by a browser spike. The design itself calls the adapter spike the first implementation task (`design.md:29`), while the task list places all analyzer work before it (`tasks.md:1–10`). Resolve that ordering so an unavailable hardware browser backend or incompatible raw capture does not invalidate a large amount of finished scaffolding.

The force multiplier is a thin end-to-end parked run that produces a durable, source-identified artifact and cleans up after a deliberately blocked page. It validates the control, game integration, export and offline-read boundaries together. This does not remove the final two-scenario acceptance; it establishes a useful intermediate slice with explicit limits.

### Priority Sequence

1. **Specify the minimum envelope, then prove the browser path.** Keep the schema and fixtures from Task 1.1 (evidence contract), but immediately execute Tasks 2.1, 2.3 and the blocked-page part of 2.4 (hardware adapter and independent teardown). Full Chrome, foreground rendering and exact task-owned cleanup are requirements, not optional polish. The existing local instruction explicitly requires structural cleanup before expanded coverage (`AGENTS.override.md:23–25`); do not adopt a second backend during this change simply to make the capability spike pass.

2. **Land a bounded parked capture before comprehensive comparison machinery.** Reuse the central tick (`ARCHITECTURE.md:117–135`), fixed quality/camera pattern (`src/main.js:117–126`) and existing capture transport. Keep ordinary gameplay alive and exclude baseline wrappers and spawn probes. Obtain one successful run and one incomplete run with an acknowledged saved artifact. This is the smallest integration test that establishes a usable collection pipeline.

3. **Add exact frame export deliberately.** Existing `FrameTelemetry.takeWindow()` empties its raw window and returns window quantiles (`src/perfTelemetry.js:92–110`); the current report prints medians of window p95/p99 (`bin/report-perf-playtest:81–90`). Those are legitimate legacy summaries but cannot supply the new run-level quantiles. Make opt-in bounded raw timings an explicit prerequisite of analyzer acceptance, with a fixed memory/export cap and a test that the run-level p95 comes from frames, not from window summaries. Preserve existing manual summary semantics instead of expanding a parser extraction into a wholesale report rewrite.

4. **Establish parked A/A repeatability and validate the analyzer with a known injected cost.** The proposed four-run calibration and four-runs-per-variant alternating comparison are a reasonable conservative initial policy, explicitly not a confidence interval (`design.md:63`). Implement those fixed rules rather than a configurable statistical framework. Freeze workload and noise policy before the candidate dataset, then retain all incomplete or divergent attempts.

5. **Extend the proven collection path to driving.** Add the exclusive normal-controller input adapter and truthful clock/progress fields, then the declared outbound/turn/return route. Promote the waypoint follower only if unchanged-source open-loop runs fail comparable-work checks; the plan already provides that conditional escape hatch (`design.md:39`). Do not make a generic control-recording or route-authoring UI a prerequisite.

6. **Finish repeatable source snapshots, full failure cases, skill and acceptance report.** Source identity and immutable served output are necessary from the first measurement, but an elaborate reusable snapshot manager is not. Initially support an explicit inventory of the current-compatible source/build inputs and two immutable directories, then prove dirty/untracked handling required by the spec. Do not implement compatibility adapters for arbitrary historical revisions (`design.md:25`). Keep the final skill thin, linking to actual verified commands and policy rather than duplicating them (`design.md:71`).

### Incremental Delivery Plan

- **Slice 1, ship first: bounded parked collection.** Minimum run schema, current-source immutable build, one hardware browser backend, fixed settings, normal ready-title click, active gameplay, exact frame export, host deadline and exact cleanup. Verify success plus deliberately blocked-page interruption. Report “collection capability verified”; do not issue a performance-improvement claim. This unlocks repeatability measurements, analyzer fixtures grounded in real output and later driving integration.
- **Slice 2, trusted parked comparison.** Four unchanged-source repeats, frozen finite-sample policy, injected-cost comparison, deterministic offline report and remaining export/failure fixtures. Verify the known CPU cost is detected and A/A is non-directional. This is already useful for crowd/render performance work while clearly excluding streaming performance.
- **Slice 3, complete first milestone.** Exclusive input and clock observations, stable streaming route, repeated route/workload validation, the same calibration/injection protocol, Low/Mid/High normal-game integration smoke, documentation and skill. Both scenarios remain required before the overall lab is called accepted (`tasks.md:31–35`).

### Delivery Concerns and Mitigations

- **Do not require an unrelated optimization to prove the harness.** Task 5.3 (alternating snapshot comparison) can compare the ordinary and explicitly injected compatible snapshots. The lab task does not include optimizing gameplay (`design.md:11`). Acceptance should not stall waiting for a genuine candidate fix, and it should not manufacture one.
- **Make the first tier concrete in the scenario manifest.** The plan wisely excludes a quality matrix and still retains Low/Mid/High smoke (`design.md:11`, `tasks.md:34`). Pick one measured fixed tier/rung and physical size for initial timing acceptance; other tiers are smoke coverage until separately calibrated. Reusing the prior High dense scene is sensible only after a fresh supported-start check, as the plan already states (`design.md:37`).
- **Distinguish workload invariants from optimization outputs.** Route/checkpoints, seeded content, actor counts and visible-content policy protect comparability; draw counts and CPU work are also outcomes an optimization is allowed to reduce. Do not automatically invalidate an instancing improvement because it makes fewer draws. Keep the recorded outcome differences visible and reject semantic workload loss under predeclared rules (`design.md:54`, `design.md:61–65`).
- **Keep builds and analysis outside measurement.** The current toolchain explicitly builds production output (`.claude/rules/no-build.md:9–19`). Finish builds before the reserved measurement window and avoid concurrently running full tests/analyzers during a capture; otherwise the harness becomes its own competing workload. Record preparation and settle policy, with bounded experiment-level duration, rather than silently extending warm-up until favorable results appear.
- **Do not weaken the ordinary start path for convenience.** The normal title-click requirement is necessary because a scripted start cannot verify synchronous audio unlock (`AGENTS.md:63–66`). A sandbox-only test cannot replace this full-game measurement path.

### Deferred / Park on ROADMAP

- **Second browser backend:** freeze one passing backend; both shared and standalone ownership models can remain documented, but implementing both does not block the first autonomous experiment (`design.md:29`).
- **Historical-source adapters:** explicitly outside initial compatibility and not needed for A/A plus injected regression proof (`design.md:25`).
- **Broad quality, cold-cache and Auto matrices:** fixed-tier timing plus cross-tier smoke meets this milestone; each additional matrix cell needs its own calibration rather than multiplying runs immediately (`design.md:11`, `tasks.md:34`).
- **General flight recorder, user-control recording and scenario language:** retain the proposal's exclusions; neither is needed to test two declared workloads (`proposal.md:42`).

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: The task ordering risks building a large analyzer/snapshot system before proving the only backend and live capture format it depends on.
- **Recommendation**: Retain the final two-scenario contract but deliver a thin, safely owned parked capture first, then calibrated offline comparison, then driving. Make raw frame export explicit, use the injected variant as the initial candidate, and freeze one backend and timing configuration. This produces earlier verified value without cutting any final safety or evidence gate.
