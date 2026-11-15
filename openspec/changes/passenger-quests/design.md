# Design: passenger quests

Read `.claude/passenger-quests-design.md` for the player-facing intent. This file records how it maps onto the code during the 2026-11-15 integration, and where the build deliberately departs from the older design.

## Anchors verified in the code

| Fact | Where |
| --- | --- |
| A rider becomes `riding` in `_tickBoarding`, which calls `crowd.onBoard(handle, { party })` for Zerble only | `src/crowd.js` `_tickBoarding` |
| Ordinary rides end in `_tickRiding` when `rideTimer <= 0` and Zerble is slower than `ZERBLE_IDLE_SPEED` (0.6), or at once when the tank is dry | `src/crowd.js` `_tickRiding` |
| Zerble has 8 passenger seats; `MAX_PASSENGERS` is 10 (the old design says 4) | `src/zerble.js` `seatSlots`, `src/crowd.js` |
| `cheerTimer` gives an NPC the jump, arms-up, smile pose | `src/crowd.js` `cheerNear` |
| `smiles.spawn(pos)` makes a pickup that homes to Zerble; collection flows through `Scoring.collect` | `src/smiles.js`, `src/main.js` tick |
| `Scoring.award` exists for quests but pickups already reach `collect`, so quests do not call it directly | `src/scoring.js` |
| The map accepts up to 32 objective pins and can track one | `src/festivalMap/view.js` `setObjectives`, `track` |
| Plan-side POIs exist for unloaded areas | `src/worldgen/festival.js` `festivalPlan`, `campVillagesNear`; `src/worldgen/hearts.js` `heartsInBounds` |
| A monk party can already board Zerble as a group and leaves after `rideUntil` | `src/monks.js` `reserve`, `arrive`, `leave` |
| Boarding and ride duration use `Math.random`, not a seeded stream | `src/crowd.js` |

## Modules

```
src/quests/catalog.js        pure   destination kinds: label, icon id, arrive radius, toast bank, reward weights
src/quests/pick.js           pure   distance band + inverse-distance weighted choice
src/quests/engine.js         pure   PassengerQuests: offer/update/cancel, emits events, computes rewards
src/quests/worldSource.js    game   gathers candidates from the worldgen plan + registry
src/quests/summitSource.js   game   admitted landscape districts and road guidance
src/quests/runtime.js        game   crowd/rewards/log integration and hailing
src/quests/presentation.js   game   bubbles, compass and map pins
src/quests/questLog.js       pure   storage-tolerant delivery record
src/models/questBubble.js    three  pooled thought-bubble sprites + shared canvas icon textures
src/questHud.js              DOM    compass strip
```

`engine.js` knows nothing about NPCs. It holds quests keyed by an opaque rider id and is driven with `update(dt, {x, z, speed})`. It returns events; `runtime.js` turns events into toasts, sounds and crowd calls, while `presentation.js` owns sprites, the compass and map pins. `main.js` constructs and connects these layers.

### Engine events

`offered`, `hint` (with a line), `near`, `missed`, `via`, `arrived` (with `reward`), `gaveUp`, `failed` (urgent only), `cancelled`.

### Crowd passenger API (new, narrow)

- `crowd.riderInfo(handle, out)`: head position and whether the person still rides Zerble.
- `crowd.holdRide(handle, on)`: suspends the ordinary ride timer while a quest is active.
- `crowd.endRide(handle, zerble, options)`: uses the existing disembark path with celebration or flee options. Arrival can be deferred until a legal exit is available.
- `QuestRuntime.update` polls `crowd.riderInfo` to cancel solo quests whose rider has left; monk parties report their own departures. There is no `crowd.onRideEnd` callback.

## Constants (first pass, all in `src/quests/catalog.js`)

| Name | Value | Why |
| --- | --- | --- |
| `QUEST.CHANCE` | 0.08 | Rare walk-up requests supplement hailing |
| First boarder of a session | ordinary chance roll | Hailers introduce the feature |
| `MAX_ACTIVE` | 3 | Compass strip legibility |
| Distance band | 80 to 300 m | Design doc |
| Arrive radius | Per kind in the catalog (16 to 45 m); a camp village supplies `min(60, footprint + 10)` and the larger value wins; stages are aimed at their dance floor instead of the deck | Big venues are entered, not touched |
| Arrive speed | under 2 m/s | Design doc |
| Stall patience | 75 s without getting 5 m closer | Replaces the fixed 90 s clock; see session-log D3 |
| Missed | was inside the arrive radius, then beyond 60 m | Halves the bonus once |
| Reward | `6 + floor(startDist / 50)`, so 7 to 12 raw smiles | Under the Worker's placeholder 40 raw/min even back to back |
| Urgent chance | 12% of quests, when a potty is 60 to 220 m away | Rare by design |
| Urgent clock | `30 + dist / 5` s | 42 to 74 s |
| Urgent reward / penalty | 10 plus up to 5 for spare time / minus 2 | Light stakes |
| Mountaintop band | 200 to 900 m, reward `10 + floor(dist / 60)` | A journey, not an errand |
| Monk party reward | 3 per monk | 12 to 18 for the party |

## Destination kinds

Plan-backed (available at any distance): `main_stage`, `side_stage`, `tent_stage`, `food_court`, `vendor_row`, `drum_circle`, `camp_village`, `arch`, `healing_arts`, `welfare_post` (urgent only).
Registry-backed (only when loaded): `beach`, `hammock`, `porta_potty` (urgent only, preferred over the plan post when present).
Landscape-backed: `mountaintop`.

Every candidate is rejected if `lakeAt` reports water at its point.

## Departures from the older design doc

1. `MAX_PASSENGERS` is 10 with 8 seats, so quests are capped separately at three.
2. Destinations come from the plan because the registry only holds streamed chunks.
3. The fixed 90 s timeout became a stall timer.
4. Rewards are spawned pickups, not a direct score write, so the player sees and collects them.
5. Hailing is the main source, with up to two people asking within 75 m; un-hailed boarders ask only 8% of the time and the first-boarder guarantee is removed.
6. The Passport Ride log displays browser-local totals and the latest 20 deliveries from `src/quests/questLog.js`. Reward smiles count emitted pickups, before collection and score bonuses.
7. The live presentation allocates five instance-owned sprite slots; only that pool disposes its materials and textures.
8. The timed porta-potty variant was added to the backlog after the doc said "no timed missions". It is kept rare and gentle.

## Verification surfaces

- `bin/test-passenger-quests`: engine, picker and catalog in Node (added to `npm run check`).
- `sandbox.html?entity=quest_bubbles&mute=1`: every icon at each brightness step.
- `/?mute=1` with `__dbg.quests()`, `__dbg.giveQuest(kind)`, `__dbg.questGo()` for the real loop.
