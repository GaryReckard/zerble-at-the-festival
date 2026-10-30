# Clear stand-up recovery

October 30, 2026. The [recovery planner](../../../src/physics/standRecovery.js) extends the occupied reaction with a bounded local slide-and-rise sequence, and [Crowd](../../../src/crowd.js) accepts a continuous seated-leg blend. It remains a fixture-level capability until live chair ownership and terrain support are connected.

## Contract

The planner tries sixteen deterministic nearby targets, using a caller-supplied traversable ground result and current engine shape contacts. Each candidate has 24 path samples; preparation advances at most four samples per accepted step, plus an initial-overlap query and, when the candidate finishes, one playback recheck. Each query has an adapter collider-test cap and returns failure rather than treating exhausted work as clearance. No random stream changes, extra timer or expanding world search is introduced.

Existing initial penetration may be exited, but the sampled route cannot deepen it beyond a 5 mm numerical tolerance or introduce a new penetration. The final target cannot retain penetration. The chosen route is checked again during playback; changed support or collisions stop it. Slide and rise interpolate the capsule pose and leg bend under the same person claim, then match the upright feet-origin pose before releasing that claim and its temporary body. A second impact interrupts recovery and retains the current leg blend. These are conservative sampled checks, not a continuous swept-volume proof for arbitrarily thin moving geometry.

## Evidence

[Real-engine recovery tests](../../../bin/test-physics-stand-recovery) cover tipped-chair landing, ordinary walking resumption, one seat release, body/budget cleanup, blocked and changed ground, a second impulse and despawn. The maximum observed per-step person-position change must remain below 20 cm in each scenario. A separate thin-wall case proves a clear destination does not authorize a path through an obstacle; stale body generations and exhausted queries fail closed. The test also caps the per-call query count at six. [Person capability tests](../../../bin/test-person-reactions) reject invalid leg-blend inputs.

The [production-model fixture](../seat-reaction.html) completes the fall and recovery, leaving the person visibly upright beside the fallen chair. Its counters remain at the supported baseline of 29 draws and 2,006 triangles. Recovery removes the person body, supported load and temporary contact exclusion, leaving just the chair and floor. Explicit disposal removes all engine resources and budget records. Low uses Lambert and Mid uses Standard materials.

Captures: [Low Noon](low-recovered-noon.png), [Low Midnight](low-recovered-midnight.png), [Mid Noon](mid-recovered-noon.png), [Mid Midnight](mid-recovered-midnight.png). The Low captures precede the later change that spreads planning over several steps; presentation and completion counters are unchanged. Mid exercises the final bounded planner.

The full `npm run check`, standard production build and fixture build passed. Low and Mid fixtures had no captured console warnings/errors, and the main game booted through the ready Just Cruisin’ button with a rendered world and clean captured console. Owned tabs and the temporary preview were closed; Gary’s separate cooler preview remains unchanged.

## Reproduce

Use the build/preview commands in the [reaction fixture report](../2026-10-30-seat-reaction/README.md#reproduce), then run the tipped-chair fall. Its four-second simulation now includes recovery. Close the tab and stop the preview afterward.

## Limits and next integration

The fixture supplies a flat floor, not streamed production terrain. Integration must supply resident traversable support, count query work inside the shared frame budget, and coordinate all active occupants. The capsule remains a simple body approximation; visual acceptance, active-crowd clearance, displaced-chair seating and phone performance are not established by this proof. The requested full feature and occupied-chair acceptance tasks remain open.
