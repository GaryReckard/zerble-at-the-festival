## The Profiler's Position

### Priority Sequence

1. **Merge per-MODEL at build time (food-truck, sugar-shack), not per-cluster in the chunk builder.** The cluster builders (`buildFoodCourtAt`, `buildCampVillageAt`) are the wrong altitude. The draw-call cost lives inside the individual models, and `tent.js` already proved the right pattern: `buildTent()` calls `mergeStaticDecor(g)` on its own group at the end (`tent.js:239`). Mirror that — `buildFoodTruck()` calls merge on itself, `buildSugarShack()` calls merge on itself — so the win lands everywhere those models spawn (vendor rows, lone roadside trucks, the hub deck), not only inside two cluster functions.

2. **Generalize `mergeStaticDecor` + `_bakeForMerge` into a shared util module** (e.g. `src/models/mergeDecor.js`) and have `tent.js`, `picnicTable.js`, `foodTruck.js`, `sugarShack.js` all import it. They are byte-identical copies today; a third and fourth copy is a maintenance trap. NOTE the tripwire: a new `src/` module must be added to the importmap `models`/`mods` array in **all four** HTML files (`index.html`, `sandbox.html`, `hub-sandbox.html`, `map-sandbox.html`) and pass `bin/check-importmaps`. This is the only tripwire this change trips.

3. **Skip camp-village / campsite entirely for now.** `campsite.js` is already the *least* draw-heavy per the existing perf work: its torches are collapsed to 3 `InstancedMesh` (`campsite.js:386-388`), it carries an `animatables` array (flame/chiminea pulse) and per-instance emissive + `PointLight`s. The mergeable static surface is small, and the merge-exclusion bookkeeping (animatables, instanced, emissive, lights) is where the bugs hide. Low reward, high risk — defer until the truck/shack merge proves out on Gary's capture.

### Win estimate (which builders, what they spawn)

Grounded mesh counts (`grep -c 'new THREE.Mesh'`):

| Model | static meshes | already merged? | castShadow | animated/excluded |
| --- | --- | --- | --- | --- |
| `tent.js` (vendor booth) | ~40 | **yes** (shipped, −36% meshes) | roof, tables | shopkeeper NPC (`noMerge`), painting art (emissive) |
| `foodTruck.js` | 12 | no | box, cab | none — fully static, emissive serving-window/sign |
| `sugarShack.js` | 49 | no (bulbs instanced) | roof, panels, gable, banner | cook NPC (`cookEntry`), emissive signage/bulbs, 3 PointLights, bulb InstancedMesh |
| `campsite.js` | 29 | torches instanced | tent, roof, cloth | flame/chiminea animatables, PointLights, torch InstancedMesh |

**Food-court cluster** (`buildFoodCourtAt`): 3–5 trucks + 0–1 sugar shack + 1–3 picnic tables (already merged) + torch field (instanced) + maybe a bubble vendor.

- Food-truck merge: ~12 → ~2 draws each (opaque + emissive-left-alone). 5 trucks: **~60 → ~10 draws (−50)**.
- Sugar-shack merge: ~49 meshes; subtract the cook, 3 lights, ~20-bulb InstancedMesh, emissive signage — call it ~25–30 static structural meshes collapsing to ~2 + the emissive/instanced/animated remainder. One shack: **~30 → ~4 draws (−25ish)**.

**Order-of-magnitude per dense hub**: food-court trucks + shacks are a plausible **−75 to −150 draws** across a multi-court hub. Against a 400 high-tier budget that's modest; against the **measured median ~3,750 draws** it's a ~2–4% dent. This is a *real but incremental* win — it does not, on its own, close a 12–23× overage. The big draw mass is almost certainly the **crowd, forests, and string-light/decor spread**, not these clusters. So: proceed, but bank it as one of several draw-cuts, not the silver bullet.

### Merge vs InstancedMesh — where each wins

The briefing frames variation as "transform + color." Both tools handle that, but they win in **different** places:

- **Merge wins** when the geometries *differ* (a truck box + wheels + awning + menu are all different shapes) and the count per spawn is modest. One truck = many different meshes → merge to one buffer. This is exactly the truck/shack case, and exactly what `mergeStaticDecor` already does (bakes `material.color` → vertex-color attribute so one shared `vertexColors` material batches them).
- **InstancedMesh wins** when the *same* geometry repeats many times across a cluster (string bulbs, torch poles, bench-ring logs). The codebase already reached for this correctly: sugar-shack bulbs (20→1), campsite torches (~45→3). Do NOT re-merge those — they're already optimal.

Verdict on tool choice: **merge is the right tool for the truck/shack structural decor**; instancing already covers the repeated-geometry cases. No conflict — they compose (the merged static mesh sits alongside the surviving InstancedMesh and emissive meshes).

### Performance Risks Identified

| Risk | Type | Severity | Trigger Condition |
| --- | --- | --- | --- |
| Cost moves from per-frame draws to a one-time **allocation stall** — `mergeGeometries` runs synchronously inside the builder, which runs inside `_generate` | Alloc | Medium | First sugar-shack/food-court spawn as a chunk crosses the load ring. Adds to `cgWorst`/`fMax`. |
| Merged static mesh casting shadow as ONE big caster vs many small non-casters | Shadow | Low | If the merged opaque mesh sets `castShadow=true` (tent.js does), it casts from the *union* AABB — fine for a truck/shack body, but it now casts from parts that were non-casters before |
| Disposing a `userData.shared` pooled geo/mat during the merge (truck/shack geos ARE pooled `shared`) | Alloc/Steady | High | If the generalized helper disposes originals without the `!userData.shared` guard, the next chunk-unload→regen storms shader recompiles (~200ms stalls) |
| Merged geometry leaking on the GPU if NOT disposed on unload | Alloc | Medium | Merged buffer is unique (not shared) → the disposal walk (`chunks.js:556`) must dispose it; it does, *provided* the merged mesh is not tagged shared |
| Tri count unchanged — merge collapses draws, not triangles | Tris | Low | Tris stay at ~1.4M; merging cannot help the tri budget. Confirm tris already under high 1.2M... they're slightly OVER (1.4M), so tri reduction needs a *different* tool (LOD/cull), not this |

**Allocation-vs-steady-state read**: This is a **steady-state draw-count** fix that imports a small **allocation-cost** side effect. The merge work happens once per spawn, in the builder, in the spawn hitch — exactly the frames that already show `cgWorst` ~289ms early in Gary's capture. `tent.js` already pays this and the capture didn't flag it as catastrophic, so the per-truck/per-shack merge cost is likely sub-ms each. But food-court can spawn 5 trucks + a shack in *one* `_generate` call — that's 6 `mergeGeometries` in one chunk build. **Mitigation: the merge belongs inside each `buildX()` (amortized across whatever frames those models are built on) — it does NOT need to and should NOT be hoisted to a per-cluster "merge the whole court" pass**, which would concentrate the cost and lose per-model frustum-cull AABBs.

### Budget Estimate

- **Draw delta**: **−50 to −150 draws** on a dense multi-court hub (trucks ~−10/court, shacks ~−25 each). Against high 400 budget: helpful. Against measured ~3,750: ~2–4%.
- **Triangle delta**: **0** (merge preserves tris). Tris stay ~1.4M — still slightly over the 1.2M high budget; this change does not address that.
- **Cost type**: **Steady-state FPS win** (fewer draws/frame) with a **minor allocation-stall import** (merge runs in the builder). Net positive if merge stays per-model.
- **Low/mid-tier verdict**: **Safe and most valuable here.** Low (80 draws) and mid (200) are the squeeze tiers; on low, shadows are off and the Lambert swap is on, so a −10 draws/truck cut is a larger *fraction* of the budget than on high. This is exactly the tier where draw-count cuts matter. Verify the merge respects the threeShim tier-aware material (the shared `_MERGED_OPAQUE_MAT` is a `MeshStandardMaterial` → gets Lambert-swapped on low via the shim; confirm the merged material goes through the shim, not a raw `new THREE.MeshStandardMaterial` that bypasses it).

### What the implementation MUST do

1. **Per-model merge** (`buildFoodTruck`/`buildSugarShack` call merge on their own group), not per-cluster.
2. **Exclude from the merge**: the cook NPC (`sugarShack` — tag its subtree `userData.noMerge` like tent's shopkeeper), all emissive meshes (signage, serving window, bulbs — the helper already skips emissive), all `InstancedMesh` (bulbs, torches — the `o.isMesh` walk already skips instanced since `isInstancedMesh` is a separate flag; **confirm** the walk doesn't try to bake an InstancedMesh), all `PointLight`s (not meshes — skipped), and anything in an `animatables` array.
3. **Disposal contract**: merged geometry is unique → MUST be disposable (NOT `userData.shared`). The merged *materials* are module-shared → MUST stay tagged `userData.shared` (tent's `_MERGED_OPAQUE_MAT`/`_MERGED_GLASS_MAT` already are; if shared via the new util, keep the tag). Originals disposed only with the `!userData.shared` guard (truck/shack pooled geos survive).
4. **Determinism**: merge is post-construction, consumes no `rng()` — confirm the refactor adds no rng draw. Safe by construction.
5. **Shadow discipline**: the merged opaque mesh should cast shadow only if the model's body already did (truck box, shack panels). Do not let small detail (now baked into the merged buffer) become a new caster beyond the body's existing shadow read.
6. **Importmap**: if a new `src/models/mergeDecor.js` is added, register it in all four HTML files and run `bin/check-importmaps`.

### What to verify on Gary's capture (real-GPU only — Codespaces has no WebGL)

- **B0 draws before/after on a dense hub** (`hub-sandbox.html` with multiple food courts, or a captured dense game hub): the new B0 number should drop by the predicted ~50–150.
- **Allocation stall at chunk-gen**: `cgWorst` / `fMax` must NOT regress meaningfully when a food-court chunk spawns (5 trucks + shack = up to 6 merges in one build). If it does, that's the signal the merge needs time-slicing (it shouldn't, per tent's precedent).
- **Tris**: confirm `tris` is unchanged (sanity check that merge isn't dropping/duplicating geometry).
- **Geometry count over a load/unload cycle**: `renderer.info.memory.geometries` must return to baseline after driving away from and back to a hub — proves the merged buffers dispose and don't leak (the exact bug `tent.js:140` comments warn about).
- **Low + mid tier** (`?perf=low`, `?perf=mid`): confirm the merged material Lambert-swaps via threeShim and the draw cut shows on the squeeze tiers, where it matters most.
- **Game boot clean**: `buildWorld → ChunkManager.update → _generate → buildFoodCourtAt` must not throw (the classic sandbox-pass/game-crash on a `.group` vs bare-Group mismatch — note `buildCampTent` returns `{group,...}`, `buildFoodTruck` returns a bare Group; keep the contracts straight).

### Verdict

- **Verdict**: **Proceed with mitigations**.
- **Key Concern**: The win is real but *incremental* (~2–4% of measured draws) — it must be framed as one of several draw-cuts, not as closing the 12–23× overage. And the merge MUST stay **per-model** (inside `buildFoodTruck`/`buildSugarShack`), not hoisted to a per-cluster pass, or it concentrates the `mergeGeometries` cost into a single chunk-gen frame and loses per-model cull AABBs.
- **Recommendation**: Generalize `mergeStaticDecor` to a shared util; apply it inside the food-truck and sugar-shack models (mirroring tent.js); skip camp-village/campsite (already instanced, low reward, high exclusion-bookkeeping risk). Preserve the disposal contract exactly (merged geo disposable, shared mats tagged). Prove on Gary's capture: B0 draw drop, no `cgWorst` regression, geometry count returns to baseline on unload, gains visible on low/mid.
