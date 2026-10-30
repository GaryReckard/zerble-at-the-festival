# Cooler hinge and contents comparison

October 30, 2026. This is an experiment, not live cooler behavior.

## Alternatives and provisional selection

The [comparison implementation](../../../src/physics/coolerExperiment.js) builds
identical hollow cooler bodies, separate contact lids and six preallocated
cylindrical cans. The controlled alternative uses a clamped single-axis model
responding to gravity and base translation, published as a kinematic lid. It
cannot transfer hinge torque or contents impulses back to the base. The physical
alternative uses the adapter's revolute joint, a closed-angle latch and 0–1.85
radian open limits, with body/lid self-contact disabled.

Carry the **physical hinge** forward because the tested implementation preserves
force exchange and substantially better anchor attachment during ordinary and
strong corner impacts. This is a comparison of these two implementations, not a
proof that every controlled implementation must perform worse. Production
selection remains gated on tighter hard-landing error, bounded live admission,
render-part ownership and phone measurements. Task 7.5 (Lid and contents
experiment) remains open until those decisions are concrete.

## Recorded results

[Eight real-engine runs](engine-results.json), each 480 steps at 1/60 second,
cover rest, ordinary impact, strong off-center impact and inverted landing.
The impulses are diagnostic inputs, not approved cart tuning.

| Scenario | Controlled maximum hinge separation | Physical maximum hinge separation |
| --- | ---: | ---: |
| Rest | 12.6 mm | 0.38 mm |
| Ordinary impact | 38.5 mm | 1.01 mm |
| Strong corner impact | 150.3 mm | 41.9 mm |
| Inverted landing | 71.0 mm | 35.6 mm |

The physical inverted landing exceeded its angular limit by **0.138 radians
(about 7.9 degrees)**; the strong impact exceeded it by 0.048 radians. These are
unresolved constraint errors, not accepted production tolerances. The regression
bounds (80 mm / 0.15 radian / 30 m/s) catch instability in this initial fixture;
they do not establish release quality or energy conservation.

Each world uses nine bodies and thirteen colliders including its floor, with
one joint for the physical variant or one suppressed contact pair for the
controlled variant. Six can slots are allocated before impact. Every run checks
finite poses and velocities, floor support, zero event overflow and complete
teardown. The final can positions can differ because the two lids exchange
forces differently. This does not yet test live contents admission or reuse.

The first strong-impact fixture used a floor only 20 metres across. Recorded
can positions crossed its edge before falling, so that apparent ground failure
was corrected by enlarging the fixture floor. Do not interpret it as tunneling.

## Browser verification

The [side-by-side fixture](../cooler-lid.html) uses production cooler geometry and
exactly 480 fixed simulation steps, with reset, pause and disposal. Its
[browser inverted result](browser-inverted.json) matches the recorded engine
maxima in this Chrome run. [Noon](low-noon.png) and [Midnight](low-midnight.png)
captures show the aftermath and scattered cans. They are not close-up hinge
error measurements or phone performance evidence. The combined scene reports
21 draws / 4,242 triangles. Disposal reported zero bodies, colliders, joints,
contact pairs and remaining events in both worlds.

`npm run check`, `npm run build` and the fixture build passed. Chrome showed no
comparison errors. The main game passed an actual ready Just Cruisin’ click,
world boot and console inspection. Existing module-type and bundle-size warnings
remain. Both owned tabs and the temporary preview were stopped.

## Reproduce and next action

```sh
node bin/test-physics-cooler-lid
node --input-type=module -e 'import {build} from "vite"; await build({build:{outDir:"/tmp/zerble-cooler-experiment",rollupOptions:{input:["index.html","verification/physical-festival/cooler-lid.html"]}}});'
npm run preview -- --host 127.0.0.1 --port 8766 --strictPort --outDir /tmp/zerble-cooler-experiment
```

Open `/verification/physical-festival/cooler-lid.html?mute=1&perf=low` on that
preview. Next tighten the physical hinge's hard-landing constraint without
silently changing the global simulation rate, then connect the cooler assembly
to reserved admission and adopted render parts. Cups in holders/hands remain a
separate unfinished transfer system.

## Solver and CCD follow-up

Reproduce with `node bin/test-physics-cooler-lid --solver-sweep`.
The [40 recorded runs](solver-sweep.json) vary only the requested extra solver
iterations (0, 1, 2, 4, 8) and assembly CCD (enabled/disabled), retaining the
four scenarios, six contents, 480 steps and 60 Hz clock. Contents retain CCD.
Every run checks finite transforms, floor support, bounded speed, zero event
overflow and disposal. Invalid requests are rejected before engine allocation.

Extra iterations are **not selected for live tuning**. With CCD enabled, eight
extra iterations reduce inverted landing angular error from 0.138 to 0.0073
radians, but increase strong-impact anchor separation from 41.9 to 59.7 mm.
Disabling assembly CCD does not solve the problem: the zero-extra-iteration
inverted landing still reaches 35.6 mm and 0.138 radians. Default fixture
settings remain zero extra iterations and CCD enabled. These are constraint
measurements, not phone performance results.

The adapter now permits a bounded integer request of 0–8 additional iterations.
Rapier applies it to connected bodies, so its cost is not limited to the body
carrying the request. See the [official API](https://rapier.rs/javascript3d/classes/RigidBodyDesc.html).
The option is currently used only by the comparison experiment.

A runtime inspection of pinned Rapier 0.21 found that the returned revolute
multibody joint exposes validity and contact controls but no mutable limit
controls. The current latch depends on changing joint limits from closed to
open. A multibody alternative therefore needs a separate verified latch/stop
strategy before adoption; this inspection does not establish that multibodies
are unsuitable. The next experiment should prove exact hinge attachment with
that strategy before changing live rendering or admission.

Follow-up verification: `npm run check` and production build passed. A fresh
Chrome tab on the rebuilt preview started through **Play Just Cruisin’**, staged
a cooler, admitted it, and recorded one impact after **Coast forward**, with no
console errors. The tab and temporary preview were closed afterward. The user
playtest preview on port 8769 remains separate and unchanged. No render geometry,
materials or default motion changed in this follow-up.
