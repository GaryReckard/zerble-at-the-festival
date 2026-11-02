# Person pose publication

October 30, 2026. This checkpoint supplies full feet-origin transforms to existing Crowd instances. It does not enable live NPC falls.

## Contract and evidence

`Crowd.writeReactionPose` requires a current activity claim, validates and copies the transform, normalizes rotation, and retains existing appearance and instance slots. Ordinary grounding, walking, dancing, cheering and smile bounce cannot override the reaction. Releasing the claim or publishing an ordinary activity pose removes the override. Party members, vehicle riders, photographers and hidden/instrument bindings remain excluded.

`node bin/test-person-reactions` passed ownership, stale claim, input validation, copy/reuse and release tests. `npm run check` and the normal production build passed. The build retains its existing large-chunk warning.

The [production-Crowd fixture](../person-pose.html) passed 39 assertions in Low and Mid, including native instance transforms, seated legs, suppressed walking, retained height, unchanged clocks and matching baseline counters. Both tiers measured 50 draws, 4,982 triangles and 22 geometries before and after pose overrides. Low uses Lambert and Mid uses Standard materials. These counters do not establish phone performance.

Captures: [Low Noon](low-noon.png), [Low Midnight](low-midnight.png), [Mid Noon](mid-noon.png), [Mid Midnight](mid-midnight.png). The larger 1.05-radian chair tilt also passed on Low. These are authored poses, not simulated impacts or recovery animations.

A fresh Low production game started through the ready Just Cruisin’ button, rendered the festival, and produced no captured console warnings or errors. The test tabs were closed and temporary preview stopped; Gary’s separate cooler preview remains untouched.

## Reproduce

Build the fixture as an additional Vite entry without changing repository configuration:

```sh
node --input-type=module -e 'import {build} from "vite"; await build({build:{outDir:"/tmp/zerble-person-pose",rollupOptions:{input:["index.html","verification/physical-festival/person-pose.html"]}}});'
npm run preview -- --outDir /tmp/zerble-person-pose --host 127.0.0.1 --port 8766
```

Open `/verification/physical-festival/person-pose.html?mute=1&perf=low`, then repeat with `perf=mid`. Use Noon, Midnight and Change chair tilt; finish with Dispose fixture, close the tab and stop the server. Direct source serving from this managed `.codex` checkout encountered the configured filesystem deny rule, so verification used a production build outside that directory without weakening access restrictions.

## Remaining integration

Connect the supported-seat and reserved-fall-body leases to live activity ownership, transform publication, safe release, landing and recovery. This proof does not establish collider placement, streaming ownership, incident consequences, iOS audio or physical-device acceptance.
