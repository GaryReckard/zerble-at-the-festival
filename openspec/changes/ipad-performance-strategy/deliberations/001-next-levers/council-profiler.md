## The Profiler's Order of Operations

**TL/DR.** The iPad has two separate problems, and they need different fixes.
The first is the **driving stall**: occasional 120 to 450 ms frames that come
almost entirely from far-field work. The November 11 change targets that
directly, but nobody has run it on the iPad yet. The second is the
**steady frame rate**: the iPad sits at roughly 25 to 30 FPS even when parked.
The captures show this is a **main-thread CPU problem, not a GPU or resolution
problem**. Per-frame work runs at about 20 to 26 ms, and on a 60 Hz display
anything over 16.7 ms is rounded down to 30 FPS. Auto has already dropped
resolution to its lowest rung without fixing it, and about 12 to 15 ms of that
work happens in code the capture does not time at all. My recommendation is to
make the next iPad session do three jobs at once: confirm the far-field fix,
time the untimed half of the frame, and run a one-variable test of whether
resolution matters. Only after that should anything else get built. The
cheapest structural candidate the evidence supports is to stop placing horizon
instances beyond the fog limit.

### Evidence base (what the iPad numbers actually say)

I computed per-phase medians from the raw captures, using the per-second
`frame` windows in `baseline-capture.json` (November 8) and `capture.json`
(November 7).

| Capture / phase | wall p50 (ms) | work p95 (ms) | render max (ms) | world max (ms) | draws | tris | NPCs | quality |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Nov 8 parked | 32 | 22 | 8 | 1 | 1,023 | 515k | 119 | pixel-75 → pixel-50 |
| Nov 8 drive | 36 | 32 | 9 | 16 | 1,025 | 596k | 164 | pixel-50 |
| Nov 8 parked-after | 36 | 26 | 10 | 1 | 1,270 | 628k | 152 | pixel-50 |
| Nov 7 parked | 27 | 19 | 6 | 1 | 514 | 420k | 109 | pixel-75 → pixel-50 |
| Nov 7 drive | 31 | 29 | 8 | 15 | 710 | 444k | 121 | pixel-50 |
| Nov 7 parked-after | 22 | 15.5 | 6 | 1 | 469 | 423k | 93 | pixel-50 |

What this table establishes:

1. **Steady-state FPS follows main-thread work, not resolution.** In every
   phase the median wall time sits on or near the next 16.7 ms vsync multiple
   above work p95. The only phase where work dropped below about 16 ms
   (Nov 7 parked-after, 15.5 ms) is also the only one with a wall p50 well
   under 33 ms (22 ms). On November 8, Auto moved the pixel ratio from 1.1 to
   0.6 during the parked phases (`baseline-report.txt`, "CHECK: pixel ratio
   changed across comparison phases"), yet parked FPS fell from 29 to 26
   (`2026-11-08-ipad-child-density/README.md:24`). This correlation does not
   prove causation, but it means no fill-rate lever has yet been shown to
   help on this device.
2. **The render timer is only a third of the work.** Render max is 6 to 10 ms
   and world max is 1 ms when parked, while work p95 is 19 to 26 ms. The
   remainder, about 12 to 15 ms, is in `tickBody` code between
   `src/main.js:1239` and `src/main.js:1940` that the capture does not time.
   That code includes the Rapier `physicalWorld.advance` (`src/main.js:1288`),
   people and crowd updates, collisions (`src/main.js:1808-1829`),
   `chaseCam`, `ContextLights.update` (`src/main.js:1917`), `AdaptiveQuality.tick`
   and HUD writes. The backlog already lists this gap
   (`docs/backlog/performance.md:131`).
3. **The tool meant to attribute that gap cannot run on the iPad.**
   `peopleFrameTrace` and `peopleBaseline` only activate when the hostname is
   `localhost` or `127.0.0.1` (`src/main.js:95-99`). The iPad loads the game
   over the LAN, so the backlog's suggested method of a people-frame trace on
   the device does not work as written. A capture-gated timer shaped like
   `createWorldTimings` (`src/main.js:1206-1207`) is needed instead.
4. **Work scales with scene content, so content size matters more than
   pixel count.** Within the same build and quality rung, the November 8 run
   went from 1,023 draws and 119 NPCs (work 22 ms) to 1,270 draws and 152 NPCs
   (work 26 ms). November 7 at 469 to 514 draws ran 4 to 10 ms cheaper. The
   charter's profiler note already says the engine is draw-bound and that
   density knobs matter more than fill-rate knobs (`openspec/council/charter.md:226-228`).
   Draws are 6 to 16 times the Low HUD budget of 80, and triangles are 3 to
   4 times the 150k budget (`src/perf.js` TABLE `low`), although that budget is
   flagged as stale (`docs/backlog/performance.md:74`).
5. **Every large driving stall is far-field publication.** All seven of the
   largest retained November 8 driving world intervals were `farField`
   (424, 323, 154, 136, 122, 120, 119 ms), plus 1,421 ms during settling
   (`baseline-report.txt`, "Largest retained world-update frames"). Ordinary
   chunk generation peaked at 41 ms (`cgWorst`, sample at `t=41.6`). The
   November 11 change moved the worst offline call from 61 to 176 ms down to
   3 to 33 ms on an M4 (`2026-11-11-far-field-publication/README.md:74-85`).
   It still leaves an indivisible cold-plan unit of 15 to 30 ms on the M4
   (`README.md:87-92`). The README's own rough estimate is that the iPad is
   about 3 times slower (`README.md:96`), which would put that unit at roughly
   45 to 90 ms. That is an inference, not a measurement.

### Priority Sequence

1. **Build one diagnostic-ready iPad build before Gary touches the device
   (no device time yet).** Add a capture-gated timer for the parts of
   `tickBody` that sit outside world and render, following the existing
   `_perfWorldParts` pattern: physical advance, people/crowd, collisions,
   bubbles/StarPower, camera and audio listener, context lights, adaptive
   quality, HUD, and the capture's own overhead. It must not use the
   loopback-only trace (`src/main.js:95`). Also extend `ffCold`, or add a
   sibling counter, so it records the largest single far-field publication or
   grounding unit. The current counter only covers planning steps
   (`2026-11-08-ipad-child-density/README.md:32-36`). *Justification:* these
   are the two unknowns that decide whether every later item is worth doing,
   and neither can be resolved off-device (Non-Negotiable 9).
2. **Run one iPad session of three fixed-route runs on that same build, about
   six minutes of Gary's time in total.**
   (a) Auto on the November 8 route and seed. This verifies the November 11
   far-field fix against the 424 ms baseline and records game-part timings.
   (b) The same route with `perfQuality=baseline`, which locks quality to
   level 0 (`src/adaptiveQuality.js:38,437,470`). This is the one-variable
   test of whether resolution affects FPS on this iPad. If work and wall
   match run (a), Auto is lowering image quality for no gain.
   (c) The same route with `farField=0` (`src/perf.js` `resolveFarField`).
   This measures the horizon's steady per-frame cost in draws, triangles and
   work, not just its stalls.
   *Justification:* the October 22 phone pair already showed Sustained
   matching Auto (58 vs 57 FPS, `docs/backlog/performance.md:78`), so the
   resolution question is plausible and cheap to settle. Batching all three
   runs into one session respects Constraint 11.
3. **Cull far-field instances beyond the fog limit, after step 2 and only if
   the far-field tail or its steady cost remains visible.** More than half of
   the kept Low instances sat beyond the 520 m fog-opaque distance, with
   canopies reaching 1,508 m (`2026-11-11-far-field-publication/README.md:103`).
   Those instances pay terrain grounding during publication and vertex work
   every frame while rendering only fog color. *Justification:* it is the one
   candidate that reduces both the stall and the steady load. Its acceptance
   check is the existing fingerprint harness, with a deliberately new
   baseline, plus Noon and Midnight screenshots. Apply the cull as a filter
   after planning so no `rng()` draw order changes (Non-Negotiable 1).
4. **Attack whichever main-loop part step 2 identifies as largest, with a goal
   of getting parked work p95 under about 16 ms on the iPad.** The evidence
   suggests that crossing this line is worth more than any other single
   change, because it moves the frame from 2 vsyncs to 1 (compare Nov 7
   parked-after at 22 ms wall with every other phase). Candidates depend on
   the measurement. If physics dominates, look at the Rapier step rate or
   body count. If people/crowd dominates, look at a Low `crowdMax` or
   child-cohort reduction (the half cohort fixture already exists,
   `2026-11-08-ipad-child-density/README.md:40-44`), which counts as relaxing
   population and must be justified under Constraint 10. If the render CPU
   time dominates, prioritise draw reduction (step 5).
5. **Draw-count reduction on Low, using the device numbers rather than
   desktop render timing.** The November 7 shopkeeper batching cut 63 to 128
   Low draws but was judged on desktop work time
   (`2026-11-07-structural-options/README.md`, "Spatial shopkeeper part
   submission"). Per-draw CPU cost in Safari's WebGL is a device fact that
   the M4 cannot stand in for (Non-Negotiable 9), so that rejection should
   not be treated as final for the iPad. Run `__dbg.drawCensus`
   (`src/main.js:2691`) at the November 8 parked-after pose, where draws were
   1,270, and reconsider the largest repeated contributors once step 2
   confirms that render CPU is a meaningful share.
6. **Change the Auto governor only after step 2(b).** If the locked-baseline
   run matches Auto's FPS, Auto should stop descending resolution rungs when
   frames are CPU-bound, for example when work time is already close to wall
   time. Resolution should only drop when there is evidence the GPU is the
   constraint. This is a player-visible image-quality improvement at no
   frame-rate cost, but it should not ship on inference.
7. **Defer chunk-unload budgeting, lake deadlines, terrain cache keys, the
   direct-render path and context-light pools.** None of them appears in the
   iPad's largest intervals. Ordinary chunk work reached 41 ms against
   far-field's 424 ms, and at 675×462 a direct render would remove a
   full-screen pass over very few pixels. Revisit any of them only if the
   step 2 data points at it.

### Things to stop doing

-   **Stop treating resolution as the iPad's lever.** Auto had already reached
    its floor in every driving sample on both captures (`2026-11-07-ipad/README.md:57-61`).
    Fill-rate work cannot recover a frame that is CPU-bound.
-   **Stop scoring device-facing candidates on desktop render timing alone.**
    The November 7 nomination threshold was a 1 ms desktop saving. On a device
    that is 4 to 9 ms short of the next vsync boundary, a draw cut has to be
    re-measured where it matters.
-   **Stop reading the HUD's red draw and triangle budgets as a verdict.** They
    are stale (`docs/backlog/performance.md:74`). Use work p95 against 16.7 ms
    as the iPad's real budget line.

### Performance Risks Identified

| Risk | Type | Severity | Trigger Condition |
| --- | --- | --- | --- |
| The November 11 far-field fix leaves a 15–30 ms (M4) cold festival or woodland plan as one unsplit unit, plausibly 45–90 ms on the iPad by the README's ~3× inference | Latency | High | First approach to unplanned terrain while driving; `2026-11-11-far-field-publication/README.md:87-96` |
| Far-field publication now trails cell crossings by several frames and stalls further if the streaming remainder stays at zero | Latency (visual pop / stale horizon) | Medium | Dense chunk admission consumes the whole 3 ms Low `chunkBudgetMs`; `README.md:99` |
| Steady main-loop work of 20–26 ms quantizes to 30 FPS on 60 Hz; 12–15 ms of it is untimed | Latency | High | Every frame at current Low density; per-phase table above |
| Auto lowers resolution in response to CPU-bound frames, costing image quality with no measured FPS gain | Latency / UX | Medium | Any iPad session under Auto; Nov 8 parked FPS 29 → 26 across a pixel ratio of 1.1 → 0.6 |
| Diagnostic timers add their own overhead, and `performance.now()` resolution on Safari is coarse (the capture reports whole milliseconds) | Measurement | Medium | Many small timed sections summed per frame; keep the section count small and report the capture's own overhead |
| Content load grows with location (draws 469 → 1,270 across poses), so a single-route verdict may not represent dense hubs | Load variance | Medium | Seeds or routes passing several stages and vendor rows; fixed route `device-road-follow-v1` covers 641 m |
| A fog-limit cull changes the published horizon set and could thin the visible skyline near 520 m | Visual regression | Low | The cull radius is set tighter than the fog's opaque distance; needs Noon/Midnight captures |
| Reducing Low `crowdMax` or the child cohort relaxes protected population behavior | Policy | Medium | Chosen in step 4 without device proof that people/crowd dominates; Constraint 10 |

### Load Estimates

-   **Per-Request (per-frame) Impact**: The current parked iPad work is about
    20–26 ms per frame (p95), of which render CPU is 6–10 ms and world 1 ms.
    Step 1's timers should add well under 0.5 ms if they are limited to about
    10 `performance.now()` pairs per frame. That is an estimate and must be
    confirmed by comparing the same route with and without the flag. The
    target is a parked work p95 of 16 ms or less, a cut of roughly 4–10 ms.
-   **Bulk Operation Scale**: On November 8 the iPad route generated 25
    ordinary chunks over 641 m, with per-chunk maxima of 41 ms. The far-field
    holds about 1,004 active instances with a reported overflow of 1,092
    (`ffActive` and `ffOverflow` in the sample at `t=41.6`), and on the M4 the
    planner considered about 2,400 Low candidates per anchor
    (`2026-11-11-far-field-publication/README.md:22`). Over half of the kept
    instances lie beyond 520 m, so a fog-limit cull should roughly halve
    grounding work on newly revealed terrain at that pose. That is one seed and
    one pose, and the share will vary.
-   **Memory Ceiling**: The far-field road memo is bounded at 768 polylines and
    discarded when the terrain generation changes (`README.md:36-41`). The
    terrain caches filled by `prepareTerrainArea` grow with distance travelled,
    and their retention policy is not documented in the evidence I read. Gary
    should record `heapMB` (currently `null` on Safari, per the sample) or the
    cache sizes over a long drive before anyone assumes it is bounded. Physical
    iPad memory pressure has never been captured.

### Verdict

-   **Verdict**: Proceed with mitigations
-   **Key Concern**: The iPad's steady frame rate is limited by main-thread
    work of about 20–26 ms per frame, roughly half of which the capture does
    not time and whose existing trace tool cannot run on a LAN device
    (`src/main.js:95`). Any optimization picked before that is attributed on
    the device is a guess, and the resolution rungs Auto keeps spending have
    already shown no measurable return.
-   **Recommendation**: Spend Gary's next iPad session on one build that
    combines the November 11 far-field verification, a device-capable timer
    for game-update parts, and a locked-quality and far-field-off A/B on the
    fixed route. Then cull far-field instances beyond the fog limit and attack
    whichever main-loop part is measured as the largest, aiming for work under
    16.7 ms per frame. Defer the remaining unmeasured backlog candidates until
    that data points at them.

## Round 2 — Reactions

**TL/DR.** Two arguments from Round 2 moved me. The Adversary is right that the
frame-time gap between JavaScript work and wall-clock time is real, and that my
Round 1 "it is just vsync rounding" explanation was too neat; I rechecked the
raw captures and the data does not cluster on 16.7 ms multiples. The Adversary
is also right that physics deserves its own A/B arm, so I am trading my
`farField=0` run for a `physics=0` run. My main remaining disagreement is with
the Pragmatist (and partly the Architect) about ranking "render directly when
bloom and Trip are off" as an iPad steady-state lever. At a 675×462 target that
change saves GPU fill on very few pixels and does nothing for main-thread work,
which is where the iPad's frame goes.

### On the Adversary

-   **"On every iPad phase the median frame interval exceeds the
    95th-percentile JavaScript work" (`council-adversary.md`, Vulnerabilities,
    first bullet). Agree, and this corrects my Round 1.** I recomputed the
    per-window wall p50 minus work p95 for the parked phases. The median gap is
    9.5 ms on November 8 (range 7–19) and 8 ms on November 7 (range 5–16),
    taken from the `samples[*].frame` windows in
    `2026-11-08-ipad-child-density/baseline-capture.json` and
    `2026-11-07-ipad/capture.json`. More importantly, the window wall p50
    values are spread continuously from 29 to 43 ms (November 8) and from 20 to
    43 ms (November 7). They do not pile up at 16.7 or 33 ms, which is what a
    pure 60 Hz CPU-bound model predicts. My Round 1 sentence "the median wall
    time sits on or near the next 16.7 ms vsync multiple" is therefore
    **overstated, and I withdraw it**. The refresh cadence (60 Hz, or a 120 Hz
    ProMotion panel) is unknown because the hardware model is unknown
    (`2026-11-08-ipad-child-density/README.md:20-22`).
-   **"The steady frame time is ... not explained by JavaScript work at all"
    (`council-adversary.md`, TL/DR). Sharpen: this goes too far in the other
    direction.** Wall time still moves with work across phases. The lowest-work
    phase (November 7 parked-after, work p95 15.5 ms) is also the
    lowest-wall phase (22 ms), and the highest-work parked phase (November 8
    parked-after, 26 ms) has one of the highest walls (36 ms); see my Round 1
    table. Even with a zero gap, 22–26 ms of work caps the game at roughly 38–45
    FPS. Both terms are real. The work term is about two-thirds of the frame and
    the gap is the remaining third, so the session must measure both rather than
    pick one.
-   **"Retained Nov 8 parked frame events show 60 ms walls against 18 ms of
    work." Agree on the fact, but sharpen what it means.** I confirmed it, and
    November 7 parked-after shows the same pattern with 50–59 ms walls against
    12–15 ms of work (`capture.json`, `frameEvents`). These events are the
    retained slow frames (the minimum retained wall is 21–26 ms), so they are
    the tail rather than typical frames. Work below one vsync followed by a
    three-vsync wall is direct evidence of waiting outside the timed JS. That
    wait does not have to be the GPU. Garbage collection between callbacks,
    input and audio-scheduler handlers, the capture's own upload, and
    compositor back-pressure all land in that same gap. The wall-minus-work
    metric the Adversary asks for should therefore be reported alongside the
    previous frame's work and any `progDelta`, so a GPU reading is not assumed
    by default.
-   **Physics runs outside both timers, and its fixed step gets more expensive as
    frame rate falls (`council-adversary.md`, Vulnerabilities, second bullet).
    Agree, verified.** `FixedStepClock` defaults to `step = 1/60` with
    `maxSteps = 5` (`src/physics/fixedStep.js:3`). The frame delta is clamped to
    0.05 s (`src/main.js:1223`), so the real ceiling is 3 steps per frame. At
    25–30 FPS that is 2 steps, and it reaches 3 at 20 FPS. That is a positive
    feedback loop: slower frames run more Rapier steps per frame, which makes
    the frames slower still. I listed "physical advance" in my Round 1 timer list,
    but I did not ask for the step count, and I did not propose an A/B arm. The
    Adversary's ABAB `physics=0` pair is a better use of device time than my
    `farField=0` arm, for a reason the Adversary also gave: far-field draws and
    triangles depend on pose and tier rather than device
    (`docs/backlog/performance.md:74`), so its draw share can be counted on
    desktop with `__dbg.drawCensus` (`src/main.js:2691`). **I am adopting the
    physics arm and moving the far-field draw share to a desktop census.**
-   **`applySuperseded` is not serialized, so a horizon that stops publishing
    could look like a win (`council-adversary.md`, Vulnerabilities, third
    bullet). Agree.** That is the same staleness risk I rated Medium in Round 1
    (`2026-11-11-far-field-publication/README.md:99`), but the Adversary named
    the missing counter. Treat it as a hard acceptance condition for the
    November 11 verification. The far-field result should only count as a pass
    if the horizon age stays bounded during the drive and the worst
    far-field interval also falls.
-   **Record Low Power Mode, charging and thermal state (`council-adversary.md`,
    Priority Sequence step 2). Agree.** The two captures on the same device
    differ by 10 ms of parked wall p50 (22 vs 32 ms), and no power state was
    recorded (`2026-11-07-ipad/README.md:24-26`). A frame-rate cap in one arm
    would invalidate any A/B comparison, and recording the state costs Gary
    seconds.
-   **"Freeze production performance changes until the next iPad run." Agree.**
    It is compatible with my sequence, because steps 1 and 2 are capture-only.
    I would allow one exception. The fog-limit cull can land behind a
    default-off URL flag, as the Pragmatist proposes in Slice 2, so it can be
    A/B'd in the same session without changing what players get.

### On the Maverick

-   **The Auto-versus-quality-lock run and the CPU-bound guard on Auto
    (`council-maverick.md`, steps 2–3). Agree.** We reached the same position
    independently from the same November 8 numbers. One sharpening on the
    choice of arm: the Maverick proposes `perfQuality=sustained`, while I
    proposed `perfQuality=baseline`. Sustained only disables the p95 trigger
    (`src/adaptiveQuality.js:215`) and can still descend on the sustained
    average. Baseline locks level 0 (`src/adaptiveQuality.js:437,470`), which
    makes it the clean one-variable test of whether resolution matters.
    Sustained is the realistic shipping candidate. **For the first session I
    recommend baseline**, because the question is diagnostic. Sustained becomes
    the A/B arm once a CPU-bound guard exists.
-   **"Attack the largest named main-thread row: static scene-graph matrix
    traversal" (`council-maverick.md`, step 4). Rebut the ranking, though not
    the idea.** `src/main.js` never calls `scene.updateMatrixWorld()`; a grep
    finds only `sun.target.updateMatrixWorld()` in `src/world.js:219`. The
    scene-wide traversal therefore happens inside `composer.render()`, which
    sits inside the render timer (`src/main.js:1938-1940`). That relies on
    Three.js r160 updating matrices from inside `renderer.render`. I could not
    check that here because `node_modules` is absent, so it needs confirming
    against the pinned source. If it holds, matrix traversal is part of the
    6–10 ms render timer and cannot be the untimed 12–15 ms. That caps what
    freezing static subtrees can win on the iPad below the render timer's total,
    which also includes encoding about 1,000 draws. It belongs under "render
    CPU dominates" in the decision table, after draw reduction is considered,
    and not ahead of the attribution.
-   **CPU rungs in Auto, including staggered updates for distant actors
    (`council-maverick.md`, Alternative Approach). Agree in direction, and the
    Maverick's own gating is correct.** A ladder whose bottom rungs act on CPU
    would give Auto a lever that can actually cross the frame budget. It is
    premature until attribution names the subsystem, as the Maverick says.
    The determinism check against `src/crowd.js` and `src/people/` is
    mandatory (Non-Negotiable 1).

### On the Architect

-   **`registry.rebuildSpatialIndex()` walks every registry entry every frame
    (`council-architect.md`, step 4 and Structural Risks). Agree, verified, and
    it should be its own timed section.** The call is at `src/main.js:1477`,
    inside the untimed region. The loop iterates over every entry in
    `this.entries.values()` (`src/registry.js:308-331`). It skips the grid
    writes for unchanged entries, but it still does the per-entry cell math and
    map lookups. The November 8 sample shows `reg` at 2,268 entries. This is a
    concrete, linear-in-content candidate for the untimed 12–15 ms and should
    get a dedicated bucket in the new timer rather than being folded into
    "people".
-   **Direct render and the context-light pool as the "render CPU" branch
    (`council-architect.md`, step 4, third sub-bullet). Rebut.** Both of these
    reduce GPU fragment work. The direct-render path removes the half-float
    target, FXAA and `OutputPass`, which add only a handful of draw calls, so it
    barely changes CPU-side render time. If render CPU dominates, the levers are
    draw count and matrix traversal, not pass count.
-   **Spec drift and the staleness window (`council-architect.md`, Structural
    Risks). Agree.** I have nothing to add from a performance angle, beyond
    noting that reading `ffApplyFrames` lines up with the Adversary's
    `applySuperseded` request. Both should be in the acceptance check.

### On the Pragmatist

-   **Ranking "direct render when bloom and Trip are both off" second among
    steady-state levers (`council-pragmatist.md`, step 4b). Rebut. This is my
    strongest remaining disagreement.** The iPad's driving phase ran at a
    675×462 scene target (`2026-11-07-ipad/README.md:58-60`), which is about
    0.31 megapixels. FXAA and `OutputPass` are two full-screen passes at that
    size. On the parked windows, render CPU is 6–10 ms and the remaining
    untimed work is 12–15 ms. Neither of those is fragment-bound work. The
    Pragmatist's own text expects "a modest gain". The Adversary adds a
    concrete risk: switching render paths when Auto toggles bloom could create
    new shader program variants, and the project already had a 54 to 691
    program leak from a similar mechanism (`docs/backlog/performance.md:164-176`).
    Low expected gain plus a known failure class means this belongs after the
    attribution and the CPU levers, and only on Mid or High, not second for the
    iPad.
-   **The pre-decided branch table (`council-pragmatist.md`, Critical Path step 3)
    and the "never ship the iPad two untested changes stacked" rule. Agree.**
    The table is the right shape. I would add the two branches it lacks. One
    is "untimed game-update work dominates", which is likely given the
    12–15 ms gap. The other is "wall-minus-work dominates", which the
    Adversary raised.
-   **"Physics ... protected per briefing constraint 10, I do not propose
    relaxing any of them" (`council-pragmatist.md`, Deferred / Cut). Sharpen.**
    Measuring physics with a `physics=0` arm is not a relaxation, because it is
    a capture-only control. The policy question only comes up if the
    measurement shows physics is the dominant cost. At that point, reducing the
    step rate on Low becomes a decision for Gary, as the Adversary says.

### Revised Verdict (only if it changed)

My verdict stays **Proceed with mitigations**, but the Key Concern is now
sharper. The iPad's steady frame has two unmeasured pieces of roughly equal
weight, which the capture cannot currently see:

1.  About 12–15 ms of untimed game-update work, including Rapier stepping,
    which rises as frame rate falls, and a full-registry walk every frame.
2.  About 8–10 ms of wall time beyond the work, whose cause (GPU, garbage
    collection, compositor or power cap) is unknown.

The next session is wasted unless it measures both and records the device's
power state.

### Where I now stand on the order of operations

1.  **Freeze production changes, and make the capture-only additions on
    desktop.** These are:
    -   per-section `tickBody` timers, including a dedicated
        `rebuildSpatialIndex` bucket;
    -   physics step time and steps per frame (`liveWorld` `stats()`
        `meanStepMs`, per `council-adversary.md`);
    -   wall-minus-work per phase;
    -   far-field `applySuperseded` and horizon age, plus the largest single
        publication unit;
    -   the power and charging state and the device model;
    -   a `physics=0` option in `bin/playtest-perf`.
2.  **Do the draw census on desktop** at the November 8 route anchors with
    `?perf=low`, including the far-field share. This costs no device time.
3.  **Run one iPad session on the November 8 route and seed.** The order is
    default (Auto), then `physics=0`, then default, then `perfQuality=baseline`.
    The first default run is the acceptance check for the November 11 fix, and
    the fix only passes if the horizon age stays bounded. The repeated default
    run checks repeatability, and the baseline run is the resolution test. If
    Gary only has time for three runs, drop the repeat.
4.  **Choose the lever from the data.** If physics dominates, Gary decides on
    the step rate on Low. If people or the registry dominates, apply the
    targeted fix in that subsystem. If render CPU dominates, reduce draws and
    then freeze static subtrees. If wall-minus-work dominates, start with draw
    reduction and the fog-limit cull. If the far-field tail survives, split the
    cold plan.
5.  **Add the fog-limit horizon cull behind a default-off flag**, filtering after
    planning and re-basing the fingerprints visibly, with Noon and Midnight
    screenshots.
6.  **If the baseline run matches Auto's FPS, add a CPU-bound guard to Auto.**
7.  **Keep these deferred for the iPad:** direct render, the context-light pool,
    unload budgeting, lake deadlines, terrain cache keys, workers and
    compression.
