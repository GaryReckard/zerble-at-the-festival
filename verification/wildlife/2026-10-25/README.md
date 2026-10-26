# Wildlife and scenery verification, October 25, 2026

Birds now share species-specific anatomy and wing poses between the sandbox and
live instanced flock. Trees use clustered foliage and forked trunks while retaining
existing forest instance buckets. Hammock contacts use trunk taper at world support
height, tents use stronger colors, and star pickups follow the terrain surface.

## Geometry and performance boundary

The fixed `forest_patch_instanced` fixture contains 18 trees and uses seed `0x9e37`.
Actual Three.js 0.160.0 buffers establish the following, excluding sandbox ground:

| Metric | Previous tree geometry | Revised tree geometry |
| --- | ---: | ---: |
| Draw batches | 6 | 6 |
| Shadow-casting batches | 4 | 4 |
| Triangles | 3,752 | 7,244 |

[Raw measurement](tree-cost.jsonl). The baseline is `747795b:src/models/tree.js`, before this work; its temporary
filename is recorded in the JSONL. Single allocation timings are included for traceability but are **not** a
benchmark or evidence of a speed improvement. Added tree detail costs 3,492
triangles in this fixture. The renderer reports 8 draws and 7,292 triangles with
the sandbox ground/grid included. All ordinary/forest trees share four unit meshes;
no new transparent foliage, textures, per-frame tree animation, or draw buckets.

Bird geometry costs 480 triangles for sparrows, 500 for finches, 492 for jays,
456 for crows and 452 for doves. A jay sandbox scene changed from 8 draws / 256
triangles to 5 draws / 540 triangles (including ground/grid). The game continues to
use three batches per species, at most 15 total, with Low/Mid/High counts of
14/26/40. Added anatomy is not free, but it adds no live-flock draw calls or shadows.

These are geometry costs and desktop Chrome smoke checks, **not phone FPS claims**.
The live Mid boot at seed 308091034 reported 6,439 draws / 1,738,030 triangles via
`/perf`; this is an integration snapshot without a matched pre-change baseline,
so it cannot isolate this patch's frame-time impact.

## Automated coverage

- `npm run check`: passed; [full log](check.log).
- `node bin/test-birds`: terrain spawn/cruise, escape direction directly above the
  cart, escape cooldown, braking/landing convergence, removed tree reservations,
  dawn return, invalid frame durations and bounded motion.
- Optional actual-library run with `BIRD_TEST_THREE` and `BIRD_TEST_UTILS` pointing
  to external cached Three.js 0.160.0 modules: finite pooled geometry, symmetric
  wingtip heights, positive transforms, folding and 600 updates of the real
  40-bird matrix writer. No package dependency was added.
- `node bin/test-tree-detail`: 200 builds share four geometry pools; material and
  vertex-color ownership, six-batch cap and fixture triangle ceiling. Also passed
  against actual Three.js using `BIRD_TEST_THREE`.
- `node bin/test-forest-determinism`: 4,000 seeds preserve the existing golden RNG
  stream and crown/perch coordinates (`badb6efd125e…`).
- `node bin/test-hammock-anchors`: tapered radius interpolation, world/local height
  conversion on sloping ground, asymmetric supports, clearance and unchanged RNG.
- `node bin/test-campsite-layout`: all shell/rainfly palette choices and the existing
  two-draw tent RNG contract.
- `node bin/test-star-power`, `node bin/test-debug-commands`, and
  `node bin/test-debug-actions`: footprint sampling, slash grammar and real adapters.

## Browser checks

Used the existing server on port 8747 and ordinary Chrome, with `mute=1` throughout.
No standalone/headless browser was launched. The final resumed check started a
no-cache server on the same port, clicked Just Cruisin' to boot the current game,
confirmed an empty warning/error console, saved a capture, then closed its tab and
stopped that server. The full `npm run check` suite also passed again on resume.

- Birds: original jay captured before edits; revised jay on Low, perched sparrow
  and goldfinch on Mid, Noon and Midnight checks, no captured console errors.
- Trees: oak/birch branch connections, fixed instanced forest on Low and Mid,
  Noon and Midnight. The original standalone oak was inspected before edits,
  but its random descriptor differs on reload; use the fixed-fixture measurements
  above for cost comparisons.
- Hammock-between-trees composite: both rope endpoints reach the facing bark.
- Vendor row and large campsite: colored roofs/shells by day, lit campsite by night.
- Real game: ready mode-plank clicks and running-world boots on Low and Mid.
  Low exercised seed 308091034 at the reported cart position (511.96, 751.13),
  heading 211.49 degrees and time .403. `/star spawn` created a pickup 10 m ahead
  at (517.2, 759.7); `/star find` reported that location/distance, and the pickup
  rendered above the terrain. `/star trigger` and `/star end` succeeded. This
  reproduces the reported area, not the exact historical random pickup location.
- No captured warning/error console entries on the checked paths. Silent tests
  do not establish audible iOS unlock behavior or physical-device performance.

## Captures

- [Bird, Low Noon](bird-low-noon.png), [bird, Mid Midnight](bird-mid-midnight.png).
- [Forest, Low Noon](forest-low-noon.png), [Low Midnight](forest-low-midnight.png),
  [Mid Noon](forest-mid-noon.png), [Mid Midnight](forest-mid-midnight.png).
- [Hammock contacts](hammock-mid-noon.png), [vendor colors](vendors-mid-noon.png),
  [camp day](camp-mid-noon.png), [camp night](camp-mid-midnight.png).
- [Star over terrain](star-terrain-low.png), [final real-game Mid boot](game-mid-final.png).

Natural-history reference: [Cornell's American Goldfinch guide](https://www.allaboutbirds.org/guide/American_Goldfinch/id)
supports the yellow/black markings and bounding flight direction. Models remain
stylized festival wildlife rather than anatomical or seasonal-plumage simulations.
