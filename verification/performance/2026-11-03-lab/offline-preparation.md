# Offline preparation before the reserved-Mac window

This is the historical state before hardware acceptance; current results are in [the final report](README.md).


The remaining sections record the state before the quiet-Mac window, not current browser capability or task counts.

## Implemented surfaces

- `bin/perf-lab`: explicit source/build snapshots, one-session lock, independent supervisor, task-owned full Chrome/CDP worker, individual runs and a serial experiment controller.
- `tooling/performance_lab/`: bounded loopback export with atomic writes and final hash acknowledgement, exact raw-frame contract, source/build verification and deterministic finite-sample analysis.
- `bin/compare-perf-runs`: strict offline calibration, fresh holdouts and paired comparisons with explicit invalidity. Saved payload integrity is checked before analysis.
- `src/performanceLab/`: diagnostic-only scenario state, primitive frame buffer, ordinary controller commands, route checkpoints, workload/cost observations and explicit restoration. The live game keeps updating; method-level spawn probes and paused-render alternatives are excluded.
- Normal input, analytics, leaderboard and quality modules have localhost-only lab integration. The existing guided-report path remains available.

## Offline evidence

Contract, analyzer, input, runtime, integrity, capability-gate and existing report regressions pass. The full `npm run check` and production `npm run build` passed after correcting an existing source-extraction test boundary exposed by the input hook. New host-only checks also passed separately. The runtime test covers exact frame export, identical retry bytes, acknowledged completion, quality/time/input restoration, visibility and HUD invalidation. The analyzer fixtures exercise all four verdicts, fresh holdout identity, content loss versus cheaper rendering, session drift, incomplete data, CPU headroom and deterministic unmutated output.

The supervisor test used inert Python process trees, not a browser, and verified real exact-PID absence after successful completion, worker SIGKILL and an independently enforced hung-worker deadline. The transport test used a temporary loopback server and verified persistence/receipt hashes, identical retries, conflicting data, invalid schemas and cross-origin rejection. These tests do not prove full Chrome cleanup or real game startup.

An immutable source snapshot built successfully with 296 inventoried files. Early snapshot construction failed because root CSS was missing from the explicit inventory; CSS is now included, and failed attempts remain isolated from the live checkout.

## Browser capability attempts

Three foreground full-Chrome probes were attempted before Gary's interruption. Their local ownership records are retained under `.claude/captures/performance-lab/runs/`:

| Run | Result | Cleanup |
| --- | --- | --- |
| `20261103-171508-f74b4a66` | Overall 25-second deadline | All 28 recorded task-created PIDs absent |
| `20261103-171639-536b356d` | Actual Apple M4 Pro GPU and visible title gesture saved, but rejected a missing-favicon 404 in the probe fixture | All 13 recorded task-created PIDs absent |
| `20261103-171706-88819e90` | CDP session disappeared before a GPU result was saved | All 17 recorded task-created PIDs absent |

The probe fixture now includes a data favicon, and protocol errors include their command names. Session-loss attribution still requires a new explicitly quiet test window. The supervisor polls owned Chrome exit and verifies its exact recorded PIDs; no pre-existing user tab or process was intentionally stopped. These attempts are not device frame-rate evidence.

The CLI now structurally refuses game runs without all three hardware/fault receipts for the current backend, and refuses full experiments without a valid acknowledged parked collection. No accepted receipts exist yet.

## Remaining acceptance

Actual browser feasibility and browser fault cleanup, normal/diagnostic ready-title integration on Low/Mid/High, route stability, collector overhead, frozen calibration, fresh holdouts and comparable injected-cost detection remain unmeasured. The project skill is deferred until those commands are verified. Desktop timing would still not establish phone performance, driving feel, Auto behavior or cold-cache performance.

Commands and schemas are documented in [the lab guide](../../../docs/performance-lab.md); exact implementation progress is tracked in [the change](../../../openspec/changes/repeatable-performance-lab/README.md).

## Additional offline preparation

A follow-up review found and corrected gaps before hardware testing resumes:

- Calibration/holdout and candidate baseline identities now include the exact app and build, and malformed JSON containers produce invalid-input outcomes rather than parser exceptions.
- The analyzer now emits per-segment distributions and uses calibrated segment p95 guardrails, so an overall gain cannot hide a protected segment regression. Driving captures retain actual checkpoint wall time and require complete checkpoint/segment/streaming evidence.
- Fault receipts require a persisted fault-entry marker. A boot timeout before the requested page hang is not accepted as proof of hang cleanup.
- Inspection failure cannot bypass resource termination or produce a success claim, and an exited root's stale process group is never signalled. Cleanup failure revokes backend capability and retains the exclusive lease for reconciliation.
- A synthetic controller test exercises all 48 declared run slots with calibration, fresh holdouts and injected comparisons, and confirms that cleanup failure stops after the first attempt. The CLI lease test independently verifies that a second launch is refused. Neither test launches an OS browser or produces device performance evidence.

The task count remains 12/27 because these are hardening of completed code tasks, while the outstanding acceptance tasks require the reserved Mac. No browser was opened during this follow-up.
