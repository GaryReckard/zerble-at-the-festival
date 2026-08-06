# Capability: perf-tiers

> **Source:** `src/perf.js` (boot tier detection + the `PERF` table + the
> `USE_WORLDGEN_V2` flag), `src/adaptiveQuality.js` (runtime frame-time monitor).
> Cross-cutting: every system that has a quality knob reads `PERF.*`; `main.js`
> installs and ticks `AdaptiveQuality`. Budget panel lives in `debug.js`
> (see `sandbox-harness`).

The game targets three device classes — low / mid / high — picked once at boot
from cheap signals, and every quality knob reads from a single `PERF` profile
object instead of hardcoding. A runtime monitor degrades quality further when the
frame budget is missed, and restores it when headroom returns.

## ADDED Requirements

### Requirement: Boot-time tier detection

`perf.js` SHALL select one of three profiles (`low`, `mid`, `high`) once at module
load from cheap device signals: touch capability, smallest screen dimension,
`navigator.hardwareConcurrency`, and `navigator.deviceMemory`. Touch + small screen
SHALL resolve to `low` (phone); touch + large screen to `mid` (tablet); a non-touch
machine with `cores <= 2` or `mem <= 2` to `mid`; otherwise `high`. The selected
profile SHALL be logged to the console (`perf.js:8-33,129-131`).

#### Scenario: Phone resolves to low

- **WHEN** the device is touch-capable and the smaller screen dimension is below 700px
- **THEN** the profile is `low`

#### Scenario: Capable desktop resolves to high

- **WHEN** the device is non-touch with more than 2 cores and more than 2GB reported memory
- **THEN** the profile is `high`

### Requirement: Tier override at URL and runtime

A `?perf=low|mid|high` query parameter SHALL force the profile, and a
`window.__perfProfile` value SHALL also force it; the manual override SHALL win over
detection (`perf.js:9-12`).

#### Scenario: URL forces a tier

- **WHEN** the page loads with `?perf=low`
- **THEN** the profile is `low` regardless of the device's detected class

### Requirement: Single PERF profile object

Each profile SHALL expose the full knob set consumed across the codebase:
`pixelRatioCap` (1.25 / 1.5 / 2), `bloom` (+ `bloomStrength`/`bloomRadius`/
`bloomThreshold`), `shadows` (off / on / on), `shadowType` (`basic` / `basic` /
`soft`), `crowdMax` (180 / 320 / 500), `chunkLoadRadius` (1 / 2 / 2),
`chunkUnloadRadius` (2 / 3 / 3), `chunkBudgetMs` (3 / 4 / 5),
`forestTreeDensityMul` (0.7 / 1 / 1), and
`bubblePoolMax` (200 / 350 / 600), and `cameraFar` (1040 at every tier because
the shared backdrop sets the same safe minimum). Systems SHALL read these instead
of branching on the tier name (`perf.js:49-105`).

#### Scenario: Shadows are gated by the profile

- **WHEN** the profile is `low`
- **THEN** `PERF.shadows` is `false` and shadow-dependent setup is skipped

#### Scenario: Camera range culls only fog-hidden retained content

- **WHEN** any profile constructs the gameplay camera
- **THEN** its far plane is 1040m, beyond the sky, stars, mountains, and ground envelope
- **AND** lake content retained toward the 1500m unload boundary is outside the frustum

#### Scenario: Streaming respects the tier's generation wall

- **WHEN** the eager first load is complete and multiple chunks are missing
- **THEN** the closest chunk starts immediately
- **AND** another chunk starts in that frame only while elapsed chunk-generation
  time remains below `PERF.chunkBudgetMs`

### Requirement: Opt-in context-light upgrades persisted in localStorage

`PERF.contextLights` and `PERF.fancyLights` SHALL both default off at every tier and
SHALL be read at boot from `localStorage` keys `zerble.contextLights` /
`zerble.fancyLights`. `contextLights` enables one proxy `PointLight` per cluster;
`fancyLights` adds a real light per torch/bulb/fixture on top. Reading localStorage
SHALL be wrapped so a throwing/absent store falls back to off (`perf.js:107-127`).

#### Scenario: Context lights stay off unless opted in

- **WHEN** neither localStorage key is set to `'1'`
- **THEN** `PERF.contextLights` and `PERF.fancyLights` are both `false`

### Requirement: Worldgen v2 flag resolved once at load

`perf.js` SHALL export `USE_WORLDGEN_V2`, resolved once at module load.
The default SHALL be `true` (the v2 procedural festival is what production ships, as
of 2026-06-16). `?worldgen=1` SHALL force v2 on and `?worldgen=0` SHALL force the
legacy v1 world. In a headless context with no `location`, it SHALL fall back to the
default (`perf.js:35-47`).

#### Scenario: v2 is the default

- **WHEN** the page loads with no `worldgen` query parameter
- **THEN** `USE_WORLDGEN_V2` is `true`

#### Scenario: Legacy world can be forced

- **WHEN** the page loads with `?worldgen=0`
- **THEN** `USE_WORLDGEN_V2` is `false`

### Requirement: Runtime adaptive quality monitor

`adaptiveQuality.js` SHALL watch raw wall-clock frame time over a rolling 90-frame
window and step DOWN through a fixed ladder of quality levels (pixel-ratio multiplier
→ bloom off → cheap bubbles → shadows off → lower pixel ratio) when the budget is
sustained-missed, and step UP conservatively when headroom returns. Each transition
SHALL mutate the live renderer/composer/PERF rather than reloading; debug sessions
also surface a HUD toast (`adaptiveQuality.js:39-59,125-250,303-338`).

#### Scenario: Sustained slow frames drop quality

- **WHEN** average frame time exceeds 22ms (or p95 exceeds 33ms) for 60 consecutive
  frames and the current level is not the lowest
- **THEN** the monitor applies the next-lower quality level and begins a fresh
  observation window at that level

#### Scenario: A severe hitch drops immediately

- **WHEN** two consecutive frames exceed 80ms
- **THEN** the monitor applies one downgrade without waiting for the sustain window

#### Scenario: Restore requires sustained headroom after a hold

- **WHEN** average, p95, AND max frame time are all below their raise thresholds for
  180 consecutive frames, the current level has been held for at least 30 seconds,
  and the level is above baseline
- **THEN** the monitor steps one level back up

#### Scenario: Failed recovery backs off its boundary

- **WHEN** a recovered level falls back within 15 seconds
- **THEN** the monitor waits two minutes before retrying that same quality boundary
- **AND** repeated failures double the wait up to a five-minute cap without blocking
  necessary downgrades through other boundaries

#### Scenario: Transitions do not reuse stale evidence

- **WHEN** the monitor changes level in either direction
- **THEN** it clears the rolling window and consecutive-run counters
- **AND** its next decision uses only frames rendered at the new level

### Requirement: Shadow toggle avoids stale ghost shadows

When the monitor disables shadows it SHALL NOT simply set
`renderer.shadowMap.enabled = false` (which leaves the last depth texture sampled,
freezing stale shadows). It SHALL instead walk the scene, turn off `castShadow` on
every casting mesh (saving the list for restore), and request a shadow-map update so
the next render writes a clean empty depth texture (`adaptiveQuality.js:340-384`).

#### Scenario: Disabling shadows clears the ground

- **WHEN** the monitor drops to a no-shadows level
- **THEN** every previously-casting mesh has `castShadow` set false and the ground
  reads fully lit, with no frozen shadow shapes

### Requirement: Pixel ratio is dropped first

The quality ladder SHALL reduce pixel ratio before disabling bloom or shadows,
because on Retina displays pixel ratio is the single largest GPU cost. Level pixel
ratios SHALL scale from the baseline captured at `install()` time, not clobber it,
and the composer SHALL be resized on every change so bloom render targets track the
new resolution (`adaptiveQuality.js:12-16,61-72,316-320`).

#### Scenario: First downgrade lowers resolution

- **WHEN** the monitor leaves the baseline level for the first time
- **THEN** it scales the renderer pixel ratio down before touching bloom or shadows
