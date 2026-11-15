## Scope
- Reviewed: custom `558c9f3...origin/passenger-quests` (tip `2277934`), `src/quests/{catalog,compassMath,engine,pick,questLog,runtime,summitSource,worldSource}.js`, `src/crowd.js`, `src/main.js`, `src/monks.js`, `src/people/groupParticipation.js`, `src/analytics.js`, `src/bubbleChallenges.js`, `src/bubbleTypes.js`, `bin/test-passenger-quests`, and `bin/test-bubble-types`.
- Notes: Read the passenger-quests HANDOFF, proposal, design, tasks and questions. Read current root crowd/cornhole integration without modifying it. No source changes or browser sessions. No seeded-world RNG regression found in this scope: new quest randomness is separate from the existing procedural streams, and world sources read existing plan APIs.

## Findings
- [P1][high] src/quests/runtime.js:200-201 - Urgent completion changes a still-seated passenger into a pedestrian after landing fails
  - Why: `Crowd.endRide` explicitly returns false when `_landPassenger` rejects every exit, retaining the reservation and seat (`src/crowd.js:2256`). The arrival handler ignores that result and calls `sendToPotty`, which unconditionally changes the NPC to `idle` (`src/crowd.js:2271`). This leaves an occupied seat/reservation attached to a pedestrian, and the ordinary riding loop can no longer release it. The quest has already been removed and pays its reward. This is reachable on terrain-bound rides when the cart stops near a destination with no legal clear landing position.
  - Evidence: A Node probe extracted and executed the actual changed `endRide` and `sendToPotty` methods with `_exitRide` returning false, then asserted both `npc.state === 'idle'` and `npc.seatSlot.occupied === true`. Both assertions passed. The production caller has exactly that call order.
  - Fix: Only send a rider to the potty after successful disembarkation, and reject seated riders in `sendToPotty` itself. Preserve a pending exit when landing is unsafe, and settle completion/rewards once the exit succeeds. Keep the existing grounded/immersion restrictions on quest-driven exits as well as ordinary exits.
  - Duplicate-of: none
- [P2][high] src/crowd.js:2198 - Hailing advertises people whose activity claims prevent boarding
  - Why: The candidate filter uses ambient state as a proxy for being unoccupied, but `claimActivity` deliberately sets claimed NPCs to `idle` (`src/crowd.js:2631`). `walkerInfo` repeats the same omission (`src/crowd.js:2208`), so these people retain a visible hail while `_reservePassenger` correctly rejects their pickup because an activity claim exists (`src/crowd.js:1999`). In the preserved root work, cornhole acquires exactly these claims (`src/people/cornholeSession.js:22`), making this a concrete merge-integration defect: a player can stop beside an advertised rider who cannot board. Activity acquisition after a hail starts has the same failure.
  - Evidence: A Node probe executed the actual `forEachHailCandidate` method with an idle NPC whose handle was present in `activityClaims.current`; the NPC was selected. Root cornhole source was inspected read-only to verify this state/claim combination is real.
  - Fix: Exclude existing activity claims and passenger reservations during candidate selection and availability checks. If an activity acquires a hailer afterward, end that hail, or explicitly release the activity through its owner before advertising pickup. Do not bypass the reservation guard.
  - Duplicate-of: none

## Verification
- `node bin/test-passenger-quests`: passed.
- `node bin/test-bubble-types`: passed.
- Two isolated probes of the actual changed crowd methods reproduced both findings.
- The existing quest script tests engine/picker/log/compass/source behavior but does not cover the crowd/runtime handoff exposed above. No real-game or physical-device verification was performed in this read-only specialist review.
