---
name: multi-person-deliberation
description: "Adaptive deliberation engine for Zerble. Selects 3-5 from specialized personas + Mediator to produce divergent plans, surface real tensions, and synthesize a unified strategy as Change Groups. Two modes: synthesis (default) and debate (two-phase)."
license: MIT
metadata:
  author: zerble
  version: "2.0"
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
implementation plans, surface the real tensions between them, and synthesize a
unified strategy as Change Groups. It is tuned to Zerble: a no-build browser
game where the real risk lives in determinism, the three.js render path,
per-tier perf budgets, the audio gesture chain, and the sandbox/boot
verification surface.

### The Two Cardinal Rules (read these first)

1. **Personas write in isolation and must NOT guess at each other.** A persona
   that can't see the others cannot identify a real tension — asking it to
   "anticipate tensions" produces parroting. Real tensions are found either by
   the **Mediator** (synthesis mode) or in **Round 2** (debate mode).
2. **The orchestrator must NEVER seed a briefing.** Do not put example tensions,
   other personas' likely positions, or "Persona X will probably argue Y" into
   any persona's briefing. Drop a worked example into an LLM's context and it
   echoes the example back as if it were its own analysis. The briefing carries
   ONLY: the task, the context, the constraints, and that persona's own job.
   Every persona gets the SAME shared briefing — never a per-persona variant
   that hints at the others.

### Deliberation Mode (Tier 3 only)

Tier 3 runs in one of two modes:

| Mode | Default? | Rounds | How tensions are found | Cost |
| ---- | -------- | ------ | ---------------------- | ---- |
| **synthesis** | **yes** | 1 (parallel positions) + Mediator | The Mediator — the only actor that reads every position — surfaces and resolves the conflicts | ~N + 1 calls |
| **debate** | opt-in | 1 (positions) + Round 2 (cited cross-examination, auto-skipped if Round 1 converges) + Mediator | The personas react to each other's *actual* Round-1 outputs, then the Mediator synthesizes | up to ~2N + 1 calls |

**Selecting the mode:**
- Default to **synthesis**.
- Use **debate** when the user passes `--debate` / `--two-phase`, or says "debate",
  "cross-examine", "have them react to each other", "argue it out", or "two-phase".
- The mode is independent of how many personas are selected.

### Execution Contract

- `/deliberate` defaults to **Tier 3** unless the prompt specifies another tier,
  and to **synthesis mode** unless debate is requested.
- `/deliberate` is a true council workflow: create `deliberations/NNN-slug/`,
  write `briefing.md`, invoke 3-5 `council-*` personas as real parallel
  sub-agents, (debate only) run Round 2, then invoke the mediator and write
  `results.md`.
- Do not report Tier 3 complete until the artifact-based Definition of Done is satisfied.

The engine operates in **three tiers** based on task stakes:

| Tier | Name                  | Personas       | Use Case                                                                  | Est. Tokens |
| ---- | --------------------- | -------------- | ------------------------------------------------------------------------- | ----------- |
| 1    | **Quick Review**      | 1 consolidated | Routine model tweaks, copy changes, small refactors                       | ~5K         |
| 2    | **Domain Specialist** | 1 specialist   | When a single lens dominates (Perf, Adversary, Experience)                | ~8K         |
| 3    | **Full Deliberation** | 3-5 + Mediator | High-stakes: determinism, threeShim/material-tier, boot order, lifecycle  | ~30-60K     |

### Tier Routing

1. An explicit tier in the prompt wins.
2. An explicit `/deliberate` invocation defaults to **Tier 3**.
3. An explicit domain specialist invocation (e.g. `@council-profiler`) defaults to **Tier 2**.
4. A request phrased as "quick review", "quick take", or "sanity check" → **Tier 1**.
5. Otherwise fall back to task-stakes routing.

- **Tier 1 (Quick Review)**: single `general` sub-agent, consolidated multi-lens prompt. Output: `review-notes.md`.
- **Tier 2 (Domain Specialist)**: one persona, no Mediator. Output: the agent's native format.
- **Tier 3 (Full Deliberation)**: 3-5 personas + Mediator, in synthesis or debate mode.

### Non-Negotiable Rules

- Do NOT downgrade an explicit `/deliberate` request to Tier 1.
- Do NOT satisfy `/deliberate` with a single `general` agent imitating multiple voices.
- Do NOT infer persona opinions from agent description files — invoke them for real, in parallel.
- Do NOT seed briefings (see Cardinal Rule 2). Do NOT ask personas to anticipate tensions in Round 1.
- Do NOT report Tier 3 complete unless `briefing.md`, the expected `council-*.md`
  files (subject to Step 6 partial-failure rules), and `results.md` exist.

### Tier 3 Definition of Done

- `deliberations/NNN-slug/briefing.md` exists.
- `deliberations/NNN-slug/council-*.md` exists for 3-5 personas (subject to Step 6).
  In debate mode (when Round 2 ran), these files contain a `## Round 2 — Reactions` section.
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
| **Mediator** | `council-mediator` | Always included in Tier 3. In synthesis mode, surfaces the tensions from the positions; in debate mode, synthesizes positions + Round 2 reactions. Final voice → Change Groups. |

## Instructions

### Step 1: Understand the Task

If no clear task is provided, ask:
> "What change or decision should the Council deliberate on? Provide a
> description, an OpenSpec change name, or a ROADMAP item."

Gather context: any referenced OpenSpec change (`openspec/changes/<name>/`),
relevant `openspec/specs/`, `CLAUDE.md`, `openspec/config.yaml`, the relevant
`ARCHITECTURE.md` section(s), and skim `ROADMAP.md`.

### Step 2: Determine Tier and Mode

Apply the tier routing above. Then pick the **mode** (synthesis default; debate
on request — see "Deliberation Mode").

**Tier 3 triggers** — escalate to Full Deliberation if ANY apply:
- **Determinism** (`rng.js`, `hash2`, seed salts — anything that regenerates existing chunks)
- **Render-pipeline / boot order** (`threeShim.js`, material-tier swap, importmap/module-load, post-process wiring)
- **World lifecycle** (`chunks.js`, `world.js`, forests, lakes, registry `chunkKey`, disposal/`userData.shared`)
- **Audio init path** (the iOS gesture chain in `sound.js`)
- **Perf-budget** (a change expected to move draws/tris/shadow-casters near a tier budget)
- **Cross-cutting** (5+ files across 3+ subsystems)
- User explicitly requests `/deliberate`

**Tier 2**: user invokes one persona, or a single domain concern dominates.
**Tier 1**: everything else.

### Step 3 (Tier 1): Quick Review

Single `general` sub-agent. Combine three lenses: Structural (Architect),
Quality (Auditor — conventions, no-build/importmap, pooling, CHANGELOG, scope
completeness), Delivery (Pragmatist — critical path, smaller slice, park on
ROADMAP). Write `review-notes.md` to the change folder if one exists:

```markdown
# Quick Review
## Task
## Structural Assessment
## Quality Assessment
## Delivery Assessment
## Tripwires Touched
## Verdict   [Proceed | Proceed with mitigations | Block]
## Escalation Recommendation   [if it warrants Tier 3, say "run /deliberate"]
```
Present and stop.

### Step 3 (Tier 2): Domain Specialist

Invoke the requested persona as one sub-agent. No Mediator. Write its native
output to the change folder if one exists. Present and stop.

### Step 3 (Tier 3): Select the Council

#### Selection Matrix (3 personas + Mediator — default)

| Task Characteristic              | Recommended Personas                       |
| -------------------------------- | ------------------------------------------ |
| New model / visual entity        | Architect + Anthropologist + Profiler      |
| New gameplay system (greenfield) | Architect + Maverick + Adversary           |
| Bug fix / "looks frozen" / crash | Adversary + Auditor + Pragmatist           |
| Refactor / tech debt             | Architect + Auditor + Pragmatist           |
| Performance optimization         | Profiler + Pragmatist + Architect          |
| Feature prioritization / scope   | Maverick + Pragmatist + Adversary          |
| World-gen / chunk-lifecycle      | Architect + Adversary + Profiler           |
| Player feel / UI / HUD           | Anthropologist + Maverick + Pragmatist     |
| Dev tooling / sandbox / harness  | Anthropologist + Pragmatist + Auditor      |
| Audio change                     | Adversary + Anthropologist + Profiler      |

#### 5 personas + Mediator (high-stakes)

| Task Characteristic              | Recommended Personas                                          |
| -------------------------------- | ------------------------------------------------------------- |
| Determinism / rng-seeding change | Adversary + Architect + Auditor + Profiler + Pragmatist       |
| threeShim / material-tier change | Architect + Adversary + Profiler + Auditor + Anthropologist   |
| Boot-order / module-load change  | Architect + Adversary + Auditor + Pragmatist + Profiler       |
| Large new system (broad scope)   | Architect + Maverick + Anthropologist + Profiler + Adversary  |
| Major refactor across subsystems | Architect + Auditor + Pragmatist + Profiler + Adversary       |

If no row fits, ask the user which personas they want, presenting the matrix.

### Step 4 (Tier 3): Brief the Council

Prepare ONE **shared briefing** that every selected persona receives identically.
**Write it to `deliberations/NNN-slug/briefing.md` before invoking personas.**

Folder numbering: if `deliberations/` exists, increment the highest `NNN-*`;
else start at `001`. Slug is a short label (`initial`, `revised-scope`). Create:
```bash
mkdir -p openspec/changes/<change-name>/deliberations/NNN-slug
```
If there is no OpenSpec change, ask whether to create one with `/opsx:new`, or
fall back to `.claude/deliberations/NNN-slug/`.

> **CARDINAL RULE 2 — do not seed.** The briefing below contains NO example
> tensions, NO other-persona positions, NO "Persona X will say Y". If you catch
> yourself writing such a hint, delete it. Personas reason from the task and the
> evidence, not from your guesses about each other.

Briefing template:

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
Write your full Round-1 position to: `[OUTPUT_PATH]`
Return a brief summary to the orchestrator: your Verdict, Key Concern, and 3 bullet points.

### Your Task (Round 1)
1. Propose your prioritized order of operations for this task.
2. Identify the risks/concerns from YOUR domain, grounded in the docs/code.
3. Give a Verdict (Proceed | Proceed with mitigations | Block).
You are working in isolation. Do NOT speculate about what other personas think,
and do NOT write an "Anticipated Tensions" section — that's handled later.
```

The orchestrator MUST replace `[OUTPUT_PATH]` with each persona's actual file
path. The rest of the briefing is identical for every persona.

### Step 5 (Tier 3): Round 1 — Independent Positions (Parallel)

Launch all selected personas as **parallel sub-agent tasks** in a single
message. Each receives the shared briefing (with its `[OUTPUT_PATH]`), its role
(from its agent `.md`), and the instruction to write its Round-1 file and return
a brief summary. Real `council-*` invocations only.

Persona-to-filename mapping: `council-architect.md`, `council-maverick.md`,
`council-pragmatist.md`, `council-auditor.md`, `council-adversary.md`,
`council-anthropologist.md`, `council-profiler.md`.

After they return, verify each expected file exists (Step 6 handles failures).

### Step 5b (Tier 3, DEBATE MODE ONLY): Round 2 — Cross-Examination

Skip this entire step in synthesis mode.

1. **Convergence check.** Read the Round-1 files. If they **converge** — every
   Verdict is "Proceed", no conflicting priority orders, no contradictory
   recommendations — there is nothing to debate. Log "Round 1 converged —
   skipping Round 2" and go to Step 7. Otherwise continue.
2. **Re-invoke each selected persona in parallel**, this time giving it the
   **actual Round-1 files of the OTHER personas** (read from disk and pass their
   contents, or instruct the agent to read the specific file paths). The prompt:
   > "This is Round 2 of a debate-mode deliberation. Here are the other personas'
   > Round-1 positions: [list the `council-*.md` paths / contents]. Read them and
   > APPEND a `## Round 2 — Reactions` section to your own file `[OUTPUT_PATH]`,
   > per the council-protocol. Cite the specific claim you react to. Concede where
   > they convinced you, rebut where they didn't, and revise your Verdict only if
   > an actual argument moved you. Do not react to a position no one took."
3. This is genuine cross-examination grounded in evidence — not guessing. Pass
   the real files; never a paraphrase that could distort.

### Step 6 (Tier 3): Handle Partial Failures

After Round 1 (and Round 2 if run), verify each expected file exists:
- **All exist**: proceed.
- **1 of 3+ failed**: proceed; the Mediator notes the gap.
- **2+ of 3 fail (or 3+ of 5)**: abort and report.
- **In debate mode, if a Round-2 reaction is missing** but the Round-1 position
  exists: proceed with the Round-1 position and note the missing reaction.

### Step 7 (Tier 3): Invoke the Mediator

Pass the deliberation folder path and the persona summaries to `council-mediator`:

> "This is a Tier 3 [synthesis | debate] deliberation. Read each `council-*.md`
> file in the deliberation folder. In **synthesis mode**, YOU surface and resolve
> the tensions across the positions — the personas did not write them. In
> **debate mode**, also read each file's `## Round 2 — Reactions` section and use
> the latest (possibly revised) verdicts. Synthesize into a unified plan using
> your resolution hierarchy and write `results.md` in the same folder."

Tell the Mediator which mode ran, the folder path, the list of persona files, and
note any persona that failed.

### Step 8 (Tier 3): Present Results

Verify `briefing.md`, `results.md`, and the expected `council-*.md` files exist.
Then present:

```
**Council Deliberation Complete**

**Tier**: 3 — [synthesis | debate] mode
**Personas Consulted**: [selected] + Mediator
**Round 2**: [ran | skipped (Round 1 converged) | n/a (synthesis mode)]
**Artifacts**:
  - briefing.md, council-{persona}.md (x[N]), results.md  under .../deliberations/NNN-slug/

**Convergence** (all agreed):
- ...
**Key Conflict Resolved**:
- ...
**Change Groups**:
1. ...
**Risk Register**: [N] risks, [M] critical
**Next Step**: [Proceed with /opsx:apply, or revise]
```

## OpenSpec Integration

### Advisory Deliberation Gate

For changes created via `/opsx:new` or `/opsx:ff`, the gate triggers on
**specific risk signatures**, not generic complexity: determinism, render-pipeline/
threeShim/material-tier, boot-order/module-load, world-lifecycle (disposal,
`userData.shared`), perf-budget geometry, iOS audio init. When detected:
> "This change touches **[risk area]**. Run `/deliberate` (add `--debate` for a
> two-phase cross-examination) before finalizing tasks, or continue to skip."

Do NOT trigger for generic "3+ tasks", a single isolated model tweak, copy/README,
or doc-only changes.

### Output Structure

Tier 3 deliberations live in `openspec/changes/<change>/deliberations/NNN-slug/`
(`briefing.md`, `council-*.md`, `results.md`). Tier 1/2 outputs stay flat
(`review-notes.md` or the specialist's file). `results.md` Change Groups feed the
`tasks` artifact.

## Guardrails

- **No code changes**: markdown only.
- **All personas inherit the tripwires**: no writes to `src/`, `index.html`, `sandbox.html`, or game code.
- **Mediator has final authority**: persona verdicts are advisory; the synthesis is the actionable output.
- **Conflicts are expected, not forced**: agreement after debate is a strong signal — don't manufacture either side.
- **Human override**: the user can override any Mediator decision.
