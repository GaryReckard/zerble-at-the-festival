## Scope

- Reviewed: branch changes from `558c9f3` through `2277934` in `index.html`, `sandbox.html`, `src/questHud.js`, `src/settings.js`, `styles.css`, and the quest/start/debug additions in `src/main.js`; inspected the presentation, map, input, and model call sites for integration context.
- Notes: Read-only source review, with this artifact as the only write. No browser, headless session, build, or runtime test was run by this reviewer. Current shared instructions and `.claude/rules/sandbox-and-testing.md` use Vite imports, so the historical dual-importmap inventory requirement does not apply.
- Notes: The model is imported, listed under Particles, instantiated through the same `QuestBubbles` constructor used in the game, animated, and disposed on sandbox switches (`sandbox.html:347`, `sandbox.html:619`, `sandbox.html:874`, `sandbox.html:3190`; `src/quests/presentation.js:19`). It has no collision or spatial-music kind requiring those mappings.
- Notes: Existing debug driving helpers remain intact, and quest helpers are added to `help()` (`src/main.js:2543`, `src/main.js:3138`). The start callback retains synchronous `Sound.init()` (`src/main.js:1073`, `src/main.js:1111`). Real game boot and a trusted mode-plank gesture still require runtime verification; sandbox wiring cannot establish either.

## Findings

- [P2][high] src/questHud.js:15 - Space cannot activate a focused passenger destination button
  - Why: The compass creates native buttons at line 28 but handles only `click`. Their Space keydown reaches the window input listener, which records `SPACE` and prevents the browser default (`src/input.js:29-45`), preventing native button activation while the game consumes it as a honk (`src/main.js:1347-1349`). A keyboard player can focus a destination chip but pressing Space honks instead of selecting its map destination.
  - Fix: Stop propagation of Space keydown when its target is a quest button, preserving the native click default. The existing map buttons already implement this exact ownership boundary (`src/festivalMap/view.js:33`). Verify Space and Enter select the destination without honking, while Space outside the HUD still honks.
  - Duplicate-of: none

## Integration notes

- Passenger-quests Task 11.5 (player-facing ride-log page) is explicitly pending in `openspec/changes/passenger-quests/tasks.md:62`, so its absence is not classified as a defect. The log already exposes totals, per-type/per-kind counts, and twenty recent records through `snapshot()` (`src/quests/questLog.js`). A practical completion is an all-time “Rides” section in Festival Passport, supplied with the existing runtime log instance, preserving the current visit/all-time statistics distinction and avoiding a second independently cached log instance.
- Preserve the root workspace's Lantern Night `createPassportMenu()` rendering and accessibility structure when adding that page (`src/passportMenu.js:15-25` in the root workspace). The root's settings accessibility panel still has a clear insertion point alongside `set-map-visible` (`src/settings.js:150-152` in the root workspace), and its map retains `setObjectives()` and `track()` (`src/festivalMap/view.js:119-120` in the root workspace), so the quest setting and map API need no replacement architecture.
- Merge the quest strip into the existing HUD and retain the root's Lantern Night styles and menu changes. Source inspection does not establish final touch layout or visual compatibility; verify three simultaneous chips, urgent countdown, open non-modal map, menu focus, and landscape phone controls after integration. The branch already records physical-device layout acceptance and Mid/High boots as pending (`openspec/changes/passenger-quests/tasks.md:53-55`).
- The reduced-motion compass styling issue belongs to the rendering review and is intentionally not duplicated here.
