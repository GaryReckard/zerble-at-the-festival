# HANDOFF — v2-worldgen-3d-integration

> **New session: read this first**, then `tasks.md` (the executable roadmap),
> then `deliberations/001-initial/results.md` (the Risk Register + every hardened
> sub-task), then the latest Work Log entry in `session-log.md`. This is the
> consolidated "hit the ground running" doc for wiring the 2D worldgen into the
> live 3D game.

## TL;DR — what this is and where it stands

Wiring the verified, deterministic 2D `src/worldgen/` generator (built by the
`procedural-map-generator` change) into the **live 3D game** as v2 worldgen — the
ROADMAP "big one." Full OpenSpec pipeline so far: `/opsx:ff` (proposal/design/specs/
tasks) → tier-3 `/deliberate` (5 council + mediator, all "Proceed with mitigations",
results folded into tasks as Groups A–I). **Group A (paperwork) is DONE.** Next is
**Group B (scaffolding)** — no code written into the game yet. Everything ships behind
a `USE_WORLDGEN_V2` flag (`?worldgen=0` disables).

Committed on branch `procedural-map-generator`:
- `68b22eb` — the 2D road/forest refinement (lake-heart proxy + route-around + tree-dots).
- `4a1742a` — this change's planning artifacts + deliberation.

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
  Force a tier: `?perf=low|mid|high`. Disable v2: `?worldgen=0`.
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
