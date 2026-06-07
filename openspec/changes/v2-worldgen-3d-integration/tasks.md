<!-- Folded from deliberation 001-initial/results.md (5 council + mediator, synthesis).
     Resolved order: A(paperwork) → B scaffold → C roads → D placement → E lakes →
     F forests → G crowd → H gates → I docs. Junction-merge deferred to a fast-follow.
     Source-of-truth lever: Option (b) RAW (Gary's standing directive → recommended default).
     R# refer to the Risk Register in results.md. The six High/Critical rows are binding apply-gates. -->

## A. Source-of-truth + determinism decision (paperwork; do first)

- [x] A.1 Record in design.md (D-I revised): the 3D game consumes the **RAW** arterial network for both rendering and the `noBuild`/`facing`/crowd gates; `nearestRoad`/`roadsInBounds` are the single source of truth, unchanged by this change. (R1)
- [x] A.2 Defer the road junction-merge to a separate fast-follow change (2D-sandbox-only); strike it from this change; note it in ROADMAP at landing (I.5). (R1)
- [x] A.3 Re-confirm in design.md: contract tuple stays append-only; self-test stays 20/20 **by construction** (3D wire-in only reads the unchanged contract; only per-chunk scatter jitter adds a fresh salt). (R1, footgun #4)
- [x] A.4 Deliberation gate (old §2.1) — this council IS the gate; complete on fold.

## B. Scaffolding / flag / importmap / salt / empty-placement boot (force-multiplier gate)

- [x] B.1 Add all 8 `src/worldgen/*` modules (`constants,hearts,water,roads,density,roles,index,selftest`) to the importmap `mods` array in BOTH `index.html` AND `sandbox.html` (today 0/8 present in either); confirm the cache-buster resolves nested `worldgen/index` paths (mirror `map-sandbox.html`). (R6-adjacent, footgun #1)
- [x] B.2 Add `USE_WORLDGEN_V2` flag — resolved ONCE at module load (const + `?worldgen=0` override), read once per chunk, never per-placement-point.
- [x] B.3 Create `src/worldgen/placement.js` — pure + three-free (lives in `src/worldgen/`, returns plain descriptors `{kind,localX,localZ,yaw,footprint,...}` only; MUST NOT import `three` or `models/*`). Add `worldgen/placement` to BOTH importmaps in the same commit it's created. (R-architecture)
- [x] B.4 Reserve `placement.js`'s jitter salt as a named constant in the `0x4D41_xx` worldgen `SALT` namespace (constants.js) with a header comment asserting non-collision with theme=1 / STYLE_SALT / SPAWN_JUG_SALT / POTTY_SALT. (footgun #4)
- [x] B.5 Empty-placement boot smoke test: flag ON + a stubbed placement that places NOTHING → prove `_generate → placement` runs empty without crashing; `?worldgen=0` → byte-for-byte today's world; `__dbg.teleport` to a known heart-center chunk and boot there (origin (0,0) is pinned spawn, may not be a heart). (R2, sandbox-pass≠game-pass)
- [x] B.6 No worldgen work in the start gesture: keep seed resolution + worldgen warm-up at module-eval / inside `buildWorld`; NO await/setTimeout/cache-warm between the title tap and `Sound.init()`. (R12, footgun #3)

## C. Roads — chunk-clipped RAW arterial ribbons (biggest visible win)

- [x] C.1 Shared road material tagged `userData.shared=true` (R6). ALSO tagged the pre-existing untagged `_forestPathMat` (forests.js:330) — a real latent dispose-storm in the SHIPPED game (module-scope, shared across forest chunks, untagged → first forest-chunk unload disposes it → recompile storm). **Footgun found:** a `depthWrite:false` MeshStandardMaterial built at MODULE-EVAL renders INVISIBLY (its meshes draw under the player-centered ground); the legacy per-chunk path material renders only because it's built at RUNTIME. Fix: the shared road material is created LAZILY on first chunk-gen (still one shared instance, R6 intact). (R6, footgun #6 — binding gate)
- [x] C.2 Replaced `placePaths` `+`-grid with chunk-clipped RAW worldgen arterial ribbons. New `buildRibbonFromPolyline` traces the ACTUAL worldgen polyline vertices (not a re-jittered curve — that's the R1 source-of-truth alignment: ribbon == where `nearestRoad`/`noBuild` says the road is); `clipPolylineToBox` (Liang–Barsky) clips to the chunk AABB. Chunk-keyed; consumes `queryRegion(bounds).roads` (raw, per A.1; one queryRegion/chunk per D-A/R7). Verified at vertex level: ribbon centerline matches the clipped arterial exactly (boundary crossings + interior vertices), width=ROAD_WIDTH(7), y=0.06.
- [x] C.3 Single-branch retirement: roads passable (no collider); new chunk-keyed road `path_node` waypoint (reuses the kind so the 2 existing skip-sites stay consistent); legacy `path_node` only runs in the `else` branch. One `if (USE_WORLDGEN_V2)` at the top of `_generate` (B.5). Verified: worldgen=1 registry has NO themed kinds (only road path_node + LakeManager); worldgen=0 has the full legacy world (stage/tent/truck/chunk-tree/25 path_node). (R10)
- [x] C.4 Budget: net draw delta NEGATIVE (~1 ribbon/chunk vs legacy 2 ribbons + pad — verified each road chunk has exactly 1 mesh). Sampler cost (R7) measured headlessly: roadsInBounds cold 4.9ms (first chunk only) / warm <0.4ms, hearts+lakes negligible — well under the 8ms gate; the arterial memo works; no stray `bumpWorldgen()` clears it on the game path (R14). Browser `[chunk slow]` 50–230ms is hidden-tab CPU-throttle inflation, not real cost. Verified renders + boots clean at `?perf=low` (threeShim Lambert path) and default tier; kink-free seam proven (adjacent chunks' ribbon ends coincide to 0.01 m). Both flag states boot with ZERO console errors.

## D. Themes/props — placement.js drives anchors + scatter (correctness headline; highest crash-risk → freshest context)

- [x] D.1 Heart-anchor ownership with an explicit "is this the heart-center chunk?" input/test, so a `core`-but-NOT-center chunk produces scatter, never a 2nd anchor or barren core ring. (R2, Architect Key Concern) — `isHeartCenterChunk(heart,cx,cz,chunkSize)` gates the anchor loop in placement.js; only the center chunk emits `anchor:true` descriptors. Non-center core chunks fall through to scatter. Verified: chunk (8,-3) (seed 1234) is the major-heart center → main_stage + food_court; neighbor (9,-3) → core scatter only, no second stage.
- [x] D.2 District scatter re-derives from worldgen math (`queryPoint`/`heart`), NEVER a live registry lookup of the (possibly-unloaded) chunk-keyed anchor. (R2) — scatter samples `queryPoint(px,pz)` per candidate slot for role/rank/noBuild/facing; no registry read in placement.js (it's pure, can't reach the registry).
- [x] D.3 Fix the `roleTier`/`heart.rank` vocabulary collision BEFORE writing the table: key on the tuple `(roleTier['core'|'district'|'outskirts'], heart.rank['minor'|'major'])`, both enums named + cited in the module header (rewrite as `core×major`, `core×minor`, `district×major`, …). A mis-keyed switch silently places nothing and still passes the green self-test. (R4) — `ROLE_THEME` keyed `${roleTier}×${rank}` via `roleKey()`; both enums named+cited in the header. Verified in-game (not just self-test): core×major produced the full anchor + scatter, NOT silently empty.
- [x] D.4 Honor `noBuild` (off road/water) and `facing` (face nearest road), reading the raw road network; defensively extract model return shapes (`buildForestTree`→Group; others→`{group,...}`). (R2) — placement.js skips `qp.noBuild` candidates + `nudgeOffNoBuild` for anchors; chunks.js adds a defensive `isPointInLake` guard (legacy rendered water until Group E) + `closestBuilding`. `facing` → `roadFacingYaw` (= π/2 − facing) applied to the yaw-aware `buildStage` and scatter props. Return shapes: `buildStage`/`buildDrumCircleAt` register internally; `placeSingleCampsite` + the *At helpers extract `.group`/bare-Group per builder.
- [x] D.5 A/B vs `?worldgen=0`; confirm stages-on-roads is structurally gone and nothing is placed in water. — v2 major-heart stage sits beside the worldgen road (off it), lake clear of props; legacy (`?worldgen=0`) origin stage + arch + crowd render byte-identical (yaw-0 path), zero console errors.
- [x] D.6 Boot the REAL game at a heart-center chunk (anchors are sandbox-invisible by construction); watch `buildWorld → ChunkManager.update → _generate → placement`; `preview_console_logs` clean; check backtick budget AND `chunkGenStats.slowest` at `?perf=low`/`mid`. (R2, R11) — booted real game at chunk (8,-3) noon+midnight, low/mid/high tiers, ZERO console errors. Per-chunk placement sampler cost measured headlessly (browser HUD is throttle-inflated, Group C lesson): 2.5–4.4 ms warm / 8 ms cold-once, under the 8 ms R7 gate. Full per-tier draw/tri budget pass deferred to Group H (H.3).

## E. Lakes — LakeManager reads worldgen (smallest blast radius)

- [ ] E.1 ONE deliberate coordinate-frame conversion at the LakeManager↔worldgen boundary: worldgen = absolute world vertices + point-in-polygon (water.js); LakeManager = center-relative + angular `outlineRAt` (lakes.js). Convert at the read boundary (or rewrite the collider walk + canoe clamp to point-in-poly) — not an implicit assumption. (R5)
- [ ] E.2 Assert outline winding (signed area) BEFORE swapping: `placeSealedColliders` assumes CCW (inward normal `(-edz,+edx)`), `buildLake` walks the outline in reverse for ShapeGeometry. Match `lakes.js`'s expectation or fix the reverse-walk + normal sign as a PAIR, or sealed colliders land outside the water (masked by `DoubleSide` → invisible missing collision). (R5 — binding gate)
- [ ] E.3 Verify lake colliders carry NO chunkKey and survive a host-chunk unload (footgun #5): drive INTO a worldgen lake with `__dbg`, confirm damage, `showColliders` at the shore.
- [ ] E.4 Boot, compare feel vs `?worldgen=0` (worldgen `LAKE_CELL=1050`@0.60 vs `lakes.js` 320@0.45 → fewer/larger lakes; 720/1500 load radii may leave the ring empty). The swap must ship; feel-tuning is parkable to a fast-follow A/B.

## F. Forests — per-chunk treeDensity scatter (biggest perf risk; re-budget AFTER lakes)

- [ ] F.1 Reproduce the old hard cap: clamp D-F's `count ∝ density × cellArea × PERF.forestTreeDensityMul` to the proven ~80 trees/chunk ceiling (`forests.js:765` `FOREST_TREE_TARGET_DENSITY=0.022`); keep `forestTreeDensityMul`. (R3 — binding gate, Profiler Key Concern)
- [ ] F.2 Single-branch retirement: with v2 ON, `getForestAt`/`buildForestChunk` (the 5×5 path) must NOT be consulted; same `if (USE_WORLDGEN_V2)` discipline. (R10)
- [ ] F.3 If scatter introduces InstancedMesh (only if the ~80 cap still busts low — don't rely on the parked variant-bucket idea), every matrix write needs `instanceMatrix.needsUpdate=true`. (footgun #7)
- [ ] F.4 Re-home the "drum-circle nested in dense forest" POI as an `outskirts`+high-density placement; verify reachable. Parkable to a fast-follow if the run is tight.
- [ ] F.5 Gate on `chunkGenStats` (not just the HUD): test `?perf=low`/`mid` while DRIVING through a high-density + lakeshore-ring region at boost; note the lakeshore-ring feedback (larger lakes × `LAKE_RING_BAND=70` → treeDensity 0.62 around every shore). (R3, R9)

## G. Crowd — heart-influence weighting + road attraction (baseline ships; tuning parks)

- [ ] G.1 Scale ambient crowd count per chunk by sampled heart influence / role tier; don't let a core chunk spawn hundreds at once (PERF.crowdMax bounds steady-state).
- [ ] G.2 Gate road attraction on a REAL road: `nearestRoad` in empty outskirts returns `dist=Infinity` but a finite meaningless `dirAngle` — gate on `onRoad` or `dist<threshold`, never trust `dirAngle` blindly; keep heart attractors dominant. Tuning parkable. (R13)
- [ ] G.3 Verify NPCs cluster at hearts, drift along roads, never spawn/path into water OR toward a phantom outskirts road.

## H. Determinism + cross-engine + perf gate (closing correctness gates)

- [ ] H.1 Same-seed-same-world on the game path; worldgen self-test stays 20/20; contract tuple append-only (green by construction).
- [ ] H.2 Cross-engine golden MUST include road EXISTENCE (`nearestRoad(...).onRoad` + arterial-null), not just `queryPoint` tuples; widen/quantize the detour tie-break `Math.abs(ccw-Math.PI)<0.05` (roads.js:167) so it can't straddle the threshold per-engine (JSC vs V8). Upgrades the deferred integer-orientation test to REQUIRED. (R8)
- [ ] H.3 Full per-tier budget pass at `?perf=low`/`mid`/`high`; shadow-caster count not walked back (hold ~56; forest tree count is the lever); include `chunkGenStats` readings. (R3, R11)

## I. Verify / review / docs / landing

- [ ] I.0 Flip `DEFAULT_WORLDGEN_V2` to `true` in perf.js (v2 becomes the default world) — ONLY after the world is populated + verified at all tiers. Until then legacy ships by default; test v2 with `?worldgen=1`.
- [ ] I.1 Run `/opsx:verify` against these artifacts.
- [ ] I.2 Run `/smart-review` (rendering, performance, gameplay, audio, sandbox, docs); fix findings. Any NEW road/junction MESH builder needs a `sandbox.html` entry per the new-model checklist; `placement.js` is pure data (its surface = map-sandbox `wouldHost` inspector + the booted game).
- [ ] I.3 Final boot smoke test at all tiers (title → start → ~2.5s → `preview_console_logs` clean → screenshot at noon + midnight).
- [ ] I.4 CHANGELOG: v2 headline, same commit as code (travels with EACH content commit, not batched).
- [ ] I.5 ROADMAP: remove "wire the generator into the live 3D world as v2 worldgen"; ADD the junction-merge fast-follow; note old-path-removal follow-up.
- [ ] I.6 ARCHITECTURE.md world-streaming rewrite (HARD GATE): the doc still describes `pickTheme`/`THEME_BUILDERS`/5×5 forests, all retired behind the flag here. (R15)
- [ ] I.7 Update HANDOFF + session-log; note follow-ups (junction-merge, forest-POI re-home, lake/crowd tuning, old-path removal) on ROADMAP.
