# Capability: ambient-backdrop

> **Source:** `src/birds.js` (the boids flock) + `src/models/bird.js` (the instanced
> bird geometry), the star field + moon in `src/world.js` (`buildStars` `:204`,
> `buildMoon` `:293`), `src/mountains.js` (the Blue Ridge ring). The player-centering
> of these backdrops is in `world-streaming`; nightness in `lighting-and-time-of-day`;
> birdsong in `audio-synthesis`.

The non-interactive backdrop that makes the festival feel like a place: a living bird
flock, a twinkling night sky with an arcing moon, and a mountain ring on the horizon.

## ADDED Requirements

### Requirement: Boids bird flock

`birds.js` SHALL maintain a global flock that flies over the festival and perches in
trees, with per-species boids steering (separation / alignment / cohesion), mate-seeking
+ courting (priority birdsong), landing on free canopy perches the registry exposes, and
a startle response when the cart drives close and fast. The whole flock SHALL render as
an `InstancedMesh` (~15 draw calls regardless of count), with caps scaling by perf tier,
living within `SPAWN_RADIUS` (130m) of the player and treadmilling at `DESPAWN_RADIUS`
(175m). Activity SHALL follow a daily curve (dawn rise, midday lull, dusk peak, night
roost) (`birds.js:1-56`).

#### Scenario: A bird startles when buzzed

- **WHEN** the cart drives close and fast under a low or perched bird
- **THEN** that bird startles and takes off

#### Scenario: The flock is instanced

- **WHEN** many birds are active
- **THEN** they render in roughly a constant ~15 draw calls via the InstancedMesh

### Requirement: Night sky — stars and moon

`world.js` SHALL build a 1200-point star field (upper-hemisphere distribution, per-star
size/color/twinkle phase, additive `ShaderMaterial`) whose opacity is driven by a
`nightness` uniform and hard-skipped (`visible = false`) at full daylight, and a moon
mesh (self-luminous `MeshBasicMaterial` body + mare + additive halo, not a light source)
that arcs east→overhead→west during the night phase and hides during the day
(`world.js:196-341`).

#### Scenario: Stars fade in at dusk and skip the draw by day

- **WHEN** `nightness` exceeds ~0.05
- **THEN** the star field becomes visible and twinkles; at full daylight it is set
  `visible = false`

#### Scenario: The moon arcs only at night

- **WHEN** the time is in the night phase
- **THEN** the moon is visible and arcs across the sky; otherwise it is hidden

### Requirement: Mountain backdrop ring

`mountains.js` SHALL build a Blue Ridge mountain ring (three rings of low-poly autumn
hills) that `world-streaming` re-centers on the player so the horizon looks a constant
distance away as the player roams. The ~234 hills SHALL be merged at build time into a
single geometry + single shared material so the whole backdrop is ONE draw call: each
hill's per-vertex colour and world transform are baked into its geometry before
`mergeGeometries`, the merged buffer + material are tagged `userData.shared = true`, and
the hills use `Math.random()` (no determinism contract, so the merge is pixel-identical
and loses nothing). The material has `fog: false` so the ring always silhouettes the
horizon through fog (`mountains.js:30-89`, `buildMountains`; recenter at `world.js:129`).

#### Scenario: Mountains stay on the horizon

- **WHEN** the player drives in any direction
- **THEN** the mountain ring re-centers so the horizon never gets closer

#### Scenario: The whole mountain ring is one draw call

- **WHEN** the mountain backdrop renders
- **THEN** all ~234 hills draw as a single merged mesh (one draw call), not one draw per
  hill
