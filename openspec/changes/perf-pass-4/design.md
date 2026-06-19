## Context

Grounded in the current code (read 2026-06-19):

- **Post-processing** (`main.js:139-167`): `EffectComposer` = RenderPass → bloom
  (UnrealBloom) → `Trip.pass` → optional FXAA → OutputPass. `composer.render()`
  at `main.js:1131`. This is why `renderer.info.render.calls` reads `1` in the
  HUD/log — the final fullscreen pass overwrites it.
- **Shader-stall fix 1A is already shipped** (`main.js:127`): `checkShaderErrors`
  is off for players, so the remaining 137–343ms stalls are the genuine GL
  compile/link of new programs on first render, not the info-log sync. That makes
  *prewarm + sliced reveal* (A1/A4) the correct next lever, not another sync fix.
- **Shadows** (`world.js:349-357`): one sun `DirectionalLight` casts; tier-aware
  map size; `renderer.shadowMap.autoUpdate` is unset (defaults `true` → every
  frame). AdaptiveQuality toggles shadows via a `castShadow`-walk (NOT
  `shadowMap.enabled`) specifically because disabling the *render* leaves an empty
  map (`adaptiveQuality.js:198-205`). F2 must respect that lesson.
- **Bloom enable** has two writers today: boot (`main.js:147`) and AdaptiveQuality
  level changes (`adaptiveQuality.js:171`). F1 adds a per-frame writer → needs a
  single resolved predicate.
- **Chunk gen** (`chunks.js:304-401`): `update()` loops a `BUDGET_PER_FRAME = 1`
  chunk/frame; `_generate` → `_generateWorldgen` builds a whole chunk
  synchronously, registering colliders inline. Self-timed into `cgN/cgSlow/
  cgWorst`.
- **Crowd** (`crowd.js:605`): `activePassengersRef: { count, add }` literal
  allocated per-NPC per-frame.

## Goals / Non-Goals

**Goals:** kill the hub shader-stall (A1/A4), flatten the chunk-gen hitch (C1),
restore draw measurement (B0), bank two cheap GPU wins (F1/F2), cut crowd GC
(D3), and mask any residual stall (E1) — all main-thread, no-build, no determinism
regression.

**Non-Goals:** any bundler/build step, Web Workers, KTX2/Draco compression (parked
on ROADMAP). No new `src/models/` files (so no importmap churn expected). Not
chasing Tier-2 items the B0 numbers don't justify.

## Decisions

**B0 — info-capture pass.** Insert a minimal custom `Pass` at composer index 1
(immediately after `RenderPass`) whose `render()` copies
`renderer.info.render.calls/triangles` into a module-scoped `lastSceneInfo`, then
passes the read-buffer straight through (no draw of its own). `debug.js` reads
`lastSceneInfo` instead of live `renderer.info.render` at both consumers (HUD
~1029, perf sample ~1609). Add `progDelta` to the perf sample by diffing
`info.programs.length` against the prior frame. *Chosen over* `info.autoReset=false`
+ post-composer read (which would over-count every fullscreen pass) and over
double-rendering the scene (wasteful).

**C1 — phased deferral, not a full coroutine (recommended; deliberation to
confirm).** Two candidate shapes:
- *(C1-a) Full generator coroutine:* refactor `_generateWorldgen` to `yield`
  between sub-stages; ChunkManager pumps generators under a ms budget. Maximum
  smoothing, but invasive and determinism-delicate (every inline `registry.add`
  becomes a resumable step).
- *(C1-b) Phased deferral (recommended):* build the chunk's **structure** (roads,
  ground, large props that define collision) synchronously so the chunk is
  immediately coherent, then push the **heavy scatter** (trees, ambient props,
  campsites, crowd spawn) onto a per-chunk follow-up queue processed under the
  same ms budget over the next few frames. Lower blast radius; the deferred work
  keeps its exact `rng()` order because it runs the same calls in the same
  sequence — only later. The chunk's `chunkKey` registry lifecycle already tags
  everything, so deferred entries attach to the same key.

Either way: **the per-frame budget switches from `BUDGET_PER_FRAME` chunks to a
`CHUNK_BUDGET_MS` wall** (tier-aware in `perf.js`), and a chunk that leaves the
load ring before its deferred work runs has that work cancelled (drop the queued
closure keyed by `chunkKey`; the structure already present unloads normally).

**A4 — sliced reveal (primary), keyed by material.** Maintain a `Set` of seen
material UUIDs. When a chunk's meshes are added, any mesh whose material UUID is
unseen is set `visible = false` and queued; each frame the reveal pump flips ≤1
queued mesh `visible = true` (forcing exactly one new program link) and marks its
material seen. Shared materials reveal once. **A1 — prewarm (best-effort).** At
the title tap, *after* `Sound.init()` (synchronous, untouched), build an offscreen
scene with one mesh per known heavy material variant **constructed through
`threeShim`** (so the program keys match the real draws — fog/shadow/tier defines
included) and `await renderer.compileAsync(warmScene, camera)`; seed those
materials into the seen set. A1 reduces what A4 has to slice; A4 guarantees
correctness even for variants A1 missed.

**F2 — amortized shadow map.** After the first rendered frame, set
`renderer.shadowMap.autoUpdate = false`. In `tickBody`, every `SHADOW_UPDATE_EVERY`
frames (tier-aware: e.g. 1 on high if cheap, 2–3 on mid) set
`renderer.shadowMap.needsUpdate = true`. Between updates the last *good* map is
reused (stale, not empty) — this is the crucial difference from the AdaptiveQuality
empty-map trap, which came from skipping the render with materials still sampling.
Compatible with AQ's `castShadow`-walk (orthogonal axis).

**F1 — single resolved bloom predicate.** Refactor so AdaptiveQuality sets a flag
`state.bloomAllowed` instead of writing `bloomPass.enabled` directly. Each frame,
`bloomPass.enabled = PERF.bloom && aq.bloomAllowed && brightInFrame()`, where
`brightInFrame()` = `nightness > T` OR nearest stage/fire attractor within a
view-relevant radius (reuse the registry attractor query). Hysteresis via a small
envelope so it doesn't fl/ on the threshold.

**D3 — hoist the closure.** Replace the per-NPC `activePassengersRef` literal with
a single reusable scratch object reset once per crowd frame (or pass `count` by a
shared counter object). Sweep the immediate loop for sibling `new Vector3/Color` /
array-literal churn and hoist to module scratch.

**E1 — arrival curtain.** On first crossing into a hub's influence (reuse
`heartInfluence`), start a ~400ms envelope that adds to bloom strength + warm
tone-mapping exposure + fires an audio swell; temporarily raise the A4 reveal pump
rate so the hub's decor (and its compiles) lands inside the flourish. Rate-limit:
one fire per hub, no re-fire while still inside.

## Risks / Trade-offs

- **[Determinism — C1]** If time-slicing reorders any `rng()` call, every existing
  chunk regenerates differently mid-game. → **Mitigation:** preserve exact call
  order (C1-b runs the same calls, just deferred); guard with the determinism gate
  — generate a fixed seed's chunk both ways and diff the registry dump. No seed
  migration needed because output is identical.
- **[Lifecycle — C1]** A half-built / queued-but-unbuilt chunk that unloads must
  not orphan nodes or double-generate on re-entry. → **Mitigation:** key deferred
  work by `chunkKey`; cancel on unload; `_unload` already drops everything tagged
  with the key.
- **[Empty-map — F2]** Getting the amortization wrong reproduces the
  AdaptiveQuality blank-shadow bug. → **Mitigation:** use `autoUpdate=false` +
  periodic `needsUpdate` (keeps last good map); never skip with materials mid-swap.
- **[Bloom triple-writer — F1]** Three writers to `bloomPass.enabled` will fight.
  → **Mitigation:** AQ becomes a flag-setter; one place computes the final enabled.
- **[iOS audio + boot order — A1]** Any `await`/async hop between the title tap and
  `Sound.init()` ships iOS silent. → **Mitigation:** `Sound.init()` stays the
  first synchronous call in the handler; `compileAsync` is kicked *after* it and is
  allowed to resolve later (it doesn't block the boot).
- **[threeShim — A1]** Prewarming a material not built through the shim links a
  program that doesn't match the real draw → warms nothing and wastes time. →
  **Mitigation:** construct warm meshes through the same factories the world uses.
- **[Perf budget — B0/F1/F2/E1]** New passes/curtain must not themselves blow the
  budget. → **Mitigation:** B0 capture pass does no draw; verify the backtick panel
  and test `?perf=low|mid|high` after each render-touching task.

## Migration Plan

No determinism migration required: C1 is explicitly output-preserving (same
`rng()` order), so existing seeds regenerate identically — the gate test must
*prove* this before C1 merges. No importmap migration expected (no new modules).
F2/F1 are runtime-only. If any Tier-2 item adds a new pooled resource, it follows
the existing `userData.shared` disposal contract.

## Open Questions

- C1-a (full coroutine) vs C1-b (phased deferral) — recommended C1-b; the
  deliberation debate should settle it against the determinism/blast-radius
  trade-off.
- How aggressively to prewarm in A1 (full known set vs the top offenders) before
  diminishing returns — settle empirically once B0 + `progDelta` show which hubs
  mint the most programs.
- Tier-2 ordering depends entirely on B0's numbers; not decided here.
