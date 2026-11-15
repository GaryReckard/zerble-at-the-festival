## 1. Plan and handoff trail
- [x] 1.1 Write README, proposal, design, tasks, deliberation skip, session log, questions and HANDOFF; commit as documentation.

## 2. Pure quest engine
- [x] 2.1 `src/quests/catalog.js`: destination kinds, labels, icon ids, arrive radii, toast banks, constants.
- [x] 2.2 `src/quests/pick.js`: distance band and inverse-distance weighted choice with an injected random source.
- [x] 2.3 `src/quests/engine.js`: offer, update, cancel, events, rewards, stall patience, missed-it, max-active cap.
- [x] 2.4 `bin/test-passenger-quests` covering 2.1 to 2.3; add it to `npm run check`.

## 3. Core loop in the game
- [x] 3.1 `src/quests/worldSource.js`: candidates from the worldgen plan and the registry, with lake rejection.
- [x] 3.2 Crowd passenger API: `riderInfo`, `holdRide`, `endRide`, `onRideEnd` on every exit path.
- [x] 3.3 Wire `main.js`: offer on board, update each tick, arrival celebration and smile burst, give-up exit, cancel on ride end, resume/restart cleanup.
- [x] 3.4 Toasts for offer, hints, near, missed, arrival and give-up, using each kind's line bank.
- [x] 3.5 `__dbg.quests()`, `__dbg.giveQuest(kind)`, `__dbg.questGo()`; document them in DEBUGGING.md and `__dbg.help()`.
- [x] 3.6 Real-game smoke test (title card, mode plank, boot, a completed quest, clean console); CHANGELOG entry; commit.

## 4. Thought bubble
- [x] 4.1 `src/models/questBubble.js`: shared canvas icon textures, pooled sprites, brightness and pulse by proximity.
- [x] 4.2 Sandbox entity `quest_bubbles` (import, option, `loadEntity` case).
- [x] 4.3 Attach bubbles to quest riders in the game; free them on every quest end.
- [x] 4.4 Noon and Midnight captures in the sandbox and the game; Low-tier boot check; commit.

## 5. Navigation aids
- [x] 5.1 `src/questHud.js` compass strip with direction arrow, distance and warm-up colour; CSS in `index.html`.
- [x] 5.2 Compass setting (default on) in `settings.js`.
- [x] 5.3 Festival-map objective pins through `festivalMap.setObjectives`.
- [x] 5.4 Sounds in `sound.js`: accept chirp, proximity hum, arrival flourish (no change to the start-gesture audio chain).
- [x] 5.5 Analytics events through `src/analytics.js`.
- [x] 5.6 Verify in the game on desktop and a phone-sized viewport; commit.

## 6. "Gotta GO!" porta-potty run
- [x] 6.1 Urgent quest type in the engine: countdown, success bonus, failure penalty; tests.
- [ ] 6.2 Squirm pose for the urgent rider. (Potty candidates, the "!!" bubble icon and the compass countdown are done.)
- [ ] 6.3 Watch a full urgent success and a failure in the game (rider reaches the door; rider flees) and tune. The calls are wired; only the visuals are unverified.

## 7. "Take me to the mountaintop"
- [ ] 7.1 Find admitted mountain districts and a legal arrival point from the landscape planner; tests.
- [ ] 7.2 Mountaintop quest kind, icon, lines and reward; verify on a seed with a reachable district; commit.

## 8. Monk party shared destination
- [ ] 8.1 Party quest in the engine: one quest for the group, all-or-none completion; tests.
- [ ] 8.2 Hook `MonkParty` boarding Zerble; hold the party ride until the quest ends; one shared bubble.
- [ ] 8.3 Verify with `__dbg` monk helpers; commit.

## 9. Documentation and close-out
- [ ] 9.1 CHANGELOG entries travel with each commit; trim ROADMAP "Passenger quests" bullets to what remains.
- [ ] 9.2 ARCHITECTURE.md section, DEBUGGING.md commands, a `passenger-quests` capability spec, verification record.
- [ ] 9.3 Final `npm run check`, `npm run build`, Low and Mid game boots, `bin/readme-sync passenger-quests`, HANDOFF update.
