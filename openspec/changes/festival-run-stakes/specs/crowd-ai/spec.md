# crowd-ai — delta

## MODIFIED Requirements

### Requirement: Hit response panics and infects

`onZerbleHit(npc, nx, nz)` SHALL panic the struck NPC into `fleeing`, apply knockback,
and infect nearby NPCs (within 6m) into a brief fleeing state, so a high-speed plow
scatters the crowd (`crowd.js:2014-2035`, dispatched from `main.js:1262` inside
`resolveCollision`). In **Festival Run**, a damaging NPC hit SHALL additionally
surface a hit notification consumed by the run layer (vibe strike, combo break,
Lurleen scare) and SHALL flip the struck NPC's mouth to a frown for the frown
duration — but ONLY for damaging hits (`hit.damaging`, dispatched from `main.js`,
never from the raw `onZerbleHit` which also fires for damage-0 grazes of fleeing
NPCs) and never in god mode. In Just Cruisin' the pre-change behavior is unchanged.

#### Scenario: A plow scatters the crowd

- **WHEN** the player damages an NPC at speed
- **THEN** that NPC flees and nearby NPCs are infected into fleeing too

#### Scenario: Festival Run hits carry consequences

- **WHEN** the player damages an NPC at speed during a Festival Run
- **THEN** the run layer receives the hit event and the struck NPC frowns while fleeing

## ADDED Requirements

### Requirement: Frown threshold scales with the day ramp

The dry-cart displeasure threshold (`FROWN_THRESHOLD`) SHALL be scalable via a
runtime multiplier set by the run layer (day ramp), defaulting to 1.0 (today's
behavior) in Just Cruisin' and on Day 1.

#### Scenario: Late-day crowds frown faster

- **WHEN** the run layer applies a Day 4 frown multiplier
- **THEN** dry-cart displeasure crosses into frowns proportionally sooner

### Requirement: Sputter demotes frowns to flavor

While the run layer reports the sputter state active, frowns SHALL still animate
(mouth flip, turn away) but `onFrown` score deductions SHALL be suppressed — a
sputtering player is not additionally taxed.

#### Scenario: No pile-on during sputter

- **WHEN** NPCs frown at a sputtering, dry Zerble
- **THEN** the frown animation plays but no smiles are deducted
