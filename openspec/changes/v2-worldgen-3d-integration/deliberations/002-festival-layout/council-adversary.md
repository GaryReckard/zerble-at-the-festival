## Adversary's Position

I read the redesign assuming it is wrong until the engine reality proves it
right. The legacy clustering RULES are sound — the briefing's own thesis. The
attack surface is the new *seam* between three rng regimes (`festival.js`'s
`cellRng`/`pairRng`, the chunk's `mulberry32(chunkSeed)`, and the per-chunk
`cellRng(SALT.placement)`), the *trig* now driving placement-and-comparison, the
*window scans* that have to find a feature whose center may be tens of chunks
away, and the *longest call chain* getting heavier than it has ever been.

Grounded in: `src/rng.js`, `src/worldgen/{constants,hearts,roads,water,placement,selftest}.js`,
`src/chunks.js`, the prior Risk Register (`deliberations/001-initial/results.md`
R1–R15), and the cited git history (all six commits verified to exist).

### Priority Sequence

The redesign touches the determinism substrate and the boot-crash chain. I order
the work so the *blast-radius gates* land before the content that depends on them,
so a green self-test can never give false confidence, and so each step is
independently bootable behind `?worldgen=0`.

1. **Salt + window-scan plumbing FIRST, before any cluster build (D2.1 + D2.2).**
   Allocate `SALT.poiLayout = 0x4D41_0B` / jitter `0x4D41_0C` and the three
   additive exports (`approachRoadsOf`, `nearestMajorHeart`, `shoreBand`) as pure
   functions with their own bounded, deterministic window scans. These are the
   pieces every later step reads; if their scan window is wrong, every cluster
   built on top inherits a window-truncation bug. Get them green in node + the
   map-sandbox `wouldHost` inspector before a single mesh moves.

2. **Extend the determinism harness to cover the NEW surface (part of D2.7) —
   BEFORE D2.3/D2.4.** The current `runSelfTest` golden accumulates `queryPoint`
   tuples ONLY (`selftest.js:62-66`). It is *blind* to `festivalPlan`,
   `approachRoadsOf`, `nearestMajorHeart`, and `shoreBand`. Shipping clusters
   first and "the golden `63c8dea2` stays green" is the R1-class false-confidence
   trap re-run on a new layer: the golden stays green *by construction* because
   it tests a tuple the new layer doesn't touch, while the new layer can be fully
   non-deterministic and the light stays green. Add a POI-layer golden + the
   window-invariance check (D2.7 already names it) as a GATE, not a closing task.

3. **One rng regime per cluster — decide the contract BEFORE D2.3.** Today every
   build half (`buildFoodCourtAt` `chunks.js:1037-1079`, `buildCampVillage`
   `:1849-1887`, `buildStage` `:1897-1899`) pulls from `ctx.rng`
   (`mulberry32(chunkSeed)`) in a FIXED order. `festival.js` decides WHAT/WHERE
   from `cellRng(heart)`. These two streams now interleave in one `_generate`.
   Pin the rule: layout/positions/counts come from `festival.js`; the build half
   may consume `ctx.rng` ONLY for cosmetic, count-stable jitter (scale, hair,
   color) — never for anything that changes how many `ctx.rng()` draws happen.
   Otherwise the chunk's downstream stream desyncs the instant the descriptor
   list changes length.

4. **Spawn relocation (D2.6) AFTER anchors render correctly — it is a consumer,
   not a foundation.** `nearestMajorHeart(0,0)` → relocate Zerble depends on the
   major-heart scan (step 1), the arch+stage+lights coming free from that heart's
   plan (step 3), AND the spawn-clearance rule not fighting the forced audience
   cluster. Wire it last so a relocation bug can't be confused with a layout bug.

5. **Boot smoke test at a heart-CENTER chunk on EVERY content commit (D2.8),
   not just at the end.** The sandbox cannot see anchors (briefing line 96). The
   `{group,...}` vs bare-`Group` footgun (R2) bit a prior change and the build
   half here is now MORE forked (8 `case`s in `buildWorldgenKind`, each with a
   different return-shape contract — `chunks.js:957-969`). `__dbg.teleport` to a
   known major-heart center + `preview_console_logs` is the gate.

6. **Perf re-measure HEADLESSLY in node (D2.8), per the Group C lesson** — the
   browser HUD is hidden-tab-throttle-inflated. The village+court single-frame
   allocation spike (R11) is the symptom to watch, against the 8 ms R7 gate.

### Vulnerabilities Found

-   **POI-layer golden blindness (the R1 trap, re-run on a new layer)**: The
    self-test golden is computed *only* from `queryPoint` tuples
    (`selftest.js:62` `goldenAcc += sa`). D-P's claim "the POI layer does not
    touch the `queryPoint` tuple → golden `63c8dea2` stays" is *true and exactly
    the problem*: the golden cannot detect a determinism regression in
    `festivalPlan`/`approachRoadsOf`/`nearestMajorHeart` because it never
    evaluates them. A green 20/20 after the redesign proves nothing about the new
    surface. This is the same shape as R1 (Critical) — "green self-test gives
    false confidence." On the game path, two players on the same seed could get
    different festival layouts and the harness would say "deterministic." —
    Severity: **High**

-   **`nearestMajorHeart` window-truncation (briefing's own CRITICAL class,
    re-introduced)**: Majors are ~4% (`HEART_RANK.minorBelow = 0.96`,
    `constants.js:14`) — one per ~25 cells, so the nearest major to origin is
    expected ~1100 m+ away (sqrt(25)·440/2). The existing `heartNeighborhoodCells()`
    window covers the largest *district* (1000 m → 4 cells, `constants.js:53-56`),
    which is NOT sized to *guarantee finding a major*. An "expanding-window scan"
    (D-L) that grows until it finds a major must (a) be bounded so a major-sparse
    region doesn't spin forever, (b) be deterministic — the SAME window every
    call regardless of caller, or `nearestMajorHeart(0,0)` at spawn could resolve
    to a different heart than a later query and Zerble spawns pointing at nothing.
    `constants.js:49-52` already documents this exact class as "the council's
    'window truncation' CRITICAL risk" for `nearestHeart`; the new rank-filtered
    scan re-opens it with a rarer target. — Severity: **High**

-   **Cross-cluster rng-stream desync (the build-half coupling)**: `buildCampVillage`
    (`chunks.js:1854-1885`) and `buildFoodCourtAt` (`:1037-1042`) make their layout
    decisions (corner, target count, truck count, shack slot, size mix, every
    jittered position) by consuming `ctx.rng()` in a fixed order. The redesign
    moves WHERE/HOW-MANY into `festival.js` (`cellRng`). If the build half *keeps*
    pulling `ctx.rng()` for those same decisions, you have two sources for one
    layout (re-roll desync waiting to happen). If it *stops* pulling them but the
    number of `ctx.rng()` draws per chunk changes with the descriptor list
    length, every builder *after* that point in the same `_generate` shifts —
    e.g. tree scatter or a later cluster's cosmetic jitter moves, even though its
    own inputs didn't change. The fixed-order contract in `placement.js:13-15`
    ("consumed in a FIXED order per chunk") must be extended to the *build* half
    or the chunk is no longer reproducible. — Severity: **High**

-   **Cross-engine trig fork in the placement-AND-comparison path (R8, widened)**:
    R8 already flags the `Math.abs(ccw - Math.PI) < 0.05` detour tie-break
    (`roads.js:167`) as a JSC-vs-V8 *road-existence* flip — not cosmetic, because
    it changes `noBuild`/collider existence. `approachRoadsOf(heart)` composes
    `arterial` (which runs `_computeArterial` → `arcAround` → `atan2`/`hypot`,
    `roads.js:103-118, 163-172`). The redesign's `bearing` field
    (`[{neighbor, polyline, bearing}]`, D2.2) is derived from those polylines via
    trig; if `bearing` is then *clustered* or *threshold-compared* to choose "the
    primary approach road" (longest/first, D-M) or to perpendicular-offset a
    vendor row, a low-bit `atan2` difference can pick a different primary road on
    Safari than on Chrome → the entrance arch, food court, and SPAWN orientation
    fork per-engine. The browser golden is already `a527d31e` ≠ node `63c8dea2`
    (procedural-map-generator HANDOFF:15) — the cross-engine wobble is real and
    pre-existing. D-P says "quantize any trig result before a threshold compare";
    that is necessary but the design does not yet say *which* compares (bearing
    clustering, primary-road selection, perpendicular-offset sign) get quantized.
    Unquantized bearing selection = a per-engine festival layout. — Severity:
    **High**

-   **Window-truncation in `placeChunkProps` cluster ownership (R7 vs the scan
    widening)**: D-N widens `heartsInBounds` "by the max POI reach" so a chunk
    owning a cluster center doesn't miss the heart that seeds it. But a major's
    district is 1000 m and its road-courts sit "60–120 m" out, camp villages "off
    the drag" further still. If "max POI reach" is under-estimated, a chunk that
    contains a cluster CENTER fails to enumerate the heart that owns it → the
    cluster silently never builds (a hole in the festival, green console, no
    crash — the R4-class silent-nothing failure). If it is over-estimated to be
    safe, every chunk scans a wide heart window × `festivalPlan` per heart and the
    per-chunk sampler blows the 8 ms R7 gate on boost. The memo makes the *plan*
    cheap, but the *enumeration* (how many hearts × how many POIs filtered per
    chunk) is the cost, and it is not yet bounded in the design. — Severity:
    **Medium**

-   **Heart-center anchor chunk: heavier longest call chain → boot crash (R2,
    worsened)**: A `core×major` center chunk now builds, in ONE `_generate`: the
    main stage (`buildStage` → `buildStageModel` returns `{group, deckWidth,...}`,
    band placement, music attach), the food-truck ring (`buildFoodCourtAt`, which
    can itself spawn a `buildSugarShack` returning a Group with `userData.cookEntry`,
    `:1048-1052`), the entrance arch, string lights, AND a bubble vendor. Eight
    distinct return-shape contracts flow through `buildWorldgenKind`
    (`chunks.js:957-969`), each one a `{group,...}`-vs-`Group` footgun site on the
    rarest, sandbox-invisible path. The prior change crashed at world-gen on
    exactly this (`buildCampChair` `{group,color,footprint}` vs Group, per
    CLAUDE.md). One `TypeError` here hangs the title card. The sandbox will pass.
    — Severity: **High**

-   **Spawn cluster shoving the parked player (invariant g, indirect)**: The
    no-shove-parked-Zerble fix (`806a689`, logic at `crowd.js:1862-1893`, keyed on
    `Math.abs(zerble.speed) < 0.5`) protects against NPCs crowding a stationary
    cart. D-O forces a *guaranteed audience* at the relocated spawn (main stage =
    22 audience, D-M) PLUS intro jugs (attractors) PLUS the player spawns parked,
    facing the stage. At boot, `zerble.speed === 0` → `isParked` true → the
    scatter pass should fire — but the audience NPCs are themselves attracted to
    the stage *behind* the player. The interaction (dense forced cluster + parked
    player + stage attractor at the same point) is untested and is precisely the
    geometry `806a689` was NOT tuned for (it was tuned for mid-game parking, not a
    boot-time forced crowd). Risk: a wall of NPCs at the worst possible first
    impression, or the scatter fighting the attractor and jittering forever. —
    Severity: **Medium**

-   **`USE_WORLDGEN_V2` default-ON regression exposure (R10, current state)**:
    `chunks.js:21` imports `USE_WORLDGEN_V2`, and the v2 branch comment says
    "default ON" (`chunks.js:416`), while tasks I.0 says "flip
    `DEFAULT_WORLDGEN_V2` to true … ONLY after the world is populated + verified"
    and "Until then legacy ships by default." There is a live contradiction
    between the code comment and the task gate — I cannot verify from the design
    which is true *right now*. If v2 is already the default while this redesign is
    mid-flight, every WIP commit ships the broken layout to the live GitHub Pages
    deploy (CLAUDE.md: "treat the production deploy as observed by real players").
    The flag must demonstrably default to LEGACY until D2.8 passes. — Severity:
    **Medium**

-   **Quantize-before-compare gaps in `shoreBand` (preferential lakeshore camps)**:
    `shoreBand(x,z,N)` reuses "the bearing-sampled outline math `density.lakeRingBoost`
    uses" (D-L). The lake outline vertices are quantized (`water.js:73`), but
    `shoreBand` returns `shoreR` and a "within N m of shore" test. If that test is
    `hypot(dx,dz) < N` on un-quantized intermediates, two adjacent chunks can
    disagree on whether a point is in-band at the N-meter boundary → a camp
    village's preferred-placement gate flips across a chunk seam, and the village
    appears or vanishes depending on which chunk evaluates it first. Same class as
    the road-existence flip (R8) but for camp placement. — Severity: **Medium**

-   **Drum-circle "treed off-road district cell" derivation feeding back into the
    forest budget (R3/R9 collision)**: D-M anchors the drum circle where
    `treeDensity` is high + off-road. F.4 also re-homes the "drum circle nested in
    dense forest" POI as outskirts+high-density. If BOTH the festival layer AND
    the forest scatter consult `treeDensity` to decide placement, a high-density
    cell hosts a drum circle AND the un-capped tree scatter (R3) AND, if it's
    lakeshore, the `LAKE_RING_BAND=70` boost to 0.62 (R9). Three systems piling
    onto the same high-density cell is the worst-case single-chunk perf spike, and
    it is exactly the cell most likely to also be a "destination." — Severity:
    **Medium**

-   **iOS audio async-hop latency, via spawn relocation (R12, latent)**: D-O adds
    spawn work in `main.js`/`world.js` boot order — `nearestMajorHeart(0,0)`
    (an expanding window scan) + relocation. R12 already warned that touching the
    boot order tempts a "warm the worldgen cache in the start handler" that would
    push `Sound.init()` off the synchronous gesture frame (CLAUDE.md tripwire #3).
    `nearestMajorHeart` could be *expensive* on a cold cache (it scans an expanding
    window of `heartInCell`, each a `cellRng` + memo miss). If that scan lands
    between the title tap and `Sound.init()`, iOS ships silent. The scan must run
    inside `buildWorld`, never before `Sound.init()`. — Severity: **Low (latent,
    but a silent-mobile regression if violated)**

### Verdict

-   **Verdict**: **Proceed with mitigations**
-   **Key Concern**: The determinism harness is structurally blind to the entire
    new POI layer — its golden only hashes `queryPoint` tuples (`selftest.js:62`),
    which the redesign deliberately doesn't touch. "Golden `63c8dea2` stays green"
    is therefore *guaranteed and meaningless* for proving the festival layout is
    deterministic. This is the R1 false-confidence trap re-run one layer up.
    **Block the cluster-build tasks (D2.3/D2.4) until the self-test grows a
    POI-layer golden + window-invariance check over `festivalPlan` /
    `approachRoadsOf` / `nearestMajorHeart` / `shoreBand`** — and that golden must
    be recorded on BOTH node and a browser engine, because the cross-engine fork
    (`63c8dea2` node ≠ `a527d31e` browser) is already real and the new trig-driven
    bearing/primary-road selection widens it.
-   **Recommendation**: The clustering rules are well-grounded and the prior
    Risk Register's mitigations (R2 boot-smoke, R4 tuple-keying, R7 8 ms gate,
    R10 single-branch) carry forward correctly. But four High-severity seams are
    new to THIS redesign: (1) the POI-golden blindness, (2) `nearestMajorHeart`
    window-truncation on a 4%-rare target, (3) the build-half rng-stream coupling,
    and (4) the cross-engine bearing/primary-road fork. Each is mitigable in
    design before building — quantize the named compares, bound + fix the
    major-scan window deterministically, pin one rng regime per cluster, and
    extend the golden. Land the salt/exports/harness FIRST, build clusters SECOND,
    wire spawn LAST, and boot the real game at a major-heart center on every
    content commit. Do not flip `DEFAULT_WORLDGEN_V2` to true until D2.8 is green
    at low/mid/high — the live deploy is watched by real players.
