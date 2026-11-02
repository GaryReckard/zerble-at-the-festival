# Fall capacity reserved before taking a sitter

October 30, 2026. Engine/resource handoff proof, not a visible NPC-fall release.

## What changed

`src/physics/seatRelease.js` prepares a supported mass and an actual disabled
dynamic body before the incoming activity can take ownership. Both allocations
count against engine limits and `AdmissionBudget`: one body and two colliders
per sitter while supported. The disabled body has no simulation/contact role.

At release, the existing body receives the support's world pose, point velocity
and angular velocity; the supported mass is removed and that body is enabled.
The budget drops the removed load collider. The fall path does not call body or
load allocation, even when optional content has filled all remaining slots.
Repeated release returns the same body, and stale leases cannot touch a reused
body ID. Cleanup works before or after adapter disposal.

Supported loads now accept a capsule half-height as well as the original sphere
default. A reserved fall body uses the same shape, dimensions, mass and rotation
as its supported load. These fixture dimensions are not accepted NPC tuning.

The resource lease is registered with the current activity's preparation cleanup.
Failed admission rolls back both engine resources and accounting. If enabling
the already-prepared body throws, the lease retains its captured release state
and can retry without removing mass twice or allocating another body. The caller
must resolve that exceptional activation before advancing the affected person;
the resource helper does not schedule retries or advance the world itself.

## Evidence

`bin/test-physics-seat-release` uses real Rapier and the production loveseat
collision recipe. Two capsule-shaped sitters reserve their fall bodies, then
optional content fills all four engine-body and 12 collider slots as well as
the corresponding budget dimensions. Both sitters release with allocation
methods guarded to fail if called. Tests verify continuous linear/angular
velocity, total mass and linear momentum, idempotency, and complete cleanup.

Additional cases cover exhausted load/body capacity, stale support generation,
expired preparation, activation retry, reused body identity and either teardown
order. `bin/test-camp-support-transfer` composes the helper with real population
claims and camp reservations: after release, the seat is free while the reaction
still owns movement; ending that activity releases the body and budget.

The new test runs in both `npm run check` and `npm run test:physics`. It exercises
the resource transition, not sustained body collisions, rendering, contact
separation, a stand-up animation or device performance. No live occupied chair
is admitted yet. Cup release reservations and mandatory-event handling remain
separate acceptance requirements.

The focused tests, full `npm run check`, and production build all exited 0.
The build at `/tmp/zerble-seat-release-20261030` booted in Chrome tab 380986137
through the ready Just Cruisin' button with physics, mute, Low and seed 1977.
The title closed and the world ran with five active props and 19 bodies; console
warnings/errors were empty. This proves boot compatibility, not live use of the
new resource helper. No graphics changed, so no new Noon/Midnight captures are
claimed. The test tab closed and temporary port-8766 preview exited 130; the
user cooler preview on port 8767 was not replaced.

## Next integration

Connect occupied furniture admission to the prepared support and fall resources,
publish person transforms from the current support/body, and implement bracing,
safe release separation, landing and clear stand-up recovery. The full occupied
chair and fall tasks remain unchecked until those production paths and their
visual/device gates are verified.
