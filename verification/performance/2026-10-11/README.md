# Particle Lifetime and Query Optimizations

## Summary

Fixed a reproduced smile-halo GPU resource leak and removed unnecessary bubble
submissions, whole-registry queries, and duplicate kid proximity work. No quality
settings, density, draw distance, worldgen RNG, scoring rules, or build tooling
changed. These are bounded resource and CPU/geometry improvements, not a claim
that the entire game is a particular percentage faster.

The source baseline was `8a43996e562a0f7b35c31e3b3539bcd3dc650d9e`.
[Recorded measurements](results.json) came from Chrome 152 using the Apple M4 Pro
Metal GPU, not SwiftShader. [The browser probes](probes.js) are repeatable through
the local game's `__dbg` surface.

## Measured Changes

| Workload | Before | After |
|---|---:|---:|
| GPU geometries added after warm-up, five further batches of 40 expired smiles | 200 | 0 |
| Halo geometries/materials allocated for all 240 smiles | 240 / 240 | 1 / 2 |
| Low cheap-bubble triangles, two live bubbles | 32,000 | 320 |
| Low cheap-bubble triangles, twenty live bubbles | 32,000 | 3,200 |
| Low cheap-bubble triangles, full 200-slot pool | 32,000 | 32,000 |
| 10,000 attractor selections, synthetic 4,000-entry registry | 384.99 ms | 3.33 ms |
| 10,000 populated chunk lookups, same registry | 226.54 ms | 13.02 ms |
| 1,000 chunk unload/reload pairs, same registry | 54.66 ms | 44.48 ms |

Particle measurements render an isolated scene through the game's renderer while
the main loop is paused. Compare the slope within each smile run, not absolute
geometry totals between runs: the surrounding world was not at the same lifecycle
point. Low, Mid, and High all had zero growth across the six optimized batches.
The isolated cheap-bubble mesh takes two draws because it is double-sided and
transparent; draw count is unchanged. Savings shrink as the highest live slot
approaches capacity, and interior dead slots deliberately remain in place.
Detailed bubbles still require transmission rendering when alive.

Registry numbers are medians of seven warmed, alternating Node runs, with 40
owners and 80 attractors. Maintaining the indexes costs memory and extra writes:
10,000 individual add/remove pairs increased from 1.45 to 4.95 ms, approximately
0.35 microseconds extra per pair. These timings do not imply a 115x game speedup.

## Implementation

- [`smiles.js`](../../../src/smiles.js) owns one halo geometry and two halo
  materials for the system lifetime, reuses a target vector, and disposes its
  resources when the sandbox retires the owner. Previously, collection and
  expiration removed the mesh but stranded its individually allocated halo.
- [`bubbles.js`](../../../src/bubbles.js) submits only through the last live or
  popping slot. Slot ordering, physics, pop timing, materials, and saturation are
  unchanged. The first live update computes the original full-pool bounding sphere
  before trimming: Three.js r160 uses that cached sphere for transparency sorting
  even when frustum culling is off. Independent review caught this requirement,
  and the real-Three sphere equality test verifies the correction on every tier.
- [`registry.js`](../../../src/registry.js) maintains ordered owner and attractor
  indexes through add/remove. Positions and weights stay live; weighted subtraction
  and RNG consumption are unchanged. Registered owner keys and attractor membership
  remain fixed until removal, as current callers already require. Spatial indexes,
  collision ordering, and their per-frame rebuild are untouched.
- [`obstacles.js`](../../../src/obstacles.js) reuses the kid's nearest-bubble chase
  distance for its smaller happiness radius. The test runs the actual update and
  the restored old scan against 2,016 identical frames, with equal movement,
  happiness, score events, and random calls, eliminating 2,830 `Math.hypot` calls
  across those fixtures.

## Verification

`npm run check` passed with the three new suites included. The updated bubble test
also passes after the sorting-bound repair. Coverage includes 400 smile lifetimes
and every removal path, owner disposal, sparse/pop/refill/full bubble pools,
11,182 differential registry states, 36,000 existing spatial-grid queries, kid
motion and scoring equivalence, and the existing worldgen, quality, and gameplay
regressions. The Node Three shim checks ownership and control flow, not rendered
geometry; real-Three browser checks separately cover face orientation and bubble
sorting bounds.

The main game loaded on Low, Mid, and High without browser errors. Real title-button
clicks booted Low, including the 390x844 viewport with no horizontal overflow.
Each tier completed the same four-stop teleport route, from `(300,-641)` to
`(1043,-31)`, `(1789,-1594)`, and back. Streaming settled and both new registry
indexes matched full-scan insertion order at every stop. High generated 100 chunks;
Low generated 36. This is a streaming smoke test, not a continuous driving benchmark.

The sandbox's direct Smiles and Crowd-owned Smiles paths were switched through the
real dropdown. Both dispatched exactly one halo-geometry disposal event and left
no active smiles or child meshes. The real face-orientation regression passed.
Screenshots were inspected at Noon and Midnight, and the main game at desktop and
mobile-sized dimensions:

- [Noon smile](smile-noon.png)
- [Midnight smile](smile-midnight.png)
- [High desktop gameplay](game-high.png)
- [Low mobile-sized gameplay](game-low-mobile.png)

## Reproduce

Start the existing no-cache server, open the fixed-seed local game with the desired
`perf=low|mid|high`, and boot with `__dbg.start()` or the real title button. Then:

```js
const probes = await import('/verification/performance/2026-10-11/probes.js');
await probes.checkBubbleBounds();
await probes.particleProbe();
await probes.travelProbe();
await (await import('/verification/smiles/check.mjs')).checkSmiles();
```

The probes return measurements without uploading them. The particle probe briefly
replaces the rendered view with its test scene, then restores the render target
and resumes the game. Run it only in the local diagnostic session.

```sh
node bin/test-registry-indexes --bench
node bin/test-kid-bubble-query
node bin/test-smiles-lifecycle
node bin/test-bubbles-visibility
npm run check
```

## Limits

No physical iPhone, Safari, thermal, or sustained-drive FPS claim is made. The
existing [device governor comparison](../2026-10-09/capture-follow-up.md) remains
separate, and no governor thresholds changed. The High travel sample's total
geometry count grew from 1,377 to 3,376 despite returning to the original area,
while registry residency and animated resources differed. This short smoke test
does not establish an overall world-resource plateau or attribute that growth;
only the isolated smile lifetime leak has been proved and fixed here.

The full-registry spatial rebuild and bubble-neighbor indexing candidates were not
changed: preserving query order and all first-match behavior requires a separately
measured intervention. Broad model merges remain rejected by the previous GPU gate,
and this patch does not claim to resolve synchronous chunk-builder stalls.
