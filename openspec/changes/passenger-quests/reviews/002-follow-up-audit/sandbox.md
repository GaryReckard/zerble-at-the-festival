## Scope

- Reviewed: `2277934..dd1516c`, using `.claude/worktrees/passenger-quests-audit-2`, specifically `src/hud.js`, `src/questHud.js`, `src/quests/compassMath.js`, `src/quests/presentation.js`, `index.html`, `styles.css`, and changed UI/lifecycle wiring in `src/main.js`. Related map/input/runtime source was read only to establish contracts.
- Notes: Source citations below are relative to that worktree at `dd1516c`. No application edits or Git mutations were made. Browser checks belong to the parent review; this report does not establish real-game boot, touch-device layout, or visual acceptance.
- The scoped diff adds no modules or models. The repository already uses Vite and has no HTML module inventory, as documented in `AGENTS.md:92`; no importmap or new-model selector maintenance is required for this delta.

## Findings

- [P2][high] src/quests/presentation.js:94 - A stale completed quest selection suppresses the next summit's automatic tracking
  - Trigger: Track a quest, hide the compact map, complete that quest, then receive a summit request while the map remains hidden. The preference can also be hidden before selecting a destination with a compass chip.
  - Why: `setObjectives()` replaces objective markers without clearing `selected` (`src/festivalMap/view.js:112`). Hidden maps return before marker reconciliation (`src/festivalMap/view.js:141`), so the removed quest ID remains selected until the map is visible again (`src/festivalMap/view.js:152`). The new null-only guard treats that stale ID as a valid existing choice and unconditionally discards `_track`. Reopening the map clears the old ID, but the summit auto-track request is already gone. The player can still select the summit manually through its compass chip.
  - Fix: Reconcile removed objective selections when objectives change, or distinguish a still-valid selection before consuming the summit's pending auto-track request. Preserve valid user-selected destinations.
  - Repro/evidence: Executed the actual `QuestPresentation.update` and complete `FestivalMap` class methods (`setObjectives`, `track` and `tick`) from the audited source in Node with drawing/storage boundaries stubbed, `selected='quest:1'`, active summit `quest:2`, and pending `_track='quest:2'`. After update, the objective list contained only `quest:2`, `selected` remained `quest:1`, and `_track` became null. The hidden-map persistence and later removal are established by the cited real map source; no browser reproduction is claimed.
  - Duplicate-of: none.

## Verified behavior and integration notes

- Actual `QuestCompass` code ran against a minimal DOM double through 4,000 successive bearings. The largest arrow update was 6 degrees, including repeated angle wraps; accessible destination labeling and chip removal also passed (`src/questHud.js:52`, `src/questHud.js:64`, `src/questHud.js:69`). This proves the arithmetic/state behavior, not browser transition rendering.
- The actual `HUD.toast` method ran with controlled time and timers. Low-priority chatter could not replace an unexpired ordinary toast, could replace it at expiry, and was itself immediately replaced by an ordinary toast; each replacement left exactly one timer (`src/hud.js:579`).
- Slow-down copy uses the shared arrival threshold and absolute cart speed (`src/quests/compassMath.js:30`), with live speed forwarded by `src/quests/presentation.js:83`; the engine uses the matching strict below-threshold arrival test (`src/quests/engine.js:119`).
- Destination names are visible in desktop chips and intentionally hidden for coarse pointers (`src/questHud.js:35`, `styles.css:494`); accessible labels retain the name (`src/questHud.js:65`). Real touch-layout acceptance remains with the parent.
- The OS and in-game reduced-motion selectors both disable compass rotation transitions and urgent pulsing (`styles.css:497`, `styles.css:502`). The scoped source still lacks the Space propagation guard on quest buttons, so its global input listener prevents native Space activation (`src/input.js:45`). That defect predates this diff, and current main already supplies the guard in `src/questHud.js:14`; preserve it during integration rather than file it as an introduced defect.
- Capture suppression is wired after runtime/presentation construction and before the frame loop (`src/main.js:928`); both Festival Run and vehicle end paths call `quests.stop()` (`src/main.js:2072`, `src/main.js:2110`). These are game-only paths, so ordinary and capture-mode game boots are required in the parent verification. A model sandbox cannot establish them.
- No changed model internals required an additional rendering-specialist handoff. This review makes no new scene-rendering or performance claims.

Reproduction is persisted as `ui-probes.mjs`, including the real hidden-map tick and reopening tick. These establish the selection failure without a browser claim.
