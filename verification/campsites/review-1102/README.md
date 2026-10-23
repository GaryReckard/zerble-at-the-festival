# Campsite review and corrections

October 23, 2026, following the requested 11:02 a.m. Eastern review. The original implementation was saved as `61bced9` before this review; Gary subsequently authorized committing the review and tent refinements too. No deployment was performed.

## Corrected behavior

- [Crowd transforms](../../../src/crowd.js) now align the torso capsule's actual bottom (`1 - .55/2 - .26 = .465` local units) with the chair fabric, instead of aligning the higher `.62` leg pivot. Seated bobbing, dance tilt and dance yaw no longer move that contact through the seat. [Chair regression](../../../bin/test-camp-chair) executes the production matrix writer for 100 combinations across four styles, both loveseat slots, five body scales and four animation phases.
- [Camp registration](../../../src/campRegistry.js) chooses a reachable approach using the entire final walking segment, including the NPC clearance radius. Placement preserves older neighbors' complete routes, and unreachable chairs cannot advertise claims. [Layout regression](../../../bin/test-campsite-layout) checks every chair in 1,800 layouts and 100 complete seven-camp neighborhoods. The small-camp canopy/kitchen moves .45 native units outward to open a real passage beside the hearth.
- [Forest placement](../../../src/forests.js) suppresses satellites if their host was rejected during planning or runtime placement. Preflight exempts only the containing owner's non-colliding forest reservation, while foreign forests, trees and solid markers still block. [Placement regression](../../../bin/test-camp-placement) covers 500 real forest plans with 5,937 retained pitches, alongside the existing 6,000 village plans.
- [Camp lifecycle regression](../../../bin/test-camp-life) verifies that forced departure waits when every physical exit is blocked, retaining the claim until the actor can stand clear rather than materializing inside its chair.

- [Tent geometry](../../../src/models/campsite.js) replaces rectangular door signs with split triangular A-frame flaps and curved fabric zipper doors. The dome door and zipper are clipped to the exact shell triangles, with diagonal poles clear of the entrance. Octagonal/cabin doors have a straight left hinge and curved D zipper. Cabin gables face outward, overlapping fly edges close wall seams, and windows are removed; the dark octagonal base is offset to prevent coplanar flicker. Muted greens, greys, cream and yellow also match [distant camp colors](../../../src/farField.js). Evening glow uses the actual fabric door, with thirteen silhouette poses prepared once and copied into a fixed buffer during animation. The layout test checks door outlines, hinges, facet clipping, daytime cloth visibility, cached poses and late-night extinction.
- [Debug village selection](../../../src/debug.js) filters out the welfare markers returned alongside villages, so its destination and tent-count label refer to the actual camp.

## Browser evidence

The in-app browser reused Gary's existing server at port 8765 with muted URLs. No standalone browser or new server was started.

The real-NPC `camp_seating` preview showed sling, director, low lounge and both loveseat positions at body scales .75, 1 and 1.35. [Noon](seating-noon.jpg), [side contact](seating-side.jpg) and [Midnight](seating-midnight.jpg) captures show the corrected contact. Its isolated scene reported 237 draws and 22,138 triangles, including 15 unbatched preview actors and the standalone furniture; this is not a production camp budget or a device performance result.

The actual daily-routine preview reached [seven seated campers](activity-seated.jpg), then [three hidden sleeping campers](activity-sleep.jpg) at time .95, and zero sleeping campers after Morning, with no warning/error console entries. [Morning emergence](activity-morning.jpg) is also captured.

All five tent families were inspected at Noon and Midnight: [dome Noon](dome-noon.jpg), [dome Midnight](dome-midnight.jpg), [ridge Noon](ridge-noon.jpg), [ridge Midnight](ridge-midnight.jpg), [octagon Noon](octagon-noon.jpg), [octagon Midnight](octagon-midnight.jpg), [cabin Noon](cabin-noon.jpg), [cabin Midnight](cabin-midnight.jpg), [connected rooms Noon](multiroom-noon.jpg), [connected rooms Midnight](multiroom-midnight.jpg). At seed 1977 the isolated dome scene reported 8 draws / 855 triangles, cabin 8 / 457, octagon 8 / 595, ridge 7 / 138 and connected rooms 11 / 695. These totals include the sandbox ground and cannot establish performance improvements against an unmeasured old tent scene.

The integrated large camp on Low showed [37 draws / 3,208 triangles at Noon](camp-low-noon.jpg) and [39 / 3,226 at Midnight](camp-low-midnight.jpg), with revised fabric glow and no warning/error console entries. This archetype and lighting sample differs from the original report's family camp, so the totals are not a paired benchmark.

Final High and Low real-game boots used ready mode-button clicks and reached gameplay with no warning/error console entries. The High check streamed a [village at Midnight](game-village-night.jpg), increasing generated chunks from 25 to 44; the corrected picker displayed `camp village (11 tents)`. [High startup](game-high.jpg) and [Low gameplay](game-low.jpg) captures document the boots. Owned test tabs were closed afterward, and Gary's pre-existing server was left running.

## Verification

`npm run check` passed, followed by a passing focused layout rerun after the final cached-glow regression was added. The [saved output](checks.log) includes both runs. `git diff --check` also passed. Both one-time wakeups are now PAUSED.

## Scope and limits

Rendering primitives are stubbed in focused Node tests; browser captures establish actual appearance. These checks do not establish physical-phone performance or iOS audio unlock. The existing nominal far-field proxy limitations remain documented in the [original report](../README.md).
