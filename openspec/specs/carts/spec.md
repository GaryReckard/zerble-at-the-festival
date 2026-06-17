# Capability: carts

> **Source:** `src/zerble.js` (the player cart — geometry + arcade physics +
> nightness-gated lights), `src/lurleen.js` (the companion cart + its state machine).
> Both stay in `src/` (not `models/`) because they carry physics + state, not just
> geometry. Collision dispatch is in `registry-collision`; the spatialized engine
> audio in `audio-synthesis`; input in `input-controls`.

Two anthropomorphic golf carts. Zerble is the player-driven cart with arcade physics
and a face that lights up at night. Lurleen is a second cart — a love interest — that
wanders the world and, when the player comes near, erupts in hearts and chases them.

## ADDED Requirements

### Requirement: Arcade driving physics

`Zerble.update(dt, input, nightness)` SHALL integrate arcade driving: throttle
accelerates at `ACCEL` (18 m/s²) toward `MAX_SPEED` (18 m/s), boost (throttle + boost
held) raises the cap by `BOOST_MULT` (1.55×), reversing throttle decelerates at
`BRAKE` (28 m/s²), no throttle applies multiplicative `DRAG` (0.78/s), and steering
turns at up to `TURN_RATE` (2.1 rad/s) scaled by speed. The cart SHALL have collision
radius 1.9 (`zerble.js:10-23,70,1240-1269`).

#### Scenario: Boost raises the speed cap

- **WHEN** the player holds throttle and boost
- **THEN** the cart accelerates toward `MAX_SPEED * BOOST_MULT`

#### Scenario: Coasting decays speed

- **WHEN** the player releases throttle while moving
- **THEN** speed decays by the multiplicative drag coefficient each frame

### Requirement: World bound keeps the player in the festival

The cart's position SHALL be clamped within `WORLD_BOUND` (230m) so the player can't
outrun the festival's "feel" (`zerble.js:23`).

#### Scenario: The edge of the world holds

- **WHEN** the player drives toward the boundary
- **THEN** the cart is clamped at `WORLD_BOUND` rather than continuing into emptiness

### Requirement: Invulnerability window on hit

`Zerble.applyHit(pushDir)` SHALL apply a knockback impulse and open a brief
invulnerability window (`invulnLeft`), so a single collision doesn't chain into
repeated damage while the cart is being pushed clear (`zerble.js:71`, the collision
model in `registry-collision`).

#### Scenario: A hit grants brief immunity

- **WHEN** `applyHit` runs
- **THEN** the cart is knocked back and is immune to further damage until the window expires

### Requirement: Nightness-gated cart lights

The cart's emissive eye glow, headlight/well lights, brake lights, and the spinning
disco spot SHALL ramp with `nightness` (subtle or off by day, vivid after dark) so
they cost effectively nothing in daylight, and the eye glow SHALL be hand-tunable for
testing. The cart body SHALL show a bubble-mix "juice" level that tracks the score
meter (`zerble.js:349-351,406-464,513-532,1334-1410`).

#### Scenario: Lights fade in at dusk

- **WHEN** `nightness` rises toward 1
- **THEN** the eye glow, well lights, and disco spot ramp up; at full day they are off

### Requirement: Lurleen state machine

`Lurleen.update(dt, zerblePos, zerbleHeading)` SHALL run a state machine:
`wandering` (drift to wander targets) → `aware` (when the player comes within
`AWARE_RANGE`, erupt a burst of pink hearts and pause briefly) → `following` (chase
the player), falling back to `wandering` when the player is far again. She SHALL emit
recurring heart particles, more frequently while aware than while following
(`lurleen.js:6-14,691-843`).

#### Scenario: Proximity triggers awareness then pursuit

- **WHEN** the player drives within `AWARE_RANGE` of a wandering Lurleen
- **THEN** she bursts hearts, pauses in `aware`, then transitions to `following` and
  drives after the player

### Requirement: Lurleen off-camera re-home

When Lurleen is far off-camera, `update` SHALL be allowed to re-home her (teleport to
a fresh wander position) and SHALL skip that frame's state machine after a teleport so
a re-homed cart doesn't snap-chase from the old position (`lurleen.js:141-146,
705-709`).

#### Scenario: Re-homed Lurleen doesn't snap-chase

- **WHEN** Lurleen re-homes off-camera
- **THEN** the state machine is skipped that frame so she starts fresh at the new spot

### Requirement: Lurleen reports a damage-free, named collision

Lurleen SHALL register a collider with `damage: 0` so bumping her bounces the player
(and notifies for a toast/SFX) without deducting smiles — she is a sweetheart, not an
obstacle (`main.js:1246-1251`, the `lurleen_found` analytics event).

#### Scenario: Bumping Lurleen costs no smiles

- **WHEN** the player collides with Lurleen
- **THEN** the carts bounce apart and a toast/SFX fires, with no score deduction
