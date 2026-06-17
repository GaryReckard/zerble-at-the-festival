## Context

The live world is generated per-chunk and independently: `chunks.js` `pickTheme`
rolls a theme from `worldHash(cx,cz,1)` with no neighbor awareness, and `placePaths`
stamps a `+` path through every chunk center — exactly where theme builders anchor
their attraction (e.g. the tent stage is placed *at* `(cxWorld,czWorld)`). Lakes
(`lakes.js`, 320m macrocell) and forests (`forests.js`, 5×5 chunk macrocell) already
demonstrate the pattern we want to lean on: coarse cells, jittered features,
locally-computable, deterministic via `rng.js` (`hash2`/`worldHash`/`mulberry32`).

This change builds the *layout brain* in isolation — a render-agnostic generator and
a 2D top-down sandbox — before any 3D integration, because the global structure we're
trying to judge (sparsity, hierarchy, a road network that leads somewhere) is
invisible inside the chunk-loaded 3D game.

## Goals / Non-Goals

**Goals:**
- A deterministic, render-agnostic generator that returns layout *data* for any
  (seed, coordinate): hearts/ranks, road hierarchy, lakes, rivers/bridges,
  tree-density field, per-location role.
- Intentional structure inside infinity via a central-place hierarchy (the way real
  geography looks planned with no global planner).
- A 2D Canvas sandbox to develop, visualize across kilometers, and tune the generator
  fast.
- Architecture that lets the future 3D world and a future in-game map view consume
  the identical generator (single source of truth).

**Non-Goals (this change):**
- Wiring the generator into the live 3D game (`chunks.js`/`forests.js`/`lakes.js`).
- The in-game map view UI.
- Rivers-in-3D (water meshes, bridge meshes, collision corridors).
- Replacing or migrating existing world layouts. The live game is untouched here.

## Decisions

**D1 — Render-agnostic pure generator is the single source of truth.**
The generator returns plain data and imports nothing from `three`/DOM.
*Alternative:* build layout logic straight into `chunks.js` against three.js.
*Rejected:* couples layout to the renderer, can't be viewed globally, slow to
iterate, and would have to be rewritten for a map view. A pure module feeds 2D
sandbox + 3D world + map view alike.

**D2 — The sandbox is Canvas 2D, not three.js.**
*Alternative:* a three.js orthographic top-down scene.
*Rejected:* Canvas 2D is simpler, instant, can draw kilometers at once, and sidesteps
the threeShim/material-tier, post-process, and shadow-budget tripwires entirely. It
also enforces the render-agnostic split — if the sandbox can draw it from data alone,
the data model is complete.

**D3 — Central-place hierarchy for "intentional structure in infinity."**
Rare, rank-weighted *hearts* (none → minor → major → mega); every location derives
its role from its nearest heart (distance/angle → core/district/outskirts).
*Alternatives:* (a) status-quo uniform per-chunk roll — no structure; (b) pure
edge-port tiling — solves connectivity but produces an intention-less uniform web.
*Chosen:* hierarchy of centers — sparsity is the space *between* hearts;
intentionality is everything orienting to its center. This is how Earth looks planned
without a planner.

**D4 — Determinism via edge/pair-seeded shared features, NOT forward-passing.**
This is the load-bearing correction. A shared feature (a road crossing a chunk edge,
a river between two lakes) is seeded from the feature's *own* identity — the edge id
or the endpoint-pair hash — so both sides compute it identically.
*Alternative (explored and rejected):* "the first-generated chunk computes its edge
ports and hands them to the neighbor." *Rejected:* order-dependent — the same chunk
would generate differently depending on approach direction, would drift on
unload/reload (chunks DO unload past `UNLOAD_RADIUS`), and would break `?seed`
reproducibility. Edge-seeding keeps the same mental model (ports drive the interior)
but makes ports a property of the *wall*, not the *neighbor*.

**D5 — Roads = node-graph arterials + local footpaths, as two tiers of one hierarchy.**
Arterials connect hearts (the node-graph); collectors branch; footpaths are the fine
local tier (the edge-port/tiling idea, demoted to where it fits). Roads cross region
boundaries *perpendicular* so the two independently-generated halves meet without a
kink.
*Rationale:* unifies the two approaches we debated — they were never rivals, they're
different floors of the same building.

**D6 — Which hearts connect: a local proximity graph with a generous lookup radius.**
Arterials connect each heart to its nearest few neighbor hearts (relative-neighborhood
/ Gabriel-style). Because such graphs can depend on a third point just outside a small
window, the connection rule reads a deliberately generous macrocell neighborhood to
stay globally consistent. The exact radius is verified empirically in the sandbox.

**D7 — Rivers: deterministic meandering curves between lakes, built last.**
A river is a pair-hash-seeded meander connecting two lakes, routed to bend around
heart cores, carrying a no-build corridor. Bridges are deterministic road×river
intersections. Rivers are the hardest element and the most coupled, so they are the
*last* layer implemented, behind the proven heart+road skeleton.

**D8 — Tree density is a continuous field, not discrete forest blocks.**
density = woodland-noise − heart-core clearing − water/road footprint. "Forest" is
where the field is high. Replaces the current discrete 3×3 forest concept for the new
generator (the live `forests.js` is untouched in this change).

**D9 — Tunable macrocell constants; the heart distribution is the make-or-break knob.**
Heart cell size, rank weights, jitter, domain radii, and the road-neighborhood radius
are named constants. The heart rarity/spacing/rank-variation is the single knob that
decides "reads as real" vs "lattice of festivals," so the sandbox exists primarily to
tune it by eye at the macro scale.

**D10 — Layered pipeline, each layer a pure function reading earlier layers.**
Order: hearts → water (lakes+rivers) → roads (route around water, bridge crossings) →
tree-density → per-location role/theme. Mirrors the dependency order the exploration
converged on ("lakes first, then roads, then things").

**D11 — File layout: a small `src/worldgen/` module set.**
e.g. `hearts.js`, `roads.js`, `water.js`, `density.js`, `roles.js`, and an `index.js`
that composes them into the point-query + region-query API. Each pure; all reuse
`rng.js`. A new `map-sandbox.html` + driver consumes `index.js`.

## Risks / Trade-offs

- **Uniform heart spacing → grid-of-festivals.** → Rank variation + jitter +
  Poisson-ish placement; treat the zoomed-out 2D view as the acceptance test for this
  specific knob before building anything downstream.
- **Proximity-graph inconsistency across the plane.** → Use a generous neighborhood
  radius; add a sandbox self-check that computes a point's local graph from several
  window origins and asserts agreement.
- **Rivers are hard + highly coupled** (roads need bridges, props avoid corridors). →
  Build last; isolate in their own layer with a clean `no-build(x,z)` query; keep the
  skeleton shippable without them.
- **Seam kinks** where independently-generated road halves meet. → Perpendicular
  edge-crossing on both sides.
- **Determinism regressions** (the cardinal sin, footgun #4). → A determinism
  self-test in the sandbox: query points in two different traversal orders and assert
  byte-identical output (mirrors the byte-identical verification the perf-pass-4
  spatial grid shipped with).
- **Generator cost when drawing kilometers** (a naive per-pixel query is expensive). →
  Keep the point-query bounded-neighborhood cheap; render at sampled resolution / tile
  cache in the sandbox; this is a sandbox-rendering concern, not a generator concern.

## Migration Plan

This change ships only `src/worldgen/` + `map-sandbox.html`; **no live-game migration
occurs.** Rollback is deleting the new files — nothing in the running game imports
them. The *future* integration change will wire the generator into `chunks.js` as a
deliberate **v2 worldgen** (the breaking, world-regenerating step) and is explicitly
out of scope here.

## Open Questions

- **Q1 (heart spacing/rarity):** target feel for distance between hearts (≈ drive time
  at boost)? Drives the make-or-break knob. *Default if unanswered:* tune for a major
  heart roughly every few hundred meters and a mega rarely, then eyeball.
- **Q2 (footpath density):** "midway with frontage" (sparser) vs a denser organic web
  at the fine tier? *Default:* lean sparser; footpaths only where they earn it.
- **Q3 (map-view priority):** is the in-game map view a near-term follow-up (architect
  for it now) or someday-maybe? *Default:* keep the generator map-view-ready, don't
  build the UI.
- **Q4 (rivers in this 2D scope):** include rivers+bridges in this change's 2D
  prototype, or defer even the 2D work? *Default (per exploration):* in scope, built
  last.
