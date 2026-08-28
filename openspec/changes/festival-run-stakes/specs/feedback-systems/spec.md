# feedback-systems — delta

## MODIFIED Requirements

### Requirement: Refuelable juice resource gates bubbling

Bubbling SHALL drain a "juice" meter at `JUICE_DRAIN_PER_SEC` (≈140s per meter),
~3× faster while the G blast is held; when the meter runs dry the bubbles SHALL stop
(the last fraction sputtering out) and a dry cart SHALL make NPCs frown. The meter
SHALL refuel from drive-over jugs (each adding a full meter, stacking past 1 with no
cap) and the bubble vendor (topping the working meter to 1) (`bubbles.js:13-27`).
These defaults are the **Just Cruisin' contract** and remain the module's baseline.
In **Festival Run**, the mode config MAY overlay: vendor draws priced in smiles
(refused when unaffordable), a deterministic runtime availability filter on scattered
jug pickups, and a reserve-stockpile cap — all applied at the consuming call sites,
never by editing the module's global constants (`JUICE_STACK_MAX` stays `Infinity`).

#### Scenario: Dry tank stops bubbles and frowns NPCs

- **WHEN** the juice meter reaches zero
- **THEN** bubbling stops and nearby NPCs frown rather than smile

#### Scenario: Jugs stockpile without a cap

- **WHEN** the player drives over multiple jugs in Just Cruisin'
- **THEN** each adds a full meter and the stockpile climbs past 1 unbounded

#### Scenario: Festival Run overlays without touching the baseline

- **WHEN** a Festival Run applies vendor pricing and a jug filter
- **THEN** `bubbles.js` constants are unchanged and a Just Cruisin' session in the
  same build behaves per the baseline scenarios

## ADDED Requirements

### Requirement: Smile collection emits a collect event

Smile pickup collection SHALL emit a collect event consumed by the scoring module
(combo/score credit) and the audio layer (pitch-ladder blip), replacing direct
score arithmetic at the collect callback. Burst collections in one frame SHALL be
delivered such that audio can coalesce them (one chord, not N overlapping blips).

#### Scenario: A burst collects as one musical event

- **WHEN** a crowd-wide reaction collects many smiles within a frame
- **THEN** scoring credits each smile and audio plays a single coalesced chord
