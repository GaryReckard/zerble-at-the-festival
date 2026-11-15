# Deliberation Summary: what should the next performance work be, especially for iPads?

## TL/DR

The single most valuable next step is a better measurement, because the iPad captures we have cannot say where a typical frame goes, and every optimization on the list is a guess until they can. All five personas therefore agree that production performance changes should be frozen, that a small capture-only instrumentation change should be built on the desktop, and that you should then spend one batched iPad session on the November 8 fixed route. That session has four short runs (Auto, locked full resolution, Auto again, horizon off), and together they confirm the November 11 far-field fix, split the untimed part of the frame, and show whether the iPad is limited by JavaScript, by the graphics side, or by both. The first lever after that is most likely the fog-limit horizon cull behind a default-off flag, since four of the five personas rank it first and it is the only candidate that helps both the stalls and the steady frame. The council overturned the idea that Auto is wasting resolution on the iPad, so Auto stays exactly as it is for now. Three things need your call rather than the council's: any relaxation of physics or population, the unusable Low draw budget of 80, and how to record the older "validate on device" roadmap bullets that no run can now validate.

## Context

-   **Task**: Review everything done, researched, built and planned for performance, and decide what would most significantly improve performance next, especially on iPads (`briefing.md`).
-   **Personas Consulted**: Profiler, Architect, Maverick, Adversary, Pragmatist, plus the Mediator.
-   **Mode**: Tier 3 Full Deliberation in debate mode. Every persona file has a Round 2 reactions section, and this summary uses each persona's latest position.
-   **Extra input**: `orchestrator-prethinking.md`, weighted no more than one persona position. The section "Where the orchestrator's pre-thinking stood up" near the end says what the council confirmed and overturned.
-   **Date**: 2026-11-15
-   **Stale charter text noted**: Charter Non-Negotiable 4 ("No build step") predates the Vite approval of 2026-10-29 (`openspec/council/charter.md:47-52` against `.claude/rules/no-build.md`). It was not applied as a tripwire here.

Shorthand used below, expanded once:

-   **Auto** is the adaptive quality governor in `src/adaptiveQuality.js`, which steps down through quality rungs when frames are slow. **`pixel-50`** is its lowest rung, which the iPad reached on both captures at a 675×462 scene target (`verification/performance/2026-11-07-ipad/README.md:55-61`, cited in the Profiler's "Things to stop doing").
-   **Work** is the time the game's own JavaScript spends inside one frame. **Wall** is the real interval between two frames. **Wall-minus-work** is the part of a frame the capture cannot attribute to the game's JavaScript at all.
-   **p50** and **p95** are the median and the 95th-percentile value in a one-second capture window.
-   **A/B** means two runs that differ in exactly one setting.

## What the council agreed

All five verdicts are "Proceed with mitigations". The agreement below is real convergence reached independently in Round 1 and held through Round 2.

1.  **Freeze production performance changes until the next iPad run.** Capture-only instrumentation, harness options and documentation are exempt (Adversary, Round 2 "Where I now stand" step 1; Architect, Round 2 "Agreements"; Profiler, Round 2 "On the Adversary"; Maverick, Round 2 step 1; Pragmatist, Round 2 reaction 4).
2.  **Instrument the untimed part of the frame with capture-gated timers.** The existing people-frame tracer only switches on when the hostname is `localhost` or `127.0.0.1` (`src/main.js:95-100`, verified by the Mediator), so it can never run on an iPad that loads the game over the local network.
3.  **Spend one batched physical-iPad session on the November 8 fixed route**, and choose the next lever only from that data.
4.  **Record the device and its power state.** Neither capture recorded battery, thermal or charging state (`verification/performance/2026-11-07-ipad/README.md:24-26`, cited in the Adversary's Round 1 "Vulnerabilities"), and the hardware model is unknown (`verification/performance/2026-11-08-ipad-child-density/README.md:20-22`, cited by the Profiler and the Maverick).
5.  **The fog-limit horizon cull is the leading structural candidate**, built behind a default-off flag (Profiler, Round 2 step 5; Maverick, Round 2 step 4; Pragmatist, Slice 2; Adversary, Round 2 "Sharpened points"; Architect, Round 2 step 5).
6.  **Any change to physics, population or simulation behavior goes to Gary as an explicit decision** (briefing constraint 10; Profiler, Round 2 "On the Pragmatist"; Architect, Round 1 step 4; Adversary, Round 1 step 5; Maverick, Round 2 step 6).
7.  **Stop desktop-only structural investigations and stop reading the red HUD budgets as a verdict** (Maverick, "What to stop doing"; Profiler, "Things to stop doing"; Pragmatist, "Deferred / Cut").

### Measured facts and inferences, kept apart

| Statement | Status | Source |
| --- | --- | --- |
| Every one of the largest November 8 driving world intervals was far-field work (424, 323, 154, 136, 122, 120 and 119 ms, plus 1,421 ms during settling). | Measured on the iPad | `2026-11-08-ipad-child-density/baseline-report.txt`, cited in Profiler "Evidence base" item 5 |
| Parked iPad work p95 was 19 to 26 ms, with the render call at 6 to 10 ms and the world update at 1 ms, which leaves about 12 to 15 ms untimed. | Measured on the iPad (computed by the Profiler from capture windows) | Profiler "Evidence base" table and item 2 |
| The median parked gap between wall p50 and work p95 was 9.5 ms on November 8 and 8 ms on November 7, and window wall values are spread continuously instead of clustering at 16.7 or 33 ms. | Measured on the iPad | Profiler, Round 2 "On the Adversary" |
| Inside one parked phase with steady draws and steady work, the frame interval fell as the resolution fell (November 8: 41.0, 37.0, then 30.9 ms; November 7: 36.5, 33.6, then 27.0 ms). Only two and three windows exist at the top rung. | Measured on the iPad, with a small sample at the top rung | Maverick, Round 2 rung table |
| Physics runs outside both existing timers. `physicalWorld.advance` is at `src/main.js:1288`, and its `beginRender` and `endRender` hooks sit just outside the render timer. | Read from source (verified by the Mediator at `src/main.js:1288`, `1906`, `1938-1942`) | Adversary, Round 1 and Round 2 |
| The fixed-step clock defaults to 60 steps per second with at most 5 steps per call, and the frame delta is clamped to 0.05 s. | Read from source (verified at `src/physics/fixedStep.js:3` and `src/main.js:1223`) | Profiler, Round 2 |
| `registry.rebuildSpatialIndex()` runs every frame in the untimed region. | Read from source (verified at `src/main.js:1477`) | Architect, Round 1 step 4 |
| The far field counts dropped publications in `applySuperseded`, but the capture does not serialize that counter. | Read from source (verified: `src/farField.js:713,889`, and no match in `src/debug.js`) | Adversary, Round 1 "Vulnerabilities" |
| The November 8 baseline was served from head `5e85a2d` with uncommitted edits that included `src/worldgen/terrain.js` and `src/world.js`. | Measured (verified by the Mediator in `baseline-snapshot.json`, fields `head` and `dirty`) | Adversary, Round 2 "Rebuttals" |
| The November 11 fix makes the worst offline far-field call fall from 61 to 176 ms down to 3 to 33 ms. | Measured on an M4 in Node only, with no browser, GPU or iPad result | `2026-11-11-far-field-publication/README.md:74-85`, cited in Profiler item 5 |
| The iPad runs this work about three times slower than the M4. | Inference recorded in the evidence bundle, not a measurement | `2026-11-11-far-field-publication/README.md:96`, cited by Profiler, Maverick and Adversary |
| The wall-minus-work gap is graphics-side work in Safari. | Inference. The Profiler lists garbage collection, input and audio handlers, the capture upload and compositor back-pressure as equally possible occupants. | Maverick, Round 2 consequence 1; Profiler, Round 2 "On the Adversary" |
| Three.js updates scene matrices inside the render call, so matrix traversal is already inside the 5 to 9 ms render timer. | Unverified inference. `node_modules` is absent in this checkout (Mediator: `ls node_modules/three/package.json` fails), so nobody read the pinned source. | Architect, Round 2 "Disagreements"; Profiler, Round 2 "On the Maverick" |

## Tensions and how they were resolved

| # | Conflict | Positions (persona and section) | Resolution | Rationale |
| --- | --- | --- | --- | --- |
| 1 | What bounds the steady frame on the iPad | Profiler Round 1 "Evidence base" item 1 said main-thread work plus refresh rounding. Adversary Round 1 "Killer Finding" said the time is outside timed code. In Round 2 the Adversary conceded that rounding explains the median ("Concessions"), the Profiler withdrew the clustering claim ("On the Adversary"), and the Maverick showed the interval falling with resolution (rung table). | Treat it as unsettled, with two unmeasured pieces of similar weight: about 12 to 15 ms of untimed JavaScript and about 8 to 10 ms of wall-minus-work. The session must measure both, per phase and per quality rung. | The Profiler's revised verdict states this directly, and no persona's latest position contradicts it. Charter Resolution Rule 2 (verifiability over speed) applies. |
| 2 | Should Auto stop dropping resolution on the iPad | Maverick Round 1 step 3 proposed a guard and then retracted it (Round 2 "On my own Round 1"). Architect Round 2 step 4, Profiler Round 2 step 6 and Adversary Round 2 step 6 still propose a hold if a locked-resolution run matches Auto. | Auto stays unchanged. A hold is considered only if the locked run matches Auto within the session's own noise floor, and it then goes to Gary as a player-visible decision. | The only within-phase evidence says a hold would cost about 10 ms per frame (Maverick rung table). `ROADMAP.md:274` already records "Keep Auto as the shipping quality policy", and this plan preserves that decision. |
| 3 | Which runs the session carries | Profiler Round 2 step 3: Auto, `physics=0`, Auto, locked baseline. Architect Round 2 step 3: Auto, locked baseline, plus `farField=0` if time allows. Adversary Round 2 step 4: Auto, locked quality, `farField=0`, Auto. Maverick Round 2 step 3: Auto and `physics=0` alternated twice. Pragmatist Round 2 step 3: Auto, `physics=0`, locked baseline, then `farField=0`. | One order: Auto, locked baseline, Auto, `farField=0`, with `physics=0` as an optional fifth run. The exact commands are in Change Group 2. | See tensions 4, 5 and 6 for each arm. The order is chosen so that a session cut short after three runs still answers the main question with a repeat. |
| 4 | Whether to spend runs on `physics=0` | For: Profiler Round 2, Maverick Round 2, Pragmatist Round 2 reaction 2. Against: Architect Round 2 "Disagreements" (it selects the legacy driving path, `DEBUGGING.md:69`, so it is not a one-variable test), and the Adversary dropped it in Round 2 "Concessions" in favour of a timer. | Time physics with a section timer that also covers `beginRender` and `endRender`, and record steps per frame. `physics=0` becomes an optional last run that bounds the answer, and it is never read as a clean A/B. | The One-Variable rule and Gary's device time both point the same way. The persona who proposed the arm withdrew it, and the timer answers the same question without a run. |
| 5 | Whether the locked-resolution run is worth a slot | Maverick Round 2 dropped it because "both captures already show what they would find". Profiler, Architect, Pragmatist and Adversary keep `perfQuality=baseline`. | Keep it as run 2. | The Maverick's own table has two and three windows at the top rung and compares rungs that Auto visited at different moments of the same phase, so time since boot is not controlled. A locked run on the whole route is the one-variable version, and it is the measurement that separates JavaScript levers from graphics-side levers. The harness already supports it (`bin/playtest-perf:17`). |
| 6 | `perfQuality=sustained` or `perfQuality=baseline` | Maverick Round 1 step 2 proposed sustained. Profiler Round 2 "On the Maverick", Architect Round 2 and Pragmatist Round 2 reaction 5 prefer baseline. | Baseline. | Sustained only disables the p95 trigger and can still step down on the average (`src/adaptiveQuality.js:214-215`, verified by the Mediator), so it is not a locked arm. |
| 7 | Can one Auto run "accept" the October 22, November 5 and November 6 changes | Pragmatist Round 1 step 2, Architect Round 2 step 3 and Maverick Round 2 step 3 say yes. Adversary Round 2 "Rebuttals" says no, because the November 8 baseline already contained them. | The Adversary is right on the facts. The next run can accept only the changes that landed after the November 8 build. The older bullets are recorded as "present in every iPad capture, no device before and after exists". | Verified: `baseline-snapshot.json` shows head `5e85a2d` with dirty `src/worldgen/terrain.js`. Recording an acceptance that never took place would corrupt the audit trail in ROADMAP and CHANGELOG. |
| 8 | When the far-field item may be closed | Pragmatist Round 1 step 3: worst driving world interval below roughly 50 ms. Adversary Round 2 "Rebuttals": that passes even if the horizon has quietly stopped publishing. | Two conditions, both required: the worst far-field interval is below about 50 ms in both Auto runs, and the horizon keeps publishing while driving. The Pragmatist adopted this in Round 2 reaction 3. | Dropped jobs increment `applySuperseded` (`src/farField.js:889`), which the capture does not record. Safety and correctness come before speed. |
| 9 | Where "render directly when bloom and Trip are off" ranks | Maverick Round 2 moved it up to first graphics-side candidate. Profiler Round 2 "On the Pragmatist" and Adversary Round 2 "Rebuttals" rank it low for the iPad. The Pragmatist demoted it (Round 2 reaction 10), and the Architect demoted it (Round 2 "Concessions"). | Conditional. It is scheduled only if the session shows a large wall-minus-work share at `pixel-50` that moves with resolution. It then needs a shader program-count check across quality changes and a `render-pipeline` spec delta, and it passes through its own deliberation gate. | It touches the render pipeline, which is a charter risk signature. The project has already had a program leak from 54 to 691 (`docs/backlog/performance.md:164-176`, cited by the Adversary). |
| 10 | Freezing static chunk subtrees | Maverick Round 1 step 4 ranked it fourth and conceded in Round 2. Architect and Profiler argue it lives inside the timed render call. Adversary Round 2 notes that chunk groups now hold physics-moved props. | Parked until the device prices matrix traversal. If it is ever scheduled, the "nothing moves in a frozen subtree" check must cover physics-adopted props and nightness-polled parts. | The claim that it sits inside the render timer is unverified against the pinned Three.js source. The failure mode is silent, so correctness comes first. |
| 11 | Fog-limit cull: before planning or after | Architect Round 1 step 6 and `ROADMAP.md:259` say cull before planning to save planning cost. Profiler Round 1 step 3 says filter after planning so no seeded draw order changes. | The cull must sit after every seeded random draw and before terrain grounding. Its acceptance check is that the culled set equals the old published set filtered by radius. | Charter Non-Negotiable 1 (determinism) overrides the extra saving. Grounding is the cost the Profiler identifies, so most of the benefit survives. |
| 12 | Whether the cull flag ships inside the session build | Profiler Round 2 "On the Adversary" wants it A/B'd in the same session. Pragmatist "Batching rule": never give the iPad a build with two untested changes stacked. | The session build contains only capture-only changes. The `farField=0` run prices the upper bound of what the cull could save, and the cull itself is confirmed in the following session. | The session's first job is a clean test of the November 11 fix. Editing `src/farField.js` again before that test would break the One-Variable rule. |
| 13 | Spec work: precondition or fold-in | Architect Round 2 step 5 wants the far-field spec and the flat-terrain fix first. Pragmatist Round 2 reaction 9 wants them folded into the cull change. | Both are satisfied. The far-field capability spec is written as the first task of the cull change, and the flat-terrain and charter corrections are documentation-only edits that can land during the freeze. | Architecture adherence ranks above simplicity in the charter's Mediator note, and this ordering costs no extra device time. |
| 14 | Reopening the shopkeeper batching that was declined on November 7 | Profiler Round 1 step 5: the rejection used desktop timing and is not final for the iPad. Pragmatist Round 2 reaction 11: do the desktop draw census first. | Run the census first and reopen shopkeepers only if they are among the top draw owners at the route anchors. | The census costs no device time (Adversary Round 1 step 3). |
| 15 | "Perf work stops at green" cannot be applied on Low | Architect "Structural Risks": the iPad runs at 6 to 13 times the Low draw budget of 80, so charter Resolution Rule 4 and Non-Negotiable 6 are unreachable as written. Pragmatist "Deferred / Cut": recalibration is polish and blocks nothing. | No lever is blocked on recalibration. Until Gary recalibrates the budget, the stop condition for this change is device-based: parked and driving work p95 and wall on the fixed route. No proposed change may add draws on Low. | A Non-Negotiable cannot be rewritten by the council, so the gap is escalated under "Decisions only Gary can make". |

## Final Priority Path

### Change Group 1: Foundation, capture instrumentation and harness options

-   **Scope**: Capture-only code, harness options and a desktop census. Nothing here changes what a player sees. It lands in one commit so the session build differs from current `main` by diagnostics alone.
-   **Estimated Effort**: Half a day to one day on the desktop. The Pragmatist's "Effort reality check" calls the timers "hours, not days", and the harness options and regression checks add to that.
-   **Tasks**:
    1.  **Add section timers for the untimed part of the frame**, behind the existing `PERF_CAPTURE_TIMING` gate and in the existing world-parts accumulator pattern (`src/main.js:1205-1207`; Architect Round 1 step 1). The sections are: physics, covering `advance` at `src/main.js:1288` and both `beginRender` and `endRender` hooks at `src/main.js:1906` and `1942`; people and crowd; `registry.rebuildSpatialIndex()` at `src/main.js:1477` as its own bucket; the per-kind scans (`src/main.js:1620-1640` and `1672-1776`, Architect "Structural Risks"); collisions; bubbles and StarPower; chase camera; context lights; adaptive quality; and HUD writes. Keep it to about ten timer pairs (Profiler "Load Estimates").
    2.  **Accumulate each section across the one-second window instead of storing per-frame values.** The capture reports whole milliseconds on Safari (Profiler "Performance Risks"), so a per-frame reading of a 1 ms section is unreliable, while a per-window sum is not. This is a Mediator recommendation that follows from that risk.
    3.  **Record physics steps per frame and the step timings that already exist**, namely `meanStepMs` and `maxStepMs` from `stats()` at `src/physics/liveWorld.js:342` (Adversary Round 1 "Vulnerabilities").
    4.  **Report wall-minus-work per phase and per quality rung**, together with the previous frame's work and any change in shader program count, so a graphics-side reading is not assumed by default (Maverick Round 2; Profiler Round 2 "On the Adversary").
    5.  **Serialize far-field health**: `applySuperseded`, the age of the published horizon, and the largest single publication or grounding unit, next to the existing `ffCold`, `ffApply` and `ffApplyFrames` fields at `src/debug.js:2143-2148` (Adversary Round 1 step 2; Profiler Round 1 step 1).
    6.  **Record the environment**: display refresh rate, estimated from frame intervals on the title card before the world boots, plus manual fields for iPad model, Low Power Mode and charging state (Maverick Round 2 "power-state bullet"; Adversary Round 1 step 2).
    7.  **Decide how to price scene matrix traversal only after reading the pinned Three.js 0.160.0 source.** The Architect proposes timing an explicit `scene.updateMatrixWorld()` before `composer.render()` (Round 2 step 2). That source could not be read in this checkout, and an extra explicit call may add a second traversal under capture, so run `npm ci` and check first. If it would double the work, leave this section out of the session build.
    8.  **Add harness options to `bin/playtest-perf`** for `farField=0` and `physics=0`. The harness has no way to add arbitrary flags today (`bin/playtest-perf:12-24`, verified), and a hand-edited link on the iPad is easy to get wrong (Adversary Round 2 "Rebuttals").
    9.  **Settle the tier flag before the session.** `--quality baseline` requires `--tier low` (`bin/playtest-perf:33-34`, verified by the Mediator), while the November 8 baseline used detected Low. Confirm on the desktop that forced Low and detected Low resolve to the same settings in `src/perf.js`. If they do, run every arm with `--tier low` so the arms differ only in the intended setting.
    10. **Pre-register the pass thresholds** in the change folder before the session: the far-field interval limit (about 50 ms, Pragmatist Round 1 step 3) and a concrete publication rule such as at least one completed publication per N cells crossed with no long run of supersessions (Adversary Round 2 "Rebuttals"). Choose N from a desktop run of the same route.
    11. **Prove the timers are cheap** by running the same desktop route with and without capture timing (Adversary Round 2 step 2; Profiler "Load Estimates").
    12. **Run the desktop draw census** with `__dbg.drawCensus()` (`src/main.js:2691`) at the November 8 route anchors on `?perf=low`, including the far-field share, so draw owners are named at no device cost (Adversary Round 1 step 3; Profiler Round 2 step 2).
    13. **Regression checks and the game smoke test**: `npm run check`, `npm run build`, `bin/report-perf-playtest` on an existing capture file to prove the report still parses (Pragmatist "Effort reality check"), the `bin/test-device-capture-flow` checks, and the real game boot on `/?mute=1` (title card, mode-plank click, world boot, clean console). Add a CHANGELOG entry because this is a development-workflow change (`.claude/rules/changelog-and-roadmap.md`).

### Change Group 2: One batched physical-iPad session

-   **Scope**: Evidence only. Four runs on one frozen build, on the November 8 route and seed, plus one optional run.
-   **Estimated Effort**: About 20 to 30 minutes of Gary's time including setup. This is a Mediator estimate. The Profiler's "Priority Sequence" step 2 puts three route runs at about six minutes of driving in total.
-   **Run order**:

| Run | Harness setting | What this run answers | Compared with |
| --- | --- | --- | --- |
| 1 | Default Auto: `bin/playtest-perf drive --autopilot --world-detail` with the November 8 seed and the tier flag settled in task 1.9 | Is the November 11 far-field fix real on the device, and does the horizon keep publishing? It also gives the first device split of the untimed frame and wall-minus-work at each rung Auto visits. | The November 8 baseline (worst driving interval 424 ms, 423 ms of it far-field) |
| 2 | The same, with `--tier low --quality baseline` | Does resolution change frame time on this iPad over the whole route, with quality held at rung zero? The size of the gap between runs 2 and 1 is the graphics-side share. | Runs 1 and 3 |
| 3 | Default Auto again | How much does the same route vary on this device? No route has ever been repeated on the iPad (Adversary Round 2 "Rebuttals"), so this is the noise floor for every other comparison, and it shows whether heat from run 2 carried over. | Run 1 |
| 4 | The same as run 1, with the new far-field-off option | What does the horizon cost on the device in steady work, wall and draws? This is the upper bound of what the fog-limit cull can save. | Runs 1 and 3 |
| 5, optional | The same as run 1, with the new physics-off option | A bounding check on physics only if time remains. It switches to the legacy driving path (`DEBUGGING.md:69`), so it is supporting evidence for the physics timer and never a clean A/B. | Runs 1 and 3 |

-   **Why this order**: Runs 1 to 3 form a complete answer on their own (the fix, the resolution question and a repeat), so a session that is interrupted after three runs still pays. The Adversary asked for Auto first and last. Placing the second Auto run third keeps the locked run bracketed and makes run 4 directional when runs 1 and 3 disagree.
-   **Tasks**:
    1.  Freeze the build and note its commit and clean status in the bundle.
    2.  Record the environment before run 1 (see the Gary-only checklist).
    3.  Perform runs 1 to 4 in order without changing anything else between them.
    4.  Perform run 5 only if time and patience remain.
    5.  Save a new evidence bundle under `verification/performance/` with a README that states the build, the environment, each run's setting and the pre-registered thresholds.
    6.  Judge every comparison on work p95 and wall-minus-work, and report FPS only as context. Refresh rounding can hide a real 4 ms saving behind an unchanged FPS figure (Adversary Round 2 "Sharpened points").

### Change Group 3: Decide from the data, then build the first lever

-   **Scope**: Apply the table below to the session results, then build exactly one lever behind a default-off flag for confirmation in the next session.
-   **Estimated Effort**: About an hour to read the session against the table. The fog-limit cull is "a day, not an hour" (Pragmatist "Effort reality check"). Other branches are sized when they are chosen.
-   **Decision table**:

| Session outcome | Next step | Source |
| --- | --- | --- |
| Runs 1 and 3 disagree by more than the differences between arms | The session is inconclusive. Record the power and thermal notes and repeat before choosing any lever. | Adversary Round 2 "Rebuttals" |
| Worst far-field interval below about 50 ms in both Auto runs, and the horizon meets the pre-registered publication rule | Close `ROADMAP.md:257` and move to the steady-frame rows. | Pragmatist Round 2 reaction 3; Adversary Round 2 step 5 |
| Interval is low, but the horizon is stale or supersessions run long | Not a pass. Treat it as publication starvation and lead with the fog-limit cull, which reduces the work each publication needs. | Adversary Round 1 "Vulnerabilities"; Profiler "Load Estimates" (inference that the cull roughly halves grounding at one pose) |
| The tail persists and the largest unit is a cold festival or woodland plan | Split inside `festivalPlan` or the woodland `cellPlan`, with the 120-horizon fingerprint check as the equivalence gate. | Architect Round 1 step 3; `2026-11-11-far-field-publication/README.md:105` |
| The tail is somewhere else (chunk builds, unloads or lakes) | Take the matching backlog row. Deferred disposal always needs a hard cap, and registry and collider removal stay immediate. | Pragmatist Round 1 step 3; Adversary Round 1 "Vulnerabilities" |
| Run 2 is clearly slower than Auto, and wall-minus-work at `pixel-50` is still large | The device is partly limited on the graphics side. Build the fog-limit cull first, then consider direct rendering with its gates. Auto stays as it is. | Maverick Round 2 steps 4 and 5 |
| Run 2 matches Auto within the noise floor | Resolution does not matter on this route. Bring an Auto resolution hold to Gary as a decision and demote graphics-side levers. | Architect Round 2 step 4; Profiler Round 2 step 6 |
| Run 4 lowers work p95 or wall by more than the noise floor | The fog-limit cull is confirmed as the first lever. | Profiler Round 1 step 2(c) |
| Run 4 shows no steady change | The cull is justified only by the stall evidence, so it drops behind whatever section dominates. | Mediator reading of the same arm |
| Physics is the largest section, or steps per frame are routinely 2 or more | Gary decides on the Low physics step. Run 5 or a dedicated pair can confirm it first. | Adversary Round 1 step 5; Profiler Round 2 step 4 |
| People or crowd is the largest section | Gary decides on population policy. The existing half-cohort fixture is the device A/B. Staggered updates need a determinism test at 30 and 60 FPS on one seed before any design. | Architect Round 1 step 4; Adversary Round 2 "Rebuttals" |
| `rebuildSpatialIndex` or the per-kind scans are the largest section | Design a mover-only index pass that handles the adverse all-mover case found on November 7. | Architect Round 1 step 4 |
| The render call is the largest section | Reduce draws: the fog-limit cull, then the census owners. Subtree freezing comes only after matrix traversal is priced and the frozen-subtree check covers physics-moved props. | Profiler Round 2 step 4; Adversary Round 2 "Rebuttals" |
| No section dominates and wall-minus-work is small | There is no single lever. Gary decides whether the current iPad experience is acceptable or whether density policy is on the table. | Charter Resolution Rule 3 (effort proportional to perceivable impact) |

-   **Tasks**:
    1.  Fill in the table from the bundle and write the chosen branch into the change's session log as a key decision.
    2.  Update the ROADMAP bullets as described in Change Group 5.
    3.  If the fog-limit cull is chosen, write the far-field capability spec first (Change Group 5, task 1).
    4.  Build the cull behind a default-off URL flag, following the `?farField=0` precedent. Place the radius filter after every seeded draw and before terrain grounding (tension 11).
    5.  Create a deliberately new fingerprint baseline for the flagged path and keep the existing 120-horizon baseline for the default path (Architect Round 2 "Agreements").
    6.  Run a pool-demand sweep on dense seeds, since the cull changes pool demand (Pragmatist "Effort reality check").
    7.  Confirm the flagged lever on the iPad in the next session, one change per session, before flipping the default.

### Change Group 4: Quality gates

-   **Scope**: Gates that apply to Change Group 1 and to whichever lever Change Group 3 selects.
-   **Estimated Effort**: One to two hours per change, plus the next device session for any lever.
-   **Tasks**:
    1.  `npm run check` and `npm run build` on every change (`AGENTS.md`, "Run and verify").
    2.  Smoke-test the real game on `/?mute=1`: title card, a ready mode-plank click, world boot and console inspection. A sandbox pass does not establish integration (charter Non-Negotiable 7).
    3.  Verify on `?perf=low` and `?perf=mid`, not only High (charter Non-Negotiable 6).
    4.  For the cull or any visual change, capture Noon and Midnight on Low and Mid (`ROADMAP.md:259`; Maverick Round 2 step 4).
    5.  Determinism gate for the cull: the culled set equals the old published set filtered by radius, and no existing `rng()` draw is reordered or re-salted (charter Non-Negotiable 1).
    6.  For direct rendering, if it is ever chosen: compare shader program counts before and after a bloom toggle, and check tone-mapping parity for sky, water and stars (Adversary Round 1 "Vulnerabilities"; Pragmatist Round 1 step 4b).
    7.  Accept or reject each lever on device work p95 and wall-minus-work measured against the Auto noise floor, never on desktop timing or FPS alone (briefing constraint 9; Adversary Round 2).
    8.  Update CHANGELOG in the same commit as any observable change, and trim ROADMAP to what remains.

### Change Group 5: Documentation and spec drift

-   **Scope**: Documentation-only edits, which are allowed during the freeze, plus the spec deltas that travel with later levers.
-   **Estimated Effort**: One to two hours for the documentation edits. The far-field spec is part of the cull's day.
-   **Tasks**:
    1.  **Write a far-field capability spec** covering pool caps, the fog radius, bounded publication and a staleness bound for the horizon while driving. No spec under `openspec/specs/` covers `farField` today (Architect "Structural Risks"). This is the first task of the cull change.
    2.  **Correct the flat-terrain requirement** in `openspec/specs/world-streaming/spec.md:41-51`, which still says `terrainHeight` returns 0 (Architect "Structural Risks").
    3.  **Prepare a `render-pipeline` spec delta only if direct rendering is chosen**, since the spec describes a fixed pass chain (`openspec/specs/render-pipeline/spec.md:31-50`).
    4.  **Rewrite the ROADMAP "validate on device" bullets** as set out in the table that follows this list.
    5.  **Record the HUD budget gap.** State in ROADMAP that the Low budget of 80 draws is not a usable stop condition against 514 to 1,270 measured draws, pending Gary's recalibration decision.
    6.  **Correct the stale charter text** in Non-Negotiable 4 and the importmap wording in Non-Negotiable 2, if Gary approves the edit.

What each ROADMAP bullet should become (task 4):

| ROADMAP bullet | What it should become |
| --- | --- |
| "Confirm the far-field publication fix on the iPad" (`ROADMAP.md:257`) | Keep it as the one bullet the next session can close. Add the two-part pass rule from tension 8 and the new `applySuperseded` and horizon-age reads. Its line about the four-group child fixture stays parked and is revived only if the people section is large. |
| "Decide whether the horizon should stop at the fog limit" (`ROADMAP.md:259`) | Keep it, and reword it as the default first lever: built behind a default-off flag after the session, priced by run 4, filtered after seeded draws, and confirmed on the device before the default flips. |
| "Verify the November 6 terrain optimizations on older-iPad Safari and Auto" (`ROADMAP.md:261`) | Replace the device request with a record: "Present in every iPad capture; no device before and after exists." Keep the desktop result as written. |
| "Validate the November 5 optimization on older-iPad Safari and actual Auto driving" (`ROADMAP.md:264`) | The same record. The November 8 build was already on top of `65c0085`. |
| "Validate the October 22 changes on the phone" (`ROADMAP.md:268-273`) | Split it in two. The registry half gets the same "no device before and after exists" record. The first-dusk and first-Trip check on the phone stays open as its own item, because the fixed driving route does not exercise either moment. |
| "Keep Auto as the shipping quality policy" (`ROADMAP.md:274`) | Keep it. Add that the iPad's within-phase data shows resolution drops shortening frames, and that run 2 is the comparable locked run this bullet asked for. |

## Final Recommendation

Proceed, in this order: freeze production performance changes, land the capture-only instrumentation and harness options, and run the four-run iPad session. Choose one lever from the decision table afterwards, with the fog-limit horizon cull behind a default-off flag as the expected first choice, and confirm it on the device before any default changes. Auto stays untouched, and nothing that relaxes physics, population or simulation moves without Gary's explicit sign-off.

---

## Risk Register

| # | Risk | Severity | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| 1 | The session runs on a capture that cannot see physics, the registry walk or wall-minus-work, so it returns no usable answer. | High | Change Group 1, tasks 1 to 4, land before the session. | Adversary, Architect, Profiler |
| 2 | The far-field fix reads as a win because the horizon stopped publishing, not because it got cheaper. | High | Serialize `applySuperseded` and horizon age, and require the two-part pass rule. | Adversary |
| 3 | A cold festival or woodland plan is still one unsplit unit of 15 to 30 ms on the M4, which could be a recurring hitch on the iPad. | High | Record the largest single unit, and split the plan only if the device shows the tail. | Profiler, Adversary |
| 4 | The older changes are recorded as accepted on a run that could not test them. | Medium | Rewrite the ROADMAP bullets as "no device before and after exists". | Adversary |
| 5 | Single runs per arm are compared without knowing how much the route varies on this device. | Medium | Run 3 repeats Auto and sets the noise floor. | Adversary |
| 6 | The council picks JavaScript levers for a device that is partly limited on the graphics side, or the reverse. | Medium | Run 2, plus wall-minus-work reported per rung. | Maverick |
| 7 | Timer overhead or whole-millisecond clock resolution on Safari distorts the section split. | Medium | About ten sections, per-window sums, and a desktop overhead check. | Profiler |
| 8 | The forced-Low run differs from detected Low in more than resolution, or the pre-render matrix timing doubles traversal under capture. | Medium | Tasks 1.7 and 1.9 settle both on the desktop before the session. | Mediator, from `bin/playtest-perf:33-34` and the Architect's unverified Three.js caveat |
| 9 | Low Power Mode, charging or thermal state differs between arms and fakes or hides a gain. | Low | Record the state once and keep it fixed through the session. | Adversary (downgraded in Round 2), Profiler |
| 10 | The fog-limit cull thins the visible skyline or shifts seeded draws. | Medium | Filter after seeded draws, use the subset fingerprint check, and capture Noon and Midnight on Low and Mid. | Profiler, Architect |
| 11 | Direct rendering creates new shader program variants each time Auto toggles bloom. | Medium | Program-count check before it is scheduled, plus its own deliberation gate. | Adversary |
| 12 | A frozen static subtree silently stops physics-moved or animated content. | Low while parked | Keep it parked, and require a check that covers physics-adopted props. | Adversary, Pragmatist |
| 13 | Deferred chunk disposal grows without bound, and iPad Safari terminates the tab under memory pressure. | Low while parked | A hard cap on pending disposals and a geometry and texture trend in the capture. | Adversary |
| 14 | A physics or population relaxation ships as tuning and changes protected behavior, or staggered updates make crowd results depend on frame rate. | Medium | Gary's explicit sign-off, and a determinism test at 30 and 60 FPS before design. | Profiler, Adversary, Maverick |
| 15 | One 641 m route does not represent dense hubs, where draws ranged from 469 to 1,270 across poses. | Medium | Treat the route verdict as one scene, and use the desktop census at several anchors. | Profiler |
| 16 | The Low budget of 80 draws makes "stop at green" unusable, so performance work has no agreed end. | Medium | An interim device-based stop condition, and Gary's recalibration decision. | Architect |

## What to stop doing

-   **Stop landing production performance changes before the next iPad run.** One unverified change sits on top of the November 8 baseline today, and a second would make the next run unattributable (Adversary Round 1 step 1).
-   **Stop scheduling a device session per change.** Batch the questions into one visit with a repeat built in (Maverick "What to stop doing").
-   **Stop desktop-only structural investigations and desktop micro-optimization as a route to iPad gains.** The November 7 round ended with no selected rewrite, and desktop numbers cannot establish a device result (briefing constraint 9; Pragmatist "Deferred / Cut").
-   **Stop accepting or rejecting iPad levers on FPS alone.** Use work p95 and wall-minus-work (Adversary Round 2 "Sharpened points").
-   **Stop treating the red HUD draw and triangle budgets on Low as a verdict** until they are recalibrated (Profiler "Things to stop doing"; `docs/backlog/performance.md:74`).
-   **Stop saying that resolution drops buy nothing on the iPad.** The within-phase data shows the opposite (Maverick Round 2 retraction). Equally, do not tune the ladder further, because it is already at its floor.
-   **Stop planning to use the people-frame tracer on the device.** It cannot run off `localhost` (`src/main.js:95-100`).
-   **Keep these parked**: Web Workers for worldgen, texture and mesh compression, chunk-builder splitting, cheaper terrain cache keys, the per-tier context-light pool, hidden-tab and audio scheduler work, and broad model merges (Pragmatist "Deferred / Cut"; Architect Round 1 step 7).

## Decisions only Gary can make

1.  **Physics on Low.** If the timer shows physics is the largest section, are you willing to lower the Low physics step rate or cap steps per frame? This relaxes simulation behavior (briefing constraint 10).
2.  **Population on Low.** If people or crowd dominates, are you willing to lower `crowdMax` (180 on Low, `src/perf.js:107`) or the child cohort, or to allow staggered updates for distant actors?
3.  **An Auto resolution hold.** This arises only if run 2 matches Auto. It would change what players see, and `ROADMAP.md:274` currently says to keep Auto as the shipping policy.
4.  **The Low HUD budget.** Recalibrate the 80-draw and 150k-triangle Low budget from device captures, or accept a device-based stop condition instead (charter Non-Negotiable 6 and Resolution Rule 4).
5.  **How to record the older device checks.** The council recommends the "no device before and after exists" wording. The alternative is a deliberate revert build and an extra session (Adversary Round 2 "Rebuttals").
6.  **Flipping the fog-limit cull to default-on**, after you have looked at the Noon and Midnight captures in the game.
7.  **Charter corrections** to Non-Negotiable 4 and the importmap wording, since the charter is yours to amend.
8.  **Whether the optional physics-off run is worth five more minutes** on the day.

## Gary-only device checklist

Budget about 20 to 30 minutes. Run 5 adds about five more.

**Before the first run (about five minutes)**

1.  Write down the iPad model from Settings, General, About (Model Name and Model Number).
2.  Note whether Low Power Mode is on (Settings, Battery), and leave it unchanged for the whole session.
3.  Note the battery percentage and whether the iPad is charging, and keep the charging state the same for every run.
4.  Note anything that affects heat, such as a case or a previous heavy app, and whether the iPad feels warm.
5.  Close other Safari tabs and background apps.
6.  Confirm the build is the frozen commit with a clean working tree.

**The runs (about three to four minutes each, including loading)**

1.  Run 1, default Auto on the November 8 route and seed.
2.  Run 2, locked baseline quality.
3.  Run 3, default Auto again.
4.  Run 4, far field off.
5.  Run 5, physics off, only if you have time.

For each run, wait for the capture to announce that the final report is saved before starting the next one, and keep the iPad in the same position and orientation.

**What to record alongside the captures**

-   Whether the horizon visibly popped in late or stayed stale while driving, in runs 1 and 3.
-   Anything that interrupted a run, such as a notification, a screen dim or an orientation change.
-   Whether the iPad felt warmer by the end, since run 2 renders at full Low resolution.
-   The battery percentage at the end.

## Where the orchestrator's pre-thinking stood up

The pre-deliberation notes in `orchestrator-prethinking.md` were read as one more non-binding input.

**Confirmed by the council**

-   The iPad has two separate problems, the far-field stalls and the steady frame rate, and the far-field fix has no device result (all five personas).
-   Roughly 13 ms of each frame is unattributed on the device, and attributing it gates everything else (point 1).
-   The iPad model is unknown and needs recording (point 5).
-   One batched session is the right shape, and desktop-only micro-optimization and more model merging are not worth further effort.
-   The fog-limit cull is worth doing, and a worldgen worker should wait for device evidence (levers 5 and 6).

**Overturned or narrowed by the council**

-   **"Auto is spending resolution to fix a CPU problem" (point 3) and the CPU-aware governor (lever 3)** did not survive. The Maverick's within-phase table shows frames shortening as resolution fell, and the orchestrator's own "Correction after Round 2" accepts this.
-   **"Vsync quantization explains the 30 FPS" (point 2)** is now a hypothesis. The Profiler withdrew the claim that wall values cluster on refresh multiples.
-   **"With the existing people-frame trace enabled"** is not possible on the device, because the tracer is limited to `localhost` (`src/main.js:95-100`).
-   **"One device session that answers three questions"** overstated what a run can accept. The November 8 baseline already contained the October 22, November 5 and November 6 changes (Adversary Round 2).
-   **Simulation level-of-detail for people (lever 2)** moved from second place to a conditional branch that needs Gary's sign-off and a frame-rate determinism test.
-   **"Resolution or bloom tuning is not worth more effort"** is half right. The ladder is at its floor, but graphics-side savings at the lowest rung remain possible (Maverick Round 2).
-   **Direct rendering and frozen static subtrees (lever 4)** are both conditional on the session, not scheduled.

## Verdicts Summary

| Persona | Key Concern (latest) | Verdict |
| --- | --- | --- |
| Profiler | The steady frame has two unmeasured pieces of similar weight, about 12 to 15 ms of untimed game work and about 8 to 10 ms of wall beyond the work, and the session is wasted unless it measures both and records power state. | Proceed with mitigations |
| Architect | The capture cannot attribute the steady frame on the device. The instrumentation must also cover physics, far-field supersession and wall-minus-work, and the far field has no capability spec. | Proceed with mitigations |
| Maverick | Every Round 1 position framed the iPad as CPU-bound, yet both captures show frames shortening as resolution falls, so the graphics-side share must be measured before levers are chosen. | Proceed with mitigations |
| Adversary | The next session can mislead in three ways: accepting older changes against a baseline that already held them, closing the far-field item while the horizon has stopped publishing, and comparing single runs with no noise floor. | Proceed with mitigations |
| Pragmatist | Building any new optimization before one well-instrumented iPad capture risks spending Gary's scarcest resource on the wrong thing. | Proceed with mitigations |
