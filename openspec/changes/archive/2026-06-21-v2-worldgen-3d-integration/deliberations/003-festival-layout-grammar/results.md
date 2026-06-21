# Deliberation Summary — Festival Layout Grammar (003)

## Context

-   **Task**: Stress-test the FESTIVAL LAYOUT GRAMMAR spec
    (`festival-layout-grammar.md`) before rebuilding `src/worldgen/festival.js`.
    The grammar replaces independent per-piece placement with one computed
    **front axis `F`** that every entity obeys (§3 front-axis, §4 placement
    rules, §5 overlap guard, §6 spawn arch, §7 determinism).
-   **Personas Consulted**: Architect, Adversary, Profiler, Anthropologist,
    Pragmatist + Mediator (synthesis mode — tensions surfaced by the Mediator).
-   **Date**: 2026-06-07
-   **Verdict spread**: all five Proceed / Proceed-with-mitigations. No Block.

---

## Synthesized Plan — Change Groups

> The five mitigation threads collapse into **one tight grammar-core slice
> (CG2)** plus a **harness-first prerequisite (CG1)**, **quality gates (CG4)**,
> and **parked fast-follows (CG5)**. CG1–CG4 map to Pragmatist's "Slice 1, judge
> one hub, then continue." Everything else is parked to keep the one-variable
> signal clean.

### Change Group 1: Harness + contract prerequisites (FIRST, before any `_computePlan` rewrite)

**Scope**: Make the grammar's new primitives *visible* and *typed* before they
exist in code. Pure-layer/visual prep only — no placement logic yet.
**Estimated effort**: ~an afternoon (overlay) + a small contract decision.
**Maps to**: spec §3 (the keystone made legible), Anthropologist binding #1,
Architect priority #1, Profiler priority #1.

**Tasks**:
1. **Extend the `map-sandbox.html` 2D `festival` overlay** (draw loop at
   `map-sandbox.html:267-312`, layer already `checked` at `:88`, `festival.js`
   already in the `wg` importmap at `:26-28` — no importmap change) to render,
   per hub: the **front axis `F`** ray from the hub center; the **road outward
   bearings + angular gaps** with the *chosen* widest-dry-gap highlighted; the
   **dancefloor clearing rect** (oriented, drawn against the stage footprint so
   depth/width are dial-able); the **sector tint** (front=dancefloor,
   drag=rows/court, back=camps+drum); and on the spawn hub only, the **arch +
   spawn point + drive-in vector**. This converts "drive and squint" into "open
   the map sandbox and read it." It is the 003-level recurrence of 002's binding
   R21 gate — the old overlay draws independent markers; the grammar's whole
   value is the *relationship*. Build it before the feature.
2. **Settle the plan contract** before writing placement rules (Architect #1):
   `festivalPlan(heart)` keeps returning the **flat descriptor array**, and the
   dancefloor clearing is exposed as **plan data** — either a sibling pure export
   `dancefloorRectsNear(AABB)` or a `kind:'dancefloor_clear'` descriptor with no
   model — so the tree layer consumes clearings without importing plan internals.
   Decide this now; CG2 task 3 depends on it.
3. **Move stage `scale` into the plan**, seeded off `clusterSeed` (Architect #2).
   Today the runtime stage scale is rolled inside `buildStage` from `ctx.rng`
   (`chunks.js:2094-2096`); the dancefloor rect and the model must agree, so the
   scale must be deterministic plan data the rect derives from. This is the
   determinism-correct home anyway.
4. **Correct the stale `MAX_POI_REACH` comment** (`festival.js:50-58`): it
   documents "major core (350)" but the LIVE value is `major.core = 100`
   (`constants.js:22`, confirmed). Re-derive `MAX_POI_REACH` from the live
   `maxCore + DRUM_BAND + dancefloorDepth` and keep the `≤ 440` heartsInBounds
   pad assertion (R16). **All §4 sizing reads the live `heart.core`, never a
   literal 350.**

### Change Group 2: Grammar core — the `F` rewrite of `_computePlan` (the one shippable slice)

**Scope**: The whole "does this read as a festival now" answer, flag-off, in the
pure layer plus one cross-module tree edit plus an arch deletion.
**Estimated effort**: Small — a rewrite of one pure function (`_computePlan`)
that re-aims eight builders that already take `(x,z,yaw)`, + ~10-line tree edit,
+ ~15-line guard, + a deletion. Pragmatist's "Slice 1."
**Maps to**: spec §3/§4/§5/§6, A3/A4/A5/A6/A8/A1/A2.

**Tasks** (in dependency order):
1. **`computeFrontAxis(heart, roads, lake)` — the keystone (§3), pure, in
   `festival.js`, QUANTIZED.** Widest-dry-gap bisector between road outward
   bearings, water-penalized. **Selection must be a pure integer sort, no float
   compare** (Adversary V-1, the Critical concern): bin each road bearing to a
   fixed angular grid (e.g. `round(bearing / (2π/256))` → index 0..255), compute
   gaps as integer index differences, and the water penalty as a **discrete
   integer count** of in-lake/`noBuild` ray samples (Adversary V-2/V-9/V-11) —
   walk the ray on `quantize()`d sample points (reuse the `roads.js`
   `crossesWater` pattern, `roads.js:106-116`). Final selection key:
   `(clearGapWidthIdx desc, penaltyCount asc, lowest startIdx)`. 0-road fallback
   (§3.4): 16 fixed-grid bearings scored by **integer** dry-sample count, tie →
   lowest quantized index. Derive yaw/coords from the quantized index; `desc()`
   already `quantize()`s the final coords. **The `F` ray-walk distance and
   dancefloor depth size off the LIVE `heart.core` (=100), not the stale 350.**
   Add the quantized `F` index to the descriptor stream so the golden sees it.
2. **Re-aim the §4 placement rules in `_computePlan` to `F` + the drag.** Stage
   yaw → `+F` (feed `buildStage`'s existing `yaw` instead of
   `roadFacingYaw(facing)`). Drag = `roads[0]` (already sorted longest-first).
   Vendor rows + food court walk OUT past `core + dancefloorDepth` on the drag,
   perp-offset off the corridor (reuse `walkOriented`/`perpOff`,
   `festival.js:94,110`). Drum circle stays `treedDistrictSpot` constrained to
   BACK/side of `F`. Porta-banks at margins (re-aim `addPotty`). **Keep the
   cluster-local-rng regime UNCHANGED** (Adversary #2): do not add/remove/reorder
   a `desc()` push or `idx++` for non-feature reasons; the `clusterSeed(heart,
   idx)` sequence is load-bearing. **Assert every re-aimed cluster CENTER stays
   ≤ `MAX_POI_REACH`** or `placement.js` silently drops it (Architect, R16).
   Watch each re-aim land in the CG1 overlay before booting.
3. **Dancefloor clearing as a QUANTIZED RECT carried on `ctx.region`, honored by
   `scatterWorldgenTrees` — the one cross-CHUNK seam (the convergent hazard).**
   The clearing is a **cross-CHUNK** dependency, not within-chunk: a stage's
   dancefloor (~3 stage-lengths in `+F`) routinely spills into a NEIGHBOR chunk
   whose `scatterWorldgenTrees` (`chunks.js:988`) cannot see it via the current
   `ctx.region`/registry path and may run *before* the stage's chunk builds
   (Architect Structural Risk #1). Resolution (Architect + Adversary + Profiler
   converge): a **new pure `dancefloorRectsNear(chunkAABB)` export**, keyed off
   OWNING HEARTS via the same `MAX_POI_REACH` AABB-expand pattern
   `placement.js:38` uses, carried as quantized oriented rects on `ctx.region`
   (same channel as `ctx.region.roads`, `chunks.js:1001`). **Never a
   `registry.closest('stage')` lookup** (window/load-order dependent → R18
   window-invariance break) and **never a per-tree-attempt `festivalPlan()` /
   `queryPoint()` call** against the 8 ms R7 gate (Profiler Key Concern). The
   tree loop fetches the rects ONCE at the top, then tests each candidate with
   oriented point-in-rect math (precompute the rect's `sin/cos` from the
   QUANTIZED `F` bearing once per rect — Profiler). Reorder nothing else in the
   scatter loop; the reject changes draw order but `scatterWorldgenTrees` is the
   last scatter and nothing reads its rng downstream (Adversary V-3, contained).
4. **§5 overlap guard — a pure deterministic pass at the tail of `_computePlan`.**
   Operate on the existing `footprint` field (`KIND_FOOTPRINT`,
   `festival.js:63`). It is a LAYOUT-layer concern, not a build-layer one
   (Architect) — keep it pure, seeded off the heart, so it composes with the plan
   memo + window-invariance. It **complements, does not replace**, the existing
   `closestBuilding` cross-load-order guard in `placeWorldgenProps`
   (`chunks.js:1082`) — two guards, two scopes. Iterate in the **fixed
   `_computePlan` push order** (no unstable float sort), `quantize()` the
   pushed-out position, and the drop branch must **not re-index survivors'
   `clusterSeed`** (Adversary V-4): capture `idx` BEFORE the guard runs. Add a
   selftest assertion that dropping/keeping a cluster does not change any
   surviving cluster's `clusterSeed`.
5. **Arch → spawn only, and rewrite the `main.js` spawn block in the SAME slice
   (the coupling that silently regresses if split).** Delete the per-hub `arch`
   descriptor (`festival.js:199-207`) AND rewrite `main.js:217-245` together. If
   the descriptor is deleted alone, `plan.find(...'arch')` returns `undefined`,
   the `if (stage && arch)` guard fails, and spawn silently falls back to legacy
   `(0,65)` — boots clean, smoke test passes, intended arrival gone (Architect +
   Adversary V-7). The current block derives spawn from `arch - stage` and faces
   the stage head-on (`main.js:225-228`, confirmed) — but §6 puts the arch
   straddling the approach ROAD and the stage faces a GAP (a different sector),
   so `arch - stage` is no longer the road direction. **Derive spawn point +
   arch + heading from ONE quantized road bearing** (`approachRoadsOf(spawnHeart)
   [0].bearing`, outward): spawn just outside the arch on the road, face INWARD
   along the road. The arch is a **singleton with NO chunkKey** (built outside
   the chunk system, like the persistent lake colliders that deliberately omit
   `chunkKey`, footgun #5) — never tag it with a borrowed chunkKey. **Exempt the
   arch posts from spawn-clearance** (it's the intended gateway), keep the >12 m
   post opening wider than Zerble, keep `nearestMajorHeart(0,0)` at module-eval
   (NEVER between the title tap and `Sound.init()`, R31 — the existing comment at
   `main.js:210-216` already guards this; preserve it). A2 banner: the back-face
   "FESTIVAL" mirror is a texture flip on an already-`DoubleSide` banner
   (`entranceArch.js:37`) — minutes, rides along.

### Change Group 3: Re-record the determinism golden (rides with CG2)

**Scope**: Keep the determinism net honest across the rewrite.
**Estimated effort**: Minutes (infra exists).
**Maps to**: spec §7, R18/R20.

**Tasks**:
1. **Re-record the POI golden on node AND a browser engine** in the same commit
   that lands CG2. The POI golden WILL move (expected, flag-off, §7) — deleting
   the per-hub arch alone removes an `idx` draw; the re-aim + guard move
   positions. The `queryPoint` golden must STAY stable (POI layer must not touch
   the queryPoint tuple). **The chosen quantized `F` must be serialized into the
   descriptor** so `selftest.js`'s `poiAcc` (`:53`) hashing + T6 major-window-
   invariance (`:127`) actually exercise it — an `F` that is computed but not
   serialized is the R18 false-confidence trap one layer up (Adversary Key
   Concern). Confirm `DEFAULT_WORLDGEN_V2` stays **false** before the first
   commit (R23 — live deploy is watched).

### Change Group 4: Quality gates — judge one hub, then stop (THE CHECKPOINT)

**Scope**: Prove the slice reads right and doesn't regress determinism/perf/boot.
**Estimated effort**: Verification only.
**Maps to**: spec §9.5, CLAUDE.md "ALWAYS boot the main game," performance.md.

**Tasks**:
1. **2D-first, then 3D for the arrival.** Verify `F`, every re-aim, the
   dancefloor rect, the sectors, AND the §6 arrival geometry in the CG1 overlay
   BEFORE booting. The 3D hub composite is **correctly declined** (Anthropologist
   agrees with 002's call — it would re-implement the build half and risk the
   `buildCampChair` sandbox-pass/game-fail class), so the arrival is real-game-
   only by construction.
2. **Boot the real game at `?worldgen=1`** (mandatory, non-skippable): title card
   → start → drive in through the spawn arch. Confirm stage reads off to the side
   (Gary's §6 call), dancefloor clear in front, no chairs in water, no row
   through stage, no court with road/porta inside. **Boot the game immediately
   after CG2 task 3** (the A4 tree edit), not batched — it's the one pure/build
   seam and the highest sandbox-pass/game-fail surface (Pragmatist + Adversary
   V-6). Screenshot noon + midnight.
3. **Boot at three hub types** (Adversary): the spawn major, a roadless minor
   (exercises §3.4 fallback), and a lakeside hub (exercises the water penalty).
   Check `preview_console_logs` for new-builder `TypeError` (the `{group,...}`-
   vs-bare-Group crash, V-6) on every content commit; have the spawn block LOG
   the resolved hub/arch/stage so a bad resolve surfaces instead of a silent
   face-the-void (Anthropologist).
4. **Headless node chunk-gen gate at 8 ms** (Profiler, the binding perf gate —
   the browser HUD is hidden-tab-throttle-inflated, D-Q): drive `_generate` over
   a corridor crossing a major hub center, then FORCE the R24 worst-case stacked
   chunk (hub center that is ALSO lakeshore + camp village + drum circle) and
   assert `chunkGenStats.lastMs ≤ 8` at low (`forestTreeDensityMul = 0.7`) and
   mid (`1.0`). If it breaches, the escape hatch is **deferring the drum-circle +
   camp build within the anchor chunk across 1-2 frames** (a sub-chunk queue) —
   NOT thinning content; park that queue until the gate proves it's needed.
5. **Foreground low-tier draw/tri read** (Profiler): a hub-center view is the
   densest single frame in the game; verify `?perf=low` stays under 80 draws /
   150k tris (instancing tents is the lever if it breaches, not thinning).
   Check `?perf=low` AND `?perf=mid`, never sign off on high alone. **No
   `castShadow = true`** on any new clearing-edge prop.

### Change Group 5: Parked fast-follows (after the checkpoint, separate slices)

**Scope**: Texture/variety/new-entities on a hub that already reads right. Park
to keep the one-variable signal clean (Pragmatist + Anthropologist converge).
**Estimated effort**: Out of this slice.

**Tasks** (tracked on ROADMAP, NOT silently cut):
1. **PARK** C2 (picnic-table model + crowd seating state — importmap×3 + sandbox
   entry + hit kind + new crowd state; A7 reserves the plaza space NOW as a
   larger ring radius, tables drop in later — Pragmatist). If/when built, it MUST
   pool (`userData.shared`, Profiler) — one geometry + a small material bucket,
   same pattern as `SUPPLY_CAN_GEO`.
2. **PARK** C1 (tree-anchored hammock post-pass — stacks a second mechanism on
   the A4 tree-scatter edit; separate to keep the A4 signal clean).
3. **PARK** B1 (tent-stage variety), D1/D2/D3 (camp rules + tent-count-to-crowd
   + camps-behind-vendors), G1 (picnic blankets), C3 (tiki edge markers), F1
   (lone field trees), E1/E2/H1. B2 (verify full drum circle) is free during the
   CG4 boot.
4. **PARK HARD** the density re-settle + the 23/24 negative-control-teeth
   decision until after the checkpoint — moving density mid-rebuild destroys the
   "did the GRAMMAR work?" signal (one-variable rule).
5. **TRACK on ROADMAP** (not a grammar concern, but Gary-load-bearing): the
   **inter-hub continuity** — "one infinite festival" means the GAPS between hubs
   must not feel dead (Anthropologist). The grammar is hub-local; the "woods stay
   at the back/sides, only clear the front" rule (§3, A4) is the continuity glue
   — keep it load-bearing. Owned by the density re-settle, tracked so it isn't
   lost behind the grammar win.

## Final Recommendation

**Proceed.** Ship CG1 (harness + contract) then CG2 (the `F` rewrite) as one
flag-off slice, run the CG3 golden re-record and CG4 checkpoint, and let Gary
judge one hub before touching anything in CG5. The cost calculus is unusually
favorable — the build half, the harness, the spawn block, and the determinism
golden all already exist on disk; this is a rewrite of one pure function plus one
cross-module tree edit plus an arch deletion. The non-negotiables are: quantize
`F` to an integer key and serialize it into the descriptor; carry the dancefloor
clearing as quantized plan data into `scatterWorldgenTrees` (never a registry or
per-tree query); and land the arch deletion + `main.js` spawn rewrite in the SAME
slice.

---

## Convergence Points

-   **The thesis is sound.** All five accept "one front axis `F` every piece
    obeys" as the correct structural fix for an *arrangement* (not density)
    problem. No persona challenges the grammar's premise.
-   **`F` must be quantized to an integer key before any threshold compare, and
    serialized into the descriptor.** Adversary (Critical), Profiler, Pragmatist,
    Architect all name R20/footgun #4 — and Adversary + Architect both insist the
    quantized `F` land in the descriptor stream or the golden is blind to it.
-   **The dancefloor clearing is a cross-CHUNK pure query, not a registry lookup
    and not a per-tree worldgen call.** Architect (Structural Risk #1, Key
    Concern), Adversary (V-3), and Profiler (Key Concern) independently converge
    on: a new pure `dancefloorRectsNear(AABB)` keyed off owning hearts via the
    `MAX_POI_REACH` AABB-expand pattern, carried as quantized rects on
    `ctx.region`.
-   **Arch deletion and the `main.js` spawn rewrite must land together.**
    Architect (priority #5) and Adversary (V-7) both flag the silent
    legacy-spawn fallback; both prescribe deriving spawn+arch+heading from one
    quantized road bearing.
-   **Keep the cluster-local-rng / `clusterSeed(heart, idx)` regime UNCHANGED.**
    Architect, Adversary (#2, V-4), Pragmatist all warn against reordering
    `desc()` pushes or `idx++` for non-feature reasons.
-   **Ship the grammar core as one slice, judge one hub, park the rest.**
    Pragmatist's slice ordering; Anthropologist's "texture doesn't gate 'reads as
    designed'"; Profiler's "don't pre-split frames until the gate breaches."
-   **The 3D hub composite is correctly declined; the arrival is real-game-only.**
    Anthropologist explicitly agrees with 002's call.

## Conflicts Resolved

| Conflict | Position A | Position B | Resolution | Rationale |
| -------- | ---------- | ---------- | ---------- | --------- |
| **Verdict label** | Pragmatist: **Proceed** (clean) | Architect/Adversary/Profiler/Anthropologist: **Proceed with mitigations** | **Proceed with mitigations** — adopt the binding mitigations as CG tasks | Superficial conflict. Pragmatist's clean Proceed assumes the determinism + cross-chunk mitigations are obvious; the others make them explicit. Safety/correctness trumps — name them as tasks (resolution hierarchy #1). |
| **Build order: keystone-first vs harness-first** | Architect/Adversary/Profiler/Pragmatist: `computeFrontAxis` first | Anthropologist: extend the 2D overlay FIRST, then `F` | **Harness-first (CG1 before CG2).** Draw the primitives, then build `F`. | Not a real conflict — the four "F first" personas mean "F is the first *placement* work"; Anthropologist's overlay is verification infrastructure that gates it. Project doctrine: build the harness, then the feature (CLAUDE.md). The overlay is cheap (data exposed, importmap wired). Verifiability over speed (#3). |
| **Where does stage `scale` live?** | Architect: move stage scale INTO the plan (off `clusterSeed`) | Spec: scale rolled in `buildStage` from `ctx.rng` (`chunks.js:2094`) | **Move it into the plan** (CG1 task 3) | The dancefloor rect and the stage model must agree on size; the rect is plan data, so the scale must be deterministic plan data too. Architecture adherence + determinism-correct (#2). |
| **Two overlap guards or one?** | Architect: keep BOTH (pure layout guard in `_computePlan` + `closestBuilding` in `chunks.js`) | Spec §5: describes one footprint guard | **Two guards, two scopes** — name both explicitly | The layout guard handles intra-heart overlap (pure, window-invariant); the `closestBuilding` guard handles inter-heart/cross-load-order stacking (registry). Collapsing them re-introduces a load-order dependency. Architecture adherence (#2). |
| **`MAX_POI_REACH` sizing source** | Adversary V-5: size off LIVE `heart.core` (=100); fix the stale comment | Spec §4: sizes off "core" but the in-file comment says 350 | **Size off the live `heart.core`; correct the comment** (CG1 task 4) | Confirmed on disk: `constants.js:22` = `major.core: 100`, `festival.js:52` comment says 350. An agent reading 350 over-reaches the dancefloor + ray-walk 3.5×. Ground truth wins. |
| **Perf: pre-split the anchor-chunk build?** | Profiler: do NOT pre-split until the 8 ms gate breaches | (implicit "stack is denser" worry) | **Accept the spike, instrument it; defer drum+camp within the chunk ONLY if the headless gate shows >8 ms** | performance.md: don't optimize before you measure. The sub-chunk queue is the escape hatch, parked until proven needed (#5 simplicity). |

## Risk Register

| Risk | Severity | Mitigation | Owner |
| ---- | -------- | ---------- | ----- |
| `F` widest-gap selection is a float `argmax` over `atan2`-derived widths → a V8/JSC epsilon flips the gap and rotates the ENTIRE hub per engine (R20 on a higher-leverage surface) | **Critical** | Bin bearings to a fixed angular grid; integer gap-width argmax + lowest-index tiebreak; integer/discrete water penalty; quantize before any compare; serialize the quantized `F` into the descriptor | Adversary (V-1) |
| Dancefloor clearing read via registry lookup or per-tree `festivalPlan`/`queryPoint` → window-invariance break (R18) AND/OR 8 ms R7 gate breach on a treed hub-center chunk | **High** | New pure `dancefloorRectsNear(AABB)` keyed off owning hearts (MAX_POI_REACH AABB-expand), quantized rects on `ctx.region`, fetched once per scatter, oriented point-in-rect with precomputed `sin/cos` | Architect (SR#1) / Adversary (V-3) / Profiler (Key) |
| Arch descriptor deleted without rewriting `main.js:217-245` → silent legacy `(0,65)` spawn fallback that boots clean | **High** | Land deletion + spawn rewrite in ONE slice; derive spawn+arch+heading from one quantized road bearing | Architect (#5) / Adversary (V-7) |
| New builders (picnic table, tent-stage) return `{group,...}` instead of bare Group → `Cannot read properties of undefined (reading 'set')` at world-gen; sandbox passes, game crashes | **High** | One-line return-shape comment per builder; defensive call-site extraction; boot the real game at the food-court chunk on each content commit (C2/B1 are PARKED, so deferred) | Adversary (V-6) / Profiler |
| Water-penalty / 0-road-fallback scoring is a float threshold → near-tie candidates fork per engine before the quantized tiebreak fires | **High** | Discrete INTEGER scores (dry-sample count), quantized sample points; `(intScore, lowest-index)` sort; don't gate on raw `nearestLake().dist` | Adversary (V-2/V-9/V-11) |
| R24 stacked hub-center chunk (stage+courts+rows+drum+camps, worst case also lakeshore) exceeds 8 ms; 1-chunk/frame budget can't split it | **High** | Headless node gate forcing the worst-case chunk under 8 ms at low+mid tree-mul; sub-chunk defer queue as escape hatch (parked until gate breaches) | Profiler |
| A front-axis-relative cluster CENTER pushed past `MAX_POI_REACH` (480 m) → `placement.js` silently drops it → "hole in the festival" (R16) | **Medium** | Assert every re-aimed center ≤ MAX_POI_REACH, or bump it and re-verify the `placement.js:36` reach math + R16's 440 m pad | Architect |
| Overlap-guard drop branch re-indexes survivors' `clusterSeed` → window-dependent positions | **Medium** | Capture `idx` BEFORE the guard; guard is a post-process over the fixed push order; quantize pushed positions; selftest asserts drop/keep doesn't move a survivor's seed | Adversary (V-4) / Architect |
| Arch-on-road collider competes with spawn-clearance → either no gateway or Zerble clips a post frame 1 (R27) | **Medium** | Exempt arch from spawn-clearance; spawn OUTSIDE the posts along the road; >12 m post opening; clearance still vetoes stages/trucks near spawn | Adversary (V-8) |
| New picnic table (when un-parked) not pooled / `userData.shared` → shader-recompile storm on chunk unload | **Medium** (deferred — C2 parked) | One pooled geometry + small material bucket, `userData.shared = true`; no `castShadow` | Profiler |
| Stage off-side `F` near-perpendicular to the approach road → "where's the stage / empty field" arrival | **Medium** (feel) | Draw the arrival in the overlay; if it reads empty across seeds, add a soft preference for an `F` gap not near-perpendicular to the primary road, OR accept and let the gate carry "you've arrived" — decide by looking, not by spec | Anthropologist |
| Inter-hub gaps feel dead → "one infinite festival" framing lost even though a hub reads great | **Medium** (feel, deferred) | Keep "woods stay at back/sides, clear only the front" load-bearing; track inter-hub continuity on ROADMAP under the density re-settle | Anthropologist |
| `F` reaching for window-relative data (`queryPoint(...).heart`, `nearestMajorHeart`) → window-invariance break | **Low** | Assert `F` reads ONLY `heart`, `approachRoadsOf(heart)`, point-pure `lakeAt`/`nearestLake`; T-series + POI golden catch a regression IF `F` is serialized | Adversary (V-10) |
| `DEFAULT_WORLDGEN_V2` flipped during WIP → in-progress layout ships to watched live deploy (R23) | **Low** | Confirm flag stays `false` before the first commit; don't flip until the full checkpoint is green | Pragmatist / Adversary |

## Verdicts Summary

| Persona | Key Concern | Verdict |
| ------- | ----------- | ------- |
| Architect | Dancefloor clearing (A4) is a cross-CHUNK dependency the spec treats as within-chunk — needs a new pure `dancefloorRectsNear(AABB)` keyed off owning hearts, not a same-chunk flag | Proceed with mitigations |
| Adversary | `F` widest-gap selection is a float `argmax` that rotates the ENTIRE hub per engine (R20, Critical) — quantize to an integer key AND serialize into the descriptor | Proceed with mitigations |
| Profiler | The clearing must hand `scatterWorldgenTrees` a precomputed memoized rect list (cheap point-in-rect), NEVER a per-tree `festivalPlan`/`queryPoint` call against the 8 ms R7 gate; R24 stacking reopened | Proceed with mitigations |
| Anthropologist | Extend the 2D map-sandbox overlay to draw `F`/gaps/dancefloor rect/sectors/arrival BEFORE rewriting `_computePlan` (003-level R21); verify the §6 arrival in 2D then boot it | Proceed with mitigations |
| Pragmatist | The A4 tree-clearing is the one pure/build seam (highest sandbox-pass/game-fail surface) the overlay can't fully verify — boot the game to eyeball the cleared dancefloor immediately after that step, not batched | Proceed |
