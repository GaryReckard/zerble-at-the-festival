<!-- Re-cut per the 001-perf-pass-4-plan deliberation (debate mode). Three ship
slices + a park bucket; F2 pulled out of Slice 1; C1-b chosen over C1-a; seven
binding corrections folded in. See deliberations/001-perf-pass-4-plan/results.md. -->

## 1. Slice 1 — B0 (true measurement) + D3 (crowd alloc pooling)

> Both are agent-self-verifiable for *correctness* without a real GPU. Ship together; each item's CHANGELOG bullet travels in this slice's commit (per-slice changelog).

- [x] 1.1 `rg 'info.render' src/` to confirm the exact set of readers (expected: HUD ~1029-1030, perf sample ~1609-1610) — catch any third reader before refactoring. *(Confirmed 2 readers; the main.js `dumpPrograms` reader is unrelated.)*
- [x] 1.2 Add a minimal `InfoCapturePass` at composer index 1 (right after `RenderPass`) that snapshots `renderer.info.render.calls/triangles` into a module-scoped object (`sceneInfo`, exposed as `renderer.__sceneInfo`) and passes the buffer through **issuing no draw of its own** (`needsSwap=false`).
- [x] 1.3 Point all `debug.js` info readers at the snapshot instead of live `renderer.info.render` (HUD + perf sample, with live fallback).
- [x] 1.4 Add a per-frame `progDelta` to the perf sample (diff `info.programs.length` vs prior frame) so shader-stall frames self-identify.
- [x] 1.5 D3: replace the per-NPC `activePassengersRef` literal (crowd.js:605) with a pooled ref that **re-snapshots `count` per NPC** and keeps `add()` mutating the live outer counter — semantically identical, minus the per-NPC allocation.
- [x] 1.6 Sweep the immediate crowd loop for sibling per-frame churn. *(The loop body is now just the pooled-ctx call; `bubblePositions` is one array/frame holding live refs — left as-is, reuse would risk staleness for negligible gain.)*
- [~] 1.7 **AGENT PORTION DONE; live boot is Gary's.** Static verification green: 3 edited modules parse as ESM, the new `Pass` import resolves at unpkg 0.160.0, `bin/check-importmaps` OK, `bin/test-registry-grid` PASS. No Preview MCP / WebGL in Codespaces → confirm HUD `draws`/`tris` read realistic (not 1) and crowd boarding is unchanged on real hardware.
- [~] 1.8 CHANGELOG done (per-slice, item 6.1). **Commit deferred** (Gary didn't ask to commit; the diff feeds verify + smart-review first). Round-trip-1 capture: same flow as before — `recordPerf(true)` → ~90s drive → `recordPerf(false)` → `capture()`; now `draws`/`tris`/`progDelta` carry real data.

## 2. Slice 2 — re-scoped by the 2026-06-19 round-trip-1 capture

> **Capture verdict (B0 paid off):** draws now read real = **median ~3,750, max 9,232** vs the 400 high-tier budget (12–23× over) → **draw count is the steady-state ceiling.** `progDelta` ~0 and `fMax` median 33ms → the shader stall did NOT fire this run, and shadows/fMax are a non-issue. So Slice 2 collapses to the one cheap GPU win the data supports (F1), F2 is cut by its own gate, and A1/A4 are deferred until a hub-stress capture shows the stall. **The real next lever is draw-call reduction (see Slice 2.5 below / geometry-merge).**

- [x] 2.1 **F1 flag-setter refactor:** AdaptiveQuality sets `state.bloomAllowed` + exports `bloomAllowed()` instead of writing `bloomPass.enabled` directly (adaptiveQuality.js); single owner established.
- [x] 2.6 **F1 gating (shipped):** `bloomPass.enabled = AdaptiveQuality.bloomAllowed() && (nightness > 0.08 || StarPower.isActive())` — the ONLY per-frame writer (main.js, in tick). Gated on nightness (glacial ramp → no flicker) + star power so the daytime rainbow glow keeps bloom. Skips the full-screen bloom pass in bright daytime driving.
- [~] 2.5 **F2 — CUT.** Per its own gate ("cut if B0 shows the depth pass isn't material"): the capture's `fMax` median is 33ms with no shadow-driven spikes, so amortizing the shadow render buys nothing measurable and carries the verified smear-under-motion risk. Not worth it. Decision recorded in session-log -> D9.
- [~] 2.2 / 2.3 / 2.4 **A4 reveal / A1 prewarm / shared governor — DEFERRED.** `progDelta` ~0 all run → the 137–343 ms shader stall didn't fire here. Re-prioritize behind a hub-stress capture that actually reproduces the stall; the design + binding mitigations stay on record for when it does.
- [ ] 2.7 Verify F1 live on `?perf=low/mid/high` (low has `PERF.bloom` false → `bloomAllowed()` returns false → bloom stays off, correct): confirm bloom turns off in bright daytime open driving and back on at dusk/at a stage/under star power, with no flicker. **Gary (no WebGL here).**
- [ ] 2.8 CHANGELOG (done for F1) + commit when Gary's ready.

## 3. Slice 3 — C1-b time-sliced chunk generation (phased deferral)

> Determinism is the merge-blocker. C1-a (full coroutine) was rejected unanimously.

- [ ] 3.1 Audit which `buildWorldgenKind` cases (chunks.js:1304-1322) register colliders; pin ALL collider-registering work to the synchronous structure phase. Deferred phase is collider-free only.
- [ ] 3.2 Switch the ChunkManager budget from `BUDGET_PER_FRAME` chunks to a tier-aware `CHUNK_BUDGET_MS` wall (perf.js knob); keep `firstLoad` eager.
- [ ] 3.3 Defer the collider-free scatter (trees/props/campsites/crowd spawn) onto a per-chunk queue processed under the shared governor (Slice 2), **preserving exact `rng()` call order** (same `ctx.rng` instance carried in the deferred closure); **crowd spawn is the last deferred stage** (it injects into the live crowd system).
- [ ] 3.4 Key deferred work by `chunkKey`; clear the by-key queue entry in `_unload` so a chunk that leaves the load ring mid-defer is cancelled cleanly with **no orphaned nodes and no double-generate on re-entry**; dispose any partial-add meshes via the existing by-key helper (`disposeChunkByKey`), not a raw `traverse(dispose)`.
- [ ] 3.5 **Determinism gate (HARD merge-blocker):** generate a fixed seed's chunk old vs new and diff the `__dbg.dumpRegistry` output across a **multi-chunk concurrent-deferral neighborhood** (deferred queue is global while `registry.byChunk` is key-scoped — single-chunk identity is necessary but NOT sufficient). MUST be byte-identical. Borrow the `bin/test-registry-grid` harness pattern.
- [ ] 3.6 Boot + drive several hubs; confirm `cgWorst`/`fMax` hitches flatten and no collidable footprint appears before its chunk is coherent. CHANGELOG + commit. Round-trip-3 capture confirms the hitch-flatten.

## 4. E1 — arrival curtain (gated on Slice-2 results)

- [ ] 4.1 Only build if Round-trip-2 shows residual stall worth masking. On first crossing into a hub's influence (reuse `heartInfluence`), start a ~400ms bloom-strength + tone-exposure swell + audio cue via the single bloom-writer; rate-limit to once per hub, no re-fire while inside.
- [ ] 4.2 During the curtain, the shared governor temporarily raises the reveal-pump rate so the hub's compiles land inside the flourish. Verify it reads as charming (Noon + Midnight), honoring the warm-festival tone.

## 5. Draw-call reduction — JUSTIFIED by the round-trip-1 capture (the real lever)

> B0 confirmed draws = median ~3,750 / max 9,232 vs a 400 high-tier budget (12–23× over). This is the steady-state ceiling, so draw-call reduction is promoted from "if justified" to the **primary next work**. Overlaps the existing ROADMAP P2/P3 merge bullet.

- [x] 5.1 Decision recorded (session-log -> D8): draws are the bottleneck. **geometry-merge** is primary; **fog-as-far-cull** secondary; crowd LOD unproven (steady-state CPU is fine); atmosphere fakes ADD draws → not now.
- [x] 5.1b **Deliberation 002 ran (Architect+Adversary+Profiler+Mediator, synthesis).** -> deliberations/002-geometry-merge/results.md. **REFRAME (headline): geometry merge is a ~2–4% win (≈50–150 draws of the ~3,750 median), NOT the fix for the 12–23× overage** — food-court/camp-village are mostly ALREADY `userData.shared`-pooled (food trucks) or `InstancedMesh` (campsite torches) or self-merged (picnic tables), which three.js already batches. Resolved: merge **per-MODEL** (inside `buildX`, like tent.js:239) not per-cluster; scope = **food-truck + sugar-shack YES** (unique geometry), **camp-village SKIP** (instanced + animatable-heavy), food-court only its mergeable models.
- [ ] 5.2a Extract `mergeStaticDecor` + `_bakeForMerge` + `_MERGED_*` mats from tent.js → neutral `src/mergeDecor.js` (preserve the `userData.shared` mat tags, tent.js:86/88); update tent.js + picnicTable.js call sites; add `mergeDecor` to ALL FOUR importmaps; run `bin/check-importmaps`.
- [ ] 5.2b Harden the util: add the missing `if (o.isInstancedMesh) return;` guard (Critical — camp-style instanced fields would frozen-collapse); keep emissive + `noMerge` skips; surface `castShadow` per bucket (currently hardcoded true for opaque, tent.js:148); keep the failure-safe ordering (merge fails → originals stay).
- [ ] 5.2c Apply per-model merge inside `buildFoodTruck` + `buildSugarShack` only; tag the cook/animated/emissive parts `noMerge`; honor the disposal contract (merged geo NOT shared → disposes on unload; merged mats `userData.shared`; originals disposed only behind `!userData.shared`). rng-free (merge call is last in the builder).
- [ ] 5.2d **Gary's real-GPU capture (the gate):** draws before/after parked at a dense food-court on `?perf=low/mid/high`; `renderer.info.memory.geometries` returns to baseline across a hub load/unload cycle (leak check); **Midnight** screenshot (emissive glow intact); two-frame check (animated parts still move). Scope OUT any model whose draws don't drop.
- [ ] 5.3 (If justified) Fog-as-far-cull: bound `camera.far` (currently 1500, world.js) toward fog distance per tier — **verify distant hubs/skybox don't clip** before/after; no visible pop-out.

## 6. Docs + verification (per slice, not batched)

- [x] 6.1 Slice 1's CHANGELOG entry written (2026-06-19: B0 Added + D3 Performance). Future slices update CHANGELOG in their own commit.
- [x] 6.2 ROADMAP.md updated: added the full perf-pass-4 item set + the parked build-step/worker/compression cluster; reframed the *Out of scope* Bundler note (Gary relaxed no-build).
- [x] 6.3 `bin/check-importmaps` OK (31 src + 12 worldgen + 28 models across 4 pages); `bin/test-registry-grid` PASS (36k queries). Recorded in session-log.
- [x] 6.4 README status refreshed via `bin/readme-sync perf-pass-4` (Slice 1 boundary).

## 7. Slice 4 — forest-tree instancing (the real draw lever)

<!-- Folded from deliberations/003-forest-instancing/results.md (Tier-3 debate,
"proceed with mitigations", unanimous). drawCensus at a dense hub named TREES as
~half the scene's draws: IcosahedronGeometry·240v = 2,637 draws (oak/birch crowns)
+ ConeGeometry·35v = 2,120 (pine tiers) + a big share of ~3,700 cylinder draws
(trunks), all un-instanced. tree.js pools foliage MATERIALS (_foliageMats, shared)
but allocates GEOMETRY per tree → each crown/cone/trunk is its own draw. Instancing
collapses ~344 draws/treed-chunk → ~5. This supersedes Section 5 (geometry-merge,
falsified to ~2–4% by deliberation 002) as the primary draw lever. Change Groups
CG1–CG4 map to subsections 7.1–7.4. -->

> **Three traps the deliberation caught — read before coding.** (1) The shipped
> path is **worldgen v2** (`DEFAULT_WORLDGEN_V2=true`, perf.js:42; v2 `return`s at
> chunks.js:405). The live tree path is `scatterWorldgenTrees`/`buildForestTree`
> (chunks.js:1036/1061), NOT the dead-by-default v1 `scatterForestTrees`
> (forests.js:911, `?worldgen=0` only). Instrument v1 and the production census
> moves by **zero**. (The chunks.js:385 "default OFF" comment is **stale** — trust
> perf.js:42.) (2) `bin/layout-snapshot` is **visual-blind** — `dumpRegistry`
> (main.js:1505-1515) emits 9 placement fields, dropping scale/color/species/
> crown/perches, so a same-count rng *reorder* regenerates every forest + moves
> bird perches with a green snapshot. A new golden-hash gate is mandatory.
> (3) `InstancedMesh.castShadow` is all-or-nothing, so buckets MUST follow the
> existing per-mesh cast lines or the 56-caster audit (#9) regresses.

### 7.1 CG1 — determinism-gate precondition (agent-static, NO Gary round-trip)

> Build the gate that can SEE a foliage-stream reorder, **before any builder is
> touched**, so the golden is captured from `main`. Effort: small (~30-line gate +
> ~6 shim stubs).

- [x] 7.1.1 **Extend `bin/node-three-shim.mjs` FIRST (precondition).** It stubs
  only `Vector3` today (node-three-shim.mjs:4-5); `tree.js` touches six THREE
  classes at load+build: `CylinderGeometry`+`MeshStandardMaterial` at module scope
  (tree.js:32,34) and `Group`,`Mesh`,`IcosahedronGeometry`,`ConeGeometry` in the
  builders (tree.js:97,98,106,123). Add trivial no-op constructors — the gate
  hashes rng-derived *numbers*, not geometry math. Without this, `import` of
  tree.js throws under node and the gate can't run.
- [x] 7.1.2 **Build `bin/test-forest-determinism`.** Reuse the loader pattern from
  `bin/test-registry-grid:28-29` (`register('./node-three-shim.mjs')`), import the
  REAL tree.js, run `buildForestTree(mulberry32(FIXED))` (or the CG2
  `describeForestTree` sibling) N times, and golden-hash the full descriptor
  stream: `type, trunkH, trunkR, greenIdx(→colorHex), mainR/baseR(→scale),
  bumpCount/crownCount, every per-bump/crown/tier draw, rotation`. Asserts the
  strict invariant — identical rng order AND count including the variable-length
  loops (pine 5 draws, oak `5+3·bumpCount`, birch `4+3·crownCount`, + caller's
  `rotation.y=rng()` last).
- [x] 7.1.3 **Capture the golden from `main` BEFORE CG2 lands.** The refactor passes
  iff the hash is unchanged. Converts the load-bearing check from a Gary round-trip
  into an agent-static gate that runs every slice. (No importmap entry — it's a
  `bin/` test, not a `src/` module.)

### 7.2 CG2 — additive descriptor extraction (pure refactor, byte-identical, NO Gary round-trip)

> Make tree.js emit descriptors WITHOUT changing the builders' return type. No
> visual change ships here. Gate: golden-hash unchanged (7.1) + `node --check` +
> `bin/check-model-dims` + game-boot smoke. Effort: small.

- [x] 7.2.1 **Keep `buildForestTree`/`buildTallPine`/`buildOak`/`buildBirch`/
  `buildTree` returning a real `THREE.Group`.** Add `describeForestTree(rng)`
  siblings (or `group.userData.descriptor`) as the single rng-order source of
  truth the Group builders route through. Protects the six sandbox cases
  (sandbox.html:1148 `buildTree`, :1807/:1816/:1825/:1834 forest builders, :1904
  `bird_in_tree` reads `tree.userData.perches`) AND the excluded lake call-sites
  (lakes.js:537,713 do `tree.position.set`/`tree.scale.set`). Changing the return
  type is the sandbox-pass/game-crash footgun running backwards.
- [x] 7.2.2 **Descriptor MUST carry `crown`+`perches`.** Birds read these off the
  registry entry, never the mesh (birds.js:157-169) — so registration must populate
  them from the descriptor or forest birds **silently stop perching** (no error).
  Refactor `worldPerches`/`worldCrown` (tree.js:84-94) to take the descriptor (or
  its perches/crown + x/z); compute perch/crown once in a shared helper both paths
  call.
- [x] 7.2.3 **rng order is non-negotiable.** Emit fields in the descriptor literal
  WITHOUT reordering draws: do NOT draw `greenIdx` before `trunkH`/`trunkR` (it's
  3rd today, tree.js:174/211/255), do NOT hoist the bump/crown loop draws, do NOT
  "compute scale once at the top" (moves `mainR`/`baseR` ahead of `greenIdx`). The
  7.1 golden-hash proves it held.

### 7.3 CG3 — instance the two isolated-stream forest paths (the production win)

> Build per-chunk `InstancedMesh`es from descriptors. Slice = BOTH isolated-stream
> paths via one refactor: chunks.js:1061 (v2, production-default, **lead**) +
> forests.js:911 (v1, rides the shared `buildForestTree` emitter for free). v2 is
> non-skippable. Gates: golden-hash unchanged + `bin/layout-snapshot` clean
> (positions) + game-boot smoke (agent). **Gary round-trip:** draw census +
> `?perf=low/mid` tri budget + Noon/Midnight screenshots. Effort: medium.

- [x] 7.3.1 **Accumulate descriptors per chunk; build into `ctx.group`** for both
  paths. Both scatterers `ctx.group.add(tree)` (forests.js:914, chunks.js:1064) and
  register `chunkKey: ctx.key` (forests.js:925, chunks.js:1070). The 3×3 forest is
  a placement concept, not ownership — each of the 9 chunks owns its own trees/
  group/chunkKey. Per-chunk is the lifecycle home.
- [x] 7.3.2 **~5 buckets/chunk, boundary = the cast/no-cast line** (not color).
  `InstancedMesh.castShadow` is one boolean for all instances; today's casting is
  selective within a tree, so buckets MUST equal the existing per-mesh lines:
  `crown_caster` (oak main tree.js:217 + lowest birch puff :271), `crown_noshadow`
  (oak bumps :222-232 + upper birch puffs), `cone_caster` (lowest pine tier :185
  `i===0`), `cone_noshadow` (upper pine tiers), `trunk` (all cast :167,207,251).
  **Reject "just cast the whole crown bucket"** — over-casts and walks back the
  115→56 audit (#9).
- [x] 7.3.3 **Use `instanceColor`, NOT green-bucket meshes.** Color → per-instance
  attribute, one base `MeshStandardMaterial`, ~5 buckets total (vs ~28 to keep
  green-bucketing shadow-faithful). `instanceColor` ⊥ shadow casting (depth pass
  ignores color) — one extra **cached** program (`USE_INSTANCING_COLOR`), amortized,
  NOT the recompile-storm footgun. Gary live-verifies it renders under the low-tier
  threeShim Lambert swap (#2).
- [x] 7.3.4 **Module-shared unit geos tagged; per-chunk InstancedMeshes NOT tagged.**
  Hoist `IcosahedronGeometry(1,1)`, `ConeGeometry(1,1,8)`, unit trunk cylinder to
  module scope in tree.js, tag each `userData.shared=true` (like _trunkGeo/
  _foliageMats, tree.js:32-54). Do NOT tag the per-chunk InstancedMeshes — they
  dispose per chunk. Disposal is already correct: `disposeChunkByKey`
  (chunks.js:553-565) skips shared geo at :556 and frees instance buffers via
  `if (obj.isInstancedMesh) obj.dispose()` at :563. Untagged unit geo = first
  forest-chunk unload disposes it → recompile storm (#6).
- [x] 7.3.5 **`instanceMatrix.needsUpdate=true` (and `instanceColor.needsUpdate=true`)
  after the per-chunk fill** (#7). Trees are static → set-once; forgetting it
  renders the chunk empty/frozen.
- [x] 7.3.6 **Per-chunk granularity — reject per-forest-block.** Per-block (240m)
  needs a lake-style macrocell lifecycle outliving all 9 chunks and its 9→3 draw
  saving is rounding error; per-chunk's small bounding spheres keep off-screen
  chunks culled as units (mandatory for the low-tier tri budget). Consider fixing
  the stale chunks.js:385 comment in this commit.

### 7.4 CG4 — quality gates + measurement + docs

> Agent-static gates the agent owns + the GPU-only confirmations that are Gary's.

- [ ] 7.4.1 **Agent-static (every slice):** `node --check` tree.js/chunks.js/
  forests.js; `bin/test-forest-determinism` golden unchanged (7.1); `bin/layout-snapshot`
  self-diff clean for tree *positions*; `bin/check-model-dims`; `bin/check-importmaps`;
  **clean game-boot on the DEFAULT build** (no `?worldgen`) — title→start→
  `preview_console_logs` clean. `buildWorld→ChunkManager._generate→_generateWorldgen→
  scatterWorldgenTrees` is the longest-call-chain boot-bug zone.
- [ ] 7.4.2 **Gary — draw census (success proof):** default-build `__dbg.drawCensus()`
  before/after; success = the icosa·240v + cone·35v buckets collapse from thousands
  toward low hundreds pre-frustum. Run on the default v2 build, NO `?worldgen=` flag.
- [ ] 7.4.3 **Gary — `?perf=low` tri budget (HARD ship-gate):** instancing defeats
  per-tree intra-chunk cull, so a partially-visible chunk pulls all its trees' tris.
  Worst case ~100k tree tris vs the 150k low budget (~67%) — tight. Confirm
  `?perf=low` and `?perf=mid` stay under budget in a dense-forest frame. Meaningful
  only AFTER the golden passes. Keep `forestTreeDensityMul=0.7` on low (perf.js:66)
  — load-bearing; don't raise it because "draws got cheap."
- [ ] 7.4.4 **Gary — geometries-leak check:** drive in/out of a forest 5× (or
  hub-sandbox); `renderer.info.memory.geometries` returns to baseline. Climbing =
  an untagged unit geo or a per-chunk InstancedMesh wrongly tagged shared / not under
  the disposed chunk group.
- [ ] 7.4.5 **Gary — forest birds still perch:** `__dbg.start()`, fly to a forest,
  confirm birds land (the `bird_in_tree` sandbox case only proves the model, not the
  registry wiring).
- [x] 7.4.6 **Sandbox:** keep the Group-returning builders so `forest_tree_*` +
  `bird_in_tree` (sandbox.html:1806-1834,:1904) still render; add ONE
  instanced-forest-patch composite case so the *instanced* assembly is eyeballable
  at Noon + Midnight (extend the harness before bypassing it).
- [x] 7.4.7 **CHANGELOG `### Performance` entry in the shipping commit; trim the
  ROADMAP "Performance" item** (LOD-on-trees / variant-bucketed-InstancedMesh
  bullet) to what landed. If a dense-low tri capture pushes past ~110-120k, the
  parked LOD/detail-0-icosa fallback (20 tris vs 80) is the follow-up — already on
  ROADMAP; don't pre-build it.

### 7.5 CG5 — lakeside-tree instancing (Slice 4 follow-up, greenlit 2026-06-21)

> The CG3 deliberation EXCLUDED lakes (lake lifecycle, not chunk). Gary's post-ship
> drawCensus then named lake trees the next big un-instanced tree mass (icosa·240v·uniq
> 749 + cone·35v·uniq 532), so he greenlit instancing them. Same machinery, per-lake.

- [x] 7.5.1 **`buildForestInstanced` gained an optional per-instance uniform `scale`**
  (tree.js). Composes `…·Ry(rotY)·S(scale)·T(local)·S(part)`. Chunk forest passes no
  scale → defaults to 1 → matrix byte-identical (golden `badb6efd125e…` unchanged).
- [x] 7.5.2 **`lakes.js buildLake` accumulates island (537) + shore-ring (713)
  descriptors** into a per-lake `treeInstances`, flushed once before `return` (line 753)
  into the lake group. Both sites swapped `buildForestTree`→`describeForestTree` + a
  `{d,x,z,rotY:0,scale:s}` push; the per-tree `s = 0.85 + rng()*0.3x` scale draw + the
  `forest_tree` collider registration (radius `1.0*s`, no chunkKey, no perches) are
  unchanged → rng order + layout-snapshot byte-identical.
- [x] 7.5.3 **Disposal already correct** — the lake unload walk (lakes.js:864-883) frees
  InstancedMesh buffers (`o.isInstancedMesh && o.dispose()`) and skips `userData.shared`
  unit geos, same as the chunk path. Lake trees have no perches, so birds (which skip
  perch-less entries) are unaffected.
- [ ] 7.5.4 **Gary GPU:** lakeside woods render + draw-count drop + drive-past + a
  lake load/unload geo-leak check (drive away from a lake and back). Same hardware
  gate as 7.4.1-7.4.5.
