# Briefing — Forest-tree draw-call instancing (perf-pass-4, the option-(b) draw lever)

> Same briefing for every persona. Read `CLAUDE.md`, `ARCHITECTURE.md`,
> `.claude/rules/performance.md`, `.claude/rules/perf-pooling.md`, and the code
> paths named below before writing. Write your own `council-<role>.md` in this folder.

## The decision on the table

Should we instance forest + chunk trees to cut draw calls, via the specific plan
below — and if so, what must the implementation get right? Stress-test the plan;
don't rubber-stamp it.

## Why now — the measurement (ground truth)

`__dbg.drawCensus()` was added (B0 made true draw counts readable under
post-processing). Run at a **dense hub**, it reports:

- **14,359 pre-frustum scene draws** (whole resident scene-graph; over-counts vs
  `renderer.info`, which frustum-culls to **~3,750 median / 9,232 max** — against a
  **400-draw budget**, all tiers). Read ratios, not the exact 14k.
- Top buckets, by draws, all `uniq` (non-shared geo), all `MeshStandardMaterial`:
  - `IcosahedronGeometry·240v` — **2,637 draws** (detail-1 icosa = 240v)
  - `ConeGeometry·35v` — **2,120 draws**
  - Cylinders (40/46/52v) — **~3,700 draws** combined
  - Capsules (126/162v) — **~1,300 draws** (the crowd; out of scope here)
- `mergeCandidateUniqueGeosByMaterial: { MeshStandardMaterial: 65, ... }`
- 124 InstancedMeshes already exist (4,840 instances) — trees are NOT among them.

## What the code actually does (verified)

- `src/models/tree.js`:
  - Pools foliage **materials** by green-index (`_foliageMats`, `userData.shared`),
    and trunk geo/mat (`_trunkGeo`/`_trunkMat`, shared). **Good.**
  - But allocates **geometry per tree**: `new THREE.IcosahedronGeometry(mainR, 1)`
    (buildOak:215/226, buildBirch:264) and `new THREE.ConeGeometry(baseR, h, 8)`
    (buildTallPine:183), plus a per-tree trunk cylinder (varying dims). So every
    crown/cone/trunk is its **own draw call** → the icosa-240v and cone-35v buckets.
  - `buildTree` (chunk trees) is worse: it allocates a **fresh `MeshStandardMaterial`
    per tree** (tree.js:107) in addition to unique geo.
  - Trees are **static** — no per-frame sway/anim updater anywhere.
  - Each built tree exposes `userData.crown {x,y,z,r}` and `userData.perches [...]`
    (local-space ring); `worldPerches()`/`worldCrown()` convert to world-space.
- `src/forests.js`:
  - `scatterForestTrees` (forests.js:831) places trees per **chunk**: builds the tree
    with a **forest-stable** rng `mulberry32(hash2(forest.seed + dx*131, dz*197+11))`
    (NOT `ctx.rng`), then `ctx.group.add(tree)` (forests.js:914).
  - Each forest tree registers a `forest_tree` registry entry with a hard collider
    (`{radius:1.3, damage:3}`), `footprint:2.0`, `chunkKey: ctx.key`, plus
    `perches`/`crown` read off the built tree (forests.js:920-931). The collider IS
    the forest wall.
- Chunks are the load/unload unit (80m grid). `ctx.group` is the per-chunk group.
  On unload, `chunks.js _unload` removes the chunk group and the disposal walk frees
  geo/mat **unless `userData.shared`**. Forests pin to a 3×3 chunk block; lakes use a
  separate macrocell. (See CLAUDE.md tripwire #5/#6.)

## The proposed plan (the thing to interrogate)

1. Refactor `buildForestTree`/`buildTree` to emit **instance descriptors**
   `{ type, x, y, z, scale, rotY, colorHex, crown, perches }` instead of building/
   returning meshes — calling `rng()` in the **exact same order** as today.
2. `scatterForestTrees` (and the chunk-tree path) accumulate descriptors per chunk,
   then build **~3 InstancedMeshes per chunk**: unit `IcosahedronGeometry(1,1)`
   crowns, unit `ConeGeometry(1,1,8)` pine tiers, unit trunk cylinder. Per-instance
   scale+rotation baked into the matrix; color via `instanceColor` (or N green-bucket
   meshes). Module-shared unit geos (`userData.shared`).
3. **Per-chunk granularity** (not per-forest-block): each chunk's instanced meshes
   have small bounding spheres, so off-screen chunks still frustum-cull as units.
4. Registry `forest_tree` entries (collider/footprint/perches/crown) are **data** and
   stay exactly as-is — only the visual mesh representation changes.

Expected: ~7,000 tree draws → ~3 per resident forest chunk; plausibly **halves total
scene draws**. This is option (b), greenlit by Gary.

## Risks to interrogate (don't limit yourself to these)

1. **Determinism (load-bearing).** rng call-order must not shift, or every forest
   regenerates for anyone mid-change. How do we *guarantee* it and *gate-test* it?
   (`bin/test-registry-grid` checks registry determinism; is a forest-position diff
   needed too? What's the exact invariant?)
2. **Disposal/lifecycle.** Does `chunks.js _unload` call `.dispose()` on an
   InstancedMesh (freeing instanceMatrix/instanceColor buffers), or only walk
   geo/mat? If unit geos are `userData.shared` (skipped), what frees the per-chunk
   instance buffers? Leak risk over a long session of chunk churn?
3. **Tris vs draws.** Instanced chunks submit all instances when visible (no
   per-tree frustum cull within a chunk). Per-chunk bounds it, draws are the
   bottleneck — but confirm against per-tier tri budgets (low 150k / mid 400k /
   high 1.2M), especially low/mid.
4. **Birds.** Birds land on `perches`/`crown`. Instancing the visual must preserve
   that registry data. Any coupling between the bird system and the actual tree
   `Object3D` (vs the registry entry)?
5. **Shadows.** Forest foliage/trunks `castShadow=true` selectively (lowest pine
   tier, oak main crown, etc.). InstancedMesh casts shadow as one unit — does that
   preserve the per-tier shadow discipline, or over/under-cast?
6. **Sandbox + no-build hygiene.** tree.js sandbox cases (buildTallPine/Oak/Birch
   variants are sandbox-exposed); importmaps in all 4 html files; CHANGELOG/ROADMAP.

## Constraints / non-negotiables

- No bundler. ES modules + importmap (4 html files). `three` from CDN 0.160.0.
- Determinism is load-bearing (CLAUDE.md #4). Material-tier shim (#2). Disposal
  + `userData.shared` (#6). InstancedMesh needs `instanceMatrix.needsUpdate=true` (#7).
  No reflexive `castShadow=true` (#9). Per-tier budgets (#10).
- Agent can only statically verify here (no WebGL in Codespaces): `node --check`,
  `bin/check-importmaps`, `bin/test-registry-grid`, `bin/check-model-dims`. Live/
  visual/tri-budget/iOS confirmation is the human's job.

## Your job

Per your role, give a position: ship / ship-with-mitigations / don't-ship-as-drawn.
Cite file:line, command output, or the rules. Name what the plan gets wrong or omits.
Propose the slice cut and the gate tests. Be concrete; no hedging without a citation.
