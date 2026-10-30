# Adopted cooler lid and cupholder transforms

October 30, 2026. This completes independent render-part publication, not live
lid/contents admission or physical hinge acceptance.

## Implemented contract

The production cooler labels body, hardware, trim and lid with unique part IDs.
Source batching preserves those IDs in its descriptions and validates all IDs
before removing meshes. Active render acquisition preserves them and rejects
duplicates before allocation. `setPartMatrix(id, localMatrix)` changes only the
selected existing slot; `samplePartWorldMatrix(id, out)` reads its actual world
transform through the active owner's parents. Both reject stale bindings.

`cooler.lid.setAngle(angle, binding)` and
`cooler.sampleCupWell(id, out, binding)` use that same adopted owner. Omitting
the binding retains the native model behavior and its detached-source guard.
Geometry, materials, body metadata and the independent source batch are not
mutated by active part publication. The physics comparison fixture now uses
these adopted parts after immediately disposing its source batch.

## Verification

`node bin/test-camp-cooler` exercises the actual production builder, including
source teardown, independent neighbor slots, transformed roots, raycast matching
of both moving cup floors, unchanged body trim, invalid transform atomicity,
duplicate IDs, and stale handles. One changed lid requests 64 matrix bytes after
prior uploads have been acknowledged; pending upload ranges intentionally merge.
`node bin/test-prop-rendering` and `node bin/test-physics-render-adoption` retain
the original chair and lifetime coverage. Full `npm run check` passed.

The production build plus comparison page built successfully. In Chrome, the
inversion replay completed 480 steps with four slots/four buckets per cooler,
256 allocated matrix bytes per cooler, zero rejection/overflow, and **21 draws /
4,242 triangles** for the whole comparison scene, matching its previous total.
[Browser data](browser-inverted.json), [Low Noon](low-noon.png), and
[Low Midnight](low-midnight.png) show the adopted render path. These wide aftermath
captures establish rendering continuity, not close-up lid-motion approval or
phone performance. [Mid Noon](mid-noon.png) and [Mid Midnight](mid-midnight.png)
also preserve the closed appearance. [Disposal data](disposed.json) confirms zero
engine bodies/joints and zero render slots/buckets/buffer bytes after cleanup.

The final build also passed a real-game Chrome ready-mode click and world boot,
with eight active props, 30 engine bodies and no console errors. Verification tabs
and temporary port 8766 previews were closed; Gary’s port 8769 preview was not changed.

## Rejected articulated-joint spike

An isolated temporary adapter inserted a `createMultibodyJoint` revolute with
the same anchors and axis immediately before the existing impulse joint. The
impulse joint retained mutable latch/limit controls. This was not committed as
runtime behavior. [Four measured scenarios](rejected-hybrid.json) show nearly
identical rest/impact/boost maxima, which exposed a false-positive stability
result. Reading the strong impact immediately before stepping gave base velocity
approximately `(1.667, .833, -6.000)` m/s, but the next step returned it to roughly
`(.000018, -.000349, -.000678)` m/s. Inversion also retained 49.5 mm maximum anchor
error. The spike therefore fails the existing impulse-driven interaction
contract and does not justify adopting that combination.

This does not prove all multibody approaches fail. Hinge integration still needs
a verified force/contact/latch strategy or another measured solver approach.
Render-part ownership is now available independently of that decision.
