# Structural optimization candidates

This is a neutral investigation inventory, not a selected plan. The application
remains unchanged from [the tested source](source-manifest.json). Existing
November 6 work is dirty and must be preserved. These are opportunities to
measure, not expected FPS gains.

## Observed baseline

The High driving CPU profile completed the actual sixty-second measured route
through the normal title gesture. Its instrumentation is `cpu-profile-v1`,
which is deliberately incompatible with accepted `light-v1` comparison data.
The [complete function attribution](high-route-all-functions.json) maps samples
through the exact frozen build. Inclusive timings overlap; they cannot be added.
Of 59,840.666 sampled milliseconds, the profile recorded about 23,505 ms under
composer rendering, 12,440 ms under adult update, 6,647 ms under terrain sampling,
2,375 ms self time in registry reconciliation, 2,170 ms under child update, and
165 ms under ordinary chunk generation. These are instrumented attribution
observations, not savings predictions. Cumulative cost does not identify the
cause of a worst frame.

## Unordered structural candidates

| Candidate | Current mechanism | Evidence and central unknown |
| --- | --- | --- |
| Spatial static presentation / render tiles | Replace selected repeated static Object3D presentations with bounded spatial batches or static islands while retaining gameplay ownership. | Renderer traversal and matrix work are notable in the current profile. Generic broad model merging previously failed a real-GPU gate, so actual eligible repeated families and GPU outcomes must be established: `docs/backlog/performance.md:107`, `src/people/childPresentation.js:69`, `high-route-all-functions.json`. |
| Reusable exact support regions or batched support queries | Restructure repeated small pedestrian support proposals around immutable terrain/support ownership, preserving complete footprint sweeps. | Adult update and terrain support dominate parts of the profile. Atomic immediate moves already avoid duplicate commit validation: `src/landscape/support.js:147`, `src/landscape/support.js:185`, `src/landscape/peopleAdapter.js:25`. A valid geometric fast path and its hit rate are unproven. |
| Explicit registry spatial publication | Replace frame-wide discovery of raw entry mutations with explicit owner/publication rules and event-driven aggregate maintenance in existing ordered grids. | Membership writes are already incremental; the remaining scan is `src/registry.js:308`. Publication timing is fixed at `src/main.js:1469`; changing timing or query order can change behavior. |
| Deterministic child contact solving | Extract a spatially selective solver that preserves collision constraints and correction order. | `src/people/children.js:419` permits 128 all-pairs passes. That is an upper bound, not observed pass use; corrections can invalidate precomputed neighbor sets during a pass. |
| Cancellable bounded ordinary-world construction | Split measured hot ordinary chunk/lake builders into bounded cancellable jobs with completed-owner publication. | Deadlines are checked before synchronous generation (`src/chunks.js:385`); current `isLoaded` means fully built (`src/chunks.js:334`). District staging already exists (`src/landscape/districtBuild.js:18`, `src/landscape/district.js:145`), but the measured route does not yet attribute worst frames to ordinary builders. |
| Compact child pose data | Replace retained source scene rigs with direct matrix publication while retaining actor identity and exact poses. | Batching already exists, but source hierarchies remain (`src/people/childPresentation.js:24`, `src/people/childPresentation.js:98`). Hierarchical pose, shadow and camera equivalence need proof. |
| Incremental ground representation | Replace whole-mesh recenters with tiles/strips/ring buffers and incremental normal/bound maintenance. | Current code rewrites all 19,881 vertices (`src/world.js:211`). The exact-grid shortcut is already present and is the baseline; current route attributes only about138 ms total to this function, and seams/normals/draw overhead may outweigh savings. |

## Existing work that must not be proposed as new

Adults already use instancing and a separation grid (`src/crowd.js:234`,
`src/crowd.js:905`). Landscape planning and render buffers already use a worker
(`src/landscape/planner.js:57`). Child draw submission is already batched
(`src/people/childPresentation.js:69`). The registry already retains unchanged
cell memberships (`src/registry.js:308`). Low already has Lambert fallback and
tier-specific effects. Raw count reductions or source complexity alone are not
a performance verdict.

The [streaming map](streaming-source-map.md),
[render/actor map](render-actor-source-map.md), and
[registry map](registry-source-map.md) preserve additional source citations
and reusable verification surfaces. Their recommendations are independent
research opinions rather than a council decision.
