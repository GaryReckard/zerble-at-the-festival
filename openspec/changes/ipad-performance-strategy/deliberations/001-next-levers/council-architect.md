## Architect's Order of Operations

**TL/DR:** The iPad has two separate problems, and the project's
instrumentation only covers one of them. The stalls (hundreds of milliseconds
while driving) are now attributed to far-field work and have an unverified fix,
so the next iPad session should confirm it. The steady low frame rate (25 to 29
FPS even at the lowest quality rung) comes mostly from main-thread work that
sits outside both the world timer and the render timer, and the one tool that
could split it is switched off on the device. Fix that blind spot before
choosing any steady-state optimization, and do not open a new structural
rewrite until the device says where the time goes.

### Priority Sequence

1. **Extend capture-timing attribution to the rest of `tickBody`, using the
   pattern that already exists.** The capture frame records `workMs`, `worldMs`,
   `renderMs` and `worldParts` (`src/main.js:1213-1236`), so the world section
   can be split on device and the November 8 run proved this works by pinning
   423 of 424 ms on `farField`
   (`verification/performance/2026-11-08-ipad-child-density/README.md:24-30`).
   Nothing comparable exists for the gameplay sections between frame start and
   `updateWorld` (`src/main.js:1287-1776`) or after it (`src/main.js:1799-1924`).
   The people tracer that could split them is gated to `localhost`/`127.0.0.1`
   (`src/main.js:95-100`), but the iPad loads the game over a LAN address
   through the Python capture server (`.claude/rules/no-build.md`, "Deployment
   and captures"), so it can never run on the device. The backlog already names
   this gap ("Attribute iPad game-update time", `docs/backlog/performance.md:131`).
   Structurally, the fix should add coarse sections (people phases, registry
   spatial index, per-kind animatable scans, chase camera, context lights,
   adaptive quality) to the existing `_perfWorldParts`-style accumulator behind
   `PERF_CAPTURE_TIMING` (`src/main.js:284`), rather than relaxing the
   localhost gate on the heavy per-NPC tracer or inventing a third tracer. This
   is measurement-only code and it rides along with step 2, so it costs Gary no
   extra device session.

2. **Run one fixed-route iPad capture on a build that contains the November 11
   far-field change and the step 1 sections.** This is already the first
   queued item (`ROADMAP.md:257`). It verifies the bounded-publication change
   (no browser, GPU or iPad result exists for it,
   `verification/performance/2026-11-11-far-field-publication/README.md:8-10`)
   and, in the same run, produces the first device breakdown of the steady
   frame. Also read the November 5, November 6 and October 22 changes off this
   same capture instead of scheduling separate sessions for them
   (`ROADMAP.md:261-273`), since all of those merged changes are already in
   the build. Gary's device time is the scarcest resource (briefing
   constraint 11), so every pending device check should share one run.

3. **If the far-field tail survives on the device, split the cold plan, not the
   scheduler.** The fix leaves one indivisible 15–30 ms cold festival or woodland
   plan on the M4, with an inferred iPad ratio of about 3×
   (`verification/performance/2026-11-11-far-field-publication/README.md:87-96`).
   The documented next split is inside `festivalPlan` or the woodland `cellPlan`
   (same file, line 105). Any such split must keep memoized plan arrays
   immutable and leave draw order alone (charter Non-Negotiable 1); the existing
   120-horizon fingerprint harness (`fingerprint.mjs`, lines 55-65) is the
   correct equivalence gate and should be reused.

4. **Choose the steady-state lever from the step 2 attribution, using this
   decision rule.** The evidence so far points away from the GPU: Auto had
   already exhausted its ladder (`pixel-50`, bloom off, shadows off, 675×462)
   and the iPad still drove at a median of 29 FPS
   (`verification/performance/2026-11-07-ipad/README.md:42-67`), while the
   briefing's digest records 22–31 ms of main-loop work with only 0–2 ms in the
   world and 5–9 ms in render. That makes further resolution tuning a poor bet,
   which the November 7 report also says (lines 110-112). Then:
   -   If **people/crowd** dominates, that is a population-policy question (Low
       `crowdMax: 180`, `src/perf.js:107`), which constraint 10 marks as
       protected. Make any change to it an explicit, separately approved
       decision, and keep the existing half-child fixture as the device A/B
       (`verification/performance/2026-11-08-ipad-child-density/README.md:38-52`).
   -   If **registry maintenance** dominates, the candidate is structural.
       `registry.rebuildSpatialIndex()` runs every frame (`src/main.js:1477`)
       and walks every registry entry (`src/registry.js:308-331`), which the
       October 8 audit counted at 3,983 entries (`.claude/rules/performance.md`,
       priority 3). Most of those entries are static props. A mover-only index
       pass would follow the registry's own contract, but the November 7
       registry-publication probe found an adverse all-mover case
       (`verification/performance/2026-11-07-structural-options/README.md:3-8`),
       so a design must cover that case before anyone proposes it.
   -   If **render CPU** dominates, look at draw count before shaders. The iPad
       recorded median draws of 514–710 (November 7) and 1,023–1,025 (November 8)
       against a Low budget of 80 (charter Non-Negotiable 6). Of the existing
       candidates, "render directly when bloom and Trip are both off"
       (`docs/backlog/performance.md:125`) and the per-tier context-light pool
       (line 126) are the two that act on the lowest Auto rung the iPad actually
       ran at.

5. **Take the two cheap world-tail hygiene items only after step 2, and only
   if they appear in the world parts.** Budgeted unloads and a lake deadline
   (`docs/backlog/performance.md:128-129`) are architecturally sound if the
   registry and collider removal stays immediate and only the dispose walk is
   deferred. Lakes must also keep omitting `chunkKey` and must register before
   neighbouring chunks build (charter Non-Negotiable 5). Neither has been
   measured, so neither should jump ahead of steps 1–4.

6. **Fog-limit horizon cull: proceed as a fidelity-plus-performance decision,
   not as pure performance.** More than half of the kept Low instances sat
   beyond the 520 m fog-opaque radius at one pose
   (`verification/performance/2026-11-11-far-field-publication/README.md:103`).
   Culling before planning removes their terrain planning cost as well as
   draws, but it changes the published set and therefore breaks the
   byte-identical fingerprint contract by design. Re-base the fingerprint
   deliberately and visibly, with Noon and Midnight captures (`ROADMAP.md:259`).

7. **Stop or keep parked for now:** Web Workers for worldgen (the stall they
   target is the one step 2 is about to re-measure, and the collider-sync
   requirement in `docs/backlog/performance.md:99-104` makes them the most
   invasive option); frozen static chunk subtrees (a silent-animation-freeze
   risk worth about 5% of desktop CPU, `docs/backlog/performance.md:127`);
   broad model merges (already rejected by a real-GPU gate,
   `docs/backlog/performance.md:110`); and texture/mesh compression (no
   evidence ties iPad frame time to upload or memory).

8. **Update the specs before or alongside the next structural change.** See
   Spec Drift below. A change to `farField.js` or terrain-dependent streaming
   currently has no capability spec to delta against.

### Structural Risks Identified

-   **The device measurement path is blind to most of the steady frame.** The
    capture splits only the world section and the render section
    (`src/main.js:1227-1231`), and the people tracer cannot run on a LAN host
    (`src/main.js:95-100`). Any steady-state optimization chosen before this is
    fixed would be chosen on desktop evidence, and briefing constraint 9 already
    rules desktop evidence out as a device result.
-   **The per-frame O(registry) walks are a scaling hazard that grows with world
    density.** Besides the spatial index pass (`src/registry.js:308-331`, called
    at `src/main.js:1477`), `tickBody` scans by kind for nature proximity on a
    100 ms timer (`src/main.js:1620-1640`) and walks bubble jugs, bubble vendors
    and porta-potties each frame (`src/main.js:1672-1776`). These are linear in
    the loaded content rather than in what is near the player. Whether they cost
    milliseconds on the iPad is unmeasured, which is exactly what step 1 should
    answer.
-   **Spec drift: the far-field horizon has no capability spec.** A search of
    `openspec/specs/` for `farField`/`far-field` finds nothing; the only
    description is `ARCHITECTURE.md:274`. The subsystem with the largest
    measured device stall therefore has no requirement-level contract for its
    publication timing, pool caps or fog radius. Bounded publication is now a
    shipped invariant (the previous horizon stays on screen until a complete
    publication swaps in,
    `verification/performance/2026-11-11-far-field-publication/README.md:42-46`),
    and it should be written down before the fog-limit cull changes the
    published set.
-   **Spec drift: `world-streaming` still says terrain is flat.** The
    "Flat terrain by contract" requirement
    (`openspec/specs/world-streaming/spec.md:41-51`) says `terrainHeight`
    returns 0. Terrain is live, and the November 8 subtraction shows terrain
    accounts for most of the far-field snapshot cost
    (`verification/performance/2026-11-08-ipad-child-density/README.md:71-76`).
    A spec reader would wrongly conclude that terrain sampling cannot be a cost
    centre.
-   **Spec drift: the composer chain spec no longer describes the gated path.**
    `render-pipeline` specifies a fixed `RenderPass → Bloom → Trip → FXAA →
    OutputPass` chain (`openspec/specs/render-pipeline/spec.md:31-50`). The
    direct-render candidate would make the chain conditional, so that
    requirement needs a delta, and the sky, water and star materials need a
    stated color/tone-mapping equivalence scenario.
-   **The HUD draw budget is not a usable gate.** The iPad runs at 6–13× the Low
    draw budget, and the HUD triangle budgets already "cry wolf" on v2
    (`docs/backlog/performance.md:74`). Charter Non-Negotiable 6 and Resolution
    Rule 4 ("perf work stops at green") are therefore unreachable as written for
    Low. The charter needs a device-derived recalibration so that it can act as
    a stop condition again. Until then, use FPS and frame-delivery deltas on the
    fixed route as the gate rather than the budget colour.
-   **Stale charter text.** Non-Negotiable 4 still requires importmap
    cache-buster entries (`openspec/council/charter.md:47-52`), which conflicts
    with the October 29 Vite approval (`.claude/rules/no-build.md`). It is
    harmless for this strategy, but a future worker proposal would be wrongly
    blocked by it, so it should be corrected.
-   **Bounded publication adds a staleness window.** The horizon can now trail
    a cell crossing by several frames, and the lag grows if the streaming
    remainder stays at zero
    (`verification/performance/2026-11-11-far-field-publication/README.md:99`).
    The step 2 capture should read `ffApplyFrames` and the time to the first
    horizon (`ROADMAP.md:257`), so the stall fix does not quietly become a pop-in
    regression.

### Verdict

-   **Verdict**: Proceed with mitigations
-   **Key Concern**: The device capture cannot attribute the roughly 13–20 ms
    of steady main-thread work outside the world and render timers, because the
    people tracer only runs on localhost (`src/main.js:95-100`). Without that
    breakdown, any steady-state iPad optimization would be picked on desktop
    evidence, which the project's own rules say cannot establish a device result.
-   **Recommendation**: Add coarse `tickBody` sections to the existing
    capture-timing accumulator, then spend one iPad session on the fixed route
    to verify the November 11 far-field fix and read the new breakdown in the
    same run. Choose the steady-state lever (population policy, registry
    maintenance, or render path and draw count) only from that result, and
    update the far-field, terrain and composer specs as part of whichever
    structural change follows.

## Round 2 — Reactions

**TL/DR:** All five of us agree on the core plan: instrument the untimed part
of the frame, then batch one iPad session that also checks the November 11
fix. The real disagreements are about what that instrumentation must cover and
which A/B arms Gary's session should carry. On those points the Adversary
caught two blind spots that I missed (physics and far-field supersession). I
also found that one of the Maverick's lead levers is aimed at the wrong timer.

### Agreements, with sharpening

-   **Profiler, Evidence base item 3, and Maverick, step 2: "a capture-gated
    timer shaped like `createWorldTimings` is needed instead" of the
    localhost-only tracer.** I agree, and this is the same structural call as
    my step 1. Four of five personas reached it independently, which makes it
    the settled first move. My only sharpening is to keep it to one
    accumulator, the existing world-parts pattern, rather than letting each
    concern add its own counter.
-   **Profiler, Evidence base item 1: steady FPS "follows main-thread work",
    with frames quantized to the next 16.7 ms vsync.** I agree, and it explains
    the median case better than my Round 1 phrasing did. A work p95 of 22 ms
    cannot fit one vsync, so it lands near 33 ms, which matches the 32 ms
    parked wall p50 in both the Profiler's and the Adversary's tables. The
    Profiler's target ("parked work p95 under about 16 ms") is a better stop
    condition than the stale HUD colours I flagged, and it should replace them
    in practice until the budgets are recalibrated.
-   **Pragmatist, Slice 2: put the fog-limit cull behind a URL/tier flag and
    ship it default-off until the iPad A/B shows a gain.** I agree, and it
    resolves my concern that the cull breaks the fingerprint contract. A flag
    keeps the existing 120-horizon baseline valid for the default path while
    the culled set gets its own deliberately new baseline. The precedent is
    `?farField=0` (`src/perf.js`, `resolveFarField`).
-   **Adversary, step 1: "Freeze production performance changes until the next
    iPad run."** I agree. It follows from my step 2 and from the Pragmatist's
    rule "Never ship the iPad a build with two untested changes stacked." The
    capture-only instrumentation is the one exception, and every persona who
    raised it treats it as diagnostic rather than gameplay code.

### Concessions (arguments that moved me)

-   **Adversary, Vulnerabilities, "Physics is unmeasured on the device".** My
    step 1 section list left out the single most obvious untimed subsystem.
    `physicalWorld?.advance(dt, …)` runs at `src/main.js:1288`, before the
    world timer starts (`src/main.js:1789`) and outside the render timer
    (`src/main.js:1938-1940`). The Profiler also lists it (item 2). Physics
    timing and steps per frame belong in the first instrumentation slice, and
    I am adding them.
-   **Adversary, step 2: serialize `applySuperseded`.** I confirmed the gap.
    The counter exists at `src/farField.js:713` and increments at
    `src/farField.js:889`, but `src/debug.js` never serializes it (a search for
    `applySuperseded` in `src/debug.js` returns nothing). My Round 1 staleness
    risk asked the run to read `ffApplyFrames` and time-to-first-horizon, but
    without supersession and horizon age the capture cannot tell "cheaper"
    apart from "stopped publishing". This is the correct, stronger form of my
    own risk, and it should be part of the step 1 slice.
-   **Profiler, step 7, and Maverick, "What to stop doing": direct render and
    the context-light pool are GPU-side levers.** I listed them as the
    render-CPU branch of my step 4 decision rule. That was a category error.
    Both mostly save fragment or full-screen work at a 675×462 target, while
    my own branch condition was CPU render time. I demote both to Mid/High
    candidates until a device run shows the GPU matters, and I accept the
    Adversary's program-churn gate (`programCount` before and after a bloom
    toggle) as the precondition for direct render.

### Disagreements and factual checks

-   **Maverick, step 4: static scene-graph matrix traversal is "the largest
    named main-thread row" and plausibly "several milliseconds per frame on the
    device", grouped with "the unattributed ~13 ms".** I rebut where it is
    aimed. The game code never calls `scene.updateMatrixWorld()` itself; the
    only explicit call in `src/` is `sun.target.updateMatrixWorld()` at
    `src/world.js:218-219`. The scene-wide traversal therefore happens inside
    Three's `WebGLRenderer.render`, which runs inside `composer.render()`, and
    that whole call is wrapped by the render timer at `src/main.js:1938-1940`.
    On the iPad that timer reads only 5–9 ms in total, including draw
    submission for about 1,000 draws. Matrix freezing can therefore save at
    most part of that 5–9 ms, and none of the 12–15 ms gap. The triage file
    the Maverick cites also says the scene-wide total "contains all other world
    hierarchies" and warns against planning from it
    (`verification/performance/2026-11-07-structural-options/residual-cost-triage.md:21`).
    One caveat applies: `node_modules` is absent in this checkout, so I am
    relying on standard r160 renderer behaviour rather than the pinned source.
    The step 1 timer settles the question either way: a separate
    `scene.updateMatrixWorld()` timing just before `composer.render()` would
    price it on the device. My park on frozen subtrees stands until then.
-   **Adversary, Killer Finding: "the median frame interval exceeds the
    95th-percentile JavaScript work" in every row, so the steady frame lives
    "somewhere the capture does not time" (GPU process, submission or a power
    cap).** I checked the capture data, and both readings are partly right.
    For the median case, the Profiler's vsync quantization explains the gap
    without any hidden cost: 22 ms of work becomes about 33 ms of wall. The
    retained parked events tell a different story, though. The November 8
    `frameEvents` (retained when wall or work reaches 50 ms,
    `src/perfTelemetry.js:56,102`) include parked frames of 50–73 ms wall with
    only 17–28 ms of work and 15–23 ms of previous work, for example 66 / 18 /
    16 and 73 / 21 / 22 ms. Quantization would put those at about 33 ms, so a
    real untimed cost of 20–35 ms exists on those frames. It is a tail, not
    the median. So the Adversary is right that wall-minus-work must become a
    first-class capture metric, and wrong to frame it as the explanation for
    the steady 25–29 FPS. The steady lever is still main-thread work, and the
    50–70 ms parked frames are a separate, third problem that needs the
    wall-minus-work metric and the power-state record to diagnose.
-   **Maverick, step 2: use `perfQuality=sustained` as the "is it GPU-bound"
    arm.** I sharpen this in favour of the Profiler's `perfQuality=baseline`.
    Sustained only disables the p95 trigger; the average-frame trigger still
    downgrades quality (`src/adaptiveQuality.js:214-216`, where
    `averageBad = avg > DROP_FRAME_MS` stays active). On a device averaging
    30+ ms that arm may still walk down rungs, so it would not be a
    one-variable test. The locked baseline is the clean arm.
-   **Adversary, step 4: the second arm should be `physics=0` in an ABAB pair,
    with the quality question deferred to a second session.** I partly
    disagree. Once `advance()` is timed (the concession above), the timer
    already prices Rapier's direct cost on the device. `?physics=0` is also not
    a one-variable switch, because it selects the legacy driving path
    (`DEBUGGING.md:69`), and it needs new `bin/playtest-perf` plumbing. I would
    give the second arm to the locked-quality run, because that question has
    two prior observations behind it (November 8 parked 29 → 26 FPS across a
    resolution drop; the October 22 phone pair at 57 vs 58 FPS), and its answer
    directly decides an Auto change that is visible to players. The physics A/B
    earns a session only if the timer shows `advance()` is large.
-   **Maverick, Alternative Approach: CPU rungs in Auto, including staggered
    updates for distant actors.** Structurally this is the right shape for the
    long term, because it gives the governor a lever that matches the resource
    the device is short of. But it relaxes simulation behaviour (constraint
    10), and the Maverick's own condition that crowd code "must not consume
    seeded RNG in a frame-count-dependent way" touches Non-Negotiable 1. It
    must wait for the step 1 attribution. The Maverick says so too, so we
    agree on the timing.
-   **Pragmatist, step 3, decision table: if the tail is elsewhere, "take the
    matching backlog row (budget unloads / lake deadline)".** I agree,
    provided the Adversary's hard cap on deferred disposal goes with it
    (Vulnerabilities, "Deferred chunk disposal is an iPad memory risk"). This
    matches my step 5 condition that registry and collider removal stays
    immediate, and the hard cap closes the unbounded-backlog hole that my
    version left open.

### Points nobody else addressed

-   **Spec drift remains mine alone.** No other persona noted that
    `farField` has no capability spec, that `world-streaming` still declares
    flat terrain (`openspec/specs/world-streaming/spec.md:41-51`), or that the
    composer chain requirement would need a delta. The fog-limit cull is now
    the consensus lead structural change across the Profiler, Maverick,
    Adversary and Pragmatist. That makes writing a far-field requirement (pool
    caps, fog radius, bounded publication and its staleness bound) a
    precondition for that change rather than a nice-to-have.
-   **The per-frame `rebuildSpatialIndex` walk over every registry entry**
    (`src/registry.js:308-331`, called at `src/main.js:1477`) belongs among the
    step 1 timer sections, because it is a likely occupant of the untimed gap
    and no one else named it.

### Revised Verdict (only if it changed)

Unchanged: **Proceed with mitigations.** My Key Concern is broadened rather
than replaced. The step 1 instrumentation must also cover physics `advance()`,
far-field supersession and horizon age, and wall-minus-work. Without them,
the next iPad session can still return an answer that is either blind or
falsely positive.

### Where I now stand on the order of operations

1. Freeze production performance changes until the next iPad run.
2. Add one capture-only slice using the world-parts pattern, with these
   sections and fields:
   -   physics `advance()` time and steps per frame;
   -   people/crowd phases;
   -   `rebuildSpatialIndex`;
   -   the per-kind scans;
   -   a pre-render `scene.updateMatrixWorld()` timing;
   -   camera, lights and Auto;
   -   far-field `applySuperseded` and horizon age;
   -   the largest single far-field unit;
   -   wall-minus-work per phase;
   -   a power-state note.

   Then verify that `bin/report-perf-playtest` still parses an existing
   capture.
3. Spend one iPad session on the November 8 route with an Auto arm (which
   accepts the November 11, November 5, November 6 and October 22 changes)
   and a `perfQuality=baseline` arm. Add `farField=0` if Gary has time left.
4. Branch on the result. If the far-field tail persists, split the cold plan.
   If the parked work is dominated by one subsystem, act on it. Population or
   physics changes go to Gary as explicit policy decisions. If the baseline
   arm matches Auto, add a CPU-bound hold to Auto.
5. Write the far-field capability spec and fix the flat-terrain requirement,
   then run the fog-limit cull behind a default-off flag with Noon and
   Midnight captures and a new fingerprint baseline.
6. Keep these parked until the device implicates them: direct render, the
   context-light pool, frozen subtrees, workers, compression and deferred
   unloads (and deferred unloads only ever with a hard cap).
