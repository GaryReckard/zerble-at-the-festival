# A coherent structure for festival people

> **Status:** <!--STATUS:LINE-->complete · 40/40 tasks (100%)<!--/STATUS:LINE-->

## TL;DR

Give festival inhabitants one clear way to participate in the game while preserving
their different behavior, lifetime policies, and rendering. Separate who a person
is from their current activity and visible model, then make movement authority,
interactions, and cleanup explicit.

**Planning, council, independent Astra review, implementation and all 40 acceptance
tasks are complete.** The generated
progress below tracks implementation separately from the completed planning exercise.

## The Problem

The crowd, children, parties, and performers already have useful specialized logic,
but the game connects them in different ways. Main orchestration enumerates their
updates, honk reactions, and collision sources, while activities can change a crowd
person's movement and appearance through private state. Those boundaries make it
hard to know which system has authority when a person joins an activity or leaves
the world. The [source inventory](brainstorm.md#what-the-code-establishes) records
the concrete examples; inconsistent freeze behavior was only the starting observation.

## Implemented ownership model

The structure gives each responsibility a clear home:

| Question | Answer |
| --- | --- |
| Who owns this person's lifetime? | One population controller, even when another activity borrows the person. |
| Who can move them now? | Their current validated activity or ordinary movement controller. A group can propose shared intent. |
| Who draws them? | A render binding that consumes pose, preserving adult instancing and specialized models. |
| How do they join the game? | Registration with a small population directory for ordered dispatch, supported capabilities, and inspection. |
| Who owns seats, instruments, or a place? | The existing vehicle or world owner, with explicit reservation and release rules. |
| What happens on removal? | Stop participation, revoke authority, release borrowers, detach publications, then dispose only owned resources. |

The migration proved **Healing Arts first and children second**, then applied the
contracts to the remaining owners. Healing Arts moved trajectory authority out of
its model, while children established independent identity/storage and common
participation without inheriting adult activity policy. See the
[technical design](design.md) and [implementation checklist](tasks.md).

## Before and after

[Open Gary’s visual](../../../verification/people/architecture.html) for the
side-by-side ownership map, or read the [source-grounded diagrams](architecture-visual.md).
They cover every family, the boundaries that changed, the specialization retained,
and the connection contract for future people/place behaviors.

## Implemented structure

All population/activity migrations are complete. The checklist below records
implementation acceptance separately from the earlier planning exercise. Registered specialized owners retain their storage, movement and rendering;
public handles/claims make borrowing and resource release explicit, while named
slots retain the game's scoring, streaming and render barriers. No autonomous person
loop or universal NPC superclass was introduced.

The [extension guide](extension-guide.md) provides a population/venue eligibility
matrix and an executable behavior across two storage types, two place adapters and
two render bindings. The [acceptance record](acceptance.md) accounts for all 17
coverage families, full ownership/failure contracts, actual game traces and matched
Low/Mid topology. It also records measured CPU overhead and physical-device limits,
so behavioral equivalence is not confused with intentional authority/cleanup or
clock corrections. The [dependency map](dependency-slots.md) explains the permanent
interleaving with non-person systems.

## Progress

<!--STATUS:AUTO-->
**complete** — 40/40 tasks complete (100%) · current: Complete: 40/40 implementation and acceptance tasks; available for review, no commit or archive

_Last updated: 2026-10-27_

| Group | Progress |
|---|---|
| 1. Verification and ownership foundation | 5/5 ✅ |
| 2. Two early ownership proofs and complete migration | 25/25 ✅ |
| 3. Continuous quality gates and final acceptance | 5/5 ✅ |
| 4. Extension guidance and audit-trail closeout | 5/5 ✅ |
<!--/STATUS:AUTO-->

## Key Decisions

- Keep specialized behavior and existing storage behind small public contracts;
  do not turn Crowd into a universal controller or introduce a full entity/component framework.
- Protect identity against both reused pool slots and replacement controllers.
  Activity tokens protect movement writes as well as cleanup.
- Let activities own motion and renderers consume it. Preserve Healing Arts'
  current sampling cadence explicitly during extraction.
- Keep necessary update slots interleaved with smile collection, scoring, streaming,
  and collisions. A single global update sequence is not the goal.
- Prove extension for populations, existing-person activities, and role/render
  variations. Merely removing branches from main is insufficient.

These decisions incorporate the [council synthesis](deliberations/001-architecture/results.md)
and [Astra review](astra-review.md); the [resolution record](review-resolution.md)
shows how their comments changed the draft.

## Risks & Watch-outs

The difficult parts are preserving gameplay timing, releasing claims in the right
order, retaining efficient batched rendering, and avoiding broader spatial scans.
The plan therefore starts with characterization and trustworthy module checks,
uses production-backed fixtures, and requires evidence for each migration slice.
The council records [15 prospective risks](deliberations/001-architecture/results.md#risk-register).

Runtime ownership and bounded Mac browser acceptance are established in the
[acceptance record](acceptance.md), with measured CPU costs and physical-device
limitations beside the evidence. Seeded generation, shared-resource safety,
independent day/night reads, synchronous mobile audio initialization and existing
vehicle/world ownership remain explicit constraints. A muted Mac run is not a
physical-phone audio or performance test.
AI replacement, population rebalance, a global event bus, and scheduling optimization
are evaluated alternatives outside this structural refactor.

## Where Things Live

- [Brainstorm](brainstorm.md): 24 candidate directions before ranking.
- [Critical evaluation](critical-evaluation.md): tradeoffs and initial recommendation.
- [Proposal](proposal.md): scope, affected systems, and capability changes.
- [Design](design.md): final responsibilities, contracts, migration, and acceptance.
- [Tasks](tasks.md): four groups of future implementation work.
- [People-runtime contract](specs/people-runtime/spec.md) and
  [crowd delta](specs/crowd-ai/spec.md): testable future requirements.
- [Council record](deliberations/000-index.md), [Astra review](astra-review.md), and
  [review resolutions](review-resolution.md): independent findings and decisions.
- [Session log](session-log.md), [question register](questions-for-human.md), and
  [planning verification](planning-verification.md): recovery state and evidence.
