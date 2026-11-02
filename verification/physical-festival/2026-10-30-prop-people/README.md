# Moving props and ordinary pedestrians

October 30, 2026. Opt-in `physics=1`; rendered secondary-impact acceptance remains open.

## Implementation

[BodySweep](../../../src/physics/bodySweep.js) advances through a supplied linear
translation and shortest quaternion arc using shape separation and a bound on
relative surface travel. [RapierAdapter](../../../src/physics/rapierAdapter.js)
queries the real compound primitives, including disabled pedestrian reserves,
without changing their poses, enabling bodies or advancing the simulation.
Contacts include world points, normal, fraction and closing surface travel.
Sensors are excluded, stale generations fail, and mesh sweeps are unsupported.
A query has at most 64 iterations and the caller's collider-pair budget; exhausted
work returns an explicit failure rather than a miss or guessed contact.
The same travel bound rejects motion below the fall threshold before any WASM
distance query, avoiding steady work for settled furniture.

[OrdinaryPeople](../../../src/physics/ordinaryPeople.js) spends at most 512 shape
pair tests per accepted step across four reserved pedestrians and admitted props.
Only eligible, prepared pedestrians participate. Contacts are ordered by sweep
fraction, then checked against remaining contact-point velocity. Response uses
both bodies' effective mass and rotational inertia, restitution 0.1, approach
threshold 1.2 m/s and a 6 m/s person impulse cap. Equal opposing impulses prevent
the first hit's momentum from being reused at full strength for later recipients.
Activation uses the existing claim, reserved body and recovery controller.
Already-active fall bodies remain solver-owned, without another scripted kick.

[LiveWorld](../../../src/physics/liveWorld.js) snapshots admitted prop poses before
each engine step and delivers swept contacts after solver and incident relay.
Available incident history records a generation-qualified person target once;
unattributed or expired props can still physically strike a person. This adds no
indirect smile penalty. Direct-person and empty-object score policies are unchanged.

## Evidence

- `node bin/test-physics-body-sweep`: actual Rapier shapes catch fast crossings
  and rotation-only intersections between clear endpoints; nearby misses,
  relative motion, offset compound shapes, sensors, quaternion sign equivalence,
  disabled reserves, stale generations and capacity failure are covered.
  Predicted rotated contact-point response is compared with a real applied impulse.
- `node bin/test-physics-prop-people`: real adapter and Crowd claim methods test
  activation, equal opposing linear momentum, target ordering independent of
  population slots, depletion before a second recipient, no duplicate scripted
  kick, protected/unprepared targets, attribution expiry and cleanup. Terrain
  readiness is an explicit fixture stub; this test does not establish streaming.
- `npm run check` and `npm run build` passed, including existing live terrain,
  ordinary-person and occupied-chair regressions. Both new tests are in the
  standard check and physics scripts.
- Real Chrome, Low, seed 1977 at `x=-1025&z=-482`, muted: clicked the ready
  Just Cruisin' control, booted the world, staged a pedestrian and drove into them.
  One direct fall completed recovery, with no console warnings/errors. The
  [saved diagnostics](live-smoke.json) report `started: 1`, `completed: 1`,
  `propHits: 0`. This is an integration smoke test, **not visual proof of a
  secondary impact**.
- The [first boot snapshot](final-boot.json) exposed 144 shape tests in a quiet
  step with three prepared people. After adding the motion-bound rejection,
  the [final build snapshot](idle-optimized.json) has four prepared people,
  eight active chairs, zero shape tests and no rejection after 643 steps.
  Both builds booted through the ready control with an empty warning/error log.
  These are workload counters, not a matched timing or phone-performance result.

## Limits and next acceptance

The sweep proves the supplied interpolated path, not an arbitrary internal
solver trajectory. Endpoint snapshots cannot reconstruct multiple revolutions or
intermediate rebounds. Pedestrians are queried at their currently published pose;
this does not yet sweep their independent crowd motion. Work exhaustion remains
visible as `lastReject`, but overload feel still needs acceptance. Reserved bodies
are limited to ordinary eligible adults; supported sitters and specialists do
not enter this new delivery path.

Build a repeatable rendered prop-to-person encounter next, including a moving
pedestrian, a rotating chair, multiple recipients and exhausted preparation.
Capture actual secondary falls at Noon/Midnight and test on the phone before
closing task 4.3 (bounded incident provenance) or broad secondary-impact acceptance.
The cooler staging control also selected a non-admitted cooler while eight chairs
were active during this smoke run; its admission priority needs a regression test.

Rapier's [shape contact contract](https://rapier.rs/javascript3d/classes/Shape.html#contactShape)
defines world-space witnesses and signed separation. Its
[rigid body API](https://rapier.rs/javascript3d/classes/RigidBody.html)
defines point velocity and effective world inverse inertia; behavior above is
tested against the installed 0.21.0 engine rather than inferred from current docs.
