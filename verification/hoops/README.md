# Hoop choreography verification

The implementation preserves classic hooping and adds opt-in flow through the
existing Crowd/session/activity ownership path. Its [plan and checklist](../../openspec/changes/generative-hoop-dancers/README.md)
retain the design decisions and outstanding acceptance. The [workshop guide](../../DEBUGGING.md#flow-hoop-choreography-workshop)
explains controls and repeatable captures.

The [grounded choreography refinement](grounded-choreography.md) supersedes the version-2
footwork and fixed-body isolation evidence below, and also articulates regular
waist hoopers. Earlier captures remain historical.

## Automated contracts

- `node bin/test-hoop-score`: independent shader-equivalent hand/contact math,
  numerical continuity, deterministic descriptors, bounded scores and replay validation.
- `node bin/test-hoop-flow-session`: cache-before-publication, explicit scratch
  resets, accepted clocks, reentry clearance, stale authority, bounded replay,
  resource failure and the eight-person/sixteen-prop cap using production protocols.
- `node bin/test-hoop-pair`: non-stealing paired authority, reentrant rollback,
  world-space hand/rim agreement and release/catch continuity using real Three math.
- `node bin/test-hoop-workshop`: real Crowd matrices, runtime and activities,
  scale/heading fixtures, baseline equivalence, isolated controls and owner cleanup.

These Node tests do not establish GPU shader output or device performance.

## Browser and cost evidence

Desktop verification was performed on Gary's Mac on 2026-10-29, using seed
1977 and score version 2. `npm run check` includes 91,194 independent score
samples, 9,558 real Crowd presentation poses, 14 flow-session groups and eight
pair-session groups. `npm run build` succeeds with Vite's existing large-chunk
warning. These checks cover contact, continuity, facing, shoe support, shared
scratch reset, interruption, bounded replay and disposal.

### Captures and artistic observations

| Capture | Observation |
| --- | --- |
| [Playful at Noon](dance-noon.png), [diagnostics](dance-noon.json) | At 2.2 seconds, the dancer travels with alternating leg stride while the classic comparison remains recognizable. |
| [Playful at Midnight](dance-midnight.png), [diagnostics](dance-midnight.json) | At 17.6 seconds, the overhead phrase changes heading and silhouette; the held isolation provides a quieter contrast to the orbit phrases. |
| [Facing correction](facing-noon.png) | Earlier score-version-1 capture establishes the corrected reach toward the actual face and shoe direction; the dance captures above supersede its body motion. |

Partner flight and aerial twins were inspected live, including honk cancellation
and dispose/recreate, but their requested downloads did not produce new files.
No partner/twin capture is retained as evidence.

The lyrical/playful/aerial fixtures are reproducible in the workshop. Motion
returns to its motif, with alternating orbit, answer and settling phases;
profile variation changes timing and phrase development. Visual inspection
establishes readability on this desktop setup, not a general naturalness score.
The [research assessment](../../openspec/changes/generative-hoop-dancers/research-assessment.md)
identifies remaining foot planting and moving-isolation limitations.

### Matched CPU fixtures

The [retained version-2 summary](cpu-benchmark.json) records these historical
measurements; its original raw trials were overwritten during refinement and
are not retained. The benchmark command now produces the current
report linked above. Each historical case
uses the same two people, appearance, seed and placement, five rotated-order
trials, 250 warmup steps and 600 timed steps. Medians on an Apple M4 Pro with
Node 24.10.0 were:

| Fixture | Construction | CPU per tick | Model draws | Model triangles |
| --- | ---: | ---: | ---: | ---: |
| Two classics | 5.565 ms | 0.01572 ms | 11 | 2,878 |
| One classic + one single-hoop flow | 6.509 ms | 0.01453 ms | 11 | 2,878 |
| One classic + one twin-hoop flow | 6.035 ms | 0.01869 ms | 12 | 3,166 |

These small CPU batches are noisy and do not establish a speed improvement for
single-hoop flow. The original protocol separated compilation/sampling from construction
and recorded retained heap after explicit garbage collection. Retained heap is
not an allocation rate. Draw/triangle counts describe the isolated model only;
there was no GPU context in this benchmark.

### Production game integration

The real muted game was started through its ready mode plank on Low, Mid and
High, with no reported console errors during the observed runs. The debug Stats
line confirmed `MeshLambertMaterial` on Low and `MeshStandardMaterial` on Mid and
High, together with a live classic/flow mix. A localhost-only `hoopFlow=0` run
confirmed eight classic performers and zero flow performers.

On Low, debug teleport from approximately (-419, -100) to (1000, 1000), followed
by return, removed the former performers/props and recruited the new venue's
participants. Inspection after return showed eight participants, including four
flow performers, with four active hoops and four owned envelopes. A stage honk
also exercised production interruption without reported errors.

Cold full-world snapshots ranged from 1,606 draws on Low to over 4,000 on
Mid/High, already beyond the guide budgets. Different streaming/visibility times
prevent a causal GPU comparison with the classic-only run; these observations
are boot and lifecycle evidence, not performance acceptance.

## Limits

Physical iPhone/Safari audio and GPU performance remain device-only acceptance.
The entity sandbox bypasses Low's Lambert material replacement, so a sandbox Low
capture alone cannot establish the production Low material path. Clearance
reservations coordinate performers and conservatively cancel obstructed scores;
they do not physically exclude bystanders or make visual hoops solid objects.
