---
description: Run a Tier 1 Quick Review on a task or plan (project alias for /council:review)
argument-hint: "[task, plan, or change to review]"
---

This is a project-local alias for the council plugin's `/council:review`. Load the council plugin's `deliberation-engine` skill and execute it at **Tier 1 (Quick Review)**, following the full contract of the plugin's review command:

- A single consolidated assessment (Architect + Auditor + Pragmatist lenses) via one general-purpose sub-agent. Do NOT invoke multiple personas or the Mediator.
- Read the project charter at `openspec/council/charter.md` for Non-Negotiables and the Domain Spec Index.
- When a matching active OpenSpec change exists, persist to `openspec/changes/<change-name>/reviews/NNN-slug/review-summary.md` (NNN increments from `001`); otherwise return the review in chat and note that no artifact was persisted.
- If the review reveals Tier 3 complexity, recommend escalating to `/deliberate`.

The user wants a quick review of the following:
$ARGUMENTS

If no arguments were provided, ask the user what they want reviewed.
