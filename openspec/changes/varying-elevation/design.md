## Context

The existing proof (`src/terrainSurface.js:1`) shares a one-meter contact lattice with its authored mesh. The game has a much larger 1,400m ground patch, while `src/world.js:202` subtracts a moving center height. Existing roads already have canonical pair ownership (`src/worldgen/roads.js:1`) and festival planning has substantial cold cost (`src/worldgen/festival.js:278`). A world sampler cannot call the full festival planner for every mesh vertex or wheel sample.

## Goals / Non-Goals

**Goals:** One deterministic world-space surface; unchanged X/Z layout; broad playable rolling country; level complete gathering/camp footprints and lakes; grounded live consumers; bounded boot and sampling work; independently inspectable map and driving harness.

**Non-Goals:** Rare mountain districts, switchbacks, new horizontal layout, airborne physics, bridges/tunnels/stacked surfaces, simulated hydrology, workers or GPU displacement without a measured need.

## Decisions

1. **One-way pure surface.** Add a render-independent `src/worldgen/terrain.js` module exporting `sampleTerrain(x,z,out)`, `terrainHeight(x,z)`, `terrainVertexHeight(x,z)` and bounded `terrainDescriptors(bounds)` inspection. `sampleTerrain` fills height, `nx/ny/nz`, `dx/dz`, grade, surfaceClass and traversable without mandatory per-call allocation. Keep the authored proof fixture available; the driving harness gains a world-surface mode. Avoid importing the final terrain back into heart, lake or road generation.
2. **Independent relief and complete constraints.** Use a new documented terrain salt and a terrain version; never consume layout RNG draws. Start with approximately 12–24m broad relief over roughly 800m and an ordinary target grade below 15%, then measure the actual maximum after grading. Descriptor heights sample base relief only. Canonical hub catchments can level complete dense venues/camp clearings cheaply; finer footprint descriptors are added only where needed to cover real planned extents, including satellite pitches. Entire lake polygons and shoreline collars share one canonical level. Pair-owned road approaches interpolate shared endpoint anchors and blend shoulders. Water exclusion wins inside lake interiors; land pads and roads use deterministic priorities/IDs and compatible junction anchors. Overlap behavior is a pure function of descriptors, never load order.
3. **Bounded preparation.** Discover descriptors by fixed spatial tiles with finite influence bounds, stable sorting, and bounded seed/epoch/version-aware caches. Cache mesh-lattice vertex heights. Prepare a patch's tile descriptors once, then sample many vertices from them. Never invoke `festivalPlan` independently for each ground vertex or wheel sample, and never enumerate off-scale hubs in the map. Use conservative canonical catchments derived from cheap heart/road/water descriptors where precise plans would make boot expensive; verify they cover complete footprints. Cache eviction must change work only, not output.
4. **Authoritative contact lattice.** Begin with the game's existing 10m spacing and a fixed global origin. Verify PlaneGeometry's rotated index diagonal before selecting the identical sampler triangle rule; the proof's diagonal is not assumed equivalent. Sample contact from triangle interpolation of final vertex heights, and derive normals from the same triangle. Mesh vertices use absolute world heights, with no center subtraction. Recenter by whole lattice steps. Road/decal vertices and feet use contact height; level venue regions must include a one-cell margin so triangles spanning their borders cannot disturb the occupied flat interior. If this margin or coarse spacing causes unacceptable transitions, refine the lattice with measured budget evidence rather than maintaining separate physical terrain.
5. **Consumer migration.** A shared grounding helper can lift a complete builder result and its world-space registry anchors exactly once while retaining model-local animation offsets. Roads sample both edges; forests and scatter instance transforms receive ground elevation. Lakes translate one owning root and all absolute world anchors coherently, retaining no chunkKey. Audit camps, walking versus seated/hammock/cart crowd states, parade/one-wheel/nut-wagon routes, passengers, nozzles, headlights, effects, proxies and all camera modes. Single-valued terrain permits existing X/Z broadphase, but physical collisions must not produce spurious interactions across vertical separation; add explicit height overlap where needed without invalidating water barriers.
6. **Driving and cameras.** Reuse `terrainDriving.js` with baseline game acceleration/boost preserved, four-wheel support, bounded chassis tilt and full attachment transforms. Terrain sampling resets on teleport. Chase clearance samples the camera-target segment, and alternate cameras remain terrain-relative. The initial world stays grounded with no airborne state. Braking and parking hold, reverse, boost and diagonal traversal must obey tested grade limits.

## Implemented refinement, October 25

The implemented first pass uses a common zero datum for gathering pads and lakes,
with independently salted rolling relief between their finite shoulders. Dense
480m hub disks suppressed nearly all relief; actual planned venue envelopes and
complete woodland/lakeside camp catchments retain more usable country. Compatible
zero-level overlaps avoid order-dependent steps without conflicting pad priorities.
The acceptance fixture is therefore a real hub **within rolling terrain**, rather
than an artificially raised hub. Pair-owned road approach grading remains an
acceptance item; current road geometry conforms to the surface, including triangle
crease clipping, but does not independently reshape the ground into a road profile.

Camp sleeping tents additionally fit a local support plane and independent props
receive their own heights. This improves residual slopes without deforming pooled
meshes. It is not a guarantee of perfect contact across arbitrary nonplanar ground.

## Risks / Trade-offs

- **Determinism:** Query order, stale seed caches and overlapping pads can fork heights. Mitigate with shuffled query/load order, negative coordinates, seed-reset and cache-eviction fixtures while preserving existing layout goldens.
- **Dense planning/boot cost:** A ground patch has many vertices and nearby venue plans overlap. Mitigate with bounded descriptor preparation and vertex caches, plus call-count and cold-patch timing regressions before live integration.
- **Coarse ground:** Exact contact alone does not prove smooth shoulders or flat camps. Verify full footprint corners, one-cell pad margins, road junctions, lake shores and repeated 40m recenter crossings.
- **Lifecycle/disposal:** Raising render roots can double-lift registry or animation anchors. Test load/unload/revisit and lake collider survival, preserving shared resource tags and instance update flags.
- **Performance/tier policy:** Added sampling and ground resolution can cost CPU/triangles. Measure parked and streaming costs separately at Noon/Midnight and Low/Mid/High; keep materials/shadow policy unchanged.
- **Boot/threeShim/audio:** New modules require all five importmaps and real game boot. Preserve frozen module namespace handling and the synchronous gesture-to-Sound.init chain.

## Migration Plan

Keep a flat fallback while converting all consumers. Existing X/Z seed layouts remain identical, while terrain has its own versioned fixtures. Enable rolling terrain by default only after automated and available browser acceptance, recording unavailable device checks honestly. This change does not require a new save format or regenerate layout goldens.

## Open Questions

None blocking implementation. Exact amplitudes, shoulders and maximum grades are measured tuning values, not permission to relax contact or lifecycle contracts.
