# Changelog

All notable changes to Zerble at the Festival. Newest at top. Following [Keep a Changelog](https://keepachangelog.com); the project isn't versioned yet, so entries are grouped by date.

## 2026-06-07

### Changed
- **v2 festival ARRANGEMENT redesigned around a per-hub front axis — stages face
  open dancefloors, not water (behind `?worldgen=1`).** The playtest showed the v2
  layout placed each piece independently — stages faced "the nearest road" (often the
  lake), vendor rows punched through stages, the arch landed mid-row, food courts had a
  road + porta inside them. Root cause: no shared sense of which way a hub faced. Fix:
  each hub now computes ONE **front axis `F`** = the bisector of the widest *dry* gap
  between its approach roads, and every piece is placed relative to it. The stage faces
  `+F` (open ground *between* roads — so there's never a road in front of it), with a
  cleared **dancefloor** (`scatterWorldgenTrees` now skips an oriented no-tree rect in
  front of each stage, so woods nestle the back/sides but never the audience side). Food
  courts + vendor rows sit out along the longest road (the "drag"), away from the stage;
  the drum circle is kept to the back/side of `F`; the per-hub arch was removed (exactly
  ONE arch belongs to the whole festival, at spawn — coming with the arch build). A final
  **footprint overlap guard** pushes any two clusters apart so nothing stacks. The
  front-axis selection is fully integer-keyed (bearings bin to a 256-slot grid) so a hub
  can't face differently across browsers. Verified in-game at seed 1234: boot drops you
  in front of a stage with a live band across a clear dancefloor, vendors off to the
  sides, woods around — no chairs in water, no row through a stage. `?worldgen=0`
  unchanged. (Determinism: queryPoint golden held at `eddf8e50`; the POI golden moved as
  expected — `d9cfa5f2` node, flag-off.)
- **v2 spawn now drops you AT a festival hub of any size (behind `?worldgen=1`).** At the
  dense config there's often no *major* heart near the origin, so the old "spawn at the
  nearest major's arch" check silently fell back to an empty field. Spawn now finds the
  nearest hub of any rank and places you out on its stage's dancefloor facing the stage,
  so you open straight into the music.
- **v2 world is ~2.6× denser — festivals every ~390m instead of ~610m (behind
  `?worldgen=1`).** Playtest feedback: the v2 world read WAY too sparse — wide-open
  fields with just scattered people. Tightened the heart macrocell from 440m → **340m**
  and dropped the empty-cell share from ~48% → **25%** (so ~75% of cells now host a
  festival heart). The first-pass idea (260m / 0% empty) was tried and rejected: it hung
  the 2D map sandbox, spiked chunk generation to 335ms, and left zero breathing room (the
  determinism self-test's road negative-control lost its teeth — no road-sparse region
  remained anywhere). 340m is the deliberate stopping point — it keeps the `nearestHeart`
  scan window at 4 cells (260m blows it to 5 = 121 cells/query) so per-point cost stays
  flat (~1.7ms tree-density sampling/chunk, unchanged), while still leaving ~25% of cells
  empty for open stretches between festivals. The map-sandbox's live "heart cell" /
  "empty cells" sliders let you push it further by eye. `?worldgen=0` unchanged. This
  regenerated the v2 world, so the determinism goldens moved (the new baseline is recorded
  in `selftest.js`); v2 is still flag-off so no shipped world changed. Part of
  `v2-worldgen-3d-integration`.

### Added
- **Festival layout-grammar harness — every hub now has a computed "front" (dev
  tooling, flag-off).** Groundwork for fixing the v2 arrangement (stages facing water,
  vendor rows through stages — the playtest disasters): a new pure `computeFrontAxis(heart)`
  in `worldgen/festival.js` gives each hub a single front axis `F` = the bisector of the
  *widest dry gap* between its approach roads, so the dancefloor faces open ground *between*
  roads (never down a road or at a lake) by construction. Selection is fully integer-keyed
  (bearings bin to a 256-slot grid, integer gap widths, integer blocked-probe count, lowest-bin
  tiebreak) so it can't flip cross-engine and rotate a hub. The `map-sandbox.html` overlay grew
  a **"layout grammar"** layer drawing each hub's F arrow, road angular gaps (chosen gap green,
  water-hemmed red), and the oriented dancefloor clearing — so the whole arrangement is judged
  by eye on the 2D map before any placement code is rewritten. Determinism goldens unchanged
  (the layer is purely additive). The `_computePlan` rewrite that *uses* F lands next.
- **v2 ambient crowd, concentrated at the hearts (behind `?worldgen=1`).** v2 chunks now
  spawn a wandering ambient crowd whose size scales with worldgen *heart influence* — a
  major heart's grounds throng with people, a minor heart draws a modest gathering, and
  the deep outskirts are empty (count drops to zero past the district edge). The crowd
  clusters at the festival attractors (stage front, drum circle, camps) and **drifts
  along the roads** via `path_node` waypoints seeded every ~26m down each road run.
  Notably this does NOT use a per-NPC nearest-road query (that measured 215µs/call →
  ~107ms/frame for a full crowd — a non-starter); instead the legacy "+-grid path pull"
  is disabled in v2 (its grid lines have no road there — it would march everyone toward
  phantom paths) and the crowd follows the road-waypoint attractor chain instead. The
  global per-tier crowd cap still hard-bounds the total (the spawn pool refuses past it,
  so a busy core can't drain its neighbours). Verified seed 1234: dense crowd lining the
  spawn heart's stage + road junction thinning to the tree line, modest at a minor heart,
  empty in deep woods; zero console errors. Part of `v2-worldgen-3d-integration` (Group G).
- **v2 woods (behind `?worldgen=1`) — continuous, density-driven forests replace the
  legacy 5×5 forest blocks.** With worldgen on, every chunk scatters trees from
  worldgen's `treeDensity(x,z)` field — organic gap-fill noise that clears at heart
  cores, ramps in across districts, and rings each lakeshore — instead of the old
  "one 3×3 forest per 5×5 block" system. Dense regions become drive-around woods you
  weave through; clearings (cores, between blobs, on roads) stay open. Trees use the
  collidable forest-tree (driving into a trunk hurts, like the old forests), dodge the
  road ribbons + festival clusters, and the drum circle now genuinely sits *in* the
  woods (its treed-district spot gets surrounded). The legacy forest's hand-placed
  interior (paths, campsites, the LEAF drum circle) isn't ported — it's superseded by
  the festival POI layer (`festival.js`) + the lakeside camp/forest rings. **Perf (R3):**
  hard-capped at the proven ~80 trees/chunk (56 on low tier via `forestTreeDensityMul`,
  verified exact); the per-chunk decision cost is ~1.6 ms of `treeDensity` sampling
  (~2.5 ms with the festival plan), well under the 8 ms gate (measured headlessly —
  the live full-framerate draw budget on a low-end device is the one check the throttled
  preview can't give and stays open). Verified seed 1234 at default + low tier: woods
  read as designed, drum nestled, roads/clearings open, zero console errors; legacy
  `?worldgen=0` unchanged. Part of `v2-worldgen-3d-integration` (Group F).

### Changed
- **v2 cluster placement no longer lets trees block a cluster (behind `?worldgen=1`).**
  The festival cluster-center guard now skips `forest_tree` as well as `tree`: a
  cluster's *presence* must not depend on chunk load order (a neighbor chunk's woods can
  register before the cluster's own chunk generates — especially the off-road drum
  circle that lands in a treed pocket). Clusters always build; their own chunk's trees
  dodge them, and a rare cross-chunk tree clipping a cluster edge is cosmetic. Part of
  Group F.
- **v2 lakes are now the worldgen lakes (behind `?worldgen=1`) — the rendered water
  finally matches what the festival planned around.** `LakeManager` used to self-seed
  its own macrocell lakes (320m cells, ~45% density) that had nothing to do with the
  worldgen water `festival.js`/roads avoid — so a legacy lake could sit right where a
  cluster or the spawn was planned. It now reads `src/worldgen`'s lakes (1050m cells,
  ~60% density → fewer, bigger lakes) so the water you see *is* the water the layout
  dodges. The mesh, sealed colliders, decoration (lakeside camps + forest ring), and
  canoes are unchanged — only the source of the lake's center + outline was swapped.
  This removes the two interim band-aids: the post-`buildWorld` spawn-nudge is gone
  (the spawn-clearance is now a single worldgen `lakeAt` walk-to-dry folded into the
  spawn-at-heart step, which works regardless of which lakes are loaded), and the
  cluster placement guard now reads worldgen-aligned water. `?worldgen=0` is byte-for-
  byte unchanged (legacy keeps its self-seeded lakes; verified: 17 macrocell lakes,
  spawn still `(0,65)`). **Determinism gate (R5):** the worldgen outline (absolute
  world vertices) is converted to lakes.js's center-relative form and its winding is
  asserted-then-normalized to CCW before the sealed colliders are placed — all 22
  lakes near origin proved CCW by construction, so the normalize is defensive insurance
  against a future shape silently sealing colliders *outside* the water (which the
  water's `DoubleSide` would mask). In-game point-in-poly now matches worldgen `lakeAt`
  to within 0.3m (a quantize-boundary fuzz at the waterline, harmless). Verified in the
  real game (seed 1234, noon + midnight, default + low tier): spawn lands dry at the
  major heart, the two loaded lakes match the worldgen self-test cells, the collider
  ring traces the lobed shore and the cart is blocked + damaged + ejected when it hits
  it, zero console errors. Self-test still 24/24 (`queryPoint` golden `63c8dea2`, POI
  golden `f8dc276d` — worldgen untouched). Part of `v2-worldgen-3d-integration` (Group E).
- **v2 spawn now drops you AT a festival (behind `?worldgen=1`) — outside a major
  heart's entrance arch, facing its main stage.** Instead of the legacy fixed
  `(0,65)`, the game finds the nearest major heart to origin and relocates Zerble
  just beyond its arch facing the stage, so you drive in through the gateway into a
  live festival — the main stage, string lights, food-truck court, and vendor street
  are right there from frame one. The guaranteed welcome jugs (bumped 2 → 4, fanned
  around the arrival) ring the new spawn, and the spawn-jug placement now spirals out
  to ~26m to find a clear gap between stalls rather than giving up in a dense core.
  (Interim: until the lakes layer is swapped to worldgen, a legacy lake can overlap
  the planned spawn, so the spawn nudges forward onto dry shore if it lands in water.)
  `?worldgen=0` is unchanged (still spawns at the origin stage). Part of the
  `v2-worldgen-3d-integration` change (CG3, D2.6).
- **v2 festival now places structured, feature-anchored CLUSTERS in-game (behind
  `?worldgen=1`) — the redesign replacing the Group-D random scatter.** Where Group
  D sprinkled single props per chunk (solo sugar shacks, drum circles on arbitrary
  grass, no clustering), the festival now reads as *designed*: a heart builds a main
  stage at its center, an entrance arch + string lights on its primary approach
  road, **food-truck court rings and double-row vendor markets lining its streets**,
  a guaranteed refuel bubble vendor, a drum circle off in a treed district pocket,
  and porta-potty banks tucked beside each cluster — while **packed 12–20-site camp
  villages** fill the districts out back. The pure `src/worldgen/festival.js` POI
  layer decides the layout (memoized per heart); `placement.js` filters it per chunk
  by cluster-center ownership; `chunks.js` builds each cluster from a stable
  per-cluster `clusterSeed` (so model variation never rides chunk-rng draw order).
  **Sugar shacks now appear ONLY inside food courts** (killing the solo-shack bug),
  the food-court ring gained an inter-truck overlap guard the legacy plaza lacked,
  and the cluster placement guard no longer counts lake colliders/markers as
  "buildings" (which had been silently eating courts/vendor rows placed near
  lakeshore roads). Verified in the real game at a major heart (seed 1234): clusters
  line the roads, nothing in water, zero console errors; per-chunk decision cost
  ~0.9 ms warm / ~37 ms cold-once (memoized), well under the 8 ms steady-state gate.
  Determinism self-test still 20/20 (`queryPoint` golden `63c8dea2`; new POI golden
  `f8dc276d` on node). Part of the `v2-worldgen-3d-integration` change (CG2/CG3).

### Added
- **Map-sandbox `festival` POI overlay — see the festival LAYOUT in 2D before the
  3D build.** `map-sandbox.html` gained a `festival` layer toggle that draws the
  planned cluster layout from the new pure `src/worldgen/festival.js` POI layer:
  stage squares (with a road-facing tick), food-court rings, vendor-row segments
  (aligned to the road), entrance-arch arcs, bubble-vendor/porta dots, drum-circle
  rings, and camp-village footprint envelopes. This is the "build the harness,
  then the feature" surface for the festival-layout redesign — a structured,
  feature-anchored cluster system (stages/courts/vendor rows lining a heart's
  approach roads, camp villages out in the districts) that replaces the v2 Group-D
  per-chunk random scatter. The POI layer is render-agnostic data; the
  determinism self-test grew a separate POI golden (`fe82f8cc` on node) + a
  major-heart window-invariance check, and the `queryPoint` golden is unchanged
  (`63c8dea2`). Not wired into the game yet — that's the next slice. Part of the
  `v2-worldgen-3d-integration` OpenSpec change (festival-layout redesign, CG1).
- **v2 worldgen festival placement — heart anchors + role×rank prop scatter
  (behind `?worldgen=1`).** The headline content slice: v2 chunks now place real
  festival content from the worldgen layout instead of the old per-chunk theme
  dice-roll. A new **pure** `src/worldgen/placement.js` (no three.js, no model
  imports) maps each location's **`(roleTier × heart.rank)` tuple** —
  `core/district/outskirts` (a distance band) crossed with `minor/major` (a heart
  size class), two distinct enums kept explicitly apart — to a prop palette and
  returns plain descriptors; `chunks.js` does the build + `registry.add`. The one
  chunk that owns a heart's *center* builds that heart's **anchor**: a main stage
  + food-truck court for a `core×major` hub, a side stage for `core×minor`,
  placed at the heart center, **nudged off any road/water corridor**, and rotated
  to **face the nearest road** — the structural fix for the old "stages-on-roads"
  bug (`buildStage` is now yaw-aware; the legacy theme path passes yaw 0 and stays
  byte-identical). Every chunk additionally **scatters** its role's palette
  (vendors, food trucks, porta-potties in the core; campsites + drum circles in
  the districts; sparse camps in the outskirts) at jittered buildable points,
  re-deriving role/rank from `queryPoint` at each point — never a registry lookup
  of the possibly-unloaded anchor. Verified by booting the *real* game at a major
  heart (seed 1234, chunk (8,-3)) at noon + midnight across low/mid/high tiers
  with zero console errors: stages land off roads, nothing lands in water, the
  stage light show + food-truck glow read at night. Determinism self-test stays
  20/20 (golden `63c8dea2` unchanged — placement only *reads* the contract);
  per-chunk placement sampler costs ~2.5–4.4 ms warm / ~8 ms cold-once, under the
  8 ms gate. Still **default-off** while the rest of the v2 world is built out.
  Part of the `v2-worldgen-3d-integration` OpenSpec change (Group D).
- **v2 worldgen roads in the 3D game (behind `?worldgen=1`).** First content
  slice wiring the 2D `src/worldgen/` generator into the live world: each chunk
  now renders the portions of the worldgen **arterial road network** crossing it
  as dirt ribbons, replacing the old rigid `+`-grid of trails. Each arterial is
  one deterministic, pair-owned polyline; a chunk clips it to its own 80 m cell
  (Liang–Barsky) and builds a ribbon that traces the *actual* worldgen vertices —
  so adjacent chunks meet at the identical shared boundary point with the
  identical tangent (no seam kink, verified to 0.01 m), and the rendered road
  lands exactly where `nearestRoad`/`noBuild` reports it (one **raw** source of
  truth). Roads are passable (no collider); NPCs get a chunk-keyed road waypoint
  so they drift along them. Net draw delta is negative — ~1 ribbon per
  road-bearing chunk vs the old 2 ribbons + a pad. Still **default-off**
  (`?worldgen=1` to see it; `?worldgen=0`/no flag is the shipped world) while the
  rest of the v2 world is built out. Part of the `v2-worldgen-3d-integration`
  OpenSpec change (Group C).

### Fixed
- **Map-sandbox now resolves a numeric seed the same way the game does.** Typing
  `1234` (or `?seed=1234`) in the map sandbox FNV-hashed it as a string, so it
  showed a *different* world than the game — which parses a pure-integer seed as a
  number. Since the whole point of the sandbox is "tune a map here, reproduce it in
  the game under the same seed" (the one seed door), that silently broke
  reproduction for numeric seeds. Added a `resolveSeed` matching the game's
  integer-first parse, so seed `1234` is now the identical world in both.
- **Forest-path material was a latent shader-recompile-storm.** The shared
  `_forestPathMat` ([forests.js](src/forests.js)) is reused by every forest
  center chunk but was never tagged `userData.shared`, so the first forest-chunk
  unload disposed it out from under every other forest — forcing a shader
  recompile the next frame any forest path drew (footgun #6). Tagged it shared so
  the chunk-unload disposal walk skips it. Surfaced while building the worldgen
  road material (which hit the same class of bug: a `depthWrite:false` material
  built at module-eval renders invisibly, so the road material is now created
  lazily at chunk-generation time, mirroring how the legacy per-chunk path
  material has always been built).

## 2026-06-06

### Added
- **World-map sandbox — a 2D top-down brain for designing the procedural
  festival layout.** New `map-sandbox.html` + a render-agnostic `src/worldgen/`
  module (no three.js, no DOM) that deterministically lays out an *infinite*
  world as plain *data*: rare rank-weighted **hearts** (festival anchors —
  minor/major) on a macrocell grid, meandering **arterial roads** connecting
  them (routed around water), elongated/lobed **lakes** (peanut/oval/kidney, not
  just circles), and an organic gap-filling **forest** field with tree-rings
  hugging the lakeshores. The Canvas-2D viewer renders it across *kilometers*
  with pan/zoom, deep-link URLs, **live tuning sliders** (drag to re-roll the
  map), a **point inspector** (hover → role tier + what each spot would host),
  and an on-screen **determinism self-test**. This is the planning surface for a
  future "natural roads + intentional structure" worldgen — it intentionally
  does **not** touch the live game yet (wiring it in is a separate change). The
  central idea: a hierarchy of centers (à la real geography) gives an infinite
  world intentional structure with no global plan; sparsity is the space between
  hearts. Built spec-first via OpenSpec (`procedural-map-generator`) with a
  tier-3 council review; determinism (footgun #4) is proven by a
  window-invariance + negative-control + cross-engine golden-hash harness.
  Distinct from `sandbox.html` (one model in 3D) — this is the *whole world
  layout* in 2D top-down.

### Changed
- **Lake-heart roads now converge on a single shore proxy, and roads route
  *around* a lake instead of vanishing at it.** A heart that sits in a lake used
  to land each of its roads at a different shore point (the roads aimed at the
  heart's in-water center and stopped at a scatter of edge points); now every one
  of that heart's arterials converges on **one** representative point on the
  shore — the heart pushed radially out from the lake center to just past the
  waterline (`heartProxy` in [roads.js](src/worldgen/roads.js)). And when the
  straight line between two hearts would cross open water, the arterial now bends
  **around** the blocking lake on an arc that rides just outside the shore
  (`arterial` → `arcAround`) rather than being nulled — so a lakeside heart
  reaches its across-the-lake neighbors and two hearts on opposite shores finally
  connect (113 such around-the-lake links in a single 18 km box at seed 1234,
  every one of them previously a missing road). Bridges are still cut, so if even
  the detour can't find a dry path the road simply doesn't exist; verified **0 of
  90,026** densely-sampled road points land in water. Determinism harness stays
  **20/20** green (golden re-rolled — road output legitimately changed).
- **Forests render as scattered tree-dots, not a flat green wash.** The map
  sandbox now stipples woods as world-anchored green dots whose density follows
  the `treeDensity` field (more trees = denser dots, thinning to bare field),
  so you can actually read where forest is and watch roads thread through it —
  the lakeshore tree-rings in particular now read as rings. Dots are anchored in
  world space (they stay put while you pan) on a grid whose spacing tracks zoom
  (constant on-screen density), sampled cheaply off a coarse density grid and
  batched into one fill. The underlying forest *generation* is unchanged — this
  is a viewer-render change only.

## 2026-06-05

### Added
- **Lurleen has her own engine.** Her cart now runs a spatialized motor — a
  lighter, brighter, peppier sibling of Zerble's wheezy gas-engine
  (`createEngine` in [sound.js](src/sound.js) is now profile-driven: higher
  fundamental via `pitchMul` 1.5, gentler tanh soft-clip, less noise rumble,
  faster putt-putt). It pans + attenuates from her world position through an
  `equalpower` PannerNode, so you hear it come from where she actually is and
  fade out past ~130 m. Pitch and volume track her *real* speed whether she's
  wandering on her own or chasing you, and since she has no throttle the engine
  derives a rev "boost" from her acceleration — it growls up as she speeds to
  catch Zerble, eases off when she coasts. Driven from
  [main.js](src/main.js) right after `lurleen.update()`, and auditionable in the
  sandbox `lurleen` / `lurleen_zerble` views.
- **Social share previews (Open Graph + Twitter cards).** Added `og:`/`twitter:`
  meta to [index.html](index.html) so a shared link unfurls with the Zerble art
  and the "bring the bubbles, collect the smiles" tagline instead of a bare URL.
  Image + URL are absolute against the GitHub Pages deploy
  (`garyreckard.github.io/zerble-at-the-festival/`); the image is the existing
  `assets/zerble.png` for now — a dedicated opaque ~1200×630 landscape share
  image (the current art is near-square and will letterbox) is the follow-up
  polish.

### Added — Porta-potties

- **Porta-potties, with a whole little life of their own.** New model
  ([portaPotty.js](src/models/portaPotty.js)): a festival-blue / blue-grey unit
  (~2× a person, so it reads as a real structure) with a light-grey domed roof, a
  side vent, and a door on a real hinge. The body is a **hollow shell** (merged to
  one draw call) with a real doorway opening, so when the door swings open you
  **see inside** — blue walls, a grey floor, and a molded toilet with a dark seat
  (interior only renders while the door's open, so closed units cost nothing).
  Blue body colors vary slightly per unit so a row reads with variety. A
  vacant/occupied indicator on the door reads green when free, red when in use.
- **They spawn where it makes sense.** [chunks.js](src/chunks.js)
  `scatterPortaPotties` drops banks of **1, 2, or 5** near a chunk's gathering
  spot — stages, food plazas, drum circles, vendor rows, camp villages — but
  pushed off to the side, doors facing the crowd, the way real festivals tuck
  them just past the action. Placement uses a fresh salted RNG (`POTTY_SALT`)
  so adding them never reshuffles any existing prop layout (footgun #4). Banks
  dodge buildings, paths, and water for the whole row before committing.
- **They're solid, and bonking one is funny.** Registered as a hard collider
  (light damage 4). A dedicated toast bank fires on a hit; if the unit is
  **occupied**, the flustered occupant gets ejected mid-business (fleeing) and a
  separate, more mortified toast bank plays. New hollow-plastic collision SFX in
  [sound.js](src/sound.js).
- **NPCs actually use them.** New crowd states ([crowd.js](src/crowd.js)):
  NPCs occasionally (rarely, realistically — gated low via `POTTY_URGE_RATE`)
  get the urge and head for the nearest unit. They walk to the door, the door
  opens, they step in, the door closes (occupied + a subtle in-use wobble +
  occasional comedic poop noises from within), then after 6–13s the door opens,
  a puff of **thin squiggly green stink lines** rises, and they walk off. Every state has a
  give-up timeout and releases its unit on abort / despawn / chunk-unload, so a
  unit can never get stuck phantom-"occupied."
- **The unlocked-door gag — now you see the victim.** When an NPC reaches an
  occupied unit, there's a chance the occupant didn't lock it — the new arrival
  yanks the door open and you see the **startled occupant sitting right there on
  the toilet** (reusing the seated pose, arms thrown up). Both jump back, the door
  slams, the occupant scrambles to lock it, and the startled NPC trundles off to
  try the next-closest unit. Locked units just get a brief wait, then the NPC
  moves on. (Ramming an occupied unit with the cart triggers the same eject.)
- **Faintly lit at night, cheaply.** The side vent + an interior wall panel use an
  emissive material (no `Light` object) that ramps with `nightness²` — dark by
  day, a soft "candle/LED inside" glow after dusk, a touch brighter when
  occupied. Bloom catches it.
- **Sandbox coverage.** Two new entities — `porta_potty` and `porta_potty_bank`
  (5 units) — run a staggered approach→enter→occupied→exit demo cycle against
  the time-of-day slider so the door swing, vent glow, indicator, wobble, and
  stink puff are all verifiable in isolation. "Hit it" wired to the new SFX.

### Changed
- **Reverse→forward steering no longer fights you mid-switch.** The steering
  direction (`dir` in [zerble.js](src/zerble.js) `update()`) was keyed to the
  sign of *current velocity* — realistic "back up and the rear swings the other
  way" car behavior, but it meant that when you flipped from reverse-and-turn
  (S+D) to forward-and-turn-the-other-way (W+A), your new steering input stayed
  inverted for the ~130 ms the cart was still drifting backward, then snapped
  direction the instant speed crossed zero. Now `dir` follows *throttle intent*
  (`Math.sign(throttle)`) whenever you're on the gas, falling back to velocity
  only while coasting: press forward and steering re-orients to forward-style
  immediately, even before momentum reverses. The intentional reverse-pivot feel
  is preserved when you're actually holding reverse. Verified with a scripted
  S+D→W+A scenario — heading now climbs monotonically across the zero-crossing
  instead of kinking at it.

### Fixed
- **Dev cache-buster covers every module again — local edits to 10 files
  silently weren't reloading.** The `mods`/`models` arrays in
  [index.html](index.html) (and the parallel pair in [sandbox.html](sandbox.html))
  had drifted out of sync with `src/`: the `adaptiveQuality`, `analytics`,
  `contextLights`, `forests`, `timeOfDay` modules and the `campsite`,
  `frisbeePlayer`, `hulaHooper`, `leafDrumCircle`, `tribalFigures` models were
  missing, so on local/preview hosts they loaded without the `?v=<timestamp>`
  suffix and Chrome could heuristic-cache their bodies past `no-store`
  (CLAUDE.md footgun #1) — edits didn't show on reload. Both files now list the
  COMPLETE src + models set so transitive imports get busted too and the lists
  can't quietly go stale again. (Sandbox's `'three'` still points straight at
  unpkg — no threeShim — by design.)
- **Favicons + web manifest now load on the live deploy.** The favicon /
  apple-touch-icon / manifest `<link href>`s in [index.html](index.html) and the
  icon `src`s in [site.webmanifest](site.webmanifest) were root-absolute
  (`/favicon.svg`, `/site.webmanifest`, `/web-app-manifest-*.png`) — on the
  GitHub Pages project subpath (`/zerble-at-the-festival/`) those resolve to the
  org root and 404 even though the files ship in the repo. Switched to
  document-relative paths so they resolve under the project path.

### Performance
- **Crowd + collision sim: a spatial-hash broadphase kills the O(n²)
  steady-state cost.** Parked at the main stage with 500 NPCs / ~4.4k registry
  entries, `crowd.update()` measured **~39.7 ms/frame** — the dominant slice of
  the ~52 ms frame that pinned the cart near 19 fps (the measurement in
  [.claude/perf-pass-4-plan.md](.claude/perf-pass-4-plan.md)). Two loops were
  quadratic: NPC-NPC separation walked *every other* NPC, and per-NPC building
  avoidance (`nearestFootprintAvoidance`) walked the *entire* registry footprint
  list every NPC every frame ([crowd.js](src/crowd.js)); the kid push-out
  ([obstacles.js](src/obstacles.js)) and Zerble's own collision
  ([main.js](src/main.js)) likewise scanned all ~4k colliders. Added a uniform
  hash grid ([spatialGrid.js](src/spatialGrid.js)) + a registry broadphase
  (`rebuildSpatialIndex` / `footprintsNear` / `collidersNear` in
  [registry.js](src/registry.js)), rebuilt once per frame from live positions in
  [main.js](src/main.js). Separation now queries a ~9-cell neighbourhood;
  avoidance + collisions query only nearby cells; and Zerble's collision pulls
  nearby colliders into reused scratch + pooled wrappers instead of spreading all
  ~4k into a fresh array each frame. **Result: `crowd.update()` ~39.7 ms → ~6.96 ms
  (~5.7×, with *more* NPCs loaded), plus a ~0.65 ms/frame rebuild — net crowd CPU
  ~39.7 → ~8.8 ms.** The grids are pure query accelerators (no rng, no placement),
  so determinism is untouched; verified the footprint avoidance result is
  byte-identical to the old full scan across all 500 NPCs (max diff 8e-15) and the
  collider query is a faithful superset (0 misses across 7,569 probe points).
  Booted clean at high/mid/low. (PLAN.md §2.1, the unshipped half of perf-pass-4.)

## 2026-06-04

### Added
- **A couple of bubble-juice jugs now spawn near where you start.** Two
  guaranteed jugs drop at seeded-random spots in a 25–60m ring around the spawn
  point (0,0,65) — a different spot every load (fixed under `?seed=`) — so a new
  player meets the refill pickup early and doesn't run dry before stumbling on a
  random one. The existing rare per-chunk scatter (~1 in 9 chunks) is unchanged
  and still runs everywhere, including near spawn (so you'll sometimes see a
  third nearby). Targets are computed once from the session seed and dropped as
  their chunk loads (all within the boot-load ring); placement uses no chunk RNG,
  so existing world layouts are untouched. ([chunks.js](src/chunks.js))
- **Crowd "woo!" cheers over the applause.** A few voiced shouts now layer on
  top of the clap cluster at each song-end — two slightly-detuned sawtooths
  shaped by parallel vowel formant bandpasses (an /oo/) with a rise-then-sag
  pitch contour and fade-in vibrato, so they read as excited shouts instead of
  the buzzy single-bandpass sawtooth that was tried before. 2–3 per cheer, a mix
  of lower and higher voices, kept low under the bed, fired live on the stage
  panner so they share the applause's distance falloff. ([sound.js](src/sound.js))
- **The intro now opens on applause.** The pinned origin (0,0) main stage
  starts its very first song already at its closing **outro**, so a
  freshly-spawned player hears the band wrap up over ~10s and the crowd erupt —
  the festival's first applause moment, right in the intro, instead of waiting
  out a full ~2-minute song before any applause ever happens. Threaded as an
  `introFinaleSeconds` option through `attachStageMusic → createStageMusic →
  runStageSong`; only the origin stage sets it (it snaps to the final section's
  downbeat so it opens cleanly), every other stage plays full songs from the
  top. ([chunks.js](src/chunks.js), [sound.js](src/sound.js))
- **Proper GM percussion kit in the MIDI player.** The per-channel rework
  (2026-06-03) routed drums to a kit, but the kit was thin — kick plus three
  flat white-noise voices, and *everything* outside kick/snare/hat (toms,
  congas, bongos, shakers, cowbell, agogô, tambourine, woodblocks, claves…)
  collapsed into one snare hiss, so a percussion-heavy track came out wrong.
  Built a real General-MIDI kit ([midiPlayer.js](src/midiPlayer.js)): a
  pitched-membrane **tom/conga/bongo/timbale** pool (round-robin ×3 so fills
  don't cut their own tails off), an FM **bell** for cowbell/agogô/triangle/
  ride + ride bell, **filtered** noise for hats (high-passed tick, not "shh"),
  snare (band-passed crack), cymbal, and shaker, and woody "toks" for
  claves/woodblocks. `GM_DRUM` maps the full 35–81 percussion range to
  per-note pitches; a per-voice time-nudge guard keeps coincident hits from
  tripping Tone's monophonic "strictly greater" constraint. Verified every GM
  family fires cleanly (including simultaneous hits) — the individual timbres
  are tunable by ear from here.

### Changed
- **Bubble-wand sticks now meet their loops.** On the cart's bubble-machine
  wand wheel, each spoke stopped ~1/3 of a loop-diameter short of its ring,
  leaving a visible gap; the sticks now extend to overlap the loop's inner edge
  so each handle and ring visibly join. ([zerble.js](src/zerble.js))
- **Sandbox exposes its orbit camera for scripted framing.** `window.__sandbox`
  now includes `cam` + `applyCam()`, so a precise close-up can be set from
  `preview_eval` (target/yaw/pitch/dist, then `applyCam()`) instead of fighting
  the input-only camera. ([sandbox.html](sandbox.html))
- **Crowd applause resynthesized — it sounds like a crowd now, not rain.** The
  old `playCrowdCheer` was dominated by one continuous band-passed white-noise
  bed (which reads as static/hiss), plus 22 identical clap bursts and a few
  sawtooth "woo" voices that sounded synthetic. Rebuilt on the model the
  clap/applause synthesis literature uses (Peltola/Välimäki; Lee & Reiss,
  "Real-Time Sound Synthesis of Audience Applause", AES): applause is a
  **Poisson process of hundreds of individual claps**, each a short
  exponentially-decaying noise burst through a broad resonance (~0.7–2.0 kHz,
  the spectral range of real claps), rendered into one buffer with a swell→thin
  density arc and a ~2.8 kHz lowpass so the cluster sits warm (~1.8 kHz
  centroid) instead of hissing. The sawtooth "woo" voices are gone. Playback is
  now a **single source node** (down from ~25), and the rendered buffers are
  pooled (≤3, built lazily) so a song-end never hitches re-synthesizing on
  lower-end devices. ([sound.js](src/sound.js))
- **Applause swells the instant a song ends, not ~4 seconds later.** The
  cheer/applause callback used to fire ~0.2s *before* the 4.5s cheer gap ended,
  leaving an awkward near-silent gap between the last note and the crowd's
  reaction. It now fires ~0.2s *after* the final note, so the crowd reacts as
  the song lands and the applause tail bleeds into the next song's intro (the
  debug force-end matches). Also reset `nextBeatTime` on each new song so a
  post-gap restart begins cleanly at beat 0 instead of catching up the frozen
  gap beats and starting several beats into its intro. ([sound.js](src/sound.js))
- **MIDI drums rebalanced — the kit no longer drowns the melody.** The new GM
  kit (above) shipped with the kick at −4 dB, *louder* than the bass (−5), lead
  (−8), and pad (−10), so the drums sat on top of everything. Pulled the kick to
  −9 and the rest of the kit down 3–6 dB (snare −11, toms/congas −12,
  cymbal/bell −15, hats −16 / −18, shaker −19) so bass + lead + kick lead the
  mix and the rest tucks underneath. Levels are still a by-ear work-in-progress.
  ([midiPlayer.js](src/midiPlayer.js))
- **Trip chromatic aberration hits a lot harder.** The shader's RGB-split offset
  constant went 5× (`0.005` → `0.025` in [trip.js](src/trip.js)), so the color
  fringing at full strength is far more pronounced. The slider/envelope range is
  untouched — only the ceiling moved up.
- **Trip lens distortion breathes deeper.** The barrel "breathe" amplitude went
  `0.08` → `0.28`, so the bulge pulses in and out ~3.5× more dramatically over the
  course of a trip.
- **Dynamic-mode chromatic aberration now bursts.** The mid-trip CA curve keeps
  its four smooth 0.25→1.0 breathing swings, but layers occasional fast bursts on
  top — brief, irregularly-timed windows where a 22-cycle wiggle punches the value
  up to ~1.38 (above the old hard 1.0 ceiling) and bounces back. Two high-power
  raised humps at 3 and 5 cycles gate the bursts so they land off-beat instead of
  on a metronome, and every term zeroes out at the segment seams (`p` = 0.25 /
  0.75) so a burst can't introduce a discontinuity. Verified by sampling the
  shipped curve: range 0–1.38, smooth (max adjacent step 0.018), 14 peaks across
  the middle half.
- **Brass band + puppet parade spawn anywhere, and now rarely wander elsewhere.**
  The brass band's march loop was hardcoded near world origin, so it always
  blared right on the start area; it now uses the same random-anchor placement
  the puppet parade already had (0–150m from origin). And both loops *relocate*:
  once you've driven 500m away from a loop — deliberately rarer than the wook
  recycle (300m) — it hops to a fresh anchor 150–300m around your new position
  ([obstacles.js](src/obstacles.js)), so it reappears across the field rather
  than popping in on top of you. The band's spatial music rides along; since the
  hop only fires at 500m+ (well out of earshot) it's silent and fades back in as
  you approach the new spot. Both units now share a `_basePath` +
  `placeLoop`/`maybeRecycleLoop`, and their `update()` takes the player position
  to drive the recycle test.

### Fixed
- **Stage songs never actually ended, so the crowd never applauded.**
  `currentSection()` fell back to the last section forever once a song ran past
  its outro, making the song-end branch dead code: every melodic stage looped
  its closing section indefinitely, and the "crowd goes wild" applause + cheer
  (built 2026-06-03) could only ever fire via the debug force-end — which is
  what the "verified live" note in that entry was unknowingly observing. Songs
  now end when they run out of sections: the cheer gap opens, the synthesized
  applause + NPC arms-up cheer fire, and a fresh song fades in a new key.
  Verified live — the origin stage ends ~10s in (its intro finale), 13 audience
  NPCs flip into the cheer state, and the song restarts at songIdx 1.
  ([sound.js](src/sound.js))
- **Audio could boot effectively silent until you nudged the master slider.**
  The mute added 2026-06-03 set `masterGain` *itself* to 0, and `masterGain` is
  the value `_saveVolumes()` persists — so muting and then touching any volume
  slider wrote `zerble.vol.master = "0"`, which every later boot restored to the
  0.05 "anti-stuck" floor (inaudible). Mute now lives on a **dedicated
  downstream node** (`masterGain → muteGain → destination`, mirroring
  `musicDuckGain`), so `masterGain` always holds the real level and can never be
  persisted as 0. The restore also now heals a sub-audible saved value (an
  existing corrupted `"0"`) up to the default instead of the 0.05 floor, so an
  already-affected browser fixes itself on the next load — no manual clear
  needed. ([sound.js](src/sound.js))
- **Mute is session-only now — the game always boots unmuted.** Muting then
  reloading used to start the game silent while the (lazily-built) backtick
  checkbox read unchecked, so you had to check-then-uncheck to get sound back.
  Mute is no longer persisted (any legacy `zerble.muted` flag is cleared on
  boot), so a reload always comes up with sound and the checkbox always matches
  reality. ([sound.js](src/sound.js))

## 2026-06-03

### Added — Real songform: stages play actual *songs* now, with genre variety
The big one. Every melodic stage was an infinite `setInterval` loop rotating a
few melody variants forever; now each runs a finite **song** with an arc, ends,
and a fresh song begins — driven by a new shared `runStageSong` engine in
[sound.js](src/sound.js) that the genre defs plug into.
- **Sectioned arcs.** A song is an ordered run of named sections (jam:
  intro→verse→chorus→verse→bridge→chorus→outro; dance:
  intro→build→drop→break→build→drop→outro), each with its own active-voice set
  and intensity. Voices come in and out by section (just kick in the intro,
  full band in the chorus, drop-to-bass in a dub break). Each stage runs its
  own song independently — no global lockstep.
- **Per-song tempo *and* key.** Every new song re-rolls its tempo within the
  genre's range (so two jam stages can groove at 91 and 98 BPM at the same
  time) and transposes to a new key from a pleasant-interval set, never
  repeating the last key. Verified live: a song ending at tonic 232Hz/91BPM
  restarted at 209Hz/99BPM.
- **Three new genres** alongside jam + brass: **dance** (four-on-the-floor,
  off-beat hats, resonant acid bass, 16th arp, noise-riser builds into drops,
  ~122–130 BPM), **world** (son-clave woodblock, conga/djembe, shaker, agogô
  bell, marimba ostinato, walking bass, ~96–116 BPM), and **dub** (echoey
  off-beat skank stabs through a per-voice feedback delay, deep sub-bass,
  cross-stick, ~68–84 BPM). The Euclidean rhythm helper `E()` was hoisted to
  module scope so dance/world share it with the forest engine.
- **Stages roll a style for variety.** [chunks.js](src/chunks.js) now picks
  each stage's genre from a seeded palette (`pickStageStyle`, fresh salt) —
  main stages from jam/dance/world/dub (jam-weighted), side stages from
  brass/dance/world/dub — so the festival sounds like a real lineup instead of
  the same jam band everywhere. **The origin (0,0) main stage stays jam** (the
  calibrated home tune). Audio-only, so no chunk geometry re-rolls. Drum
  circles, forest circles, and the marching band keep their characters.
- **The four "smaller music polish" items fell out of the engine for free**,
  applied across every melodic genre at once: dynamics-aware breath (rest
  probability couples to section intensity + a gain LFO — loud sections pack
  notes, quiet ones breathe), tempo wobble (±~2% sinusoidal drift recomputed
  per beat, so the groove isn't metronomic), shuffled variant order (never
  repeats the last pattern/key index), and lead-timbre drift (the lead
  oscillator can swap triangle↔sine↔square at section boundaries).

### Added — When a song ends, the crowd goes wild
A song-end now sends a signal to the audience: nearby NPCs **focus the stage,
jump up and down, throw their arms up, and cheer** for ~5s, then the next song
fades in. `runStageSong` fires `Sound.onSongEnd(x,z)` at the song's audible end
(reading the stage's *live* panner position, so the moving brass band reports
where it actually is); [main.js](src/main.js) routes that to a new
`crowd.cheerNear(x,z)` ([crowd.js](src/crowd.js)) which flips available NPCs
within 16m into a `cheering` state — a positive-half-sine **jump** (~0.32m,
desynced by NPC index so it isn't lockstep), an **arms-up pose** (a precomputed
`_armsUpMat` multiplied onto the arms InstancedMesh only, mirroring the
existing seated-leg-bend `_sitLegMat` trick), and a smile pop. A synthesized
**applause + "wooo" swell** (`Sound.playCrowdCheer`, a temporary positional
panner → `sfxBus`) plays from the stage, distance-gated so far stages stay
quiet. Matrix-only crowd change — zero new draws/instances; verified to run
clean on `?perf=low`.

### Added — MIDI player: real instruments, GM routing, a granular climax
The M-key player was one `PolySynth(FMSynth)` for every track. Now
([midiPlayer.js](src/midiPlayer.js)):
- **Per-channel instruments + General MIDI program map.** Each parsed track
  routes by `GM_CATEGORY(program, isPercussion)` to a small synth pool — a drum
  kit (MembraneSynth kick/toms + per-class NoiseSynths for snare/hat/cymbal,
  switched on GM drum note numbers), a bass synth, a melodic PolySynth, and a
  softer pad. Verified on the 17-track Toto Africa MIDI: routed to
  drums/bass/lead/pad with names matching ("Electric Drum Kit"→drums, "Bass
  Guitar"→bass). Drums sound like drums instead of all-FMSynth-everything.
- **Parallel long reverb for the trip swell.** A second `Reverb({decay:12})`
  runs in parallel with the short hall; its wet crossfades **up** at the trip
  peak (the `peakBell` at progress≈1/3) for a true "cathedral opens" — verified
  ramping 0→0.55 at peak, back to 0.
- **Granular synthesis at the climax.** An inline `AudioWorklet` (registered via
  a Blob URL, so it stays no-build) splices a ring-buffer grain-stutter between
  the reverb and output; its `mix` ramps up only at the trip peak (verified
  0→0.65) and is transparent passthrough at idle. Clean fallback — if
  `audioWorklet`/`addModule` is unavailable, the splice is skipped and playback
  is unaffected.
- **Per-track muting** (`midi.getTracks()` / `setTrackMute(i, on)`) with a live
  "MIDI tracks" panel in the backtick overlay ([debug.js](src/debug.js)) for
  remixing a song on the fly during a trip.

### Added — Audio polish
- **Night owl.** A low "hoo… hoo-hoo" on a slow timer during deep night
  (`nightness > 0.85`), filling the quiet gap after the songbirds roost —
  a new `owl` voice + scheduler in [sound.js](src/sound.js)'s nature engine.
- **Directional crickets & frogs.** The cricket/frog beds now pan toward the
  nearest forest / lake edge instead of a fixed stereo spread —
  [main.js](src/main.js)'s nature scan captures the nearest source's direction
  and feeds a listener-relative pan to `setCricketBed(level, panX)` /
  `setFrogBed(level, panX)`. The pond is now audibly *over there*.
- **Nature-bus volume control** (`Sound.get/setNatureVolume`, persisted as
  `zerble.vol.nature`) + a 5th slider in the backtick overlay, alongside
  master/music/sfx/midi.
- **A real mute.** `Sound.setMuted(true)` silences playback via a dedicated
  mute node, so you can fully mute past the ≥0.05 anti-stuck restore clamp.
  Backtick mute checkbox. (Reworked 2026-06-04 — see that day's *Fixed* — to be
  session-only and to stop it corrupting the saved master volume.)
- **Output-routing diagnostics.** `Sound.diagnostics()` now reports
  `outputRouting` (channel count, sample rate, and best-effort audio-output
  device labels with a likely-Bluetooth flag) to help chase "iOS is silent —
  is it routed to a ghost device?".

### Changed
- **Stage music cross-fades between stages instead of popping.** Each stage now
  has a per-stage `master` gain ([sound.js](src/sound.js)); [main.js](src/main.js)
  walks the active stage registry each frame and rides each gain by distance
  with a ~0.6s time-constant (and the PannerNode rolloff was softened), so
  driving from one stage's range into another's swells/fades over ~1.5s rather
  than abruptly swapping like a radio station.
- **`?sounddebug` is no longer the only way to surface the mobile audio toast.**
  It now also enables via `?debug` or a `zerble.debug` localStorage flag —
  still off by default in production ([main.js](src/main.js)).

### Added — GA4 tracking caught up to everything shipped since launch
The original GA4 wiring (2026-05-25) covered honks, smiles, collisions, views, Lurleen, and trips. A pile of systems landed since — the whole bubble-juice loop, passengers, the blast verb, vendors, the perf/adaptive-quality work — none of it tracked. Closed the gap across four fronts, all through the existing no-op-safe [analytics.js](src/analytics.js) wrapper (still gated off local hosts), keeping the one-event-with-a-param pattern so we stay nowhere near GA4's 500-event-name cap.
- **The bubble-juice economy.** `bubble_ran_dry` (friction — fires each time the tank empties, with a climbing `count`), `refuel{source: jug|vendor}` (the vendor case edge-detected off the refill stream so it isn't per-frame, [main.js](src/main.js)), and `bubble_blast` for the marquee G-hold verb (once per run, like `first_honk`).
- **Session shape + context.** A `session_end` summary fires on tab-hide via **beacon transport** (mobile-reliable, unlike `beforeunload`) carrying duration, smiles, best, max juice, honks, and the run's jug/vendor/trip/passenger/ran-dry counts; the guard resets when the tab returns so a briefly-backgrounded session still logs a fuller snapshot on the real exit. `game_start` now carries `{perf_tier, touch, seeded, returning}` so every downstream event is segmentable by device and player type.
- **Field health.** Uncaught errors (`window.onerror` + `unhandledrejection`) now report as GA4 `exception` events, capped at 8/load so a render-loop error can't flood — the only way we'll see field crashes on devices we can't repro (e.g. the Safari frozen-module class, [threeShim.js](src/threeShim.js)). `quality_downgrade` fires when the adaptive monitor steps quality DOWN under load ([adaptiveQuality.js](src/adaptiveQuality.js) now passes the triggering frame time through `onLevelChange`), with the avg fps + perf tier.
- **Feature discovery + engagement.** A single `feature_used{feature}` event (once per run) for the bell/clown honks, the M music toggle, camera zoom (the new chase/FPV zoom), and boost; plus `passenger_board` (first board per run; every board feeds the session_end count, via a new `crowd.onBoard` callback mirroring `onFrown`), `trip_end{source, duration_s}` (logged when a trip fully comes down, [trip.js](src/trip.js)), and `saw_night` (played into nightfall — a clean "stuck around" proxy).
- **Every action keystroke is now covered.** Audited all key handlers: the debug-panel sub-keys (`P` pause, `.` step, `C` colliders, `G` god, `F` freeze — [debug.js](src/debug.js)) and the camera **arrow keys** ([main.js](src/main.js)) now fire `feature_used` too, joining the already-tracked menu opens (`` ` `` → `debug_menu_open`, `T` → `trip_menu_open`) and the gameplay keys above. Only WASD driving is intentionally left out — it's the continuous core loop (captured by `session_end` + duration), not a discrete feature.

### Changed
- **`window.__dbg` is now the one door for agent/dev automation, documented in a new [DEBUGGING.md](DEBUGGING.md).** The repo had three overlapping debug globals — `__game` (live refs), `__debug` (interactive backtick-overlay API, ships to prod), and `__dbg` (localhost-only automation). They stay separate (different gating + owners; `__game` even has a runtime role), but `__dbg` now aliases `.game` and `.debug` onto itself and adds a self-documenting `help()`, so there's a single entry point for headless verification ([main.js](src/main.js)). DEBUGGING.md is the full reference (wired into CLAUDE.md's required reading + a Run+verify summary so every agent loads it).

### Fixed
- **The bubble-vendor refuel stream never stopped when the tank was full.** The bubble machine drains the tank a hair every frame ([bubbles.js](src/bubbles.js) — it's always on, even parked), and `bubbles.update()` runs *earlier* in the tick than the vendor refill loop. So at a full tank parked at a vendor, each frame the drain dropped juice just below 1.0 and the vendor topped it back up — which the old "is the meter rising?" check (`juice > before`) read as an active refill, so the stream flowed forever. Now it only draws while filling a *meaningful* deficit (`before < 1 − 0.02`, [main.js](src/main.js)). The tank still gets topped off invisibly, so a parked-at-vendor meter stays full — it just reads as full with no stream, and no flicker (the vendor keeps `before` pinned just under 1.0, never re-crossing the threshold).

## 2026-06-02

### Added — Zerble, rebuilt: off-road tires, a working bubble machine, reserve jugs
- **Big knobby off-road tires with gold rims.** Swapped the smooth golf-cart wheels for fat AT tires (radius 0.55→0.62, wider) ringed with chunky tread lugs — collapsed into one `InstancedMesh` per wheel, so all the tread is **4 draws, not ~110**. Gold rim + bright-gold center cap. The body was slimmed and each wheel now tucks under a **red fender arch** (half-torus) so the tires read as wheel wells instead of clipping the body (EZ-GO style). ([zerble.js](src/zerble.js))
- **The bubble machine is a real machine now.** Rebuilt the purple box as a **hollow shell with an actual circular hole** in the rear face, black inside. A white **wand wheel** — central hub + 9 spokes, each tipped with a small loop — is recessed on a white **axle** running to the inner back wall, spinning continuously (faster during a G-blast). The bottom **pools with cyan bubble liquid whose level tracks your meter**: full up to the hole's bottom lip, draining to empty as you bubble. Driven by a new `setJuiceLevel()` fed from [main.js](src/main.js). ([zerble.js](src/zerble.js))
- **Wheel-well LED underglow.** Hue-cycling rocker strips down each side, brightness ramping with nightness; on mid/high a single downward wash light tints the ground + tires at night (PERF-gated — low tier leans on the emissive strips + bloom, since the cart already runs 3 lights).
- **Rear brake lights + a mini "ZERBLE" plate.** Two red tail lights low on the back (faint by day, glowing at night) and a canvas-baked **"NORTH CAROLINA / ZERBLE"** novelty plate.
- **Reserve bubble-juice jugs under the back seat.** Stockpiled meters now show as physical jugs stashed in the under-seat cavity, count matching the HUD reserve pips. Placement is a **random non-clipping packing algorithm** — each jug drops into a clear spot, or packs in clipping once the cavity fills. The back-seat cushion was halved in thickness (seating height unchanged) so the jugs show underneath.

### Added — Bubble juice: vendor collisions + a title-card nudge
- **The bubble vendor is solid now — and has opinions.** Gave the stand a collider so you bounce off it instead of driving through ([chunks.js](src/chunks.js), `radius 1.5, damage 2`); ram it and you get a random crack from a new `BUBBLE_VENDOR_TOASTS` pool ("That's a stand, not a drive-thru!", "The juice is for drinking, not crashing!"). Pull up gently and it just refills — no penalty (non-damaging contact). ([main.js](src/main.js) `toastForKind`)
- **Title card explains the juice loop.** Added a hint: bubbling runs on bubble juice — grab a glowing jug or pull up to a vendor to refill ([index.html](index.html)).

### Added — Camera zoom in chase + first-person
- **Chase and first-person views can zoom now — mouse wheel on desktop, two-finger pinch on touch.** Top-down already zoomed (wheel + up/down arrows); the other two couldn't, because up/down is camera *pitch* in those modes. So zoom rides the wheel plus a new pinch gesture instead. In **chase** it dollies the whole rig in/out along its view ray — a `chaseZoom` multiplier on the default distance + height, clamped 0.5–2.4× (distance and height scale together so the look angle holds). In **first-person** the camera is bolted to Zerble's head and can't dolly, so zoom is a **telephoto FOV** change instead — 62°→28°, the wide end being the camera's natural lens. Both persist across view switches, the way top-down already remembers its height. Pinch lives in [touch.js](src/touch.js) (a second canvas finger suspends the one-finger orbit and tracks the spread; lifting either finger hands the survivor back to orbit without a jump) → `Input.consumeZoom()` → [camera.js](src/camera.js) `_applyZoom`, which routes one factor to whichever view's zoom axis is live. ([camera.js](src/camera.js), [touch.js](src/touch.js), [input.js](src/input.js))

### Changed
- **Bubble vendor refills from further out, and the refuel stream cuts off the instant you're full.** Refill range 5→7m, and the vendor→cart stream now only flows while the meter is actually *rising* — so it stops cleanly the moment you top off, instead of lingering ([main.js](src/main.js)).
- **Floor LEDs only ring the back half of the rear platform** (they were wrapping all the way around) — matches the real cart ([zerble.js](src/zerble.js)).
- **Bubble juice drains 20% slower.** `JUICE_DRAIN_PER_SEC` 0.009 → **0.0072** ([bubbles.js](src/bubbles.js)) — ~110s of normal bubbling per meter stretches to ~140s. The first pass emptied a touch too quick. The G-blast cost is a multiplier on top, so it scales down proportionally too.
- **Bubble-juice stockpile is unlimited now, and the HUD reserve reads as a jug count instead of dots.** The 4-meter cap is gone — `JUICE_STACK_MAX` is `Infinity`, so you can hoard as many jugs as you can find ([bubbles.js](src/bubbles.js)). The three reserve *pips* in the HUD (which topped out at 3 anyway) are replaced by a **"N× 🫙" badge**: a little jug icon — matching the in-game gallon jug (white body, orange cap, magenta label, cyan halo) — with the spare-meter count beside it, hidden when you have no spares ([hud.js](src/hud.js), [index.html](index.html), [styles.css](styles.css)). The physical reserve jugs stashed under the back seat still cap at a poolful of 12 (the cavity just packs full), but the count on the HUD is unbounded.
- **The puppet parade no longer always loops right on top of the main stage.** Its patrol path was a fixed loop centred on the origin, and (unlike the Wooks / Kids / Frisbees, which relocate to follow you) the parade is a singleton that never moves its loop — so it was always marching through spawn. The loop now slides by a random offset of **0–150m** each session ([obstacles.js](src/obstacles.js) `PuppetParade`): sometimes it's right there, sometimes it's a good drive away. `avoidLakes` runs after the slide so the shifted path still dodges water; the parade has no attached audio source, so nothing desyncs.
- **Cart passengers sit now instead of standing on the seats.** Riders in a bench / driver / roof seat get their legs+shoes (separate InstancedMeshes from the torso) pivoted forward ~72° at the hip while the torso stays upright — so they read as *seated*, butt on the cushion with legs hanging forward over the edge, instead of levitating bolt-upright. The seated body also rides higher (feet-equivalent Y `seatY - 0.4` vs the standing running-board riders' `seatY - 1.05`) so the butt rests *on top of* the cushion rather than sinking through the torso. Running-board side-riders still stand. ([crowd.js](src/crowd.js) `_writeMatrices`, `_sitLegMat`)
- **Dev-only `window.__dbg` backdoor for verifying the *running* game** (local dev — `localhost`/`127.0.0.1` — only; never on the deploy). The live game actively resists automation: the title card needs a trusted gesture to dismiss (iOS audio gating), the chase cam overrides any camera you set, and driving Zerble with a stub input NaNs its physics. `__dbg` sidesteps all of it — `start()` boots straight into gameplay with no gesture (mirrors the real start callback minus the audio dependency), `camLock(px,py,pz, tx,ty,tz)`/`camUnlock()` pin a fixed camera for close-ups, `fillSeats(kind?)`/`rider(kind)` force idle NPCs into seats for pose testing, plus `setJuice(m)`, `tod(t)`, `teleport(x,z)`. ([main.js](src/main.js))

### Fixed
- **Tires were spinning backwards.** The wheel-roll rotation sign was inverted (and the spin rate was hardcoded to the old 0.55 radius) — wheels now roll forward when you drive forward, at the correct rate for the bigger tires ([zerble.js](src/zerble.js)).

### Performance — tiki torches instanced; low-tier forests thinned; instance buffers freed
- **Tiki torch woodwork collapses to 3 InstancedMesh per cluster.** Each torch was 4 static meshes (pole + 2 joint rings + cup) plus its flame; a 4-torch campsite was 16 woodwork draws and a 6-torch forest path was 24. New `buildTorchField()` in [campsite.js](src/models/campsite.js) builds **3 InstancedMesh total** (poles, joints×2, cups) for the whole cluster regardless of torch count — so the same campsite is now **3 woodwork draws**, a forest path **3 instead of 24**. The flames stay per-torch `Mesh`es because each one animates its own emissive / opacity / scale on an independent phase (an instanced flame would need a per-instance shader patch) — verified in the sandbox that all 6 flames in a ring still flicker out of sync at midnight. The campsite assembler ([campsite.js](src/models/campsite.js) `buildCampsite`) and the forest entrance lanterns ([forests.js](src/forests.js) `placePathLanterns`) both route through it; the rng draw order is preserved at both call sites, so existing worlds regenerate identically. Geometry/materials were already pooled + `userData.shared`, so nothing new to dispose. New `torch_field` sandbox entity (6-torch ring) for isolated verification.
- **Low tier plants ~30% fewer forest trees.** Trees doubled in size on 2026-06-01, so each one fills more screen — fill-rate, not draw count, is what hurts integrated GPUs. New `PERF.forestTreeDensityMul` ([perf.js](src/perf.js)) scales the forest tree target (1.0 on mid/high, **0.7 on low**), applied in [forests.js](src/forests.js) `scatterForestTrees`. Because the placement loop draws the same rng stream regardless of the cap, a lower target yields the **same first-N trees** the full run would place — a strict subset, not a reshuffle — so a low-tier forest reads as a thinned version of the same woods, and the bigger crowns fill the gaps. Only low-tier devices are affected. (Picks up the "forest tree count on low tier" ROADMAP item flagged as more valuable after the 2x tree pass.)
- **InstancedMesh per-instance buffers no longer leak on unload.** The chunk + lake disposal walks ([chunks.js](src/chunks.js) `_unload`, [lakes.js](src/lakes.js) `destroyLake`) disposed each mesh's geometry/material (skipping `userData.shared`) but never called `InstancedMesh.dispose()`, so the `instanceMatrix` GPU buffers of torch fields, Sugar Shack string bulbs, and drum-circle benches were orphaned (small per cluster, but unbounded over a long session). Added `if (obj.isInstancedMesh) obj.dispose()` to both walks — `dispose()` frees only the instance buffers, not the shared geometry/material, so it's safe alongside the existing walk and benefits every instanced cluster, not just the new torches.

## 2026-06-01

### Added — Main stage gets a wooden roof + back wall
- **The main stage now reads as a built structure, not a floating banner.** Added a wooden **gabled roof** (ridge along the width, sloping to front + back eaves with a small overhang, springing from the truss top) and a wooden **back wall** behind the band ([stage.js](src/models/stage.js), gated to `isMain` — side stages stay open). The roof + back scale with the stage and the existing FESTIVAL banner shows in front of the wood.

### Changed — Bubble-juice: stakes, stockpile, and a polished refuel loop
- **Running dry now bites — bubbles stop, NPCs sour, and riders bail.** The empty-tank trickle is gone: the spawn rate ramps to zero over the last 0.25 of the meter, so a dry cart makes **no bubbles at all** ([bubbles.js](src/bubbles.js)). And a bubble-less Zerble *disappoints* the crowd — nearby NPCs build displeasure from eye contact and react: the mouth flips to a **frown**, they **stop bouncing, turn their back, and walk away**, and a reddish **"lost smile" orb drifts off the cart out to them** (the reverse of a smile pickup — [smiles.js](src/smiles.js) `spawnLost`), each costing a smile ([crowd.js](src/crowd.js) `bubblesEmpty` / `onFrown`; wired in [main.js](src/main.js)). Frowns clear the happy-bounce cooldown so a soured NPC never flips back to a smile, and are gated by the same reset-distance as smiles so you won't re-sour someone you just left. **Passengers also disembark when you run dry, and nobody new climbs aboard a bubble-less cart.** A one-time "out of bubble juice" toast fires when you run dry.
- **Zelda-style stockpile.** The tank holds up to 4 *meters* now. Each jug adds a **full meter** and stacks past 1, so you can load up deep; the vendor only tops the current meter (cap 1). The HUD shows the working meter as the bar plus spare meters as **reserve pips** ([hud.js](src/hud.js), [styles.css](styles.css)).
- **Vendor refuel reads clearly.** A stream of glowing bubbles arcs from the vendor to the cart while it's topping off (a 12-instance pool, 1 draw, [main.js](src/main.js) `updateRefuelStream`), stopping with a "full!" cue + chime when the meter caps. The low/empty meter states got a real **amber (low) / red-pulsing (empty) border**, not just the subtle fill pulse.
- **Vendor fixes.** The stand was inside-out — the vendor + counter now face the customer (sign side), and all four posts (incl. the front pair) reach up to the awning ([bubbleVendor.js](src/models/bubbleVendor.js)). This also corrects its in-world facing toward the plaza.

### Added — Bubble-juice meter + jugs + a spacesuit bubble vendor
- **Bubbling is now a resource you manage.** `bubbles.js` carries a `juice` tank (0..1, session-scoped) that drains slowly while bubbling and **~3× faster while the G blast is held** (the blast already triples output, so the cost scales with the payoff). It **never fully empties** — at zero the spawn rate floors at a trickle (`JUICE_FLOOR` 18%), so you sputter rather than cut off, keeping the "bring the bubbles" pitch intact. `Bubbles.addJuice(amt)` is the refuel hook.
- **Rare floating jugs.** New `src/models/bubbleJug.js` — a glowing gallon jug (white body, orange cap, magenta label, cyan halo) that bobs + spins. Spawned sparsely (~1 in 9 chunks, `scatterBubbleJugs` in [chunks.js](src/chunks.js)) at a random open spot. **Drive over one to collect it** (+0.45 tank), with an ascending sparkle SFX (`Sound.playJuicePickup`) + toast. Pickup/animation handled in the [main.js](src/main.js) loop off the `bubble_jug` registry kind.
- **Bubble-juice vendor.** New `src/models/bubbleVendor.js` — a classic-lemonade-stand booth restyled for bubbles: striped awning, a canvas **"BUBBLES"** sign, glowing jugs + drifting bubbles on the counter, and a vendor in a **space suit with a clear bubble helmet** + oxygen tank (reuses `buildSimpleNPC`). ~40% of food plazas get one ([chunks.js](src/chunks.js) `buildFoodPlaza`); **drive up + linger to refill for free** (~0.4/s) via the `bubble_vendor` registry proximity loop, with a debounced "free refill" toast.

### Changed — Top-left HUD revamped into one cohesive cluster
- **Smiles + Best + a bubble-juice gauge now read as a single unit.** Reworked `#score-panel` in [index.html](index.html) + [styles.css](styles.css): a gradient panel holds the smile count, best, and a glossy cyan **bubble-juice fill bar** (rounded tube, top sheen, soft glow) under a divider. The gauge scales with the tank and flips to a **pulsing amber low-juice warning** below 22%. `HUD.setJuice(frac)` is driven every frame from `bubbles.juice`.

### Added — Birds: a flock that circles the festival and roosts in the trees
- **~14–40 birds (perf-tier capped) wheel overhead and perch in trees.** New `src/birds.js` system + `src/models/bird.js` model. Five species — sparrow, finch, jay, crow, dove — each with its own size, palette, cruising-altitude band, flock tendency, and song. Rendered as three InstancedMeshes per species (body + left + right wing), so the whole flock is ~15 draw calls regardless of count; the body cluster (body+head+beak+tail) is merged into one vertex-coloured geometry and the wings flap via per-instance hinge matrices (mirrored for the right side). The body silhouette is identical between the sandbox model and the instanced game birds.
- **Real-bird behaviour.** Boids flocking (separation/alignment/cohesion within a species), per-species altitude bands (sparrows ~5–15m, crows ~14–40m), mate-seeking (a bird steers to the nearest same-species neighbour, the pair "courts" and calls), landing (picks a free canopy perch — see trees below — and descends to it), and **startle** (buzz a low or perched bird with Zerble at speed and it bursts back into flight).
- **Time-of-day rhythm.** A dawn chorus (most aloft + calling), a midday lull (more perched), a dusk peak, then a **night roost**: perched birds tuck into the crown and fade out, and the soundscape hands over to crickets/frogs. Reads `getTimeOfDay()`; `Birds.update` is wired into [main.js](src/main.js), distance-managed like the other roaming systems. Sandbox entries added under a new "Wildlife" group (per-species flying, perched, a flock, and a "bird in tree" perch-anchor composite).

### Added — Nature soundscape: birdsong, crickets, frogs (and they all trip)
- **A dedicated `natureBus` with its own trip wet/dry chain.** Birdsong, crickets, and frogs route through it in [sound.js](src/sound.js), so a Zerble trip warps the whole soundscape — the lushest of the three warp paths (lowpass closes to ~520Hz, longest feedback), with an extra in-synth pitch-bend so the calls themselves go woozy, not just filtered. Driven by new `Sound.setNatureTrip(env, progress)`, called beside `setMusicTrip`/`setSfxTrip` from the same `Trip._envelope`/`Trip.progress()` scalars.
- **Per-species bird songs, spatialised + activity-gated.** Each species has its own synthesis recipe (sparrow chip-chirrup, finch trill, jay/crow harsh bandpass-noise caws, dove coo). A scheduler fires songs from a pool of 4 positional PannerNodes at the singing bird's world position; rate scales with the time-of-day activity curve and mate-seekers get priority. Birds hand the scheduler their audible singers each frame via `Birds.songCandidates` → `Sound.setBirdSongCandidates`.
- **Crickets near trees at night, frogs near the water.** Crickets (≈4.6kHz pulsed sine trills, the same scheduler pattern as the fire-crackle bed) gate on `nightness > ~0.45` **and** proximity to trees/forest; frogs (low sawtooth ribbits with a formant sweep) gate on proximity to a lake edge, day and night with a small night bump. [main.js](src/main.js) feeds per-frame "treeness"/"lakeness" (throttled registry scan of `forest_tree`/`tree`/`lake_edge`) to `Sound.setCricketBed`/`setFrogBed`. All schedulers early-out when their gates are closed, so open daytime festival pays ~nothing. New `Sound.natureDiagnostics()` exposes the live gating for console verification.

### Changed — Trees are ~2x bigger, and birds can perch in them
- **Real-world-ish tree dimensions.** Chunk trees go from ~5–6m to ~11–12m; forest pines to ~16–22m, oaks ~14–18m, birch ~12–16m, trunk radii scaled to match. Geometry-only — no RNG call-order change, so existing chunk/forest layouts regenerate in the same spots, just taller. `forest_tree` collider radius 0.9→1.3 and footprint 1.4→2.0 for the thicker trunk; chunk-tree footprint 1.2→1.8. Sandbox + forest-tree-variant cameras pulled back to frame the bigger trees.
- **Canopy perch anchors (no branch geometry).** Each tree now exposes `userData.crown` + `userData.perches` — a ring of points on the lower-outer canopy surface where a bird visibly sits — and [forests.js](src/forests.js)/[chunks.js](src/chunks.js) copy the world-space versions onto the registry entry so the bird system reads perch targets straight off the registry. Birds perch on the foliage by day and tuck into the crown to roost at night; deliberately no per-tree branch meshes (would blow the forest draw budget).

### Fixed — Tree shared materials weren't disposal-safe
- **`tree.js`'s module-pooled geo/mats now carry `userData.shared`.** `_trunkGeo`/`_trunkMat` and the forest trunk/birch/foliage materials were unflagged, so a chunk unload past `UNLOAD_RADIUS` (chunks **do** unload — ARCHITECTURE's "never unloaded" is stale) would dispose them and storm shader recompiles the next frame any other chunk reused them (perf footgun #6). Flagged so the `_unload` disposal walk skips them. Latent — masked by forests being sparse — surfaced while rescaling the trees.

### Performance — birds are cheap; the bigger trees add fill, not draws
- **Birds: ~15 instanced draw calls + ~3k triangles total** (5 species × 3 InstancedMeshes, capped at 14/26/40 by tier), `castShadow = false`. The 2x trees add **zero** draw calls and **zero** triangles (scaling doesn't change geometry counts) — their only cost is overdraw/fill and a larger shadow-map footprint on mid/high (GPU-time, not visible in the draw/tri budget). Verified at `?perf=low`: the existing crowd+stage scene dominates the draw count (~1500–1800 draws), so birds + trees are ~1% on top. The fill/shadow cost of the bigger canopies wants a feel-test on a real low/mid device — the parked "LOD on distant trees" and "forest tree count on low tier" ROADMAP items are now a bit more valuable.

### Added — Trips now warp the SFX bus too, not just the music
- **The engine, collisions, honks, and bumps get dosed alongside the music.** Until now the wook trip only warped the two music paths — the procedural stage music (`musicBus`, via `setMusicTrip`) and the MIDI player (its own Tone.js chain, via `setTripState`). The SFX bus (engine drone + every collision one-shot) connected straight to `masterGain` and stayed bone-dry through the wildest trip. Now `sfxBus` routes through its own wet/dry trip chain in [sound.js](src/sound.js) — a lowpass sweep + feedback delay, same topology as the music chain but SFX-tuned: it closes the lowpass to ~1000Hz (vs music's 700) and keeps more dry signal (0.4 cut vs 0.55) so the engine stays legible and the cart still feels driveable, while the feedback delay smears each bonk into a stuttering echo. New `Sound.setSfxTrip(env, progress)`, driven from [main.js](src/main.js) by the same `Trip._envelope` / `Trip.progress()` scalars that already feed the music + MIDI warps.
- **The engine goes seasick.** On top of the bus FX, the gas-engine oscillators get a slow pitch-detune wobble while a trip is active — two summed sines (±~16% at full trip, ≈ a couple of warbly semitones) whose rate creeps up with trip progress. The engine `update()` reads the trip envelope/progress straight from module state, same poll-everywhere pattern as `nightness`. The feedback gain is capped lower than the music chain (0.55 vs 0.78) precisely because the engine is a *continuous* source feeding the delay loop — left uncapped it would build into a runaway howl, where the music's discrete notes wouldn't. All trip nodes idle at gain 0 so the steady-state cost is four extra Web Audio nodes doing nothing until you're tripping.

### Changed — Cheap bubbles are see-through now, not white marbles
- **The adaptive-downgrade bubble material got less opaque.** When AdaptiveQuality drops to `cheap-bubs` or lower (sustained FPS pressure — see [adaptiveQuality.js](src/adaptiveQuality.js)), bubbles swap from the `MeshPhysicalMaterial` (transmission/iridescence) to a plain `MeshStandardMaterial` fallback. That cheap material was reading as fairly solid white/grey marbles: opacity `0.55` plus metalness `0.25` meant it blocked the background *and* reflected the bright sky as a grey specular wash. Dropped opacity to `0.15` (properly see-through) and metalness to `0.1` (stops grabbing the sky), so the cheap path looks closer to the glassy fancy bubbles. The material is already `transparent: true`, so this is **free** — same single draw call, same render path, just different numbers. The sharp sun glints (roughness `0.1`) stay, which is what sells them as bubbles. Fancy material untouched.

### Added — Opening reveal: the 2D Zerble drawing "comes to life"
- **Start now plays a cinematic intro before handing over control.** Tapping "Let's go ZERBLIN'!" snaps the camera to a low front-quarter "match" pose that lines the 3D cart up behind [assets/zerble.png](assets/zerble.png), shows the 2D cutout opaque over it, then cross-dissolves the drawing out to reveal the real 3D model in the same angle/profile, and finally orbits the camera around to the normal chase position. A tap or key press during the sequence skips straight to chase. Sequence lives in `startIntroReveal()`/`finishIntroReveal()` in [main.js](src/main.js); the camera moves are `poseIntroMatch()` + `beginIntroOrbit()` in [camera.js](src/camera.js).
- **The match shot is a real low-angle 3/4.** The camera sits *below* the canopy roofline (height 2.4m vs the 3.75m roof) and aims up at 2.7m, so you see the underside of the canopy just like the drawing — an angle gameplay never otherwise reaches. FOV starts at a long 32° (flattening perspective toward the near-orthographic cartoon) and widens back to the gameplay 62° across the orbit. All match knobs (azimuth, radius, height, look height, FOV) are tunable constants at the top of camera.js.
- **`assets/zerble.png` is now a transparent cutout (RGBA).** Background-removed in place so only the cart cross-dissolves with the live festival visible behind it the whole time. Bonus: the README hero image loses its grey box and sits cleanly on any page background. (The 3D googly eyes are set a touch wider/larger than the cartoon's, so a small sliver of one eye peeks past the cutout during the opaque beat — inherent to matching two art styles, and gone the instant it dissolves.)
- **Input is locked during the reveal.** The world keeps simulating (crowd, music, day/night) but Zerble gets a neutral input and honks are suppressed until the orbit completes, so you can't drive mid-cinematic. Touch/keyboard skip cuts it short.

### Fixed — MIDI music (M key) was silent
- **Root cause: the player scheduled notes on the wrong Transport.** [midiPlayer.js](src/midiPlayer.js) shares Sound.js's AudioContext via `Tone.setContext(...)` so MIDI routes through `masterGain`/`midiGain` (that's what makes the volume sliders work). But it then drove playback with `Tone.Transport` — a **legacy singleton bound to Tone's default context at module load**, which `setContext()` does *not* migrate. So the synth lived on the shared game context while the Transport ran on a separate, stale context: the Part timeline the notes were scheduled on never started (its progress sat frozen at 0), while the Transport that *was* started had nothing on it. Net result: playback reported "playing," the clock advanced, but no note ever sounded. Confirmed with an analyser tap — zero signal at every stage — and by comparing contexts (`Transport.context.rawContext !== Sound.getContext()`).
- **Fix: bind to the current context's transport.** Capture `this.transport = Tone.getTransport()` right after `setContext()` (it follows the context switch) and route all scheduling/start/stop/tempo through it instead of `Tone.Transport`. With the fix the Part advances, voices activate (18 live on a dense track), and signal reaches `midiGain` (peak ≈ 0.20). 
- **Also fixed: polyphony was stuck at 32.** The synth passed `maxPolyphony: 256` (and `volume: -8`) in `new PolySynth(FMSynth, {...})`, but that second arg is the *voice's* options — `maxPolyphony` is a PolySynth property and was silently ignored, leaving the default 32. Far too few for 13–17 track full-band MIDIs (chords + bass + drums + pads sustaining at once), so even once audible, dense passages would drop most notes. Now set directly: `synth.maxPolyphony = 256; synth.volume.value = -8`. (Heads up: the in-game **Master** volume is saved at 14% in localStorage — MIDI is audible but quiet until that's raised; the MIDI fader itself is fine.)
- **Also fixed: the manifest fetch could serve a stale empty `tracks: []` and silently drop to the procedural test loop** (the looping 8-note C–E–G–B arpeggio). The Claude Preview proxy and some browsers ignore `cache: 'no-store'`, so a manifest cached before tracks were added would keep being served — making the M key play the built-in fallback instead of the listed `.mid` files. Now the manifest URL is cache-busted (`?v=<timestamp>`) so it's always fetched fresh.

### Fixed — Crowd smiles no longer float off a swaying NPC's face
- **Root cause: the mouth's instance matrix was composed independently of the body matrix and never received the dance hip-sway tilt.** In [crowd.js](src/crowd.js) `_writeMatrices`, the legs/shoes/body/arms/head/eyes all share one matrix `m` that gets the `danceTilt` Z-axis hip sway (post-multiplied) plus the `danceYawWiggle` and `npc.scale`. The mouth was built from scratch using only the yaw quaternion — so when a dancing NPC's head swung sideways, the smile stayed put. At peak sway a dancefloor NPC's head leans ~0.36m off its vertical axis; the old yaw-only mouth ended up ~0.31m (horizontal) / ~0.51m (total) from where the face actually was. The same independent path also ignored `npc.scale` and the riding/hammock seat lift, so the supine hammock-rider's smile was mispositioned too.
- **Fix: derive the mouth matrix from the body matrix `m`.** The mouth geometry is baked at the origin, so we now build a small local matrix holding the face offset `(0, 1.55, -0.215)` + the smile-pop scale, then multiply it onto `m`. The smile inherits everything the head and eyes do — bob, hip-sway tilt, yaw wiggle, NPC scale, and the seat/hammock lift — so it stays glued to the face in every state. Verified across all 500 live NPCs: max deviation of the mouth from its body-frame face position is 16 microns, and the smile-pop scale (`npc.scale × smileScale`) is exact. Net behavior change beyond the fix: a bigger NPC now gets a proportionally bigger smile (the pop used to be a fixed size regardless of figure scale).

### Fixed — Brass band: honking no longer stacks duplicate music into a cacophony
- **Root cause: `BrassBand.scatter()` re-attached the band's music on every parked honk.** In [obstacles.js](src/obstacles.js) the `Sound.attachStageMusic(..., 'second_line')` call sat at the tail of `scatter()`, after the dodge loop's early `return`. `scatter()` is only called from the honk handler ([main.js](src/main.js) when Zerble is parked), and it only short-circuits when a band member is directly in front — so every honk where the band *wasn't* in front ran the attach again, spinning up a fresh second-line generator and overwriting `this._music` **without stopping the previous one**. Spam honk (`SPACE`/`B`/`H`) near the marching band and the leaked generators pile up into a wall of overlapping brass. It also meant the band's music never started until the first honk.
- **Fix: attach the music once in the constructor instead.** Moved the `attachStageMusic` call into `BrassBand`'s constructor (the band is built once at module load and never respawned) and deleted it from `scatter()`, which now only does the dodge sidestep. `attachStageMusic` returns a deferred handle when the AudioContext isn't up yet (the band is constructed before the start-tap `Sound.init`); `Sound.init` adopts it into a real generator when audio comes online — the same deferred path the chunk stages and forest drums already use. Verified in-game: the band's handle adopts a live `second_line` instance at boot (music plays without a honk now), and calling `scatter()` 25× adds **zero** new music instances (was up to 25 before). This is the actual root cause behind the 2026-05-28 "music waits for the first honk" symptom — the audio-engine priming fix helped the engine warm up, but the band's attach was still gated behind `scatter()`.

### Added — Camp village chunk theme
- **New `camp_village` chunk theme.** Packs 12–20 campsites of varying sizes (50% small / 35% medium / 15% large) into a green cell of the road grid. The path system runs E–W and N–S trails through every chunk's centre, so the "cell bounded by 4 paths" the player sees is at a chunk *corner* (where 4 chunks meet), not a chunk centre. `buildCampVillage` in [chunks.js](src/chunks.js) picks one of this chunk's 4 corners as the village centre and packs campsites in a ±30m square around it — the village sits in the green square with this chunk's E–W and N–S paths along 2 sides and the diagonally-opposite neighbor chunk's paths along the other 2. The village group stays parented to THIS chunk so it unloads as a unit, even though its content visually extends into the 3 adjacent chunks. `placeSingleCampsite` now accepts an optional `size` arg so the same helper handles small/medium/large.
- **Two earlier framings were wrong and ruled out.** *First attempt:* scatter across the whole chunk minus the path strip — looked like a campground sprawled over the 4-way intersection at chunk centre. *Second attempt:* skip the chunk's own path cross + dense-pack the chunk interior — still placed the village concentric with the chunk centre, so even with no path through it the *cell* felt off-grid rather than nestled between roads. The corner-centred approach is the one that matches "a green cell outlined by 4 not-straight paths."
- **Theme weighting.** Not picked in the inner ring (`dist ≤ 1.5`) — would clutter the spawn neighborhood. ~7% probability in the middle ring (`dist ≤ 3.5`) and ~12% in the outer rings, taken from what would otherwise have been a grove or open lawn — same "low-stakes empty chunk" slot. `THEME_PROPS.camp_village` runs sparse trees (0.45) + a low ambient crowd (8) since most campers are already at their sites rather than wandering.

### Fixed — Brass band music no longer waits for the first honk
- **Root cause: the music chain wasn't fully primed by the existing 1-sample silent unlock buffer.** On some desktop-Chrome builds, the multi-stage music path (`musicBus → musicDuckGain → _tripDryGain → masterGain → destination`) doesn't actually start emitting samples until a real (non-trivial) signal flows through it. The brass band's `secondLineStage` schedules its first notes at `ctx.currentTime + 0.15s`, which lands before the engine has fully warmed up — those notes get dropped on the floor. The user's first honk (sfxBus → masterGain, a simpler 2-node path) is the first signal long enough to flush the engine, and the brass band's `setInterval(schedule, 160)` then keeps queuing notes that *do* play. Net symptom: "music starts as soon as I honk."
- **Fix in [sound.js](src/sound.js):** added a 60ms near-silent noise pulse (peak amplitude 0.003 — well below perceptual threshold even on headphones) routed through `musicBus` immediately after the mix chain is built. This forces the entire music path active before any stage music is constructed. The pending-stages queue drain is also delayed by 80ms (`setTimeout`) so the prime pulse has time to actually hit the audio thread before the brass band schedules its first notes. `Sound.init` now calls `ctx.resume()` unconditionally instead of only when `ctx.state === 'suspended'` — on some Chrome builds the context reports as "running" while the audio thread is still idle, and a no-op resume on an already-running ctx is harmless.

### Added — Sandbox harness for vendor variety + standalone shopkeeper
- **`tent_row` composite** in [sandbox.html](sandbox.html) — 5 vendor tents at 5m spacing (matches `buildVendorRow`), each rolling its own booth layout + product spread + trim color + shopkeeper position. Single deep-linkable URL (`/sandbox.html?entity=tent_row`) shows the full layout variety in one screenshot.
- **`shopkeeper` entity** — the same `buildSimpleNPC` call vendor tents use, with the same shirt+skin palette rolled per-load, so the variation is verifiable in isolation. Camera at distance 4m for a portrait-style view.

### Added — Vendor tents have varied interior layouts + a shopkeeper
- **Booth interior is now an arrangement of table "slots," not one center table.** `buildTent` in [tent.js](src/models/tent.js) picks weighted-random from five layouts: U-shape (back + both side-wall tables — most common, 5x weight), L-shape (back + one side, 2x left + 2x right), back-wall only (2x), and the original single-center table (2x). Each table in a multi-table booth rolls its product spread independently — a U-shape booth might display pottery on the back, jars on the left, and hats on the right, so a single vendor reads as a curated stall instead of one flat surface. All tables in a booth share one cloth color (the vendor's "brand"), but each gets its own layout. Per-tent dimensions: back/side tables are 3.0×0.8 / 2.6×0.8m; the legacy center table stays 3.0×1.2m.
- **Every vendor tent now has a shopkeeper.** Uses [`buildSimpleNPC`](src/models/puppet.js:191) with a vendor-coded palette (8 shirt colors — warm earthy/crafter tones — and 4 skin tones from the shared Sugar Shack set). 70% of shopkeepers stand inside the booth behind their tables facing the customer (tent opening at +Z); 30% loiter just out front facing back into the booth. Interior spot is picked per-layout so the shopkeeper fits between whatever tables are there (centered in the U gap, in front of the back wall for L/back-only, off to the corner for the center-table layout). Cheap — `buildSimpleNPC` already pools its geometries + color-keyed materials, so 16 shopkeepers per vendor-row chunk add ~190 mesh refs but no new geometry uploads.

### Performance
- **Pooled tent geometry + material allocations.** Per-tent re-allocation of identical leg / roof / trim / table `BoxGeometry` + `ConeGeometry` + matching `MeshStandardMaterial`s was wasteful — a vendor-row chunk spawns 10–14 tents, and the new layout work multiplied that by adding 1–2 more tables per tent. Now: one shared leg geo, one shared roof geo, one shared trim geo, a 3-entry table-geo cache keyed by `lengthxdepth`, a 5-entry cloth-material pool keyed by cloth color, a 6-entry trim-material pool keyed by trim color, and two constants for the leg + roof material. All tagged `userData.shared = true` so chunk-unload disposal walks skip them per the [perf-pooling rule](.claude/rules/perf-pooling.md). Brings vendor-row chunk-gen back in line with the prior baseline now that booths carry more meshes (the ROADMAP "Material pooling in older models" item shrinks accordingly — only `puppet.js` and `foodTruck.js` still need it).

### Changed
- **Frisbee players spawn more often.** Bumped `FRISBEE_PAIR_COUNT` from 2 → 5 in `src/obstacles.js`. The Frisbees pool is global (recycled around Zerble at 35–90m every time a pair drifts past 200m), not chunk-bound, so a pool of 2 meant most of the festival had no pair visible at any moment — they were rare encounters. 5 pairs lands closer to the hoopers pool (8) without going overboard. Each pair is two simple NPCs + one disc, so the perf cost is negligible.

### Fixed — Lurleen no longer spawns on a lake
- **Root cause: neither her initial spawn nor her off-camera rehome considered water.** Lurleen's seeded spawn lands somewhere on a 200–280m ring around origin; the rehome drops her 150–220m from the player. Both code paths in `src/lurleen.js` picked an angle and a radius and called `setSpawnAt` directly. An enumeration of the spawn ring against the loaded lake registry showed 219 / 1530 (≈14%) of candidate points fell inside a lake outline — so roughly 1-in-7 sessions had her materialize on the water.
- **Fix: lake-avoidance helper at both spawn sites.** Added `avoidLake(x, z)` in `lurleen.js` that calls `isPointInLake` (exact-outline check from `lakes.js`) and, on a hit, projects out via `projectOutOfLake` with a 50m margin. The constructor applies it to the seeded spawn point; `_relocateNearPlayer` applies it before calling `setSpawnAt`. Margin chosen so her wander circle (`HOME_RADIUS * 0.7` ≈ 38m) stays clear of the lake's bounding circle even after the projection. `main.js` builds the lake manager (which seeds 720m around origin) before constructing Lurleen, so the registry is populated when the constructor runs.

### Fixed — Zerble no longer spawns inside or immediately in front of a structure
- **Root cause: chunk (0,1) — the first chunk north of spawn — could randomly be a `food_plaza`, `side_stage`, or `tent_stage`.** Zerble spawns at `(0, 65)` pointing north. A food plaza centered at `(0, 80)` places trucks in a ring of radius ~24m, putting the closest truck at z≈56–59 with a 6m-radius collider extending to z≈62–65 — Zerble's exact spawn point. A side stage placed at the chunk's south edge puts its back deck face at z≈69 (only 4 m ahead), and a tent stage with the tent's depth axis along Z has its south wall at z=61–66, directly over spawn. Each scenario occurs ~35% of sessions combined.
- **Fix: guarantee chunk (0,1) is always a low-obstacle theme.** Added a special case in `pickTheme` that restricts chunk (0,1) to `drum_circle` (35%), `vendor_row` (25%), `grove` (20%), or `open_lawn` (20%). All four place their content at or near the chunk centre (z≈80), leaving the southern edge clear. The session-seed RNG still varies *which* of the four themes appears, so the area isn't the same every run.

### Added — Debug panel collapsible sections + Render quality override panel
- **All debug panel sections are now collapsible** (click the `▾/▸` header). Controls and Teleport default closed; Time of day, Audio, Render, and Lights default to their most useful states. Panel fits on screen without scrolling even with all sections open.
- **New "Render" section** in the backtick overlay exposes every setting the adaptive quality system manages. Level dropdown picks "auto" (adaptive running) or any of the 7 named levels (baseline → pixel-50) to lock it. Bloom, Shadows, Cheap bubbles checkboxes and a Pixel ratio select become active when a level is locked — greyed and read-only in auto mode, but still live-update each frame to show what the adaptive system currently has applied (no mystery about what level did what). Switching back to "auto" re-enables the tuning loop.
- **`bloomPass` added to `installDebug` hooks** so the Render panel can read and toggle bloom state directly.
- **New exports on `adaptiveQuality.js`**: `applyLevel(n)`, `setShadows(on)`, `getBloomEnabled()`, `getShadowsEnabled()`, `getBasePixelRatio()`, `getLevelNames()`, `setPixelRatio(mul)`.

### Fixed — MIDI music now responds to Master and MIDI volume sliders
- **Root cause: Tone.js was creating its own AudioContext.** The MIDI player lazy-loads Tone.js on the first M press. By default Tone.js creates a fresh `AudioContext`, which is a completely separate audio graph from Sound.js's `ctx`. Cross-context node connections are illegal in Web Audio, so none of the three debug HUD sliders (Master, Music, SFX) could touch MIDI volume.
- **Fix: share Sound.js's AudioContext with Tone.js.** Before `Tone.start()`, `midiPlayer` now calls `Tone.setContext(new Tone.Context({ context: Sound.getContext() }))`. Tone.js v14 supports wrapping an existing AudioContext. With a shared context, all nodes live in the same graph and cross-module connections are legal.
- **New `midiGain` node in Sound.js.** Sits between the MIDI effect chain and `masterGain` (`midiGain → masterGain → ctx.destination`). The effect chain in `midiPlayer` now routes `reverb → midiGain` instead of `reverb → T.Destination`, bypassing Tone's own destination wrapper.
- **4th audio slider added to the debug HUD.** Master / Music / MIDI / SFX — MIDI and stage music are independently controllable. Volume preference persisted to `localStorage` under `zerble.vol.midi`.

### Performance — Phase 3 bubble material pre-build (perf-pass-4)
- **Both bubble materials built at startup, never during a quality drop.** `MeshPhysicalMaterial` (fancy: transmission, iridescence, sheen) and `MeshStandardMaterial` (cheap: plain translucent standard) are now constructed in the `Bubbles` constructor. `setCheapMaterial(on)` just swaps `this.mesh.material` between the two pre-built references — zero allocation, no shader compile mid-crisis. Wired via the `onLevelChange` hook added in Phase 2: levels with `bubbles: 'cheap'` call `bubbles.setCheapMaterial(true)`, the rest call `false`. Nightness iridescence/sheen ramp now correctly skips when the cheap material is active (Standard doesn't have those properties).
- **`_AXIS_Y` hoisted to module scope in `bubbles.js`.** `_writeInstance` was calling `new THREE.Vector3(0, 1, 0)` for every `setFromAxisAngle` — one allocation per live bubble per frame. Replaced with a module-level constant.

### Performance — Phase 2 adaptive quality overhaul (perf-pass-4)
- **Pixel ratio drops first, not bloom.** On Retina displays (dPR 2) rendering at 2× is the largest single GPU cost. The old `QUALITY_LEVELS` ladder dropped bloom first, which was backwards. New ladder: pixel-ratio 87% → remove bloom → pixel-ratio 75% → cheap bubbles → no shadows → pixel-ratio 50%. Encodes a `bubbles` property (`'fancy'`|`'cheap'`) per level so `main.js` can swap the Bubbles material without `adaptiveQuality.js` importing `bubbles.js`. Wired via a new `onLevelChange` hook in the `install()` call; guarded with `?.` pending Phase 3's `setCheapMaterial()` implementation.
- **P95 and max-spike triggers added.** The old system only watched rolling average frame time. Now: DROP fires if avg > 22ms *or* p95 > 33ms sustained for 60 frames; two consecutive frames > 80ms triggers an immediate one-level drop (hitch detector). RAISE requires all three metrics healthy simultaneously (avg < 18ms, p95 < 22ms, max < 33ms) — a p95 spike blocks restoration even when average looks fine. Stats recomputed every 10 frames (sort on 90 samples — fast) instead of every frame for p95/max.
- **dt cap bug fixed.** `main.js` clamps `dt = Math.min(clock.getDelta(), 0.05)` — using `dt * 1000` for frame timing made avg/p95/max all report exactly 50.0ms. Fixed by tracking raw `performance.now()` diffs directly in `adaptiveQuality.js` (`_lastPerfTime` state field), independent of the animation loop's clamped dt.
- **`quality` row in the debug HUD.** Backtick overlay now shows the current adaptive level name (`baseline`, `pixel-87`, `no-bloom`, etc.) directly below the `frame` timing row.

### Performance — Phase 1 instrumentation (perf-pass-4)
- **Chunk-generation timing surfaced in the backtick HUD.** Each call to `_generate` is now wrapped in `performance.now()`; the `chunks` HUD line shows total generated, slow count (>8ms), worst-ever ms, last ms, and session average. A `console.warn` fires on any chunk over 8ms so stalls are visible in DevTools without the overlay open. First measurement: at the main stage with 499 NPCs parked still, chunk gen averages 3.3ms (worst 15ms) — not the bottleneck.
- **Real frame-time stats (avg / p95 / max) in the debug overlay.** `adaptiveQuality.js` now tracks raw `performance.now()` wall-clock deltas (not `dt`, which is clamped at 50ms by `Math.min(clock.getDelta(), 0.05)` and would make p95/max useless). Stats update every ~60 frames and are exposed via `getFrameStats()`. First measurement: 19fps, avg=52ms, p95=58ms, max=78ms — all while parked, confirming the bottleneck is CPU simulation (NPC O(n²) separation + registry footprint scan), not rendering or chunk gen.
- **Branch decision logged.** Path B (crowd-first) confirmed: spatial hashing for crowd separation + registry footprints goes before forest geometry merging. See `.claude/perf-pass-4-plan.md`.

### Added — Session-seeded world (with the festival arch + main stage pinned)
- **`?seed=…` URL param picks the world layout.** Lakes, forests, non-origin chunk themes, neighbouring prop placement, music seeds, drum seeds, and Lurleen's starting position all re-roll per session. No param → fresh random seed each load. Strings get FNV-1a hashed to a 32-bit int (`?seed=bananas` → `0x95128419`); plain ints used as-is (`?seed=12345`). Resolved seed echoed on `window.__seed` and in the backtick debug overlay (`seed         bananas (0x95128419)`).
- **(0,0) main stage + entrance arch stay identical across seeds.** Two carve-outs: `ChunkManager._generate` keeps the origin chunk's `ctx.rng` on pure `hash2(0, 0)` (so the buildMainStage layout, tree scatter, ambient crowd positions don't shift), and `buildStage` falls back to pure `hash2` for the main stage's music seed when `isMain && (cx,cz) === (0,0)`. So spawn always feels the same — the arch ahead of you, the stage past it, the same crowd density — but ten feet past the arch the festival is freshly rolled.
- **Lurleen's initial spawn is now seeded on a 200–280m ring.** Replaces the hard-coded `(240, 260)` (always northeast, ~360m, 3 chunks NE). Drawn from `worldHash(0xC4F18EE7, 0x5A7B19D3)` so she's deterministic per seed but in a different direction each play-through — confirmed by sampling five seeds, got angles 75° / 171° / 187° / 255° / 321° distributed around the ring.
- **Off-camera re-home so she stays findable.** If the player drives off without ever entering AWARE_RANGE, every 25s Lurleen rolls a 50% chance to relocate. Gated on `dToZerble > 300m` so the teleport always happens past render distance — the player can't see it. New position is 150–220m from Zerble, 70% biased into a ±45° forward cone (so she tends to appear *ahead* in the player's natural path), 30% anywhere. `_everMet` latches on the first AWARE state transition, after which re-home stops permanently. Sandbox sets `autoRehome = false` so she doesn't teleport away from her pinned inspection spot.
- **Seed visible in the backtick debug overlay.** `seed         bananas (0x95128419)` line — shows the raw input string (if any) plus the resolved 32-bit hex.
- **New rng.js exports: `setSessionSeed`, `getSessionSeed`, `worldHash`.** `hash2` stays pure (no behaviour change for things that must persist across sessions); `worldHash(x, y, salt=0)` mixes the session seed into both inputs of hash2 so the avalanche actually interacts with x and y rather than just nudging the final XOR. When `SESSION_SEED === 0`, `worldHash(x, y, 0)` collapses to `hash2(x, y)` — back-compat for anything that forgets to wire the seed.
- **Latent bug fixed along the way.** `chunks.js pickTheme` called `hash2(cx, cz, 1)` with a third "salt" arg that `hash2` silently ignored — meaning the chunk's prop RNG and theme RNG were sharing the same seed. Migrated to `worldHash(cx, cz, 1)` so the salt parameter actually decouples them now.

### Fixed
- **Kids + wooks no longer end up in lakes.** Two more spawn paths weren't checking `isPointInLake` before placing: `KidGaggle.update`'s recycle (re-anchors any kid >200m from Zerble to a random spot 30-80m away) and `Wooks.update`'s recycle (re-anchors any wook with anchor >300m from Zerble to a spot 90-160m away). Both now use a shared `_pickPositionAvoidingLakes` helper (6 tries; falls through to the per-frame projection below if all candidates land in water). Each pool also gets a per-frame safety net: any kid/wook whose position is `isPointInLake` gets pushed to the shoreline via `projectOutOfLake` and re-anchored there so the next wander doesn't immediately drift back in. Drove Zerble through a lake center and verified the water surface is now NPC-free; all crowd activity stays on the shore.

### Added
- **Tent stage chair clumps INSIDE the tent.** Initial attempt placed chairs outside the tent canvas (behind the open-tent walls), which left the tent interior just as empty as before. Repositioned: chair band sits in the back 2/3 of the tent's audience floor, in tent-local coordinates between the stage front (z = `stagePos.z + stageDepth/2`) and just in front of the soundboard (z = `mixerPos.z - 1.5`). Front 1/3 stays chair-free as a dance area; 4-5 clumps of 3-6 chairs each populate the rest; an additional clump lands just behind the soundboard 70% of the time for variety. Lateral spread `tent.width - 5` keeps chairs inside the tent walls. All positions rotated through the existing `worldXZ` helper so they honor the tent's random `yaw`; chairs face `yaw + π` (toward the stage) with a small jitter. Hula-hoopers attach automatically via the existing `stage_front` attractor. The tent's own `crowdSpots` (18 indoor NPCs + sound engineer) keeps the audience density up.

### Changed
- **GA tag gated to non-local hosts.** Both `index.html` and `sandbox.html` previously fired `gtag.js` + `gtag('config')` on every page load — including localhost dev. Wrapped the gtag bootstrap in the same `isLocal` check used by the importmap cache-buster (localhost / 127.0.0.1 / 0.0.0.0 / `*.local` / RFC1918 LAN / `claude-preview` / `happycog`). On those hosts the script tag isn't injected, `window.gtag` is never defined, and `Analytics.send()` already no-ops when gtag is missing. Production is unaffected.

### Fixed
- **Adaptive quality no longer leaves stale ghost shadows on the ground.** When the frame budget slipped, `AdaptiveQuality._apply` set `renderer.shadowMap.enabled = false`. That stopped the shadow-map RENDER pass, but materials compiled with shadow support kept sampling the depth texture — which now had stale contents — so the last frame's shadows froze on the ground like a visual bug. Replaced with a `_setShadowsOn(scene, renderer, on)` helper that walks the scene, flips every casting mesh's `castShadow` off (saving the list for restore on raise), and triggers a fresh shadow-map render. The next render produces a clean empty depth texture → every receive-shadow surface reads "fully lit" instead of "frozen shadow". On raise, the saved caster list is flipped back on. Net perf is still way better than full shadows because the per-caster fill cost is gone; we keep `shadowMap.enabled = true` so materials don't need recompiling.
- **Kids no longer float above the ground.** `tickKid` was setting `body.y = 0.55 + bounce`, lifting the entire kid 55cm into the air at rest. The body group already bakes shoes-bottom at `y = 0`, so the resting body.y should be 0. Now `body.y = bounce` only (`Math.abs(sin)` keeps it non-negative so they hop *up*, never through the ground).
- **Lake "reflection" shader removed — looked like fake sparkles, not reflection.** The procedural twinkly stars shader patch I added earlier read as "glitter sprinkled on the water" that faded in and out at a constant rate — exactly the wrong physics for reflected sky. Removed the `onBeforeCompile` patch, deleted the star-field GLSL + uniforms, kept `setLakeNightness` as a no-op for caller backward compat. Water is now honest plain water at every time of day. **Real lake reflections** (via `three/examples/jsm/objects/Reflector` — mirrors actual sky/stars/moon at the cost of a second scene render) added to ROADMAP under World; gated to high tier when it lands.

### Added — NPCs dance on the dancefloor
- **Crowd NPCs within ~9m of a `stage_front` attractor go into dance mode.** While `onDancefloor`, the existing matrix-write path layers a much bigger animation set:
  - **Vertical bounce** at ~0.07m peak + a smaller off-beat ripple at 0.025m — clear hop without floating.
  - **Hip tilt** sway around Z at 0.18 rad (~10°) peak — applied via the existing `m.multiply(_tmpDanceMat)` path so it reuses the per-NPC scratch matrix.
  - **Yaw shimmy** of ±0.20 rad layered onto `npc.yaw` in the Euler — back-and-forth twist.
  Each component uses `npc.bob` with frequencies offset by `npc.dance` (the per-NPC personality value seeded at spawn), so neighbors aren't in lockstep — each dancer has a slightly different rhythm and amplitude. Detection runs once per NPC per frame walking `registry.byKind.get('stage_front')` (O(N × stages) — typically ≤4 stages, cheap).
- **Chair clumps line up with this radius.** `chunks.js buildStage`'s `dancefloorDepth = 9 * scale` matches the dancefloor detect radius — chairs sit just outside the dance zone, so dancers have room and seated NPCs don't accidentally trigger dance moves.

### Added — Trip warps procedural music too (bands, drums, drum circles)
- **Music bus gets a trippy lowpass + feedback delay chain.** Previously only MIDI playback warped during trips; the procedural music (`jam`/`brass`/`drum`/`forest_drum` engines synthesized in Web Audio) stayed clean. Added a wet/dry chain between `musicDuckGain` and `masterGain`:
  ```
  musicDuckGain ─┬─→ tripDryGain ─→ masterGain                    (always-on bypass)
                 └─→ lowpass ─┬─→ tripWetGain ─→ masterGain        (wet branch)
                              └─→ delay ─→ feedback ─→ lowpass     (echo loop)
  ```
  `Sound.setMusicTrip(env, p)` ramps wet gain with envelope, sweeps the lowpass from 18kHz → 700Hz, and pushes the feedback delay toward runaway (capped 0.78) around the visual climax at `p ≈ 1/3` — same peak moment the MIDI chain + visual posterize spike hit. Idle cost is two Gain nodes + a Biquad + a Delay at gain 0 — basically free until a trip fires. Wired from `main.js` tick (same pattern as `midi.setTripState`) and from `sandbox.html` so the Trip panel's FIRE/DYNAMIC buttons can audition the warp on any music style picked from the Music panel.

### Added — Camp-chair clumps in the stage audience
- **Loose chair clumps in the audience zone, dancefloor stays chair-free.** Every stage (main + side) now spawns 2-5 clumps of 3-6 camp chairs in a band behind the immediate front zone, all loosely facing the stage with per-chair yaw jitter (no soldier-straight rows). Zones in stage-local +Z: dancefloor (no chairs) extends `9 * scale` past the deck edge; chair band from there to `(9 + 14) * scale`; lateral spread `±11 * scale`. Each chair registers a small `chair` footprint so NPCs steer around them. Reuses `buildCampChair` from `campsite.js`.

### Changed — Honk scatter applies to boarding NPCs
- **Would-be passengers scatter on honk.** `applyHonk` used to exempt both `riding` and `boarding` from the scatter range — boarding NPCs serenely continued walking to their seat regardless of the racket. Now boarding NPCs scatter too: their reserved seat slot is released, state flips to `fleeing`. The per-frame `activePassengers` recount on the next tick picks up the state change and the cap auto-decrements. `riding` stays exempt (already on the cart; teleporting them off would look jarring).

### Fixed — Wook tie-dye splotches actually look like fabric
- **Splotches painted onto the body material via `onBeforeCompile`, not jutting geometry.** Both previous attempts placed extra meshes (cubes, then circles) at the body surface oriented radially outward. A flat planar disc on a curved capsule has its center on the surface but its edges off it — disc edges visibly bulged outward at the wook's silhouette from any angle that wasn't head-on at the disc. Same root cause as the cube version, just rounded. **Real fix:** drop the 7-disc geometry entirely and use the same shader-patch pattern as the crowd's tie-dye shirts (`crowd.js`): inject three sum-of-sin noise fields into the body's fragment shader, threshold each with smoothstep, and `mix()` the three accent colors over the base diffuse. Pattern is part of the surface, conforms to curvature perfectly, no protruding edges. Shared `customProgramCacheKey('wook-tiedye-v1')` so the shader compiles once across all wooks; per-wook variation lives in uniforms (3 accent colors + a phase offset).
- **Upper sleeve shares the patched body material.** Previously each sleeve allocated a fresh `MeshStandardMaterial` matching the body color — with the new shader patch on the body, sleeves stayed plain solid while torso had splotches. Sharing the material makes the tie-dye flow continuously from torso onto sleeve.

### Fixed — Lakes pass 2
- **Collider ring now traces the actual shoreline.** Original placement pushed each collider inward along the **radial** from lake center, which works for circular lakes but warps the ring on elongated/lobed shapes (concave dips push too far inside, lobes don't push enough). Now uses the **edge normal** at each outline segment: for CCW polygon, edge direction `(dx, dz)` → inward normal `(-dz, dx) / |edge|`. Collider ring now hugs the visible outline at every angle.
- **Visible water frame matched to outline data.** Water mesh was `ShapeGeometry` + `rotation.x = -π/2`, which maps shape `(sx, sy, 0)` → world `(sx, 0, -sy)` — i.e. it mirrors Z. Colliders/camps/trees/beach use the un-mirrored outline data, so the visible water was a mirror image of where everything else thought the lake's shoreline was. Fixed by switching to `rotation.x = +π/2` + reversing the shape winding (so the polygon still faces +Y), plus `side: THREE.DoubleSide` on the water material as a safety net since ShapeGeometry's normals can come out either way depending on winding/triangulation.
- **Outline smoothed.** Per-vertex jitter dropped from ±8% → ±2% and lobe-perturbation amplitudes halved. Outline reads as a natural shoreline instead of a jagged spiked polygon. Big-feature elongation/ellipse stretch retained.
- **Campsites no longer land in water.** Camp placement was `outlineRAt(theta) + 6 + footprint`, which only checks the shoreR at the center angle. On elongated lakes a lobe at `theta+ε` can extend past the shore at `theta` — camp ended up partly in water. Now samples the *maximum* shoreR across a ±0.30rad wedge around `theta`, well beyond the camp's own angular footprint at these distances.
- **Forest trees no longer land in water.** Same wedge-max trick applied to the forest-ring placement (±0.15rad sample).
- **NPCs no longer spawn in lakes.** `spawnAmbientCrowd` reject loop only checked `closestBuilding` — positions on shore attractors near a lobed lake could land inside the water. Added `isPointInLake(x, z)` (exact in-outline check via the new outline stashed on the lake registry entry) to the reject criteria, with a tries-up-to-8 cap that *skips* the spawn entirely if no valid land position can be found rather than spawning in the water as a fallback.
- **`isPointInLake(x, z)` exported.** Lake registry entry now carries the outline (was just position + footprint=maxR). `isPointInLake` does cheap bounding-circle rejection first, then exact outlineRAt check for points inside the bounding circle.

### Added — Lake star shimmer
- **Procedural star twinkle on lakes at night.** Water material gets an `onBeforeCompile` shader patch that adds a sparse procedural star field at world-XZ coordinates, gated by `uNightness²` so it's invisible by day and ramps in through dusk → midnight. Each "star" is a small Gaussian glow at the center of a hash-selected grid cell (top ~1.5% of cells), with an independent twinkle phase so the field shimmers rather than pulses in lockstep. World-position varying computed standalone (`modelMatrix * vec4(transformed, 1.0)`) so we don't depend on three.js's `worldPosition` chunk macro, which only declares the var conditionally based on shadow/env flags. **Three.js 0.160 gotcha:** the final-color chunk is now `<opaque_fragment>` (was `<output_fragment>` pre-0.150) — injecting into the latter silently no-ops in modern three. Approximates "stars reflected on water" via screen-space twinkle, not real Reflector-based reflection — cost is a few sin/exp per water fragment and one extra varying.
- **Shared water material.** Hoisted the per-lake `MeshStandardMaterial` into a module-level `WATER_MAT` tagged `userData.shared = true` so every lake's water samples the same uniforms (driven once per frame by `setLakeNightness(nightness, time)`) and chunk/lake disposal doesn't free the material out from under other lakes. `customProgramCacheKey` set so three.js doesn't reuse a vanilla physical-material program.
- **Wired from `main.js` and `sandbox.html`.** Both call `setLakeNightness(tod.nightness, performance.now() * 0.001)` each frame.

### Changed — Lakes overhaul
- **One lake per macrocell, not two.** Dropped the big/small + causeway pattern. Each macrocell either has a lake or doesn't; the lake is one connected body. `lake.bigR / lake.smallR` from the return value are replaced by a single `lake.radius` (bounding circle). Caller-visible API unchanged except for `lake.canoe` → `lake.canoes` (array).
- **Irregular elongated outlines.** Lakes are now `ShapeGeometry`-rendered from a 64-point outline generated by composing (a) an ellipse stretch with random major-axis rotation, (b) two low-frequency lobe perturbations (2-3 broad + 4-6 finer), and (c) per-vertex micro-jitter (±8%). 15% of lakes stay clean circular for variety; the other 85% are elongated and lobed. Stretch can reach ~1.7× along the major axis, so a 100m baseR lake spans up to ~340m end-to-end.
- **Sealed perimeter — no more causeway gaps.** Removed the grass causeway between big/small lakes (and the peninsula on the small one). The collider ring walks the outline at SPHERE_R arc-length intervals, pushed inward by SPHERE_R along the radial direction so the cart's edge meets the visible water as it hits the ring. Causeway-skip code that used to leave gaps is gone — for a typical lake, ~159 overlapping sphere colliders fully seal the perimeter. Cart and all NPCs are kept out of the water; canoes are the only entities allowed inside (created already-inside, clamped against the outline).
- **Path + campsites + forest ring on 60% of lakes.** Lakes that win the treatment roll get 4-9 campsites placed at varied angles around the shore, each at shoreR + 6 + camp_footprint so a ~6m clear grass band remains between water and camps — that's the path Zerble drives along. Beyond the camps, a forest ring of 90-140 trees fills the band 14-39m beyond shore with `rng()^0.6`-biased radial distribution → density increases with distance from the lake. Trees within camp_footprint + 2.5m of any camp are rejected so camps stay clear. Forest trees use the `forest_tree` collider kind (same as `forests.js`) so hitting one hurts.
- **0/1/2 canoes per lake.** 30/50/20 distribution. The old code always made one canoe; some lakes now have none, some have two. Canoes restructured into `lake.canoes` array; LakeManager.update iterates.
- **Outline-aware canoe drift.** Replaced the old `safeR = lakeR * 0.78` hardcoded safe radius with per-angle outline lookup — canoes can now explore the lobes of elongated lakes instead of orbiting the center.
- **Islands optional, with 0/1/2 trees most having 1-2.** 35% of lakes get an island (4-8m radius, anchored inside the inscribed radius so it doesn't punch through the outline on any side). Tree count distribution: 18% empty / 44% one tree / 38% two trees. Island trees have no collider since the island is unreachable from outside.
- **Beach now 60% chance** (was 100%). Still uses the existing 5%-of-shoreline-arc sizing math. `opts.forceBeach: true` still forces one (sandbox uses this).
- **Fixed `chunkInLake` pre-existing bug.** Was `e.position.z - cxWorld` (using `cxWorld` instead of `czWorld`); corrected to `czWorld`. The bug meant the lake-on-water suppression occasionally fired/missed depending on absolute coords.

### Changed — Sandbox tweaks for the new lakes
- **Camera far plane bumped 200 → 500**, fog disabled. The new lakes span up to ~340m and the forest ring reaches 35m beyond shore — far exceeds the old 200m far plane. Fog with the old 30/100 near/far made everything beyond 100m render as full fog color (which at dawn is warm tan), so the lake looked tan-on-navy from a sandbox overview. Sandbox doesn't really need atmospheric fog for entity inspection.
- **`big_lake` entity seeded for the full treatment.** Was 0xC0FFEE, which (with the new outline-generation code path) happens to roll empty on the camps+forest gate. Switched to 0x7 which lands all the gates — camps, forest, beach, island, canoe — so the entity is a useful end-to-end preview.

### Added — Sandbox panels
- **Sandbox: Music style trigger.** New Music panel below the audio sliders with Jam / Brass / Drum / Forest buttons that manually attach a stage-music engine at world origin, plus a Stop music button. Switches between styles cleanly (detaches any prior auto- or manual-attached engine before attaching the new one). Seeded by style name so two presses of the same button produce the same pattern — handy when A/B-ing.
- **Sandbox: MIDI player toggle.** ♪ MIDI button next to Stop music. Lazy-loads Tone.js + @tonejs/midi on first press, then toggles play/stop on subsequent presses (same code path as the in-game M key). Button text flips to ■ MIDI while playing. Status messages route into the entity info field via a stub HUD object.
- **Sandbox: Trip (T) panel.** Collapsible panel at the bottom of the HUD — hidden by default, opens with the toggle button or pressing T. Mirrors the in-game debug T panel: live state readout (`state | env | mode`), Micro / Std / Full presets, FIRE / DYNAMIC / COME DOWN action buttons, and 8 per-effect sliders (hue / sat / ripple / chroma / lens / poster / vign / bright). While Dynamic mode is driving a trip, slider values mirror the scripted timeline so you can see the curves animating. Auto-trigger path is disabled (sandbox passes empty `wookPositions`) so only manual buttons start a trip.
- **Sandbox: post-process composer.** Switched render pipeline from `renderer.render(scene, camera)` to `EffectComposer` with `RenderPass → Trip.pass → OutputPass`. Required to wire Trip's ShaderPass into the sandbox; cost at idle is one disabled pass + an OutputPass blit.
- **Sandbox: setTimeout fallback for hidden tabs.** `tick()` now uses `setTimeout(tick, 16)` when `document.hidden`, RAF otherwise. The Claude Preview MCP runs the page hidden, which throttles RAF to ~0fps — without this, the sandbox didn't advance and Trip / MIDI / motion all froze when previewed by an agent. Same pattern main.js has used since the preview MCP was wired in.
- **Sandbox importmap: added trip + midiPlayer to the mods list and hulaHooper / frisbeePlayer / sugarShack to the models list** so the dev cache-buster decorates their URLs and edits hot-reload. They worked without it but iteration was slow.
- **`window.__sandbox` exposes Trip and midi** for preview-MCP introspection / scripted verification.

### Changed
- **Hula-hooper: hoop actually orbits the body.** The hoop used to spin centered on the body axis, so from above it just rotated in place — the hooper's silhouette stayed in the middle of the ring and nothing read as "hooping". Now the hoop is offset 0.27m from `hoopPivot`'s Y axis (the body axis at hip height) via `hoop.position.x = HOOP_OFFSET`. `hoopPivot.rotation.y` (already driven by `p * hoopSpinMult`) sweeps the hoop's center on a circle of radius 0.27m around the body, so the contact point between hoop and body rotates around the body the way real hooping reads. Geometry sized so nominal clearance is ~5cm and the body's max-sway leans (±0.17m at hip from `bodyGroup` rotating ±0.20rad around the feet) bring the hoop into authentic graze-contact at the away-side moments. Verified from a top-down view in the sandbox.

### Fixed
- **Wook tie-dye squares.** The 4 splotches on the wook's torso were 0.4×0.4×0.02 `BoxGeometry`s — the square silhouette + 2cm depth read as cube-faces stuck to the body, not splotches on fabric. Replaced with 7 thin elliptical `CircleGeometry` discs at 0.18-0.28m radius, non-uniform x/y scale (0.7-1.3), `DoubleSide` so glancing angles don't drop out, positioned at 0.451m (just outside body radius 0.45) with `lookAt` pointing the normal radially outward. Now reads as organic tie-dye patches.
- **Wook dread clipping.** Dreads emerged from `baseR = 0.28` (just *inside* the head's 0.30 radius) and only drooped outward at `*0.10` per segment — by segment 4 the strand was at ~0.39m, well inside body radius 0.45, so dreads sank straight through the torso. Bumped `baseR` to 0.30 (flush on the head) and droop coefficient to `*0.30` per segment. By segment 2 the strand clears the body (~0.48m) and angles increasingly outward as it falls. Side-view profile now shows a clean curtain hanging behind the body instead of dreads visibly intersecting the torso.

## 2026-05-27

### Added — Hula-hoopers, frisbee players, tie-dye shirts
- **Hula-hoopers.** New POI-attached performer that gyrates with a glowing hoop. Pool of 8 (`HulaHoopers`) scans the registry every 2.5s and anchors to nearby attractor entries (`stage`, `stage_front`, `drum_circle`, `firepit`, `leaf_drum_circle`) within 120m of Zerble. Per-attractor cap by weight (heavy attractors up to 3; small ones at most 1), and most candidates roll empty — average 0-1 per attractor, never more than 3. Each hooper registers a `hula_hoop`-kind footprint with the registry so crowd NPCs steer around the hoop's swept radius (0.58m + 0.6m buffer); footprint position updates as the hooper drifts. Body sways in an elliptical hip orbit (sin/cos at the same rate, 90° out of phase) and hoop spins independently at 1.3-2.0× the hip rate. Glow material's `emissiveIntensity` ramps from 0.05 (day) to ~3.0 (full night) so the hoop reads like a glow stick after dusk. Slight random drift: every 4-9s the hooper picks a new offset target 0.4-1.3m from the anchor and eases toward it at ~25cm/s. Witty toast on hit ("That hoop was somebody's chakra!", "You broke her flow, man!", and four others) — kind set to `hula_hoop` and added to `SOFT_PEOPLE_KINDS` so the hooper doesn't shove a parked Zerble. Per-frame animation lives in a single `tickHulaHooper(model, dt, nightness)` so the game (`Frisbees.update`) and sandbox can't drift apart.
- **Frisbee players.** New pair-based global system (`Frisbees`, 2 pairs) recycled around Zerble like the Wooks. Each pair has two players + a disc with a `held` → `flying` → `landed` state machine. Tosses use a parabolic trajectory with softened gravity (0.6×) for a floaty arc, plus ±0.20rad aim jitter and 0.85-1.20× speed variance — so the disc regularly lands a meter or two off target. The catcher solves the quadratic time-to-catch-height each frame, predicts where the disc will be at hand height (0.4m), and walks to that spot at 2.6m/s. Catches happen when planar distance to hand < 0.7m and disc y in [0.6, 1.7]; otherwise the disc lands and the catcher walks over to pick it up. Roles swap on each catch / pickup. Quadratic landing solver guards against the both-roots-negative case (filters with `isFinite`) so the catcher position never goes NaN. Disc material is emissive (`emissiveIntensity = 0.05 + nightness*3.0`) so it glows in the dark — same curve as the hoop. Player colliders are soft `person`-kind with damage 1.
- **Tie-dye crowd shirts.** Crowd `NPC_ROW_SHIRT` palette expanded from 14 pastels to 28 colors with vivid magentas/lime greens/electric blues mixed in. ~55% of NPCs now get a procedural tie-dye swirl: two new per-instance attributes (`shirtAccent` vec3 + `shirtTieDye` float) drive an `onBeforeCompile`-injected fragment-shader patch on the body + arms materials. Swirl built from three sins at different frequencies/phases over local position, blended onto `diffuseColor` via `mix()` with `smoothstep(-0.3, 0.5, swirl)`. Body and arms share the same underlying `Float32Array` so sleeves match torso. `customProgramCacheKey = 'crowd-tiedye-v1'` so three.js doesn't reuse a vanilla program. Plain shirts still happen for the other ~45%.
- **Glow-in-the-dark frisbee.** `buildFrisbeeDisc()` material now uses `emissive` + `emissiveIntensity`. `Frisbees.update(dt, zerblePos, nightness)` bumps it each frame; main.js passes the world `nightness` through. Matches the hooper hoop curve so both pickups read the same way after dusk.
- **Sandbox: hooper + frisbee entries.** Added "Hula-hooper", "Hula-hooper (night — hoop glows)", "Frisbee player", and "Frisbee pair (tossing disc)" under People. The night variant pins `tod._nightness = 1`. The frisbee pair runs the full ballistic toss / catcher-chases-prediction physics inside the sandbox so motion matches the game.

### Changed
- **Kid bounce + motion calmed down.** `KidGaggle.update()` per-frame bob multiplier was `performance.now() * 0.012` (felt fidgety); now `* 0.008`. Bounce amplitudes also dropped — was 0.22 chasing / 0.15 idle, now 0.13 / 0.08 — so kids look animated rather than spasmodic.
- **Kid chase stickiness.** Two roughly-equidistant bubbles used to make the nearest-bubble pick flip every frame, whipping the kid's heading back and forth. Added a per-kid `chaseHoldTimer` (0.4s commitment) and `chaseDirX/Z` that the kid lerps toward each frame while held — the search still updates internally, but the displayed direction stays smooth.
- **Kid yaw smoothing.** New `displayedYaw` field lerps toward `heading` via shortest-arc (wrapped into [-π, π]) at ~9/s. Snapping rotation directly to `heading` caused visible 180° flips whenever heading changed sign (chase target switch, wander reroll); the lerp lets the heading whip internally without showing it.

### Added — MIDI player + trip warp
- **MIDI music player (M key).** Lazy-loaded Tone.js 14 + @tonejs/midi 2 via ESM CDN — zero startup cost until the first M press. Reads `assets/music/manifest.json`, random pick from the tracks list, scheduled through `Tone.Transport` and looped. Manifest entries accept either bare filenames (`"music-1.mid"`) or `{file, name}` objects. Procedural test loop plays when the manifest is empty so M always does something. Mobile gets a ♪ button alongside HONK/BOOST/CAM; touch tap latches the same press as the keyboard.
- **256-voice PolySynth (FMSynth).** Bumped from default 32 to handle dense full-band MIDIs (drums + bass + chords + lead + pad all sustaining together). Release tail trimmed from 1.0s → 0.4s so voices return to the pool quickly under heavy chords.
- **Trip-warp effect chain.** Master signal: `synth → Vibrato → AutoFilter → PingPongDelay → Reverb → master`. Each effect has its own personality curve over the trip's progress `p` (0..1 across fadeIn + sustain + fadeOut), all gated by `Trip._envelope`. Mirrors the visual `_writeDynamicCurves` two-layer design (gate × curve). Gaussian bell centered at `p=1/3` engineers an audio climax at the same moment as the visual posterize spike — vibrato widens to 0.55, tempo bottoms out at 80% of base, delay feedback approaches runaway (0.78), reverb wet swells to 0.78. Curves: vibrato slows monotonically toward peak, reverb sigmoid-up over first half, delay-feedback sum-of-sines (like the visual vignette pulse), AutoFilter sum-of-sines breathing gated in/out across first/last quarter, tempo recovers after peak.
- **Stage-music ducks during MIDI playback.** New `musicDuckGain` GainNode downstream of `musicBus`. `Sound.setMusicDuck(factor)` ramps it smoothly (400ms cancel-and-ramp). MIDI player calls 0.18 on start, 1.0 on stop — in-world stage music drops ~82% so foreground MIDI dominates, but distant stages stay faintly audible so the festival doesn't go dead. User volume preference untouched (duck is a runtime multiplier on top).
- **`Trip.progress()` API.** Returns the same 0..1 trip-progress value `_writeDynamicCurves` uses internally for visuals. External systems (MIDI player) read it to shape their own per-effect curves in lockstep with the visuals.

### Added — Sandbox / NPC behaviors
- **Kid gaggles spread + recycle.** Was 3 hardcoded gaggles of 4-6 (~15 kids total) clustered near the stages. Now 8 gaggles of 5-8 kids fanned in a ring 25-75m from origin (~50 kids spread across the festival). Recycle loop: any kid stranded > 200m from Zerble teleports to a fresh anchor 30-80m around him. Long drives never strand the gaggle.
- **Kids play around Zerble's bubbles.** When Zerble parks, each kid's anchor lerps toward `zerble.nozzleWorld` (the bubble vent) ~3× faster than when he's moving. Kids naturally cluster behind the cart chasing the bubble stream without being forced onto an explicit orbit slot.
- **Honk scatter — all collidable people.** Crowd NPCs, kids, wooks, puppet parade, and brass band all dodge perpendicular-away from a parked Zerble when honked. Crowd NPCs flip to `fleeing` state. Kids/wooks get a per-entity dodge timer that overrides their normal motion for 1.2-1.4s (wooks re-anchor their orbit center on dodge end). Puppets get a bell-curve lateral offset on top of their path. The brass band sidesteps as a whole formation (3m perpendicular, 1.6s bell envelope).
- **Stages always have a crowd.** `buildStage` now spawns its own guaranteed audience directly: 22 NPCs for main stages, 12 for side stages, in three rows fanning out 14m wide. Was relying on ambient-crowd attraction alone, which left stages empty if spawns happened to scatter elsewhere.
- **Sugar Shack apron cook patrols.** Cook walks a random progression between four cooking stations + a counter spot in shack-local coordinates. 2-5s holds at each station, 3-6s at the counter. Tagged by chunkKey so cleanup follows chunk unload. Pattern mirrors `stagePerformers` — module-level `sugarShackCooks` array, `updateSugarShackCooks(dt)` ticked from main.js.

### Added — Driver controls
- **G — hold for bubble blast.** Spawn rate × 2.8 and the under-cart disco SpotLight bumps brighter, strobes, and adds a daytime intensity kicker so the splash on the ground reads even in bright sun. Pool size is now tier-aware (`PERF.bubblePoolMax` — high=600, mid=350, low=200) so the blast actually produces a denser visible cloud instead of just churning a saturated 200-bubble pool.

### Fixed
- **Sugar Shack sign text overlap.** Header banner ("FESTIVAL · FAMOUS / the SUGAR SHACK / BREAKFAST ALL DAY + NIGHT") and menu plank stacked on themselves and overflowed their canvases. Root cause: the perf-pass-3 texture clamp halved canvas dimensions (2048×512 → 1024×256 and 2048×384 → 1024×192) but kept the original hard-coded Y-coordinates, font sizes, and line widths. Introduced a `const S = c.width / 2048` scale factor in each helper — all positions/sizes derived from canvas size now, so the same code works at any canvas resolution.
- **Apron cook bald-head poke-through.** Hair sphere center (y=1.74) + scale.y=0.5 placed the dome top at y≈1.875, but the head crown sits at y≈1.91. Raised hair to y=1.82, scale.y=0.55 — top now at y≈1.97, comfortably clears the head.
- **People pushing a parked Zerble around.** Soft-people colliders (crowd NPCs, kids, wooks, brass) no longer push Zerble when he's parked (|speed| < 1.2 m/s). Hard kinds (truck, tent, stage, arch, puppet, lurleen) still block. Curious NPCs can now crowd up to the cart without shoving it across the grass.
- **Accidental collisions with disembarking passengers.** When an NPC hops off Zerble, they enter `state === 'disembarking'` for ~5s. Collision generator now skips disembarking NPCs entirely during that window. Was a frequent damage source when Zerble started rolling forward right as a passenger appeared in front of the wheels.
- **G key bubble blast not noticeable.** First-pass cap of 200 bubbles was already saturated at normal play — the 2.8× spawn multiplier just churned existing bubbles with zero visible effect. Tier-aware pool sizes (200/350/600) now let blast mode actually produce a denser cloud. Disco-light visual feedback added in parallel so the effect reads even before the cloud builds.

### Changed
- **Posterize peak capped at 0.9.** Trip dynamic curve's posterize spike at `p=1/3` was reaching the full clamp at 1.0, flattening the world to too few color bands. Now caps at 0.9 — climax still reads as a sharp spike but leaves a touch of tonal nuance. Other effects' curves unchanged.

### Performance (pass 3 — r/threejs thread nuggets)
- **Texture clamp to 1024.** Sugar Shack header banner (2048×512 → 1024×256) and menu plank (2048×384 → 1024×192) were the only canvases over 1024. Per the thread: iOS can crash on textures > 2048; 1024 is the safe cross-device upper bound. Font auto-shrink in `fitFont()` keeps text crisp.
- **MeshStandardMaterial → MeshLambertMaterial on low tier.** Now routed via `src/threeShim.js`, redirected through the `'three'` importmap entry so every `import * as THREE from 'three'` gets the tier-aware override transparently — no caller changes. (Earlier monkey-patch via `src/litFallback.js` crashed Safari mobile because ES module namespaces are frozen; the shim fixes the assignment-at-import-time issue properly.) PBR is per-fragment; Lambert is per-vertex diffuse — single highest-ROI material change for integrated GPUs. Tradeoff (roughness/metalness dropped) is invisible on Zerble's flat-shaded surfaces.
- **Chunk-load budget.** `ChunkManager.update()` used to synchronously build every uncached chunk in the load ring on a single frame; crossing a corner at boost speed (~28 m/s) demanded 3-5 chunks in one tick — long enough to stutter movement mid-boost. Now budgeted to 1 chunk per frame after boot, closest-first. The 3x3 ring backfills over ~3 frames (50ms).
- **Per-tier perf budgets in the HUD.** Backtick debug panel now shows draws and tris next to their per-tier budget (low 80/150k, mid 200/400k, high 400/1.2M) with `ok` / `!` / `!!` markers. Catches regressions visually as new content lands.

### Performance (pass 2)
- **`renderer.info` overlay** in the backtick debug panel — live draw calls, triangles, geometry/texture/heap counts.
- **Dispose-safe shared resources.** Module-level cached materials/geometries (`SHACK_MATS`, `STRING_BULB_GEO`, campsite `matFor`, NPC pool, torch+chair pools, food truck pool) are tagged `userData.shared`. Chunk + lake unload disposal walks skip them, so a Sugar Shack chunk unloading doesn't free materials that other chunks still need.
- **Distance-gated per-frame updates.** Campsite ember pulses, tiki flicker, drum-circle figure animation skip entirely when their cluster is > 75m from Zerble.
- **Adaptive quality monitor** (`src/adaptiveQuality.js`). Rolling 90-frame window. If avg frame > 24ms for ~1s, drops a quality level (bloom → shadows → half pixel ratio). Recovers if frame budget < 15ms sustained. HUD toast on transitions.
- **InstancedMesh.** Sugar Shack string bulbs (20 per shack → 1 draw); forest drum-circle bench rings (~45 meshes → 2 draws).
- **MSAA → FXAA on mid/low tier.** High tier keeps renderer antialias; mid/low get `antialias: false` + a screen-space `FXAAPass`. Way cheaper at pixelRatio 2.
- **Material + geometry pooling rollout.** `puppet.js` (every NPC shares geometry buffers, materials pooled by color), `campsite.js` torches + chairs (every torch/chair shares its primitive buffers), `foodTruck.js` (every truck shares buffers + materials pooled by color). Typical scene geometry count dropped ~21% (3686 → 2919).

### Performance (pass 1)
- **Shadow-cast audit.** `castShadow = true` count across the codebase dropped from 115 to 56 — cut on tent poles, sign boards, brackets, light fixtures, NPC limbs, Lurleen's raffia strands (was 280-560 per cart!), camp chairs, firepit stones, drum-circle benches, lamppost cylinders, and Zerble's smaller detail bits. Large objects (tent roofs, main walls, body capsules, banners, tree crowns, chassis) still cast.
- **Trip post-process pass disables itself** when the envelope is at zero — saves a full-screen render every frame the player isn't tripping.
- **Sugar Shack material + geometry pooling.** Hoisted ~20 per-build `MeshStandardMaterial` allocations to a module-level `SHACK_MATS` cache; string-light bulb sphere geometry and supply-can cylinder geometry are now shared too. Multiple shacks in view share draw calls.
- **Tier-aware shadow map.** Sun shadow map drops from 1024×1024 → 512×512 on mid tier (low tier already had shadows off). Shadow frustum tightens from 100m to 60m on mid for sharper shadows on the smaller map.

### Added
- **Sugar Shack vendor** modeled on Tom's Sugar Shack at LEAF. A 4×8m white gable tent with a separate signage facade in front: beige header banner ("Festival Famous / the SUGAR SHACK / Breakfast All Day + Night"), one long wooden menu plank below it with FRENCH TOAST / VEGGIE THING / VERMONT MAPLE TREATS / HOT & COLD DRINKS, white DRINKS price list on the left, white FOOD price list on the right, pink THANK YOU banner across the counter. Two triangular-frame wooden brackets (two poles meeting at an apex) project forward from the banner with chrome work lights at the apex, aimed inward to spotlight the sign — real `SpotLight`s, not emissive trickery. Two workers inside: Tom (tie-dye shirt, white/grey ponytail, beard stubble) and an apron-wearing cook. Cooking stations along the side walls; center is the worker walkway. String lights along both eaves; a single PointLight inside stands in for the cumulative glow. ~35% of food-plaza chunks swap one ring slot for a shack. *(Sandbox: "Sugar Shack" entity.)*
- **Sandbox: Time-of-day panel.** Slider + Morning / Noon / Dusk / Midnight buttons in the entity sandbox UI, mirroring the in-game block from the backtick debug menu. The full backtick debug overlay is removed from the sandbox — the entity panel is now the entire sandbox UI.
- **Context lights (`PERF.contextLights`).** New PERF flag (off on low-tier, on for mid/high) that gates the optional proxy `PointLight`s now placed at every campsite firepit and chunk-level drum-circle firepit, plus the Sugar Shack's three lights. Each is one light per cluster (not per element), `castShadow = false`, and the campsite ones modulate by `nightness²` so they're invisible by day and roaring at midnight.

### Changed
- **Music: less repetitive across all stages.** Every music generator (jam, brass, second-line, drum-circle) now rotates through 2–3 melody/rhythm variants instead of looping a single 16-step pattern forever. Lead voices have an 8–12% chance to drop notes so the soloist breathes a little (tuned down from a heavier 18–28% first pass — too many rests sounded weird). Drum toms miss ~6% of hits. A slow ±20–30% gain LFO over 20–28 seconds makes the whole mix ebb and flow. The forest drum circle was already varied (Euclidean rhythms + ghost notes + jitter) and is unchanged. *(See [ROADMAP.md](ROADMAP.md) for section-based songform and full Markov phrase generation.)*
- **Music bus volume dropped from 1.6 → 1.2.** The boost-to-carry was compensating for the wall-of-sound problem. With the variation pass landed, the boost isn't needed and the main stage is no longer in-your-face at boot.

## 2026-05-26

### Added
- **iOS audio.** Multi-stage unlock during the Start gesture: synchronous `ctx.resume()` first, then a 1-sample WebAudio buffer-source, then a real 100ms silent WAV via HTMLAudioElement appended to the DOM. The third path engages iOS's "Playback" audio session so WebAudio stops respecting the hardware silent switch. Lock state persists across tab backgrounding via the `Sound.resume()` shim.
- **Audio diagnostics.** `Sound.diagnostics()` returns the full init + live state (ctx state, gain values, unlock outcomes). Surfaced on `window.__game.sound` for Safari Web Inspector probing. `?sounddebug=1` URL param pops the state as an on-screen toast at Start.
- **Volume safety clamp.** `localStorage.zerble.vol.master` (and music/sfx) restore now clamps anything below 0.05 to 0.05 — a previously-saved zero was a real "no sound" footgun.
- **Trip offer: tap-to-accept on touch devices.** The wook offer toast becomes a one-shot button (pulsing green border, `pointer-events: auto`) so mobile players can accept without a Y key. Desktop Y still works.
- **README** with indie-game framing, hero image, and the canonical control list.
- **ARCHITECTURE.md** — full walkthrough of render pipeline, world chunks/forests/lakes, registry, collision model, crowd AI, audio synthesis, perf tiers.
- **Drum-circle population.** Tribal-aesthetic figures (drummers on benches, dancers orbiting the fire, firekeeper + spotter) added to forest drum circles. Hybrid silhouettes — mixed bodies/clothing/hair, no shoes — to read as ecstatic fire-dancers without leaning on the stereotyped tribal trope.
- **Starry night sky + moon.** Star field opacity ramps with nightness. Moon rises across the sky on the day/night arc.
- **Drum-circle clearings** inside selected forests, with raised stone firepit, log benches, smouldering log cone, and emissive fire that lifts nearby trunks out of the dark.
- **More campsites** — both forest-clearing and lakeside variants, with firepits + tiki torches that flicker on at night.

### Changed
- **Generic festival branding.** Title screen reads "Zerble at the Festival" (added "the"). Tagline dropped the "Black Mountain, NC" reference. README scrubbed of LEAF / Lake Eden Arts Festival names so the game reads as generic-festival.
- **Pixel-art hero image** in README, replacing the ASCII title block.

### Fixed
- **iOS no-sound bug.** Root cause: `new AudioContext()` returns suspended on iOS Safari and was never resumed. Compounded by WebAudio respecting the silent switch when no `HTMLMediaElement` has played.

## 2026-05-25

### Added
- **Wook trip system.** Approaching a wook while stopped triggers a slow-build psychedelic post-process effect — kaleidoscope, color shift, rippling refraction — running for ~3 minutes with a Come Down phase before clearing. Trip has two modes (Static for hand-tuned slider values, Dynamic for scripted timelines). Wook actively approaches the player to dose them.
- **First-person view.** `V` cycles through chase / first-person / top-down.
- **Bubble bump** — Zerble can now bonk NPCs gently and get a non-damaging soft-collision response.
- **GA4 analytics** wired to gameplay events: game start, first honk, smile milestones (10/25/50/100/250/500/1000/2500), personal best, collisions by kind, view toggles, Lurleen found.
- **Lurleen** — Zerble's love interest, a second cart with pink puffy lips, raffia hair, flower basket. Spawns ~360m NE of origin, wanders home turf, transitions to "aware" with hearts when Zerble approaches, then follows.
- **Lakes** — first-class macrocell lake bodies (big radius 70–100m, small 25–40m), independent of the chunk grid. Canoes, beaches, lakeside campsites. Edge colliders stop carts from driving in.
- **Bigger lakes** with proper shore handling and 20% beach odds.
- **Forests.** 3x3 chunk-block forest cells pinned to the chunk grid with a 5x5 macrocell rule guaranteeing breathing room. Some host interior clearings (campsite or drum circle); all have a path entry through the tree wall.
- **Brass band parade** — roaming second-line marching brass with trumpet, trombone, tuba, snare, and kick. Anchored music handle that follows the band.
- **Puppet parade**, **kid gaggle**, and **wooks** as world-roaming obstacles independent of the chunk system.
- **Crowd v2** — pool of stateful NPCs with personality vectors (curiosity, skittishness, energy, social, talkative). State machine: idle / walking / watching / approaching / fleeing / smiling / riding / boarding. Steering with neighbor separation, footprint repulsion via registry, path attraction.
- **Crowd faces, smile reactions, happy bounce.** Walking-backward bug fix.
- **Humanoid bodies + horizontal guitar/bass necks** for stage performers.
- **Hammocks** with sleeping NPCs rendered supine (spine aligned with the poles, sinks into the sag).
- **Procedural festival chunk system.** 80m chunks, themed (main_stage / side_stage / food_plaza / vendor_row / drum_circle / grove / open_lawn), deterministic per (cx,cz) hash, lazy-load on approach.
- **Honk system.** Bell (B) + clown horn (H), Space picks randomly. 0.15s cooldown. Clown horn is a 2-phase honk + inhale fifth up. Bell is a brrring trill.
- **Boost engine sound** that punches in with throttle.
- **Touch controls.** Virtual thumbstick + Boost / Honk / Cam buttons, drag-to-orbit-camera.
- **Mobile polish** — viewport handling for iOS URL bar, dvh sizing, pinch/double-tap zoom suppression.

### Changed
- **Performance tiers** (low/mid/high) auto-detected from touch/screen/cores/memory. Pixel ratio cap, shadows, bloom, crowd density, chunk draw radius all read from this.
- **Performers / band poses** — trumpet, trombone, tuba alignment; cone bells flipped so they point away from the player; detached-forearm bug fixed.

## 2026-05-24

### Added
- **People fixes** — improved NPC rendering and behavior.
- **Mobile updates** — viewport, controls, audio gesture handling.

## 2026-05-23

### Added
- **Initial three.js scene** — Zerble cart, ground plane, sky, bubbles, smile pickups, score panel, title card.
