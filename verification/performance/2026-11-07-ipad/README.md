# Physical-iPad guided capture, November 7

**TL/DR:** This completed capture confirms limited steady performance even at
Auto's lowest quality setting, plus large main-thread world-update stalls while
driving. The next useful diagnostic is to split the world-update timer into its
actual subsystems, then fix the measured expensive unit. This report does not
identify that inner unit or establish an optimization gain.

## Provenance and validity

The [raw report](capture.json) is the acknowledged `complete` upload
`device-mw7bahrf-4ij7ob.json`, SHA-256
`848acca821ac6909f85a47eb99da8adce8c790639f9e9d9a01c697fc1cfaac96`.
It contains 154 samples over 156.1 active seconds, zero captured errors and zero
visibility interruptions. The user drove approximately 1,558 metres between
sampled positions and was moving in 85 of 89 driving samples. The report records
66 ordinary chunks generated during capture; the counter is explicitly a delta
from capture start (`src/debug.js:2431`). This was a genuine driving capture,
with stationary parked phases, rather than a stationary route or hidden-tab run.

Safari automation receipts independently identified a real iPad running
iPadOS 18.7.8 and Safari 18.7.5. Its normal Safari report uses a desktop-style
`MacIntel` user agent, but has five touch points and a 1080 × 740 viewport; do
not misclassify it as a Mac. The exact iPad hardware model, battery/thermal
conditions and charging state have not been supplied. This capture started
muted, so it does not establish audio cost or iOS audio-unlock behavior.

The [source/build manifest](source-build.json) binds the served local production
bundle to app `00d10db620720b429a5ab93e6973495324b8d2e0c33e7b98ea6d22dedf64b708`
and build `3d48df21697278a1149f3fca84d5de85c2f8635514b5b3f2820e37921ebba114`.
It includes the existing uncommitted November 6 terrain work and is not a claim
about the currently published deployment. The only temporary HTTP control-test
asset was removed before the run, and the served build digest was rechecked.

## Observed performance

The [standard reporter output](report.txt) and [numeric extraction](summary.json)
retain the exact results. FPS below is the median of sampled rolling FPS values,
not a pooled whole-phase frame-rate statistic. Worst gaps come from the retained
per-window maxima.

| Phase | Median sampled FPS | Worst recorded frame gap |
| --- | ---: | ---: |
| Initial settling | 22 | 1,494 ms |
| Parked before driving | 34 | 70 ms |
| Driving | 29 | 495 ms |
| Parked after driving | 40 | 124 ms |

The driving windows contain 2,563 recorded frames, including 212 gaps over 50 ms
and 23 over 100 ms. The typical driving-window p95 was 56 ms; that is the median
of window p95 values, not the overall run's p95. Detailed event storage is
bounded: 240 events remain and 179 older events were dropped, so early worst
frame detail cannot be reconstructed from the retained event list.

### Auto was correctly on Low and exhausted its quality ladder

The device detected and selected Low. Every driving sample used the lowest
`pixel-50` rung, with bloom off, cheap bubbles and sun shadows off. The scene
target was 675 × 462.5, with the integer canvas at 675 × 462. The half-pixel
height difference is ordinary rounding, not the earlier oversized-target bug.
The driver phase therefore did not vary quality or rendering dimensions.

Earlier parked/settling phases did change quality while Auto adapted, and the
first versus last parked scenes also differ. Their FPS numbers are observations,
not equal-content before/after comparisons or proof that a particular downgrade
caused an improvement. The existing Low tier/governor definitions are in
`src/perf.js:98-112` and `src/adaptiveQuality.js:70-91`.

### The broad world-update section explains several large retained stalls

One exact retained driving frame took 375 ms of main-loop work, including
357 ms in the world-update timer and 5 ms in the render timer, at virtual
position approximately (616, 312). Another took 360 ms total, including
338 ms world update and 8 ms rendering. A subsequent frame gap can reflect
the prior frame's work, which is why the raw event retains `previousWorkMs`.
The phase windows additionally record maxima of 472 ms total work and 451 ms
world update, but those window maxima should not be summed or treated as
necessarily one exact matched event (`capture.json:frameEvents,samples[*].frame`).

The timer surrounds `updateWorld(...)` (`src/main.js:1781-1785`). That function
includes landscape streaming, lakes, ordinary chunks, physical preparation,
time-of-day/vendor updates, far-field work and moving ground maintenance
(`src/world.js:118-150,182-228`). This is direct evidence of CPU elapsed time
inside that broad section, not a diagnosis of one builder or a GPU-completion
measurement. Other frames did have render spikes up to 199 ms during driving,
so rendering cost is not declared irrelevant.

The ordinary chunk generator's recorded session maximum is only 31 ms, while
its largest recorded prop stage is 20 ms (`capture.json:samples[*].cgWorst,chunkStages`).
Those counters do not explain the hundreds of milliseconds in the outer world
timer. Do not select an ordinary-chunk rewrite merely from the outer timer's
name; uninstrumented subwork, elapsed scheduling/collection and other world
subsystems remain to be separated.

## Recommended next experiment

Add capture-only timings for the individual `updateWorld` sections, associate
them with the existing exact slow-frame events, and repeat one comparable iPad
drive on the same known build/policy. Distinguish landscape/district admission,
lake work, ordinary chunk generation, physical preparation, far-field work,
ground resampling/normals/bounds and time-of-day/vendor work. Keep the timer
overhead explicit and avoid treating nested timings as additive savings.

Then reduce or split the actual measured hot unit while preserving completed
world/collider publication and deterministic ownership. This new device evidence
justifies reopening **world-update tail diagnosis** after the earlier desktop
investigation stopped without a selected rewrite; it does not retroactively
turn an untested structural hypothesis into an accepted optimization.

Address steady scene/CPU/GPU cost separately after that attribution. Auto has
already shed its current cheap effects and resolution options, so further
resolution-only tuning cannot be presumed to solve the demonstrated world stalls.
No production source was edited by this analysis.

## Remaining limits

This is one human-driven symptom capture with camera/scene changes, not a
calibrated equal-content A/B experiment. The exact model, power and temperature
conditions remain unknown. The only FELT LAG marker was during settling; older
detailed events were later evicted, so lack of a nearby retained event does not
show that the reported lag was absent. This run establishes the reported
conditions and captured costs, not their universal frequency or a device-wide
performance verdict. The saved baseline should be retained before any new build
or capture is compared against it.
