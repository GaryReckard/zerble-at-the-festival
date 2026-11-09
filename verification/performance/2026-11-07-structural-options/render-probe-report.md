# Frozen rendering discriminator

**TL/DR:** Neither tested rendering mechanism advances. Freezing direct booth
meshes saved no meaningful render work, while spatially grouping shopkeeper
parts lowered draws but did not materially improve measured render work. This
is a negative feasibility result for these mechanisms on this desktop, not a
claim that all rendering restructures are unhelpful.

## Provenance and coverage

The [pre-capture policy](render-discriminator-policy.md) defined the mechanisms,
protected state and nomination filter. The [baseline manifest](source-manifest.json)
identifies the existing application. The disposable copy added only a local
factory-exposure bootstrap, recorded in [build provenance](render-build-provenance.json)
and [its manifest](render-probe-manifest.json); no application working-tree source
was changed by this investigation.

Accepted external supervision ran hardware-backed Chrome on Apple M4 Pro with
1280 × 720 canvas and scene targets, native ready-title clicks, muted audio and
native camera-cycle key events. Low and High each completed 2,304 frozen manual
renders, covering third-person, first-person and top-down at Noon .3 and
Midnight .75. Each mechanism/view used ABBA ABBA, four untimed renders before
each block and 24 measured samples per block. The full raw samples, exact-state
assertions and cleanup outcomes are retained in [High raw data](high-render-raw.json),
[Low raw data](low-render-raw.json), [High ownership](high-render-ownership.json)
and [Low ownership](low-render-ownership.json).

The application simulation was paused for each entire comparison, and every
original pose/world matrix, parent, visibility, resource/render state and expected
layer mask stayed exact, alongside ordered registry and camera fingerprints.
Disposal restored layers, transform flags, mesh count and the existing render
observer. This establishes those exercised state checks, not all gameplay fields
or streaming lifecycle correctness. The real factory retains every source rig.

## Results

Values below are candidate minus baseline medians in milliseconds. Positive is
more render work. They are rounded for reading; [the deterministic summary](render-summary.json)
preserves full numeric values, block pairs and both order groups.

| View | High static flags | High shopkeeper batches | Low static flags | Low shopkeeper batches |
| --- | ---: | ---: | ---: | ---: |
| Third, Noon | 0.00 | +0.20 | +0.05 | −0.20 |
| Third, Midnight | −0.10 | +0.10 | −0.10 | −0.10 |
| First, Noon | −0.05 | +0.15 | −0.20 | +0.20 |
| First, Midnight | −0.05 | +0.10 | +0.10 | +0.05 |
| Top, Noon | −0.10 | +0.05 | −0.10 | +0.05 |
| Top, Midnight | +0.05 | approximately 0.00 | 0.00 | +0.25 |

Neither mechanism had a single view with the predeclared 1 ms median reduction,
so neither reached the required two views or advances to an ordinary pilot.
This is a planning investment filter, not a calibrated statistical verdict.
The small mixed deltas are not described as established improvements or
regressions in delivered frames.

### Static transform control

The audited booth direct-mesh family contained 74 High meshes and 44 Low meshes.
Every untimed arithmetic audit removed that many local `updateMatrix` calls but
left all selected world-matrix multiplications. A .125-unit parent mutation
still propagated through the disabled child flags, matching pinned r160 force
semantics, and exact original matrices returned after explicit republish/revert.
No scene traversal or world-multiply elimination is claimed
(`render-summary.json:tiers.*.rows[*].matrixAudit`;
`node_modules/three/src/core/Object3D.js:572-608`).

### Spatial shopkeeper submission

High retained 481 selected vendor meshes and added 128 batch meshes in seven
80-metre cells. Low retained 286 source meshes and added 78 batch meshes in four
cells. The source rigs remained in the scene and the actual factory performed
visibility/caster checks, matrix copies, uploads and bounds maintenance
(`render-summary.json:tiers.*.rows[*].candidateCounts`;
`src/people/childPresentation.js:23-25,69-106`).

High scene draws fell by 63–151 depending on view; Low fell by 63–128. High
triangles rose by 352 in third-person and 1,056 in first-person, with unchanged
top-down totals; Low triangle totals stayed equal. This is consistent with the
helper retaining offscreen shadow casters, but no GPU completion timer was
collected. The counter change alone cannot establish its exact cause or cost
(`render-summary.json:tiers.*.rows[*].submissions`). Construction per re-entry
was approximately 4.9–8.5 ms High and 2.0–2.9 ms Low, reported separately rather
than hidden in steady render timing.

All six Midnight vendor screenshot pairs were byte-identical. Noon pairs were
not byte-identical; the High third-person pair was visually inspected without
an obvious scene change, but no comprehensive pixel-equivalence claim follows.
The attempted Pillow comparison was unavailable because Pillow is not installed;
[the image checks](render-image-checks.json) therefore report hashes only.
Since the mechanism already fails its performance nomination filter, no visual
acceptance or production migration is asserted.

## Reproduction and limits

`python3 analyze-render-probe.py` in this directory regenerates the summary from
the two fixed diagnostic directories and promotes exact raw/ownership/input
copies. The [worker](render-worker.mjs), [installer](render-install.js),
[author notes](render-probe-author-notes.md) and [runner](render-probe.py) record
the complete mechanism and teardown. The runner requires an explicit reserved
Mac, current capability receipts and the disposable manifest, and is not a new
general-purpose lab command.

This is frozen-pose render attribution, not ordinary `light-v1` frame acceptance.
It does not establish route tails, sustained driving, Safari/iPad behavior,
Auto quality, long-run GPU/heap retention or synchronous iOS audio unlock.
Source matrix equivalence cannot prove every rendered pixel, and separate tiers
were not identical populations. The appropriate conclusion is to reject these
two tested mechanisms for advancement, then review the residual inventory before
deciding whether any other structural direction justifies an implementation plan.
