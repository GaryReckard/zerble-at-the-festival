# Deliberation Briefing: Time Machine archive

## Task

Review the proposed implementation order and constraints for playable historical commits, ephemeral saves and GitHub Pages publishing. Read proposal.md, design.md and tasks.md in this change. No implementation exists yet beyond planning and installing fake-indexeddb 6.2.8.

## Context

- Change: openspec/changes/time-machine.
- Subsystems: development/deployment tooling, historical module preparation and storage bootstrap, timeline UI.
- Live hostname: game.zerble.net; archive hostname: game-archive.zerble.net. One archive repository holds all prepared output.
- Gary explicitly selected no archived progress between plays and no migration of current saves.
- User requested reusing the road timeline UI from /Users/garyreckard/Sites/zerble.net, including its cart if appropriate. That source is read-only.
- Milestones span May raw ES modules/importmaps through current Vite. Current source dependencies: Three.js 0.160.0, Rapier 0.21.0; Vite 8.3.5. Native map storage relies on IndexedDB transactions/epochs.
- Build historical source with trusted current tooling/configuration, never historical scripts. Bootstrap memory storage before all historical scripts; strip analytics and block production score writes. Publish only index.html and reachable public assets, with immutable SHA paths.

## Constraints

Read current AGENTS.md and council charter for authoritative rules. Some OpenSpec context still describes obsolete no-build policy; current Vite policy takes precedence. Preserve historical RNG, renderer/shim and gesture/audio behavior. Do not change source game systems or zerble.net. Real-game boot verification is required. No standalone WebGL automation without bounded lifecycle and cleanup. You are not alone in the codebase; write only your assigned Markdown position and do not revert others' work.

## Output

Load council-protocol skill. Write your position immediately and incrementally to the assigned output path. Cite current source where useful. Give your priority sequence, domain concerns and verdict. Work in isolation without reading other persona files or predicting their positions. Return a short summary.
