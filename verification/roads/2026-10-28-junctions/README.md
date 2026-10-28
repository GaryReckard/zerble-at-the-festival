# Mixed road junctions and dirt repetition, October 28, 2026

This follow-up fixes the two reports on checkpoint `3277b51`, seed2791182655:
(640.73,-210.08), heading-.522, time.219, and (234.56,-1463.88), heading-.253,
time.297. The changes remain uncommitted and were not pushed or deployed.

## Reproduction and cause

[The production fixture](../junctions.html?mute=1&perf=low) uses the actual
worldgen edge descriptors, road materials, ribbon builder and terrain sampler.
The [first baseline](first-before.png) and [second baseline](second-before.png)
reproduce competing dirt/asphalt fragments without any crowds, cart or distant
road underlay. Both materials had the same .06m lift and identical polygon
bias, so their overlapping terrain-conforming triangles could win or lose the
same depth pixels as the camera moved. This is a different failure from the
previous distant-road triangles protruding through terrain creases.

Geometry subtraction alone fixed the overlap with the original texture still
in place, recorded in [first-geometry-only.png](first-geometry-only.png).
Texture changes were applied afterward, isolating the two corrections.

## Implementation and constraints

[roadGeometry.js](../../../src/roadGeometry.js) creates the canonical ribbon
footprint and subtracts convex paved triangles from dirt. This removes the
competing dirt area, rather than trying to make a depth bias hide it. Each
retained piece is triangulated, then the existing terrain clipping and
world-aligned UV generation proceed in [chunks.js](../../../src/chunks.js).
The same complete edge is formed before clipping to chunk ownership, so the
rendered asphalt and its dirt cutout agree at bends and chunk seams. Road
footprints crossing a chunk border are admitted even when their centerline
is outside that chunk. Existing path-node placement still uses the original
centerline runs. Dirt access paths use the same paved-footprint rule, while
legacy worldgen=0 paths never carve holes for absent v2 roads.

The [distant renderer](../../../src/farField.js) applies the same subtraction
within its original single draw, surface colors, width fraction, lower lift
and hard buffer limits. If nearest-first capacity selection omits pavement, a
second, bounded pass reserves only the paved proxies actually kept, restores
dirt under omitted ones and preserves the fixed capacities. The retry cannot
evict its reserved cutters. It runs during snapshot commits, not per frame.

[roadMaterials.js](../../../src/roadMaterials.js) changes only the dirt tile:
512² RGBA over 32m, compared with the previous 256² over 4m, with lower-contrast
broad mottling, smaller variations and grain. The mapping remains world-space,
with repeat wrapping and mipmaps. Asphalt remains 256² over 4m, and both maps
and materials remain shared. The total base pixel allocation is now 1.25MiB,
about 1.67MiB including full mip chains, which adds about 1MiB of mipmapped
texture storage. There is no new material, shadow caster, per-frame texture
generation or draw for an additional surface layer.

The road graph, surface assignment, water eligibility, widths, point-query
fields, planner descriptors, RNG streams, scoring/frame barriers, independent
nightness and synchronous gesture audio initialization are unchanged.

## Tests

- `node bin/test-road-junctions`: 619 old overlap probes confirm that the
  reports exercise the original defect; 22,050 independent barycentric probes
  find no competing dirt/paved interiors after subtraction while retaining the
  original road union. Exact crossing area, containment, deterministic repeats
  and adjacent chunk area partition also pass.
- `node bin/test-terrain-consumers`: actual extracted production chunk functions
  remove dirt beneath asphalt before draping, preserve the terrain lift and
  crease behavior, and avoid phantom pavement queries in legacy mode.
- `node bin/test-far-field`: actual index/position/color buffers have no competing
  surface probes, and an eight-vertex/twelve-index capacity case restores both
  uncut dirt quads when their paved cutter is omitted. Existing long-travel,
  ownership/disposal, fixed-capacity and 630 road-crease interior probes pass.
- `node bin/test-road-surfaces`: the original four-seed route, point/nearest-field
  and POI hashes remain exact, along with the full-width shore fallback and
  bounded shared material/texture assertions.
- `npm run check` passes. [The complete log](check.log) includes all of the above
  and the existing people, rendering, audio, worldgen and scoring checks.
  Importmaps cover 156 source modules on all five entry pages.

## Native browser and real-game evidence

All checks used muted localhost in-app browser tabs, without a standalone
browser or software-WebGL worker. Both locations were inspected at several
camera angles in Low and Mid, with clean error consoles.

| Location | Low | Mid |
| --- | --- | --- |
| First report | [Noon](first-low-noon.png), [camera moved](first-low-moved.png), [Midnight](first-low-midnight.png) | [Noon](first-mid-noon.png), [camera moved](first-mid-moved.png), [Midnight](first-mid-midnight.png) |
| Second report | [Noon](second-low-noon.png), [camera moved](second-low-moved.png), [Midnight](second-low-midnight.png) | [Noon](second-mid-noon.png), [camera moved](second-mid-moved.png), [Midnight](second-mid-midnight.png) |

The first fixture uses four draws and the second five, including ground, the
same draw counts as their baselines. Current totals are 916 and 946 triangles.
The old fixtures drew uncropped portions of their complete source edges, while
the new ones obey the authored 90m bounds, so their triangle totals are not a
like-for-like performance comparison or an FPS claim.

[Ten actual unload/rebuild cycles](texture-lifetime-low.png) retain three draws,
six triangles and two uploaded textures in the isolated surface fixture, with
shared material identity intact. One cold Low tile/ribbon run measured 9.1ms
CPU, separate from rendering and steady-state cost. This is a single desktop
observation, not a device performance guarantee.

Both actual game pages booted through a ready Just Cruisin' plank click:
[first location, Low](game-first-low.png) and [second location, Mid](game-second-mid.png).
Honking and driving/camera movement at the first location produced no console
errors. Direct game and isolated fixture checks are clean; physical iOS audio
and phone performance were not retested because their code paths are unchanged.

## Cleanup

All task-created browser tabs were explicitly closed, and the final in-app
browser inventory was empty. The owned no-cache server PID61074 was terminated;
`ps -p 61074 -o pid,command` returned only its header with exit1, proving that
exact process was gone. No standalone browser was launched, unrelated process
stopped, or commit/push/deployment performed.
