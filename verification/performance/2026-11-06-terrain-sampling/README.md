# Terrain sampling cache, November 6, 2026

## Current state

The original pooled/lazy support cache now passed a complete forty-run
checkpointed comparison, with **no detectable change in frame delivery** in
either High parked festival or High driving. Median run frame-work timers fell
about 1 ms in each condition; the results do not establish an FPS increase.
Both independent conditions, all six exactly regenerated reports and their
source identities are summarized in [the checkpoint suite](checkpoint-suite.json).
All earlier rejected/interrupted attempts remain preserved below.

Gary [reserved a new window for at least a couple hours](window-5/grant.json)
and requested continued practical optimization. A subsequent exact-lattice
height shortcut cuts warm CPU work in the real ground-recenter benchmark by
about 56% without changing final geometry. Its own full check/build, seven native tier/route qualification operations and
forty fresh browser captures now pass, with all reports exactly regenerated.
The overall frame-delivery verdict is no detectable change; driving p99
improved as a secondary metric, while median frame work fell about 1.3 ms. See [the lattice revision](lattice-README.md),
[its declared plan](lattice-plan.json), and [exact source](lattice-manifest.json).
The prior cache's browser result cannot establish acceptance for this new source.
No deployment is authorized by this optimization request.

## Measured lead and implementation

The current baseline is preserved in [the immutable manifest](baseline-manifest.json).
A hardware-Chrome CPU profile through the real title gesture observed
431.5 sampled milliseconds in terrain vertex lookup, 410.5 in terrain sampling,
and 189.7 in ground sampling within 5,568.9 sampled milliseconds. The
[source-mapped attribution](baseline-attribution.json) is sampling evidence,
not an additive GPU/CPU timing or a frame-rate result. The historical diagnostic
helper's baked-in authorization label still says November 5; actual authorization
for these November 6 captures is recorded by this session and plan, not that label.

[The sampler](../../../src/worldgen/terrain.js) caches four vertices and lazily
computed triangle planes for up to 4,096 cells, using a FIFO ring and reusable
records. It preserves the original interpolation
arithmetic and triangle choice. Seed/epoch changes clear this bounded retention,
including landscape generation and supported tuning changes. Water classification
still runs for each point; cache hits do not bypass water or collision truth.
Output records remain caller-owned and cannot mutate the private cached planes.
Pooled values are copied before caller output publication, so even a reentrant
output setter cannot observe a recycled record. Height-only sampling bypasses
the plane cache and avoids computing unused gradients/normals, keeping full
ground-mesh recenters from evicting local support samples.

## Behavioral proof

[The frozen original](legacy-terrain.js) changes only import locations. The
[regression](../../../bin/test-terrain-cell-cache) reverses those relocations and
checks its body against the baseline source hash before comparing outputs.
The initial run passed 50,224 exact sample-record comparisons, including 1,608 wet samples and
11,888 sloped samples, with both generations, three seeds, triangle ties and
either side, signed/negative boundaries, reused output objects, tuning/epoch
changes, disable/re-enable and eviction/revisits beyond the 4,096-cell limit.
The preimplementation run failed at the new cache-statistics contract, not at
an existing height error. The revised test extends this coverage as described
below and in the saved revised log. Existing terrain/physics/people
regressions remain part of the full project check.

## Additional offline production-ground verification

After Gary explicitly stopped browser testing and authorized offline work,
[the production-ground fixture](ground-fixture.mjs) executes the actual
`resampleGroundSurface`, color/noise functions and constants extracted from
`src/world.js`. It constructs real pinned Three.js geometry, without a renderer,
DOM, browser process or graphics context. The source hash is saved with results.

[The integration regression](../../../bin/test-terrain-ground-recenter) passes
30 complete 19,881-vertex snapshots and 120 actual raycasts. Positions, normals,
colors, UVs, indices, bounds, texture offsets and dirty-version counters match
the frozen original exactly. The sequence includes all 21 snapped centers
derived from the actual lab scenario path, the reported seed-1977 ridge area,
generation/seed changes and terrain toggles. Local support-cache retention stays
unchanged through each ground resample. [The focused log](checks/production-ground-recenter.log)
records the source identity and nonflat coverage. The regression is wired into
the project check.

[The production-function benchmark](production-ground-benchmark.json) runs
twelve independent Node processes, four per original/rejected/revised source,
in declared alternating order. [The script](ground-bench.mjs) measures complete
color, vertex-normal and bound updates across the 21 scenario centers after a
warm traversal, rather than timing only isolated sampler calls.

| Source | Median total warm recenter work over the route | Median initial recenter |
| --- | --- | --- |
| Original | 282.01 ms | 1,255.45 ms |
| Rejected cache | 792.93 ms | 1,286.47 ms |
| Revised cache / height-only path | 269.80 ms | 1,255.88 ms |

All twelve final geometry hashes match. One revised run took 451.37 ms; the
other three took 252.89–280.79 ms. Every run is retained. Mac foreground activity
was uncontrolled, so the median reduction is exploratory CPU evidence and does
not establish a reliable tail improvement or explain that outlier.

A separate [instrumented Node attribution](production-ground-attribution.json),
reproduced by [this script](ground-attribution.mjs), observed 271.01 / 756.69 /
250.39 ms wall work and 1.36 / 15.02 / 0.84 ms of GC entries for original /
rejected / revised respectively. GC is already included in elapsed work, not an
additional duration to add to it. These one-off instrumented observations support
the cache-churn investigation; they do not replace browser frame delivery or
explain the earlier uninstrumented outlier.

The [expanded full project check](checks/offline-final-npm-check.log) and
[build](checks/offline-final-npm-build.log) pass. No browser testing was performed
for this additional verification. The prepared future qualification controller
preserves each invocation in a unique attempt folder, verifies the underlying
owner's cleanup receipt, and leaves browser deadlines/teardown with the accepted
supervisor rather than externally killing that resource owner.
The revised controller subsequently completed all seven native integration
operations under the new grant, with successful cleanup. See the live-window
record below; candidate performance acceptance remains incomplete.

The [offline code/evidence review](offline-review.md) records the bounded pool,
height-only bypass and caller-output publication checks with verified source
locations. Its final focused regression adds literal signed-zero inputs and a
nonvacuous recycled-plane fixture, passing
[50,262 exact sample records](checks/offline-final-cache.log) plus height-only
comparisons. These extra assertions do not change runtime code.

## First-candidate operation experiment

[The archived benchmark helper](initial-operation-bench.mjs) ran in eight separate Node processes in predeclared
ABBA order, four per source. Each measures three passes of 120,000 calls on a
fixed local query set, with checksums equal across all sources and processes.
[Raw results](operation-benchmark.json) retain every run and cold/warm timings.

Median run warm ground-sampling time fell from 35.56 to 11.05 ms per 120,000
calls; water-aware terrain sampling fell from 72.48 to 48.71 ms. Initial local
query construction medians were 617.69 / 614.05 ms for original/candidate.
These establish the rejected variant's operation-cost improvement with warm locality, not game FPS,
GPU memory, whole-world cold construction or physical-iPad performance. The
cache trades a bounded additional set of CPU records for fewer repeated queries.

[Helper provenance](operation-helper-provenance.json) distinguishes the original
executed helper and phase-specific source identities. For a fresh operation
experiment, [the current helper](bench.mjs) accepts explicit `legacy`, `rejected`
and `current` modes and records the selected sampler-file hash. `current` means
the latest checkout, not whichever historical candidate produced a saved row.

## Rejected runtime trial and revision

[First-candidate qualification receipts](qualification-results.json) record ordinary Low/Mid/High
ready-title startup and completed diagnostic driving routes, with actual physics,
streaming, acknowledged captures and exact process cleanup. The
[full check](checks/npm-check.log) includes the new differential test, and the
[production build](checks/npm-build.log) passed before the candidate was frozen.

The [candidate CPU attribution](candidate-attribution.json) and raw
[baseline](profiles/baseline/cpu.json) / [candidate](profiles/candidate/cpu.json)
people profiles observe median frame work of 15.2 / 14.1 ms. Adult update totals
were 1,058.7 / 909.0 ms over 180 measured frames, and child totals were 151.6 /
110.7 ms. These separately launched instrumented scenes have live-behavior
variation and are attribution observations, not calibrated frame-delivery proof.

The [preserved first trial](comparisons/attempt-1/result.json) completed all forty
captures, with both unchanged-baseline holdouts passing. Festival frame delivery
reported no detectable change. Driving reported regressed: its paired stall-rate
increase was 0.200 events/second against the frozen 0.100 bound, with all four
pair changes beyond that bound. Typical p95 and the worst stalls improved, but
those do not cancel the stall-frequency regression. All six analysis reports
[regenerate exactly](comparisons/attempt-1/regeneration.json).

Investigation found that [ground recentering](../../../src/world.js) calls
height sampling at all 19,881 mesh vertices every 40 metres. A
[prewarmed grid experiment](rejected-churn-benchmark.json), reproduced by
[the frozen script](rejected-churn-bench.mjs), exercises 10,000 distinct cells
per sweep. The first candidate took roughly 14–19 ms per warm sweep compared
with approximately 3–4 ms for the original, exposing the cache-capacity problem.
The source also allocated new plane records and used `Map.keys().next()` for
each eviction. This is a concrete streaming-path lead, not proof that every
recorded stall has the same cause.

The revised source uses reusable ring slots, lazily calculates only the queried
triangle's plane, and keeps height-only queries out of the plane cache. The
[revised oracle regression](checks/revised-cache.log) passes 50,226 exact sample
records plus height-only comparisons, keeps height-only grids from populating
the support cache, and verifies reentrant publication during pool recycling.
The [uncontended churn rerun](revised-churn-benchmark.json) observes height-only
sweeps around 3.27 ms against the original's 3.45 ms. General support sampling
across a grid larger than capacity still costs about 5.9–6.3 ms against 3.5–3.8
ms, so the local-plane cache is not a universal query-speed improvement. It is
kept off the mesh-recenter path rather than hiding that tradeoff.

The [revised warm operation experiment](revised-operation-benchmark.json) retains
the gain for repeated local queries: ground sampling medians are 34.75 / 11.28
ms and water-aware sampling medians 71.51 / 48.99 ms per 120,000 calls for
original/revised. The revised [full check](checks/revised-npm-check.log) and
[build](checks/revised-npm-build.log) pass. Its [fresh runtime plan](revision-plan.json)
was initially prepared for the failed High driving condition. Before any revised
comparison capture, the newly granted window allowed restoring both original
scenario scopes: forty fresh High driving/festival captures, driving first,
with ordinary/diagnostic Low/Mid/High qualification. It does not relabel the
rejected variant's parked result as revised-source acceptance. This revised
runtime verification stopped when Gary returned, with its incomplete second
attempt preserved below. An initial
revised churn exploration overlapped a functional test; its
[raw results](revised-churn-benchmark-overlap.json) are retained and excluded
from timing claims, with a separate uncontended rerun recorded afterward.

[Exact first-trial cleanup](cleanup-attempt-1.json) reconciles all 48 task-owned
profile, qualification and comparison manifests and 914 PID/birth identities.
None remain alive, the lab lease is absent, and only the owned keep-awake process
was stopped. The existing user-requested development server is preserved.

## Revised live window, ended on Gary’s return

[All seven qualification operations](revision-qualification-results.json) passed:
ordinary ready-title startup on Low/Mid/High, the streaming driving route on
Low/Mid/High, and High parked diagnostic capture. Selected raw integration
evidence and its hashes are retained in [the window promotion](window-2/promotion.json).
The [revised CPU profile](profiles/revised/diagnostic-input.json),
[raw samples](profiles/revised/sampled-cpu.json), and
[source-mapped attribution](revised-attribution.json) are attribution evidence,
not a calibrated frame-delivery verdict. One initial profile invocation failed
before browser launch because the filesystem sandbox denied process inspection;
[its log](window-2/profile-sandbox-denied.log) is preserved. The authorized
process-inspecting invocation then completed with successful cleanup.

The [second comparison attempt](comparisons/attempt-2/inventory.json) declared
forty runs before capture, driving first. Four fresh driving calibration runs
froze the unchanged policy thresholds, and eight unchanged-baseline holdout
runs returned **no detectable change**. The first paired run still used the
original baseline and failed with `foreground-lost` and one hidden frame,
which invalidated capture. The [terminal result](comparisons/attempt-2/result.json)
preserves this failed attempt with thirteen run slots entered. No revised
candidate paired capture or parked comparison completed, so this attempt
establishes no candidate performance verdict. Both available analysis reports
[regenerate exactly](comparisons/attempt-2/regeneration.json) through the real CLI.

Gary then announced his return, ending foreground authorization.
[Exact cleanup](window-2/cleanup.json) reconciles twenty-one native
qualification/profile/comparison ownership manifests and 430 PID/birth identities,
with every task-owned process absent. The task-owned keep-awake process was
stopped and the repository lease is absent. User sessions were preserved.
A new reserved window is required before any further foreground capture.

## Third live window, ended on Gary’s return

Gary [authorized another away window](window-3/grant.json).
[Preflight](window-3/preflight.json) verified that all 303 inputs still matched
the qualified revised snapshot and that backend capability receipts remained
current. The [third comparison](comparisons/attempt-3/inventory.json) declared
the same forty-run, two-scenario scope with fresh baseline calibration and
holdout. The previous failed attempt remained preserved.

Four calibration drives passed with the same frozen minimum thresholds, and
six independent holdout drives completed. The seventh holdout drive failed
with `foreground-lost` when foreground authorization ended, leaving the
[trial incomplete](comparisons/attempt-3/result.json) after eleven run slots
were entered. No candidate comparison began. The one available calibration
report [regenerates exactly](comparisons/attempt-3/regeneration.json), but this
does not establish a holdout or candidate verdict.

[Exact cleanup](window-3/cleanup.json) reconciled all eleven ownership manifests
and 225 PID/birth identities, with every test-owned process absent. The
bounded task-owned keep-awake process was stopped and the lab lease is absent.
No further foreground captures are authorized. Completing the declared
two-scenario comparison requires an uninterrupted reserved window of roughly
fifty-five minutes, with preparation and integration already complete for the
unchanged source.

## Fourth live window, ended during candidate comparison

[The new grant](window-4/grant.json) reserved at least an hour, with
[unchanged-source preflight](window-4/preflight.json) passing. The
[fourth trial](comparisons/attempt-4/inventory.json) used fresh calibration
and the same declared forty-run scope. Driving calibration froze a 2.1 ms
p95 threshold and the unchanged 0.1 events/second stall-rate threshold under
the original policy. All eight independent baseline holdout drives passed.
The first paired original drive and first revised-candidate drive completed,
but the second revised drive failed with `window-focus-lost` when Gary
returned. [The terminal result](comparisons/attempt-4/result.json) preserves
fifteen entered run slots; no complete paired candidate verdict is available.
Both baseline analysis reports [regenerate exactly](comparisons/attempt-4/regeneration.json).

[Cleanup](window-4/cleanup.json) reconciled all fifteen ownership manifests
and 333 PID/birth identities. Every test-owned process is absent, the keep-awake
process is stopped and the lab lease is absent. Foreground authorization ended.
The revision remains unpromoted, and interrupted candidate data does not
establish improved FPS or smoothness. Repeated calibration and holdout phases
consume much of a short window; measurement scheduling needs reconsideration
before another launch, without relaxing the policy or treating partial data
as an accepted comparison.

## Scheduling after the interrupted windows

An [offline review of the existing controller and analyzer](scenario-checkpoint-plan.json)
found a safe, already-supported checkpoint at the complete-scenario boundary.
The controller accepts one condition through `--conditions` and independently
calibrates, validates and compares each scenario. The next run will complete
the parked condition first, preserve and regenerate its full evidence, then
run the driving condition independently under current foreground authorization.
[Exact prepared commands](next-window.md) use that existing controller without
changing runtime or statistical code. No browser was launched for this review.

The final requirement remains both complete conditions, forty successful runs
with fresh per-condition calibration/holdout and the unchanged analyzer policy.
Only complete, regenerated, source-bound condition results may carry forward
across windows. None of the four current attempts provides such a checkpoint
for the revised source. Partial calibration/holdout/candidate stages cannot be
carried forward, and an accepted parked result cannot establish driving
acceptance. A completed regression or invalid report still stops acceptance
rather than triggering retries until it passes.

## Final acceptance

The final source is [the lattice manifest](lattice-manifest.json), and the
[complete comparison](lattice-suite.json) retains both independent scenarios.
See [the concise final results and limits](lattice-README.md),
[exact process cleanup](window-5/cleanup.json), and
[requirement-by-requirement completion audit](completion-audit.json).
The original cache-only checkpoint suite remains separate rather than being
relabelled as the final source. All rejected and interrupted attempts remain
unchanged. Runtime verification is complete for the declared fixed-tier desktop
scope; physical-iPad/Auto follow-up remains separate. No merge or deployment
was performed.
