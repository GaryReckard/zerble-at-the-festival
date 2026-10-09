# Far-Field Post-Fixes Review

## Review Metadata

- Date: 2026-10-08.
- Diff scope: custom, `c86f5de..7553915`, restricted to far-field implementation, model facts, vendor placement, viewer, tests, importmaps, and associated documentation. Unrelated capture fixes were excluded.
- Reviewed commits: `e8413c2`, `b755e4f`, `95fc8ba`, `7553915`.
- Specialists used: three parallel general agents assigned rendering, placement/performance, and sandbox/docs lenses. Dedicated `review-*` agent types were unavailable.
- No application files changed. This review and its four screenshots are new artifacts.

## Intent Match

The main-stage gable, elongated marquee roof, roofless side stage, elevated white vendor roofs, shared shape constants, and stable vendor candidate slots are meaningful improvements. The slot refactor preserves the old arithmetic and iteration order across 12,040 numeric fixtures. All four importmaps include the new module.

This is a partial fidelity correction, not completion of the earlier recommendations. Camps, forests, accepted vendor placements, two-sided transitions, and production lighting remain unresolved. The new documentation acknowledges most of this rather than claiming full visual acceptance.

## Findings

### 1. P2 / High: Low-tier vendor roofs now exceed capacity inside the horizon

Locations: `src/farField.js:417-425`, `src/perf.js:162`, `bin/test-far-field:812-820`.

The updated vendor expansion increases peak demand, but only the canopy pool was rebudgeted. At seed `9876`, anchor `(320,320)`, the low-tier peak pool has 200 candidates within 520 m versus a capacity of 192. Eight vendor roofs are dropped. The old expansion has 169 candidates within that radius and drops none. Warm markers for the affected rows survive because selection happens independently by pool.

Two omitted roofs at `(799.224,515.713)` and `(789.977,519.521)` are approximately 466 m and 459 m from the player at `(359.9,359.9)`, which is still inside the same planning cell. This is not merely overflow from irrelevant distant candidates.

Fix: measure and rebudget peak demand as well as canopy demand, and test all defining surface pools. A low-tier peak cap of 224 addresses this reproduction and raises the full-cap triangle total from 9,056 to 9,440, still under 9,700. Broader sampling is required before treating 224 as a general guarantee. Consider structure-aware selection so retained lights do not outlive their associated roofs.

Verification: reproduced by the main reviewer using the real planner and both revisions' expansion functions. Temporary probe: `/var/folders/87/21271msd0sd1z2063kqknpbh0000gp/T/opencode/zerble-farfield-pure-review.mjs --detail`.

The new canopy test checks total padded-plan demand, not within-radius demand. For seed 1234 at the origin, the specialist measured 41 total canopies but only 11 within 520 m. The changelog's claim that all 41-44 measured canopies are inside the horizon should be corrected (`CHANGELOG.md:10`). Test omission from the actual visibility region, including movement inside an 80 m planning cell.

### 2. P2 / High: The marquee's closed rear wall is missing its upper triangle

Locations: `src/farField.js:345-350,486-495`; comparison: `src/models/tentStage.js:61-69`.

The real back wall is a pentagon reaching the 11 m ridge. The proxy adds a rectangle only to the 5.5 m eaves, while its open gable geometry supplies roof slopes but no end cap. The result is a 28 m wide, 5.5 m high triangular opening where the actual tent has solid canvas, a 77 square metre silhouette difference.

Fix: include the rear gable triangle while preserving the open front and sides. Verify front, rear, and oblique views, not only roof bounds. The test at `bin/test-far-field:396` currently accepts one truss instance as proof of a closed back wall without checking its full silhouette.

### 3. P2 / High: The roofless side-stage proxy is only a goalpost

Locations: `src/farField.js:353-379`; comparison: `src/models/stage.js:28-48`.

Removing the nonexistent roof is correct, but the proxy now contains only two posts and a crossbeam. Real side stages have a full-width, 7-times-scale-high colored banner and a raised deck. Those are defining opaque surfaces, not small decorations, and both appear only when the real chunk arrives. Main-stage proxies also omit the raised deck, which is visible in the saved fixed-camera pair.

Fix: retain the no-roof decision but add cheap banner/deck boxes at authoritative dimensions and transforms. Match the banner's real appearance without perturbing model RNG. Rebudget truss demand if these boxes use that pool, and test projected silhouette coverage rather than just absence of a roof.

### 4. P2 / High: The new comparison modes still mix real and proxy content

Locations: `hub-sandbox.html:358-388`; supporting code: `src/farField.js:555-565`, `src/chunks.js:1428-1465`, `src/lakes.js:619-688`.

In Real only, `setOwnershipOverride('real')` dissolves the six instanced pools but leaves the road underlay visible. The hub builder does not build the authoritative road ribbons that would cover it in the game. Browser reproduction at seed 1234, hub 0, low tier: every pool fade is zero, but the far-field group and road are visible, with 3,234 road indices.

In Proxy only, the viewer hides the hub, crowd, smiles, and floor overlay but leaves real lake-owned trees and camps visible. In the same browser scene all three lake groups remain visible; one contains 431 meshes. The screenshots therefore cannot be read as pure representations of near and far scenery.

Fix: hide the entire far-field group in Real only and restore it in other applicable modes. Apply the policy after construction as well as on toggles. Include lake-owned decor in exclusive comparison ownership, or explicitly label it as shared context and provide a separate genuinely isolated scenery comparison. Add a viewer-level visibility test covering roads and lake decor, not just instance fades.

### 5. P2 / High: The new main-stage roof encloses the night beacon

Locations: `src/farField.js:359-365,381-385`.

The gabled roof now reaches `11.6 * scale`, but the main-stage beacon remains centered at `10.6 * scale`. With cluster seed 1234 and stage scale 1.15, the beacon's top is about 13.095 m versus the 13.34 m ridge, and its lateral vertices also lie below the slopes. The opaque, double-sided roof occludes the marker from above and sufficiently elevated oblique views.

Fix: if the marker remains part of the intended distant-stage language, place it above `trussHeight + roofRise`, accounting for its radius. Alternatively replace the floating beacon deliberately with coarse light cues anchored to the real stage. Add a roof-clearance test instead of merely checking beacon count. This finding is supported by source geometry and the specialist's numeric probe, not a claim that the beacon disappears from every camera angle.

## Known Remaining Work

- Camp and tree positions remain independently generated, and the camp proxy still omits the real campsite's 2x scale and A-frame topology: `src/farField.js:387-411`; `src/models/campsite.js:66-104,646-658,788-796`. The latest commit records the camp mismatch rather than fixing it.
- Shared vendor slots are candidates, not accepted placements. The far side still omits the real water, road, and registry rejection checks: `src/chunks.js:1640-1651`. Do not describe this as exact built-world parity.
- Real geometry still appears at full strength while only the proxy dissolves: `src/chunks.js:435-436`; `src/farField.js:945-972`.
- The game still uses the unlit dimmer: `src/farField.js:514,925-929`. The Lambert selector is an experiment, not a shipping lighting fix.

These are preexisting, acknowledged limitations rather than new regressions, but they still prevent the original visual acceptance criterion from being met.

## Verification and Gaps

- `bin/test-far-field`: passed.
- `bin/check-importmaps`: passed, 46 source modules, 12 worldgen modules, 29 models across four pages.
- Numeric vendor-slot equivalence: 12,040 candidates matched exactly.
- Capacity regression: reproduced against base and current expansion using the current real planner; no GPU speedup claim.
- Main game: title and debug-start boot succeeded at low, mid, and high with committed horizon plans and no reported browser errors. The trusted-click/audio path was not retested.
- Fixed-camera viewer captures at seed 1234, hub 0, low tier: [near Noon](near-noon.png), [far Noon](far-noon.png), [near Midnight](near-midnight.png), [far Midnight](far-midnight.png). These intentionally preserve the viewer defects described above rather than silently correcting the scene for the screenshots.
- No real-iPhone or new GPU timing acceptance was performed.
- Lighting experiment caveat: the hub viewer never calls `ContextLights.update`, unlike the game (`hub-sandbox.html:435-443`; `src/main.js:1460`; `src/contextLights.js:100-111`). Registered stage/drum light carriers therefore do not become the game's visible pooled lights. This predates the selector, but limits Midnight conclusions. Either scope the experiment explicitly to sun/hemi/ambient or run the real contextual-light path at a controlled position. The contextual pool is distance-gated, so this does not imply every distant roof should receive stage light.

## Suggested Commit Description and Changelog

Accurate description of the reviewed work: "Share far-field roof shapes and vendor candidate slots; add comparison controls and canopy demand checks."

Changelog should retain its partial-completion wording, correct the padded-plan versus within-radius canopy measurement, and avoid calling viewer modes exclusive until the road/lake visibility policy is fixed. Do not claim accepted-placement parity, lighting parity, or complete fidelity.

## Verdict

Approve with changes as an incremental improvement; do not close the far-field fidelity task. No boot blocker or new RNG-order regression was found. Fix the remaining defining surfaces, actual visible peak overflow, and comparison isolation before accepting the building pass, then continue the already recorded camp/tree/transition work.
