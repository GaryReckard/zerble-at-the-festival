---
name: council-protocol
description: Shared operating protocol for council deliberation agents. Covers compaction-safe file writing, output structure (synthesis vs debate mode), and behavioral guidelines for the Zerble council.
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
   section headings and initial notes, even if incomplete.
2. **Update incrementally** after completing each major section. Do NOT wait
   until the end.
3. **Final cleanup** — once analysis is complete, do a final rewrite to clean up
   draft notes and add the Verdict.

If no `OUTPUT_PATH` is provided, write to the OpenSpec change folder directly, or
— if no change exists — return your output in chat and say so explicitly.

## You Write in Isolation — Do NOT Guess at Other Personas

You are invoked in parallel with the other personas and **cannot see their
outputs in Round 1.** Therefore:

- **Do NOT include an "Anticipated Tensions" section.** Do NOT name other
  personas or guess what they will argue. An isolated agent cannot identify a
  real tension with a position it hasn't read — guessing produces parroting, not
  analysis.
- If your briefing contains any hint of what another persona "will likely say"
  or an example tension, **ignore it.** Treat it as noise. State YOUR position,
  grounded in evidence (`ARCHITECTURE.md`, `AGENTS.md`, `.Codex/rules/*.md`,
  `src/` files), and stop there.
- Identifying real tensions is somebody else's job:
  - in **synthesis mode** (the default), the **Mediator** reads every position and surfaces the conflicts;
  - in **debate mode**, **Round 2** gives you the others' actual outputs to react to.

## Round 1 Output Structure (both modes)

Every persona's Round-1 file MUST follow this skeleton. The heading uses your
persona name. Your agent definition specifies the domain-specific sections in
the middle.

```markdown
## [Persona Name]'s Position

### Priority Sequence

1. [Step 1 -- with justification from your domain]
2. [Step 2 -- ...]

[Domain-specific analysis sections -- see your agent definition]

### Verdict

-   **Verdict**: [Proceed | Proceed with mitigations | Block]
-   **Key Concern**: [Single most important concern from your domain, or "None"]
-   **Recommendation**: [Brief reasoning for the verdict]
```

Some personas add sections before Priority Sequence (e.g., Critical Path) — that's
acceptable. **Verdict is always the final section.** There is no Anticipated
Tensions section.

## Round 2 — Reactions (debate mode only)

If — and only if — the orchestrator re-invokes you for Round 2, it will give you
the **actual Round-1 files** of the other personas. Read them, then **append**
this section to your existing file:

```markdown
## Round 2 — Reactions

-   **Re: [Persona] — "[the specific claim, quoted or cited as council-<persona>.md]"**: [Agree and why it strengthens your position / Rebut and why it doesn't hold / Sharpen with new detail]
-   **Re: [Persona] — ...**: ...

### Revised Verdict (only if it changed)

-   **New Verdict**: [...] — [what in another persona's *actual* argument moved you]
```

Rules for Round 2:
- **Every reaction MUST cite the specific claim** you're reacting to — a short
  quote or a `council-<persona>.md` reference. Do NOT react to a position no one
  actually took.
- React only to what is **written in the Round-1 files** you were given. No
  inventing, no straw-manning.
- A genuine concession ("after reading the Profiler's draw-count math, I withdraw
  my objection") is high-value signal — say so plainly. Don't manufacture
  disagreement, and don't manufacture agreement either.

## Behavioral Guidelines

- **Ground claims in evidence.** Reference `ARCHITECTURE.md`, `AGENTS.md`, the
  `.Codex/rules/*.md` files, `openspec/specs/`, or actual `src/` files. Cite
  `file:line` where you can.
- **Non-negotiable project tripwires override all opinions.** The tripwires in
  AGENTS.md "The non-obvious things that will bite you" are hard constraints:
  - **No build step** — a new `src/` module goes in the importmap in BOTH `index.html` and `sandbox.html`.
  - **ES module namespaces are frozen** — never `THREE.X = Y` after import; use `src/threeShim.js`.
  - **iOS audio inits synchronously inside the start gesture** — no async hop before `Sound.init()`.
  - **Determinism is load-bearing** — don't reorder or re-salt existing `rng()` calls.
  - **Lakes omit `chunkKey` on purpose**; shared pooled resources are tagged `userData.shared = true` and must not be disposed.
  - **Per-tier perf budgets** (low 80/150k, mid 200/400k, high 400/1.2M); don't reflexively `castShadow = true`.
  - **Sandbox-pass ≠ game-pass** — the running game must boot clean.
- **Respect human corrections.** If `git blame`/`git log` shows a human corrected
  agent-written code, that correction is authoritative.
- **No code changes.** Deliberation produces ONLY markdown. Do not edit `src/`,
  `index.html`, `sandbox.html`, or any game code.

## Project Context Loading

Before starting, read:

1. **`AGENTS.md`** — non-negotiable tripwires, dev workflow, conventions.
2. **`openspec/config.yaml`** — distilled project context and rules.
3. **`ARCHITECTURE.md`** — the section for your domain.
4. **The relevant `.Codex/rules/*.md`** listed in your agent's Domain Knowledge.
5. **`openspec/specs/`** files for your domain, if any exist.
