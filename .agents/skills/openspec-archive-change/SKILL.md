---
name: openspec-archive-change
description: Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.0.2"
  customizedFor: zerble
---

Archive a completed change in the experimental workflow.

The actual move + spec-sync + validation is done by the **`openspec archive` CLI** — do NOT
hand-roll `mkdir`/`mv` or a manual spec sync. The skill's job is the Zerble-specific
pre-archive finalize (README status + session-log close-out), then delegating to the CLI.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Use the **AskUserQuestion tool** to let the user select. Show only active changes (not already archived). Include the schema if available.

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Finalize the README and memory (soft-gate) — BEFORE the move**

   Do this first so the finalized content is what gets archived.

   **README (front-door soft-gate):**
   - Run `bin/readme-sync <name>` so the status block reflects the final task state (it should read 100% / complete).
   - Read the durable prose one last time — this README is the lasting record a future reader opens first. Make sure TL;DR, Proposed Fix, Key Decisions, Risks & Watch-outs, and "Where Things Live" reflect what actually shipped (including any smart-review outcome). A stale README is the thing to fix before the change is frozen.

   **Update `session-log.md`:**
   - Add a final Work Log entry: "Archived. [one-line final state — tasks complete, specs synced or skipped, review outcome]."
   - Update frontmatter: `status: complete`, `current_task: null`, `blocked_by: null`, `last_updated` to today.

   **Update `questions-for-human.md`:** if any questions are still open, note they were archived unresolved (leave counts as-is for the historical record).

3. **Decide spec handling**

   Look at the change's capabilities (its `specs/` delta + the proposal's Capabilities section):
   - **Product/system capability** (something `openspec/specs/` should own — a render-pipeline, world-streaming, registry/collision, crowd-ai, audio-synthesis, perf-tier, models, or determinism behavior) → let the CLI sync it into the main specs (default).
   - **Process / tooling / docs-only change** (no product capability — e.g. an OpenSpec-workflow, `.Codex/**` config, or doc-only change) → archive with **`--skip-specs`** (the CLI's exact intended use for these). The delta spec, if any, stays in the archived change as the record.

4. **Archive via the OpenSpec CLI**

   ```bash
   openspec archive "<name>" -y            # syncs delta specs into openspec/specs/
   # or, for process/tooling/doc changes:
   openspec archive "<name>" -y --skip-specs
   ```

   The CLI handles everything: validates the change + delta specs, warns on incomplete tasks, syncs specs (unless `--skip-specs`), creates `openspec/changes/archive/YYYY-MM-DD-<name>/`, refuses if that target already exists, and moves the directory.

   - **`-y` is required here** — the agent runs non-interactively and cannot answer the CLI's `confirm()` prompts. `-y` accepts the incomplete-task and spec-update prompts. Only pass `-y` once you (and the user, if tasks are incomplete) actually intend to proceed.
   - **If the CLI aborts on validation errors**, surface them and fix the change — do NOT reach for `--no-validate` to paper over invalid specs. `--no-validate` is a last resort that itself requires confirmation.
   - The CLI moves with `fs.rename` (it is **not** a `git mv`). It does not stage anything in git.

5. **Stage the archive in git (only if the user is committing)**

   Because the move isn't a `git mv`, record the rename yourself when committing:
   ```bash
   git add "openspec/changes/<name>" "openspec/changes/archive/YYYY-MM-DD-<name>"
   ```
   Staging both the old (now-removed) and new paths lets git detect the rename. Since the finalize in Step 2 happened before the move, those edits are included. **Do not commit unless the user asked** — archiving and committing are separate.

6. **Display summary**

   - Change name + schema
   - Archive location (`openspec/changes/archive/YYYY-MM-DD-<name>/`)
   - Whether specs were synced or `--skip-specs` was used (and why)
   - Any incomplete-task / validation warnings the CLI reported

**Output On Success**

```
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs  (or  "Skipped (--skip-specs): <reason>")
```

**Guardrails**
- Delegate the move + spec-sync + validation to `openspec archive` — never hand-roll `mkdir`/`mv` or a manual sync.
- Always prompt for change selection if not provided.
- Run the README + memory finalize (Step 2) BEFORE the CLI move, so the archived content is final.
- Use `--skip-specs` for process/tooling/doc changes; let the CLI sync product/system capabilities.
- Don't bypass validation (`--no-validate`) to force an archive — fix the change instead.
- Don't commit unless explicitly asked; if committing, stage both old + new paths so git records the rename.
