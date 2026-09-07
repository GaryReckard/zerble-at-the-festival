# Capability: special-modes

> **Source:** `src/starPower.js` (the rare star + 15s buff), `src/trip.js` (the wook
> dose + post-process pass). Both are **Easter eggs — internal-only.** Player-facing
> copy (README, title card) MUST NOT reveal them. The post-process pass lives in the
> composer chain (`render-pipeline`); the offer/narration HUD wiring is in `main.js`;
> the trip-coupled audio swell is in `audio-synthesis`; the star vignette in `hud`.
> See `NOTES.md` for the hidden interaction details.

Two timed special modes layer over normal play: star power (a collectible buff that
ghost-modes and rainbow-tints the cart) and the trip (a screen-warping post-process the
player can be offered by a wook). Both are discovery content, never advertised.

## ADDED Requirements

### Requirement: Star power buff

A glowing star SHALL spawn on a long cooldown out near the player; driving into it SHALL
start a `DURATION` (15s) buff with an arm/hold/fade envelope: ghost mode (pass through
obstacles), a silvery-rainbow recolor of the cart's polygons, streaming sparkles and
rainbow tire-tracks, a beam, an ending blink, and NPCs within `LOVE_RADIUS` (25m)
falling in love. The buff SHALL stack the trip (`starPower.js:1-11,130-131`).

#### Scenario: Collecting the star ghosts and rainbows the cart

- **WHEN** the player drives into the star
- **THEN** the cart enters ghost mode and rainbow-tints for 15 seconds, then blinks out

### Requirement: Rainbow recolor via idempotent shader patch

The rainbow recolor SHALL be applied by `patchStarPowerMaterial(mat)` — an idempotent
`onBeforeCompile` patch that injects HSV rainbow GLSL after `<color_fragment>`, mixed by
a shared `uStarEnv` uniform, with a stable `customProgramCacheKey` so the patched
program is cached. It SHALL NOT reassign any frozen module export
(`starPower.js:29-92`, the threeShim/frozen-namespace rule).

#### Scenario: Patching a material twice is a no-op

- **WHEN** `patchStarPowerMaterial` is called twice on the same material
- **THEN** the second call returns immediately (guarded by `userData._starPatched`)

### Requirement: Trip post-process pass, gated at zero

The trip SHALL be a custom `ShaderPass` (lens distortion, ripple, melt, chromatic
aberration, hue shift, saturation, posterize, brightness + vignette pulse) whose per-effect
intensities are scaled by a master `intensity` envelope. The envelope SHALL ramp in over
`fadeIn`, sustain for `duration`, and fade out; T-menu sliders set each effect's base
intensity. The pass SHALL be a no-op (and SHALL disable itself) at envelope 0 so it costs
nothing when inactive (`trip.js:1-166`; the `pass.enabled = envelope > 0.001` gate is at
`trip.js:583` — the post-process-gating perf rule).

#### Scenario: The trip pass is free when inactive

- **WHEN** the trip envelope is 0
- **THEN** the ShaderPass is a no-op / disabled and adds no full-screen cost

### Requirement: Luxury trip effects are tier-masked

Trip effects added after the 2026-09-01 tier contract SHALL be a high/mid luxury: the
`low` tier MUST NOT be more expensive than it was before the effect existed. Such an
effect's key SHALL appear in `LOW_TIER_MASKED` (`trip.js`), which resolves once at
`init()` against `PERF.name` and forces both the uniform and the `live` readout to 0 on
low. A masked effect SHALL be unmaskable only through the debug surface
(`Trip.maskEnabled` / `__dbg.tripMask(false)`) so its low-tier cost can be measured; it
SHALL stay masked in shipping behaviour until a frame-time A/B on `?perf=low` shows no
regression.

#### Scenario: A luxury effect costs nothing on low

- **WHEN** the trip runs on `?perf=low`
- **THEN** every key in `LOW_TIER_MASKED` reports 0 in both its uniform and `Trip.live`

### Requirement: Trip iteration harness

The trip SHALL be inspectable at any point on its timeline without playing one through.
`Trip.scrub(p)` (surfaced as `__dbg.tripScrub` and the T-menu scrub slider) SHALL pin the
trip at progress `p`, force Dynamic mode, hold the envelope open, and bypass the state
machine so no phase advances and no narration fires; `Trip.state` SHALL read `'scrub'` so
a held window is distinguishable from an organic trip in perf telemetry. Passing `null`
SHALL release the hold to `idle` with the pass disabled.

Because `InfoCapturePass` records draws and triangles BEFORE the trip pass in the composer
chain, the draw/tri budgets cannot observe the trip and frame time is the only responsive
metric. Perf samples SHALL therefore carry a `phase` label (`__dbg.perfPhase`), and
`perfPhaseSummary` SHALL average frame-time columns over populated samples only, reporting
a `warmup` count — `AdaptiveQuality` publishes no frame stats until its 90-frame window
fills, and averaging those zeros biases the earliest window (normally the baseline)
optimistically.

While Dynamic mode drives a trip, the T-menu effect sliders SHALL remain usable: touching
one SHALL take that effect off its curve and drive it from `Trip.config`
(`Trip.overrideEffect`), and the panel's live-value mirror SHALL NOT write to an
overridden slider. `Trip.clearOverrides()` (and any preset) SHALL return every effect to
its curve.

#### Scenario: Tuning one effect mid-trip

- **WHEN** an effect slider is dragged during a Dynamic-mode trip
- **THEN** that effect renders the slider's value while every other effect keeps animating

#### Scenario: Holding the trip at its climax

- **WHEN** `__dbg.tripScrub(1/3)` is called
- **THEN** the trip renders its climax indefinitely and `Trip.progress()` returns `1/3`

### Requirement: One shared climax for picture and sound

The trip's peak SHALL be defined once, as the exported `PEAK_CENTER` / `PEAK_WIDTH`
constants in `trip.js`, consumed by the visual curves through `Trip._peak(p, width)` and by
`midiPlayer.js`'s `peakBell`. No effect SHALL hardcode its own centre. An effect needing a
sharper climax SHALL pass its own `width` while still sharing the centre.

#### Scenario: Re-centring the climax moves picture and sound together

- **WHEN** `PEAK_CENTER` changes
- **THEN** the visual peak-gated curves and the audio crescendo both move with it

### Requirement: Wook dose offer flow

When a wook lingers near a stopped cart for ~5 continuous seconds the trip system SHALL
offer a dose, emitting `onOffer`/`onAccept`/`onDecline` hooks (wired by `main.js` to HUD
prompts) and `onNarrate` periodically during an active trip — keeping the trip module
HUD-agnostic. Accepting SHALL start the envelope (`trip.js:3-8,180-193`).

#### Scenario: Lingering near a wook offers a trip

- **WHEN** a wook stays near the stopped cart for ~5 seconds
- **THEN** `onOffer` fires and the player can accept (start the trip) or decline
