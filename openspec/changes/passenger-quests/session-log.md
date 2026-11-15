---
change: passenger-quests
status: in_progress
current_task: "4.1"
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

## Assumptions

| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | `festivalPlan` and `campVillagesNear` are cheap enough to call once per boarding | Medium | Verified | 0.4 ms in the running game (plans are already warm from streaming and the horizon). A fully cold Node process took 0.4 to 1.3 s for a 900 m reach, so do not widen the reach without re-measuring. |
| A2 | The landscape planner exposes admitted mountain districts with a reachable point | Low | Open | Investigate in task 7.1 |
| A3 | `cheerTimer` reads as a thumbs-up on a just-disembarked rider | Medium | Open | Look at it in task 3.6 |

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
