# Capability: passenger-quests

> **Source:** `src/quests/` (`catalog.js`, `pick.js`, `engine.js`, `worldSource.js`,
> `summitSource.js`, `runtime.js`, `presentation.js`, `compassMath.js`),
> `src/models/questBubble.js`, `src/questHud.js`, the "Passenger-quest surface" in
> `src/crowd.js`, `questHold` in `src/monks.js`, and the wiring in `src/main.js`.
> Riders are `crowd-ai`; rewards are smile pickups from `feedback-systems`; the
> pins use the festival map's `setObjectives`. Rationale and departures from the
> older design doc are in
> [the change record](../../changes/passenger-quests/design.md); measurements are in
> [verification](../../../verification/passenger-quests/README.md).

Some riders who board Zerble ask to be driven somewhere. A pure engine owns the
rules, a runtime wires it to the game, and optional presentation layers (thought
bubble, compass strip, map pins) show the request. Arriving ends the ride with a
cheer and a burst of smile pickups.

## ADDED Requirements

### Requirement: Walk-up offer chance

An un-hailed boarding rider SHALL carry a request with probability `QUEST.CHANCE` (0.08), with no first-boarder guarantee. A hailing rider SHALL receive the request planned before boarding. No offer SHALL be made while
`QUEST.MAX_ACTIVE` (3) requests are active, regardless of free seats. A request
SHALL hold the rider's ordinary ride timer open, so a quest rider never times out
the way an ordinary rider does (`engine.js` `rollOffer`, `offer`; `runtime.js`
`onBoard`; `catalog.js` `QUEST`).

#### Scenario: An un-hailed first rider

- **WHEN** the first rider of a session boards without a hail
- **THEN** the ordinary 8% chance roll applies

#### Scenario: The strip is capped at three

- **WHEN** three requests are active and a fourth rider boards
- **THEN** no fourth request is offered

### Requirement: Distance bands

An ordinary request SHALL choose a destination at least `QUEST.MIN_DIST` (60 m) from the arrival edge and at most `QUEST.MAX_DIST` (300 m) between the cart and destination centre, weighted toward nearer places and damped for
kinds already active. An urgent request SHALL use a porta-potty at least 45 m from its arrival edge and at most 220 m from its centre,
and a summit request an admitted district at least 160 m from its arrival edge and at most 900 m from its centre (`pick.js`
`candidatesInBand`, `pickWeighted`, `planOffer`).

#### Scenario: Nothing in band means no request

- **WHEN** no candidate lies within the band
- **THEN** the rider boards as an ordinary rider and no request is made

### Requirement: Destinations come from the plan first, with lake rejection

Candidates SHALL be gathered when planning a hail or boarding offer, rather than on every frame, from the worldgen
plan (`festivalPlan`, `campVillagesNear`) so unstreamed areas qualify, then from the
live registry for beaches, hammocks, forest drum circles and exact porta-potties.
Stage requests SHALL aim at the dance floor in front of the stage along its facing.
Any plan candidate whose point `lakeAt` reports as water SHALL be rejected. A built
porta-potty SHALL replace the plan's welfare-post centre within 30 m. The search
SHALL NOT advance any seeded stream (`worldSource.js` `fromPlan`,
`gatherDestinations`).

#### Scenario: An unloaded venue can be requested

- **WHEN** a stage lies 250 m away in a chunk that has not streamed in
- **THEN** it can be offered, because the plan describes it

#### Scenario: Water is never a destination

- **WHEN** a plan point falls inside a lake
- **THEN** it is not offered

### Requirement: Arrival needs a near stop

An arrival SHALL require the cart to be within the destination’s arrive radius and
slower than `QUEST.ARRIVE_SPEED` (2 m/s), with a safe disembarkation. Solo facility requests SHALL additionally wait for activity entry before completion. The radius SHALL be the larger of the
kind's catalog radius and the radius the source supplies for a sprawling venue
(`engine.js` `offer`, `update`).

#### Scenario: Driving through does not complete

- **WHEN** the cart crosses the radius faster than 2 m/s
- **THEN** the request stays active

#### Scenario: Stopping inside completes

- **WHEN** the cart is inside the radius, slower than 2 m/s and a safe exit succeeds
- **THEN** an ordinary non-facility request emits `arrived` with the reward and is removed
- **AND** a solo facility request waits for its reserved activity to begin

### Requirement: Missed stops halve the reward

After the cart has been inside the radius, going beyond the radius plus
`QUEST.MISSED_DISTANCE` (60 m) SHALL mark the request missed once, say a missed-stop
line, and halve the reward (rounded up). The patience baseline SHALL reset so the
way back counts as progress (`engine.js` `update`, `reward`).

#### Scenario: Passing the stop

- **WHEN** the cart enters the radius without stopping and drives 60 m past it
- **THEN** the rider calls out the missed stop and a later arrival pays half

### Requirement: Stall patience replaces a fixed clock

For non-urgent requests, patience SHALL drain only while the cart is not getting
closer. Getting 5 m (`QUEST.STALL_PROGRESS`) closer than the best distance resets
it, and it does not drain inside the radius. After `QUEST.STALL_SECONDS` (75 s) the
rider SHALL give up politely with no penalty, and the crowd releases the seat
(`engine.js` `update`; `runtime.js` `gaveUp` handling).

#### Scenario: Idling near the goal is fine

- **WHEN** the cart sits inside the arrive radius for longer than 75 s
- **THEN** the rider does not give up

#### Scenario: Going nowhere

- **WHEN** the cart makes no 5 m progress for 75 s outside the radius
- **THEN** a `gaveUp` event fires and the rider steps off with no penalty

### Requirement: Urgent run countdown, reward and penalty

About `QUEST.URGENT_CHANCE` (12%) of offers, when a potty is in the urgent band, SHALL
be urgent. The countdown SHALL be `30 + distance / 5` seconds. Entering the reserved potty SHALL pay
`URGENT_REWARD` (10) plus up to `URGENT_BONUS` (5) in proportion to time left at drop-off. The countdown SHALL pause during a committed facility handoff. Running out of time SHALL emit `failed`,
deduct `URGENT_PENALTY` (2) smiles through `Scoring.deduct`, and send the rider
fleeing. The urgent rider SHALL fidget while seated (`engine.js` `reward`, `update`;
`runtime.js` `failed` handling; `crowd.js` `setRideMood`, `beginQuestActivity`, `questActivityStatus`).

#### Scenario: Made it in time

- **WHEN** the cart stops in the potty's radius with time left
- **THEN** a free reachable potty is reserved, the rider exits safely and walks in with the countdown paused
- **AND** entering `using_potty` awards 10 to 15 smiles

#### Scenario: Too late

- **WHEN** the countdown reaches zero
- **THEN** the rider flees and 2 smiles are deducted

### Requirement: Summit requests read only admitted districts

The mountaintop source SHALL return a candidate only for districts of kind
`mountain-top` whose state is `ready`, and SHALL query the landscape access with
`{ request: false }` so a quest never asks the planner for new work. The drop-off
SHALL be the point on the district's own main road nearest its commons. A summit
request SHALL pay `10 + floor(distance / 60)` smiles, and SHALL be rolled with
`QUEST.SUMMIT_CHANCE` (10%) (`summitSource.js`; `pick.js` `planOffer`; `engine.js`
`reward`).

#### Scenario: A pending district is ignored

- **WHEN** a Mountain Top district has not finished planning
- **THEN** it is not a candidate and no planning is requested

### Requirement: A monk party shares one request

A monk party that finishes boarding Zerble SHALL receive a single shared request
spoken in narration rather than quotes, with one bubble over the cart. The party
SHALL stay aboard until the request ends (`questHold`), pay `QUEST.PARTY_REWARD_EACH`
(3) per monk, and leave together on arrival or give-up. If the party leaves first,
the request SHALL be cancelled (`monks.js` `questHold`, `onBoardZerble`,
`onLeaveZerble`; `runtime.js` `offerParty`).

#### Scenario: Five monks arrive together

- **WHEN** a five-monk party stops at its destination
- **THEN** the reward is 15 smiles and all members leave together

### Requirement: Rewards are ordinary smile pickups

An arrival SHALL spawn the reward as `smiles.spawn` pickups around the cart, collected
through the normal path to `Scoring.collect`, so combo, Lurleen's doubling and raw
smile accounting apply in both modes. The runtime SHALL NOT call `Scoring.award` for
arrivals (`runtime.js` `_spawnBurst`; `smiles.js`).

#### Scenario: Smiles reach the HUD

- **WHEN** a request completes with a reward of 15
- **THEN** 15 pickups spawn and the HUD count rises as they are collected

### Requirement: No seeded stream is touched

Quest rolls, picks and remarks SHALL use `Math.random`, as boarding does. They SHALL
NOT read or advance a seeded world stream, so seeded worlds are unchanged by the
feature (`engine.js`, `runtime.js` `random` default).

#### Scenario: Same seed, same world

- **WHEN** the same seed is loaded with and without quests active
- **THEN** the generated world is identical

### Requirement: Every exit path frees the request

A rider who leaves for any reason the engine did not cause (dry tank, scatter,
despawn, restart) SHALL cancel the request without reward or remark, and the runtime
SHALL release the ride hold and the bubble sprite. The runtime SHALL detect this by
polling `crowd.riderInfo` for each active request, at most three, each frame
(`runtime.js` `update`, `clear`; `crowd.js` `riderInfo`).

#### Scenario: Tank runs dry

- **WHEN** the bubble tank empties and the rider steps off
- **THEN** a `cancelled` event fires and the bubble is hidden

### Requirement: Presentation is pooled and the compass avoids the controls

The live `QuestPresentation` SHALL allocate five reusable `QuestBubbles` sprite slots with shared canvas icon textures owned
by one instance, with `dispose()` as the only teardown path. A bubble SHALL brighten with proximity, pulse when almost there and jitter for
an urgent request, honouring reduced motion. The compass strip SHALL list one chip per
request with a shaft arrow, plain nose-relative direction words and the distance left, and be hideable by the Passenger compass setting. It SHALL sit at the top center on desktop and touch layouts, with toasts positioned below its measured height. Inside the arrival radius, slow/stop or blocked-arrival instructions SHALL replace directional guidance; pending facility handoffs SHALL show “Passenger walking in” without an arrow or urgent countdown. Each request SHALL be a pin through `festivalMap.setObjectives`
(`models/questBubble.js`; `questHud.js`; `presentation.js`; `compassMath.js`
`relativeBearing`, `chipState`).

#### Scenario: Three requests, three indicators

- **WHEN** three requests are active
- **THEN** three bubbles, three compass chips and three map pins are shown

#### Scenario: Compass turned off

- **WHEN** the Passenger compass setting is off
- **THEN** the strip is hidden and bubbles and pins still show

### Requirement: Hailing is the main source of requests

The runtime SHALL keep at most `QUEST.HAIL_MAX` (2) people on foot hailing the cart, chosen from ordinary adults `HAIL_MIN_DIST` to `HAIL_MAX_DIST` (10 to 75 m) away, each with a destination planned from that person's own position. Hails SHALL count toward `MAX_ACTIVE`. A hail SHALL lapse after `HAIL_PATIENCE` seconds or beyond `HAIL_LEASH` metres. An un-hailed boarder SHALL carry a request only with probability `QUEST.CHANCE` (0.08) (`src/quests/runtime.js` `startHail`, `_updateHails`; `src/quests/catalog.js`).

#### Scenario: The player stops for a hailer

- **WHEN** the cart is slower than 0.6 m/s within `HAIL_PICKUP` (14 m) of a hailing person and the tank is not empty
- **THEN** that person claims a seat and boards, and on sitting down receives exactly the request their bubble showed

### Requirement: Deliveries are logged and can earn bubble types

Each arrival SHALL be recorded in a versioned `localStorage` log holding totals by type and kind and the 20 most recent rides; a missing, corrupt or blocked store SHALL read as empty and never interrupt play (`src/quests/questLog.js`). `ChallengeTracker.onQuestCompleted` SHALL unlock `relief` on an urgent delivery, `summit` on a mountaintop delivery, `saffron` on a party delivery and `hitch` once the all-time total reaches `CHALLENGE.hitchRides` (`src/bubbleChallenges.js`).

#### Scenario: Fifth ride

- **WHEN** the fifth delivery of all time is recorded
- **THEN** Hitchhiker Bubbles unlock through the ordinary bubble-progress path

### Requirement: The Passport exposes the ride log

The Festival Passport SHALL include a Ride log tab showing all-time completed lifts, reward smiles sent out and up to 20 recent deliveries in newest-first order. Reward smiles SHALL describe emitted pickups before collection and score bonuses, not the HUD score. The record SHALL remain local to this browser, and unavailable storage SHALL leave the session record usable with a visible notice.

#### Scenario: Reading recent rides

- **WHEN** the player selects Ride log in the Passport
- **THEN** gameplay remains paused and the log shows destination, ride type and reward for each recent delivery

### Requirement: A mountaintop request is guided by the road

A summit candidate SHALL carry a `via` waypoint at the end of the district's `mainRoad` farthest from its commons when that end is more than 60 m from the drop-off. The compass SHALL aim at the waypoint until the cart comes within `VIA_RADIUS`, after which it aims at the destination (`src/quests/summitSource.js`, `src/quests/engine.js`, `src/quests/compassMath.js`).

#### Scenario: Reaching the foot of the road

- **WHEN** the cart first comes within 45 m of the waypoint
- **THEN** a `via` event fires once and the arrow swings to the summit

### Requirement: Quests stay out of measurement sessions and finished runs

`QuestRuntime.stop()` SHALL cancel every hail and request and prevent further offers. It SHALL be called at boot under the performance lab, device autopilot, timed captures and layout capture, and when a Festival Run or the vehicle ends (`src/main.js`).

#### Scenario: Fixed-route device capture

- **WHEN** the game boots with a capture or autopilot flag
- **THEN** no person hails, no request is offered and no destination search runs

### Requirement: A hailer waits for the cart

While `npc.hailing` is set, a person SHALL NOT lane-dodge, flee on proximity or be honk-scattered, and only people who could board (no activity claim, no corridor route, a shared surface) SHALL be chosen (`src/crowd.js`).

#### Scenario: Driving up to a hailer

- **WHEN** the cart approaches a hailing person at cruising speed
- **THEN** the person holds their ground and the hail remains until pickup, patience or the leash ends it

### Requirement: Generic facilities accept built alternatives

Solo hammock and porta-potty requests SHALL accept any currently built free matching facility within 25 m and 16 m respectively, provided a valid approach and checked route are available. Tree hammocks SHALL expose real seats and ground-sampled approaches through nonblocking, zero-footprint, chunk-owned metadata without consuming RNG. Group requests SHALL exclude these single-person facilities. Other destinations SHALL retain their stored specific target. Planned but absent facilities, occupied facilities, wrong kinds and streamed-out entries SHALL NOT complete a ride. The activity owner SHALL reserve the resource before safe disembarkation and release the temporary reservation on every exit path. A successful transfer SHALL keep the request in `handoff`, pausing patience and urgent time until the rider enters `hammock_riding` or `using_potty`. Reward and log mutation SHALL occur only then; interruption or resource loss SHALL cancel without reward and release the activity claim. Alternate facilities SHALL NOT reset urgent deadlines or increase distance reward beyond the offered trip.

#### Scenario: Another hammock on the way

- **GIVEN** a rider asked for a hammock at a suggested location
- **WHEN** the cart slows beside another free, reachable built hammock with a safe exit
- **THEN** that hammock is reserved and the rider walks to it
- **AND** settling into `hammock_riding` completes the request at that alternative
- **AND** any distance bonus is capped by the closer accepted trip

#### Scenario: A specific camp

- **GIVEN** a rider asked for their camp
- **WHEN** the cart stops beside another camp
- **THEN** the request remains active and points to the original destination


### Requirement: Ordinary solo deliveries approach their activity

After a completed non-facility solo ride, a bounded destination intent SHALL wait for the exit reaction, choose a nearby live venue and validate a traversable, unobstructed route before claiming walking authority. It SHALL allow at most three active intents and release authority on interruption, unload, route blockage, run end, page hide or the 32-second limit. It SHALL invite existing watching, picnic, market or camp owners where supported after reaching the gathering point; those owners retain their own eligibility and capacity checks. Unsupported venues SHALL use a short gathering-point dwell, and an unavailable route SHALL leave ordinary behavior in control. Mountaintop requests MAY use a checked gathering point without a live campsite. This intent SHALL neither gate nor duplicate the completed ride’s reward (`src/people/destinationIntent.js`; `src/main.js`).

#### Scenario: A stage passenger joins the audience

- **GIVEN** a solo rider completed a stage request with a nearby live stage front and clear route
- **WHEN** the exit reaction ends
- **THEN** the passenger walks to a checked gathering point and is invited into existing watching behavior
- **AND** the temporary walking claim is released
