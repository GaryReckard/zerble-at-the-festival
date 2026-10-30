# Independent occupied-seat load proof

October 30, 2026. This is engine support for upcoming occupied-chair behavior;
the live game still admits empty chairs and closed coolers only.

## Implementation and limits

`src/physics/rapierAdapter.js` owns generation-checked supported loads. Each load
is a mass-bearing spherical sensor attached to its supporting body, with zero
collision/solver groups and no events. It contributes mass, center of mass and
inertia without creating a second independently simulated person. Both the
explicit supported-load capacity and the existing collider capacity apply;
supported-load capacity defaults to zero and is not enabled in the live world.

The approach follows Rapier's documented [collider mass contribution](https://rapier.rs/docs/user_guides/javascript/colliders/#mass-properties)
and [world-space point velocity](https://www.rapier.rs/javascript3d/classes/RigidBody.html#velocityAtPoint).
Tests below exercise the pinned installed 0.21.0 engine, rather than assuming
the online API establishes runtime behavior.

Adding, moving or removing a load recomputes mass properties immediately. Because
linear velocity describes the center of mass, the adapter adjusts that velocity
to preserve the body's existing velocity at its origin when the center shifts.
This keeps other supported seats continuous. A release snapshot includes world
position, orientation, point velocity and angular velocity. The caller must
remove that supported load before activating an independently weighted person.
This API does not itself reserve the future person body, establish a person
activity claim, decide when to release, or animate a fall.

## Tests and observations

`node bin/test-physics-supported-loads` uses the real loveseat compound recipe
and Rapier WASM. It verifies:

- Independent 65 kg and 80 kg loads, mass removal exactly once, and center-shift
  velocity continuity under nonzero translation and three-axis rotation.
- Load-position changes suitable for a later bracing controller, without stale
  local metadata or a discontinuity in the supporting body's velocity field.
- Release into one independent body carrying the support's orientation, linear
  point velocity and angular velocity; total mass and linear momentum match
  before and after the tested release, within floating-point tolerance.
- A mass-bearing sensor overlapping another body generates no events or
  impulses, while the supporting body responds to impulse using its loaded mass.
- Invalid arguments, stale body generations, duplicate loads, zero load capacity,
  exhausted collider capacity, foreign-world tokens and reused load IDs.
- Allocation failure and an injected post-allocation mass-update failure both
  restore owned counts and mass; 100 add/remove cycles preserve baseline counts.
- Body removal and adapter disposal clear attached load lifetimes and resources.

The test is included in `npm run check` and `npm run test:physics`. No CPU/device
budget or visual approval is inferred from these deterministic engine tests.
The radius and masses in the tests are fixtures, not accepted character tuning.
The focused test, physics suite, full `npm run check`, and production build all
exited 0. The full check included the final impulse and release-momentum cases.

The production build at `/tmp/zerble-supported-loads-20261030` booted in Chrome
tab 380986114 through the ready Just Cruisin' control, with physics enabled,
mute, Low and seed 1977. The title closed, the world ran with two active props
and 17 bodies, and the console warning/error list was empty. The tab closed and
the temporary port-8766 preview exited 130. The user preview on port 8767 was
not replaced. No visual meshes changed, so no new Noon/Midnight comparison is
claimed. This is a compatibility smoke test, not an occupied-chair demonstration.

## Remaining work

Task 5.2 (Supported load and bracing) remains incomplete: connect prepared
person/support claims, set measured admission reservations, and implement the
stability/brace controller. Continuous fall handoff, collision separation,
landing/recovery, normal-camera visual acceptance and phone measurements remain
required by the existing plan.
