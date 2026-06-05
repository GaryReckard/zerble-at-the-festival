---
name: multi-person-deliberation
description: "Adaptive deliberation engine for Zerble. Selects 3-5 from specialized personas + Mediator to produce divergent plans, find tensions, and synthesize a unified strategy as Change Groups."
license: MIT
metadata:
  author: zerble
  version: "1.0"
---

# Skill: Multi-Person Deliberation

## Trigger

Activate this skill when ANY of these conditions are met:
- User says `/deliberate` or `/deliberation`
- User asks for "a council", "multiple perspectives", "deliberate this", or to
  "stress-test" a plan or design
- User asks about "prioritization" or "strategy" for a complex change

## Overview

This skill orchestrates an adaptive deliberation — personas selected from a
fleet of seven, plus the Mediator (the Sage) — to produce divergent
implementation plans, identify tensions between them, and synthesize a unified
strategy as Change Groups. It is tuned to Zerble: a no-build browser game where
the real risk lives in determinism, the three.js render path, per-tier perf
budgets, the audio gesture chain, and the sandbox/boot verification surface.

### Execution Contract

- When invoked via `/deliberate`, **Tier 3 (Full Deliberation)** is the default
  unless the invoking command or user prompt explicitly specifies another tier.
- `/deliberate` is a true council workflow: create `deliberations/NNN-slug/`,
  write `briefing.md`, invoke 3-5 `council-*` personas as real parallel
  sub-agents, have each persona write its own `council-*.md`, invoke the
  mediator, and write `results.md`.
- Do not report Tier 3 complete until the artifact-based Definition of Done is
  satisfied.

The engine operates in **three tiers** based on task stakes:

| Tier | Name                  | Personas       | Use Case                                                                  | Est. Tokens |
| ---- | --------------------- | -------------- | ------------------------------------------------------------------------- | ----------- |
| 1    | **Quick Review**      | 1 consolidated | Routine model tweaks, copy changes, small refactors                       | ~5K         |
| 2    | **Domain Specialist** | 1 specialist   | When a single lens dominates (Perf, Adversary, Experience)                | ~8K         |
| 3    | **Full Deliberation** | 3-5 + Mediator | High-stakes: determinism, threeShim/material-tier, boot order, lifecycle  | ~30-50K     |

### Tier Routing

Apply this precedence in order:

1. An explicit tier in the invoking command or user prompt wins.
2. An explicit `/deliberate` invocation defaults to **Tier 3 (Full Deliberation)**.
3. An explicit domain specialist invocation (e.g. `@council-profiler`) defaults to **Tier 2**.
4. A request phrased as "quick review", "quick take", or "sanity check" → **Tier 1**.
5. Only otherwise fall back to task-stakes routing.

- **Tier 1 (Quick Review)**: A single sub-agent call using the `general` agent
  type with a consolidated multi-lens prompt (Architect + Auditor + Pragmatist
  perspectives). Output: lightweight `review-notes.md`.
- **Tier 2 (Domain Specialist)**: User explicitly invokes one persona. No
  orchestration, no Mediator. Output: the agent's native standalone format.
- **Tier 3 (Full Deliberation)**: 3-5 personas + Mediator. Output:
  `deliberations/NNN-slug/` folder with `briefing.md`, `council-{persona}.md`
  files, and `results.md`.

### Non-Negotiable Rules

- Do NOT downgrade an explicit `/deliberate` request to Tier 1.
- Do NOT satisfy `/deliberate` with a single `general` agent imitating multiple voices.
- Do NOT infer persona opinions from agent description files.
- Invoke the selected `council-*` sub-agents for real, in parallel.
- The user's `/deliberate` request counts as explicit approval to invoke the
  selected `council-*` agents and the mediator.
- Do NOT report Tier 3 complete unless `briefing.md`, the expected
  `council-*.md` files (subject to Step 6 partial-failure rules), and
  `results.md` exist.

### Tier 3 Definition of Done

A Tier 3 deliberation is complete only when all of the following are true:

- `deliberations/NNN-slug/briefing.md` exists.
- `deliberations/NNN-slug/council-*.md` exists for 3-5 personas, subject to the
  partial-failure rules in Step 6.
- `deliberations/NNN-slug/results.md` exists.

### The Fleet

| Persona            | Agent                    | Lens                                                      | Best For                                                         |
| ------------------ | ------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------- |
| **Architect**      | `council-architect`      | Structural integrity, ARCHITECTURE.md adherence, module boundaries | New systems/models, registry/lifecycle, render-pipeline shape |
| **Maverick**       | `council-maverick`       | Innovation, impact, scope reduction                       | Feature ideas, alternative approaches, "do we even need this"    |
| **Pragmatist**     | `council-pragmatist`     | Force multipliers, ship-it-now vs park-on-ROADMAP         | Critical path, incremental slices, effort reality-checks         |
| **Auditor**        | `council-auditor`        | Conventions, no-build/importmap, pooling, CHANGELOG       | Refactors, new-model completeness, disposal safety, hygiene      |
| **Anthropologist** | `council-anthropologist` | Player feel + agent/dev experience (the harness)          | UI/feel changes, the sandbox surface, onboarding the next agent  |
| **Profiler**       | `council-profiler`       | Per-tier draw/tri budgets, shadows, instancing, alloc-vs-steady | Perf work, geometry-adding features, mobile/low-tier risk   |
| **Adversary**      | `council-adversary`      | What breaks: determinism, Safari freeze, iOS audio, sandbox-pass-game-crash | Tripwire-adjacent work, boot order, lifecycle disposal |

### The Mediator (The Sage)

| Persona      | Agent              | Role                                                                                   |
| ------------ | ------------------ | -------------------------------------------------------------------------------------- |
| **Mediator** | `council-mediator` | Always included in Tier 3. Synthesizes friction into a Final Priority Path as Change Groups. |

## Instructions

### Step 1: Understand the Task

If no clear task is provided, ask:
> "What change or decision should the Council deliberate on? Provide a
> description, an OpenSpec change name, or a ROADMAP item."

Gather the full context:
- Read any referenced OpenSpec change artifacts (`openspec/changes/<name>/`)
- Read relevant `openspec/specs/` if any exist
- Read `CLAUDE.md`, `openspec/config.yaml`, and the relevant `ARCHITECTURE.md`
  section(s) for the subsystem in play
- Skim `ROADMAP.md` — the idea may already be parked or considered

### Step 2: Determine Tier

Apply the routing precedence above. If no explicit route, use task-stakes triggers.

**Tier 3 triggers** — escalate to Full Deliberation if ANY apply:
- **Determinism**: touches `rng.js`, `hash2`, seed salts, or anything that would
  regenerate existing chunks/forests/lakes differently
- **Render-pipeline / module boot order**: `threeShim.js`, the
  `MeshStandardMaterial` tier swap, importmap/module-load changes, post-process
  pass wiring
- **World lifecycle**: `chunks.js`, `world.js`, forests, lakes, registry
  `chunkKey` lifecycle, disposal/`userData.shared` handling
- **Audio init path**: the iOS gesture unlock chain in `sound.js`
- **Perf-budget**: a change expected to move draws/tris/shadow-casters near a
  tier budget
- **Cross-cutting**: changes affecting 5+ files across 3+ subsystems
- User explicitly requests `/deliberate`

**Tier 2 triggers**: user invokes one persona by name, or a single domain
concern dominates ("just check this for perf" → `@council-profiler`).

**Tier 1 (default only when no higher route applies)**: everything else.

If you detect a Tier 3 trigger but the user only asked for a quick take, inform them:
> "This change touches **[risk area]**. A Full Deliberation (Tier 3) may be more
> appropriate — run `/deliberate` to escalate, or I'll proceed with a Quick Review."

### Step 3 (Tier 1): Quick Review

Use a single `general` sub-agent. The prompt combines three lenses:

1. **Structural** (Architect): Does this align with ARCHITECTURE.md patterns and the registry/lifecycle model?
2. **Quality** (Auditor): Conventions, no-build/importmap completeness, pooling/disposal, CHANGELOG/ROADMAP discipline. Did the plan search for other places this pattern exists?
3. **Delivery** (Pragmatist): What's the critical path? Can it ship as a smaller slice, or be parked on ROADMAP?

Write a `review-notes.md` to the OpenSpec change folder (if one exists):

```markdown
# Quick Review

## Task
[Brief description]

## Structural Assessment
- [Architect lens]

## Quality Assessment
- [Auditor lens]
- [Scope completeness: did the plan look for parallel pattern locations?]

## Delivery Assessment
- [Pragmatist lens]

## Tripwires Touched
- [Any of: determinism, threeShim, iOS audio, disposal, importmap, perf budget — or "none"]

## Verdict
[Proceed | Proceed with mitigations | Block]

## Escalation Recommendation
[If complexity warrants Tier 3: "Consider running /deliberate for a full deliberation."]
```

Present results and stop.

### Step 3 (Tier 2): Domain Specialist

Invoke the requested persona directly as one sub-agent task. No Mediator. It
produces its native output format; write it to the OpenSpec change folder if one
exists. Present results and stop.

### Step 3 (Tier 3): Full Deliberation — Select the Council

#### Selection Matrix

**3 personas + Mediator** (default for Tier 3):

| Task Characteristic              | Recommended Personas                       |
| -------------------------------- | ------------------------------------------ |
| New model / visual entity        | Architect + Anthropologist + Profiler      |
| New gameplay system (greenfield) | Architect + Maverick + Adversary           |
| Bug fix / "looks frozen" / crash | Adversary + Auditor + Pragmatist           |
| Refactor / tech debt             | Architect + Auditor + Pragmatist           |
| Performance optimization         | Profiler + Pragmatist + Architect          |
| Feature prioritization / scope   | Maverick + Pragmatist + Adversary          |
| World-gen / chunk-lifecycle change | Architect + Adversary + Profiler         |
| Player feel / UI / HUD           | Anthropologist + Maverick + Pragmatist     |
| Dev tooling / sandbox / harness  | Anthropologist + Pragmatist + Auditor      |
| Audio change                     | Adversary + Anthropologist + Profiler      |

**5 personas + Mediator** (escalated Tier 3, for high-stakes work):

| Task Characteristic              | Recommended Personas                                          |
| -------------------------------- | ------------------------------------------------------------- |
| Determinism / rng-seeding change | Adversary + Architect + Auditor + Profiler + Pragmatist       |
| threeShim / material-tier change | Architect + Adversary + Profiler + Auditor + Anthropologist   |
| Boot-order / module-load change  | Architect + Adversary + Auditor + Pragmatist + Profiler       |
| Large new system (broad scope)   | Architect + Maverick + Anthropologist + Profiler + Adversary  |
| Major refactor across subsystems | Architect + Auditor + Pragmatist + Profiler + Adversary       |

If the task doesn't clearly match a row, ask the user which personas they want,
presenting the matrix as context.

### Step 4 (Tier 3): Brief the Council

Prepare a **shared briefing** each persona receives. **Write it to
`deliberations/NNN-slug/briefing.md` before invoking personas.**

To determine the folder number:
1. Check if `deliberations/` exists in the change folder.
2. If it does, find the highest existing `NNN-*` folder number and increment by 1.
3. If it doesn't, start with `001`.
4. The slug is a short descriptive label (e.g., `initial`, `revised-scope`).

Create the folder:
```bash
mkdir -p openspec/changes/<change-name>/deliberations/NNN-slug
```

If there is no OpenSpec change yet, ask whether to create one with `/opsx:new`
first, or fall back to `.claude/deliberations/NNN-slug/` for an ad-hoc
deliberation not tied to a change.

The briefing must include:

```
# Deliberation Briefing: [Topic]

## Task
[Clear description of what needs to be decided/planned]

## Context
- **OpenSpec Change**: [path if applicable]
- **ROADMAP item**: [if applicable]
- **Subsystem(s)**: [render-pipeline | world-streaming | registry-collision | crowd-ai | audio | perf-tiers | models | sandbox-harness]
- **Files Affected**: [list of key src/ files]
- **ARCHITECTURE.md sections relevant**: [list]

## Constraints (the tripwires — non-negotiable)
- No build step; a new src/ module goes in the importmap in BOTH index.html AND sandbox.html
- ES module namespaces are frozen — no THREE.X = Y after import; tier overrides via src/threeShim.js
- iOS audio inits synchronously inside the start gesture — no async hop before Sound.init()
- Determinism is load-bearing — don't reorder/re-salt existing rng() calls
- Lakes omit chunkKey on purpose; shared pooled resources tagged userData.shared = true must not be disposed
- Per-tier perf budgets: low 80 draws/150k tris, mid 200/400k, high 400/1.2M; don't reflexively castShadow = true
- A new model is not done until it has a sandbox entry (importmap x2 + dropdown + loadEntity + hit kind + music style)
- Sandbox-pass ≠ game-pass — the running game must boot clean

### Your Output
Write your full deliberation to: `[OUTPUT_PATH]`
Return a brief summary to the orchestrator containing: your Verdict, Key Concern, and 3 bullet points.

### Your Task
1. Propose your prioritized order of operations for this task.
2. Identify risks/concerns from YOUR perspective.
3. Identify anticipated tensions with other approaches where they genuinely exist.
4. Write your full output to the file path specified above.
```

The orchestrator MUST replace `[OUTPUT_PATH]` with the actual file path for each
persona before sending the briefing (e.g.,
`openspec/changes/<change-name>/deliberations/NNN-slug/council-architect.md`).

### Step 5 (Tier 3): Invoke Personas (Parallel)

Launch all selected personas as **parallel sub-agent tasks** in a single
message. Each receives:

- The shared briefing from Step 4 (with `[OUTPUT_PATH]` replaced)
- Their specific role (from their agent `.md` file)
- Instruction to write their full output to their designated `council-{persona}.md`
- Instruction to return only a brief summary to the orchestrator (Verdict, Key Concern, 3 bullets)

For `/deliberate`, the orchestrator MUST NOT substitute a single `general` agent
or an inferred council summary for the selected personas. Tier 3 requires real
parallel `council-*` sub-agent invocations.

Persona-to-filename mapping:

| Agent ID                  | Output Filename              |
| ------------------------- | ---------------------------- |
| `council-architect`       | `council-architect.md`       |
| `council-maverick`        | `council-maverick.md`        |
| `council-pragmatist`      | `council-pragmatist.md`      |
| `council-auditor`         | `council-auditor.md`         |
| `council-adversary`       | `council-adversary.md`       |
| `council-anthropologist`  | `council-anthropologist.md`  |
| `council-profiler`        | `council-profiler.md`        |

**After all personas complete**, verify each expected `council-*.md` file
exists. If a file is missing, treat that persona as failed (see Step 6).

Report progress:
> "Deliberation in progress: [N] personas analyzing..."

### Step 6 (Tier 3): Handle Partial Failures

After all persona calls return, verify each expected file exists:

- **All exist**: Proceed to Step 7.
- **1 of 3+ failed** (file missing): Proceed to Step 7; the Mediator synthesizes with available outputs and notes the gap.
- **2+ of 3 fail (or 3+ of 5)**: Abort. Report: "Deliberation failed: [N] of [M] personas did not respond. Try again or reduce to a Quick Review."
- **Mediator fails** (Step 7): Present the persona summaries and direct the user to the full `council-*.md` files.

### Step 7 (Tier 3): Invoke the Mediator

Pass the **deliberation folder path** and the **persona summaries** to
`council-mediator`:

> "You have received summaries from [N] personas. This is a Tier 3 Full
> Deliberation. Read each `council-*.md` file in the deliberation folder for
> full proposals. Synthesize them into a unified plan using your resolution
> hierarchy. Write the output as `results.md` in the same folder."

Provide the Mediator with:
- The deliberation folder path
- The list of persona files to read
- The brief summaries returned by each persona
- If any persona failed: "Note: [Persona] did not respond. Synthesize with available outputs and note the gap."

### Step 8 (Tier 3): Present Results

Before reporting completion, verify `briefing.md`, `results.md`, and the
expected `council-*.md` files exist (subject to Step 6). If not, report the
failure instead of claiming completion.

After the Mediator completes, present:

```
**Council Deliberation Complete**

**Tier**: 3 (Full Deliberation)
**Personas Consulted**: [selected personas] + Mediator
**Artifacts**:
  - Briefing: `.../deliberations/NNN-slug/briefing.md`
  - Persona outputs: `council-{persona}.md` (x[N])
  - Synthesis: `.../deliberations/NNN-slug/results.md`

**Convergence** (all agreed):
- [Point 1]

**Key Conflict Resolved**:
- [The most significant disagreement and how it was resolved]

**Change Groups**:
1. [Group 1 Name] — [N tasks]
2. [Group 2 Name] — [N tasks]

**Risk Register**: [N] risks identified, [M] critical

**Next Step**: [Proceed to implementation with /opsx:apply, or revise the plan]
```

## OpenSpec Integration

### Advisory Deliberation Gate

For OpenSpec changes created via `/opsx:new` or `/opsx:ff`, the deliberation
gate triggers on **specific risk signatures**, not generic complexity:

**Risk signatures that trigger the advisory gate:**
- Determinism changes (rng salts, hash inputs, seed ordering)
- Render-pipeline / threeShim / material-tier changes
- Boot-order or module-load changes
- World-lifecycle changes (chunk/forest/lake load-unload, disposal, `userData.shared`)
- Perf-budget-affecting geometry/draw additions
- iOS audio init-path changes

When a signature is detected:
> "This change touches **[risk area]**. A quick review is recommended before
> finalizing tasks. Run `/deliberate` for a full multi-persona deliberation, or
> continue with `/opsx:continue` to skip."

**Do NOT trigger the gate for:** generic "3+ tasks", copy/README changes, a
single isolated model tweak, or doc-only changes.

### Deliberation Output Structure

**Tier 3** deliberations produce a folder inside the change:

```
openspec/changes/<change-name>/
  proposal.md
  tasks.md
  deliberations/
    001-initial/
      briefing.md
      council-architect.md
      council-profiler.md
      council-adversary.md
      results.md
```

**Tier 1 and Tier 2** outputs stay flat in the change folder (`review-notes.md`,
or the specialist's standalone file).

### Change Group Mapping

Each Change Group from the deliberation can become a separate OpenSpec change,
or tasks within one change, depending on scope. `results.md` should be
referenced in `proposal.md` as the decision record.

## Guardrails

- **No code changes**: deliberation produces ONLY markdown in `openspec/changes/`
  (or `.claude/deliberations/` for ad-hoc runs).
- **All personas inherit the tripwires**: no persona may write to `src/`,
  `index.html`, `sandbox.html`, or game code.
- **Mediator has final authority**: persona verdicts are advisory; the
  Mediator's synthesis is the actionable output.
- **Conflicts are expected, not forced**: agreement after adversarial analysis
  is a strong signal — don't re-invoke to manufacture disagreement.
- **Human override**: the user can override any Mediator decision.
- **Time-box**: if a deliberation drags (3+ re-invocations), the Mediator
  synthesizes with what's available and notes the gap.
