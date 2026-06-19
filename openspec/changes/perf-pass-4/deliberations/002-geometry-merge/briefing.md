# Deliberation Briefing: geometry-merge for draw-call reduction (perf-pass-4 Task 5.2)

## Task

Design how to extend static-decor geometry merging to the **food-court** and
**camp-village** worldgen builders, to cut draw calls. Propose the approach, the
disposal/lifecycle contract, the exclusion rules, and what to verify — BEFORE any
code is written. This is a focused, "short" deliberation (synthesis mode).

## Context — why now (the measured driver)

`perf-pass-4` Slice 1 shipped **B0** (true draw/tri measurement under
post-processing). Gary's round-trip-1 real-GPU capture then revealed: **`draws` =
median ~3,750, max 9,232 per frame against a 400 high-tier budget (12–23× over);
`tris` ~1.4M.** Steady-state CPU is fine (`avoidMs` 0.1–0.3) and the shader stall
barely fired (`progDelta` ~0). So **draw-call count is the steady-state ceiling**,
and reducing it is the highest-value perf work. (Background:
`.claude/perf-brainstorm.md`, memory `perf-draws-are-bottleneck`.)

## The existing pattern to extend (read it first)

`src/models/tent.js:112` `mergeStaticDecor(root)` — the SHIPPED, working merge
(vendor booths, −36% meshes, see CHANGELOG 2026-06-16). It:
- walks a group; skips any subtree tagged `userData.noMerge` (e.g. the shopkeeper
  NPC) and any emissive mesh (painting art) — those are left intact;
- bakes each opaque/transparent mesh's `material.color` into a vertex-color
  attribute and its world transform into local space (`_bakeForMerge`);
- buckets into opaque vs transparent, `BufferGeometryUtils.mergeGeometries` per
  bucket;
- on success removes the originals and disposes their NON-`userData.shared`
  geometry+material (pooled `shared` resources survive); **on merge failure leaves
  the originals in place — never silently deletes decor**;
- adds one merged `THREE.Mesh` per bucket with the shared vertex-color materials
  `_MERGED_OPAQUE_MAT` / `_MERGED_GLASS_MAT`.

`src/models/picnicTable.js` also uses the same helper. `portaPotty.js` merges its
own parts at build time too.

## Files in scope

- `src/chunks.js` — `buildFoodCourtAt(ctx, x, z)` (~1526) and
  `buildCampVillageAt(ctx, x, z, tentTarget)` (~1657); the builder dispatch
  (~1304-1322); the chunk disposal walk `disposeChunkByKey(scene, group, key,
  crowd)` (~553) which skips `userData.shared`; `_unload` (~367).
- `src/models/tent.js` — `mergeStaticDecor` + `_bakeForMerge` + the merged
  materials (the pattern to generalize or copy).
- Possibly the food-truck / campsite / tent models the builders instantiate.

## Constraints (the tripwires — non-negotiable)

- No build step; a new src/ module goes in the importmap in BOTH index.html AND sandbox.html (and hub-sandbox.html + map-sandbox.html) — but this likely adds NO new module.
- ES module namespaces are frozen — no THREE.X = Y after import; tier overrides via src/threeShim.js.
- iOS audio inits synchronously inside the start gesture — not in scope here.
- Determinism is load-bearing — don't reorder/re-salt existing rng() calls. (Merging is post-construction, so it should not consume any rng — confirm.)
- Lakes omit chunkKey on purpose; shared pooled resources tagged userData.shared = true must NOT be disposed. The chunk unload walk skips them. A NEW merged geometry is unique (not shared) and MUST be disposed on unload; a merged material that is module-shared MUST be tagged userData.shared.
- Per-tier perf budgets: low 80 draws/150k tris, mid 200/400k, high 400/1.2M; don't reflexively castShadow = true. Merging must not silently turn small detail into shadow casters or break the audited caster set.
- A new model is not done until it has a sandbox entry — N/A unless a new model file is added.
- Sandbox-pass ≠ game-pass — the running game must boot clean (buildWorld → ChunkManager.update → _generate → theme builder). Live/visual/draw verification can only run on Gary's real GPU (Codespaces has no WebGL); the agent can verify ESM parse, importmaps, and the registry-determinism gate only.

### Your Output

Write your full position to: `[OUTPUT_PATH]`
Return a brief summary to the orchestrator: your Verdict, Key Concern, and 3 bullet points.

### Your Task (synthesis mode — one round, no cross-examination)

1. Propose your recommended approach: generalize `mergeStaticDecor` into a shared util vs per-builder copies; per-cluster merge (per food-court / per camp-village, preserving per-cluster frustum-cull AABBs) vs per-chunk merge at completion; which builders/props are worth merging.
2. Identify the risks/exclusions from YOUR domain, grounded in the code: what MUST be excluded from a merge (animated parts — flags, NPCs, fire/flame, tiki, anything with an updater closure or `anim`; emissive; collider proxies; instanced meshes), how disposal stays safe (new merged geo disposed, shared mats tagged, failure leaves originals), determinism, shadow-caster discipline, and whether merging across a cluster loses per-object culling that matters.
3. Give a Verdict (Proceed | Proceed with mitigations | Block) and name what the implementation MUST do and what to verify on Gary's capture.

You are working in isolation. Do NOT speculate about what other personas think,
and do NOT write an "Anticipated Tensions" section — that's handled by the Mediator.
