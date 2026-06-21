---
change: festival-zone-grammar
open: 0
answered: 1
last_question: "Q1"
last_answer: "Lean path now; full scope (extraction + crowd pre-roll) eventually as a follow-up."
---

# Questions for Human: festival-zone-grammar

> **AGENT DIRECTIVE:** Check this file when resuming work. If `open > 0`, present
> each unanswered question to the user before starting new work.

## Open Questions

*(none open)*

## Answered Questions

### Q1: Re-scope to the lean planner-only critical path?
**Date:** 2026-06-13
**Context:** The Group 0.5 spike (the council's recommended step) found, with code
evidence, that every failing linter rule is a PLANNER placement decision — the
`chunks.js` builders only render the planner's descriptors. The POI golden hashes the
plan (descriptors), not the build, and the crowd's tier-dependent draws live in the
builder, so they don't touch the golden the slotting commit moves. So the riskiest,
largest part the council worried about — the ~8-builder layout/mesh extraction (group 2)
and crowd pre-roll (group 1) — is **not required** to drive the error rules to zero.
**Question:** Proceed with the **lean path** — rewrite the planner (oriented-extent zone
slotting) + relocate the arch + add the registry backstop, one deliberate POI-golden
move, and **defer the builder extraction + crowd pre-roll to a follow-up cleanup change** —
OR keep the **full original scope** (behaviour-preserving extraction first, then grammar)?
**Impact:** The lean path is dramatically lower-risk and faster (no behaviour-preserving
8-builder refactor, the golden moves once at the planner commit), and still hits the
numeric success criterion. The full scope additionally delivers the D-C′ substrate +
the tier-dependence fix, at much higher risk/effort.

**ANSWER (2026-06-13, Gary):** Lean path now. "I'm cool with starting with this, but
want to eventually do the full scope. let's gooooooo." So: ship the lean planner-only
critical path as THIS change; the full builder extraction + crowd pre-roll is parked
on ROADMAP as the explicit follow-up (not dropped). **Action:** -> groups 1 & 2 marked
DEFERRED in tasks.md; -> D13 in session-log; -> ROADMAP "Festival worldgen v2" follow-up
bullet added.
