# Deliberation Briefing: landscape and travel execution

## Task

Review the implementation-ready proposal/design/spec/tasks for dependency order, concrete closure gates and efficient bounded implementation. Return your own prioritized sequence, domain-grounded concerns and verdict. Read current source where needed. This is synthesis mode; work in isolation and do not speculate about other personas.

## Context

Change: openspec/changes/landscape-and-travel. User authorized finalizing execution planning and starting implementation if appropriate. User requirements and reference photograph are in docs/backlog/landscape-and-travel.md; prior independent Astra exploration is docs/backlog/landscape-and-travel-astra-review.md. Review the finalized task list, not the earlier brainstorm alone.

Subsystems: pure landscape/worldgen, terrain support, registry/collision, cart/people, streaming, local geometry, water crossings, sandbox verification and perf tiers. First slice is pure support/solid contracts plus an authored terrain-sandbox mode; current live generation remains baseline. Barn and first aid are future work. No near-spawn guarantee. Existing physics/boot work is concurrent and must be preserved.

Relevant architecture: world generation, registry/collision, carts, crowd, tiers; source includes worldgen/terrain.js, terrainSandbox.js, terrainDriving.js, collisionContacts.js, registry.js, worldgen/roads.js and physics/runtime.js.

## Constraints

Current AGENTS.md and .claude/rules/no-build.md are authoritative: Vite and ordinary imports are current, despite stale no-build/importmap text in OpenSpec config and council skill templates. Do not add module inventories. Preserve shim/material tiers, synchronous gesture audio, RNG stream independence, complete deterministic owner plans, lake-omits-chunkKey lifecycle, shared resources and instance flags. Measure cold work separately. Sandbox pass does not establish game integration. Respect local browser cleanup and forbidden layout-snapshot capture. Council writes markdown only.

## Output

Read .agents/skills/council-protocol/SKILL.md. Write your position incrementally to this folder using your canonical council persona filename. Own only that file; you are not alone in the repository and must preserve other edits. Provide Priority Sequence, your domain analysis with source citations and a final Verdict (Proceed / Proceed with mitigations / Block), Key Concern and Recommendation. Return a concise summary. Do not read other persona outputs.
