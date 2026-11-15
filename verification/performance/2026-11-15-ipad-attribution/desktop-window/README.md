# Reserved-Mac capture overhead and route checks, November 15

**TL/DR:** All four guided routes completed, and the incremental detailed-capture check passed its declared descriptive desktop criterion at +0.20 ms. The second detailed route passed the frozen publication-health checks, but the first contained a 72.9 ms far-field preparation interval, above the unchanged 50 ms target. This is measurement evidence, not a production optimization or physical-iPad acceptance.

## Identity, permission and method

Gary explicitly reserved this Mac for 20 minutes, beginning at 17:59:13 UTC. The [grant and predeclared plan](grant.json), [measured snapshot](measured-snapshot.json), and [safety/ordinary boot receipts](safety-and-smoke/) identify the scope. The four runs finished by approximately 18:12 UTC, within that window. The source/build was frozen before the landing-forgiveness change and later runner safeguards; the captured snapshot remains intact, while new runs must prepare a fresh snapshot.

A normal hardware probe and deliberate worker-death/page-hang probes passed their expected entry, failure and exact-PID cleanup checks. Ordinary Low/Mid/High ready-title boots also passed. Each guided capture used a fresh extension-disabled full Chrome profile, native ready-title gesture, 1280×720 viewport at device ratio 1, muted audio, Low baseline quality, seed 2404796662 and full-v1 children. The existing road-follow-v2 route used normal cart input without teleport corrections, invulnerability or obstacle removal. The new [guided runner](../../../../tooling/performance_lab/guided.py) reuses the accepted independent supervisor and exact process cleanup, while collecting the same guided schema used for the iPad session.

The order was basic, detailed, detailed, basic. Both arms used `perfCapture=1`; detailed alone added `perfWorld=1`. This measures incremental detailed instrumentation, including its horizon and section probes, rather than total cost of all capture machinery. No builds or heavy tests ran during these four captures. The existing Vite server was idle, the known in-app tab was the static gallery, and helper work was limited to drafting and source inspection. A quiet reservation does not prove OS-wide or thermal isolation.

## Results and limits

[Reproducible analysis](analyze.py), [derived results](results.json), and immutable raw reports retain the observations:

| Run | Detail | Median of one-second driving p95 summaries | Complete checkpoints | Raw report |
| --- | --- | ---: | ---: | --- |
| 1 | Off | 17.6 ms | 4 | [Baseline first](run-1-basic/device-report.json) |
| 2 | On | 17.9 ms | 4 | [Detailed training](run-2-detail/device-report.json) |
| 3 | On | 17.6 ms | 4 | [Detailed check](run-3-detail/device-report.json) |
| 4 | Off | 17.5 ms | 4 | [Baseline repeat](run-4-basic/device-report.json) |

The basic average is 17.55 ms and the detailed average 17.75 ms, so the incremental difference is +0.20 ms against the declared 2 ms bound. The two baseline summaries differ by 0.10 ms. Every report is valid, saved, complete and free of runtime errors or visibility interruptions. Each run retains a hardware GPU receipt and a successful exact-PID cleanup manifest alongside its raw report.

These are medians of window p95 summaries, not an exact whole-route frame p95 or a pooled statistical sample. Four serial runs do not constitute the performance lab's independent calibrated holdout experiment. Live adult populations at export were 155, 147, 150 and 150, while children and tier/quality policy were fixed, so identical semantic work is not established. The result satisfies this declared descriptive desktop check, but does not bound physical-iPad overhead or establish an optimization gain. Existing full lab sensitivity acceptance is separate.

## Frozen publication checks and retained miss

The [threshold file](publication-thresholds.json) was written and SHA-256 recorded before starting the second detailed route. Its hash is `2c01900f267fd0ce433d80a13b15e1922ba406f53ad1147dca78a23979ea471f`. Training-based sampled limits were at most 2 requested cells without publication, a supersession streak of 1, pending published age of 9 seconds and first-request latency of 3 seconds; the 50 ms maximum driving far-field interval target remained fixed.

The second detailed route had a 46.9 ms maximum far-field interval, 1 pending cell, no supersession streak, a 2.410-second sampled pending age and a 1.863-second first-request publication latency. It published ten times during driving, and final requested/published cells agreed. All frozen checks passed on that run.

The first detailed run nevertheless recorded 72.9 ms in far-field at approximately (-365, -629), within a 90.6 ms callback. The capture-lifetime maximum preparation call was also 72.9 ms. This preserves a concrete remaining long-call lead; it does not identify one indivisible terrain sample or GPU time. Both detailed runs therefore do **not** satisfy the 50 ms duration target. The first run also reached a 7.714-second sampled pending age, which explains the 9-second regression threshold; that threshold is not a claim that such delay feels acceptable.

Publication observations are sampled once per second, so shorter excursions can be missed. Stationary publication age alone is not considered stale. Do not replace the retained target miss with the passing second run, and do not call the far-field issue closed. These thresholds can structure the next physical-iPad session, whose reports must retain both duration failures and proof of ongoing publication.

## Replay

From the repository root:

```sh
python3 verification/performance/2026-11-15-ipad-attribution/desktop-window/analyze.py \
  verification/performance/2026-11-15-ipad-attribution/desktop-window/publication-thresholds.json \
  verification/performance/2026-11-15-ipad-attribution/desktop-window/run-1-basic \
  verification/performance/2026-11-15-ipad-attribution/desktop-window/run-2-detail \
  verification/performance/2026-11-15-ipad-attribution/desktop-window/run-3-detail \
  verification/performance/2026-11-15-ipad-attribution/desktop-window/run-4-basic
```

Only raw reports, metadata, GPU/gesture receipts, screenshots, census and ownership artifacts were promoted. Private token-bearing configs and Chrome profiles remain excluded. After collection, offline runner tests exposed and fixed non-object JSON rejection and retention of the lease when the supervisor unexpectedly raises without a cleanup receipt. The measured artifacts were not edited to incorporate those later fixes.

## Integration after collection

The separately requested landing forgiveness and runner safety fixes passed the final [full project check](post-landing-check.log), [production build](post-landing-build.log), native physics regressions and real-game Low smoke. The [landing report](../../../physics/2026-11-15-landing.md) records behavior and limits. These changes occurred after measurement and are not relabeled as the captured build.

The [post-landing prepared snapshot](post-landing-snapshot.json) identifies the current source and built bytes, while the measured snapshot remains separate. The checkout still includes uncommitted UI and gameplay work, so this does not satisfy the council's clean-commit device freeze.
