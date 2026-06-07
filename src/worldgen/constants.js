// Worldgen tunables — the single named-constant surface (deliberation CG1.7),
// exposed as a MUTABLE CONFIG object so the 2D sandbox can bind live sliders to
// it and re-roll the map instantly (GATE-1 by-eye tuning, Q1). Layers read
// CONFIG.* per-call (never destructure at module scope) so edits take effect
// without reload.
//
// Defaults below were tuned by Gary in the map sandbox on 2026-06-06.

export const CONFIG = {
  // --- Hearts ---------------------------------------------------------------
  // Tightened from 440 (Gary 2026-06-07: v2 read WAY too sparse — wide-open fields with
  // just scattered people). 340 (not Gary's first-pass 260) is deliberate: it keeps the
  // nearestHeart scan window at 4 cells (`ceil(1000/340)+1`), where 260 would blow it to
  // 5 (121 cells/query) AND 260+noneBelow:0 hung the 2D sandbox + spiked chunk-gen to
  // 335ms with zero breathing room (the road negative-control self-test lost its teeth —
  // no road-sparse region left anywhere). 340 + 75%-filled is ~2.6× denser than 440/52%
  // (festivals ~390m apart vs ~610m) while staying affordable + leaving open stretches.
  HEART_CELL: 340,            // macrocell size (m)
  HEART_JITTER: 0.40,         // candidate offset, fraction of cell (±); keep ≤ 0.5
  // Cumulative rank thresholds over a [0,1) roll. ~75% of cells now host a heart (was
  // ~52%) so the world reads festival-dense, but ~25% stay empty for breathing room.
  HEART_RANK: { noneBelow: 0.25, minorBelow: 0.96 },  // ≈25% none, ≈71% minor, 4% major
  HEART_DOMAIN: {
    minor: { core: 95,  district: 290 },
    major: { core: 350, district: 1000 },   // majors are big regional hubs
  },

  // --- Lakes ----------------------------------------------------------------
  LAKE_CELL: 1050,
  LAKE_PROB: 0.60,
  LAKE_JITTER: 0.35,
  LAKE_RADIUS: { min: 70, max: 150 },     // base radius before shaping
  LAKE_ELONGATE: 1.9,                     // max major/minor axis ratio (peanut/oval)
  LAKE_CIRCLE_FRAC: 0.12,                 // fraction that stay ~circular
  LAKE_NEIGHBORHOOD_CELLS: 1,

  // --- Forests / density (CG4) ----------------------------------------------
  DENSITY_CELL: 230,          // woodland-noise grain (smaller = patchier forests)
  DENSITY_CLEAR_PAD: 30,
  DENSITY_THRESHOLD: 0.36,    // noise below this = open field; lower = more forest
  LAKE_RING_BAND: 70,         // tree-ring width beyond a lakeshore

  // --- Roads (CG3, static until GATE 2) -------------------------------------
  ROAD_MAX_NEIGHBORS: 3,
  ROAD_MAX_EDGE_CELLS: 3,
  ROAD_WIDTH: 7,
  ROAD_LAKE_DETOUR: 35,       // clearance an around-the-lake detour rides outside the shore
};

// Worldgen "epoch" — bumped whenever CONFIG is mutated (the sandbox sliders call
// bumpWorldgen() on change). Per-cell memo caches gate on (seed, epoch) so live
// tuning invalidates them correctly while a static seed stays fully cached.
let EPOCH = 0;
export function bumpWorldgen() { EPOCH++; }
export function worldgenEpoch() { return EPOCH; }

// Derived scan window for nearestHeart: must cover the largest district, or a
// big heart's influence could reach a point the scan never looks at (the
// council's "window truncation" CRITICAL risk). +1 cell jitter pad. Recomputed
// from live CONFIG so it stays correct as districts are tuned.
export function heartNeighborhoodCells() {
  const maxDistrict = Math.max(CONFIG.HEART_DOMAIN.minor.district, CONFIG.HEART_DOMAIN.major.district);
  return Math.max(2, Math.ceil(maxDistrict / CONFIG.HEART_CELL) + 1);
}

// Derived (read at call time in CG3): how far to scan for arterial endpoints.
export function roadNeighborhoodCells() {
  return Math.ceil(CONFIG.ROAD_MAX_EDGE_CELLS) + 1;
}

// Determinism salts — distinct integer streams per layer, away from lakes.js /
// forests.js literals so worldgen features don't spatially correlate with the
// existing (to-be-retired) lake/forest placement. NOT tunable.
export const SALT = {
  heartRank:   0x4D41_01,
  heartJitter: 0x4D41_02,
  lakeCell:    0x4D41_03,
  lakeJitter:  0x4D41_04,
  lakeShape:   0x4D41_07,
  roadPair:    0x4D41_05,
  density:     0x4D41_06,
  roadProxy:   0x4D41_08,   // dead-centre fallback angle for a lake-heart's shore proxy
  roadSide:    0x4D41_09,   // which way a detour wraps a lake when both ways are equal
  placement:   0x4D41_0A,   // 3D placement jitter (placement.js) — fresh stream, no collision
  poiLayout:   0x4D41_0B,   // per-heart festival POI layout (festival.js) — fresh, no collision
  poiVillage:  0x4D41_0C,   // camp-village coarse-grid placement (festival.js) — fresh, no collision
};
