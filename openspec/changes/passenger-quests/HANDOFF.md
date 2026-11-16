# Handoff: passenger quests

**If you are picking this up cold, read this file, then `README.md`, then `tasks.md`.**

## Where it stands

_Last update: 2026-11-15, after the audit-fix commit._

- **Branch: `passenger-quests`** (local only, not pushed). Local `main` equals `origin/main`.
- Built and committed: the engine and tests, the core loop, thought bubbles, compass, map pins, sounds, analytics, the Settings toggle, the urgent porta-potty run with its squirm, the mountaintop request, monk-party shared quests, and the docs.
- Also built after Gary's first read: hailing (people on foot ask and the player stops for them), the ride log, four quest-earned bubble types and mountaintop road guidance (task group 11).
- **Read `adversarial-audit-001.md`.** Its findings 1 to 3 and most of 5 to 8 are fixed (task group 12); finding 4 (economy) is open.
- Open, in order of value:
  -1. Task 12.7: drive up to a hailer on a real GPU. The audit's main finding is fixed only on paper until this is seen.
  0. Tasks 11.5 and 11.6: a ride-log page, and a real-GPU look at hailers from a distance.
  1. Task 10.x: Gary plays it on real hardware and judges rewards.
  2. Task 7.3: see a mountaintop request live.
  3. Task 6.3: watch an urgent success (does the rider reach the potty door?) and a failure (do they flee?) on a real GPU.
  4. Task 9.3: Mid and High boots.
- Nothing is half-applied in the working tree.
- Environment note: this checkout runs Node 22 although the project asks for 24; `npm ci` had to be run once. `npm run check` takes five to ten minutes.

## Rules that apply to this work

- Commit small, verified slices on the `passenger-quests` branch. **Never push and never commit to `main`** without Gary asking.
- Do not touch the iPad performance work under `openspec/changes/ipad-performance-strategy/`; another agent owns it.
- Every game-visible commit carries its CHANGELOG entry under the real date.
- Before each commit: `npm run check`, `npm run build`, then the real game on `/?mute=1` (title card, mode plank click, world boot, console clean).
- Tick boxes in `tasks.md`, then run `bin/readme-sync passenger-quests`.
- `crowd.onBoard(handle, { party })` passes a person handle, never the private record. Any new caller must do the same.

## How to verify quickly

```sh
node bin/test-passenger-quests
npm run dev     # http://127.0.0.1:8765/?mute=1
```

In the browser console after clicking a mode plank: `__dbg.hail()` then `__dbg.hailGo()` to be flagged down and stop for them; `__dbg.giveQuest()` (seats a rider if needed), `__dbg.quests()`, `__dbg.questGo()`, then stop the cart. `__dbg.giveQuest('urgent')` forces the porta-potty run and `'summit'` the mountaintop. For monks: `__dbg.summonNutWagon()`, wait for `__dbg.monks().count`, park Zerble within 14 m of them with bubble juice in the tank, and they board and ask on their own; `__dbg.monkQuest()` forces a request once they ride.

Without a GPU browser, the project's fallback is `bin/verify-headless` (one `--eval`, software WebGL). For multi-step flows the previous agent used a small Playwright script that loads `playwright` from `~/.zerble-verify`, opens `/?mute=1&perf=low&seed=1234`, waits for `#mode-cruisin:not([disabled])`, clicks it, waits for `window.__dbg`, then calls the commands above with waits between them. Festival-goers take up to a minute to appear under software rendering, so retry `giveQuest()` until it stops answering "no free rider". Keep one headless browser alive at a time and close it in `finally`.

## Known gaps and traps

- The plan can describe a place its builder later omitted, so a rider may occasionally be dropped at a spot with little there. Not yet observed; if it shows up, check the registry near the destination at offer time.
- Software WebGL cannot drive the cart at speed (a few metres in thirteen seconds), so anything that depends on approach speed must be checked on a GPU. `__dbg.hailGo()` teleports and therefore proves nothing about the approach.
- After `__dbg.teleport` the chase camera can end up behind a tree. Use `__dbg.camLock(...)` for screenshots.
- `HUD.toast` holds one message, so a quest remark replaces whatever toast was showing.
- Phones are landscape only (portrait shows "Rotate your phone"), so test touch layouts at 844×390, not 390×844.
- Three riders on the back bench give three overlapping bubbles. They step upward by a `stack` offset; it is readable but crowded.
