# Physical festival: first engine proof

October 30, 2026. Branch `codex/physical-festival`, based on `17102a1`.

## What exists

The [playground](../../physical-sandbox.html) runs the game's real chair and cooler models through a pinned `@dimforge/rapier3d-compat` 0.21.0 adapter. Its five scenes cover an empty chair, pair, slope, solid neighbor and closed cooler. Four chair styles, seed, approach speed/angle, slow motion, single step, static reference, day/night and diagnostic overlays make contacts repeatable. The [source baseline](2026-10-30-baseline.md) records the production contracts that integration must preserve.

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

## Acceptance boundaries and next work

Only Task 1.1 (Baseline and compatibility) is complete in the [66-task implementation plan](../../openspec/changes/physical-festival/tasks.md). Other foundation tasks have partial code, but remain unchecked where their full contracts require more evidence.

1. Finish the production fixture contract: real controller adapter, triangulated terrain, bounded admission/residency and production frame barriers. The current cart is a moving box, the slope is a plane, and the static reference does not run legacy contacts.
2. Complete loading/failure and base-path evidence, production pause/ghost/reset integration, and phone measurements before broader content. The adapter's allocation-failure test does not prove network/WASM initialization failure recovery. Joint APIs and iOS synchronous audio unlock are not yet exercised.
3. Implement stable prop keys, instance bindings, registry updates, ownership adoption and approved distance reset before live-world rollout. The fixture deliberately has no streaming and no origin suppression.
4. Obtain Gary's motion feedback, then implement occupied support, bracing/dismount/fall/recovery and the real campsite gate. Cups, signs, social aftermath and articulated cooler lids remain planned work. The isolated cooler is a recipe/engine probe and does not complete the cooler group.

Physical-phone testing is still open. No phone FPS, iOS audio, memory envelope, production-budget or player-feel acceptance is claimed. Gary confirmed that an iPhone or iPad is available. The actual device test and its model, OS and browser record remain pending.
