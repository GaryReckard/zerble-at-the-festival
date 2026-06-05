---
name: council-protocol
description: Shared operating protocol for council deliberation agents. Covers compaction-safe file writing, output structure, and behavioral guidelines for the Zerble council.
---

# Skill: Council Deliberation Protocol

Shared operating protocol for all council personas on the Zerble project. Load
this skill before starting your analysis.

## File-Based Persistence (Compaction-Safe Writing)

**You MUST write your output to a file, not just return it in chat.** The
orchestrator provides an `OUTPUT_PATH` in your briefing (e.g.,
`openspec/changes/<change>/deliberations/NNN-slug/council-architect.md`). Use it.

### Three-Step Writing Strategy

Context compaction can occur at any time. To ensure your work survives:

1. **Write a skeleton immediately** after reading the briefing. Include all
   section headings and initial notes, even if incomplete. Use the Write tool
   to create the file at `OUTPUT_PATH`.
2. **Update incrementally** after completing each major section. Rewrite the
   file with the completed section added. Do NOT wait until the end.
3. **Final cleanup** — once all analysis is complete, do a final rewrite to
   clean up draft notes, ensure consistent formatting, and add the Verdict
   section.

If no `OUTPUT_PATH` is provided (standalone invocation), write to the OpenSpec
change folder directly, or — if no change exists — return your output in chat
and say so explicitly.

## Deliberation Output Structure

Every persona's output file MUST follow this skeleton. The heading uses your
persona name. Your agent definition specifies which domain-specific sections to
include in the middle.

```markdown
## [Persona Name]'s Order of Operations

### Priority Sequence

1. [Step 1 -- with justification from your domain]
2. [Step 2 -- ...]

[Domain-specific analysis sections -- see your agent definition]

### Anticipated Tensions

-   **Tension with [Persona]**: [Where your perspective diverges from theirs, with specific reasoning]

### Verdict

-   **Verdict**: [Proceed | Proceed with mitigations | Block]
-   **Key Concern**: [Single most important concern from your domain, or "None"]
-   **Recommendation**: [Brief reasoning for the verdict]
```

Some personas add sections before Priority Sequence (e.g., Critical Path) — that's
acceptable. Anticipated Tensions and Verdict MUST always be the final two sections.

Be specific in Anticipated Tensions — name the persona, state the disagreement,
and ground it in evidence from the docs or codebase. Tensions are where
deliberation gets its value.

## Behavioral Guidelines

- **Conflicts are expected, not forced.** Engage authentically from your
  perspective. If you genuinely agree with other personas, say so. Don't
  manufacture disagreement.
- **Ground claims in evidence.** Reference `ARCHITECTURE.md`, `CLAUDE.md`, the
  `.claude/rules/*.md` files, `openspec/specs/`, or actual `src/` files — not
  abstract principles. Cite `file:line` where you can.
- **Non-negotiable project tripwires override all opinions.** The tripwires in
  CLAUDE.md "The non-obvious things that will bite you" are hard constraints. No
  persona can override them, regardless of how many agree:
  - **No build step** — no bundler/transpiler; a new `src/` module goes in the
    importmap in BOTH `index.html` and `sandbox.html`.
  - **ES module namespaces are frozen** — never `THREE.X = Y` after import; use
    `src/threeShim.js`.
  - **iOS audio inits synchronously inside the start gesture** — no async hop
    before `Sound.init()`.
  - **Determinism is load-bearing** — don't reorder or re-salt existing `rng()`
    calls; new randomness gets a fresh salt constant.
  - **Lakes omit `chunkKey` on purpose**; shared pooled resources are tagged
    `userData.shared = true` and must not be disposed.
  - **Per-tier perf budgets** (low 80 draws/150k tris, mid 200/400k, high
    400/1.2M); don't reflexively `castShadow = true`.
  - **Sandbox-pass ≠ game-pass** — the running game must boot clean.
- **Respect human corrections.** If `git blame`/`git log` shows a human
  corrected agent-written code, that correction is authoritative. Flag any
  proposal that would revert it.
- **No code changes.** Deliberation produces ONLY markdown. Do not edit `src/`,
  `index.html`, `sandbox.html`, or any game code.

## Project Context Loading

Before starting your analysis, read:

1. **`CLAUDE.md`** — non-negotiable tripwires, dev workflow, conventions.
2. **`openspec/config.yaml`** — distilled project context and rules.
3. **`ARCHITECTURE.md`** — the canonical walkthrough; find the section for your domain.
4. **The relevant `.claude/rules/*.md`** files listed in your agent's Domain
   Knowledge section (e.g. `performance.md`, `sandbox-and-testing.md`,
   `no-build.md`, `perf-pooling.md`, `changelog-and-roadmap.md`).
5. **`openspec/specs/`** files for your domain, if any exist yet.

Your agent definition specifies which docs are most relevant to your
perspective. Prioritize those, but cross-reference others when a finding crosses
domains.
