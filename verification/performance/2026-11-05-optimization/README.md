# Festival optimization, November 5, 2026

## Current state

Gary assigned the Mac for foreground testing on November 5. Implementation,
the full project checks, source build, normal/diagnostic Low/Mid/High boots,
camera/raster qualification and four independent fixed-tier comparisons have
passed. High festival and driving frame delivery improved; Low's primary
frame-delivery verdict is no detectable change, with lower observed CPU work.
One baseline-only driving holdout failed, stopped its attempt and remains
preserved. The declared fresh expanded-calibration attempt completed. His supplied
[Deep Research report](external-research.md) has been assessed against current
code; [the assessment](research-review.md) retains useful experiments and
corrects measurement/arithmetic errors before incorporating its recommendations.
The [qualification receipts](qualification/results.json),
[final source manifest](final-candidate-manifest.json) and
[three Astra consultations](astra-review.md) preserve the current acceptance.

The goal is lower frame time and fewer driving stalls while retaining festival
richness, driving feel, gameplay correctness, all camera modes, and safe world
streaming/resource ownership. Desktop evidence cannot establish older-iPad
Safari performance.

| Recorded condition | Baseline / candidate median run p95 | Paired p95 change / frozen threshold | Verdict |
| --- | --- | --- | --- |
| High festival | 30.5 / 18.3 ms | -11.95 / 8.80 ms | Improved |
| High driving | 31.3 / 19.9 ms | -11.60 / 5.50 ms | Improved |
| Low festival | 18.5 / 18.5 ms | 0.00 / 2.00 ms | No detectable change |
| Low driving | 19.85 / 18.5 ms | -1.30 / 2.60 ms | No detectable change |

These are fixed-tier, hardware-Chrome, 1280×720 physical/DPR 1 captures on the
reserved Apple M4 Pro Mac, seed 2404796662, with the same collector identity.
The baseline already includes child resource pooling; this is not an FPS
comparison against the original goal-start build or the published release.
The [derived summary](comparison-summary.json) links the exact raw reports.
High's median run p95 fell approximately 40% in the festival and 36% on the
route; those percentages describe these captures, not an iPad or Auto guarantee.

## Baseline and published version

[The baseline manifest](baseline-manifest.json) preserves the initial dirty
source inventory, immutable local snapshot path and built output identity,
before this optimization effort changed application code. Existing work was
not committed, discarded, or moved between branches.

The iPad symptom was on the published game. Read-only HTTP inspection found a
concrete difference: its crowd implementation performs terrain reachability
before rejecting distant dance stages. Current local code rejects distant
stages first. The exact extracted [published dancefloor code](published-dancefloor.txt)
and [asset/source-map hashes and workflow metadata](published-version.json)
preserve that finding. The latest successful main workflow references
`fdaecb1d17d064cbe08820e8c96d344a1f5c7e61`; this metadata alone does not prove
an exact asset-to-commit mapping. No deployment has been performed.

The [November 2 measurements](../2026-11-02-render-load/README.md) establish why
that difference matters on the measured desktop: expensive crowd support work
was reproduced, and the distance guard reduced that work in instrumented runs.
They do not quantify an iPad improvement. Do not use the older published app
as the equal-work baseline for a new local change.

## Method

1. Preserved the dirty source/build baseline, assessed the supplied research,
   and built the subtraction verification surface before changing the game.
   Offline tests exercise success, failure, timeout and restoration.
2. Captured Low/High parked rendering with one family hidden at a time,
   restoring and repeating the baseline between interventions. Gameplay was
   paused, so those interventions attribute rendering rather than FPS or
   simulation cost. Raw diagnostics retain hardware, size and camera metadata.
3. Used active people-update measurements and a source-mapped High CPU profile
   to locate repeated terrain work, then repeated attribution after the
   atomic-move, query-selection and presentation changes. Allocation experiments
   remain separate from steady-state frame measurements.
4. Implemented bounded child resource pooling, equivalent terrain-query
   rejection and camera-aware repeated-mesh submission. Differential and
   lifecycle tests protect behavior, RNG, transforms and resource ownership.
5. Qualified normal and diagnostic Low/Mid/High game starts through native title
   input, sandbox reloads, Noon/Midnight and all three cameras. Frozen A/B images
   protect appearance; native top-down yaw/zoom and transformed-camera tests
   cover camera movement. Source simulation continues for offscreen actors.
6. Froze the source and ran independent calibration, holdout and candidate
   captures through the accepted supervisor/analyzer for parked and driving
   scenarios. Preserved the failed holdout, all raw attempts and worst stalls,
   then regenerated reports through the actual offline CLI.
7. Reconciled source/build identities and exact owned processes, stopped the
   task-owned keep-awake process, and documented remaining streaming spikes,
   subjective Auto acceptance and a real-iPad procedure. No deployment or
   physical-iPad measurement was performed.

## Offline topology lead

A reproducible [50-child model inventory](kid-topology.json), generated by
[this script](kid-topology.mjs), contains 737 meshes, 86,400 triangles, 100
shadow-casting meshes and 1,037 scene nodes. It allocates 490 geometry objects
whose buffer contents reduce to 14 distinct shapes, plus 375 material objects.
A second invocation produced byte-identical inventory output.

These are unculled detailed-model counts, not measured draws, GPU memory or
frame time. They justify testing child rendering and allocation separately.
Geometry pooling could reduce construction/resources, while draw reduction
would require a different change such as spatial instancing or model detail.
Do not report pooling as a demonstrated steady-state rendering improvement.

## First candidate: shared child resources

`src/models/kid.js` now lazily shares its fixed geometry and palette materials.
The [frozen original model](legacy-kid-model.js) retains the initial source
body, with only imports relocated; the regression verifies its hash against
the preserved baseline manifest. The change retains all meshes, triangles,
animation transforms, material settings and shadow flags.

The [independent-process construction experiment](kid-construction.json),
reproducible with [this script](kid-construction.mjs), ran eight legacy and
eight pooled cases in predeclared ABBA order. Each used 50 children and retained
737 meshes / 86,400 triangles. Per cohort, geometry objects fell from 490 to
14, material objects from 375 to 43, and unique CPU geometry-buffer storage
from 1,629,120 to 96,016 bytes. Cold-construction medians were 24.02 / 13.55 ms;
warm-construction medians were 13.27 / 3.15 ms for legacy / pooled respectively.

These are exploratory Node measurements while Gary was using the Mac, not
calibrated game-frame or iPad performance evidence. The bounded page-lifetime
pool retains a small resource set even after every model is removed; callers
must retain the shared-resource disposal contract.

The first equivalence attempt caught hidden global RNG consumption from
Three's UUID generation. Cache hits now consume the same UUID draw that a new
resource would have used, preserving subsequent palette/accessory/world draws.
`bin/test-kid-pooling` verifies independent cold-cache processes, 72 random
variants with six animated poses each, exact buffers/materials/shadows and RNG
draws, bounded pools, and disposal with another model still alive. Its
[focused log](checks/kid-pooling.log) passes. Real-game tier, sandbox and camera
qualification now pass as described below. Calibrated game-frame comparisons
remain separate from this allocation result.

## Terrain-query work

The [source-mapped High CPU profile](diagnostics/baseline-high-cpu-attribution.json)
attributes 1,572.8 sampled milliseconds to campsite reachability within an
8,132.0 ms sample window. This locates expensive work; sampling is not the same
measurement as elapsed frame timing.

Two changes preserve complete terrain/collision validation for relevant moves:

- The shared [people adapter](../../../src/landscape/peopleAdapter.js) uses the
  existing synchronous atomic move instead of immediately proposing and then
  revalidating the same route during commit. Both child grounding phases stay
  intact. [Differential tests](../../../bin/test-people-grounding-cost) retain
  bridge entry/exit, blocked footprints, sweep bounds, stale worlds, missing
  decks, hidden initial placement and relocation, with exactly half the
  terrain samples for successful immediate moves.
- [Campsite](../../../src/people/campActivity.js), market, picnic, hammock and
  bathroom searches reject candidates that cannot beat the current nearest
  choice before paying for terrain reachability. Strict range boundaries,
  registry-order ties, unreachable nearer places, reservation cleanup, grouped
  ranges and behavior RNG remain covered by
  [camp](../../../bin/test-camp-reachability) and
  [other-place](../../../bin/test-place-reachability) regressions, alongside
  the existing long-running ownership/behavior oracles.

Instrumented High profiles observed adult update averages from 12.98–16.96 ms
before these changes and 6.00 ms after the query guards; child updates observed
1.69 ms before and 1.28 ms after the isolated atomic-move change. Live activity,
profiling and launch state differ, so these are attribution observations, not
the final calibrated FPS claim. The immutable pooled baseline used for the
formal comparison already includes child resource pooling; the candidate adds
the query changes and presentation instancing.

## Camera-aware child presentation

[The presenter](../../../src/people/childPresentation.js) retains the complete
original rigs and gameplay ownership. Source meshes borrow layer zero while
owned instances submit repeated opaque geometry/material/render-state groups.
A shared scene callback runs after world transforms update and before renderer
projection, buffer upload and shadow rendering. It updates instances from the
current pose and active camera, with no extra source-rig traversal in the game
tick. Offscreen casters remain available while shadows are enabled. Unsupported
instance-local shear or changed render state restores ordinary rendering before
projection; disposal restores layers and releases only owned instance buffers.

The [presentation regression](../../../bin/test-child-presentation) covers
animated matrix equivalence, transformed outer parents, vertex containment,
nonvacuous frustum checks, immediate camera changes, distinct Low/High caster
behavior, hidden/reappearing actors, recycling, global RNG preservation, true
partial-construction failure, shared resources and multiple owners. Source rigs
remain authoritative for collision, movement and interaction regardless of
whether a particular instance renders.

Frozen live-game comparisons used native V-key camera switching through chase,
first-person and top-down at Noon and Midnight on Low and High. Each pair keeps
the same actor/camera/registry fingerprint. Low submitted exactly the same
triangles in all six pairs, with 424–428 fewer total draws in chase, 59–61 fewer
in first-person and 666 fewer in top-down. High retained approximately
4,500–16,500 extra offscreen caster triangles in chase/first-person so shadows
could remain correct; top-down triangle totals matched. This is an explicit
submission tradeoff rather than a triangle-reduction claim.

Across the twelve pairs, at most 0.0084% of compared world pixels differed by
more than 8/255 per channel, excluding documented HUD rectangles. Raw images,
camera data and [Low raster metrics](diagnostics/20261105-174549-cameras-low-219e3149/raster-comparison.json)
and [High raster metrics](diagnostics/20261105-174625-cameras-high-bd67e2bc/raster-comparison.json)
are preserved. The [standard-library PNG comparison](compare-raster.mjs)
reproduces those metrics without modifying source images. These results support
near-identical prepared views, not a blanket perceptual or device claim.

Native manual camera input also changed top-down yaw to approximately 0.153
radians and camera height to 72.73 in both tier captures. The saved `manualCamera`
fields record those resulting values. This verifies that the live camera still
responds while presentation instancing is enabled; the frozen pairs above
establish image equivalence at the prepared views.

## Physical-device follow-up

The [older-iPad Safari acceptance procedure](ipad-acceptance.md) uses the existing
guided capture path, records device/build and quality conditions, and retains
felt-lag markers and worst stalls. The local optimization has not been deployed,
and no physical-iPad improvement is claimed from these desktop measurements.

## Calibrated comparison ledger

The [first declared attempt](comparisons/attempt-1/inventory.json) planned four
baseline calibration runs, eight fresh unchanged-baseline holdouts and eight
paired candidate runs for High/Low festival and driving conditions. It stopped
after 32 runs, preserving the [terminal failure](comparisons/attempt-1/result.json).
No thresholds or inputs were removed or edited after inspection.

High dense-festival-v1 passed its independent holdout and reports
[improved](comparisons/attempt-1/high-dense-festival-v1/comparison.json): paired
median p95 change was -11.95 ms against an 8.80 ms frozen threshold, with all
four pair changes beyond that threshold. This is an independently completed
condition, not successful completion of the attempted four-condition suite.

The High driving [unchanged-baseline holdout](comparisons/attempt-1/high-streaming-drive-v1/holdout.json)
reports comparison invalid. Three of four baseline-only pair changes exceeded
the initial segment's 2 ms bound, with a paired median increase of 3.70 ms.
The candidate was never launched for that condition. This cannot establish a
candidate regression or improvement. All 32 owners reported successful cleanup,
and a subsequent exact-identity check found no owned process still alive and no
lab lease. macOS reported no recorded thermal/performance warning; that does
not prove temperature control or OS-wide isolation.

All five saved reports, including the invalid holdout, regenerated through the
real CLI with exact JSON equality, recorded in
[the regeneration receipt](comparisons/attempt-1/regeneration.json).
Repeat that offline check from the repository root:

```sh
python3 verification/performance/2026-11-05-optimization/regenerate.py verification/performance/2026-11-05-optimization/comparisons/attempt-1
```

Use `attempt-2` in the final argument to regenerate the second bundle.

The [second experiment](comparisons/attempt-2/inventory.json) was declared before capture: Low festival, Low driving and
High driving, each with eight new baseline calibration runs, eight fresh
holdouts and eight candidate runs, for 72 runs. The versioned controller recipe
changes the calibration sample count; the analyzer's finite-sample envelope,
minimum thresholds, semantic checks, segment protection, holdout and drift
rules remain unchanged. Its inventory embeds the failed prior attempt.
This was one fresh attempt, not repeated retries until a desired result appeared.
It [completed](comparisons/attempt-2/result.json), with all three fresh holdouts
reporting no detectable change. High driving improved and both Low comparisons
reported no detectable change in their primary frame-delivery verdict. The
independently accepted High festival condition comes from the first attempt;
do not describe that stopped attempt as a completed 80-run suite.

All nine second-attempt reports [regenerated exactly](comparisons/attempt-2/regeneration.json),
giving fourteen deterministic offline CLI regenerations across both attempts.
The original acknowledged `capture.json`, projected `run.json`, ownership,
worker/Chrome logs, declared inventories and executed controller sources are
retained for all 104 comparison captures. Browser profiles and endpoint/token
configuration are excluded from the promoted bundle. The original ignored lab
directories remain intact. [Promotion](promote-comparison.py) records source
file hashes and refuses to overwrite differing evidence.

The medians of recorded run-level CPU-work medians fell from 12.15 to 8.25 ms
on Low festival and 13.85 to 9.65 ms on Low driving. This supports more CPU
headroom even though delivered frames remained near the same cadence. The
analyzer does not promote CPU-only improvement to its primary frame-delivery
verdict. Low driving's p99 improved under the analyzer while primary p95/stall
criteria did not cross their bounds.

Streaming hitches remain. Candidate driving worst frames ranged from 139.7 to
144.0 ms on High and 162.6 to 167.9 ms on Low. High's recorded stall counts fell
from 16–19 to 10–11 per measured route, but the conservative stall-rate detector
did not establish that as a separate improvement. Retain the worst frames and
attribute their owners before selecting a further construction/streaming change;
this optimization does not establish hitch-free driving.

All [303 frozen application and collector inputs match the final candidate](source-reconciliation.json),
both immutable builds verify, and host collector identities match. Full checks
and the production build passed before that freeze, with logs at
[final check](checks/final-npm-check.log) and [final build](checks/final-npm-build.log).
No application source changed during comparison.

[Final ownership reconciliation](resource-cleanup.json) covers 130 task-run
manifests and 2,680 recorded PID/birth identities, including attribution,
qualification and both comparison attempts. Every owner passed cleanup, no
recorded identity remained alive, and the lab lease was absent. The exact
task-owned keep-awake process was stopped and verified absent. Pre-existing
browser/process identities were not signalled; per-run servers were closed by
their owners. No ordinary development server was started or left running.

## Diagnostic entry point

During the reserved Mac window, use the supervised browser ownership procedure
in [the lab guide](../../../docs/performance-lab.md). The local diagnostic URL is
`/?mute=1&perf=low&sceneProbe=subtract&seed=2404796662`; press **Isolate rendering
costs** after the normal title gesture. Repeat on High and with representative
cameras. The resulting JSON is in `#scene-probe-result`.

The scene is parked, quality pinned temporarily, and one render family hidden
per intervention. Population, registry entries, collision and resource ownership
are not removed. The report distinguishes subtraction from equal-content
optimization. Every intervention restores original mesh visibility, and the
existing probe restores material, quality, pause, renderer hooks, GPU queries
and scheduled callbacks on completion, failure, timeout and page exit.

## Verification ledger

- `node bin/test-render-subtraction`: passed real Three.js scene family
  classification, hidden ancestors, newly streamed meshes, unchanged scene and
  resources, and synchronous/asynchronous failure restoration.
- `node bin/test-scene-probe`: passed both probe modes across prior pause
  states, GPU/no-GPU, success, render failure, timeout and page exit. Subtraction
  failures occur during an intervention, proving visibility restoration.
- Full project checks passed; [the saved log](checks/npm-check.log) includes
  the new subtraction regressions. The [production build](checks/npm-build.log)
  passed after adding report camera/render-size metadata.
- Real-game normal/diagnostic Low/Mid/High integration and sandbox Noon/Midnight
  reload qualification: [passed](qualification/results.json).
- Camera/visual prepared-scene qualification: twelve frozen pairs passed as
  documented above, with native camera switching, yaw and zoom checks.
- Four calibrated fixed-tier conditions passed as detailed above; one failed
  unchanged-baseline holdout remains preserved, with no candidate driving claim
  made from that attempt. All fourteen CLI analyses regenerate exactly.
- Final frozen-source and exact process reconciliation: passed, with the
  task-owned keep-awake process stopped. Physical-iPad and subjective Auto
  acceptance remain separate from these measurements.
- Candidate child pooling: focused model/controller tests passed, production
  build and [full suite](checks/kid-pooling-full-check.log) passed for the changed
  model. The [build log](checks/kid-pooling-build.log) is preserved separately
  from the earlier diagnostic-only preparation build.
