## The Maverick's Order of Operations

**TL/DR.** The iPad's everyday problem is not the stalls, and it is not pixels.
On the iPad, ordinary frames spend about 22 to 27 ms of main-thread work, which
on a 60 Hz display lands the game on a roughly 30 FPS cadence no matter how small
the canvas gets. Auto's quality ladder only has GPU rungs (resolution, bloom,
shadows), and its p95 trigger fires at 33 ms, so on a CPU-bound device it walks
all the way down to `pixel-50` and makes the game look worse while buying
nothing measurable. My recommendation is to spend Gary's next iPad session on
one batched capture that both validates the four pending fixes and answers the
"CPU or GPU?" question directly, then to aim the next code work at main-thread
CPU (static matrix traversal and the unattributed ~13 ms), and to stop paying
for resolution drops that do not move FPS.

### Priority Sequence

1. **Reframe the target as main-thread work per ordinary frame, not stalls or
   resolution.** The November 8 fixed-route report shows parked frames whose
   worst work was 27 ms with a median of 29 FPS, and ordinary driving frames at
   22 to 25 ms of work with only 0 to 2 ms in world update and 5 to 9 ms in
   render (`verification/performance/2026-11-08-ipad-child-density/baseline-report.txt`,
   phase table and "Worst frames" list). Frames of 22 to 27 ms cannot fit a
   16.7 ms vsync, so they settle at about two vsyncs, which matches the observed
   25 to 29 FPS medians. The stalls are real but intermittent; the 30 FPS cadence
   is what a player feels every second. The scheduler is plain
   `requestAnimationFrame` (`src/main.js:1965-1968`), so there is no pacing
   layer hiding this.

2. **Before Gary's next device session, add capture-only timers for the
   non-world, non-render slice of `tickBody`, then run one batched session on
   current `main`.** The backlog already names "Attribute iPad game-update time"
   as measurement-only (`docs/backlog/performance.md:131`), and the existing
   `peopleFrameTrace` cannot help on the iPad because it is gated to
   `localhost`/`127.0.0.1` (`src/main.js:95`). The world timer already has
   per-part splits (`src/main.js:1205-1207`, `createWorldTimings`), so the same
   pattern can wrap the crowd, children, physics, bubbles and camera sections.
   The batched session should be three short fixed-route autopilot runs on the
   same build:
   * Auto (the default), which simultaneously serves as the device acceptance
     run for the November 11 far-field fix, November 6 terrain, November 5
     child pooling and October 22 registry work, all of which are merged and
     all of which are separately waiting on a device (`ROADMAP.md`
     "Performance", first, third, fourth and sixth bullets).
   * `perfQuality=sustained` (`src/perfTelemetry.js:31`; the p95 trigger is
     disabled under that policy at `src/adaptiveQuality.js:215`). If Sustained
     holds a higher pixel ratio at the same FPS, the device is CPU-bound and
     Auto's resolution rungs are pure visual loss there.
   * `farField=0` (`src/perf.js:84-88`, the documented one-variable A/B
     control), which bounds the far field's steady draw and CPU share.
   This replaces four separate acceptance sessions with one, and it is the
   cheapest way to respect the fact that Gary's device time is the scarcest
   resource (briefing constraint 11).

3. **Stop letting Auto trade resolution for nothing on a CPU-bound device.**
   Every rung in the ladder is a GPU-side knob
   (`src/adaptiveQuality.js:70-78`), the drop trigger is p95 above 33 ms
   (`src/adaptiveQuality.js:53`), and a device stuck at two-vsync cadence has a
   p95 near 58 to 60 ms (`baseline-report.txt`, parked and drive rows), so Auto
   is structurally guaranteed to bottom out. The evidence that this buys nothing
   already exists twice: the November 8 iPad run reached `pixel-50` and its
   parked FPS went from 29 before to 26 after (same report), and the October 22
   phone pair recorded Auto at `pixel-50` with a median of 57 FPS against
   Sustained at 1.09 to 1.25 DPR with a median of 58
   (`docs/backlog/performance.md:78`). The November 7 iPad bundle itself warns
   that "further resolution-only tuning cannot be presumed to solve" the problem
   (`verification/performance/2026-11-07-ipad/README.md:110-112`). If step 2's
   Sustained run confirms it on the iPad, add a CPU-bound guard: when capture
   timing shows work explains the frame interval, Auto should hold its
   resolution rung instead of descending. This is a small, local change in one
   module, and it is the only item on this list that makes the game visibly
   better on the iPad on day one.

4. **Attack the largest named main-thread row: static scene-graph matrix
   traversal.** In the Low route desktop profile, scene-wide `updateMatrixWorld`
   self time is the biggest named row in the residual triage at 2,252 ms,
   larger than the entire child update (1,686 ms) and adult `_writeMatrices`
   (924 ms) (`verification/performance/2026-11-07-structural-options/residual-cost-triage.md`,
   rank 3 and rank 1 rows). The backlog records it as about 5% of sampled CPU
   across roughly 7,700 nodes and notes that the November 7 probe froze only 74
   booth meshes, which is why it did not move (`docs/backlog/performance.md:127`).
   Freezing whole static chunk subtrees is the honest version of that test. The
   November 11 bundle infers that the iPad runs CPU work about three times
   slower than the M4 (`verification/performance/2026-11-11-far-field-publication/README.md:96`),
   so a desktop row of this size is plausibly several milliseconds per frame on
   the device. The risk is real (animated children inside a frozen branch stop
   moving), so this needs a node-count census and a "nothing animated lives in a
   frozen subtree" check, and the exact r160 traversal semantics must be read
   from the pinned source before design, because `node_modules` is absent in
   this checkout and I could not confirm them here.

5. **Cull the horizon at the fog limit, as a cheap draw and CPU cut.** More
   than half of the kept Low far-field instances sat beyond the 520 m opaque
   fog distance, with canopies to 1,508 m
   (`verification/performance/2026-11-11-far-field-publication/README.md:103`),
   and Low's `cameraFar` is 1,040 m (`src/perf.js:116`). The Nov 8 route ran at
   a median of about 1,023 draws against a Low HUD budget of 80
   (`baseline-report.txt`, draws column), so anything invisible that still
   submits is worth removing. This is low-risk because fog already hides the
   content, but it changes the published set, so it needs Noon and Midnight
   screenshots on Low and Mid, as the roadmap says (`ROADMAP.md` "Decide whether
   the horizon should stop at the fog limit").

6. **Only after step 2, pick the next lever from the new 13 ms breakdown.** If
   the children solver or adult publication dominates on the device, the
   minimum discriminators are already written down
   (`residual-cost-triage.md`, ranks 1 and 2). If physics dominates, that is a
   new finding that no prior bundle has measured.

**What to stop doing.**
* Stop scheduling GPU-only candidates for the iPad before the Sustained A/B.
  "Render directly when bloom and Trip are off" and the per-tier context-light
  pool (`docs/backlog/performance.md:125-126`) both save fragment or full-screen
  work, which at a 675 × 462 target on a CPU-bound device is probably the wrong
  resource. Keep them queued for Mid/High desktops.
* Stop running separate device acceptance sessions per change. Four merged
  changes are waiting; one Auto run on `main` covers them.
* Stop desktop-only structural investigations of the November 7 kind. Two
  councils and several thousand measured renders ended with no selected rewrite
  (`verification/performance/2026-11-07-structural-options/README.md:3-8`),
  and the gap was device attribution, not ideas.

### Alternative Approach

**Make "CPU-bound Low" an explicit profile instead of letting a GPU governor
discover it.** Rather than adding more cleverness to Auto, treat the iPad case
as a known shape: hold resolution at the Sustained floor (about 1.1 DPR, the
value the October 22 phone held without losing FPS) and spend the governor's
effort on main-thread work instead. Concretely, the ladder would gain CPU rungs
below `pixel-75`, such as reduced far-field density (`densityMul` already exists
per tier at `src/perf.js:143`) and staggered updates for distant non-player
actors (for example, distant adults and birds updating every other frame with a
doubled `dt`), while the player, camera, near crowd and physics stay
every-frame.

*   **Value**: It turns the bottom of Auto from "blurrier and still 30 FPS" into
    "sharp and cheaper per frame", and it gives the governor a lever that can
    actually cross the 16.7 ms line on a device like this one. It also scales
    to every future CPU-limited phone, not just this iPad.
*   **Risk**: Staggered actor updates explicitly relax the simulation protection
    that the November 7 investigation treated as fixed (briefing constraint 10).
    I am proposing that relaxation openly, limited to actors beyond a distance
    threshold and only on the lowest rung. Crowd behavior must not consume
    seeded RNG in a frame-count-dependent way, or determinism (Non-Negotiable 1)
    would break; that has to be checked against `src/crowd.js` and
    `src/people/children.js` before any design. Lowering far-field density
    changes the horizon's look and needs Noon and Midnight review.
*   **Effort**: Larger than step 3 alone, roughly comparable to step 4. It
    should not start until the step 2 capture shows where the ~13 ms goes,
    because a CPU rung that targets the wrong subsystem is the same mistake as a
    resolution rung on a CPU-bound device.

### Risks and Honest Limits

* The CPU-bound reading rests on frame arithmetic (work above 16.7 ms implies
  two-vsync cadence) plus two observations that resolution drops did not raise
  FPS. Safari offers no GPU timer in these captures, so a GPU contribution is
  not excluded; that is exactly why the Sustained run in step 2 comes before the
  Auto change in step 3.
* The 3x iPad-to-M4 ratio is an inference recorded in the November 11 bundle,
  not a measurement, so step 4's device payoff is a hypothesis.
* The iPad's hardware model is unknown
  (`verification/performance/2026-11-08-ipad-child-density/README.md:20-22`), so
  a change tuned on it may not generalize to other iPads.

### Verdict

-   **Verdict**: Proceed with mitigations
-   **Key Concern**: Auto is spending the iPad's visual quality on a GPU ladder
    while the evidence points to a CPU-bound 30 FPS cadence, and every pending
    candidate is being queued without the one device run (Auto versus Sustained
    plus a subsystem split of the unattributed ~13 ms) that would tell us which
    resource to spend effort on.
-   **Recommendation**: Instrument the non-world tick sections, then batch one
    iPad session (Auto, Sustained, `farField=0`) on current `main` that doubles
    as acceptance for four merged changes. If Sustained matches Auto's FPS, add
    a CPU-bound guard to Auto, then pursue static-subtree matrix freezing and the
    fog-limit horizon cull. Defer GPU-side candidates for the iPad until the
    device says GPU matters.

## Round 2 — Reactions

**TL/DR.** I have to retract the central claim of my Round 1, and the data that
refutes it was already sitting in both iPad captures. When the iPad was parked
at the same spot with the same draw count, every step down in resolution made
frames shorter, by about 10 ms in total, while main-thread work stayed flat.
That means Auto's resolution rungs were working on this iPad, the device is
limited by GPU or compositor time at higher resolutions, and my proposed
"CPU-bound guard" would have made the game slower. Two other personas share
the same "resolution does nothing" conclusion and need the same correction. The
Adversary's "wall-minus-work" point is right, and it now matters more than the
gap inside the JavaScript work.

### The finding that changes the debate (checked against the raw captures)

I grouped the per-second `frame` windows in both raw captures by phase and
quality rung (fields `quality`, `pixelRatio`, `frame.wallP50`,
`frame.workP95` and `draws` in
`verification/performance/2026-11-08-ipad-child-density/baseline-capture.json`
and `verification/performance/2026-11-07-ipad/capture.json`). These are means
of per-second medians, so they describe the trend rather than give exact frame
costs.

| Capture, parked phase | Rung (DPR) | Windows | Mean wall p50 | Mean work p95 | Mean draws |
| --- | --- | ---: | ---: | ---: | ---: |
| Nov 8 | `no-bloom` (1.1) | 3 | 41.0 ms | 23.0 ms | 1,027 |
| Nov 8 | `pixel-75` (0.9) | 6 | 37.0 ms | 22.2 ms | 1,025 |
| Nov 8 | `pixel-50` (0.6) | 16 | 30.9 ms | 22.0 ms | 1,021 |
| Nov 7 | `no-bloom` (1.1) | 2 | 36.5 ms | 20.5 ms | 516 |
| Nov 7 | `pixel-75` (0.9) | 5 | 33.6 ms | 20.6 ms | 517 |
| Nov 7 | `pixel-50` (0.6) | 18 | 27.0 ms | 18.7 ms | 515 |

The car was parked, the draw count held steady to within about 1%, and
JavaScript work did not change, yet the frame interval fell steadily on both
devices runs as resolution fell. This is the closest thing to a one-variable
test that exists, and it shows the same direction twice. The window counts at
1.1 DPR are small (two and three), so I would not quote the exact millisecond
gain, but the direction is not in doubt. Two consequences follow:

1. **At 1.1 DPR the iPad needs more than two vsyncs per frame (41 ms) even
   though work p95 is 23 ms.** Something outside the timed JavaScript, most
   plausibly Safari's GPU process doing fill and full-screen pass work, is the
   binding cost at the higher rungs.
2. **At `pixel-50` the wall time (27 to 31 ms) and the work time (19 to 22 ms)
   are close but not equal.** That fits a device where GPU and CPU limits
   overlap at the floor. The median wall of 27 ms on Nov 7 is not a multiple of
   16.7 ms, so my Round 1 "two-vsync quantization" arithmetic was too tidy.
   Either the display is not a fixed 60 Hz (ProMotion or a power-state cap) or
   frames alternate between one and two intervals. Neither capture records the
   display rate.

### Reactions to specific claims

**On my own Round 1 (retraction).** My step 3 said Auto "buys nothing
measurable" and cited the Nov 8 parked FPS going "from 29 before to 26 after."
That comparison spans two phases at different poses with draws rising from
1,023 to 1,265 (table above and `baseline-report.txt`), so it confounds
resolution with content. Within one phase at one pose, resolution clearly helped.
The October 22 phone result (`docs/backlog/performance.md:78`) is a different
device and does not carry over. **I withdraw the CPU-bound guard, the
"hold DPR near 1.1" Alternative Approach and the "stop GPU-only candidates"
item.** Holding 1.1 DPR on this iPad would have cost about 10 ms per frame.

**Profiler, Evidence base point 1: "Steady-state FPS follows main-thread work,
not resolution" and "no fill-rate lever has yet been shown to help on this
device."** *Rebut, with the same data.* The Profiler cites the pixel ratio
moving from 1.1 to 0.6 while "parked FPS fell from 29 to 26," which is the
same cross-phase comparison I made. The within-phase windows show the opposite.
The Profiler's general observation that wall time sits near the next vsync
multiple above work is true at `pixel-50` but false at 1.1 DPR, where wall is
41 ms against work of 23 ms. *Sharpen:* the Profiler's step 2(b), a locked
`perfQuality=baseline` run, now has a predictable answer (slower), so it would
spend a run of Gary's session confirming what both captures already show. I
also recommended a Sustained arm, and I am dropping it for the same reason.

**Profiler, step 4: "the goal of getting parked work p95 under about 16 ms"
because "it moves the frame from 2 vsyncs to 1."** *Sharpen.* That reasoning
only holds if the GPU side also fits in 16.7 ms at `pixel-50`, and the 27 to
31 ms walls against 19 to 22 ms work say we do not know that. Cutting CPU work
alone may not change the frame interval at all. The step 2 session must measure
both limits before a CPU target is set.

**Adversary, Vulnerabilities, first bullet: "The median frame interval exceeds
the 95th-percentile JavaScript work in every row... there is a second and
larger gap, between the work and the wall clock, that no current candidate
addresses."** *Agree, and this is the strongest argument in Round 2.* The
rung table above adds the mechanism the Adversary could not prove: the
wall-minus-work gap shrinks as resolution shrinks (Nov 8: 18, 15, then 9 ms),
which points to GPU or compositor work rather than a JavaScript blind spot.
The Adversary's proposal to report wall-minus-work as a first-class metric
(step 2) is correct, and it should be reported per quality rung, not just per
phase. A plain JavaScript timer in `tickBody` cannot see this gap at all.

**Adversary, step 6: "Tuning the resolution ladder for the iPad... The iPad is
therefore paying for a blurry 675×462 image without getting the frames back."**
*Rebut in part.* The ladder is exhausted, so "don't tune it further" holds,
but the frames did come back, about 10 ms of them. The right conclusion is the
opposite of what the Adversary, Profiler and I wrote: at the floor the iPad
is still partly GPU-bound, so GPU-side savings at `pixel-50` remain on the
table.

**Adversary, Vulnerabilities, physics bullet: physics runs outside both timers,
`FixedStepClock` takes "up to 5 per call," and `liveWorld` already tracks
`meanStepMs` and `maxStepMs`.** *Agree; I verified it.* `maxSteps = 5` is the
default at `src/physics/fixedStep.js:3`, `physicalWorld.advance(...)` runs at
`src/main.js:1288` outside the world timer, and `playerResidency.meanStepMs`
and `maxStepMs` are in `stats()` at `src/physics/liveWorld.js:342`. My Round 1
said physics domination would be "a new finding," and the Adversary has
turned that into a cheap test. The `physics=0` arm is a better use of a
session slot than the Sustained arm I proposed.

**Adversary, step 1: "Freeze production performance changes until the next iPad
run."** *Agree.* This matches my "one batched session" goal and states the
rule I left implicit. Capture-only instrumentation stays allowed, as the
Adversary's own step 2 says.

**Adversary, Vulnerabilities, power-state bullet.** *Agree and extend.* The
27 ms wall finding makes the display refresh rate a required field alongside
Low Power Mode and charging state. Without it, nobody can tell whether a
change crossed a vsync boundary.

**Adversary, Vulnerabilities, "The November 11 fix can look like a win because
the work stopped happening."** *Agree.* Serializing `applySuperseded` and the
horizon's age is cheap and closes a real false-positive path. I did not see it
in Round 1.

**Pragmatist, Deferred/Cut, and Adversary, freezing bullet, on static subtree
freezing ("about 5% of sampled desktop CPU," "the failure mode is silent").**
*Concede.* My step 4 rested on the iPad being CPU-bound, and the rung table
shows it is at least partly GPU-bound. The Adversary also points out that chunk
groups now contain physics-moved camp chairs (`docs/backlog/performance.md:112`),
which raises the silent-freeze risk. I move it behind the device attribution.

**Pragmatist, step 4b: "Direct render when bloom and Trip are both off... expect
a modest gain."** *Sharpen, upward.* In Round 1 I called this "probably the
wrong resource." The rung table shows the iPad's frame interval responds to
pixel-proportional work even at `pixel-50`, and this candidate removes a
half-float target write plus FXAA and `OutputPass` full-screen work on exactly
the rung the iPad lives on (`docs/backlog/performance.md:125`). It is now my
first GPU-side candidate. The Adversary's program-churn gate (`programCount`
before and after toggling) and the Architect's `render-pipeline` spec-delta
note are the right preconditions, and the first-use preparation pattern from
October 22 should cover any new variants.

**Architect, step 4: "The evidence so far points away from the GPU... That
makes further resolution tuning a poor bet."** *Rebut in part* for the same
reason as above. The Architect's decision rule is otherwise sound, and its
render-CPU branch already names draw count and the direct-render path, so it
needs a GPU branch added rather than rewritten.

**Architect, Structural Risks: `registry.rebuildSpatialIndex()` runs every frame
and walks every entry.** *Agree it should be timed.* I confirmed the call at
`src/main.js:1477`. It belongs in the coarse `tickBody` sections that the
Architect, Profiler, Pragmatist and I all proposed.

**Profiler, Pragmatist and Architect on the fog-limit horizon cull.** *Agree,
and it gains weight.* It cuts draws and vertex work, which matter if the GPU
side is binding, as well as publication cost. All four of us rank it as the
first structural change after the session, which is real convergence rather
than politeness.

**Profiler, step 5: the November 7 shopkeeper rejection "should not be treated
as final for the iPad."** *Agree.* It was judged on desktop work time, and the
iPad now shows that non-JavaScript time dominates at higher rungs. Draw
reductions that looked worthless on the M4 could matter on this device.

### Revised Verdict (only if it changed)

-   **Verdict**: Proceed with mitigations (unchanged).
-   **Key Concern (revised)**: Every Round 1 position, including mine, framed
    the iPad as CPU-bound, but both captures show the frame interval falling
    by about 10 ms as resolution falls at constant draws and constant work.
    The next session must measure the non-JavaScript share of the frame
    (wall-minus-work per rung, display rate and power state) alongside the
    JavaScript split, or the council will pick CPU levers for a device that
    is partly GPU-bound.
-   **Recommendation (revised)**: Keep Auto's ladder as it is. Instrument both
    sides of the frame, run one frozen-build session (Auto twice, `physics=0`
    twice, with `farField=0` only if time remains), then lead with the
    fog-limit cull and the direct-render path, choosing CPU levers only if
    the new split shows the JavaScript side binding at `pixel-50`.

### Where I now stand on the order of operations

1. **Freeze production performance changes** until the next iPad session (the
   Adversary's step 1).
2. **Capture-only instrumentation, built and checked on desktop:** coarse
   `tickBody` sections (physics advance plus steps per frame, people and crowd,
   `rebuildSpatialIndex`, camera, context lights, HUD); wall-minus-work per
   phase and per quality rung; far-field `applySuperseded` and horizon age;
   Low Power Mode, charging state and display refresh rate.
3. **One iPad session on the fixed November 8 route:** Auto, `physics=0`, Auto,
   `physics=0`, which also serves as acceptance for the October 22, November 5,
   November 6 and November 11 changes. Add `farField=0` only if Gary has time
   left. Drop the Sustained and locked-baseline arms, because both captures
   already show what they would find.
4. **The fog-limit horizon cull**, behind an A/B flag, gated on Noon and
   Midnight screenshots on Low and Mid and a deliberately re-based fingerprint.
5. **The direct-render path when bloom and Trip are off**, gated on a
   `programCount` check across rung toggles and a `render-pipeline` spec delta.
6. **CPU levers (physics step on Low, people work, static subtree freezing) only
   if step 3 shows the JavaScript side binding at `pixel-50`.** A physics or
   population change is a constraint 10 relaxation that needs Gary's explicit
   sign-off.
