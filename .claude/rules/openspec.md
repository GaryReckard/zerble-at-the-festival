---
paths:
  - "openspec/**"
---

# OpenSpec Workflow Details (Zerble)

OpenSpec is the optional spec-driven planning system for Zerble. It's **lazy and
intent-gated** — don't enumerate `openspec/changes/` on first message. This file
holds the operational details for when you're actively working in `openspec/`.

The project context the workflow uses lives in `openspec/config.yaml` (auto-injected
into `openspec instructions`). The hard tripwires live in `CLAUDE.md`.

## When to Use OpenSpec

| Scenario | Use OpenSpec? | Reason |
|----------|---------------|--------|
| New entity/system (3+ tasks) | **Yes** | Structured planning prevents scope creep |
| Multi-file refactor | **Yes** | Documents intent and scope |
| A change brushing a tripwire (determinism, threeShim, lifecycle, audio) | **Yes** | The session-log + deliberation gate earn their keep here |
| Single isolated model tweak | Optional | The sandbox loop is faster |
| Copy/tuning one-liner | No | Overhead not justified |

This is a solo hobby game with no Jira — OpenSpec is a planning aid, not a
mandate. The everyday audit trail is still **CHANGELOG + ROADMAP + git**.

## OpenSpec Commands

```
/opsx:new        Start a new change (proposal → specs → design → tasks)
/opsx:ff         Fast-forward: create all artifacts to apply-ready in one go
/opsx:continue   Create the next artifact
/opsx:apply      Implement tasks from a change
/opsx:verify     Verify implementation matches artifacts
/opsx:archive    Archive a completed change
/opsx:explore    Thinking partner for exploring an idea
/deliberate      Full multi-persona council (Tier 3) — see multi-person-deliberation
/smart-review    Multi-specialist code review of a diff — see smart-review
```

## OpenSpec Structure

```
openspec/
├── config.yaml                    # Zerble project context + rules (auto-injected)
├── templates/                     # session-log.md + questions-for-human.md templates
├── specs/                         # Source of truth for capabilities (subsystems)
└── changes/
    ├── <active-change>/
    │   ├── proposal.md
    │   ├── design.md              # (spec-driven schema)
    │   ├── specs/                 # delta specs
    │   ├── tasks.md
    │   ├── session-log.md          # Persistent memory — survives compaction
    │   ├── questions-for-human.md  # Async question queue
    │   ├── deliberations/NNN-slug/ # /deliberate output (if run)
    │   └── reviews/NNN-slug/        # /smart-review output (if run against this change)
    └── archive/
```

## Persistent Memory Files

**Every active change MUST have both `session-log.md` and `questions-for-human.md`.**
They are the only things that survive context compaction. Write to them
**continuously** — log intent before action, log results after action — so
compaction at any point leaves enough on disk to reconstruct what was happening.
Templates: `openspec/templates/`.

### `session-log.md`

**Frontmatter:** `change`, `status` (not_started|in_progress|blocked|paused|complete),
`current_task`, `blocked_by`, `open_questions`, `started`, `last_updated`, `ref`
(the CHANGELOG entry / ROADMAP bullet / commit this picks up — there is no Jira here).

**Sections:** Current Status (MUTABLE — updated in-place), Key Decisions
(APPEND-ONLY, D-numbered), Assumptions (table w/ Confidence/Status/Resolution),
Dangling Threads (APPEND-ONLY, strikethrough when resolved), Work Log
(APPEND-ONLY, newest at BOTTOM).

**Work Log entry:** `### YYYY-MM-DD HH:MM -- [Title]` with **Intent** (before),
**Result** (after), **Changed** (files/commits), **Refs** (cross-references).

### `questions-for-human.md`

**Frontmatter:** `change`, `open`, `answered`, `last_question`, `last_answer`.

**Question format:** `### Q[N]: [title]` with **Date**, **Context**, **Question**, **Impact**.

**Rules:**
1. New questions at the **top** (newest first), numbered sequentially.
2. When answered, move to the **Answered** section with the response.
3. **Always mention unanswered questions** at the end of your reply to the user.
4. Check for unanswered questions when resuming work.
5. Don't let questions block progress — state your assumption and proceed, noting
   "Proceeding with [assumption]. See Q[N]."

## Continuous Writing Protocol

These apply during `/opsx:apply` and `/opsx:continue`, not just at creation:

| Trigger | What to Write | Where | Update Frontmatter? |
|---------|---------------|-------|---------------------|
| Starting a task | Intent line in new Work Log entry | session-log | `current_task`, `status` |
| Completing a task | Result/Changed lines, update Current Status | session-log | `current_task` (next), `last_updated` |
| Making a key decision | Add to Key Decisions (D-numbered) | session-log | No |
| Discovering something unexpected | Work Log + Dangling Threads if unresolved | session-log | No |
| Hitting a question for human | Write question + cross-ref in Work Log | both files | `open_questions`, `open`, `last_question` |
| Human answers | Move to Answered | questions-for-human | `open`, `answered`, `last_answer` |
| Hitting a blocker | Update Current Status + Work Log | session-log | `status: blocked`, `blocked_by` |
| Committing code | Commit ref in Work Log Changed line | session-log | No |
| Shipping player-visible work | Reminder: CHANGELOG entry + ROADMAP trim in the SAME commit | (code repo) | No |

## Cross-Referencing Convention

| Reference | Meaning |
|-----------|---------|
| `-> Q3` | Question 3 in questions-for-human.md |
| `-> Task 7.2.1` | Task 7.2.1 in tasks.md |
| `-> D4` | Decision 4 in session-log Key Decisions |
| `-> A2` | Assumption 2 in session-log Assumptions |

When a question answer changes the plan: in the answer write
"**Action:** -> Task 7.7 added"; in the work entry write "Per -> Q8 answer,
added -> Task 7.7." When a dangling thread becomes a task, strikethrough it and
note "-> promoted to -> Task 7.4.5".

## Recovery Escalation Protocol (Minimal I/O)

1. **Enumerate:** list `openspec/changes/` (exclude `archive/`).
2. **Match:** use change name / subsystem keywords from the prompt.
3. **Hydrate one matched change only:** `session-log.md` (frontmatter + Current
   Status + latest Work Log entry), `tasks.md`, and `questions-for-human.md` only
   if `open_questions > 0`.
4. **Disambiguate:** if multiple candidates, read frontmatter only and ask one concise question.
5. **Do not** bulk-read all session logs unless the user asks for a cross-change audit.

## Integration with the Council & Review

- The **Deliberation Gate** in `/opsx:new` and `/opsx:ff` is advisory and fires on
  zerble risk signatures (determinism, threeShim/material-tier, boot order,
  lifecycle/disposal, perf budget, iOS audio). It points at `/deliberate`.
- `/deliberate` writes to `deliberations/NNN-slug/`; its `results.md` Change Groups
  feed the `tasks` artifact.
- `/smart-review` writes to `reviews/NNN-slug/` when run against an active change
  (otherwise `.claude/reviews/`).
