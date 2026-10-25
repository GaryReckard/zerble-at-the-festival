## Why

The driving proof establishes a useful terrain experiment, but the festival still places roads, people, venues and water on a flat world. Bring broad rolling terrain into the actual game through one deterministic surface, with the map and driving harness proving the contracts before the full world consumes them.

## What Changes

- Preserve existing X/Z world layout and RNG while adding independently seeded, bounded relief, level gathering pads, road grading and horizontal lake basins.
- Expose the final surface in the map and driving harness, then connect ground rendering, live cart motion, world placement, people, collision, cameras and distant proxies.
- Retain a flat fallback during integration, and enable rolling terrain only after recorded acceptance; rare mountain districts and changed route topology are outside this change.
- Add focused deterministic, contact, streaming and real-game checks plus development documentation and dated CHANGELOG/ROADMAP updates.

## Capabilities

### New Capabilities

- `terrain-integration`: A shared deterministic festival elevation surface and complete consumer integration, including release acceptance.

### Modified Capabilities

- `sandbox-harness`: The map and driving harness inspect the real shared terrain contract before live integration.

## Impact

Touches render-independent world generation, ground mesh, chunks/forests/lakes, registry/collision, crowd, carts, cameras, far-field proxies and sandbox tooling. Player-visible terrain requires CHANGELOG and ROADMAP updates. No new engine, build step, dependency, shadow-casting policy or asynchronous audio initialization is proposed. Determinism, lifecycle/disposal, boot order, geometry budgets and importmap coverage are risk signatures; the explicit efficiency-directed skip is recorded in the deliberation artifact.

## Scope Check

Source inspection found the flat-world pattern in `src/rng.js:77`, moving-center subtraction in `src/world.js:202` and `:532`, flat road ribbons in `src/chunks.js:941`, satellite pitches in `src/campClearing.js:33`, canoe bobbing in `src/lakes.js:877`, and the authored proof in `src/terrainSurface.js:1`. All are included as integration boundaries. The full consumer inventory in [the original proposal](../../../verification/terrain/2026-10-24-proposal.md) covers passengers, lights, bubbles, walking/seated states, lake ownership, forests and near/far transitions. Cosmetic model-local offsets remain local; absolute world-height assumptions are converted. Five consuming HTML importmaps require checking against the actual current repository, rather than the older proposal's four-page count.
