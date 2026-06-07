// Festival POI layer — the deterministic, render-agnostic LAYOUT of a heart's
// festival: where the stage / arch / food courts / vendor rows / bubble vendor /
// drum circle / porta-banks land relative to the heart and its approach roads,
// plus the camp villages out in the districts. Pure DATA (no `three`, no
// `models/*`); chunks.js maps each descriptor's `kind` → buildX() → registry.add.
// (deliberation 002 / design.md "Festival Layout Redesign" D-K..D-Q.)
//
// ── Why this exists ──────────────────────────────────────────────────────────
// Group D placed the right prop KINDS but per-point-random — confetti, no
// clustering. This re-anchors the TUNED legacy clustering rules (food-truck ring,
// vendor double-row, 12–20-site camp village, lakeside camp ring) off the chunk
// grid and onto worldgen FEATURES (a heart, one of its approach roads, a district
// cell). The camp_village took three framings to get right (CHANGELOG 2026-05-28)
// precisely because the chunk grid was always the wrong anchor — the packing RULE
// was good. Port the rules; re-anchor them.
//
// ── Determinism (footgun #4 / R17–R20) ───────────────────────────────────────
//  - festivalPlan(heart) is MEMOIZED, gated on (seed, epoch) — mirrors the
//    hearts.js / roads.js cache pattern so live sliders invalidate it and a static
//    seed stays fully cached. It takes ONLY the heart (never a chunk window), so a
//    cluster is seeded off its OWNING heart and the per-chunk filter only *selects*
//    from the plan — that closes the window-invariance class (R-windowinvariance).
//  - One rng stream per heart: cellRng(heart.cx, heart.cz, SALT.poiLayout),
//    consumed in a FIXED order. Camp villages use a separate coarse-grid stream
//    (SALT.poiVillage). NEVER reorder a draw — that re-rolls existing layouts.
//  - Each descriptor carries a `clusterSeed` (a stable per-cluster integer). The
//    BUILD half (chunks.js) derives ALL its model variation from `clusterSeed`,
//    NOT `ctx.rng`, so a change in the descriptor-list length never desyncs the
//    chunk's other ctx.rng consumers (R19).
//  - EVERY stored coordinate is quantized; the primary-road pick is a stable
//    INTEGER-key sort, never a raw-float bearing compare (R20). Bearings feed only
//    cos/sin into a position that is then quantized, so cross-engine atan2 noise is
//    absorbed below the integer-meter grid.

import { cellRng, quantize, worldHash } from '../rng.js';
import { CONFIG, SALT, worldgenEpoch } from './constants.js';
import { getSessionSeed } from '../rng.js';
import { queryPoint } from './index.js';
import { approachRoadsOf } from './roads.js';

// Max distance a heart's cluster center can sit from the heart center. Courts /
// vendor rows / the arch stay near (<=120 m, on the approach roads); the DRUM
// CIRCLE is the far one — it wants a treed spot, and treeDensity is zero inside a
// heart's core (density.js), so for a MAJOR (core 350 m) the nearest treed pocket
// is past the core. We bound the drum to core + DRUM_BAND, so the furthest any
// cluster reaches is maxCore(350) + DRUM_BAND. placement.js enumerates owning
// hearts by EXPANDING the chunk AABB by MAX_POI_REACH, so a cluster centered in a
// chunk is guaranteed to enumerate its heart regardless of HEART_CELL (R16).
const DRUM_BAND = 130;
export const MAX_POI_REACH = 350 + DRUM_BAND;   // 480: major core + drum band

// Footprint (clear-radius, m) hint per cluster kind — for the build half's
// spacing + the map-sandbox overlay. The build side registers each prop with the
// model's real footprint; this is the cluster envelope.
const KIND_FOOTPRINT = {
  main_stage: 11, side_stage: 8, arch: 6, food_court: 16, vendor_row: 12,
  bubble_vendor: 3, drum_circle: 6, porta_bank: 3, camp_village: 32,
};

// Camp-village coarse grid (independent of hearts — the "back of the festival").
const VILLAGE_CELL = 240;
const VILLAGE_PROB = 0.25;   // a discovery, not a carpet (parked feel-tunable)

// worldgen `facing` (atan2(Δz,Δx) toward the road) → three.js Y-rotation turning a
// model's local +Z (its "front") toward the road. yaw = π/2 − facing (a group at
// yaw θ maps +Z to world (sinθ,cosθ); set = (cos f, sin f)). Random fallback when
// no road is near.
function roadFacingYaw(facing, rng) {
  if (facing == null) return rng() * Math.PI * 2;
  return Math.PI / 2 - facing;
}

// A stable per-cluster seed so the build half's model variation doesn't ride
// ctx.rng draw order (R19).
function clusterSeed(heart, idx) {
  return worldHash(heart.cx * 2 + idx, heart.cz * 3 + idx * 7, SALT.poiLayout) >>> 0;
}

function desc(kind, x, z, yaw, role, rank, anchor, seed) {
  return { kind, x: quantize(x), z: quantize(z), yaw, footprint: KIND_FOOTPRINT[kind] || 4, role, rank, anchor, clusterSeed: seed };
}

// Walk `dist` meters from the heart's end (oriented[0]) along an approach-road
// polyline. Returns the quantized point + the local tangent bearing (pointing
// outward, away from the heart). Clamps to the polyline length.
function walkOriented(oriented, dist) {
  let acc = 0;
  for (let i = 0; i < oriented.length - 1; i++) {
    const a = oriented[i], b = oriented[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.z - a.z) || 1e-6;
    if (acc + segLen >= dist) {
      const t = (dist - acc) / segLen;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, bearing: Math.atan2(b.z - a.z, b.x - a.x) };
    }
    acc += segLen;
  }
  const a = oriented[oriented.length - 2], b = oriented[oriented.length - 1];
  return { x: b.x, z: b.z, bearing: Math.atan2(b.z - a.z, b.x - a.x) };
}

// Offset perpendicular to a bearing by `dist` on the given side (+1 / −1).
function perpOff(x, z, bearing, dist, side) {
  const px = -Math.sin(bearing) * side, pz = Math.cos(bearing) * side;
  return { x: x + px * dist, z: z + pz * dist };
}

// Nudge a point off `noBuild` (worldgen road corridor / lake). Tries the point,
// then a deterministic ring. Returns {x,z} | null (nowhere nearby buildable).
function nudgeOff(x, z, rng) {
  if (!queryPoint(x, z).noBuild) return { x, z };
  const baseA = rng() * Math.PI * 2;
  for (let r = 10; r <= 28; r += 9) {
    for (let k = 0; k < 6; k++) {
      const a = baseA + (k / 6) * Math.PI * 2;
      const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
      if (!queryPoint(nx, nz).noBuild) return { x: nx, z: nz };
    }
  }
  return null;
}

// A quiet off-road spot just past the heart's core (for a drum circle — a
// destination, not the main drag), preferring a treed pocket. BOUNDED to
// core + DRUM_BAND so it stays within MAX_POI_REACH (so its owning chunk always
// enumerates this heart — R16). Deterministic: tries treed off-road spots first,
// then falls back to the first off-road spot found (so a major in open country
// still gets its drum circle rather than dropping it).
function treedDistrictSpot(heart, rng) {
  const r0 = heart.core + 15;
  const r1 = Math.min(heart.core + DRUM_BAND, heart.district * 0.7);
  let fallback = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const a = rng() * Math.PI * 2;
    const r = r0 + rng() * Math.max(0, r1 - r0);
    const x = heart.x + Math.cos(a) * r, z = heart.z + Math.sin(a) * r;
    const qp = queryPoint(x, z);
    if (qp.noBuild) continue;
    if (!fallback) fallback = { x, z };       // first buildable spot, in case nothing is treed
    if (qp.treeDensity >= 0.25) return { x, z };
  }
  return fallback;
}

// ── Per-heart festival plan (memoized, gated on (seed, epoch)) ───────────────
const _planCache = new Map();
let _planGate = '';
function planGate() {
  const g = getSessionSeed() + ':' + worldgenEpoch();
  if (g !== _planGate) { _planCache.clear(); _planGate = g; }
}

export function festivalPlan(heart) {
  if (!heart) return [];
  planGate();
  if (_planCache.size > 4000) _planCache.clear();   // bound long-pan growth
  const key = heart.cx + ',' + heart.cz;
  const hit = _planCache.get(key);
  if (hit) return hit;
  const plan = _computePlan(heart);
  _planCache.set(key, plan);
  return plan;
}

function _computePlan(heart) {
  const rng = cellRng(heart.cx, heart.cz, SALT.poiLayout);
  const major = heart.rank === 'major';
  const out = [];
  let idx = 0;

  // Approach roads, sorted by a STABLE INTEGER key so "primary" is engine-stable
  // (R20): longest first, then neighbor cell index. roads[0] = the entrance road.
  const roads = approachRoadsOf(heart)
    .sort((a, b) => b.lenQ - a.lenQ || a.neighbor.cx - b.neighbor.cx || a.neighbor.cz - b.neighbor.cz);

  // Attach a porta-bank just off a cluster (tucked aside, doors faced via yaw).
  const addPotty = (x, z, parentYaw) => {
    const a = rng() * Math.PI * 2;
    const spot = nudgeOff(x + Math.cos(a) * 9, z + Math.sin(a) * 9, rng);
    if (spot) out.push(desc('porta_bank', spot.x, spot.z, parentYaw, 'core', heart.rank, false, clusterSeed(heart, idx)));
    idx++;
  };

  // 1. STAGE at the heart center, nudged off road/water, facing the nearest road.
  const stageSpot = nudgeOff(heart.x, heart.z, rng) || { x: heart.x, z: heart.z };
  const stageYaw = roadFacingYaw(queryPoint(stageSpot.x, stageSpot.z).facing, rng);
  out.push(desc(major ? 'main_stage' : 'side_stage', stageSpot.x, stageSpot.z, stageYaw, 'core', heart.rank, true, clusterSeed(heart, idx++)));
  addPotty(stageSpot.x, stageSpot.z, stageYaw);

  // 2. ENTRANCE ARCH + string lights on the primary approach road, out toward it,
  //    facing back at the stage (the "you've arrived" gateway).
  if (roads.length) {
    const p = walkOriented(roads[0].oriented, major ? 30 : 22);
    const spot = nudgeOff(p.x, p.z, rng);
    if (spot) {
      const yawToStage = Math.PI / 2 - Math.atan2(stageSpot.z - spot.z, stageSpot.x - spot.x);
      out.push(desc('arch', spot.x, spot.z, yawToStage, 'core', heart.rank, true, clusterSeed(heart, idx)));
    }
    idx++;
  }

  // 3. FOOD COURTS along the longest roads (the food street); sugar shacks live
  //    ONLY inside these (the build half). Offset off the road corridor.
  const courtN = Math.min(roads.length, major ? 2 : 1);
  for (let i = 0; i < courtN; i++) {
    const rd = roads[i];
    const dist = Math.min(MAX_POI_REACH, (rd.lenQ * 0.42) | 0, (major ? 72 : 46) + rng() * 28);
    const p = walkOriented(rd.oriented, dist);
    const side = rng() < 0.5 ? 1 : -1;
    const o = perpOff(p.x, p.z, p.bearing, CONFIG.ROAD_WIDTH / 2 + 16, side);
    const spot = nudgeOff(o.x, o.z, rng);
    if (spot) {
      const yaw = roadFacingYaw(queryPoint(spot.x, spot.z).facing, rng);
      out.push(desc('food_court', spot.x, spot.z, yaw, 'core', heart.rank, false, clusterSeed(heart, idx)));
      addPotty(spot.x, spot.z, yaw);
    }
    idx++;
  }

  // 4. VENDOR ROWS parallel to a road (the market street).
  const rowN = Math.min(roads.length, major ? 2 : 1);
  for (let i = 0; i < rowN; i++) {
    const rd = roads[i];
    const dist = Math.min(MAX_POI_REACH, (rd.lenQ * 0.3) | 0, (major ? 48 : 36) + rng() * 18);
    const p = walkOriented(rd.oriented, dist);
    const side = rng() < 0.5 ? 1 : -1;
    const o = perpOff(p.x, p.z, p.bearing, CONFIG.ROAD_WIDTH / 2 + 10, side);
    const spot = nudgeOff(o.x, o.z, rng);
    // Row runs PARALLEL to the road → yaw aligns to the road tangent (π/2 − bearing).
    if (spot) out.push(desc('vendor_row', spot.x, spot.z, Math.PI / 2 - p.bearing, 'core', heart.rank, false, clusterSeed(heart, idx)));
    idx++;
  }

  // 5. BUBBLE VENDOR — one guaranteed refuel per heart (a quieter road, or near center).
  {
    let spot = null, yaw = rng() * Math.PI * 2;
    if (roads.length) {
      const rd = roads[roads.length - 1];
      const p = walkOriented(rd.oriented, Math.min(MAX_POI_REACH, (major ? 55 : 40) + rng() * 20));
      const side = rng() < 0.5 ? 1 : -1;
      const o = perpOff(p.x, p.z, p.bearing, CONFIG.ROAD_WIDTH / 2 + 5, side);
      spot = nudgeOff(o.x, o.z, rng);
      if (spot) yaw = roadFacingYaw(queryPoint(spot.x, spot.z).facing, rng);
    }
    if (!spot) spot = nudgeOff(heart.x + (rng() - 0.5) * 50, heart.z + (rng() - 0.5) * 50, rng);
    if (spot) out.push(desc('bubble_vendor', spot.x, spot.z, yaw, 'core', heart.rank, false, clusterSeed(heart, idx)));
    idx++;
  }

  // 6. DRUM CIRCLE — a quiet treed destination in the district ring (off the drag).
  const drumN = major ? 1 : (rng() < 0.5 ? 1 : 0);
  for (let k = 0; k < drumN; k++) {
    const spot = treedDistrictSpot(heart, rng);
    if (spot) out.push(desc('drum_circle', spot.x, spot.z, rng() * Math.PI * 2, 'district', heart.rank, false, clusterSeed(heart, idx)));
    idx++;
  }

  return out;
}

// ── Camp villages — the "back of the festival" packed clusters (independent of
//    hearts; a coarse deterministic grid, district/outskirts only) ─────────────
export function campVillagesNear(bounds) {
  const { minX, minZ, maxX, maxZ } = bounds;
  const c0x = Math.floor(minX / VILLAGE_CELL) - 1, c1x = Math.floor(maxX / VILLAGE_CELL) + 1;
  const c0z = Math.floor(minZ / VILLAGE_CELL) - 1, c1z = Math.floor(maxZ / VILLAGE_CELL) + 1;
  const out = [];
  for (let cz = c0z; cz <= c1z; cz++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      const rng = cellRng(cx, cz, SALT.poiVillage);
      if (rng() > VILLAGE_PROB) continue;
      const jx = (rng() - 0.5) * VILLAGE_CELL * 0.6, jz = (rng() - 0.5) * VILLAGE_CELL * 0.6;
      const x = quantize((cx + 0.5) * VILLAGE_CELL + jx), z = quantize((cz + 0.5) * VILLAGE_CELL + jz);
      const qp = queryPoint(x, z);
      if (qp.noBuild || qp.inLake) continue;       // off road + off water
      if (qp.roleTier === 'core') continue;          // villages are back-of-festival, not the core
      out.push({
        kind: 'camp_village', x, z, yaw: 0, footprint: KIND_FOOTPRINT.camp_village,
        role: qp.roleTier, rank: qp.heart ? qp.heart.rank : 'minor', anchor: false,
        clusterSeed: (worldHash(cx, cz, SALT.poiVillage) >>> 0),
      });
    }
  }
  return out;
}

// Convenience for the map-sandbox overlay + any "everything in view" consumer:
// every heart's festival plan (clipped to bounds) plus the camp villages.
// (The per-chunk game path uses festivalPlan + campVillagesNear directly so it
// can filter by cluster-center ownership — see placement.js.)
export function poisInBounds(bounds, hearts) {
  const out = [];
  for (const h of (hearts || [])) {
    for (const p of festivalPlan(h)) {
      if (p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ) out.push(p);
    }
  }
  for (const v of campVillagesNear(bounds)) out.push(v);
  return out;
}
