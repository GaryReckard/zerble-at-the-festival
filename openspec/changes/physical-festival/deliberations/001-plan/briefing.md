# Deliberation briefing: Physical festival implementation plan

## Task

Review and refine this planning-only handoff before implementation. Gary wants meticulous documentation and an efficient step-by-step path for contact-driven prop physics, occupied chair/person reactions and recovery, the existing cooler as the next object, cups in chair/cooler holders and NPC hands, and useful sparse intersection/POI signs that can fall or flatten without mandatory repair. The discussion also preserves ragdolls, attachments, local social reactions and bounded aftermath as staged possibilities.

The primary agent has written proposal.md, ideas.md, evidence.md, design.md, tasks.md, verification.md and eight capability deltas in this change. Read those, prioritizing design/tasks and evidence. Identify concrete omissions, contradictions or unnecessary dependencies from your own lens. This is a Tier 3 synthesis deliberation; do not read other personas or anticipate their arguments.

## Context

- Change root: `openspec/changes/physical-festival/`.
- Scope: simulation, batched models, streaming/registry, person activities, drinks, pure sign planning, sound/scoring and verification.
- Current evidence: `evidence.md` with verified source links. Recheck relevant symbols if needed; source is moving in the shared checkout.
- Key files: `src/models/campsite.js`, `src/models/campChair.js`, `src/campRegistry.js`, `src/registry.js`, `src/collisionContacts.js`, `src/main.js`, `src/crowd.js`, `src/crowdAppearance.js`, `src/people/campResources.js`, `src/worldgen/roads.js`, `src/worldgen/festival.js`, `src/worldgen/terrain.js`.
- Architecture areas: world ownership, models, crowd/person runtime, update scheduling and render budgets in `ARCHITECTURE.md`; current person extension guide is `openspec/changes/people-npc-architecture/extension-guide.md`.
- Branch: Gary explicitly permits remaining on `codex/generative-hoop-dancers` with the other agent. Other work is concurrent; do not revert or edit it.

## Authoritative constraints

Read AGENTS.md and the council-protocol skill. Current AGENTS.md and `.claude/rules/no-build.md` supersede older council/config/template claims: this project now uses Vite and normal imports, not importmap inventories. Do not reintroduce a no-build requirement.

Preserve deterministic generation streams, threeShim/material-tier safety, synchronous iOS audio initialization, lake/forest/chunk ownership, shared-resource disposal and instance dirty flags. Keep browser resource cleanup structural and respect the prohibited layout capture path. No runtime changes or dependency installation in this planning turn. No performance results have been measured. Decisions should distinguish accepted user intent, proposed defaults and validation gates.

## Your output

Write a complete independent position to the assigned OUTPUT_PATH, following council-protocol headings with priority sequence, evidence-backed domain analysis and final verdict. Own only that file. You are not alone in this checkout; accommodate others' edits and never revert them. Cite code or plan sections for actionable claims; keep the review focused enough to integrate. Return verdict, key concern and a brief summary. No other files may be edited.

The mediator will read the actual positions, resolve disagreements and produce Change Groups; implementation remains unstarted.
