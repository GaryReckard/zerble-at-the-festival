# Vendor EZ-up continuity, October 28–29, 2026

## Cause and change

The baseline `6cc615a` detailed vendor model used six colorful palettes while its horizon roof used fixed off-white canvas. [Before](before-far.png). The new [shared appearance selector](../../../src/festivalShapes.js) derives roof/cloth/trim colors and slight roof rotation from session seed and quantized booth coordinates, with a separate salt. [The real row builder](../../../src/chunks.js) and [horizon expansion](../../../src/farField.js) use the same descriptor, independent of rejected neighbours or tier density omissions. The detailed builder still consumes its three historical appearance draws, preserving subsequent layout, camp and merchandise randomness. Existing standalone/legacy model calls retain their seeded palette path.

Four simple posts now support each distant vendor roof, matching the detailed model's dimensions and color through a shared shape contract. The posts form one instanced pool, without caps, shadows, collision or animation. Legs are filtered against retained vendor roofs before publication, with the same chunk owner and dither envelope. Disposal remains owner-only; geometry/materials are allocated once per horizon owner. Camping-tent proxies do not get vendor legs.

## Cost and bounds

The ten-booth fixture changes from **1 draw / 40 triangles** to **2 draws / 360 triangles** at Noon, and **3 draws / 408 triangles** at Midnight with the existing light markers. Detailed booths retain **130 / 21,749** at Noon and **140 / 21,869** at Midnight. The leg batch adds one draw and 32 triangles per retained booth, with no extra draw per color.

Leg capacities match the existing peak capacities so dense views retain their roofs. Previous whole-horizon worst-case triangle ceilings could not cover the new geometry; the tier budgets were explicitly updated rather than dropping booths to fit them:

| Tier | Maximum leg instances | Added triangle bound | Whole horizon at all caps | Budget |
| --- | ---: | ---: | ---: | ---: |
| Low | 288 | 9,216 | 17,360 | 17,500 |
| Mid | 448 | 14,336 | 25,312 | 25,500 |
| High | 448 | 14,336 | 26,976 | 27,000 |

These are conservative fixed-buffer bounds, including leg slots that cannot all coexist with non-vendor peaks. They are not device FPS measurements. In the live Low snapshot, 274 leg instances were retained across the complete padded snapshot, including loaded/dissolved and out-of-view proxies.

## Tests and native fixtures

`npm run check` passed, including all five importmaps and 156 source modules. [Full output](check.log). Additional final paired-fade assertions also passed in [the far-field gate](far-field-check.log).

The gate covers signed coordinates, four session seeds, exact roof colors/yaws, density omissions, independent RNG activity and deterministic revisits. Renderer tests cover complete roof/leg pairs under capacity pressure, 32-triangle post topology, no shadow casting, equal load/unload fades and reduced-motion snapping, fixed buffers, bounds, visible-roof retention at dense/corner samples and idempotent disposal.

The [production fixture](../canopy-handoff.html?mute=1&perf=low) uses actual `buildTent`, horizon geometry/materials and instance writes. It separately checks the unmerged rendered roof's material color and rotation against the horizon records, and compares the caller RNG after full detailed construction with/without the shared descriptor. Low/Mid Noon/Midnight and unload/revisit passed, with no native console errors.

| Tier | Distant Noon | Detailed Noon | Distant Midnight | Detailed Midnight |
| --- | --- | --- | --- | --- |
| Low | [Capture](low-far-noon.png) | [Capture](low-near-noon.png) | [Capture](low-far-midnight.png) | [Capture](low-near-midnight.png) |
| Mid | [Capture](mid-far-noon.png) | [Capture](mid-near-noon.png) | [Capture](mid-far-midnight.png) | [Capture](mid-near-midnight.png) |

## Actual game and limits

The [live fixture](../canopy-live-game.html?mute=1) starts via a real ready Just Cruisin' plank click, then inspects existing vendor objects and actual horizon matrix/color buffers. At seed1234, booth `(265.80012278084,-151.91900187895)` had matching teal roof color `3578769`, roof yaw `.80870787834`, and paired leg instances. Teleporting 2,500m away unloaded the original vendor; returning created a different vendor object with identical appearance. [Saved result](live-revisit.png).

The initial harness assumed the first loaded booth would have a Low-tier proxy, which correctly failed because density thinning can omit it. The final harness selects a retained booth; the successful rerun emitted no new errors. The tab's log retained that earlier harness timeout, so this is not a clean cumulative-log claim. A separate direct Mid game title/ready-plank/world boot had no console errors. [Capture](direct-mid-boot.png).

The controlled fixture switches representations at one camera position; it does not claim a recorded continuous driving route. Actual streaming/revisit and the existing handoff lifecycle are independently exercised. Muted desktop tests do not establish physical iOS audio or phone performance acceptance.

Camping tents already use six colored fabrics in `src/models/campsite.js`; this fix does not change their palette. All owned tabs and the owned no-cache server were closed after verification, with exact-PID absence checked. No commit or push was performed.
