# council-pragmatist.md — Forest-tree instancing (perf-pass-4, 003)

## The Pragmatist's Position

The lever is real and the plan is sound, but it's drawn as one big landing. My
job is to find the fastest path to a *verified* number-mover without betting the
forest's determinism on a single commit. Two things de-risk this enormously, and
both are already in the tree:

1. **The infrastructure already exists.** The chunk disposal walk handles
   InstancedMesh correctly TODAY — `disposeChunkByKey` (chunks.js:563)
   `if (obj.isInstancedMesh) obj.dispose();`, with `userData.shared` skips on
   lines 556/560. The briefing's "leak risk" question (risk #2) is already
   answered: per-chunk instance buffers are freed on unload, module-shared unit
   geos are skipped. There is a working per-chunk-InstancedMesh precedent in the
   *same file we're editing* (forests.js:400 — the forest-path torches use 3
   shared InstancedMeshes per path).

2. **Birds are decoupled from the mesh.** birds.js:157-169 reads `e.perches` and
   `e.crown` straight off the **registry entry** (`registry.byKind('forest_tree')`),
   never off the tree `Object3D`. So as long as `scatterForestTrees` keeps
   computing `perches`/`crown` and stuffing them in the registry entry
   (forests.js:929-930), the visual mesh can become anything — instances, a
   point cloud, nothing — and birds don't notice. Briefing risk #4 dissolves.

That means the only load-bearing risk left is **determinism** (the rng call
order), and we already own the gate that proves it: `bin/layout-snapshot`
captures `forest_tree`/`tree` registry entries (bin/layout-snapshot:35, keyed
`kind|x|z|footprint|...` at :281). A before/after self-diff is the determinism
proof. So the work is gateable; the question is purely *sequencing and slice
size*.

### Critical Path

The longest dependency chain — what must happen in order:

1. **Bank the free win first (no instancing).** Kill the per-tree
   `MeshStandardMaterial` at tree.js:107 and the per-tree cone material at
   tree.js:124 (chunk-tree `buildTree`). These are allocation-only, share-pool
   into the existing module pools, **don't touch rng order at all**, and are
   independently shippable. This is the lowest-risk, fastest-to-verify slice and
   it unblocks nothing else — so it goes first precisely *because* it's free and
   carries zero determinism risk. It's a clean warm-up that proves the
   harness/gate cadence before we touch the rng-sensitive code.

2. **Establish the determinism baseline.** Before any descriptor refactor, Gary
   captures a `bin/layout-snapshot` over a fixed seed-set at a dense forest. This
   baseline is the thing every later slice diffs against. Capturing it is on the
   critical path — without it, slice 3's "byte-identical" claim is unverifiable.

3. **Forest FOLIAGE-only instancing (the proof slice).** Refactor
   `buildForestTree` → descriptors, instance ONLY the crowns/cones (icosa + cone
   buckets — the 2,637 + 2,120-draw buckets per the briefing). **Trunks stay as
   individual meshes for now**, on their already-shared `_forestTrunkMat`/
   `_birchTrunkMat`/`_trunkMat`. This is the smallest change that proves the
   lever moves the draw number, and it isolates the determinism diff to one rng
   reordering.

4. **Trunks + chunk-tree instancing (the completion slice).** Only after slice 3
   diffs clean and Gary confirms the draw drop. Trunks vary in dims (taper,
   height) so they need per-instance scale baked into the matrix — slightly more
   fiddly than foliage; deferring them keeps slice 3 small.

5. **Per-forest-block consolidation — DON'T. Park it.** (See Deferred.)

### Priority Sequence

1. **Slice 0 (free win, ship immediately):** chunk-tree material pooling at
   tree.js:107 + tree.js:124. Replace the two `new THREE.MeshStandardMaterial`
   with pooled lookups. The leaf path already picks a color from `TREE_GREENS`
   (tree.js:108) — pool one shared mat per `TREE_GREENS` index, exactly like
   `_foliageMats` does for forest greens (tree.js:50-54). The cone path uses a
   single fixed color `0x2d5d3e` (tree.js:124) — one shared module mat. Tag all
   `userData.shared = true`. **Critically: the rng draw `Math.floor(rng() *
   TREE_GREENS.length)` (tree.js:108) must stay exactly where it is** — you're
   replacing where the material *comes from*, not removing the rng pick. No call
   reorder → no determinism diff needed (but run the gate anyway, it's cheap).
   Gates: `node --check`, `node bin/test-registry-grid`, boot-clean. This is
   ~30 min of work and it's a real allocation win on every chunk spawn.

2. **Slice 1 (foliage descriptors + instancing — the proof):** Refactor
   `buildForestTree`/`buildTallPine`/`buildOak`/`buildBirch` to emit descriptors
   `{ type, x, y, z, scale, rotY, colorHex, crown, perches }` calling `rng()` in
   the **byte-identical order** to today. `scatterForestTrees` (forests.js:911)
   accumulates descriptors, then builds per-chunk InstancedMeshes for crowns
   (unit `IcosahedronGeometry(1,1)`) and pine cone tiers (unit
   `ConeGeometry(1,1,8)`), bucketed by `_foliageMats` green-index (already 7
   buckets — reuse them; no `instanceColor` needed, sidesteps a whole material
   question). Trunks stay as-is. Module-shared unit geos tagged
   `userData.shared = true`. `instanceMatrix.needsUpdate = true` after the fill
   (tripwire #7). Registry entries unchanged.

3. **Slice 2 (trunks + chunk-trees — completion):** Instance the forest trunks
   (per-instance scale for taper/height) and apply the same descriptor pattern to
   `buildTree` + `scatterTrees` (chunks.js:1683). Lower priority — it's the
   smaller bucket-share for forest, and chunk-trees are sparse (~18/chunk,
   chunks.js:1684).

### The smallest first slice that proves the lever

**Foliage only — icosa crowns + pine cones — instanced per chunk, trunks left
alone.** Rationale:

- The briefing's own measurement says the foliage buckets ARE the lever:
  `IcosahedronGeometry·240v` = 2,637 draws + `ConeGeometry·35v` = 2,120 draws =
  **~4,757 of the ~7,000 tree draws.** Trunks (cylinders) are a smaller slice and
  share the ~3,700 cylinder bucket with non-tree geometry, so they're noisier to
  attribute. Lead with the cleanest, biggest, most-attributable win.
- Foliage already shares materials by green-index (`_foliageMats`,
  tree.js:50-54), so I can bucket InstancedMeshes by that exact index — **zero
  new material decisions, no `instanceColor`.** Trunks span three different mats
  (`_forestTrunkMat`, `_birchTrunkMat`, and chunk `_trunkMat`) and varying
  cylinder dims → more buckets, per-instance taper scale. Defer that complexity.
- Smallest possible determinism diff: only the foliage build path moves; trunk
  rng draws stay in place. Easier to eyeball the rng order, easier to bisect if
  the snapshot diff is dirty.

### The cheapest free win to bank first

**tree.js:107 chunk-tree material pooling.** It's allocation-only (no
instancing, no rng reorder), it's a one-function edit, and per the briefing
chunk-`buildTree` is "worse: allocates a fresh `MeshStandardMaterial` per tree."
Banking it first (a) lands a real per-spawn allocation win, (b) costs almost
nothing, (c) is fully agent-verifiable for correctness, and (d) carries no
determinism exposure. There is no reason to bundle it into the risky instancing
slice. Ship it standalone, get the cadence warm, then do the rng-sensitive work.

### Verify cadence (agent has no WebGL — match 001/002)

Per the established perf-pass-4 cadence (001 results: "Codespaces has no WebGL —
live perf, visual, iOS… is Gary's job"), each slice has agent-static gates and a
batched Gary round-trip.

**Per-slice agent-static gates (every slice):**
- `node --check src/models/tree.js src/forests.js src/chunks.js` (syntax).
- `node bin/test-registry-grid` (closestBuilding determinism — exit 0).
- `bin/check-importmaps` (only matters if a new module is added — this plan adds
  no new file, so it's a no-op guard, but run it).
- `bin/check-model-dims` (the tree variants are dim-checked — confirm unit-geo
  refactor didn't change built proportions).
- Boot the main game (preview): title card → start → world generates → no
  `TypeError`/shader-compile error in `preview_console_logs`. **This is the
  mandatory game-boot smoke test** (CLAUDE.md "ALWAYS boot the main game"); the
  `buildWorld → ChunkManager._generate → scatterForestTrees` path is exactly the
  longest call chain where boot bugs hide.

**The determinism gate (the load-bearing one) — Gary round-trip:**
- `bin/layout-snapshot` already captures `forest_tree`/`tree` entries
  (bin/layout-snapshot:35,:281). **Before slice 1, Gary captures a baseline**
  over a fixed seed-set at a dense forest. **After slice 1 (and again after slice
  2), Gary re-captures and self-diffs.** A clean diff = positions byte-identical =
  rng order preserved. A dirty diff = the refactor reordered an `rng()` call;
  do NOT ship — bisect. This is the *exact* invariant briefing risk #1 asks for,
  and the tool already exists. No new gate to build.

**Gary visual/number round-trips (batched, not per-edit):**
- **Sandbox** (`sandbox.html?entity=forest_tree_random` + `forest_tree_pine/
  oak/birch`, already wired sandbox.html:284-287): confirm the instanced foliage
  renders at Noon + Midnight, shadows read, perches still look right. NOTE the
  sandbox builds ONE tree via `buildForestTree` directly (sandbox.html:529), so
  **if the descriptor refactor changes the builder's return type, the sandbox
  cases must be updated to build-from-descriptor too** — otherwise sandbox-pass
  is meaningless. Add a small `forest_chunk` composite case (a handful of
  instanced trees) so the *instanced* path — not just the single-tree path — is
  visible in the sandbox. (Per sandbox doctrine: extend the harness before
  bypassing it.)
- **HUD draw count** (backtick overlay + `__dbg.drawCensus()`): Gary captures
  the dense-hub draw census before/after. The success criterion is the
  `IcosahedronGeometry·240v` + `ConeGeometry·35v` buckets collapsing from
  thousands of draws to ~few-per-resident-forest-chunk. This is the *did the
  number move* proof the agent cannot produce.
- **Tri budget** (briefing risk #3): instanced chunks submit all instances when
  visible. Gary confirms `?perf=low` and `?perf=mid` stay under tri budget (low
  150k / mid 400k). Per-chunk granularity (small bounding spheres) keeps
  off-screen chunks culling as units, so this should be fine, but it's a
  GPU-only confirmation.

### Per-chunk now, defer per-forest-block — yes

**Do per-chunk now; do NOT do per-forest-block, now or maybe ever.** Reasons:

- Per-chunk is what the existing lifecycle already supports. Chunks are the
  load/unload unit (80m grid); `ctx.group` is the per-chunk group; the disposal
  walk already frees per-chunk InstancedMeshes (chunks.js:563). Per-chunk
  instancing slots into the existing machinery with **zero lifecycle changes.**
- `forest_tree` entries are already `chunkKey: ctx.key` (forests.js:925), so the
  registry data already unloads per-chunk. Per-chunk visual instancing keeps the
  visual and the registry data on the same lifecycle — no new bookkeeping.
- Per-forest-block (3×3) would mean instance meshes that span chunks, which
  breaks the "unload as a unit" contract and forces a separate lifecycle (like
  lakes' macrocell), plus the determinism story gets harder (trees from 9 chunks
  in one buffer). It's a bigger blast radius for a marginal draw-count
  difference (9 instanced-chunk draws vs ~3 block draws — both are tiny next to
  the ~4,757 we're killing). The briefing itself argues per-chunk (risk-section
  point 3: small bounding spheres frustum-cull as units). Agreed. Park the block
  idea.

### Deferred / Park on ROADMAP

- **Per-forest-block (3×3) instance consolidation:** the 9→3 draw saving is
  rounding error against the ~4,757-draw win, and it breaks the per-chunk unload
  contract. Park it; revisit only if a census after slice 1+2 shows per-chunk
  instanced-mesh count itself is a budget problem (it won't be).
- **`instanceColor` for per-tree green variation:** not needed — `_foliageMats`
  already buckets by 7 green indices (tree.js:50), so N green-bucket
  InstancedMeshes give the same variety with no `instanceColor` complexity and
  no transparent-sort concerns. Park `instanceColor` unless a future census says
  7 buckets × per-chunk is too many draws.
- **Geometry-merge of trunks (the 002 lever):** trunks are a candidate for the
  002 geometry-merge approach instead of instancing (they're static, varied
  dims). Don't double-solve. If 002 lands a merge pass, trunks may be better
  served there — note the cross-ref and let slice 2 defer to whichever of
  {002 merge, 003 instance} ships first. Park the duplication question; don't
  build both for trunks.
- **LOD on distant forest chunks:** already on ROADMAP (performance.md "Open
  items deferred to ROADMAP"). Not this change. Don't re-propose.

### Incremental Delivery Plan

- **Slice 0 (ship FIRST — free, no rng risk):** chunk-tree material pooling
  (tree.js:107, :124). Pool `TREE_GREENS` mats + the single conifer mat into
  module scope, `userData.shared`. **Enables:** nothing downstream blocks on it —
  it's banked independently. **Verify:** `node --check`, `bin/test-registry-grid`,
  game-boot clean, `bin/check-model-dims`. No layout-snapshot needed (no rng
  reorder) but run it for free. CHANGELOG `Performance` entry in the same commit.

- **Slice 1 (ship after baseline capture — the PROOF):** forest FOLIAGE-only
  descriptors + per-chunk InstancedMeshes (icosa crowns + pine cones), bucketed
  by `_foliageMats` green-index. Trunks untouched. **Depends on:** Slice 0
  landed + Gary's `layout-snapshot` baseline captured. **Enables:** proves the
  lever moves the draw number before we touch trunks. **Verify:** all static
  gates + the layout-snapshot self-diff (MUST be clean) + Gary's before/after
  drawCensus + sandbox `forest_tree_*` cases updated to the descriptor path +
  new `forest_chunk` composite case + Noon/Midnight screenshots + `?perf=low/mid`
  tri-budget. CHANGELOG `Performance`; trim any ROADMAP forest-instancing bullet.

- **Slice 2 (ship after Slice 1 diffs clean — COMPLETION):** instance the forest
  trunks (per-instance taper scale) + apply descriptor pattern to chunk-trees
  (`buildTree`/`scatterTrees`, chunks.js:1683). **Depends on:** Slice 1's
  descriptor scaffolding + a clean Slice 1 snapshot diff (so we know the pattern
  is determinism-safe). **Defer-or-merge note:** if 002 geometry-merge ships
  first and covers trunks, Slice 2 trunks fold into that instead. **Verify:**
  same gate set; fresh layout-snapshot diff; fresh drawCensus.

### Verdict

- **Verdict**: **Proceed with mitigations.** Ship — but as the ordered slices
  above, not the one-shot landing the briefing sketches. The plan's core is
  sound and most of the briefing's named risks are already mitigated in the
  shipped code (disposal handles InstancedMesh at chunks.js:563; birds read the
  registry not the mesh at birds.js:157).

- **Key Concern**: **The determinism gate is a Gary-round-trip
  (`layout-snapshot`), not an agent-static gate** — and it's the one
  load-bearing risk. The mitigation is non-negotiable sequencing: capture the
  baseline BEFORE Slice 1, self-diff AFTER each rng-touching slice, and treat a
  dirty diff as a hard block (a forest reshuffle hits everyone playing across the
  change, CLAUDE.md tripwire #4). Secondary: the sandbox `forest_tree_*` cases
  (sandbox.html:284-287, :529) build via the raw builder return — if the
  descriptor refactor changes that return shape, those cases must be updated or
  sandbox-pass is a lie.

- **Recommendation**: Bank the tree.js:107 free win standalone today (zero
  risk). Lead the instancing with **foliage-only** (≈4,757 of ≈7,000 tree
  draws, cleanest determinism diff, reuses the existing `_foliageMats` buckets
  with no `instanceColor`). Keep granularity **per-chunk** — it slots into the
  existing unload machinery with no lifecycle change; park per-forest-block.
  Defer trunks + chunk-trees to Slice 2 and cross-ref 002 so trunks aren't
  solved twice.
