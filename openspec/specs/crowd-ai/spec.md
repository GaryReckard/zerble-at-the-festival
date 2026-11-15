# Capability: crowd-ai

> **Source:** `src/crowd.js` (the pooled NPC crowd — spawn, state machine, steering,
> smile mechanic), focused `src/people/` controllers (puppet parade, brass band,
> children, wooks, hoopers and frisbee pairs). Registered people providers feed the
> collision pass in `registry-collision`; the humanoid geometry is in `models`;
> bubbles/smiles in `feedback-systems`; the song-end cheer signal in
> `audio-synthesis`.

## Purpose

The crowd is a pool of stateful NPCs spawned by chunks, each with a personality and a
small behavior state machine, that react to the player — making eye contact, smiling
and dropping smile pickups, fleeing when plowed into. Separately, a few themed groups
roam the field on placed loops as soft obstacles.

## Requirements

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

Focused population controllers SHALL own the puppet parade, brass band, kid gaggle,
and wooks and SHALL participate through the people-runtime contracts. Loop-based
groups SHALL preserve their existing placed-loop movement and relocation policies;
children SHALL preserve their gaggle, bubble-chasing, scattering, and recycling
behavior. Each controller SHALL publish its existing collision metadata
`{ position, radius, damage, kind }` through an ordered collision source. Geometry
SHALL remain in `src/models/`; controllers SHALL own behavior. The puppet parade
SHALL retain honk-scatter, where puppets ahead of a parked, honking player dodge
laterally while their loop continues marching.

#### Scenario: A parade marches across the field, not just origin

- **WHEN** a roaming loop group spawns or recycles
- **THEN** its loop is placed at a random anchor according to its existing policy
  and its members are exposed as collision candidates

#### Scenario: Honking scatters puppets ahead

- **WHEN** the player honks while parked in front of the puppet parade
- **THEN** the puppets in front dodge laterally for a moment while the parade loop continues

#### Scenario: Children remain behaviorally distinct

- **WHEN** the child controller participates through the common runtime
- **THEN** children retain gaggle movement and bubble chasing without receiving
  adult-only boarding or amenity behavior merely through registration


### Requirement: Ordinary people can play and leave cornhole

Cornhole SHALL borrow two eligible existing adults through the people activity-claim contract. A game SHALL alternate four bags per player, count one point on the board and three in the hole, apply cancellation after eight throws, and finish at 21 or more at the end of a round. Players SHALL walk between ends, visibly collect bags, react to the result, shake hands, tidy bags at one end, and release back to ordinary AI. The game SHALL NOT create a dedicated permanent population or end solely because a short presentation timer expired.

#### Scenario: A full game concludes

- **WHEN** a normal game completes an eight-bag round with a player reaching 21 or more
- **THEN** all bags are gathered, the result reactions and handshake play, the court is tidied, and both people return to ordinary behavior

#### Scenario: Zerble interrupts play

- **WHEN** the cart approaches, a person becomes unavailable, or the court unloads
- **THEN** claims are released without stale pose writes or retained actors
- **AND** on a still-live court held/flying bags settle near their current positions for the next pair to collect

### Requirement: Courts are contextual and have vacant periods

Courts SHALL be admitted only within completed communal camp or vendor-parent reservations, with enough households/booths, dry level grass, road clearance and unoccupied playing/access space. A parent whose full registered court footprint cannot fit SHALL decline. Court selection SHALL use an independent seeded stream. Courts SHALL remain present when idle, use staggered initial availability and post-game rests, respect individual cooldowns, prefer newcomers and cap simultaneous games at two.

#### Scenario: A narrow vendor strip cannot fit a court

- **WHEN** the full conservative court footprint extends outside the vendor reservation
- **THEN** no court is spawned there, even if a narrower visible rectangle would fit

#### Scenario: A court is ready for another pair

- **WHEN** its rest period has elapsed and eligible people are available
- **THEN** a new pair may claim it, with prior participants de-prioritized rather than permanently excluded
