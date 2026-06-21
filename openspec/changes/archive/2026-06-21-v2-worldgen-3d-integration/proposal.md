## Why

The live game's world is a per-chunk dice roll: `chunks.js` stamps a rigid `+`-path
through every 80m chunk center and `pickTheme` drops a stage/court/camp wherever the
dice land — so stages sit on roads, there's no intentional structure, and the festival
never reads like a *place*. We already built and tuned the answer in 2D: a deterministic,
render-agnostic `src/worldgen/` generator (a hierarchy of **hearts** → **arterial roads**
→ lobed **lakes** → density **forests**) that gives an infinite world real structure with
no global planner. This change spends that asset — it wires the generator into the live 3D
game as **v2 worldgen**. Now is the moment because the generator is verified (self-test
20/20) and the 3D integration is the only thing standing between the planning brain and a
world players actually drive through.

## What Changes

- **BREAKING (world-regenerating):** Replace the per-chunk `+`-path grid, `pickTheme`,
  and `THEME_BUILDERS` content-selection in `chunks.js` with **worldgen-driven placement**.
  The chunk system stays as the streaming/LOD engine; each chunk samples
  `queryPoint`/`queryRegion` for its 80m cell and places what worldgen says belongs there.
- **Roads:** render worldgen **arterial polylines** (chunk-clipped ribbons) in place of the
  `+`-grid. Structures respect `noBuild` (on-road/in-water) → **structurally kills
  stages-on-roads**. Roads become a crowd path-attractor.
- **Lakes:** `LakeManager` **reads** worldgen lakes (`lakeInCell`/`lakesInBounds`, lobed
  outlines) instead of computing its own 320m-macrocell placement. It keeps owning the
  mesh, the sealed-perimeter colliders, beaches, and the distance-based lifecycle (still
  **no chunkKey** — footgun #5).
- **Forests:** scatter trees per worldgen `treeDensity` (organic, heart-cleared, lakeshore
  rings) in place of the 5x5-block `forests.js` system; keep the tree models, pooling, and
  castShadow discipline.
- **Themes/props:** place stages, food courts, vendor rows, drum circles, porta-potties,
  campsites **per-point** from `roleTier` + heart `rank` + `facing` + `noBuild` — heart
  cores get the anchor (main/side stage + court), districts get camps/vendors/potties,
  outskirts go sparse/forest. Reuse the existing models + registry contract unchanged.
- **Crowd:** ambient density follows heart influence/roleTier; NPCs cluster at hearts,
  drift along roads, avoid water (the registry attractor/footprint contract is unchanged —
  only what gets registered changes).
- **Road junction-merge (2D-first):** add a deterministic **2nd pass** to the generator
  that merges redundant roads converging on a heart into a single trunk + fork (the "lens"
  Gary flagged), tuned in `map-sandbox.html` before the 3D consumes it.
- **Feature flag:** ship behind `USE_WORLDGEN_V2` (disable with `?worldgen=0`) so the old
  world is one flag away during rollout and the game stays bootable throughout.
- **Importmap:** add every `src/worldgen/*` module to the `mods` array in **both**
  `index.html` and `sandbox.html`.

Player-visible: **yes** — this is the headline world change. CHANGELOG required; ROADMAP
"World generation" section trimmed as items land.

## Capabilities

### New Capabilities
- `worldgen-3d-world`: the live-game integration — chunk-clipped worldgen sampling and
  placement of roads, lakes, forests, themed props, and crowd; the feature flag; persistent
  vs chunk-keyed lifecycle; per-tier perf + cross-engine determinism on the game path.
- `worldgen-road-junctions`: a deterministic, window-bounded 2nd pass over the road network
  that merges redundant approaches converging on a heart into a shared trunk (worked out in
  the 2D sandbox, consumed by both 2D and 3D).

### Modified Capabilities
<!-- The prior change's specs (world-layout-generator, worldgen-2d-sandbox) are not yet
     synced to openspec/specs/, so there is no synced requirement to delta. The road
     junction work is captured as the new `worldgen-road-junctions` capability rather than a
     delta, to keep the spec self-contained. No existing synced capability changes. -->
- _(none — no synced specs exist yet to delta against.)_

## Impact

**Subsystems touched:** render pipeline + **world streaming** (`chunks.js`, `world.js`,
`lakes.js`, `forests.js`), **registry/collision** (what registers, not the contract),
**crowd AI** (`crowd.js` spawn weighting + road attraction), **perf tiers** (shadow/draw
budgets on the new geometry), **models** (reused), **sandbox harness** (`map-sandbox.html`
junction-merge viz + the new-model checklist for any new road/junction mesh).

**Code:** `src/chunks.js` (content-selection rewrite, behind flag), `src/world.js` (boot
order, seed routing already in place), `src/lakes.js` (read worldgen placement), `src/forests.js`
(replace with density scatter or retire), `src/worldgen/roads.js` (+ junction pass),
`src/worldgen/index.js` (contract may gain junction/road-render fields, append-only),
new `src/worldgen/placement.js` (roleTier+rank → theme/prop mapping for 3D), `index.html`
+ `sandbox.html` importmaps, `map-sandbox.html` (junction viz).

**Tripwires brushed (all explicitly in scope):**
- **Determinism (footgun #4):** quantize before hash, reuse `rng.js` salts, self-test stays
  green; the contract tuple is **append-only**; re-verify the golden cross-engine (Node vs
  browser already differ on lake `sin/cos` — documented).
- **Persistent lifecycle (footgun #5):** worldgen lakes/roads carry **no chunkKey** so their
  colliders survive host-chunk unload; chunk-owned props keep their chunkKey.
- **threeShim (footgun #2):** new materials go through the tier-aware path; never `THREE.X=Y`.
- **Disposal safety:** new pooled geometries/materials tagged `userData.shared`.
- **Perf budgets:** new road/lake/forest geometry must hold low 80/150k, mid 200/400k,
  high 400/1.2M; don't reflexively `castShadow=true`.
- **iOS audio:** boot-order changes must not insert an async hop before `Sound.init()`.
- **Importmap in BOTH html files.**
- **Sandbox-pass ≠ game-pass:** the longest call chain (`buildWorld → ChunkManager.update →
  _generate → placement`) only runs in the real game — boot it every milestone.

**Scope Check:** the placement pattern (read worldgen → place props → register with
footprint/collider/attractor) repeats across roads, lakes, forests, and every theme. It is
centralized in a new `placement.js` + per-chunk sampler so the mapping lives in one place
rather than scattered across theme builders. The old `THEME_BUILDERS` and `forests.js`
5x5/`lakes.js` 320m-placement are **in scope to replace** (not leave dual-running); the
feature flag preserves the old path for rollback only. Models, registry, collision,
spatial-hash, and audio wiring are **out of scope** (reused as-is).
