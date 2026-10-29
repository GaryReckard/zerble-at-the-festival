# People locomotion refinement, October 29, 2026

## Scope and behavior

The ordinary adult Crowd now animates opposing legs and arms while walking,
approaching, fleeing, boarding, and walking to supported places. The existing
instanced geometry receives one scalar stride attribute; the visible leg normals
and depth material use the same hip rotation. Phase follows horizontal distance,
while speed controls amplitude, so stopping relaxes the stride and a repeated
render publication cannot advance it. Relocations of half a metre or more in one
publication do not advance phase. This is a lightweight hip gait, not a skinned
rig, knee simulation, or terrain foot-placement system.

The right hand remains steady for a cup, and the left remains steady for a
shopping bag. Authored arm activities retain priority. Seated, cross-legged,
hammock and photo poses clear the stride. Ordinary idle people no longer have
the old positive/negative whole-body bob. Dance, hula, smiles and cheers retain
their explicit animations. Ordinary wanderers ease their requested speed over
the last 1.2 metres before the existing arrival threshold, retaining a 25% speed
floor so they still arrive. Idle yaw sway now uses accepted delta time, matching
its previous rate at 60 Hz. Emergency steering and movement remain unchanged.

Implementation: [shared motion](../../src/personMotion.js),
[Crowd rendering and ordinary movement](../../src/crowd.js).
This pass covers shared Crowd adults, including people borrowed by activities;
the subsequent [specialist-family extension](locomotion-families.md) covers children, wooks, band members, parade carriers and the remaining person renderers through explicit adapters. The measurements below record this initial adult pass.

## Verification

- `npm run check` completed successfully. The first two runs exposed test harness
  assumptions around a new render helper; the chair harness now imports that
  production helper, and hidden people still return before sampling motion.
- `npm run build` completed successfully. Existing module-type and bundle-size
  warnings remain; there were no build errors.
- [Motion regression tests](../../bin/test-person-motion) cover repeated writes,
  distance-based phase at 30/60/120 Hz, teleport rejection, protected states,
  finite/bounded poses, opposing arms, arrival convergence at three energy levels
  and frame rates, and time-scaled idle sway.
- [Chair regression tests](../../bin/test-camp-chair) retain 100 production
  contact-transform checks across chair styles, scales and phases.
- The [native fixture](locomotion.html?mute=1) passed 25 production pose checks
  on Low (Lambert) and Mid (Standard). Checks include walking/visiting states,
  matching shoes, opposing arms, seven non-walking transitions and occupied hands.
  Noon and Midnight rendered without warning/error console messages.
- The [live-game fixture](locomotion-live.html?mute=1) uses a landscape iframe
  because the in-app browser panel is portrait. Both tiers were started by
  clicking the ready Just Cruisin’ plank, rather than calling `start()`.
  Low had 79 people; its noon inspection had 21 nonzero strides and its midnight
  inspection had 35. Both had zero non-finite strides and zero nonzero strides
  in seated/riding/hammock states. Mid had 210 people and 79 nonzero strides
  at noon, also with zero invalid or protected strides and no warning/error
  console messages. Real iOS audio unlock was not tested.

## Cost and limits

| Six-person native fixture | Draws | Triangles | Geometries |
| --- | ---: | ---: | ---: |
| Before, Low | 16 | 7,320 | 18 |
| After, Low | 16 | 7,320 | 18 |
| After, Mid | 16 | 7,320 | 18 |

The baseline was measured before runtime edits with the same six seeded people.
The later camera framing is closer, so the screenshots are visual records rather
than pixel-diff evidence. No meshes, triangles, textures or shadow casters were
added. The stride adds one shared CPU float array and a float attribute on each
of the two leg/shoe GPU geometries, plus three numeric tracking fields per person.
Sampling reuses one output object. This avoids a per-person animation mixer.

A warm Node v24.10.0 microbenchmark sampled 500 mixed walking/idle actors per
batch, 1,000 batches per run, after 100 warmup batches. Seven runs took
0.0250–0.0280 ms per batch (median 0.0262 ms). It measured the motion sampler
only, including position updates, not the complete renderer, attribute uploads,
GPU vertex work, allocation/spawn time or a phone. Unchanged geometry counts do
not establish unchanged frame time. Physical-device and extended streaming
performance remain outside this desktop smoke test.

## Captures and reproduction

Run `npm run dev`, then open the native fixture with `?perf=low&mute=1` or
`?perf=mid&mute=1`. Next stride advances 50 ms; Play / pause animates the fixed
lineup through the production matrix writer. Noon/Midnight change fixture lights.
The live fixture exposes population inspection and the real game time controls.
Close either page to tear down its render loop; stop the server when finished.

- [Before](locomotion-before.png)
- [Low noon](locomotion-low-noon.png), [Low midnight](locomotion-low-midnight.png)
- [Mid noon](locomotion-mid-noon.png), [Mid midnight](locomotion-mid-midnight.png)
- [Live Low](locomotion-game-low.png), [Live Mid](locomotion-game-mid.png)
