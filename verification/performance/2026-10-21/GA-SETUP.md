# GA quality reporting setup

## Completed October 21, 2026

Implementation commit: `2cc103b`.
Using Gary's authenticated Chrome session, registered and verified the following
custom definitions in **Zerble at the Festival**, property **538915666**, account
**3808563**. Existing `Performance tier` (`perf_tier`) was retained.

[Open custom definitions](https://analytics.google.com/analytics/web/#/a3808563p538915666/admin/customdefinitions/hub)

## Event-scoped dimensions

| Display name | Event parameter |
| --- | --- |
| Quality trigger | trigger |
| Quality from level | from_level |
| Quality to level | to_level |
| Quality governor policy | governor_policy |
| Quality outcome | outcome |
| Quality worst level | quality_worst_level |

The verification screenshot is retained locally under `.claude/captures/ga-quality-dimensions-2026-10-21.png` (ignored by Git).

## Event-scoped metrics

All four use **Milliseconds**.

| Display name | Event parameter |
| --- | --- |
| Quality before average ms | before_avg_ms |
| Quality after average ms | after_avg_ms |
| Quality before p95 ms | before_p95_ms |
| Quality after p95 ms | after_p95_ms |

The verification screenshot is retained locally under `.claude/captures/ga-quality-metrics-2026-10-21.png` (ignored by Git).

## Interpretation

For before/after comparisons, filter to `quality_outcome` and
`Quality outcome = observed`, then segment by performance tier, device/browser,
policy and destination rung. Divide metric sums by the count of matching
observations to obtain means; summed frame times are not FPS. Averaging window
p95 values does not yield a pooled p95. These are associations, since scene
content can change between samples. Inspect interrupted and superseded outcomes
separately rather than calling them improvements.

The random `quality_run_id` and `transition_id` are deliberately not registered
as dimensions. For raw exports, join outcomes by both identifiers, and select
the final cumulative session snapshot per quality_run_id before calculating
degraded-time share. Do not sum repeated visibility-driven snapshots. No new
cumulative session-summary metrics were registered because their default sums
would overcount. No BigQuery export was configured as part of this work.

Google documents a 24–48 hour availability window after custom data is sent and
its definition is created: [dimensions](https://support.google.com/analytics/answer/14239696?hl=en)
and [metrics](https://support.google.com/analytics/answer/14239619?hl=en).
Definitions are configured, and Gary reported pushing the code commit on October 22,
but live deployment and ingestion have **not yet been verified**. No synthetic performance
events were sent to the production property.

## Next device check

Run these sequentially on the same iPhone, route, orientation and power mode,
allowing comparable device temperature. Stop each launcher and close its game
tab before starting the next. Record clarity, stutters and warmth, and repeat in
reverse order if possible.

```sh
bin/playtest-perf drive --tier low --quality auto --seed 3948869160
bin/playtest-perf drive --tier low --quality sustained --seed 3948869160
```

These are local phone captures, not a production policy change. The launcher
opens a QR and prints a tokenized LAN URL; keep that URL private. Both guided captures completed on October 22. See the
[comparison](../2026-10-22/guided-quality-comparison.md). The temporary LAN
servers were stopped after each run.
