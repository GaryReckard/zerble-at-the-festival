# Deliberation Briefing: Wire src/worldgen/ into the live 3D game (v2 worldgen)

## Task
Stress-test the implementation plan for the OpenSpec change `v2-worldgen-3d-integration`
BEFORE building it. The plan wires the already-built, deterministic 2D `src/worldgen/`
generator (hearts → arterial roads → lobed lakes → density forests; self-test 20/20) into
the live 3D game as the new world. Read the artifacts in full before forming a position:

- `openspec/changes/v2-worldgen-3d-integration/proposal.md`
- `openspec/changes/v2-worldgen-3d-integration/design.md` (the decisions D-A..D-J, risks, migration)
- `openspec/changes/v2-worldgen-3d-integration/specs/worldgen-3d-world/spec.md`
- `openspec/changes/v2-worldgen-3d-integration/specs/worldgen-road-junctions/spec.md`
- `openspec/changes/v2-worldgen-3d-integration/tasks.md`

Background on the 2D generator + decisions it rests on:
- `openspec/changes/procedural-map-generator/HANDOFF.md` and `.../design.md`
- The generator itself: `src/worldgen/{index,constants,hearts,water,roads,density,roles,selftest}.js`
- The 2D sandbox: `map-sandbox.html`

## Context
- **OpenSpec Change**: `openspec/changes/v2-worldgen-3d-integration/`
- **ROADMAP item**: "World generation (procedural map)" → "Wire the generator into the live
  3D world as v2 worldgen" (a deliberate world-regenerating break).
- **Subsystem(s)**: render-pipeline, world-streaming, registry-collision, crowd-ai, perf-tiers,
  models (reused), sandbox-harness.
- **Files affected**: `src/chunks.js` (content-selection rewrite behind a flag), `src/world.js`
  (boot order), `src/lakes.js` (read worldgen placement), `src/forests.js` (replace 5x5 with
  density scatter), `src/worldgen/roads.js` (+ junction-merge 2nd pass), `src/worldgen/index.js`
  (contract append-only), new `src/worldgen/placement.js`, `index.html` + `sandbox.html`
  importmaps, `map-sandbox.html` (junction viz).
- **ARCHITECTURE.md sections relevant**: render pipeline, world chunks/forests/lakes, registry,
  collision, crowd AI, perf tiers.

### Current game world systems (what's being replaced/kept), from a full codebase map:
- `chunks.js`: 80m chunks, lazy-load ring (PERF.chunkLoadRadius 1–2), **1 chunk/frame budget**,
  never-unload-until-UNLOAD_RADIUS. Per chunk: `placePaths` stamps a rigid `+` (two 5m dirt
  ribbons through the chunk center), `pickTheme(cx,cz)` = `mulberry32(worldHash(cx,cz,1))`
  (salt=1), `THEME_BUILDERS[theme](ctx)` places props radially around the chunk center, then
  scatterTrees/scatterPortaPotties/spawnAmbientCrowd. Props `registry.add({kind,position,
  footprint,collider,attractor,chunkKey:ctx.key})`. On unload `registry.removeChunk(key)` sweeps
  chunkKey'd entries (skips `userData.shared`). Salts in use: theme=1, STYLE_SALT=0xC4FE7B2A,
  SPAWN_JUG_SALT=0x5A17B0BB, POTTY_SALT=0x9E3779B1.
- `lakes.js`: `LakeManager`, 320m macrocell, 45% density, load 720/unload 1500, ShapeGeometry
  water + sealed-perimeter sphere colliders (`lake_edge`, **NO chunkKey** — footgun #5) + beaches
  + lakeside campsites. `WATER_MAT` shared.
- `forests.js`: 5x5 chunk blocks, one center at (2,2), 3x3 footprint, `getForestAt` pure-hash,
  chunk-keyed, designed interior (paths + central campsite/drum circle). Tree models in
  `models/tree.js` (pooled trunk geo + foliage mats `userData.shared`, lowest-tier-only castShadow).
- Boot: title tap → `Sound.init()` (sync, iOS) → `buildWorld(scene,crowd)` → `lakeManager.update()`
  FIRST → `chunkManager.update()` → render loop. Seed `?seed=` → `setSessionSeed` → SESSION_SEED →
  worldgen already reads it. threeShim Lambert swap on low tier. importmap `mods`/`models` in BOTH
  index.html + sandbox.html.
- Crowd: `spawnAmbientCrowd(ctx,count)` clusters NPCs at in-chunk attractors (weight≥0.5, 70%
  near), per-theme counts; NPCs also pulled toward the 80m path grid.
- Worldgen ALREADY produces: `queryPoint(x,z)` tuple (heart, heartDist, heartInfluence, roleTier,
  onRoad, roadTier, facing, footprint, inLake, noBuild, treeDensity, lifecycle:'persistent',
  groundY), `queryRegion(bounds)` {hearts, roads, lakes}, `lakeInCell`/`lakesInBounds`/`lakeAt`,
  `treeDensity`. Determinism is edge/pair-seeded + integer-quantized.

### The plan's core architecture decisions (read design.md for full rationale):
- D-A: a per-chunk worldgen **sampler** (chunk = streaming engine), NOT a separate heart
  lifecycle manager.
- D-C: a heart's anchor structures are owned by the one chunk containing the heart center.
- D-D: roads = chunk-clipped arterial ribbons, passable, chunk-keyed.
- D-E: LakeManager reads worldgen lakes (swap placement source only).
- D-F: forests = per-chunk treeDensity scatter (replace the 5x5 system).
- D-G: ship behind `USE_WORLDGEN_V2` (`?worldgen=0` to disable).
- D-I: road junction-merge = a deterministic, window-bounded, non-recursive per-heart 2nd pass.

## Constraints (the tripwires — non-negotiable)
- No build step; a new src/ module goes in the importmap in BOTH index.html AND sandbox.html.
- ES module namespaces are frozen — no THREE.X = Y after import; tier overrides via src/threeShim.js.
- iOS audio inits synchronously inside the start gesture — no async hop before Sound.init().
- Determinism is load-bearing — don't reorder/re-salt existing rng() calls; quantize before hash;
  the contract tuple is append-only; the self-test must stay green; the golden already differs
  cross-engine (Node vs browser) on lake sin/cos.
- Lakes omit chunkKey on purpose (footgun #5); shared pooled resources tagged
  userData.shared = true must not be disposed.
- Per-tier perf budgets: low 80 draws/150k tris, mid 200/400k, high 400/1.2M; don't reflexively
  castShadow = true (the audit holds at 56 casters).
- InstancedMesh writes need instanceMatrix.needsUpdate = true.
- A new model is not done until it has a sandbox entry; map-sandbox.html is the worldgen-layout
  sandbox (distinct from sandbox.html's per-entity viewer).
- Sandbox-pass ≠ game-pass — the running game must boot clean. The longest call chain
  `buildWorld → ChunkManager.update → ChunkManager._generate → placement` is where boot bugs hide
  (a prior change crashed here on a `{group,...}` vs `Group` return-shape mismatch).

### Your Output
Write your full Round-1 position to: `[OUTPUT_PATH]`
Return a brief summary to the orchestrator: your Verdict, Key Concern, and 3 bullet points.

### Your Task (Round 1)
1. Propose your prioritized order of operations for this task.
2. Identify the risks/concerns from YOUR domain, grounded in the docs/code (cite file:line or
   the specific decision D-x / task number).
3. Give a Verdict (Proceed | Proceed with mitigations | Block).
You are working in isolation. Do NOT speculate about what other personas think, and do NOT write
an "Anticipated Tensions" section — that's handled later.
