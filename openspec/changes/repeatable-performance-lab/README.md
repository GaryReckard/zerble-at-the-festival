# A trustworthy performance lab for Zerble

> **Status:** <!--STATUS:LINE-->complete · 27/27 tasks (100%)<!--/STATUS:LINE-->

## TL;DR

Build a small lab that lets an agent run Zerble on Gary's reserved Mac, collect comparable evidence and evaluate a change without asking Gary to drive. Start by proving one safely owned browser can capture an active festival, then establish reliable comparisons, and finally add a streaming drive. The implementation and a complete 48-run desktop trial passed on Gary’s explicitly reserved Mac. Both scenarios passed hardware ownership/failure cleanup, overhead, calibration, fresh holdouts and comparable injected sensitivity; failed earlier attempts remain preserved.

## The Problem

A slow game can have several causes, and a parked test cannot expose everything that happens during driving. Recent probes found expensive bubble rendering and crowd terrain checks, but their live populations and workloads varied between runs. Repeating a route or quoting average FPS alone does not establish whether a change helped, especially if a struggling version travels less distance or Auto quietly reduces visual quality. The [existing investigation](../../../verification/performance/2026-11-02-render-load/README.md) retains those measurements and limits.

Gary can reserve the Mac while an assigned performance task runs. That gives the lab a practical quiet window, while the tool still needs to detect interrupted visibility, record known competing activity and avoid claiming complete control over temperature or other OS work.

## Proposed Fix

Deliver three usable slices, with a safety and evidence gate at each boundary:

1. **Prove collection.** Use one foreground, hardware-backed Chrome session and an immutable game build. Start through the normal title screen, keep people and bubbles updating, export exact frame timings, establish neutral input ownership before measurement, and demonstrate cleanup after both a blocked page and a terminated control worker. This slice reports collection capability, not a performance improvement.
2. **Prove comparison.** Measure the collector's own overhead, repeat an unchanged build to establish normal variation, freeze the comparison rules, and test them on fresh unchanged-build runs. Then deliberately add a declared CPU cost and verify the lab detects a comparable slowdown.
3. **Add streaming driving.** Use the normal driving controller to accelerate, boost, turn, load and unload world regions, and return. Record route progress, elapsed time and any time the simulation discarded. Complete the same repeatability, sensitivity and cleanup checks before calling the whole lab accepted.

The final report gives each scenario one of four outcomes: **improved**, **regressed**, **no detectable change**, or **comparison invalid**, with saved source identities, individual runs, worst stalls and reasons. The initial candidate is the deliberately slowed variant, so acceptance does not require an unrelated game optimization.

## Progress

<!--STATUS:AUTO-->
**complete** — 27/27 tasks complete (100%) · current: 1.2 (hardware browser capability)

_Last updated: 2026-11-04_

| Group | Progress |
|---|---|
| 1. Minimum contract and supervised browser foundation | 4/4 ✅ |
| 2. Thin real-game parked capture | 5/5 ✅ |
| 3. Trusted parked comparison and offline analysis | 6/6 ✅ |
| 4. Streaming drive through normal controls | 5/5 ✅ |
| 5. Complete safety and integration acceptance | 4/4 ✅ |
| 6. Agent handoff and documentation | 3/3 ✅ |
<!--/STATUS:AUTO-->

## Key Decisions

- Scripts own the data rules and calculations. A project skill will tell agents how to run the verified commands and cite evidence, without becoming a second implementation of the analyzer.
- Freeze one measured graphics configuration and one browser backend first. Low/Mid/High receive integration smoke checks; wider performance matrices need their own calibration.
- Compare the same semantic work, such as route, visible-content policy and streaming coverage. Fewer draw calls can be a successful optimization, while silently reducing the crowd is a different experiment.
- Keep incomplete and divergent runs. A drive that fails to finish cannot become a favorable performance result by disappearing from the dataset.
- Use exact per-frame timing for lab percentiles. Existing manual captures and their window summaries remain supported under their original meaning.
- Preserve the source and build for every variant, including relevant uncommitted files, without changing Gary's dirty checkout or stopping his play server.
- Give cleanup authority a lifetime independent of the control worker. A page's finally handler cannot rescue a blocked page, and a dead worker cannot enforce its own deadline.
- A quiet-Mac assignment is recorded once for the experiment. No scheduler, recurring permission prompt, user-recorded drive or perfectly deterministic festival is required.

These decisions incorporate the prior Astra Medium feedback, the [initial synthesis](deliberations/001-initial/results.md), and the latest [Anthropologist, Pragmatist, Auditor and Mediator review](deliberations/002-plan-review/results.md). The latest refinements put neutral input protection in the parked slice, require safe supervision from the first browser launch, make integration checks prerequisites of measurement, and require delivery records for each shipped slice. All council mitigations are reflected in the design and tasks.

## Risks & Watch-outs

The browser backend and route passed the current acceptance trial; a changed backend or fixture needs renewed proof. Full acceptance entails at least 40 calibration/holdout/injection runs, about 30 minutes of accepted measurement at the declared windows plus boot, settling, overhead experiments and retries; the runner will display its inventory before execution. A fresh test profile does not mean cold OS or graphics-driver caches. CPU work can increase without changing displayed frames when spare time remains, so injected-cost validation must measure both while preserving route comparability. Instrumentation can change the result, which is why collector overhead is an acceptance check.

The lab must preserve normal input behavior, the synchronous audio start gesture, the Three shim, existing world-generation seeds and shared-resource ownership. Production launches must have no active lab sampler, control source or injected cost. Current AGENTS/Vite instructions take precedence over stale no-build/importmap wording in OpenSpec configuration.

This plan does not add game optimizations, automatic scheduling, mobile automation, a general flight recorder, historical-version adapters or a broad quality/cold-start matrix. Desktop timing does not establish driving feel, phone performance or Auto acceptance. No human decision is currently blocking implementation; the technical unknowns have explicit experiments and failure outcomes in the task list.

## Where Things Live

- [Proposal and scope audit](proposal.md): why this exists and which existing tools it extends.
- [Technical design](design.md): browser supervision, capture/source identity, scenario policy and analysis rules.
- [Verification and spec coverage](verification.md), with the [specialist review](reviews/001-implementation/review-summary.md).
- [Implementation checklist](tasks.md): the ordered work and its verified completion state.
- [Performance-lab requirements](specs/performance-lab/spec.md): testable contracts and failure cases.
- [Latest council synthesis](deliberations/002-plan-review/results.md): completed-plan review, resolved trade-offs and risk register.
- [Initial council synthesis](deliberations/001-initial/results.md): original measurement-contract review.
- [Deliberation index](deliberations/000-index.md): gate status and links.
- [Session log](session-log.md): durable decisions and provenance.
- [Questions for Gary](questions-for-human.md): no open questions.

The verified runner/analyzer commands are documented in the [lab guide](../../../docs/performance-lab.md), with [complete acceptance evidence](../../../verification/performance/2026-11-03-lab/README.md) and the [operating skill](../../../.agents/skills/performance-lab/SKILL.md). Future captures require an explicitly assigned quiet-Mac window; changed backends and fixtures require the relevant proof and fresh calibration.
