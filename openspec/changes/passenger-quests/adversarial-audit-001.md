# Adversarial audit 001: passenger-quests

- **Date:** 2026-11-15
- **Scope:** `git diff main..passenger-quests` at `2277934` (five commits plus the hailing, ride-log, quest-bubble and road-guidance commit). The audit began while that last slice was staged; the content is identical.
- **Method:** read-only code tracing against the change folder, `openspec/specs/passenger-quests/spec.md`, `openspec/council/charter.md` and `AGENTS.md`. `node bin/test-passenger-quests` was run and passed. Nothing was run in a browser, and `npm run check` / `npm run build` were not run by this audit.
- **Verdict:** Proceed with mitigations. Do not merge to `main` until findings 1 and 2 are dealt with.

## TL;DR

The pure quest engine is sound and the lifecycle fears the builder listed mostly did not materialise: handles are generation-checked, NPC records are fresh objects, the monk path is re-entrancy safe, and no seeded stream is touched. The weakness sits one layer out, in the hailing slice, which was verified only by teleporting the cart beside a hailer. Driving at a hailer the way a player would makes that person dodge and cancels the hail. Separately, the feature runs unconditionally, so it would add unseeded work and behaviour to the fixed-route iPad session the performance freeze exists to protect. The documents also overstate what was verified, and the spec contradicts itself in three places.

Classification used below: **Confirmed defect** means the failing path was traced in code. **Plausible risk** means the mechanism is cited but its frequency or cost was not measured. **Claims mismatch** means a document says something the code or the verification record does not support.

## Charter note

`openspec/council/charter.md` is present but stale on one Non-Negotiable. Item 4 (charter.md:47-52) still requires importmap cache-buster lists and `bin/check-importmaps`, while `AGENTS.md` and `.claude/rules/no-build.md` record that Gary approved the Vite workflow on October 29, 2026. This audit followed `AGENTS.md` on that point and did not treat the missing importmap entries as a violation.

## Findings, ranked

### 1. High, confirmed defect: approaching a hailer the natural way cancels the hail

Hailing marks a person with `npc.hailing`, but the crowd reads that flag in exactly one place, the candidate filter (`src/crowd.js:2198`, set at `:2216`). A hailer keeps running the full ambient proximity machine, so three ordinary player actions end the hail:

- **Lane dodge.** Any cart faster than 4 m/s with the person inside a 3.5 m half-width corridor and a look-ahead of 5 m plus speed (capped at 24 m) flips them to `fleeing` (`src/steering.js:12-17`, `:34-45`; `src/crowd.js:1211-1220`). The pickup radius is 14 m (`src/quests/catalog.js:13`), so a player braking from the 18 m/s cruise straight at the hailer is inside the look-ahead before reaching it.
- **Honk.** The honk scatter sets every non-riding person in range to `fleeing` (`src/crowd.js:3004-3019`).
- **Skittishness.** A person with `skittish > 0.55` flees inside about 10.8 m (`src/crowd.js:1226-1227`). The candidate filter only requires `curiosity >= 0.3` (`src/crowd.js:2198`), and `skittish = (1 - curiosity) * rng()` (`src/crowd.js:631-632`), so candidates with curiosity between 0.30 and 0.45 can exceed the threshold.

`walkerInfo` reports a fleeing person as unavailable (`src/crowd.js:2207-2211`) and `_updateHails` then ends the hail as `gone` (`src/quests/runtime.js:136`). The bubble vanishes just as the player arrives.

The verification never exercised this path. It used `__dbg.hailGo()`, which teleports the cart to an offset beside the person (`src/main.js:2557-2561`; `verification/passenger-quests/README.md` addendum). The CHANGELOG sentence "Stopping within 14 m brings that person aboard straight away" (CHANGELOG.md, 2026-11-15, first bullet) is therefore only established for a teleported, parked cart.

**Fix direction:** make a hailing person exempt from the skittish flee and from the lane dodge below a hit-risk threshold (or have them hold position), and let a flee pause the hail briefly instead of ending it. Then verify by actually driving up.

### 2. High, plausible risk: the feature runs inside the frozen iPad measurement session

ROADMAP.md:265 freezes production performance changes until one batched iPad session of four fixed-route runs. `QuestRuntime` is constructed unconditionally (`src/main.js:905-913`) and updated every frame (`src/main.js:1509-1510`). Nothing in `src/quests/`, `src/questHud.js` or `src/models/questBubble.js` reads `PERFORMANCE_LAB`, `DEVICE_AUTOPILOT` or the capture flags (`rg` for those names in those paths returns nothing). If this branch merges before that session, every guided run gains:

- A hail attempt every 5 s while fewer than two people are hailing (`src/quests/runtime.js:153-155`). Each attempt scans every NPC (`src/crowd.js:2196-2202`), then calls `gatherDestinations` at a 300 m reach plus the 480 m POI pad (`src/quests/worldSource.js:44-46`; `src/worldgen/festival.js:69`) and a 900 m landscape query (`src/quests/summitSource.js:25-28`). Where no destination is in band the attempt returns null and repeats every 5 s indefinitely (`runtime.js:116`, `:123`).
- `Math.random`-driven hailers, waves and boardings, so two runs of the same route no longer carry the same workload.
- Riders held aboard by `rideHold` whenever the autopilot stops within 14 m of a hailer.

The change's own cost evidence is thin. The session log measured the search at 0.4 ms warm and 1.3 ms from a hailer's position on a desktop under software rendering, and 0.4 to 1.3 s cold in Node (session-log.md:34; verification README addendum). On Low the load ring is one chunk (`src/perf.js:108`), so whether plans 780 m out are warm depends on the horizon, which nobody checked. `lastGatherMs` is exposed only through `__dbg.quests()` (`runtime.js:238`), not through the capture reports.

Smaller costs that the README's "at most three sprites and a few DOM nodes" (README.md:60) leaves out:

- The sprite pool holds five, not three (`src/quests/presentation.js:18`).
- An arrival spawns 7 to 25 pickups in one frame (`runtime.js:172-179`; `engine.js:67-73`), and each pickup allocates three unpooled meshes (`src/smiles.js:99-123`).
- Each compass chip uses `backdrop-filter: blur(6px)` over the canvas (`styles.css:459`).
- Per-frame garbage while quests or hails exist: array spreads at `runtime.js:134`, `:163` and `engine.js:107`; a player object at `runtime.js:41-44`; option objects at `presentation.js:54`, `:61`, `:78`; one chip-state object and one `Set` per sync (`compassMath.js:29`; `questHud.js:44`). The compass also syncs its DOM while hidden (`presentation.js:81-85`).

**Fix direction:** either hold the merge until the iPad session is done, or disable `quests.enabled` and `quests.hailing` under the capture and autopilot flags and record `lastGatherMs` in the capture attribution.

### 3. Medium, confirmed defect: quest remarks overwrite Festival Run safety toasts

`HUD.toast` holds one message and each call replaces the last (`src/hud.js:577-581`). In `tickBody` the Festival Run layer raises "running on fumes — find juice, fast!" and the dry-tank toast at `src/main.js:1447-1476`, and `quests.update` runs later in the same frame at `:1509`. A rider remark can fire at any moment a quest is active (hints every 7 s or more, `catalog.js:25-26`; `runtime.js:191-196`), as can the hail tip (`runtime.js:150`). A quest line landing in the same frame, or within the 3.2 s the warning is on screen, erases it. The marshal-whistle warning (`src/main.js:2038-2040`) is exposed the same way. HANDOFF.md:45 lists this as a known trap, but no priority rule was added.

### 4. Medium, confirmed defect: the hail candidate filter admits people who cannot board

`forEachHailCandidate` checks state, party, photographer, curiosity and the cheer and frown timers, and nothing else (`src/crowd.js:2196-2202`). Three groups slip through:

- **People holding an activity claim.** `_reservePassenger` refuses anyone in `activityClaims` (`src/crowd.js:1999`), so `hailBoard` fails every frame (`:2230-2232`). The player parks beside them and nothing happens until the 50 s patience expires. That claimed people can sit in ordinary states is shown by the guards at `crowd.js:2541` and `:2996`, which check both.
- **People on another surface.** The filter uses flat distance (`crowd.js:2199`), while the rest of the crowd treats a height gap over 3 m as unreachable (`crowd.js:1081`) and seat reservation demands a matching surface (`crowd.js:2000-2005`). The bubble still shows, through the hillside, because it is drawn with `depthTest: false` (`src/models/questBubble.js:133`).
- **Route walkers in landscape districts.** `_tickCorridor` returns early every frame (`crowd.js:1000-1010`, called at `:1085`), so the code that counts `cheerTimer` down (`crowd.js:1158-1159`) is never reached. After the first `hailWave` (`crowd.js:2223`) the person walks their route in the arms-up hop pose (`crowd.js:1712-1714`) until the route ends. Routes are assigned at `src/landscape/district.js:177`.

There is also no feedback when boarding is refused for a dry tank or a full cart (`crowd.js:2230-2232`).

### 5. Medium, plausible risk: hailing changes the Festival Run economy and the stated ceiling argument no longer holds

design.md:56 justifies the reward table as "under the Worker's placeholder 40 raw/min even back to back". That was written for a 30% roll on boarders. Hailing now supplies up to two fares at once with a five-second refill (`catalog.js:8-10`), and closer destinations are weighted more heavily (`src/quests/pick.js:23`).

The minimum trip is short. A hailer's destination is at least 80 m from the hailer, the cart parks within 14 m, and a camp village's arrive radius reaches 60 m (`worldSource.js:33`). The cart may need to move only about 6 m before stopping for 7 smiles (`engine.js:72`). From the constants alone, two fares every 15 to 20 s is 40 to 55 raw smiles a minute from quests, before organic smiles. A burst also lifts the chain past the x3 threshold on its own (`src/runMode.js:39-43`; `src/scoring.js:80-93`).

This does not obviously breach the Worker today, because its ceiling is 40 x 8 x 1.5 x 1.5 = 720 multiplied points a minute (`workers/leaderboard/worker.js:51-58`). It does matter for the pending calibration (ROADMAP.md:78): if `BASE_SMILES_PER_MIN` is set from pre-quest play, honest quest farmers become the outliers. None of this was played or measured (verification README, "Limits").

Two smaller points. Quests are not gated on the run being over: `quests.update` is conditioned only on `npcsFrozen()` (`main.js:1509`), so after `endFestivalRun` a coasting cart can still complete a delivery, write the ride log, unlock a bubble and call `Scoring.deduct`. The submitted score is unaffected, since it was sent once at run end (`main.js:2075-2088`).

### 6. Medium, confirmed defect: the urgent-success and arrival exits do not do what the CHANGELOG says

- **The celebration is always cancelled on an urgent success.** `endRide` starts the cheer (`crowd.js:2258-2260`), then `sendToPotty` zeroes `cheerTimer` and sets the state to `idle` before it knows whether a potty can be claimed (`crowd.js:2268-2272`, called from `runtime.js:200-201`). When the destination was a plan-side welfare post with no built potty (`worldSource.js:34`), or the potty is taken, the rider gets neither the cheer nor the dash.
- **A delivered rider can climb straight back on.** The `beside` exit places them 3.6 m from the cart with their target on their own position (`crowd.js:2160-2165`), so `_tickDisembarking` returns them to `idle` on the next frame (`crowd.js:2297-2305`; `ARRIVE_RADIUS` is 1.5 at `:128`). No `disinterestedUntil` is set. Once the 2.6 s cheer ends, the ordinary boarding trigger applies at 45% a second while the cart is still parked (`crowd.js:1237-1251`; `:118`).
- **The exit skips the physics guard.** The ordinary disembark is blocked while the cart is airborne or more than 40% immersed (`crowd.js:2138`). `endRide` calls `_exitRide` directly (`crowd.js:2253-2256`) and places the rider with no lake or collider check. Physics driving is on by default (`main.js:629`), and a beach destination sits at the shoreline with a 28 m radius (`catalog.js:72`).
- **The urgent twist is not rendered under default physics.** The squirm adds to `npc.yaw` (`crowd.js:2132`), but a physics-driven rider's orientation is rebuilt from the cart quaternion and the seat yaw, ignoring `npc.yaw` (`crowd.js:1789-1792`). Only the faster bob survives. Task 6.2 is ticked and the CHANGELOG says the rider "bounces and twists", while the verification record says the pose was never seen.

### 7. Low to medium, confirmed defect: a hailer can lose the request on boarding

`startHail` enforces the three-request cap only when a hail is created (`runtime.js:113`). A walk-up roll checks only `engine.full` (`engine.js:32-35`), and so does a monk party (`runtime.js:84`). With one active request and two hails, a walk-up or party request makes two active; the first hailer boards to make three; the second hailer's bubble is removed (`runtime.js:54`) and `engine.offer` refuses because the engine is full (`engine.js:41`). They board as a plain rider with no message. This contradicts spec.md:229, "Hails SHALL count toward `MAX_ACTIVE`".

### 8. Low, confirmed defects in presentation

- **The arrow spins the long way round.** The bearing wraps to plus or minus 180 degrees (`compassMath.js:11`, `:32`), it is written as a raw `rotate()` (`questHud.js:51`), and the arrow has a transform transition (`styles.css:473`). A destination directly behind flips between +180 and -180 and animates through a full turn.
- **The chip ignores the in-game reduced-motion setting.** The urgent pulse is gated on the OS media query (`styles.css:495-498`), while the game's toggle sets `body.reduced-motion` (`src/a11y.js:46`). The bubble sprite does honour the toggle (`presentation.js:51`).
- **Auto-tracking discards the player's map selection.** A summit request calls `festivalMap.track` (`presentation.js:36`, `:94`), which overwrites `selected` (`src/festivalMap/view.js:113`). When the quest ends the selection is cleared, not restored (`view.js:152-155`).

### 9. Claims mismatches

| Claim | Where | Reality |
| --- | --- | --- |
| `QUEST.CHANCE` is 0.30 and the first boarder always carries a request | spec.md:20-23; design.md:48-49 | 0.08 and no first-boarder rule (`catalog.js:5`; `engine.js:32-35`). The same spec says 0.08 at line 229. |
| Candidates are gathered once per boarding, never per frame | spec.md:54; `worldSource.js:9`; 000-skipped.md:11 | Also gathered on every hail attempt, every 5 s (`runtime.js:121`, `:155`). |
| At most four sprites (spec), at most three (README, skip record) | spec.md:207; README.md:60; 000-skipped.md:11 | Five (`presentation.js:18`). |
| Every exit path reports through `onRideEnd` | design.md:42; 000-skipped.md:13 | No such hook exists; the runtime polls `riderInfo` (`runtime.js:163-166`). The session log admits this; design.md and the skip record were not updated. |
| "Tests and the smoke test cover scatter, dry tank and restart" | 000-skipped.md:13 | `bin/test-passenger-quests` imports only the catalog, picker, engine, compass math, summit source and quest log (lines 3-5, 236, 274, 320). `runtime.js`, hailing and every crowd method are untested, and `rg "scatter|dry|bubblesEmpty|restart|despawn" bin/test-passenger-quests` returns nothing. |
| "Resume/restart cleanup" is done | tasks.md 3.3 | `QuestRuntime.clear()` (`runtime.js:170`) has no caller in `src/main.js`. A restart is a page reload, so nothing leaks, but the task describes work that is not wired. If `clear()` is ever called, it would leave `monks.questHold` set, because the party cancel path never resets it (`runtime.js:224-229`; `src/monks.js:93`). |
| Behaviours stated as shipped fact | CHANGELOG.md 2026-11-15 | The verification record lists as never seen: the dash to the potty, the flee on failure, the squirm, the hailer's wave and bubble from the chase camera, the emitted look of all four new bubbles, three of the four unlocks, and any mountaintop request or waypoint in the game. |
| Check and build passed for the change | verification README, Method | Recorded only up to the variants commit. No pass is recorded after the hailing slice, and a check was still running during this audit. |

## What was tested and held

- **Flag leaks through pooling.** NPC records are new object literals per spawn and handles carry a generation (`src/people/personHandle.js:19-24`, `:38`), so `hailing`, `rideHold` and `rideMood` cannot reach a reused slot. `_endHail` always clears `hailing` (`runtime.js:102-108`).
- **`rideHold` stuck forever.** Every engine exit releases it (`runtime.js:200`, `:213`, `:218`, `:227`), and a failed `endRide` drops it (`crowd.js:2256`). A dry tank still empties the cart (`crowd.js:2138`). Riders are exempt from honk scatter and distance despawn (`crowd.js:3004`, `:859`).
- **Monk party.** All Zerble exits go through `leave()` (`src/monks.js:117-127`), which clears `questHold` and cancels. The arrival path re-enters `cancel` after the quest is already removed (`engine.js:120`, `:83-85`). Using the party object as the key is consistent throughout.
- **`crowd.onBoard` contract.** The two callers pass a handle (`crowd.js:2077`; `src/people/groupParticipation.js:64`), and the one test double ignores its arguments (`bin/test-boarding-ownership:18`).
- **Determinism.** No seeded stream is read or advanced. The plan functions are read without mutation (`worldSource.js:24-37`, `:50-58`; `summitSource.js:30-42`), the caches are clear-on-overflow memos of pure functions (`src/worldgen/festival.js:796`, `:846`; `src/worldgen/hearts.js:31`), and `request: false` does reach `planner.read` (`src/landscape/accessIndex.js:16-19`). `Math.random` is not globally seeded (`src/people/baseline.js:3-9`).
- **Persistence.** `zerble.questLog` matches the existing `zerble.*` key family, is versioned and tolerates a missing or corrupt store (`src/quests/questLog.js:11-22`). Map pins stay far below the 32 limit.
- **iOS audio.** `src/sound.js` gains new cue functions only; nothing sits before `Sound.init()`.

## Recommended order

1. Decide the merge timing against the iPad session, or add the capture-flag switch (finding 2).
2. Fix hailer behaviour and the candidate filter together, then verify by driving up to a hailer and by honking near one (findings 1 and 4).
3. Give run-critical toasts priority over quest remarks (finding 3).
4. Fix the urgent-success exit, the re-board, the physics guard and the cap race (findings 6 and 7).
5. Bring spec.md, design.md, the skip record and tasks.md into line with the code, and reword the CHANGELOG lines that describe unobserved behaviour (finding 9).
6. Add a Node test for `QuestRuntime` with a fake crowd, covering hail lifecycle, the cap and each exit path.
