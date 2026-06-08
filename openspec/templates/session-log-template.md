---
change: change-name-here
status: not_started        # not_started | in_progress | blocked | paused | complete
current_task: null          # task ID from tasks.md, or null
blocked_by: null            # "Q3" | "dependency X" | null
open_questions: 0           # count of unanswered questions in questions-for-human.md
started: YYYY-MM-DD
last_updated: YYYY-MM-DD
ref: null                   # commit, CHANGELOG entry, or ROADMAP bullet this picks up, or null
---

# Session Log: [Change Name]

> **AGENT DIRECTIVE:** This log is the "why" trail — it is **event-driven**, not a
> per-task diary. Write an entry only when a decision is made, something unexpected is
> discovered, a blocker is hit, or a question is raised for the human. Per-task progress
> lives in `tasks.md` checkboxes; the human-readable summary lives in `README.md`. To
> recover context, read `README.md`, then this file's frontmatter + Key Decisions + the
> latest Work Log entry, then `tasks.md`.

## Key Decisions
<!-- APPEND-ONLY. Number sequentially with D-prefix. The choices a future reader needs to
understand "why it's built this way" — e.g. why a fresh rng salt (vs reordering existing
calls), why this disposal ownership, which perf tradeoff was accepted, why this threeShim
path. -->

## Assumptions
<!-- Table format. Update Status/Resolution columns as verified. -->
| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|

## Dangling Threads
<!-- APPEND-ONLY. Open loops / things to come back to. Strikethrough when resolved, don't delete. -->

## Work Log
<!-- APPEND-ONLY, newest at BOTTOM. EVENT-DRIVEN — one entry per real event, NOT per task. -->

### Work Log Entry Format
<!--
### YYYY-MM-DD -- [Brief Title]
**Event:** decision | discovery | blocker | question | phase-change
**What:** [What happened and why it matters — the part a future reader can't reconstruct from the code or the checkboxes]
**Refs:** [cross-references: -> Q3, -> Task 7.2, -> D4]
-->
