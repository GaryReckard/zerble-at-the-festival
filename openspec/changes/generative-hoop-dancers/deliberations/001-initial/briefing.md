# Deliberation Briefing: Generative hoop dancers

## Task

Review and refine the initial plan for an additive flow-hooping activity. Gary requested a branch and planning for varied, dynamic, creative routines while preserving current hoopers, then asked to continue. Decide whether this plan can proceed to implementation and identify precise prerequisites and acceptance criteria. This is Tier 3 synthesis mode; planning only.

## Context

- OpenSpec change: openspec/changes/generative-hoop-dancers/. Read README.md, proposal.md, design.md, tasks.md and specs/hoop-choreography/spec.md.
- ROADMAP: Generative hoop dancers.
- Subsystems: crowd-ai, models/animation, sandbox-harness, registry/collision ownership and perf tiers.
- Key source: src/people/hulaActivity.js, src/people/hulaSession.js, src/personMotion.js, src/crowd.js, src/people/runtime.js, src/main.js, src/models/hulaHooper.js, sandbox.html.
- Relevant architecture: people ownership/activity, rendering/instanced characters, deterministic time, model/resource lifecycle and sandbox verification. Verify current source rather than assuming older spec/config prose is current.
- The prior creative consultation is recorded in session-log.md. It was not a council review.

## Constraints

- Follow current AGENTS.md and local browser/process safeguards. Current toolchain is Vite with ordinary imports. Historical council/config instructions about no-build and HTML module inventories are superseded.
- Preserve classic routines and Crowd-owned identity, claims, collision and activity interruption contracts.
- Never mutate frozen Three.js module namespaces; tier overrides remain in threeShim.js.
- Preserve synchronous iOS audio initialization and existing worldgen/classic RNG sequences. New random composition requires an isolated recorded seed stream.
- Honor shared-resource tags and owner disposal; avoid new lights or shadow casters. Budget HUD thresholds require matched measurements, not assumptions about device performance.
- Build the production-path verification surface before runtime behavior. A sandbox pass cannot establish full-game correctness.
- Do not launch browsers, servers, installs or run runtime implementation. Markdown only.

## Your Output

Read .agents/skills/council-protocol/SKILL.md and openspec/council/charter.md. Write your independent position to the persona-specific OUTPUT_PATH supplied by the orchestrator, following the protocol. Write a skeleton first and develop it incrementally. You own only that output file. You are not alone in this repository; preserve other people's changes.

## Your Task (Round 1)

1. Propose your prioritized order of operations.
2. Identify concerns from your own domain, citing verified file:line evidence for project-specific claims.
3. Give a Verdict: Proceed, Proceed with mitigations, or Block.
4. Return Verdict, Key Concern and three concise findings to the orchestrator.

Work in isolation. Do not read other council outputs, speculate about their positions or write anticipated tensions. The mediator handles synthesis after independent reviews are complete.
