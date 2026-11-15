# Handoff: passenger quests

**If you are picking this up cold, read this file, then `README.md`, then `tasks.md`.**

## Where it stands

_Updated after every commit. Last update: 2026-11-15, after the engine commit._

- Done: plan (group 1) and the pure engine with its Node test (group 2). The engine already models ordinary, urgent, summit and party quests, so groups 6 to 8 are wiring and presentation, not new rules.
- Next: group 3, wiring the engine into the game (`worldSource.js`, the crowd passenger API, `main.js`).
- Nothing is half-applied in the working tree.
- Environment note: this checkout runs Node 22 although the project asks for 24; `npm ci` had to be run once. `npm run check` takes about five minutes.

## Rules that apply to this work

- Commit small, verified slices on local `main`. **Never push** (main deploys).
- Do not touch the iPad performance work under `openspec/changes/ipad-performance-strategy/`; another agent owns it.
- Every game-visible commit carries its CHANGELOG entry under the real date.
- Before each commit: `npm run check`, `npm run build`, then the real game on `/?mute=1` (title card, mode plank click, world boot, console clean).
- Tick boxes in `tasks.md`, then run `bin/readme-sync passenger-quests`.

## How to verify quickly

```sh
node bin/test-passenger-quests
npm run dev     # http://127.0.0.1:8765/?mute=1
```

In the browser console: `__dbg.start()`, `__dbg.fillSeats()`, `__dbg.giveQuest()`, `__dbg.quests()`, `__dbg.questGo()`.

## Known gaps and traps

_None yet. Add them here as they are found._
