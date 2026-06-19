## Why

The 2026-06-19 instrumented capture (driving ~1500m through fresh territory)
shows the steady-state CPU grind is fixed, but two felt problems remain:
**shader-compile stalls** — single frames of 137–343ms that line up exactly with
three.js `prog` (program count) jumping as a new festival hub first renders — and
**chunk-generation hitches** — frequent 30–60ms frames as `_generate` builds a
whole chunk synchronously. A third problem is diagnostic: `renderer.info` reports
`draws=1` under the EffectComposer post-processing chain, so every draw-call and
overdraw decision is currently blind. This change attacks all three with
main-thread, no-build techniques (the build-step/worker/compression ideas are
deliberately parked — see ROADMAP and [[no-build-constraint-relaxed]]).

## What Changes

Ordered by the recommended sequencing (measurement first, then the two live
symptoms, then cheap steady-state GPU wins, then measurement-gated Tier-2):

- **B0 — True draw/tri measurement under post-processing.** Snapshot
  `renderer.info.render.calls/triangles` right after the scene `RenderPass`
  (before bloom/trip/fxaa/output overwrite it), surface in the backtick HUD +
  perf log. Also emit a per-frame `prog`-delta so shader-stall frames self-label.
- **C1 — Time-slice `_generate` into a ms-budgeted coroutine.** Convert the
  synchronous per-chunk build into a generator that yields between sub-stages;
  ChunkManager drives it under a per-frame millisecond budget, resuming next
  frame. Determinism preserved — `rng()` draw *order* is unchanged, only *when*.
- **A1 + A4 — Shader prewarm + sliced reveal.** Prewarm known material/geometry
  combos via `renderer.compileAsync()` during the title card; for anything not
  prewarmed, reveal newly-streamed meshes so at most one new GL program links per
  frame. Turns the 300ms wall into sub-frame slivers.
- **F2 — Amortized shadow map.** `shadowMap.autoUpdate = false` + a manual
  `needsUpdate` every N frames (sun crawls, casters are static, NPCs don't cast).
  Reuses the last *good* map between updates (NOT the empty-map disable path
  AdaptiveQuality warns about).
- **F1 — Gate the bloom pass when nothing bright is in frame.** Per-frame
  `bloomPass.enabled` driven by nightness + nearest-bright-emissive proximity,
  coordinated with AdaptiveQuality's existing bloom ownership.
- **D3 — Pool per-frame crowd allocations.** Hoist the per-NPC-per-frame
  `activePassengersRef` closure object (crowd.js:605) and sibling scratch out of
  the hot loop to cut GC churn.
- **E1 — "Arriving at the festival" bloom curtain.** A deliberate ~400ms bloom/
  warm-grade/audio swell on hub entry that hosts any residual compile cost, so a
  leftover stall reads as a cinematic arrival beat rather than a freeze.
- **Tier-2 (measurement-gated, may partially defer):** static-geometry merge at
  chunk completion; crowd LOD (distance-tiered update + offscreen freeze);
  fog-as-far-cull; billboard stage-light shafts; faked lake reflections; adaptive
  sparkle budget. These ship only where B0's numbers justify them.

Not in scope (parked on ROADMAP): any bundler/build step, Web Workers,
KTX2/Draco texture/mesh compression. The 1×1 scissor prewarm, depth pre-pass, and
"catch your breath" speed clamp were evaluated and cut (see perf-brainstorm Part 2).

## Capabilities

### New Capabilities
- `frame-budget`: the contract that per-frame work is bounded and measurable —
  streaming is time-sliced under a ms budget (C1), shader compilation is
  prewarmed + sliced so no single frame links more than one new program (A1/A4),
  the shadow map is amortized (F2), and the HUD reports true scene draws/tris
  under post-processing (B0).
- `perceptual-lod`: the Tier-2 contract for distance/visibility-based cost
  reduction that stays imperceptible — crowd update LOD + offscreen freeze,
  fog-bounded far-cull, static-decor geometry merge, and faked atmosphere
  (light-shaft billboards, lake reflections, adaptive sparkle).

### Modified Capabilities
- `render-pipeline`: ADDED requirements for dynamic bloom gating (F1) and the
  arrival-transition curtain (E1). No existing requirement's behavior is removed
  or inverted.

## Impact

- **Code:** `src/main.js` (composer/info-capture pass, prewarm, shadow autoUpdate,
  bloom gate, arrival curtain), `src/chunks.js` (`_generate` coroutine + ms
  budget), `src/crowd.js` (allocation pooling + LOD), `src/debug.js` (true draws/
  tris + prog-delta readout), `src/world.js` (sun shadow ownership for F2),
  `src/adaptiveQuality.js` (bloom/shadow coordination), `src/lakes.js` /
  `src/forests.js` (Tier-2 merge/cull, if reached), plus `src/perf.js` for any new
  per-tier knobs.
- **Subsystems:** render pipeline, world streaming, crowd AI, lighting/ToD,
  perf tiers, debug/HUD.
- **Tripwires brushed (drives the deliberation gate):** determinism (C1 must not
  reorder `rng()`); boot order + threeShim + iOS audio (A1 prewarm sits in the
  title-tap path next to `Sound.init()`); render-pipeline + per-tier perf budget
  (B0/F1/F2/E1, the info-capture pass, shadow cadence); chunk/forest/lake
  lifecycle + disposal (C1 half-built chunks, Tier-2 geometry merge + `userData.
  shared`); no `castShadow` regressions. NO importmap change expected (no new
  module files; verify with `bin/check-importmaps` if any are added).
- **Player-visible:** yes (smoother streaming, no hub freeze, arrival flourish) →
  CHANGELOG required.

## Scope Check

Searched for parallel sites of each pattern:
- **Shadow cadence (F2):** only one `DirectionalLight` casts (`world.js:349`, the
  sun); `renderer.shadowMap.autoUpdate` is currently unset (defaults true) and not
  touched elsewhere — single owner, no parallel.
- **Bloom enable (F1):** `bloomPass.enabled` is owned in two places today —
  boot (`main.js:147`) and AdaptiveQuality level changes (`adaptiveQuality.js:171`).
  F1 becomes a third writer, so it MUST be coordinated through a single resolved
  predicate, not set blindly — included in scope, called out in design.
- **Per-frame allocation (D3):** the `activePassengersRef` closure is the cited
  hot allocation; the crowd loop will be swept for sibling per-frame `new
  Vector3/Color`/array-literal churn in the same pass.
- **Geometry merge / disposal (Tier-2):** the existing vendor-booth static-decor
  merge (CHANGELOG, −36% meshes) is the precedent; any new merge reuses its
  `userData.shared` disposal discipline rather than inventing a second pattern.
- **Info readout (B0):** `renderer.info.render.calls` is read in two places in
  `debug.js` (HUD line ~1029, perf sample ~1609) — both must consume the new
  post-RenderPass snapshot, not the post-composer value.
