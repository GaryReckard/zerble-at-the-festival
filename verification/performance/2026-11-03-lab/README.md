# Repeatable performance lab, November 3, 2026

## TL;DR

**Both scenarios passed desktop acceptance in a complete 48-run trial.** Fresh unchanged-build holdouts returned `no detectable change`, and a declared 40 ms per-frame CPU injection returned `regressed` in both scenarios while completing comparable work. This validates the lab’s repeatability, sensitivity and ownership on this configuration, rather than claiming a game optimization. The [saved result](acceptance/result.json), [CLI replay checks](checks/cli-regeneration.json) and [source manifest](source-manifest.json) preserve the evidence.

## Conditions and identity

| Condition | Recorded value |
| --- | --- |
| Hardware/backend | Apple M4 Pro, full Chrome 157, ANGLE Metal hardware GPU |
| Render conditions | High tier, rung zero, 1280×720 physical canvas and scene target, DPR 1 |
| Generation | Seed 2404796662, time 0.3, real Just Cruisin’ title gesture, muted audio |
| Content | `live-festival-v2`, normal active festival, eight child groups containing 50 children; actor motion and appearance remain live |
| Driving | `road-follow-v2`, four milestones, normal controller input, ten-metre corridor |
| App/source hash | `9188f890a7f7b85b6d5c769e3d0762f26eaa4c5337d7e3c04b50b4a7f53077e8` |
| Build hash | `00067aaa66f404ff01089cb246b87a13bc5d3e088423e8c0bbc78b78eaba7e01` |
| Harness hash | `8d9f2c8b879fbac0ac1892bc4d0c28d6eb1c8f42e1b4c1caf5137e328827659a` |
| Git base | `7e7fd38eef4667e67802191a9df3acd43697ebfa`, with dirty tracked/relevant-untracked source preserved in the immutable local snapshot |

The [hardware context](hardware-context.json) records the local snapshot path and backend signature. The snapshot’s source/build files were verified before and after every run. The source manifest records each inventoried file and its hash; it does not require a clean checkout. Gary explicitly assigned the Mac, confirmed one brief return that interrupted an earlier trial, and reassigned it afterward. Connected browser inventories found no competing game tab. This does not establish OS-wide isolation, temperature, refresh rate or power-state control.

## Results

| Scenario | Collector p95 difference / tolerance | Frozen p95 threshold | Fresh holdout | Injected comparison |
| --- | --- | --- | --- | --- |
| [Parked festival](acceptance/dense-festival-v1/sensitivity.json) | +0.50 / 3.18 ms | 6.70 ms | [No detectable change](acceptance/dense-festival-v1/holdout.json) | Regressed, paired p95 +38.05 ms |
| [Streaming drive](acceptance/streaming-drive-v1/sensitivity.json) | −0.05 / 3.56 ms | 3.40 ms | [No detectable change](acceptance/streaming-drive-v1/holdout.json) | Regressed, paired p95 +43.70 ms |

Each scenario used four sentinel/full/full/sentinel overhead captures, four calibration captures, eight fresh holdouts in two ABBA blocks, and eight fresh normal/injected comparisons in the same order. Calibration data was not reused as holdout or candidate data, and thresholds were frozen before those phases. The [inventory](acceptance/inventory.json), [parked calibration](acceptance/dense-festival-v1/calibration.json), [driving calibration](acceptance/streaming-drive-v1/calibration.json), and [controller log](checks/acceptance-controller.log) retain the complete sequence.

Injection was predeclared at 40 ms in every measured frame, and all four injected medians were exactly 40 ms for each scenario. Baseline/injected p95 values were 33.2–39.8 / 73.1–77.0 ms parked, and 34.1–42.8 / 79.2–81.7 ms driving. The paired increase in wall time was also retained: parked measurement completion increased by 10.85 seconds, and driving route completion by 17.20 seconds. Accepted simulation windows remained 30 seconds parked and 60 seconds driving, after 20 accepted seconds of settling. Outer clamp loss and physics-discarded time were recorded separately. Exact frames, worst stalls and per-segment distributions are retained in every run, rather than combining run quantiles or silently discarding outliers.

The collector comparison measures incremental observation cost relative to a shared timing sentinel. Its negative estimate is within noise and is not evidence of zero observer cost. Frozen thresholds are finite-sample envelopes from four repeats, not confidence intervals or a guarantee of detecting every smaller change. Moving route segments have their own p95 guards, so an overall improvement cannot hide a protected segment regression.

## Real-game and ownership proof

| Proof | Evidence |
| --- | --- |
| Hardware, visibility, focus and native title gesture | [Normal GPU probe](proofs/normal/probe.json), [ownership](proofs/normal/ownership.json) |
| Actual control-worker SIGKILL | [Fault entry](proofs/worker-death/fault-entered.json), [independent cleanup](proofs/worker-death/ownership.json) |
| Confirmed blocked page JavaScript | [Binding entry marker](proofs/page-hang/fault-entered.json), [host deadline and cleanup](proofs/page-hang/ownership.json) |
| Ordinary and diagnostic Low/Mid/High boots | [Integration results](integration/results.json), with individual `smoke.json` or acknowledged capture/ownership records |
| Deliberate partial capture and restoration | [Partial payload](integration/interrupted/capture.json), [failed final run](integration/interrupted/run.json), [cleanup](integration/interrupted/ownership.json) |
| Final resource reconciliation | [Exact process identity and unrelated-resource checks](checks/resource-reconciliation.json) |

The revised route completed both normal and injected pilots, then all 24 acceptance drives. The first two driving overhead runs each crossed all four checkpoints, loaded 41 chunks, unloaded 31, and completed the route in 45.35 and 45.12 wall-clock seconds. Collisions, terrain support, physics, actors and streaming stayed active. No corrective teleport, invulnerability, obstacle removal or paused alternate renderer was used.

The supervisor owns Chrome and its worker independently, keeps a write-ahead process manifest, enforces deadlines, and verifies exact owned-PID absence. Signal errors remain recorded separately; only independent absence proves successful cleanup. Inspection uncertainty or a remaining owned process retains the lease and blocks a next launch. Inert-process tests also cover browser-root exit, failed teardown and worker lease failures; HTTP/runtime tests cover idempotency, conflicts, lost acknowledgements, overflow and input/settings restoration. The complete [project check log](checks/npm-check.log) and [production build log](checks/npm-build.log) passed for the measured source. A 400-frame legacy-equivalence test verifies unchanged ordinary child behavior and random draw order.

## Preserved failed attempts and revisions

| Attempt | Result and response |
| --- | --- |
| [First full trial](attempts/20261103-220238-09ef2b8a/result.json) | Stopped in holdout run 14 on foreground loss. Gary confirmed causing the interruption; the [separate context receipt](attempts/20261103-220238-09ef2b8a/interruption-context.json) records the reassignment. The partial capture and original failed result remain unchanged. |
| [Second full trial](attempts/20261103-221851-e5fcab83/dense-festival-v1/sensitivity.json) | Correctly invalidated because normal run 24 constructed 59 children outside frozen bounds from 47–53. The real constructor’s eight independent 5–8-child draws were unseeded. No bound was widened. The new content recipe passes a private construction RNG before boot and requires fresh calibration, while leaving global randomness and live behavior intact. |
| [Original cross-country route](attempts/20261103-214248-90524405/run.json) | Wrecked in a vendor area after roughly six accepted seconds. A separately versioned road-following policy replaced it before calibration, with a tighter corridor and normal corner braking. |
| [Extension interference](attempts/20261103-212851-e4adab94/worker-result.json) | A completed capture was rejected for a `passwordalert` exception. Disposable lab profiles now disable extensions; user profiles were unchanged. |
| [Earlier termination error](attempts/20261103-213130-cfa22d14/ownership.json) | Capture stayed rejected and the lease was retained. [Independent exact-PID reconciliation](attempts/20261103-213130-cfa22d14/cleanup-recovery.json) established absence before releasing that stale lease. |

All raw run/capture pairs and ownership records from the full trials are included, without browser-profile data. <a id="additional-offline-preparation"></a>

[Historical offline preparation](offline-preparation.md) preserves the earlier code-only state and capability failures.

## Reproduce the analysis

From the repository root, with no browser required:

```sh
python3 verification/performance/2026-11-03-lab/regenerate.py
```

This loads the original acknowledged payloads, regenerates both calibrations, both holdouts and both injected comparisons, checks exact canonical equality, and verifies overhead against raw quantiles and its saved threshold. All six real `bin/compare-perf-runs` CLI replays also matched exactly, including expected exit codes, as recorded in [the replay receipt](checks/cli-regeneration.json). [Evidence hashes](evidence-sha256.json) cover the saved JSON/log artifacts. Future captures and baseline/candidate comparisons use [the operating guide](../../../docs/performance-lab.md) and [project skill](../../../.agents/skills/performance-lab/SKILL.md).

## Post-trial review fixes

The 48-run timing trial predates two subsequent guard fixes. Before applying them, [source reconciliation](checks/post-trial-source-reconciliation.json) proved that all 301 live inventoried files, including the executed host scripts, matched the measured snapshot. Independent reviewers confirmed the timing/controller/quality/statistics path was unchanged; the original results and manifests remain valid and unmodified.

The final runner now refuses live host CLI/tooling drift against a snapshot before and after launches, and input first pressed during diagnostic ownership cannot leak auto-repeat after release. New negative tests reproduce both defects, and the [fresh-source nine-check browser matrix](post-review/results.json) passed ordinary/diagnostic Low/Mid/High boots, partial capture and normal/injected routes. The [actual CLI refusal receipt](post-review/checks/stale-snapshot-refusal.json) proves that an old snapshot cannot launch under the changed host. The [current source manifest](post-review/source-manifest.json) is distinct from the measured manifest. These guard checks do not constitute a new calibrated timing comparison; future measurements require a current snapshot and matching fresh calibration.

## Limits

Acceptance covers this prepared desktop configuration and these scenarios. GPU durations were not requested in lightweight timing mode and remain unavailable; work time is elapsed main-loop wall time, including synchronous rendering waits. No cold-cache, mobile, Auto-quality, iOS audio-unlock or subjective driving-feel result is implied. Ordinary ready-title boots covered Low/Mid/High, while calibrated timing used High only. A future changed fixture, harness or content policy needs fresh acceptance rather than relabelling these runs.
