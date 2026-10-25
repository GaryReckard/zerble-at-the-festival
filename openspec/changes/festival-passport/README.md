# Festival Passport
<!--STATUS:LINE-->
<!--/STATUS:LINE-->
## TL;DR
A browser-local record of exploration, smiles and festival memories, with incremental analytics for understanding play.
## The Problem
The score and bubble upgrades do not provide a complete record of a player's visits.
## Proposed Fix
A read-only passport with This visit / All time statistics and six descriptive stamps. GA receives independent increments, while local progress works without GA.
## Progress
<!--STATUS:AUTO-->
**complete** — 7/7 tasks complete (100%)

_Last updated: 2026-10-25_

| Group | Progress |
|---|---|
| 1. Foundation | 1/1 ✅ |
| 2. Integration | 2/2 ✅ |
| 3. Player view | 1/1 ✅ |
| 4. Verification and delivery | 2/2 ✅ |
| 5. Terrain integration | 1/1 ✅ |
<!--/STATUS:AUTO-->
## Key Decisions
Measure ground-plane travel independently of terrain. Opening the passport pauses gameplay. Preserve a visit only through settings restart. Implementation was isolated on codex/festival-passport, then verified with the committed terrain integration before updating the shared branch.
## Risks & Watch-outs
Local storage has no cross-device sync. Exploration records become ineligible after relocation. Importmaps cover all five pages, and audio stays synchronous.
## Where Things Live
[Proposal](proposal.md), [design](design.md), [requirements](specs/festival-passport/spec.md), [tasks](tasks.md), [council](deliberations/001-integration/results.md), [decisions](session-log.md), [questions](questions-for-human.md).
