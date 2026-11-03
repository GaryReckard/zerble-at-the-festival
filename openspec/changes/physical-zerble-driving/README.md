# Zerble can leave the ground

> **Status:** <!--STATUS:LINE-->complete · 12/12 tasks (100%)<!--/STATUS:LINE-->

## TL;DR
Zerble drives with suspension and momentum, so hills can launch him and uneven landings matter. Gary accepted the revised handling; the [focused handling pass](../../../verification/driving/2026-11-02/handling-pass.md) supplies the force controller and before/after replays. Road surfaces change grip and resistance, shallow water slows him, and deep submersion or accumulated crash damage ends play.

## The Problem
Before this change, the cart was attached to terrain height and water had an invisible barrier. New hills need airborne movement, coherent engine effort and useful consequences.

## Proposed Fix
Use the installed physics engine's vehicle controller with four wheel probes and one chassis, integrated into the existing clock and streamed collision ownership. Preserve friendly controls and provide a bounded driving course to inspect and replay.

## Progress
<!--STATUS:AUTO-->
**complete** — 12/12 tasks complete (100%) · Gary accepted the focused handling pass.

_Last updated: 2026-11-02_

| Group | Progress |
|---|---|
| 1. Contracts and proof | 2/2 ✅ |
| 2. Physical driving | 3/3 ✅ |
| 3. Terrain and consequences | 3/3 ✅ |
| 4. Verification and documentation | 3/3 ✅ |
| 5. Driving feel acceptance | 1/1 ✅ |
<!--/STATUS:AUTO-->

## Key Decisions
Keep one physical authority on land and in the air. Use actual water surfaces and beds. Both modes can end from water/damage, while only Festival Run uses its scoring submission path. Future repairs are outside this change but restoration has a supported API.

## Risks & Watch-outs
Collision support must exist before advancing; parked contacts must not drain health. Vehicle resources must be freed. No RNG draw ordering, Three shim or synchronous audio unlock changes are intended. Physical device acceptance is separate from desktop evidence.

## Where Things Live
- [Proposal](proposal.md), [design](design.md), [requirements](specs/physical-driving/spec.md) and [tasks](tasks.md).
- [Independent deliberation](deliberations/001-driving/briefing.md).
- [Session log](session-log.md) and [questions](questions-for-human.md).
