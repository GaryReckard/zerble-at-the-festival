# Performance playtests

[Documentation index](README.md) · [Debugging reference](../DEBUGGING.md)

Run commands from the repository root. Start with the [capture workflow](#capture-workflow) for a device investigation; the first sections describe focused probes and comparison policies.

## Registry maintenance and streaming

`node bin/test-registry-maintenance` compares spatial candidate membership and
order against a full rebuild through movement, resizing and unloads. Add
`--bench` for a synthetic workload, or run
`node verification/performance/2026-10-22/index-maintenance/bench.mjs 674ed90`
for an interleaved comparison against the actual prior registry source. The
[verification report](../verification/performance/2026-10-22/index-maintenance/README.md)
records the CPU measurements separately from game frame delivery.
`verification/performance/2026-10-22/index-maintenance/game.html?perf=low&mute=1`
embeds the real game and checks collision and footprint queries after streaming
across five locations and returning to spawn; repeat on High. Close its tab
when finished to stop the embedded frame loop.

## Post-process first activation

The [render-stall report](../verification/performance/2026-10-22/render-stall/README.md)
traces the tagged one-second iPhone stall to the same sample as bloom's first
activation and eight new shader programs. Open
`verification/performance/2026-10-22/render-stall/check.html?perf=low&mute=1`
on the no-cache server to compare cold and prepared bloom. Add `trip=1` to
include Trip. Each bounded probe disposes its renderer and targets after use.
`game.html?perf=low&mute=1` in that folder embeds the real game and uses `__dbg`
to check day, dusk and Trip; repeat on Mid and High. Shader error checks remain
on in the embedded game. Its effect-material variant counts must stay at one.
The guided device JSON records `session.postprocessPreparation`, including
ready/failed status, material count and boot preparation time, so a rerun can
verify the preparation actually preceded gameplay.

## Controlled governor comparison

Run `bin/playtest-perf drive --tier low --quality auto --seed 3948869160`, then
stop that launcher and close its tab before running the same command with
`--quality sustained`. This capture-only experiment retains sustained-average
and consecutive-hitch protection but ignores p95-only downgrade pressure. Both
policies retain the same Low tier and cheap bubbles; normal launches use Auto.
Compare comparable routes, orientation, temperature and power mode, then repeat
in reverse order. Record clarity, felt stutters and warmth alongside frame gaps.
`--quality baseline` remains available as the rung-zero control. No production
threshold change is justified by the parked comparison alone.

The report's `session.qualityPolicy` identifies the applied policy. GA's
`quality_downgrade` preserves `level`, `avg_fps`, `perf_tier` and elapsed time,
adding `trigger`, named `from_level`/`to_level`, frame statistics and settings.
`quality_recovery` reports raises. `quality_outcome` links by `transition_id`
plus `quality_run_id` and reports `observed`, `superseded` or `interrupted`.
An observed outcome uses the last 90 frames after at least five seconds at that
rung, not an average over those five seconds. Null after-values mean no full
fresh window exists. Treat changes as correlations because the scene can move.

`session_end` includes `quality_active_s`, `quality_degraded_s`,
`quality_downgrades`, `quality_recoveries`, `quality_worst_level` and
`governor_policy`. These are cumulative snapshots since game start, including
only foreground ticks while the governor is enabled. Do not sum repeated
page-hide summaries; compare the final snapshot per `quality_run_id`. That
random identifier resets at game start and does not identify the player. A session may start
already degraded by title-card rendering without any gameplay downgrade event.
For field analysis, use affected sessions and degraded-time share alongside
transition counts, segmented by device/browser and tier. Six quality dimensions and four timing metrics were registered in the GA
property on October 21; see [the configuration record](../verification/performance/2026-10-21/GA-SETUP.md).
Live ingestion still needs verification after deployment.

## Capture workflow

The [October 11 particle/query report](../verification/performance/2026-10-11/README.md)
includes local browser probes for smile-resource lifetime, bubble submission and
transparency bounds, and ordered registry indexes through streaming. It records
operation-level before/after measurements separately from device FPS captures.

The guided capture is the easiest way to investigate a hitch in either a desktop
browser or phone Safari. It runs the real game at a fixed world seed, records one-second engine
samples plus capture-only frame distributions and slow-frame events, and sends
JSON into the ignored `.claude/captures/` directory on this Mac. The game
records position, speed, quality level, pixel ratio, render time, world-update
time, chunk-generation stages, shader-program count, visibility interruptions,
physical canvas/scene-target/bloom dimensions, active bubble count,
the effective shadow policy and sun shadow state,
and any **FELT LAG** taps. That button creates an ordinary saved marker with a
`felt-lag` kind and no note modal, while `K` still drops a general pin and
opens a comment box for location or visual issues. Use **FELT LAG** during the
timed run so typing cannot disturb its frame measurements. A long frame gap can
reflect prior-frame work, so the event records both current and previous frame
work. Frame timing is sampled
only with `?perfCapture=1`; ordinary play does not pay for these timers.

1. Run the two captures separately from Terminal in this repo. For the desktop
   run, use `bin/playtest-perf --desktop`; it starts a loopback server and opens
   the Mac's default browser. Use `--browser Safari` or another app name if
   that is where the desktop issue occurs. If port 8765 is busy, the guided
   launcher uses the next available port and prints the actual URL; it leaves
   the existing server alone. For the phone run, put the Mac and phone on the
   same Wi-Fi and use `bin/playtest-perf`; it opens a QR code and prints a
   fallback URL. Do not post the phone's tokenized URL publicly because it
   authorizes local uploads.
2. On each device, tap the **Just Cruisin'** plank to choose that mode and start.
   A mode plank also resumes a saved session when its mode matches. On the phone,
   first scan the QR and open the link in Safari. Leave the game tab in the
   foreground and follow the small `PERF` instruction box. The guided test
   pauses driving controls and stops the cart during every parked phase. Drive
   around normally for the 90-second drive phase, crossing into new parts of
   the festival; the final 20-second recovery phase parks the cart for you.
   Tap **FELT LAG** whenever a hitch is noticeable.
3. Wait for **PERF · SAVED ✓**, which takes about 2 minutes 35 seconds of active
   play. If it says **SEND FAILED**, tap **SEND** while the Mac server is still
   running. Press Control-C in Terminal after each run has saved, then launch
   the next run. Tell the agent which desktop browser, phone model and iOS
   version you used, what you felt in each place, and that both playtests saved.
   The agent reads both JSON reports locally; there is nothing to copy or export.

By default, the drive run leaves adaptive quality active so its changes remain part of the
real-world symptom. For a parked Wook Trip comparison, add `trip` before the
options, for example `bin/playtest-perf trip --desktop` or
`bin/playtest-perf trip`. The scenario parks the cart, holds the current render
quality steady, starts the Trip, and holds its peak automatically. It takes at
least 1 minute 57 seconds; a slow fade-in extends
the capture until the Trip actually reaches its sustaining state. Keep the
Trip tab in the foreground throughout: backgrounding invalidates that
comparison because the game and capture clocks can diverge. The drive scenario
pauses its phase clock while hidden, and a free-form capture continues when the
tab returns. Run `bin/report-perf-playtest` to summarize
the newest completed capture, or pass an exact JSON path. The report flags a
stationary “drive,” movement during a parked phase, and quality or physical
render-size changes across comparison phases that would contaminate a
comparison. It also flags a scene target whose
physical dimensions differ from the canvas after an adaptive-quality change.
For an apples-to-apples low-tier rerun,
pass `--tier low`; `--seed` can select another reproducible world.

The completed iPhone parked governor comparison used these commands separately.
The server was stopped with Control-C after each report said **SAVED**:

```sh
bin/playtest-perf parked --tier low --quality auto --seed 3948869160
```

```sh
bin/playtest-perf parked --tier low --quality baseline --seed 3948869160
```

Each lasts 60 seconds (20 settling, 40 parked) with controls paused. Baseline
locks Low's initial resolution before the first rendered frame, not after
settling; Auto can downgrade normally. Both use Low's cheap bubbles regardless
of a saved Detailed bubbles preference, without changing that preference.
Tier density, shadows, and chunk/bubble capacities are unchanged. Baseline is
rejected unless `--tier low` is explicit. The flag also works with drive and
Trip; only Trip locks the reached rung after settling, while drive and parked keep the selected governor active.
Keep Safari foregrounded, the same orientation, camera, settings, and similar
device temperature; let the phone cool between runs. Do not edit settings during
either run. Record clarity, stutters, heat, and Low Power Mode. Full instructions
and interpretation are in [the follow-up](../verification/performance/2026-10-09/capture-follow-up.md).

The parked pair is recorded in [the follow-up](../verification/performance/2026-10-09/capture-follow-up.md#completed-parked-pair). The [October 22 drive pair](../verification/performance/2026-10-22/guided-quality-comparison.md) followed that parked test. A further comparison should use a comparable route in reverse order, retaining Baseline as a control. Saved `session.qualityPolicy` and `qualityLockedFromFirstFrame` distinguish the runs, while `session.tierPolicy` records their fixed scene policy. Compare the
live `frame.*` windows: governor `fAvg/fP95/fMax` stop updating when disabled.

The server's LAN mode serves only game assets, and upload writes require the
generated URL token. The data remains on the Mac under `.claude/captures/`.

The desktop Chrome and iPhone Safari drive and Trip captures were collected on
2026-10-09. Their findings, validity caveats, and next controlled experiment
are in [the guided playtest report](../verification/performance/2026-10-09/guided-playtests.md),
with follow-up work tracked in [ROADMAP.md](../ROADMAP.md). Keep that performance
work separate from the far-field visual review.
