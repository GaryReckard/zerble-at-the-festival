# Capability: hud

> **Source:** `src/hud.js` (DOM bindings), `styles.css`, the HUD scaffolding in
> `index.html`. Score values come from `feedback-systems`; the title-card start
> gesture boots the game + audio (`render-pipeline`, `audio-synthesis`); the star
> vignette is driven by `special-modes`.

The HUD is vanilla DOM, no framework. It binds score/best, a juice gauge, a toast
strip, a hit flash, the star-power vignette, and the title card.

## ADDED Requirements

### Requirement: Score with persisted best

`HUD.setSmiles(n)` SHALL display the floored current score; `loadBest`/`saveBest`
SHALL read/write the personal best to `localStorage` under `zerble-best-smiles`,
updating the displayed best only when beaten (`hud.js:21,45-95`).

#### Scenario: A new record persists

- **WHEN** the player's score exceeds the stored best and `saveBest` is called
- **THEN** the new best is written to localStorage and shown

### Requirement: Bubble-juice gauge

`HUD.setJuice(total)` SHALL show the working meter as a bar (`min(1, total)`) plus the
spare whole meters as an uncapped "N× jug" reserve count, switch to an amber `low`
state below 0.45 (with no reserve) and a red `empty` state at ~0, and guard against
redundant DOM writes since it's called every frame (`hud.js:49-81`).

#### Scenario: Low juice turns the gauge amber

- **WHEN** the working meter drops below 0.45 with no reserve
- **THEN** the gauge shows the `low` (amber) state

### Requirement: Toast strip, optionally tappable

`HUD.toast(msg, ms, { onTap })` SHALL show a fading status message cleared after `ms`
or replaced by the next toast; when `onTap` is provided the toast SHALL become a
single-shot button (handling `touchend` before the synthesized click, firing once)
(`hud.js:97-124`).

#### Scenario: A tappable toast fires once

- **WHEN** a toast with `onTap` is tapped
- **THEN** the callback fires exactly once and the toast's tap listener is cleared

### Requirement: Hit flash and star vignette

`HUD.flashHit()` SHALL pulse a red damage vignette (~180ms); `HUD.setStarPower(on)`
SHALL toggle a warm-gold edge vignette via pure CSS (zero three.js cost) while star
power is active (`hud.js:126-135`).

#### Scenario: Taking damage flashes red

- **WHEN** the cart takes a damaging hit
- **THEN** a red vignette pulses briefly

### Requirement: Title card gates the start gesture

`HUD.showTitle`/`hideTitle` SHALL toggle the full-screen title overlay, and
`HUD.onStart(cb)` SHALL fire the callback once on the green start button click — the
trusted user gesture that boots the world and (synchronously) initializes audio
(`hud.js:33-43`, the iOS audio-init contract in `audio-synthesis`).

#### Scenario: Start boots the game once

- **WHEN** the player clicks the start button
- **THEN** the callback fires a single time and the title card hides
