## Why

Festival inhabitants have several useful specialized controllers, but participation
in scheduling, interactions, collisions, activities, and cleanup is wired separately.
This refactor establishes consistent ownership and extension boundaries so adding
people does not require expanding unrelated orchestration code.

## What Changes

- Introduce a population runtime with registered controllers and explicit update phases.
- Expose renderer-independent, lifetime-safe person handles over existing storage.
- Give temporary activities, parties, movement, and render bindings distinct authority.
- Route supported interactions and collision candidates through explicit capabilities.
- Extract common rules selectively, split the obstacle-controller collection, and
  provide production-backed behavioral fixtures and lifecycle contract tests.
- Preserve current behavior, rendering strategies, population policies, and random
  streams during structural migration; isolate intentional changes for review.

This request authorizes planning and council deliberation only. No runtime
implementation, commit, deployment, or gameplay rebalance is included.

## Capabilities

### New Capabilities

- `people-runtime`: population participation, lifetime-safe identity, controller
  scheduling, activity authority, query/collision facets, and extension checks.

### Modified Capabilities

- `crowd-ai`: replace the requirement that roaming populations live specifically in
  `obstacles.js` with focused controllers participating through the common runtime.

## Impact

Crowd AI, main orchestration, registry/collision consumers, activities and parties,
models' animation inputs, sandbox/debug tooling, and relevant world-builder seams.
Expected affected modules include `src/main.js`, `src/crowd.js`, `src/obstacles.js`,
`src/monks.js`, `src/campJamActivity.js`, `src/healingArtsActivity.js`,
`src/oneWheels.js`, `src/nutWagon.js`, and performer adapters in `src/chunks.js`.

Tripwires: boot order and module loading; all five HTML importmaps per current
AGENTS.md; RNG call order; instance pooling and shared-resource disposal; reservation
cleanup across unload; collision candidate ordering; and per-tier costs. Preserve
threeShim and synchronous iOS audio unlock. Continue independent nightness polling.
Documentation planning alone needs no gameplay changelog. Implementation must add
the dated changelog for observable workflow or behavior changes and trim roadmap.

## Scope Check

Searches covered `Crowd`, every exported roaming controller in `obstacles.js`,
monks, Healing Arts, camp music, one-wheel riders, the nut wagon, Lurleen,
place-owned stage performers and cooks, birds, registry queries, debug commands,
and the main frame/collision/honk paths. Evidence is indexed in
[brainstorm.md](brainstorm.md).

Roaming people and parties are full migration targets. Place-owned people join
through adapters without receiving a second lifetime owner. Nut wagon and Lurleen
retain vehicle physics while their people/seat/query boundaries join the runtime.
Birds remain an ambient controller; they do not become people. Props, forests,
lakes, player physics, audio synthesis, and procedural population distribution
retain their owners. Full ECS, global event bus, AI algorithm replacement, density
rebalance, full replay, and performance scheduling changes are evaluated alternatives,
not required implementation scope.
