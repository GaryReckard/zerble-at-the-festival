# Landscape and travel

> **Status:** <!--STATUS:LINE-->in progress · 33/36 tasks (91%)<!--/STATUS:LINE-->

## TL;DR

Build recognizable hills and mountains that shape the journey, with roads connecting broad camping meadows at different elevations and a sheltered drum-circle clearing beyond the crest. Streams and working bridges share the same landscape and travel rules. Begin with a small reusable engineering proof, then populate and generate complete districts once their routes and ownership are proven.

## The Problem

Broad hills currently disappear beneath flat gathering areas, and a bridge needs more than visible geometry: vehicles must stay on the correct level, avoid objects on other levels, and reach destinations through feasible routes. Building generation before proving those rules would spread uncertainty across the game.

## Proposed Fix

Use the [ordered execution plan](tasks.md). First record baseline behavior and implement pure support/solid contracts, then extend the existing terrain driving sandbox with two shelves, a steep bank, side road and a tiny stream crossing. That proof uses the real cart and shared geometry. After it passes, complete a populated mountain district, deterministic admission, finite water systems and all-consumer integration before enabling a new world version.

## Current checkpoint

The opt-in generation-2 game streams varied Mountain Top districts with dense irregular lower camping, sparse upper lawns/firepits, side roads and wooded descents to separate drum clearings. Native stream beds, water and working bridges share terrain/support truth with vehicles, people and activities. The merged main branch's default live physics shares terrain tiles, bridge slabs and landscape-owner leases, including chair/cooler and pedestrian reactions.

The recorded desktop implementation and verification checks pass, including full project checks/build, ready-plank game boots, Low/Mid/High captures, camera modes, repeated streaming/revisit and explicit owned-tab cleanup. A measured distant-owner rebuild loop is fixed, and road normals/UVs are prepared off-thread. [Current measurements and limitations](../../../verification/landscape/README.md#integrated-performance-and-desktop-acceptance) include construction outliers, adaptive quality changes and cold teleport spikes, so they do not establish phone performance.

**Next:** obtain physical iPhone/iPad and player recognition evidence before final tuning/rollout. Both seeded reports are corrected, with regressions for full toilet-row road clearance and Lurleen's uninterrupted ridge following. [Main integration](../../../verification/landscape/2026-11-01-main-integration.md) records the merged revision and verification limits. The [task checklist](tasks.md) remains the acceptance record.

## Progress

<!--STATUS:AUTO-->
**in progress** — 33/36 tasks complete (91%) · current: 9.2 (physical-device acceptance), then 9.3 (player recognition and route choice)

_Last updated: 2026-11-01_

| Group | Progress |
|---|---|
| 1. Establish the integration baseline | 2/2 ✅ |
| 2. Implement shared support and solid contracts | 3/3 ✅ |
| 3. Build the authored landscape engineering proof | 4/4 ✅ |
| 4. Make travel authoritative | 4/4 ✅ |
| 5. Build one complete populated mountain district | 4/4 ✅ |
| 6. Add bounded procedural admission | 4/4 ✅ |
| 7. Complete water systems and crossings | 4/4 ✅ |
| 8. Migrate all affected consumers and measure | 7/7 ✅ |
| 9. Release and preserve the handoff | 1/4 |
| Execution handoff rules | 0/0 |
<!--/STATUS:AUTO-->

## Key Decisions

- A district coordinates its meadows, connecting road and steep banks; occupied destinations are admitted only with feasible access.
- A selected supporting surface is read without side effects. Only accepted movement can commit a transition between ground and bridge.
- Test support, vertical collisions and reachable routes separately; grounded feet alone do not prove navigation.
- Reuse the existing terrain sandbox; keep default generation unchanged during the first proof.
- Preserve a future two-level hillside Barn without implementing it now. First aid remains a separate roadmap idea, and no early hill encounter is required.
- The [real council synthesis](deliberations/001-execution/results.md) gates the execution plan and separates first-slice corrections from later release acceptance.

## Risks & Watch-outs

Protect deterministic random streams, version intentional layout changes, preserve world ownership and pooled resources, and measure local refinement before scaling it. Current Vite instructions override stale importmap language in older workflow templates. Full-game and physical-device acceptance remain required even when the bounded proof passes. Concurrent physics and boot-recovery edits are outside this change's ownership.

## Where Things Live

- [Proposal](proposal.md): scope and affected systems.
- [Design](design.md): contracts, dependencies, first-proof defaults and failure behavior.
- [Tasks](tasks.md): ordered implementation checkboxes and finite fallback rules.
- [Capability requirements](specs/landscape-travel/spec.md): observable behavior.
- [Council synthesis](deliberations/001-execution/results.md): risk-gate result and required mitigations.
- [Evidence](evidence.md): baseline, experiment results and unverified limits.
- [Session log](session-log.md): decisions, current task and event history.
- [Questions](questions-for-human.md): no unanswered product decisions block the first proof.
- [Full design/reference photo](../../../docs/backlog/landscape-and-travel.md) and [fresh Astra critique](../../../docs/backlog/landscape-and-travel-astra-review.md): complete discussion.
