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

### Q1: Does hailing feel discoverable without crowding the grounds?
**Date:** 2026-11-15
**Context:** Hailing superseded the original 30% boarding proposal and first-boarder guarantee. Up to two nearby adults hail within 75 m, with a five-second refill interval; un-hailed riders ask with an 8% chance.
**Question:** Are the wave and bubble noticeable from the chase camera, and is the frequency comfortable in play?
**Impact:** Hailing constants in `src/quests/catalog.js`; the current values remain pending playtest feedback.

## Answered Questions
