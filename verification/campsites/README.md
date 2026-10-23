# Campsite layouts and daily life

October 23, 2026. The original implementation is committed as `61bced9`; the subsequent seating, placement and tent corrections are documented in the [11:02 review](review-1102/README.md). No deployment was performed.

## Implementation and evidence

| Behavior | Source and focused check |
| --- | --- |
| Five actual tent silhouettes, four camp archetypes, private sleeping borders and supported rear-canopy screens | [Campsite model](../../src/models/campsite.js), `bin/test-campsite-layout`: 1,800 deterministic size/role/archetype layouts with actual shelter and chair builders, exact fabric bounds, torch/screen clearance and footprint containment |
| Compact and roomier mixed households share one host hearth/kitchen | [Pure planner](../../src/campPlanning.js), `bin/test-camp-planning`: 6,000 bounded neighborhood scenarios; [production orchestration](../../src/chunks.js), `bin/test-camp-placement`: 6,000 cases, including 4,704 compact households and blocked-host suppression |
| Empty household frontages merge while solids and entrances remain clear | [Registration and preflight](../../src/campRegistry.js), `bin/test-camp-registry`: transforms, shared loveseat collider/independent claims, wider-chair approaches, rejection without registry mutation; `bin/test-campsite-layout`: 100 complete physical neighborhoods, all seven camps accepted in every sampled busy layout |
| Sling, director, low and loveseat chairs have different frames/fabric and usable seat coordinates | [Chair builder](../../src/models/campChair.js), `bin/test-camp-chair`: 240 cases, one external RNG draw, pooled buffers/materials, actual seat height/offset metadata, no new shadow casters |
| Daytime rests, evening gathering, tent entry, hidden sleep and morning emergence | [Crowd](../../src/crowd.js), `bin/test-camp-life`: exclusive claims, approach/sit/sleep/wake, blocked exits, unloading and forced abandonment, complete rig hiding and player collision exclusions |
| Cold daytime fires, dusk ignition, late-night fire/tent extinction, table/hanging lanterns and supported twinkles | [Central camp animator](../../src/models/campsite.js), `bin/test-campsite-layout`: noon/evening/late-night states and shared-resource ownership |
| Longer and varied NPC hair | [Appearance data](../../src/crowdAppearance.js) and [geometry/instance buckets](../../src/crowd.js), `bin/test-crowd-appearance.js`: six modeled silhouettes, fifteen colors, seeded distribution, RNG isolation, pooled slots and unchanged shadow policy |

The layout and chair tests execute production builders with rendering primitives stubbed; they establish deterministic geometry/metadata contracts rather than GPU appearance or device speed. The baseline comparison preserves the external campsite RNG stream across 600 size/seed cases using identical primitive stubs. Intentional neighborhood planning changes alter camp locations.

## Browser observations

The in-app browser used the existing local server on port 8765, always with `mute=1`. A final boot caught and corrected an accidental vendor-path reference to neighborhood options; both quality tiers were booted again after the correction. No standalone/headless browser was launched and no development server was left running by this task.

- The final medium-camp preview showed torches outside tent fabric and privacy screens outside the sleeping area; large/family previews showed rear-canopy screening and separate kitchen/lounge canopies.
- The real-crowd preview reached six seated campers, then three hidden sleeping campers at time `0.95`, and zero sleeping campers after Morning. Additional visitors remained free to follow normal routines. This is an observed sequence, not a claim that every available chair or shelter always fills.
- The final compact mixed preview at seed 1977 showed seven households sharing a kitchen/hearth with asymmetric sleeping pitches. Its HUD reported 112 draws / 9,192 triangles at Noon and 124 draws / 9,342 triangles at Midnight; the roomier variant reported 133 draws / 10,898 triangles at Noon. These are isolated scene counts, including sandbox ground, not phone performance measurements.
- Low camp materials were checked at Noon and Midnight without console errors. The family preview reported 72 draws / 4,886 triangles at Noon and 75 / 4,935 at Midnight.
- Low and High full-game checks used a ready title mode-button click, reached gameplay and produced no new warning/error console entries after the vendor ownership correction. The High game also used the built-in Camp village teleport and Midnight controls, streaming from 25 to 50 generated chunks without console errors.
- The hair preview showed all six styles from the front and back, and the four chair styles were visually inspected.

## Repeatable inspection

Use `sandbox.html?entity=campsite_cluster&seed=1977&mute=1`, then select its roomier counterpart or an individual archetype. Use `entity=campsite_activity` for the production crowd routine, `camp_chair_lineup` for furniture, and `crowd_hair` for hairstyle front/back views. Tent families are individually selectable.

The complete `npm run check` passed after the final source edits; [saved check output](checks.log) records the run. Also run `node bin/test-campsite-layout /tmp/zerble-campsite-baseline.js` when that saved pre-change source is available. The baseline file is a local verification input, not a required repository dependency. Worldgen's existence/query golden remains `eddf8e50`; the intended larger village reservation and welfare placement produce POI hash `846e1957`.

## Captures and practical limits

[Compact Noon](cluster-noon.jpg), [compact Midnight](cluster-midnight.jpg), [medium clearance](medium-noon.jpg), [family Low Noon](family-low-noon.jpg), [chair styles](chairs.jpg), [hair front/back](hair.jpg), [seated campers](after-midnight.jpg), [late-night lights-out](late-night.jpg), [morning emergence](morning.jpg), [Low game boot](game-low.jpg), [High game boot](game-high.jpg), [streamed village at night](game-village-night.jpg).

Lights use emissive geometry and the existing bounded proxy-light system; silhouettes are animated meshes on softly lit tent fabric rather than real shadow-map lights. Twinkles are attached to actual canopy posts, without invented tree attachments. Sleeping reservations follow each shelter's modeled capacity and share its entrance. Roads, water, neighboring existing structures and blocked entrances can reduce a generated neighborhood. Far-field camps remain coarse nominal silhouettes and cannot reproduce near-world collision rejections or retry offsets. No physical iPhone playtest or paired GPU/FPS benchmark was performed.

## Follow-up review

The [11:02 review and corrections](review-1102/README.md) records the seated-body alignment fix, complete chair-approach clearance, forest host ownership corrections, and Gary's later tent-door, cabin-wall and fabric-color refinements. Its newer captures and check output supersede the original previews for those details.
