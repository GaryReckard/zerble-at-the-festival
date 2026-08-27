## Why

The fully rendered festival can end hundreds of metres before fog becomes opaque,
especially on the low tier's 3x3 chunk ring, so roads and destinations disappear
into an empty middle distance and then pop into existence on approach. The existing
deterministic worldgen descriptors can support a small render-only horizon layer
without paying for more gameplay chunks.

## What Changes

- Add a development-gated festival horizon (effective only as
  `farFieldRequested && USE_WORLDGEN_V2`; a zero-allocation no-op under the
  legacy `?worldgen=0` world) that renders deterministic, low-poly stage
  silhouettes, vendor or tent roof peaks, arterial-road continuation, and
  sparse night lights beyond the fully loaded chunk ring.
- Keep the horizon independent from gameplay ownership: no registry entries,
  colliders, NPCs, audio, pickups, real lights, shadow casters, or per-prop
  animation.
- Batch the initial representation into a fixed set of shared, bounded GPU pools
  with a hard 6-12 scene-draw ceiling and tier-specific range and density.
- Hand proxy clusters off to real chunks according to actual chunk completion,
  using an opaque, sorting-safe dissolve on the proxy only and an immediate swap
  under reduced motion.
- Extend the hub sandbox and local debug API with proxy-only, real-only, handoff,
  tier, time-of-day, and resource/performance inspection controls.
- Add deterministic, lifecycle, and performance regression coverage, then promote
  the feature from `?farField=1` only if the measured and visual gates pass.
- Keep coarse forest masses, far-field crowds, per-booth replicas, baked billboard
  atlases, lake proxies, fog expansion, and true loaded-cluster replacement LOD out
  of the first slice.

## Capabilities

### New Capabilities

- `festival-horizon`: Deterministic semantic far-field rendering, fixed draw and
  resource budgets, tier-aware horizon bands, real-chunk handoff, reduced-motion
  behavior, and the isolated verification surface.

### Modified Capabilities

- `worldgen-layout`: a narrow clarification of the "Persistent lifecycle (no
  chunkKey)" requirement. The baseline says every worldgen feature is persistent
  and carries no `chunkKey`, while `festival-composition` (and the actual
  `chunks.js` consumption path) chunk-key every festival cluster's built content
  by its descriptor center. The delta narrows the persistence guarantee to the
  render-agnostic query tuples (water, roads, hearts, density); festival cluster
  content ownership follows the existing descriptor-center chunk contract that
  the horizon handoff binds to. No runtime behavior changes; the delta makes the
  two baseline specs coherent before a new observer depends on them.

The `world-streaming`, `perf-tiers`, and `render-pipeline` contracts remain
intact; the new layer consumes their public state without changing their
existing guarantees. `world-streaming` gains a consumer that depends on
"loaded means fully built," so the horizon binds to a named completion
predicate rather than the current synchronous-generation implementation
accident (see `design.md` D1/D4).

## Impact

- **Code:** a new `src/farField.js` module; ownership and update wiring in
  `src/world.js`; performance knobs in `src/perf.js`; local debug hooks in
  `src/main.js`; hub-sandbox controls; the three full-page HTML importmap source
  lists (map-sandbox is worldgen-only); a new focused test harness.
- **Subsystems:** render pipeline, world streaming observation, deterministic
  worldgen reads, performance tiers, sandbox/debug harness, and GPU lifecycle.
  Registry/collision, crowd AI, audio, lake lifecycle, and model builders are
  explicitly read-only or excluded.
- **Tripwires:** the layer reads deterministic plans without consuming or
  reordering existing RNG calls; observes chunk load/unload without taking
  ownership; uses shared and dispose-safe geometry/material pools; adds measured
  draws and triangles; uses a shader/material path that must work through the
  existing `threeShim`; and requires a new source-module entry in the three
  full-page HTML importmap lists. The iOS audio initialization chain is untouched.
- **Player-visible:** yes. A CHANGELOG entry is required, and the shipped ROADMAP
  item must be removed or narrowed in the same eventual commit.
- **Dependencies:** no new package, asset pipeline, bundler, texture atlas, or
  external runtime dependency.

## Scope Check

The parallel distance/lifecycle systems were traced before scoping this change.
`ChunkManager` remains the sole owner of full interactive chunks; `LakeManager`
remains authoritative for separately streamed lakes; the recentered mountains,
sky, stars, and ground remain backdrop systems; and the forest-tree instancing
pool remains near-world rendering. The horizon follows the existing pooled
`InstancedMesh` and `userData.shared` disposal patterns but does not reuse a model
builder whose registry, animation, light, or audio side effects would violate the
render-only contract. Existing chunk roads remain authoritative in loaded chunks;
the far road is a narrower underlay built from the same pure road polylines.

The source-module cache-buster pattern exists independently per page.
`bin/check-importmaps` requires every `src/*.js` module in the three full pages
(`index.html`, `sandbox.html`, `hub-sandbox.html`); `map-sandbox.html` is
worldgen-only (`wg` + `rng`) and takes no render module, so it needs no entry.
True replacement LOD for already-loaded tents, trucks, crowds, or trees is a
separate follow-up because it changes render ownership inside live chunks and has
different performance acceptance criteria.
