# Retain unchanged registry spatial cells

## Delivered behavior

`Registry.rebuildSpatialIndex()` still scans live entries once per frame, but
only changes the spatial grids when a position crosses an 8m cell boundary or
footprint/collider membership changes. Stationary trees, shore colliders and
props keep their existing cells. Live radius maxima and the ordered list of
oversized footprints still refresh each frame. Same-pass worldgen queries
continue seeing adds and removals immediately.

The registry uses ordered cell buckets to preserve the collision and avoidance
candidate order produced by a full rebuild. A mover re-entering a cell returns
to its registry insertion position rather than being appended after newer
entries. Other SpatialGrid users keep their default insertion and swap-removal
behavior. Empty buckets are dropped on removal, so walking movers do not retain
cells from old locations.

Removal now uses the recorded indexed position. Previously, moving an entry
across a cell boundary and removing it before the next rebuild could leave it
inside the old bucket until a subsequent rebuild. The regression explicitly
checks this move-then-remove case.

Implementation: [registry](../../../../src/registry.js),
[grid](../../../../src/spatialGrid.js), and
[regression test](../../../../bin/test-registry-maintenance).

## Measured CPU cost

The paired benchmark loads the actual Registry and SpatialGrid source from
commit `674ed90`, then compares it with the working implementation. Each trial
starts a separate registry with 4,500 static entries and 12 moving entries,
warms 100 updates, and times 2,000 updates. Five trials alternate which
implementation goes first. No browser, rendering or world-generation timing is
included; these are synthetic Node CPU operation measurements, not phone FPS.

| Operation | Previous source, median | Incremental source, median |
| --- | ---: | ---: |
| 2,000 spatial updates | 472.86 ms | 127.06 ms |
| Per-update equivalent | 0.236 ms | 0.064 ms |
| 10,000 add/remove pairs | 2.31 ms | 4.05 ms |
| 1,000 unload/reload batches, 24 entries each | 6.89 ms | 10.32 ms |

The measured maintenance reduction was about 73%. The additional snapshot
bookkeeping makes add/remove operations slightly more expensive in this
fixture: about 0.17 microseconds per pair and 3.44 microseconds per 24-entry
unload/reload batch. Each resident entry also retains one small snapshot
record; memory in bytes was not measured. Those records disappear on removal,
which both unit and live-streaming checks verify. Do not translate these CPU
deltas into an assumed FPS gain or claim they fix the one-second bloom stall.

[Raw paired timings](paired-bench.json), [repeatable benchmark](bench.mjs),
and [independent synthetic test timings](bench.txt).

Repeat with:

```sh
node verification/performance/2026-10-22/index-maintenance/bench.mjs 674ed90
node bin/test-registry-maintenance --bench
```

## Verification

`npm run check` passed. [Full output](check.log). This includes the existing
6,000 randomized grid trials and 36,000 placement queries, 11,182 registry
lifecycle states, forest determinism, gameplay and capture regressions.

The new test compares exact candidate membership **and order** with a full
rebuild through 1,500 randomized movement, resize, footprint-class, collider
presence, removal, chunk unload and re-add states. It also verifies zero grid
writes on unchanged/within-cell movement, bounded cell retention after 600
moves, and immediate removal of entries moved since their last indexing.

The real Low and High games started through the mode button, streamed across
`(300,-641)`, `(463,43)`, `(800,800)`, `(-800,-800)` and back to spawn, then checked
40 collision/footprint queries per tier against full-rebuild membership/order.
All checks passed. Snapshot counts equaled resident entry counts at every
location, including after unloads. These checks validate lifecycle behavior;
they are not driving FPS captures or a byte-for-byte full-world comparison.

[Low results](game-low.json), [High results](game-high.json),
[High game view](high-game.png). The bounded harness is `game.html?perf=low&mute=1`
in this directory and uses the official `__dbg` control surface. Close its tab
after testing to stop the embedded game.

One source-less `MutationObserver.observe` console error was recorded during
initial in-app inspection at 15:42:09Z. A source search found no MutationObserver
calls in `src` or the four game HTML files. No new matching entry appeared
during the subsequent High test, and a fresh normal-game Low smoke test
recorded [no console errors](low-smoke-errors.json). Its origin was not established, so the report
does not present the console as entirely clean. The registry tests themselves
completed successfully; the source-less entry is retained as a verification
limitation rather than attributed to the game or the browser without evidence.

No standalone browser or development server was started. The temporary browser
tab was closed, and the pre-existing localhost server was retained.

## Remaining acceptance

Real-phone frame delivery and heat have not been remeasured for this change.
The separately committed bloom/Trip preparation fix still needs its first-dusk
and first-Trip phone comparison. This registry change reduces repeated CPU
maintenance while preserving the current quality policy.
