# Cornhole, November 15, 2026

**TL/DR:** Communal campsite courts, scored games using ordinary NPCs, visible bag retrieval and social endings, deliberate vacancies, and small native wheel bumps are implemented. The production-session sandbox and real streamed game were checked. Physical-device handling and naturally observed busy/idle balance remain separate acceptance work.

## Try it

- [Idle boards](http://127.0.0.1:8765/sandbox.html?entity=cornhole&mute=1&perf=low).
- [Production NPC session](http://127.0.0.1:8765/sandbox.html?entity=cornhole_activity&mute=1&perf=low). Start, advance a round, inspect celebration/handshake, resume, interrupt, unload and revisit through visible controls. Fast-forward uses bounded accepted simulation steps and preserves actual scoring.
- [Clear live campsite fixture](http://127.0.0.1:8765/?mute=1&perf=low&seed=4&x=57&z=-107&heading=-1.006&tod=0.3). Click the ready Just Cruisin' button. `/inspect people` includes cornhole phase, score, court availability and recruitment counts; `/tp cornhole` visits a currently loaded court.

## Contextual placement

The [placement module](../../src/cornholePlacement.js) uses a private salted random stream after a communal parent has been completed. At least three households or booths are required, and each eligible parent gets one bounded placement attempt sequence with a 55% initial chance and at most 24 candidates. It never consumes the parent's `ctx.rng`.

The entire conservative 6.21 m registered circle must fit inside the parent's existing reservation, and the same circle must clear canonical generation footprints and colliders. The actual 3.2×12 m playing/access lane is sampled for dry traversable grass, grade, height variation, roads and landscape exclusions. A whole-court height spread over 0.22 m or grade over 0.055 declines. Road-facing aisles, shop fronts, queues, stages, water, solo camps and arbitrary wilderness do not receive courts.

Current vendor backstage strips cannot fit the registered circle, so they are rejected. The final completed-hub census across seeds 0–4 produced **0, 0, 0, 1, 1 courts**, both in camp villages, with real furniture, Crowd, elevated terrain and prepared landscape access policy. The broader 144-parent fixture produced 33 builds and 111 declines. The [placement test](../../bin/test-cornhole-placement) checks parent containment, actual final furniture, terrain/road exclusions, private RNG and real chunk teardown.

Admission is sensitive to existing neighboring geometry, as other camp placement already is. With seed 4, starting at the camp's source chunk around (57, -107) admits the court at (87.220032, -125.976899). Starting first in neighboring chunk (1,-2) around (105,-126) generates three trees in that candidate area before the parent is built, so the court correctly declines. The [replayable streaming probe](streaming-probe.mjs) and [its output](streaming-probe.log) retain both admission orders. This is a retained streaming-order limitation, not a claim of globally identical court existence for every load order. No tree or parent reservation was widened to force a court.

## A complete game using ordinary people

[CornholeActivity](../../src/people/cornholeActivity.js) registers at the existing people roaming barrier and discovers live court entries. It borrows two eligible uncommitted ordinary adults through validated claims, caps active games at two, and never creates a separate gameplay population. Recruitment reaches into the surrounding 60 m camp commons because the required empty court rim often contains no people; actual surface reach, state, cooldown and existing participation still gate acquisition. A real-game inspector observed five nearby people, three eligible/reachable candidates, two acquired players, and progression through throwing to first-round collection with a 0–5 score. [Saved live inspector](live-people-inspect.txt).

[CornholeRules](../../src/people/cornholeRules.js) uses alternating four-bag turns, one point for a bag on the board, three through the hole, cancellation after all eight throws and a win at 21 or more after the round. This follows the [official ACA scoring rules](https://www.playcornhole.org/pages/rules). [CornholeSession](../../src/people/cornholeSession.js) drives 3–6 second aiming periods, underhand throws and visible trajectories, walking to the receiving end, one-at-a-time collection while the partner clears the lane, and play back the other way.

At a win, the winner raises their arms, the loser slumps, they meet and shake hands, gather the bags at one end, and release back to ordinary AI. Ordinary walking restoration is directly tested; later dancing or other activities remain choices of that normal AI. A nearby cart, honk, unavailable person, blocked route or court removal releases claims. On a live interrupted court, landed bags stay put and held/flying bags settle at their current horizontal positions for the next pair to retrieve; unloading never writes to a stale model.

The complete native ownership fixture uses production Crowd claim/resume methods over recording render boundaries, translated/rotated courts and actual registered board colliders. Its final seeded example completed **12 rounds in 905.8 simulated seconds**. Tests check bounded walking without teleports, collider clearance, waiting positions inside the admitted footprint, scoring, hole-versus-board targets, collection, social endings, hand/lean restoration, real person removal, interruptions and full claim cleanup. See [activity](../../bin/test-cornhole-activity) and [rules](../../bin/test-cornhole-rules) tests. The real browser sandbox independently completed a game at 24–11, reached the paused handshake, resumed to idle with normal walkers, and unloaded/revisited cleanly. [Handshake state](handshake-state.txt), [completed state](finished-state.txt).

## Busy and vacant courts

Half the seeded court offers initially rest for 90–270 seconds. After a completed match the court rests for 65–105% of the actual game duration, clamped to 90–600 seconds; interrupted games rest for 45–90 seconds. People also receive a 180-second cooldown, with newcomers preferred and prior players still permitted after cooldown if newcomers are unavailable. For the fifteen-minute native example, the court rest reaches ten minutes. These are scheduling rules and one example, not a measured claim of population-wide occupancy. Other activities, player proximity and the two-game cap can leave additional courts vacant.

Boards and bags remain present while idle. No protected activity blocks driving; players abandon play when the cart comes too close. A regression specifically checks recruitment from beyond the empty 20 m rim without adding people, and another checks a different pair taking the next game and prior players returning later when needed.

## Small boards with real wheel support

The [shared-resource model](../../src/models/cornhole.js) has two 0.7×1.3 m boards, 0.07 m low noses and 0.30 m high ends, actual circular holes and eight bags. [Static residency](../../src/physics/staticResidency.js) mirrors each with four thin sloping native collider pieces and an open target area. The collider opening is square around the circular visual hole, an explicit primitive approximation. Court/board entries retain their origin chunk and world yaw. The physical player uses these supports; upward contacts follow landing forgiveness and side contacts use the lightweight-prop damage curve. No launch impulse is introduced.

The [native Rapier test](../../bin/test-cornhole-board-physics) scans only one tire over the board while the other remains on unchanged ground, checks a rotated board and exact collider removal, then runs the real free player chassis without pose corrections. Compared with flat ground, maximum chassis height changes from 0.00475 to 0.09257 m, roll reaches 0.0480 radians (about 2.75 degrees), 85 native tire contacts hit the board, and damage remains zero. This establishes an incidental small bump and tilt, not a guaranteed whole-cart jump at every speed or approach.

The court model has **18 meshes / 416 triangles**, shared geometry/materials and no shadow casters. The real two-person activity sandbox changed from 29 draws / 3,320 triangles to 11 / 2,904 when its court was unloaded, then returned to the original counts on revisit. Idle-board views include ground/grid and are not those same raw totals. No device FPS or calibrated performance claim follows from these composition counts.

## Browser evidence and cleanup

Managed in-app browser checks covered Low and Mid, Noon and Midnight, muted board-hit control, full game/finale, normal departure, unload/revisit and the real Low ready-title game gesture. The final game and sandbox console error lists are retained. No standalone or software-WebGL browser was launched, and task tabs were closed while Gary's existing gallery tab and requested Vite server were preserved.

- [Idle boards, Low Noon](boards-noon-low.jpg) and [Low Midnight](boards-midnight-low.jpg).
- [Handshake, Low Noon](handshake-noon.jpg) and [Low Midnight](handshake-midnight.jpg); [final Mid celebration](celebration-noon-mid.jpg) and [clean finale view](cornhole-finale-mid.jpg).
- [Live camp](live-camp-noon-low.jpg) and [loaded court nearby](live-court-near-low.jpg).
- [Sandbox console](sandbox-console.json), [Mid console](mid-console.json), [live console](live-console.json), [final live boot console](live-final-console.json).

## Validation and limits

The [first full check](initial-check-failure.log) exposed the existing isolated camp-layout fixture's missing new placement dependency; the fixture now explicitly stubs that separate feature while retaining all 6,000 packing assertions, and cornhole admission is tested through the actual completed hub and streaming paths. Earlier passing check/build runs were followed by targeted live-recruitment and waiting-clearance improvements, with final focused/full results retained here.

The final full `npm run check` and `npm run build` passed. The [full check](check.log), [production build](build.log), [placement](placement.log), [activity](activity.log), [native board physics](board-physics.log), and [camp compatibility](camp-compatibility.log) logs record verification. Desktop/native evidence does not establish physical iOS audio, device frame delivery, subjective one-wheel feel or naturally observed busy/idle balance; those remain in ROADMAP. The separate iPad performance investigation and its retained far-field stall target are unchanged by this feature.
