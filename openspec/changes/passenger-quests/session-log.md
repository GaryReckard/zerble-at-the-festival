---
change: passenger-quests
status: in_progress
current_task: "10.1"
blocked_by: null
open_questions: 3
started: 2026-11-15
last_updated: 2026-11-15
ref: ROADMAP "Gameplay verbs" passenger quests bullet; .claude/passenger-quests-design.md
---

# Session Log: Passenger quests

> **AGENT DIRECTIVE:** Event-driven "why" trail. Read `HANDOFF.md` and `README.md` first, then this file's frontmatter, Key Decisions and latest Work Log entry, then `tasks.md`.

## Key Decisions

- **D1 (2026-11-15, Gary):** Build the full stack including the three variants, count rewards in both modes, light OpenSpec with a skipped council, small commits on local `main`, never push.
- **D2:** Destinations come from the worldgen plan first and the registry second, because the registry only holds streamed chunks and a 300 m destination is often not loaded.
- **D3:** The design doc's fixed 90 s timeout became a stall timer (75 s without getting 5 m closer). The same doc also says "player just chills with passenger: allowed", and a stall timer satisfies both.
- **D4:** Rewards are spawned smile pickups. They reach `Scoring.collect` through the existing path, so combo, Lurleen and `rawSmiles` behave as for organic smiles and `Scoring.award` is not called a second time.
- **D5:** Quest randomness uses `Math.random`. No seeded stream is read or advanced.
- **D6:** At most three active quests, independent of the eight seats.
- **D7 (2026-11-15, Gary):** The work moved off `main` onto the `passenger-quests` branch mid-session; local `main` was reset to `origin/main`. Supersedes the branch part of D1. Still no pushes.
- **D8:** A monk party asks for an ordinary destination (so the bubble and compass show a real place) but speaks through the `monk_party` line bank via the engine's `voice` option, and its toasts are narration without quotes.
- **D10 (2026-11-15, Gary):** Requests should be visible on people walking around so the player can choose a fare; they must be easy to find without saturating the grounds. Hence two hailers at most, a five-second refill, and an 8% walk-up chance. This replaces the 30% roll and the first-boarder guarantee in D-less design notes and Q1.
- **D11:** Quest-earned bubbles use existing tint animations and no inner motif, so the special-bubble shader is untouched during the performance freeze.
- **D9:** The mountaintop drop-off is the point on the district's `mainRoad` nearest its `commons`, read with `access.query(bounds, { request: false })` so a quest never triggers planner work.

## Assumptions

| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | `festivalPlan` and `campVillagesNear` are cheap enough to call once per boarding | Medium | Verified | 0.4 ms in the running game (plans are already warm from streaming and the horizon). A fully cold Node process took 0.4 to 1.3 s for a 900 m reach, so do not widen the reach without re-measuring. |
| A2 | The landscape planner exposes admitted mountain districts with a reachable point | Low | Verified in code, not live | `LandscapeRuntime.access.query` returns `{candidate, state}`; `state.status === 'ready'` carries `state.plan` with `mainRoad` and `commons`. Not yet seen in the game (task 7.3). |
| A3 | `cheerTimer` reads as a thumbs-up on a just-disembarked rider | Medium | Open | The call is made; the pose was never caught in a screenshot. Needs a real-GPU look (task 10.1). |

## Dangling Threads

- The stage-spacing bug in ROADMAP "Bugs" was diagnosed in this session before the switch to quests. The finding is recorded in that ROADMAP bullet; no fix was made.

## Work Log

### 2026-11-15 -- Change opened
**Event:** phase-change
**What:** Gary asked for a substantial non-performance roadmap item with under a day of usage left, then chose the full passenger-quest stack. The survey found the boarding hook, the reserved scoring door and the map's objective pins already in place, and found three facts the older design doc has wrong (seat count, registry coverage, monk boarding already exists).
**Refs:** -> D1, -> D2, design.md "Departures"

### 2026-11-15 -- Core loop verified in the real game
**Event:** discovery
**What:** Through the real title card and a mode-plank click on Low, a forced request was offered, `questGo` reached the stop, the rider left and 15 smiles reached the HUD with no console errors. Two things differ from the plan. First, a `QuestRuntime` glue class (`src/quests/runtime.js`) was added so `main.js` only constructs it and calls `onBoard`/`update`; presentation layers subscribe to it. Second, the crowd needed no exit hooks: the runtime polls `crowd.riderInfo` for at most three riders per frame, which catches every way a rider can leave. The urgent run's rules and its potty targeting landed with the core loop because the engine already modelled them; only its squirm pose, "!!!" bubble and countdown display remain in group 6. This session has no GPU browser, so game checks use a Playwright driver on software WebGL (see HANDOFF).
**Refs:** -> Task 3.6, -> Task 6.1, -> A1

### 2026-11-15 -- Presentation verified; phone layout corrected
**Event:** discovery
**What:** Bubbles, compass chips and the minimap flag were checked in the real game at Noon and Midnight on Low (software WebGL). Two layout facts were not in the plan: phones play landscape only, and on touch layouts the right edge holds SLOW/CAM/BOOST/HONK, so the strip moves to the left column under the status rail for `(pointer: coarse)`. Presentation lives in `src/quests/presentation.js`, which subscribes to the runtime; the pure bearing and formatting rules are in `src/quests/compassMath.js` and are covered by the Node test. Zerble's forward is (-sin h, -cos h), so a larger heading turns the cart to screen left and the arrow angle is negated.
**Refs:** -> Tasks 4.x, 5.x

### 2026-11-15 -- Variants built; a boarding-contract bug found and fixed
**Event:** discovery
**What:** Changing `crowd.onBoard` to pass a handle broke one caller: `groupParticipation.completeBoarding` still passed the private record for each monk, so every monk was offered a solo quest that was cancelled a frame later, and those phantom offers could fill the three-quest cap and block the party's real request. Group boarding now calls `onBoard(handle, { party: true })` and `main.js` skips solo offers for party members. After the fix, seed 1977 showed five monks board, share one request, arrive and leave together for 15 smiles. The urgent squirm and the mountaintop request could not be confirmed visually in this environment (software rendering; no admitted district in range).
**Refs:** -> D8, -> D9, -> Tasks 7.3, 6.3, 10.x

### 2026-11-15 -- Hailing, ride log, bubbles and mountaintop guidance
**Event:** decision
**What:** Built after Gary's first read. On seed 1234 (Low, software WebGL, clean console) a person hailed within seconds, boarded when the cart stopped beside them with the request their bubble showed, and was delivered; a forced urgent run then unlocked Relief Bubbles and the log read two rides after being stored. The hailer's bubble was not caught in a chase-camera screenshot, so its legibility at distance is unverified (task 11.6). The mountaintop waypoint is covered only by the Node test.
**Refs:** -> D10, -> D11, -> Tasks 11.x

## Integration review, 2026-11-15

Gary authorized review, improvements and integration into main after cornhole, followed by a docs sweep. Six specialists reviewed 558c9f3...2277934. The combined implementation preserves the Lantern Night menus, driving map overlay, cornhole ownership and capture instrumentation. Review fixes gate arrival rewards on safe disembarkation, exclude activity-owned hailers, honor reduced motion and preserve Space button activation. The Passport Ride log is implemented and desktop-verified; the review and evidence are linked from the verification record. The original branch-only/no-push history is retained above as history; local main integration is now authorized, while no remote push was requested. Physical phone/audio, subjective balance, full urgent walk-to-door/flee animation and live summit acceptance remain open.

## Follow-up review and facility semantics, November 15

Gary pushed `979ffdc` and `dd1516c` and requested a thorough review. The exact delta from `2277934` was audited separately from current main. Confirmed findings covered the airborne guard interacting with unchecked arrival, shutdown monk holds, the cooldown bypass, stale hidden-map selections and documentation inaccuracies. The combined follow-up preserves main’s existing transactional arrival, ownership, keyboard and reduced-motion repairs while fixing the new interactions.

Gary then reported a hammock non-drop-off at seed 4077605147, (207.3,-24.32), and explained that he expected any hammock or porta-potty to count. The location-only note cannot recover the original rider target or speed. A reconstruction found registered posted hammocks over 50 m away and a decorative tree hammock about 30 m away that the old system did not register. Terrain at the note is walkable with roughly 12% grade; movement below 2 m/s already passes the speed gate. The implementation now distinguishes generic hammock/potty requests from specific destinations, registers decorative hammock drop-offs without layout side effects, and explains the distinction visibly.

A native Low game test on the reported seed completed a request whose suggestion was (248.83,78.35) by stopping beside a different tree hammock around (189.31,-0.78), with a reduced 6-smile reward rather than the suggestion’s 8. An urgent built-potty delivery also completed. A second native game used the approach helper only to start 35 m away, then actual forward/brake/honk input brought the hailer aboard; it did not teleport into boarding range. Focused regressions, combined check/build and compact control-bound checks passed. Physical phone, audible cues, full-speed legibility, live summit and reward-rate acceptance remain separate.
