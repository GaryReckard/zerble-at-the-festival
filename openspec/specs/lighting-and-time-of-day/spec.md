# Capability: lighting-and-time-of-day

> **Source:** `src/timeOfDay.js` (the cycle + `nightness` + sky/sun/hemi/fog drive),
> `src/contextLights.js` (the distance-culled proxy-light registry). `nightness`
> consumers (stage shows, torches, drum audio, eye glow, stars) are specified in
> their own capabilities; this spec owns the *producer* and the lighting budget.

A single normalized clock drives the festival's day/night look and a global
`nightness` value that every other system polls to fade lights and behaviors in.
A separate registry caps how many optional proxy lights are active at once so the
forward renderer's per-fragment lighting cost stays bounded.

## ADDED Requirements

### Requirement: Normalized day/night clock

`TimeOfDay` SHALL track one normalized `t ∈ [0,1)` advancing by
`dt / cycleSeconds` per update and wrapping, where `0`=dawn, `0.25`=noon, `0.5`=dusk,
`0.75`=midnight. One full cycle SHALL default to 360 seconds. The world SHALL start
at `t ≈ 0.15` (mid-morning) so the player's first view is bright daylight. A `setT(t)`
method SHALL allow forcing the time (used by the debug menu and sandbox slider)
(`timeOfDay.js:80-129`).

#### Scenario: Time advances and wraps

- **WHEN** `update(dt)` is called repeatedly
- **THEN** `t` increases by `dt/cycleSeconds` and wraps from just under 1 back to 0

#### Scenario: Debug can force a time of day

- **WHEN** `setT(0.75)` is called
- **THEN** `t` becomes midnight and the visuals re-apply immediately

### Requirement: Smooth nightness accessor

`TimeOfDay` SHALL expose a `nightness ∈ [0,1]` getter derived from `t`: 0 across the
daytime band (`t` ≈ 0.07–0.43), a smoothstep ramp through twilight, 1 across the
night band (`t` ≈ 0.55–0.95), and a smoothstep back down before dawn. This is the
single value other systems poll to fade in night behavior (`timeOfDay.js:65-78,
107-110`).

#### Scenario: Midday is fully day

- **WHEN** `t` is 0.25 (noon)
- **THEN** `nightness` is 0

#### Scenario: Midnight is fully night

- **WHEN** `t` is 0.75
- **THEN** `nightness` is 1

### Requirement: Drives sky, sun, hemisphere, ambient, and fog

Each update SHALL apply the look from `t` and `nightness`: sky shader top/bottom
colors blended day→dusk→night; the sun directional light's position along an
east→overhead→west arc (using `cos` for X so morning and afternoon shadows differ),
color (day→dusk→moon), and intensity (day↔night lerp); hemisphere sky/ground colors +
intensity; ambient intensity; and fog color. The sun SHALL stop casting shadows once
`nightness >= 0.7` so there is no shadow caster from the dim night sun
(`timeOfDay.js:131-199`).

#### Scenario: Morning and afternoon shadows differ

- **WHEN** the sun is sampled at a morning `t` and the mirror-image afternoon `t`
- **THEN** the sun's X position differs (east vs west), so the shadows fall on
  opposite sides rather than identically

#### Scenario: Night sun stops casting

- **WHEN** `nightness` reaches 0.7 or higher
- **THEN** `sun.castShadow` is false

### Requirement: Attach-injected scene references

`TimeOfDay` SHALL not create the lights/sky/fog itself; `world.js` SHALL build them
and inject them via `attach({ sky, sun, hemi, ambient })`, after which `TimeOfDay`
mutates those references each frame. The scene's existing `fog` SHALL be picked up at
attach time (`timeOfDay.js:97-105`).

#### Scenario: World owns the lights, clock drives them

- **WHEN** `world.js` calls `attach` with its sun/hemi/ambient/sky
- **THEN** subsequent `update` calls mutate exactly those objects' color/intensity/position

### Requirement: Constant context-light pool

`contextLights.js` SHALL maintain a registry of optional proxy lights (campsite
firepits, drum-circle pits, Sugar Shack spots) plus a FIXED scene pool of
`POINT_POOL` (6) `PointLight`s and `SPOT_POOL` (6) `SpotLight`s. Registered lights
SHALL become invisible carriers (`visible = false`, contributing nothing to the
scene's light count); the pool does all the rendering. Each frame
`update(cameraPos, scene)` SHALL discard any registered carrier beyond
`MAX_DISTANCE` (45m), sort the in-range carriers nearest-first, and copy the closest
ones' world position/color/intensity (+ spot aim) into the matching pool slots,
dimming unclaimed slots to `intensity = 0`. Because the scene's point/spot light
counts NEVER change, the per-fragment lighting loop pays a constant bounded cost and
the material program cache stops growing (the old `light.visible` toggle leaked ~220
shader programs as the visible count wobbled). The pool SHALL materialize lazily —
`update` is a pure no-op while no light has registered (`contextLights.js:38-47,
54-72,88-157`).

#### Scenario: Distant context lights are excluded

- **WHEN** a registered proxy light is more than 45m from the camera
- **THEN** it claims no pool slot and contributes no shader cost

#### Scenario: Only the closest fill the pool

- **WHEN** more registered lights are within range than there are pool slots of
  their type
- **THEN** only the nearest by squared distance (up to `POINT_POOL` points /
  `SPOT_POOL` spots) are copied into the pool; the rest are skipped

### Requirement: Lazy pruning of orphaned lights

`contextLights.update` SHALL lazily drop any registered light whose `parent` is null
(its host chunk/cluster was unloaded), so the registry does not leak entries across
chunk lifecycle churn (`contextLights.js:101-108`).

#### Scenario: Unloaded cluster's light is pruned

- **WHEN** a chunk holding a registered light unloads and detaches it
- **THEN** the next `update` removes it from the registry
