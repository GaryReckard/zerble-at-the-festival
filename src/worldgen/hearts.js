// Hearts — the central-place anchors (deliberation CG2). Rare, rank-weighted
// festival centers on a coarse macrocell grid. Everything downstream derives
// its role from the nearest heart, so sparsity is the space between hearts and
// intentionality is everything orienting to its center.
//
// Determinism: candidate positions are QUANTIZED to integer meters, so the
// nearest-heart search compares exact integer squared distances (no float
// ambiguity), with a (cx,cz) lexicographic tiebreak — never iteration order.
// minor/major ranks only; the mega rank is cut from this change (kept in spec).
//
// Reads CONFIG.* per-call so the sandbox's live sliders take effect instantly.

import { cellRng, quantize, getSessionSeed } from '../rng.js';
import { CONFIG, SALT, heartNeighborhoodCells, worldgenEpoch } from './constants.js';

// Per-cell memo, gated on (seed, epoch). heartInCell is hit a LOT (window scans,
// road neighbor scans, density field) — so cache it.
const _cache = new Map();
let _gate = '';
function gate() { const g = getSessionSeed() + ':' + worldgenEpoch(); if (g !== _gate) { _cache.clear(); _gate = g; } }

// The heart hosted by macrocell (cx, cz), or null. Pure function of (cx, cz),
// the session seed, and CONFIG. Hearts may sit lakeside or even over water — a
// lakeside main stage is a feature (real LEAF did this). The per-point
// inLake/noBuild fields keep ACTUAL structures off the water; that placement
// detail is the 3D layer's job, not the substrate's.
export function heartInCell(cx, cz) {
  cx |= 0; cz |= 0;
  gate();
  if (_cache.size > 250000) _cache.clear();   // bound growth on long pans at one seed
  const key = cx + ',' + cz;
  if (_cache.has(key)) return _cache.get(key);
  const v = _computeHeart(cx, cz);
  _cache.set(key, v);
  return v;
}

function _computeHeart(cx, cz) {
  const { HEART_CELL, HEART_JITTER, HEART_RANK, HEART_DOMAIN } = CONFIG;
  const rankRoll = cellRng(cx, cz, SALT.heartRank)();
  let rank;
  if (rankRoll < HEART_RANK.noneBelow) return null;
  else if (rankRoll < HEART_RANK.minorBelow) rank = 'minor';
  else rank = 'major';

  const jr = cellRng(cx, cz, SALT.heartJitter);
  const jx = (jr() * 2 - 1) * HEART_JITTER;
  const jz = (jr() * 2 - 1) * HEART_JITTER;
  const x = quantize((cx + 0.5 + jx) * HEART_CELL);
  const z = quantize((cz + 0.5 + jz) * HEART_CELL);
  const dom = HEART_DOMAIN[rank];
  return { cx, cz, x, z, rank, core: dom.core, district: dom.district };
}

// Nearest heart to a world point. windowCells override exists for the
// determinism harness (window-invariance + negative control). Returns
// { heart, dist } or { heart: null, dist: Infinity }.
export function nearestHeart(x, z, windowCells = heartNeighborhoodCells()) {
  const cell = CONFIG.HEART_CELL;
  const qx = quantize(x), qz = quantize(z);
  const ccx = Math.floor(qx / cell);
  const ccz = Math.floor(qz / cell);
  let best = null, bestSq = Infinity;
  for (let dcz = -windowCells; dcz <= windowCells; dcz++) {
    for (let dcx = -windowCells; dcx <= windowCells; dcx++) {
      const h = heartInCell(ccx + dcx, ccz + dcz);
      if (!h) continue;
      const dx = qx - h.x, dz = qz - h.z;
      const sq = dx * dx + dz * dz;   // exact integer
      if (sq < bestSq ||
          (sq === bestSq && best &&
            (h.cx < best.cx || (h.cx === best.cx && h.cz < best.cz)))) {
        bestSq = sq; best = h;
      }
    }
  }
  return { heart: best, dist: best ? Math.sqrt(bestSq) : Infinity };
}

// All hearts whose center falls within a world-space rectangle — for the
// sandbox to draw hearts as dots without per-pixel queries. Pads by one cell so
// hearts jittered in from just outside the rect aren't clipped.
export function heartsInBounds(minX, minZ, maxX, maxZ) {
  const cell = CONFIG.HEART_CELL;
  const c0x = Math.floor(minX / cell) - 1;
  const c1x = Math.floor(maxX / cell) + 1;
  const c0z = Math.floor(minZ / cell) - 1;
  const c1z = Math.floor(maxZ / cell) + 1;
  if ((c1x - c0x) * (c1z - c0z) > 60000) return [];   // too far out to draw dots
  const out = [];
  for (let cz = c0z; cz <= c1z; cz++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      const h = heartInCell(cx, cz);
      if (h) out.push(h);
    }
  }
  return out;
}

// Continuous 0..1 influence of the nearest heart (peaks at its center, 0 at the
// district edge). Carried in the tuple as cheap insurance for the future 3D
// arrival-ramp + map-view shading (CG5.7) — a read, not a re-derivation.
export function influenceFrom(heart, dist) {
  if (!heart) return 0;
  const v = 1 - dist / heart.district;
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

// The nearest MAJOR-rank heart to a world point — for spawn relocation (D2.2 /
// D-O). Majors are ~4% of cells (HEART_RANK), so the nearest can sit several
// cells out — well past `nearestHeart`'s district-sized window — which re-opens
// the window-truncation class (R17). So this is a BOUNDED, fully-deterministic
// Chebyshev-ring scan: expand ring by ring; once a major is found, scan two more
// rings (a major in a farther cell ring can be Euclidean-closer in another
// direction once jitter is applied) then stop. Same point → same heart, every
// call (exact-integer squared-distance + (cx,cz) lexicographic tiebreak, never
// iteration order). Returns the heart | null (no major within maxRings).
// `accept` (optional) filters candidate majors — the spawn picker passes a
// "dry" predicate so the game never opens on a stage in a lake. Default null
// (no filter) keeps the selftest T6 invariance + the golden untouched, and
// keeps hearts.js water-agnostic (the predicate is supplied by the caller, so
// no hearts→water import cycle).
export function nearestMajorHeart(x, z, maxRings = 28, accept = null) {
  const cell = CONFIG.HEART_CELL;
  const qx = quantize(x), qz = quantize(z);
  const ccx = Math.floor(qx / cell), ccz = Math.floor(qz / cell);
  let best = null, bestSq = Infinity, stopRing = maxRings;
  for (let ring = 0; ring <= stopRing; ring++) {
    for (let dcz = -ring; dcz <= ring; dcz++) {
      for (let dcx = -ring; dcx <= ring; dcx++) {
        if (Math.max(Math.abs(dcx), Math.abs(dcz)) !== ring) continue;   // shell only
        const h = heartInCell(ccx + dcx, ccz + dcz);
        if (!h || h.rank !== 'major') continue;
        if (accept && !accept(h)) continue;
        const dx = qx - h.x, dz = qz - h.z, sq = dx * dx + dz * dz;
        if (sq < bestSq ||
            (sq === bestSq && best &&
              (h.cx < best.cx || (h.cx === best.cx && h.cz < best.cz)))) {
          bestSq = sq; best = h;
        }
      }
    }
    if (best && stopRing === maxRings) stopRing = Math.min(maxRings, ring + 2);
  }
  return best;
}
