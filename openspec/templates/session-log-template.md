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

> **AGENT DIRECTIVE:** After compaction or new session, read this file + tasks.md
> before doing anything else. Read frontmatter, then Current Status, then latest
> Work Log entry.

## Current Status
<!-- MUTABLE: This is the ONE section that gets updated in-place, not appended. -->
**Phase:** [current phase/area of work]
**Doing:** [specific task in progress, or "nothing -- awaiting direction"]
**Next:** [what comes after current task]
**Blocked:** [nothing | description of what's blocking]

## Key Decisions
<!-- APPEND-ONLY. Number sequentially with D-prefix. -->

## Assumptions
<!-- Table format. Update Status/Resolution columns as verified. -->
| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|

## Dangling Threads
<!-- APPEND-ONLY. Strikethrough when resolved, don't delete. -->

## Work Log
<!-- APPEND-ONLY. Newest entries at BOTTOM. -->

### Work Log Entry Format
<!--
### YYYY-MM-DD HH:MM -- [Brief Title]
**Intent:** [What I'm about to do and why -- written BEFORE starting]
**Result:** [What happened -- written AFTER completing]
**Changed:** [Files created/modified, commits made]
**Refs:** [cross-references to questions, tasks, decisions]
-->
