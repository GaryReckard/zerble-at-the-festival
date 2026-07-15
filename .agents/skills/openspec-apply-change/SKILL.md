---
name: openspec-apply-change
description: Implement tasks from an OpenSpec change. Use when the user wants to start implementing, continue implementation, or work through tasks.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.0.2"
  customizedFor: zerble
---

Implement tasks from an OpenSpec change.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g., `/opsx:apply <other>`).

2. **Check status to understand the schema**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)

3. **Recover context (event-driven memory)**

   Recover where things stand from the change's files, in this order:

   a. **Read `README.md`** — the fastest human-readable picture of the change and its state.
   b. **Read `session-log.md`** — frontmatter (`status`, `current_task`, `blocked_by`, `open_questions`) plus Key Decisions and the latest Work Log entry (the "why" trail).
   c. **Read `tasks.md`** — the exact checkbox state is the per-task progress record.
   d. **Check `questions-for-human.md`** — if `open > 0`, present each unanswered question with the **AskUserQuestion tool** before proceeding. After answers, move them to Answered (update frontmatter) and reflect the new count in `session-log.md` (`open_questions`).

   If the memory files don't exist yet (legacy change), create them from `openspec/templates/`, initialized from the current state.

   **If context feels incomplete** (suspect compaction), recover recent history from the session transcript before proceeding. This supplements the files, it doesn't replace them.

   **Update `session-log.md` frontmatter only:** `status: in_progress`, `last_updated` to today. Do NOT add a Work Log entry just for resuming — the log is event-driven (write on decisions / surprises / blockers / questions, not on session start).

4. **Get apply instructions**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   This returns:
   - Context file paths (varies by schema - could be proposal/specs/design/tasks or spec/tests/implementation/docs)
   - Progress (total, complete, remaining)
   - Task list with status
   - Dynamic instruction based on current state

   **Handle states:**
   - If `state: "blocked"` (missing artifacts): show message, suggest using openspec-continue-change
   - If `state: "all_done"`: congratulate, suggest archive
   - Otherwise: proceed to implementation

5. **Read context files**

   Read the files listed in `contextFiles` from the apply instructions output.
   The files depend on the schema being used:
   - **spec-driven**: proposal, specs, design, tasks
   - Other schemas: follow the contextFiles from CLI output

6. **Show current progress**

   Display:
   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview
   - Dynamic instruction from CLI

7. **Implement tasks (loop until done or blocked)**

   For each pending task:
   - Show which task is being worked on; update `session-log.md` frontmatter `current_task`.
   - Make the code changes required; keep them minimal and focused.
   - Mark the task complete in `tasks.md`: `- [ ]` → `- [x]`. **The checkbox is the per-task progress record — do NOT also write a Work Log entry per task.**
   - Continue to the next task.

   **Refresh the README at milestones:** after finishing a task **group** (a `## N.` section in tasks.md), run `bin/readme-sync <change-name>` to update the README status block.

   **Write to `session-log.md` only on events** (event-driven, not per-task):
   - **Key decision** → Key Decisions entry (D-numbered).
   - **Unexpected discovery** → Work Log entry; Dangling Thread if unresolved.
   - **Question for the human** → write to `questions-for-human.md`, bump `open_questions` in session-log frontmatter, cross-ref `-> Q[N]`.
   - **Blocker** → Work Log entry + frontmatter `status: blocked`, `blocked_by: <description>`.

   Remember the Zerble tripwires while you work (determinism, threeShim/material-tier, iOS audio, disposal safety, importmap-in-both-html, per-tier perf budget) and that **sandbox-pass ≠ game-pass** — boot the main game before marking an entity/world task done.

   **Pause if:**
   - Task is unclear → ask for clarification
   - Implementation reveals a design issue → suggest updating artifacts
   - Error or blocker encountered → report, set `status: blocked` / `blocked_by`, and wait for guidance
   - User interrupts

8. **On completion or pause, finalize**

   **Refresh the README:** run `bin/readme-sync <change-name>` so the status block reflects the final task state.

   **Update `session-log.md`:**
   - Frontmatter: `status` (complete/paused/blocked), `current_task`, `last_updated`.
   - Add a Work Log entry ONLY if there's something worth recording (a decision, a surprise, a blocker, or a one-line phase-change note). A clean run that just ticked boxes needs no prose entry.

   **Display to user:**
   - Tasks completed this session; overall progress "N/M tasks complete"
   - If all done: suggest `/opsx:verify`, then archive. Set frontmatter `status: complete`.
   - If paused: explain why and wait for guidance
   - If `open_questions > 0`: mention unanswered questions in `questions-for-human.md`

**Output During Implementation**

```
## Implementing: <change-name> (schema: <schema-name>)

Working on task 3/7: <task description>
[...implementation happening...]
✓ Task complete

Working on task 4/7: <task description>
[...implementation happening...]
✓ Task complete
```

**Output On Completion**

```
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

All tasks complete! Ready to archive this change.
```

**Output On Pause (Issue Encountered)**

```
## Implementation Paused

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Guardrails**
- Keep going through tasks until done or blocked
- Always read context files before starting (from the apply instructions output)
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each task
- Update task checkbox immediately after completing each task
- Pause on errors, blockers, or unclear requirements - don't guess
- Use contextFiles from CLI output, don't assume specific file names

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly
