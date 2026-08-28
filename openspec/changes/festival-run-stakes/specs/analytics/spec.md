# analytics — delta

## ADDED Requirements

### Requirement: Run lifecycle events, name-free

Analytics SHALL emit: `run_start` (mode), `run_end` (cause, high-water score, days,
duration, best combo, rescue-used), `leaderboard_submit` (accepted boolean), and
`name_entered`/`name_length` at title-card start. No event SHALL carry the player's
name or any free-text field. All events follow the existing fail-safe wrapper (never
throw, never block gameplay).

#### Scenario: A run's story is measurable

- **WHEN** a Festival Run ends by ejection on Day 3
- **THEN** `run_end` reports cause `vibed_out`, the day count, and the high-water score

#### Scenario: PII stays out

- **WHEN** any of the new events fire for a named player
- **THEN** no payload field contains the name string
