# Adding a person behavior without coupling people to places

## Current executable example

A population owns who exists and how its storage/rendering work; an activity borrows
one eligible person; a place adapter owns its reservations and approach/exit targets.
These responsibilities connect through handles and public commands, so the activity
does not need to know whether the person uses instanced meshes or Map storage.

The working example is [PlaceVisitActivity](../../../src/people/placeVisit.js),
[its routine contract](../../../bin/test-people-extension), and the
[inspectable browser fixture](../../../verification/people/extension.html).
The same implementation runs against Crowd's real public methods and an independent
[Map-backed fixture population](../../../verification/people/fixturePopulation.js).
Two [place adapters](../../../verification/people/fixturePlaces.js) demonstrate a
standing-slot array and an exclusive counter with a resource generation.
The example is intentionally used only by verification; it does not enroll live
children or change the eligibility/selection policies of existing festival places.

## What an activity needs

1. Supply a population's public operations: `readPerson`, `claimActivity`,
   `writeActivityPose`, `setActivityBinding`, and `endPersonActivity`.
   Keep raw-record lookup inside the population. The routine example receives a
   frozen object containing only these methods, so a private dependency fails.
2. Supply explicit eligibility and selection. A compatible protocol is not
   authorization to make every person do every activity. Existing group obligations,
   protected states, role exclusions, locality, cooldowns and choice order remain
   population/activity policy. A person handle preserves identity across the visit.
3. Reserve a place inside synchronous claim preparation. Register tentative cleanup
   with `attempt.own(...)`; return failure when capacity or the resource lifetime
   is invalid. A failed reservation leaves the current activity intact.
4. Let the place supply and validate its approach/exit targets and local clearance.
   The example uses simple bounded walking; existing activities retain their authored
   routing/steering. It is not a replacement pathfinder for the festival.
5. Move only through the current claim. The example advances from approach to visit
   to exit using caller-supplied accepted deltas, with no timer or animation loop.
   Its optional stand-in rig is reserved and released by the place; the population
   remains responsible for restoring the ordinary visible binding.
6. Release on completion, interruption, missing person, place unload, or owner
   disposal. Stop new writes first, release borrowed resources while metadata/render
   resources are live, then let the population resume. Old handles or releases must
   not touch a new occupant or a newer activity.

These steps are executable in `node bin/test-people-extension`, including the
2-population × 2-place × 2-binding matrix, same-frame contention, unload, person-first
removal, and incoming-activity disposal during outgoing cleanup. Claim failure ordering
is covered by `node bin/test-activity-claims`.

## Applying the boundary to the requested venues

The existing live activities have migrated, while the reusable example proves the
connection contract without adding new player behavior. Food-truck service and new
cross-family venue participation still require deliberate gameplay selection.

| Place | Keep with the place/resource owner | Keep with the activity/population policy |
| --- | --- | --- |
| Stage | Valid audience destinations and any deliberately reserved spots | Which people watch, how they approach, duration and interruption |
| Porta-potty | Occupancy, door state, valid resource identity and exits | Eligibility, selection order, waiting, use and interrupted departure |
| Food truck/vendor | Counter/customer reservation and service location | Selection, approach, purchase/service behavior and cooldown |
| Healing Arts | Rig slots, pole/entry constraints and tent lifetime | Yoga/dance changeover, eligibility, motion samples and exit policy |
| Nut wagon | Vehicle physics, seat identity, capacity and vehicle lifetime | Boarding choice, group coordination, movement authority and safe disembark |

The existing responsibilities are inventoried against the original source in the
[coverage ledger](coverage-ledger.md), and the current Healing Arts ownership example
is [HealingArtsActivity](../../../src/healingArtsActivity.js). More specialized venue
behavior can use the same claims/person operations without inheriting this example's
simple visit sequence. Add a local adapter or selection entry where needed; do not
add a central switch over every combination of population and venue.

## Verification recipe

Run the routine contract, then open
`/verification/people/extension.html?mute=1&perf=low`. Both visitors enter using the
same behavior, while the right-hand fixture uses a gold stand-in rig. Finish the
visits and verify that ordinary rendering and each reservation format are restored.
The fixture renders on demand and closes its owned runtime/GPU resources on page exit.
Run the mixed workshop and full ready-title Low/Mid game paths for production changes;
the example does not establish physical-device acceptance or whole-refactor completion.


## Choose the smallest participation contract

| Change being added | Registration and implementation needed | Production example / proof |
| --- | --- | --- |
| New interactive population | Create one registered controller, own its storage/handles and cleanup, declare only supported schedule/query/reaction/collision capabilities; compose its constructor once in main. | `people/children.js`, `test-children-ownership` |
| New activity for an existing person | Reuse the current handle; acquire a current claim, reserve resources transactionally, write through validated commands, and release on every exit. No second person registration. | `healingArtsActivity.js`, `people/placeVisit.js`, `test-people-extension` |
| New role or appearance | Keep the same population lifetime and ordinary render pool; add the role's eligibility/pose/binding locally. | `photographer.js`, `test-photographer-ownership` |
| Animated place decoration | Lend an existing place updater through `PlaceDisplay`; do not create person handles, queries or colliders solely to animate a model. | `people/placeDisplay.js`, `test-place-displays` |
| Vehicle inspection/selection | Expose copied person fields without transferring physics or granting activities. | `people/vehiclePersonFacet.js`, `test-vehicle-people-queries` |

The composition root still names the constructors it creates, and a sandbox selector
still names its inspectable fixtures. Those are intentional catalog changes. New
families do not need per-family honk, collision or inspection branches. Add modules
to all five importmaps, a fixture selector if needed, and the routine contract suite.
`node bin/test-people-boundaries` protects runtime/model/public-consumer directions.

## Concrete behavior wiring

The executable equivalent of this sketch is `verification/people/extension.html`:

```js
const visit = new PlaceVisitActivity({
  people: eligiblePopulation,
  place: venueAdapter,
  eligible: view => !view.claimed && ['idle', 'walking'].includes(view.state),
  key: 'venue-visit',
  speed: 1.45,
  duration: 8,
});
// A local selector supplies an eligible handle, never a raw population record.
visit.start(personHandle);
// The existing scheduling owner calls this at its documented dependency slot.
visit.update(acceptedDelta);
// Place unload or controller shutdown ends the visit and its borrowed resources.
visit.dispose();
```

This sketch omits authored approach routing and selection frequency. Supply them
locally rather than copying this straight-line fixture movement into an occupied
festival. The population facade validates motion authority and fallback rendering;
the adapter provides `reserve(person, attempt)`, `isLive(reservation)`,
`readTarget(reservation, phase, scratch)`, `canApproach(...)` and optional enter/leave
hooks. `attempt.own(release)` rolls back tentative resources on acquisition failure
and releases committed resources later. Compare exact resource identity, not merely
coordinates or slot numbers, so a replacement stall or seat cannot be cleared by
an old visitor's callback.

## Venue integration matrix

| Venue | Current live integration | Deliberate extension point |
| --- | --- | --- |
| Stages | Ordinary Crowd attraction and place-owned stage performer display remain separate. | Add an audience/queue adapter with valid standing destinations or optional reserved spots, then choose eligible populations locally. A performer's decorative rig is not automatically an audience person. |
| Porta-potties | `PottyActivity` owns eligible adult selection/motion; registered unit owns occupancy/door/lifetime. | Reuse or adapt the unit resource interface for another explicitly compatible population, including size/exit clearance and interrupted departure. |
| Food trucks / vendors | Vendor browsing/purchase uses `MarketActivity` and tent frontage. Food trucks currently publish truck geometry/collision and court tables, not that vendor service resource. | Add a food-truck counter/service adapter, retain its truck/chunk lifetime, and reuse the visit contract for approach/reserve/service/exit. Do not infer a counter from a collision body or silently enroll children. |
| Healing Arts tent | Activity owns trajectory samples and claims; tent owns rig slots; Crowd retains people. | Add compatible population motion/binding operations and explicit yoga/dance eligibility, keeping rig size, prior-sample cadence and unload rules. |
| Nut wagon | Vehicle owns physics and seat resources; public passenger commands and `SeatReservations` coordinate adults/monks/driver. | Explicitly add a compatible boarding policy and seat/body fit checks for a new population; a person query facet alone cannot board. |

## Population eligibility matrix

| Family | Read/query or display participation | Existing-person activity authority |
| --- | --- | --- |
| Ordinary adults | Public handles, nearby views, ordered collision/honk/cheer | Production claims and typed motion/binding commands |
| Photographers | Same adult handle with salted role/pose | Adult claims with role/protected-state selection |
| Children | Independent handles, nearby/honk/colliders | No automatic live adult activities; cross-storage protocol is demonstrated by the fixture population, so a child-specific compatible borrowing policy is explicit future work |
| Wooks | Independent handles/query/parked-honk/colliders | Specialized movement owner; no implied adult claim facade |
| Puppet carriers | Independent handles/query/honk/colliders; puppet is a prop | Formation movement owner |
| Brass musicians | Independent handles/query/honk/colliders/audio | Formation movement owner |
| Hoopers | Handles/query/active-place colliders | Hooper/place controller owns motion |
| Frisbee players | Handles/query/colliders; pair owns disc intent | Pair controller owns motion |
| Monk parties | Member handles stay in Crowd; group supplies intent/avatar | Group/public adult operations and atomic boarding, no second lifetime |
| Wagon driver | Same Crowd handle survives wagon despawn | Existing public seat/passenger commands |
| One-wheel riders | Query identity, registry-only collider | Vehicle physics owner, no activity capability implied |
| Lurleen | Read-only person facet and existing relationship integration | Existing vehicle/relationship owner |
| Healing Arts visitors | Borrowed Crowd identities and tent display rigs | Current claim owns sampled movement/binding |
| Stage performers | Place-owned display adapter | No interactive lifetime merely for animation |
| Sugar Shack cooks | Place-owned display adapter/local patrol | No interactive lifetime merely for animation |
| Vendor keepers | Tent-owned display/service metadata | Customer activity stays separate |
| Birds | Ambient flock/perch system | Outside the people domain |

The [coverage ledger](coverage-ledger.md) is the immutable before inventory;
[acceptance](acceptance.md) maps every row to current executable evidence. Supporting
a new interaction means adding a verified contract where it is actually needed,
not pretending every family already supports every activity. This preserves authored
character differences while giving future behavior one predictable integration path.
