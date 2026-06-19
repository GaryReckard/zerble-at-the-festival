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

## 2. Slice 2 — Shader wall + F2 (one coherent slice, ordered)

> Gated behind Slice-1's B0 numbers where noted. One shared per-frame governor for all program-link work.

- [ ] 2.1 **F1 prerequisite refactor:** make AdaptiveQuality set a `bloomAllowed` flag instead of writing `bloomPass.enabled` directly (adaptiveQuality.js:171); establish a single site that computes `bloomPass.enabled`. Verify bloom parity (no behavior change yet) before any gating.
- [ ] 2.2 **A4 reveal (correctness floor):** track seen material UUIDs; queue meshes with unseen materials as `visible=false`; reveal ≤1 per frame, marking the material seen. Shared materials reveal once.
- [ ] 2.3 **A1 prewarm:** at the title tap, AFTER the synchronous `Sound.init()` (main.js:543, untouched), build an offscreen scene of known heavy material variants **through the real threeShim-backed factories** and `renderer.compileAsync()`; seed those into the seen set. **Never dispose** the warm scene's GPU-owning resources — reference the already-permanent pooled `userData.shared` materials so teardown can't free them (else recompile storm).
- [ ] 2.4 **Shared per-frame governor:** C1-b deferred scatter (Slice 3), A4 reveal pump, and E1 curtain pump draw from ONE per-frame budget (GL program links + ms). Implement the governor here; crowd-spawn is always the last deferred stage.
- [ ] 2.5 **F2 (scope-capped):** flip `renderer.shadowMap.autoUpdate = false` only AFTER the first good map renders; request `needsUpdate` **gated on player-movement delta**, co-located with the per-frame sun-follow in world.js (mirror the `GROUND_RESAMPLE_THRESHOLD` pattern, world.js:121-127) so the moved shadow-camera VP never samples a stale depth map under motion. Make world.js the **single owner** of shadow cadence; reconcile with AdaptiveQuality's shadow toggle. Write the scope cap in a comment: amortizes mid/high while ~stationary only, zero on low, ~zero during boost. **Cut F2 entirely if B0 shows the depth pass isn't a measurable mid/high line item.**
- [ ] 2.6 **F1 gating (B0-gated):** `bloomPass.enabled = PERF.bloom && aq.bloomAllowed && brightInFrame()` with hysteresis; `brightInFrame()` = nightness > T OR nearest stage/fire attractor in range. The resolved predicate is the ONLY writer.
- [ ] 2.7 Verify `?perf=low/mid/high` after each render-touching task (low uses the threeShim Lambert path = different program set, so A4 must cover it). Screenshot Noon + Midnight.
- [ ] 2.8 Per-slice CHANGELOG bullets; commit. Hand Gary the Round-trip-2 capture (boost run): confirms F2-safety (no shadow smear under motion), A1/A4 killed the 137–343ms stall (progDelta ≤1/frame at hub entry), and whether E1 is still needed.

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

## 5. Tier-2 — PARK by default (only B0-justified items)

- [ ] 5.1 Using Slice-1 B0 numbers, decide Tier-2 go/no-go; record in session-log. Only **geometry-merge** and **fog-as-far-cull** are draw-win candidates; crowd LOD is unproven; atmosphere fakes ADD draws (book separately). Default = park to ROADMAP.
- [ ] 5.2 (If justified) Static-decor geometry merge at chunk completion, reusing the vendor-booth `userData.shared` disposal pattern; backtick budget check before/after.
- [ ] 5.3 (If justified) Fog-as-far-cull: bound `camera.far` (currently 1500, world.js) toward fog distance per tier — **verify distant hubs/skybox don't clip** before/after; no visible pop-out.

## 6. Docs + verification (per slice, not batched)

- [x] 6.1 Slice 1's CHANGELOG entry written (2026-06-19: B0 Added + D3 Performance). Future slices update CHANGELOG in their own commit.
- [x] 6.2 ROADMAP.md updated: added the full perf-pass-4 item set + the parked build-step/worker/compression cluster; reframed the *Out of scope* Bundler note (Gary relaxed no-build).
- [x] 6.3 `bin/check-importmaps` OK (31 src + 12 worldgen + 28 models across 4 pages); `bin/test-registry-grid` PASS (36k queries). Recorded in session-log.
- [x] 6.4 README status refreshed via `bin/readme-sync perf-pass-4` (Slice 1 boundary).
