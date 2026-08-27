## Context

Worldgen v2 loads full 80m chunks around Zerble. Low keeps a 3x3 load ring and
mid/high keep 5x5, while fog remains partially transparent until 520m. Increasing
the full chunk radius would multiply registry, collision, crowd, audio, animation,
shadow, and model ownership, so the ROADMAP parks a separate semantic far-field
layer instead.

The pure worldgen boundary already provides the right source data:
`queryRegion(bounds)` returns hearts and arterial road polylines, and
`festivalPlan(heart)` returns deterministic cluster descriptors with stable stage,
vendor-row, position, yaw, scale, and cluster-seed data. `ChunkManager.loaded`
records real completion only after a chunk has been fully built and added. The
horizon can therefore share placement truth without calling any real builder.

This is not the loaded-cluster replacement LOD that would swap real tents or
trucks beyond 60-100m. The first slice spends a small fixed render budget to fill
currently empty space; the same proxy geometry can support replacement LOD later.

## Goals / Non-Goals

**Goals:**

- Make roads and festival destinations read intentionally through the middle
  distance at Noon and Midnight on every tier.
- Consume existing deterministic descriptors without changing RNG calls, golden
  output, registry state, or full chunk ownership.
- Hold the initial layer to 6-12 added scene draws with bounded geometry and no
  steady-state allocation churn.
- Transition according to actual real-chunk completion and expose the proxy again
  when that chunk unloads.
- Make isolated visual, handoff, tier, performance, and lifecycle verification
  cheaper than driving the full game.

**Non-Goals:**

- Loading a larger full chunk ring.
- Replacing already-loaded model groups with proxies.
- Exact miniature copies of booths, crowds, forests, or lakes.
- Billboard atlas generation, textures, transparent cards, new lights, shadows,
  audio, colliders, pickups, or registry entries.
- Extending `cameraFar`, weakening fog, changing worldgen salts, or modifying the
  synchronous iOS audio start chain.

## Decisions

### D1: `FarField` is a peer world system, not part of `ChunkManager`

`world.js` owns one `FarField` beside `ChunkManager` and `LakeManager`. Build order
is lakes, full chunks, then horizon, while frame order updates full chunks before
the horizon. The horizon receives a narrow `chunkManager.isLoaded(cx, cz)`
completion predicate and the current time-of-day value; it never sees the mutable
`loaded` Map or the private chunk-key string format, and it never registers
content or asks a real cluster builder to run.

Chunk teardown stays authoritative, and the handoff contract is named rather than
inferred: a proxy hides only once the owning chunk's required cluster props
actually exist. Today `isLoaded` can be backed by `loaded.has(...)` because
`_generateWorldgen` runs synchronously start-to-finish, but that is an
implementation accident the code already plans to break (both `perf.js` and
`chunks.js` note future intra-chunk splitting). If chunk generation is ever
split, `isLoaded` must keep answering "fully built," not "started"; the
predicate is the seam that forces a real completion signal.

Expanding `ChunkManager` was rejected because a proxy has none of a chunk's
gameplay lifecycle. Construction happens in `buildWorld` but performs no
synchronous planning at module evaluation: the first plan is deferred to the
first enabled update so the default-off path adds nothing to the boot chain, and
initial proxy ownership snaps to its target state with no envelope.

### D2: The first visual vocabulary uses six global batches

The layer owns fixed-capacity pools for:

1. road ribbon geometry, one draw;
2. stage canopy primitives, one draw;
3. dark truss/beam boxes, one draw;
4. tent and vendor roof peaks, one draw;
5. warm festival light markers, one draw; and
6. colored stage beacons, one draw.

Canopies, beams, peaks, and lights use `InstancedMesh` with small shared code-native
geometries. Per-instance color expresses a bounded palette without material
variants. Road positions and indices live in preallocated typed arrays on one
`BufferGeometry`; `setDrawRange` exposes the active prefix. Pools deterministically
keep the nearest candidates when capacity is exceeded and report overflow through
debug stats. Every matrix/color write flips its corresponding `needsUpdate` flag,
and every committed pool rewrite recomputes the affected `InstancedMesh` bounding
volumes and road geometry bounds (or deliberately disables frustum culling for
that batch and accounts for the cost). Three r160 computes instanced bounds once,
so a rewrite that moves instances hundreds of metres would otherwise leave stale
bounds and the horizon would vanish at specific camera angles.

Six batches are the maximum vocabulary, not a mandate: the road, stage canopies,
and roof peaks land first, and trusses plus the two night-marker batches are
added only while the measured draw, triangle, upload, and shader-program caps
stay green.

All materials are unlit, opaque, fog-aware, non-shadow-casting, and owned by the
FarField instance. They do not use real `Light` objects. No module-level material
is disposed by chunk teardown. `FarField.dispose()` owns its instance buffers,
geometries, and materials for hub-sandbox rebuild and page teardown.

### D3: Actual plans define anchors; semantic geometry stays intentionally coarse

At an 80m player-cell crossing, the layer discovers hearts and roads incrementally
by coarse cell within the tier's horizon radius plus one-cell hysteresis, never as
one monolithic `queryRegion` over the full ~1km² bounds, whose cold cost is
measured history (the per-cell road cache exists because cold arterial
computation once stalled for seconds). For each heart in range it reads the
memoized `festivalPlan`, selects the guaranteed stage plus a bounded number of
vendor-row descriptors, and immediately copies the needed fields into compact
FarField-owned records. Cached worldgen arrays (`festivalPlan` results, road
polylines) are shared memoized truth: the horizon never sorts, clips, annotates,
or otherwise mutates them in place, and the focused tests hash descriptor inputs
before and after a rebuild to prove it. Stage proxy position, yaw, and scale come
from the actual stage descriptor. Roof peaks align to actual vendor-row axes, but represent a strip
rather than individual booths. No private RNG stream is necessary in the first
slice; palette choices derive from descriptor kind/rank/clusterSeed by pure integer
mapping that consumes no generator draws.

Road geometry follows the existing pair-owned polyline data, copied into the
preallocated buffers as a slightly narrower ribbon at an explicit elevation
constant strictly between the ground plane (y=0) and the authoritative road
(y=0.06), nominally y=0.03. Full road meshes therefore cover the proxy without
per-segment handoff or z-fighting. The underlay material stays opaque with
`depthWrite: true` and is created at construction time, never at module
evaluation (the depthWrite/module-eval failure class has shipped on this exact
surface before). Verification covers both grazing-angle and top-down views,
since top-down separation is Δy alone.

Rebuilding is boundary-triggered, not per-frame, and there is no second streaming
budget: `world.js` owns one shared per-frame streaming deadline (the existing
3/4/5ms tier wall), full chunk work consumes it first, and the horizon receives
only the remaining time. Planning proceeds per coarse cell as an incremental
pending snapshot while the previous horizon stays visible, then lands as one
atomic pool rewrite. Pending snapshots are versioned by the requesting player
cell: a rapid teleport supersedes any older pending job, so a stale snapshot can
never commit. The largest indivisible cold step is measured separately and gated.

### D4: Visibility follows descriptor ownership and uses proxy-only dither

Cluster ownership uses the same half-open 80m center rule as `placeChunkProps`,
via one pure owner-cell helper exported from `src/worldgen/placement.js`, never a
re-implementation. The rule currently lives in a local closure, the chunk-key
string format is private to `chunks.js`, and player-cell derivation is
`Math.round` center-anchored where a naive port reaches for `Math.floor`; each of
those three re-derivations goes wrong at negative coordinates. Each proxy has a
target visibility derived from the narrow `chunkManager.isLoaded(ownerCx, ownerCz)`
completion predicate: not loaded targets 1, loaded targets 0. A 0.3s envelope
updates only active handoffs, and the initial state after a (re)plan snaps
without an envelope.

Proxy materials extend an opaque `MeshBasicMaterial` through `onBeforeCompile`
with one per-instance fade attribute and a stable Bayer screen-door discard. The
material retains built-in fog, depth testing, tone mapping, and per-instance color;
it remains `transparent=false` and `depthWrite=true`. A stable
`customProgramCacheKey` prevents program churn. No real-world material is changed.
Reduced motion skips the envelope and snaps to the target state, and the flag is
read live at each handoff rather than cached at construction, because
`A11y.init()` resolves the persisted/OS preference only after `buildWorld` has
already run.

### D5: Time of day changes shared batches, not individual props

Day silhouettes use warm, fog-compatible flat colors. Night marker batches remain
hidden below a small nightness threshold, then use material-level color/intensity
updates shared by the whole batch. There is no per-light animation or twinkle in
the first slice. This adds no context lights and does not alter bloom ownership.

### D6: Tier knobs and experiment gating are explicit

`perf.js` owns `farFieldRadius`, capacities, and density. Low starts with a sparser
320-360m horizon; mid/high may reach 520m. Per-tier caps are pinned before any
geometry is built: instance counts, road vertex/index capacity, upload bytes, and
submitted triangles, with provisional marginal caps of +5k triangles on low and
+10k on mid/high until measurement justifies tighter values.

Effective enablement is `farFieldRequested && USE_WORLDGEN_V2`. `?worldgen=0`
remains a live escape hatch to the legacy world, and a horizon of v2 hearts over
a v1 world would be a permanent false horizon whose proxies never hand off. With
the feature off (or forced off by legacy mode) the path is a zero-allocation
no-op: no FarField GPU resources, no shader programs, no planning work. The
first implementation is enabled by `?farField=1`, with `?farField=0` retained as
the A/B control.

Promotion is baseline-first: fixed-pose disabled baselines are captured on real
`?perf=low|mid|high` reloads before the gate is finalized. If a tier's flag-off
baseline already exceeds its absolute HUD budget, the promotion gate for that
tier is re-keyed to marginal delta plus no-regression plus explicit Gary
sign-off, rather than leaving an unsatisfiable absolute test in place. Otherwise
the default flips only after every hard gate passes; if any fails, the
experiment remains local and the ROADMAP item stays parked.

### D7: The hub sandbox owns isolated iteration

`hub-sandbox.html` gains a far-field mode that constructs the real `FarField`
around a selected deterministic hub. Controls switch proxy-only, real-only, and
handoff states; move the simulated player distance; select tier and time of day;
and display active instances, overflow, draw/triangle delta, rebuild time, geometry,
textures, and programs. The main game's `window.__dbg` exposes read-only stats and
force-state controls for fixed A/B captures.

Two caveats keep this surface honest. Tuning-slider changes bump the worldgen
memoization epoch and rebuild the hub, so the far-field snapshot is invalidated
and rebuilt on the same trigger; the alignment-proving surface must never render
a pre-bump plan against a post-bump hub. And sandbox tier controls preview
composition only, so real tier, `threeShim`, and shader-compilation behavior are
verified through actual `?perf=low|mid|high` page reloads.

## Risks / Trade-offs

- **[Determinism] Reading more plans could warm caches or tempt new RNG calls.**
  The layer only consumes public pure descriptors and integer-maps existing fields;
  worldgen and registry goldens must remain byte-identical with the flag off/on.
- **[Cold planning hitch] A horizon query can discover several new hearts at once.**
  Rebuild timing is measured; work exceeding the tier wall is sliced while the old
  snapshot remains visible.
- **[Misleading proxy] A roof strip could promise detail the real builder skips.**
  Only guaranteed stage anchors and bounded semantic vendor strips are represented,
  and every cluster proxy disappears when its owning real chunk completes.
- **[Shader portability] `onBeforeCompile` string injections can drift with three.js.**
  Use documented shader chunks, a focused source/static test, a stable cache key,
  and real low/mid/high Safari-compatible boot verification through `threeShim`.
- **[Transparent-sort regression] A conventional opacity fade would require sorting.**
  The proxy-only Bayer discard stays opaque and depth-writing; reduced motion snaps.
- **[Pool overflow] Dense seeds can exceed fixed capacities.** Deterministic nearest
  selection preserves the most legible destinations and exposes an overflow counter;
  representative multi-seed tests size the pools before promotion.
- **[Resource leak] Repeated horizon rebuilds could replace GPU buffers.** Buffers are
  allocated once and rewritten; the hub sandbox and long-travel test require stable
  geometry, texture, heap, and program plateaus.
- **[Budget spend] This visual-depth layer adds draws rather than reducing current
  loaded-world draws.** The 12-draw ceiling and same-state A/B measurements are hard
  promotion gates. Replacement LOD is evaluated separately.
- **[Unsatisfiable gate] The shipped game may already exceed an absolute tier
  budget** (B0 profiling recorded ~3.7k median draws against a 400 budget), which
  would make an absolute-budget promotion gate dead on arrival. Disabled
  baselines are captured first; an over-budget tier re-keys to marginal delta
  plus no-regression plus explicit sign-off.
- **[Cache cliff] A 520m horizon query touches roughly 6-7x the heart area per
  crossing that 80m chunk placement does**, reaching the worldgen plan cache's
  full-clear threshold sooner on long travel; the long-travel plateau capture
  watches for the resulting periodic cold-recompute spike.
- **[Boot/importmap] A missing cache-buster entry can make local pages run stale code.**
  Add the new module to the three full pages' `mods` lists (map-sandbox is
  worldgen-only) and run `bin/check-importmaps`.

## Migration Plan

No world or save migration is required. The feature consumes existing descriptors
and introduces no salt, reordered draw, registry entry, or persisted state, so a
fixed seed must generate the same full chunks with the experiment off and on.

Rollout begins behind `?farField=1`. If the visual, determinism, lifecycle, and
performance gates pass, flip the default while retaining `?farField=0` for future
one-variable captures. If any hard gate fails, keep the default off and either
revise the bounded implementation or remove the experiment cleanly.

## Open Questions

None currently. Pool capacities and the exact low-tier radius are measurement
outputs, not human preference blockers.
