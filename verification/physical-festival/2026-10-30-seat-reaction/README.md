# Occupied reaction controller and visible fall

October 30, 2026. The [controller](../../../src/physics/seatReaction.js) connects a current person claim, supported load, reserved fall body and existing Crowd pose publication. It runs on accepted simulation steps and owns no independent loop or person lifetime.

## Behavior

The controller distinguishes supported, bracing, falling and settled states. Bracing currently supplies stability hysteresis only, without a corrective force or visible arm gesture. A brief wobble can return to supported; sustained large tilt/spin or immediate inversion releases the reserved body. Zero accepted time cannot trigger release. The seat callback runs once, while the person retains the same activity claim and curled-leg pose throughout the fall. Low speed alone is insufficient to mark a landing: the caller must confirm ground support. A second impact returns the existing reaction to falling, and a stale claim stops publication.

The new continuous-pose regression found an adapter defect: Rapier collider world positions lag a direct body pose change until stepping. `readSupportedLoad` now composes the current rigid-body pose with the stored local load point, so release uses a coherent position and rotation even before a solver step.

## Evidence

[Controller regressions](../../../bin/test-physics-seat-reaction) use real Rapier resources and the production population claim methods. They cover wobble/save hysteresis, moderate instability dwell/reset, paused inversion, continuous feet-origin publication, one release, grounded settling, repeated impact, replacement and cleanup. Existing supported-load and seat-release suites pass. The full repository checks, standard production build and extra fixture build passed.

The [browser fixture](../seat-reaction.html) uses production Crowd, a real sling chair and its collision recipe, the reserved capsule and a flat ground collider. Its initial tilted-chair pose is authored; the subsequent fall and landing are solved by Rapier. Low and Mid each reached settled after 240 fixed steps, with one seat release, zero remaining supported loads, three bodies and eight colliders. Draw counts stayed at the supported baseline of 29 draws and 2,006 triangles. Low uses Lambert, Mid uses Standard; these are scene counters, not device performance measurements.

- [Supported sitter](low-supported.png)
- [Low Noon fall](low-fallen-noon.png) and [Low Midnight fall](low-fallen-midnight.png)
- [Mid Noon fall](mid-fallen-noon.png) and [Mid Midnight fall](mid-fallen-midnight.png)

Both disposal controls reported zero bodies, colliders, supported loads, contact exclusions and budget records. Both consoles had no captured warnings/errors. The bounded fixture stops its animation loop after four simulated seconds and cancels it on disposal/page exit.

A fresh Low main game booted through its ready Just Cruisin’ button, rendered the world and had no captured console warnings/errors. All owned test tabs were closed and the temporary preview stopped; the separate user cooler preview was not changed.

## Reproduce

```sh
node --input-type=module -e 'import {build} from "vite"; await build({build:{outDir:"/tmp/zerble-seat-reaction",rollupOptions:{input:["index.html","verification/physical-festival/seat-reaction.html"]}}});'
npm run preview -- --outDir /tmp/zerble-seat-reaction --host 127.0.0.1 --port 8766
```

Open `/verification/physical-festival/seat-reaction.html?mute=1&perf=low`, click Run tipped-chair fall, then repeat at Mid and inspect Noon/Midnight. Reload for another encounter. Finish with Dispose fixture, close the tab and stop the server.

## Remaining acceptance

The final pose visibly overlaps the original chair, so its contact exclusion correctly remains active. This requires clear recovery placement; it is not final visual acceptance. The fixture does not implement a walking exit, stand-up blend, terrain recovery planner, real campsite occupant transfer, direct cart/person impact or phone checks. Ground support here uses the capsule extent against the fixture’s flat floor. Live integration must supply terrain/contact evidence rather than reuse this floor assumption. No full occupied-chair task has been marked complete.
