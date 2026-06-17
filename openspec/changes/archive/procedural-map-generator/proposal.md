## Why

Zerble's world is generated per-chunk: every 80m chunk independently rolls a theme
and drops a `+`-shaped path through its own center (`placePaths`, `pickTheme` in
`chunks.js`). The result reads as a squirrely uniform grid — paths run exactly
where attractions anchor (tent stages are placed *at* chunk center, on the path
intersection), every chunk is an equal independent dice-roll, and roads connect
everything to everything with no sense of "leading somewhere." There's no
intentional structure, no hierarchy, no sparsity.

We want an infinite world that still reads like a *real* festival: a central-place
hierarchy (rare hearts, rarer mega-hearts) with roads that connect destinations,
open/sparse land between, and a coherent landscape of lakes, rivers, and forests —
the way real geography looks intentional without any global planner.

That's a large, determinism-sensitive worldgen change. Rather than rebuild the live
3D world blind, this change first builds the layout **brain** as a render-agnostic
generator plus a dedicated **2D top-down sandbox** to develop and tune it across
*kilometers* — the global structure the chunk-loaded 3D game can never show on
screen. The generator is architected as the single source of truth so the 3D world
and a future in-game map view can later consume the identical layout.

## What Changes

- **NEW `world-layout-generator`** — a pure, render-agnostic, deterministic module:
  given a seed and a world coordinate (or chunk), it returns layout *data* (it does
  not render anything): hearts with rank, the road network with hierarchy, lakes,
  rivers + bridge points, a tree-density field, and the computed role/theme of any
  location. Determinism via hash-of-coordinates (`worldHash`), **order-independent**
  — no neighbor-to-neighbor forward passing; shared features (road segments crossing
  chunk edges, rivers between lakes) are edge/pair-seeded so any chunk computes them
  identically regardless of load order.
- **NEW `worldgen-2d-sandbox`** — a standalone Canvas-2D top-down page (separate from
  the existing 3D entity sandbox) to visualize and tune the generator: seed input,
  pan/zoom across kilometers, per-layer toggles (hearts / roads / water /
  forest-density / roles), and click-to-inspect a point's computed layout tuple.
- **Layered generation pipeline** (the order our exploration converged on):
  hearts → water (lakes + rivers) → roads (arterial / collector / footpath hierarchy,
  with bridges where roads cross rivers) → tree-density field → per-location role &
  theme (anchored *off* roads, facing them — which structurally kills the
  "stages-on-roads" bug).
- **Central-place hierarchy:** hearts are rare and rank-weighted (mostly none →
  minor → major → **mega**, the mega occupying a 2×2 macrocell block and clearing
  lesser hearts near it); rank drives domain radius and what spawns. Sparsity is
  simply the space *between* hearts; intentionality is everything orienting to its
  nearest heart.
- **Rivers + bridges (2D concept):** deterministic meandering curves connecting lakes,
  routed around heart cores; they carry a no-build corridor (nothing spawns on a
  river), and a road crossing a river marks a bridge.

## Capabilities

### New Capabilities
- `world-layout-generator`: the deterministic, render-agnostic infinite-layout
  function + the layered pipeline (hearts/ranks/megas, road hierarchy, lakes,
  rivers/bridges, tree-density field, per-location role) and its
  determinism/order-independence contract.
- `worldgen-2d-sandbox`: the standalone top-down dev/tuning harness (pan/zoom, seed,
  layer toggles, point inspector) that renders the generator's output and is the
  primary surface for developing and perfecting the map.

### Modified Capabilities
- (none — `openspec/specs/` is currently empty; this change introduces the first
  specs and does not alter existing live-game behavior.)

## Impact

- **New code:** a `src/worldgen/` module set with no `three` import; a new
  `map-sandbox.html` + its driver script using Canvas 2D. Reuses `rng.js`
  (`worldHash` / `hash2` / `mulberry32`); may add deterministic helpers there.
- **No live-game changes in this scope.** `chunks.js`, `forests.js`, `lakes.js`,
  the theme builders, registry, crowd, and the 3D render pipeline are untouched.
  Wiring the generator into the 3D world, the in-game map view, and rivers-in-3D
  (water + bridge meshes + collision corridors) are **explicit follow-up changes.**
- **Tripwire — determinism (footgun #4):** the entire generator must be
  order-independent and seed-deterministic. When *later* integrated into the live
  game it will be a deliberate **v2 worldgen** (regenerates existing worlds
  differently) — flagged now, not triggered in this change.
- **No threeShim / iOS-audio / disposal / perf-budget exposure:** the 2D sandbox is
  Canvas 2D, not three.js, so it sidesteps the material-tier, post-process, and
  shadow-budget tripwires entirely.
- **Importmap / cache-buster (no-build rule):** any new `src/` module loaded by the
  new sandbox page must be registered in that page's cache-buster list so local
  edits hot-reload.

### Scope Check
The existing "world layout" logic lives in `chunks.js` (`placePaths`, `pickTheme`,
the theme builders), `lakes.js` (320m lake macrocells), and `forests.js` (5×5 forest
macrocells). This change **deliberately does not modify them** — it builds a
parallel, isolated generator to perfect in 2D first; replacing the live pipeline is a
follow-up change. The only shared code reused is the determinism primitives in
`rng.js`, so the eventual integration inherits one seeding contract rather than a
second, divergent one.

## Decision Record
The Tier-3 council deliberation (`deliberations/001-initial/results.md`, 2026-06-06)
endorsed the architecture (D1–D4, D11) unanimously and reorganized the work into 5
Change Groups around two hard gates. Per Gary's decisions (see
`questions-for-human.md` Q1/Q4): **rivers + bridges and the mega-heart 2×2 are cut
from this change** — kept in the spec as the target and in the contract as
always-false stubs, deferred to the 3D-integration follow-up; **heart spacing is
tuned by eye at GATE 1** from a medium default. `tasks.md` reflects the CG1→CG5
implementation order.
