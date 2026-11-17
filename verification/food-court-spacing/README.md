# Food-court spacing verification

## Reproduction

Gary's marker: seed `3185230054`, position `(-1887.63, -1232.91)`, heading
`0.485`, time of day `0.837`. The original plan at source revision `380cf22`
contains these three minor-hub courts:

| Centre | Distance from marker | Owning hub | Cluster seed |
| --- | --- | --- | --- |
| (-1929, -1214) | 45 m | (-10, -6) | 2204976600 |
| (-1848, -1312) | 88 m | (-9, -7) | 791674536 |
| (-2007, -1301) | 137 m | (-11, -7) | 1261234067 |

Their pairwise centre distances are approximately 127 m, 117 m and 159 m.
Each hub respected its own one-court limit, and the cross-hub seam rules did
not merge these non-overlapping courts. The failing regression reproduced three
courts within 150 m before the fix.

[baseline.json](baseline.json) records the original descriptors from 47 owning
hubs around the marker, captured before changing density. This fixture allows a
comparison of every unaffected descriptor, rather than checking only a court
count. Persisted `yaw` angles use the existing road-snapshot policy of 1e-12
radian resolution for cross-platform final-bit differences; positions, seeds,
existence decisions and all other fields remain exact. Mutation controls prove
that meaningful angle changes and any coordinate or seed change still fail.
The reported-location assertion expands the owning-heart search by
`MAX_POI_REACH`, so courts whose owners sit outside the immediate area are included.

## Current rule

`FESTIVAL_TUNING.FOOD_COURT_MIN_SPACING` is 240 m between court centres. The
final plan retains the existing court at (-1929, -1214), leaving one court within
150 m of the marker. The entrance welcome court is protected, major hubs win
over minor hubs, and remaining conflicts use the existing stable hub-priority
hash with coordinate and cluster-seed ties. No new RNG stream or draw is needed.

The filter runs after seam resolution and removes the losing court together
with its dependent welfare post. It does not reroll the base plan, reposition
other venues or change retained courts' build seeds. Chunk construction, maps,
terrain and passenger destination searches all consume the final plan.

Density decisions compare neighbouring base plans, never final plans or the
loaded registry, which prevents recursion and load-order winners. A court can
conservatively yield to a better candidate that another rule removes; the rule
guarantees separation rather than maximising the number of courts. Seed/epoch
caches bound repeated work, but this check is not a frame-time benchmark.

## Verification

- `node bin/test-food-court-spacing`: passed. Checks the reported cluster,
  112 surviving courts across five seeds, every pair's spacing, road clearance,
  discoverability, welcome-court preservation, reverse query order and seed
  roundtrips. It also compares unaffected sibling descriptors against the saved
  baseline and confirms that a zero spacing setting restores all baseline plans.
- `node bin/test-food-court-road-clearance`: passed, retaining the original
  five-seed road fixture with 170 courts.
- `node bin/test-sugar-shack-placement` and `node bin/test-sugar-shack-spacing`:
  passed, retaining close-court fixtures to test named-vendor spacing, model RNG,
  reverse load order and unload/rebuild independently of density. These older
  fixtures explicitly set court spacing to zero; the new test covers production
  court spacing and road/welcome integration together.
- `node bin/test-road-surfaces`: passed. The historical road/welfare snapshot
  remains exact with court density disabled, and the production plans differ only
  by removed courts and their dependent amenities across the four snapshot seeds.
- All commands in the `npm run check` suite passed. The initial run reached the
  historical road-layout snapshot; after updating that test to distinguish density
  omissions from layout changes, it passed and every remaining suite command was
  run successfully.
- `npm run build`: passed, with the existing large-chunk warning.

## Running-game check

Opened the existing local Vite server in a temporary in-app browser tab at the
reported seed, coordinates and heading, with `perf=low&mute=1`, then clicked the
ready Just Cruisin' plank. `/where` confirmed the supplied position and heading.
Inspected the surrounding area with `/camera top 400`, then used `/tp food` and
`/camera top 150` to inspect the retained court and its tables at Noon. The
locator arrived at (-1914, -1195), the approach beside the retained court's
(-1929, -1214) centre. Returned to chase view and inspected Midnight as well.
The final console check contained no warnings or errors. The tab was closed,
and no standalone browser or development server was started.

This verifies the reported desktop scene and production command/build path;
it does not establish phone performance or universal subjective density acceptance.
