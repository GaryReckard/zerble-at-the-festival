# People and NPC refactor design

## Context

**TL/DR:** Give festival inhabitants a consistent integration boundary while
preserving their different behaviors and rendering strategies. A population runtime
coordinates controllers; people retain one identity and lifetime owner; activities
borrow explicit authority; groups supply shared intent; models display the result.

This design incorporates the council and independent Astra review. The reviewed
draft is preserved under `deliberations/001-architecture/input-plan/`.
Current-code evidence and alternatives live in [brainstorm.md](brainstorm.md) and
[critical-evaluation.md](critical-evaluation.md). This document describes proposed
APIs, not modules that already exist.

The current crowd combines update scheduling, parties, camp jobs, per-person state,
and instance uploads (`src/crowd.js:910-970`). Specialized roaming controllers have
independent data and geometry (`src/obstacles.js:389-454`), while Healing Arts already
demonstrates one person's identity surviving a temporary rig substitution
(`src/healingArtsActivity.js:3-50`). This is the foundation to improve.

## Goals / Non-Goals

**Goals:**

- Make lifetime, behavior, movement, activity, group, rendering, collision, and
  interaction responsibilities explicit and independently testable.
- Make registration the normal path for adding inhabitants to orchestration,
  queries, debugging, and cleanup.
- Reduce cross-module writes and duplicated common rules without erasing character
  differences or expanding Crowd into a universal character controller.
- Preserve gameplay and efficient rendering through verifiable migration slices.

**Non-goals:** a full ECS, new dependency or build system, new AI selection algorithm,
population rebalance, off-thread simulation, complete deterministic replay, new
visual models, or a global event bus. Simulation LOD remains measurement-gated by
the existing roadmap. These are scope boundaries, not excuses to leave an adapter
half-migrated or retain duplicate authoritative paths.

## Decisions

### Responsibility map

| Responsibility | Proposed owner | Explicit boundary |
| --- | --- | --- |
| Runtime participation and ordered calls | `PeopleRuntime` | No per-role AI branches; no ownership of world props |
| Person lifetime and internal storage | A registered population controller | Exactly one owner per person; no second person for an activity rig |
| Stable public identity | `PersonHandle` plus controller resolver | Does not expose a mutable Three.js model as identity |
| Autonomous intent | Population behavior, or an exclusive activity | Only one current movement authority |
| Collective intent | Party/group controller | Membership is not lifetime ownership or a second individual update |
| Steering and movement | The person's movement controller | Applies authorized intent; safety policies remain explicit |
| Temporary activity and resources | Activity claim and resource owner | Activity cancellation releases its own claims exactly once |
| Rendering | Existing instance batch or model adapter | Reads final pose; does not choose destinations or award smiles |
| Spatial world content | Existing registry | Does not become the person-lifetime database |
| Score and audio | Existing scoring/audio systems | People emit bounded effects through existing services |

### Minimal integration protocol

Proposed module root: `src/people/`. Before adding it, extend `bin/check-importmaps`
to discover nested people modules and reject missing/nonexistent mappings, with
negative tests for each required HTML page. Current discovery only covers direct
`src`, `worldgen`, and `models` files (`bin/check-importmaps:24-29`). Reconcile the
map sandbox's narrower checker role with the authoritative five-page rule.

Start with `runtime.js`, `personHandle.js`,
and adapters. Extract focused controller/activity/rule modules as their migration
lands; do not create empty directories or speculative framework layers.

Each registered controller has a unique key, explicit schedule registration,
`inspect(out)`, and idempotent `dispose(reason)`. Supported capabilities are explicit
method references, not a growing list of role names inside the runtime:

```js
people.register({
  key: 'children',
  controller: children,
  schedule: legacyChildrenSlot,
  capabilities: {
    people: children.peopleView,
    collisions: children.collisionSource,
    honk: children.onHonk,
  },
});
```

The runtime is an ordered population directory and dispatcher, not a general
scheduler or behavior engine. Compile stable dispatch/provider lists at registration;
do not discover capabilities or solve dependencies every frame. Activity selection
and resource reservations stay beside their owners. Display-only adapters need
schedule, inspection, and cleanup participation but no person handle or movement claim.

This is illustrative, not a required spelling. The contract must be small enough
to document on one page. Unsupported reactions stay unsupported; participation
does not imply every person can board, cheer, flee, or smile. Domain checks stay in
their controller. Registration validation catches duplicates and incompatible
capability shapes. Avoid broad `world` or `game` objects as service locators.

### Identity without forced storage migration

Use a stable handle `{ ownerToken, slot, generation }`, allocated at creation,
never freshly wrapped each frame. The runtime issues an opaque owner token per
controller registration lifetime; the readable `controllerKey` is not identity.
Re-registering the same key or replacing the runtime produces a new owner token.
A released/reused pooled slot increments its generation. Every obsolete command,
tick, hit callback, and release must reject both slot reuse and owner replacement.

Existing crowd records and child meshes can stay internally authoritative until
their extraction requires change. Common read views expose current world position,
heading, collision presence, activity summary, group membership, and capabilities.
Commands validate authority rather than exposing arbitrary mutable state or making
a Three.js model the public identity. No copied person object per query and no scene
node per instanced adult is required.

Identity survives boarding, render substitution, and current child recycling, which
relocates an existing mesh with continuing state (`src/obstacles.js:495-514`). Actual
removal/reuse begins a new lifetime. Inventory outside consumers too: lost-smile
effects retain a raw NPC record and read its position (`src/smiles.js:81-93`,
`src/smiles.js:125-128`). Migrate them to follow a live handle and retain the last valid
position after removal until expiry, never following a replacement occupant. Verify
the characterized effect path before replacing references.

Spatial providers use existing storage, callback/iterator access, and caller-owned
scratch. Preserve localized candidate bounds and consumer filters; avoiding wrapper
allocations alone does not prevent an accidental full-population scan.

### Scheduling and authority

First register adapters at their **existing call sites and order**, including nested
party/activity updates. Remove each replaced invocation when its registered route
becomes authoritative. Record one execution owner per controller/phase.

The final schedule is a small explicit ordered list at real integration points,
including non-person dependencies: bubble updates; vehicles/seats; spatial sync;
adult movement and smile emission; smile aging/collection/coalescing/scoring; child
movement and smile emission; late place activities; streaming/unload; star-love;
contacts; final render publication. Adults emit before collection and children
afterward (`src/main.js:1196-1221`), so grouping all effects at the end changes behavior.

Multiple documented runtime entry points can be permanent when gameplay barriers
require them. Consolidation is conditional on before/after observable traces, not a
required one-call sequence or runtime dependency solver. Verify pickup ages,
callbacks, score/combo order, boarding, streaming, and contact outcomes as well as
execution counts. Retire undocumented legacy routes, not necessary integration slots.

The runtime consumes accepted main-loop delta, owns no RAF/timer/visibility handler,
and advances actor time once per accepted gameplay frame without catch-up. Preserve
the current delta cap and hidden-tab scheduler (`src/main.js:994-995`,
`src/main.js:1632-1637`) with skipped and visible/hidden/visible tick tests. Reuse a
narrow frame context. Keep nightness independently polled by existing consumers;
actor time does not replace world-day or Web Audio clocks. Convert animation clocks
separately from extraction, including both stored deadlines and their comparisons:
Healing Arts stores absolute `healingCooldownUntil` (`src/healingArtsActivity.js:45`,
`src/healingArtsActivity.js:81-82`). Record intentional visible timing changes.

### Activities, parties, and resource claims

Activity ownership has a concrete transition protocol:

1. The population owner validates live identity, eligibility, and existing selection
   precedence, while resource owners validate reservation tokens.
2. Preparation obtains only tentative resources. Failure rolls back that attempt's
   work and preserves the current activity and authority.
3. Synchronous commit marks the outgoing claim as revoking, denying movement and
   new binding writes before its cleanup, then
   activates the prepared incoming claim. Reentrant acquisition during transition
   is rejected; outgoing cleanup cannot release the incoming claim.
4. The current claim selects the authorized movement implementation. Claim-checked
   operations commit position/heading and binding changes; generic `setState` or
   `mutatePerson` facades are not the contract. Preserve activity-specific algorithms.
5. Ending invalidates authority first, releases that claim's resources, then resumes
   the characterized ordinary/group behavior. Membership can survive while its
   lower-priority movement proposal is suspended.

A claim identifies the person, owning activity, and claim incarnation. Only an
active current claim may tick, move, or establish a binding. A revoking claim may
release its own still-owned resources/binding once, but cannot restore ordinary
movement or modify an incoming claim; the population owner commits fallback/resume
after cleanup. Validate person lifetime and claim/resource ownership for release,
rather than treating revocation as permission to abandon cleanup. Same-frame contenders
resolve synchronously in existing selection order without a global priority solver.
Allow overlays only where authorities do not conflict, such as an ordinary walking
pose with an eligible cheer. Preserve existing safety interruptions and protected
rider/activity rules. Test failed acquisition, competing activities, stale ticks,
replacement, and interruption during group boarding.

Seats, beds, and instruments retain their world/vehicle owners. Resource adapters
provide narrow reserve/validate/release operations that validate resource identity
and person generation. Failed group acquisition undoes only its own reservations;
registry mutation remains synchronous and nontransactional.

Group controllers retain handles and shared intent without integrating movement
again. Group lifetime policy can request collective removal through the population
owner; it cannot free slots or invalidate handles directly. Preserve monk collective
distance removal, party-member sweep exemptions, partial-spawn rollback, and repeated
clear (`src/crowd.js:814-817`, `src/monks.js:115`, `src/monks.js:168-172`).

Teardown proceeds in order: mark owner unavailable to new dispatch/claims; invalidate
claims and release borrowers while metadata and fallback renderers remain live;
detach borrowed bindings; remove publications/spatial handles; dispose exclusively
owned graphics/audio resources; finalize invalidation through the population owner.
Both crowd removal paths converge on one release core (`src/crowd.js:808-868`,
`src/crowd.js:2721-2751`). Test person-first, place-first, controller-first, and repeated
teardown, including attempted reacquisition from callbacks. Shared resources survive.

### Render bindings and shared mechanics

Render adapters consume pose and appearance. Adult instancing, articulated children,
monk avatars, and borrowed place rigs remain distinct implementations. Bind/unbind
commands ensure a single visible representation and restore ordinary binding on
release. Model animation does not acquire resources or award smiles.

Healing Arts requires real ownership extraction: the model currently computes
trajectories/overlap constraints, publishes `currentX/Z`, and the activity copies
those back to NPC positions (`src/models/healingArts.js:193-237`,
`src/models/healingArts.js:267`, `src/healingArtsActivity.js:124-126`). Move the existing
calculation into an activity-owned sampler/cache, preserving bootstrap pose creation,
activity-before-sampling order, prior-sample reads, and near/night-transition cadence
(`src/chunks.js:68-74`). The legacy cadence becomes explicit activity policy independent
of whether display updates execute; unconditionally sampling earlier would change
both timing and far-away behavior. Renderers consume activity output, never supply
authoritative movement. Current-sample alignment is a separate intentional change.
Headless/display-skipped tests still run the characterized activity sampler and
check resumption, including its explicitly retained prior-sample offset.

The crowd facade owns matrix/attribute storage, packed counts, accessory ranges,
shadow/culling policy, and dirty flags. Late activity, hit, or release writes dirty
only affected slots and publish before render submission even when the ordinary
crowd slot did not run. Do not add a population-sized pose copy or a second complete
population traversal to flush a binding. Preserve visual distance gates separately
from gameplay sampling; test hair, camera/flash, drink, avatar, hidden-rig, and body
ranges as well as instance dirty flags.

Extract shared smile eligibility/cooldown/reset transitions while retaining separate
child/adult gain profiles. Keep `steering.js` as the common pure math layer. Extract
additional helpers only after real equivalent consumers and tests justify them;
do not normalize speeds, reactions, or selection priorities as incidental cleanup.

### Collision and nearby-person queries

Keep world-registry queries for props and already registered movers. Register person
candidate providers separately, preserving existing candidate order and exclusion
rules. An object published through the registry must not also be appended by an actor
provider. Collision metadata can include a generation-safe person handle, while
existing `kind`, radius, damage, and gameplay classification stay compatible.

The collision resolver remains the authority on the physical hit. The NPC interaction
router sends the selected hit back to its controller; scoring retains its single
writer. Do not assign all `person` handles the same damage or combo policy.
Nearby-person queries include eligible inhabitants across storage types, while
each consumer declares filters so a vehicle's existing crowd-only yielding policy
is preserved until a separately reviewed behavior change expands it.

## Coverage and completion boundary

| Family | Required migration |
| --- | --- |
| General adults and photographers | Population adapter, stable handles, renderer facade, extracted activity seams |
| Children and wooks | Focused controllers, queries/interactions/collisions, shared rule consumers where equivalent |
| Puppet parade and brass band | Formation controller adapters, colliders, sound-handle lifecycle |
| Hoopers and frisbee pairs | Explicit pair/place/activity owner, participant views, supported reactions |
| Monks | Existing crowd identities plus group intent and public avatar/activity commands |
| Camp, bathroom, picnic, hammock, market, boarding, Healing Arts | Explicit activity/resource authority and cancellation paths |
| Stage performers and cooks | Place-owned display adapter; no second person or pool allocation merely to animate scenery |
| Nut wagon, one-wheels, and Lurleen | Preserve vehicle motion owners; integrate relevant seats, rider views, queries, and scheduling dependencies |
| Birds | Keep ambient ownership and existing ticking; explicitly excluded from the people domain |

Completion includes eliminating cross-controller private render calls such as
Healing Arts and monks calling `_writeMatrices` (`src/healingArtsActivity.js:50`,
`src/monks.js:49`). Public commands and dirty/render binding operations replace
those dependencies. Adapters are acceptable stable boundaries only when authority
is singular and their contract is tested; indefinite parallel legacy paths are not.

## Risks / Trade-offs

| Risk and evidence | Mitigation / acceptance |
| --- | --- |
| Pooled slots and external activities can outlive one another (`src/crowd.js:808-835`, `src/healingArtsActivity.js:20-50`) | Generation handles, resource-identity validation, stale-release tests |
| Current update order mixes nested and external controllers (`src/crowd.js:910-917`, `src/main.js:1193-1244`) | Legacy slots first; execution counts and explicit dependency traces before consolidation |
| Collision first-hit order is deliberate (`src/main.js:1516-1544`, `src/registry.js:28-30`) | Ordered providers, no duplicate registry publication, candidate/hit equivalence fixtures |
| RNG modes differ (`src/obstacles.js:405-426`, `src/monks.js:15`) | Preserve draws and streams during moves; injectable legacy RNG in tests; no claim of full replay |
| A generic facade can add allocations or lose instancing (`src/crowd.js:951-970`) | Stable handles/views, caller scratch, measure spawn separately from steady state |
| Place unloading and borrowed rigs have different owners (`src/chunks.js:596-597`, `src/healingArtsActivity.js:3-50`) | Resource owner triggers release; no transfer to chunk lifetime for wandering people |
| Import/boot and shared-resource contracts are project tripwires (AGENTS.md, constraints 1-6) | Five importmaps, import checker, Low/Mid/full boot; shared tags honored; no audio gesture changes |

Measure before/after on identical tier, seed, location, time, population, effective
adaptive quality, DPR/render dimensions, and foreground state, with warmup and
multiple samples. Record simulation, query/collision publication, and render-publication
costs, allocations, spawn/recycle outliers, scene draws/triangles, programs, and owned
resource counts. Count candidate visits/callbacks and matrix writes to catch multiplied
work that aggregate timings miss. Target zero added scene/shadow draws and triangles
for matching scenes, retaining packed active instance counts. No unexplained regression is accepted;
an already-over-budget baseline is not permission to worsen it, and this refactor
does not promise to repair unrelated rendering budgets. Device claims require a
real device. Headless software WebGL timings are not device evidence.

## Migration Plan

1. Inventory owners and complete frame/collision barriers; fix nested-module checker
   coverage; establish production-backed fixtures, routine contract tests, and
   comparable baselines. Add detailed characterization before each affected slice.
2. Introduce only the runtime/identity/claim/render seams needed for a complete
   **adult → Healing Arts → ordinary adult** slice, including activity-owned motion,
   interruption/unload, stale references, pool reuse, and render-skipped equivalence.
3. Prove the same contracts with a complete **child population** slice, retaining
   independent storage/movement. Exercise population, activity, and role extension
   early, before broad rollout; do not make children inherit adult-only behavior.
4. Migrate remaining populations, activities, and parties in focused slices, including
   public person/query access, selected shared rules, and owned teardown. Remove
   each superseded authority as its replacement becomes production-authoritative.
5. Complete place/vehicle adapters, ordered interactions/collision providers, external
   handle consumers, and documented schedule dependencies. Keep justified permanent
   integration slots rather than forcing a single scheduler call.
6. Reconcile full inventory coverage, performance/behavior evidence, documentation,
   extension examples, and obsolete compatibility removal before acceptance.

This adopts Astra's harder ownership proof first and the council's requirement for
two early contrasting consumers. Every slice includes its checks, documentation,
and same-commit CHANGELOG/ROADMAP updates when behavior or developer workflow is
observable; final documentation is reconciliation, not deferred first documentation.

Every step has a runnable production path and bounded reviewable diffs. Revert a
failed slice only after checking current Git state and preserving others' work;
never use a destructive reset as rollback. Do not keep two active implementations
as insurance. Seeded worlds and existing draw sequences must not regenerate differently.
Freeze policy changes, sampling-timing corrections, AI algorithms, and scheduling
optimizations need separate characterization and intentional scope decisions.

## Verification and extension recipe

Extend existing sandbox fixtures for crowd photography, Healing Arts, campsite
activity, and camp music (DEBUGGING.md:559-635), then add a mixed-population fixture
using production constructors and scoped world/query services. Test behavior without
WebGL where possible, rendering/rig handoff in the sandbox, and streaming/collisions
in the real game. Do not build a second simulation exclusively for tests.

Prove three extension operations: add a population, add an activity to an eligible
existing person, and add a role/render variation without forking identity. Each
supplies its owner, registration/selection entry, supported capabilities, production
fixture, and removal path. An explicit local activity-catalog entry is acceptable;
new runtime role switches, unrelated activity edits, and raw-record dependencies
are not. Tests prove single update/movement authority, replacement-safe identity,
claim-checked writes, cancellation, collision equivalence, and ordered cleanup.
Main should not gain per-character update, honk, collision, inspection, or teardown
branches. Run early examples again at final acceptance.

Implementation verification includes `npm run check`, `bin/check-importmaps`,
relevant behavior tests, title-card gesture and full-world boot, Low/Mid with
Noon/Midnight checks, unload/revisit cycles, and browser/server teardown. Follow
`docs/browser-verification.md` and local overrides: muted URLs, unique sessions,
hard deadlines, exact-PID assertions, no unsafe layout-snapshot capture. A scripted
start does not establish iOS audio unlock. Planning verification only checks the
documents and their references; no browser measurement has been performed here.

## Open Questions

No human answer is needed to complete this plan. Exact API spelling and measured
baselines are implementation tasks; the architecture and scope must remain explicit.

## Council Amendments

The [five-specialist synthesis](deliberations/001-architecture/results.md) and
[independent Astra review](astra-review.md) refine the preferred direction rather
than replace it. Adopted changes cover owner-incarnation identity; explicit
acquire/write/replace/release semantics; Healing Arts motion ownership; an adult/activity
slice before children; preservation of external gameplay barriers; ordered teardown;
nested importmap coverage; routine-suite integration; targeted rendering and bounded
queries; and extension proof for activities/roles as well as populations.

The [review resolution record](review-resolution.md) maps findings to final contracts
and tasks. Initial reviews cite the preserved draft, not the revised line numbers.


### Clarified extension acceptance (Gary, 2026-10-26)

The primary outcome is easier composition of new behavior across compatible people
and places, rather than uniform orchestration alone. A behavior should declare its
person capabilities and use a place/resource adapter for selection, approach,
reservation, interruption, exit and unload. It must not require unrelated NPC
storage/renderer changes or central switches per NPC family and venue. Prove one
behavior across two distinct population/storage types and two resource adapters
early, then reconcile an extension matrix covering stages, porta-potties, food
trucks, Healing Arts and the nut wagon. Existing eligibility remains explicit;
shared contracts do not grant every population every activity automatically.
The contributor guide and final before-and-after visual must make these extension
points understandable and concrete.
