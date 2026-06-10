---
change: worldgen-layout-harness
status: not_started        # not_started | in_progress | blocked | paused | complete
current_task: null
blocked_by: null
open_questions: 0
started: 2026-06-10
last_updated: 2026-06-10
ref: "ROADMAP 'Layout-work agent harness' (added 2026-06-10); gate for festival-zone-grammar"
---

# Session Log: worldgen-layout-harness

> **AGENT DIRECTIVE:** This log is the "why" trail — it is **event-driven**, not a
> per-task diary. Write an entry only when a decision is made, something unexpected is
> discovered, a blocker is hit, or a question is raised for the human. Per-task progress
> lives in `tasks.md` checkboxes; the human-readable summary lives in `README.md`. To
> recover context, read `README.md`, then this file's frontmatter + Key Decisions + the
> latest Work Log entry, then `tasks.md`.

## Key Decisions

- **D1 — Harness lands BEFORE the grammar rewrite, as its gate.** Two playtest
  rounds of item-by-item layout fixes didn't converge because no surface can see
  or assert on the *built composition*. The linter's rules ARE the executable
  grammar spec; `festival-zone-grammar` is measured against this change's
  baseline. (Gary endorsed 2026-06-10.)
- **D2 — `dumpRegistry` is built FIRST (design D-A): instrument before surgery.**
  The behavior-preservation gate for the hoist + dry-run refactors is an empty
  normalized registry-snapshot diff at 3 seeds plus both unchanged goldens.
  Vocabulary: these are **layout snapshots**, not "goldens" (the goldens are the
  determinism hashes; Gary finds "golden" overloaded).
- **D3 — Layout functions own ALL rng draws, cosmetics included (design D-C).**
  The mesh halves of builders go rng-free; cosmetic values ride in the records.
  This is what makes the extraction provably order-preserving. One builder per
  commit so a diff failure localizes.
- **D4 — Water lookup is injected (`env.waterAt`), not imported.** Game passes
  its `isPointInLake` closure (bit-identical behavior); linter/overlay pass
  worldgen `lakeAt`. Shoreline divergence is tagged informational in lint output.
- **D5 — This change is golden-frozen.** Unlike the grammar change (which will
  move the POI golden deliberately), nothing here may move either golden or the
  built world. No "accept the drift" path exists.
- **D6 — THE PIVOT (deliberation 001): dry-run extraction deferred to
  festival-zone-grammar; built-truth capture is this change's substrate.** The
  Adversary proved old D-C unimplementable as scoped (cosmetic draws inside ~8
  model builders; `crowd.spawn` tier-pool draws — built layouts are
  tier-dependent TODAY; `registry.closestBuilding` inside draw loops). The
  registry is the primary, exact data source; the extraction lands inside the
  grammar change under its already-moving golden, gated by this harness. D-C′
  hands the full extraction design forward (model param splits, crowd
  pre-rolled params, `env={waterAt,blockedAt}`, Math.random transcribe-as-is).
  Freeze window collapses ~10 commits → ~2. Pending Gary confirm (-> Q1).
- **D7 — Cross-change sequencing (deliberation 001):** v2 H.2 golden-mover =
  commit zero (before any snapshot capture); `DEFAULT_WORLDGEN_V2` flip
  re-sequenced to AFTER festival-zone-grammar — the v2 HANDOFF's stale "Group I
  next" order would ship the jumble to real players (-> Q2).

## Assumptions

| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | The worldgen builders' rng draws can all be moved into pure layout fns without changing draw order (incl. conditional draws in retry loops) | Med | open | Verified per-builder by D2's snapshot diff |
| A2 | `registry.closestBuilding` guards inside builders depend on cross-chunk build order, so lint-time reproduction is approximate — acceptable for a linter | Med | open | Council round 001 to pressure-test |
| A3 | A perspective top-down via existing camLock is sufficient (no ortho camera plumbing) | High | open | Revisit only if seam-checks prove unreadable |

## Dangling Threads

- Marker hotkey final binding (`m` vs `k`) — resolve against input.js/debug.js/touch.js at build (-> Task 7.1).
- Whether `gotoHub` should print that hub's lint violations once lint lands (design open question).

## Work Log

### 2026-06-10 -- Change created via /opsx:ff; artifacts drafted; council launched
**Event:** phase-change
**What:** Gary pivoted from round-3 symptom fixes to root cause after a structural
analysis showed every arrangement bug traces to the plan/build contract
(`KIND_FOOTPRINT` scalars vs oversized built extents) AND that no harness surface
can see built composition (the only detector is Gary driving). Decision: two
changes — this harness change gates `festival-zone-grammar`. ROADMAP gained both
sections (same date). proposal/design/specs/tasks drafted; deliberation round
001-initial launched with Adversary + Architect + Pragmatist + Anthropologist
(signatures: determinism rng-order, importmap×3, disposal, chunks.js outside the
game).
**Refs:** -> D1..D5, ROADMAP "Layout-work agent harness", deliberations/001-initial/

### 2026-06-10 -- Deliberation 001 returned: THE PIVOT; artifacts revised; 6 questions queued
**Event:** decision + phase-change
**What:** 4/4 personas said proceed-with-mitigations, but the Adversary's
Criticals invalidated the central design decision (old D-C dry-run extraction)
*as scoped* — see -> D6. Mediator synthesis (CG1–CG8) folded back into ALL
artifacts same-day: design D-C→D-C′ + hardened D-A/D-B/D-D/D-E/D-G/D-H +
cross-change sequencing section; tasks group 3 retired (not renumbered), group 0
added (H.2 commit zero + HANDOFF correction), grammar-unblock milestone declared
(groups 1+2+4+8.1); specs/layout-dry-run removed, other four specs amended;
proposal re-pointed (4 capabilities, four-html-file importmap truth). Notable
new instruments from the council: bin/layout-snapshot one-command capture,
per-cluster draw-count canary, twice-capture self-diff control, importmap
consistency checker, hub-viewer acceptance test (diff vs game dump). Six
For-Gary decisions queued (-> Q1–Q6); **apply gates on Q1–Q3.**
**Refs:** -> D6, -> D7, deliberations/001-initial/results.md, -> Q1..Q6

### 2026-06-10 -- Q1–Q6 answered interactively: ALL council recommendations confirmed; apply unblocked
**Event:** question (answered) + phase-change
**What:** Gary answered all six via interactive ELI-JD prompts, confirming every
recommendation: Q1 pivot CONFIRMED (-> D6 stands); Q2 flip re-sequenced — the
v2 HANDOFF correction landed the same hour (-> Task 0.2 ticked, the one
pre-apply task explicitly gated on the confirm); Q3 capture tier pinned
`?perf=high` crowd-on (design D-A updated); Q4 markers ship WITH the touch
affordance (task 7.1 + spec + D-G updated — phone playtests of the deploy must
produce coordinates); Q5 tuning freeze agreed (ping at open/close); Q6
importmap-bootstrap dedupe parked on ROADMAP (bullet added). Nothing blocks
apply except starting it; next session begins at task 0.1 (land v2 H.2 as
commit zero) per the tasks preamble.
**Refs:** -> Q1..Q6 (Answered), -> Task 0.2, -> D6, -> D7, v2 HANDOFF.md, ROADMAP.md

### 2026-06-10 -- Delegation refinement pass: APPLY-GUARDRAILS.md + anchored tasks + a real bug found
**Event:** decision + discovery
**What:** Gary asked whether a cheaper model (Opus/Sonnet) could implement this
change safely. Assessment: ~80% yes already (the deliberation's gates make
mistakes loud); refinement pass closed the rest. Shipped: (1)
**APPLY-GUARDRAILS.md** — one-page DO-NOT list, the literal gate ritual,
stop-and-report conditions, model routing (0.1 → Fable; 6.1/6.2 → Fable or
careful Opus 4.8; rest → Opus/Sonnet; /smart-review after group 2 and 8.1),
and a verified code-anchor table; (2) tasks.md rewritten with inline verified
file:line anchors + a "done =" criterion per task. **Discovery during anchor
verification (D8-worthy):** design/spec said hub-sandbox should copy
*sandbox.html's* `'three'` mapping — but sandbox.html deliberately maps
`'three'` to raw unpkg (sandbox.html:176 comment, no threeShim); it's
*index.html:101* that maps the shim. A skimming implementer would have built a
tier-divergent viewer whose acceptance test could never pass. Corrected in
design D-E, specs/layout-surfaces, task 6.2, and guardrail #9.
**Refs:** APPLY-GUARDRAILS.md, tasks.md (all groups), design D-E, -> Q1/Q3/Q4 answers baked into anchors
