---
change: festival-zone-grammar
status: not_started        # not_started | in_progress | blocked | paused | complete
current_task: null
blocked_by: null
open_questions: 0
started: 2026-06-13
last_updated: 2026-06-13
ref: "ROADMAP 'Festival layout'; gated by worldgen-layout-harness baseline (now MET)"
---

# Session Log: festival-zone-grammar

> **AGENT DIRECTIVE:** This log is the "why" trail — it is **event-driven**, not a
> per-task diary. Write an entry only when a decision is made, something unexpected is
> discovered, a blocker is hit, or a question is raised for the human. Per-task progress
> lives in `tasks.md` checkboxes; the human-readable summary lives in `README.md`. To
> recover context, read `README.md`, then this file's frontmatter + Key Decisions + the
> latest Work Log entry, then `tasks.md`.

## Key Decisions

- **D1 — Extraction first, behaviour-preserving, one builder per commit (golden-frozen),
  THEN the grammar (golden moves once).** Carries forward harness D-C′/D6. The only commit
  that moves the POI golden is the deliberate group-4 slotting commit; every extraction
  commit is snapshot-EMPTY-gated so a diff failure localizes to one builder.
- **D2 — Crowd pre-rolled params close the tier-dependence (harness R2).** The extraction
  pre-rolls crowd count + per-NPC seeds into layout records so `crowd.spawn` stops drawing
  from the cluster rng with a tier-sized pool; baseline (perf=high) and shipped low/mid then agree.
- **D3 — True extents are oriented shapes from the SAME `FESTIVAL_TUNING` constants the
  builder reads** (court=ring, vendor=rect incl. camps-behind, stage=wedge). The D8
  "two owners, do NOT merge" pairs (planner dancefloor vs buildStage's 9 m; legacy twins)
  MERGE here — world drift is expected and gated.
- **D4 — Zone slotting (priority order on front axis F), omit-if-no-fit, not
  scatter-then-relax.** Mutual exclusion by construction = main's "one theme per chunk" at
  hub scale. Relaxation rejected (permits clipping under density).
- **D5 — Spur roads + drum access path are COSMETIC PATH RECORDS from the planner, not new
  arterials in roads.js** — so the queryPoint (road-existence) golden stays frozen; only
  the POI golden moves.
- **D6 — `DEFAULT_WORLDGEN_V2` flip is a SEPARATE later change** (Gary-sequenced: H.2 →
  harness → this → H.3/F.5 + I + flip). This change ships flag-off; no mid-game player is on v2.

## Assumptions

| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | Every worldgen builder's rng draws can be hoisted into a pure `layout(rng,env)` with EMPTY snapshot diff (incl. conditional draws in retry loops) | Med | open | Verified per-builder by group-1 snapshot diffs |
| A2 | Spur/access paths can be cosmetic records without touching the road-existence golden | Med | open | Verified at task 4.3 (queryPoint golden held) |
| A3 | Zone-slotting + omit can hit 0 error-rules on all 10 baseline seeds without leaving hubs feeling empty | Med | open | Tuned in the hub viewer/gallery; Gary playtest (7.3) |
| A4 | Crowd pre-roll makes layout tier-independent without changing the perf=high baseline | Med | open | Verified at task 2.1 (low==high normalized layout) |

## Dangling Threads

- Spawn-on-road vs face-the-stage tradeoff (round-2 open) — lean "both via front axis"; resolve in task 4.1 (-> deliberation).
- `booth-on-road` warn threshold (baseline's largest rule, 74) — may need a "straddle allowed, on-surface not" refinement; a linter-rule bug is fixable here (-> Open Q).
- Inherited from harness adversarial review: hub-viewer acceptance is N=1 (widen to 2–3 seeds before grading against it); `arch-placement` fires ~globally (should drop to ~0 here — if not, `ARCH_MIN_STAGE_DIST` is miscalibrated, not the placement).

## Work Log

### 2026-06-13 -- Change drafted (proposal/specs/design/tasks) via /opsx:ff
**Event:** phase-change
**What:** Artifacts authored from the DRAFTING-BRIEF, the harness baseline.md (106 error /
92 warn across 10 seeds; worst clip 7.5 m), and design D-C′. Two capabilities:
`festival-zone-grammar` (the slotting planner + placement rules, graded against the
baseline) and `builder-layout-extraction` (the pure layout/mesh split + crowd pre-roll +
env injection + registry backstop). Tasks sequence extraction (golden-frozen, 1 builder/
commit) → true extents → zone slotting (the single golden move) → backstop → burndown →
verify/judge. Next: the deliberation gate (signatures fire by design — determinism, boot
order, lifecycle), then /opsx:apply.
**Refs:** -> D1..D6, proposal.md, design.md, tasks.md, ../worldgen-layout-harness/{design.md (D-C′), verification/baseline.md}
