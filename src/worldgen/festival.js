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

import { cellRng, quantize, worldHash, mulberry32, cellHash, edgeHash } from '../rng.js';
import { CONFIG, SALT, worldgenEpoch } from './constants.js';
import { FESTIVAL_TUNING, clusterShapes, clustersOverlap, clusterExtent } from './tuning.js';
import { getSessionSeed } from '../rng.js';
import { queryPoint } from './index.js';
import { approachRoadsOf, nearestRoad } from './roads.js';
import { heartsInBounds, nearestMajorHeart } from './hearts.js';
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
  // Prefer the DRIEST gap, then the widest, then lowest bin. In the common case a
  // fully-dry gap exists (all blocked === 0) so this is width-first — IDENTICAL to
  // before, byte-for-byte. It only differs when NO gap is dry (a lake-hemmed hub):
  // then the LEAST-WET gap wins instead of the widest, so the dancefloor opens toward
  // the driest available ground rather than onto a lake (the residual dancefloor-
  // mouth-on-water case). `blocked` is already scale-aware (reach = core +
  // dancefloorDepth), so it reflects mouth wetness. Integer keys; deterministic.
  pool.sort((a, b) => a.blocked - b.blocked || b.widthBins - a.widthBins || a.binMid - b.binMid);
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
// building hub has a stage, so it contributes one rect — but a hub suppressed for
// sitting in a lake (`_festivalSuppressed`) builds no stage, so it gets no clearing
// (else the tree scatter would carve a phantom clear patch over open water).
export function dancefloorRectsNear(minX, minZ, maxX, maxZ) {
  const hs = heartsInBounds(minX - MAX_POI_REACH, minZ - MAX_POI_REACH, maxX + MAX_POI_REACH, maxZ + MAX_POI_REACH);
  const T = FESTIVAL_TUNING;
  const out = [];
  // CG2 — the AUTHORITATIVE clearing, read off the actual STAGE descriptor (its
  // nudged spot, yaw, scale), not the heart-center preview `dancefloorRect`. Two
  // fixes over the preview form (Gary 2026-06-16): (1) it tracks the stage's
  // footprint-aware nudge, so the clearing sits where the stage really is — not
  // where the heart center was; (2) it extends BEHIND the deck by `deckR` so the
  // tent BODY is cleared too, not just the audience side ("trees growing through
  // the tent"). Anchored behind the deck; depth = deckR + dancefloor so the
  // existing along∈[0,depth] point test (pointInDancefloor) is unchanged.
  for (const h of hs) {
    if (_festivalSuppressed(h)) continue;
    for (const d of festivalPlan(h)) {
      if (d.kind !== 'main_stage' && d.kind !== 'side_stage' && d.kind !== 'tent_stage') continue;
      const scale = d.scale || 1;
      const dirx = Math.sin(d.yaw), dirz = Math.cos(d.yaw);          // stage +F (matches clusterShapes ux/uz)
      const deckR = (T.KIND_FOOTPRINT[d.kind] || 11) * scale;        // deck/tent body radius
      const floorDepth = T.DANCEFLOOR_DEPTH_BASE * scale;
      out.push({
        cx: quantize(d.x - dirx * deckR), cz: quantize(d.z - dirz * deckR), dirx, dirz, bin: d.fbin,
        depth: quantize(deckR + floorDepth),
        halfWidth: quantize(Math.max(T.DANCEFLOOR_HALFWIDTH_BASE * scale, deckR)),
      });
    }
  }
  return out;
}

// Drum-circle clearings for every nearby hub, as { x, z, r } circles — the inner
// keep-out the Group-F tree scatter carves so woods surround the drum (treed pocket
// is the POINT, DRUM_TREE_RADIUS) but never fill the firepit/bench ring (Gary
// 2026-06-14: "trees spawned in the middle of a drum circle"). Plan-side (not
// registry) so it's load-order-independent: a drum's bench ring spills past its
// own chunk, and a neighbour chunk may scatter trees before the drum's chunk
// builds. `r` = the planner's own drum envelope (KIND_FOOTPRINT.drum_circle) + a
// small margin for the bench arc + figures. Fetched ONCE per chunk like danceRects.
export function drumClearingsNear(minX, minZ, maxX, maxZ) {
  const hs = heartsInBounds(minX - MAX_POI_REACH, minZ - MAX_POI_REACH, maxX + MAX_POI_REACH, maxZ + MAX_POI_REACH);
  const r = (FESTIVAL_TUNING.KIND_FOOTPRINT.drum_circle || 6) + 2;
  const out = [];
  for (const h of hs) {
    for (const d of festivalPlan(h)) {
      if (d.kind === 'drum_circle') out.push({ x: d.x, z: d.z, r });
    }
  }
  return out;
}

// (Removed `stageDeckClips` + `_STAGE_DECK_MAX` in 4B.3c — the drum-yields-to-a-neighbour-
// stage band-aid is now the principled `yield` seam response in festivalPlan; see below.)

// --- Cross-hub seam grammar (Group 4B — D7/D8/D9, D19–D23) --------------------
// DENSE & SEAMED (Gary grill 2026-06-14): hubs sit HEART_CELL (200 m) apart but
// clusters reach ~190 m, so neighbours overlap BY DESIGN. Instead of patching each
// clip in the builders (blind + load-order-dependent), we promote the seam to a
// designed place — shared street / merged court / soft buffer — DECIDED IN THE PLANNER
// so both hubs derive the identical outcome with no communication. The decision is
// INTEGER-ONLY (no float gates existence — footgun #4): integer priority + quantized
// positions + integer squared-distance, the hearts.js pattern. 4B.1 is the pure,
// golden-FROZEN foundation (priority + pair enumeration); it emits nothing into the
// plan — classification + response land in 4B.2/4B.3.

// Integer priority for a hub (cell + session seed). Breaks symmetry between two
// seaming hubs without communication: the HIGHER-priority hub is the keeper (anchor),
// the lower yields (trims its row / cedes its court). Pure uint32; exact-equality ties
// are broken downstream by (cx,cz) lexicographic — never iteration order.
export function getHubPriority(cx, cz) {
  return cellHash(cx | 0, cz | 0, SALT.hubPriority) >>> 0;
}

// Center-distance at which two hubs' fronts can clip. EMPIRICAL: the max heart-center
// distance among ACTUAL classified clips is ~259 m across sampled seeds (4B.3b probe), so
// 300 is a safe superset with margin while keeping the per-heart base-plan fan-out (the
// dominant cold cost — festivalPlan warms every neighbour's base plan inside this radius)
// as small as correctness allows. Was 420 (an arbitrary over-bound that warmed ~2× the
// hearts for zero extra clips). The residual cold-warming stall (frame-spread + cheaper
// base plans) is the #1 item for the dedicated perf pass — see PERF-FEEL-NOTES.
// (Structural; candidate FESTIVAL_TUNING knob. Must stay ≥ the true max clip distance or a
// real clip is missed — golden-affecting; re-verify the POI golden if changed.)
const SEAM_PAIR_REACH = 300;

// Every unordered hub PAIR near a region whose centers are within SEAM_PAIR_REACH —
// the load-order-independent substrate the seam classifier (4B.2) runs on (mirrors
// dancefloorRectsNear / stageDeckClips). Canonicalized by (cx,cz) so pair (A,B) ===
// pair (B,A) regardless of which chunk asked; `keeper`/`yielder` decided by integer
// priority (higher keeps), exact ties by (cx,cz). PURE: no festivalPlan, no rng draw,
// no nearestRoad — heart positions + integer hashes only, so it's cheap AND golden-frozen.
export function seamPairsNear(minX, minZ, maxX, maxZ) {
  const hs = heartsInBounds(minX - SEAM_PAIR_REACH, minZ - SEAM_PAIR_REACH, maxX + SEAM_PAIR_REACH, maxZ + SEAM_PAIR_REACH);
  const reachSq = SEAM_PAIR_REACH * SEAM_PAIR_REACH;
  const out = [];
  for (let i = 0; i < hs.length; i++) {
    for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i], b = hs[j];
      const dx = a.x - b.x, dz = a.z - b.z;
      const distSq = dx * dx + dz * dz;          // exact integer (heart coords are quantized)
      if (distSq > reachSq) continue;
      // canonical pair order: lower (cx,cz) first → origin-independent identity
      let lo = a, hi = b;
      if (b.cx < a.cx || (b.cx === a.cx && b.cz < a.cz)) { lo = b; hi = a; }
      const pLo = getHubPriority(lo.cx, lo.cz), pHi = getHubPriority(hi.cx, hi.cz);
      // higher priority keeps; on exact tie the canonical-lower (cx,cz) hub keeps
      const keeper = (pLo >= pHi) ? lo : hi;
      const yielder = (keeper === lo) ? hi : lo;
      out.push({ lo, hi, keeper, yielder, distSq, seamHash: edgeHash(lo.cx, lo.cz, hi.cx, hi.cz, SALT.seam) >>> 0 });
    }
  }
  return out;
}

// Seam category per descriptor kind — the axis the context-grammar classifies on
// (D20): loud (stages + drum), commerce (market), food (court), quiet/support (camps,
// potties, bubbles, arch). Camps live on a separate coarse grid (campVillagesNear),
// not festivalPlan, so 4B.2 v1 classifies festival-POI-zone seams; camp↔loud buffers
// are a 4B.3 extension.
const SEAM_CATEGORY = {
  main_stage: 'loud', tent_stage: 'loud', side_stage: 'loud', drum_circle: 'loud',
  vendor_row: 'commerce',
  food_court: 'food',
  camp_village: 'quiet', porta_bank: 'support', bubble_vendor: 'support', arch: 'support',
};
// The big-footprint zones whose fronts actually form a seam (small threshold props —
// arch, bubble, potty — don't define a front; skip them as the "edge zone").
const SEAM_ZONE_KINDS = new Set(['main_stage', 'tent_stage', 'side_stage', 'drum_circle', 'vendor_row', 'food_court']);
const SEAM_MARGIN = 2;   // integer slack (m) on the existence gate

// Conservative per-kind extent, QUANTIZED to whole meters — the existence gate must be
// integer (D8/D21), so the float `clusterExtent` can't feed the compare directly. Stages
// use their MAX scale bound (a conservative per-rank deck radius); other kinds are pure constants. Read
// per-call (no cross-epoch memo) so live sandbox tuning still tracks.
function seamExtentInt(kind) {
  const T = FESTIVAL_TUNING;
  let maxScale = 1;
  if (kind === 'main_stage') maxScale = T.STAGE_SCALE_MAJOR_BASE + T.STAGE_SCALE_MAJOR_SPAN;
  else if (kind === 'tent_stage' || kind === 'side_stage') maxScale = T.STAGE_SCALE_MINOR_BASE + T.STAGE_SCALE_MINOR_SPAN;
  return quantize(clusterExtent(kind, maxScale));
}

// The seam-relevant zone in `plan` whose center is nearest the OTHER hub — the "front"
// that meets the neighbour. Integer squared-distance (desc() quantizes x,z), so the
// pick is engine-stable. Returns the descriptor or null.
function nearestZoneToward(plan, other) {
  let best = null, bestSq = Infinity;
  for (const d of plan) {
    if (!SEAM_ZONE_KINDS.has(d.kind)) continue;
    const dx = d.x - other.x, dz = d.z - other.z;
    const sq = dx * dx + dz * dz;          // integer
    if (sq < bestSq) { bestSq = sq; best = d; }
  }
  return best;
}

// Soft-buffer seam HEDGES (4B.7 — "dress, don't delete"). Where a loud cluster (a
// stage) abuts a quieter neighbour, the seam was classified `soft_buffer` but the
// response was informational only (suppressing all would gut the dense festival).
// Instead, dress it: a short hedge line of shrubs at the midpoint between the two
// abutting zones, perpendicular to the line between them, so they read as separate
// places. Pure read (classifySeamsNear is golden-emitting-nothing); the chunk builder
// places each shrub whose position lands in its own chunk (ownership by-position, no
// double-placement), seeded per-position off `seamHash` so it's render-order-independent.
export function seamHedgesNear(minX, minZ, maxX, maxZ) {
  const out = [];
  for (const seam of classifySeamsNear(minX, minZ, maxX, maxZ)) {
    if (seam.type !== 'soft_buffer') continue;
    const ax = seam.keeperZone.x, az = seam.keeperZone.z;
    const bx = seam.yielderZone.x, bz = seam.yielderZone.z;
    let dx = bx - ax, dz = bz - az;
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    out.push({ x: (ax + bx) / 2, z: (az + bz) / 2, dirx: -dz, dirz: dx, seamHash: seam.seamHash >>> 0 });
  }
  return out;
}

// Context-grammar seam TYPE from the two meeting categories (D20). food+food merges to
// one court; commerce+commerce fuses to a shared street; two loud fronts (drum vs stage)
// → the lower-priority one yields; loud meeting anything quieter → a soft buffer; other
// mixes default to a buffer (separate them).
function classifySeamType(catA, catB) {
  if (catA === 'food' && catB === 'food') return 'merged_court';
  if (catA === 'commerce' && catB === 'commerce') return 'shared_street';
  if (catA === 'loud' && catB === 'loud') return 'yield';
  if ((catA === 'loud') !== (catB === 'loud')) return 'soft_buffer';
  return 'soft_buffer';
}

// Classify every CONFLICTING hub-pair seam near a region (4B.2). For each pair from
// seamPairsNear: take each hub's front nearest the other, gate the conflict on INTEGER
// center-distance vs the quantized extent sum (no float gates existence — D8/D21), and
// tag the seam TYPE. Pure read — calls festivalPlan (memoized) but emits NOTHING into any
// plan, so both goldens stay frozen. The response (trim/merge/buffer) is 4B.3.
export function classifySeamsNear(minX, minZ, maxX, maxZ) {
  const out = [];
  for (const seam of seamPairsNear(minX, minZ, maxX, maxZ)) {
    const eK = nearestZoneToward(_basePlan(seam.keeper), seam.yielder);
    const eY = nearestZoneToward(_basePlan(seam.yielder), seam.keeper);
    if (!eK || !eY) continue;
    const dx = eK.x - eY.x, dz = eK.z - eY.z;
    const distSq = dx * dx + dz * dz;                              // integer
    const thr = seamExtentInt(eK.kind) + seamExtentInt(eY.kind) + SEAM_MARGIN;
    if (distSq > thr * thr) continue;                             // fronts clear — no seam
    const catK = SEAM_CATEGORY[eK.kind] || 'support';
    const catY = SEAM_CATEGORY[eY.kind] || 'support';
    out.push({
      keeper: seam.keeper, yielder: seam.yielder,
      keeperZone: eK, yielderZone: eY,
      type: classifySeamType(catK, catY),
      gapInt: Math.round(Math.sqrt(distSq)), thrInt: thr, seamHash: seam.seamHash,
    });
  }
  return out;
}

// Seam-response category rank — for soft_buffer, the QUIETER front yields (lower rank).
const SEAM_RANK = { loud: 3, commerce: 2, food: 1, support: 0, quiet: 0 };

// Exact integer sqrt — bit-identical across V8 forks (the Math.sqrt seed may differ by a
// ULP, but the integer correction loops make the RESULT engine-stable). Used so the
// trim-vs-suppress decision (an existence gate) is integer, never float (N3/D21).
function isqrt(n) {
  if (n < 2) return n | 0;
  let x = Math.floor(Math.sqrt(n)) | 0;
  while (x * x > n) x--;
  while ((x + 1) * (x + 1) <= n) x++;
  return x;
}

// 4B.3a — the DARK-EMIT seam-response pass (deliberation 002, CG1). For each classified
// seam, compute the deterministic RESPONSE: which descriptor the YIELDER suppresses or
// trims, chosen ONCE from the canonical pair (so both hubs' chunks derive the identical
// outcome with no communication — N2). This is a SEPARATE post-base-plan read: it never
// mutates festivalPlan/out[] and `_computePlan` never calls a neighbour (N1), so both
// goldens stay frozen here. 4B.3b consumes these records at build time; until then this
// exists for the order-independence proof + the map-overlay. INTEGER-ONLY: the target is
// identified by a stable `clusterSeed`, the trim count by integer booth math over an
// integer overlap (isqrt), never a float gate (N3).
//   merged_court → suppress the yielder's food_court (the band-aid `neighbourCourtHere` did
//                  this blindly; here the keeper is integer-priority-chosen, so it's order-safe).
//   yield        → suppress the DRUM among the two fronts (a stage is a hard anchor; the
//                  drum always yields — `stageDeckClips`' principled form). stage+stage =
//                  unresolved spacing (action 'none', a WARN, not an ERROR).
//   soft_buffer  → the quieter front (lower SEAM_RANK) yields; bare separation only here,
//                  buffer dressing is 4B.7.
//   shared_street→ trim the yielder's vendor_row by the integer overlap; suppress if the
//                  trimmed row can't seat 3 booths (Gemini R4).
function _seamResponse(s, spacing, maxBooths) {
  const { type, keeperZone: K, yielderZone: Y, keeper, yielder, seamHash } = s;
  const kCell = [keeper.cx, keeper.cz], yCell = [yielder.cx, yielder.cz];
  // a zone descriptor owned by the keeper came from _basePlan(keeper); else the yielder.
  const cellOf = (zone) => (zone === K ? kCell : yCell);
  const base = {
    seamHash, type, keeperCell: kCell, yielderCell: yCell,
    action: 'none', targetSeed: null, targetKind: null, targetCell: null, trimToBooths: null,
  };
  if (type === 'merged_court') return { ...base, action: 'suppress', targetSeed: Y.clusterSeed, targetKind: Y.kind, targetCell: yCell };
  if (type === 'yield') {
    const drum = K.kind === 'drum_circle' ? K : (Y.kind === 'drum_circle' ? Y : null);
    return drum ? { ...base, action: 'suppress', targetSeed: drum.clusterSeed, targetKind: 'drum_circle', targetCell: cellOf(drum) } : base;
  }
  if (type === 'soft_buffer') {
    // DRESS-NOT-DELETE (4B.7, landed 2026-06-16): we do NOT suppress — at 200 m density
    // soft_buffer fires ~40×/window and deleting all would gut the festival
    // (PERF-FEEL-NOTES). The dressing is a shrub hedge along the seam (`seamHedgesNear`
    // → chunks.js `placeSeamHedges`), read off classifySeamsNear directly. This `action:
    // 'buffer'` stays informational (the map overlay renders it); _suppressSetForHeart
    // ignores it, so nothing is removed from the plan and the golden is unaffected.
    const q = (SEAM_RANK[SEAM_CATEGORY[K.kind]] ?? 0) <= (SEAM_RANK[SEAM_CATEGORY[Y.kind]] ?? 0) ? K : Y;
    return { ...base, action: 'buffer', targetSeed: q.clusterSeed, targetKind: q.kind, targetCell: cellOf(q) };
  }
  if (type === 'shared_street') {
    const dx = K.x - Y.x, dz = K.z - Y.z;            // integer (desc quantizes x,z)
    const overlap = Math.max(0, s.thrInt - isqrt(dx * dx + dz * dz));   // integer m
    const removed = Math.floor((overlap + spacing - 1) / spacing);      // ceil, integer
    const newBooths = maxBooths - removed;
    // 4B.3b applies trim as a full suppress (the builder doesn't honour a booth count yet);
    // trimToBooths is recorded for the 4B.7 real-trim upgrade. <3 booths = suppress regardless.
    return { ...base, action: 'trim', targetSeed: Y.clusterSeed, targetKind: 'vendor_row', targetCell: yCell, trimToBooths: newBooths >= 3 ? newBooths : null };
  }
  return base;
}

// All actionable seam responses near a region — the single canonical source 4B.3b filters
// against (by `targetSeed`), and the map-overlay (4B.0) renders. Order-independent by
// construction (rides classifySeamsNear's canonical pairs); pure read, golden-frozen.
export function seamResponsesNear(minX, minZ, maxX, maxZ) {
  const T = FESTIVAL_TUNING;
  const spacing = quantize(T.VENDOR_ROW_SPACING) || 5;
  const maxBooths = (T.VENDOR_ROW_COUNT_BASE + T.VENDOR_ROW_COUNT_SPAN - 1) | 0;
  const out = [];
  for (const s of classifySeamsNear(minX, minZ, maxX, maxZ)) {
    const r = _seamResponse(s, spacing, maxBooths);
    if (r.action !== 'none') out.push(r);
  }
  return out;
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

// Footprint-aware nudge for the STAGE deck. `nudgeOff` only tests the CENTER
// point, but a stage deck is a ~13-19 m circle — its center can clear road+lake
// while a back/side corner dips into a shore (Gary 2026-06-16: "tent stage
// partially flooded, corner in the lake"). This requires the center off
// road/lake AND a rosette of perimeter samples at `footR` clear of open water,
// searching the same deterministic ring as `nudgeOff` but HASH-seeded so it
// consumes NO rng — the rest of the hub's plan stream is untouched, and only a
// genuinely-flooding stage moves. Falls back to the least-wet buildable spot,
// then the heart center, so a lake-hemmed hub still gets its stage. Mirrors the
// "least-wet gap" philosophy already used for the dancefloor front-axis.
function nudgeOffStage(x, z, footR, heart) {
  const T = FESTIVAL_TUNING;
  // 16 perimeter samples (~4 m apart on a 15 m deck) so a narrow shoreline inlet
  // can't slip between probes; plus a mid-radius ring for a deep finger of water.
  const wetness = (cx, cz) => {
    if (queryPoint(cx, cz).noBuild) return Infinity;   // center on road/lake — never a candidate
    let wet = 0;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      if (queryPoint(cx + c * footR, cz + s * footR).inLake) wet++;
      if (queryPoint(cx + c * footR * 0.6, cz + s * footR * 0.6).inLake) wet++;
    }
    return wet;
  };
  if (wetness(x, z) === 0) return { x, z };
  const baseA = ((worldHash(heart.cx, heart.cz, SALT.poiLayout) >>> 0) / 4294967296) * Math.PI * 2;
  let best = null, bestWet = Infinity;
  // Stages are big (13-19 m deck) AND anchor the hub, so a shore-hugging one needs
  // a wider sweep than nudgeOff's 28 m to find dry ground — but the whole composition
  // (dancefloor, potty, band) rides stageSpot, so they relocate together. 12 dirs ×
  // out to ~52 m. A residual heavy-flood means a genuinely lake-hemmed hub (no dry
  // deck within reach) → least-wet, same parked class as the dancefloor-mouth case.
  for (let r = 10; r <= 52; r += 7) {
    for (let k = 0; k < 12; k++) {
      const a = baseA + (k / 12) * Math.PI * 2;
      const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
      const w = wetness(nx, nz);
      if (w === 0) return { x: nx, z: nz };
      if (w < bestWet) { bestWet = w; best = { x: nx, z: nz }; }
    }
  }
  return best || { x, z };
}

// Footprint-aware road/water nudge for the DRUM circle. `nudgeOff` tests only the
// drum's CENTER against the road corridor, but its firepit/bench RING (clearR ≈
// footprint+2, the same keep-out drumClearingsNear carves) can spill across a road
// while the center sits just clear (Gary 2026-06-16 marker: "drum circle spawning
// in a road, blocking the road a bit"). The road is a polyline corridor of half-
// width ROAD_WIDTH, so the test is EXACT and cheap (one nearestRoad call, no
// perimeter-probe resolution gaps): the drum's clearR keep-out disk and that
// corridor are disjoint iff the center is farther than ROAD_WIDTH + clearR from the
// nearest centerline. Lake is the same center test the old nudgeOff did (a ring dip
// into open water wasn't a reported case). HASH-seeded (rng-free) so the hub's plan
// stream is untouched — only a genuinely road/water-clipping drum moves (the now-
// rng-free nudge shifts the draw position for those hubs, like the stage fix did).
// Returns the clear spot, or null when none is in reach (caller then OMITS the drum,
// as for a no-treed-pocket miss).
function nudgeOffDrum(x, z, clearR, heart) {
  const roadClear = CONFIG.ROAD_WIDTH + clearR + 1;   // +1 epsilon: onRoad is `≤ ROAD_WIDTH`, so clear the closed boundary too
  const blocked = (cx, cz) =>
    lakeAt(quantize(cx), quantize(cz)) || nearestRoad(cx, cz).dist < roadClear;
  if (!blocked(x, z)) return { x, z };
  const baseA = ((worldHash(heart.cx, heart.cz, SALT.poiLayout) >>> 0) / 4294967296) * Math.PI * 2;
  for (let r = clearR; r <= clearR + 30; r += 6) {
    for (let k = 0; k < 12; k++) {
      const a = baseA + (k / 12) * Math.PI * 2;
      const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
      if (!blocked(nx, nz)) return { x: quantize(nx), z: quantize(nz) };
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
  // "Quiet behind, loud in front" (Gary 2026-06-16): the drum is the hub's quiet
  // destination, so bias it to the REAR hemisphere — behind the stage, away from
  // the dancefloor — instead of anywhere-but-the-front-wedge. With avoidBearing
  // (= +F), map the raw angle onto an arc centered on the rear bearing (F+π),
  // spanning ±(π−FRONT_HALF) so it's out of the front wedge BY CONSTRUCTION, and
  // skew it toward the rear (|u|^1.6) so most drums tuck directly behind. Same one
  // rng draw for the angle → same variable-draw class as before (file header);
  // the drum's positions shift, so the POI golden moves deliberately.
  const rear = avoidBearing != null ? avoidBearing + Math.PI : null;
  let chosen = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    let a;
    if (rear != null) {
      const u = rng() * 2 - 1;                                   // [-1, 1)
      a = rear + Math.sign(u) * Math.pow(Math.abs(u), 2.2) * (Math.PI - FRONT_HALF);
    } else {
      a = rng() * Math.PI * 2;
    }
    const r = r0 + rng() * Math.max(0, r1 - r0);
    const x = heart.x + Math.cos(a) * r, z = heart.z + Math.sin(a) * r;
    // Cheap tests only in the LOOP — `treeDensity` + `lakeAt`, NOT the heavy
    // `queryPoint` (whose nearestRoad ran 215µs/call × 12 attempts = the bulk of
    // the plan's cold cost). Water is avoided here; the road check is ONE query on
    // the FINAL spot below (D — Gary round-2: "drum circle should not be ON a road").
    if (lakeAt(quantize(x), quantize(z))) continue;
    // group 4 / D14 step 4: reject a spot whose drum envelope sits inside an
    // already-placed zone (the "drum inside a food-truck circle" bug Gary saw) —
    // re-attempt within this same 12-try loop.
    if (reject && reject(x, z)) continue;
    if (treeDensity(x, z) >= 0.25) { chosen = { x, z }; break; }
  }
  // Gary 2026-06-14: OMIT the drum if no genuinely treed pocket was found — drum
  // circles do NOT belong at every hub, and a treeless drum reads wrong. No dry
  // fallback any more: only a treed spot gets a drum.
  if (!chosen) return null;
  const spot = chosen;
  // D: nudge the drum off the road corridor / open water if it landed on one — now
  //    FOOTPRINT-AWARE (Gary 2026-06-16 marker), so the firepit/bench RING clears the
  //    road, not just the center point (`nudgeOff` tested only the center → a drum
  //    whose center sat just off a road still spilled its ring across it, blocking it).
  //    `nudgeOffDrum` early-returns when the whole ring is already clear — the common
  //    case (drum spots are deep off-road), so the loop stays cheap — and only ring-
  //    scans when it actually clips. It is HASH-seeded (rng-free), unlike the old
  //    rng-driven `nudgeOff`, so the drum's attempt count is now the ONLY variable-draw
  //    source here: hubs whose drum clipped a road/lake no longer consume that nudge
  //    draw, shifting their potties (step 5) + bubble (step 7) — the SAME accepted
  //    golden-move class as the stage flood fix (736f05b4). Same-engine determinism
  //    (the golden) is intact; the POI golden moves deliberately (selftest baseline).
  const clearR = (FESTIVAL_TUNING.KIND_FOOTPRINT.drum_circle || 6) + 2;   // matches drumClearingsNear
  const finalSpot = nudgeOffDrum(spot.x, spot.z, clearR, heart);
  // The chosen spot met the treed bar (>=0.25), but `nudgeOffDrum` may have shoved it
  // off a road EDGE into the adjacent CLEARING — landing the drum on bare ground (the
  // `drum-in-trees` burndown: density 0.00, off-road, road-facing). Re-validate the
  // FINAL spot against the SAME bar and OMIT if it's now bare — a treeless drum reads
  // wrong, and drums don't belong at every hub (Gary 2026-06-14: omit, don't place).
  // treeDensity is pure → deterministic; omitting here skips the drum's yaw draw the
  // same way a no-spot omission already does (the variable-draw class noted above).
  if (!finalSpot || treeDensity(finalSpot.x, finalSpot.z) < 0.25) return null;
  return finalSpot;
}

// ── Per-heart festival plan (memoized, gated on (seed, epoch)) ───────────────
// Two layers (4B.3b): `_planCache` holds the seam-BLIND base plan; `_seamedCache` holds
// the public plan = base + cross-hub seam suppressions. The seam pass reads the base
// (never the seamed plan) so it's non-recursive (N1) and the base cache never goes stale
// w.r.t. a seam (the Architect's stale-memo invariant, deliberation 002).
const _planCache = new Map();
const _seamedCache = new Map();
let _planGate = '';
let _spawnHubKey = null;     // the ONE hub that gets the entrance arch (Gary 2026-06-14)
function planGate() {
  const g = getSessionSeed() + ':' + worldgenEpoch();
  if (g !== _planGate) { _planCache.clear(); _seamedCache.clear(); _faCache.clear(); _spawnHubKey = null; _planGate = g; }
}

// There is exactly ONE entrance arch in the whole world — the festival's grand gateway
// at the SPAWN hub's main stage (A1; Gary 2026-06-14 playtest: "only ONE arch, by the
// main stage"). main.js spawns Zerble at the nearest major heart to origin, so the arch
// belongs to that same hub. Cached per (seed, epoch); deterministic per seed.
// The hub the game OPENS on: the nearest major heart to origin that ISN'T in a
// lake — so Zerble never spawns facing a stage in the water (the spawn hub is the
// one hub exempt from `_festivalSuppressed`, so a wet pick would build a submerged
// festival as the opening view). Falls back to the nearest major at all (then
// main.js falls back to any heart) so spawn always resolves even in a pathological
// all-wet neighbourhood. main.js MUST use this same picker for the spawn arch +
// Zerble's position to belong to this hub. Pure per seed; deterministic.
export function spawnHeart() {
  planGate();
  return nearestMajorHeart(0, 0, 28, h => !lakeAt(quantize(h.x), quantize(h.z)))
      || nearestMajorHeart(0, 0);
}

function spawnHubKey() {
  planGate();
  if (_spawnHubKey === null) {
    const sh = spawnHeart();
    _spawnHubKey = sh ? sh.cx + ',' + sh.cz : '';
  }
  return _spawnHubKey;
}

// Which hubs get the road→arch→stage ARRIVAL composition (D9/4B.4). The spawn hub
// ALWAYS does (the guaranteed hero gateway main.js opens through). Beyond it, the
// arch is a grammar feature of MAJOR hubs only (~4% of cells), thinned to
// ~ARCH_MAJOR_PCT% of those by an INTEGER hash gate — so arrivals stay rare and
// varied, never one-per-hub (Gary: "maybe not EVERY one"). Integer-only: no float
// gates whether the arch exists (footgun #4); `>>> 0` forces unsigned before the
// modulo, matching getHubPriority. Pure (heart, seed). Adds only an arch descriptor
// (the block consumes no rng), so this is a purely-additive POI-golden move.
function _archAtHub(heart) {
  if (heart.cx + ',' + heart.cz === spawnHubKey()) return true;
  if (heart.rank !== 'major') return false;
  return ((cellHash(heart.cx, heart.cz, SALT.archGate) >>> 0) % 100) < FESTIVAL_TUNING.ARCH_MAJOR_PCT;
}

// A hub centered in open water is NOT a festival site: the stage deck and the
// dancefloor clearing are both anchored at the heart center (dancefloorRect uses
// heart.x/heart.z), so a wet center drops BOTH in the lake (the `water-clear`
// burndown error — every one of which traced to a stage at an in-lake heart). Such
// hubs emit no festival; the lake stands where the festival would. You don't hold a
// festival in the middle of a lake. The SPAWN hub is exempt — the world's single
// entrance arch + Zerble's spawn assume it builds (no baseline seed spawns in a lake,
// but the guard makes it robust for arbitrary live seeds). `lakeAt` is integer-
// quantized and already part of the FROZEN queryPoint golden, so gating existence on
// it moves ONLY the POI golden, never the road/water-existence golden (D21/N6). Pure
// (heart, seed) — consumes no rng — so every NON-suppressed hub stays byte-identical.
function _festivalSuppressed(heart) {
  return heart.cx + ',' + heart.cz !== spawnHubKey() &&
         lakeAt(quantize(heart.x), quantize(heart.z));
}

// Seam-BLIND base plan — what the cross-hub seam pass reads (so it stays non-recursive,
// N1) and the layer the base cache holds. Internal; callers want `festivalPlan` (seamed).
function _basePlan(heart) {
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

// The clusterSeeds this heart's plan must DROP, from cross-hub seam responses that TARGET a
// descriptor owned by this heart (merge/yield/trim → suppress; soft_buffer deferred to 4B.7).
// Order-independent (rides the canonical seam pairs); integer-only. This is the principled,
// order-safe replacement for the load-order-dependent `neighbourCourtHere`/`stageDeckClips`
// builder band-aids (4B.3b / deliberation 002).
function _suppressSetForHeart(heart) {
  const myCell = heart.cx + ',' + heart.cz;
  const set = new Set();
  // Pass a POINT (heart center) — seamResponsesNear → seamPairsNear expands by SEAM_PAIR_REACH
  // ONCE internally, giving the heart ± SEAM_PAIR_REACH window. (Pre-expanding here too would
  // DOUBLE-pad to ±2·reach = 4× the area = 4× the neighbour base-plans warmed — the cold-stall
  // bug. Golden-preserving: the extra far pairs never target this heart.)
  for (const r of seamResponsesNear(heart.x, heart.z, heart.x, heart.z)) {
    if ((r.action === 'suppress' || r.action === 'trim') && r.targetCell &&
        r.targetCell[0] + ',' + r.targetCell[1] === myCell) set.add(r.targetSeed);
  }
  return set;
}

// Public plan = base plan with cross-hub seam suppressions applied (4B.3b). This is what the
// game builds AND what the POI golden hashes — so the seam decision lands in ONE hash
// (deliberation 002, Decision 1). Memoized separately; a pure function of (heart, seed) —
// the suppressions derive from neighbours' seam-blind base plans, which are themselves pure.
export function festivalPlan(heart) {
  if (!heart) return [];
  planGate();
  const key = heart.cx + ',' + heart.cz;
  const hit = _seamedCache.get(key);
  if (hit) return hit;
  const base = _basePlan(heart);
  const drop = _suppressSetForHeart(heart);
  const plan = drop.size ? base.filter(d => !drop.has(d.clusterSeed)) : base;
  if (_seamedCache.size > 4000) _seamedCache.clear();
  _seamedCache.set(key, plan);
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
  if (_festivalSuppressed(heart)) return [];   // hub centered in a lake → no festival
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
  const stageYaw = Math.PI / 2 - fa.bearing;   // model front (+Z) → +F
  // Major hubs get the big main stage; minor hubs roll a tent stage (~35%) for
  // variety (B1) vs the open side stage. Deterministic per hub (cellRng stream).
  // Rolled BEFORE the nudge (the nudge is now rng-free) so the stream position of
  // this draw is unchanged from when nudgeOff was rng-driven for buildable centers.
  const stageKind = major ? 'main_stage' : (rng() < 0.35 ? 'tent_stage' : 'side_stage');
  const stageScale = stageScaleOf(heart);       // rng-free (clusterSeed-derived)
  const stageFootR = (T.KIND_FOOTPRINT[stageKind] || 11) * stageScale;   // deck circle radius
  const stageSpot = nudgeOffStage(heart.x, heart.z, stageFootR, heart);
  const stage = desc(stageKind, stageSpot.x, stageSpot.z, stageYaw, 'core', heart.rank, true, clusterSeed(heart, IDX.stage));
  stage.fbin = fa.bin;                          // serialize F → the POI golden + window-invariance test see it (R18)
  stage.scale = stageScale;
  commit(stage);
  pottyParents.push({ x: stageSpot.x, z: stageSpot.z, yaw: stageYaw, idx: IDX.pottyStage, r: stageFootR });

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
    pottyParents.push({ x: d.x, z: d.z, yaw, idx: IDX.pottyRow + i, r: T.VENDOR_ROW_OFFSET + T.VENDOR_CAMPER_BACK_OFFSET + 2 });
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
        pottyParents.push({ x: d.x, z: d.z, yaw, idx: IDX.pottyCourt + i, r: clusterExtent('food_court') });
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

  // 5. POTTIES — one per placed parent zone (stage / court / row), tucked just PAST the
  //    parent's SOLID edge (par.r + POTTY_GAP), not a fixed 9 m from the center — a fixed
  //    offset landed potties INSIDE the food court's ~24 m truck ring (Gary 2026-06-14:
  //    "a porta potty clipping inside a food truck"). Search a fan of directions starting
  //    hub-outward and take the first that's dry AND clear of every placed zone (so it
  //    can't clip the parent or a sibling); a stage sits at the hub center, so its outward
  //    dir is degenerate and the fan finds a clear side/behind. Parents omitted in steps
  //    1–3 aren't in pottyParents → their potty drops with them (transactional).
  let stageWelfareSpot = null;   // the stage's potty bank — the bubble amenity joins it (step 7)
  for (const par of pottyParents) {
    const reach = par.r + T.POTTY_GAP;
    const base = Math.atan2(par.z - heart.z, par.x - heart.x);   // hub-outward (0 for the centered stage)
    for (let k = 0; k < 6; k++) {
      const ang = base + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (Math.PI / 3);   // 0, ±60, ±120, 180
      const spot = nudgeOff(par.x + Math.cos(ang) * reach, par.z + Math.sin(ang) * reach, rng);
      if (!spot) continue;
      const ps = [{ t: 'circle', x: spot.x, z: spot.z, r: T.KIND_FOOTPRINT.porta_bank || 3 }];
      if (placed.some((pl) => clustersOverlap(ps, pl.s, 1))) continue;   // don't clip the parent or a sibling
      out.push(desc('porta_bank', spot.x, spot.z, par.yaw, 'core', heart.rank, false, clusterSeed(heart, par.idx)));
      if (par.idx === IDX.pottyStage) stageWelfareSpot = { x: spot.x, z: spot.z };
      break;
    }
  }

  // 6. ARCH — the festival's entrance gateway, now an ARRIVAL grammar feature of MAJOR
  //    hubs (D9/4B.4): the spawn hub ALWAYS gets it (the hero gateway Zerble opens
  //    through, D18 intact there), plus ~ARCH_MAJOR_PCT% of other majors via `_archAtHub`
  //    — so a handful of big hubs read as a "you've arrived" threshold, but it's never
  //    one-per-hub (revises D18's world-single-arch, which was a reaction to arches at
  //    every MINOR hub). On a road that leads to the stage, set back ≥ 2 × dancefloor
  //    depth (relaxation ladder so the spawn arch always places); clear of market/courts;
  //    Zerble opens just outside the spawn arch facing through it (main.js). The planner
  //    owns it (buildSpawnArch removed). Adds no rng draw → purely-additive golden move.
  if (_archAtHub(heart)) {
    const floorDepth = T.DANCEFLOOR_DEPTH_BASE * (stage.scale || 1);
    const deckR = (T.KIND_FOOTPRINT[stage.kind] || 11) * (stage.scale || 1);
    // PREFER ≥ 2 dancefloor-lengths from the stage (Gary), but the ONE arch MUST exist
    // by the stage, so relax the minimum toward the deck if no road can host it that far.
    const minLadder = [2 * floorDepth, 1.5 * floorDepth, floorDepth, T.ARCH_MIN_STAGE_DIST + deckR];
    let archPlaced = false;
    for (const archMin of minLadder) {
      for (const rd of roads) {
        const cap = Math.min(MAX_POI_REACH, (rd.lenQ * T.ARCH_DRAG_FRAC) | 0);
        if (cap < archMin) continue;
        for (let d = archMin; d <= cap; d += 6) {
          const p = walkOriented(rd.oriented, d);
          if (Math.hypot(p.x - stage.x, p.z - stage.z) < archMin) continue;
          if (lakeAt(quantize(p.x), quantize(p.z))) continue;            // dry
          const yaw = Math.PI / 2 - p.bearing;
          if (!fits(clusterShapes('arch', 1, p.x, p.z, yaw))) continue;  // clear of market + courts
          commit(desc('arch', p.x, p.z, yaw, 'core', heart.rank, true, clusterSeed(heart, IDX.arch)));
          archPlaced = true;
          break;
        }
        if (archPlaced) break;
      }
      if (archPlaced) break;
    }
  }

  // 7. BUBBLE VENDOR — one GUARANTEED refuel per hub (refuel is a core verb, so it
  //    stays guaranteed, D15). Welfare-bundle reframe (Gary 2026-06-16): the bubble
  //    vendor IS the hub's water/refill AMENITY, so it co-locates with the stage's
  //    porta-bank to read as one welfare station by the busy core — not a prop on a
  //    quiet road. A deterministic fan tucks it beside that potty on the plaza-facing
  //    side, clear of placed zones + dry. Falls back to the old road-walk / center
  //    scatter when the stage had no potty (rare), so the guaranteed refuel persists.
  {
    let spot = null, yaw = rng() * Math.PI * 2;
    if (stageWelfareSpot) {
      const gap = (T.KIND_FOOTPRINT.porta_bank || 3) + (T.KIND_FOOTPRINT.bubble_vendor || 3) + 1.5;
      const toward = Math.atan2(heart.z - stageWelfareSpot.z, heart.x - stageWelfareSpot.x);   // toward the plaza
      for (let k = 0; k < 6 && !spot; k++) {
        const ang = toward + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (Math.PI / 3);
        const cx = stageWelfareSpot.x + Math.cos(ang) * gap, cz = stageWelfareSpot.z + Math.sin(ang) * gap;
        if (queryPoint(cx, cz).noBuild) continue;
        if (placed.some((pl) => clustersOverlap(clusterShapes('bubble_vendor', 1, cx, cz, 0), pl.s, 1))) continue;
        spot = { x: quantize(cx), z: quantize(cz) };
        yaw = roadFacingYaw(queryPoint(cx, cz).facing, rng);
      }
    }
    if (!spot && roads.length) {
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
