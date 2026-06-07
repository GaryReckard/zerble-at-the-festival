---
change: v2-worldgen-3d-integration
status: in_progress
current_task: Festival-layout redesign (placement quality) — deep-plan → deliberate → apply → verify → smart-review (Gary feedback 2026-06-07)
blocked_by: null
open_questions: 0
started: 2026-06-06
last_updated: 2026-06-07
ref: procedural-map-generator change (2D generator + sandbox, complete); ROADMAP "World generation (procedural map)" → "Wire the generator into the live 3D world as v2 worldgen"
---

# Session Log: v2 Worldgen → 3D Integration

> **AGENT DIRECTIVE:** New session / after compaction — read this file + `tasks.md`
> and `HANDOFF.md` before doing anything else. Frontmatter → Current Status →
> latest Work Log entry. This change WIRES the 2D `src/worldgen/` generator (built
> by the `procedural-map-generator` change) into the live 3D game.

## Current Status
**Phase:** APPLY. Artifacts done (proposal/design/specs/tasks); `/deliberate` complete
(5 council + mediator, synthesis — all "Proceed with mitigations", 0 blocks; results.md
folded into tasks.md as Groups A–I). Group A (paperwork) done. Now implementing.
**Doing:** Group D DONE + verified (heart anchors + role×rank scatter visible in-game at a
major heart; both flag states boot clean; self-test 20/20 golden unchanged). Next: Group E (lakes).
**Resolved delivery order:** A(paperwork ✓) → B scaffold ✓ → C roads ✓ → D placement ✓ →
**E lakes** → F forests → G crowd → H gates → I docs. Junction-merge DEFERRED to a 2D-only
fast-follow change.
**Flag:** `DEFAULT_WORLDGEN_V2 = false` in perf.js (legacy ships by default while building);
test v2 with `?worldgen=1`; flip default to true at landing (task I.0).
**Next:** Group E — `LakeManager` reads worldgen lakes (smallest blast radius). The binding
gate is R5 (lake collider winding sign-flip: worldgen `_computeLake` winding vs `lakes.js`
CCW-inward-normal + reverse-walk assumption — assert signed area BEFORE the swap, fix
reverse-walk + normal sign as a PAIR; DoubleSide masks the visual so it only shows as missing
collision). Also R5-adjacent: lakes keep NO chunkKey (footgun #5). `_generateWorldgen` already
stores `ctx.region.lakes` (ready, currently unused by placement — placement honors worldgen
`noBuild` which already includes worldgen `lakeAt`).
**Blocked:** Nothing.
**Binding apply-gates (the 6 High/Critical risks):** R1 road source-of-truth=RAW (done in
design), R2 heart-anchor boot crash, R3 forest ~80/chunk cap, R4 (roleTier,rank) tuple key,
R5 lake winding sign, R6 ROAD_MAT userData.shared. See results.md Risk Register.

## Key Decisions
<!-- APPEND-ONLY. Number sequentially with D-prefix. Full rationale in design.md. -->
- **D1 — Chunk system stays as the streaming/LOD engine; only the content-selection
  layer is replaced.** `chunks.js` keeps its load ring + 1-chunk/frame budget +
  chunkKey lifecycle. `pickTheme`/`THEME_BUILDERS`/`+`-grid are replaced by a
  per-chunk worldgen sampler. Rationale: the streaming engine is good; the dice-roll
  content is the problem.
- **D2 — Ship behind a feature flag (`USE_WORLDGEN_V2`, `?worldgen=0` to disable).**
  Keeps the game bootable + gives a rollback during a world-regenerating break.
- **D3 — Worldgen lakes/roads are persistent (no chunkKey, footgun #5); chunk-owned
  props keep chunkKey.** LakeManager keeps owning mesh/collider/lifecycle but READS
  positions/outlines from worldgen.
- **D4 — Contract tuple is append-only across the 2D→3D boundary** (existing rule).
- **D5 — Road junction-merge is a deterministic, window-bounded 2nd pass, worked out
  in the 2D sandbox first** (Gary 2026-06-06, the "lens" redundancy).
- **D6 — Road SOURCE-OF-TRUTH = RAW arterials (post-deliberation).** The 3D game consumes
  the raw per-edge arterial network for render + `noBuild`/`facing`/crowd gates;
  `nearestRoad`/`roadsInBounds` unchanged → self-test green by construction, golden stable,
  no merge math in the hot path. The junction-merge is DEFERRED to a separate 2D-only
  fast-follow change. (Adversary V1 / Architect #7 / Pragmatist; design.md "D-I REVISED".)
- **D7 — Placement is a pure→build split (Group D).** `worldgen/placement.js` (pure, may
  import sibling worldgen modules but NOT three/models) decides WHAT/WHERE as plain descriptors
  `{kind,x,z,yaw,footprint,role,rank,anchor}`; `chunks.js placeWorldgenProps` does build +
  `registry.add`. Rationale: keeps the self-test/map-sandbox runnable (Architect #3) and isolates
  the crash-prone build half on the three side. The anchor was scoped to **one signature
  structure per heart** (major→main_stage+food_court, minor→side_stage) rather than the design's
  fuller main+court+vendor_rows cluster — vendor_rows folded into core scatter to avoid a
  multi-chunk-spanning anchor for the first cut. Scatter uses 10 fixed candidate slots/chunk with
  per-role density (core 0.62/max4, district 0.48/max3, outskirts 0.14/max2) — bounded for R7.
  `facing` → three.js yaw via `π/2 − facing` (derived: a group at yaw θ maps local +Z to world
  (sinθ,cosθ); set equal to the road direction (cos f, sin f)). `buildStage` gained a `yaw=0`
  param (legacy byte-identical) routing its registry world-positions through a rotation helper.

- **D8 — Festival layout redesign (placement quality) + /deliberate 002 resolutions.** Gary flagged
  the Group D scatter as too random (solo sugar shacks, no clustering). Redesign = port the tuned legacy
  clustering rules, re-anchor off the chunk grid to hearts/roads/lakes (design.md D-K..D-Q). Council 002
  (5 personas + mediator, all Proceed-with-mitigations) resolved six tensions → re-sequenced D2 into
  CG1 (harness gates first) → CG2 (decision layer) → CG3 (build + spawn) → CG4 (back-of-festival).
  Binding resolutions: (a) **harness-first** — extend selftest golden to the POI layer + a window-invariance
  check, recorded node AND browser, BEFORE cluster-build (R18); a `festival` POI-overlay in map-sandbox is a
  required harness (R21); headless `chunkGenStats`+memo-hit (R25). (b) **rng-regime** — `festival.js` owns
  all layout randomness via a per-descriptor `clusterSeed`; the build half uses `ctx.rng` only for
  count-stable cosmetic jitter (R19). (c) **ownership-plumbing** — enumerate via explicit
  `heartsInBounds(chunkAABB)`, name `MAX_POI_REACH`, assert `≤440m` (R16). (d) `nearestMajorHeart` bounded +
  deterministic (R17). (e) name the 3 quantized trig compares (R20). (f) spawn-clearance = placement veto,
  not removal (R27); `festival.js` stays a pure data sampler, never a lifecycle manager (R28, D-A). Spawn-at-
  heart is the visible-win Slice 1. Parked to fast-follows: shoreBand/causeway camps, count-tuning,
  drum-circle dense-forest nesting (Group F dep), cross-frame build-splitter.

## Assumptions
| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | Chunk-clipped worldgen sampling (vs a separate worldgen lifecycle manager) is the right integration shape | High | Open | Confirm in design + apply |
| A2 | `forests.js` 5x5 system is fully replaceable by per-chunk treeDensity scatter (no feature lost) | Med | Open | Verify drum-circle/campsite interiors still reachable |
| A3 | LakeManager can read worldgen lakes with only its placement logic swapped (mesh/collider/lifecycle untouched) | High | Open | Verify in CG lakes |
| A4 | Per-tier perf budgets hold with worldgen geometry (roads as ribbons, density trees) | Med | Open | Measure in backtick HUD at ?perf=low/mid |
| A5 | Crowd attractor/footprint contract needs no change — only what registers | High | Open | Verify crowd clusters at hearts |

## Dangling Threads
<!-- APPEND-ONLY. Strikethrough when resolved. -->
- Cross-engine golden already differs (Node vs browser) on lake `sin/cos`; the 3D
  path adds more transcendental-dependent road existence. Must re-verify golden on
  the game path + document; consider integer orientation test if it ever flips a
  collider's existence (not just cosmetics).
- Two lake macrocell sizes today (game 320m vs worldgen 1050m) — the worldgen one wins;
  confirm density/size feel in 3D vs the old lakes players have seen.
- **`_forestPathMat` (forests.js:330) is created at MODULE-EVAL with `depthWrite:false`** — the
  same class that made the worldgen road invisible. The legacy FOREST interior paths may
  therefore be invisible in the shipped game (unverified — forests are sparse, interior paths
  rarely viewed). If confirmed, the fix is the same: build it lazily at runtime. Out of scope for
  Group C (legacy forests are being retired by Group F); flagged as a follow-up. (Tagging it
  `userData.shared` this commit is still correct for the dispose-storm regardless.)
- **Spawn-overlap protection not ported to v2 (Group D).** Legacy `pickTheme` special-cases the
  spawn corridor (chunk (0,1)) to keep large stage/plaza geometry away from the player's start at
  (0,65). v2 placement has no such guard — if a heart center jitters onto/near world spawn, a main
  stage could build on top of the player. Hearts are rare + jittered; seed 1234's nearest hearts
  are (701,-204)/(−103,134), far from spawn, so it doesn't bite the verify seed. Low-priority
  follow-up: skip/relocate an anchor whose center is within ~50 m of (0,65). Parkable.
- **Cross-engine `facing` is float `atan2`** (cosmetic per roads.js header — not hashed). The
  stage-yaw uses it; a low-bit JSC/V8 difference would only wobble a stage's facing by a hair, not
  flip placement. R8 (road EXISTENCE flip) is the real cross-engine gate (Group H.2), unaffected.

## Work Log
<!-- APPEND-ONLY. Newest at BOTTOM. -->

### 2026-06-06 — Kickoff: explore game world systems + scaffold the change
**Intent:** Wire src/worldgen/ into the 3D game (the ROADMAP "big one"). Gary green-lit
a full autonomous run through the OpenSpec pipeline. First understand what I'm replacing.
**Result:** Ran 4 parallel Explore sub-agents → full map of chunks.js (CHUNK_SIZE 80,
1/frame budget, pickTheme salt=1, THEME_BUILDERS, registry add() shape), lakes.js
(LakeManager, 320m cell, no-chunkKey colliders, WATER_MAT shared), forests.js (5x5 blocks,
getForestAt pure-hash, chunk-keyed), boot/render (buildWorld lakes-first→chunks, seed via
SESSION_SEED already reaches worldgen, threeShim Lambert swap, importmap mods/models in
index.html+sandbox.html), registry/crowd/collision (entry schema, 8m spatial hash,
attractor-clustering crowd, circle-circle collision). Wrote proposal.md + this log +
questions file. Architecture decision: chunk = streaming engine, replace content-selection.
**Changed:** openspec/changes/v2-worldgen-3d-integration/{proposal,session-log,questions-for-human}.md
**Refs:** -> D1..D5; continues procedural-map-generator/HANDOFF.md "OPEN/next" item 2.

### 2026-06-06 — Artifacts + Tier-3 deliberation; folded into tasks
**Intent:** Finish the OpenSpec artifacts and run `/deliberate` (the change brushes
determinism/lifecycle/threeShim/perf/boot-order) before any code.
**Result:** design.md (D-A..D-J), 2 specs (worldgen-3d-world, worldgen-road-junctions),
tasks.md written → apply-ready. Ran Tier-3 synthesis deliberation: 5 council personas
(Architect, Adversary, Profiler, Pragmatist, Auditor) + Mediator, all "Proceed with
mitigations", 0 blocks. Mediator's results.md resolved two tensions into one decision:
(1) road source-of-truth = RAW (-> D6), junction-merge deferred to a fast-follow;
(2) reorder to scaffold → roads → placement → lakes → forests → crowd → gates → docs.
Folded the 9 Change Groups (A–I) + 6 binding High/Critical mitigations into tasks.md.
Did Group A (paperwork): D-I REVISED in design.md, append-only/self-test-green reconfirmed.
**Verified:** `openspec status` 4/4 artifacts complete; deliberation folder has briefing +
5 council files + results.md.
**Changed:** design.md (D-I REVISED), tasks.md (rewritten as Groups A–I), session-log.md;
deliberations/001-initial/{briefing,council-*,results}.md.
**Refs:** -> D6; results.md Risk Register R1–R15 (R1–R6 are binding gates). Next: Group B.

### 2026-06-06 — Group B: scaffolding (flag + importmap + placement.js + empty-boot)
**Intent:** Land the force-multiplier scaffolding gate so all content groups have a clean,
flag-gated, boots-clean foundation (Group B; R2/R10/footgun #1/#4).
**Result:**
- B.1: added all 8 `src/worldgen/*` + `worldgen/placement` to the importmap `mods` array in
  BOTH index.html AND sandbox.html (was 0/8).
- B.2: `USE_WORLDGEN_V2` in perf.js — resolved once at module load; `DEFAULT_WORLDGEN_V2=false`
  (legacy ships by default while building; flip at landing I.0); `?worldgen=1`/`=0` override.
  Chose default OFF over the design's "default ON for dev" for production safety (the deploy is
  observed by real players; a half-empty v2 world must never ship by accident).
- B.3: `src/worldgen/placement.js` skeleton — pure + three-free (no `three`/`models` import),
  returns []; landed `isHeartCenterChunk` (R2/D-C) + `ROLE_THEME` (roleTier×rank) table stub
  with the R4 axis-collision warning in the header.
- B.4: reserved `SALT.placement = 0x4D41_0A` (fresh stream, footgun #4).
- B.5: restructured `chunks.js _generate` into a SINGLE `if (USE_WORLDGEN_V2)` branch (R10) →
  `_generateWorldgen(ctx)` (empty for now); legacy path fully under `else`.
**Verified:** syntax OK (perf/placement/chunks); worldgen self-test 20/20 green, golden
**63c8dea2 unchanged** (placement.js inert to the contract). Booted the REAL game:
`?worldgen=1` → v2 empty path, registry `chunkThemedPresent: []` (no stage/tent/truck/tree/
path_node/chair/drum/hammock/picnic), only LakeManager+obstacles+spawn-jugs; `?worldgen=0` →
full legacy world (stage 39, tent 65, tree 209, path_node 26, … 6748 entries). BOTH boot with
**zero console errors**. Screenshot captured.
**Changed:** index.html, sandbox.html, src/perf.js, src/worldgen/{constants,placement}.js,
src/chunks.js; openspec change docs (tasks B✓ + I.0, HANDOFF, session-log).
**Refs:** -> R2 (empty-boot gate passed), R10 (single branch), footgun #1/#4. Next: Group C roads.

### 2026-06-07 — Group C: chunk-clipped RAW arterial road ribbons
**Intent:** Land the biggest visible win (roads) on the v2 path — clip the worldgen
arterials per chunk, build dirt ribbons, register a road crowd waypoint; keep the
single-branch + shared-material + source-of-truth discipline. (Group C; R1/R6/R7/R10.)
**Result:**
- C.1: shared road material (R6); tagged the pre-existing untagged `_forestPathMat`
  (real latent dispose-storm in the SHIPPED legacy game). `_generateWorldgen` now calls
  `queryRegion` ONCE/chunk (D-A/R7), stores `ctx.region` for D/F.
- C.2: `placeWorldgenRoads` + `clipPolylineToBox` (Liang–Barsky) + `buildRibbonFromPolyline`
  (traces the ACTUAL worldgen vertices, not a re-jittered curve → R1 alignment). Verified at
  vertex level: ribbon centerline == clipped arterial (boundary crossings + interior verts),
  width=ROAD_WIDTH(7). Kink-free seams PROVEN: adjacent chunks' ribbon ends coincide to 0.01 m.
- C.3: chunk-keyed road `path_node` (reuses kind → 2 skip-sites stay consistent); legacy
  path_node only in the `else` branch. Verified registry: worldgen=1 has NO themed kinds; worldgen=0 full legacy.
- C.4: net draw delta NEGATIVE (1 ribbon/chunk vs legacy 3). R7 sampler cost measured HEADLESSLY:
  roadsInBounds cold 4.9ms (first chunk) / warm <0.4ms; hearts+lakes negligible — under the 8ms gate.
  No game-path `bumpWorldgen()` clears the memo (R14 ruled out). Booted clean at `?perf=low` (Lambert) + default.
- **FOOTGUN FOUND + FIXED (the bug Gary caught — roads invisible everywhere):** a
  `depthWrite:false` MeshStandardMaterial created at MODULE-EVAL renders INVISIBLY in-game
  (meshes draw under the player-centered ground plane). Proven by in-game A/B + corroborated:
  the legacy `+`-grid paths render only because their material is built per-chunk at RUNTIME;
  `_forestPathMat` (module-eval) is likely also invisible in legacy (see Dangling Threads). Fix:
  create the shared road material LAZILY on first chunk-gen (still one shared instance — R6 intact).
**Verified:** syntax OK; self-test 20/20 golden 63c8dea2 unchanged; roads VISIBLE in the running
game on fresh source (arterial Y-junction, kink-free); BOTH `?worldgen=1` and `?worldgen=0` boot
with ZERO console errors.
**Changed:** src/chunks.js (imports, lazy roadMat, clip+ribbon helpers, placeWorldgenRoads,
_generateWorldgen), src/forests.js (_forestPathMat shared tag); CHANGELOG.md (2026-06-07);
tasks.md (C✓), session-log.md.
**Refs:** -> R1 (RAW source-of-truth, ribbon traces raw arterial), R6 (shared mat + dispose-storm
fix), R7 (sampler cost gate passed), R10 (single branch), R14 (no stray bump). Next: Group D placement.

### 2026-06-07 — Group D: placement.js heart anchors + role×rank scatter (the headline)
**Intent:** Land the correctness headline + highest-crash-risk group — replace the per-chunk theme
dice-roll with worldgen-driven placement: the heart-center chunk builds its heart's anchor; every
chunk scatters its role×rank palette off roads/water. Honor the binding gates R2 (boot crash /
return-shape) + R4 (roleTier×rank tuple key). (Group D; D.1–D.6.)
**Result:**
- **placement.js (pure)** filled in (D.1–D.3): `placeChunkProps(cx,cz,chunkSize,region)` →
  descriptors. Anchors gated by `isHeartCenterChunk` (D.1); `ROLE_THEME` keyed on the
  `${roleTier}×${rank}` TUPLE via `roleKey()`, both enums named+cited in the header (D.3/R4);
  scatter samples `queryPoint` per slot to re-derive role/rank — pure, no registry reach (D.2/R2).
  10 candidate slots/chunk, per-role density caps (R7-bounded). `nudgeOffNoBuild` rings the anchor
  off road/water; `roadFacingYaw = π/2 − facing` converts worldgen facing → three.js yaw.
- **chunks.js (build side)** (D.4): new `placeWorldgenProps` → `buildWorldgenKind` dispatch wired
  into `_generateWorldgen` (replaced the empty `void props`). Reuses legacy builders, world-
  positioned: made `buildStage(ctx,x,z,isMain,yaw=0)` yaw-aware (routes its registry positions
  through a `rot()` helper — legacy callers pass no yaw → byte-identical); split
  `buildDrumCircle`→`buildDrumCircleAt`; added `buildFoodTruckAt`/`buildVendorAt`/`buildPottyBankAt`/
  `buildFoodCourtAt`; `placeSingleCampsite` reused as-is. Defensive scene guards: `isPointInLake`
  (legacy rendered water until Group E) + `closestBuilding` (overlap) before building scatter.
- Return-shape footgun (R2) handled per-builder: stage/drum register internally; the *At helpers +
  campsite extract `.group`/bare-Group exactly as each model demands.
**Verified (sandbox-pass ≠ game-pass — booted the REAL game):**
- Headless (seed 1234 INTEGER — `?seed=1234` parses int-first, NOT the FNV string; this was my
  first-test mistake): chunk (8,-3) = the (701,-204) major-heart center → main_stage + food_court
  + vendor×3 + porta_potty (R4 NOT silently empty); heart sat ON a road (`noBuild`) → nudged off
  to (703.5,-213.7). Deterministic (same chunk twice identical). District/outskirts chunks scatter
  correctly + sparsely.
- In-game at (701,-204), noon (nightness 0) + midnight (nightness 1), `?perf=low`+`mid`+default:
  main stage (band, "FESTIVAL" banner, chairs in the audience facing the rotated stage), food-truck
  court, vendors, porta-potties, worldgen road — stage OFF the road + FACING it (stages-on-roads
  structurally gone), lake clear (nothing in water). Night: stage light show + beam pool on the
  road + lit truck windows all read. ZERO console errors every boot (R2 passed — longest call
  chain clean). Legacy `?worldgen=0` origin stage+arch+crowd byte-identical (yaw-0 path), clean.
- Self-test 20/20, golden **63c8dea2 unchanged** (placement only reads the contract). Per-chunk
  placement sampler cost (headless — browser HUD throttle-inflated): 2.5–4.4 ms warm / 8 ms
  cold-once, under the 8 ms R7 gate. Full per-tier draw/tri budget pass → Group H (H.3).
**Changed:** src/worldgen/placement.js (anchors+scatter+roadFacingYaw+nudge), src/chunks.js
(yaw-aware buildStage, buildDrumCircleAt split, placeWorldgenProps + buildWorldgenKind +
buildFoodTruckAt/buildVendorAt/buildPottyBankAt/buildFoodCourtAt, wired into _generateWorldgen);
CHANGELOG.md (2026-06-07 Group D), tasks.md (D.1–D.6 ✓), session-log.md (D7, dangling threads).
**Refs:** -> R2 (boot crash gate passed, return-shapes per-builder), R4 (tuple key verified
in-game), R7 (sampler under gate), R11 (anchor frame-spike accepted; split only if shown — H.3).
Next: Group E lakes (binding gate R5 winding sign-flip).

### 2026-06-07 — Festival redesign CG1: foundation + harness gates (deliberation 002)
**Intent:** Per /deliberate 002, land the foundation BEFORE any content: the pure POI decision
layer, the additive worldgen exports, the determinism harness (POI golden + window-invariance,
the R18 block-release), and the map-sandbox overlay (R21 harness-first). The game stays Group-D
behavior — festival.js isn't wired in yet — so this is a clean bootable checkpoint.
**Result:**
- D2.2: `roads.approachRoadsOf(heart)` (+`oriented` heart-first polyline, `fromHeart`, `lenQ`),
  `hearts.nearestMajorHeart(x,z)` (bounded Chebyshev-ring scan, +2 rings after first hit). ZERO
  new rng draws → golden `63c8dea2` unchanged. Verified `nearestMajorHeart(0,0)`=(701,-204)@1234.
- D2.1: NEW pure `src/worldgen/festival.js` — `festivalPlan(heart)` (memoized, (seed,epoch)-gated)
  + `campVillagesNear` + `poisInBounds`. Salts `poiLayout=0x4D41_0B`, `poiVillage=0x4D41_0C`.
  Catalog: stage@center + arch on primary road + food courts/vendor rows along approach roads
  (clusterSeed per descriptor; cellRng heart-owned) + 1 guaranteed bubble vendor + drum circle in a
  treed off-road district cell + porta banks attached. Headless: major heart = 11 POIs, all <97m
  reach, deterministic. (R28 purity: imports only rng/constants/index/roads.)
- D2.0a: `selftest.js` grew `poiGoldenHash` (node **fe82f8cc**, stable) + T6 major window-invariance
  (r28==r44). 24/24 pass; `queryPoint` golden `63c8dea2` held. R18 gate green → cluster-build unblocked.
- D2.0b: `map-sandbox.html` `festival` overlay (stage/court/row/arch/vendor/drum/village markers);
  `worldgen/festival` in all 3 importmaps. Verified at seed 1234 (701,-204) — clusters line the
  approach roads as designed. **Found+fixed:** map-sandbox parsed numeric seeds as FNV strings while
  the game parses int-first → different worlds for the same seed; added `resolveSeed` (the seed-door
  reproduction promise). Fixed the stale chunks.js:416 "default ON" comment (R23 — flag is correctly OFF).
**Verified:** game boots clean both flag states (festival.js not yet wired → unchanged); self-test
24/24; map-sandbox overlay screenshot confirms designed layout.
**Changed:** src/worldgen/{festival.js NEW, roads.js, hearts.js, constants.js, selftest.js},
map-sandbox.html, index.html, sandbox.html, src/chunks.js (comment), CHANGELOG.md, tasks.md (D2.0a/b/1/2 ✓), session-log.
**Refs:** -> R16-R28 (CG1 satisfies R17/R18/R20/R21/R23/R28). Next: CG2/CG3 — wire placeChunkProps
to the plan (D2.5) + re-anchor builders with clusterSeed rng-regime (D2.1b/D2.3) + spawn-at-heart (D2.6).

### 2026-06-07 — Festival redesign CG2/CG3: wire festival.js into the game (placement is LIVE)
**Intent:** Make festival.js drive in-game placement (D2.5), re-anchor the cluster builders with the
clusterSeed rng-regime (D2.1b/D2.3). The festival should now read as designed in-game behind ?worldgen=1.
**Result:**
- D2.5: `placeChunkProps` rewritten as the thin per-chunk filter — `heartsInBounds(chunkAABB ± MAX_POI_REACH)`
  → memoized `festivalPlan` → keep clusters whose center is in this chunk (half-open, one owner/seam);
  + `campVillagesNear`. Per-heart distance pre-filter spreads the memoized plan cost.
- D2.1b/D2.3: `placeWorldgenProps` + `buildWorldgenKind` rewritten — each cluster built with a
  CLUSTER-LOCAL `cctx={...ctx, rng:mulberry32(d.clusterSeed)}` (R19, severs from ctx.rng). New builders:
  `buildEntranceArchAt` (arch+colliders+string lights), `buildVendorRowAt` (double row along road),
  `buildBubbleVendorAt`, `buildCampVillageAt` (12-20 packing, world-positioned); `buildFoodCourtAt` gained
  an inter-truck overlap guard + edge bubble vendor; solo-shack branch deleted (shacks ONLY in courts).
- **MAX_POI_REACH fix (R16):** found that a major's drum circle reaches ~core+130 (350+130=480, treeDensity
  is 0 inside a core so the treed spot is past it) — beyond the old 120 + the ±440 pad → would vanish. Set
  MAX_POI_REACH=480, drum bounded to core+DRUM_BAND with a fallback, ownership scan expands by MAX_POI_REACH.
- **GUARD BUG found+fixed (the courts/vendor-rows were invisible):** `registry.closestBuilding` measures
  EDGE distance (hypot − footprint) and only excluded 'tree'. The `lake` water-mesh entry has a HUGE
  footprint, so a court near a lakeshore road read as "near the lake building" → skipped (even though
  `isPointInLake` said the center was dry). Also companion portas tripped it. Fix: `CLUSTER_GUARD_SKIP`
  blocks only on stage/truck/tent (the big solid structures); lake/lake_edge/shore/companions ignored.
  Diagnosed with a temporary `[WGDBG]` log → "food_court SKIPPED by lake" → removed the log after.
**Verified (REAL game, seed 1234):** at the (62,1463) major heart — main stage + chairs, 2 arches w/ string
lights, food-court truck ring (truck×7), double vendor rows (tent×22), bubble vendors, porta banks, lakeside
campsites. Clusters LINE THE ROADS as designed (screenshots: close + establishing), nothing in water, ZERO
console errors. Self-test 24/24 (queryPoint 63c8dea2, POI f8dc276d). Per-chunk DECISION cost headless:
0.5-0.9 ms warm, 37 ms cold-once (down from 84 via the per-heart pre-filter), << 8 ms steady-state gate.
**Changed:** src/worldgen/{festival.js, placement.js}, src/chunks.js (placeWorldgenProps/buildWorldgenKind
+ builders + CLUSTER_GUARD_SKIP), CHANGELOG.md, tasks.md (D2.1b/3/5 ✓), session-log.
**Refs:** -> R16 (ownership scan), R19 (clusterSeed rng-regime), R22 (no boot crash), R29 (shack shared).
Next: D2.6 spawn-at-heart (the visible win — relocate Zerble to the nearest major's arch); then D2.4 filler /
D2.7 quantize sign-off / D2.8 all-tier boot + browser POI golden; then /smart-review.

### 2026-06-07 — D2.6: spawn at the festival heart (the visible win)
**Intent:** Relocate spawn from the legacy (0,65) to the nearest major heart's arch facing the stage
(Gary: arch + stage + lights + more jugs), iOS-safe (before Sound.init).
**Result:** `main.js` module-eval block (after the seed IIFE, before the title tap): `nearestMajorHeart(0,0)`
→ `festivalPlan` → spawn 14m beyond the arch facing the stage; `setSpawnPoint` + intro jugs 2→4 fanned;
`_placeSpawnJugs` spirals to ~26m for a clear gap. **Found:** spawn landed IN a legacy lake (the worldgen
arch avoids worldgen lakes, but the rendered water is still legacy LakeManager — the interim dual-lake
mismatch). Added a post-`buildWorld` nudge: walk forward (toward the dry-shore stage) out of any lake.
**Verified (seed 1234):** spawn (724,-207) on dry shore facing the festival (stage + vendor row + trucks +
2 jugs around), ZERO console errors; `?worldgen=0` unchanged ((0,65), clean). Self-test 24/24
(queryPoint 63c8dea2, POI f8dc276d).
**KEY INTERIM ISSUE (raises Group E's priority):** the legacy LakeManager lakes ≠ worldgen lakes, so in the
v2 path RIGHT NOW the rendered water can (a) eat festival clusters near a legacy shore (the lake-guard fix
mitigates the court/row case; isPointInLake still skips a cluster IN legacy water) and (b) put spawn in
water (mitigated by the nudge). **Group E (lakes → worldgen) is the clean fix** and should arguably come
before more festival polish — once the rendered water == worldgen water, festival.js's noBuild planning and
the in-game water line up, and the spawn-nudge + cluster-skips become unnecessary.
**Changed:** src/main.js (imports + spawn-at-heart block + post-buildWorld nudge), src/chunks.js
(setSpawnPoint + 4 jugs + wider _placeSpawnJugs search), CHANGELOG.md, tasks.md (D2.6 ✓), session-log.
**Refs:** -> D-O, R31 (iOS — module-eval not gesture), R27 (clearance veto deferred). Next: D2.4 filler /
D2.7 quantize sign-off / D2.8 all-tier boot + browser POI golden / Group E (lakes) / /smart-review / ARCHITECTURE.
