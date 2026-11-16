---
change: passenger-quests
open: 3
answered: 0
last_question: Q3
last_answer: null
---

# Questions for Human: passenger-quests

## Open Questions

### Q3: Is the timed porta-potty run welcome given "no timed missions"?
**Date:** 2026-11-15
**Context:** The design doc lists timed missions under "deliberately avoids", while the later backlog bullet asks for a countdown on "Gotta GO!".
**Question:** Keep the countdown as built (rare, 42 to 74 s, at most two smiles lost), or make it untimed?
**Impact:** One constant. Proceeding with the countdown.

### Q2: Are the reward sizes right for Festival Run?
**Date:** 2026-11-15
**Context:** Quests pay 7 to 12 raw smiles, urgent runs 10 to 15, mountaintop more. These multiply with combo and Lurleen like any smile.
**Question:** After a playtest, should these go up or down?
**Impact:** Constants in `src/quests/catalog.js`. Proceeding with the table in design.md.
**Update after audit 001:** hailing can supply fares much faster than the boarding roll the table was sized for. The audit's paper estimate is 40 to 55 raw smiles a minute while farming, against the Worker's placeholder ceiling of 40. This needs a measured playtest before the branch merges if Festival Run scores matter.

### Q1: Should 30% of boarders carry a quest?
**Date:** 2026-11-15
**Context:** The design doc leans 30%. The first boarder of a session always has one so the feature is discovered.
**Question:** Does that feel right in play?
**Impact:** One constant. Proceeding with 30%.
**Update 2026-11-15:** Superseded by hailing (session-log D10). The live questions are now whether two hailers within 75 m and a five-second refill feel right.

## Answered Questions
