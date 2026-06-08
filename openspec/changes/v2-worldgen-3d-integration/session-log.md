---
change: v2-worldgen-3d-integration
status: in_progress
current_task: SALVAGE decided. Next big work = festival LAYOUT GRAMMAR redesign of festival.js (Gary playtest: arrangement is the problem, not density). See festival-polish-backlog.md. Then H gates → I landing.
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
**Doing:** Group G DONE + verified (heart-influence-weighted ambient crowd + along-road `path_node` waypoints;
R13 solved via attractors not per-NPC nearestRoad which is 215µs/call; crowd concentrates at hearts, lines roads,
empty deep-outskirts, cap-bounded; self-test 24/24 goldens unchanged). Content groups DONE — only the closing
gates remain.
Next: H gates (H.2 cross-engine road-EXISTENCE integer test — the one non-cosmetic cross-engine gate; H.3 budget
pass) → I landing (flip DEFAULT_WORLDGEN_V2, ARCHITECTURE.md I.6 rewrite, ROADMAP trim, F.5 real-device draw check).
**Resolved delivery order:** A(paperwork ✓) → B scaffold ✓ → C roads ✓ → D placement ✓ +festival redesign ✓ →
**E lakes ✓ → F forests ✓ → G crowd ✓** → H gates → I docs. Junction-merge DEFERRED to a 2D-only
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
- ~~Two lake macrocell sizes today (game 320m vs worldgen 1050m) — the worldgen one wins;
  confirm density/size feel in 3D vs the old lakes players have seen.~~ RESOLVED in Group E: v2 reads
  worldgen lakes (1050@0.60 → fewer/bigger), legacy keeps 320@0.45 byte-identical. Density/size *feel*
  A/B parked to a fast-follow (E.4) — the swap ships; tuning is optional.
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

### 2026-06-07 — Group E: LakeManager reads worldgen lakes (binding gate R5) — INTENT
**Intent:** Make the RENDERED water == WORLDGEN water (kill the interim dual-lake mismatch). `LakeManager.update`
branches on `USE_WORLDGEN_V2`: legacy → today's self-seeded macrocell lakes BYTE-IDENTICAL; v2 → `wgLakesInBounds`
around the player (margin for big worldgen lakes, load/unload by center-dist ∓ lake.maxR so the bigger LAKE_CELL=1050
doesn't leave the load ring empty — E.4). `buildLake` gains a top branch: `opts.worldgenLake` → center+true outline
from worldgen; else legacy. **R5 plan (assert-then-normalize, stronger than assert):** convert worldgen absolute
outline → center-relative + normalize signed-area to CCW (worldgen `_computeLake` is CCW by ellipse cos/sin
construction; normalize defensively so a future shape can't silently seal colliders OUTSIDE the water — masked by the
water DoubleSide). The TRUE polygon drives the water ShapeGeometry + sealed colliders + a point-in-poly `isPointInLake`
(so game water-test == worldgen `lakeAt`); decoration (camps/beach/forest/canoe via outlineRAt's index→angle
assumption) uses a polar-resampled outline so a rotated/lobed worldgen lake places its ring correctly WITHOUT touching
the legacy path. Decoration rng = a fresh per-cell `worldHash(cx*167+13, cz*379+71)` stream (footgun #4). E.3: lake
colliders keep NO chunkKey (unchanged — buildLake never passes one). Band-aids removed: the post-buildWorld
`isPointInLake` spawn-nudge in main.js → folded into the spawn-at-heart block as a WORLDGEN `lakeAt` walk-to-dry
(always available, not lifecycle-gated); chunks.js:964 guard kept (now reads worldgen-aligned water) with comment
fixed. Self-test golden `63c8dea2`/POI `f8dc276d` MUST stay (water.js untouched; decoration rng is game-side).
**Refs:** -> E.1-E.4, R5 (binding gate), footgun #4/#5, D-P (no-water invariant). Result entry to follow.

### 2026-06-07 — Group E: LakeManager reads worldgen lakes — RESULT (DONE + verified)
**Result:** Swapped + verified end-to-end; both interim band-aids removed.
- **lakes.js:** `LakeManager.update` now branches `if (USE_WORLDGEN_V2)` → `_loadUnloadWorldgen` (scan
  `wgLakesInBounds` over player±(LOAD_RADIUS+`WG_MAX_LAKE_R`=340); load/unload by center-dist ∓ lake.maxR so the
  1050m cell never leaves the ring empty — E.4) vs `_loadUnloadLegacy` (today's macrocell scan VERBATIM); canoe drift
  shared. `buildLake` gained a top branch: `opts.worldgenLake` → center+TRUE outline from worldgen via
  `worldgenOutlineToCCWRelative` (R5: shoelace signed-area assert-then-normalize to CCW) + a `polarResample` for the
  decoration's `outlineRAt` index→angle path; else legacy (rng draw order byte-identical, `decoOutline===outline`).
  Decoration body renamed `outline`→`decoOutline` at the 4 placement `outlineRAt` calls + canoe; registry `lake`
  entry carries `exactPoly:!!wl`; `isPointInLake` branches (worldgen → `pointInPolyRel` true polygon == worldgen
  `lakeAt`; legacy → unchanged radial test). Decoration rng = fresh `mulberry32(worldHash(cx*167+13, cz*379+71))`
  (footgun #4). Lakes still NO chunkKey (E.3).
- **main.js:** folded the spawn-clearance into the spawn-at-heart block as a worldgen `lakeAt` walk-to-dry (always
  available, not lifecycle-gated); deleted the post-`buildWorld` `isPointInLake` nudge + dropped the now-unused import.
- **chunks.js:** :964 guard kept (now reads worldgen-aligned water), comment fixed.
**Verified:** self-test 24/24, goldens `63c8dea2`/`f8dc276d` UNCHANGED (water.js untouched). Headless R5 proof: all 22
lakes in ±2km CCW (normalize never fires); my `pointInPolyRel` vs worldgen `lakeContaining` = 6/3668 disagreements, all
≤0.293m from the shoreline (quantize-the-query fuzz, harmless). REAL game seed 1234: (1) v2 default — spawn dry at
(746,-216) by the (701,-204) major, 2 worldgen lakes loaded whose centers/radii EXACTLY match self-test cells (0,-1)
& (-1,-1), both `exactPoly`, 733 `lake_edge` colliders, ZERO errors; noon + midnight arrival read great. (2) E.3 — top-down
`showColliders` shows the sealed ring tracing the lobed worldgen shore; teleporting onto a `lake_edge` blocked + damaged
(juice 0.9→0.854) + EJECTED the cart away from water. (3) v2 `?perf=low` (Lambert) — same spawn/lakes, clean. (4)
`?worldgen=0` — spawn (0,65), 17 macrocell lakes, all `exactPoly:false`, ZERO errors → byte-identical legacy.
**Changed:** src/lakes.js (LakeManager branch + worldgen helpers + buildLake branch + isPointInLake), src/main.js
(spawn walk-to-dry + nudge removed + import), src/chunks.js (:964 comment); CHANGELOG.md (2026-06-07 Group E),
tasks.md (E.1-E.4 ✓), session-log. Commit: `209e850`.
**Refs:** -> E.1-E.4, R5 (PASSED), footgun #4/#5. Next: D2.4 filler / D2.7 quantize sign-off / D2.8 all-tier boot +
browser POI golden / R27 spawn-clearance veto / /smart-review the festival+lakes diff / I.6 ARCHITECTURE.md rewrite;
then F forests → G crowd → H gates → I landing.

### 2026-06-07 — /smart-review 001 (festival + spawn + lakes diff) + review-response
**Intent:** Run the multi-specialist review of the world-content diff (0ee3c7c..HEAD) now that roads/festival/
spawn/lakes are all live behind the flag; fix findings.
**Result:** 6 specialists, one parallel batch → reviews/001-festival-lakes/review-summary.md. rendering/audio/docs
CLEAN; gameplay/performance only P3; sandbox one P1 (verification-confidence) + a P2 + P3. **P1 CLOSED by
verification, not code:** the prior passes hadn't streamed a `drum_circle` or worldgen `camp_village`; booted
`?worldgen=1&seed=1234`, teleported to the spawn heart's drum (1034,-50) → drum_circle entry built, no crash, and a
camp_village at (156,-842) → 12 campsites packed, no crash, zero console errors → every `buildWorldgenKind`
return-shape path now exercised. **Fixed (hygiene, no behavior change):** added `worldgen/placement` to map-sandbox
`wg` array (P2 consistency); map-sandbox self-test readout now prints the POI golden too (P3 — unblocks the D2.8
browser cross-engine check); documented the `treedDistrictSpot` `treeDensity>=0.25` compare in the festival.js
determinism header as the ACCEPTED cosmetic cross-engine class + named it in D2.7 (R20); fixed the stale WATER_MAT
"star shimmer" comment in lakes.js. Deferred (P3, pre-existing/tracked): `placePolePair` pooling, the R11
one-frame cluster-stack gate (→ D2.0c/D2.8), R9 lakeshore ring (→ Group F).
**Verified:** self-test 24/24, goldens `63c8dea2`/`f8dc276d` unchanged (all fixes comment/array/doc-only).
**Changed:** src/worldgen/festival.js (header comment), src/lakes.js (comment), map-sandbox.html (wg array +
readout), tasks.md (D2.7 text), reviews/001-festival-lakes/review-summary.md (NEW), session-log. Commit: `cd58138`.
**Refs:** -> R20 (D2.7), R11 (D2.8), R27 (deferred). Next: D2.4 filler / D2.7 sign-off / D2.8 mid-tier+browser golden;
then F forests.
**D2.8 partial (browser POI golden — DONE):** loaded map-sandbox.html?seed=1234, ran the self-test in the preview
browser. **Browser POI golden = `f8dc276d` == node `f8dc276d`** → the festival POI layer is cross-engine DETERMINISTIC
(no fork between node-V8 and the browser engine). Browser queryPoint golden = `a527d31e` ≠ node `63c8dea2` — that's
the PRE-EXISTING, documented lake/road sin/cos cosmetic fork (Dangling Threads), NOT a regression and NOT in the POI
layer. So the cross-engine cluster layout is safe. Remaining D2.8: ?perf=mid + ?perf=high game boots; headless
chunkGenStats R11 gate; a minor-heart + lakeshore-region boot.

### 2026-06-07 — D2.8 mid/high banked + Group F: worldgen woods (treeDensity scatter)
**Intent:** Bank the festival+lakes at mid/high tier (the one-variable rule, before changing forests), then land Group F
— replace the legacy 5×5 forest system with continuous per-chunk `treeDensity` scatter (binding gate R3 ~80/chunk).
**Result:**
- **D2.8 mid/high (banked):** booted `?worldgen=1&perf=mid` and `&perf=high` at seed 1234 — festival arrival renders
  clean both tiers, ZERO console errors. (low + default were banked in the Group E session.)
- **Group F (chunks.js):** `_generateWorldgen` now calls `scatterWorldgenTrees(ctx)` after the festival props.
  `scatterWorldgenTrees` places `buildForestTree` (collidable, damage 3) ∝ `treeDensity(x,z)` — `if (rng()>d) continue`
  scales count with local density; hard-capped at `MAX_WORLDGEN_TREES=80`/chunk × `forestTreeDensityMul`
  (verified EXACT: 80 default / 56 low). Fresh per-chunk `worldHash(cx*73+19, cz*91+41)` stream (not ctx.rng).
  `pointNearWorldgenRoad` (point-to-segment vs ctx.region.roads — no per-attempt worldgen query, R7) keeps trunks off
  the ribbons; `TREE_GUARD_SKIP` lets trees fill the lakeshore ring (don't treat the lake's huge footprint as a blocker
  — same lesson as CLUSTER_GUARD_SKIP) while dodging solid structures. Legacy forest interior (paths/camps/LEAF drum)
  NOT ported — superseded by festival.js + lake rings (F.4: the festival drum at a treedDistrictSpot is now surrounded
  by Group-F woods, verified 54 trees within 40m at (1034,-50)).
- **Guard fix found via the low-tier screenshot (a tree sat on the drum):** `CLUSTER_GUARD_SKIP` skipped `tree` but not
  `forest_tree`, so a neighbor chunk's woods generating BEFORE the drum's chunk could BLOCK the drum (cluster presence
  was chunk-load-order-dependent). Added `forest_tree` to the skip set → clusters always build; their own chunk's trees
  dodge them; rare cross-chunk tree-clip is cosmetic.
**Verified:** self-test 24/24, goldens `63c8dea2`/`f8dc276d` unchanged (chunks.js is game-side). Headless decision cost
~2.5 ms/chunk (1.6 ms treeDensity + 0.9 ms festival) << 8 ms gate. In-game seed 1234 default+low: dense varied woods,
R3 cap held EXACTLY (80/56 max per chunk; lake-ring trees are a separate no-chunkKey count), drum nestled, roads/clearings
open, ZERO console errors. **OPEN (F.5):** the LIVE full-framerate draw budget + a real low-end-device pass — the
hidden-tab preview throttle-inflates `renderer.info` (reads 1/1) and chunk-gen timing, so live draws are unmeasurable
here; carry to a real-device check before I.0 landing. v2 woods are CONTINUOUS (vs legacy 1-per-5×5) so a dense region
loads more tree-chunks at once — the new steady-state risk.
**Changed:** src/chunks.js (treeDensity+buildForestTree imports, scatterWorldgenTrees + pointNearWorldgenRoad +
TREE_GUARD_SKIP, wired into _generateWorldgen, CLUSTER_GUARD_SKIP +forest_tree); CHANGELOG.md (Group F Added+Changed),
tasks.md (F.1/F.2/F.4 ✓, F.3/F.5 partial), session-log. Commit: `8ce84cf`.
**Refs:** -> F.1-F.5, R3 (cap held), R7 (decision cost), R9 (lakeshore ring — real-device), R10 (single branch),
footgun #4. Next: G crowd (heart-weighting); then H gates (cross-engine road-existence) → I landing (flag flip,
ARCHITECTURE.md I.6, the F.5 real-device draw check).

### 2026-06-07 — Group G: heart-weighted ambient crowd + along-road waypoints (R13)
**Intent:** Wire ambient crowd into v2 (it had none — only festival-cluster NPCs), concentrated at hearts, drifting
along roads, honoring R13 (don't trust `nearestRoad.dirAngle` / march to phantom roads).
**Result:**
- **G.2 measurement-driven pivot:** `nearestRoad` costs **215 µs/call** (headless) → 107 ms/frame for 500 NPCs — a
  per-NPC road-pull (even cached) is unviable. So instead: (a) crowd.js — the legacy `Math.round(pos/PATH_GRID)`
  grid-pull is now gated `if (!USE_WORLDGEN_V2)` (in v2 the +-grid lines have no road; pulling there IS the R13 trap);
  (b) chunks.js `placeWorldgenRoads` → new `placeRoadWaypoints` seeds `path_node` attractors every ~26 m ALONG each
  in-chunk road run (replacing the single midpoint waypoint), so the crowd lines the roads via the normal attractor
  system — zero per-NPC road queries, deterministic, chunk-keyed.
- **G.1:** `_generateWorldgen` calls `spawnAmbientCrowd(ctx, count)` with `count = heartInfluence<0.04 ? 0 :
  round(1 + heartInfluence*15)` (one `queryPoint`/chunk at gen-time, ~0.25 ms — has nearestRoad inside, fine once/chunk).
  `crowd.spawn` returns null on an empty `MAX_NPCS` free-list → cap is a HARD bound (no leak).
**Verified (seed 1234, real game):** at the (701,-204) major heart — dense crowd around the stage + vendor row,
lining the road junction, thinning to the Group-F tree line (establishing screenshot); 37 path_node road waypoints
seeded. Minor-heart fringe (near (3377,2851)) ~17 NPCs; deep outskirts (influence 0) spawn 0. No phantom-grid march.
ZERO console errors. Self-test 24/24, goldens `63c8dea2`/`f8dc276d` unchanged (crowd/chunks are game-side; crowd is
Math.random-driven, never in the determinism contract). spawnAmbientCrowd water-reject + per-frame projectOutOfLake
unchanged, now worldgen-aligned (Group E).
**Changed:** src/crowd.js (USE_WORLDGEN_V2 import + grid-pull gated to legacy), src/chunks.js (queryPoint import,
placeRoadWaypoints along-road waypoints, spawnAmbientCrowd in _generateWorldgen with influence count);
CHANGELOG.md (Group G Added), tasks.md (G.1/G.2/G.3 ✓), session-log. Commit: `e0bcc01`.
**Refs:** -> G.1-G.3, R13 (no phantom-road march — solved by attractors, not per-NPC queries). Next: H gates
(H.2 cross-engine road-EXISTENCE integer test — the one non-cosmetic cross-engine gate; H.3 budget pass) → I landing.

### 2026-06-07 — Heart-density tuning (Gary: v2 read WAY too sparse)
**Intent:** Gary playtested v2 and found it too sparse — "wide-open fields with just people." He proposed
HEART_CELL 440→260 + empty cells (noneBelow) 0.48→0.
**Result:** Tried 260/0 first (his numbers) → REJECTED on four signals: (1) hung the 2D map-sandbox (eval
"navigated or closed" — the dense per-pixel heart/road/forest compute choked/crashed); (2) spiked game chunk-gen
to 335ms (throttled, but a huge relative jump); (3) the road negative-control self-test FAILED — "window 1 never
differed, lacks teeth" = roads so dense (fully-connected, every cell a heart) there's NO road-sparse region left,
i.e. zero breathing room; (4) nearestHeart scan window blows from 4→5 cells (121/query) at 260 (`ceil(1000/260)+1`).
Dialed to **HEART_CELL 340 / noneBelow 0.25** (75% filled, ~25% empty): keeps the nearestHeart window at 4 (cost
FLAT — treeDensity 1.69ms/chunk vs 1.6 @440), ~2.6× denser than 440/0.52 (festivals ~390m apart vs ~610m), breathing
room intact (negative control regained teeth → **self-test 24/24**). Verified: map-sandbox loads clean (1862 hearts in
view, no hang); 3D game boots, the spawn heart reads as a populated festival (stage + 2 vendor rows + trucks + arch +
crowd lining the roads), chunk-gen warnings 8-27ms (one 99.9ms heart-heavy chunk — throttled ≈ ~1-20ms real, vs 260/0's
335ms), ZERO JS errors.
**Goldens MOVED (intended — CONFIG tuning regenerated the v2 world; flag-off, no shipped world changed):**
queryPoint node `fb9724fb` / browser `ad9e50cc`; POI node `4e335f21` / browser `f105c425`. NOTE: the POI golden now
FORKS cross-engine (node≠browser) where at the sparse 440/0.48 it matched (`f8dc276d` both) — the denser world exercises
more hearts → more of the documented cosmetic cross-engine forks (treeDensity spot-pick, road bearings). Single-engine
reproducibility holds. **This AMPLIFIES the H.2 surface** (the non-cosmetic road-EXISTENCE fork) — H.2 matters more now.
**Changed:** src/worldgen/constants.js (HEART_CELL 340, HEART_RANK.noneBelow 0.25 + rationale), src/worldgen/selftest.js
(new golden baseline in the POI comment); CHANGELOG.md (Changed — denser world), session-log. Commit: `0a0cac9`.
**Refs:** -> H.2 (amplified by density). Lever for Gary to push denser: the map-sandbox live sliders; past ~300/~0.10
needs frame-splitting the cluster build (R11) + shrinking the major district (1000) to keep the scan window + chunk-gen sane.

### 2026-06-07 — Playtest pivot: SALVAGE v2, festival ARRANGEMENT is the real problem
**Intent:** Gary playtested the denser v2 and was disappointed — considered scrapping to `main`.
**Result:** Diagnosed the real issue (NOT density): `festival.js` arranges a heart's clusters
(stage/arch/rows/court/drum/camps) INDEPENDENTLY relative to the heart+roads, so they collide + face wrong —
stage faces water w/ chairs in water, vendor row through the stage, arch mid-row, court with a row+porta inside.
Gary's close-up screenshots are the evidence. Decision: **SALVAGE** (the world structure is the upgrade he likes;
the badness is concentrated in one file). Next big work = a festival **LAYOUT GRAMMAR** (front-axis away from
water/toward main road → place each entity by rule), done together. Captured Gary's full polish-notes backlog
(18 items across arrangement / missing entities / new entities / campsites / crowd / woods / blankets / Lurleen)
in **festival-polish-backlog.md** with technical hooks + a suggested execution order. Also explained the levers
(core/district/golden) to Gary — part of the frustration was the sliders being illegible.
Gary kept tuning his config live: HEART_CELL 200, noneBelow 0.05, minor 90/160, major 100/200 (inversion fixed),
LAKE_CELL 600, DENSITY_THRESHOLD 0.2, LAKE_RING_BAND 160 — UNCOMMITTED in the tree, keep it. Self-test 23/24 at
this density (road negative-control teeth lost at 5% empty — re-settle later; not a determinism break).
**Changed:** festival-polish-backlog.md (NEW — the canonical notes list), HANDOFF.md (salvage + redesign + backlog
pointer), session-log. constants.js holds Gary's live config (uncommitted, intentional). Commit: (pending — docs only).
**Refs:** -> festival-polish-backlog.md (all 18 notes). Next: festival layout-grammar spec → /deliberate → rebuild festival.js.

### 2026-06-07 — Festival LAYOUT GRAMMAR: spec + /deliberate 003
**Intent:** Per the salvage decision, draft the festival layout-grammar spec, get Gary's design forks,
and /deliberate it before rebuilding festival.js (collaboration: bring the spec/options first).
**Result:** Wrote **festival-layout-grammar.md** — the keystone is ONE computed front axis `F` per hub
(= bisector of the widest *dry* gap between the hub's roads), with every entity placed by a rule relative
to `F` + roads + water + a footprint overlap guard. Gary's forks RESOLVED: front-axis = widest-dry-gap;
arch = ON the approach road at spawn (drive in along the street, stage reads off to the side); process =
/deliberate first. Ran **/deliberate 003-festival-layout-grammar** (Tier 3 synthesis, 5 council: Architect/
Adversary/Profiler/Anthropologist/Pragmatist + Mediator) → **Proceed with mitigations**, 5 Change Groups.
Convergence: thesis sound; (1) `F` must be an INTEGER-keyed sort (bin bearings to a fixed grid, integer
gap widths, integer water penalty) AND serialized into the descriptor (else the golden is blind — R18);
(2) the dancefloor clearing (A4) is a CROSS-CHUNK pure query — new `dancefloorRectsNear(AABB)` keyed off
owning hearts, NEVER a registry lookup or per-tree query (R18 + 8ms R7 gate); (3) the arch deletion + the
main.js spawn rewrite MUST land together (split = silent legacy (0,65) spawn). Factual snag (verified):
`MAX_POI_REACH` comment says "major core 350" but live `major.core=100` — size everything off live `heart.core`.
Folded CG1-CG5 into **tasks.md as D3.1-D3.14**. Build order: CG1 harness-first (overlay + contract) → CG2
the `F` rewrite → CG3 golden → CG4 judge ONE hub → park CG5. One feel watch-item flagged for Gary: if `F`
lands near-perpendicular to the approach road, the drive-in could read "empty field, where's the stage" —
decide by looking in the overlay, not by spec.
**Changed:** festival-layout-grammar.md (NEW spec), deliberations/003-festival-layout-grammar/{briefing,council-*,results}.md,
tasks.md (D3.1-D3.14), session-log. Commit: (pending — docs; code starts with CG1).
**Refs:** -> festival-layout-grammar.md, -> deliberations/003-festival-layout-grammar/results.md, -> D3.1 (next, harness-first).

### 2026-06-07 — D3 CG1: front-axis F (pure) + map-sandbox grammar overlay
**Intent:** Harness-first (per deliberation 003): make the front axis F *visible* before
rewriting _computePlan, so Gary can judge how every hub faces — and so the overlay and the
(CG2) placement rewrite share the SAME math by construction.
**Result (CG1, flag-off, 2D-only — no game boot needed):**
- **D3.5** `computeFrontAxis(heart)` in festival.js — PURE, INTEGER-keyed (256-bin angular grid,
  integer gap widths, integer blocked-probe count, integer sort + lowest-bin tiebreak → no float
  argmax that could rotate the hub cross-engine; R20). Prefers DRY gaps (0 blocked), widest wins.
  0-road + 1-road fallbacks. Verified on the seed-1234 hub at (733,-146): 3 roads (bins 6/174/185)
  → picked F=bin90 (126.6°), the widest DRY gap (168 bins, 0 blocked), rejecting the narrow wet gap
  (w11) + the wrap gap (w77, 1 blocked). Sizing reads LIVE heart.core (not the stale 350).
- **D3.4** fixed the stale MAX_POI_REACH comment (said "major core 350"; live major.core=100 → 480 is
  a generous over-bound). All per-cluster sizing reads live heart.core.
- `dancefloorRect(heart)` (preview, hub-center origin) + `dancefloorRectsNear(AABB)` (pure cross-chunk
  query for CG2/D3.7's tree clearing) + `stageScaleOf(heart)` (replicates buildStage's first rng draw
  so the rect + model agree without touching the build half yet).
- **D3.1** extended the map-sandbox `festival` overlay with a new "layout grammar" layer: per hub draws
  the F arrow, road outward rays, the angular gaps (chosen widest-dry gap GREEN, wet-only choice RED),
  the oriented dancefloor rect, and the spawn arch/drive-in vector (guarded). Verified at seed 1234,
  noon (2D): every hub faces an open gap between roads (A3 by construction); lakeside hub flagged red
  with its dancefloor angled off the water. Determinism INTACT — goldens unchanged (queryPoint eddf8e50,
  POI 6fa977c8); computeFrontAxis is purely additive (doesn't touch the queryPoint tuple or _computePlan).
**FINDING (sharpens D3.9 + flags a current regression):** at Gary's dense config (major share 0.04),
`nearestMajorHeart(0,0)` is NULL for seed 1234 (the hub near origin is now a MINOR at 733,-146). So
main.js:222 (`if (stage && arch)`) already FALLS BACK to the pinned (0,65) spawn — the "spawn at a
festival" win is currently broken at this config (it worked at the older 340/0.25 config). CG2/D3.9
deleting the arch descriptor would make that fallback permanent. → D3.9 must spawn at the nearest hub
of ANY rank (fits the one-infinite-festival framing — hubs are hubs) and build the arch spawn-side from
the road bearing, NOT depend on a major near origin or a plan arch descriptor.
**NOT done this turn (CG2, gated behind Gary judging F):** D3.6 re-aim _computePlan to F + serialize F
into the descriptor, D3.7 tree clearing via ctx.region, D3.8 overlap guard, D3.9 arch→spawn rewrite.
**Changed:** src/worldgen/festival.js (computeFrontAxis + dancefloor helpers + MAX_POI_REACH comment),
map-sandbox.html (grammar overlay layer), tasks.md (D3 checkboxes), CHANGELOG, session-log.
**Refs:** -> D3.1/D3.4/D3.5 done; -> D3.9 (sharpened by the null-major finding); next: Gary judges F → CG2.

### 2026-06-07 — D3 CG2: the F rewrite of _computePlan + dancefloor clearing + overlap guard + spawn-at-hub
**Intent:** Rewrite festival.js to USE the front axis (CG2) so the festival reads right in 3D —
Gary judges in the game, not the 2D overlay (he said the 2D abstraction didn't land for him).
**Result (flag-off, verified in the real game seed 1234):**
- **D3.6** `_computePlan` re-aimed to F: stage faces `+F` (the widest dry gap → dancefloor faces
  open ground between roads, A3); per-hub ARCH removed (spawn-only, A1); courts/rows walk out past
  the dancefloor on the drag (roads[0]); drum kept out of the ±40° front wedge; `fbin`+`scale`
  serialized on the stage descriptor (so the POI golden + T6 window-invariance exercise F).
- **D3.8** `resolveOverlaps` — pure deterministic footprint de-overlap, fixed push order, stage is
  the anchor, never touches clusterSeed. Verified: ZERO pairwise overlaps at the seed-1234 hub.
- **D3.7** dancefloor tree-clearing: `dancefloorRectsNear(chunkAABB)` (pure, owning-hearts via the
  MAX_POI_REACH expand) + `pointInDancefloor` skip in `scatterWorldgenTrees` — woods nestle back/
  sides, audience side clear. No per-tree query (R7).
- **D3.9 (partial)** spawn rewrite: `main.js` spawns at `nearestHeart(0,0)` (ANY rank) out on the
  stage's dancefloor facing the stage → boot opens INTO a festival. Verified spawn (-90,52), NOT
  the (0,65) fallback. The persistent ARCH on the road (A1/A2, Gary's arch-on-road pick) is DEFERRED.
- **PERF (R7) — caught + fixed a self-inflicted blow-out:** `computeFrontAxis`'s dry probe first used
  the heavy `queryPoint` (nearestRoad 215µs × ~18/heart) → ~10ms/heart (node) / ~68ms (browser); since
  `festivalPlan` now calls computeFrontAxis per heart, chunk-gen would stall for seconds. Swapped the
  probe to the cheap `lakeAt` (water-only; road-avoidance is implicit in facing a GAP) → **0.08ms/heart**.
  Also cut `treedDistrictSpot`'s 12 `queryPoint` to `treeDensity`+`lakeAt`. computeFrontAxis memoized.
- **Determinism:** queryPoint golden HELD `eddf8e50` (contract untouched); POI golden moved to `d9cfa5f2`
  node (expected, flag-off; selftest.js baseline comment updated). 23/24 (the pre-existing dense-config
  road-negative-control). All window-invariance tests pass incl. T6 (F is window-invariant).
- **3D verified (the real deliverable for Gary):** boot drops you in front of a stage with a live band
  across a clear dancefloor, vendors/court off to the sides, drum circle in the district, woods framing
  the back — no chairs in water, no row through a stage, no arch mid-row. ZERO console errors. Screenshots
  taken (player arrival + 3/4 hub + stage-front). This is the answer to Gary's playtest disappointment.
**OPEN watch-item:** full festivalPlan is ~9ms COLD in node (~60ms browser), slightly over the 8ms R7
gate — but PRE-EXISTING (the old plan had the same ~20 queryPoint calls; my grammar is perf-neutral-to-
better). The remaining cost is nudgeOff/court `queryPoint` + cold arterials. → D3.13 headless gate +
the frame-defer escape hatch (parked until measured to stall in real play).
**Changed:** src/worldgen/festival.js (computeFrontAxis memo+probe, _computePlan rewrite, resolveOverlaps,
treedDistrictSpot), src/chunks.js (dancefloorRectsNear import + pointInDancefloor in scatter), src/main.js
(spawn-at-any-hub), src/worldgen/selftest.js (golden baseline comment), CHANGELOG, tasks (D3.2/3/5/6/7/8 done,
D3.9/D3.10 partial), session-log. Commit: (pending).
**Refs:** -> D3.6/7/8 done, D3.9 partial (arch deferred); next: build the ONE arch (A1/A2) + the rest of CG5.

### 2026-06-08 -- The one spawn arch (A1/A2)
**Event:** phase-change. **What:** built the single persistent entrance arch (A1) on the
spawn hub's primary road via `buildSpawnArch` (chunks.js) — added straight to the scene,
colliders keyed `'spawn_arch'` so they never unload (lake-collider persistence trick).
main.js spawn rewritten to Gary's §6 arch-on-road arrival: spawn outside the arch on the
road, face inward, drive through the gate (stage off to the side). A2 banner mirror fixed
in entranceArch.js (two back-to-back FrontSide planes vs one DoubleSide). Verified in 3D
seed 1234: drive-in shows "FESTIVAL" correct from both sides, zero errors. **Refs:** -> D3.9 done.
