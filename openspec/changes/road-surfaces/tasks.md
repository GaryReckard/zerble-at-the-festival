## 1. Characterization and planning
- [x] 1.1 Audit road graph, width/clearance consumers, grass texture and both render paths; record unchanged seed route fixtures.
- [x] 1.2 Build a production-backed surface fixture and complete council review of the plan.

## 2. Semantic road data
- [x] 2.1 Add deterministic surface/width metadata to canonical edges and propagate approach, bounds and nearest-point queries without changing RNG streams or graph topology.
- [x] 2.2 Make map rendering and venue/road clearance consume actual widths, with tests across seeds and reversed query order.

## 3. Road rendering
- [x] 3.1 Add bounded shared dirt/asphalt procedural textures and world-aligned UVs, wired through all five importmaps.
- [x] 3.2 Apply textures to detailed roads and dirt access/legacy paths, preserving terrain clipping and shared disposal.
- [x] 3.3 Propagate widths and colors through the existing distant-road snapshot/buffer draw and preserve the black-patch regression.

## 4. Verification and documentation
- [x] 4.1 Run meaningful surface/metadata/clearance/streaming tests, importmap checks and the full suite.
- [x] 4.2 Capture Low/Mid Noon/Midnight cart-height and hub fixtures, compare counters and cold allocations, and boot the actual game through a ready mode click.
- [x] 4.3 Update CHANGELOG, verification and OpenSpec records; close owned tabs/server, leave unrelated work intact, and do not commit/push/deploy.
