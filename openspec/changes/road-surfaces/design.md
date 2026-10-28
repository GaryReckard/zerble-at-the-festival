## Context

All current worldgen roads have tier arterial and a seven-metre visible ribbon, while ROAD_WIDTH also defines a broader no-build corridor. Hearts already have major/minor ranks, and roads are canonical endpoint pairs. The grass surface uses deterministic, mipmapped DataTexture grain; detailed roads have no texture UVs. Distant roads are one fixed-capacity draw, now correctly draped on terrain triangles.

## Goals / Non-Goals

Goals: believable dirt and asphalt; coherent paving based on access to major festival hubs; map/planner/render width agreement; stable coordinates, seam-safe texture scale, Low/Mid support and bounded shared resources.

Non-goals: new road graph edges, traffic lanes or driving physics, changes to lake ownership, iOS audio, people architecture or player scoring.

## Decisions

Accepted policy: edges incident to a major heart are candidates for paved festival access roads, with a nine-metre visible width; minor-to-minor roads remain seven-metre dirt routes. Classify the whole canonical edge without new random draws, preserve its route and arterial tier, and expose stable surface/width metadata to all consumers. A whole edge falls back to dirt if any segment comes within the full paved half-width of a lake’s enclosing circle, which also contains its complete irregular outline. This conservative continuous-distance test covers interpolated ribbon joints and may reject some otherwise dry shore roads. This leaves most roads dirt under current four-percent-major tuning. Do not infer rank by recursively calling festivalPlan from roads.

Add a renderer-owned material/texture helper with two lazy shared, repeat-wrapped, mipmapped procedural texture tiles. Use world X/Z metres for UVs after terrain clipping, so adjacent chunks and access paths do not slide or rescale their grain. Dirt paths reuse the dirt finish; asphalt is limited to planned road edges. No texture animation, extra shadow casters, post-process work or per-frame allocations.

Detailed roads select one shared material per surface. Coarse roads carry copied semantic metadata and use per-vertex surface colors in their existing single draw. Keep the recent terrain-crease clipping fix. Map overview/detail use the same road descriptor. The full-shape planner keeps its original 4.5m half-envelope: dirt7 + shoulders1, pavement9 + shoulders0. Physical builder checks conservatively use the widest half-width plus their object radius/margin, vendor canopies use complete oriented 4.7m boxes, and registry lint includes captured collider radii, since the nearest centerline is not always the closest mixed-width boundary. Broad no-build corridor remains unchanged. Audit every direct ROAD_WIDTH consumer before implementing the widened ribbon.

## Risks / Trade-offs

- Widening can intersect existing venues or access paths: use descriptor widths in clearance and production hub fixtures across seeds, while preserving road centerlines and existing RNG ordering.
- World-space UV repetition can show tiling or shimmer: combine broad dirt mottling and fine grain, mipmaps, bounded texture sizes, Noon/Midnight Low/Mid captures at cart height.
- Shared material disposal can trigger recompiles: shared-tag both textures and materials, verify unload/revisit ownership.
- Added metadata can be lost in cache/copy paths: cover approachRoadsOf, nearestRoad, roadsInBounds, map and distant-road snapshots with deterministic/query-order tests.
- New helper module must appear in all five importmaps and cannot mutate THREE namespaces.

## Migration Plan

Existing road graph and route points remain unchanged for a seed. Surface assignment and visible width are newly derived from existing hub rank; The full-shape venue planner retains its original predicates and execution. Builder-local physical backstops may omit props near the wider ribbon, including conservative omissions beside dirt roads. Any such placement changes must be explicit and characterized, not caused by incidental RNG shifts. Legacy worldgen=0 remains dirt.

## Open Questions

None for Gary; implementation details will be resolved from the production code and review.
