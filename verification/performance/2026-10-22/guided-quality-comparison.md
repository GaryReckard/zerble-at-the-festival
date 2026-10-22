# Low-tier Auto versus Sustained guided drive, iPhone Safari

Both runs completed on October 22, 2026, on the same iPhone Safari browser,
Apple GPU, landscape viewport 932×320, seed `3948869160`, and Low tier. The
ignored raw reports are `.claude/captures/device-mvjkqay4-v173bd.json` (Auto)
and `.claude/captures/device-mvjkyq2x-qhv48p.json` (Sustained). Both report zero
capture errors. The agent stopped each temporary LAN server after its completed
report and left the pre-existing loopback development server alone.

## Ground truth

| Observation | Auto | Sustained |
| --- | ---: | ---: |
| Active duration | 156 s | 156.9 s |
| Visibility events | 0 | 2, a 2.714 s phone lock during first parked phase |
| Felt lag taps | 0 | 2 during drive, at 110.5 s and 113.1 s |
| Drive distance | ~1,321 m | ~1,444 m |
| Moving seconds / 90 drive samples | 87 | 89 |
| Drive median reported FPS | 57 | 58 |
| Drive median window wall p95 | 38 ms | 21 ms |
| Drive gaps over 33 ms | 346 / 5,085 frames | 28 / 4,987 frames |
| Drive gaps over 50 ms | 2 | 3 |
| Drive gaps over 100 ms | 0 | 1 |
| Largest drive frame gap | 69 ms | 1,053 ms |

The run routes and final positions diverged, the Sustained run was second, and
its early parked phase was interrupted by a phone lock. These are measured
comparisons, not a clean proof that the policy caused the p95 difference.
Gary could not tell a consistent visual or smoothness difference, but did feel
and tag a lag in Sustained. Phone warmth was not reported.

Auto reached Low's `pixel-50` rung by about 9 s and stayed there through the
comparison at approximately 0.625 DPR. Sustained started at baseline 1.25 DPR,
recovered to baseline during the drive around 74 s, and spent the drive
at baseline, `pixel-87`, or `no-bloom` (approximately 1.25/1.09 DPR).
It later fell to
`pixel-50` during the final parked phase. Neither trace supports treating
resolution as a universal fix: Auto stayed heavily reduced with persistent
p95 pressure, while Sustained kept more pixels for much of the drive without a
lower median reported FPS. The isolated one-second lag in Sustained remains a
serious counterexample to any blanket smoothness claim.

## The tagged stall

Near `(463, 43)` at approximately 112.7 s in Sustained, a frame spent
**1,047 ms in synchronous work, 1,045 ms of that in the render call**; the next
frame had a **1,053 ms wall gap**. The first felt-lag tap was 0.5 s away.
World-update time was zero in that event; loaded chunks increased from 51 to
54, and shader-program count rose from 53 to 61 in the same sampled second.
Before that, the adjacent samples at 109.9–110.9 s showed 53 programs and
5–6 ms worst render work. The second felt-lag tap at 113.1 s had no separate
>50 ms frame within three seconds.

The program jump alongside a render-call stall makes shader compilation or
another GPU synchronization during new-chunk rendering a concrete hypothesis.
The capture does **not** time compilation separately or identify which eight
programs were created, so it does not prove that mechanism. A full device
profile or capture-only program-name logging around a repeat would narrow it.
The on-device lock was approximately 80 seconds earlier, during the first
parked phase, and cannot directly explain this later render-work spike.

## Decision

Keep the shipping Auto policy until the render stall and the differing frame-gap
patterns are understood. The `sustained` policy remains a capture-only
experiment. A comparable reverse-order pair without a phone lock would reduce
order and interruption confounds, with Gary's notes on sharpness, stutters and
warmth recorded for both runs. Prioritize the one-second render stall over
further pixel-ratio tuning, because it was felt by Gary and resolution did not
prevent slow frames in the earlier parked comparison. The capture provides a
specific gate for the deferred shader-program prewarm item in ROADMAP, but a
change should target the programs or render path observed at this location.

Commands used: `bin/report-perf-playtest <report>` for each capture, plus
field extraction from the two raw JSON files. The reports are ignored local
files and are not committed.
