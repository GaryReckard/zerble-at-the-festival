# Far-field publication stall, November 11

**TL/DR:** The 424 ms far-field interval from the [November 8 iPad route](../2026-11-08-ipad-child-density/README.md)
was one unbudgeted call that rebuilt the whole horizon each time the player
crossed an 80 m cell. Most of that work was discarded or repeated. The horizon
now publishes exactly the same instances and road buffers, prepared in bounded
pieces under the existing streaming budget. In an offline Node probe the worst
single call while driving fell from 61–176 ms to 3–33 ms, and revisited ground
from 33–98 ms to 3–4 ms. No browser, GPU or iPad result is established here;
the fixed-route iPad run is the acceptance check and remains pending.

## What was measured before the change

`attribution-probe.mjs` drives the real Low far-field with terrain along a
straight line in eight 80 m steps from the November 8 route anchor (seed
2404796662) and samples the CPU profile of the publication call.
[Raw output](before-attribution.txt) from commit `b222c7a`:

| Share of sampled publication time (935 ms over eight steps) | Cause |
|---|---|
| 450 ms inside `_writeRoads` | Every road polyline was subdivided, trimmed against paved footprints and split along the terrain lattice again on every crossing, and the paved-capacity retry usually ran the whole pass twice. |
| 407 ms inside `expandFarInstances` | Terrain height was sampled for every candidate before the pool caps kept the nearest. At the second anchor Low had about 2,400 candidates and kept 1,015. The discarded ones are the farthest, so they land on terrain tiles nobody has needed yet. |
| 389 ms inside `tileDescriptors` (overlaps both rows above) | A cold 200 m terrain tile plans every festival hub and woodland camp within roughly 700 m. Tiles more than 800 m from the anchor were planned for a 520 m horizon. |

The planner's own budgeted steps cost about 0.3 ms each, which is why the
existing `ffCold` counter never exceeded 3 ms on the iPad: it never covered
publication.

## What changed

1. **Heights are resolved after selection.** `planFarInstances` places
   candidates by x/z only and records where each stands (`gx`, `gz`) plus its
   vertical offsets. `groundFarInstance` samples terrain for the instances that
   survive the caps. Selection reads x/z only, so the kept set is unchanged, and
   the offsets are summed in the original order so each height is bit-identical.
2. **Road geometry is reused.** `buildFarRoad` produces one polyline's finished
   underlay independent of its position in the shared buffer. The owner keeps a
   bounded memo (768 polylines) keyed by content, width and surface. Dirt
   variants are keyed by the ordered list of paved roads whose footprints can
   reach them, because that is what determines the cut. The memo is discarded
   when the terrain generation changes.
3. **Publication is prepared across frames.** A committed snapshot becomes a job:
   grounding and road preparation advance under the remainder of the streaming
   budget, and the pools and road buffers are written together only when
   everything is ready. The previous horizon stays on screen meanwhile. Crossing
   into another cell drops the job; its road and terrain work stays cached.
4. **Cold terrain tiles warm in pieces.** `prepareTerrainHeight` and
   `prepareTerrainArea` fill the same per-hub and per-camp caches
   `tileDescriptors` reads, one plan at a time, so a tile no longer lands as a
   single call. Other terrain consumers are untouched.

Calls without a budget (tests, sandboxes, `_applySnapshot`) still finish in one
call.

## Equivalence

`fingerprint.mjs` hashes every published instance field as raw float bits,
pool counts, fade buffers, road position/color/index prefixes, bounds and
statistics at ten poses (seven adjacent steps, a 3 km teleport, a neighbouring
cell there, and a return), for two seeds, three tiers and terrain on and off:
120 published horizons.

- [baseline-fingerprints.json](baseline-fingerprints.json) was recorded from the unchanged source, twice, with identical output.
- The new source reproduces it exactly with one generous call per snapshot (`node fingerprint.mjs`).
- It reproduces it exactly again with a 0.5 ms budget, which spreads each publication over many calls (`node fingerprint.mjs --sliced`).

## Timing

`timing.mjs` calls `update` with a 3 ms budget until each snapshot publishes
and records the worst single call and the summed time. Median of three cold
processes each, M4 Pro, Node 24.10. [Before](before-timing.jsonl) ·
[after](after-timing.jsonl).

| Step | Worst call before | Worst call after | Total before | Total after |
|---|---|---|---|---|
| First snapshot | 1616.2 ms | 126.1 ms | 2223.3 ms | 2094.9 ms |
| 0 | 68.4 | 4.3 | 84.0 | 29.6 |
| 1 | 175.9 | 32.5 | 191.4 | 139.3 |
| 2 | 95.4 | 31.2 | 110.8 | 101.1 |
| 3 | 67.6 | 7.0 | 79.9 | 53.1 |
| 4 | 61.2 | 4.5 | 76.6 | 24.3 |
| 5 | 151.0 | 29.1 | 166.5 | 93.0 |
| 6 | 171.4 | 28.0 | 187.3 | 157.5 |
| 7 | 103.6 | 6.2 | 118.9 | 46.2 |
| Back over step 6–3 ground | 32.7–98.0 | 3.2–3.7 | 47.4–113.4 | 19.0–20.0 |

[Unit sizes](after-unit-sizes.json) with a budget that admits one unit per call
show what remains indivisible: planning steps peak at 1.8 ms, road builds at
6.2 ms, and grounding has a p99 of 14 ms and a maximum of 30.9 ms. That tail
is a single cold festival or woodland camp plan. The first snapshot's 126 ms
call is the planner's first coarse cell (cold road queries), which predates
this change and happens once at boot.

## Limits

- Node on an M4 Pro measures CPU work only. The iPad's ratio to it is unknown; the 424 ms device interval against 61–176 ms here suggests roughly 3×, which is an inference, not a measurement.
- The probe installs no landscape clearance policy, so forest records differ from the running game's. Equivalence is proved for the configurations hashed, and the in-game path is covered by the browser smoke test recorded below.
- Total work on steps that reveal new terrain is only 5–45% lower, because the terrain planning that remains is real. It is spread out, not removed.
- Publication can now trail a cell crossing by several frames. A sustained zero streaming remainder would delay it further, exactly as it already delays planning.

## Follow-ups this surfaced

- **Instances beyond the fog limit.** At the second anchor more than half of the kept Low instances were farther than 520 m (`perf.js` calls that the fog-opaque limit), with canopies out to 1,508 m, because pools under their cap keep everything. A radius cull before planning would remove both their terrain cost and their draws. It changes the published set, so it needs Noon and Midnight screenshots. One seed and one pose; the share will vary.
- **Terrain lookup overhead.** `gate()` in `terrain.js` builds a template string on every vertex lookup and the vertex cache uses string keys. For 19,881 warm lookups (the ground mesh size) the total was 2.47 ms, of which the gate string alone was about 1.0 ms; integer keys halved the bare Map cost (0.93 to 0.50 ms). A modest constant factor for every terrain consumer.
- **One cold plan is still 15–30 ms here.** If the iPad run shows that tail, the next split is inside `festivalPlan` or the woodland `cellPlan`.

## Reproduce

```sh
cd verification/performance/2026-11-11-far-field-publication
node fingerprint.mjs | diff - baseline-fingerprints.json
node fingerprint.mjs --sliced | diff - baseline-fingerprints.json
node timing.mjs 3
node unit-sizes.mjs 0.01
```

`ZERBLE_ROOT=<path to another checkout>` points any probe at a different source
tree; the before files used an archive of `b222c7a`. `attribution-probe.mjs`
profiles `_applySnapshot` and therefore only attributes the one-call path.

## Verification status

See the [status file](status.md) for the full check, build and browser results.
