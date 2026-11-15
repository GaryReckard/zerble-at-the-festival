## Context

The [council result](deliberations/001-next-levers/results.md) freezes production performance changes while capture instrumentation is built. Existing world/render timings do not partition the rest of a frame, and a shorter far-field interval is not sufficient evidence if publication stops altogether.

## Goals / Non-Goals

**Goals:** Attribute measured callback work without changing its execution order, preserve bounded capture storage, record the manual device environment, and prepare a comparable four-run session.

**Non-Goals:** No production optimization, quality-governor tuning, physics/population relaxation, horizon cull, extra rendering pass, device acceptance claim, or reserved-Mac session is authorized by this design alone.

## Decisions

1. Use capture-only instance hooks and a disjoint timing accumulator, with world, render, residual other, physics, people, spatial index, per-kind scans, collisions, bubbles/StarPower, camera, lights, adaptive quality, HUD, and scene matrices. Nested intervals must not be counted twice. Accumulate sums and frame counts across each one-second window and phase/quality grouping rather than treating sub-millisecond Safari samples as independently precise.
2. Pair the interval ending at the current callback with the previous callback's work and quality/phase identity. Preserve negative raw differences or invalid/missing counts as diagnostic evidence; wall-minus-work is unattributed elapsed time, not a GPU timer. Record shader-program changes alongside it.
3. Read lightweight existing physics counters for steps, mean step time, and maximum step time, covering advance and render interpolation hooks. Do not construct actor snapshots every frame.
4. Time the renderer's existing scene matrix update through its instance method. The pinned Three.js renderer already calls `scene.updateMatrixWorld()` at `node_modules/three/src/renderers/WebGLRenderer.js:1150`; an extra pre-render traversal would change the workload and is rejected. Keep the nested matrix cost out of exclusive render time.
5. Attach horizon health observation only for detailed capture after world construction. Serialize supersessions, publication age/progress, and largest units without changing far-field planning, seeded draws, publication scheduling, or defaults.
6. Estimate pre-world title-card callback cadence with a bounded sample and label it an estimate rather than hardware refresh detection. Manual metadata uses the five `perfDevice*` fields documented in the [playbook](../../../docs/performance-playtests.md#four-run-ipad-attribution-session); omissions remain unknown.
7. Keep explicit Low tier in every session arm: Auto quality, locked baseline quality, Auto again, then horizon off. The full `PERF` object for detected tablet Low equals forced Low in a VM check of `src/perf.js`; Auto tier does not mean High. Optional physics-off uses legacy driving and is a confounded supporting check.

## Risks / Trade-offs

- Timer overhead and coarse Safari clocks require sum/count aggregation plus a real matched desktop route overhead check before device use.
- A stale horizon can look cheap, so acceptance requires both bounded stalls and continuing publication, with numeric thresholds recorded before the device session.
- Thermal drift and feedback-controlled route variance require fixed environment notes and the repeated Auto arm.
- Instance hooks must restore cleanly and preserve receiver, arguments, return values, and exceptions. Ordinary play must not allocate detailed capture state.
- No RNG, material, scene ownership, audio-gesture, or pool-disposal change is allowed; Low/Mid and real-game smoke checks remain required.

## Migration Plan

Existing captures remain readable with unavailable fields reported as unavailable. There is no save, seed, or gameplay migration. Do not archive the change while desktop preparation or the device evidence remains pending.

## Open Questions

No immediate human answer is required for instrumentation. The device evidence gates later choices; the Low HUD budget remains unrecalibrated, and any future physics/population relaxation or cull default promotion needs Gary's decision when relevant.
