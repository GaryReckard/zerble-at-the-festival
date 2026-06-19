# Deliberation Summary

## Context
-   **Task**: Design how to extend the shipped `mergeStaticDecor` static-decor
    geometry merge (`tent.js:112`, vendor booths, −36% meshes, CHANGELOG
    2026-06-16) to the food-court and camp-village worldgen builders to cut
    steady-state **draw calls** — the measured perf ceiling (perf-pass-4 Task
    5.2). Design only; no code written. Synthesis mode (one round, no debate).
-   **Personas Consulted**: Architect, Adversary, Profiler + Mediator
-   **Date**: 2026-06-19

---

## HEADLINE FINDING (read this first) — the reframe

**The originally-assumed payoff is false.** The framing that geometry-merge would
take "~9,000 draws → hundreds" does not survive contact with the code. All three
personas, working in isolation, independently reached the same conclusion: the
food-court and camp-village clusters are **already mostly pooled / instanced**, so
the genuinely-mergeable surface is small.

- `foodTruck.js` is **100% `userData.shared`** pooled geometry + materials
  (`_GEO`, `_SHARED_MATS`, `_bodyMatPool`) — three.js already batches identical
  geo+material across trucks.
- `campsite.js` torch woodwork is **already collapsed to 3 `InstancedMesh`** per
  field (`buildTorchField`, `campsite.js:386-404`); its mats are all `shared`.
- `picnicTable.js` is **already self-merged** — re-merging it would bake a
  vertex-color of a vertex-color.

**Realistic win: ≈ 50–150 draws on a dense multi-court hub** — roughly **2–4% of
the measured median ~3,750 draws** (max 9,232) against the 400 high-tier budget
(12–23× over). The Profiler's grounded mesh-count math: trucks ~−10/court, sugar
shacks ~−25 each.

**Therefore this is ONE modest draw-cut, not the fix for the overage.** The 12–23×
draw problem needs a *broader attack* the personas point at but this task does not
deliver: LOD / cross-cluster instancing of distant clusters, and an honest
re-examination of whether a 400-draw budget is realistic for v2 worldgen at all.
The big draw mass is almost certainly **crowd, forests, and the string-light /
decor spread**, not these clusters. **Bank this as one of several cuts; keep the
real draw fight queued separately.** (See ROADMAP follow-up in Change Group 4.)

This reframe is the single most important output for the human. Proceed, but with
calibrated expectations.

---

## Synthesized Plan

### Change Group 1: Extract the merge primitive into a neutral shared util
**Scope**: Promote `mergeStaticDecor` + `_bakeForMerge` + the two `_MERGED_*`
materials out of `tent.js` into one shared module. All three personas converged on
this (the Architect on module-boundary grounds, the Adversary on "every dropped
guard is a title-card hang," the Profiler on "a 3rd/4th byte-identical copy is a
maintenance trap"). One util, never per-builder copies.
**Estimated Effort**: Small (mechanical move + import rewrites + importmap).
**Tasks**:
1. Create `src/mergeDecor.js` (neutral util, NOT under `models/` — it is a
   general algorithm, not a leaf model; resolves the existing `picnicTable.js → tent.js`
   wrong-way model-to-model edge). Export `mergeStaticDecor`.
2. Move `_bakeForMerge`, `_MERGED_OPAQUE_MAT`, `_MERGED_GLASS_MAT` with it.
   **Preserve `userData.shared = true` on both materials** — verified present at
   `tent.js:86,88`; the move must not drop them, or the first chunk unload
   double-disposes a module-shared material and storms shader recompiles
   (~200ms stalls, tripwire #6). This is the single must-not-break item.
3. Keep both merged materials as `MeshStandardMaterial` so the `threeShim`
   tier-aware swap (Lambert on low) still applies — do NOT bypass the shim with a
   raw constructor.
4. Repoint `tent.js` and `picnicTable.js` imports at the new util. No behavior
   change for those two (regression-only check).
5. **Add `mergeDecor` to the importmap `mods`/`models` array in all four HTML
   files** (`index.html`, `sandbox.html`, `hub-sandbox.html`, `map-sandbox.html`)
   and run `bin/check-importmaps`. This is the only tripwire this whole change
   trips. (map-sandbox is worldgen-only and likely won't consume it, but the
   check still wants consistency — follow what `bin/check-importmaps` reports.)

### Change Group 2: Harden the util's exclusion guards BEFORE applying it anywhere
**Scope**: The tent booth never contained an `InstancedMesh` or an animatable
flame, so the existing walk lacks two guards that camp-village and the shacks
*require*. Add them to the util while it is still only used by tent/picnic (whose
behavior is unaffected — they have neither).
**Estimated Effort**: Small.
**Tasks**:
1. **Add `if (o.isInstancedMesh) return;` to the walk** (`mergeDecor.js`, the
   `tent.js:118` `o.isMesh` branch). `InstancedMesh.isMesh === true`, and
   `_bakeForMerge` reads only the *template* geometry, ignoring `instanceMatrix`
   — merging an InstancedMesh collapses every instance to one transform (torch
   poles stack at origin / vanish). **CRITICAL gap** — without this, generalizing
   the helper frozen-collapses every camp-village torch field.
2. Keep the **emissive skip** (`tent.js:120`) and the **`noMerge` skip**
   (`tent.js:117,118`) exactly as-is. These protect glow (truck sign/window, shack
   signage/bulbs, flames) and the NPC subtrees.
3. **Surface `castShadow` as a per-bucket parameter** of `mergeStaticDecor`. The
   internal `add(bucket, mat, shadow)` already takes `shadow` (`tent.js:130`) but
   the opaque bucket is hardcoded `true` (`tent.js:148`). Expose it so callers can
   match the *model's existing caster set* — a merged truck mesh must not make
   wheels/canopy cast (they deliberately don't, `foodTruck.js:82`) or grow the
   audited shadow silhouette (tripwire #9, `.claude/rules/performance.md`).
   Default tent/picnic to current behavior (opaque casts) — no regression.
4. **Preserve the failure-safe ordering exactly**: originals are removed
   (`o.parent.remove`) only *after* `merged` is confirmed non-null
   (`tent.js:134-135`). On a driver where `mergeGeometries` returns null
   (attribute mismatch — a Safari / integrated-GPU-only mode), this leaves decor
   intact instead of silently deleting it. Any reorder reintroduces silent
   decor-deletion.

### Change Group 3: Apply per-MODEL merge to the chosen models only
**Scope**: Mirror the established `tent.js:239` pattern — each model merges its
own group at the end of `buildX()`, NOT a per-cluster pass in the chunk builder.
**Estimated Effort**: Small–Medium.
**Tasks**:
1. **`buildFoodTruck()` calls `mergeStaticDecor(group)` at its end.** Merge set =
   box + cab + canopy + 4 wheels (opaque, structural). Left intact by guards:
   emissive `window` + `sign` mats (`foodTruck.js:29-35`). Pass `castShadow` so
   only box+cab cast (their current set, `foodTruck.js:62,68`).
2. **`buildSugarShack()` calls `mergeStaticDecor(group)` at its end.** Merge set =
   structural panels/gable/roof/banner. Left intact: cook NPC (**tag its subtree
   `userData.noMerge`** like the tent shopkeeper — `chunks.js:1553` `cookEntry`),
   emissive signage, the bulb `InstancedMesh` (now caught by the CG2 guard), the 3
   PointLights (not meshes). Match `castShadow` to the shack's current casters
   (roof, panels, gable, banner).
3. **SKIP camp-village / campsite entirely** (unanimous across all three
   personas). It is the least draw-heavy cluster: torches already instanced, mats
   already `shared`, and it holds **live animatable references** — `campsite.js`
   returns `{ animatables }` carrying the exact `flameMat`/`emberMat`/`flame`
   mesh / `PointLight` objects mutated every frame and registered into
   `forestAnimatables` with `chunkKey` (`chunks.js:2533`). A merge that swept any
   of those would leave the per-frame updater writing to a disposed material
   (silent break / recompile churn). Low reward, high exclusion-bookkeeping risk.
   Defer until truck/shack proves out on Gary's capture.
4. **Food-court: merge only its mergeable models** (the trucks + any sugar shack)
   — which now happens automatically *because the merge lives in the models*, not
   the cluster. Do NOT merge picnic tables (already self-merged), the bubble
   vendor (`bubbleVendor.js:186` `group.userData.anim` — would freeze its
   jugs/bubbles), or the torch field (instanced).
5. **Disposal contract (applies to every merge site)**:
   - Merged geometry is **unique → NOT tagged shared → disposed normally** on
     chunk unload by the `disposeChunkByKey` walk (`chunks.js:553`), *provided*
     the merged mesh lives under `ctx.group`. Since the merge runs inside
     `buildX()` and the model group is added to the chunk group by the builder,
     this is inherited for free (same as the tent path).
   - Merged **materials are module-shared → stay `userData.shared`** (verified
     `tent.js:86,88`) so the walk skips them.
   - Originals disposed only behind the `!userData.shared` guard
     (`tent.js:141-142`) — the truck/shack/campsite pooled `shared` geos+mats
     survive untouched.
6. **Determinism (safe by construction)**: the merge is post-construction and
   consumes **no `rng()`** (`_bakeForMerge` is pure geometry math; `mergeStaticDecor`
   takes only the built group). Place the merge call **last in each `buildX()`**,
   after all `ctx.rng()`-driven placement, so the rng draw stream is byte-identical
   and existing chunk/POI goldens are unchanged (tripwire #4). Do NOT gate a
   `build*` call on `PERF` — the model build must always run; only the post-build
   merge may be tier-aware.

### Change Group 4: Quality gates + measurement on Gary's real GPU
**Scope**: Codespaces has no WebGL — the agent can verify ESM parse, importmaps,
and the registry-determinism gate locally; **all draw/visual verification is
Gary's, on his real-GPU capture.** Plus the docs and the honest "this is one cut"
follow-up.
**Estimated Effort**: Small (agent side); measurement is Gary's.
**Tasks**:
1. **Agent-local gates**: `bin/check-importmaps` passes; ESM parse of the new
   module + edited files; the registry-determinism self-test still matches (merge
   is rng-free, so goldens must be byte-identical); clean game boot through
   `buildWorld → ChunkManager.update → _generate → buildFoodCourtAt` with no
   `TypeError` (mind the `.group` vs bare-Group contract — `buildFoodTruck`
   returns a bare Group, `buildCampTent` returns `{group,...}`).
2. **Gary's capture — draws before/after** (B0, the post-processing-true counter
   from Slice 1) parked beside a food court AND a sugar shack, on **`?perf=low`,
   `?perf=mid`, `?perf=high`**. Expected: ~−50 to −150 on a dense hub; on low
   (80-draw budget, shadows off, Lambert swap on) the cut is a larger *fraction* —
   this is where it matters most. **If the number doesn't move in those clusters,
   the merge isn't paying — scope the non-moving model out.**
3. **Geometries-leak check**: `renderer.info.memory.geometries` over several
   load/unload cycles (drive in and out of a food court 5×) must return to
   baseline. A climbing count = merged geo leaking (not parented under the
   disposed chunk group) or a shared resource baked into unique buffers.
4. **No shader-recompile stalls** (the `progDelta` counter) after the first few
   unloads — a spike means a merged material lost its `userData.shared` tag.
5. **Allocation stall**: `cgWorst` / `fMax` must not regress when a food-court
   chunk spawns (up to ~6 merges in one `_generate`). Tent's precedent says
   sub-ms each; if it regresses, time-slice (it shouldn't).
6. **Midnight screenshot beside a food court** — emissive glow is INVISIBLE to a
   noon still. The truck sign/window and shack signage only read as broken at
   `tod` midnight. A noon screenshot can look perfect while the glow was baked
   away.
7. **Two-frame / short-video check on any animated part in frame** — a still can't
   show a *frozen* flame or a torch field collapsed to origin. (Relevant if the
   guards ever regress; the chosen scope excludes animated parts, so this is a
   guard-regression tripwire, not an expected state.)
8. **Tris unchanged** — merge collapses draws, not triangles. Tris stay ~1.4M
   (still slightly over the 1.2M high budget). This change does NOT address tris;
   that needs LOD/cull.
9. **CHANGELOG** entry (Performance) in the shipping commit; trim the ROADMAP
   bullet for this slice. **Add a ROADMAP follow-up** capturing the reframe: the
   real draw overage (12–23×) is unaddressed and needs LOD / cross-cluster
   instancing of distant clusters and a budget-realism review for v2 worldgen.

## Final Recommendation
**Proceed with mitigations**, scoped tightly: extract `mergeDecor.js`, harden it
with the `isInstancedMesh` guard + parameterized `castShadow`, and apply
per-model merge to **food-truck and sugar-shack only** — **skip camp-village**.
Ship it as a modest, banked ~50–150-draw cut, and queue the real draw fight (LOD /
cross-cluster instancing / budget realism) separately. Verification of the draw
delta and emissive integrity is Gary's, on his real GPU.

---

## Convergence Points
-   **Verdict** — all three: *Proceed with mitigations.* None blocked.
-   **Generalize `mergeStaticDecor` into one neutral shared util**, imported
    everywhere, never per-builder copies → all four importmaps + `bin/check-importmaps`.
-   **The shared-pool / InstancedMesh inversion** — food trucks (100% `shared`),
    campsite torches (already 3 InstancedMesh), picnic tables (already merged) mean
    much of these clusters is *already batched*; the mergeable surface is small.
-   **Disposal contract** — merged geo unique/disposable; merged mats
    `userData.shared` (verified `tent.js:86,88`); originals disposed only behind
    `!userData.shared`; merge-failure leaves originals in place.
-   **Add an `isInstancedMesh` guard; keep the emissive + `noMerge` skips;
    parameterize `castShadow`.**
-   **Merging is rng-free → determinism-safe** (place the call last in each builder).
-   **The win cuts draws, not tris** (~1.4M tris unchanged; tri overage needs a
    different tool).
-   **Skip camp-village** (Profiler + Adversary explicit; Architect "hold / re-scope").
-   **The win is incremental (~2–4% of measured draws), not the silver bullet.**

## Conflicts Resolved
| Conflict | Position A | Position B | Resolution | Rationale |
| -------- | ---------- | ---------- | ---------- | --------- |
| Merge altitude: **per-MODEL** (inside `buildFoodTruck`/`buildSugarShack`) vs **per-CLUSTER** (in `buildFoodCourtAt`) | Profiler: per-model — mirrors `tent.js:239`, win lands everywhere the model spawns, cost amortizes across build frames, keeps per-model cull AABBs | Architect: per-cluster — keeps merge scoped to props the builder knows are static, preserves per-cluster AABBs | **Per-MODEL wins.** It is the *established, shipped* pattern (`tent.js:239` calls merge on its own group), it preserves per-*model* frustum-cull AABBs (a *tighter* cull than per-cluster, not looser), it avoids concentrating up-to-6 `mergeGeometries` into one `_generate` frame, and the win follows the model to lone roadside trucks / the hub deck — not just two cluster functions. Architecture-adherence + simplicity both favor it. The Architect's per-cluster concern (don't smear unrelated clusters) is *satisfied* by per-model — it is strictly more scoped. |
| Is food-truck worth merging at all? | Adversary: "real chance the honest answer is don't merge it" (100% shared, possible memory/batch regression) | Profiler: ~−10 draws/court, worth it | **Apply, but make it measurement-gated (CG4.2).** The Profiler's grounded count says it pays; the Adversary's inversion risk is real. Resolution: implement it, but if Gary's per-cluster draw capture doesn't move, scope the truck out. Verifiability over assumption. |
| Scope of camp-village | Architect: hold / re-scope pending measured per-village alloc cost | Profiler + Adversary: skip entirely now | **SKIP entirely now.** Unanimous direction; the live-animatable-reference hazard (disposed-material writes) + already-instanced torches + 12–20 fresh buffers per village at spawn make it low-reward/high-risk. Safety + simplicity. Revisit only with its own measured justification. |
| Is `_MERGED_*` `userData.shared` tag present? | Adversary: "un-verified in the snippet — must check (CRITICAL)" | (others assumed present) | **Verified present** at `tent.js:86,88` by the Mediator. The Critical item downgrades to: *preserve the tags through the util move* (CG1.2). Still load-bearing — a dropped tag on the move = recompile storm. |

## Risk Register
| Risk | Severity | Mitigation | Owner |
| ---- | -------- | ---------- | ----- |
| Generalized walk lacks `isInstancedMesh` skip → frozen-collapses torch fields (instances stack at origin) | **CRITICAL** | Add `if (o.isInstancedMesh) return;` to the util walk *before* any new use (CG2.1). The chosen scope skips camp-village, but the guard is mandatory the moment the util touches any instanced model (shack bulbs). | Adversary |
| `_MERGED_*` material loses `userData.shared` tag during the util move → first unload double-disposes → ~200ms recompile storms | **CRITICAL** | Verified tags present (`tent.js:86,88`); explicitly preserve them through the move and check at the new module (CG1.2). | Adversary / Mediator |
| Merge-failure path reordered → silent decor deletion on drivers where `mergeGeometries` returns null (Safari / integrated GPU) | High | Preserve exact ordering: remove originals only after `merged` non-null (CG2.4). | Adversary |
| Disposing a pooled `userData.shared` truck/shack geo/mat during the merge → recompile storm | High | Keep the `!userData.shared` guard on the originals-dispose loop (CG3.5). | Profiler |
| Emissive glow baked away (truck sign/window, shack signage) — invisible at noon | High | Emissive skip stays (CG2.2); **Midnight screenshot beside a food court** (CG4.6). | Adversary / Architect |
| Merged geometry leaks if not under the disposed chunk group | Medium | Merge inside `buildX()` so the model group is added to `ctx.group`; `disposeChunkByKey` frees it for free; verify `renderer.info.memory.geometries` returns to baseline (CG4.3). | Profiler / Adversary |
| Merged opaque mesh grows the audited shadow-caster silhouette (wheels/canopy now cast) | Medium | Parameterize `castShadow` per bucket; match each model's existing caster set (CG2.3, CG3.1-2). | Architect / Profiler |
| Allocation stall — up to ~6 `mergeGeometries` in one food-court `_generate` | Medium | Per-model merge amortizes; tent precedent sub-ms; watch `cgWorst`/`fMax` (CG4.5). | Profiler |
| Boot-chain `TypeError` in the merge walk hangs the title card | Medium | One shared util (guards never dropped); empty-bucket + multi-material guards already present (`tent.js:121,131`); clean-boot gate (CG4.1). | Adversary |
| Re-merging already-merged `picnic_table` (vertex-color of a vertex-color) | Low | Per-model scope never feeds picnic tables to a second merge; they merge once in their own builder (CG3.4). | Adversary |
| **Expectation risk: treating this as the fix for the 12–23× draw overage** | **Strategic** | State the reframe loudly (Headline + CG4.9 ROADMAP follow-up); bank as one of several cuts; queue LOD / cross-cluster instancing / budget realism separately. | Profiler / Mediator |

## Verdicts Summary
| Persona | Key Concern | Verdict |
| ------- | ----------- | ------- |
| Architect | Camp-village animatables hold live `flameMat`/`emberMat`/`flame`/`PointLight` refs in `forestAnimatables`; a merge that sweeps any breaks the per-frame updater silently — emissive heuristic is insufficient, explicit `noMerge` is mandatory | Proceed with mitigations (food-court yes; hold/re-scope camp-village) |
| Adversary | The shared-pool inversion — trucks/campsites are ~100% pooled/instanced, so a naive merge can *increase* memory, un-batch trucks, un-instance torches, bake away glow; merge only where a real unique-static set exists, measured per builder | Proceed with mitigations (real chance "don't merge food-truck") |
| Profiler | The win is real but incremental (~2–4% of measured draws) — frame it as one of several cuts, not closing the overage; merge MUST stay per-model, not hoisted per-cluster | Proceed with mitigations |
