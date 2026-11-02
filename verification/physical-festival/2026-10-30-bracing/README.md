# Supported bracing pose

October 30, 2026.

## Implementation

[The reaction controller](../../../src/physics/seatReaction.js) now eases a bounded
brace amount toward one while supported and bracing, and toward zero on a save,
exit or fall. It advances only on accepted simulation time. The existing
[Crowd arm attributes](../../../src/crowd.js) spread free arms for balance without
moving the supported hips or adding geometry. A right hand with an existing drink
keeps its original socket while the free left arm braces.

## Evidence

- `node bin/test-person-reactions` verifies bounded input validation and pose
  storage; `node bin/test-physics-seat-reaction` verifies a real-engine wobble,
  zero-delta freeze and relaxation after a successful save.
- The production-Crowd [pose fixture](../person-pose.html) passes 41 assertions
  while braced, including held-drink arm preservation and unchanged root matrices.
  Low renders 51 draws, 5,058 triangles and 22 geometries before and after bracing.
- [Noon](low-noon.png) and [Midnight](low-midnight.png) show the static pose at
  normal character scale. The tilted sitter spreads both arms, while the upright
  drink holder uses the free arm. These are authored pose comparisons, not a
  recording of a complete successful save.
- Chrome main-game smoke passed a real Just Cruisin’ click, world boot, occupied
  encounter preparation and completed controlled exit. [Diagnostics](live-result.json)
  distinguish the completed dismount from the other supported occupants. No
  console errors were reported. Both owned tabs were closed and the temporary
  preview stopped.

- `npm run check` and `npm run build` passed, including the controlled exit
  regressions. Existing module-type and bundle-size warnings remain.

## Remaining acceptance

The full dynamic wobble/save/fall sequence still needs rendered acceptance and
phone feedback. This checkpoint does not finish the occupied-chair gate or
establish mobile performance. Transferable drinks and meaningful cooler lids are
still required by the overall feature.
