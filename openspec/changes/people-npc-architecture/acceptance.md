# People refactor acceptance

This record distinguishes controlled equivalence, native Three.js contracts, real
browser observations and measurement limits. The implementation checklist remains
the completion record, and the dated [verification log](implementation-verification.md)
contains the individual runs and intentional corrections.

## Ownership coverage

Every family from the [baseline ledger](coverage-ledger.md) is accounted for below.
A role, group or borrowed display does not become a second person lifetime.
Global populations use controller/runtime replacement cycles; chunk-owned places
use resource unload/revisit. These are different ownership policies, not missing
implementations of one universal despawn rule.

| Family | Final ownership and supported participation | Executable evidence |
| --- | --- | --- |
| Ordinary adults | Crowd owns storage, identity, ordinary movement and instanced publication; current activity tokens authorize borrowed movement. | [Crowd](../../../bin/test-crowd-ownership), [handles](../../../bin/test-person-handles), [claims](../../../bin/test-activity-claims) |
| Photographers | Role and camera/flash pools stay on the same Crowd identity; commands validate handles and competing authority. | [Role/pose/commands](../../../bin/test-photographer-ownership), [appearance](../../../bin/test-crowd-appearance.js) |
| Children | Independent storage/controller, lifetime-safe relocation, queries, honk and colliders; the independent fixture demonstrates how compatible borrowing is added without enrolling children in adult activities. | [Children](../../../bin/test-children-ownership), [cross-population extension](../../../bin/test-people-extension) |
| Wooks | Focused controller owns recycling, movement, model and passive collision policy. | [Wooks](../../../bin/test-wooks-ownership) |
| Puppet parade | Controller owns carrier identities, route and lantern props; props get no duplicate interactive identities. | [Formations](../../../bin/test-formations-ownership) |
| Brass band | Formation controller owns musicians, route, colliders and bounded spatial/deferred audio release. | [Formations](../../../bin/test-formations-ownership), [audio lifecycle](../../../bin/test-stage-audio-lifecycle) |
| Hoopers | Controller owns the global person pool and each active place footprint; unplaced models publish no ghost collision. | [Hoopers](../../../bin/test-hoopers-ownership) |
| Frisbee pairs | Pair owns intent/disc; players retain individual controller-owned identities and collision poses. | [Pairs](../../../bin/test-frisbees-ownership), [model pose](../../../bin/test-frisbee-player) |
| Monk parties | Crowd owns people; public group intent/avatar bindings and atomic seat reservations preserve all-or-none boarding and rollback. | [Monks](../../../bin/test-monks-ownership), [seats](../../../bin/test-seat-reservations) |
| One-wheel riders | Rider controller owns physics, query identities and disposal; registry remains the sole collider publisher. | [Motion/manager](../../../bin/test-one-wheel), [queries](../../../bin/test-vehicle-people-queries), [fault cleanup](../../../bin/test-vehicle-cleanup) |
| Nut wagon and driver | Vehicle owns route, body, slots and music; driver remains the same Crowd person on release, with immediate ordinary-body publication. | [Boarding](../../../bin/test-boarding-ownership), [seat ownership](../../../bin/test-seat-reservations), [fault cleanup](../../../bin/test-vehicle-cleanup) |
| Lurleen | Existing controller owns physics/relationship/rendering; query-only person facet grants no activity or duplicate collider authority. | [Vehicle facet](../../../bin/test-vehicle-people-queries) |
| Healing Arts | Crowd owns identities; activity owns trajectory/cache and claims; place owns articulated rigs/music. Prior-sample and near/night cadence remain explicit. | [Ownership](../../../bin/test-healing-arts-ownership), [sampler](../../../bin/test-healing-arts-sampler) |
| Stage performers | Place owns display rigs and chunk lifetime; lightweight registered updater, zero interactive population. | [Display routes](../../../bin/test-place-displays) |
| Sugar Shack cooks | Shack owns local patrol/model entries and unload; registered display updater preserves waypoint RNG and model-only ownership. | [Display routes](../../../bin/test-place-displays) |
| Vendor keepers | Tent owns keeper/model/open-sleep presentation; copied customer state comes from the separate market activity. | [Market](../../../bin/test-market-ownership), [vendor presentation](../../../bin/test-evening-vendors), [shopping](../../../bin/test-vendor-shopping) |
| Birds | Existing ambient flock/perch owner remains outside the people directory. | [Birds](../../../bin/test-birds) |

## Activity and resource coverage

| Activity/resource | Ownership proof |
| --- | --- |
| Boarding, riding and disembarking | [240-frame characterization and public commands](../../../bin/test-boarding-ownership); [atomic/stale/replaced slots](../../../bin/test-seat-reservations) |
| Hammocks and picnic seats | [Exact motion plus contention/person/place/controller teardown and revisit](../../../bin/test-rest-activities) |
| Bathrooms | [Five 900-frame scenarios, occupied-door surprise, interrupted unit release and exact replacement](../../../bin/test-potty-ownership) |
| Market browsing/purchase | [Seven 600-frame scenarios, frontage identity, copied keeper presentation and teardown](../../../bin/test-market-ownership) |
| Camp chairs and beds | [Five 1,200-frame scenarios, physical exit preflight and resource lifetime](../../../bin/test-camp-ownership) |
| Camp music and instruments | [Four 1,400-frame scenarios, chair transfer, audio failure, rollback and cleanup](../../../bin/test-camp-music-ownership) |
| Healing Arts participants/rig slots | [Current movement/binding claims, prior-sample handoff and place-first/person-first removal](../../../bin/test-healing-arts-ownership) |
| Photography, smiles and cheer | [Role/pool ownership](../../../bin/test-photographer-ownership); [24,000 distinct adult/child transitions](../../../bin/test-smile-policy); [lost-target lifetime](../../../bin/test-smiles-lifecycle) |

## Native ownership and failure evidence

[The native contracts](../../../verification/people/contracts.html) construct real
Three.js populations, rigs, borrowed instruments, camera/flash matrices and vehicle
models. The October 27 passing run includes two whole-population runtime
replacement cycles and two real wagon unload/revisit cycles, with intermediate
identity, footprint, seat, root and body-publication assertions. Shared templates
survive both cycles, and unique owned attachments dispose exactly once.

The fault suite first reproduced a stranded rider record after a GPU release
failure and a stranded wagon root after audio detach failure, then passed after
cleanup was made complete before reporting errors. A separate native matrix check
first reproduced delayed ordinary-body restoration, then passed after publishing
only affected people during vehicle-first release. Driver identity survival is
preserved from baseline `9eaf2e5d73419f7c926c11ab06882f007b2bf1e4`, rather than
assuming the driver dies with the wagon.

The full ownership check exits 0 in
`/tmp/zerble-people-ownership-complete-check.log`, and the subsequent complete suite
exits 0 in `/tmp/zerble-people-final-acceptance-check.log`. Native tab 103 passes
with a clean console. The final gates and limits are recorded below.


## Trace and operation acceptance

All 20 saved real-game traces pass the current `bin/test-people-frame-trace` oracle
(`/tmp/zerble-people-all-traces-check.log`). These include startup, actual selected
hits, star-love suppression, streaming disposal, seats, display publication and
accepted clocks, rather than only empty phase labels. Per-slice frozen comparisons
cover pickup age/scoring/coalescing, late handoff matrices, packed photographer/hair/
drink ranges and distant pool reuse; see the linked contracts above and the dated
[verification record](implementation-verification.md). Intentional authority and
cleanup corrections are listed there rather than described as exact equivalence.

`PeopleRuntime.compile()` rebuilds provider lists on registration changes, while
`run()` traverses those same lists. `PersonHandles.create()` allocates only at a
new lifetime, `readOwnedRecord()` fills caller scratch, and population queries keep
storage scans local. Crowd retains one population/render pass, with targeted late
writes instead of another preparation pass. These boundaries are exercised by
`test-people-runtime`, `test-person-handles`, `test-people-queries` and the native
matrix/publication contracts. This is source and operation evidence, not a sampled
heap profile or a claim that no callback allocation exists anywhere in the game.

## Matched render and CPU comparison

`bin/prepare-people-render-comparison` exports immutable pre-refactor revision
`9eaf2e5d73419f7c926c11ab06882f007b2bf1e4` with only the current opt-in probes.
It does not reset or switch the working checkout. `peopleBaselineAuto=1` starts on
the first accepted gameplay frame. `peopleBaselineCohort=1` supplies two isolated,
synchronous constructor streams for child/frisbee appearance and population parity;
normal launches preserve their existing streams. Both exact restoration and the
inert default are tested. No random override remains installed during gameplay.

The four `matched-{original,current}-{low,mid}-fixed-cohort-baseline.json` artifacts
in [verification/people](../../../verification/people/) use seed 1977, time .3,
camera [-431,12,-84], viewport 1280×720, DPR 2, quality level 0, 120 warmup frames
and 180 samples on the same Apple M4 Pro browser GPU. Low uses a 1600×900 scene
target and Mid 1920×1080. `node bin/check-people-render-comparison` validates the
comparison conditions and exact equality of every named initial topology bucket:
meshes, instances, potential scene draws, triangles, material types and shadow
casters. Low references exactly the same 2,610 geometries/1,489 materials/30 textures;
Mid references three fewer geometry objects with identical topology and materials.
There are no added actor meshes, potential draws, triangles or shadow casters.

| Instrumented CPU window | Original median / p95 | Current median / p95 |
| --- | --- | --- |
| Low | 5.7 / 6.2 ms | 6.0 / 6.3 ms |
| Mid | 9.8 / 11.1 ms | 11.3 / 12.6 ms |

Adult update means in those windows rise from .720 to .911 ms (101 adults) and
1.467 to 1.909 ms (215 adults), respectively. That measures a real validation/
public-facade cost, so this refactor makes no zero-CPU-cost claim. A second Mid
window with renderer probes records 1.521 → 2.051 ms adult updates and 7.832 →
8.119 ms renderer calls per accepted frame, with 540 renderer calls on both sides.
That secondary diagnostic overlapped the routine check process and is attribution
context, not another clean performance trial. Live poses, effects, render-cache
history and scheduling are not held byte-identical. The exact initial topology gate
is separate from actual culled draws and device FPS. Matrix-write probes report
164,394 → 164,394 (Low) and 349,974 → 349,794 (Mid), and both populations execute
180 updates each; there is no extra population publication pass.

The earlier manual captures and original 995×949 viewport trial are not comparable
CPU or GPU-cache acceptance evidence. They exposed the need for the matched protocol,
not a proven geometry leak. Saved final inventories and GPU `info.memory` counters
can change with pose/culling/upload history; they are not the initial topology gate.

## Real browser and extension acceptance limits

Ready title-mode gestures, Low/Mid world boot and console checks pass in the final
comparison runs (IAB 109–114, all closed). Earlier affected real-game captures cover
driving contact, seats, streaming/unload/revisit and Noon/Midnight activity paths.
Native contracts cover two whole-owner replacements and two wagon unload/revisit
cycles. Final extension tab 115 again passes identical behavior on Crowd and Map
storage, both distinct place reservations and the selected stand-in binding, then
finishes exits, restores ordinary rendering and releases both reservations. It has
no captured console warnings/errors and was closed immediately.

No physical iPhone, Safari gesture audio, mobile GPU or long-session heap profile was
available in this environment. Synchronous gesture → Sound.init/resume/silent-buffer/
WAV wiring remains unchanged and is covered by the existing unlock tests, but a
muted Mac run does not verify audible iOS unlock. These are recorded acceptance
limits, not claims of physical-device testing.


## Final closeout

The final complete `npm run check` exits 0 in
`/tmp/zerble-people-closeout-check.log`, including the new dependency boundary suite
and the frozen verification-only rider oracle. Strict OpenSpec change validation,
149 modules across five importmaps and the matched render comparison all pass.
Final native tab 117 repeats the complete ownership matrix, including rider motion
and two wagon/whole-owner replacement cycles, with no captured warnings/errors.
Final ready-title Low game tab 118 progresses through gameplay and smile collection
with a clean console. Both tabs were closed. The visual is readable on desktop,
and the corrected 360px layout reports equal content/client width (345px after
the scrollbar), with no horizontal overflow. All owned IAB tabs through 120 are
closed and the viewport override is reset; no standalone browser, GPU worker or
daemon was created.

Original comparison server PID 78060 has been stopped, and direct exact-PID and
port-8766 checks find no process/listener. The current local game server PID 3465
on port 8765 is intentionally handed to Gary for the local play session he requested,
rather than left as an unattended test resource. No commit, push or deployment
was performed. The active change remains available for review rather than being
archived automatically.


Documentation read-through and local link/command checks cover 26 documents, 816
links and 28 heading anchors with no missing local targets. Historical references
to the deleted obstacle facade now point at immutable baseline source. All 40
implementation/acceptance tasks are checked independently of the earlier planning
completion, and the recurring implementation wakeup is no longer needed.
