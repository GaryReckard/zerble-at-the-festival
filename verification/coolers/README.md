# Camp coolers, October 29, 2026

Campsite kitchens previously represented a cooler with one teal box instance
inside the stove/water-jug batch. They now call `buildCampCooler()` from
`src/models/campsite.js`, which supplies a colored body, cream insulated lid
with two circular cup recesses, dark gasket, two front latches and side handles. The existing kitchen location
at local `(1.9, 0, -0.7)` and `camp_cooler` collision radius of `.42` remain.
Kitchen-bearing camps get one cooler; light-traveler and satellite pitches
continue to omit kitchens. This does not add a pickup or storage interaction.

The body finish derives from an already sampled camp angle, without consuming
caller or layout randomness. All four finishes share one box geometry, one
recessed-lid geometry and six pooled materials. Geometry and materials carry the shared-resource disposal tag.
The cooler has two instanced batches and one lid mesh, totaling 320 triangles,
with zero shadow casters or new lights. Replacing the original box adds three draws and
308 triangles to a kitchen-bearing camp. These are geometry costs, not measured
device frame-time results.

## Checks

- `node bin/test-camp-cooler`: 40 builds using native Three.js, all four
  deterministic finishes, ground contact, every part's bounds within the
  existing collision radius, pooled resources and instance upload flags.
  Downward raycasts prove both cup floors sit 2.5 cm below the surrounding lid, and the actual kitchen builder
  installs the cooler at its reserved position.
- `node bin/test-campsite-layout`: 1,800 camp layouts plus neighborhood,
  door, chair-approach and woodland integration checks passed.
- `npm run check` and `npm run build` passed. The existing build chunk-size
  advisory and Node module-type warnings remain.
- In-app browser, existing Vite server on port 8747: standalone cooler loaded
  at Morning, Noon, Dusk and Midnight, and Low loaded without console errors.
  The muted Hit it button exercised the existing `camp_cooler` sound mapping;
  this establishes dispatch, not audible acceptance.
- Standalone scene counters: five draws and 368 triangles, including sandbox
  ground/helper geometry. The complete family-base campsite rendered with its
  cooler beside the kitchen, at 75 draws and 5,210 triangles.
- Real Low-tier game: clicked the ready Just Cruisin' mode plank, observed the
  running world/HUD and inspected the console after boot, with no errors.
  This is a desktop integration smoke test, not an iOS audio or phone FPS test.

## Captures

Open `/sandbox.html?entity=camp_cooler&mute=1` for the isolated model, or
`/sandbox.html?entity=campsite_family-base&mute=1` for its kitchen context.

![Cooler at noon](noon.png)

![Cooler at midnight](midnight.png)

![Cooler beside the camp kitchen](campsite.png)
