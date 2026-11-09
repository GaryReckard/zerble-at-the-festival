# Actor simulation and render presentation source map

Read-only source investigation, November 7, 2026. No browser, server, benchmark, or test suite was launched, and no runtime file was edited. These are code-grounded candidates for measurement, not measured speedup claims.

## Current pipeline

- The main loop dispatches vehicles, adults, formations, children, roaming, relationship, performers, late activities and cooks in explicit phases, with smile collection and seating/publication boundaries between them (`src/main.js:1465`, `src/main.js:1472`, `src/main.js:1501`, `src/main.js:1524`).
- PeopleRuntime is an ownership/capability dispatcher, not simulation storage or an independent timer scheduler. Each slot executes only once per accepted frame, receiving the accepted delta (`src/people/runtime.js:1`, `src/people/runtime.js:44`, `src/people/runtime.js:51`).
- Adults already use instanced body-part meshes and per-instance appearance/pose attributes (`src/crowd.js:234`, `src/crowd.js:438`, `src/crowd.js:466`). Their separation grid is rebuilt once per frame before the all-live-NPC update (`src/crowd.js:905`, `src/crowd.js:916`). Generic adult instancing or broadphase proposals would repeat existing work.
- Adult batches deliberately disable frustum culling because a stale whole-batch sphere previously hid moving people while collision/smile behavior continued. Draw counts follow the highest occupied slot rather than camera-visible membership (`src/crowd.js:511`, `src/crowd.js:941`).
- Child draw submissions already use instanced buckets, but the complete source rigs remain in the scene with their mesh layers disabled. Every render scans/culls/copies individual part transforms and computes current batch bounds (`src/people/childPresentation.js:24`, `src/people/childPresentation.js:34`, `src/people/childPresentation.js:48`, `src/people/childPresentation.js:69`). This is draw batching, not removal of the original rig-transform workload.
- Children are grounded before bubble interactions, perform targeting and behavioral movement, solve hard separation with world reprojection, then ground again, animate and publish final colliders (`src/people/children.js:228`, `src/people/children.js:278`, `src/people/children.js:415`, `src/people/children.js:461`).

## Candidate 1: deterministic spatial child contact solver

The current solver checks every child pair for as many as 128 passes and reprojects against lake shores and hard colliders after each pass (`src/people/children.js:415`, `src/people/children.js:446`). At 50 children, the loop bound permits 156,800 pair checks before world queries. **This arithmetic is an upper bound, not evidence that real runs reach it.** Measure actual passes, pair checks and world reprojections, especially during parked bubble convergence, before selecting this path.

A structural extraction into a deterministic contact solver could prune impossible pairs without reducing population or interaction fidelity. Exact equivalence is demanding because both participants move during the scan. A once-per-pass neighbor list can become stale, and changing correction order can change settled positions. Stable pair-index directions already handle coincident children (`src/people/children.js:420`, `src/people/children.js:434`). Any broadphase needs immediate membership maintenance and ordering rules that retain the original sequential projection behavior, or an explicitly validated behavior change.

## Candidate 2: compact child poses with direct presentation

Replace the retained source scene rigs with compact pose data and direct body-part matrix generation, while keeping gameplay identity and behavior separate. This goes beyond the existing child draw batching because the current implementation derives instance transforms from every original Object3D (`src/people/childPresentation.js:24`, `src/people/childPresentation.js:48`, `src/people/childPresentation.js:98`).

Risks include pose equivalence, transformed parents, changed materials/layers and shadow silhouettes. Current presentation retains offscreen shadow casters because camera and light frusta differ (`src/people/childPresentation.js:89`). `bin/test-child-presentation:11`, `:36`, and `:65` already provide seeded rigs, transformed-parent matrix equivalence, animated bounds, perspective/orthographic cameras, shadow retention, RNG checks, fallback and disposal coverage.

## Candidate 3: separate adult identity from spatial draw publication

Create a dedicated presentation layer that keeps stable actor handles separate from camera-relevant draw slots or spatial batches. Adults currently write several part matrices per actor, while global instance batches remain uncullable (`src/crowd.js:1820`, `src/crowd.js:1907`, `src/crowd.js:511`).

This needs evidence of substantial upload, vertex or shadow cost before selection. Spatial batches may increase draw calls; compacting matrices without the matching appearance/pose attributes would corrupt people. The rewrite must not repeat the documented invisible-crowd failure, and off-camera simulation cannot disappear.

## Existing optimizations and controls

- Rendering already uses tier-specific MSAA versus FXAA (`src/main.js:285`, `src/main.js:361`), adaptive resolution/effect rungs (`src/adaptiveQuality.js:73`), dusk/star-power bloom gating (`src/main.js:1925`) and distance-gated prop animation (`src/main.js:1535`). Generic suggestions to lower these effects mostly repeat existing controls.
- Crowd caps are 180/320/500 and shadows are tier-dependent (`src/perf.js:99`, `src/perf.js:171`, `src/perf.js:203`).
- Render subtraction isolates adult, child, other-person, world, vehicle and effect families, restoring visibility in finally. It is explicitly attribution rather than an equal-content optimization comparison (`src/renderSubtraction.js:3`, `src/renderSubtraction.js:25`).
- Child presentation has a local individual-rendering control through kidBatch=0, and a debug presentation toggle (`src/main.js:743`, `src/main.js:2367`).

## Behavior and verification constraints

Arbitrarily lowering simulation frequency risks changing global random draws at state transitions and the timing/order of smile or collision effects (`src/people/children.js:374`, `src/people/children.js:461`). Off-camera visibility must not determine simulation truth. The landscape adapter already uses an atomic support move to avoid duplicate immediate proposal validation while retaining the complete footprint sweep (`src/landscape/peopleAdapter.js:25`); a rewrite must not replace that with a weaker height-only check.

Reusable verification surfaces include the child presentation matrix/geometry oracle, PeopleRuntime ownership/ordering tests, people frame traces, the current people baseline/render inventory, and render subtraction. Relevant files are `bin/test-child-presentation`, `bin/test-people-runtime`, `bin/test-people-frame-trace`, `bin/test-children-ownership`, `bin/test-people-grounding-cost`, `src/people/baseline.js`, and `src/renderSubtraction.js`.
