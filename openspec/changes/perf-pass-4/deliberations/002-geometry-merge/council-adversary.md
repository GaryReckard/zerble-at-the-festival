## The Adversary's Position

> Domain: what breaks. Determinism, disposal, lifecycle, sandbox-pass/game-crash,
> frozen instances, baked-away emissive, stale closures. Grounded in the real code
> in `src/chunks.js`, `src/models/foodTruck.js`, `src/models/campsite.js`,
> `src/models/tent.js`.

### Priority Sequence

1. **Establish the must-not-merge set BEFORE any merge call** — for food-court and
   camp-village, the dangerous elements are not theoretical; they are concrete code
   references (emissive flames in `forestAnimatables`, the truck's shared pooled
   geometry, the torch InstancedMeshes). Get the exclusion list locked first.
2. **Decide the merge SCOPE deliberately.** `tent.js mergeStaticDecor` was designed
   for a single booth whose *goods* were unique per-item geometry. Food trucks and
   campsites are a different animal: they are built almost entirely from
   `userData.shared` pooled buffers. A naive per-cluster `mergeStaticDecor` here does
   the *opposite* of the tent win — see "The shared-pool inversion" below.
3. **Disposal contract for the new merged geo** — unique, non-shared, must dispose on
   unload; the merged *material* if module-shared must be `userData.shared`.
4. **Boot the real game** at `?worldgen=1` (the v2 builders are the call site) on
   low/mid/high. Sandbox renders one model through a different path.

---

### The shared-pool inversion (the headline risk)

`tent.js mergeStaticDecor` won −36% meshes because each booth's **goods** (pottery,
hats, jars, paintings) were *unique per-item geometry+material* — merging collapsed N
unique draws into one and the disposal freed unique buffers (`tent.js:137-142`).

Food trucks and campsites are built the opposite way:

- **`foodTruck.js` is 100% `userData.shared`.** Every geometry (`_GEO`, all tagged
  shared at `foodTruck.js:24`), every material (`_SHARED_MATS` at `:37`, the
  color-keyed `_bodyMatPool` at `:46`) is pooled. Three.js already batches identical
  geometry+material pairs across trucks. A per-truck `mergeStaticDecor` would:
  1. **bake the shared box/cab/wheel geometry into a unique per-truck merged buffer**,
     converting shared, GPU-resident, batched buffers into N unique buffers — a
     *memory and upload regression*, and
  2. the `_bakeForMerge` color-bake (`tent.js:95-104`) collapses the truck's distinct
     materials into one vertex-color material, which **defeats** the existing
     same-material batching and **bakes away both emissive materials** (see below).
  Net: merging a food truck can *increase* draw cost on the second visible truck and
  break its glow. This must be measured per-cluster, not assumed.

- **`campsite.js matFor()` (`:41-56`) and `WOOD_MAT/POLE_MAT/_TORCH_*_GEO` are all
  `userData.shared`.** Same inversion. The torch woodwork is *already* collapsed to 3
  InstancedMeshes per field (`buildTorchField`, `campsite.js:386-404`) — merging on
  top of that is double work that would *un-instance* them.

**Conclusion:** the merge target in these two builders is NOT "lots of unique static
meshes." It is mostly already-pooled / already-instanced. The genuinely unique,
mergeable static surface is small. Whoever implements this must enumerate, per
cluster, which meshes are unique-non-shared-opaque-non-emissive-non-instanced — and
if that set is small, **the merge does not pay and should be scoped out of that
builder**, not forced.

---

### 1. Hard must-not-merge list (by name, from the code)

If any of these is swept into a merged buffer, here is exactly what breaks:

| Element | File:line | If merged → what breaks |
|---|---|---|
| **Food-truck `window` material** (emissive `0x97e6ff`) | `foodTruck.js:29-31` | Glow baked away → service window goes flat/dead at night. `mergeStaticDecor` *does* skip emissive (`tent.js:120`), so this is covered IF the generalized helper keeps that guard — flag if a copy drops it. |
| **Food-truck `sign` material** (emissive `0xffe066`, intensity 0.4) | `foodTruck.js:33-35` | Sign stops glowing — the truck's most visible night feature. Same emissive-skip dependency. |
| **All food-truck shared geometry/material** | `foodTruck.js:24,37,46` | Not "wrong output" but a **perf inversion** + a **double-dispose trap**: the merge's disposal loop frees `!userData.shared` originals only (`tent.js:141-142`), so shared survive — but the *baked clone* (`_bakeForMerge` clones then `g.dispose()` at `tent.js:133`) is fine. The danger is the shared originals get `o.parent.remove(o)` (`tent.js:136`) leaving the truck as one merged blob — acceptable only if it's a net win, which here it is not. |
| **Per-torch flame mesh + `flameMat`** (emissive `0xff5a1a`, intensity 2.0, transparent) | `campsite.js:410-420`, `buildTorchField`; court torches via `chunks.js:1644` | Emissive-skip protects the *opaque* bucket, but the flame is **transparent** → it would land in the *glass* bucket of `mergeStaticDecor` UNLESS the emissive guard catches it first. It IS emissive (`emissiveIntensity 2.0`), so the guard skips it — but it is also **held by reference in an animatable closure** pushed to `forestAnimatables` (`chunks.js:1646`, `:2534`). If a future merge variant removes the flame mesh from its parent, the per-frame updater still holds `flameMat`/`flame` → **stale closure animating a detached/disposed mesh** (no-op flicker at best, GPU-freed-material write at worst). Must-not-merge, hard. |
| **Per-torch `flameLight` PointLight** (`PERF.fancyLights`) | `campsite.js:424-428`, torchField `:424` | Registered with `registerContextLight`; not a mesh so merge ignores it, but it's in the same animatable. Don't touch. |
| **Firepit/chiminea `emberMat`** (emissive `0xff5511/0xff5a1a`, pulsed by nightness) | `campsite.js:202-207,294` | Emissive → skipped by the guard. But it is the `emberMat` returned in the campsite animatable (`forestAnimatables`). Same stale-closure trap as the flame. Must-not-merge. |
| **Torch woodwork InstancedMeshes** (pole/joint/cup) | `campsite.js:386-404` | Already 1 draw each. `mergeStaticDecor` walks `o.isMesh` — `InstancedMesh.isMesh === true`, but it has no per-instance geometry to bake (`_bakeForMerge` reads `geo.attributes` of the *template*, ignoring `instanceMatrix`). Merging would **collapse all instances to one transform** → all torches stack at the origin or vanish. **The generalized helper MUST skip `o.isInstancedMesh`** — `tent.js mergeStaticDecor` never encountered one, so this guard does not exist yet. Critical gap. |
| **Tapestry sway / any `userData.anim` group** (bubbleVendor `group.userData.anim`, `bubbleVendor.js:186`) | `bubbleVendor.js:179-194` | If the court's bubble vendor (`chunks.js:1591`) is ever fed to a merge, its animated jugs/bubbles freeze. The vendor is added via `buildBubbleVendorAt`, not currently a merge input — keep it out. |
| **Sugar-shack cook NPC + `cookEntry`** (food court, `chunks.js:1553`) | `chunks.js:1549,1553` | The cook is an NPC with `chunkKey`-tagged registry behaviour. Must carry `userData.noMerge` like the tent shopkeeper (`tent.js:117`) if a shack is ever in a merge subtree. |
| **Picnic-table merged blob** | `picnicTable.js` already self-merges (`:8,11`) | Don't re-merge an already-merged mesh — its color is already a vertex-color attribute with a shared material; a second pass would bake a vertex-color *of* a vertex-color. Exclude `picnic_table` outputs. |

**Single biggest gap vs the existing helper:** `mergeStaticDecor` has **no
`isInstancedMesh` skip** because the tent booth had none. Camp-village is full of
InstancedMeshes (`buildTorchField`). Generalizing the helper without adding
`if (o.isInstancedMesh) return;` to the walk **frozen-collapses every torch field**.

---

### 2. Disposal failure modes

- **New merged geometry is unique → MUST be disposed on unload.** The merged
  `THREE.Mesh` added at `tent.js:144-146` has a fresh `merged` buffer with NO
  `userData.shared`. `disposeChunkByKey` (`chunks.js:553-565`) traverses and frees
  `!userData.shared` geometry — so the merged geo is correctly freed **only if it
  lives under the chunk group that gets passed to `disposeChunkByKey`**. Confirm the
  merged mesh is parented into `ctx.group` (the chunk group), not a module-level
  cache. `mergeStaticDecor` does `root.add(mesh)` where `root` is the booth group —
  fine as long as the booth group is under `ctx.group`. For food-court/camp-village,
  the merge root must be the per-cluster group that is `ctx.group.add(...)`'d.
- **Module-shared merged material MUST be `userData.shared`.** `_MERGED_OPAQUE_MAT`/
  `_MERGED_GLASS_MAT` (`tent.js:148-149`) are module-level and reused across every
  booth/cluster. If they are NOT tagged `userData.shared`, the **first chunk unload
  double-disposes them** → every other resident cluster's merged mesh forces a shader
  recompile next frame (footgun #6, recompile storm = ~200ms periodic stalls). **The
  implementer must verify `_MERGED_OPAQUE_MAT.userData.shared === true`.** I could not
  confirm the tag is present from the snippet — this is a must-check, not an assumption.
- **`mergeGeometries` fails mid-cluster.** `tent.js:134` handles this: on `!merged`
  it disposed the clones and **left originals in place** (`tent.js:133-134`). Good —
  but note it already disposed the *clones* before the null check, which is fine. The
  failure path is safe **only if originals were not yet removed** — and they aren't,
  removal is in the success-only loop at `:135`. Preserve this ordering exactly. A
  reordering that removes originals before confirming `merged` would **silently delete
  decor on any GPU where mergeGeometries returns null** (attribute mismatch on a
  specific driver). This is a Safari/integrated-GPU-only failure mode.
- **Mixed-index merge.** `_bakeForMerge` drops the index (`tent.js:99`) precisely so a
  mixed indexed/non-indexed set can't fail. Food-truck/campsite geometry is all
  BoxGeometry/CylinderGeometry (indexed) → uniform, fine. But the **uv guard**
  (`tent.js:96`: skips geometry without uv) silently drops any mesh lacking uv from the
  merge — for these models everything has uv, but a future no-uv detail mesh would be
  *silently left unmerged* (correct, but invisible — note it).
- **Stale-closure double-dispose.** If an animated flame mesh is ever both (a) removed
  by a merge and (b) its `flameMat` disposed by the merge loop, then `forestAnimatables`
  still references it. The per-frame updater writing `flameMat.emissiveIntensity` on a
  disposed material is a silent no-op; if the updater also writes `flame.scale` on a
  removed mesh it's a harmless no-op — **but** if `disposeChunkByKey` later also tries
  to free it, that's a double-dispose. The clean rule: **flames/embers are never merge
  inputs**, which the emissive guard enforces — keep them out and the closures stay
  valid.

---

### 3. Determinism

- **Merging is post-construction and consumes NO rng.** `mergeStaticDecor(root)`
  (`tent.js:112`) takes only the built group; it calls no `ctx.rng()`. `_bakeForMerge`
  is pure geometry math. ✅ As long as the merge call is placed **after** all
  `buildFoodTruck(ctx.rng)` / `buildCampsite(ctx.rng)` / `buildTorchField(..., ctx.rng)`
  calls in the builder, the rng draw stream is byte-identical → existing chunks/POI
  goldens unchanged. **Verify the merge call is the last thing in the builder, not
  interleaved** with placement (interleaving wouldn't change rng either, but keep it
  clean and obviously post-construction).
- **Do NOT let the merge read `PERF` to branch rng or skip a `build*` call.** A
  `if (PERF.merge) buildFoodTruck()` style gate would change draw order across tiers —
  the model build must always run; only the post-build merge is tier-gated. Tent's
  pattern builds first, then merges, which is correct.
- **No new salt, no reorder** — merging adds zero randomness, so tripwire #4 is not
  engaged provided the above holds.

**Boot-chain risk:** the merge runs inside
`buildWorld → ChunkManager._generate → buildFoodCourtAt/buildCampVillageAt`
(`chunks.js:1526,1657`) — the longest chain. A `TypeError` in the merge walk (e.g.
calling `mergeGeometries` on an empty bucket — guarded at `tent.js:131` — or reading
`o.material.color` on a multi-material `Array` mesh — guarded at `tent.js:121`) would
**hang the title card**. The guards exist in `mergeStaticDecor`; a per-builder *copy*
that drops one of them reintroduces the hang. Strong argument for **one shared util,
not copies.**

---

### 4. Verdict

- **Verdict**: **Proceed with mitigations** — but with a real chance the honest
  answer for `foodTruck` is "don't merge it."
- **Key Concern**: The **shared-pool inversion** — food trucks and campsites are built
  almost entirely from `userData.shared` pooled/instanced buffers, the opposite of the
  tent booth's unique goods. A naive per-cluster `mergeStaticDecor` here can *increase*
  GPU memory, *un-batch* same-material trucks, *un-instance* torch fields, and *bake
  away* the truck sign/window glow. The merge must be applied only where a real set of
  unique-static-opaque-non-emissive-non-instanced meshes exists, and that set must be
  measured per builder before committing.

**The implementation MUST:**
1. Add **`if (o.isInstancedMesh) return;`** to the merge walk (camp-village has
   InstancedMesh torch woodwork — `mergeStaticDecor` has no such guard today).
2. Keep the **emissive skip** (`tent.js:120`) and the **`noMerge` skip** (`:117`) — and
   tag the **sugar-shack cook NPC** `noMerge` if a shack enters a merge subtree.
3. **Never** make any mesh referenced by a `forestAnimatables` closure (flames,
   embers, `flameMat`, `emberMat`, `flameLight`) a merge input — verify by exclusion,
   not by hope.
4. Confirm `_MERGED_OPAQUE_MAT` / `_MERGED_GLASS_MAT` carry **`userData.shared = true`**
   (un-verified in the snippet — must check; without it the first unload double-disposes
   and storms shader recompiles).
5. Preserve the **failure-safe ordering**: remove originals only *after* `merged` is
   non-null; on null, leave decor intact.
6. Use **one shared util**, not per-builder copies — every dropped guard is a title-card
   hang in the longest call chain.
7. Place the merge call **last in each builder** (obviously post-construction, zero rng).
8. **Measure the actual net mesh delta per builder.** If `foodTruck`'s unique mergeable
   set is empty/tiny (it is — it's all shared), **scope the truck OUT** and merge only
   what pays.

**What Gary must verify on his real-GPU capture (Codespaces has no WebGL):**
- **Draw count before/after** at `?worldgen=1` parked beside a food court AND a camp
  village, on `?perf=low`, `?perf=mid`, `?perf=high`. The whole point is draws — if the
  number doesn't drop in those specific clusters, the merge isn't paying.
- **`renderer.info.memory.geometries`** over several chunk load/unload cycles (drive in
  and out of a camp village 5×). It must return to baseline — a climbing count means the
  merged geo is leaking (not parented under the disposed chunk group) OR a shared
  resource got baked into unique buffers.
- **No shader-recompile stalls** (the `progDelta` / shader-link stall counter from B0)
  after the first few unloads. A spike means a merged material isn't `userData.shared`.

**What is INVISIBLE to a stationary screenshot (Gary must specifically check these):**
- **Emissive glow at night** — the truck sign/window and torch flames only show as
  broken at `tod` midnight, not noon. A noon screenshot will look fine while the merge
  baked the glow away. **Screenshot at Midnight specifically**, beside a food court.
- **Torch-flame flicker** — a still frame can't show a *frozen* flame. Needs a short
  video / two frames a second apart, or watch live. A frozen flame = a flame mesh that
  got merged or whose closure went stale.
- **Frozen torch woodwork at origin** — if the InstancedMesh skip is missing, the torch
  poles collapse to one transform; on a stationary screenshot pointed away from origin
  you won't see the missing poles. Check the camp village's torch ring directly.
- **The double-dispose recompile storm** — invisible on frame 1; shows only after
  driving across several chunk unloads. A single screenshot will never catch it.
