## Profiler's Position

### Priority Sequence

1. Implement and fixture-test the run contract and pure analyzer first, then prove the hardware-browser lifecycle before adding game instrumentation. This matches the existing separation between capture-only frame timing and the adaptive-quality window (`src/perfTelemetry.js:1`) and avoids broadening unsafe browser coverage before cleanup is established (`tasks.md:10-14`).
2. Establish one fixed-tier, fixed-physical-size experiment with two workload classes: active parked steady state and normal-controller streaming allocation work. The existing doctrine distinguishes spawn stalls from steady-state FPS (`.claude/rules/performance.md:103-116`), while current High and Low populations/render policies differ (`ARCHITECTURE.md:594-603`). Smoke Low/Mid, but do not turn this milestone into a cross-tier performance matrix.
3. Measure the lab's own perturbation, then calibrate unchanged-source noise and workload variation. Add the diagnostic injection only after its dose, cadence and effect on both CPU work and wall delivery can be verified.
4. Execute alternating snapshot comparisons and preserve scenario-level outcomes, source identity, incomplete runs and worst stalls. Write the skill after the scripts can regenerate the same report from saved evidence.

### Performance Risks Identified

| Risk | Type | Severity | Trigger Condition |
| --- | --- | --- | --- |
| Collection overhead creates the regression being measured | Alloc / SteadyState | High | The plan adds frame/progress/workload observations but does not yet set an overhead acceptance check (`design.md:45-55`). Existing capture windows allocate frame objects, and snapshot collection drains crowd self-time counters (`src/perfTelemetry.js:67-71`, `src/debug.js:2043-2068`). |
| Comparability rejects successful optimizations | Draws / Tris / SteadyState | High | Broad workload validation treats lower draw/resource counts as materially different work, although instancing and renderer changes intentionally reduce those outcomes (`design.md:54,61-65`; historical reduction examples in `.claude/perf-pass-2-plan.md:74-76`). |
| Known injected CPU cost does not cross a display deadline | SteadyState | High | Injection is sized above observed noise but not necessarily above available frame headroom (`design.md:67`). A CPU cost can be real while wall delivery stays display-limited; the lab records both work and wall separately (`src/main.js:1200-1215`). |
| Instrumented or paused probes are mistaken for ordinary game performance | SteadyState | High | Reusing sceneProbe's execution loop would pause gameplay and miss crowd work; it explicitly sets pause and performs composer-only renders (`src/sceneProbe.js:37-41,62`). The current design correctly excludes this (`design.md:19`). |
| Display/session differences masquerade as candidate changes | SteadyState | Medium | GPU/browser/viewport are fixed, but refresh/power/display conditions are not explicitly part of the policy identity (`design.md:49-50`). Record available display cadence/power observations and operator conditions, and detect baseline session drift. |
| Streaming work is normalized away during slow frames | Alloc | High | Main clamps outer elapsed to 50 ms (`src/main.js:1207`), so identical accepted travel may take different wall time. The design correctly records outer loss separately and preserves incomplete progress (`design.md:39,53`). |

### Required Mitigations

**Distinguish workload invariants from optimization outcomes.** Freeze route, camera, settings, seed/start state and scene-semantic coverage as comparability inputs. Treat draw calls, triangle submissions, shader/resource counts and subsystem timings as outcomes that are allowed to improve. Actor presence/population changes require a declared claim class: equal-content comparison or explicit quality/workload tradeoff. Do not silently call reduced crowd density an equal-work optimization, and do not invalidate instancing merely because draws fell. Add tests for both cases. This sharpens the broad material-work check in `specs/performance-lab/spec.md:81-85` without demanding perfect live-world determinism.

**Validate collection perturbation and metric ownership.** Prefer bounded buffered primitive samples, no per-frame serialization/network/disk writes or scene traversal, one authoritative owner for draining counters, and export after measurement. Add an acceptance task comparing lightweight collector enabled/disabled on the same scenario, report the observed overhead, and separate heavy attribution. Existing `collectPerfSample` has observable counter-draining side effects (`src/debug.js:2043-2068`); two consumers cannot be assumed independent. The overhead experiment cannot prove zero cost, but it can reject a collector that materially changes the workload or crosses frame deadlines.

**Specify injection validity beyond noise magnitude.** Predeclare a bounded dose/cadence after calibration that produces a measurable CPU-work increase and crosses the relevant wall-delivery threshold without violating route comparability or the run deadline. Retain insufficient-dose experiments as diagnostic outcomes, then version/redeclare a stronger dose before repeating; never claim analyzer failure solely because frame delivery had spare capacity. Add deterministic fixtures for cost increase with unchanged wall delivery and for an actual wall regression. The requirement currently promises `regressed` from a dose exceeding only the noise floor (`specs/performance-lab/spec.md:95-97`), which is insufficient.

**Make prepared-runtime conditions explicit.** Fresh test profiles and immutable snapshots do not imply cold OS/driver/shader caches. Keep the proposed cold-start exclusion (`design.md:11,41`), capture program-count deltas and startup/settling separately, and retain any late compilation stall. Pin the initial tier and quality policy before world construction. Record refresh/power/display facts when available, without claiming inaccessible thermal telemetry. Recalibrate when observable session conditions materially change.

### Budget Estimate

- **Draw delta:** zero intended production or scenario-content draws; test controls must remain outside the measured canvas path. Existing budget guides remain Low 80 / Mid 200 / High 400, but this lab must use measured timing and content evidence rather than treat the HUD colors as device acceptance (`.claude/rules/performance.md:49-51`).
- **Triangle delta:** zero intended; no new geometry or shadow casters. Closest-tier headroom cannot be inferred without the actual scenario captures; current policy explicitly requires Low-tier fallback and deliberate shadow additions (`AGENTS.md:112-114`).
- **Cost type:** the lab itself adds opt-in steady-state collection and bounded capture allocation; its two scenarios intentionally separate steady-state and streaming allocation costs. Production launches must incur no sampler/query/injection activity (`specs/performance-lab/spec.md:15-17`).
- **Low/mid-tier verdict:** safe in planned geometry/render policy, contingent on measured collector overhead, bounded buffers and required normal/diagnostic boot checks. Desktop High measurements do not establish mobile performance.

### Verdict

- **Verdict:** Proceed with mitigations.
- **Key Concern:** The analyzer must distinguish comparable scene content from deliberately improved rendering outcomes; otherwise a successful optimization can invalidate its own benchmark.
- **Recommendation:** Keep both scenarios and the source/cleanup/calibration architecture, but amend the contract now for input-versus-outcome comparability, collector perturbation and injection headroom. Those changes are small compared with the cost of trusting a misleading automated verdict.
