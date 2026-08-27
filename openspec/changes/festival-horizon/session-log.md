---
change: festival-horizon
status: not_started
current_task: null
blocked_by: null
open_questions: 0
started: 2026-08-26
last_updated: 2026-08-26
ref: ROADMAP.md "Far-field festival depth / semantic LOD"
---

# Session Log: Festival Horizon

> **AGENT DIRECTIVE:** This log is the "why" trail. It is **event-driven**, not a
> per-task diary. Write an entry only when a decision is made, something unexpected is
> discovered, a blocker is hit, or a question is raised for the human. Per-task progress
> lives in `tasks.md` checkboxes; the human-readable summary lives in `README.md`. To
> recover context, read `README.md`, then this file's frontmatter plus Key Decisions and
> the latest Work Log entry, then `tasks.md`.

## Key Decisions

- **D1 (2026-08-26):** Effective enablement is `farFieldRequested &&
  USE_WORLDGEN_V2`; the disabled or legacy-forced path is a zero-allocation
  no-op. `?worldgen=0` is a live escape hatch, and v2 proxies over the v1 world
  would never hand off. (audit V2)
- **D2 (2026-08-26):** Memoized worldgen descriptors are immutable inputs.
  FarField copies them into its own compact records and never mutates cached
  arrays; `bin/test-far-field` hashes inputs pre/post rebuild. (audit V3)
- **D3 (2026-08-26):** One world-owned streaming deadline. Full chunks consume
  first, FarField gets the remainder; planning is incremental per coarse cell
  (never one monolithic ~1km² `queryRegion`); pending snapshots are versioned by
  requesting player cell so teleports supersede stale work. (audit V4)
- **D4 (2026-08-26):** One exported owner-cell helper from `placement.js` plus a
  narrow `ChunkManager.isLoaded(cx, cz)` predicate. Handoff is keyed to the
  named contract "required cluster props exist," not to `_generateWorldgen`
  currently being synchronous. (audit V5, V7)
- **D5 (2026-08-26):** Every committed pool rewrite recomputes affected bounds
  (or per-batch frustum culling is deliberately disabled); the road underlay
  sits at an explicit elevation in (0, 0.06) with opaque `depthWrite: true` and
  construction-time materials. (audit V6, V12)
- **D6 (2026-08-26):** Promotion is baseline-first. If a tier's flag-off
  baseline already exceeds its absolute HUD budget, that tier's gate re-keys to
  marginal delta + no-regression + explicit Gary sign-off. (audit V9)
- **D7 (2026-08-26):** The `worldgen-layout` persistence guarantee is narrowed
  via a delta spec to render-agnostic query tuples; festival cluster content is
  chunk-owned per `festival-composition`. Proposal now declares the modified
  capability. (audit V11)
- **D8 (2026-08-26):** Reduced motion is read live at handoff time (after
  `A11y.init()`), initial ownership snaps, and no planning happens at module
  evaluation. (audit V8)
- **D9 (2026-08-26):** The hub-sandbox far-field snapshot invalidates on the
  same worldgen tuning-epoch bump that rebuilds the hub. (audit V10)
- **D10 (2026-08-26):** The importmap task covers the three full pages only;
  `map-sandbox.html` is worldgen-only (`wg` + `rng`) per `bin/check-importmaps`.
  (audit V13)

## Assumptions

| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | `ChunkManager.loaded.has()` implies "fully built" only while `_generateWorldgen` stays synchronous; perf.js and chunks.js already announce future intra-chunk splitting | High (today), fragile (future) | Mitigated | Handoff specced against the `isLoaded` completion contract (-> D4); any future chunk-splitting change must preserve "fully built" semantics |

## Dangling Threads

## Work Log

### 2026-08-26 -- Post-audit artifact revision

- **Event:** decision
- **What:** Deliberation 001 concluded "Proceed with mitigations" but its
  amendments were never folded into the executable artifacts; adversarial audit
  001 blocked on exactly that (V1) and added findings V7, V9, V10, V12-V14.
  Revised `proposal.md`, `design.md`, `specs/festival-horizon/spec.md`, and
  `tasks.md` in one sitting, added the `specs/worldgen-layout/spec.md` delta,
  and recorded decisions D1-D10 plus assumption A1. Task group 1 was
  restructured (now 1.1-1.5: contract helpers first, tests, flag resolution,
  importmaps, disabled baselines). No application code touched; implementation
  remains not_started.
- **Refs:** `deliberations/001-initial-plan/results.md`,
  `adversarial-audit-001.md`, -> D1..D10, -> A1
