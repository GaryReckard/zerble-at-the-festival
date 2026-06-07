// Worldgen — the render-agnostic infinite-layout generator (single source of
// truth for the 2D map sandbox now, and the future 3D world + in-game map
// view). NO `three`, NO DOM: returns plain data only.
//
// ── THE CONTRACT (deliberation CG1.1) ───────────────────────────────────────
// queryPoint(x, z) returns the layout tuple below. The seed is module-global
// (set once via setSeed → rng.setSessionSeed, the same door `?seed=` uses) — do
// NOT thread a private seed param, or sandbox-tuned maps won't reproduce in the
// 3D game under the same seed.
//
// The tuple is APPEND-ONLY across the 2D→3D boundary: the 3D port MAY add
// fields, but MUST NOT reorder or re-salt the draws that produce existing ones
// (that would regenerate worlds differently — footgun #4).
//
//   {
//     x, z,            // quantized echo of the query point
//     heart,           // nearest heart { cx,cz,x,z,rank,core,district } | null
//     heartDist,       // distance to nearest heart center (m)
//     heartInfluence,  // continuous 0..1 (1 at a heart center → 0 at district edge)
//     roleTier,        // 'core' | 'district' | 'outskirts'
//     onRoad, roadTier,// road state (arterial tier lands at GATE 2; stub: false/null)
//     facing,          // radians: suggested facing for a placement (faces nearest
//                      //   road — the stages-face-road fix); null until GATE 2
//     footprint,       // suggested clear-radius (m) for a placement here
//     inLake,          // bool
//     onRiver, bridge, // STUBS — always false (river layer cut this change, Q4)
//     noBuild,         // inLake || onRiver || on a road corridor
//     treeDensity,     // 0..1
//     lifecycle,       // 'persistent' — worldgen features carry NO chunkKey,
//                      //   like lakes.js (footgun #5); the 3D port must register
//                      //   them so they survive host-chunk unload
//     groundY,         // reserved; always 0 (terrain is flat today)
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { setSessionSeed, getSessionSeed, quantize } from '../rng.js';
import { CONFIG } from './constants.js';
import { nearestHeart, heartsInBounds, influenceFrom } from './hearts.js';
import { lakeAt, lakesInBounds } from './water.js';
import { nearestRoad, roadsInBounds } from './roads.js';
import { roleTier, footprintFor } from './roles.js';
import { treeDensity } from './density.js';

// Seed routing — the ONE door. Sandbox + game both go through this.
export function setSeed(seedInput) { return setSessionSeed(seedInput); }
export function getSeed() { return getSessionSeed(); }

export function queryPoint(x, z) {
  const qx = quantize(x), qz = quantize(z);
  const { heart, dist } = nearestHeart(qx, qz);
  const tier = roleTier(heart, dist);
  const road = nearestRoad(qx, qz);
  const inLake = lakeAt(qx, qz);
  const onRiver = false;   // river layer cut (Q4) — contract slot kept
  const bridge = false;
  // Face the nearest road if one is reasonably near (the off-road anchor that
  // fixes stages-on-roads); null in deep outskirts with no road in range.
  const facing = road.dist < CONFIG.HEART_CELL ? road.dirAngle : null;
  return {
    x: qx, z: qz,
    heart,
    heartDist: dist,
    heartInfluence: influenceFrom(heart, dist),
    roleTier: tier,
    onRoad: road.onRoad,
    roadTier: road.tier,
    facing,
    footprint: footprintFor(tier),
    inLake,
    onRiver,
    bridge,
    noBuild: inLake || onRiver || road.onRoad,
    treeDensity: treeDensity(qx, qz),
    lifecycle: 'persistent',
    groundY: 0,
  };
}

// Discrete features intersecting a rectangle, for the sandbox to draw features
// AS features (dots / polylines / polygons) — reserve per-pixel queryPoint
// sampling for the density field only (CG2.6). bounds = {minX,minZ,maxX,maxZ}.
export function queryRegion(bounds) {
  const { minX, minZ, maxX, maxZ } = bounds;
  return {
    bounds,
    hearts: heartsInBounds(minX, minZ, maxX, maxZ),
    lakes: lakesInBounds(minX, minZ, maxX, maxZ),
    roads: roadsInBounds(minX, minZ, maxX, maxZ),
  };
}
