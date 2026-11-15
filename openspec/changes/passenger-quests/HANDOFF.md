# Handoff: passenger quests

**If you are picking this up cold, read this file, then `README.md`, then `tasks.md`.**

## Where it stands

_Updated after every commit. Last update: 2026-11-15, after the presentation commit._

- Done: plan (1), engine and test (2), playable core loop (3), thought bubbles and their sandbox view (4), compass strip, setting, map pins, sounds and analytics (5), and the urgent run's rules, icon and countdown (6.1 and most of 6.2).
- Not built yet: the urgent rider's squirm pose and a watched success/failure (6.2, 6.3), mountaintop (7), monk parties (8), close-out docs (9).
- Next: group 7 or 8. Both only need a destination source and a call into `QuestRuntime`; the engine already has `summit` and `party` quest types with rewards and tests.
  - Mountaintop: pass an `extraDestinations(origin)` function to `QuestRuntime` in `main.js` that returns `{ kind: 'mountaintop', x, z, radius }` candidates. `__dbg.giveQuest('summit')` forces one.
  - Monks: call `quests.offerParty(key, dest, memberCount)` when a `MonkParty` finishes boarding Zerble, keep the party aboard until the quest ends, and call `quests.cancel(key)` if the party leaves. `QuestPresentation` already floats one shared bubble over the cart for a `party` quest.
- Nothing is half-applied in the working tree.
- Environment note: this checkout runs Node 22 although the project asks for 24; `npm ci` had to be run once. `npm run check` takes five to ten minutes.

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
- Phones are landscape only (portrait shows "Rotate your phone"), so test touch layouts at 844×390, not 390×844.
- Three riders on the back bench give three overlapping bubbles. They step upward by a `stack` offset; it is readable but crowded.
