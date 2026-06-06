---
change: procedural-map-generator
status: in_progress
current_task: null
blocked_by: null
open_questions: 4
started: 2026-06-06
last_updated: 2026-06-06
ref: /opsx:explore thread "more sensible festival paths" (no CHANGELOG/ROADMAP entry yet)
---

# Session Log: Procedural Map Generator

> **AGENT DIRECTIVE:** After compaction or new session, read this file + tasks.md
> before doing anything else. Read frontmatter, then Current Status, then latest
> Work Log entry.

## Current Status
**Phase:** Artifacts complete (`/opsx:ff`). Apply-ready.
**Doing:** Nothing in-flight — handing off to the requested tier-3 `/deliberate`.
**Next:** Council deliberation → fold Change Groups into tasks.md → `/opsx:apply` →
`/opsx:verify` → `/smart-review`.
**Blocked:** Nothing. 4 open design questions logged (Q1–Q4) but each has a default
to proceed under, so they don't block.

## Key Decisions
<!-- APPEND-ONLY. Full rationale + alternatives live in design.md. -->
- **D-load-bearing — Determinism via edge/pair-seeded shared features, NOT
  forward-passing.** Shared features (road crossing a chunk edge, river between
  lakes) are seeded by the feature's own identity so both sides compute identically.
  The explored "neighbor generates first and hands ports forward" idea was rejected
  as order-dependent (breaks on approach direction, unload/reload, `?seed`). See
  design.md D4.
- **D-structure — Central-place hierarchy** (rare rank-weighted hearts; everything
  orients to nearest heart; sparsity = space between). design.md D3.
- **D-harness — 2D Canvas sandbox, render-agnostic generator, single source of
  truth** for future 3D world + in-game map view. design.md D1/D2/D11.
- **D-scope — This change ships the generator + 2D sandbox ONLY.** No live-game
  changes; the v2-worldgen integration (the breaking step) is a follow-up. proposal
  Impact + design Non-Goals.
- Full set D1–D11 in design.md.

## Assumptions
| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | Canvas 2D (not three.js) is the right sandbox renderer | High | Open | Confirm during apply |
| A2 | Rivers belong in this change's 2D scope, built last | Med | Open | -> Q4 |
| A3 | A small `src/worldgen/` module set (vs one file) is the right shape | High | Open | Confirm during apply |
| A4 | Reusing `rng.js` seeding (not a new scheme) keeps future 3D integration single-contract | High | Open | Verify in §1.2 |

## Dangling Threads
<!-- APPEND-ONLY. Strikethrough when resolved. -->
- Proximity-graph (D6) consistency radius is empirical — must be validated by the
  §9.2 multi-origin check, not assumed.
- Generator cost when the sandbox draws kilometers — sampled-resolution/tile-cache is
  a sandbox concern; confirm the point-query stays bounded-neighborhood cheap.

## Work Log
<!-- APPEND-ONLY. Newest at BOTTOM. -->

### 2026-06-06 — /opsx:ff artifact creation
**Intent:** Fast-forward all spec-driven artifacts to apply-ready for
procedural-map-generator, capturing the /opsx:explore design thread.
**Result:** Created proposal.md, specs/world-layout-generator/spec.md,
specs/worldgen-2d-sandbox/spec.md, design.md (D1–D11 + risks + open questions),
tasks.md (10 groups, harness-early, rivers last, determinism acceptance gate).
Initialized this log + questions-for-human.md (Q1–Q4). Also fixed two pre-existing
YAML syntax bugs in openspec/config.yaml (multi-line list items with inline colons)
that were breaking the CLI; two harmless leftover warnings remain
(`implementation`/`verification` rule blocks for a non-active schema).
**Changed:** openspec/changes/procedural-map-generator/* ; openspec/config.yaml.
**Refs:** -> Q1–Q4; design.md D1–D11; proposal Scope Check.
