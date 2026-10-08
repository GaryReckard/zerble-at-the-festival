# Far-field fidelity review follow-up

Date: 2026-10-08. Source: Astra's review pasted by Gary. This records its
findings and proposed acceptance criteria for a later implementation pass;
the findings have not been independently rechecked in this documentation turn.
No application code was changed here.

## What the review found

The far-field layer often depicts a different object at approximately the
right location rather than a simpler version of the approaching object:

| Object | Review finding | Source to inspect |
|---|---|---|
| Main stage | Wide brown gabled real roof becomes a smaller, randomly colored square slab. | `src/models/stage.js:24-124`; `src/farField.js:323-467` |
| Side stage | Open real stage becomes a roofed proxy. | `src/models/tentStage.js:14-95`; `src/farField.js:323-467` |
| Big marquee | Real 28 × 38 m open-sided tent with a long ridge becomes a square pyramid reaching the ground. | `src/models/tent.js:115-148`; `src/farField.js:323-467` |
| Vendor tents | Elevated white roofs and aligned booths become variably colored ground-reaching pyramids with different spacing; the proxy uses the tablecloth colors for roofs. | `src/farField.js:405-456`; `src/chunks.js:1625-1700` |
| Trees | Separate-grid forest masses do not track the actual pines, oaks, birches, clearings, or exclusions. | `src/chunks.js:1098-1177`; `src/models/tree.js:150-282` |

The review also found that chunk completion immediately shows full real
geometry while the incompatible proxy dissolves for 0.3 seconds
(`src/chunks.js:433-436`; `src/farField.js:946-979`). Proxy materials are unlit
and dimmed globally at night while real materials respond to lighting
(`src/farField.js:604-612,928-942`). Existing tests currently require some of
the mismatched shapes, including the side-stage roof and square marquee
(`bin/test-far-field:384-418`). The hub viewer's “Proxy only” mode does not
hide the real hub (`hub-sandbox.html:348-358`).

The source review's Noon comparison images were stored in a temporary
`/var/folders/.../opencode/` directory, so they are not a durable project
artifact. Recreate fixed-camera Noon and Midnight comparisons when work
resumes.

## Implementation order and acceptance

1. Share descriptive data for defining building silhouette, dimensions,
   colors, and local transforms between real and far renderers. Preserve the
   stage gable and back wall, marquee ridge and open sides, and vendor roof
   shape while omitting distant small details. Keep the batched rendering and
   per-tier ceilings.
2. Generate booth and campsite arrangements once and consume those placements
   at both detail levels. Audit RNG draw order and live-registry exclusions
   before replacing current generation; identical seeds alone do not ensure
   identical layouts (`src/chunks.js:1635-1700,1849-1861`).
3. Add an intermediate, inexpensive species-shaped tree representation at
   authoritative positions, using `describeForestTree` as a starting point;
   reserve coarse masses for the outermost distance (`src/models/tree.js:150-282`).
4. Once silhouettes and placements agree, use a controlled overlap band with
   complementary near/far dither, gated on real-content readiness. Compare
   cheap lit proxy materials with the current unlit treatment at Noon and
   Midnight before choosing a lighting policy.
5. Make the hub viewer's near/far modes genuinely exclusive and add a fixed
   camera toggle or wipe. Test silhouette dimensions, roof presence, colors,
   and transforms against shared descriptions instead of hard-coded proxy
   assumptions.

The visual acceptance criterion is that approaching the hub adds detail to
the same place without changing its defining shapes or moving its objects.
Blur, heavier fog, or a longer fade do not meet that criterion.

## Implementation progress, 2026-10-08

Shared stage, marquee, and vendor-roof shape data now feeds both real models
and far proxies. Main-stage and marquee roofs are gabled, side stages remain
open, and vendor-roof candidates use the same row slots as the near builder.
The hub viewer can hide the real hub for proxy-only inspection and toggle
real/proxy at a fixed camera. `bin/test-far-field` checks the shared shapes,
candidate slots, and pool triangle gate. The actual game booted on low and
high tiers without browser errors.

Camp pitches and forest trees still use separate proxy positions, and the
handoff still dissolves only the proxy while real geometry appears at full
strength. Proxy lighting remains a global unlit dimmer. Those differences
must be resolved and compared at Noon and Midnight before this review's
visual acceptance criterion is met. No physical-device or new GPU result is
claimed here.
