# Controlled occupied-chair exits

October 30, 2026, on `codex/physical-festival-integration`.

## Behavior

A moderately unstable supported sitter can prepare a short clear route and step
out over 0.8 seconds. Preparation shares the bounded terrain, body and nearby
person clearance planner used for recovery. Before releasing the seat, the
controller checks the current support pose and rechecks the first step and exit.
A brief wobble that stabilizes remains a successful save. A blocked route retains
the seated claim and mass until the support requires a fall. An impact or newly
blocked path during the step returns control to the existing fall/recovery path.

The same person activity claim publishes the pose throughout the exit; the
reserved body activates and the supported load and seat release once. Ordinary
walking resumes only at the final feet position. Independent loveseat occupants
use independent routes and claims. Existing hand visuals remain under that person
claim; transferable drink identities are separate unfinished work.

Sources: [reaction controller](../../../src/physics/seatReaction.js),
[route planner](../../../src/physics/standRecovery.js),
[occupied integration](../../../src/physics/occupiedSeats.js).

## Verification

- `node bin/test-physics-dismount` passed clear/blocked ground/blocked wall,
  settled wobble, moved start, changed exit, pause, second impact and despawn
  cases against real Rapier shapes and person claims. Preparation uses at most
  five shape queries per call; the continuous exit test limits each published
  step to 0.15 metres and checks one load/seat release and complete cleanup.
- `node bin/test-physics-live-occupants` passed both camp and stage loveseats,
  including two independent completed exits, real activity transfers, source
  regeneration and cleanup. Completion explicitly distinguishes a dismount from
  a fall followed by recovery.
- `npm run check` and `npm run build` passed. Node module-type and build chunk-size
  warnings remain.
- Chrome used the production build with Low, seed 1977, mute enabled, an actual
  Just Cruisin’ ready-button click and the live Stage occupied encounter control.
  Try occupied-chair exit completed for person 40 on entry 2604. The saved
  [live diagnostics](live-result.json) report `completion: dismount`, the released
  seat and ended claim, while three other sitters remain supported. No console
  errors were reported.
- [Noon](low-noon.png) and [Midnight](low-midnight.png) captures show the live scene.
  The canopy obstructs the upper camera view, and these are scene captures, not
  close-up animation acceptance or proof of every intermediate pose. The Noon
  capture precedes the completed result; Midnight follows it.

## Limits and next steps

Clearance is bounded discrete sampling, not a continuous character sweep.
Animation polish, moving-person sweeps, full occupied-chair visual acceptance and
real iPhone/iPad performance remain open. The observed world counters are not a
matched performance comparison and substantially exceed the HUD guide budgets.
No geometry was added by this exit behavior. Next, finish the supported bracing
visual and inspect the complete wobble, save, exit and fall sequence before
expanding cooler lids and transferable drinks.
