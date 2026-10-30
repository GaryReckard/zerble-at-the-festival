## ADDED Requirements

### Requirement: Reuse ambient beverage identity

The beverage system SHALL extend existing ordinary-crowd appearance and render participation without changing established RNG draws incidentally. Appearance eligibility SHALL remain distinct from current possession.

#### Scenario: An eligible NPC drops a drink

- **WHEN** the cup becomes a free prop
- **THEN** the appearance flag does not recreate another held cup

### Requirement: Exclusive hand and holder transfer

Every cup SHALL have exactly one live representation and at most one hand/holder/support claim. Voluntary transfer SHALL validate destination capacity and person/prop generation; failure SHALL preserve a valid source state. Mandatory support loss SHALL use pre-reserved release capacity and SHALL NOT roll back to an invalid or vanished support.

#### Scenario: Two people request one cup

- **WHEN** two claims compete in the same step
- **THEN** one succeeds and the other leaves all existing ownership intact

#### Scenario: Free-body capacity is unavailable

- **WHEN** a voluntary transfer cannot allocate its required representation
- **THEN** the documented bounded policy preserves one coherent cup state instead of losing or duplicating it

### Requirement: Physical support release

Holder and hand sockets SHALL publish actual world pose and motion. Release SHALL retain support-point velocity. Unsupported chair styles SHALL NOT receive invented holder locations. A cushion-supported cup SHALL block the seat until removed.

#### Scenario: Cooler tips with a cup

- **WHEN** the holder exceeds its configured support threshold
- **THEN** the cup releases once at the current socket pose and follows free motion

### Requirement: Activity compatibility

Drink posing and transfers SHALL respect instrument, camera, hoop, boarding and hidden-body authority. Presentation hiding SHALL NOT imply physical drop, and current possession SHALL determine whether a drink returns when a conflicting pose ends.

#### Scenario: A two-handed activity ends

- **WHEN** an NPC previously dropped its cup before the activity
- **THEN** ending the activity does not restore a phantom held cup

