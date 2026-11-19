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
implementation requirements. The [braking change](../../openspec/changes/brake-and-parking/README.md)
and [verification](../../verification/braking/README.md) track delivery and
physical-device acceptance.

Pre-implementation evidence: [Input.brake](../../src/input.js) returned a diagnostic value or
false, so normal player controls did not expose it. The physical vehicle's
[beforeStep](../../src/physics/playerVehicle.js) accepts explicit brake input and
opposing throttle, then applies bounded longitudinal deceleration based on
contact and traction. Its old brake demand depended on velocity and did not explicitly
counter downhill gravity at rest. These observations motivated the implementation;
they are not descriptions of the updated controller. The
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
| Do yoga | Gary specifically wants to join yoga at the Healing Arts tent when a mat is available. Plan mat ownership, participation and a deliberate exit; the purpose/reward remains exploratory. |
| Shop, potentially | What is sold, browsing/confirmation, whether purchases cost anything and whether there is a worthwhile reward or use. |

Joining a drum circle and sitting at a campfire or picnic table are additional
assistant suggestions. Repairs could later connect to stepping out, but should
not become mandatory roadside chores.
Avoid introducing hunger, inventories, fetch errands or a second progression
economy merely to justify having a walking controller. The visible two-hand jug
carrying below is a requested practical activity, not a reason to add a backpack
menu or mandatory supply chores.

### Hands, jugs and returning to Zerble

**Gary's proposal, November 18, 2026:** walking into a loose juice jug picks it
up and occupies one hand. One jug slows him a little; a second occupies the
other hand and makes him noticeably encumbered. Returning to Zerble transfers
the carried jugs under the seat and frees his hands. Full hands prevent actions
that require hands, including playing cornhole or ordering food. These are
requested design rules for the future walking mode, not implemented behavior.

**Confirmed follow-up:** one free hand is sufficient for cornhole and ordering
food, so Gary may do either while holding one jug. Stowing a jug immediately
refills Zerble; it does not remain a separately stored supply item. The transfer
trigger and behavior when the tank cannot accept all the juice still need design.
Driving over a jug already collects/refills through Zerble; it never leaves Gary
holding that jug after parking. Hand-carrying starts only with an on-foot pickup,
followed by a return to the cart.

This gives walking a useful small loop: park, step out, spot a jug, carry it
back, tuck it away and rejoin the festival. The visible load explains the slower
movement without a numerical weight meter. Keep this optional and ordinary;
do not turn every drive into a supply run.

Assistant recommendations for the design:

- Track the two hands explicitly, including the particular objects they own.
  A carried jug leaves the loose-pickup state once, stays visibly attached to
  the appropriate hand and cannot simultaneously refill the cart or belong to
  another actor. A full-handed collision must leave the extra jug available.
- Show carrying through posture, gait and the jugs themselves. Tune one-jug
  and two-jug speeds by feel; the proposed differences do not select numerical
  speed multipliers, stamina loss or mandatory dropping on slopes.
- Give actions a free-hand requirement and a plain availability explanation,
  such as “Free a hand first.” Two full hands block cornhole and food ordering.
  Cornhole and food ordering each require one free hand, as Gary confirmed.
  Decide the requirements of other activities separately rather than treating
  every activity alike.
- Keep a deliberate way to put a jug down. Stowing at Zerble should be easy,
  with clear feedback and no fiddly under-seat targeting. Decide whether the
  transfer occurs on approach or re-entry and what happens at a full or nearly
  full tank. Stowing refills immediately. Avoid double credit or silent juice loss.
- Account for interruption, water/falls, occupied hand transfers, cart movement,
  unloading and save/resume. Decide whether holding a jug blocks entry into
  seated activities, or whether those activities offer an explicit stow action.

Automatic loose-jug collection is an explicit exception to the general
deliberate-interaction rule below. Approaching a chair, shop or game still does
not activate it automatically. Verify hand capacity and pickup ownership at the
moment of collection rather than consuming the jug merely because it was nearby.

### First-person cornhole

**Gary's proposal, November 18, 2026:** cornhole could become a first-person
participation activity. The controls remain an open design question. This is an
activity-specific view, not a decision to make all walking first-person.

Assistant recommendation: prototype the pleasure of one physical throw before
designing a large minigame. Let Gary stand beside the board, look toward the far
board, see the bag in his hand and make a readable, weighty toss. Preserve the
shared game/turn ownership described above; a camera change alone does not make
an NPC game player-controlled.

A candidate control scheme to test:

- Mouse: move to aim, then hold and release the primary button to set power and
  throw. Keep aiming and charge feedback legible without requiring a perfect
  timed release.
- Touch: drag the view to aim, then hold and release a distinct Throw control.
  Give that finger its own ownership so charging does not also move the camera.
  Begin with this predictable scheme before evaluating a flick gesture whose
  sensitivity could vary with screen size and grip.
- Both: provide a clear cancel before release and an explicit leave-game action.
  Decide whether aim stays adjustable during charge, how assistance works and
  how much trajectory preview belongs in the festival. These are prototype
  questions, not accepted bindings.

Joining requires one free hand, and the bag itself needs
ownership during aim, charge, flight and resolution. Leaving mid-throw must
restore the walking camera/input and resolve the bag and turn consistently.
Keep the first proof small: join, aim, toss, observe the landing and score, then
leave cleanly. Preserve forgiving festival participation rather than requiring
a separate competitive progression system.

### Human smiles and emotes

**Gary's exploratory idea, November 18, 2026:** on-foot Gary could collect smiles
through interactions, rather than generating them passively by being present.
An emote menu inspired by Minecraft could offer dance moves and other expressive
actions, with additional emotes earned during play. Reward rules, acquisition,
controls and the specific emotes remain exploratory; this is not implementation
approval or a commitment to a separate progression system.

**Confirmed direction:** mostly choose a move and enjoy the scene, with some
watching others and joining what they are doing. Gary wants this relaxed and fun,
rather than a rhythm/timing performance test. New moves should arrive as a
surprise from joining activities, without advertised learning objectives or a
checklist. The endorsed subtle outlines below provide one participation cue;
the broader invitation language and smile rules outside yoga remain open.
Compare a quick selector inspired by Zelda's weapon selection with other
interfaces suited to touch, as recorded below.

**Assistant proposals, not settled reward rules:** recognize a shared moment,
such as returning a wave, dancing alongside someone, cheering together or
finishing a friendly cornhole exchange. Do not award a smile for every button
press or multiply rewards by the number of nearby spectators. Rare moves need
not earn more smiles than familiar ones. Some activities can remain entirely
unrewarded. A new move could arrive after joining a dance or spending time with
a group, with a small acknowledgment after the moment rather than an advance
unlock advertisement. Exact conditions and repeat-reward limits remain open.

Invitations can also come from the scene: a dancer making room, a returned wave,
an available mat or an NPC demonstrating a move. These are proposals to test
alongside outlines, not promises that every gathering teaches something. Keep
the contextual action for joining or sitting separate from the Moves control
for expressing yourself, so opening favorites does not become necessary for
every object interaction.

Preserve the accepted hand constraints when
exploring expressive actions; an emote cannot silently discard a held jug or bypass
an activity's free-hand requirement.

### Yoga participation and optional matching

**November 18 follow-up:** Gary is comfortable joining yoga and simply watching
the character participate; not every activity needs a reward. Choosing a pose
could be optional. A tentative alternative is for the same move selector to show
yoga poses during the session, allowing the player to recognize and match the
teacher or class within a forgiving window for a small bonus, possibly a smile.
This must retain the relaxed character of participation rather than becoming a
dedicated yoga minigame. Gary subsequently endorsed occasional smiles during the
session, rather than a reward for every matching pose. Matching mechanics and the
exact recognition/reward cadence still need exploration.

Design questions include automatic following versus deliberately selected poses,
how to return to following after a manual choice, how occasional shared moments
are recognized, and how the player recognizes the reference
pose. Automatic following must not accidentally satisfy a deliberate-match bonus.
The existing [pose renderer](../../src/models/healingArts.js) cycles participants
with individual phase offsets; a clear teacher/shared target pose and an explicit
pose identity would be new behavior, not an existing scored activity.

### Highlighting interaction targets

**Gary's endorsed visual direction:** nearby objects or opportunities could stand out
with a subtle outline that follows the projected shape of their 3D geometry.
This is a selection/discovery cue, not an overhead objective marker or a promise
of an unlock. Exact reach, targeting, appearance and rendering method are open.

Assistant recommendations to prototype: highlight a nearby, visible intended
target, retain it stably while the camera shifts slightly, pair it with a short
action label, and let occluding scenery hide the highlight. Outline the actual
interaction target, such as a free mat or chair, rather than a whole tent.
A world-space edge around a flat mat may supply the desired appearance without
a general silhouette effect. A true silhouette on more complex objects needs
phone-tier measurement before selecting a rendering approach.

The [mat renderer](../../src/models/healingArts.js) uses an InstancedMesh for the
mat collection. Selecting one mat therefore requires an instance-specific cue
or proxy; selecting the shared mesh for an object-outline effect would not express
the intended single-mat selection. No outline feature is implemented here.

### Moves menu comparison

Gary requested a phone-sized comparison of a six-slot wheel and a six-card tray.
Both should use the same example moves and expose the same functionality so
visual preference is not confused with a different feature set. The layout is
not selected. Keep familiar favorites stable; a new unlock should not silently
replace or move an existing shortcut.

The comparison explores selecting a move, returning to the world and reopening
the picker. It also explores switching the same picker to yoga poses during
participation and explaining hand restrictions. Candidate hand requirements for
individual emotes remain proposals; only cornhole/food ordering's one-free-hand
rule is settled.

The wheel suggests directional/drag selection, while the tray offers larger
labeled cards and readable pose previews. Both need deliberate cancellation and
phone testing. The full collection/favorite-management interface remains a
separate design question. This is a visual conversation prototype, not shipped
input code or a usability/performance acceptance result.

Saved comparison views: [six-slot wheel](moves-menu/wheel.jpg) and
[six-card tray](moves-menu/tray.jpg). These use illustrative figures and a
simplified scene, not captures of implemented walking gameplay. Both examples
use Wave, Clap, Shuffle, Cheer, Stretch and Goofy dance. The interactive
conversation preview also offers a yoga set and occupied-hand variations.

Initial assistant preference is the tray for reading names and recognizing poses;
the wheel offers the possibility of fast directional selection once positions
are familiar. That tradeoff still requires Gary's preference and physical-phone
testing. Selection, reopening, cancellation and the narrow layout were checked
in a browser; no physical touch, wheel-drag, reward or game integration claim is
implied by those checks.

**Gary's subsequent direction, November 18:** the wheel should float directly
over the world without the rectangular background and border shown in the
comparison. Explore an Apple Liquid Glass-inspired circular surface with some
transparency, background blur and a restrained light-bending/refraction effect,
so the scene remains slightly visible through it. It should emerge from the
Moves button. Gary proposed leaving it open until explicitly closed or tapped
outside; this supersedes the prototype's automatic dismissal on selection as
the next behavior to explore. Whether selecting or changing a move keeps it
open, and how outside taps avoid accidental world actions, need deliberate
design. The precise visual treatment, accessibility fallback and phone rendering
cost remain undecided. Do not revise the prototype or implement this effect yet.

The saved comparison is an earlier exploration, not the accepted visual target.
The wheel has this new direction; a final wheel-versus-tray decision remains
open and is tabled with the rest of the moves-menu project.

### Separate projects and Gary's movement foundation

**Gary's requested pacing, November 18:** table the moves menu, first-person
cornhole and walking gameplay as separate small projects, developing each piece
with care and iteration rather than implementing the whole wishlist together.
The ideas remain recorded here, but are not an active implementation request.

Gary suggested an early modeling session to establish the character's appearance
and an appropriate skeleton/rig before building out movements. Explore the
character in isolation first, reviewing proportions, joint placement and how the
body reads at game-camera distance. A skeletal rig versus a procedural joint
hierarchy is an open implementation decision, not a chosen asset pipeline.

Develop and review a small movement vocabulary incrementally: standing idle and
looking around, then walking and running, followed by individual actions such as
throwing a cornhole sack and waving. These are iteration candidates rather than
a required batch or fixed sequence. Check transitions, feet meeting the ground,
hand placement and Gary's personality as each movement takes shape. Carrying
jugs, sitting and yoga can later build on the approved foundation instead of
forcing every activity into the initial modeling session.

The character study should inform later walking controls and activity work;
it does not by itself settle camera, collision, animation blending, first-person
throwing or parked-cart ownership. Establish the visual/movement foundation,
then prove one complete walking interaction, and develop cornhole and the moves
picker in their own bounded iterations. Exact scope and order will be chosen
when each project is resumed.

### Summoning Zerble as a companion

**Separate future project, endorsed November 18:** Gary can call Zerble after
wandering on foot, so exploring does not turn the return trip into a chore.
Zerble should feel like Gary's little companion: Gary whistles, Zerble answers
with a beep, then comes to meet him. This character direction and the
whistle-and-beep exchange are accepted; autonomous pickup is not implemented
or authorized by this record.

The proposed arrival is a physical drive to a safe nearby pickup spot, respecting
terrain, obstacles and people rather than driving through an activity to reach
Gary's exact position. A nearby path rendezvous could serve inaccessible places.
Routing, arrival behavior, cancellation and the controls for calling remain
future design work, separate from the initial walking/modeling project.

Keep these questions explicitly open:

- **Passengers:** can Zerble be summoned while occupied, and what happens to
  riders, their destination, boarding, quest clocks and an interrupted pickup?
- **Getting stuck and recovery:** what happens when Zerble cannot find a route,
  becomes stuck en route or cannot reach a safe pickup spot? A brief transition
  that relocates him safely out of view was proposed as a fallback, but is not
  an accepted recovery rule.

Earlier assistant suggestions included avoiding fuel costs, cooldowns and
distance penalties, plus providing a clear cart-location cue and a reliable
return-to-Zerble option before autonomous pickup. These remain recommendations,
not settled mechanics or prerequisites. Walking should be developed and tested
independently of the eventual companion-summoning system.

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
