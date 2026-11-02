# Rotation-safe support and starvation regression

October 30, 2026, following the [per-step support guard](../2026-10-30-frontier/README.md).

## What changed

The support guard previously used the last published horizontal footprint. A chair can rotate between publications and extend beyond that footprint. Chair admission now computes a fixed radius from the scaled bounds of both the rendered parts and collision recipe. A sphere centered on the body's origin with that radius contains those bounds at every rotation. Support preparation and the per-step guard use this radius; ordinary live registry avoidance retains its tighter current-orientation footprint.

Sources: [chair ownership](../../../src/physics/chairOwnership.js) and [live service](../../../src/physics/liveWorld.js).

## Verification

- [Full repository checks](check.log) passed. [The production build](build.log) passed into a separate temporary output directory, preserving Gary's already running playtest build.
- [Chair ownership tests](../../../bin/test-physics-chair-ownership) exercise sling, director, low and loveseat models with nonuniform scale, checking 32 orientations per style. The bound contains every transformed collision-box corner before pose publication and the resulting published visual footprint afterward; its radius remains constant.
- The added [starvation test](../../../bin/test-physics-live-world) passed in a [separate run](starvation.log): a 60 m/s accepted cart trajectory hits a real Rapier chair while every later preparation call has an expired deadline. The service reaches `support-frontier`, keeps the chair inside its initial eight-metre window, and retains its exact position for 30 more presentation frames. Sixty frames with preparation restored resume simulation and retain one owned chair. This is an adversarial controller trajectory, not a claim that the production cart normally drives at that speed.
- The isolated build started through the real **Just Cruisin’** ready button, then staging and coasting registered one impact. [The report](impact.json) contains four active chairs, no support block and zero admission rejections. Their support radii range from approximately 2.02 to 2.36 metres and exceed their current horizontal footprints. [Captured console output](console.json) is empty.
- The isolated test tab closed and its port-8766 preview stopped with exit 130. Gary's port-8765 playtest preview remains running, unchanged.

## Boundaries and next steps

This proves the conservative orientation bound and one real-engine starvation/resumption scenario. It does not prove arbitrary within-step impact containment, maximum-capacity multi-object behavior, new scenery overlap reconciliation, or independent motion for unrelated objects while another needs support. The global stop remains provisional. Device measurements and motion feedback remain pending, as do occupied-chair reactions, cooler articulation, cups, signs and aftermath.

Continue with sustained multi-object support pressure and the final overload policy before treating the support contract as complete. Preserve the playtest server/build until Gary has finished testing.
