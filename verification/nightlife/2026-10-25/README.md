# Evening vendors, moonset and Smile Bubbles

Verified October 25, 2026 against main `3b59477` plus this change. The shared working tree also contained another session's scenery edits; those are excluded from this commit. Earlier browser captures use the original scenery, while `vendor-high-evening.jpg` includes the other session's tent palette. The isolated staged snapshot is the automated acceptance surface.

## Player behavior

Vendor tents use the game's normalized clock, where dawn is 0 and midnight is .75. Display bulbs and warm, color-preserving merchandise illumination follow global nightness from dusk, fade during .735–.75, and turn off at midnight. Vendors move toward their bed during that interval and lie down inside the booth until .04 the next morning. This is a visual daily routine, not a new crowd actor or trading mechanic.

The moon body, phase patch and additive halo project at celestial depth, behind foreground geometry. The sky no longer writes depth, and the camera far plane and compact moon orbit stay unchanged.

Smile Bubbles require 1,000 **raw collectible pickups** over the browser's saved lifetime. The score can differ because of multipliers, spending and damage. The ordinary threshold already worked; periodic challenge evaluation now repairs an eligible restored total whose earned record is absent, with one normal unlock notification. The debug collectible helper now passes a Vector3 at the cart's terrain height. Challenge metadata reads the actual game mode.

## Automated evidence

- `node bin/test-bubble-challenges`: exact 999→1,000 threshold, one-shot unlock, restored 1,000/1,200 totals, immediate persistence and no repeated celebration after reload.
- `node bin/test-special-bubbles`: actual debug spawn helper, real collectible homing/pickup, challenge, production main unlock subscriber, persistence, toast, sound request, unread badge, analytics request and actual emitted Smile particles, in both modes. Rendering/audio/GA transport are stubbed in Node.
- `node bin/test-evening-vendors`: day/evening/closing/midnight/wrapped-night/dawn transitions and celestial depth configuration. This uses focused scene-graph doubles; browser captures establish raster behavior.
- `node bin/test-healing-arts`: shared teardown retains neighboring vendor references while removing the unloaded chunk's entries.
- `npm run check`: passed in the isolated staged snapshot, including the final regression additions. See [check.log](check.log) for the complete result.

## Browser evidence

The in-app browser used `mute=1` throughout. A normal Just Cruisin' mode-button click booted the real Low game. Eleven `/smiles 100` batches passed through actual pickups; the upgrade menu showed an enabled Smile Bubbles switch ([capture](smile-unlocked.jpg)). A fresh reload retained the unlock. No warning/error messages were observed after the live checks. Audio remained muted and no production GA ingestion is claimed.

At seed 1977, cart `(5300,5300)`, heading 51°, a lowered chase camera and bounded `/step 1` snapshots show the moon above the ridge at .92 ([above](moon-above-ridge.jpg)), partially hidden at .928 ([overlap](moon-occluded.jpg)), and fully hidden at .935 ([behind](moon-behind-ridge.jpg)). Noon and Midnight game frames are [saved](game-noon.jpg) [here](game-midnight.jpg).

The real tent sandbox was checked at Noon, evening .63 and Midnight on Low, and evening/Midnight on High. Low's scene counter measured 15 draws/1,604 triangles by day, 16/1,712 in the evening and 16/1,616 at midnight. Relative to the day fixture, the three instanced bulbs cost one draw/108 triangles; the visible bed costs one draw/12 triangles. The two geometries are pooled, bulb instance matrices are flagged, no new light or shadow caster is added, and cloned booth materials are owned and disposed with their chunk. These are scene/allocation observations, not device FPS measurements.

[Noon stall](vendor-noon.jpg) · [Evening stall](vendor-evening.jpg) · [Sleeping vendor](vendor-midnight.jpg) · [High evening](vendor-high-evening.jpg)

Real mobile GPU performance and audible unlock playback were not measured in this pass.
