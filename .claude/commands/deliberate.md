---
description: Launch a multi-persona deliberation on a task or plan (project alias for /council:deliberate)
argument-hint: "[task, ticket ID, or OpenSpec change] [--debate]"
---

This is a project-local alias for the council plugin's `/council:deliberate`. Load the council plugin's `deliberation-engine` skill and execute it at **Tier 3 (Full Deliberation)**, following the full contract of the plugin's deliberate command:

- `/deliberate` is never internal: fan out to 3-5 real parallel `council-*` sub-agents (never a single general-purpose agent imitating them), then `council-mediator`.
- Read the project charter at `openspec/council/charter.md` first; if it is missing, stop and direct the user to `/council:init`.
- Synthesis mode by default; `--debate` / "argue it out" opts into the Round 2 cross-examination.
- Two cardinal rules always: personas write Round 1 in isolation (no anticipated tensions), and the briefing is never seeded with other-persona positions.
- Report completion only after `briefing.md`, the persona `council-*.md` files, and `results.md` exist in `deliberations/NNN-slug/`.

The user's `/deliberate` request counts as explicit approval to invoke the selected `council-*` agents and the mediator.

The user wants to deliberate on the following:
$ARGUMENTS

If no arguments were provided, ask the user what they want to deliberate on.
