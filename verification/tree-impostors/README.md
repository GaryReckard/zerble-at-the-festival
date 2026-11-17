# Angle-aware actual-model forest impostors

Implemented on November 16, 2026, following Gary’s report that the distant forest
looked like oversized bushes. This replaces those domes with individual tree
silhouettes and removes floating stage diamonds. See the [capture gallery](gallery.html).

## Approach and sources

The offline [baker](../../bin/bake-tree-impostors.mjs) rasterizes deterministic
pine, oak and birch samples from the actual [tree builders](../../src/models/tree.js).
Each species has four azimuths and elevations of 0°, 30°, 60° and 90°, totaling
48 images with transparent gutters. Common per-species framing preserves the
trunk’s ground anchor across views; the checked-in manifest records dimensions
and a source hash. `node bin/bake-tree-impostors.mjs --check` reproduces the PNG
and manifest byte for byte and checks every silhouette for coverage and padding.

The [runtime](../../src/treeImpostors.js) uses one camera-facing instanced square
per tree. Its GPU shader selects a yaw-relative azimuth and blends neighboring
elevation coverage, correcting the overhead image basis as the viewer rotates.
Where both captures are opaque, the nearer elevation supplies interior color,
which prevents a lower-view white birch trunk from ghosting across a top crown.
Fog, instance tint and the existing chunk-completion Bayer dissolve remain active.
Cutout fragments use depth writes without transparent sorting. Camera movement
requires no per-tree CPU matrix or atlas-buffer rewrites.

The technique follows the established multi-view/upper-hemisphere approach
outlined in [Epic’s impostor documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/impostor-baker-plugin-in-unreal-engine).
This implementation deliberately uses four azimuths and two texture samples,
rather than a depth-corrected multi-frame octahedral renderer.

## Performance and ownership

[Allocation and hard caps](budgets.json) were read from the actual Three.js
geometry/instance buffers and current tier definitions. The old dome capacities
were 96/176/256 at 20 triangles each, recorded in `4b5e2a7:src/perf.js` and
`4b5e2a7:src/farField.js`. Replacing each dome slot with eight two-triangle slots
lowers maximum forest triangles by 20% on every tier.

| Tier | Tree slots | Maximum forest triangles | Forest buffers, bytes | All proxy triangles at full caps | Existing cap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Low | 768 | 1,536 | 73,868 | 16,720 | 17,500 |
| Mid | 1,408 | 2,816 | 135,308 | 24,288 | 25,500 |
| High | 2,048 | 4,096 | 196,748 | 25,568 | 27,000 |

The forest remains one draw. Removing stage diamonds removes a complete pool,
leaving seven instance pools plus the road underlay. The live Mid
[scene census](game-census-mid.json) identified exactly one opaque
“View-dependent tree impostors” draw; its counts are scene composition evidence,
not a GPU benchmark. Warm camp lights remain.

The 1024² atlas transfers 67,940 PNG bytes but occupies 5,592,404 RGBA bytes
including mipmaps, approximately 5.33 MiB. Each forest fragment takes two texture
samples. There are more instance records, grounding samples and handoff entries
than with the coarse domes, although fixed caps and the existing sliced
publication/deadline policy remain intact. These costs are explicit; no device
frame-time improvement is claimed. Physical-phone/iPad GPU and route acceptance
remain open.

There is no runtime model bake, additional light or shadow caster. The disabled
far-field path still constructs no rendering resources. Materials own their atlas
texture, remain hidden until loading succeeds and release it on disposal; a
caller-provided texture remains caller-owned.

## Placement and handoff limits

The existing world-anchored density grid supplies deterministic groups of two to
eight normal-sized trees, with isolated hashes for species, size, position and
yaw. Species weights follow the near forest’s pine/oak/birch mix. Increasing
density adds trees rather than inflating a single crown.

These are representative trees, not an exact replay of the near forest.
[Near scatter](../../src/chunks.js) also depends on accepted RNG draws, roads,
dance clearings, landscape/woodland clearance, spacing and registry buildings.
The far planner does not import builders or consult gameplay registries.
Each representative fades with completion of the chunk containing its final
position, retaining the existing 0.3-second envelope and reduced-motion snap.
There can still be changes in individual positions/species at the near/far
handoff, and coarse density samples can differ from precise near clearances.

## Verification

- `npm run check` passed, including atlas reproduction and the new view/basis,
  yaw, elevation, pole orientation, two-triangle geometry and shader-composition
  tests. The far-field suite covers determinism, capacity selection, terrain
  grounding, sliced/superseded publication, handoff, travel resource plateaus,
  absent stage diamonds and idempotent disposal.
- `npm run build` passed, with the atlas included through Vite’s asset URL path.
- Native in-app browser checks used the real game’s ready mode plank on Low and
  Mid, then driving, first-person, overhead and zoomed-out views, plus Noon and
  Midnight. No final shader or game console errors were captured.
- The model lab compared the cards with their exact source models at low,
  elevated and overhead angles, including a quarter-turn overhead rotation.
  It verified the corrected birch crown and handoff visibility toggle.
- Three Mid lab rebuilds retained 14 draws, 1,162 triangles, 8 geometries and
  4 textures, including the source models and reference ground. See
  [browser counters](browser-counters.json). The production hub comparison also
  ran with the new pool list and without stage diamonds, using Low materials
  and the hub tool’s default Mid horizon composition.

An early development asset-path error was corrected to use the repository’s
`assets/` directory and Vite URL discovery; fresh loads passed. No headless WebGL
sessions were launched, and temporary browser tabs were closed after inspection.
The pre-existing development server was left running.

## Reproduce

Open `/sandbox.html?entity=forest_impostors&perf=low&mute=1`, then repeat on Mid.
The front row is the cards, the rear row their actual source models. Buttons
select camera angles, rotate, hide source models, toggle handoff or rebuild.
The game remains the authoritative terrain/streaming view.

Rebuild after editing tree models:

```sh
node bin/bake-tree-impostors.mjs
node bin/test-tree-impostors
node bin/bake-tree-impostors.mjs --check
npm run check
npm run build
```
