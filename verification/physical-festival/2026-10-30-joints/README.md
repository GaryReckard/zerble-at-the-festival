# Bounded hinge adapter proof

October 30, 2026. This completes the hinge-API experiment within Task 2.1 (Engine loading proof); it does not complete that task's remaining loading/failure contracts or the cooler feature.

## Contract

The [Rapier adapter](../../../src/physics/rapierAdapter.js) now owns revolute impulse joints under an explicit capacity, defaulting to zero so existing chair worlds allocate none. Callers supply two body IDs, local anchors, a nonzero local axis and ordered limits in radians. A copied, generation-checked token identifies the joint and its world; no engine handle escapes. Inspection returns copied values, and a limit update can represent a latch. Removing either attached body also removes the matching adapter joint metadata. Explicit removal and whole-world disposal release storage.

The adapter uses the pinned installed Rapier distribution. API references were checked against the official [joint guide](https://rapier.rs/docs/user_guides/javascript/joints/) and [revolute impulse joint reference](https://rapier.rs/javascript3d/classes/RevoluteImpulseJoint.html), then verified against the actual engine by tests. The guide identifies a revolute joint as allowing rotation along one axis, and the API exposes angular limits and optional contacts between connected bodies.

## Evidence

[The joint test](../../../bin/test-physics-joints), included in both `npm run check` and `npm run test:physics`, uses real WASM bodies and constraints. It tests bounded admission; invalid anchors, axes and limits; missing/same/fixed-only bodies; axis normalization; copied inspection data; enabled/disabled connected-body contacts; actual motion under angular limits; retained anchor coincidence; a zero-width latch limit; stale tokens after body/joint ID reuse; cross-world isolation; body removal from either side; 100 joint create/remove cycles; and repeated world disposal. An injected configuration failure after engine joint allocation verifies rollback without deleting the bodies.

The fixture allows 0.1 radians of transient limit tolerance and less than 0.03 metres of anchor separation under its tested impulse-free velocity setup. It is not a cooler collision, high-energy pile or device performance result. The zero-width limit test demonstrates the constraint, not an approved animation or force profile for closing a real cooler lid.

- [Full checks](check.log), [production build](build.log), and the final [targeted test run](targeted.log) passed.
- A production preview booted through **Just Cruisin’** with four active stage chairs. [Saved diagnostics](game-smoke.json) report 13 bodies, 33 colliders, zero adapter/engine joints, no support block and no event overflow. [Captured console output](console.json) is empty. This browser run verifies unchanged chair startup, not browser-rendered hinge articulation.
- The isolated port-8766 preview exited with code 130 and its test tab closed. Gary's port-8767 stage-chair playtest was not replaced or stopped.

## Remaining work

Connect joints to an owned assembly only after its body/render/release reservation succeeds, and tear them down before releasing supporting parts. The cooler still needs independent body/lid descriptors, mechanical geometry partition, holder ownership, a tuned latch/opening experiment and campsite/device acceptance. Engine loading failure/base-path tests and the physical-phone gate remain open, as do occupied-chair reactions, cups, signs and aftermath.
