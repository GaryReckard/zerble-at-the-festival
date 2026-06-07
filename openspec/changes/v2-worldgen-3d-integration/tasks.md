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

- [ ] B.1 Add all 8 `src/worldgen/*` modules (`constants,hearts,water,roads,density,roles,index,selftest`) to the importmap `mods` array in BOTH `index.html` AND `sandbox.html` (today 0/8 present in either); confirm the cache-buster resolves nested `worldgen/index` paths (mirror `map-sandbox.html`). (R6-adjacent, footgun #1)
- [ ] B.2 Add `USE_WORLDGEN_V2` flag — resolved ONCE at module load (const + `?worldgen=0` override), read once per chunk, never per-placement-point.
- [ ] B.3 Create `src/worldgen/placement.js` — pure + three-free (lives in `src/worldgen/`, returns plain descriptors `{kind,localX,localZ,yaw,footprint,...}` only; MUST NOT import `three` or `models/*`). Add `worldgen/placement` to BOTH importmaps in the same commit it's created. (R-architecture)
- [ ] B.4 Reserve `placement.js`'s jitter salt as a named constant in the `0x4D41_xx` worldgen `SALT` namespace (constants.js) with a header comment asserting non-collision with theme=1 / STYLE_SALT / SPAWN_JUG_SALT / POTTY_SALT. (footgun #4)
- [ ] B.5 Empty-placement boot smoke test: flag ON + a stubbed placement that places NOTHING → prove `_generate → placement` runs empty without crashing; `?worldgen=0` → byte-for-byte today's world; `__dbg.teleport` to a known heart-center chunk and boot there (origin (0,0) is pinned spawn, may not be a heart). (R2, sandbox-pass≠game-pass)
- [ ] B.6 No worldgen work in the start gesture: keep seed resolution + worldgen warm-up at module-eval / inside `buildWorld`; NO await/setTimeout/cache-warm between the title tap and `Sound.init()`. (R12, footgun #3)

## C. Roads — chunk-clipped RAW arterial ribbons (biggest visible win)

- [ ] C.1 Create a module-scope `ROAD_MAT`, tag `userData.shared=true`; ALSO tag the pre-existing untagged `_forestPathMat` (forests.js:330) while in scope — D-D's "shared road material" does not exist today (`chunks.js:617` allocates per-chunk). (R6, footgun #6 — binding gate)
- [ ] C.2 Replace `placePaths` `+`-grid with chunk-clipped RAW worldgen arterial ribbons (reuse `buildCurvedPath`); chunk-keyed mesh; consume `roadsInBounds`/`nearestRoad` (raw, per A.1).
- [ ] C.3 Single-branch retirement: roads passable (no collider); the new road crowd-attractor is chunk-keyed; the old `path_node` registration must NOT also run with v2 ON. One `if (USE_WORLDGEN_V2)` at the top of `_generate`, not scattered. (R10)
- [ ] C.4 Budget: verify in `map-sandbox.html` (2D) AND the running game (3D ribbon + a screenshot straddling a chunk seam to prove D-D no-kink) at `?perf=low` and `?perf=mid`.

## D. Themes/props — placement.js drives anchors + scatter (correctness headline; highest crash-risk → freshest context)

- [ ] D.1 Heart-anchor ownership with an explicit "is this the heart-center chunk?" input/test, so a `core`-but-NOT-center chunk produces scatter, never a 2nd anchor or barren core ring. (R2, Architect Key Concern)
- [ ] D.2 District scatter re-derives from worldgen math (`queryPoint`/`heart`), NEVER a live registry lookup of the (possibly-unloaded) chunk-keyed anchor. (R2)
- [ ] D.3 Fix the `roleTier`/`heart.rank` vocabulary collision BEFORE writing the table: key on the tuple `(roleTier['core'|'district'|'outskirts'], heart.rank['minor'|'major'])`, both enums named + cited in the module header (rewrite as `core×major`, `core×minor`, `district×major`, …). A mis-keyed switch silently places nothing and still passes the green self-test. (R4)
- [ ] D.4 Honor `noBuild` (off road/water) and `facing` (face nearest road), reading the raw road network; defensively extract model return shapes (`buildForestTree`→Group; others→`{group,...}`). (R2)
- [ ] D.5 A/B vs `?worldgen=0`; confirm stages-on-roads is structurally gone and nothing is placed in water.
- [ ] D.6 Boot the REAL game at a heart-center chunk (anchors are sandbox-invisible by construction); watch `buildWorld → ChunkManager.update → _generate → placement`; `preview_console_logs` clean; check backtick budget AND `chunkGenStats.slowest` at `?perf=low`/`mid`. (R2, R11)

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

- [ ] I.1 Run `/opsx:verify` against these artifacts.
- [ ] I.2 Run `/smart-review` (rendering, performance, gameplay, audio, sandbox, docs); fix findings. Any NEW road/junction MESH builder needs a `sandbox.html` entry per the new-model checklist; `placement.js` is pure data (its surface = map-sandbox `wouldHost` inspector + the booted game).
- [ ] I.3 Final boot smoke test at all tiers (title → start → ~2.5s → `preview_console_logs` clean → screenshot at noon + midnight).
- [ ] I.4 CHANGELOG: v2 headline, same commit as code (travels with EACH content commit, not batched).
- [ ] I.5 ROADMAP: remove "wire the generator into the live 3D world as v2 worldgen"; ADD the junction-merge fast-follow; note old-path-removal follow-up.
- [ ] I.6 ARCHITECTURE.md world-streaming rewrite (HARD GATE): the doc still describes `pickTheme`/`THEME_BUILDERS`/5×5 forests, all retired behind the flag here. (R15)
- [ ] I.7 Update HANDOFF + session-log; note follow-ups (junction-merge, forest-POI re-home, lake/crowd tuning, old-path removal) on ROADMAP.
