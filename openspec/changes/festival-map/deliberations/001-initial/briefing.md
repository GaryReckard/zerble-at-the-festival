# Deliberation Briefing: Festival map

## Task

Review openspec/changes/festival-map proposal, design, specs, and tasks for implementing the confirmed festival map. Propose prioritized implementation guidance from your own lens and cite verified code where relevant. Read docs/backlog/festival-map.md and festival-map-review.md for player decisions and existing review.

## Context

Affected systems: new Canvas map/persistence/worker, main.js integration, registry observation, input.js and touch music actions, settings, harness, Vite entry. Current AGENTS.md is authoritative over obsolete no-build/importmap references in historical charter/context. Existing map sandbox remains a developer tool. Gary authorizes implementation after planning.

## Constraints

Keep live gameplay/driving/timers while expanded; player centered, zoom but no pan; nearby-only friends, persisted exploration, objective fog exceptions. No RNG reseeding/reordering, no shared generator mutation, no 3D ownership/material/shadow changes, and synchronous iOS audio start stays intact. Real game boot plus harness required. Follow local browser cleanup instructions. Markdown only during this review.

## Your output

Read the council-protocol skill. Write your independent Round-1 position to council-YOURPERSONA.md in this folder. Include prioritized operations, evidence-backed domain concerns, and verdict Proceed/Proceed with mitigations/Block. Do not speculate about other reviewers. You own only your position file and must not revert others' edits. Return a brief summary. Keep this focused on actionable implementation decisions.
