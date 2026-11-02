# Predictive support and fixed-step guard

October 30, 2026. Follow-up to the [live chair checkpoint](../2026-10-30-live/README.md), on `codex/physical-festival-integration`.

## Change and reason

The live service previously checked velocity once before a presentation frame. A contact during one fixed step can change that velocity before another fixed step in the same frame. It now checks committed support before each step, and the clock discards rejected time rather than replaying a catch-up burst after preparation resumes. Completed steps still publish their solved poses.

Support requests now include up to half a second of forward travel, capped at sixteen metres. The request stays unchanged while it contains the current footprint and predicted path with a margin. This gives preparation a head start without continually moving the requested bounds or allowing extreme velocity to create an unbounded region. Existing terrain/static creation caps and the shared deadline still apply.

Source: [support windows](../../../src/physics/supportWindow.js), [live integration](../../../src/physics/liveWorld.js), [fixed clock](../../../src/physics/fixedStep.js).

## Evidence

- The [full check](check.log) and [production build](build.log) passed. The separate [runtime test](runtime.log) passed after adding the real-engine impulse regression.
- [Runtime tests](../../../bin/test-physics-runtime) verify a gate that changes after the first step, exact discarded time, no simulation-time advance while blocked and no catch-up on resume. A real Rapier body receives a large impulse after its first step; the guard prevents the second step of the same presentation frame from advancing beyond the supplied bounds. This isolates the timing contract; it is not a full-world saturation test.
- [Live tests](../../../bin/test-physics-live-world) cover stable requests under small movement, bounded forward/reversed prediction and extreme-speed bounds, alongside existing real-engine contacts at 30/60/120 Hz.
- The real game started through **Just Cruisin’**, then **Stage chair encounter** and **Coast forward**. The [saved report](impact.json) records one impact, no current support block, zero admission rejects, zero overflow and zero dropped simulation time over 2,377 steps. [Console output](console.json) is empty. The [screenshot](impact.png) records the encounter after impact; the chase camera obstructs the chair, so this is not motion-feel approval.
- The agent-owned test tab closed and its preview session stopped with exit 130. A separate same-network preview was subsequently started at Gary's request and deliberately remains running for his playtest.

## Still incomplete

The global support stop is still a prototype fallback. This change does not prove arbitrary within-step impulses cannot cross support, rotational extent coverage, independent progression of unrelated assemblies, or safe saturation/reconciliation with newly loaded solids. The sixteen-metre prediction cap is an explicit prototype bound, not a measured device policy. Final frontier handling, coherent distance reset, occupied support, broader props and device acceptance remain unfinished.

Next: exercise sustained support starvation and newly loaded-solid overlap without allowing a visible prop to fall, teleport or disappear. Gary's phone/feel feedback is pending; use the prior checkpoint's [playtest procedure](../2026-10-30-live/README.md#iphoneipad-handoff).
