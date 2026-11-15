# Handoff: passenger quests

**If you are picking this up cold, read this file, then `README.md`, then `tasks.md`.**

## Where it stands

_Updated after every commit. Last update: 2026-11-15, after the core-loop commit._

- Done: plan (group 1), pure engine and test (group 2), the playable core loop (group 3), and the urgent run's rules (task 6.1).
- Works in the game today: offers on boarding, toasts, arrival with a cheer and a smile burst, missed stops, give-up, the timed porta-potty run, and the debug commands.
- Not built yet: the thought bubble (group 4), compass, map pins, sounds, analytics and the setting (group 5), the urgent run's squirm and countdown display (6.2, 6.3), mountaintop (group 7), monk parties (group 8), close-out docs (group 9).
- Next: group 4. Subscribe to `quests.subscribe((type, quest, data) => …)` in `main.js`; do not put presentation into `runtime.js`.
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

In the browser console after clicking a mode plank: `__dbg.giveQuest()` (seats a rider if needed), `__dbg.quests()`, `__dbg.questGo()`, then stop the cart. `__dbg.giveQuest('urgent')` forces the porta-potty run.

Without a GPU browser, the project's fallback is `bin/verify-headless` (one `--eval`, software WebGL). For multi-step flows the previous agent used a small Playwright script that loads `playwright` from `~/.zerble-verify`, opens `/?mute=1&perf=low&seed=1234`, waits for `#mode-cruisin:not([disabled])`, clicks it, waits for `window.__dbg`, then calls the commands above with waits between them. Festival-goers take up to a minute to appear under software rendering, so retry `giveQuest()` until it stops answering "no free rider". Keep one headless browser alive at a time and close it in `finally`.

## Known gaps and traps

- The plan can describe a place its builder later omitted, so a rider may occasionally be dropped at a spot with little there. Not yet observed; if it shows up, check the registry near the destination at offer time.
- After `__dbg.teleport` the chase camera can end up behind a tree. Use `__dbg.camLock(...)` for screenshots.
- `HUD.toast` holds one message, so a quest remark replaces whatever toast was showing.
