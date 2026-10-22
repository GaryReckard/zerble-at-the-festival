# First-use post-process preparation

## Outcome

The game now prepares bloom's eight materials and the Trip material during the
title-screen loader, before Start is armed. It compiles the exact live materials
against the composer's render target, waits for shader readiness, then draws
each effect once offscreen into the live composer buffers. This moves shader
linking, initial uniforms, geometry upload and bloom-target allocation before
driving. It adds one-time loading work rather than per-frame work.

The synchronous Start callback, including iOS audio creation/resume, remains
intact. Effect enabled flags and user quality settings are not changed by
preparation. Renderer target, cube face, mip, clear color/alpha, autoClear and
pass screen flags are restored even on failure; temporary compile geometry is
disposed, while the live passes retain their materials and programs. Failed
preparation warns and still enables Start, leaving the ordinary lazy path.
The layout-capture harness skips this GPU work entirely. This matters because
that harness intentionally avoids software-WebGL rendering.

Implementation: [helper](../../../../src/preparePostprocessing.js),
[boot integration](../../../../src/main.js), and
[capture metadata](../../../../src/debug.js). Device reports now include
`session.postprocessPreparation` with ready/failed/skipped status, material
count and loading duration when available.

## Why this targets the tagged stall

The [original phone comparison](../guided-quality-comparison.md#the-tagged-stall)
recorded a 1,045ms render call and a subsequent 1,053ms frame gap. In the same
sample at 112.7 seconds, bloom changed from false to true and program count
rose from 53 to 61, while Trip remained idle. Auto had already disabled bloom
and never hit a comparable one-second gap in its different route.

The isolated real-three.js first bloom draw creates **exactly eight programs**:
a high-pass material, five blur kernels, composite and blend. The shipping
bloom gate enables at dusk once nightness exceeds 0.08, which matches the
transition captured near the felt-lag marker's time of day (0.452). This is a
more specific explanation for the program increase than new chunks alone.
It still does not independently time GPU compilation on the phone, so the
on-device latency reduction requires a repeat capture.

Upstream r160 sources used to verify the pipeline behavior:
[UnrealBloomPass](https://github.com/mrdoob/three.js/blob/r160/examples/jsm/postprocessing/UnrealBloomPass.js)
and [WebGLRenderer.compileAsync](https://github.com/mrdoob/three.js/blob/r160/src/renderers/WebGLRenderer.js).
Compilation uses the composer target because output color space and tone mapping
participate in program selection; compiling against the canvas would prepare
the wrong variants. The real-game checks below verify actual material reuse.

## Measurements on the Mac

These are individual synchronous CPU-side browser probe observations, not GPU
measurements, FPS benchmarks, or predicted iPhone gains. The in-app browser ran
with shader error checks enabled. Driver caches, run order and prior shader
use can affect timing; the program-count assertion is the stronger result.

| Isolated workload | Cold bloom | Prepared bloom | Prepared bloom + Trip |
| --- | ---: | ---: | ---: |
| Materials prepared | 0 | 8 | 9 |
| Preparation duration | 0 ms | 23.5 ms | 146.1 ms |
| Subsequent first activation | 18.3 ms | 0.1 ms | 0.2 ms |
| Programs before activation | 0 | 8 | 9 |
| New programs at activation | 8 | **0** | **0** |

Raw results: [cold](cold.json), [prepared bloom](prepared.json),
[prepared bloom and Trip](prepared-trip.json).
These independent runs do not isolate the incremental preparation cost of
Trip, so their preparation durations should not be subtracted as an effect cost.

## Verification

`npm run check` exited zero on the final code. [Full output](check.log).
The new dynamic test covers exact material ownership, asynchronous waiting,
offscreen draws, failure cleanup, renderer-state restoration, unchanged pass
policy, and the real boot block's wait/skip/failure behavior. The device-capture
serializer regression covers the new preparation metadata. All four importmaps
include the helper and pass `bin/check-importmaps`.

The real game booted on Low, Mid and High with shader error checks enabled.
The harness uses the official `__dbg` door for day, dusk and Trip. Every one of
the nine effect materials retained exactly one program variant across those
transitions. Total scene programs can still increase as unrelated scene
materials first render; no blanket scene-prewarm claim is made. Mid and High
also started through the real mode button, and the final Low build passed the
same mode-button smoke check. Console checks returned no JS/shader errors;
debug-only slow-chunk warnings were present during initial world generation.

Saved results: [Low](game-low.json), [Mid](game-mid.json), [High](game-high.json).
High-tier visual checks cover [Noon](high-noon.png) and [Midnight](high-midnight.png).
Preparation took 22/21/23ms in those respective isolated game boots. These are
local observations, not a startup budget promise for other devices.

## Repeat the probes

Use the existing no-cache server and open:

- `check.html?perf=low&mute=1` in this directory: press cold, then prepared. Add
  `trip=1` to include the Trip pass. Each bounded probe disposes its renderer,
  pass resources and targets in finally, and a prepared activation fails if
  it creates additional programs.
- `game.html?perf=low&mute=1`: press the activation check. Repeat with Mid and
  High. It checks preparation status and per-effect program variants, and has
  Noon/Midnight controls for visual inspection. Close its tab after testing to
  stop the embedded game's frame loop.

All temporary test tabs were closed, and no new server or standalone browser
process was launched for this work. The pre-existing localhost server remains.

## Device acceptance still open

Repeat Low Sustained through first dusk and a first Trip on the iPhone. Verify
`session.postprocessPreparation.status = ready` and `materials = 9`, then compare
the first-effect frame work, new-program counts and felt lag. The shipping
Auto thresholds have not been changed by this fix. The code addresses the
known cold post-process path; other streaming, scene-shader, shadow and
scheduling stalls remain separate measurements.
