# Disabled (flag-off) baselines — task 1.5

Captured 2026-08-27, BEFORE any far-field geometry exists (the pure planning
core is in `src/farField.js`, but nothing renders and `USE_FAR_FIELD` resolves
false by default). These are the fixed-pose numbers every later A/B capture and
the task-5.5 promotion decision compare against.

## Method

- `bin/verify-headless` (SwiftShader Chromium — this machine has no browser GL
  path; see DEBUGGING.md "When no browser here can do WebGL at all").
- Real page reloads per tier: `?perf=low|mid|high&seed=1234` (real tier +
  threeShim paths, per design D7 — not sandbox tier previews).
- Boot via `__dbg.start()`, settle until `cgN:reg` stable ≥4s while frames
  advance (90s cap), then `__dbg.tod(t)` (Noon t=0.25 / Midnight t=0.75) and
  `__dbg.camLock(z.x+28, 18, z.z+28, z.x, 2, z.z)` — the same canonical framing
  `__dbg`'s own capture helpers use.
- Counters from `__dbg.debug.perfSnapshot()` (scene draws/tris are the
  pre-post-process `__sceneInfo` snapshot), second sample after +1.5s to
  confirm stability. Zero console errors on every run.
- Fixed pose: Zerble at the seed-1234 spawn arch, (244, −179), identical
  across all six captures.

## Numbers

| Tier | ToD | Draws | Tris | Geo | Tex | Programs | Heap MB | Registry | Chunks |
|------|----------|-------|-----------|------|-----|----------|---------|----------|--------|
| low | Noon | 1,524 | 462,593 | 1,672 | 13 | 67 | 48 | 1,597 | 9 |
| low | Midnight | 1,783 | 494,101 | 2,127 | 24 | 76 | 43 | 1,597 | 9 |
| mid | Noon | 6,228 | 1,529,570 | 2,763 | 18 | 50 | 87 | 2,361 | 25 |
| mid | Midnight | 6,502 | 1,585,282 | 2,875 | 29 | 89 | 73 | 2,361 | 25 |
| high | Noon | 5,908 | 1,853,498 | 2,832 | 18 | 50 | 104 | 2,361 | 25 |
| high | Midnight | 6,362 | 1,920,674 | 3,072 | 29 | 90 | 69 | 2,361 | 25 |

Absolute HUD budgets for reference: low 80 draws / 150k tris · mid 200 / 400k ·
high 400 / 1.2M.

## Consequence: every tier's promotion gate re-keys (D6 / audit V9)

**All three flag-off baselines exceed their tier's absolute HUD budget** (low
~19-22× on draws, mid ~31×, high ~15×; tris 3-4× everywhere) — the exact
"unsatisfiable absolute gate" audit V9 predicted from perf.js's B0 note
(~3.7k median draws vs the 400 budget, consistent with these magnitudes).
Per task 1.5/5.5 and design D6, the promotion gate on **low, mid, AND high**
is therefore re-keyed to: **marginal delta (≤ +12 draws, ≤ +5k/+10k/+10k tris)
+ no-regression on the other counters + explicit Gary sign-off.** The absolute
budgets stay as the HUD's aspiration, but they are not this feature's test.
Recorded as session-log D11.

## Caveats

- SwiftShader is a software rasterizer: FPS/frame-time columns from these runs
  are meaningless and deliberately omitted; only content-driven counters
  (draws, tris, geo, tex, programs, registry) transfer to real hardware.
- All runs show `quality: "baseline"` — AdaptiveQuality fully degraded under
  SwiftShader (bloom off, cheap bubbles, pixelRatio 1). Both sides of any
  future A/B on this box degrade identically at a fixed pose, so *marginal*
  deltas remain valid; absolute counters on real GPUs (bloom on, fancy
  bubbles) will differ slightly.
- Midnight adds ~250-450 draws over Noon on every tier (night emissives,
  lampposts, string lights) — compare like-for-like ToD in A/Bs.
- mid and high share chunk radius 2 (25 chunks); high Noon measured ~320
  draws BELOW mid Noon. Cause unverified (both samples were stable across the
  +1.5s re-read, so it's not sampling noise) — do not treat mid/high as
  interchangeable in A/Bs; capture each tier against its own baseline.

Raw JSON: scratchpad captures were transcribed into this table; re-capture is
one `bin/verify-headless` invocation per cell (command in the session log's
2026-08-27 entry refs).
