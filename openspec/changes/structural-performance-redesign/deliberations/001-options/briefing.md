# Deliberation Briefing: structural performance options

## Task

Gary requests a genuinely more involved optimization path, potentially a
rewrite or restructuring, selected by analysis and experiments rather than
source aesthetics. Compare plausible paths, then recommend one only if it
is worth pursuing; recommending none is allowed. This is deliberation1 of at
most3, Tier3 synthesis mode. Produce a ranked evidence-grounded position and
the smallest discriminating experiments needed before exhaustive planning.
Do not implement a production feature.

## Context

- Change: `openspec/changes/structural-performance-redesign/`. A specific
  redesign has not been selected. Your independent assessment informs selection.
- Current branch: `codex/terrain-sampling-cache`, with verified uncommitted
  November6 terrain work. Preserve it.
- Shared evidence root: `verification/performance/2026-11-07-structural-options/`.
- Read `candidate-inventory.md`, `high-route-all-functions.json`,
  `low-route-all-functions.json`, and `low-scene-topology-summary.json` there.
- Inclusive timings overlap, profiling adds overhead, and unculled topology
  includes unknown/dynamic and camera-layer eligibility. These are attribution
  observations, not predicted FPS gains or actual submitted draws.
- Relevant current files: chunks/world/lakes/registry/crowd, people/children,
  people/childPresentation, landscape/support, landscape/districtBuild.
- Consult ARCHITECTURE rendering/main-loop/registry/people/landscape sections
  and current source. Saved evidence outranks old timing claims.
- Prior exact source and limits: `verification/performance/2026-11-06-terrain-sampling/lattice-README.md`.

## Constraints

- Follow AGENTS.md and current `.claude/rules/no-build.md`: Vite is already
  approved and implemented. Historical charter/config/protocol importmap and
  no-build instructions are stale. Do not resurrect module inventories.
- Keep Three0.160.0 and the existing shim override; never mutate ES module
  namespaces. No new dependency/toolchain without specific measured need.
- Preserve synchronous gesture audio, deterministic seed/RNG ordering,
  full-game boot integrity, all camera modes and manual camera movement.
- Preserve terrain detail, collision/support truth, world ownership, lake
  independence from chunk unload, shared disposal and instance dirty flags.
- Do not hide a performance problem by reducing density, physics cadence or
  offscreen gameplay truth. Explicitly identify any player-visible tradeoff.
- HUD budgets and old timing descriptions are clues, not actual device evidence.
- Gary reserved the Mac until return, but only the orchestrator owns captures.
  Do not launch browsers, servers, full tests or benchmarks yourself.
- Read-only source research; write only your assigned Markdown. You are not
  alone in the codebase, so preserve others' changes. Every project-specific
  claim needs verified file:line or saved evidence; otherwise cut it.

## Output

Read the council-protocol skill and your own persona definition. Write a
skeleton immediately, then incrementally persist your full isolated position
to `[OUTPUT_PATH]`. Use the required position/priority/domain-analysis/verdict
structure. Include ranked candidates, a defendable choice or no-go, evidence
that could overturn it, and a compact experiment recommendation. Do not read
others' Round1 files or speculate about their views. Return your verdict,
key concern and three bullets.
