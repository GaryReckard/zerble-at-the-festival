---
change: repeatable-performance-lab
status: complete        # not_started | in_progress | blocked | paused | complete
current_task: "1.2 (hardware browser capability)"          # task ID from tasks.md, or null
blocked_by: null            # "Q3" | "dependency X" | null
open_questions: 0           # count of unanswered questions in questions-for-human.md
started: 2026-11-03
last_updated: 2026-11-04
ref: "CHANGELOG.md: 2026-11-03 lab acceptance and 2026-11-04 provenance/input fixes"
---

# Session Log: Repeatable performance lab

> **AGENT DIRECTIVE:** This log is the "why" trail — it is **event-driven**, not a
> per-task diary. Write an entry only when a decision is made, something unexpected is
> discovered, a blocker is hit, or a question is raised for the human. Per-task progress
> lives in `tasks.md` checkboxes; the human-readable summary lives in `README.md`. To
> recover context, read `README.md`, then this file's frontmatter + Key Decisions + the
> latest Work Log entry, then `tasks.md`.

## Key Decisions

- **D1 (quiet-Mac condition), 2026-11-03:** Gary can assign performance tasks while he is not using the Mac. Record that condition once per assigned experiment; do not add scheduling or repeated prompts, and do not claim proof of OS-wide isolation.
- **D2 (script-owned analysis), 2026-11-03:** Tested scripts own capture validation, statistics and verdicts; a later skill orchestrates verified commands. Extend existing capture/manual summaries without treating legacy window percentiles as raw frames.
- **D3 (three delivery slices), 2026-11-03:** The council resolves analyzer-first versus feasibility-first in favor of a minimum envelope and supervised parked capture, then trusted parked comparisons, then driving. Both scenarios remain required for full acceptance.
- **D4 (independent validation), 2026-11-03:** Freeze semantic-work bounds and statistical policy before fresh unchanged-source holdouts and injected-cost trials. Draw/resource reductions are cost outcomes; source/content changes require honest claim classification.
- **D5 (surviving ownership), 2026-11-03:** Supervision must outlive control-worker death. No browser expansion precedes a real hardware adapter, blocked-page/controller-death cleanup proof and exact ownership assertions. See the council synthesis.
<!-- APPEND-ONLY. Number sequentially with D-prefix. The choices a future reader needs to
understand "why it's built this way" — e.g. why a fresh rng salt (vs reordering existing
calls), why this disposal ownership, which perf tradeoff was accepted, why this threeShim
path. -->

- **D6 (early neutral input), 2026-11-03:** The user-invoked completed-plan council found input ownership scheduled after parked acceptance. Neutral all-channel protection now belongs to the first collection slice; driving extends the same owner with route commands.
- **D7 (delivery prerequisites), 2026-11-03:** The same council makes supervision prerequisite to the very first browser launch, project verification prerequisite to each changed build's measurements, and same-commit CHANGELOG/ROADMAP records mandatory per usable slice. The runner exposes the full acceptance run inventory before execution.

- **D8 (explicit foreground window), 2026-11-03:** Gary reported that test Chrome windows were taking focus while he was using the Mac. All further browser launches and timed experiments are deferred until he explicitly says the Mac is free. A generic implementation assignment does not establish that condition; offline code/tests continued.
- **D9 (capability receipts), 2026-11-03:** Browser game runs now fail closed without successful normal/worker-death/page-hang proofs for the current backend signature; full experiments additionally require a valid acknowledged parked capture. Existing failed probes do not satisfy this gate.

- **D10 (isolated construction recipe), 2026-11-03:** A full trial’s normal run created 59 children, outside bounds frozen from 47–53. The unchanged child constructor independently chooses 5–8 children for each of eight groups via global randomness, so the world seed does not establish comparable initial population. A new `live-festival-v2` recipe passes a private, freshly salted construction RNG into the real constructor before boot; it never overrides global Math.random, freezes live actors, removes/adds actors after construction, or changes default gameplay. The old failed trial stays invalid and its thresholds are not widened. The new content identity requires fresh integration, overhead, calibration, holdouts and sensitivity for both scenarios.

## Assumptions
<!-- Table format. Update Status/Resolution columns as verified. -->
| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|

## Dangling Threads
<!-- APPEND-ONLY. Open loops / things to come back to. Strikethrough when resolved, don't delete. -->

## Work Log

### 2026-11-03 -- Planning review changes the acceptance contract
**Event:** decision
**What:** The prior Astra Medium critique informed the proposal. A real three-persona synthesis council then exposed five additional gaps: input-versus-cost comparability, raw-frame export, collector perturbation, controller-death supervision and independent holdouts. Their refinements are included in the delta specification, design and reordered tasks. Current Vite instructions override stale no-build/importmap context in OpenSpec; this change does not repair unrelated workflow configuration.
**Refs:** D2 (script-owned analysis), D3 (three delivery slices), D4 (independent validation), D5 (surviving ownership); [council synthesis](deliberations/001-initial/results.md).
<!-- APPEND-ONLY, newest at BOTTOM. EVENT-DRIVEN — one entry per real event, NOT per task. -->

### Work Log Entry Format
<!--
### 2026-11-03 -- [Brief Title]
**Event:** decision | discovery | blocker | question | phase-change
**What:** [What happened and why it matters — the part a future reader can't reconstruct from the code or the checkboxes]
**Refs:** [cross-references: -> Q3, -> Task 7.2, -> D4]
-->

### 2026-11-03 -- User-invoked completed-plan council
**Event:** decision
**What:** A fresh Tier 3 synthesis review used Anthropologist, Pragmatist and Auditor, followed by Mediator. It retained the milestone and acceptance contract, while correcting parked-input ordering and clarifying first-launch supervision, verification dependencies, per-slice delivery records and the measurement-run budget. All three independent positions and the synthesis are saved; no implementation task was completed.
**Refs:** D6 (early neutral input), D7 (delivery prerequisites); [latest synthesis](deliberations/002-plan-review/results.md).

### 2026-11-03 -- Browser interruptions change execution order
**Event:** blocker
**What:** Three early full-Chrome capability attempts failed or were interrupted, and Gary reported focus/Spaces disruption during active Mac use. Their recorded task-created PIDs were checked absent after cleanup. Browser work stopped immediately. The evidence contract, source snapshots, live diagnostic hooks, exclusive input, durable export, offline analyzer and normal-controller command plumbing were implemented and tested without further browsers. Inert-process supervision and loopback HTTP tests passed, as did project checks/build. Actual browser ownership fault proof, normal game smoke, route, overhead/noise/sensitivity acceptance and the operating skill remain pending. No performance improvement is claimed.
**Refs:** D8 (explicit foreground window), D9 (capability receipts); [implementation evidence](../../../verification/performance/2026-11-03-lab/README.md).

### 2026-11-03 -- Offline preparation before the quiet window
**Event:** discovery
**What:** Gary authorized remaining non-browser preparation. Review found that baseline builds were not explicitly bound to calibration, fault timeouts did not prove entry into the intended hang, and the analyzer lacked its planned per-segment output. These gaps are corrected with negative regression cases. Synthetic controller/CLI tests now cover the complete 48-run order and retained cleanup-failure lease, while live inert-process and HTTP tests remain separate from browser acceptance. Hardware work remains blocked until Gary explicitly reserves the Mac; no additional browser launches were made.
**Refs:** D8 (explicit foreground window), D9 (capability receipts); [offline preparation evidence](../../../verification/performance/2026-11-03-lab/README.md#additional-offline-preparation).

### 2026-11-03 -- Quiet Mac explicitly assigned
**Event:** phase-change
**What:** Gary explicitly gave the Mac to this task and suggested caffeinate. Browser verification and measured acceptance can resume, with one owned foreground browser and bounded keep-awake activity. No lock-screen or security settings are changed.
**Refs:** D8 (explicit foreground window), D9 (capability receipts).

### 2026-11-03 -- Real browser exposes extension and termination interference
**Event:** discovery
**What:** Hardware, worker-death and confirmed blocked-page proofs passed. The first full game capture completed and acknowledged its payload, but an external passwordalert exception invalidated the run. Disabling extensions removed that exception. Its replacement completed without JavaScript errors but was rejected by a signalling error during teardown; independent exact-PID reconciliation found no remaining owned processes, recorded a separate recovery receipt and released the stale lease. The original rejected evidence remains unchanged. Cleanup distinguishes signal errors from inspection errors and still requires exact owned-PID absence, with negative tests for both persistent helpers and unavailable inspection. An ordinary-game smoke command and declared partial-capture interruption support the remaining integration checks.
**Refs:** D9 (capability receipts); local runs `20261103-212851-e4adab94` and `20261103-213130-cfa22d14`, including `cleanup-recovery.json`; Task 5.2 (failure integration).

### 2026-11-03 -- Cross-country route fails honestly; road policy replaces it
**Event:** discovery
**What:** Ordinary and diagnostic Low/Mid/High boots passed, together with an acknowledged deliberate partial capture. The first drive then wrecked at roughly six accepted seconds near a vendor cluster, retaining its position samples, game-over screenshot and successful cleanup. No calibration had begun. The replacement `road-follow-v2` policy follows the fixed seed’s actual road centerlines, adds bounded lookahead and normal-control corner braking, uses a declared initial heading, and tightens the corridor from 35 to 10 metres. Four milestones and the 60-second measurement remain unchanged. This is a new pre-calibration route policy, not a widened acceptance envelope. Tests cover road command signs, progression, straight boost and corner braking; a real route pilot is required before acceptance.
**Refs:** local rejected run `20261103-214248-90524405`; Task 4.3 (streaming drive), Task 4.4 (route stability).

### 2026-11-03 -- Human interruption is preserved; fresh holdouts pass
**Event:** discovery
**What:** The first full trial stopped during parked holdout run 14 on foreground loss. Gary confirmed he had briefly returned and caused the focus change, then explicitly reassigned the quiet Mac. The failed trial and partial capture remain unchanged with a separate context receipt. A fresh full trial began with new overhead/calibration/holdout data, rather than replacing that one capture. Fresh parked collector overhead passed (+0.20 ms p95 against a 3.29 ms tolerance), calibration froze a 2.6 ms p95 threshold, and both fresh ABBA holdout blocks returned no detectable change. Injected sensitivity and driving acceptance remain pending.
**Refs:** local experiments `20261103-220238-09ef2b8a` and `20261103-221851-e5fcab83`; Task 3.5 (fresh parked holdouts).

### 2026-11-03 -- Comparable-population failure changes fixture construction
**Event:** discovery
**What:** The fresh full trial passed parked overhead, calibration and independent holdouts, but rejected sensitivity because normal run 24 contained 59 children against a frozen upper bound of 58.3. The dose was not the invalidation reason. Inspection traced the count to eight independent unseeded 5–8-child construction draws, confirmed by per-run constant populations ranging 47–59. The new private construction dependency leaves ordinary construction/update draw order and 400 legacy frames exactly unchanged, while a new diagnostic recipe makes initial population/layout independent of unrelated global draws and retains live child randomness. This replaces the fixture before fresh calibration rather than relaxing its bound. The same preparation pass rejects unknown analysis-policy versions and fixes experiment CLI output to identify its actual bundle.
**Refs:** D10 (isolated construction recipe); local trial `20261103-221851-e5fcab83`, run 24 and `dense-festival-v1/sensitivity.json`; `bin/test-children-ownership`, `bin/test-performance-lab-contract`, `bin/test-performance-lab-runner`.

### 2026-11-03 -- Revised parked recipe passes trusted comparison
**Event:** phase-change
**What:** The completely fresh `live-festival-v2` trial passed parked overhead (+0.50 ms p95 against 3.18 ms tolerance), frozen calibration (6.7 ms p95 threshold), both independent holdout blocks (no detectable change), and both injected-cost blocks (regressed with no invalidity reasons). All injected medians were 40 ms, with a paired median p95 increase of 38.05 ms. The fixture retained its declared child population without changing the guard or removing actors. This establishes trusted parked comparison for this desktop/configuration; driving and full-suite acceptance remain pending.
**Refs:** local experiment `20261103-225708-8aabcd0e/dense-festival-v1/`; Task 3.6 (parked sensitivity).

### 2026-11-04 -- Full acceptance, independent review and final cleanup
**Event:** phase-change
**What:** The revised fixture completed all 48 captures. Both fresh holdouts returned no detectable change, both declared 40 ms injected variants regressed with no invalidity reasons, and all six real CLI reports regenerated exactly. The accepted trial’s entire 301-file live inventory matched its snapshot before post-trial review fixes. A three-specialist smart-review found host/snapshot identity drift and key-repeat restoration edges; both were fixed and independently rechecked without changing the measured timing/controller/statistics path. Full project checks/build and a fresh nine-check ordinary/diagnostic tier, partial-capture and normal/injected route matrix passed for the corrected source, whose manifest stays distinct from the timing trial. A real stale-snapshot CLI attempt was refused before launch. Final exact-PID/birth reconciliation covered 144 ownership manifests and 2777 browser PIDs, finding no owned identities; both task keep-awake processes and parents are gone, and Gary’s original Chrome, server and keep-awake survived. All ten requirements and 24 scenarios are mapped; no unresolved review findings or human questions remain. No commit or archive was performed.
**Refs:** [acceptance and raw evidence](../../../verification/performance/2026-11-03-lab/README.md), [spec coverage](verification.md), [specialist synthesis](reviews/001-implementation/review-summary.md), Task 6.3 (final verification and handoff).
