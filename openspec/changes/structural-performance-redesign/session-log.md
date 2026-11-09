---
change: structural-performance-redesign
status: complete           # Completed investigation with no selected rewrite
current_task: null          # No further task is required for this investigation
blocked_by: null            # "Q3" | "dependency X" | null
open_questions: 0           # count of unanswered questions in questions-for-human.md
started: 2026-11-07
last_updated: 2026-11-07
ref: null                   # commit, CHANGELOG entry, or ROADMAP bullet this picks up, or null
---

# Session Log: Structural performance redesign

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

### Decisions recorded November 7

D1. **Preserve the current terrain work and use its qualified source as the baseline.** This goal edits diagnostic evidence and planning artifacts only, with source identity in [the manifest](../../../verification/performance/2026-11-07-structural-options/source-manifest.json).
D2. **Decline the tested exact-support certificate.** Strict replay passed, but cold costs regressed and warm timing showed no stable advantage. This rejects the tested mechanism, not every possible support optimization. See [the feasibility report](../../../verification/performance/2026-11-07-structural-options/support-probe-report.md).
D3. **Decline selecting explicit registry publication on current evidence.** The controlled Node saving was approximately 0.13 ms per frame with three declared movers, while the all-publishing sensitivity regressed; production static ownership is unproved. See [the registry report](../../../verification/performance/2026-11-07-structural-options/registry-probe-report.md).
D4. **Keep the remaining rendering experiment bounded by its actual mechanism.** The disposable build uses the unchanged existing child-presentation factory for nearby shopkeeper parts while retaining all rigs. It cannot establish a benefit from compact poses or a generic NPC rewrite. See [the declared discriminator](../../../verification/performance/2026-11-07-structural-options/render-discriminator-policy.md).

D5. **Close with no selected production rewrite after two full deliberations.** The second council independently reviewed tested and residual mechanisms and required no further discriminator. Exhaustive production planning is conditional on selection and remains inactive. See [the final synthesis](deliberations/002-selection/results.md).

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
### 2026-11-07 -- [Brief Title]
**Event:** decision | discovery | blocker | question | phase-change
**What:** [What happened and why it matters — the part a future reader can't reconstruct from the code or the checkboxes]
**Refs:** [cross-references: -> Q3, -> Task 7.2, -> D4]
-->

### 2026-11-07 -- Negative experiments and finite selection
**Event:** decision
**What:** Exact-support certificates and explicit registry ownership passed their exercised correctness surfaces but failed net-benefit selection; rig-retaining shopkeeper batching reduced draws without meaningful work savings. The second council and independent factual audit found no basis for a production rewrite, while preserving adult presentation and other mechanisms as unproved hypotheses. No third deliberation or further runtime experiment is required, and no production plan is fabricated for an unselected mechanism. All 303 baseline inputs remain unchanged, seven capture records covering 148 identities have no surviving owned process, and the task-owned keeper is stopped.
**Refs:** Decision 5 (no-selected-rewrite) above; [final synthesis](deliberations/002-selection/results.md); [factual audit](../../../verification/performance/2026-11-07-structural-options/final-fact-check.md).
