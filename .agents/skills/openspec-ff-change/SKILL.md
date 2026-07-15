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
   `.Codex/rules/openspec.md` for the Event-Driven Writing Protocol.

   - **`session-log.md`** — frontmatter `status: not_started`, `current_task: null`,
     `blocked_by: null`, `open_questions: 0`, today's date, `ref` set to the
     CHANGELOG/ROADMAP/commit this picks up (or null); the section headers (Key
     Decisions, Assumptions, Dangling Threads, Work Log) left empty. The log is
     **event-driven** — leave it empty until there's a decision, surprise, blocker,
     or question worth recording; don't log "fast-forwarding through artifacts."
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

   b. **Continue until the FULL artifact set is created (not just `applyRequires`)**
      - After creating each artifact, re-run `openspec status --change "<name>" --json`
      - Keep creating any artifact whose dependencies are satisfied — including
        `deliberation` and `readme`, which sit after `tasks`. `readme` is NOT in
        `applyRequires`, so don't stop at `applyRequires`; stop only when no artifact
        is left `ready`.
      - **deliberation**: for a risky change run `/deliberate` and store output under
        `deliberations/NNN-<topic>/`; for a trivial change write
        `deliberations/000-skipped.md` with a one-line rationale (see the deliberation
        gate below).
      - **readme**: after writing the plain-language narrative, run
        `bin/readme-sync <name>` to fill the generated status block.

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

**Deliberation Gate (the `deliberation` artifact)** (Zerble customization)

Under the `zerble` schema, deliberation is an artifact created **after `tasks`** (it
reviews the finalized plan and gates apply). When you reach it, decide run-vs-skip by
checking for **Zerble risk signatures**:
- Determinism — `rng.js` salts, hash2 inputs, seed/`rng()` call ordering
- Render pipeline / `threeShim.js` / material-tier swap
- Boot-order or module-load changes
- World lifecycle — chunk/forest/lake load-unload, disposal, `userData.shared`, lake-omits-chunkKey
- Perf-budget-affecting geometry/draw/shadow additions
- iOS audio init path (`sound.js`)
- importmap changes (must land in BOTH index.html and sandbox.html)

If a signature is present, run `/deliberate` (store output under
`deliberations/NNN-<topic>/`; its `results.md` Change Groups feed/refine `tasks.md`).
If none is present and the change is clearly trivial, record the skip in
`deliberations/000-skipped.md` (name the signatures you checked + why it's safe).
Since ff favors momentum, a user "just do it" means **skip-with-rationale, not omit
the gate** — the gate is always satisfied one way or the other.

**Guardrails**
- Create the FULL artifact set (proposal → specs → design → tasks → deliberation → readme), not just `apply.requires` — `readme` sits past the apply gate, so stopping at `apply.requires` leaves it uncreated
- Always read dependency artifacts before creating a new one
- If context is critically unclear, ask the user - but prefer reasonable decisions to keep momentum
- If a change with that name already exists, suggest continuing that change instead
- Verify each artifact file exists after writing before proceeding to next
- The deliberation gate must end satisfied: verify `deliberations/NNN-slug/results.md` (ran) OR `deliberations/000-skipped.md` (skipped) exists before declaring apply-ready
- After writing the README, run `bin/readme-sync <name>` and confirm the status block populated
