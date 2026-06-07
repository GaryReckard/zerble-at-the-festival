// Water — lakes (deliberation CG3.1). Macrocell, jittered, deterministic, with
// elongated / lobed (peanut, oval, kidney) outlines — not just circles.
// Containment is point-in-polygon against the outline so the shapes are real.
//
// RIVERS ARE CUT from this change (Q4): river-around-heart avoidance can depend
// on a heart outside the local window, which would non-deterministically
// violate the spec's "rivers SHALL never pass through a heart core." The
// river-shaped contract fields (onRiver/bridge) stay as always-false stubs in
// index.js so the data contract is stable for the 3D follow-up that adds them.
//
// Determinism: center + every outline vertex are QUANTIZED to integer meters,
// so point-in-polygon runs on integers (stable on a single engine). The shaping
// uses sin/cos, so a vertex could land 1 m differently across JS engines — a
// cosmetic shoreline wobble, not an invariant violation; the 3D port can switch
// to an integer orientation test if it ever matters. Reads CONFIG.* per-call.

import { cellRng, quantize, getSessionSeed } from '../rng.js';
import { CONFIG, SALT, worldgenEpoch } from './constants.js';

// Per-cell memo (outline generation is ~36 sin/cos; lake checks hit it a lot).
// Gated on (seed, epoch) so live tuning + seed changes invalidate it.
const _cache = new Map();
let _gate = '';
function gate() { const g = getSessionSeed() + ':' + worldgenEpoch(); if (g !== _gate) { _cache.clear(); _gate = g; } }

export function lakeInCell(cx, cz) {
  cx |= 0; cz |= 0;
  gate();
  if (_cache.size > 250000) _cache.clear();   // bound growth on long pans at one seed
  const key = cx + ',' + cz;
  if (_cache.has(key)) return _cache.get(key);
  const v = _computeLake(cx, cz);
  _cache.set(key, v);
  return v;
}

function _computeLake(cx, cz) {
  const { LAKE_CELL, LAKE_PROB, LAKE_JITTER, LAKE_RADIUS, LAKE_ELONGATE, LAKE_CIRCLE_FRAC } = CONFIG;
  const r = cellRng(cx, cz, SALT.lakeCell);
  if (r() >= LAKE_PROB) return null;
  const jr = cellRng(cx, cz, SALT.lakeJitter);
  const jx = (jr() * 2 - 1) * LAKE_JITTER;
  const jz = (jr() * 2 - 1) * LAKE_JITTER;
  const x = quantize((cx + 0.5 + jx) * LAKE_CELL);
  const z = quantize((cz + 0.5 + jz) * LAKE_CELL);
  const baseR = LAKE_RADIUS.min + jr() * (LAKE_RADIUS.max - LAKE_RADIUS.min);

  // shape stream (separate salt so toggling shape doesn't move centers)
  const sr = cellRng(cx, cz, SALT.lakeShape);
  const circular = sr() < LAKE_CIRCLE_FRAC;
  const elong = circular ? 1 : (1.2 + sr() * (LAKE_ELONGATE - 1.2));
  const rot = sr() * Math.PI * 2;
  const major = baseR * Math.sqrt(elong);
  const minor = baseR / Math.sqrt(elong);
  // lobes: a strong 2-lobe pinches the waist (peanut); a 3-lobe adds a kidney
  // bulge. Circular lakes get only gentle jitter.
  const l2 = circular ? 0 : 0.16 + sr() * 0.22;   // peanut strength
  const l3 = circular ? 0 : sr() * 0.12;          // asymmetric bulge
  const p2 = sr() * Math.PI * 2, p3 = sr() * Math.PI * 2;
  const cosR = Math.cos(rot), sinR = Math.sin(rot);

  const N = 36;
  const outline = [];
  let maxR = 0;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    let ex = major * Math.cos(t), ez = minor * Math.sin(t);   // ellipse
    const lobe = 1 + l2 * Math.sin(2 * t + p2) + l3 * Math.sin(3 * t + p3)
      + (sr() * 2 - 1) * 0.04;                                // + fine jitter
    ex *= lobe; ez *= lobe;
    const wx = x + ex * cosR - ez * sinR;                     // rotate into world
    const wz = z + ex * sinR + ez * cosR;
    const vx = quantize(wx), vz = quantize(wz);
    outline.push({ x: vx, z: vz });
    const d = Math.hypot(vx - x, vz - z);
    if (d > maxR) maxR = d;
  }
  return { cx, cz, x, z, maxR: Math.ceil(maxR), outline, lifecycle: 'persistent' };
}

function pointInPoly(px, pz, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, zi = poly[i].z, xj = poly[j].x, zj = poly[j].z;
    if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) inside = !inside;
  }
  return inside;
}

// Nearest lake by CENTER distance (for "is water near, route roads around it").
export function nearestLake(x, z, windowCells = CONFIG.LAKE_NEIGHBORHOOD_CELLS) {
  const cell = CONFIG.LAKE_CELL;
  const qx = quantize(x), qz = quantize(z);
  const ccx = Math.floor(qx / cell), ccz = Math.floor(qz / cell);
  let best = null, bestSq = Infinity;
  for (let dcz = -windowCells; dcz <= windowCells; dcz++) {
    for (let dcx = -windowCells; dcx <= windowCells; dcx++) {
      const l = lakeInCell(ccx + dcx, ccz + dcz);
      if (!l) continue;
      const dx = qx - l.x, dz = qz - l.z, sq = dx * dx + dz * dz;
      if (sq < bestSq ||
          (sq === bestSq && best &&
            (l.cx < best.cx || (l.cx === best.cx && l.cz < best.cz)))) { bestSq = sq; best = l; }
    }
  }
  return { lake: best, dist: best ? Math.sqrt(bestSq) : Infinity };
}

// Inside ANY nearby lake's outline (bounding-circle reject, then polygon test).
export function lakeAt(x, z) {
  return !!lakeContaining(x, z);
}

// The lake whose outline contains (x,z), or null. Lets callers (road anchoring)
// reach the lake's center + outline to project a point out to the shore.
export function lakeContaining(x, z) {
  const cell = CONFIG.LAKE_CELL;
  const w = CONFIG.LAKE_NEIGHBORHOOD_CELLS;
  const qx = quantize(x), qz = quantize(z);
  const ccx = Math.floor(qx / cell), ccz = Math.floor(qz / cell);
  for (let dcz = -w; dcz <= w; dcz++) {
    for (let dcx = -w; dcx <= w; dcx++) {
      const l = lakeInCell(ccx + dcx, ccz + dcz);
      if (!l) continue;
      const dx = qx - l.x, dz = qz - l.z;
      if (dx * dx + dz * dz > l.maxR * l.maxR) continue;   // cheap reject
      if (pointInPoly(qx, qz, l.outline)) return l;
    }
  }
  return null;
}

// Lakes intersecting a rectangle, each with its drawable outline.
export function lakesInBounds(minX, minZ, maxX, maxZ) {
  const cell = CONFIG.LAKE_CELL;
  const c0x = Math.floor(minX / cell) - 1, c1x = Math.floor(maxX / cell) + 1;
  const c0z = Math.floor(minZ / cell) - 1, c1z = Math.floor(maxZ / cell) + 1;
  const out = [];
  for (let cz = c0z; cz <= c1z; cz++)
    for (let cx = c0x; cx <= c1x; cx++) {
      const l = lakeInCell(cx, cz);
      if (l) out.push(l);
    }
  return out;
}
