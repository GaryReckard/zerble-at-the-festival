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
