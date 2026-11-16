# Sugar Shack spacing, November 16, 2026

Gary reported two nearby Sugar Shacks at seed `2641474229`, position `(38.29, 676.26)`, heading `2.532`, time of day `.803`. The production builders at baseline `8ef50de` reproduced both objects:

| Court | Court centre | Shack centre |
| --- | --- | --- |
| Welcome court, seed 3015923843 | (3, 641) | (29.0678, 644.4871) |
| Neighbor, seed 3195376535 | (11, 717) | (34.9955, 706.2340) |

The named vendors were **62.03 m apart**. Each court independently passed its Shack roll, and the builder checked only road/water clearance and its own ring occupancy. Neither object was a streaming duplicate. [Original production fixture](baseline.json).

## Placement rule

The generated v2 festival courts now use `worldgen/sugarShacks.js` to admit named-vendor candidates with a minimum **150 m centre-to-centre** separation. The selected welcome court wins, followed by unsigned cluster seed and coordinates. Selection reads final seeded plans instead of the current registry, so arriving from another direction or unloading a winner cannot restore the duplicate.

A Shack can occupy any point on its court’s 26.3 m ring, including fallback gaps, so the conservative court-centre exclusion is 150 + 2 × 26.3 = **202.6 m** at current tuning. This can decline a candidate even when outward-facing slots might have cleared, or when its higher-priority competitor ultimately has no safe physical slot. That deliberate conservative rule keeps the query bounded without recursive placement decisions. The seed/epoch cache retains at most 256 decisions and queries are performed during court construction, not each frame. Legacy worldgen-v1 plazas are a separate path.

A declined historical slot still runs the same clearance search, consumes the seven original model draws and reserves its former footprint in the builder’s temporary ring bookkeeping. It publishes no Shack, cook or collider. The surrounding trucks, tables and vendor positions remain unchanged. A shared pure variation sampler preserves the remaining Shack’s appearance and patrol draws without constructing a discarded model.

## Verification

- `node bin/test-sugar-shack-spacing` uses the actual elevated-terrain production hub builders for the two reported courts. It retains exactly one Shack at the welcome court, compares every other truck/table/vendor and court RNG count against the saved baseline, reverses build order and repeats after unload.
- `node bin/test-sugar-shack-placement` checks 219 final food courts across five seeds, retaining 69 named-vendor candidates with the conservative spacing bound. It covers negative coordinates, reverse query order, seed round trips and tuning-epoch invalidation, alongside the existing welcome selection and safe fallback checks. This pure census complements the elevated production-builder reproduction.
- The complete `npm run check` chain and production build passed, and a separate read-only review independently reran the focused suites without finding a correctness blocker.
- The managed browser started the native ready-mode game at the reported seed, position, heading and nighttime value on Low, then inspected the area in daylight. The original local build showed the neighboring white Shack canopy; the fixed preview omitted it. Console inspection reported no warnings/errors. These are placement/raster checks, not device-performance measurements. All agent URLs used `mute=1` and no volume preferences were changed.

## Browser comparison

[Before, daylight](before-noon-low.jpg) · [After, daylight](after-noon-low.jpg) · [After, night](after-night-low.jpg)

The comparison uses the same seed, position and heading; live people, quest cards, bubbles and daylight progress differ between sessions. The saved production fixture, rather than the camera framing, establishes the exact object count and unchanged static neighboring positions.
