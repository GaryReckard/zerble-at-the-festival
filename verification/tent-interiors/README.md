# Moving shadows inside backlit tent fabric

November 16, 2026. Gary clarified that the intended effect was someone inside a
lit tent casting a shadow through its walls. The old effect used two gray
rectangles clipped to the front door, with a small lateral sway. This replacement
projects an animated implied camper from a lantern onto the existing fabric.
See the [capture gallery](gallery.html).

## Behavior

Selected campsite tents retain their existing evening and individual bedtime
schedule. A warm interior glow falls off from an offset lantern, and a soft
human shadow blocks that light across whichever walls lie behind the camper.
It is not copied onto every wall: cloth on the lamp side stays lit. Different
phases select back-left or side lighting and offset breathing, leaning, turning
and arm reaches. Reduced Motion holds a fixed pose while retaining time-of-day
lighting. Noon and late-night lights-out retain the ordinary fabric and doorway.

The shadow is decorative ambient tent life, as the previous effect was. It is
not a representation of a particular registered NPC or a new occupancy claim.
No new campers, lights or gameplay actors are spawned.

## Implementation and costs

[The fabric shader](../../src/tentInterior.js) tests a finite lantern-to-cloth
segment against six soft body capsules and attenuates both transmitted emissive
and cloth-relative diffuse color. Its tent-local coordinates include each
piece’s transform, so scaled domes, roofs, the connected-room wing and terrain
pitch/yaw stay coherent. Penumbra grows as the body moves away from the wall.
This is an analytic approximation rather than a full cloth-transmission or
shadow-map simulation. The [Three.js shadow guide](https://threejs.org/manual/pages/shadows.html)
explains why adding shadow-casting lights would add rendering passes; this effect
uses the existing material pass instead.

[Campsite builders](../../src/models/campsite.js) now explicitly return their
cloth pieces, excluding poles, zippers and groundsheets. Each receiving piece
gets an owned clone of its original Standard or Low-tier Lambert material;
pooled sources and original cloth colors remain untouched. The existing
`tentGlow` animatable owns the controller and updates preallocated joint uniforms.
Subtree teardown releases the owned clones.

There are **zero added draws, triangles, textures, lights or shadow casters**.
The old separate silhouette mesh and its thirteen cached poses are removed,
saving one silhouette draw per visible lit tent. The cost is six ray/capsule
tests per lit fabric fragment, additional owned material state for all receiving
cloth pieces, and six preallocated joint pairs updated per active tent. Dark
fabric skips the capsule calculations, and daytime pose updates stop. No vertex
buffers, canvas textures or GPU shadow maps are regenerated per frame.
No physical-device GPU/frame-time gain is claimed.

## Verification

- `npm run check` and `npm run build` passed.
- `node bin/test-tent-interior` exercises finite projection geometry, lit versus
  occluded cloth, side-wall coverage, lantern movement, stable uniform objects,
  animation, Reduced Motion, transformed local frames, pooled-safe cloning and
  actual Three.js Standard/Lambert shader composition.
- Actual builders were exercised across all five families and both historical
  vestibule branches. The fabric-piece counts are ridge 2 or 3, dome 2, octagon
  3, cabin 3 and multiroom 5. RNG draws remain two; poles, floors and zipper
  strips are unchanged, and owned materials dispose normally.
- The campsite-layout suite retains deterministic layout, door geometry,
  staggered fire/tent lighting and late-night extinction checks, with its glow
  adapter updated for the real projection controller.
- Native browser captures cover all five shelter families on Low and Mid,
  without shader/console errors. [Family counters](family-checks.json) include
  the reference ground, grid and normal tent hardware, so they are not the
  effect’s marginal cost.
- Paused/advanced pose captures show a changed arm/body silhouette; moving the
  lantern changes the receiving wall and projection shape. Noon and day
  fraction `.95` lights-out were inspected with the cloth door still present.
- Three consecutive Mid connected-room rebuilds retained 11 draws, 695
  triangles, 12 geometries and 2 textures. See [rebuild counters](rebuild-checks.json).
- The real game was started through its ready mode plank on Low and Mid,
  then checked around a loaded campsite at evening with no console errors.
  The [live Mid approach](game-approach-mid.jpg) and [console result](game-console-mid.json)
  retain that integration evidence.

The browser checks establish desktop integration and visual behavior, not
physical phone/iPad fragment cost. There were no standalone headless WebGL
sessions. Temporary test tabs were closed; the existing dev server was retained.

## Reproduce

Open `/sandbox.html?entity=camp_tent_dome&interior=1&perf=low&mute=1`, then
repeat on Mid and choose the other tent families. `interior=1` holds an evening
inspection time. Buttons frame the door/side/rear, pause or advance the camper,
move the lantern, and rebuild. The ordinary Noon/Midnight controls remain usable;
Midnight is before the per-tent lights-out time.

```sh
node bin/test-tent-interior
node bin/test-campsite-layout
npm run check
npm run build
```
