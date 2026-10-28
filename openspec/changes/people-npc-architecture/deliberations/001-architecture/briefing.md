# Deliberation Briefing: People and NPC architecture

## Task

Evaluate the proposed long-term refactor of festival people/NPC structure, identify
concrete corrections, and recommend a prioritized implementation plan. Gary asked
for broad brainstorming, a critical evaluation, a written plan, then a real council
pass. Freeze was the motivating observation but is not the architectural goal.
Planning only is authorized; do not implement runtime changes.

## Context

- Change: `openspec/changes/people-npc-architecture/`.
- Read, in order: `brainstorm.md`, `critical-evaluation.md`, `proposal.md`,
  `design.md`, `specs/people-runtime/spec.md`, `specs/crowd-ai/spec.md`, `tasks.md`.
- Existing roadmap: `ROADMAP.md`, especially crowd scheduling measurement and
  population pre-roll boundaries. No independent scheduling optimization is requested.
- Subsystems: crowd AI, registry/collision, world ownership, render binding,
  activities/parties, vehicles, models, debug and sandbox verification.
- Primary source: `src/main.js`, `src/crowd.js`, `src/obstacles.js`, `src/registry.js`,
  `src/monks.js`, `src/campJamActivity.js`, `src/healingArtsActivity.js`,
  `src/oneWheels.js`, `src/nutWagon.js`, `src/chunks.js`, and `src/steering.js`.
- Relevant architecture sections: Crowd; registry and collision; world streaming;
  animation; nut wagon/monks; sandbox and render-pipeline constraints.
- Read `AGENTS.md`, `openspec/config.yaml`, `openspec/council/charter.md`,
  `.agents/skills/council-protocol/SKILL.md`, and relevant domain rules/specs.

## Constraints

- Markdown planning only. Do not edit source, HTML, shared planning files, or any
  other persona's output. You are not alone in the codebase; preserve others' work.
- No build step. Current AGENTS.md requires new source modules in all five HTML
  importmaps and `bin/check-importmaps`; older templates' counts are stale.
- Preserve threeShim overrides, frozen module namespaces, and synchronous iOS audio
  init inside the title-card gesture.
- Preserve current random streams, draw order, and seed/hash inputs during structural
  moves. New randomness needs a dedicated salt; no incidental deterministic rewrite.
- Chunks/forests/lakes retain ownership; lakes deliberately omit chunkKey.
  Preserve pooled resources tagged shared, instancing uploads, tier policy, and
  independent nightness polling. Do not treat historic budget numbers as fresh measurements.
- Keep registration/query views efficient and retain production rendering strategies.
- Verification precedes feature work. Full-game boot remains necessary for runtime
  changes; no browser session is needed for this markdown council task.
- Follow `docs/browser-verification.md` and local overrides for any future browser
  work: muted URLs, bounded unique sessions, exact-PID cleanup, no unsafe layout capture.
- Ground project-specific claims in verified file:line evidence. Clearly distinguish
  proposed API and prospective risk from observed behavior. Use readable references.

## Your Output

Write `council-<your-persona>.md` in this briefing's directory. That is your sole
owned file. Write a skeleton first, then complete it incrementally. Return Verdict,
Key Concern, and three concise findings. No edits to the plan itself.

## Your Task: Independent Position

1. Propose your prioritized order of operations from your domain perspective.
2. Assess the documented alternatives and preferred architecture using actual code.
3. Identify concrete risks, missing acceptance, or unnecessary complexity with sources.
4. Give Proceed, Proceed with mitigations, or Block.

You are working in isolation. Do not read other council position files or speculate
about what other personas think. Do not write an anticipated-tensions section.
This is Tier 3 synthesis mode; the mediator will compare the actual positions.
