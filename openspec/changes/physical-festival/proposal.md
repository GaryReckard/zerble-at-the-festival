## Why

Zerble's festival should respond to contact with believable, varied motion and characterful aftermath. A clipped chair, its sitter, a cooler, a drink and a directional sign should each react according to what they are and how they were struck, while remaining consistent with the game's people, world ownership and rendering systems.

This is a planning-only handoff requested by Gary on 2026-10-29. No runtime implementation or measured performance claim is included. See [the idea catalog](ideas.md) for the complete conversation, [the evidence ledger](evidence.md) for current code, and [the ordered tasks](tasks.md) for execution.

## What Changes

- Introduce bounded local rigid-body simulation, initially evaluating Rapier, with the existing arcade cart controller driving a kinematic collision proxy.
- Give physical props stable identity independent of their physics body, render slots, procedural origin and current location. Preserve instancing and explicit teardown.
- Deliver empty-chair interactions, then occupied-chair bracing, dismounting, falling and recovery through existing person/activity authority.
- Make the existing camp cooler the next distinct physical object, retaining its appearance and adding explicit holder/attachment metadata as needed.
- Extend existing NPC beverages into transferable cups that can be held, placed in chair/cooler holders, dropped and recovered.
- Add sparse, useful signs at verified route choices and approaches to actual points of interest. Signs may topple or flatten and stay down; automatic repair is not a requirement.
- Add bounded incident attribution, material-sensitive sound, social reactions and later object retrieval/chair righting.
- Build a production-backed interaction playground before the feature, then validate one complete campsite and expand by evidence.

## Capabilities

### New Capabilities

- `physical-props`: identity, local simulation, rendering, support/attachment recipes, distance reset, budgets and lifecycle.
- `physical-person-reactions`: occupied support, graduated reactions, single movement authority, recovery and aftermath tasks.
- `drink-props`: existing beverage integration, holder/hand claims, release and bounded transfer.
- `festival-wayfinding`: route-aware sign placement, truthful destinations, readable rendering and damage retained until safe distance reset.
- `physical-interaction-harness`: repeatable production-backed encounters, inspection, lifecycle assertions and device acceptance.

### Modified Capabilities

- `registry-collision`: physical encounters have one response authority and do not also receive the legacy disc-overlap response.
- `crowd-ai`: opted-in ordinary crowd members can brace, stumble or fall before resuming behavior; existing non-participating populations retain their responses.
- `carts`: invulnerability suppresses repeated penalties without disabling the physical prop simulation; ghost mode remains a distinct policy.

## Impact

Proposed integration touches models, batched rendering, registry/collision, streaming, ordinary crowd activities, sound, scoring, deterministic world planning, tier budgets and sandbox entrypoints. A physics dependency and its asynchronous startup are candidates for implementation, not installed by this plan.

The work touches deterministic generation, shared-resource disposal, chunk/forest/lake ownership, frame budgets, material tiers and boot ordering. Keep iOS audio initialization synchronous in the start gesture. The current authoritative toolchain is Vite and ordinary ES imports; older OpenSpec/council text mentioning mandatory importmaps is stale. See [toolchain evidence](evidence.md#toolchain-and-verification).

Implementation is player-visible and requires same-commit CHANGELOG updates and accurate ROADMAP progress. Planning documents do not claim the feature has shipped.

## Scope Check

The source survey is recorded with line anchors in [evidence.md](evidence.md). Included: camp and stage chairs; loveseat occupants; chunk-, forest- and lake-owned camp props; the existing camp cooler; existing ordinary-crowd drink slots; person claims and hand authority; current contact, penalty and ghost-mode gates; deterministic roads and festival destinations.

The first integrated people are ordinary adult crowd members. Specialist populations, parade groups, riders, hidden activity participants and moving character vehicles retain their current policies until individually adapted and verified. Structural destruction, cloth simulation, liquid simulation, a replacement cart controller, a general navigation engine and full articulated ragdolls are not prerequisites; their worthwhile extensions remain explicitly recorded in [ideas.md](ideas.md), rather than silently becoming acceptance requirements.
