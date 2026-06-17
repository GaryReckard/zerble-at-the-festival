# layout-surfaces

> Revised after deliberation 001-initial: the overlay consumes captured
> snapshots + analytic envelopes (not dry-run records); hub viewer integrity
> requirements added (CG7).

## ADDED Requirements

### Requirement: True-extent overlay in map-sandbox
`map-sandbox.html` SHALL gain a layer that draws sub-component extents from two
sources: (a) captured layout-snapshot JSON (`verification/snapshots/<seed>.json`,
fetch or file-drop) rendered as exact built truth, and (b) analytic tuning
envelopes rendered live for any seed and labeled approximate. The layer SHALL be
toggleable alongside the cluster-footprint layer and the point inspector SHALL
show per-record kind on hover for both sources. map-sandbox.html's importmap
array SHALL gain the tuning/lint/extent modules (it is the fourth importmap
file).

#### Scenario: Captured truth shows the clipping
- **WHEN** the snapshot for seed `0xf7ef2a3c` is loaded and the true-extent
  layer is on
- **THEN** the truck×booth overlap renders visibly overlapping in 2D, marked as
  built truth

#### Scenario: Any seed previews approximately
- **WHEN** no snapshot exists for the viewed seed
- **THEN** analytic envelopes render live from tuning constants, visually
  distinguished as approximate

### Requirement: Hub viewer page
The system SHALL provide `hub-sandbox.html`: a deep-linkable 3D view that builds
ONE complete hub through the real `festivalPlan` → `buildWorldgenKind` path via
an exported `buildHubPreview(scene, heart, opts)`, on a flat ground plane with
orbit camera and ToD presets. It SHALL accept `?seed=&hub=n` AND `?at=x,z`
(resolving to the nearest heart, then replaceState to the canonical URL), and
SHALL display the heart's world coordinates and rank. Its importmap SHALL map
`'three'` to `src/threeShim.js` — index.html's mapping (index.html:101), NOT
sandbox.html's, which deliberately uses raw unpkg three and would give the
viewer tier-divergent materials.

#### Scenario: Coordinates find the hub
- **WHEN** `hub-sandbox.html?at=412,-980` is opened (e.g. from a lint violation
  or a playtest marker)
- **THEN** the nearest heart to (412, −980) renders fully and the URL is
  rewritten to its canonical `?seed=&hub=` form

#### Scenario: New POI kinds appear by construction
- **WHEN** a new kind is added to the `buildWorldgenKind` dispatch
- **THEN** it renders in the hub viewer with no hub-viewer code change

### Requirement: Hub viewer fidelity and teardown integrity
`buildHubPreview` SHALL use the specced synthetic ctx ({cx, cz, key, cxWorld,
czWorld, rng, group, region, crowd}); crowd SHALL be a real instance or a
draw-faithful stub, never omitted; the hub's worldgen lakes SHALL be registered
into the page registry before building. Rebuild-in-place SHALL tear down via a
shared by-key unload helper extracted from chunks.js's existing dispose walk
(used by both `_disposeChunk` and the viewer) so rebuilds cannot leak registry
entries that feed back into placement guards. Fidelity SHALL be verified by
diffing hub-viewer sub-component positions against a game `dumpRegistry` at the
same seed/hub/tier.

#### Scenario: Viewer matches the game
- **WHEN** the same seed/hub/tier is built in hub-sandbox and captured from the
  running game
- **THEN** the sub-component position diff is empty (or each difference is
  explained and documented)

#### Scenario: Slider-drag rebuilds don't drift
- **WHEN** a tuning slider triggers ten successive rebuilds of the same hub with
  unchanged values
- **THEN** the tenth build is identical to the first (no registry leak feedback)

### Requirement: Seed-gallery mode
`map-sandbox.html?gallery=N` SHALL render an N-seed contact sheet (one tile per
seed, centered on that seed's spawn hub, seed-labeled), rendering each tile once
with a yield between tiles; lint counts SHALL come from plan mode (no boots) and
fill in progressively after tiles paint; clicking a tile SHALL open that seed
full-screen.

#### Scenario: Distribution at a glance
- **WHEN** `?gallery=12` is opened
- **THEN** 12 labeled tiles render, counts fill in asynchronously, and a tile
  click deep-links to that seed's full map view
