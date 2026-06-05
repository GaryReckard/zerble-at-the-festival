---
description: Run a multi-specialist code review of your changes (fans out to review-* specialists, dedupes, synthesizes, persists)
---

Load the `smart-review` skill and execute it as the orchestrator yourself.

Resolve scope (default to staged changes), gather minimal context (diff + commit
subjects + any active OpenSpec change + CHANGELOG top), then fan out to the
applicable `review-*` specialists in **a single parallel batch**, deduplicate by
ownership, synthesize one verdict, and persist `review-summary.md` to
`openspec/changes/<change>/reviews/NNN-<slug>/` (if a change is active) or
`.claude/reviews/NNN-<slug>/` otherwise.

The specialists: `review-rendering`, `review-performance`, `review-gameplay`,
`review-audio`, `review-sandbox`, `review-docs`. Only invoke those whose owned
file list is non-empty for this diff.

Do NOT issue the specialist calls sequentially — they go in one parallel batch.
The "Specialists Used" line in the summary must reflect actual sub-agent
invocations.

The user wants to review the following (scope or files; blank = staged changes):
$ARGUMENTS
