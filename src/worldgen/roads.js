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

import { quantize, pairRng, cellRng, getSessionSeed } from '../rng.js';
import { CONFIG, SALT, roadNeighborhoodCells, worldgenEpoch } from './constants.js';
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

// The SINGLE shore point that represents a heart sitting in a lake. ALL of that
// heart's roads converge here (Gary 2026-06-06) — one proxy on the shore, not a
// scatter of per-neighbor landings that each ended at a different edge point.
// Deterministic: push the heart radially out from its lake's center to just past
// the shore, so the proxy lands on "its" side of the water. If the heart sits
// ~dead-centre (radial direction undefined) fall back to a hash-stable angle so
// the proxy is still reproducible. A dry heart is its own proxy.
export function heartProxy(h) {
  const lake = lakeContaining(h.x, h.z);
  if (!lake) return { x: h.x, z: h.z };
  let dx = h.x - lake.x, dz = h.z - lake.z;
  let len = Math.hypot(dx, dz);
  if (len < 1) {                               // heart ~at lake centre → stable angle
    const ang = cellRng(h.cx, h.cz, SALT.roadProxy)() * Math.PI * 2;
    dx = Math.cos(ang); dz = Math.sin(ang); len = 1;
  }
  const ux = dx / len, uz = dz / len;
  let r = 0;
  for (let i = 0; i < 80; i++) {               // walk outward until dry
    if (!lakeAt(quantize(h.x + ux * r), quantize(h.z + uz * r))) break;
    r += 15;
  }
  return { x: quantize(h.x + ux * (r + 22)), z: quantize(h.z + uz * (r + 22)) };
}

// Back-compat single anchor — now identical to the convergence proxy.
export function roadAnchor(h) { return heartProxy(h); }

// True if any point along a polyline (sampled densely BETWEEN vertices too, so a
// straight run can't skip over a small lake) lies in open water. Quantized.
function crossesWater(poly) {
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 18));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (lakeAt(quantize(a.x + (b.x - a.x) * t), quantize(a.z + (b.z - a.z) * t))) return true;
    }
  }
  return false;
}

// The lake blocking a straight chord (the lake containing the first in-water
// sample). Deterministic — the chord and lakes are pure functions of the seed.
function blockingLake(pa, pb) {
  const n = Math.max(1, Math.ceil(Math.hypot(pb.x - pa.x, pb.z - pa.z) / 15));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const l = lakeContaining(quantize(pa.x + (pb.x - pa.x) * t), quantize(pa.z + (pb.z - pa.z) * t));
    if (l) return l;
  }
  return null;
}

// A detour polyline pa→pb that rides an arc OUTSIDE a lake (radius maxR +
// clearance is past every outline vertex, so the arc itself is always dry). dir
// = +1 sweeps CCW from pa's angle to pb's, -1 sweeps CW. The endpoints are on
// the dry shore already, so the short radial pa→arc and arc→pb hops stay clear.
function arcAround(pa, pb, lake, dir) {
  const cx = lake.x, cz = lake.z, R = lake.maxR + CONFIG.ROAD_LAKE_DETOUR;
  const TWO = Math.PI * 2;
  const aP = Math.atan2(pa.z - cz, pa.x - cx);
  const aQ = Math.atan2(pb.z - cz, pb.x - cx);
  let ccw = (aQ - aP) % TWO; if (ccw < 0) ccw += TWO;     // [0, 2π)
  const sweep = dir > 0 ? ccw : ccw - TWO;                 // CCW positive / CW negative
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / 0.3));
  const pts = [{ x: pa.x, z: pa.z }];
  for (let i = 1; i < steps; i++) {
    const a = aP + sweep * (i / steps);
    pts.push({ x: quantize(cx + Math.cos(a) * R), z: quantize(cz + Math.sin(a) * R) });
  }
  pts.push({ x: pb.x, z: pb.z });
  return pts;
}

// The meander polyline for the arterial between two hearts (pair-seeded), drawn
// between each heart's single shore proxy. Seed is the heart-cell pair so the
// curve is stable and order-independent.
export function arterialPolyline(a, b) {
  const A = lexLess(a, b) ? a : b;          // canonical orientation
  const B = lexLess(a, b) ? b : a;
  const pa = heartProxy(A), pb = heartProxy(B);
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

// The arterial between two CANONICAL (A ≤ B) hearts. The straight pair-seeded
// meander if it stays dry; otherwise an around-the-lake detour (so lakeside
// hearts connect to far-side neighbors, and two hearts on opposite shores get a
// road instead of a gap — Gary 2026-06-06). Bridges are still cut, so if even
// the detour can't find a dry path the road simply doesn't exist (the graph
// routes via other hearts).
function _computeArterial(A, B) {
  const straight = arterialPolyline(A, B);
  if (!crossesWater(straight)) return straight;

  // The meander can bulge into a lake-heart's OWN shore near its proxy even when
  // the direct proxy→proxy line is dry; in that case just drop the meander.
  const pa = heartProxy(A), pb = heartProxy(B);
  const direct = [{ x: pa.x, z: pa.z }, { x: pb.x, z: pb.z }];
  if (!crossesWater(direct)) return direct;

  // The direct line genuinely crosses a lake → detour around it.
  const lake = blockingLake(pa, pb);
  if (!lake) return null;
  // Prefer the shorter way around; if the endpoints are ~opposite (both ways
  // equal) break the tie on the pair hash so both endpoints agree on the side.
  const TWO = Math.PI * 2;
  const aP = Math.atan2(pa.z - lake.z, pa.x - lake.x);
  const aQ = Math.atan2(pb.z - lake.z, pb.x - lake.x);
  let ccw = (aQ - aP) % TWO; if (ccw < 0) ccw += TWO;
  const dir = Math.abs(ccw - Math.PI) < 0.05
    ? (pairRng(A.cx, A.cz, B.cx, B.cz, SALT.roadSide)() < 0.5 ? 1 : -1)
    : (ccw < Math.PI ? 1 : -1);
  let detour = arcAround(pa, pb, lake, dir);
  if (crossesWater(detour)) detour = arcAround(pa, pb, lake, -dir);   // try the other side
  return crossesWater(detour) ? null : detour;
}

// Memoized arterial (polyline | null), symmetric on the A,B pair. The dense
// water-crossing tests + around-the-lake search make _computeArterial ~10× the
// cost of the old vertex-only check, and both roadsInBounds (per redraw) and
// nearestRoad (per hover) re-request the same edges — so cache the pure result,
// gated on (seed, epoch) exactly like hearts.js/water.js (sliders bump epoch).
const _arterialCache = new Map();
let _arterialGate = '';
export function arterial(a, b) {
  const g = getSessionSeed() + ':' + worldgenEpoch();
  if (g !== _arterialGate) { _arterialCache.clear(); _arterialGate = g; }
  const A = lexLess(a, b) ? a : b;
  const B = lexLess(a, b) ? b : a;
  const key = edgeKey(A, B);
  if (_arterialCache.has(key)) return _arterialCache.get(key);
  if (_arterialCache.size > 200000) _arterialCache.clear();   // bound long-pan growth
  const v = _computeArterial(A, B);
  _arterialCache.set(key, v);
  return v;
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
