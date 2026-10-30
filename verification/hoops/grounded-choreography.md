# Grounded hoop choreography

This refinement builds on the original desktop implementation and treats waist
hooping and choreographed flow as two modes of the same Crowd-owned performer.
Physical iPhone/Safari acceptance remains separate.

## Movement and ownership

The pure dance sampler compiles bounded stance/swing plans, keeping each planted
sole fixed while two-segment knees follow the moving torso. The session samples
all four sole corners against terrain and rejects unreachable adaptations before
publishing matrices. Ordinary walking, seated people and paired exchanges retain
their separate motion paths.

Regular waist mode uses the shared articulated pose contract for independent arm
movement, head turns/tilts and knee compression over fixed feet. Its original hoop
orbit and accepted-time clock remain intact. The standalone waist preview uses
the same sampler; appearance geometry is separated from activity ownership.

Flow mode adds a directional waist groove, moving-body isolations whose hoop
center/plane stay fixed in the session frame, and independent airborne hoop
trajectories. Aerial scores choose a seeded rise between 0.65 and 2.4 meters
above release, deriving launch speed and airtime from gravity. No prop-physics
engine or collision owner is added.

## Continuous-motion evidence

The version-6 local-flow audit covers 90 scores (three profiles and 30 seeds at
22 seconds), containing 906 compatible bridges. Ordinary-join hoop-center speed ranges from 0.02361 to
1.43122 m/s, replacing the old zero-speed joins. The longest contiguous period
below 0.03 m/s is 0.020203 seconds, approximately 1.2 frames at 60 Hz; the
regression limit is 0.04 seconds. This checks motion relative to the body, not
whole-body translation or decorative hoop spin.

Bridge-edge and original-join numerical checks found maximum extrapolated
position mismatch of 9.02e-11 and second-order velocity mismatch of 2.99e-8 across
arms, hands and hoop fields. These are numerical continuity measurements, not
claims about perceptual naturalness. Contact, head/limb clearance and purposeful
isolation stillness remain separate checks.

## Technique reference

The full chest-roll addition follows the primary [Howcast instruction](https://howcast.com/videos/512743-hula-hoop-across-the-chest-roll-hula-hooping/): a shoulder-height arm slightly in front of the body, continuous arm/chest contact, a backward lean and a receiving-hand gaze. This is a chest roll, rather than a literal rigid track through the neck. Rig-specific clearances still require independent geometry checks.

## Contract checks

- `bin/test-hoop-score` passes 237,060 sample checks covering deterministic descriptors, exact hand/rim contact,
  arm/leg reach, torso/head/knee clearance, planted sole position/orientation,
  lift/land continuity, waist-drive phase and inertial isolation/toss paths.
- `bin/test-hoop-legs` independently reconstructs the two-bone chain and checks
  shader-visible/depth agreement, normals and invalid-target rejection.
- `bin/test-hoop-chest-roll` checks 4,001 supported roll samples, exact ordered
  arm/chest contact, mirrored handedness, rolling spin and shoulder-switch timing.
- `bin/test-hoop-classic` samples 2,048 waist phases and 256 standalone poses,
  including unchanged ring formulas and appearance RNG draw count.
- `bin/test-hoop-workshop` exercises 9,558 production flow poses and 180 regular
  waist frames plus 3,483 dense chest roll/catch poses, using actual Crowd matrices and rendered shoe/leg geometry.
- Session and pair tests cover cache-before-publication, caller-owned foot
  copies, interruption/reentry, terrain rejection, accepted time and cleanup.

These mathematical/CPU tests do not establish GPU performance or physical-device
visual quality.

The chest lean includes a 0.28-meter forward countershift while both feet remain
planted. Analytic capsule contact is exact; the low-poly rendered torso has a
maximum 27.57 mm skin gap, independently bounded at 30 mm by the production
fixture. This is not a claim of exact contact with every faceted triangle.

## Browser observations

Chrome on Gary's Mac, seed 1977, muted workshop:

| Evidence | Observation |
| --- | --- |
| [Chest roll at Noon](chest-roll-noon.png), [Midnight](chest-roll-midnight.png) | Seed 2, lyrical mode, shows the open-arm/back-lean pose with the hoop crossing the chest. |
| [Opposite-hand catch](chest-opposite-catch.png) | Seed 2 at 16.70 seconds, chest regrip with right-palm support. |
| [Final version-6 Low game](grounded-game-low-final.png) | Ready Just Cruisin' click, world rendered, and no captured console warnings/errors. |
| [Planted step at Noon](planted-step-noon.png) | Bent knees, a lifted swing foot and maintained hand/rim contact. |
| [Moving isolation at Noon](moving-isolation-noon.png) | The ring frames the dancer while the body uses the planted-foot pose. |
| [Waist groove at normal distance](waist-groove-normal-noon.png) | Flow body hooping and expressive regular waist mode remain visually distinct. |
| [High toss at Noon](high-toss-noon.png), [Midnight](high-toss-midnight.png) | Seed 6 rises 2.38 meters above release over a 1.39-second flight; the camera frames the entire arc. |
| [Earlier shallow toss at Midnight](toss-dance-midnight.png) | Glowing airborne hoop and released hand; superseded by the later variable-height toss. |
| [Real Low game](grounded-game-low.png), [real Mid game](grounded-game-mid.png) | Both booted through a ready Just Cruisin' button and rendered the world with no console warnings/errors in the observed runs. |

The browser accessibility/CDP inspection intermittently timed out; successful
screenshots and console reads above are the retained evidence, rather than treating
failed reads as passes. No standalone headless WebGL browser was launched.

## Current measurements and limits

The current matched CPU measurements and source hashes are in
[grounded-cpu-benchmark.json](grounded-cpu-benchmark.json), produced by
`node --expose-gc bin/bench-hoop-workshop`. It uses five rotated-order trials,
250 warmup steps and 600 timed ticks with the same two people and appearance.
Retained heap after collection is not an allocation rate, and Node CPU timings
are not GPU or phone measurements.

The earlier version-2 benchmark was overwritten during refinement. Its original
summary was recovered into [cpu-benchmark.json](cpu-benchmark.json), explicitly
marked summary-only; its raw trials are not retained.

Physical iPhone/Safari visual support/contact and GPU performance remain open.

## Final verification, 2026-10-30

`npm run check` and `npm run build` both exited 0 after the final balance change.
The build retains its existing large-chunk advisory. The final version-6 CPU
benchmark also exited 0; medians below describe two performers on this Mac.

| Mode | Mean tick median | Construction median | Model draws / triangles |
| --- | --- | --- | --- |
| Expressive waist baseline | 0.01426 ms | 4.01046 ms | 11 / 3,248 |
| Single-hoop flow | 0.02593 ms | 4.86992 ms | 11 / 3,248 |
| Two-hoop flow | 0.02309 ms | 4.66454 ms | 12 / 3,536 |

All task-created Chrome test tabs were closed after capture. No standalone
WebGL browser was started.
The task-owned Vite server on port 8765 was stopped after verification.
