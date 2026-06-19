# Capability: crowd-ai

> **Source:** `src/crowd.js` (the pooled NPC crowd — spawn, state machine, steering,
> smile mechanic), `src/obstacles.js` (the roaming themed groups: puppet parade,
> brass band, kid gaggle, wooks). Crowd NPCs and obstacle groups both feed the
> collision pass in `registry-collision`; the humanoid geometry is in `models`;
> bubbles/smiles in `feedback-systems`; the song-end cheer signal in
> `audio-synthesis`.

The crowd is a pool of stateful NPCs spawned by chunks, each with a personality and a
small behavior state machine, that react to the player — making eye contact, smiling
and dropping smile pickups, fleeing when plowed into. Separately, a few themed groups
roam the field on placed loops as soft obstacles.

## ADDED Requirements

### Requirement: Pooled, personality-driven NPCs

`Crowd` SHALL maintain a pool capped at `PERF.crowdMax` (`MAX_NPCS`, 180 / 320 / 500
by tier). Each NPC SHALL be spawned with a random personality — `curiosity`,
`skittish` (constrained so an NPC can't be both bold and skittish: `skittish =
(1 - curiosity) * rng()`), `social`, `energy`, and `dance` (an in-place sway
amount) — that shapes its behavior. NPCs SHALL render through a pooled/instanced
humanoid (`MAX_NPCS` at `crowd.js:30`; `spawn()` + personality roll at
`crowd.js:350-414`).

#### Scenario: Crowd size honors the tier budget

- **WHEN** the profile is `low`
- **THEN** the live NPC count never exceeds 180

### Requirement: NPC behavior state machine

Each NPC SHALL run a state machine across `idle → walking → watching → approaching →
fleeing → boarding/riding/disembarking`, plus hammock variants
(`walking_to_hammock`, `hammock_riding`), picnic-table variants
(`walking_to_table`, `table_seated`), and porta-potty variants (`seeking_potty`,
`entering_potty`, `using_potty`, `exiting_potty`, `surprised_potty`). Smiling is an
event (a smile-pickup emission), not a state. A transient **cheer** overlay
(`cheerNear(x,z)` fired on a stage song-end) poses arms-up and smiles for 5s on top
of the current state without interrupting riders, boarders, fleers, hammock-riders,
or table-seated NPCs (`cheerNear` at `crowd.js:485-499`).

#### Scenario: Song-end triggers a cheer wave

- **WHEN** a stage song ends and `cheerNear` is called at its position
- **THEN** nearby eligible NPCs cheer for 5 seconds, skipping
  riders/boarders/disembarkers/fleers/hammock-riders/table-seated

### Requirement: Steering blends seek, separation, and path pull

NPC steering SHALL combine a seek toward the NPC's target (a registered attractor or
random spot), repulsion from registry footprints, soft separation from neighbors
within `SEPARATION_RADIUS`, and a gentle pull toward the path grid (multiples of
`PATH_GRID = 80`) so people *tend* to use the dirt paths without being forced to. The
separation broadphase SHALL be rebuilt from live NPC positions each frame, excluding
riders (`SEPARATION_RADIUS`/`PATH_GRID` consts at `crowd.js:85-88`; per-frame
`_sepGrid` rebuild at `crowd.js:594-599`; the seek/separation/path-pull blend at
`crowd.js:1017-1066`).

#### Scenario: NPCs prefer paths but aren't rails

- **WHEN** an NPC walks near a path grid line
- **THEN** a soft pull biases it toward the path while seek/separation still apply

### Requirement: Smile mechanic with anti-farm reset

Eye contact with the player plus bubble proximity SHALL raise an NPC's internal
`happiness`; on threshold it SHALL emit a smile pickup and record the player's
position. The same NPC SHALL NOT smile again until the player has driven
`SMILE_RESET_DIST` (28m) away AND a cooldown has elapsed, so parking next to a crowd
can't farm smiles (`SMILE_RESET_DIST` at `crowd.js:63`; `happiness`/`lastSmilePos`/
`smileTimeCooldown` NPC fields at `crowd.js:420-424`; the anti-farm guard +
threshold emission at `crowd.js:1115-1141`).

#### Scenario: Parked player can't farm smiles

- **WHEN** the player stays near an NPC that just smiled
- **THEN** that NPC does not smile again until the player has driven at least 28m away
  and the cooldown passed

### Requirement: Hit response panics and infects

`onZerbleHit(npc, nx, nz)` SHALL panic the struck NPC into `fleeing`, apply knockback,
and infect nearby NPCs (within 6m) into a brief fleeing state, so a high-speed plow
scatters the crowd (`crowd.js:2014-2035`, dispatched from `main.js:1262` inside
`resolveCollision`).

#### Scenario: A plow scatters the crowd

- **WHEN** the player damages an NPC at speed
- **THEN** that NPC flees and nearby NPCs are infected into fleeing too

### Requirement: Distance despawn, not chunk-keyed despawn

NPCs SHALL be despawned by distance from the player (`DESPAWN_RADIUS`), NOT when their
spawn chunk unloads — so NPCs who wander across chunk boundaries don't blink out.
`unloadChunk` SHALL therefore be a no-op for the crowd; despawn SHALL skip riders and
boarders so passengers aren't yanked off the cart (`DESPAWN_RADIUS` at `crowd.js:36`;
`unloadChunk` no-op at `crowd.js:505-507`; `_despawnDistant` with the
riding/boarding skip at `crowd.js:511-518`).

#### Scenario: A wandering NPC survives its spawn chunk's unload

- **WHEN** an NPC walks into a neighboring chunk and its spawn chunk unloads
- **THEN** the NPC remains, despawning only once it's beyond `DESPAWN_RADIUS` of the player

### Requirement: Roaming obstacle groups on placed loops

`obstacles.js` SHALL own the puppet parade, brass band, kid gaggle, and wooks — each
marching a fixed-shape loop *placed* at a random anchor (0–150m from origin initially,
recycled to a new anchor over time), each exposing a `colliders` array of
`{ position, radius, damage, kind }` consumed by the collision pass. Geometry lives in
`src/models/`; this module owns path/AI behavior. The puppet parade SHALL support
honk-scatter (puppets ahead of a parked, honking player dodge laterally while the loop
keeps marching) (`obstacles.js:1-9,51-61,93-166`).

#### Scenario: A parade marches across the field, not just origin

- **WHEN** a roaming group spawns or recycles
- **THEN** its loop is placed at a random anchor so it appears across the field, with
  its members registered as colliders

#### Scenario: Honking scatters puppets ahead

- **WHEN** the player honks while parked in front of the puppet parade
- **THEN** the puppets in front dodge laterally for a moment while the parade loop
  continues underneath
