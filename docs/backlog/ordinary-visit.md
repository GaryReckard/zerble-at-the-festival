# An ordinary visit worth remembering

Design exploration recorded November 17, 2026, prompted by Locke's
[Suggestions for Roadmap](https://github.com/GaryReckard/zerble-at-the-festival/issues/1).
Gary endorsed the first-passenger-vignette direction and requested its roadmap
entry and this broader record. He subsequently requested roadmap entries for
braking and on-foot participation, including the activity wishlist below. These
are recorded future directions. Gary subsequently approved implementing braking
with the controls and release rules below, after committing and pushing this
planning record. On-foot implementation and mode rules remain undecided. Other
recommendations below remain exploratory.

## Contents

- [The feeling to protect](#the-feeling-to-protect)
- [The first passenger vignette](#the-first-passenger-vignette)
- [Practical extensions of Locke's suggestions](#practical-extensions-of-lockes-suggestions)
- [Stopping Zerble](#stopping-zerble)
- [Stepping out as Gary](#stepping-out-as-gary)
- [Delivery and evidence](#delivery-and-evidence)

## The feeling to protect

Driving past a stranger, leaving bubbles and seeing them smile is the emotional
center. New systems should deepen generosity, curiosity, humor and belonging.
Just Cruisin' must leave stopping to listen or wandering without an objective
legitimate. Festival Run can carry more explicit score pressure and mastery.

Locke's strongest insight is to connect driving, people, bubbles and discoveries
into memorable experiences. Constant rewards, mandatory objectives and escalating
spectacle are not necessary consequences of that insight. Ask what players miss
when they leave, and what happened that they would tell someone afterward.

## The first passenger vignette

The [roadmap section](../../ROADMAP.md#first-passenger-vignette-a-lift-to-a-friends-set)
owns the pending-work summary. The imagined five-to-ten-minute visit is a target
experience, not a guaranteed runtime or mandatory script:

1. Drive through an approachable space and see someone react to bubbles.
2. Notice a person asking for a lift to hear a friend's band, and choose whether
   to stop. The side-stage request already has that premise in the
   [dialogue catalog](../../src/quests/catalog.js).
3. Share a short, legible trip with destination-specific remarks and music on
   approach. Allow detours and ignore/abandon paths.
4. Stop safely, receive thanks and see the passenger leave toward the venue.
5. Stay for music and audience response if desired, then choose another road or
   invitation without an immediate demand to keep performing.
6. Find a small memory of the lift in the Passport later.

Build an introductory encounter-selection policy, a coherent authored dialogue
variant, a readable arrival and a bounded saved vignette identifier. Reuse
[hailing and arrival](../../src/quests/runtime.js),
[candidate selection](../../src/quests/pick.js),
[song-end hooks](../../src/sound.js) and the
[Ride log](../passport.md#ride-log).

Select for a usable journey and stopping area. Current candidate filtering uses
straight-line distance, not a route-accessibility verdict. Do not promise that a
planned destination is fully built yet; the
[destination source](../../src/quests/worldSource.js) intentionally reads plans
beyond streamed chunks. Preserve deterministic generation and recheck arrivals
against live conditions. Do not promise a scheduled encore or a new passenger
activity merely through dialogue.

## Practical extensions of Locke's suggestions

These are design judgments, grounded in the linked existing surfaces rather than
claims that the extensions are implemented.

| Direction | Recommended form and scope |
| --- | --- |
| First-session rhythm | Begin with the complete vignette above, then observe uncoached play. Space invitations around actual player actions rather than running an inflexible timer. |
| Passenger stories | Add a few recognizable situations with supported endings before expanding into dozens of mission types. A nap can use the existing hammock handoff; a meal requires the [dining loop](gameplay.md) first. |
| Hub identity | Initially connect encounter selection and remarks to existing venue types. Stronger identities can later influence music, activities and layout, using stable [hub records](../../src/worldgen/hearts.js) and an independent seeded identity salt. Labels alone do not establish identity. |
| Rare events | Prefer a local moment involving existing people and music before festival-wide migrations or large new populations. Existing [song-end callbacks](../../src/sound.js) are a concrete candidate hook; extra audience behavior still needs ownership and performance checks. |
| Passport | Favor remembered experiences and expressive rewards over compulsory completion. The [current Passport](../passport.md) already has permanent stamps and a Ride log; richer memories and rewards are additions. |
| Bubble progression | Finish acceptance of [existing upgrades](../../BUBBLE-UPGRADES-PLAN.md), then consider clearly readable behaviors that change play. Do not assume new behavior is cheap merely because rendering is instanced. |
| Daily Festival Runs | Shared seeds and a small set of deliberate objectives could give the existing activities a repeatable social context. Daily-board eligibility, scoring fairness and challenge validation still need design. See [daily challenge proposal](gameplay.md). |
| Varied-action combos | Explore in Festival Run. The [current chain](../../src/scoring.js) counts smile collections, so action-variety scoring is a genuine rules change. Avoid letting a score timer make lingering feel wrong in Just Cruisin'. |
| Driving mastery | Precise approaches, comfortable rides and well-chosen routes fit the generous fantasy. Jumps and stunts need explicit compatibility with current [physical driving](../../src/physics/playerVehicle.js), rather than assuming the older arcade hop proposal transfers unchanged. |
| Trip gameplay | Temporary encounters or altered bubble behavior could add discovery beyond graphics. Actual rule variants need explicit scope, deterministic selection where relevant, and the [existing tier contract](trip-effects.md). |
| Recognizable people | Start with distinctive appearance and consistent ride remarks. A named person recognized across long journeys or visits needs durable identity, streaming and persistence policy beyond the [current delivery record](../../src/quests/questLog.js). |
| Curiosity and landmarks | Preserve discovery through visible or audible clues, supported by the [existing discovery map](../../README.md#finding-your-way). Stronger landmarks should identify worthwhile places rather than become decoration with no encounter behind them. |
| Small surprises | Keep room for the [tiny bubble inhabitant and other ambient ideas](../../ROADMAP.md#world). A small memorable detail can justify itself without score or progression utility. |

## Stopping Zerble

Gary raised a dedicated brake because reverse input also starts reversing, while
hill stops and passenger boarding need an unambiguous way to remain stopped.
Recommendation: add a service brake, with a distinct parking state if needed.
Gary approved these controls on November 17, 2026:

| Input | Action |
| --- | --- |
| Space, held | Service brake, overriding propulsion without requesting reverse. |
| E | Honk, moving the primary binding off Space. |
| Shift, held | Boost. |
| R | Toggle parking brake near a supported stop, or explicitly release it. |
| Ctrl, held | Retain keyboard precision driving. |
| Touch Brake, held | Replace the current Slow button; retain stick steering while braking. |
| Touch Park | A separate toggle near Brake, available to engage near a stop and always available to release while set. |

Keep W/S and stick forward/reverse behavior, including opposing-throttle
deceleration. A fresh forward or reverse throttle command releases parking and
applies drive together. If throttle was already held when parking engaged, require
neutral before a new command can release it. Reject moving/airborne parking
requests without queuing them. Retain explicit release for intentional rolling;
do not make ordinary coasting automatically engage parking. These are accepted
implementation requirements, not claims of shipped behavior.

Current evidence: [Input.brake](../../src/input.js) returns a diagnostic value or
false, so normal player controls do not expose it. The physical vehicle's
[beforeStep](../../src/physics/playerVehicle.js) accepts explicit brake input and
opposing throttle, then applies bounded longitudinal deceleration based on
contact and traction. Its brake demand depends on velocity and does not explicitly
counter downhill gravity at rest. The
[physical driving sandbox](../../src/playerDrivingSandbox.js) already exposes a
brake, but this is not a hill-hold acceptance result.

Proposed behavior:

- Holding the brake decelerates forward or backward motion without requesting
  reverse, and overrides propulsion while retaining steering.
- On an ordinary supported hill, finite tire/contact forces resist gravity and
  can hold the cart. On inadequate grip or extreme grades it may slide; a locked
  wheel is not an anchor. Airborne braking does not cancel flight or freeze pose.
- Releasing the service brake permits rolling. A parking brake latches at a
  supported near stop, with clear state feedback and fresh-throttle or explicit
  release. Do not make
  neutral throttle silently engage parking while the player is coasting.
- Verify slopes in both directions, cross-slopes, surfaces, missing contacts,
  airborne cases and consistent behavior across frame rates. Check boarding and
  unloading while holding, and that brake input does not leak across menus.

Rapier documents separate engine and wheel-brake controls in its
[vehicle controller guide](https://rapier.rs/docs/user_guides/templates/vehicle_controller/).
Our controller currently owns traction impulses, so adopting native wheel braking
must be evaluated against that ownership rather than layered on blindly.

## Stepping out as Gary

Gary asked whether the driver should be controllable on foot, why, and what he
would do, then requested a roadmap entry for that direction. Recommendation:
explore this as a way to participate at a destination,
with one complete activity as the acceptance target. It is not required for the
first passenger vignette and is not approved implementation scope.

The strongest proposed scene: park near the stage, step down, walk into the
audience, dance or clap alongside the person just delivered, then return to
Zerble. The cart gets Gary between gatherings; walking lets him belong to one.
Use a close third-person view that keeps the same festival tone.

### Activity wishlist and participation

Gary's requested exploration includes the following activities. These are player
feature ideas, not an assertion that each NPC behavior already exists or can be
exposed unchanged. Each needs entry, participation, completion/cancellation and
resource-release behavior appropriate for a human player.

| Activity | Questions to resolve |
| --- | --- |
| Use a porta-potty | Availability, entering/exiting, occupied feedback and how long participation lasts. |
| Lie in a hammock | Claim a free hammock, align the person, choose when to get up and handle a blocked exit. |
| Sit in a camping chair | Seat ownership, sitting/getting up, movable supports and impacts while occupied. |
| Get a drink from a cooler | Which cooler is available, whether to open it, take/hold/drink/return or drop an item, and how contents are owned. |
| Play cornhole | Joining or starting a game, choosing aim/throw strength, turn ownership, scoring, retrieval and leaving mid-game. |
| Play frisbee | Choosing a partner, throwing/catching assistance, missed discs and leaving without stranding NPC participants. |
| Hula hoop | Starting/stopping, animation and whether participation is expressive, skill-based or both. |
| Dance and clap | Immediate expressive actions, optional music synchronization and compatibility with walking or seated states. |
| Do yoga | Joining a suitable space, pose choice, session duration and a deliberate exit. |
| Shop, potentially | What is sold, browsing/confirmation, whether purchases cost anything and whether there is a worthwhile reward or use. |

Joining a drum circle and sitting at a campfire or picnic table are additional
assistant suggestions. Repairs could later connect to stepping out, but should
not become mandatory roadside chores.
Avoid introducing hunger, inventories, fetch errands or a second progression
economy merely to justify having a walking controller.

### Mode changes and passenger quests

Distinguish the selected game mode (Just Cruisin' or Festival Run) from control
state (driving, walking or participating in an activity). Changing the controlled
actor should not silently change the selected game's rules or reset a run.

Gary explicitly identified that driving quests do not make sense unchanged while
he controls a person. Before implementation, decide:

- Whether exiting is allowed with active riders, urgent requests or a boarding
  person. A first proof can require completing the delivery before stepping out;
  that is a proposed simplification, not an agreed shipping restriction.
- If occupied-cart exits are allowed, whether passengers wait, leave or accompany
  Gary, which clocks continue and what resumes on re-entry. Simply pausing every
  clock could provide an unintended Festival Run advantage; continuing everything
  unchanged could punish the participation this feature is meant to encourage.
- Whether new cart hails stop while on foot, what happens to existing offers and
  how the driving HUD is replaced. Recommend suppressing new driving invitations
  while Gary is participating on foot.
- Which world, scoring, damage, rescue and end-of-run rules remain active. A
  control-state switch is not automatically a world pause or cart invulnerability.

### Choosing interactions

Gary suggested that approaching something such as a chair should allow a choice
of whether and how to interact. Recommend one consistent interaction system:

1. Identify and highlight a reachable candidate, considering distance, facing,
   obstacles and availability rather than distance alone.
2. Offer a readable contextual action such as Sit, Get a drink or Join game.
   Use a deliberate key/button press; do not auto-activate on proximity.
3. If several actions fit one object, offer a short choice after activation. If
   several objects overlap, provide a predictable way to change the target.
   The exact menu style and keyboard/touch bindings require design and testing.
4. Claim the same seat, game turn or item resource that NPCs use, rechecking
   availability at activation. Explain an occupied or unavailable target without
   letting the player and NPC simultaneously own it.
5. Give each activity an obvious leave/cancel action, a safe physical exit and
   reliable resource cleanup on interruption or unload. Destructive actions and
   purchases must not hide behind the same ambiguous input as sitting down.

The shared piece should be target selection, action descriptions, availability,
claims and lifecycle. The activity itself can have suitable controls: throwing a
cornhole bag need not use the same interaction as relaxing in a hammock. Adapt
existing NPC activity ownership rather than making a competing player-only seat
or turn registry. This is a proposed architecture boundary, not a completed audit
of every activity's compatibility.

### Technical scope and first proof

Technical scope is substantial. Gary is currently a
[seated model attached to Zerble](../../src/zerble.js), with dedicated
[driver geometry](../../src/models/garyDriver.js). The
[game loop](../../src/main.js) uses Zerble's position for map observation,
progress and many nearby systems. A walking mode needs explicit ownership of:

- The controlled actor, input, camera and on-foot animation/collision/grounding.
- Safe exit and re-entry locations, including blocked doors, slopes and water.
- A parked cart that retains physical state, plus its location and residency if
  the player walks away. Choose a bounded residency policy before promising
  unlimited separation or keeping a second fully active world region.
- Passenger patience, occupied seats, quest timing, damage and run-end rules while
  Gary is away. Decide which interactions belong to Gary and which to Zerble.
- Map focus, audio listener, discovery and separate walking/driving statistics.
- One deliberately adapted participation interaction; NPC activity infrastructure
  alone does not prove a player can join it. See the
  [people extension guide](../../openspec/changes/people-npc-architecture/extension-guide.md).

A bounded local proof should test park, safe exit, walking over uneven ground,
one meaningful activity and return. This is a technical validation surface, not
a recommendation to ship invisible walking boundaries or teleport the cart back.
If unlimited walking is pursued, separated-world residency becomes explicit work.

## Delivery and evidence

Keep the [current performance gate](../../ROADMAP.md#performance) in force.
The vignette can reuse existing populations; new selection work still needs
measurement. Walking is a broader architecture and controls change, even if only
one new visible person is added. Braking is a bounded driving change, but its
hill-hold behavior needs a physical proof rather than a UI-only binding.

Gary authorized the brake as the next implementation after the planning commit
and push. Then compose and observe the first passenger vignette, and evaluate
on-foot participation with one complete local scene; those later steps remain a
recommended order rather than implementation authorization.

For the vignette, verify ignored and unavailable invitations, route/arrival
conditions, streaming interruptions and save migration. For all runtime changes,
follow the project's real-game, tier and device verification requirements.
An uncoached player recognizing and retelling the experience matters alongside
contract tests; a scripted completion does not prove that the invitation or
emotional payoff reads.
