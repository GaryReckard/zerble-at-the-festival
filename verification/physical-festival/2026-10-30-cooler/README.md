# Closed coolers in the live prop simulation

October 30, 2026. Gary gave positive early chair-motion feedback, asked for more smashable objects, specifically coolers, and reaffirmed falling people. This checkpoint implements the closed cooler as the next distinct movable object; it does not implement a moving lid or falling occupants.

## Playtest

Open `http://localhost:8767/?physics=1&mute=1&perf=low&seed=1977&x=-883&z=-312.7&heading=1.57`, select **Just Cruisin’**, then **Stage cooler encounter**. Wait for the target to become active and press **Coast forward**. The staging helper may choose another loaded cooler if a nearby one lacks a clear approach. The phone uses the same path at `http://192.168.1.160:8767/` while on the same network.

Empty-object bumps retain resistance and sound without smile loss or punitive feedback. Eight total rigid props share the existing live capacity; extra objects retain static collisions. The closed cooler is heavier than the chair recipes and may slide, rotate or tip through the solver, but no final tuning or device budget is claimed.

## Implementation

- [Kitchen construction](../../../src/models/campsite.js) returns the actual cooler group. Reparenting preserves its pose while giving its collider an independent group rather than the canopy. Its three pooled geometry/material parts join the same source batching system as chairs, without adding RNG draws.
- [Camp registration](../../../src/campRegistry.js) publishes a stable cooler key, its own terrain-fit pose, source render binding and an empty seat list. No fake occupant slot is needed. The original chair-only descriptor list remains available alongside the new all-prop list.
- [Ownership](../../../src/physics/chairOwnership.js) supports the closed-cooler collision recipe under the same transaction, render/support reservations, unload transfer and source-regeneration suppression. The historical chair-owner API name is retained so every origin uses the same owner.
- [Live integration](../../../src/physics/liveWorld.js) enrolls coolers within the existing eight-object and terrain/static/render limits. The [staging helper](../../../src/physics/encounter.js) checks the approach up to initial contact rather than requiring a path through the target into adjacent kitchen furniture.

## Verification

[Cooler tests](../../../bin/test-physics-cooler) use the actual kitchen/cooler geometry with native Three transforms and real Rapier. At 30/60/120 Hz they cover independent registration, real cart impact, zero smile damage, source unloading, stable identity, hidden regenerated sources and zero owned engine/render counts on disposal. An enabled-terrain case proves that the source instances and physical descriptor agree under a rotated/scaled campsite root. [Targeted output](cooler-tests.log) records the results.

The existing cooler model tests still pass for 40 native builds, four finishes, two raycast-verified cup wells, shared resources, no shadow casters and 3 draws / 1,460 triangles per standalone model. Existing campsite layout/determinism, chair ownership/capacity and contact tests pass in [full command results](commands.txt). This is geometry and lifecycle evidence, not a phone frame-time measurement.

The production browser booted through the ready mode button on Low, staged a cooler and coasted into it. Comparing [before](before.json) and [after](after.json), cooler entry 1985 moved **1.60344 metres** in X/Z; another cooler remained at its prior position. The report recorded two total prop impacts, eight active props, no support block and no render rejection. The active pool had 16 buckets / 122 used slots against its unchanged 48-bucket / 3,072-slot limit. This is an observed allocation, not a matched performance improvement.

[Low daytime](noon-low.png) and [Mid nighttime](midnight-mid.png) captures inspect full-game appearance after launches at time-of-day 0.25 and 0.75. The simulation continued between launch and capture, so these are not frozen exact-time comparisons or close-up cooler silhouette proofs. [Low console](console-low.json) and [Mid console](console-mid.json) are empty. Geometry/finish preservation is established by the model and transform tests above.

Both agent verification tabs closed. The isolated port-8766 preview and previous user preview exited with code 130. Port 8767 now serves `/tmp/zerble-cooler-final.qo9Izs`, returned HTTP 200, and remains running by request.

## Limits and next work

Task 7.1 (Independent cooler descriptor) is complete. Task 7.2 (Heavy closed-cooler behavior) has real cart/cooler evidence but still needs the explicit chair-to-cooler and cooler-to-chair comparisons and feel acceptance. Lid mechanics, holder metadata/contents, cups and cooler-specific full acceptance remain unfinished. The shared owner retains some historical chair naming; this does not introduce a second ownership authority.

Gary's positive feedback is recorded as early chair-motion feedback, not as physical-phone approval or completion of every feel scenario. Falling people remain next major interaction work: supported seat load, balance loss, safe release, landing and recovery, with separate person consequences. The broader signs, aftermath and coherent distance reset scope remains active.
