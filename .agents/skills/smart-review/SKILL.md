---
name: smart-review
description: Orchestrate a multi-specialist Zerble code review. The main agent runs this playbook itself — resolves scope, gathers context, fans out to review-* specialist sub-agents in parallel, deduplicates, synthesizes, and persists the artifact. Trigger on "review my changes," "check my work," "smart-review," or any explicit request for a multi-lens review of a diff, branch, or PR.
---

# Skill: Smart Review (Main-Agent Orchestrated)

You are the orchestrator for this review. Do not delegate orchestration to a
sub-agent — execute every step yourself, except specialist analysis which you fan
out to `review-*` sub-agents in **a single parallel batch**.

## Core Rules

- Review changed files only unless the user explicitly asks for a broader audit.
- Prefer exact scope over guessed scope. Never silently expand a staged review into a branch audit.
- Specialists inspect evidence, not speculate. If a concern isn't supported by changed lines or an explicit contract, drop it.
- Deduplicate by ownership. Keep one canonical finding per issue; treat other agent notes as supporting evidence.
- Preserve human intent. If the diff removes a `userData.shared` tag, an `instanceMatrix.needsUpdate`, a `chunkKey` omission on a lake, a fresh rng salt, or a tier guard, treat that as a serious regression.
- Explicitly say `No actionable issues.` when a review area is clean.

## Severity and Confidence

- `P0` — blocker: boot-time crash, determinism break that regenerates existing worlds, Safari-mobile module-freeze, iOS ships-silent, data loss
- `P1` — must fix before merge
- `P2` — should fix soon, but not a blocker
- `P3` — note or follow-up
- Confidence: `high` | `medium` | `low`

## Ownership Rules (for dedupe)

- `review-rendering` owns three.js correctness, material/geometry creation, scene-graph, disposal + `userData.shared`, the `threeShim.js` override path, `castShadow` correctness, `InstancedMesh.needsUpdate`.
- `review-performance` owns per-tier draw/tri budget impact, shadow-caster count, post-process gating, instancing/pooling decisions, AA/pixel-ratio, allocation-vs-steady-state.
- `review-gameplay` owns physics, controls, collision, crowd AI, chunk/forest/lake lifecycle, registry `chunkKey`, and **determinism (`rng.js` seeding)**. It is the catch-all for game logic.
- `review-audio` owns Web Audio synthesis, the iOS sync-gesture init chain, spatialization, nightness-gated voices, and music generators.
- `review-sandbox` owns the new-model wiring contract (importmap in BOTH html files + dropdown + `loadEntity` + hit kind + music style) and the sandbox-pass-but-game-crash risk.
- `review-docs` owns CHANGELOG/ROADMAP same-commit discipline, README/title-card tone + Easter-egg non-leakage, and `.Codex/**` + `ARCHITECTURE.md`/`DEBUGGING.md` consistency.
- A specialist should avoid duplicating another's owned findings unless the issue would otherwise go unreported.

---

## Workflow

### Step 1 — Resolve Scope

- If the user named a scope (`staged`, `unstaged`, `origin/main...HEAD`, a custom diff, or specific files), honor it exactly.
- Otherwise default to **staged changes**. If nothing is staged but unstaged changes exist, ask one concise question recommending review of the unstaged working tree.
- If the working tree is clean, ask whether to review a branch against `origin/main...HEAD`.
- Capture and report the resolved scope: `staged`, `unstaged`, `origin/main...HEAD`, or `custom`.

**Contamination gate (branch reviews only):** Before fanning out, check diff size and commit subjects. If the diff is unusually large or spans many unrelated subsystems, surface the scope risk before proceeding. Continue only when the user explicitly asked for a branch/PR audit.

### Step 2 — Gather Minimal Context

Run these in parallel (single message, multiple Bash calls):

- `git diff --name-only <scope>` — changed file list
- `git diff --stat <scope>` — diff summary
- `git log --oneline <scope>` — commit subjects

Then:

- Locate an active OpenSpec change under `openspec/changes/` (excluding `archive/`) if the prompt, branch, or commit subjects point at one. Hydrate only the matching change: read `proposal.md`, `tasks.md`, `session-log.md`; read `questions-for-human.md` only if open questions could change the review outcome.
- Read `CHANGELOG.md` (top) and the changed-file headers to understand intent. There is no Jira on this project — the diff + CHANGELOG + commit subjects are the requirement context.

### Step 3 — Prepare Artifact Path

If a matching active OpenSpec change exists:
- Use `openspec/changes/<change-name>/reviews/NNN-<scope-slug>/`.

Otherwise (most ad-hoc code reviews here):
- Use `.Codex/reviews/NNN-<scope-slug>/`.

`<scope-slug>` is short, ASCII, descriptive: `staged-changes`, `unstaged-fixes`, `branch-audit`, `pre-pr`, `post-fixes`. Determine `NNN` by incrementing the highest existing three-digit-prefixed folder; start at `001`. Create with `mkdir -p` before writing, and verify files exist on disk after writing.

If persistence is unavailable, return the review in chat and note that no artifact was persisted.

### Step 4 — Fan Out Specialists (CRITICAL: parallel, single message)

Group changed files by specialist owner using the routing rules below. Then issue **one assistant message containing one `Agent` tool call per applicable specialist**, all in parallel. Do not invoke a specialist whose owned file list is empty.

Each specialist prompt MUST include:
- The exact scope label (e.g. `staged`, `origin/main...HEAD`).
- The exact list of files this specialist owns (file paths only — no globs).
- A concise diff summary (file count + 1-2 sentence "what this change does").
- Relevant OpenSpec / CHANGELOG context, if available.
- Explicit ownership and dedupe expectations ("you own X; defer to Y on Z").
- The expected return contract (see "Specialist Return Contract").

**Routing rules:**

| Specialist | Owns these paths |
|---|---|
| `review-rendering` | `src/models/**/*.js`, `src/threeShim.js`, `src/contextLights.js`, `src/mountains.js`, `src/trip.js`, and material/geometry/scene-graph code anywhere in the diff |
| `review-performance` | `src/perf.js`, `src/adaptiveQuality.js`, `src/spatialGrid.js`, plus any changed hot-path/per-frame or geometry-adding code that moves draws/tris/shadows |
| `review-gameplay` | `src/main.js`, `src/world.js`, `src/chunks.js`, `src/forests.js`, `src/lakes.js`, `src/crowd.js`, `src/obstacles.js`, `src/registry.js`, `src/zerble.js`, `src/lurleen.js`, `src/camera.js`, `src/input.js`, `src/touch.js`, `src/timeOfDay.js`, `src/birds.js`, `src/bubbles.js`, `src/smiles.js`, **`src/rng.js`** |
| `review-audio` | `src/sound.js`, `src/midiPlayer.js`, audio-bus / spatialization / music-generator code |
| `review-sandbox` | `sandbox.html`, `index.html` (the importmap `mods`/`models` arrays + `loadEntity`/`ENTITY_*` wiring), `src/debug.js`, `src/hud.js` |
| `review-docs` | `CHANGELOG.md`, `ROADMAP.md`, `README.md`, `ARCHITECTURE.md`, `DEBUGGING.md`, `AGENTS.md`, `.Codex/**` |

**Mandatory invocations:**
- A new or changed `src/models/**` file → invoke `review-rendering` AND `review-sandbox` (wiring completeness).
- Any change touching `rng.js` / seed salts → invoke `review-gameplay` (determinism owner).
- Geometry/draw-adding change → invoke `review-performance`.
- Player-visible/perf/dev-workflow change with no CHANGELOG diff → invoke `review-docs` (flag the missing entry).
- `sound.js` change → invoke `review-audio`.

### Step 5 — Synthesize and Deduplicate

Once all specialists return, do the synthesis yourself:
- Merge specialist outputs into one verdict.
- If multiple agents report the same root issue, keep it under the **owner** and reference others as `Duplicate-of:`.
- Drop low-confidence speculation without evidence.
- Your synthesis must answer:
  1. **Intent match:** does the change do what the diff/CHANGELOG/commit subjects say it does?
  2. **Critical issues:** any blockers (boot crash, determinism, Safari/iOS, budget blow-out)?
  3. **Verification gap:** was it sandbox-verified AND game-booted? Any uncovered tier?
  4. **Suggested commit/PR description + CHANGELOG entry**, grounded in the actual diff.

### Step 6 — Persist + Report

- Write `review-summary.md` at the resolved artifact path using the **Final Summary Structure**.
- Optionally persist sibling specialist files when their content adds value.
- Verify each file exists after writing.
- In chat, present the verdict, top findings, and the artifact path. If nothing was persisted, say so.

---

## Specialist Return Contract

Specialists return Markdown:

```markdown
## Scope
- Reviewed: ...
- Notes: ...

## Findings
- `No actionable issues.`
```

Or, when issues exist:

```markdown
## Findings
- [P1][high] src/models/foo.js:42 - Short issue title
  - Why: why it matters in Zerble terms (tier budget, determinism, disposal, etc.)
  - Fix: concrete recommended fix
  - Duplicate-of: none | review-performance:src/models/foo.js:42
```

Normalize any deviation during synthesis.

---

## Final Summary Structure

Use this for both chat output and the persisted `review-summary.md`:

```markdown
# Code Review Summary

## Review Metadata
- Diff Scope: staged | unstaged | origin/main...HEAD | custom
- Reviewed Files: N
- OpenSpec Change: path or none
- Specialists Used: review-rendering, review-gameplay, ...

## Intent Match
- ...

## Findings
- `No actionable issues.`
```

Or, when issues exist:

```markdown
## Findings
- [P0][high][review-gameplay] src/rng.js:18 - Reordered rng() call regenerates existing chunks
  - Why: ...
  - Fix: ...
```

Then include:
- `## Verification Gap` — sandbox-verified? game-booted? tiers tested?
- `## Suggested Commit/PR Description + CHANGELOG entry`
- `## Verdict` — one of `Approve`, `Approve with changes`, or `Block`

---

## Anti-Patterns (do NOT do these)

- ❌ Spawn a review-lead agent — you ARE the lead.
- ❌ Issue specialist calls sequentially. One parallel batch.
- ❌ Synthesize without evidence from the relevant specialists (an empty findings list IS evidence and counts).
- ❌ Claim specialists were used when they were not — the Specialists Used line must reflect actual invocations.
- ❌ Skip artifact persistence when a path is available.
