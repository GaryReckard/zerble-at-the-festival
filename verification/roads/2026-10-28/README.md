# Road surfaces and organic stage seating, October 28, 2026

The uncommitted implementation extends checkpoint `3e6d4af` and preserves the
preceding activity, shoulder, hoop, soundboard and terrain-underlay corrections.
No commit, push or deployment was made for this work.

## Implemented policy

- Seven-metre dirt roads retain subtle mottling and grain, while nine-metre
  asphalt roads serve existing edges incident to a major festival heart.
  [The road classifier](../../../src/worldgen/roads.js) rejects paving for an
  entire edge if any segment, expanded by the full ribbon half-width, intersects
  a lake's enclosing circle. Every irregular lake outline lies inside that
  circle, so this continuous test covers endpoints, joins and segment interiors.
  It deliberately rejects some otherwise dry shore roads; inherited dirt-shore
  geometry is unchanged.
- The planner retains its original 4.5m half-envelope and all its random decisions:
  dirt has one-metre shoulders, while asphalt occupies the same nine-metre
  reservation. Vendor canopies use full oriented 4.7m boxes, retaining straight avenues while rejecting bends and nearby crossing roads. Other builder-local physical gates and registry lint conservatively
  clear the widest road plus the existing object radius/margin, including when a
  narrower centerline is closer. This can omit a nearby prop even beside dirt;
  it does not move planner descriptors or reroute any road.
- [The shared materials](../../../src/roadMaterials.js) create two lazy 256² RGBA
  mipmapped tiles with repeat wrapping and sRGB color, independently of world
  RNG. Final terrain-clipped vertices receive world X/Z UVs at one repeat per
  four metres in [chunks](../../../src/chunks.js). Legacy grid, forest, drum and
  woodland access paths reuse dirt. Materials and maps carry shared ownership.
- [The distant renderer](../../../src/farField.js) copies surface/width with its
  owned polyline and writes surface colors into its existing single draw.
  Its ribbon remains 80% of the actual detailed width and 3cm above terrain,
  beneath the 6cm detailed lift. Final clipped triangles and fixed capacities
  retain the earlier black-patch repair.
- Both [map passes](../../../map-sandbox.html) consume surface and visible width.
  The hub preview now builds the same clipped road meshes as actual chunks;
  its previous venue-only preview could not establish road clearance.
- Small chair groups occupy different depths in the rear audience band, with
  short angled rows, modest individual variation, explicit separation, all four
  chair styles and seats facing toward the stage center. Covered-stage seating
  starts behind the front half of its audience area. Each stage blanket exposes
  four independently reserved cross-legged positions facing approximately toward
  the stage; ordinary lawn blankets remain ineligible. See the
  [stage report update](../../people/stage-audience.md#organic-seating-follow-up).

## Compatibility and tests

[The route baseline](route-baseline.json) was frozen before implementation.
[The layout baseline](layout-baseline.json) was additionally reconstructed using
`HEAD`'s original roads module in an isolated temporary source copy, preserving
all other current pure generator inputs. It records original queryPoint tuples,
nearest centerline fields and complete nearby festival descriptors. The new
metadata is deliberately excluded from old nearest-field comparisons.

`node bin/test-road-surfaces` passes four-seed route hashes and layout/point
hashes, reversed endpoints, seed restoration, actual approach/bounds metadata,
42 paved and 585 dirt approach visits, 24,639 dry full-width probes, and the
production shoreline conflict at heart cells (-1,-6) to (-1,-5), seed3248888364.
It also exercises the production tile factory's bounded sharing and grain.
The visit counts include repeated seed restoration, rather than unique edges.

`node bin/test-far-field` passes actual seven/nine-metre width and surface-color
buffer assertions, stable rewrites, fixed caps, long-travel lifecycle checks and
630 triangle-interior samples at the reported black-patch location.
`node bin/test-stage-audience` passes 100 seeded separated chair layouts with
unchanged RNG draw counts, four concurrent original blanket occupants, exclusive
reservation contention, vacancy reuse and unload/interruption cleanup.
Vendor footprint cases retain straight avenues and reject curved/mixed-width overlaps. The forest determinism test retains its 4,000-seed RNG/crown/perch hash.

The complete `npm run check` result is recorded in [check.log](check.log).
Importmaps cover 155 modules on all five entry pages. The production self-test
also returned pass=true and teeth=true, query golden eddf8e50 and POI golden
846e1957; the unchanged four-seed descriptor hashes are the direct compatibility
assertion, rather than relying on that self-test's round trips alone.

## Native browser evidence

All observations used the in-app browser and muted localhost URLs, with no
standalone browser or software-WebGL process launched.

| Surface | Result and evidence |
| --- | --- |
| Actual ribbon/material fixture, Low and Mid | [Low Noon](surfaces-low-noon.png), [Low Midnight](surfaces-low-midnight.png), [Mid Noon](surfaces-mid-noon.png), [Mid Midnight](surfaces-mid-midnight.png). Both passed final UV, sharing, mipmap and depth assertions, with three draws and six triangles including ground. |
| Cart-height texture view | [Low](surfaces-low-cart.png), [Mid](surfaces-mid-cart.png); both finishes remain readable at grazing angles. |
| Production disposal/rebuild | [Low](surfaces-low-lifetime.png), [Mid](surfaces-mid-lifetime.png): ten calls through actual disposeChunkByKey followed by rebuild retained the same two shared material/map pairs and two uploaded textures, with three draws/six triangles. Cold tile plus ribbon CPU was 4.8ms Low and 5.4ms Mid in these individual browser runs, separate from rendering/device performance. |
| Complete major hub, seed1234 at318,-93 | [Low Noon](hub-low-noon.png), [Low Midnight](hub-low-midnight.png), [Mid Noon](hub-mid-noon.png), [Mid Midnight](hub-mid-midnight.png), showing dirt and paved approaches beside actual stage/market builders. |
| Existing distant-road handoff | [Low shaders with Mid proxy composition](hub-low-handoff.png): 1,258 road vertices, zero clipped roads, fixed existing buffer, one road draw. Whole-hub/proxy totals were 1,274 draws/241,371 triangles, 754 geometries/10 textures/65 programs, max cold step20.6ms. These include the newly visible preview roads and all unrelated hub/proxy scenery; they are not a before/after performance claim. |
| Surface-aware map | [Seed1234](map-1234.png), both passes compile and draw without console errors. |
| Real game | [Ready-click start](game-low-start.png), [after driving and honking](game-low-driven.png). Clicked the ready Just Cruisin' plank, observed dirt/asphalt at their junction, drove with W, honked with Space and checked a clean error console. The synchronous audio initialization code was unchanged; muted desktop startup does not prove physical iOS audio. |

The two tiles add 512KiB of base-level pixel data, about 683KiB with the complete
mip chains, and one extra UV attribute on detailed road geometry. The distant
color buffer adds 48KiB at every current tier's 4,096-vertex cap. They introduce
no extra road draw or shadow caster and no texture generation during steady-state
frames. These are allocation bounds and observed counters, not device FPS.

A final [Mid evening game boot](game-mid-evening-final.png) through the ready mode plank and honk also had a clean error console. The [reported road location with texture](reported-road-textured.png) remained free of the dark polygon with its distant underlay enabled; time continued advancing during that live observation. Its iframe emitted the previously recorded unattributed MutationObserver.observe error without a source URL, while direct game boots and native fixtures remained clean. This is retained as a verification limitation, not attributed conclusively to game or browser code.

## Limits and cleanup

This establishes desktop Low/Mid visuals, deterministic layout and resource
behavior, not phone performance or a new physical-device audio test. Conservative
paving can leave short shore-adjacent major routes dirt. Existing terrain-crease
coverage remains in the far-field regression and the preceding road-patch report.

All task-created browser tabs were explicitly closed, and the final in-app
browser inventory was empty. The task-owned no-cache server PID16080 was
terminated; `ps -p 16080 -o pid,command` returned only its header with exit1,
confirming that exact PID was gone. No standalone browser was launched or
unrelated process stopped. The completed road/seating wakeup was deleted through
the app automation tool. No commit, push or deployment was made.
