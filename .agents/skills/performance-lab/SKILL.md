---
name: performance-lab
description: Run Zerble’s reserved-Mac performance captures and deterministic comparisons, or analyze saved lab runs. Use for repeatable frame-time and streaming-route evidence; subjective driving feel and phone tests use their separate workflows.
---

# Performance lab

Run from the repository root. Read [the operating guide](../../../docs/performance-lab.md) and its dated acceptance evidence first, because implemented commands and accepted measurement claims are different things. Scripts own validity, statistics and verdicts; do not replace their rules with an informal FPS comparison.

## Choose the work

For existing evidence, use the offline commands below without launching a browser. For new captures, Gary must have explicitly reserved this Mac for the session. Reuse that authorization throughout the assigned window; do not ask for each run. If no quiet window is assigned, complete preparation and ask once before opening a foreground test profile. These Chrome windows can take focus and change Spaces.

Before timed work, finish relevant tests and builds, inspect known competing game tabs without modifying user sessions, and record the quiet-window condition and any known competing activity. A quiet assignment does not prove OS-wide isolation, temperature control, cold caches or a particular refresh rate. A bounded task-owned `caffeinate` is appropriate when needed; record its PID and stop only that process afterward.

## Prepare and establish collection

Check the current directory, branch and dirty state, preserving Gary’s checkout and existing servers. Prepare the immutable build:

```sh
npm run check
npm run build
bin/perf-lab snapshot
```

Use the exact snapshot path printed by the last command. Do not build, run full checks or perform heavy analysis concurrently with a measured capture.

The installed full-Chrome adapter uses disposable extension-disabled storage, hardware GPU rendering and independent supervision. Its capability receipts are tied to the backend signature. When receipts are absent or stale, prove all three paths serially:

```sh
bin/perf-lab probe --quiet --deadline 30
bin/perf-lab probe --quiet --fault worker-death --deadline 30
bin/perf-lab probe --quiet --fault page-hang --deadline 15
```

The normal probe must succeed. Deliberate faults must fail with the expected fault-entry evidence and successful cleanup in `ownership.json`; their nonzero exit alone proves nothing. The runner enforces the receipt gate. Do not substitute software WebGL or bypass a failed gate.

For a changed build, verify ordinary and diagnostic ready-title integration on Low/Mid/High before accepting experiment timings. The following show one tier:

```sh
bin/perf-lab smoke --quiet --snapshot SNAPSHOT_DIRECTORY --tier high
bin/perf-lab run --quiet --snapshot SNAPSHOT_DIRECTORY --tier high --scenario dense-festival-v1
```

The smoke command checks an ordinary boot with no lab runtime. The run command uses the normal title gesture, exclusive diagnostic controls and acknowledged exact-frame export. `--interrupt-after 22` deliberately interrupts a run and must retain an acknowledged partial failed capture, never a completed comparison input. The fixed driving scenario is selected with `--scenario streaming-drive-v1`; verify its current route acceptance in the guide before using it for claims.

## Compare honestly

The full acceptance command declares its run inventory and executes serial overhead, calibration, fresh holdout and injected-cost trials for both scenarios:

```sh
bin/perf-lab experiment --quiet --snapshot SNAPSHOT_DIRECTORY --injection 40
```

This is a sensitivity experiment with a deliberately slower variant, not a game optimization. A failed overhead check, calibration, holdout, route or injected comparison stops acceptance. Preserve that attempt. Never rescue it by deleting runs, widening frozen thresholds, relaxing route/content bounds, or calling measurable CPU cost a detected frame regression. A revised fixture or policy requires a declared version and fresh calibration.

For explicit saved runs:

```sh
bin/report-perf-playtest /absolute/path/to/run.json
bin/compare-perf-runs --calibrate --output calibration.json RUN1 RUN2 RUN3 RUN4
bin/compare-perf-runs --calibration calibration.json --validate-holdout --output holdout.json A1 B1 B2 A2 A3 B3 B4 A4
bin/compare-perf-runs --calibration calibration.json --holdout holdout.json --output comparison.json A1 B1 B2 A2 A3 B3 B4 A4
```

Each input needs its sibling acknowledged `capture.json`. Calibration and holdout data are independent; the baseline app/build, harness, conditions and semantic work must match. The analyzer protects route segments and permits lower draw counts when content is retained. Exit codes are 0 for improved/no detectable change, 1 for regressed and 2 for comparison invalid. Regenerate analysis from the exact paths to verify determinism, preserving source artifacts.

## Ownership and reporting

One lab session owns one repository lease and at most one standalone browser. The supervisor records owned process identities, enforces deadlines independently of page JavaScript/control-worker survival, and checks exact PID absence. Cleanup failure revokes capability and retains the lease, preventing the next launch. Stop and reconcile the recorded owner and every recorded PID before releasing a stale lease; do not kill unrelated processes, delete evidence, or infer success from a truncated process listing. A signal error can be retained with successful cleanup only when independent inspection proves every owned process absent.

Keep failed manifests, partial captures and worst stalls. Promote selected raw evidence and source/build identities into a dated verification bundle, and cite those artifacts in the final report. State which stage is established: collection capability, trusted parked comparison, or full two-scenario acceptance. Report the scripts’ exact verdict and material detection limits. Desktop fixed-tier results do not establish Auto quality, mobile performance, iOS audio unlock or subjective smoothness. Stop task-owned keep-awake activity and leave Gary’s pre-existing development server and browser sessions intact.
