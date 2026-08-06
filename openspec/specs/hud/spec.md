# Capability: hud

> **Source:** `src/hud.js` (DOM bindings), `styles.css`, the HUD scaffolding in
> `index.html`. Score values come from `feedback-systems`; the title-card start
> gesture boots the game + audio (`render-pipeline`, `audio-synthesis`); the star
> vignette is driven by `special-modes`.

The HUD is vanilla DOM, no framework. Its compact status rail binds score/best, a
juice gauge, the day/night cycle, and Lurleen's following state; the remaining DOM
surfaces are a toast strip, hit flash, star-power vignette, and title card.

## ADDED Requirements

### Requirement: Score with persisted best

`HUD.setSmiles(n)` SHALL display the floored current score; `loadBest`/`saveBest`
SHALL read/write the personal best to `localStorage` under `zerble-best-smiles`,
updating the displayed best only when beaten. The current score SHALL remain the
primary rail value while the best is visually subordinate (`hud.js:33,64-68,159-174`).

#### Scenario: A new record persists

- **WHEN** the player's score exceeds the stored best and `saveBest` is called
- **THEN** the new best is written to localStorage and shown

### Requirement: Bubble-juice gauge

`HUD.setJuice(total)` SHALL show the working meter as a bar (`min(1, total)`) plus the
spare whole meters as an uncapped "N× jug" reserve count, switch to an amber `low`
state below 0.45 (with no reserve) and a red `empty` state at ~0, and guard against
redundant DOM writes since it's called every frame (`hud.js:70-114`).

#### Scenario: Low juice turns the gauge amber

- **WHEN** the working meter drops below 0.45 with no reserve
- **THEN** the gauge shows the `low` (amber) state

### Requirement: Day/night position dial

`HUD.setTimeOfDay(t, nightness)` SHALL map the normalized world clock to a circular
day/night dial, move its perimeter marker around the full cycle, switch its center
between sun and moon using `nightness`, and expose a human-readable phase label. The
main loop SHALL feed it the same `TimeOfDay.t` and `nightness` used by the world
(`hud.js:116-149`; `main.js:758-761`).

#### Scenario: Dusk updates the dial

- **WHEN** the world clock is forced to `t = 0.5`
- **THEN** the marker sits halfway around the dial and the accessible phase reads Dusk

### Requirement: Lurleen following indicator

`HUD.setLurleenFollowing(visible)` SHALL show a pink heart chip while Lurleen is
`aware` or `following` and remove it from the rail after she returns to `wandering`.
The appearance animation SHALL be disabled under reduced motion (`hud.js:151-157`;
`main.js:895-896`; `styles.css`).

#### Scenario: Losing Lurleen clears the heart

- **WHEN** a following Lurleen exceeds her forget range and returns to `wandering`
- **THEN** the pink heart is removed from the status rail

### Requirement: Toast strip, optionally tappable

`HUD.toast(msg, ms, { onTap })` SHALL show a fading status message cleared after `ms`
or replaced by the next toast; when `onTap` is provided the toast SHALL become a
single-shot button (handling `touchend` before the synthesized click, firing once)
(`hud.js:177-204`).

#### Scenario: A tappable toast fires once

- **WHEN** a toast with `onTap` is tapped
- **THEN** the callback fires exactly once and the toast's tap listener is cleared

### Requirement: Hit flash and star vignette

`HUD.flashHit()` SHALL pulse a red damage vignette (~180ms); `HUD.setStarPower(on)`
SHALL toggle a warm-gold edge vignette via pure CSS (zero three.js cost) while star
power is active (`hud.js:206-215`).

#### Scenario: Taking damage flashes red

- **WHEN** the cart takes a damaging hit
- **THEN** a red vignette pulses briefly

### Requirement: Title card gates the start gesture

`HUD.showTitle`/`hideTitle` SHALL toggle the full-screen title overlay. The static
HTML SHALL render Start and Settings disabled before the module graph loads, while an
inline bubble-pressure status remains visibly active. `HUD.onStart(cb)` SHALL install
the single-shot callback first, complete the loading status, restore the configured
Start or Resume label, and only then enable both controls. After a brief readable ready
state, the completed loading status SHALL fade and collapse so it no longer occupies
title-card space. The enabled Start click is the trusted user gesture that boots the
world and synchronously initializes audio (`index.html`, `hud.js`, and the iOS
audio-init contract in `audio-synthesis`).

#### Scenario: Controls remain honest while JavaScript loads

- **WHEN** the static title card is visible but `main.js` has not completed initialization
- **THEN** the bubble-pressure loader remains active and Start and Settings cannot be clicked

#### Scenario: Completed loading status clears the title card

- **WHEN** initialization completes and the ready message has been shown briefly
- **THEN** the loader fades and collapses while Start and Settings remain enabled
- **AND** reduced-motion preference removes the transition without delaying the final state

#### Scenario: Start boots the game once

- **WHEN** the player clicks the start button
- **THEN** the callback fires a single time and the title card hides
