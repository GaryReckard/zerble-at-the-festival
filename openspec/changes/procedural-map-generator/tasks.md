## 1. Scaffolding & determinism foundation

- [ ] 1.1 Create `src/worldgen/` with an `index.js` that exposes `queryPoint(seed, x, z)` and `queryRegion(seed, bounds)` returning plain-data layout tuples (no `three`, no DOM). Stub the layers it will compose.
- [ ] 1.2 Add deterministic helpers needed for coordinate/edge/pair seeding to `rng.js` (or a `worldgen/hash.js`) — e.g. `cellHash`, `edgeHash`, `pairHash` — all built on the existing `hash2`/`worldHash`/`mulberry32` contract. Reuse, do not fork, the seeding scheme.
- [ ] 1.3 Write a tiny determinism self-test helper: query a set of points in two different traversal orders and assert byte-identical output. (Becomes the acceptance gate in §9.)

## 2. Heart field (the make-or-break knob)

- [ ] 2.1 Implement `worldgen/hearts.js`: coarse macrocell grid, jittered candidate position per cell, rank roll (none → minor → major → mega) with tunable named-constant weights. Reuse `cellHash`.
- [ ] 2.2 Mega-heart occupies a 2×2 block and suppresses lesser hearts inside its footprint; rank → domain radius mapping.
- [ ] 2.3 `nearestHeart(seed, x, z)` over a bounded macrocell neighborhood, returning heart + rank + distance + angle.

## 3. 2D sandbox shell (harness before the rest of the features)

- [ ] 3.1 Create standalone `map-sandbox.html` (Canvas 2D, no three.js) + driver script; register any new `src/` modules in this page's cache-buster list (no-build rule).
- [ ] 3.2 Pan/zoom across kilometers; seed input + URL param; render-on-demand for the visible extent (sampled resolution / simple tile cache so a zoomed-out draw stays cheap).
- [ ] 3.3 Render the heart layer (dots sized/colored by rank) and add a determinism toggle that runs the §1.3 self-test and reports pass/fail on screen.
- [ ] 3.4 Tune the heart distribution by eye at the macro scale until it reads as "real, not a lattice" (the D9 acceptance check). Capture the chosen constants in `session-log.md`.

## 4. Roads (arterials + footpaths)

- [ ] 4.1 Implement `worldgen/roads.js` arterial tier: connect each heart to its nearest few neighbor hearts via a local proximity graph (generous lookup radius per D6); meander each arterial as a deterministic curve seeded by the endpoint-pair hash.
- [ ] 4.2 Perpendicular region-boundary crossing so independently-generated halves meet without a kink; verify visually that arterials are continuous across the view as you pan.
- [ ] 4.3 Collector + footpath tiers (the fine local layer); `roadAt(seed, x, z)` returns on-road state + tier.
- [ ] 4.4 Add road layer toggles to the sandbox (by tier); confirm roads connect destinations, not tile space.

## 5. Water — lakes

- [ ] 5.1 Implement `worldgen/water.js` lakes (macrocell, jittered) with a `lakeAt(seed, x, z)` query; hearts and roads route around lakes.
- [ ] 5.2 Add the water layer toggle to the sandbox.

## 6. Tree-density field

- [ ] 6.1 Implement `worldgen/density.js`: continuous field = woodland-noise − heart-core clearing − water/road footprint; `treeDensity(seed, x, z)`.
- [ ] 6.2 Render the density field as shading in the sandbox (toggle); confirm it clears near hearts and rises in the outskirts.

## 7. Per-location role & theme

- [ ] 7.1 Implement `worldgen/roles.js`: from nearest-heart distance/angle → role tier (core/district/outskirts) → theme + density; anchor logic that offsets a placement *off* the nearest road and faces it (the structural fix for "stages on roads").
- [ ] 7.2 Wire the full tuple into `queryPoint`; add the sandbox point-inspector (click/hover → show nearest-heart+rank, role tier, road state+tier, river/bridge state, tree density, lake state).
- [ ] 7.3 Render role tiers as a sandbox layer (toggle).

## 8. Rivers + bridges (last — hardest, most coupled)

- [ ] 8.1 Implement rivers in `worldgen/water.js`: deterministic meandering curves connecting lakes, pair-hash seeded, routed to avoid heart cores; expose `noBuild(seed, x, z)` so nothing places on a river.
- [ ] 8.2 Bridges: deterministic road×river intersection markers.
- [ ] 8.3 Add river + bridge rendering to the water layer; verify rivers never cross a heart core and that road crossings show a bridge.

## 9. Determinism & acceptance verification

- [ ] 9.1 Run the §1.3 self-test across many points/seeds; assert byte-identical under reordering. Add a boundary-agreement check (a feature crossing a region edge computed from both sides matches).
- [ ] 9.2 Proximity-graph consistency check: compute a point's local arterial graph from several window origins; assert agreement (validates the D6 lookup radius).
- [ ] 9.3 Confirm the generator module imports cleanly with no `three`/DOM (render-agnostic requirement).

## 10. Docs

- [ ] 10.1 CHANGELOG: add the new dev-workflow surface (the `map-sandbox.html` generator + 2D viewer) under today's date.
- [ ] 10.2 ROADMAP: record the future follow-ups this unlocks (wire generator into the live 3D world as v2 worldgen; in-game map view; rivers-in-3D) so they're tracked, not lost.
- [ ] 10.3 Brief `src/worldgen/README` (or header comment in `index.js`) documenting the layered pipeline, the determinism contract, and the single-source-of-truth intent for the future 3D + map-view consumers.
