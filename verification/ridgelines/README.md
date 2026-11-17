# Blue Ridge scenery and long-notice containment

Implemented and checked on Gary’s Mac on 2026-11-16, against the former mountain
backdrop in `9b25750`. Gary’s Lake Eden photographs informed the wooded green
slopes, broad rounded saddles and quiet overlapping blue ranges. The earlier AI
paint-over was a direction reference, not a rendered screenshot or an asset.
No reference photographs or generated textures are shipped.

## Rendering and terrain contract

`src/mountains.js` builds four continuous radial slopes in one opaque indexed
mesh. A dedicated seed/salt controls the skyline and baked woodland colors;
there is no per-frame noise, texture upload, terrain sampling, streaming job,
real light or shadow caster. The group follows player X/Z while retaining the
world’s zero-height datum, so elevated ground can occlude it naturally. Buried
skirts and a narrow fog-colored foot meet the existing ground. Playable terrain,
roads, collision and landscape admission are unchanged.

Daylight lower-sky and fog colors now use cool blue/green haze instead of peach,
which otherwise made a bright stripe across the valley. Warm sunset and night
color stops remain. Ridge colors blend through the existing time-of-day owner,
and their geometry sits inside the starfield radius and existing camera far
plane. The normal sky draws before the depth-tested ridges and real world.

The actual gameplay camera controls the view gate: when looking steeply down,
the ridge heights lower toward their buried foot, then the group is hidden.
This avoids an artificial circular wall in top-down views and skips its draw.
No larger camera far plane, extra quality budget or post-processing pass is used.
The shader and geometry are identical on Low and Mid.

## Measured geometry budget

| Metric | Former backdrop | Layered ridges |
| --- | ---: | ---: |
| Backdrop draws | 1 | 1, or 0 in top-down |
| Triangles | 18,720 | 10,240 |
| Vertices | 56,160 | 6,168 |
| Attribute/index buffer bytes | 2,471,040 | 357,504 |
| Added textures / real lights / shadow casters | 0 / 0 / 0 | 0 / 0 / 0 |

The geometry uses about **45% fewer triangles and 86% fewer buffer bytes**.
[Baseline](baseline.json) was measured from the actual former builder, including
its UV buffer; [replacement counts](geometry.json) come from the production
builder. Recorded construction times are isolated cold observations under
different warm/load conditions, not a controlled speedup ratio. These figures
exclude JavaScript object overhead, renderer buffers and the surrounding world;
no device FPS or GPU-time improvement is claimed.

The native production sandbox reports **3 draws / 10,288 triangles** on both
Low and Mid at noon and midnight: the ridge mesh plus the reference ground/grid.
The ridge itself has no texture uniform. Switching to Zerble and back exercises
owned-resource release; Node checks independently observe geometry and material
disposal. The sandbox restores its original fog and camera far plane on exit.

## Verification

- `node bin/test-ridgelines`: exact seams for positions/normals/colors, seeded
  reproducibility, finite buffers and valid indices, triangle/byte ceilings,
  star-shell containment, the current far clip, world-height datum, day/night
  jumps through the real atmosphere owner, fixed update resources and disposal.
- The same suite constructs the actual production `ChaseCamera` and checks
  near/far chase, first-person and top-down settings at elevations 0 and 120 m.
  Every visible ridge vertex fits the existing far plane; top-down hides it.
- `npm run check`, `npm run build`, and the focused menu suite all passed.
- Native Low and Mid games started through a ready **Just Cruisin’** plank,
  rendered the world and recorded no console errors in the checked paths.
- Seed `2641474229`: normal chase, first-person, maximum native top-down zoom,
  chase zoom-out, nighttime chase at its far dolly limit and a 600 m debug plan
  view. The plan views show real terrain with no backdrop ring.
- The Low driving capture is around `(95.79, 720.21)`, heading 58.2 degrees,
  after driving beyond the gate. Day and midnight Mid captures include spawn;
  the elevated campsite check uses the actual 20 m shelf around `(615, 930)`.
  Nearby tree canopy correctly occludes the background there. NPCs and time
  advance between images, so this is not a pixel-identical A/B capture.
- No headless browser was launched. Temporary native browser tabs were closed,
  temporary viewport changes were reset and the pre-existing user dev server
  remains running.

## Long hailing notice

The reported notice was constrained to 560 px on desktop but retained
`white-space: nowrap`, allowing its text to spill beyond the card. Production
toasts now use border-box sizing, normal wrapping, long-word breaks and a rounded
rectangle that accommodates multiple lines. Existing toast priority, durations,
tap behavior and placement beneath ride cards are unchanged.

`/menu-preview.html?screen=toast&mute=1` shows the actual hailing text through the
production HUD/CSS. At 1280×720 the card is 560×66 px and its scroll/client widths
both measure 556 px. At 667×375 it is 247×70.39 px and both widths measure 243 px;
the full instruction remains within the card. [Desktop](hail-desktop.jpg) and
[small landscape](hail-small-landscape.jpg) captures establish the layout fix.

## Inspect and compare

[Capture gallery](gallery.html) · [normal driving](after-chase-noon-low.jpg) ·
[far chase at night](after-chase-max-midnight-low.jpg) ·
[maximum top-down](after-top-max-low.jpg) · [600 m plan](after-plan-600-low.jpg) ·
[elevated campsite](after-elevated-mid.jpg).

Open `/sandbox.html?entity=mountain_backdrop&perf=low&mute=1` or `perf=mid` for
isolated geometry and Noon/Midnight controls. Use the real game and `V`, camera
arrows and wheel zoom for terrain integration. No physical phone or subjective
player acceptance is claimed. Distant evening homestead lights remain a design
idea; this implementation does not add them.
