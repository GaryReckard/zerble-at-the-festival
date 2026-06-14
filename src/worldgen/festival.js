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
//  - ACCEPTED cosmetic cross-engine fork (R20, named for D2.7): `treedDistrictSpot`
//    branches on a raw `qp.treeDensity >= 0.25` (sin/cos noise, not hashed). Right at
//    the boundary a V8/JSC epsilon could pick a different drum-circle spot AND consume
//    a different rng-draw count — but the drum is the LAST consumer of this heart's
//    poiLayout stream (no sibling desync), its result is quantized, and any single
//    engine is fully reproducible. Same accepted class as the node-vs-browser golden
//    disparity + the 1m lake-shore wobble; it never regenerates a seeded world on one
//    engine. Left as-is deliberately rather than over-quantizing a cosmetic.

import { cellRng, quantize, worldHash, mulberry32 } from '../rng.js';
import { CONFIG, SALT, worldgenEpoch } from './constants.js';
import { FESTIVAL_TUNING, clusterShapes, clustersOverlap } from './tuning.js';
import { getSessionSeed } from '../rng.js';
import { queryPoint } from './index.js';
import { approachRoadsOf } from './roads.js';
import { heartsInBounds } from './hearts.js';
import { lakeAt } from './water.js';
import { treeDensity } from './density.js';

// Max distance a heart's cluster center can sit from the heart center. Courts /
// vendor rows / the arch stay near (on the approach roads); the DRUM CIRCLE is the
// far one — it wants a treed spot, and treeDensity is zero inside a heart's core
// (density.js), so the nearest treed pocket is past the core, bounded to
// core + DRUM_BAND. placement.js enumerates owning hearts by EXPANDING the chunk
// AABB by MAX_POI_REACH, so a cluster centered in a chunk is guaranteed to
// enumerate its heart regardless of HEART_CELL (R16).
//
// NOTE (deliberation 003, D3.4): the LIVE `major.core` is 100 (constants.js
// HEART_DOMAIN — a stale earlier comment here said "350"). 480 is therefore a
// GENEROUS over-bound (drum reaches ~core+130 ≈ 230, the drag clusters ~core+90
// ≈ 190) — safe, costs only a few extra per-chunk heart enumerations. ALL
// per-cluster SIZING (dancefloor depth, the front-axis ray-walk) reads the live
// `heart.core`, NEVER a literal 350. If `major.core` is ever tuned past ~350 via
// the sliders, revisit this bound (drum would exceed 480).
export const MAX_POI_REACH = 480;   // generous over-bound; see NOTE above (R16)
// DRUM_BAND (the drum's reach past core, default 130) is now tunable:
// FESTIVAL_TUNING.DRUM_BAND (tuning.js). MAX_POI_REACH stays a fixed structural
// over-bound (R16) — if DRUM_BAND is tuned past ~350 it could exceed it; revisit.

// ── Front-axis grammar (deliberation 003 — festival-layout-grammar.md) ───────
// A hub faces ONE computed direction F: the bisector of the WIDEST DRY GAP
// between its approach roads. Stage / dancefloor / sectors all key off F, so the
// dancefloor faces open ground BETWEEN roads — never down a road (A3) or at water.
// computeFrontAxis + dancefloorRect are PURE and read only `heart` +
// approachRoadsOf(heart) (window-invariant). The map-sandbox overlay and the
// (CG2) _computePlan rewrite call the SAME functions so they agree by construction.
//
// DETERMINISM (footgun #4 / R20): the WIDEST-gap SELECTION is an INTEGER compare,
// not a float argmax — road bearings bin to a fixed 256-slot angular grid, gap
// widths are integer bin differences, and the dry test is a coarse integer count
// of blocked probe points on quantize()d coordinates. A float argmax over
// atan2-derived widths could flip which gap is "widest" across V8/JSC and rotate
// the ENTIRE hub; the integer key cannot. The chosen bin is serialized into the
// stage descriptor (see _computePlan, CG2) so the POI golden + window-invariance
// test exercise it. Residual cross-engine class: Math.cos/sin of the chosen
// bin's bearing feed the dry-probe coordinates below the 1 m quantize grid — the
// same accepted single-engine-reproducible cosmetic class as the existing
// treeDensity/road-bearing forks, here gated to a coarse boolean so a flip needs
// a probe within ~1e-13 of a meter boundary AND exactly at the dry tolerance.
const ANGLE_BINS = 256;             // fixed angular grid for cross-engine-stable gap selection
const DRY_PROBES = 6;               // blocked-point samples along a candidate bisector
// Dancefloor depth/halfwidth bases are now tunable: FESTIVAL_TUNING
// .DANCEFLOOR_DEPTH_BASE (38) / .DANCEFLOOR_HALFWIDTH_BASE (17) (tuning.js).

function binAngle(bearing) {        // atan2 result (-π,π] → integer bin [0,ANGLE_BINS)
  let b = Math.round(bearing / (Math.PI * 2) * ANGLE_BINS) % ANGLE_BINS;
  return b < 0 ? b + ANGLE_BINS : b;
}
function binBearing(bin) { return (bin / ANGLE_BINS) * Math.PI * 2; }   // [0,2π)

// Stage scale is plan DATA (D3.3) so the dancefloor rect and the built model
// agree on size. Derived from the stage's clusterSeed (idx 0), matching
// buildStage's FIRST rng draw exactly. Both this and buildStage's scale draw
// (chunks.js:2319, inside buildStage at 2309) read the SAME
// FESTIVAL_TUNING.STAGE_SCALE_* (tuning.js) — formerly duplicated literals with
// a "keep in sync" note; the hoist makes them one source.
function stageScaleOf(heart) {
  const r = mulberry32(clusterSeed(heart, 0))();
  const T = FESTIVAL_TUNING;
  return heart.rank === 'major' ? T.STAGE_SCALE_MAJOR_BASE + r * T.STAGE_SCALE_MAJOR_SPAN
                                : T.STAGE_SCALE_MINOR_BASE + r * T.STAGE_SCALE_MINOR_SPAN;
}
function dancefloorDepth(heart) { return FESTIVAL_TUNING.DANCEFLOOR_DEPTH_BASE * stageScaleOf(heart); }

// Count probe points along a ray from the hub center that fall in WATER — the
// dancefloor must not open onto a lake (A3's "no road in front" is already
// satisfied by facing a GAP between roads, so the dry test only needs the lake
// check). Uses the cheap `lakeAt` (cell-scan + point-in-poly), NOT the heavy
// `queryPoint` (which runs nearestRoad ~215µs/call — calling it 6× per gap per
// heart was a per-heart ~10ms R7 blow-out). Integer result; coords quantize()d.
function blockedCountAlong(heart, bin, reach) {
  const dx = Math.cos(binBearing(bin)), dz = Math.sin(binBearing(bin));
  let blocked = 0;
  for (let i = 1; i <= DRY_PROBES; i++) {
    const r = (reach * i) / DRY_PROBES;
    if (lakeAt(quantize(heart.x + dx * r), quantize(heart.z + dz * r))) blocked++;
  }
  return blocked;
}

// The hub's FRONT AXIS F (the keystone). Returns the chosen bin + bearing + the
// per-gap detail (so the overlay can draw every gap + highlight the winner).
// PURE; integer-keyed selection: prefer DRY gaps (0 blocked probes), widest wins,
// tie → lowest bin. 0-road and 1-road fallbacks face the driest / opposite-the-road.
// Memoized per heart, gated on (seed,epoch) — _computePlan, dancefloorRectsNear,
// and the map-sandbox overlay all share one computation.
const _faCache = new Map();
export function computeFrontAxis(heart) {
  planGate();
  const ck = heart.cx + ',' + heart.cz;
  const cached = _faCache.get(ck);
  if (cached) return cached;
  const roads = approachRoadsOf(heart);
  const reach = heart.core + dancefloorDepth(heart);
  const roadBins = [...new Set(roads.map(r => binAngle(r.bearing)))].sort((a, b) => a - b);
  const gaps = [];
  if (roadBins.length === 0) {
    for (let k = 0; k < 16; k++) {
      const bin = ((k * ANGLE_BINS / 16) | 0) % ANGLE_BINS;
      gaps.push({ binMid: bin, widthBins: ANGLE_BINS, blocked: blockedCountAlong(heart, bin, reach) });
    }
  } else if (roadBins.length === 1) {
    const bin = (roadBins[0] + (ANGLE_BINS >> 1)) % ANGLE_BINS;   // opposite the single road
    gaps.push({ binMid: bin, widthBins: ANGLE_BINS, blocked: blockedCountAlong(heart, bin, reach) });
  } else {
    for (let i = 0; i < roadBins.length; i++) {
      const a = roadBins[i], b = roadBins[(i + 1) % roadBins.length];
      const width = (b - a + ANGLE_BINS) % ANGLE_BINS;
      const binMid = (a + (width >> 1)) % ANGLE_BINS;
      gaps.push({ binMid, widthBins: width, blocked: blockedCountAlong(heart, binMid, reach) });
    }
  }
  const dry = gaps.filter(g => g.blocked === 0);
  const pool = dry.length ? dry : gaps;
  pool.sort((a, b) => b.widthBins - a.widthBins || a.blocked - b.blocked || a.binMid - b.binMid);
  const chosen = pool[0];
  const result = { bin: chosen.binMid, bearing: binBearing(chosen.binMid), widthBins: chosen.widthBins, blocked: chosen.blocked, roadBins, gaps };
  if (_faCache.size > 4000) _faCache.clear();
  _faCache.set(ck, result);
  return result;
}

// The oriented no-tree clearing in front of the stage (A4): a rectangle anchored
// at the hub center, extending `depth` along +F with `halfWidth` to each side.
// PREVIEW form (CG1) — the authoritative rect (CG2) anchors at the nudged stage
// SPOT; here the hub center is a close stand-in for the overlay. Quantized.
export function dancefloorRect(heart) {
  const fa = computeFrontAxis(heart);
  const scale = stageScaleOf(heart);
  const dx = Math.cos(fa.bearing), dz = Math.sin(fa.bearing);
  return {
    cx: heart.x, cz: heart.z, dirx: dx, dirz: dz, bin: fa.bin,
    depth: quantize(FESTIVAL_TUNING.DANCEFLOOR_DEPTH_BASE * scale),
    halfWidth: quantize(FESTIVAL_TUNING.DANCEFLOOR_HALFWIDTH_BASE * scale),
  };
}

// Dancefloor clearing rects for every hub whose rect could reach a region — the
// pure cross-CHUNK query scatterWorldgenTrees will consume (CG2/D3.7), keyed off
// owning hearts via the MAX_POI_REACH AABB-expand (placement.js pattern). Every
// hub has a stage, so every enumerated heart contributes one rect.
export function dancefloorRectsNear(minX, minZ, maxX, maxZ) {
  const hs = heartsInBounds(minX - MAX_POI_REACH, minZ - MAX_POI_REACH, maxX + MAX_POI_REACH, maxZ + MAX_POI_REACH);
  return hs.map(dancefloorRect);
}

// Footprint (clear-radius, m) hint per cluster kind — for the build half's
// spacing + the map-sandbox overlay. The build side registers each prop with the
// model's real footprint; this is the cluster envelope. Now in tuning.js:
// FESTIVAL_TUNING.KIND_FOOTPRINT.
// Camp-village coarse grid (independent of hearts — the "back of the festival"):
// FESTIVAL_TUNING.VILLAGE_CELL (240) / .VILLAGE_PROB (0.25, parked feel-tunable).

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
  return { kind, x: quantize(x), z: quantize(z), yaw, footprint: FESTIVAL_TUNING.KIND_FOOTPRINT[kind] || 4, role, rank, anchor, clusterSeed: seed };
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
  const T = FESTIVAL_TUNING;
  for (let r = T.NUDGE_R_MIN; r <= T.NUDGE_R_MAX; r += T.NUDGE_R_STEP) {
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
function treedDistrictSpot(heart, rng, avoidBearing, reject) {
  const T = FESTIVAL_TUNING;
  const r0 = heart.core + T.DRUM_CORE_PAD;
  const r1 = Math.min(heart.core + T.DRUM_BAND, heart.district * T.DRUM_DISTRICT_FRAC);
  const FRONT_HALF = T.DRUM_FRONT_HALF;         // ~40° wedge around +F kept clear (the dancefloor)
  let fallback = null;
  let chosen = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const a = rng() * Math.PI * 2;
    const r = r0 + rng() * Math.max(0, r1 - r0);
    // keep the drum out of the stage's dancefloor wedge (back/side of F, not in front)
    if (avoidBearing != null && Math.abs(Math.atan2(Math.sin(a - avoidBearing), Math.cos(a - avoidBearing))) < FRONT_HALF) continue;
    const x = heart.x + Math.cos(a) * r, z = heart.z + Math.sin(a) * r;
    // Cheap tests only in the LOOP — `treeDensity` + `lakeAt`, NOT the heavy
    // `queryPoint` (whose nearestRoad ran 215µs/call × 12 attempts = the bulk of
    // the plan's cold cost). Water is avoided here; the road check is ONE query on
    // the FINAL spot below (D — Gary round-2: "drum circle should not be ON a road").
    if (lakeAt(quantize(x), quantize(z))) continue;
    // group 4 / D14 step 4: reject a spot whose drum envelope sits inside an
    // already-placed zone (the "drum inside a food-truck circle" bug Gary saw) —
    // re-attempt within this same 12-try loop, then omit if nothing clears.
    if (reject && reject(x, z)) continue;
    if (!fallback) fallback = { x, z };       // first dry, clear spot, in case nothing is treed
    if (treeDensity(x, z) >= 0.25) { chosen = { x, z }; break; }
  }
  const spot = chosen || fallback;
  if (!spot) return null;
  // D: one queryPoint on the FINAL chosen spot only — nudge the drum off the road
  //    corridor if it landed on one. `nudgeOff` early-returns (0 rng draws) when the
  //    spot is already off-road — the common case, so the loop stays cheap — and only
  //    ring-scans when it actually sits on a road. The drum's attempt count + this
  //    final nudge are a VARIABLE number of draws; under the group-4 slotter the
  //    potties (step 5) + bubble (step 7) now consume the stream AFTER it, so a
  //    cross-engine treeDensity-boundary fork would cosmetically shift those too —
  //    the SAME accepted single-engine-reproducible class as the node-vs-browser POI
  //    golden disparity (file header). Same-engine determinism (the golden) is intact.
  return nudgeOff(spot.x, spot.z, rng);
}

// ── Per-heart festival plan (memoized, gated on (seed, epoch)) ───────────────
const _planCache = new Map();
let _planGate = '';
function planGate() {
  const g = getSessionSeed() + ':' + worldgenEpoch();
  if (g !== _planGate) { _planCache.clear(); _faCache.clear(); _planGate = g; }
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

// ── Zone-slotting indices (R19 / D14) ────────────────────────────────────────
// Each cluster slot gets a FIXED semantic index so its clusterSeed (and thus the
// build half's model variation) never shifts when a SIBLING is omitted for no-fit.
// Stage stays 0 — `stageScaleOf` reads clusterSeed(heart,0), and main.js +
// dancefloorRect depend on that scale staying stable across omits.
const IDX = {
  stage: 0, arch: 1, bubble: 2,
  drum: 10,        // + k
  court: 20,       // + i
  row: 30,         // + i
  pottyStage: 40,
  pottyCourt: 50,  // + i
  pottyRow: 60,    // + i
};

// Single-pass priority zone slotter (D14): place clusters in priority order, each
// testing its TRUE oriented extent (clusterShapes) against the accumulating
// placed[] via clustersOverlap(+ZONE_MARGIN) and OMITTING on no-fit — dropping any
// dependent (a parent's potty) transactionally. Replaces the old scatter-then-
// resolveOverlaps scalar push, which guaranteed clipping under density (ROADMAP
// "Festival layout" root cause). Mutual exclusion BY CONSTRUCTION = main's "one
// theme per chunk" at hub scale (D4). The stage's deck circle + forward dancefloor
// OBB are placed[0]: the keep-out everything packs around, so courts/rows/drum that
// would intrude the clearing are omitted (the dancefloor stays clear — A4).
function _computePlan(heart) {
  const rng = cellRng(heart.cx, heart.cz, SALT.poiLayout);
  const T = FESTIVAL_TUNING;
  const major = heart.rank === 'major';
  const fa = computeFrontAxis(heart);          // the hub's front axis F (memoized)
  const out = [];
  const placed = [];                            // { kind, s:shapes } occupancy accumulator
  const pottyParents = [];                       // { x, z, yaw, idx } — potties slotted at step 5

  // Approach roads, sorted by a STABLE INTEGER key (R20): longest first, then
  // neighbor cell. roads[0] = the DRAG (the market street + the arch threshold).
  const roads = approachRoadsOf(heart)
    .sort((a, b) => b.lenQ - a.lenQ || a.neighbor.cx - b.neighbor.cx || a.neighbor.cz - b.neighbor.cz);

  // Does a candidate's oriented shape clear every placed zone (with ZONE_MARGIN)?
  const fits = (shapes) => !placed.some(pl => clustersOverlap(shapes, pl.s, T.ZONE_MARGIN));
  // Commit a descriptor: record its shapes in placed[] so later zones pack around it.
  const commit = (d) => {
    placed.push({ kind: d.kind, s: clusterShapes(d.kind, d.scale || 1, d.x, d.z, d.yaw) });
    out.push(d);
    return d;
  };

  // 1. STAGE at the hub center, facing +F — the bisector of the widest DRY gap
  //    between roads, so the dancefloor opens onto open ground BETWEEN roads (never
  //    down a road or at water; A3). `fbin` + `scale` are plan DATA the dancefloor
  //    clearing, the build, and the golden all read. Its deck + dancefloor OBB are
  //    placed[0] — the hard keep-out everything else slots around.
  const stageSpot = nudgeOff(heart.x, heart.z, rng) || { x: heart.x, z: heart.z };
  const stageYaw = Math.PI / 2 - fa.bearing;   // model front (+Z) → +F
  // Major hubs get the big main stage; minor hubs roll a tent stage (~35%) for
  // variety (B1) vs the open side stage. Deterministic per hub (cellRng stream).
  const stageKind = major ? 'main_stage' : (rng() < 0.35 ? 'tent_stage' : 'side_stage');
  const stage = desc(stageKind, stageSpot.x, stageSpot.z, stageYaw, 'core', heart.rank, true, clusterSeed(heart, IDX.stage));
  stage.fbin = fa.bin;                          // serialize F → the POI golden + window-invariance test see it (R18)
  stage.scale = stageScaleOf(heart);
  commit(stage);
  pottyParents.push({ x: stageSpot.x, z: stageSpot.z, yaw: stageYaw, idx: IDX.pottyStage });

  // 2. VENDOR AISLES straddling the drag (A5/C): the central aisle *is* the road —
  //    the descriptor centers ON a road point and the build lays two booth lines
  //    ±offset facing IN across it, so Zerble drives the aisle. yaw = road tangent
  //    (π/2 − bearing). Out past the dancefloor depth; OMIT a row whose OBB clips an
  //    earlier zone. Vendor aisles get road priority over courts (D14 step 2).
  const rowN = Math.min(roads.length, major ? T.ROW_N_MAJOR : T.ROW_N_MINOR);
  for (let i = 0; i < rowN; i++) {
    const rd = roads[i];
    const dist = Math.min(MAX_POI_REACH, (rd.lenQ * T.VENDOR_ROW_DRAG_FRAC) | 0, (major ? T.VENDOR_ROW_WALK_MAJOR : T.VENDOR_ROW_WALK_MINOR) + rng() * T.VENDOR_ROW_WALK_SPAN);
    const p = walkOriented(rd.oriented, dist);
    const yaw = Math.PI / 2 - p.bearing;
    if (!fits(clusterShapes('vendor_row', 1, p.x, p.z, yaw))) continue;
    const d = commit(desc('vendor_row', p.x, p.z, yaw, 'core', heart.rank, false, clusterSeed(heart, IDX.row + i)));
    pottyParents.push({ x: d.x, z: d.z, yaw, idx: IDX.pottyRow + i });
  }

  // 3. FOOD COURTS off the drag, PAST the vendor market (A6): the court's wide truck
  //    ring sits further out than the row aisle, so you drive the market then reach
  //    the food. Walk OUTWARD along the road in steps until the ring clears every
  //    earlier zone (the row OBB on the same road) and the stage; try both sides at
  //    each step; omit if nothing on this road fits within the drag cap.
  const courtN = Math.min(roads.length, major ? T.COURT_N_MAJOR : T.COURT_N_MINOR);
  const COURT_CAP = (lenQ) => Math.min(MAX_POI_REACH, (lenQ * T.FOOD_COURT_DRAG_FRAC) | 0);
  for (let i = 0; i < courtN; i++) {
    // Courts branch off SIDE roads (assigned from the far end of the list), keeping
    // the main drag roads[0] for the vendor market + the entrance arch (so roads[0]
    // reads arch → market → stage, uncluttered). Wraps onto used roads only when
    // courtN exceeds the spare side roads (e.g. a 1-road minor hub).
    const rd = roads[(roads.length - 1 - i % roads.length + roads.length) % roads.length];
    const cap = COURT_CAP(rd.lenQ);
    const base = (major ? T.FOOD_COURT_WALK_MAJOR : T.FOOD_COURT_WALK_MINOR) + rng() * T.FOOD_COURT_WALK_SPAN;
    const first = rng() < 0.5 ? 1 : -1;          // preferred side; the other is the fallback
    let done = false;
    for (let step = 0; step < 6 && !done; step++) {
      const dist = Math.min(cap, base + step * T.FOOD_COURT_STEP);
      const p = walkOriented(rd.oriented, dist);
      for (const side of [first, -first]) {
        const o = perpOff(p.x, p.z, p.bearing, CONFIG.ROAD_WIDTH / 2 + T.FOOD_COURT_PERP, side);
        const spot = nudgeOff(o.x, o.z, rng);
        if (!spot) continue;
        if (Math.hypot(spot.x - stageSpot.x, spot.z - stageSpot.z) < T.COURT_MIN_STAGE_DIST) continue;
        const yaw = roadFacingYaw(queryPoint(spot.x, spot.z).facing, rng);
        if (!fits(clusterShapes('food_court', 1, spot.x, spot.z, yaw))) continue;
        const d = commit(desc('food_court', spot.x, spot.z, yaw, 'core', heart.rank, false, clusterSeed(heart, IDX.court + i)));
        pottyParents.push({ x: d.x, z: d.z, yaw, idx: IDX.pottyCourt + i });
        done = true;
        break;
      }
      if (dist >= cap) break;   // reached the drag cap; don't spin on the same point
    }
  }

  // 4. DRUM CIRCLE — a quiet treed destination in the district, kept OUT of the
  //    dancefloor wedge AND out of any placed zone (the "drum inside a food-truck
  //    circle" bug; D14 step 4). treedDistrictSpot re-attempts within its 12-try loop.
  const drumN = major ? 1 : (rng() < 0.5 ? 1 : 0);
  for (let k = 0; k < drumN; k++) {
    const rejectInZone = (x, z) => !fits(clusterShapes('drum_circle', 1, x, z, 0));
    const spot = treedDistrictSpot(heart, rng, fa.bearing, rejectInZone);
    if (spot) commit(desc('drum_circle', spot.x, spot.z, rng() * Math.PI * 2, 'district', heart.rank, false, clusterSeed(heart, IDX.drum + k)));
  }

  // 5. POTTIES — one per placed parent zone (stage / court / row), tucked at the
  //    parent's HUB-OUTWARD edge (behind the cluster, away from the core) so it reads
  //    as "attached" (A8) and stays within the potty-attached range. Parents omitted
  //    in steps 1–3 aren't in pottyParents → their potty drops with them (transactional).
  for (const par of pottyParents) {
    let ox = par.x - heart.x, oz = par.z - heart.z;
    const ol = Math.hypot(ox, oz) || 1;
    ox /= ol; oz /= ol;
    const spot = nudgeOff(par.x + ox * T.POTTY_ATTACH_OFFSET, par.z + oz * T.POTTY_ATTACH_OFFSET, rng);
    if (spot) out.push(desc('porta_bank', spot.x, spot.z, par.yaw, 'core', heart.rank, false, clusterSeed(heart, par.idx)));
  }

  // 6. ARCH — the entrance threshold you drive THROUGH on the drag (roads[0]): the
  //    OUTER gateway, past the vendor market, so the approach reads arch → market →
  //    stage. Walk outward from ARCH_MIN_STAGE_DIST to the first road point that is
  //    dry, ≥ ARCH_MIN_STAGE_DIST from the stage, and CLEAR of every placed zone
  //    (fits() vs the stage's dancefloor OBB + market + courts) — so it lands just
  //    past the outermost zone on the drag. The planner now OWNS the arch (main.js
  //    buildSpawnArch stops); on the spawn hub this descriptor IS the spawn arch.
  //    Capped at ARCH_DRAG_FRAC of the road; omitted if the drag is too packed/short.
  if (roads.length) {
    const rd = roads[0];
    const cap = Math.min(MAX_POI_REACH, (rd.lenQ * T.ARCH_DRAG_FRAC) | 0);
    // Clear ARCH_MIN_STAGE_DIST from the DECK EDGE, not the center — the registry
    // arch-placement rule measures to the nearest stage deck tile, and the deck box
    // scales with the stage (deckR = KIND_FOOTPRINT × scale, matching stage.js w/d).
    const deckClear = T.ARCH_MIN_STAGE_DIST + (T.KIND_FOOTPRINT[stage.kind] || 11) * (stage.scale || 1);
    for (let d = T.ARCH_MIN_STAGE_DIST; d <= cap; d += 6) {
      const p = walkOriented(rd.oriented, d);
      if (Math.hypot(p.x - stage.x, p.z - stage.z) < deckClear) continue;
      if (lakeAt(quantize(p.x), quantize(p.z))) continue;             // dry
      const yaw = Math.PI / 2 - p.bearing;
      if (!fits(clusterShapes('arch', 1, p.x, p.z, yaw))) continue;   // clear of floor + market + courts
      commit(desc('arch', p.x, p.z, yaw, 'core', heart.rank, true, clusterSeed(heart, IDX.arch)));
      break;
    }
  }

  // 7. BUBBLE VENDOR — one GUARANTEED refuel per hub. Refuel is a core verb, so this
  //    stays guaranteed rather than D14's probabilistic (D15). Off a quieter road if
  //    that spot is clear, else scattered near center; nudged clear of water/road.
  {
    let spot = null, yaw = rng() * Math.PI * 2;
    if (roads.length) {
      const rd = roads[roads.length - 1];
      const p = walkOriented(rd.oriented, Math.min(MAX_POI_REACH, (major ? T.BUBBLE_WALK_MAJOR : T.BUBBLE_WALK_MINOR) + rng() * T.BUBBLE_WALK_SPAN));
      const side = rng() < 0.5 ? 1 : -1;
      const o = perpOff(p.x, p.z, p.bearing, CONFIG.ROAD_WIDTH / 2 + T.BUBBLE_PERP, side);
      const cand = nudgeOff(o.x, o.z, rng);
      if (cand && fits(clusterShapes('bubble_vendor', 1, cand.x, cand.z, 0))) {
        spot = cand;
        yaw = roadFacingYaw(queryPoint(spot.x, spot.z).facing, rng);
      } else {
        spot = cand;   // keep the road spot as the guaranteed fallback even if it grazes
      }
    }
    if (!spot) spot = nudgeOff(heart.x + (rng() - 0.5) * T.BUBBLE_FALLBACK_SPREAD, heart.z + (rng() - 0.5) * T.BUBBLE_FALLBACK_SPREAD, rng);
    if (spot) out.push(desc('bubble_vendor', spot.x, spot.z, yaw, 'core', heart.rank, false, clusterSeed(heart, IDX.bubble)));
  }

  return out;
}

// ── Camp villages — the "back of the festival" packed clusters (independent of
//    hearts; a coarse deterministic grid, district/outskirts only) ─────────────
export function campVillagesNear(bounds) {
  const { minX, minZ, maxX, maxZ } = bounds;
  const VC = FESTIVAL_TUNING.VILLAGE_CELL, VP = FESTIVAL_TUNING.VILLAGE_PROB;
  const c0x = Math.floor(minX / VC) - 1, c1x = Math.floor(maxX / VC) + 1;
  const c0z = Math.floor(minZ / VC) - 1, c1z = Math.floor(maxZ / VC) + 1;
  const out = [];
  for (let cz = c0z; cz <= c1z; cz++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      const rng = cellRng(cx, cz, SALT.poiVillage);
      if (rng() > VP) continue;
      const jx = (rng() - 0.5) * VC * 0.6, jz = (rng() - 0.5) * VC * 0.6;
      const x = quantize((cx + 0.5) * VC + jx), z = quantize((cz + 0.5) * VC + jz);
      const qp = queryPoint(x, z);
      if (qp.noBuild || qp.inLake) continue;       // off road + off water
      if (qp.roleTier === 'core') continue;          // villages are back-of-festival, not the core
      // D2: tent count tracks local crowd density (~1.5 people/tent). The ambient
      // crowd per chunk is ~round(1 + heartInfluence*15) (chunks.js), so a busy
      // near-hub district packs a big camp (~22) and the quiet deep outskirts a
      // small one (~5). Carried as plan data so the build reads it deterministically.
      const tents = Math.max(5, Math.min(22, Math.round(6 + qp.heartInfluence * 16)));
      out.push({
        kind: 'camp_village', x, z, yaw: 0, footprint: FESTIVAL_TUNING.KIND_FOOTPRINT.camp_village,
        role: qp.roleTier, rank: qp.heart ? qp.heart.rank : 'minor', anchor: false, tents,
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
