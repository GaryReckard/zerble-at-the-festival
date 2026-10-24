# Compact lakeside camping, October 24, 2026

Gary reported seed 1352262399 at (-201.67, -398.85), heading -0.009 radians, time 0.217. This is a lake-owned camp centered near (-192,-403), rather than a woodland-generator district. Its original single tent and social props left a broad clearing.

`src/campClearing.js` fits independently seeded sleeping pitches within 18m of existing centers, using jittered candidate locations, actual transformed solids and doorway/chair routes. The original lake host loop and RNG remain intact. `src/lakes.js` supplies exact center/16-rim water checks and footprint-aware roads, immediately adopts accepted models into lake ownership and reserves their ground before tree scatter. Failed models release private resources while preserving shared pools. Added tents share the host's neighborhood and existing amenities.

## Verification

- `npm run check` passed, saved in [check.log](check.log). The later rejection-resource assertion passed in [layout.log](layout.log). The importmap check passed again after adding the map sandbox entry.
- Actual geometry regression fitted 156 sleeping tents around 24 host seeds, preserving solids and approaches; each group retained at least three and no more than eight followers. Rejection testing proves bounded model allocation and shared-resource safety.
- Lake integration regression covers immediate registration, water/road rejection, expanded road bounds, tree clearances and lake ownership without chunk keys.
- Fresh URL parsing regression covers missing/blank/nonfinite/out-of-range coordinates, optional fields, zero coordinates, resume precedence and preloading before world generation.
- Muted Low and High full-game boots used the real Just Cruisin' mode button. Both showed seven extra tents sharing `-1,-1:camp:1`, recorded in [camps.json](camps.json), and no console warnings/errors. The original fire and four chairs remain.
- [Before](before.png), [Noon after](after-noon.png), and [Midnight after](after-midnight.png) show the clearing. Noon/Midnight images use Low, the top camera and paused stepping.
- Live scene readings are in [Low status](status-low.txt) and [High status](status-high.txt). Low overhead measured 1511 draws / 354855 triangles; High chase measured 3443 / 1223562. These are different views and tier populations, not a controlled performance comparison or a device FPS claim. No matched pre-change counter baseline was retained.

Review link:
<http://127.0.0.1:8765/?seed=1352262399&x=-201.67&z=-398.85&heading=-0.009&tod=0.217&mute=1>

Coordinates are applied before preloading. Normal collision resolution can nudge the cart slightly off an occupied spawn; the running checks read roughly (-201.9,-398.3). Time advances after starting. Settings' explicit saved resume takes precedence on Apply & restart.

The owned IAB verification tab was closed. No server or standalone browser was started, and Gary's server remains untouched. Concurrent terrain/vehicle edits were preserved. Gary authorized saving this density follow-up in its own campsite commit.
