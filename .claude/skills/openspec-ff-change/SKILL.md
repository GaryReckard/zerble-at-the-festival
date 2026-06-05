---
name: openspec-ff-change
description: Fast-forward through OpenSpec artifact creation. Use when the user wants to quickly create all artifacts needed for implementation without stepping through each one individually.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.0.2"
  customizedFor: zerble
---

Fast-forward through artifact creation - generate everything needed to start implementation in one go.

**Input**: The user's request should include a change name (kebab-case) OR a description of what they want to build.

**Steps**

1. **If no clear input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add a balloon vendor" → `add-balloon-vendor`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```
   This creates a scaffolded change at `openspec/changes/<name>/`.

3. **Create persistent memory files** (Zerble customization)

   Every change MUST have `session-log.md` and `questions-for-human.md` from the
   start. Create both using the templates from `openspec/templates/`. See
   `.claude/rules/openspec.md` for the Continuous Writing Protocol.

   - **`session-log.md`** — frontmatter `status: not_started`, `current_task: null`,
     `blocked_by: null`, `open_questions: 0`, today's date, `ref` set to the
     CHANGELOG/ROADMAP/commit this picks up (or null); all section headers;
     Current Status Phase = "Planning", Doing = "Fast-forwarding through artifacts".
   - **`questions-for-human.md`** — frontmatter `open: 0`, `answered: 0`,
     `last_question: null`, `last_answer: null`; empty Open/Answered sections.

4. **Get the artifact build order**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to get:
   - `applyRequires`: array of artifact IDs needed before implementation (e.g., `["tasks"]`)
   - `artifacts`: list of all artifacts with their status and dependencies

5. **Create artifacts in sequence until apply-ready**

   Use the **TodoWrite tool** to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is `ready` (dependencies satisfied)**:
      - Get instructions:
        ```bash
        openspec instructions <artifact-id> --change "<name>" --json
        ```
      - The instructions JSON includes `context` (zerble's config.yaml context),
        `rules`, `template`, `instruction`, `outputPath`, `dependencies`.
      - Read any completed dependency files for context
      - Create the artifact file using `template` as the structure
      - Apply `context` and `rules` as constraints - but do NOT copy them into the file
      - Show brief progress: "✓ Created <artifact-id>"

   b. **Continue until all `applyRequires` artifacts are complete**
      - After creating each artifact, re-run `openspec status --change "<name>" --json`
      - Stop when every artifact ID in `applyRequires` has `status: "done"`

   c. **If an artifact requires user input** (unclear context):
      - Use **AskUserQuestion tool** to clarify, then continue

6. **Show final status**
   ```bash
   openspec status --change "<name>"
   ```

**Output**

After completing all artifacts, summarize:
- Change name and location
- List of artifacts created with brief descriptions
- What's ready: "All artifacts created! Ready for implementation."
- Prompt: "Run `/opsx:apply` or ask me to implement to start working on the tasks."

**Artifact Creation Guidelines**

- Follow the `instruction` field from `openspec instructions` for each artifact type
- Read dependency artifacts for context before creating new ones
- Use `template` as the structure for your output file - fill in its sections
- **IMPORTANT**: `context` and `rules` are constraints for YOU, not content for the file —
  do NOT copy `<context>` / `<rules>` / `<project_context>` blocks into the artifact

**Scope Check (Required)** (Zerble customization)

Before drafting the proposal, search the codebase for other places the same
pattern or behavior exists. The proposal MUST include a "Scope Check" section
identifying the pattern, listing other locations (or stating none), and either
including them in scope or documenting why they're excluded. Common Zerble
parallels: a material/disposal pattern across `src/models/*`, a registry-entry
shape across theme builders, an importmap entry that must live in BOTH
`index.html` and `sandbox.html`.

**Deliberation Gate (Advisory)** (Zerble customization)

After creating the `proposal` artifact but BEFORE creating `tasks`, check for
**risk signatures**: determinism (`rng.js`), render-pipeline/`threeShim.js`/
material-tier, boot-order/module-load, world-lifecycle (chunk/forest/lake
disposal, `userData.shared`), perf-budget-affecting geometry, iOS audio init
(`sound.js`).

If a signature is detected:
> "This change touches **[risk area]**. Run `/deliberate` for a full
> multi-persona deliberation before finalizing tasks, or continue to skip."

- **If user runs `/deliberate`**: wait for the deliberation, then use
  `deliberations/NNN-slug/results.md` Change Groups to inform the `tasks` artifact.
- **If user skips or says "just do it"**: proceed directly to tasks.

Do NOT trigger for generic "3+ tasks", a single isolated model tweak, copy/README,
or doc-only changes.

**Guardrails**
- Create ALL artifacts needed for implementation (as defined by schema's `apply.requires`)
- Always read dependency artifacts before creating a new one
- If context is critically unclear, ask the user - but prefer reasonable decisions to keep momentum
- If a change with that name already exists, suggest continuing that change instead
- Verify each artifact file exists after writing before proceeding to next
- If deliberation was run, verify `deliberations/NNN-slug/results.md` exists before finalizing tasks
