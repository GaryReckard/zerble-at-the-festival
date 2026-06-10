# HANDOFF — v2-worldgen-3d-integration

> **New session: read this first**, then `tasks.md` (the executable roadmap),
> then `deliberations/001-initial/results.md` (the Risk Register + every hardened
> sub-task), then the latest Work Log entry in `session-log.md`. This is the
> consolidated "hit the ground running" doc for wiring the 2D worldgen into the
> live 3D game.

> **UPDATE 2026-06-09 — layout-grammar redesign + the ENTIRE festival-polish backlog (A–H)
> are DONE** (all flag-off behind `?worldgen=1`, legacy `?worldgen=0` byte-identical). The
> festival now reads right: each hub faces a computed front-axis `F` (stage → cleared
> dancefloor, no road/water in front), the ONE arch is at spawn on the road (banner fixed),
> tent stages + the full leaf drum circle appear, food courts have picnic tables in a center
> plaza, tiki torches mark stages/courts, hammocks string between close trees, blankets +
> lone field trees sprinkle, camps tuck behind vendor stalls + scale with crowd, Lurleen
> starts a distance away, the crowd follows roads more. Determinism held (queryPoint golden
> `eddf8e50`; POI golden moved to `3b9fc6b6`, flag-off). See the 2026-06-08/09 session-log
> entries + `festival-polish-backlog.md` (all A–H marked) + the D3 tasks. **What's LEFT:**
> the closing GATES (H.2 cross-engine road-existence integer test; H.3 + F.5 real-device
> draw/tri budget — needs Gary's hardware, the throttled preview can't read `renderer.info`),
> then I landing (flip `DEFAULT_WORLDGEN_V2=true`, ARCHITECTURE.md rewrite, ROADMAP trim).
> Small deferred polish: C2 butts-on-benches seated crowd pose; A8 bespoke per-entity porta rules.

## TL;DR — what this is and where it stands

Wiring the verified, deterministic 2D `src/worldgen/` generator into the **live 3D
game** as v2 worldgen (ROADMAP "big one"), behind `?worldgen=1` (`DEFAULT_WORLDGEN_V2
= false` in perf.js — legacy ships by default until landing I.0).

**DONE + committed** (branch `procedural-map-generator`): Groups A (paperwork), B
(scaffolding), C (RAW arterial road ribbons), D (heart anchors + first scatter), then
the **FESTIVAL-LAYOUT REDESIGN** (Gary feedback: the D scatter was too random) — a
second tier-3 `/deliberate` (002, 5 council + mediator) → CG1 (pure `festival.js` POI
layer + harness gates: POI golden, map-sandbox `festival` overlay) → CG2/CG3 (festival
drives in-game placement: stages/courts/vendor-rows/drum/villages lining a heart's
approach roads; sugar shacks only in courts) → **D2.6 spawn-at-heart** (Zerble spawns
outside the nearest major heart's arch facing the stage, +4 welcome jugs). Verified
in-game at seed 1234 (noon + midnight, default + low tier): clusters line the roads,
spawn drops you at a festival, ZERO console errors; self-test 24/24 (queryPoint golden
`63c8dea2`, POI golden `fe82f8cc`→`f8dc276d` node). Commits: `7ba2805` (plan+deliberate
002), `bc2f9f3` (CG1), `c5d8df1` (CG2/CG3), `8548ecb` (D2.6). **Then E/F/G + review:** `209e850`
(E lakes → worldgen, R5 winding), `cd58138` (`/smart-review` 001 + fixes), `8ce84cf` (F continuous
treeDensity woods, R3 ~80/chunk cap), `e0bcc01` (G heart-weighted crowd + along-road waypoints, R13).

**MILESTONE: all v2 CONTENT groups landed** (roads C, festival/spawn D+D2, lakes E, woods F, crowd G).
**THEN PLAYTEST (Gary, 2026-06-07) → the festival ARRANGEMENT is the real problem, not density.** Gary drove
it and found: stage facing water with chairs IN the water, vendor row punched through a stage, festival arch
dumped mid-vendor-row, food court with a row + porta INSIDE it. Verdict: `festival.js` places a heart's pieces
(stage/arch/rows/court/drum/camps) relative to the heart + roads INDEPENDENTLY, with no rule about how they
relate — so they collide and face wrong. **Decision: SALVAGE v2** (the world structure is the upgrade he likes);
the next big work is a **festival LAYOUT GRAMMAR** redesign of `festival.js` (for each hub: pick a "front" away
from water/toward the main road, then place every entity by a rule relative to that front-axis + water + road),
done TOGETHER with Gary. Plus a big backlog of his polish notes.
**FRAMING (Gary):** it is all ONE infinite festival — hearts are HUBS/gathering areas within it, NOT separate
festivals; the gaps between are still the festival (chill/camping zones), just less dense. Update the
"festival"-per-heart language over time (heart → hub). Exactly ONE arch in the whole world: the grand entrance
at the player's spawn (backlog A1), not per-hub.

➡ **READ `festival-polish-backlog.md`** (same folder) — Gary's full playtest notes, organized into A (the
arrangement grammar — keystone), B (missing entities: tent stage, big drum circle, hammocks, picnic blankets
never seen), C (new: picnic table, tiki torches, tree-anchored hammocks), D (campsites: cluster near trees +
fields, tent-count ≈ crowd count, camps behind vendor tents), E (crowd road-follow + the people-class taxonomy
question), F (lone trees in empty fields; he likes `DENSITY_THRESHOLD 0.2`/`LAKE_RING_BAND 160`), G (picnic
blankets sprinkled near stages, not carpeted), H (Lurleen must spawn far + re-leash). Suggested execution order
is at the bottom of that file. THEN the closing gates (H.2 cross-engine road-existence, H.3 budget + F.5
real-device, I landing).

**Current config state:** `constants.js` holds Gary's experimental dense tuning (HEART_CELL 200, noneBelow 0.05,
small hearts, LAKE_CELL 600, DENSITY_THRESHOLD 0.2, LAKE_RING_BAND 160) — UNCOMMITTED in the working tree, keep it.
Self-test is **23/24** at this density (road negative-control loses teeth at 5% empty — not a determinism break;
re-settle when tuning, see the backlog). Goldens drift as we tune (flag-off, fine).

> **⚠ RE-SEQUENCED 2026-06-10 (Gary-confirmed — supersedes the priority order below).**
> The playtest verdict (festival arrangement is jumbled) makes the old "Group I
> landing next" order WRONG: flipping `DEFAULT_WORLDGEN_V2=true` now would ship the
> jumble to real players on the live deploy. **Corrected cross-change order:**
> ① **H.2** (below — still first, it moves the queryPoint golden) → ② the
> **`worldgen-layout-harness`** change (linter/capture/hub-viewer — see its README)
> → ③ the **`festival-zone-grammar`** change (the layout rewrite, measured against
> the harness baseline) → ④ **H.3/F.5 + Group I landing** (the flip, ARCHITECTURE
> rewrite, ROADMAP trim). Items H.3/F.5/I below remain accurate as descriptions —
> only their TIMING moved. Do not flip the default before the grammar change lands.

**NEXT (priority order):**
1. **Group H — gates (DELICATE — start with fresh context):**
   - **H.2 cross-engine road-EXISTENCE integer test (the one non-cosmetic cross-engine gate).** The
     `roads.js:167` detour tie-break `Math.abs(ccw - Math.PI) < 0.05` can straddle the threshold per-engine
     (V8 vs JSC) and FLIP whether a road EXISTS — which changes `noBuild`/the whole layout, not just a cosmetic
     wobble. Widen/quantize it to an integer orientation test. **WARNING: this touches the worldgen contract —
     it may MOVE the `queryPoint` golden `63c8dea2`. That's acceptable (v2 is flag-off, not shipped) but must be
     deliberate: re-record the golden + re-verify node==browser after.** This is why it wants fresh context, not
     the tail of a long session.
   - **H.3 full per-tier budget pass** — folds in the F.5 real-device draw check (below).
2. **Group I — landing**: flip `DEFAULT_WORLDGEN_V2=true` (I.0); the **ARCHITECTURE.md rewrite (I.6, hard gate —
   stale: still describes pickTheme/5×5 forests/320m lakes, all now retired behind the flag)**; ROADMAP trim (I.5).
3. **The F.5 real-device draw check** (needs Gary's hardware): boot `?worldgen=1&perf=low` on a real
   integrated-GPU phone, boost through a dense + lakeshore woods region, confirm FPS holds. v2 woods are
   CONTINUOUS (vs legacy 1-per-5×5) so a dense region loads more 80-tree chunks at once — the throttled
   preview can't measure live draws (`renderer.info` reads 1/1). The one gate the harness can't close.
4. Parked fast-follows: D2.4 filler scatter (hammocks/picnics — minor); D2.7 quantize sign-off (mostly done,
   the treeDensity compare is documented-accepted); R27 spawn-clearance veto (large-collider-near-spawn — the
   `lakeAt` walk-to-dry already covers water); junction-merge (2D); lakeshore/causeway camps (`shoreBand`);
   crowd count + road-waypoint-spacing feel-tuning.

**Groups E + F + G DONE + committed this session, plus a `/smart-review`:**
- **G (crowd, `e0bcc01`):** v2 ambient crowd scaled by heart influence (`count = influence<0.04?0:round(1+influence*15)`
  — dense major / modest minor / empty deep-outskirts; `MAX_NPCS` free-list hard-caps, no leak). R13 solved by
  MEASUREMENT: `nearestRoad` is 215µs/call → per-NPC road-pull unviable, so the legacy +-grid pull is gated to
  `!USE_WORLDGEN_V2` and `placeRoadWaypoints` seeds `path_node` attractors every ~26m along each road run → crowd
  lines the roads via attractors, zero per-NPC queries. Verified: dense crowd at the spawn heart lining the road
  junction, thinning to the tree line.
- **E (lakes, `209e850`):** `LakeManager` reads `src/worldgen` lakes behind `?worldgen=1` (rendered water ==
  the water `festival.js`/roads plan around — the dual-lake mismatch is GONE). R5 winding gate passed
  (signed-area assert-then-normalize to CCW; all 22 lakes CCW by construction). Both band-aids removed
  (spawn-nudge → worldgen `lakeAt` walk-to-dry; cluster guard reads worldgen water). `?worldgen=0` byte-identical.
- **F (woods, `8ce84cf`):** continuous per-chunk `treeDensity` scatter replaces the 5×5 forest system.
  `scatterWorldgenTrees` places collidable `buildForestTree` ∝ `treeDensity(x,z)`, hard-capped at 80/chunk
  (56 low) — **R3 binding gate held exactly**. Legacy forest interior (paths/camps/LEAF drum) superseded by
  festival.js (drum at a treed-district spot Group F surrounds) + lake rings. `CLUSTER_GUARD_SKIP` now skips
  `forest_tree` so woods can't block a cluster (load-order independence). OPEN: F.5 real-device draw check (#4 above).
- **`/smart-review` (`cd58138`):** 6 specialists; rendering/audio/docs clean, P3s elsewhere; fixes applied
  (map-sandbox `wg`+POI-golden readout, festival.js R20 doc, lakes.js comment). reviews/001-festival-lakes/.
- Verified seed 1234 across tiers: spawn dry at the heart, sealed lake colliders block/damage/eject, woods read
  as designed with the drum nestled, ZERO console errors. Self-test 24/24, goldens `63c8dea2`/`f8dc276d`
  unchanged; **browser POI golden `f8dc276d` matches node** (festival layout cross-engine stable).

The festival-redesign detail lives in design.md "Festival Layout Redesign (D-K..D-Q)",
tasks.md `## D2.`, deliberations/002-festival-layout/results.md, and the session-log
Work Log (2026-06-07 CG1/CG2-CG3/D2.6 entries).

Committed on branch `procedural-map-generator`:
- `68b22eb` — the 2D road/forest refinement (lake-heart proxy + route-around + tree-dots).
- `4a1742a` — this change's planning artifacts + deliberation.
- (HANDOFF doc) + a Group-B scaffolding commit.

## The endeavor, in one screen

**Goal / definition of done:** the game boots with no JS errors and generates a
worldgen-driven festival (hearts → arterial roads → lobed lakes → density forests →
themed props placed per role/rank, off roads + water), reads well at noon + midnight,
holds per-tier perf budgets (low 80/150k, mid 200/400k, high 400/1.2M), and the
determinism self-test stays 20/20 green.

**Core architecture (design.md D-A..D-J):** the chunk system STAYS as the streaming/LOD
engine; only the **content-selection layer** is replaced. Each chunk samples
`queryRegion`/`queryPoint` for its 80m cell and places: chunk-clipped **RAW** arterial
road ribbons, themed anchors (the heart-center chunk owns the anchor) + per-chunk
scatter (camps/vendors/potties/trees) via a new pure `src/worldgen/placement.js`,
LakeManager **reading** worldgen lakes, and `treeDensity` tree scatter. A per-chunk
sampler — NOT a separate heart lifecycle manager (D-A, endorsed by all 5 council).

## How to run + verify

```
python3 .claude/serve_nocache.py 8765   (or preview_start name "zerble")
```
- 3D game: `http://127.0.0.1:8765/` — boot via title button OR `__dbg.start()`.
  Force a tier: `?perf=low|mid|high`. **Enable v2: `?worldgen=1`** (default OFF while building;
  `?worldgen=0` forces legacy). Boot smoke test = test BOTH `?worldgen=1` and `?worldgen=0`.
- 2D worldgen sandbox: `http://127.0.0.1:8765/map-sandbox.html?seed=1234`.
- Per-entity 3D sandbox: `http://127.0.0.1:8765/sandbox.html?entity=<name>`.
- Headless self-test: `node --input-type=module -e "import('./src/worldgen/selftest.js').then(m=>{const r=m.runSelfTest();console.log(r.pass,r.goldenHash)})"`
- **Preview MCP gotcha:** the hidden tab throttles `setTimeout`-driven redraw to ~1fps,
  so after `setView`/state change, wait ~1.3s before `preview_screenshot`, or navigate
  to a fresh deep-link URL (boots a fresh draw). `__dbg` drives the running game.
- **Boot the REAL game at a heart-center chunk** (anchors are sandbox-invisible by
  construction): `__dbg.start()` then `__dbg.teleport(hx,hz)` to a heart center.

## RESOLVED delivery order (do in this order)

`A paperwork ✓` → **`B scaffold`** → `C roads (RAW)` → `D placement (headline, crash-risk)`
→ `E lakes` → `F forests` → `G crowd` → `H determinism/perf gate` → `I verify/review/docs`.
Each slice ends bootable behind the flag = a clean HANDOFF/commit checkpoint; CHANGELOG
entry travels in the SAME commit as each content slice. **Junction-merge is DEFERRED** to
a separate 2D-only fast-follow change (`worldgen-road-junction-merge`).

## The 6 BINDING apply-gates (High/Critical risks — do NOT skip)

From `deliberations/001-initial/results.md` Risk Register:
1. **R1 — road source-of-truth = RAW.** 3D consumes raw arterials for render + `noBuild`/
   `facing`/crowd; `nearestRoad`/`roadsInBounds` unchanged → self-test green by construction,
   golden stable. (DONE in design D-I REVISED.)
2. **R2 — heart-anchor boot crash** in `buildWorld → ChunkManager._generate → placement`
   (the `{group,...}` vs `Group` return-shape class). Empty-placement boot smoke test (B.5) +
   `__dbg.teleport` to a heart-center chunk + defensive return-shape extraction.
3. **R3 — forest tree-count blowup.** D-F drops the old ~80-tree/chunk cap
   (`forests.js:765` `FOREST_TREE_TARGET_DENSITY=0.022`). Clamp to ~80/chunk, keep
   `PERF.forestTreeDensityMul`, gate on `chunkGenStats` (NOT just the draws/tris HUD) while
   DRIVING through a dense + lakeshore region. (F.1, F.5)
4. **R4 — (roleTier, heart.rank) axis collision.** `roleTier`='core'|'district'|'outskirts'
   (distance band); `heart.rank`='minor'|'major' (size). Key placement on the TUPLE, both
   enums named in the header — a mis-keyed switch silently places nothing and still passes the
   green self-test. (D.3)
5. **R5 — lake collider winding sign-flip.** `lakes.js` assumes CCW (inward normal `(-edz,+edx)`)
   + reverse-walk for ShapeGeometry; worldgen `_computeLake` uses a different winding. Assert
   signed area BEFORE the swap; fix reverse-walk + normal sign as a PAIR; drive-in damage test
   (DoubleSide masks the visual). (E.1, E.2)
6. **R6 — untagged shared road material → recompile storm (footgun #6).** D-D's "shared road
   material" doesn't exist (`chunks.js:617` allocates per-chunk; `_forestPathMat`
   `forests.js:330` is UNTAGGED). Create `ROAD_MAT` + tag `userData.shared=true`; tag
   `_forestPathMat` too. (C.1)

Medium risks worth remembering: R7 per-chunk sampler CPU (one `queryRegion`/chunk, bound
`queryPoint` calls, time it), R8 cross-engine `atan2` road-existence flip (golden must cover
road existence; widen the `roads.js:167` tie-break), R10 old/new path co-run (single
`if(USE_WORLDGEN_V2)` at top of `_generate`), R12 iOS audio (no async hop before `Sound.init()`).

## File map (the game systems being touched)

**Game (what we're wiring into), with the integration seams:**
- `src/chunks.js` — 80m chunks, 1/frame budget, `_generate(cx,cz)` is THE hook. `placePaths`
  (+-grid, replace), `pickTheme` salt=1 (replace), `THEME_BUILDERS` (replace), `scatterTrees`
  (replace w/ density), `registry.add({kind,position,footprint,collider,attractor,chunkKey})`,
  `removeChunk(key)` disposal walk skips `userData.shared`. Salts: theme=1, STYLE_SALT
  0xC4FE7B2A, SPAWN_JUG_SALT 0x5A17B0BB, POTTY_SALT 0x9E3779B1.
- `src/lakes.js` — `LakeManager` (320m cell, load 720/unload 1500), `buildLake` (ShapeGeometry,
  reverse-walk outline), `placeSealedColliders` (CCW inward-normal, `lake_edge` NO chunkKey),
  `isPointInLake` (center-relative angular `outlineRAt`). `WATER_MAT` shared. SWAP placement
  source → worldgen `lakesInBounds`/`lakeInCell`.
- `src/forests.js` — 5x5 blocks, `getForestAt` pure-hash, chunk-keyed, `_forestPathMat`
  (UNTAGGED!). REPLACE with per-chunk density scatter. `models/tree.js` = pooled trunk geo +
  foliage mats `userData.shared`, lowest-tier-only castShadow, ~5 meshes/tree.
- `src/world.js` — `buildWorld(scene,crowd)`: lakes FIRST (line ~59) then chunks; preserve order.
- `src/main.js` — boot: title tap → `Sound.init()` (sync, iOS — no async hop) → buildWorld →
  loop. Seed `?seed=` → `setSessionSeed` → SESSION_SEED → worldgen reads it already.
- `src/crowd.js` — `spawnAmbientCrowd(ctx,count)`, clusters at attractors (weight≥0.5, 70%),
  per-theme counts (change to heart-influence), pulled to 80m grid (change to roads).
- `index.html` + `sandbox.html` — importmap `mods`/`models` arrays. **0/8 worldgen modules in
  either today** — B.1 adds all 8 + `placement` to BOTH.

**Worldgen (the asset, unchanged except a future fast-follow):** `src/worldgen/{index,constants,
hearts,water,roads,density,roles,selftest}.js` + new `placement.js`. Contract: `queryPoint(x,z)`
tuple (append-only), `queryRegion(bounds)` {hearts,roads,lakes}, `lakeInCell`/`lakesInBounds`,
`treeDensity`. `roleTier(heart,dist)`→core/district/outskirts; `heart.rank`→minor/major.

## Tripwires (CLAUDE.md, non-negotiable)

#1 no-build, importmap in BOTH html · #2 no `THREE.X=Y` (threeShim) · #3 iOS audio sync gesture ·
#4 determinism (fresh salts, quantize-before-hash, append-only, self-test green) · #5 lakes/roads
NO chunkKey (persistent colliders) · #6 `userData.shared` on pooled resources · #7 InstancedMesh
`instanceMatrix.needsUpdate=true` · castShadow audit holds ~56 · sandbox-pass ≠ game-pass (boot
the real game every milestone).

## Artifact pointers (all under `openspec/changes/v2-worldgen-3d-integration/`)

`proposal.md` · `design.md` (D-A..D-J + D-I REVISED) · `specs/worldgen-3d-world/spec.md` +
`specs/worldgen-road-junctions/spec.md` · `tasks.md` (Groups A–I, A done) · `session-log.md`
(Current Status + Key Decisions D1–D6 + Work Log) · `questions-for-human.md` (Q0 = the standing
autonomous directive) · `deliberations/001-initial/` (briefing + 5 council + results.md w/ the
full Risk Register R1–R15 and every hardened sub-task).

## Standing directive (Gary, 2026-06-06)

Take this all the way to a working new world map in the 3D game, within OpenSpec
(plan → /deliberate → apply → verify → /smart-review). **Don't stop to ask** — state an
assumption + sensible default, proceed, log it. New change or continue, whatever's clever.
At ~75% context: write a fresh HANDOFF + compact + continue. Commit bootable checkpoints
(with CHANGELOG in the same commit) for resilience.
