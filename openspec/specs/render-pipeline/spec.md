# Capability: render-pipeline

> **Source:** `src/main.js` (renderer + `EffectComposer` setup `:100-149`, the
> `tick`/`tickBody` main loop `:640-1126`, resize `:1293-1318`), `src/threeShim.js`
> (the `'three'` importmap entry — tier-aware material override). The collision model
> invoked from the loop is specified in `registry-collision`; quality knobs in
> `perf-tiers`.

The render pipeline is a `WebGLRenderer` driving an `EffectComposer` post chain, a
single per-frame `tick` that runs all systems then composites, and a tier-aware
three.js shim that swaps the standard PBR material for a cheap one on low-end devices
without any caller changes.

## ADDED Requirements

### Requirement: Renderer configured from the perf profile

`main.js` SHALL create one `WebGLRenderer` whose pixel ratio is capped at
`min(devicePixelRatio, PERF.pixelRatioCap)`, whose `shadowMap.enabled` and
`shadowMap.type` follow `PERF.shadows` / `PERF.shadowType` (`PCFSoftShadowMap` only
on the `soft` profile, `BasicShadowMap` otherwise), with `ACESFilmicToneMapping`,
exposure `1.05`, and sRGB output color space. MSAA (`antialias`) SHALL be enabled
only on the `high` profile (`main.js:102-114`).

#### Scenario: Low tier renders without MSAA or shadows

- **WHEN** the profile is `low`
- **THEN** the renderer is created with `antialias: false` and `shadowMap.enabled` false

### Requirement: Post-processing composer chain

`main.js` SHALL build an `EffectComposer` with passes added in this order:
`RenderPass`, `UnrealBloomPass` (constructed at half resolution — `width*0.5` ×
`height*0.5`), the `Trip` `ShaderPass`, a conditional `FXAAShader` pass (added only
when MSAA is off, i.e. on `low`/`mid`), and finally `OutputPass`. Bloom SHALL be
disabled (`enabled = false`) when `PERF.bloom` is false; the Trip pass SHALL be a
no-op at intensity 0 (`main.js:120-149`).

#### Scenario: Mid tier uses FXAA in place of MSAA

- **WHEN** the profile is `mid` (MSAA off)
- **THEN** an `FXAAShader` pass is inserted before `OutputPass`, sized from the
  renderer pixel ratio

#### Scenario: High tier skips FXAA

- **WHEN** the profile is `high` (MSAA on)
- **THEN** no FXAA pass is added

### Requirement: Single per-frame tick

The main loop SHALL be one `tick()` that computes a delta-time (clamped so a long
stall can't explode physics) and runs `tickBody(dt)` only when `shouldRunFrame(dt)`
permits (debug can pause / single-step). `composer.render()` is the **last line of
`tickBody`**, so compositing happens only on frames the gate allows. `tickBody` SHALL
advance, in order, Zerble physics, audio engine + nightness, input edges,
bubbles/crowd/smiles, roaming obstacles, trip/Lurleen, stage performers + light show,
campsite/drum animatables, world streaming, collision resolution, honk-ring, chase
camera, and the audio listener, before rendering (`main.js:640-644,1113`).

#### Scenario: Debug pause freezes both the world and the render

- **WHEN** `shouldRunFrame(dt)` returns false (paused via the debug overlay, `debug.js:129`)
- **THEN** `tickBody` is skipped entirely — including its final `composer.render()` — so
  the last drawn frame stays on screen until a single-step (`step`) or unpause

### Requirement: Hidden-tab loop uses setTimeout

When `document.hidden` is true the loop SHALL schedule its next frame with
`setTimeout(tick, 16)` instead of `requestAnimationFrame`, because RAF throttles to
~0fps in a backgrounded tab and the Claude Preview MCP keeps the page hidden. When
visible it SHALL use `requestAnimationFrame` (`main.js:1119-1121`).

#### Scenario: Backgrounded tab keeps ticking

- **WHEN** the document is hidden
- **THEN** the next frame is scheduled via `setTimeout` at ~16ms, so a hidden
  preview tab continues to run the game loop

### Requirement: iOS-correct resize via visualViewport

Resize handling SHALL prefer `window.visualViewport` dimensions (the actual visible
area on iOS Safari as the URL bar shows/hides) over `window.innerWidth/Height`, and
SHALL update the camera aspect, renderer size, and `composer.setSize` together
(`main.js:1293-1318`).

#### Scenario: Canvas tracks the iOS URL bar

- **WHEN** the iOS Safari URL bar collapses and fires a `visualViewport` resize
- **THEN** the canvas, camera aspect, and composer are resized to the new visible area

### Requirement: Tier-aware material override via the three shim

The `'three'` importmap entry SHALL resolve to `src/threeShim.js`, which re-exports
real three.js and overrides only `MeshStandardMaterial`. On the `low` profile the
override SHALL return a `MeshLambertMaterial` built from the Lambert-compatible subset
of the requested params (dropping `roughness`/`metalness`/etc.), tagged
`userData.loweredFromStandard = true`; on `mid`/`high` it SHALL return a real
`MeshStandardMaterial`. The override SHALL happen at module-resolution time, never by
reassigning a property on an imported namespace (`threeShim.js` whole file).

#### Scenario: Low tier silently downgrades standard materials

- **WHEN** code constructs `new THREE.MeshStandardMaterial({ color, roughness })` on
  the low profile
- **THEN** it receives a `MeshLambertMaterial` with the color preserved, roughness
  dropped, and `userData.loweredFromStandard` set

#### Scenario: No post-import namespace mutation

- **WHEN** a tier-aware override of a three.js export is needed
- **THEN** it is provided through the shim's direct named export, never via
  `THREE.X = Y` after `import * as THREE` (which throws "Cannot assign to property of
  [object Module]" on spec-strict runtimes)
