# Deliberation Briefing: Repeatable performance lab

## Task
Review the finalized proposal, delta specification, design and tasks for the new performance-lab change. Propose a prioritized, practical plan and grounded mitigations before implementation. Planning/markdown only. Gary requests a complete new OpenSpec plan and can reserve his Mac for performance tasks while he is not using it. A prior Astra Medium review recommended unchanged-source repeatability, pinned quality, truthful simulation progress, retained divergent failures, lightweight timing and independent browser cleanup.

## Context
- Change: `openspec/changes/repeatable-performance-lab/`; read proposal.md, design.md, specs/performance-lab/spec.md and tasks.md.
- Subsystems: sandbox harness, input/main-loop diagnostic integration, capture/reporting, real-GPU browser ownership; observes streaming/crowd/render/physics without changing their production policies.
- Existing evidence: `verification/performance/2026-11-02-render-load/README.md`.
- Reuse: `bin/report-perf-playtest`, `bin/playtest-perf`, `src/perfTelemetry.js`, `src/people/baseline.js`, `src/sceneProbe.js`, `src/input.js`, `src/main.js`, `src/physics/fixedStep.js`.
- Read current AGENTS, local AGENTS.override, current `.claude/rules/no-build.md`, browser safety docs and relevant architecture. The OpenSpec config/charter contain stale no-build/importmap claims; current instructions establish Vite and ordinary imports, with Three pinned and shim alias retained.

## Constraints
- No implementation/source/HTML/package changes in this review; each persona owns only its output markdown. Others are working; do not revert others' edits.
- No browser launch, performance run, server change, Git mutation or unrelated file search. Do not read other council positions during independent review.
- Preserve production seed salts/order, ownership/disposal and shared pools; no new draw/shadow budget or material policy. No Three namespace assignment or shim bypass.
- Preserve synchronous audio unlock in the real title click; sandbox pass cannot prove game integration.
- Current Mac safety: resource ownership, independent deadlines, one standalone WebGL system, no software-WebGL performance verdict, no killing unrelated processes or changing Gary's play server/tab/profile. Quiet operator attestation is not proof of OS isolation.
- First milestone is two real-game scenarios, calibrated script analysis, injected-cost detection, exact cleanup and a skill around verified commands. Broader matrices, whole-world determinism, scheduling and general recording are excluded.

## Your Output
Read the council-protocol skill. Write your full independent position to `[OUTPUT_PATH]`. Cite repository-specific claims with file:line. Cover prioritized operations, domain concerns and a verdict (Proceed, Proceed with mitigations, Block). Do not speculate about other personas or invent anticipated tensions. Return a brief verdict/key concern/three-bullet summary. Do not spawn further agents.
