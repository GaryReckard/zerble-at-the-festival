---
description: Launch a multi-persona council deliberation on a task, plan, or design decision
---

Load the `multi-person-deliberation` skill and execute it at Tier 3 (Full
Deliberation) unless the user explicitly specifies another tier.

This command is a true council workflow, not a quick review. Do NOT satisfy
`/deliberate` with a single `general` agent.

Create the deliberation folder, write `briefing.md`, invoke the selected
`council-*` personas in parallel, then invoke the mediator to write `results.md`.
If no OpenSpec change is active, ask whether to create one with `/opsx:new`
first, or fall back to `.claude/deliberations/NNN-slug/` for an ad-hoc run.

Preflight checklist:
- `briefing.md` is created before persona launch.
- 3-5 real `council-*` sub-agents are invoked in parallel and each writes its own `council-*.md` file.
- `council-mediator` runs after the persona outputs exist and writes `results.md`.

Invalid implementation examples:
- One `general` task is asked to imitate multiple council personas. That is a quick review, not a full deliberation.
- The orchestrator writes inferred `council-*.md` outputs without actually invoking the corresponding `council-*` agents.

Success condition: do not report `/deliberate` complete unless the deliberation
folder contains `briefing.md`, the expected `council-*.md` persona files, and
`results.md`.

The user's `/deliberate` request counts as explicit approval to invoke the
selected `council-*` agents and the mediator.

The user wants to deliberate on the following:
$ARGUMENTS

If no arguments were provided, ask the user what they want to deliberate on.
For a lighter touch, the user can ask for a "quick review" (Tier 1) or name a
single persona like `@council-profiler` (Tier 2).
