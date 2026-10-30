# Ordinary-person fall integration

October 30, 2026, opt-in `physics=1`.

## Behavior and ownership

Eligible unclaimed ordinary adults can now fall after a direct cart collision.
[OrdinaryPeople](../../../src/physics/ordinaryPeople.js) prepares at most four
nearby people, with at most one new body per preparation call and no allocation
when the shared streaming deadline has expired. Prewarming does not claim walking
or freeze the person. Impact takes movement authority only after body and nearby
terrain/static support are ready; otherwise the ordinary legacy reaction remains.
Existing specialist, grouped, hidden, rider and activity exclusions remain.

[PersonFall](../../../src/physics/personFall.js) owns the disabled capsule and
budget reservation. Activation at impact does not allocate an engine body. The
shared reaction/recovery controller starts with straight legs, publishes through
existing Crowd instances, settles, finds a clear route and restores ordinary
movement. Repeat impacts cancel recovery. The standing body uses linear damping
0.35 and angular damping 1.2; the original 0.3 angular damping left a sideways
second hit rolling beyond the test's fifteen-second recovery window.

[CollisionContacts](../../../src/collisionContacts.js) now snapshots incoming
velocity and approach speed before the cart applies its reverse kick. Both seated
and ordinary reactions use that approach speed, preserving impact strength.
Person penalties remain at the existing game gate; empty props still cost no smiles.
Cart/person engine pairs are excluded so the legacy person collision callback
remains the direct-contact response authority.

Terrain/static owner capacity is twelve (eight furniture plus four pedestrians),
while total engine, tile and static-proxy caps remain unchanged. Contact-exclusion
capacity is 36, including the worst-case 32 occupied-seat pairs. Inactive reserves
are released after leaving the 24-meter preparation neighborhood. Despawn and
world disposal release active claims and resources. Cleanup failures remain
visible and stop stepping while preparation retries the retained cleanup.

## Verification

`npm run check` and `npm run build` passed. Targeted final tests passed after the
staging/counter additions and explicit expired-deadline/capacity cases:

- `node bin/test-physics-person-fall`: real engine, last-slot reservation,
  activation without allocation, straight-leg publication, tipping, landing,
  recovery, repeat hit, despawn, failed allocation and stale-generation cleanup.
- `node bin/test-physics-live-people`: production live world and collision resolver,
  terrain preparation, pre-kick velocity, photographer exclusion, ordinary
  recovery, repeated impact, despawn, disposal, unprepared fallback, four-person
  cap and expired-deadline refusal. Production Crowd methods use the existing
  fake-GPU population fixture; this is not a rendered game test.
- `node bin/test-people-collisions`: incoming speed survives a cart response that
  changes speed from 8 to -2, alongside existing collision/scoring regressions.
- `node bin/test-physics-live-occupants` and `node bin/test-person-reactions`:
  existing occupied support, regeneration, overlap escape and reaction ownership
  continue to pass. Reserved pedestrian contact pairs are distinguished from
  occupied-seat pairs in the count assertions.

Real Chrome, Low tier, seed 1977, `x=-1025&z=-482`, mute on: started through the
ready Just Cruisin' button, selected Stage pedestrian encounter, clicked Coast
forward and held W. The visible diagnostics reported person 31 recovering, then
one fall and one completed recovery with no active pedestrian claim. The saved
[result](live-result.json) includes two inactive prewarmed people, which account
for the remaining two contact exclusions. Later travel released those reserves,
and rendered diagnostics reached zero contact exclusions. Console: no warnings
or errors. No NPC was injected into the scene for this test.

[Noon](low-noon.png) and [Midnight](low-midnight.png) are post-encounter scene and
counter captures, not images of the falling body. No person geometry/materials
were added. Whole-world counts depend on streaming and population; these captures
do not establish a matched performance delta or phone acceptance.

## Playtest and remaining work

Launch with `?physics=1&mute=1&perf=low&seed=1977&x=-1025&z=-482`.
Choose Just Cruisin', then Stage pedestrian encounter once nearby people have
prepared. Click Coast forward promptly because the target keeps walking; W can
continue the approach, and Space stops the cart. The panel reports cumulative
pedestrian falls and recoveries. If no eligible person has a clear approach, it
reports that and does not manufacture a target.

The fall is a simple rigid capsule, not a jointed ragdoll. The current reaction
is a fall, not yet a graduated stumble/brace/dismount vocabulary. Secondary debris
hits and incident attribution, coherent reset, cooler lids/drinks/signs/aftermath,
matched performance and real-device audio/input acceptance remain unfinished.
Unprepared or protected people intentionally retain their existing reactions.
Test tabs and temporary verification server are closed; the user-requested
playtest server is updated separately.
