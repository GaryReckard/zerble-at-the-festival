# Physical festival: first engine proof

October 30, 2026. Started on `codex/physical-festival` at `17102a1`; continued on `codex/physical-festival-integration` at `4aa8d47`, which combines the photographer baseline with startup recovery.

The [prop response checkpoint](2026-10-30-prop-feedback/README.md) separates simulated-chair slowdown from the person-hit reverse kick. The [fixed-object checkpoint](2026-10-30-solid-response/README.md) also removes the reverse kick for legacy scenery. The [cooldown checkpoint](2026-10-30-cooldown/README.md) keeps solids collidable during penalty immunity. The [approved object policy](2026-10-30-object-policy/README.md) removes smile penalties and punitive feedback for empty objects. Occupied reactions and phone acceptance remain unresolved.

The [closed-cooler checkpoint](2026-10-30-cooler/README.md) adds independent cooler collision and bounded live adoption, with a recorded production impact. Gary gave positive early chair-motion feedback; device and full occupied-person acceptance remain open.

The [person reaction boundary](2026-10-30-reaction-boundary.md) adds and tests guarded ordinary-person claims; visible falls and occupied-support transfers remain unfinished.

## Latest production checkpoint

The [occupied-seat load proof](2026-10-30-supported-loads.md) verifies independent
loveseat weights and continuous release velocity in real Rapier. Live occupied
chairs and fall/recovery remain unfinished.

The [bounded hinge proof](2026-10-30-joints/README.md) verifies the adapter contract needed for the later cooler lid experiment; no articulated cooler is enabled yet.

The [stage-chair fix](2026-10-30-stage/README.md) adds missing stage-audience collisions and physical descriptors, and makes all eight admission slots usable with repeated chair styles.

The [rotation follow-up](2026-10-30-rotation/README.md) reserves each chair’s full rotational reach and tests a real-engine support-starvation/resumption sequence.

The [support follow-up](2026-10-30-frontier/README.md) adds bounded forward preparation and a per-substep guard, with tests and a fresh live encounter. Final overload behavior remains open.

The [live empty-chair checkpoint](2026-10-30-live/README.md) now connects opt-in adoption, origin suppression and the main game contact barrier, with a captured physical impact and existing smile feedback. The sections below retain the earlier foundation history; statements about missing integration describe those earlier checkpoints. Final frontier/reset behavior, occupied encounters and phone acceptance remain open.

## What exists

The [playground](../../physical-sandbox.html) runs the game's real chair and cooler models through a pinned `@dimforge/rapier3d-compat` 0.21.0 adapter. Its six scenes cover an empty chair, pair, slope, sampled production terrain, solid neighbor and closed cooler. The cart now uses the real Zerble controller with a conservative kinematic hull. Four chair styles, seed, approach speed/angle, slow motion, single step, static reference, day/night and diagnostic overlays make contacts repeatable. The [source baseline](2026-10-30-baseline.md) records the production contracts that integration must preserve.

The [adapter](../../src/physics/rapierAdapter.js) privately owns engine objects, bounds its diagnostic queue, copies exposed data and rolls back failed admission. The [runtime](../../src/physics/runtime.js) consumes accepted deltas through a fixed clock and exposes explicit disposal. The [playground lifecycle](../../src/physics/playground.js) owns listeners, animation, renderer and fixture cleanup while preserving shared model assets. The main game's initial static bundle graph excludes Rapier, as asserted by [the toolchain test](../../bin/test-toolchain.mjs).

## Reproduce

Run `npm run dev`, then open `/physical-sandbox.html?mute=1&perf=low&fixture=chair&seed=1977`. Select Run encounter. Change speed/angle and reset to compare; the report records replay inputs. Open Inputs, contacts, and limits to copy the report or Dispose scene. Run `npm run test:physics` for the actual-engine tests.

## Verified evidence

| Check | Result and scope |
| --- | --- |
| Repository checks | `npm run check` passed, including adapter and runtime tests; [saved output](2026-10-30/check.log). |
| Production build | `npm run build` passed; [saved output](2026-10-30/build.log). Bundle-size warnings remain, including the approximately 4.34 MB raw / 1.67 MB gzip compat engine chunk. |
| Build isolation | `node bin/test-toolchain.mjs` passed after adding the physics-entry and main-graph isolation assertions; [saved output](2026-10-30/toolchain.log). |
| Actual engine | [Adapter tests](../../bin/test-physics-adapter) cover support, compound primitives, kinematic transfer, event distinctions, overflow, admission failure/rollback, 100 removal cycles and 12 world disposals. The fast-body test proves containment and CCD wiring, not CCD causality: its no-CCD control also stops. |
| Fixed clock and fixtures | [Runtime tests](../../bin/test-physics-runtime) cover equivalent 30/60/120 Hz presentation, capped suspension, 23 fixture runs, copied state, capacity rejection, single-step presentation and idempotent teardown. |
| Desktop development | Real Chrome: empty chair impact and cooler; Low Noon/Midnight and collision overlay; no captured console errors. [Noon](2026-10-30/cooler-noon-low.png), [Midnight](2026-10-30/cooler-midnight-low.png). |
| Desktop production | Real Chrome production preview: loveseat pair at Mid, Noon/Midnight, run and pause; no captured console errors. [Noon](2026-10-30/pair-noon-mid.png), [Midnight](2026-10-30/pair-midnight-mid.png), [report](2026-10-30/pair-production-report.json). |
| Reset/cleanup | Three cooler resets returned 4 bodies, 9 colliders, 25 draws, 1,874 triangles and 10 geometries. [Reset counters](2026-10-30/reset-counters.json). Explicit disposal returned owned body/collider counts to zero and disabled the fixture, RAF and listeners, emptied render objects/scene children and released the renderer. [Disposed report](2026-10-30/disposed-report.json). Shared caches are retained intentionally; this does not prove total process memory reclamation. |
| Real game boot | Development and production preview at Low: waited for ready mode buttons, clicked Just Cruisin', observed active HUD/map and no captured console errors. [Built game](2026-10-30/production-game-low.png). This is a boot smoke test, not new production physics acceptance. |

These browser samples are observations, not controlled benchmarks. The production pair report includes 313.6 ms cold fixture allocation, a 127 ms maximum step and about 0.404 ms mean step over 1,474 steps. Initialization/JIT and browser scheduling were not isolated; use these numbers to design the next measurement rather than approve a budget. The last displayed 0.20 ms step is not a percentile. CPU pose writes are not GPU upload measurements.

Browser verification used owned tabs in Gary's real Chrome and no standalone headless WebGL sessions. Task-owned browser tabs and development/preview servers were closed afterward. A Playwright locator timeout was resolved through the native accessibility controls; no application error was observed.

## Controller and terrain follow-up

The integration branch adds the real cart controller and exact production-terrain triangles. `bin/test-physics-terrain` checks sampled triangle interiors, non-flat negative controls, adjacent seams, disabled terrain and bounded allocation. `bin/test-physics-controller` runs actual controller/solver contact at 30/60/120 Hz with flat and enabled terrain, verifies presentation isolation, and checks owned body/mesh cleanup. The test supplies `window.performance` because Rapier uses the browser timing API when a window exists; its absence in a Node browser stub caused an independently reproduced one-ball WASM panic.

The full [repository check](2026-10-30-controller/check.log) and [production build](2026-10-30-controller/build.log) passed. Real Chrome production preview ran seed 1977 around world coordinate (650, 210), with the cart striking the chair and the chair eventually sleeping. Captures cover [Low Noon](2026-10-30-controller/terrain-noon-low.png), [Low Midnight](2026-10-30-controller/terrain-midnight-low.png), [Mid Noon](2026-10-30-controller/terrain-noon-mid.png) and [Mid Midnight](2026-10-30-controller/terrain-midnight-mid.png). No console errors were captured. The conservative hull and final cart position can partly obscure the fallen chair from the default camera; these images do not constitute a feel approval.

The [Low report](2026-10-30-controller/terrain-controller-report.json) records 3 bodies, 8 colliders, 25 mesh vertices, 32 triangles, 261 draws and 30,337 rendered triangles. Cold total allocation was 797.8 ms, of which 203.1 ms was fixture/engine allocation; the difference includes model preparation. The 133 ms maximum step includes uncontrolled cold/JIT effects. These are diagnostics, not a phone budget or steady-state benchmark. [Explicit teardown](2026-10-30-controller/disposed-report.json) returned owned bodies, colliders, mesh storage, render objects and scene children to zero, stopped the loop/listeners and reported no cleanup errors. Shared resources remain retained by their normal owners. The [main game](2026-10-30-controller/production-game-low.png) also booted through its ready Just Cruisin' button with no captured errors. The owned browser tab and preview server were closed afterward.

The cart bridge now treats teleport, rescue, restart, tier change, legacy correction and dropped time as named discontinuities. [Cart-proxy regressions](../../bin/test-physics-cart-proxy) verify that they do not sweep through intervening props. A bounded direct-shape query works while the cart is disabled and uses current body poses, including before a solver step. Ghost expiry holds contacts disabled until clearance is established, then clears stale targets/velocity before reenabling. Unknown or exhausted query results keep contacts disabled. The actual-controller test includes both a slower cart that stops overlapping the chair and a faster cart that clears it. The fixture exposes this through Cart ghost mode; the main game's star, rescue and legacy contact calls are not yet connected. A [built-browser overlap report](2026-10-30-controller/ghost-overlap-report.json) confirms ghost expiry waits while the real cart remains inside the chair, leaving the chair within 2 mm of its original horizontal position. The final build passed the full repository checks and a fresh ready-button game boot with no captured console errors; the owned tab and server were closed.

## Bounded preparation and chair instance bindings

The next foundation adds three production-facing modules, without yet enabling live-world physical enrollment:

- `terrainResidency.js` owns bounded exact terrain tiles. A replacement support request reserves capacity first and retains old support until every new tile is ready; overlapping owners share tiles. The caller supplies the existing streaming deadline and a maximum creation count. Real-engine tests cover enabled/flat seam landings, capacity rejection, retries, source changes and repeated cleanup.
- `admissionBudget.js` reserves both resident resources and future mandatory releases. Optional allocations cannot take the sitter/cup reserve; release consumption changes the accounting category without increasing the total. Tests cover a loveseat with two sitters and two cups, saturation, fail-atomic changes, stale generations and 10,000 cleanup cycles.
- `propRendering.js` retains immutable local part transforms and instance slots while campsites continue sharing geometry/material buckets. The campsite builder exposes semantic fire/canopy chair slots without new RNG draws. The moving-chair fixture now uses these same bindings. Tests compare original world matrices for all four styles, moved/rotated/scaled parents, neighboring slots, conservative bounds, bounded upload ranges, copied descriptors and shared-safe teardown. Uploaded-byte reports describe requested CPU buffer ranges, not measured GPU transfer cost.

The [full check](2026-10-30-residency/check.log) and [production build](2026-10-30-residency/build.log) passed. Browser checks covered the moving batched loveseats at [Low Noon](2026-10-30-residency/pair-batched-noon-low.png) and [Low Midnight](2026-10-30-residency/pair-batched-midnight-low.png), plus the real campsite builder at [Mid Noon](2026-10-30-residency/camp-noon-mid.png) and [Mid Midnight](2026-10-30-residency/camp-midnight-mid.png). The [settled report](2026-10-30-residency/pair-batched-report.json) records zero requested matrix bytes for unchanged poses. With cart rendering hidden and bounds enabled it reports 11 draws and 914 triangles; this is not comparable to earlier cart-visible captures. The scene shows visible intersections between the settled loveseat meshes, so collision recipe/feel acceptance remains open. [Teardown](2026-10-30-residency/disposed-report.json) returned scene objects and owned simulation resources to zero without cleanup errors. The [real game](2026-10-30-residency/production-game-low.png) started through the ready Just Cruisin' button. No console errors were captured; the owned tab and preview server were closed.

Live body admission, registry/canonical-clearance publication, owner adoption and frontier enforcement still need to connect these primitives. In particular, the residency manager does not autonomously stop a body leaving its retained support; the physical owner must request and confirm support ahead of motion.

## Canonical placement and independent render ownership

The [ownership checkpoint](2026-10-30-ownership/README.md) adds stable campsite descriptors, generation-safe registry publication and transfer, a capped independent render pool, and the shared world preparation deadline. The placement regression tests preserve neighborhood and forest-owner exemptions even after adoption. These components pass the full check suite and production build; a real ready-button Low game boot has no captured warnings/errors. They are not yet connected to live physical activation or origin-regeneration suppression.

## Acceptance boundaries and next work

Only Task 1.1 (Baseline and compatibility) is complete in the [66-task implementation plan](../../openspec/changes/physical-festival/tasks.md). Other foundation tasks have partial code, but remain unchecked where their full contracts require more evidence.

1. Finish the production fixture contract: real controller adapter, triangulated terrain, bounded admission/residency and production frame barriers. The controller and bounded triangulated terrain now run in the fixture; streaming admission and production contact barriers remain incomplete. The separate slope scene is a plane, and the static reference does not run legacy contacts.
2. Complete loading/failure and base-path evidence, production pause/ghost/reset integration, and phone measurements before broader content. The adapter's allocation-failure test does not prove network/WASM initialization failure recovery. Joint APIs and iOS synchronous audio unlock are not yet exercised.
3. Implement stable prop keys, instance bindings, registry updates, ownership adoption and approved distance reset before live-world rollout. The fixture deliberately has no streaming and no origin suppression.
4. Obtain Gary's motion feedback, then implement occupied support, bracing/dismount/fall/recovery and the real campsite gate. Cups, signs, social aftermath and articulated cooler lids remain planned work. The isolated cooler is a recipe/engine probe and does not complete the cooler group.

Physical-phone testing is still open. No phone FPS, iOS audio, memory envelope, production-budget or player-feel acceptance is claimed. Gary confirmed that an iPhone or iPad is available. The actual device test and its model, OS and browser record remain pending.
