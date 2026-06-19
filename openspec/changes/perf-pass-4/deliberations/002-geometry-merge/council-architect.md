## The Architect's Position

Scope: extending `tent.js:mergeStaticDecor` (the shipped vendor-booth merge,
CHANGELOG 2026-06-16) to the **food-court** (`chunks.js:1526 buildFoodCourtAt`)
and **camp-village** (`chunks.js:1657 buildCampVillageAt` →
`placeSingleCampsite:2527`) worldgen builders, to cut steady-state draw calls
(the measured ceiling: median ~3,750 / max 9,232 draws vs a 400 high-tier
budget).

Lens: structural soundness, module boundaries, registry/lifecycle ownership,
render-pipeline shape. Grounded in the code, not the budget math.

### Priority Sequence

1. **Promote `mergeStaticDecor` + `_bakeForMerge` + the `_MERGED_*` materials
   into a neutral util module** (`src/mergeDecor.js`), exported and imported by
   `tent.js`, `picnicTable.js`, and the `chunks.js` builders alike. Today the
   merge primitive lives in a *model* file (`tent.js:112`) and `picnicTable.js`
   already reaches across to import it — a model-to-model dependency that
   violates the "models are leaf nodes that return a Group" boundary. Asking a
   `chunks.js` builder to `import { mergeStaticDecor } from './models/tent.js'`
   would deepen that wrong-way edge (an orchestration layer reaching into a leaf
   model for a general algorithm). Move it once, fix three call sites, add the
   one new module to all four importmaps (`index.html`, `sandbox.html`,
   `hub-sandbox.html`, `map-sandbox.html` — though map-sandbox is worldgen-only
   and likely won't need it) per `.claude/rules/no-build.md`, run
   `bin/check-importmaps`.

2. **Merge PER-CLUSTER, after the cluster's static props are placed, NOT
   per-chunk-at-completion.** A food court and a camp village each build into
   `ctx.group` (the chunk group) alongside trees, roads, other clusters, and —
   critically — animated/emissive subtrees whose object references are held by
   side-lists (`forestAnimatables`, `stagePerformers`, crowd). A blind
   per-chunk merge at `_generate` completion would have to walk the *entire*
   chunk group and would smear unrelated clusters into one buffer, destroying
   per-cluster frustum-cull AABBs and the by-key disposal/animatable contract.
   Per-cluster keeps each merged mesh local to its builder's sub-group, with its
   own bounding sphere, and keeps the merge set scoped to props the builder
   *knows* are static.

3. **Merge only the genuinely-static structural geometry, and prefer the merge
   to live on a builder-owned sub-group, not on shared model Groups.** See the
   exclusion analysis below — for camp-village the safe merge surface is far
   smaller than it looks, and may not be worth it at all.

### Structural Risks Identified

**Risk — food trucks are built almost entirely from `userData.shared` pooled
geometry + materials; merging unbakes that win.** `foodTruck.js:15-50`: `_GEO`,
`_SHARED_MATS`, and `_bodyMatPool` are all tagged `userData.shared`. The whole
point (file header, perf-pooling rule) is that 3-5 trucks per court *share
draw-batchable buffers*. `mergeStaticDecor` bakes color into per-vertex
attributes and emits a fresh unique merged buffer — it explicitly **disposes
non-`shared` originals but leaves `shared` ones in the scene-graph if still
referenced**, and its design assumption (tent goods) is that originals are
*unique*. Pointing it at food trucks means cloning shared geometry into a unique
per-cluster buffer: you trade N batched draws of pooled geo for 1 merged draw,
but you *lose* the cross-chunk batching three.js already does on the shared
material. The net draw win is real only if trucks in one court currently draw as
many calls as they have meshes (they may already batch). This must be *measured
on Gary's GPU before vs after*, per-court, not assumed. Impact: possible
near-zero draw delta plus a new per-cluster geometry allocation and GPU upload
on every court spawn (allocation-cost regression, the spawn-stall category in
`.claude/rules/performance.md`).

**Risk — food-truck emissive parts (window/serv/sign) are correctly excluded by
the existing emissive guard, which fractures the merge into tiny sets.**
`foodTruck.js:29-35`: `window` and `sign` mats carry `emissive` > 0.
`mergeStaticDecor:120` skips emissive meshes. So per truck only box+cab+canopy+4
wheels are mergeable; window, serv, sign stay separate. A court of 4 trucks
collapses ~28 static meshes → ~4 merged + ~12 emissive left intact. That is a
draw win, but confirm the emissive guard fires correctly on `_SHARED_MATS`
(shared emissive materials must not be color-baked-and-disposed — the guard
protects them, but the merged-mesh's vertex-color material would flatten the
emissive glow if the guard ever regressed). Exclusion is load-bearing here.

**Risk (highest) — camp-village animatables hold direct references to meshes
INSIDE the campsite group; merging would orphan or destroy them.**
`campsite.js:642 buildCampsite` returns `{ group, animatables, footprint }`
where `animatables` contains the exact `emberMat`, `flameMat`, `flame` mesh, and
`PointLight` objects (lines 650-665, 742-743, 772-788) that the central updater
mutates every frame (`emissiveIntensity`, `opacity`, light intensity). These are
registered into `forestAnimatables` with `chunkKey` at
`placeSingleCampsite:2533`. `mergeStaticDecor` *removes and disposes* the
meshes/materials it merges. If a merge ever swept a flame/ember mesh or its
material, the per-frame updater would mutate a disposed material (silent visual
break, possible recompile churn) or a detached mesh. **The merge set for a
campsite MUST exclude every animatable-referenced mesh AND every emissive
mesh.** The emissive guard catches the firepit/flame/ember (all emissive), but
the contract is too implicit — a future non-emissive animated part (a swaying
tapestry, the file header line 9 mentions "tapestry sway") would NOT be caught
by the emissive guard and would get merged and break. Camp-village must use an
explicit `userData.noMerge` tag on every animatable subtree, the same way the
shopkeeper NPC is tagged in tent.js, NOT rely on the emissive heuristic.

**Risk — campsite already does the right intra-cluster merge for its highest-
count prop (tiki torches), so the remaining merge surface is thin.**
`campsite.js:378 buildTorchField` already collapses all torch woodwork into ~3
draws and keeps flames per-mesh for animation. So the leftover static
mergeables in a campsite are: the A-frame tents, folding chairs, and misc
ground props — most built from `userData.shared` pooled geo (`buildCampTent`,
`buildCampChair`). Same shared-geometry caveat as trucks: you'd be un-pooling
shared buffers into a unique merged buffer per campsite, and a village has
12-20 campsites. That is 12-20 fresh merged geometries allocated per village
spawn — a meaningful allocation-cost hit at exactly the moment (camp-village
generation) that already does heavy work. **Recommend: do NOT merge per
individual campsite. If anything, merge the chairs/tents across the WHOLE
village into one buffer** — but that fights the per-cluster-AABB goal and the
fact that campsites spill into 3 neighbour chunks (`chunks.js:2554-2560`) while
staying parented to one chunk group. The village-wide merge AABB would be huge
(60m envelope) and cull poorly. This is a genuine "merging across a cluster
loses per-object culling that matters" case.

**Risk — registry/collider separation is preserved (good), but verify the merge
runs AFTER registry.add.** In both builders, `registry.add` records
`position/footprint/collider/attractor/chunkKey` from the builder's own
coordinates (`chunks.js:1554`, `1572`, `1622`, `2537`) — colliders are
data-only registry entries, fully decoupled from the visual meshes. Merging the
visuals cannot touch colliders. This is clean and is the one place the
architecture makes this refactor safe. The merge must happen *after* the props
are added to `ctx.group` and *after* `registry.add`, purely as a
visual-graph post-pass, consuming no rng (confirm: `mergeStaticDecor` draws no
rng — `tent.js:112-150` is rng-free; preserves determinism, footgun #4).

**Risk — disposal correctness for the NEW merged geometry.** Per-cluster merged
buffers are unique and MUST be disposed on chunk unload. `disposeChunkByKey`
(`chunks.js:553`) traverses the chunk group and disposes any non-`shared`
geometry/material — so a merged mesh added under `ctx.group` is disposed
correctly *for free*, exactly as the tent path already relies on. The two
`_MERGED_*` materials are module-shared and tagged (`tent.js:86-88`), so the
walk skips them. If the util is promoted to `mergeDecor.js`, the shared merged
materials move with it and keep their tags — verify the tags survive the move.
The food/camp merged meshes inherit this for free **only if added directly to
`ctx.group` or a sub-group still parented under it** — do not park them on a
detached or model-internal group.

**Risk — shadow-caster discipline.** `mergeStaticDecor:148` sets
`castShadow = true` on the merged OPAQUE mesh unconditionally. For tent booths
that replaced many small casters with one — acceptable. But for trucks, the box
+ cab already cast (`foodTruck.js:62,68`) and wheels/canopy do NOT (deliberate,
line 82). A merged opaque truck mesh casting one shadow for box+cab+canopy+
wheels could *grow* the shadow silhouette (wheels now cast) and adds the merged
mesh to the audited caster set. Per `.claude/rules/performance.md` ("don't
reflexively castShadow") the merge's blanket `castShadow = true` is wrong for
heterogeneous clusters. The util needs a `castShadow` parameter per bucket, or
the builders must split mergeables into a cast bucket and a no-cast bucket.

### Verdict

- **Verdict**: **Proceed with mitigations** — but split the recommendation by
  builder. Proceed on **food-court** (clear draw win on the non-shared, the
  emissive guard already protects the glowing parts, colliders are decoupled).
  **Hold / re-scope camp-village** pending a measured per-village allocation
  cost — the high-count prop (torches) is already merged, the rest is pooled
  shared geometry, the animatable-reference hazard is real, and a village-wide
  merge fights per-cluster culling.

- **Key Concern**: The camp-village animatables (`campsite.js` returns live
  `flameMat`/`emberMat`/`flame`/`PointLight` references held in
  `forestAnimatables`) — a merge that sweeps or disposes any of those breaks the
  per-frame updater silently. The emissive heuristic is *insufficient*
  protection for any non-emissive animated part. Explicit `userData.noMerge`
  tagging is mandatory, not optional.

- **Recommendation / the implementation MUST**:
  1. **Promote the merge primitive to a neutral `src/mergeDecor.js`** util;
     `tent.js`/`picnicTable.js`/`chunks.js` import it. No model-to-model or
     chunks→model algorithm dependency. Add to all four importmaps; run
     `bin/check-importmaps`.
  2. **Merge per-cluster, post-`registry.add`, rng-free**, into a builder-owned
     sub-group parented under `ctx.group` so `disposeChunkByKey` frees the
     unique merged geometry and skips the tagged shared materials.
  3. **Exclude by explicit `userData.noMerge` tag, not by the emissive
     heuristic** — tag every animatable subtree (flames, embers, NPC cook,
     any swaying part) and every collider-relevant visual. Keep the
     merge-failure path that leaves originals intact.
  4. **Parameterize `castShadow` per bucket** so the merge doesn't grow the
     audited shadow-caster set or make wheels/canopy cast.
  5. **For camp-village specifically**: do not merge per-campsite (un-pools
     shared geo into 12-20 fresh buffers per village at spawn time). If pursued,
     it needs its own measured justification.
  - **Verify on Gary's capture (Codespaces has no WebGL)**: ESM parse +
    importmap-in-all-four + `bin/check-importmaps` + the registry-determinism
    gate locally; then on Gary's real GPU: per-court / per-village **draws
    before vs after** (the win must be net, after losing cross-chunk shared
    batching), tris unchanged, `renderer.info.memory.geometries` does NOT climb
    per chunk-gen, shadow-caster count unchanged, and a clean boot through
    `buildWorld → ChunkManager.update → _generate → buildWorldgenKind` at Noon
    and Midnight (emissive parts still glow, flames still animate).
