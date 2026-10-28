# People and NPC refactor design

## Context

**TL/DR:** Give festival inhabitants a consistent integration boundary while
preserving their different behaviors and rendering strategies. A population runtime
coordinates controllers; people retain one identity and lifetime owner; activities
borrow explicit authority; groups supply shared intent; models display the result.

This is the pre-council design. The final section will record council amendments.
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

Proposed module root: `src/people/`. Start with `runtime.js`, `personHandle.js`,
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

This is illustrative, not a required spelling. The contract must be small enough
to document on one page. Unsupported reactions stay unsupported; participation
does not imply every person can board, cheer, flee, or smile. Domain checks stay in
their controller. Registration validation catches duplicates and incompatible
capability shapes. Avoid broad `world` or `game` objects as service locators.

### Identity without forced storage migration

Use a stable handle `{ controllerKey, slot, generation }`, allocated when a person
is created, never freshly wrapped each frame. A released/reused pooled slot increments
its generation. Resolution of an obsolete handle fails without mutating the next
occupant. Existing crowd records and child meshes can stay internally authoritative
until their own extraction requires change.

A common read view exposes current world position, heading, collision presence,
activity summary, group membership, and supported interactions. Controller APIs
apply commands; callers do not assign arbitrary state fields. Identity persists
through boarding and render substitutions, but not despawn and recycle into a new
person. Preserve current gaggle recycling semantics initially; document whether a
recycle is relocation of one person or lifetime replacement before assigning handles.

Spatial queries operate through callback/iterator providers over existing storage,
with caller-owned scratch buffers. The public view must not allocate a copied
person object for every query or require one scene node per crowd person.

### Scheduling and authority

First register adapters at their **existing call sites and order**, including nested
party/activity updates. A single runtime may have multiple named slots during
migration; collecting everything into one early `people.update()` would change order.
Remove an old call when its registered replacement becomes authoritative, never
run both. The runtime records one owner and expected execution count per phase.

The eventual explicit phase model is:

1. Apply external inputs and completed ownership releases in stable order.
2. Update moving vehicles and seat transforms needed by people.
3. Synchronize relevant spatial indexes.
4. Select group/activity intent, then update individual decisions and movement.
5. Publish final poses and collision candidates, then resolve player contacts.
6. Upload final render transforms and deliver bounded effects.

This is the target dependency model, **not permission to reorder current calls**.
Each consolidation requires a before/after trace and affected scenario checks.
If an existing activity depends on a different slot, give it a named dependency
rather than silently ticking it twice or postponing it one frame.

Introduce a reused, narrow frame context for player/bubble inputs and simulation
time. Keep nightness independently polled by its existing consumers, per AGENTS.md.
Do not replace the world day clock or Web Audio clock with the actor clock.
Convert wall-clock actor animation separately from extraction, preserving phase
continuity or recording the intentional visual difference.

### Activities, parties, and resource claims

Activity ownership is explicit: `tryBegin(person, activity)`, `tick`, and
`end(reason)`. A generation-safe claim identifies the person and owning activity.
Only the current claim may release its movement/render authority. Multiple overlays
can coexist only when they do not both own the same authority, for example a cheer
pose alongside ordinary walking.

Interruption policy is named and tested: despawn/unload invalidation releases claims;
safety reactions interrupt eligible ordinary activity; committed riders and other
protected states preserve their current rules. Do not introduce a new universal
priority order that changes existing behavior without a separate decision.

Seats, beds, and instruments remain owned by their current world/vehicle systems.
Adapters expose `reserve`, `validate`, and idempotent `release`, validating resource
identity as well as person generation. This is a narrow ownership protocol, not
transactional registry mutation. Failed group acquisition must roll back only the
reservations that attempt acquired. Person removal releases activity, group, seat,
avatar binding, spatial facets, and owned audio handles through one lifecycle path.

Group controllers retain member handles and desired formation/destination. They
do not secretly own a second lifetime or integrate movement again. Monk parties are
the first concrete consumer; parade formations retain their own movement controller.

### Render bindings and shared mechanics

Render adapters consume pose and appearance. Adult instancing remains instancing;
children retain articulated models; monks retain their avatars; place-owned rigs
can temporarily bind an existing person. Hide/detach the old binding before showing
the replacement and restore it on every release path. Model animation receives
explicit animation input and must not award score or acquire gameplay resources.

Extract shared smile eligibility and cooldown/reset transitions, keeping child and
adult gain functions/configuration distinct. Retain `steering.js` as the common pure
math layer. Extract further movement helpers only after two actual consumers and
equivalence tests establish a shared rule. Do not normalize speeds or honk behavior
incidentally when moving code.

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

Measure before/after on identical tier, seed, location, time, and population with
multiple samples. Record update cost, allocations, spawn cost, draws, triangles,
programs, and live owned-resource counts. No unexplained regression is accepted;
an already-over-budget baseline is not permission to worsen it, and this refactor
does not promise to repair unrelated rendering budgets. Device claims require a
real device. Headless software WebGL timings are not device evidence.

## Migration Plan

1. Build inventory, executable characterization, and a production-backed people
   workshop before replacing orchestration. Preserve existing baseline behavior.
2. Register legacy controllers and diagnostics, preserving exact update/collision
   order and existing RNG. Introduce stable handles and lifetime release tests.
3. Move the obstacle collection into focused people controllers, removing the old
   exports once all consumers are migrated. Introduce public person/query APIs.
4. Extract Crowd's renderer and activity seams, migrate activity/resource claims,
   monks and render handoffs, and remove private cross-controller writes.
5. Consolidate supported interaction/collision paths and proven shared rules. Migrate
   remaining place/vehicle adapters and then consolidate schedule dependencies.
6. Verify every family and teardown path, document the extension recipe, and remove
   transitional registrations and obsolete facades.

Every step has a runnable production path and bounded reviewable diffs. Revert a
failed slice by reverting that slice's owned changes after checking current Git
state, not by resetting somebody else's work. Do not retain two active implementations
as rollback insurance. Seeded world layouts and existing random draw sequences must
not regenerate differently; if a proposed slice needs that change, split it out.

## Verification and extension recipe

Extend existing sandbox fixtures for crowd photography, Healing Arts, campsite
activity, and camp music (DEBUGGING.md:559-635), then add a mixed-population fixture
using production constructors and scoped world/query services. Test behavior without
WebGL where possible, rendering/rig handoff in the sandbox, and streaming/collisions
in the real game. Do not build a second simulation exclusively for tests.

A new inhabitant supplies its owner, controller registration, supported capabilities,
render adapter, removal path, and production fixture. Its contract tests prove one
update owner, stale-handle rejection, cancellation, stable collisions, and cleanup.
Main should not gain new per-character update, honk, collision, inspection, or
teardown branches.

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

Pending the requested independent deliberation. The synthesis will be incorporated
here and into [tasks.md](tasks.md) before planning is reported complete.
