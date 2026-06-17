# Capability: feedback-systems

> **Source:** `src/bubbles.js` (the bubble particle system + the juice resource),
> `src/smiles.js` (smile pickups + lost-smile cue), the score readout in
> `src/hud.js`. Smiles are emitted by `crowd-ai`; hearts (Lurleen's) by `carts`; the
> juice refuel props by `models` (`bubbleJug`/`bubbleVendor`). The HUD surfaces are in
> `hud`.

The core verb is "make bubbles, collect smiles." Bubbles are an instanced particle
system gated by a refuelable juice resource; happy NPCs drop smile pickups that home to
the cart and increment the score; when the tank runs dry, smiles are lost instead.

## ADDED Requirements

### Requirement: Instanced bubble particle system

`Bubbles` SHALL render an `InstancedMesh` of transmissive spheres capped at
`PERF.bubblePoolMax` (200 / 350 / 600 by tier), spawned at `SPAWN_PER_SEC` while
bubbling, with simple physics (gravity + buoyancy + a slowly-varying coherent wind),
a ~22s lifetime, and a pop scale-out. Both a "fancy" `MeshPhysicalMaterial`
(transmission/iridescence/sheen) and a "cheap" `MeshStandardMaterial` SHALL be
pre-built so the adaptive-quality swap never triggers a shader compile. Instance
matrix writes SHALL set `instanceMatrix.needsUpdate = true` (`bubbles.js:1-90`,
`adaptiveQuality` bubble hook).

#### Scenario: Cheap-material swap is allocation-free

- **WHEN** adaptive quality drops to cheap bubbles
- **THEN** the material reference swaps to the pre-built cheap material with no
  shader compile or allocation

### Requirement: Refuelable juice resource gates bubbling

Bubbling SHALL drain a "juice" meter at `JUICE_DRAIN_PER_SEC` (≈140s per meter),
~3× faster while the G blast is held; when the meter runs dry the bubbles SHALL stop
(the last fraction sputtering out) and a dry cart SHALL make NPCs frown. The meter
SHALL refuel from drive-over jugs (each adding a full meter, stacking past 1 with no
cap) and the bubble vendor (topping the working meter to 1) (`bubbles.js:13-27`).

#### Scenario: Dry tank stops bubbles and frowns NPCs

- **WHEN** the juice meter reaches zero
- **THEN** bubbling stops and nearby NPCs frown rather than smile

#### Scenario: Jugs stockpile without a cap

- **WHEN** the player drives over multiple jugs
- **THEN** each adds a full meter and the stockpile climbs past 1 unbounded

### Requirement: Smile pickups home and collect

A smile emitted at an NPC's position SHALL pop upward briefly, then home toward the
cart at a ramping speed (so distant smiles still arrive), bobbing and spinning, and
SHALL be collected within `PICKUP_RADIUS` (2.4m) — calling back `onCollect(1)` to
increment the score — or despawn after its `LIFETIME` (14s) (`smiles.js:5-10,85-145`).

#### Scenario: A smile flies to the cart and scores

- **WHEN** a smile is within 2.4m of the cart
- **THEN** it is collected and the score increments by one

### Requirement: Lost-smile is a visible-only cue

When the tank is dry and an NPC frowns, `spawnLost(fromPos, npc)` SHALL fly a reddish
smile from the cart out to the (live-tracked, walking-away) NPC and fade it — purely a
visual cue. It SHALL NOT be collectible and SHALL NOT change the score itself (the
deduction happens in the crowd's frown handler) (`smiles.js:36-108`).

#### Scenario: A lost smile drifts away and never returns

- **WHEN** a lost smile is spawned
- **THEN** it homes to the grumpy NPC and fades, with no collection and no score change
  from the particle itself
