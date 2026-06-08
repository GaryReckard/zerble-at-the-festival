---
name: openspec-new-change
description: Start a new OpenSpec change using the experimental artifact workflow. Use when the user wants to create a new feature, fix, or modification with a structured step-by-step approach.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.0.2"
  customizedFor: zerble
---

Start a new change using the experimental artifact-driven approach.

**Input**: The user's request should include a change name (kebab-case) OR a description of what they want to build.

**Steps**

1. **If no clear input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add a balloon vendor" → `add-balloon-vendor`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Determine the workflow schema**

   Use the default schema (omit `--schema`) unless the user explicitly requests a different workflow.

   **Use a different schema only if the user mentions:**
   - A specific schema name → use `--schema <name>`
   - "show workflows" or "what workflows" → run `openspec schemas --json` and let them choose

   **Otherwise**: Omit `--schema` to use the default.

3. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```
   Add `--schema <name>` only if the user requested a specific workflow.
   This creates a scaffolded change at `openspec/changes/<name>/` with the selected schema.

4. **Create persistent memory files** (Zerble customization)

   Every change MUST have `session-log.md` and `questions-for-human.md` from the
   start. Create both in the change directory using the templates from
   `openspec/templates/`. These are the agent's persistent memory — the durable
   "why" trail that survives context compaction. The README front door and the
   deliberation record come later, via the schema (not here). See
   `.claude/rules/openspec.md` for the Event-Driven Writing Protocol.

   **`session-log.md`** — initialize with:
   - Frontmatter: `status: not_started`, `current_task: null`, `blocked_by: null`,
     `open_questions: 0`, today's date for `started`/`last_updated`, `ref` set to
     the CHANGELOG entry / ROADMAP bullet / commit this picks up (or null)
   - The section headers (Key Decisions, Assumptions, Dangling Threads, Work Log) — left empty
   - This log is **event-driven**: it stays empty until there's a decision, surprise,
     blocker, or question worth recording. Don't pre-fill a narrative or log "creating
     artifacts" — `tasks.md` checkboxes are the per-task record.

   **`questions-for-human.md`** — initialize with:
   - Frontmatter: `open: 0`, `answered: 0`, `last_question: null`, `last_answer: null`
   - Empty "Open Questions" and "Answered" sections

5. **Show the artifact status**
   ```bash
   openspec status --change "<name>"
   ```
   This shows which artifacts need to be created and which are ready (dependencies satisfied).

6. **Get instructions for the first artifact**
   The first artifact depends on the schema (e.g., `proposal` for spec-driven).
   Check the status output to find the first artifact with status "ready".
   ```bash
   openspec instructions <first-artifact-id> --change "<name>"
   ```
   This outputs the template and context for creating the first artifact (zerble's
   `config.yaml` context is auto-injected here).

7. **STOP and wait for user direction**

**Output**

After completing the steps, summarize:
- Change name and location
- Schema/workflow being used and its artifact sequence
- Current status (0/N artifacts complete)
- The template for the first artifact
- Prompt: "Ready to create the first artifact? Just describe what this change is about and I'll draft it, or ask me to continue."

**Scope Check (Required)** (Zerble customization)

Before drafting the proposal, search the codebase for other places where the
same pattern or behavior exists. The proposal MUST include a "Scope Check"
section that:
1. Identifies the pattern being changed
2. Lists other locations where the pattern exists (or states none were found)
3. Either includes all locations in scope or documents why some are excluded

Common parallel patterns in Zerble: a material/disposal pattern repeated across
`src/models/*`, a registry-entry shape repeated across theme builders, a
nightness-gated behavior repeated across systems, an importmap entry that must
appear in BOTH `index.html` and `sandbox.html`.

**Deliberation Gate (now a schema stage)** (Zerble customization)

Under the `zerble` schema, deliberation is a first-class artifact (`deliberation`)
that gates apply — always present but skippable. You don't run it at new-change
time; it comes after `tasks`. But flag it early if you already see a **risk signature**:
- Determinism changes (rng salts, hash2 inputs, seed/`rng()` call ordering in `rng.js`)
- Render-pipeline / `threeShim.js` / material-tier changes
- Boot-order or module-load changes
- World-lifecycle changes (chunk/forest/lake load-unload, disposal, `userData.shared`, lake-omits-chunkKey)
- Perf-budget-affecting geometry/draw/shadow additions
- iOS audio init-path changes (`sound.js`)
- importmap changes (must land in BOTH index.html and sandbox.html)

If a signature is present, tell the user this change will likely need a real
`/deliberate` at the deliberation stage (not a skip). For clearly trivial changes —
a single isolated model tweak, copy/README edits, doc-only changes — it can be
skipped there with a recorded rationale (`deliberations/000-skipped.md`).

**Guardrails**
- Do NOT create any artifacts yet - just show the instructions (the memory files in step 4 are not artifacts)
- Do NOT advance beyond showing the first artifact template
- If the name is invalid (not kebab-case), ask for a valid name
- If a change with that name already exists, suggest continuing that change instead
- Pass --schema if using a non-default workflow
