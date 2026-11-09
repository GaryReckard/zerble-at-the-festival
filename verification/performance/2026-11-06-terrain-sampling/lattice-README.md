# Exact-lattice ground height lookup

## Revision and proof

The production ground is 1,400 metres wide with 140 segments per side, and
its origin moves in 40-metre increments (`src/world.js:29–31`). Its 19,881
vertices therefore land on the terrain's 10-metre sampling lattice.
`resampleGroundSurface` calls `terrainHeight` for every vertex (`src/world.js:211`).
The [new height path](../../../src/worldgen/terrain.js) reads only that exact
vertex when interpolation weights are zero, while negative zero and every
off-lattice query retain the original interpolation arithmetic. It adds no
cache, density reduction, geometry change or altered physics cadence.

The [accepted pooled implementation](pooled-terrain.js) is frozen separately;
only its imports are relocated. Reversing those relocations matches the
terrain source hash in [its manifest](revised-candidate-manifest.json).
The stronger [original-source sampler oracle](legacy-terrain.js) and production
ground regression remain in the project checks.

The [full project check](checks/lattice-npm-check.log) and
[production build](checks/lattice-npm-build.log) passed for the
[new immutable source](lattice-manifest.json). The check includes 50,262 exact
sample records plus height-only comparisons and thirty complete production
ground snapshots with 120 real raycasts, including positions, normals, colors,
UVs, indices, bounds, dirty flags and cache retention. Initial focused logs
are retained separately; the first sampler invocation preceded the final
negative-zero fallback adjustment, so the full project check is the final-source
verification rather than that initial focused run.

## Real production-ground CPU experiment

[The declared experiment](lattice-plan.json) runs eight independent Node
processes in pooled/lattice/lattice/pooled/pooled/lattice/lattice/pooled order,
with no overlapping browser captures or full test jobs.
[The benchmark](lattice-ground-bench.mjs) invokes actual production
resampling, color, normal and bounds updates on real pinned Three geometry
through [the existing fixture](ground-fixture.mjs).

[All raw runs](lattice-ground-benchmark.json) are retained. Median total warm
work across the 21 route centers fell from 260.05 to 114.02 ms, approximately
56% lower. Median initial recenter cost was 1,208.43 / 1,202.88 ms, essentially
unchanged. All eight final geometry hashes match. These are Node CPU-operation
results, not GPU timings, delivered frames or iPad evidence.

## Runtime comparison

All [seven native qualification operations](lattice-qualification-results.json)
passed for this exact source: ordinary ready-title Low/Mid/High startup, real
driving Low/Mid/High, and High parked collection. Selected acknowledged raw
evidence is retained in [the qualification promotion](window-5/qualification-promotion.json).

Both [complete independent comparisons](lattice-suite.json) passed their fresh
calibrations and unchanged-baseline holdouts. Each condition used twenty runs
under the original `conservative-paired-v1` policy. All six analysis reports
regenerate exactly through the real CLI:
[parked](comparisons/lattice-parked/regeneration.json),
[driving](comparisons/lattice-driving/regeneration.json).

| High hardware-Chrome condition | Baseline / revised median run work | Baseline / revised median run p95 | Overall verdict |
| --- | --- | --- | --- |
| Parked festival | 14.30 / 13.05 ms | 18.10 / 18.25 ms | No detectable change |
| Streaming driving | 15.15 / 13.85 ms | 19.15 / 18.55 ms | No detectable change |

The primary frame-delivery verdict is **no detectable change**, with no detected
regression in any protected metric or segment. Median paired p95 changes were
+0.20 ms parked and -0.65 ms driving, both below the 2 ms detection bound.
Frame-work timers include synchronous rendering waits and are not CPU-cycle
measurements. Their lower values are headroom evidence, not an FPS gain.

Driving p99 is a secondary metric: its paired improvement was 5.85 ms, beyond
the frozen 3 ms threshold, with all four pairs improving by 5.8–6.0 ms.
Median run p99 was 27.70 / 21.80 ms for baseline/revised. That secondary result
does not override the unchanged primary verdict. Baseline paired driving runs
had 10/10/11/10 stalls over 50 ms; revised runs had 9/9/9/9. The stall-rate change
was below its frozen 0.1 events/second bound. Worst driving frames were 140.60 ms
and 130.50 ms respectively, so meaningful spikes remain. Parked paired runs had
no stalls over 50 ms in either source. Every outlier remains in the raw captures.

The revision retains the original terrain, geometry and quality. The support
cache adds bounded CPU records, and queries without locality can still be slower
than the original sampler as shown in [the churn experiment](revised-churn-benchmark.json).
It is deliberately bypassed for whole-ground resampling. These results establish
fixed High desktop behavior, not actual Auto driving, physical-iPad Safari,
subjective smoothness, GPU memory savings or a general allocation-free claim.

[Final cleanup](window-5/cleanup.json) reconciles all 87 native qualification and
comparison ownership manifests and 1,757 exact PID/birth identities from this
window, including both fully measured revisions. All test-owned processes are
absent, the owned keep-awake process is stopped, and the lab lease is absent.
The branch remains local, with no merge or deployment performed.
