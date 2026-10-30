## MODIFIED Requirements

### Requirement: Approach-speed collision model

Every candidate SHALL have exactly one contact-response authority. Legacy candidates SHALL retain the existing 2D overlap and approach-speed rule: compute the dot of cart velocity with contact direction; above APPROACH_DAMAGE_THRESHOLD (1.2 m/s), call the existing cart hit response and eligible person reaction, returning whether damage is positive; at or below the threshold, resolve overlap and bleed small approach speed silently. Opted-in physical props and people SHALL instead use the physical contact adapter and SHALL NOT also receive the legacy projection, hit impulse or duplicate penalty. Physics stepping SHALL be independent of penalty eligibility, while ghost filtering and protected people policies remain explicit.

#### Scenario: Fast legacy plow damages

- **WHEN** the cart drives into a legacy collider above 1.2 m/s approach speed
- **THEN** the existing knockback, person response and positive-damage policy apply once

#### Scenario: Slow legacy brush resolves silently

- **WHEN** the cart overlaps a legacy collider at or below the threshold
- **THEN** overlap is resolved without a score change

#### Scenario: Physical chair contact has one response

- **WHEN** a physical chair contacts the cart
- **THEN** the physical adapter owns its response and the legacy resolver does not also reverse/project the cart for that candidate

## ADDED Requirements

### Requirement: Bounded incident attribution

Physical secondary contacts SHALL carry bounded causal provenance with per-target penalty deduplication, expiry and separation rules. A single settling contact SHALL NOT repeatedly penalize its victim, while a new eligible victim SHALL NOT be made free merely because another victim was already hit. Numeric scoring SHALL preserve the baseline until an explicit tuning decision is recorded.

#### Scenario: Chair strikes a person

- **WHEN** a recently cart-struck chair hits an eligible person
- **THEN** the incident identifies the original instigator and applies that person's eligible consequence at most once for the incident

#### Scenario: Old debris loses attribution

- **WHEN** an incident exceeds its configured lifetime or propagation bound
- **THEN** later contacts do not inherit an eternal player-blame tag
