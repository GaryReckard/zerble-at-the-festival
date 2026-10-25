# Bring rolling terrain into the festival

> **Status:** <!--STATUS:LINE-->in progress · 6/21 tasks (29%)<!--/STATUS:LINE-->

## TL;DR

Give the actual festival gentle hills while keeping its familiar horizontal layout, level gathering places and horizontal lakes. The map, driving harness and live game will share one height definition so the cart, people, roads and scenery all agree about where the ground is.

## The Problem

The bounded driving proof can demonstrate hills, but most real festival systems still assume that ground height is zero. Raising only the visible grass would bury roads and props, leave people floating and move lake or passenger attachments to the wrong height.

## Proposed Fix

Build the inspection tools and deterministic checks first, then derive broad hills and complete level pads from the existing planned festival. Convert the game ground and cart before grounding every remaining consumer, and verify a complete hub within rolling terrain with roads, camps and a neighboring lake before enabling the feature. The [technical design](design.md) defines the shared surface and its bounded preparation cost.

## Progress

<!--STATUS:AUTO-->
**in progress**: 6/21 tasks complete (29%)

_Last updated: 2026-10-25_

| Group | Progress |
|---|---|
| 1. Build the inspection and regression surface first | 0/3 |
| 2. Implement the canonical terrain service | 3/4 |
| 3. Integrate ground, cart and camera | 2/4 |
| 4. Ground all real world consumers | 1/6 |
| 5. Validate and release rolling terrain | 0/4 |
<!--/STATUS:AUTO-->

## Key Decisions

- Preserve the existing layout and random-number sequence; give terrain its own seed salt and fixtures.
- Use the same fixed triangles for visible ground and wheel contact, so contact accuracy does not depend on an approximation between two different surfaces.
- Prepare nearby terrain plans once and cache their vertices; do not run expensive festival planning for each ground sample.
- Level whole gathering and camping areas, including their outer pitches, and grade roads and shores into their shared anchors.
- Deliver bounded rolling country in this change; rare mountains and new route layouts require their own later scope.
- Record the efficiency-directed [council skip](deliberations/000-skipped.md) explicitly, retaining all required acceptance tests.

## Risks & Watch-outs

The [design risk table](design.md#risks--trade-offs) covers cache determinism, coarse ground transitions, dense planning cost, world ownership and tier performance. The [task checklist](tasks.md) requires real game boot, repeated unloading/revisiting and contact checks, because a passing isolated harness cannot establish complete integration. Mobile/iOS results must remain explicitly unverified unless actually performed.

## Where Things Live

- [Proposal](proposal.md): Motivation and scope.
- [Design](design.md): Surface, cache and consumer contracts.
- [Tasks](tasks.md): Implementation and acceptance checklist.
- [Specifications](specs/terrain-integration/spec.md): Shared terrain requirements, with [harness requirements](specs/sandbox-harness/spec.md).
- [Risk decision](deliberations/000-skipped.md): Explicit workflow exception and mandatory mitigations.
- [Session log](session-log.md): Durable decisions and assumptions.
- [Questions](questions-for-human.md): No unanswered human decisions at planning completion.
- [Original proposal](../../../verification/terrain/2026-10-24-proposal.md) and [integration sequence](../../../verification/terrain/2026-10-24-integration-plan.md): Prior evidence and context.

Current implementation and remaining acceptance: [October 25 evidence](../../../verification/terrain/2026-10-25-integration.md).
