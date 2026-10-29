# Lurleen terrain contact, October 28, 2026

## Reproduction and cause

Reported seed `1200852794`, player `(451.69,-877.87)`, heading `-6.293`, time of day `.346`, session time `77.43`. The player coordinates do not identify Lurleen's exact transform or reconstruct the input history. The [native fixture](../lurleen-grounding.html?mute=1&perf=low) pins the real Lurleen model to those coordinates over the production terrain sampler.

Baseline `6cc615a` kept her root at Y=0 while moving X/Z. At this position the terrain is `0.8897052708529043m` high. The rendered tire-center-minus-radius clearances ranged from `-0.95878m` to `-0.78063m`, reproducing the buried wheels in [before.png](before.png).

## Implementation

[Lurleen's grounding method](../../../src/lurleen.js#L655) samples all four wheel positions, sets chassis height/pitch/roll in YXZ order and solves bounded local wheel suspension, following [Zerble's existing approach](../../../src/zerble.js#L1242). It preserves her original wheel clearance and independent actor-clock jiggle. The constructor, explicit spawn, early-return offscreen rehome and normal update all call it; the [rescue repositioning](../../../src/main.js#L1943) also grounds immediately.

The original mutable position object remains the registry collider position. No extra random draws, geometry, materials, ownership changes or asynchronous audio initialization were introduced. One reused vector and 24 terrain-height samples per grounding call replace the fixed-height placement. No physical-device CPU/FPS claim is made.

## Tests and native checks

`npm run check` passed, including the new [production-class regression](../../../bin/test-lurleen-terrain) and all five importmaps with 156 source modules. [Saved output](check.log). A subsequent formatting-only source edit was followed by another passing targeted regression.

The regression runs the actual Lurleen class with rendering/effects mocked and independently calculated YXZ transforms. It covers constructor/spawn contact, 240 paired flat/sloped moving frames across wandering/aware/following and four headings, every wheel's support, exact X/Z/speed/heading and RNG equality, flat-world jiggle, original collider reference, early-return rehome and rescue wiring.

Native Low and Mid Noon/Midnight were inspected with no console errors. At the report point, root Y is `0.8897052708529043`, pitch `.0690482`, roll `.0359693`; tire-center-minus-radius clearance is `.002854–.037146m`, matching the original jiggle. Moving the fixture by `(4,-5)` updates root Y to `1.2785565m` with supported wheels; flat-world mode returns Y/pitch/roll to zero. The fixture remains 87 draws / 35,024 triangles at Noon and 88 / 35,216 at Midnight (existing night effects). The change adds no geometry. These clearance probes approximate tire contact using the tire center/radius rather than tracing rotated tread vertices.

| Tier | Noon | Midnight |
| --- | --- | --- |
| Low | [Capture](low-noon.png) | [Capture](low-midnight.png) |
| Mid | [Capture](mid-noon.png) | [Capture](mid-midnight.png) |

## Actual game

The [live fixture](../lurleen-live-game.html?mute=1) embeds the real game and requires a ready mode-plank click. The placement button uses local debug controls to put the existing persistent Lurleen at the reported slope and Zerble nearby, then lets the relationship updater run normally. She entered following and moved to `(451.69,1.1838248,-887.54763)`, with maximum wheel-support residual `9.1e-14m` and the same collider position reference. [Capture](live-game.png).

The embedded game emitted the previously observed unattributed `MutationObserver.observe` Node-type error, so this is not a clean iframe-console claim. A separate direct Mid game launch reached the ready title, started through a real Just Cruisin' plank click, rendered the world and returned no console errors. [Capture](direct-mid-boot.png). Muted desktop verification does not establish physical iOS audio or device performance acceptance.

All three owned browser tabs were closed. The owned no-cache server was stopped with exact-PID absence checked; no standalone browser was launched. Changes remain uncommitted and unpushed.
