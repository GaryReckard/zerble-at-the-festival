# Stage chairs and usable render capacity

October 30, 2026. Gary reported that chairs in front of a stage did not collide or participate in the physical prototype.

## Cause and fix

`placeStageChairRows` registered audience entries with seat data and a footprint, but no collider or physical descriptor. The builder now retains row/slot identity through batching and calls `registerStageChair`, which adds a one-smile collider, the actual batched render binding, seat claims and a stable physical key. Both open and tent stages provide their stage-front registry entry as the origin lifetime. Audience entries retain kind `chair` for the crowd activity; physical recipes use the existing camp-chair/loveseat kinds. Stage chairs join static neighbor support, encounter discovery and existing chair sound/toast mapping. Occupied chairs remain on the ordinary collision path until occupant reactions are implemented.

Sources: [stage builder](../../../src/chunks.js), [registration](../../../src/campRegistry.js), [live physics](../../../src/physics/liveWorld.js), [static support](../../../src/physics/staticResidency.js).

A separate capacity test found that six matching sling chairs could exhaust one 64-slot geometry/material bucket despite room in the overall pool. [Active rendering](../../../src/physics/activePropRendering.js) now fills existing free slots, then allocates another fixed-size bucket for the same pair within the unchanged aggregate limits. Preflight remains transactional and rejects capacity overflow before touching existing slots. Extra buckets cost extra draws; this fixes usable capacity without claiming a performance improvement.

## Evidence

- [Full checks](check.log) and [isolated production build](build.log) passed. The final added stage-contact test passed in [live tests](live-tests.log).
- [Stage audience tests](../../../bin/test-stage-audience) retain 100 seeded layout/RNG-count checks and the existing audience activity checks. They isolate layout with a registration stub; actual registration is exercised by the live-service tests.
- [Live-service tests](../../../bin/test-physics-live-world) use real stage registration and Rapier. They prove stage chairs are present in collision queries before adoption, move after a cart impact, and survive original-source unload. For each of four styles, eight chairs become physical while a ninth remains visible and collidable; repeated preparation does not churn settled terrain. Regenerating the stage preserves adopted entries and suppresses duplicate source visuals, then teardown returns owned bodies, colliders and render records to zero.
- [Render tests](../../../bin/test-physics-render-adoption) cover one prop spanning buffers, reuse of free slots across matching buffers, bounded rejection without partial writes, bounds/uploads, stale bindings and allocation rollback.
- The real game started through the ready **Just Cruisin’** button near the seeded main stage at `x=-534.43&z=-42.25&heading=0&seed=1977`. [Low diagnostics](stage-low.json) contain five active `stage-chair` identities, no support block and no admission rejects. Captures show [Low day](noon-low.png) and [Mid night](midnight-mid.png); [Low console](console-low.json) and [Mid console](console-mid.json) contain no captured warnings/errors.
- Browser driving automation did not move the cart, so these browser runs prove stage admission/rendering, not a stage impact. Stage impact is covered by the real-engine test. The generic staging shortcut selected a distant campsite when no clear approach through the dense stage row was found; it must not be cited as a stage-impact demonstration.

## Playtest and remaining scope

The verified build is served at port **8767**, including the LAN address `192.168.1.160`, and was checked with HTTP 200 after replacement. Port 8765 had an unrelated Python localhost listener alongside the earlier wildcard-bound Vite server; only the owned Vite session was stopped. The agent verification tab and port-8766 server were closed. The user-requested port-8767 preview intentionally remains running from `/tmp/zerble-stage-build.g6mhxQ`.

Refresh the playtest tab to load this fix. To start directly at the tested stage, use `/?physics=1&mute=1&perf=low&seed=1977&x=-534.43&z=-42.25&heading=0`. Drive manually because the generic staging shortcut can select another venue.

The eight-chair limit, occupied-chair legacy behavior, provisional support-stop and distance-reset policies still apply. Phone feedback, occupied reactions, coolers, cups, signs and aftermath remain unfinished. These tests establish all four styles at the admission ceiling, not a saturated multi-object moving-contact or phone-performance result.
