## Context
The previous Zerble set X/Z, sampled four ground heights and sent a kinematic trajectory to live Rapier. Terrain/static collision residency follows props and people. Rapier 0.21.0 supplies a dynamic raycast vehicle controller. Local research found currentVehicleSpeed includes fall speed, so signed longitudinal speed must be separate. The [Rapier vehicle documentation](https://rapier.rs/docs/user_guides/javascript/vehicle_controller/) describes the rigid chassis and raycast suspension, and the [cannon-es driving example](https://github.com/pmndrs/cannon-es/blob/master/examples/raycast_vehicle.html) illustrates the same approach with steering, wheel transforms and uneven ground.

## Goals / Non-Goals
Goals: continuous physical ground/air driving, forgiving steering and recovery, real surface traction, coherent engine effort, shallow water crossings, depth-aware submersion and impact damage. Non-goals: physical wheel joints, detachable cargo, repairs/shop gameplay and autonomous-vehicle rewrites.

## Decisions
- Adapter owns vehicle controller handles and runs vehicle forces before its existing world step; no second world or clock.
- One chassis with four wheel rays, grounded propulsion, lateral grip and yaw impulses depend on actual contact profiles; native wheels supply suspension; full quaternion and vector velocity are authoritative. Retain heading/signed speed as compatibility projections.
- Player reserves terrain and solid support independently, retaining old geometry until replacement ready. Water/landscape readiness is distinguished from physical loss of wheel contact.
- Lake depth uses shared analytic bed and shoreline water query; physical bed and visual bed agree without changing RNG. Streams keep native cut-bed truth; bridge rays hit slabs and water only applies below its level.
- Engine envelope derives throttle/load/contact and immersion, not fall speed. Keep synchronous initialization and Lurleen compatibility.
- Incident-based severity feeds a bounded damage meter; chassis hits and hard landings count once per impact episode. Saturation and sustained engine-depth water use existing game-over UI. Both modes end but only Festival Run submits festival scores. Repairs remain future work; expose bounded restoration API.
- First build headless regression and a visible bounded driving course, then wire live game and verify title gesture, terrain/water/prop collisions and cleanup.

## Risks / Trade-offs
- Coarse scenery cylinders -> audit supported obstacle geometry, exclude invisible lake-edge barriers for player.
- Slow preparation -> explicit player reservation and pre-step gate, old geometry retained; no unsupported solver steps.
- Chassis rollover -> tune mass/suspension and bounded safe recovery without midair snapping.
- Passenger quaternion mismatch -> inherit vehicle transform and prevent boarding/exiting while airborne/submerged.
- Boot/audio -> async physics preparation outside synchronous Sound.init gesture; no Three namespace assignments.
- Determinism/disposal -> no RNG reorder, bounded owned handles and explicit teardown; no added shadows/lights.

## Migration Plan
Existing seed identities and actor generation draws remain unchanged. Lake collision beds become deeper intentionally, with shoreline/water visuals retained. No persisted vehicle physics state is introduced; existing resume placement resets dynamics safely.

## Open Questions
None blocking. Physical-device handling/audio tuning will be recorded separately from desktop evidence.

## Focused handling pass, November 2
Use a contact-plane target speed and a 2.1 rad/s full-input yaw target with bounded impulses, no pose or velocity assignment. Fade traction on steep ground and partial support, and fade lateral/yaw authority in water. Keep normal 18 m/s and boost 27.9 m/s road targets, with surface scaling and downhill momentum. Native wheel lateral stiffness is negligible so it cannot fight the force controller. The chassis yaw inertia approximation is local to this fixed cart geometry. [Replay evidence and acceptance limits](../../../verification/driving/2026-11-02/handling-pass.md).
