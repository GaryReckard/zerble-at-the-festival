# Desktop Auto rendering load and chair damage, November 2, 2026

Gary reported about 15 FPS on desktop Auto, then clarified that this was before selecting Low. Read-only inspection of his existing Low-tier Chrome session observed 34–46 FPS, roughly 1,400–1,600 scene draws and 0.1–0.2 ms player physics steps. These reads were not a capture of the reported 15 FPS interval. No existing browser processes were stopped.

## Rendering isolation

The opt-in [scene probe](../../../src/sceneProbe.js) reused the development server on port 8765. A separate muted in-app tab started through the normal Just Cruisin' title button. The probe parked gameplay and pinned the same quality baseline while comparing detailed bubbles, simpler bubbles, then simpler bubbles without shadow rendering. Each phase discards ten warm-up renders and samples thirty main-scene renders. It reports renderer CPU duration, scene submissions and actual draw families. These initial runs predate the GPU timer extension below and do not measure GPU time or device FPS.

Both saved runs used High, viewport 1280×720 at DPR 2, seed 2404796662 and the same cart position, approximately (-230.30, -691.80). Live crowd and parade state differed between runs, so compare the material phases **within each run** for causal evidence; do not interpret the raw between-run draw difference as a controlled FPS improvement.

| Run and material | Scene draws | Triangles | Renderer CPU median / p95 |
| --- | ---: | ---: | ---: |
| Before, refractive detailed bubbles | 4,588 | 1,727,596 | 28.2 / 41.3 ms |
| Before, simpler bubbles in the same parked scene | 2,334 | 878,904 | 9.0 / 10.8 ms |
| After, detailed alpha shells | 2,654 | 1,045,390 | 10.3 / 11.7 ms |
| After, simpler bubbles in the same parked scene | 2,654 | 1,045,390 | 9.9 / 10.7 ms |

Raw results: [before.json](before.json), [after.json](after.json). Disabling shadow rendering after the bubble swap made a smaller change in this scene, about one millisecond of median renderer CPU. Ordinary main-scene counters do not include all shadow submissions, so their unchanged totals are not evidence that shadows are free.

The former `MeshPhysicalMaterial.transmission` requested a scene-wide refraction pass for a single instanced particle mesh. Detailed bubbles now keep physical iridescence and sheen, but use ordinary alpha transparency with no depth writes. The real Three.js render-list regression in [test-bubbles-visibility](../../../bin/test-bubbles-visibility) requires both material choices to stay out of the transmissive queue, while retaining ordinary transparency and particle lifetime behavior. [Noon](noon-after.png) and [Midnight](midnight-after.png) captures record gameplay appearance. Low and High normal title-click smoke tests cover boot and console inspection.

## Diagnostic cleanup

`?sceneProbe=1&mute=1` exposes the measurement button only on localhost. Its temporary render callbacks, frame requests and deadlines restore on completion, exception, timeout and page exit, along with the prior material, quality and pause state. [test-scene-probe](../../../bin/test-scene-probe) exercises all those paths, including an initially paused game. Temporary browser tabs were closed, and no standalone browser or development server was started.

## Follow-up capture and crowd CPU

Gary's [75-sample pasted log](desktop-log.json) contains two intervals separated by a long gap and reset world/program counters. The first interval, `t=0–50.4`, records 31–61 FPS and 75–124 adults. The later interval, `t=1231–1255.5`, records 6–15 FPS, median 14, with 312–386 adults, shadows on and higher render resolution. All later average/p95/max frame fields are zero, and every `frame` field is null; those fields do not locate the remaining cost. Governor frame statistics can be unavailable while its observation window is warming or reset. This log establishes a persistent later slowdown, not a controlled Low-versus-High comparison.

The diagnostic was extended with bounded [WebGL GPU timer queries](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/), which measure asynchronous GPU duration and reject disjoint results. In Gary's actual Chrome at 2311×1134, DPR 1.6, a parked High scene measured median main-scene renderer CPU of 20.1 ms and composer GPU time of 14.6 ms. Simpler bubbles measured 18.7/13.1 ms; additionally disabling shadows measured 18.6/13.1 ms. CPU and GPU durations overlap and must not be added. See [chrome-gpu.json](chrome-gpu.json). These results motivated measuring the game update rather than further graphics changes.

The existing real-game people baseline then recorded about 70.4 ms per frame inside `crowd.update`, 2.5 ms in child updates and 10.3 ms across renderer calls, with 303 adults. Median accepted-frame work was 86.8 ms and median wall interval 87.7 ms. This reproduced a slow frame budget on the current source even after the bubble refraction fix. [chrome-cpu-before.json](chrome-cpu-before.json) retains the full profile.

The dancefloor test in [crowd.js](../../../src/crowd.js) checked `canReachPlace` before checking the nine-metre dance radius. With terrain support, reachability sweeps the entire route and footprint. The fix rejects stages outside the dance radius first. A second change skips the hard-separation support move when its correction is exactly zero; the ordinary velocity move still checks support every frame, while nonzero overlap corrections retain their own validation.

The distance-only intermediate profile, [chrome-cpu-after-stage.json](chrome-cpu-after-stage.json), retained 307 adults at the same High baseline and viewport. Adult updates averaged 14.3 ms per frame; median work/wall interval were 27.0/27.4 ms. No actor population or graphics tier was reduced. The samples have live people, so they are instrumented before/after evidence, not a deterministic motion replay.

Immediate NPC movement now uses a synchronous support `move`, retaining the full swept route and footprint while avoiding the second validation needed by a held proposal. Separate `propose`/`commit` callers still revalidate. The support regression compares both paths across bridge approaches and exits, proves half the terrain sampling, and checks blocked movement and stale-world rejection.

All four profiles pin High at quality level zero, use the same seed, position and 2311×1134 viewport at DPR 1.6, warm up for 120 frames, and measure 180 accepted frames. Every report confirms the probes were restored. Live NPC activity and browser warm state vary; the smaller changes have **no separately demonstrated frame-time gain**.

| Source state | Adults | Adult update average | Frame work median / p95 | Wall interval median / p95 |
| --- | ---: | ---: | ---: | ---: |
| [Before crowd fixes](chrome-cpu-before.json) | 303 | 70.4 ms | 86.8 / 93.7 ms | 87.7 / 96.7 ms |
| [Stage distance guard](chrome-cpu-after-stage.json) | 307 | 14.3 ms | 27.0 / 33.8 ms | 27.4 / 34.3 ms |
| [Plus zero-correction skip](chrome-cpu-after-separation.json) | 306 | 16.4 ms | 30.7 / 35.0 ms | 31.4 / 35.4 ms |
| [Final, including immediate support move](chrome-cpu-after.json) | 307 | 17.4 ms | 30.9 / 35.5 ms | 31.7 / 36.6 ms |

The final run includes one 346.5 ms frame, with a 323.2 ms renderer call. The raw report retains that stall; the change does not establish stall-free driving or 60 FPS. The [final High screenshot](chrome-high-final.png) records the running scene, and its console had no errors. All temporary comparison tabs were closed, without changing Gary's existing game tab.

[test-dancefloor-reachability](../../../bin/test-dancefloor-reachability) verifies that distant stages perform no reachability sweeps, preserves the strict nine-metre boundary, rejects a nearby stage on another floor, accepts a reachable alternative, clears dancing on departure, retains actual supported movement, and still validates nonzero hard-overlap correction. One temporary Chrome inspection timed out and its test tab was closed before retrying; no existing user tab or process was killed. A debug launch at the pasted final coordinates was rejected by footprint support, so profiling used the previously validated dry point (-230.3, -691.8), not that exact route endpoint.

## Chair impacts

`VehicleCondition` applies 6% of solid-obstacle damage to `chair`, `camp_chair` and `camp_loveseat`, capped at three meter points per incident. The live owner resolves the kind from both static proxies and adopted dynamic furniture. Simultaneous contacts select the largest resulting damage, retaining the full consequence of a harder obstacle or landing. Tests cover all three static chair kinds, a real adopted dynamic chair, and a matching tree impact of about 59 points. Repeated contact still cannot drain condition while parked.

## Limits and remaining acceptance

`npm run check`, `npm run build`, and the added render-probe lifecycle regression passed. The bubble render-path test uses actual Three.js queue classification, and chair tests use the real Rapier solver. After the crowd changes, High in Chrome and Mid/Low in the in-app browser passed normal ready-title clicks, live support initialization and console checks; no console errors were captured, and every temporary test tab was closed.

The intervention removes a verified duplicate rendering cost and expensive distant-stage support sweeps without forcing a lower tier or changing physics cadence. Gary still needs to retry desktop Auto and report actual frame delivery. Remaining draws in the recorded High scene include hundreds of child-model and nearby-world submissions. A further optimization should follow measurements if those remain limiting. These desktop observations do not establish iPhone/iPad performance or subjective acceptance of the changed bubble appearance.
