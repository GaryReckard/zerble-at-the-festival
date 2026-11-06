# Local performance lab

[Performance playtests](performance-playtests.md) · [Implementation plan](../openspec/changes/repeatable-performance-lab/README.md)

## Current acceptance

**Both scenarios passed a complete 48-run reserved-Mac acceptance trial.** Hardware-backed full Chrome, independent worker-death/page-hang cleanup, ordinary/diagnostic Low/Mid/High boots, acknowledged successful/partial captures, overhead checks, frozen calibration, fresh holdouts and comparable injected-cost sensitivity are verified. See the [dated report and raw evidence](../verification/performance/2026-11-03-lab/README.md).

The backend uses disposable extension-disabled storage and a normal foreground window, with no incognito or software-WebGL flag. Earlier interrupted and rejected attempts remain preserved. Quiet-window permission is required for future sessions; an implementation request alone does not reserve Gary’s Mac. Desktop fixed-tier acceptance does not establish phone, Auto-quality or subjective-feel results.

## Offline commands

```sh
python3 bin/test-performance-lab-contract
python3 bin/test-performance-lab-analysis
python3 bin/test-performance-lab-integrity
python3 bin/test-performance-lab-capability
python3 bin/test-performance-lab-cleanup
python3 bin/test-performance-lab-experiment
python3 bin/test-performance-lab-runner
node bin/test-performance-lab-input
node bin/test-performance-lab-runtime
python3 bin/test-performance-lab-supervisor
python3 bin/test-performance-lab-transport
bin/perf-lab snapshot
```

The supervisor test launches only inert Python children, while the transport test starts a temporary loopback HTTP server. Neither opens a browser; they can require sandbox permission for `ps`/loopback access. `snapshot` inventories tracked and relevant untracked application files, copies them to a content-addressed directory, builds Vite output there, and prints a manifest. It does not switch branches, commit or change Gary's development server. Existing snapshots are verified against source/build hashes before reuse. The host CLI/tooling bytes actually executed must also match the snapshot before and after every launch; a stale snapshot is refused even when the backend probe receipts are current.

Exact raw timings use five numeric columns: wall milliseconds, main-loop work milliseconds, segment index, outer-loop discarded seconds, and actual injected CPU milliseconds. Work time is elapsed wall time inside the game tick, including synchronous rendering waits, rather than CPU-cycle profiling or GPU duration. Window summaries in old guided reports retain their original meaning and cannot substitute for these frames. The default reporter recognizes lab runs:

```sh
bin/report-perf-playtest /absolute/path/to/run.json
```

Strict comparisons require each `run.json` alongside its original acknowledged `capture.json`; the loader checks the saved payload hash and final projection before analysis. Calibration and fresh holdouts must identify the exact baseline app and build; a changed baseline is invalid. Comparisons retain individual runs and failures, report each route segment, and protect segment p95 against regressions hidden by whole-run gains. They do not pool frames across independent runs to enlarge the apparent sample size.

```sh
bin/compare-perf-runs --calibrate --output calibration.json RUN1 RUN2 RUN3 RUN4
bin/compare-perf-runs --calibration calibration.json --validate-holdout --output holdout.json A1 B1 B2 A2 A3 B3 B4 A4
bin/compare-perf-runs --calibration calibration.json --holdout holdout.json --output comparison.json A1 B1 B2 A2 A3 B3 B4 A4
```

Use fresh explicit paths in each command. The labels describe order, not filenames. Exit codes are 0 for improved/no detectable change, 1 for regressed, and 2 for invalid comparison. The deterministic finite-sample policy reports its thresholds and paired changes, rather than claiming statistical confidence. Lower draw counts are allowed outcomes; changes to declared content policy or adult/child population outside frozen bounds invalidate equal-work comparisons. Missing GPU timing remains unavailable.

## Browser commands

Run these only during an explicitly assigned quiet-Mac window, after preparation and builds/tests finish. They create a separate foreground Chrome profile and can change Spaces or take focus. They are deliberately not background browser operations.

```sh
bin/perf-lab probe --quiet --deadline 30
bin/perf-lab probe --quiet --fault worker-death --deadline 30
bin/perf-lab probe --quiet --fault page-hang --deadline 15
bin/perf-lab smoke --quiet --snapshot SNAPSHOT_DIRECTORY --tier high
bin/perf-lab run --quiet --snapshot SNAPSHOT_DIRECTORY --scenario dense-festival-v1
bin/perf-lab run --quiet --snapshot SNAPSHOT_DIRECTORY --scenario streaming-drive-v1
```

The runner refuses individual game runs until normal hardware, worker-death and page-hang receipts pass for the exact backend signature. It refuses full experiments until an acknowledged valid parked game capture also exists. Backend changes invalidate those receipts. A timeout alone is insufficient proof of a deliberate hang. The worker must persist an entry marker from the requested fault, and page-hang entry is acknowledged through a CDP runtime binding before the page blocks. A deliberate fault must exit unsuccessfully while saving `ownership.json` with successful exact-PID cleanup. Unexpected cleanup failure stops further launches. A host supervisor owns the browser and control-worker process groups, records ownership before execution, and survives a killed control worker. The page has separate restoration guards; the host does not depend on page JavaScript to end a hung session. A repository lock excludes concurrent lab sessions. Cleanup failure revokes capability receipts and retains that lock for explicit ownership reconciliation; a subsequent command cannot launch another browser. Never delete a stale lock or kill a process without inspecting its recorded owner and current identity.

`smoke` checks an ordinary ready-title game boot with no lab runtime, while `run` starts the real game through the ready Just Cruisin' title button with muted audio, fixed tier/rung, 1280×720 physical rendering at ratio 1, a fresh profile and diagnostic publication suppression. The parked scene remains active. The driving route has passed pilots and the complete overhead/calibration/holdout/injection trial using normal controller input; its earlier straight cross-country pilot wrecked and remains a failed attempt. The `road-follow-v2` revision follows actual seeded road centerlines with lookahead and corner braking inside a ten-metre corridor; no teleport corrections, invulnerability or obstacle removal are used. Missing route/streaming completion remains a failed comparison.

The serial full-acceptance controller has passed the declared two-scenario trial:

```sh
bin/perf-lab experiment --quiet --snapshot SNAPSHOT_DIRECTORY --injection 40
```

It declares 48 runs, including eight collector-overhead runs and forty calibration, fresh-holdout and injected-comparison runs. Measurement windows total about 36 accepted minutes, with boot, settling and retries additional. Synthetic controller coverage checks all 48 planned run slots and verifies immediate stop after cleanup failure; this does not constitute hardware or timing acceptance. The real controller stops on overhead, calibration, holdout, sensitivity, execution or cleanup failure and preserves the failed attempt. It does not widen thresholds or change the route to rescue a result. A declared injection may need a new, separately versioned trial if it fits spare frame headroom or invalidates driving.

Do not run a full suite until standalone cleanup, actual ready-title integration on Low/Mid/High, both scenario routes and capture validity pass. Do not build, run full checks or perform heavy analysis during timed captures. Record the quiet-window condition once per experiment; it is not proof of temperature or OS-wide isolation. Keep other game sessions paused or closed with appropriate user authorization.

## Evidence and operating skill

Local source snapshots, browser profiles, ownership records and raw runs live under ignored `.claude/captures/performance-lab/`. Promote selected raw evidence with a concise dated report after successful hardware validation. The [current implementation record](../verification/performance/2026-11-03-lab/README.md) records the completed hardware/two-scenario acceptance and retained failed attempts. The [performance-lab operating skill](../.agents/skills/performance-lab/SKILL.md) wraps the verified commands and reuses the analyzer's rules rather than inventing verdicts.

For a declared interrupted-capture check, use `bin/perf-lab run --quiet --snapshot SNAPSHOT_DIRECTORY --interrupt-after 22`. The expected result is a failed run with an acknowledged partial capture and successful cleanup; it is never eligible as a completed comparison input.

The current `live-festival-v2` content recipe uses the normal eight child groups with a private seeded construction dependency before boot. It does not override global randomness, freeze live behavior, or adjust actor counts after observing a result. This replaces a rejected full trial whose unseeded normal child count exceeded frozen comparability bounds. The changed content/harness identity requires fresh acceptance; previous thresholds and captures cannot be relabelled as the new fixture.

The saved 48-run trial identifies its exact pre-review source. Two later guard fixes bind executed host scripts to the snapshot and suppress held-key auto-repeat after diagnostic release; focused tests, a full project check/build and the [separate post-review integration matrix](../verification/performance/2026-11-03-lab/post-review/results.json) cover them. The original statistical manifests are unchanged, and future measurements use a current snapshot and fresh matching calibration.
