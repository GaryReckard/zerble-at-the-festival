---
change: festival-zone-grammar
status: in_progress        # not_started | in_progress | blocked | paused | complete
current_task: "Group 0 + 0.5 done (gate reproduces; spike: extraction is deferrable, critical path is planner-only). Awaiting Q1 re-scope decision before the planner rewrite / golden move."
blocked_by: "Q1 (re-scope decision — lean planner-only path vs full extraction)"
open_questions: 1
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

### 2026-06-13 -- Apply started: Group 0 gate validated + Group 0.5 SPIKE → extraction is deferrable
**Event:** discovery (re-scope) + question
**What:** Group 0.2 (the CRITICAL gate check) PASSES — `bin/lint` over the repo-root
baseline snapshots reproduces the recorded worst-offender penetrations exactly (1234
7.5m / 0xf7ef2a3c 5.8m / 42 6.4m). No STOP.
**Group 0.5 spike finding (code-grounded, reshapes the plan):** ALL the failing rules
are PLANNER placement decisions, not builder behaviour:
  - `arch-placement` (21): the arch is built in **main.js** `buildSpawnArch` at
    `archDist=15*scale`, deliberately INSIDE the dancefloor (main.js:240,283). Fix =
    relocate it to a road threshold. Zero builder work.
  - `overlap` (48): `resolveOverlaps` separates clusters by SCALAR
    `a.footprint+b.footprint+MARGIN` (festival.js:331,339) using `KIND_FOOTPRINT`. Fix =
    oriented-extent zone slotting in the planner.
  - `water-clear`/`drum-in-trees`/`booth-on-road`/`dancefloor-clear`/`potty-attached`:
    all set in `_computePlan`/`nudgeOff`/`perpOff` (festival.js:356-454) — planner.
  The `chunks.js` builders only RENDER the planner's descriptors, so they need no change
  to fix the rules. Crucially, **the POI golden hashes the PLAN (descriptors), not the
  build, and crowd draws live in the BUILDER** — so the crowd tier-dependence does NOT
  touch the POI golden the slotting commit moves. **Therefore the full per-record builder
  extraction (group 2) AND crowd pre-roll (group 1) are NOT on the critical path to a
  zero-error festival.** The lean critical path = planner slotting + oriented extents +
  arch relocation + registry backstop, with ONE deliberate POI-golden move. This collapses
  the riskiest, largest, most-invisible work (the ~8-builder extraction the council flagged)
  OUT of the layout fix. Raised -> Q1 for Gary: lean path now (defer extraction + crowd
  pre-roll to a follow-up) vs the full original scope. Also: the planner rewrite is the
  repo's most consequential action (moves the golden, regenerates the flag-off world) and
  the change's final gate (task 7.3) is Gary's in-game playtest — a natural human checkpoint.
**Refs:** -> Q1, -> Task 0.5.1/0.5.2, festival.js:331/356-454, main.js:240/283, deliberations/001-initial/results.md (Tension 2)

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
**Refs:** -> D1..D6, proposal.md, design.md, tasks.md, ../worldgen-layout-harness/design.md (D-C′), repo-root verification/baseline.md (the measuring stick — NOT under the harness folder)

### 2026-06-13 -- Deliberation 001-initial: 5 personas, all Proceed-with-mitigations; tasks revised
**Event:** decision + phase-change
**What:** Ran `/deliberate` (Tier 3 synthesis) with Adversary + Architect + Auditor +
Profiler + Pragmatist + Mediator (determinism/world-gen/major-refactor signature). All
five returned **Proceed with mitigations**; no blocks. (Aside: the council files all wrote
fine; the FIRST mediator invocation died on a session limit with 0 tokens — re-ran the
mediator alone against the 5 intact files, nothing regenerated.) The Mediator surfaced 9
tensions; results.md carries the full synthesis + a 17-row Risk Register (4 CRITICAL).
**Folded into tasks.md:**
  - **D7 — crowd pre-roll REORDERED ahead of the builder extraction** (old group 2 → new
    group 1). `crowd.spawn` draws a VARIABLE, tier-dependent count from the cluster rng
    (color-retry loop + zero-draw early-return at pool exhaustion, crowd.js:339), so the
    extraction's EMPTY-diff gate isn't tier-stable until crowd is hoisted. Profiler's nuance
    kept: make the LAYOUT/record stream tier-independent; the REALIZED NPC population stays
    capped by PERF.crowdMax (a per-frame CPU guard, not a draw guard).
  - **D8 — CRITICAL: baseline path was stale.** The gate artifacts live at REPO-ROOT
    `verification/`, not `openspec/changes/worldgen-layout-harness/verification/`. Task 0.1
    fixes every cite; 0.2 reproduces 106/92 bit-for-bit before any edit (STOP if it doesn't).
  - **D9 — new Group 0.5 scope spike** (Pragmatist Slice 0): the full 8-builder extraction
    may not be needed before layout wins (arch-placement is planner-only; analytic
    extents+slotting+backstop may zero the 4 error rules with only crowd pre-roll strictly
    required). Maps each error rule → minimum change before grinding.
  - **D10 — canary hardening FIRST in group 2**: the `kind@roundedX,roundedZ` key collides
    for co-located same-kind clusters (the tight-slotting regime) and silently under-reports;
    include clusterSeed/role + assert TRIANGLE count (catches a lost segment-count arg).
  - **D11 — drivable corridor is an explicit slotting RESERVATION** (path_node is in the
    linter's overlap-exclusion, so a clipping path is caught by NO error rule); path records
    carry no colliders; drivability = reservation + mesh-half backstop.
  - **D12 — promote the MODEL_DIMS drift guard from localhost console.warn → thrown
    node-selftest assertion** before extents go load-bearing (else a stale copy ships an
    in-game clip the linter, reading the same stale copy, reports as clean).
  - Plus: buildStage as an isolated 3–5× commit; buildCampVillageAt's layout half partial
    by construction (closestBuilding in the draw loop); per-builder userData.shared audit;
    boot the real game both flags/both tiers after EVERY chunks.js commit; clusterSeed keyed
    on a stable semantic index so zone-omit doesn't churn the golden; ?perf=mid in verify;
    D2 crowd commit is player-visible (own CHANGELOG entry).
**Refs:** -> deliberations/001-initial/results.md, tasks.md (revised groups 0–8 + 0.5), README.md

