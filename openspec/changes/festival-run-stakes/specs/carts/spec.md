# carts — delta

## MODIFIED Requirements

### Requirement: Lurleen state machine

`Lurleen.update(dt, zerblePos, zerbleHeading)` SHALL run a state machine:
`wandering` (drift to wander targets) → `aware` (when the player comes within
`AWARE_RANGE`, erupt a burst of pink hearts and pause briefly) → `following` (chase
the player), falling back to `wandering` when the player is far again. She SHALL emit
recurring heart particles, more frequently while aware than while following
(constants `lurleen.js:32-40`, `AWARE_RANGE = 28`; state machine `lurleen.js:691-843`).
Additionally, a **scare-off** trigger SHALL exist: when the run layer reports a
damaging NPC hit while she is `following`, she SHALL exit to `wandering` with a
distinct startled beat (hearts cut, brief dart away) and a re-approach cooldown so
she is not instantly re-acquired. The scare-off is armed only in Festival Run; in
Just Cruisin' the state machine behaves exactly as before.

#### Scenario: Proximity triggers awareness then pursuit

- **WHEN** the player drives within `AWARE_RANGE` of a wandering Lurleen
- **THEN** she bursts hearts, pauses in `aware`, then transitions to `following` and
  drives after the player

#### Scenario: Hitting someone scares her off

- **WHEN** the player damages an NPC while Lurleen is following in a Festival Run
- **THEN** she exits `following` with the startled beat and won't re-follow until the
  cooldown elapses

## ADDED Requirements

### Requirement: Lurleen exposes following state for scoring

Lurleen SHALL expose her current state (or a boolean `isFollowing`) so the scoring
module can apply the ×2 doubler and the HUD can light ♥×2, with transitions observable
the same frame they occur.

#### Scenario: The doubler tracks her state exactly

- **WHEN** Lurleen enters or exits `following`
- **THEN** the scoring doubler and ♥×2 badge flip in the same frame

### Requirement: Lurleen performs the tow rescue

When the run layer invokes the once-per-run rescue, Lurleen SHALL be brought to
Zerble (re-home rules permitting), play a short tow beat toward the nearest juice
source, and hand control back with the rescue consumed. If no juice source is
registry-resident when the rescue fires, she SHALL grant the minimal refill in place
with no tow animation (rescue still consumed). The rescue sequence MUST be
skippable-safe (no soft-lock if interrupted by chunk churn or teleports).

#### Scenario: The tow completes under churn

- **WHEN** a rescue plays while chunks load/unload around the pair
- **THEN** the sequence completes (or safely aborts to normal play) without a soft-lock
