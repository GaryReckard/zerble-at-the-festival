# Streaming and construction source map

Read-only worktree audit, November 7, 2026. This report identifies structural
work units and existing verification surfaces. No browser, server, full test
suite or benchmark was run for this audit, and no production code was changed.

## Main finding and measurement limit

Ordinary chunk construction is synchronous inside a deadline-checked admission
loop. The clock is checked before `_generate`, but not between the stages it
then executes. Lakes likewise construct newly admitted owners synchronously
without receiving a deadline. These are concrete mechanisms by which one work
unit can exceed the nominal streaming allowance; they do **not** establish that
these units caused the previously recorded long driving frames, nor quantify
the benefit of any redesign (`src/chunks.js:385–390`, `src/chunks.js:517–571`,
`src/lakes.js:183–201`).

## Current pipeline

1. `updateWorld` establishes one absolute streaming deadline. Its actual order
   is landscape residency, lakes, ordinary chunks, optional physical
   preparation, then far-field planning with the remainder. Ground recentering
   runs later in the same update, outside that streaming prefix
   (`src/world.js:118–151`, `src/world.js:182–189`).
2. `ChunkManager.update` builds closest-first candidates and checks the
   deadline before each whole `_generate`. Initial preload intentionally
   bypasses the wall. Unloads are then performed synchronously over distant
   loaded owners (`src/chunks.js:346–415`).
3. The default worldgen path synchronously queries the region and constructs
   roads, festival props, woodland camps, trees, crowd, bubble jugs, campsites
   and hedges. Only afterward does `_generate` add the group to the scene and
   publish its loaded entry (`src/chunks.js:430–449`,
   `src/chunks.js:517–571`).
4. The legacy forest system is on the alternative `worldgen=0` path, rather
   than co-running with the default worldgen branch. Default worldgen trees
   already accumulate descriptors and use per-chunk instancing, so proposing
   generic tree instancing would duplicate existing work
   (`src/perf.js:61–72`, `src/chunks.js:430–474`,
   `src/chunks.js:1071–1089`, `src/chunks.js:1202`).
5. `LakeManager.update` calls its synchronous worldgen load/unload path, which
   constructs each newly admitted lake. Lake construction also invokes the
   synchronous campsite builder (`src/lakes.js:129–142`,
   `src/lakes.js:183–201`, `src/lakes.js:653–655`).
6. Player terrain and nearby solid physics preparation already use the shared
   deadline and bounded creation counts. Each terrain patch build and Rapier
   insertion remains an indivisible unit, with maximum-unit timing recorded
   (`src/physics/liveWorld.js:136–150`,
   `src/physics/terrainResidency.js:137–179`,
   `src/physics/staticResidency.js:215–248`).

## Work already moved into workers or resumable builders

Mountain landscape planning is already off-thread. Its worker computes pure
context, admission and optional road/water render data. The main-thread planner
checks world identity, candidate fingerprint and render-buffer validity before
adoption. The worker transfers typed-array buffers rather than a Three scene
(`src/worldgen/landscapeTask.js:11–24`,
`src/landscape/landscape.worker.js:1–8`,
`src/landscape/planner.js:51–75`).

Mountain district model construction already uses cancellable generator steps,
with a deadline and maximum step count. Its district implementation stages
registry entries and lights, validates final occupancy, remaps physical
descriptor origin IDs and publishes the scene owner only after construction
completes. This is an existing pattern to extend, rather than a reason to invent
an engine-wide transaction framework (`src/landscape/districtBuild.js:6–32`,
`src/landscape/district.js:35–47`, `src/landscape/district.js:134–157`).

The runtime still performs each landscape water-owner build as one call, and
district publication is a single generator step. Existing incremental
construction therefore does not itself prove that every unit is sufficiently
small (`src/landscape/runtime.js:89–104`,
`src/landscape/district.js:134–157`).

## Structural options to compare

These are candidate designs, not measured recommendations or promised speedups.

| Candidate | Evidence supporting investigation | Principal decision to test |
| --- | --- | --- |
| Staged ordinary-world construction | Ordinary chunks and lakes remain whole synchronous units, while district construction already has a staged generator precedent (`src/chunks.js:385–390`, `src/lakes.js:183–201`, `src/landscape/districtBuild.js:18–28`). | Can entity-level work units and bounded publication reduce the largest measured construction stalls while keeping identical content and safe collision availability? |
| Worker-prepared ordinary chunk descriptions and buffers | Ordinary region/placement preparation starts inside `_generateWorldgen`; landscape planning already uses identity-checked worker output and transferred render buffers (`src/chunks.js:517–543`, `src/landscape/planner.js:51–75`, `src/landscape/landscape.worker.js:4–7`). | How much attributable main-thread work can move into pure descriptions/buffers, after accounting for adoption and actual Three/Rapier allocation that remains on the main thread? |
| Bounded construction reuse and retirement | Chunk generation creates a new group, while unload traverses owned meshes and sweeps registry, crowd, audio and animation lists (`src/chunks.js:421–449`, `src/chunks.js:586–645`). | Do measured build/dispose costs justify an explicit reuse/retirement state machine and a larger bounded memory footprint? |
| Incremental ground representation | Recenter rewrites every ground position/color and recomputes normals and bounds (`src/world.js:182–189`, `src/world.js:211–228`). | Is remaining recenter cost large enough after the latest direct-lattice lookup to justify a strip/tile or ring-buffer representation, including edge-normal and world-coordinate correctness? |

The most direct structural mechanism to investigate first is ordinary-world
construction granularity, because the deadline currently cannot interrupt
these units. Selection still requires actual stage/unit attribution and a
comparison against the other measured costs; this audit alone does not pick
the overall winner (`src/chunks.js:385–390`, `src/chunks.js:517–571`).

## Constraints a construction redesign must preserve

- **No partial logical publication.** Ordinary tree generation currently adds
  registry entries before the chunk group is added to the scene. Inserting
  yields into the current code without staging would expose a different
  intermediate state. District staging provides a reference implementation
  (`src/chunks.js:1081–1088`, `src/chunks.js:447–449`,
  `src/landscape/district.js:35–47`, `src/landscape/district.js:145–157`).
- **Completion remains completion.** `isLoaded` explicitly means fully built,
  and the far-field owner consumes this predicate for handoff. A queued or
  partially built chunk must not be reported as loaded
  (`src/chunks.js:331–343`, `src/farField.js:617–638`).
- **Determinism includes draw consumption.** Origin-chunk seeding differs
  intentionally from other chunks, and draw-count canaries track cluster-local
  RNG consumption independently of position snapshots
  (`src/chunks.js:425–428`, `src/chunks.js:282–289`).
- **Lake lifetime is independent of chunk lifetime.** Lakes deliberately omit
  `chunkKey`; their teardown respects shared geometry/materials, instance
  buffers and adopted physical chairs (`src/lakes.js:16–19`,
  `src/lakes.js:901–925`).
- **Occupied support can refuse retirement.** Landscape owners are pinned by
  borrowers, and teardown may defer while a district or water owner remains
  occupied. Physical terrain readiness is committed only after body creation
  succeeds (`src/landscape/runtime.js:57–81`,
  `src/landscape/runtime.js:113–124`,
  `src/physics/terrainResidency.js:162–179`).
- **A deadline is not preemption.** Existing pumps and generator loops check
  clocks between units. A single expensive next step, publication or adapter
  call can still run beyond the remaining wall; any proposed hard bound must
  measure and, where necessary, subdivide those actual units
  (`src/landscape/districtBuild.js:22–28`,
  `src/landscape/district.js:134–157`,
  `src/physics/terrainResidency.js:150–168`).

## Existing inexpensive verification and instrumentation

- `bin/test-landscape-staging:17–49` covers hidden partial scene/registry,
  light/audio publication, five cancellation depths, stale-world cancellation,
  deadline and step limits, physical origin-ID remapping, live object
  references, physics adoption and teardown. It is a strong starting surface
  for an ordinary-chunk staged builder, not proof that that new builder exists.
- `bin/test-chunk-deadline:19–41` stubs `_generate`; it proves admission and
  preload rules, not bounded real construction. Its production world-prefix
  checks cover shared budget arithmetic (`bin/test-chunk-deadline:45–62`).
- `bin/test-landscape-runtime:23–56` checks access readiness, completed owner
  publication, occupied-support retention, teardown and reuse of canonical
  plans on revisit. `bin/test-landscape-render:14–31` checks actual worker
  buffers, normals, UVs, terrain contact and rejected-district water data.
- `chunkGenStats` already records whole chunk costs and optional stage
  attribution; `perfCapture=1` enables stage timing without debug-mode console
  warnings. The stage measurements separate region, roads, props, woodland,
  trees, crowd, jugs, campsites and hedges (`src/chunks.js:263–318`,
  `src/chunks.js:517–571`).

These surfaces were inspected, not executed, during this source audit. Browser
attribution must precede any claim that changing one of these units improves
the actual driving-frame tail.
