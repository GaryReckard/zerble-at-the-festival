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
- [x] 6.2 Squirm pose for the urgent rider. (Potty candidates, the "!!" bubble icon and the compass countdown are done.)
- [ ] 6.3 Watch a full urgent success and a failure in the game (rider reaches the door; rider flees) and tune. The calls are wired; only the visuals are unverified.

## 7. "Take me to the mountaintop"
- [x] 7.1 Find admitted mountain districts and a legal arrival point from the landscape planner; tests.
- [x] 7.2 Mountaintop quest kind, icon, lines, reward and source, with Node tests.
- [ ] 7.3 See a mountaintop request in the live game. No admitted district was within 900 m on seeds 1234 or 1977; find a seed and start point with one (`map-sandbox.html?landscape=2`, "Find nearby Mountain Top") and run `__dbg.giveQuest('summit')`.

## 8. Monk party shared destination
- [x] 8.1 Party quest in the engine: one quest for the group, all-or-none completion; tests.
- [x] 8.2 Hook `MonkParty` boarding Zerble; hold the party ride until the quest ends; one shared bubble.
- [x] 8.3 Verify with `__dbg` monk helpers; commit.

## 9. Documentation and close-out
- [x] 9.1 CHANGELOG entries travel with each commit; trim ROADMAP "Passenger quests" bullets to what remains.
- [x] 9.2 ARCHITECTURE.md section, DEBUGGING.md commands, a `passenger-quests` capability spec, verification record.
- [x] 9.3 Final `npm run check`, `npm run build`, Low game boot, `bin/readme-sync passenger-quests`, HANDOFF update. (Mid and High boots moved to 10.3.)

## 10. Acceptance on real hardware (Gary)
- [ ] 10.1 Play it on a real GPU and a phone: bubble legibility, compass placement, toast pacing, audio cues.
- [ ] 10.2 Judge reward sizes in Festival Run and against the leaderboard ceiling.
- [ ] 10.3 Boot Mid and High and confirm a clean console.

## 11. Follow-ups from Gary's first read (2026-11-15)
- [x] 11.1 Hailing: people on foot show their request and board when the cart stops for them; walk-up chance cut to 8%.
- [x] 11.2 Ride log persisted in `localStorage`, with a running count in the arrival toast.
- [x] 11.3 Four quest-earned bubble types: Hitchhiker, Relief, Summit, Saffron.
- [x] 11.4 Mountaintop guidance: road-foot waypoint, "Road up" pin, automatic map tracking.
- [ ] 11.5 A player-facing ride-log page (Festival Passport is the natural home).
- [ ] 11.6 Look at a hailer from the chase camera on a real GPU: is the bubble and wave noticeable at 30 to 75 m?

## 12. Adversarial audit 001 and first-time-player read (2026-11-15)
- [x] 12.1 Hailers no longer dodge, flee or scatter; only boardable people may hail.
- [x] 12.2 Quests stop at run end and stay off under the performance lab, autopilot and timed captures.
- [x] 12.3 Chatter is a low-priority toast; hails hold their place in the cap; delivered riders wait 45 s before boarding again; no exit from an airborne or submerged cart.
- [x] 12.4 Trip minimum measured to the edge of the stop; hail refill slowed to 9 s.
- [x] 12.5 Compass: place names, "Slow down!", shortest-turn arrow, in-game reduced motion; summit tracking respects the player's map selection.
- [x] 12.6 "How to play" explains lifts; gentler "wrong way" lines; docs corrected where the audit found them overstated.
- [ ] 12.7 **Drive up to a hailer at cruising speed on a real GPU** and confirm they wait and board. Also honk near one. This is the audit's main finding and has only been fixed by code reading and tests.
- [ ] 12.8 Re-derive the reward table against the leaderboard ceiling now that hailing exists (audit finding 4); measure raw smiles per minute while farming.
- [ ] 12.9 Audit leftovers not done: a ground ring at the drop-off and around a hailer in range, distinct icons for stage/tent and lotus/monk, a guided first ride, and showing the urgent twist under physics driving.
