// Roads — arterials connecting hearts (deliberation CG3 / GATE 2).
//
// An arterial is one deterministic, pair-hash-seeded meander computed END-TO-END
// from its two heart endpoints. Because the whole curve is owned by the
// unordered pair (not split into per-chunk halves), there is NO seam-kink
// problem — anyone who queries the segment derives the identical polyline. The
// edge set is the symmetric union of each heart's K-nearest neighbors, capped at
// ROAD_MAX_EDGE_CELLS, computed within the DERIVED road window (proven by the
// negative-control check in selftest). Collectors + footpaths are parked (Q2).
//
// Reads CONFIG.* per-call. Endpoints/control points QUANTIZED to integers.

import { quantize, pairRng } from '../rng.js';
import { CONFIG, SALT, roadNeighborhoodCells } from './constants.js';
import { heartInCell } from './hearts.js';
import { lakeAt, lakeContaining } from './water.js';

function lexLess(a, b) { return a.cx < b.cx || (a.cx === b.cx && a.cz < b.cz); }
function edgeKey(a, b) {
  return lexLess(a, b) ? `${a.cx},${a.cz}|${b.cx},${b.cz}` : `${b.cx},${b.cz}|${a.cx},${a.cz}`;
}

// A heart's K nearest neighbor hearts within the road window, edges capped at
// ROAD_MAX_EDGE_CELLS. Candidates sorted by a total order (distance, then cell
// id) so the "first K" cut never depends on iteration order.
export function neighborsOf(heart, windowCells = roadNeighborhoodCells()) {
  const cell = CONFIG.HEART_CELL;
  const maxLen = CONFIG.ROAD_MAX_EDGE_CELLS * cell;
  const maxLenSq = maxLen * maxLen;
  const cands = [];
  for (let dcz = -windowCells; dcz <= windowCells; dcz++) {
    for (let dcx = -windowCells; dcx <= windowCells; dcx++) {
      if (dcx === 0 && dcz === 0) continue;
      const h = heartInCell(heart.cx + dcx, heart.cz + dcz);
      if (!h) continue;
      const dx = h.x - heart.x, dz = h.z - heart.z, sq = dx * dx + dz * dz;
      if (sq > maxLenSq) continue;
      cands.push({ h, sq });
    }
  }
  cands.sort((a, b) => a.sq - b.sq || (a.h.cx - b.h.cx) || (a.h.cz - b.h.cz));
  return cands.slice(0, CONFIG.ROAD_MAX_NEIGHBORS).map(c => c.h);
}

// Where the road to a heart lands. A dry heart uses its center. A heart in a
// lake gets a dry shore "landing" on the side FACING the connecting neighbor —
// so the road approaches from that neighbor's side and never has to cross the
// water (which fixes lakeside hearts whose neighbors are across the lake, not
// just the near-shore ones). Deterministic: walk from the heart toward the
// neighbor until we exit the water, then add a dry margin; quantized.
export function landingPoint(h, towardX, towardZ) {
  if (!lakeAt(h.x, h.z)) return { x: h.x, z: h.z };
  let dx = towardX - h.x, dz = towardZ - h.z;
  let len = Math.hypot(dx, dz);
  if (len < 1) { dx = 1; dz = 0; len = 1; }   // neighbor ~coincident → arbitrary dir
  const ux = dx / len, uz = dz / len;
  let r = 0;
  for (let i = 0; i < 40; i++) {               // walk toward the neighbor until dry
    r += 20;
    if (!lakeAt(quantize(h.x + ux * r), quantize(h.z + uz * r))) break;
  }
  return { x: quantize(h.x + ux * (r + 25)), z: quantize(h.z + uz * (r + 25)) };
}

// Back-compat single anchor (toward nearest shore) — kept for callers that want
// a heart's generic road point; arterials use the directional landingPoint.
export function roadAnchor(h) {
  const lake = lakeAt(h.x, h.z) && lakeContaining(h.x, h.z);
  return lake ? landingPoint(h, 2 * h.x - lake.x, 2 * h.z - lake.z) : { x: h.x, z: h.z };
}

// The meander polyline for the arterial between two hearts (pair-seeded). Each
// endpoint is that heart's landing on the shore facing the OTHER heart, so the
// road approaches each lakeside heart from the correct side. Seed is the
// heart-cell pair so the curve is stable.
export function arterialPolyline(a, b) {
  const A = lexLess(a, b) ? a : b;          // canonical orientation
  const B = lexLess(a, b) ? b : a;
  const pa = landingPoint(A, B.x, B.z), pb = landingPoint(B, A.x, A.z);
  const rng = pairRng(A.cx, A.cz, B.cx, B.cz, SALT.roadPair);
  const dx = pb.x - pa.x, dz = pb.z - pa.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len, nz = dx / len;       // perpendicular unit
  const STEPS = 6;
  const pts = [{ x: pa.x, z: pa.z }];
  for (let i = 1; i < STEPS; i++) {
    const t = i / STEPS;
    const amp = (rng() * 2 - 1) * len * 0.12 * Math.sin(Math.PI * t);  // taper to 0 at ends
    pts.push({ x: quantize(pa.x + dx * t + nx * amp), z: quantize(pa.z + dz * t + nz * amp) });
  }
  pts.push({ x: pb.x, z: pb.z });
  return pts;
}

// The arterial polyline, or null if it would cross a lake. Bridges are cut this
// change, so a road that hits water simply doesn't exist (the graph routes via
// other hearts). Deterministic + symmetric (polyline canonicalizes A,B).
export function arterial(a, b) {
  const poly = arterialPolyline(a, b);
  for (const p of poly) if (lakeAt(p.x, p.z)) return null;
  return poly;
}

function distToSeg(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
  const c1 = vx * wx + vz * wz;
  if (c1 <= 0) return Math.hypot(px - ax, pz - az);
  const c2 = vx * vx + vz * vz;
  if (c2 <= c1) return Math.hypot(px - bx, pz - bz);
  const t = c1 / c2;
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}

// Gather the unique arterials whose endpoints lie within the road window of a
// point (so any segment that could pass near the point is covered).
function arterialsNear(x, z, windowCells = roadNeighborhoodCells()) {
  const cell = CONFIG.HEART_CELL;
  const qx = quantize(x), qz = quantize(z);
  const ccx = Math.floor(qx / cell), ccz = Math.floor(qz / cell);
  const seen = new Set();
  const out = [];
  for (let dcz = -windowCells; dcz <= windowCells; dcz++) {
    for (let dcx = -windowCells; dcx <= windowCells; dcx++) {
      const A = heartInCell(ccx + dcx, ccz + dcz);
      if (!A) continue;
      for (const B of neighborsOf(A)) {
        const k = edgeKey(A, B);
        if (seen.has(k)) continue;
        seen.add(k);
        const poly = arterial(A, B);
        if (poly) out.push(poly);
      }
    }
  }
  return out;
}

// Nearest arterial to a point: { onRoad, tier, dist, dirAngle }. dirAngle points
// from the point toward the nearest road (the off-road FACING hint — cosmetic,
// so float atan2 is fine; not hashed downstream).
export function nearestRoad(x, z, windowCells = roadNeighborhoodCells()) {
  const qx = quantize(x), qz = quantize(z);
  let best = Infinity, bx = 0, bz = 0;
  for (const poly of arterialsNear(qx, qz, windowCells)) {
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1];
      const d = distToSeg(qx, qz, a.x, a.z, b.x, b.z);
      if (d < best) {
        best = d;
        // closest point on this segment (for facing)
        const vx = b.x - a.x, vz = b.z - a.z, wx = qx - a.x, wz = qz - a.z;
        const c2 = vx * vx + vz * vz || 1;
        const t = Math.max(0, Math.min(1, (vx * wx + vz * wz) / c2));
        bx = a.x + t * vx; bz = a.z + t * vz;
      }
    }
  }
  const onRoad = best <= CONFIG.ROAD_WIDTH;
  return { onRoad, tier: onRoad ? 'arterial' : null, dist: best, dirAngle: Math.atan2(bz - qz, bx - qx) };
}

export function roadAt(x, z) {
  const r = nearestRoad(x, z);
  return { onRoad: r.onRoad, tier: r.tier };
}

// Arterial polylines intersecting a rectangle, for drawing (deduped).
export function roadsInBounds(minX, minZ, maxX, maxZ) {
  const cell = CONFIG.HEART_CELL;
  const pad = CONFIG.ROAD_MAX_EDGE_CELLS;   // an edge can reach this many cells out
  const c0x = Math.floor(minX / cell) - pad, c1x = Math.floor(maxX / cell) + pad;
  const c0z = Math.floor(minZ / cell) - pad, c1z = Math.floor(maxZ / cell) + pad;
  // Backstop: don't try to enumerate roads across an absurd span (zoomed way
  // out, a 7m arterial isn't even visible). Bounds the O(cells × neighborsOf) cost.
  if ((c1x - c0x) * (c1z - c0z) > 60000) return [];
  const seen = new Set();
  const out = [];
  for (let cz = c0z; cz <= c1z; cz++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      const A = heartInCell(cx, cz);
      if (!A) continue;
      for (const B of neighborsOf(A)) {
        const k = edgeKey(A, B);
        if (seen.has(k)) continue;
        seen.add(k);
        const poly = arterial(A, B);
        if (poly) out.push({ tier: 'arterial', points: poly });
      }
    }
  }
  return out;
}
