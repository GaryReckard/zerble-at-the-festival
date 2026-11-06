# Verification: repeatable-performance-lab

## Summary

| Dimension | Result |
| --- | --- |
| Completeness | 27/27 tasks complete |
| Correctness | All ten requirements and 24 scenarios mapped |
| Coherence | Revised fixtures and guard changes match the recorded design decisions |
| Independent review | Three specialists; all findings resolved and rechecked |

No critical or warning issue remains in scope. The implementation is ready for archive, which was not requested or performed.

## Scope

The implementation is checked against all ten delta requirements and 24 scenarios in [the specification](specs/performance-lab/spec.md). The [48-run evidence](../../../verification/performance/2026-11-03-lab/README.md) identifies the exact measured source and build. The final review adds two guarded edge cases outside the timed path; their focused regressions and new-source integration evidence are recorded separately rather than relabelling the measured manifests.

## Requirement and scenario coverage

| Requirement and scenarios | Implementation | Verification |
| --- | --- | --- |
| Opt-in real-game scenarios: dense festival, streaming drive, ordinary play | `src/performanceLab/config.js:3`, `src/main.js:3180`, `src/performanceLab/scenarios.js:1` | Ordinary and diagnostic Low/Mid/High boots; parked and driving full-trial raw captures; ordinary `smoke.json` verifies absent lab state. |
| Exclusive input and truthful progress: slow/blocked drive, physical controls | `src/input.js:72`, `src/performanceLab/runtime.js:39`, `src/physics/liveWorld.js:356` | Input/runtime regressions cover all channels, abort and held/edge restoration. Injected driving completes all milestones and retains wall/accepted/outer/physics progress; missing route/streaming work is invalid. The post-review repeat-key regression covers keys first pressed during ownership. |
| Reproducible identity and fixed settings: HMR/resizing, dirty checkout | `tooling/performance_lab/snapshot.py:9`, `src/performanceLab/runtime.js:51` | Source/build drift and live-host drift refusal tests; explicit source inventory/dirty manifest; immutable loopback build; 1 Hz actual target/dimension/rung observations and configuration-drift rejection. Current host verification occurs before and after launch, not just inside the snapshot. |
| Quiet hardware execution: assigned Mac, foreground/competing game | `bin/perf-lab`, `src/performanceLab/runtime.js:19`, `tooling/performance_lab/worker.mjs` | Native title gesture and M4 Pro ANGLE renderer receipts; explicit quiet assignment and no known competing game tabs; real foreground interruption retained as failed, with human confirmation and fresh trial. |
| Independent deadlines and ownership: blocked page, killed controller, owned server | `tooling/performance_lab/supervisor.py:102`, `tooling/performance_lab/capability.py:29` | Confirmed page-hang and actual worker SIGKILL proofs; inert browser-root exit, timeout, inspector failure and lease retention tests; direct final PID/birth reconciliation, with unrelated Chrome/server/keep-awake preserved. |
| Durable bounded capture: interrupted upload, attribution mode | `src/performanceLab/runtime.js:39`, `tooling/performance_lab/supervisor.py:79`, `tooling/performance_lab/contract.py:128` | Exact primitive frame cap/overflow, identical-byte lost-ack retries, real HTTP atomic/idempotent/conflict/schema/origin tests and acknowledged partial capture. Instrumentation identity mismatch is rejected; unavailable GPU duration remains unavailable. Legacy report tests still pass. |
| Comparable content and bounded collector perturbation: cheaper submissions, reduced content, collector cost | `tooling/performance_lab/analysis.py:23`, `tooling/performance_lab/experiment.py:9`, `src/performanceLab/runtime.js:48` | Four-run overhead experiment per scenario; finite calibration/content envelopes; reduced draws allowed and semantic crowd/child loss rejected. A real 59-child normal run was invalidated before the independently seeded construction recipe and entirely fresh trial. |
| Deterministic offline analysis: incompatible inputs, same data twice | `tooling/performance_lab/contract.py:42`, `tooling/performance_lab/analysis.py:45`, `bin/compare-perf-runs` | Exact raw-frame/segment quantiles, malformed/incomplete/duplicate/corrupt/unknown-policy tests; original capture hashes checked; all six real CLI analyses and both full-scenario replays regenerate exact canonical results without mutation. |
| Calibrated conservative verdicts: known regression, spare headroom, holdout failure, unstable source | `tooling/performance_lab/analysis.py:23`, `tooling/performance_lab/analysis.py:45`, `tooling/performance_lab/experiment.py:9` | Four calibration plus eight fresh holdout plus eight alternating injected captures per scenario. Both holdouts return no detectable change and both comparable 40 ms injections regress; headroom, mixed outcomes, drift/holdout failure, instability and protected-segment negatives have tests. No threshold widening or failed-run replacement. |
| Script authority and operating skill: another agent resumes | `.agents/skills/performance-lab/SKILL.md`, `docs/performance-lab.md`, `verification/performance/2026-11-03-lab/regenerate.py` | Skill validator passes; verified commands retain scripts as statistical authority; saved evidence regenerates without a browser. Quiet-window reuse, process cleanup and scope limits are explicit. |

## Completeness, correctness and coherence

The real-game routes, timing/semantic contract, supervisor and offline analyzer satisfy their intended boundaries. The initial failed cross-country route and unseeded child recipe are preserved and replaced through declared policy/content versions, with fresh calibration rather than hidden workload adjustment. Runtime physics, world ownership, shared resources, Three shim and synchronous title-audio initialization remain under their existing owners.

No new model, material or shader is added, so a new-model sandbox wiring check is not applicable. Main-game native ready-title boots cover Low/Mid/High. Calibrated performance covers desktop High only; no mobile, Auto, cold-cache, subjective-feel or iOS audio-unlock acceptance is inferred.

## Specialist review

The [smart-review artifact](reviews/001-implementation/review-summary.md) includes independent gameplay, performance and documentation reviewers. Gameplay identified host/snapshot provenance and post-release repeat-key leaks; both were corrected, reproduced by focused tests and independently rechecked. Performance confirmed that the frozen-source statistical conclusions remain valid and that the guard fixes do not change the measured execution path. Documentation findings about missing smoke receipts and stale acceptance wording were corrected.

The complete post-review nine-check browser matrix passed, and a real CLI stale-snapshot attempt was refused before launch. Final status and the distinct post-review source identities are recorded in the change session log and dated evidence. No archive or Git commit is performed as part of verification.
