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

The trip SHALL be a custom `ShaderPass` (lens distortion, ripple, chromatic aberration,
hue shift, saturation, posterize, brightness + vignette pulse) whose per-effect
intensities are scaled by a master `intensity` envelope. The envelope SHALL ramp in over
`fadeIn`, sustain for `duration`, and fade out; T-menu sliders set each effect's base
intensity. The pass SHALL be a no-op (and SHALL disable itself) at envelope 0 so it costs
nothing when inactive (`trip.js:1-166`, the post-process-gating perf rule).

#### Scenario: The trip pass is free when inactive

- **WHEN** the trip envelope is 0
- **THEN** the ShaderPass is a no-op / disabled and adds no full-screen cost

### Requirement: Wook dose offer flow

When a wook lingers near a stopped cart for ~5 continuous seconds the trip system SHALL
offer a dose, emitting `onOffer`/`onAccept`/`onDecline` hooks (wired by `main.js` to HUD
prompts) and `onNarrate` periodically during an active trip — keeping the trip module
HUD-agnostic. Accepting SHALL start the envelope (`trip.js:3-8,180-193`).

#### Scenario: Lingering near a wook offers a trip

- **WHEN** a wook stays near the stopped cart for ~5 seconds
- **THEN** `onOffer` fires and the player can accept (start the trip) or decline
