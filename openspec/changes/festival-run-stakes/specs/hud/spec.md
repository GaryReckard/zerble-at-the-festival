# hud — delta

## ADDED Requirements

### Requirement: Title card gains name entry and mode select

The title card SHALL host the name input (player-identity) and the two-mode selector
(game-modes) without disturbing the existing calibrated copy/tone, the start button's
synchronous audio-init path, or the resume flow. Both new controls SHALL be keyboard-
and touch-usable and carry aria labels.

#### Scenario: Title card additions don't break boot

- **WHEN** the game boots on desktop and mobile with the new controls present
- **THEN** the title card renders, start works, and audio unlocks as before

### Requirement: In-run Festival HUD additions

During a Festival Run the HUD SHALL additionally show: the combo badge (multiplier +
draining chain ring + ♥×2 when Lurleen follows), the day counter (extending the
existing cycle dial), the sputter grace countdown when active, a **persistent ambient
vibe meter** (always visible, parity with the juice gauge — threshold toasts alone
are not sufficient feedback for a death path), and vibe warnings at the
marshal-ladder steps. None of these render in Just Cruisin'.

#### Scenario: The vibe meter is visible before trouble

- **WHEN** a Festival Run is in progress with zero vibe strikes
- **THEN** the vibe meter is on screen in its calm state, so the player always knows
  the second death path exists and where it stands

#### Scenario: Combo badge tracks the chain

- **WHEN** the player chains smiles, then gets hit
- **THEN** the badge climbs with the chain and visibly resets on the hit

### Requirement: Score screen with leaderboard views

Run end SHALL present a score screen overlay: cause of death, high-water score, days
survived, best combo, and tabs for the local board and (when available) the global
daily/all-time boards, plus "run again" and "back to title" actions. Global-board
fetch failure degrades to the local tab silently.

#### Scenario: Score screen is complete offline

- **WHEN** a run ends with no network available
- **THEN** the score screen still shows cause, score, days, and the local board
