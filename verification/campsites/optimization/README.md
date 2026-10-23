# Campsite optimization sweep

October 23, 2026, against the completed tent/seating review at `0970035`.

## Changes and evidence

| Path | Optimization | Verification |
| --- | --- | --- |
| Door and silhouette construction | [Shell clipping](../../../src/models/campsite.js) rejects rear and disjoint facets using scalar bounds before creating temporary polygon vertices or edge-clipping buffers. It retains the exact faceted geometry. | [Optimization regression](../../../bin/test-campsite-optimization) compares every output vertex and its order against the pre-optimization full triangle walk across 300 outlines, including thin strips, reversed winding, boundaries and scales. |
| NPC camp seeking | [Camp selection](../../../src/crowd.js) rejects camps whose registered enclosing radius cannot contain a nearer slot, before reading every seat or bed coordinate. The current best distance tightens the bound without changing iteration/tie order. | The same regression compares 200 chair/bed claims and walking outcomes against the unbounded production method. A distant 80-camp fixture reduces slot-X reads from 548 to zero. |
| Discarded construction | [Camp assembly](../../../src/models/campsite.js) consumes the historical RNG draws for omitted tent slots, canopy/chair groups and unused privacy screens without constructing their geometry, clipped doors, temporary chair meshes, materials or canvas textures. | [Layout regression](../../../bin/test-campsite-layout) checks deterministic layouts, furniture clearances and RNG continuity, including retained geometry/metadata. |

These changes target construction CPU/allocation cost and repeated seeking CPU work. They do not reduce the visible geometry, draw distance, lighting, seat capacity or NPC update cadence. Existing shared geometry/material ownership, cached silhouette poses and chair instancing remain in place.

The [saved construction comparison](construction.log) uses the complete pre-sweep assembler source saved from `0970035`, with real tent, tapestry, canopy and chair builders and identical rendering stubs. Across 1,800 size/role/archetype/seed cases, tent constructor calls fall from 3,600 to 2,700 (25%), tapestry/canvas construction from 2,736 to 1,824 (33.3%), canopies from 1,935 to 1,225 (36.7%), and chairs from 10,029 to 8,239 (17.8%). External RNG draw counts and next values, seat coordinates, shelter bounds/capacities, collider metadata and retained prop transforms remain identical. A permanent 360-case regression checks that only retained tents/screens/canopies and their usable chair groups are constructed and satellites allocate zero tapestry canvases. The optional baseline input is local verification data, not a runtime dependency. Recreate it with `git show 0970035:src/models/campsite.js > /tmp/campsite-opt-before.js`, then run `node bin/test-campsite-layout /tmp/campsite-opt-before.js`.

## Operation measurements

Run `node bin/test-campsite-optimization --bench`. The [saved measurement output](operations.log) contains seven-round medians after two warmups on this Mac:

| Synthetic workload | Before | After |
| --- | ---: | ---: |
| 600 indexed shell clipping operations | 6.633 ms | 1.209 ms |
| 1,500 unsuccessful searches among 80 camps with eight slots each | 114.736 ms | 17.491 ms |

Both clipping implementations run in the same native JavaScript realm. Both seeking implementations run through equivalent production-method VM harnesses. These are isolated operation measurements, not frame-time or FPS predictions; live savings depend on visible camps, available reservations, NPC locations and streaming activity. No physical-phone benchmark was performed.

## Browser and integration checks

The muted in-app browser reused the existing server on port 8765. At the same seed 1977, large-camp Low counters remain equal to the preceding review: [Noon](camp-low-noon.jpg) 37 draws / 3,208 triangles and [Midnight](camp-low-midnight.jpg) 39 / 3,226. No warnings or errors were reported. These unchanged render counts are intentional because this sweep removes invisible work.

Real-game [Low](game-low.jpg), [Mid](game-mid.jpg) and [High](game-high.jpg) boots used the ready mode button and reached settled gameplay without warning/error console entries. High was reloaded and booted again after the final canopy construction change. The [whole-game counters](game-counters.jpg) still show 3,271 draws at this spawn, above the guide budget, with 766,000 triangles and adaptive quality at `cheap-bubs`. This sweep therefore does not establish that the complete scene meets tier budgets or improves device FPS; broad rendering cost remains distinct from the operation savings above.

The final `npm run check` passed, including the new optimization regression and existing lifecycle, layout, registry, appearance, ownership and importmap checks; [complete output](checks.log) records the run. `git diff --check` also passed. No standalone browser or server was started; the owned in-app test tab was closed, and Gary's existing server was left running.
