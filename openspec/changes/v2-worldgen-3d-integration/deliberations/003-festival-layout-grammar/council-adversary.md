# Council — Adversary (Round 1): Festival layout grammar (the hub redesign)

> Synthesis mode. Written in isolation. No "Anticipated Tensions" section.
> Domain: what breaks — determinism holes, cross-engine forks, lifecycle, boot-time crashes.
> Grounded in `festival-layout-grammar.md`, `src/worldgen/festival.js`,
> `src/worldgen/roads.js`, `src/worldgen/hearts.js`, `src/chunks.js`,
> `src/worldgen/placement.js`, `src/main.js`, `src/rng.js`, and 002's Risk
> Register (R16–R31).

## Adversary's Position

### Priority Sequence

The spec's §9 build order is roughly right but it sequences by *visible feature*,
not by *what forks the world per-engine*. Re-ordered through the what-breaks lens:

1. **Front-axis `F` + its golden FIRST, behind the existing POI golden gate.**
   `F` is the keystone (spec §3) and it is the single biggest new determinism
   surface in the whole change: a max-selection over float gap widths feeding a
   bisector bearing that rotates *every* downstream piece. Build `F` as a pure
   function in `festival.js`, define exactly where it quantizes, and **extend
   `selftest.js`'s `poiAcc` POI golden to capture `F` per heart, recorded on node
   AND a browser engine**, before re-anchoring a single cluster. The harness
   already exists (`selftest.js:53` `poiAcc`, `:152` per-heart `festivalPlan`
   hashing, `:127` T6 major-window-invariance) — `F` rides into it for free *if*
   it lands in the descriptor stream. If `F` is computed but NOT serialized into
   the plan, the golden is blind to it (the R18 trap, one more layer up).

2. **Re-anchor stage/court/row/drum/bubble/porta to `F`, keeping the existing
   cluster-local-rng regime UNCHANGED.** The hard determinism work (R19) is
   already shipped: `buildWorldgenKind` (`chunks.js:1097`) gives each cluster
   `mulberry32(d.clusterSeed)`, severed from `ctx.rng` draw order. Do NOT
   reintroduce `ctx.rng`-driven layout decisions while re-anchoring. The
   `_computePlan` draw order (`festival.js:172`) and the `clusterSeed(heart, idx)`
   index sequence (`:83`) are load-bearing — adding/removing/reordering a `desc()`
   push or an `idx++` re-rolls every later cluster's seed and moves the golden for
   reasons unrelated to the feature.

3. **Dancefloor clearing as a PLAN OUTPUT (a quantized rect on the descriptor),
   not a registry lookup.** This is where the tree-scatter rng-order trap lives
   (see V-3). Decide the clearing geometry purely in `festival.js` from `F` +
   stage spot, quantize it, and pass it to `scatterWorldgenTrees` via
   `ctx.region` (the same channel as `ctx.region.roads`, `chunks.js:1001`) — never
   via a `registry.closest('stage')` lookup, which is window/load-order dependent.

4. **Overlap guard with a STABLE iteration order and a count-stable resolution.**
   Build it as a deterministic pass over the already-fixed `_computePlan` push
   order. The "drop if can't clear" branch changes the descriptor-list LENGTH —
   prove that length change cannot desync anything (it can't desync `ctx.rng`
   because of the clusterSeed regime, but it WILL move the POI golden and shift
   `clusterSeed(heart, idx)` for any cluster placed *after* the dropped one if
   `idx` is still being incremented past a drop).

5. **Arch → spawn only, and FIX the spawn-relocation math in `main.js` in the
   SAME slice** (V-7). Deleting the per-hub arch (`festival.js:199`) without
   updating `main.js:218-244` ships a spawn that points at nothing or spawns in
   water. This is not a "later polish" item — it's coupled to the arch move.

6. **Boot the real game at the spawn major + a roadless minor + a lakeside hub,
   noon + midnight, `?perf=low/mid/high`, on each content commit.** The new
   builders (picnic table, tent-stage variant) are the live `{group,...}`-vs-Group
   crash surface (V-6). Park: lone field trees (F1), hammock trunk-pair pass (C1),
   tent-stage variety (B1) — all additive, none gate "reads as designed."

### Vulnerabilities Found

-   **V-1 — `F` widest-gap selection is a float max over `atan2`-derived widths;
    a V8/JSC epsilon flips WHICH gap wins and rotates the entire hub.**
    Spec §3 step 1: "take the road outward bearings, sort them, find the angular
    gaps between consecutive roads, candidate `F` = bisector of each gap." Those
    bearings are `approachRoadsOf(...).bearing` = `Math.atan2(p1.z-p0.z, p1.x-p0.x)`
    (`roads.js:96`) — RAW float, explicitly NOT quantized (the road file only
    quantizes `lenQ`, `roads.js:99`, precisely because the comment at `:78-83`
    says the primary-road pick must sort on the integer `lenQ`, never the float
    bearing). The §3 gap WIDTHS are differences of these raw bearings; "pick the
    widest gap" is `argmax` over those float widths. When two gaps are near-equal
    (a hub with roughly symmetric roads — the COMMON case for a 2- or 4-road hub),
    a low-bit `atan2` difference between Safari's JSC and Chrome's V8 flips which
    gap is widest. The bisector then points ~90–180° differently. Result:
    **the stage, dancefloor, tiki edge, chair band, and (at the spawn hub) the
    arch + Zerble's spawn heading all rotate to a different sector per engine** —
    two players on the same seed see the hub facing different directions. This is
    R20 (002's BINDING cross-engine trig fork) re-instantiated on a brand-new,
    higher-leverage surface: R20's worst case was one road/offset; this rotates
    the WHOLE hub. **Severity: Critical.** Mitigation: quantize the gap-selection
    to an integer key the same way `approachRoadsOf` already quantizes `lenQ`.
    Concretely: bin each road bearing to a fixed grid (e.g. `round(bearing /
    (2π/256))` → integer index 0..255), compute gaps as integer index
    differences, pick the widest by `(gapWidthIdx desc, then lowest startIdx)` —
    a pure integer sort, no float compare in the selection. The bisector bearing
    is then derived from integer indices and the FINAL stage/dancefloor
    coordinates are `quantize()`d (as `desc()` already does, `festival.js:88`), so
    residual `cos/sin` noise lands below the 1 m grid. Add `F` (the quantized
    bearing index, not the float) to the descriptor so the golden sees it.

-   **V-2 — the water-penalty ray-walk score is a float threshold; near-tie
    candidates fork per engine.** Spec §3 step 2: score each candidate gap by
    "gap width minus a heavy water penalty — walk out `core + dancefloorDepth`
    along the bisector; if the ray hits a lake or stays `noBuild`, penalize hard."
    Even with V-1's integer gap widths, the penalty term reintroduces a float
    compare: `score = gapWidth − penalty` and `argmax(score)`. The ray-walk calls
    `queryPoint`/`lakeAt` at `cos/sin`-derived points, and `nearestLake`
    (`water.js:91`) returns a `dist = Math.sqrt(bestSq)` float. If the penalty is
    proportional to that distance (a graded penalty) the score is a continuous
    float and two candidate gaps near the water boundary can swap rank per engine.
    **Severity: High.** Mitigation: make the penalty a QUANTIZED, discrete verdict
    — walk the ray, sample at quantized step points (reuse the `roads.js`
    `crossesWater` pattern, `roads.js:106-116`, which already samples on
    `quantize()`d points), and produce an INTEGER penalty (e.g. count of in-lake
    or noBuild samples, or a binary "blocked/clear"), not a graded float distance.
    Selection stays an integer sort: `(clearGapWidthIdx desc, penaltyCount asc,
    lowest startIdx)`.

-   **V-3 — honoring the dancefloor clearing changes `scatterWorldgenTrees`'s rng
    DRAW ORDER, which shifts every tree placed after the first skip.**
    `scatterWorldgenTrees` (`chunks.js:988`) runs one self-contained rng stream
    `mulberry32(worldHash(ctx.cx*73+19, ctx.cz*91+41))` (`:991`) and consumes it
    in a tight loop: `rng()` for x, `rng()` for z, then `if (rng() > d) continue`
    (`:996-1000`). The draw COUNT per attempt already varies with the early
    `continue`s. Adding a dancefloor reject (the A4 requirement, spec §4
    "`scatterWorldgenTrees` must skip trees inside it") changes which attempts
    place vs skip, hence the running rng position, hence **every subsequent tree's
    x/z in that chunk moves**. This is contained — `scatterWorldgenTrees` is the
    LAST scatter in `_generate` (`chunks.js:514`) and nothing downstream reads its
    rng — so it does NOT desync other consumers (good). BUT two failure modes
    remain: (a) if the reject test reads the clearing from a `registry` lookup of
    the stage cluster instead of from plan data, it becomes window/load-order
    dependent — a neighbor chunk that owns the stage may or may not have built it
    yet when this chunk scatters, so the clearing flickers on/off and the tree
    layout becomes non-deterministic across pan direction (a window-invariance
    break, R18 class). (b) the tree COUNT changes (fewer trees where the clearing
    ate candidates), which is FINE for determinism but is a per-tier perf lever
    (R24) — fewer trees, not more, so it's a perf *win*, just flag it isn't a
    regression. **Severity: High** (for the registry-lookup path) / **Medium**
    (count shift). Mitigation: the clearing MUST be a quantized rect carried on
    `ctx.region` from the plan (priority step 3), tested with the same
    `pointNearWorldgenRoad`-style pure point-in-rect math (`chunks.js:1028`), so
    the skip is a pure function of (seed, chunk) with zero registry/load-order
    dependence. Reorder nothing else in the loop.

-   **V-4 — the overlap guard's "push-or-drop" mutates descriptor-list length and
    the `clusterSeed(heart, idx)` index.** Spec §5: "if a later cluster's circle
    overlaps an already-placed one, push it outward along its placement ray until
    clear, or drop it if it can't clear within budget." Determinism hinges on two
    things the spec doesn't pin: (a) the guard must iterate in the FIXED
    `_computePlan` push order (stage → potty → arch → courts → rows → bubble →
    drum, `festival.js:191-263`) — an unstable sort (e.g. by footprint or by
    overlap area) would be a non-deterministic order on near-equal floats; (b) the
    "push outward until clear" loop is iterative float geometry whose final
    position must be `quantize()`d (the `desc()` path already does this, `:88`).
    The "drop" branch is the subtle one: dropping a cluster changes the descriptor
    list LENGTH, which is fine for `ctx.rng` (clusterSeed regime, R19) and fine for
    the per-heart memo (it's recomputed once), but it WILL move the POI golden
    (expected — §7 says the POI golden may move) AND it must not retroactively
    change the `clusterSeed` of a SURVIVING cluster. Today `clusterSeed(heart,
    idx)` (`:83`) is `worldHash(heart.cx*2+idx, ...)` — seeded on the BUILD-TIME
    `idx`, not the final array position. As long as the guard runs as a
    post-process that filters/repositions an already-`idx`-assigned list (and does
    NOT re-index survivors), seeds are stable. **Severity: Medium.** Mitigation:
    assign `clusterSeed` from the cluster's STABLE identity (kind + a per-kind
    counter, or the build-order `idx` captured BEFORE the guard runs), run the
    guard as a deterministic pass over the fixed order, quantize the pushed
    position. Add an explicit selftest assertion: dropping/keeping a cluster does
    not change any surviving cluster's `clusterSeed`.

-   **V-5 — the spec asserts `MAX_POI_REACH = 480` from a STALE comment that says
    major core is 350 m; the real major core is 100 m (`constants.js:22`).**
    `festival.js:50-58` documents `MAX_POI_REACH = 350 + DRUM_BAND` "major core
    (350)" — but `HEART_DOMAIN.major.core = 100` (`constants.js:22`, "major barely
    bigger than minor at this dense setting"). The constant 480 is still SAFE
    (over-wide, still ≤ the `heartsInBounds` ±440-per-cell pad assertion path in
    `placement.js`), so this is not a live bug today. But the redesign's spec §4
    repeatedly sizes things off "core" (stage nudge, dancefloor depth `~3
    stage-lengths`, drum band `core + DRUM_BAND`, the `F` ray-walk distance
    `core + dancefloorDepth`). If the agent reads the stale 350 comment and sizes
    the dancefloor or the `F` ray-walk against 350, the dancefloor depth and the
    water-penalty ray over-reach by 3.5×, the dancefloor clearing eats far more
    trees than intended (perf), and the `F` ray-walk samples water/noBuild way
    past the actual hub — flipping the water penalty for hubs that are actually
    dry near-field. **Severity: Medium.** Mitigation: size everything off the
    LIVE `heart.core` value (read from the heart object, `hearts.js:52`), never a
    literal; correct the stale `festival.js:50-58` comment in the same change;
    re-derive `MAX_POI_REACH` from `maxCore + DRUM_BAND + dancefloorDepth` and
    re-assert `≤ 440` (R16's BINDING invariant).

-   **V-6 — new builders (picnic table, tent-stage variant, dancefloor) are the
    live `{group,...}`-vs-bare-Group boot-crash surface, on the rarest path.**
    The dispatch `buildWorldgenKind` (`chunks.js:1096-1109`) hand-extracts each
    builder's return shape per the R2/R22 footgun: `buildBubbleVendor` returns a
    bare Group (`:1133`), `buildStage`/`buildDrumCircleAt` register internally,
    the `*At` helpers extract `.group`. The spec adds `models/picnicTable.js` (C2,
    NEW) and a tent-stage catalog entry (B1). If a new builder returns
    `{ group, footprint, color }` (the `buildCampChair` shape that crashed the
    game once — CLAUDE.md, the motivating failure) and the call site does
    `group.add(buildPicnicTable(...))`, world generation throws
    `Cannot read properties of undefined (reading 'set')` inside
    `buildWorld → ChunkManager.update → _generate → buildFoodCourtAt`, the longest
    call chain, and **the title card hangs** — worse than a missing feature. The
    sandbox renders the model fine (it extracts `.group`), so sandbox-pass ≠
    game-pass. **Severity: High.** Mitigation: declare each new builder's return
    shape in a one-line comment at the builder; defensive extraction at the call
    site; boot the real game at the spawn hub + a food-court chunk via
    `__dbg.start()`/`teleport` + `preview_console_logs` on the commit that adds
    each new model (R22 BINDING, carried forward).

-   **V-7 — moving the arch to "on the approach road, facing back along the road"
    breaks the existing spawn-relocation math in `main.js`, which assumes the arch
    sits on the `arch→stage` axis.** The current spawn block computes the spawn
    point as `arch - stage` direction (`main.js:225-227`): `ox = arch.x - stage.x`,
    push Zerble `14 m` beyond the arch along that line, then heading = face the
    stage (`:228`). This is correct for TODAY's arch (placed on `roads[0]` walking
    out, then yawed back at the stage — `festival.js:199-206`). The new spec §6
    places the arch **straddling the road, facing back along the road at the hub**,
    and the stage now faces the widest dry GAP (a *different* angular sector than
    the road, by construction — §3). So `arch - stage` is NO LONGER the road
    direction. Pushing Zerble `14 m` along `arch - stage` puts the spawn off the
    road (possibly into the dancefloor or a vendor row), and the `lakeAt`
    dry-walk "toward the stage" (`:235-241`) walks the wrong way (toward the gap,
    not down the road). The intent ("drive in along the street through the arch,
    stage reads off to the side") REQUIRES the spawn to be pushed along the ROAD
    bearing (`approachRoadsOf(spawnHeart)[0].bearing`, outward), not `arch-stage`,
    and the heading to face INWARD along the road, not at the stage. **Severity:
    High.** Mitigation: rewrite the `main.js` spawn block to read the spawn
    hub's primary-road bearing from the plan/`approachRoadsOf` and orient along
    it; the arch descriptor (now spawn-only, built in `main.js` per §6, deleted
    from `_computePlan`) must carry the road bearing so spawn + arch + heading all
    derive from ONE quantized axis. Keep `nearestMajorHeart(0,0)` inside the
    module-eval/`buildWorld` path, NEVER between the title tap and `Sound.init()`
    (R31 — the comment at `main.js:210-216` already guards this; preserve it).

-   **V-8 — spawn-clearance must stay a placement VETO, and the arch-on-road now
    competes with it.** R27 (002 BINDING): clearance is "don't place a
    large-collider POI within N m of spawn," never a post-hoc collider removal
    (that orphans the mesh + breaks `byChunk` accounting). The new arch-on-road
    placement puts a hard collider (`chunks.js:1123`, `damage: 4`, two posts) ON
    the road right where Zerble spawns and drives. If the spawn-clearance veto and
    the arch placement both target the same road segment, either (a) the veto
    rejects the arch (no gateway — defeats §6) or (b) the arch posts sit in the
    spawn corridor and Zerble clips them on frame 1. **Severity: Medium.**
    Mitigation: the arch is EXEMPT from spawn-clearance (it's the intended gateway);
    spawn Zerble OUTSIDE the arch posts (the `14 m` beyond, but along the road per
    V-7) with the arch opening (>12 m between posts, `:1121` uses `±6`) wider than
    Zerble; clearance still vetoes stages/trucks/tents near spawn. Verify the
    arrival drive-through at `?perf=low` (R26 — the parked-player + forced-crowd +
    stage-attractor interaction at spawn is already a BINDING-adjacent verify item).

-   **V-9 — `nearestLake` feeds the `F` water penalty but its `dist` is a raw
    `Math.sqrt` float (`water.js:106`).** Spec §3 names `nearestLake` as an input
    to the water penalty. If the penalty branches on `nearestLake(...).dist <
    threshold`, that's an un-quantized `sqrt` compare — the same R8/R20/R30 class
    (the `shoreBand` in-band flip). Two adjacent candidate bisectors near the lake
    boundary disagree per engine. **Severity: Medium.** Mitigation: don't gate the
    penalty on `nearestLake(...).dist`; use the ray-walk `lakeAt` sample-count from
    V-2 (already quantized via `quantize()` inside `lakeContaining`/`lakeAt`,
    `water.js:110-119`). If `nearestLake.dist` IS used, quantize it before the
    compare.

-   **V-10 — `festivalPlan` window-invariance must survive `F` being seeded ONLY
    off the heart.** Spec §7 restates the invariant; the current code already
    satisfies it — `_computePlan(heart)` (`festival.js:172`) takes only the heart,
    is `(seed,epoch)`-memoized (`:153-169`), and the per-chunk filter only SELECTS
    (`placement.js:31-44`). The risk is the `F` computation reaching for anything
    window-relative: it consumes `approachRoadsOf(heart)` (pure, heart-only) and
    `nearestLake` (point-only, pure) — both safe. The trap would be if `F`'s
    water penalty queried `queryPoint(...).heart` or `nearestMajorHeart` (which
    expand windows) to "find the nearby hub" — it must not; `F` is the heart's own
    property. **Severity: Low** (the current structure is correct; this is a
    don't-regress note). Mitigation: assert in the `F` function that it reads only
    `heart`, `approachRoadsOf(heart)`, and point-pure `lakeAt`/`nearestLake`;
    the existing T-series + POI golden (`selftest.js`) catch a regression *if* `F`
    is serialized into the descriptor (see priority step 1).

-   **V-11 — the 0-roads fallback (§3 step 4) is a 16-bearing float scoring with a
    quantized tiebreak — the scoring metric is still float.** Spec §3 step 4
    handles roadless hubs: "sample N=16 bearings, score each by dry open ground
    walked out `core` meters, pick the best (ties → lowest quantized bearing
    index)." The tiebreak is quantized (good), but "score by dry open ground
    walked out" is a float distance (how far the ray stayed dry). Near-equal
    scores between two of the 16 bearings flip per engine BEFORE the tiebreak ever
    fires (the tiebreak only triggers on EXACT equality, which floats rarely hit).
    **Severity: Medium.** Mitigation: same as V-2 — make the per-bearing score an
    INTEGER (count of dry quantized samples along the ray), so two bearings with
    the same integer dry-count hit the quantized-index tiebreak deterministically.
    The 16 bearings are themselves a fixed grid (`k * 2π/16`) so they're
    engine-stable; only the scoring metric needs discretizing.

### Verdict

-   **Verdict**: Proceed with mitigations.
-   **Key Concern**: **V-1 — the front-axis `F` widest-gap selection is a float
    `argmax` over `atan2`-derived bearing widths, and it rotates the ENTIRE hub.**
    This is R20 (002's BINDING cross-engine trig fork) re-instantiated on a new,
    far higher-leverage surface: where R20's worst case forked one road choice or
    one offset sign, an unquantized `F` selection forks the orientation of the
    stage, dancefloor, chair band, tiki edge, AND (at spawn) the arch + Zerble's
    heading — two players on the same seed see the hub facing different ways on
    Safari vs Chrome. The gap-width comparison and the water-penalty score MUST
    quantize to an integer key (bin bearings to a fixed angular grid, integer gap
    widths, integer/discrete water penalty, integer sort with a low-index
    tiebreak) BEFORE any threshold compare — and the chosen quantized `F` must be
    SERIALIZED into the descriptor so the existing POI golden (`selftest.js`
    `poiAcc`, recorded node + browser) can actually see it. A `F` that is computed
    but not serialized is the R18 false-confidence trap one layer up: the golden
    stays green and proves nothing.
-   **Recommendation**: The thesis (one front axis every piece obeys) is sound and
    the determinism scaffolding from 002 is already in place and correct
    (clusterSeed regime R19 shipped at `chunks.js:1097`; POI golden + T6
    window-invariance shipped at `selftest.js:127,152`; ownership filter pure at
    `placement.js`). The new work opens four fresh determinism seams — V-1 (hub
    rotation), V-2/V-9/V-11 (float scoring/penalty), V-3 (tree-clearing rng order)
    — and three integration crash/geometry seams — V-6 (new-builder return shape),
    V-7 (arch-move breaks spawn math), V-8 (arch-vs-clearance) — every one
    mitigable in design before code. Gate the build on: (1) `F` quantized to an
    integer key and serialized into the descriptor, golden green on node AND a
    browser engine; (2) the dancefloor clearing carried as quantized plan data
    into `scatterWorldgenTrees`, never a registry lookup; (3) the `main.js` spawn
    block rewritten to the road-bearing axis in the SAME slice the arch moves; (4)
    a real-game boot at the spawn hub + a food-court chunk on every content commit,
    `?perf=low/mid/high`, checking `preview_console_logs` for the new-builder
    `TypeError`. Do not flip `DEFAULT_WORLDGEN_V2` to true until that boot is green
    (R23 — the live deploy is watched by real players).
