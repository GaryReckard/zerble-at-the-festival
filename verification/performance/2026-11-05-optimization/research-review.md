# External research assessment, November 5

Gary supplied `zerble-optimization-deep-research-report.md` from Downloads.
It is input for investigation, not an implementation instruction or measured
evidence about this build. Its source descriptions contain no clickable source
URLs, and its expected gains cannot be accepted without locating and checking
the underlying evidence.

## Useful experiments to retain

| Direction | How to adapt it to Zerble | Evidence and limitation |
| --- | --- | --- |
| Spatial instancing and selective batching | Use the subtraction result and actual draw families to select a repeated family; preserve spatial visibility and per-owner unload. | [Existing real-GPU merge rejection](../../../docs/backlog/performance.md) means fewer scene nodes alone are insufficient. [Child topology](kid-topology.json) is a lead, not an actual draw measurement. |
| Instanced visual detail | Use projected size from the active camera, with stable thresholds and tested chase/first-person/top-down switches and zoom. | The [camera](../../../src/camera.js) supports substantially different viewpoints. Distance from the cart is insufficient to decide what the player sees. |
| Smaller construction tasks / workers | Attribute current stalls first, then split the measured main-thread builder. Retain synchronous collision truth and versioned/cancellable visual admission. | [LandscapePlanner](../../../src/landscape/planner.js) already owns a bounded worker; moving everything to a worker would duplicate existing work and cannot move scene mutations off-thread unchanged. |
| Cheap visual representations | Test a measured expensive material family, compare Noon/Midnight and all camera modes, and retain recognizable shapes and lighting cues. | [Low's shim](../../../src/threeShim.js) already replaces Standard with Lambert. Any unlit/MatCap proposal must improve on that existing policy and the live day/night contract. |
| Resolution sensitivity | Change only actual physical render-target dimensions, recording both renderer and composer sizes. | [Low](../../../src/perf.js) already caps pixel ratio at 1.25 and [adaptive quality](../../../src/adaptiveQuality.js) can scale further. A blanket cap of 2 would not reduce the Low baseline. |

## Corrections before using the recommendations

- `Math.ceil` is not a replacement for `Math.abs`: for example, their results
  for `-1.5` are `-1` and `1.5`. Avoiding a repeated query or unnecessary work
  is a valid investigation; changing arithmetic semantics is not a safe generic
  optimization. The report's Safari timing anecdote has no source URL or local
  reproduction.
- `renderer.info.render.frame` is a counter, not a GPU duration, and
  `renderer.info.memory.textures` counts textures rather than their bytes.
  See the pinned [Three r160 WebGLInfo implementation](https://github.com/mrdoob/three.js/blob/r160/src/renderers/webgl/WebGLInfo.js)
  and [texture-allocation counter](https://github.com/mrdoob/three.js/blob/r160/src/renderers/webgl/WebGLTextures.js#L297).
  Our [scene probe](../../../src/sceneProbe.js) uses asynchronous GPU queries
  where supported and reports unavailable/disjoint results honestly.
- An iPad simulator or desktop viewport does not establish performance on
  Gary's older physical iPad. Use desktop experiments to attribute cost and
  retain a real-device Safari acceptance check.
- KTX2 is not a demonstrated priority here. Representative materials use
  [palette colors](../../../src/models/kid.js), procedural
  [road DataTextures](../../../src/roadMaterials.js) and generated
  [sign CanvasTextures](../../../src/models/sugarShack.js). Measure actual
  texture dimensions/formats/bandwidth before adding an asset pipeline.
- Halving player physics frequency changes collision and handling behavior;
  it needs evidence of a physics bottleneck and its own behavioral proof.
  The [earlier desktop inspection](../2026-11-02-render-load/README.md) observed
  player physics steps around 0.1–0.2 ms, so it does not justify that shortcut.
- LOD can add draw buckets and transition/CPU costs; crossfading also draws
  both representations. Both need measurement rather than an assumed free win.

The report strengthens the experiment menu, but its ranked list does not
override current measurements. First use controlled subtraction and active-loop
profiling, then choose the intervention that addresses the measured limit.
