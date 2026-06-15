// Festival ARRANGEMENT tuning — the single named surface for the distances
// *between* placed festival things (ring radii, booth spacing, row/camper
// offsets, dancefloor bases, walk distances along approach roads, per-hub
// cluster counts, KIND_FOOTPRINT). The planner (festival.js) and the 3D build
// half (chunks.js worldgen builders) both read this so the hub viewer's
// slider panel (group 6.4) can tune the festival's COMPOSITION live, the way
// constants.js CONFIG already lets the 2D map sandbox tune the worldgen
// FEATURE layer (hearts/lakes/roads/density).
//
// ── Dependency direction (BINDING) ───────────────────────────────────────────
// This module imports NOTHING. `src/worldgen/*` is the render-agnostic layer:
// it must never import chunks.js / registry.js / lakes.js / models/*. That is
// what lets the node linter (group 4) and the hub viewer import it freely. The
// arrows only ever point INTO worldgen/, never out. (constants.js obeys the
// same rule; tuning.js is its festival-arrangement sibling.)
//
// ── In / out rule (design D-B) ───────────────────────────────────────────────
// IN  — arrangement: the space BETWEEN bodies. Ring radii, booth spacing, row +
//       camper offsets, dancefloor depth/halfwidth bases, cluster walk
//       distances, potty attach offset, court/vendor counts, KIND_FOOTPRINT.
// OUT — model-internal dimensions (a truck's own width, a tent's canopy radius
//       as a MESH property). Models own their bodies; tuning owns the space
//       between bodies. Where a model dimension feeds an arrangement decision
//       (e.g. the food-court ring is `MULT × FOOD_TRUCK_SCALE`), the live model
//       export is multiplied at the call site so there is nothing to drift; and
//       where the node linter needs a model-derived extent it cannot import,
//       MODEL_DIMS holds a COPY that chunks.js drift-asserts against the live
//       export (dev-only, localhost). See chunks.js `assertTuningDrift`.
//
// ── Mutable CONFIG + setter (from day one) ───────────────────────────────────
// FESTIVAL_TUNING is a mutable object; readers access `FESTIVAL_TUNING.X`
// per-call (NEVER destructure at module scope) so a live slider edit takes
// effect on the next plan/build without reload. Mutating it must bump the
// worldgen epoch (constants.js `bumpWorldgen`) so the festivalPlan / front-axis
// memo caches invalidate — `setFestivalTuning` does NOT call bump itself
// (tuning.js imports nothing); the slider panel calls bump after patching, the
// same contract map-sandbox `setConfig` already follows.
//
// ── Determinism (footgun #4) ─────────────────────────────────────────────────
// Hoisting a literal into FESTIVAL_TUNING is VALUE-IDENTICAL by construction —
// every default below is the exact number that lived at its old site, and no
// rng() call was reordered, added, or removed. The golden-frozen snapshot diff
// (3 seeds, canary counts) is the proof.
//
// ── INVENTORY — every hoisted constant, its old file:line, and the do-NOT-merge
//    near-duplicates (task 2.1; "cite or cut") ──────────────────────────────────
//
//  PLANNER (festival.js) — hoisted:
//    DANCEFLOOR_DEPTH_BASE 38            festival.js:92
//    DANCEFLOOR_HALFWIDTH_BASE 17        festival.js:93
//    stage-scale 1.15/0.25, 1.0/0.5      festival.js:107  (twins of chunks.js:2279-2280; see below)
//    food-court walk 86/66 +rng*28       festival.js:394
//    food-court drag frac 0.45           festival.js:394
//    food-court perp 16                  festival.js:397  (added to CONFIG.ROAD_WIDTH/2)
//    vendor-row walk 66/50 +rng*18       festival.js:417
//    vendor-row drag frac 0.34           festival.js:417
//    bubble walk 55/40 +rng*20           festival.js:428
//    bubble perp 5                       festival.js:430  (added to CONFIG.ROAD_WIDTH/2)
//    bubble fallback spread 50           festival.js:434
//    potty attach offset 9               festival.js:368
//    court count major/minor 2/1         festival.js:391
//    row count major/minor 2/1           festival.js:414
//    drum band 130                       festival.js:67   (DRUM_BAND)
//    drum core pad 15                    festival.js:270
//    drum district frac 0.7              festival.js:271
//    drum front-half wedge 0.7           festival.js:272  (FRONT_HALF)
//    nudge ring 10/28/9                  festival.js:253
//    village cell 240, prob 0.25         festival.js:202-203
//    KIND_FOOTPRINT {...}                festival.js:196
//
//  BUILDER (chunks.js worldgen path) — hoisted:
//    food-court count 3 +rng*3           chunks.js:1304
//    food-court ring mult 14             chunks.js:1305   (× FOOD_TRUCK_SCALE)
//    food-court shack prob 0.35          chunks.js:1306
//    food-court shack ring pad 2.5       chunks.js:1315
//    food-court truck r mult 4.4         chunks.js:1336   (× FOOD_TRUCK_SCALE)
//    food-court bubble prob/pad 0.4/3    chunks.js:1353-1354
//    food-court table count 1 +rng*3     chunks.js:1365
//    food-court table ring frac 0.45     chunks.js:1368
//    food-court table min-spacing 3.2    chunks.js:1371
//    food-court torch ring pad 5, n 6    chunks.js:1389-1390
//    vendor-row count 5 +rng*3           chunks.js:1252
//    vendor-row spacing 5.0, offset 7    chunks.js:1253
//    vendor camper prob 0.4              chunks.js:1278
//    vendor camper back offset 6         chunks.js:1279   (added to VENDOR_ROW_OFFSET)
//    camp min-spacing 5.5, radius 30     chunks.js:1414
//    camp fallback target 12 +rng*9      chunks.js:1412
//    camp size mix 0.50/0.85             chunks.js:1425
//    camp guard radius 4                 chunks.js:1420
//
//  EXCLUDED — "same number, two owners, do NOT merge yet" (guardrail #2):
//    - buildVendorRow (legacy theme, chunks.js buildVendorRow): spacing 5.0,
//      offset 7 — SAME numbers as VENDOR_ROW_*, but the legacy non-worldgen
//      theme path. Left as literals; coupling to FESTIVAL_TUNING is grammar work.
//    - buildFoodPlaza (legacy theme, chunks.js buildFoodPlaza): count 3+rng*3,
//      ring 14×scale, shack prob 0.35, shack ring pad 2.5, truck r 4.4×scale —
//      SAME numbers as FOOD_COURT_*, the legacy non-worldgen food court. Left as
//      literals (do NOT merge). (buildFoodCourtAt is the worldgen sibling.)
//    - buildCampVillage (legacy theme, chunks.js buildCampVillage): MIN_SPACING
//      5.5, RADIUS 30, target 12+rng*9, mix 0.50/0.85 — SAME numbers as CAMP_*,
//      legacy non-worldgen path. Left as literals (do NOT merge).
//    - buildStage `dancefloorDepth = 9*scale` (chunks.js:2379): the stage's
//      chair-free zone depth — a DIFFERENT owner than the planner's
//      DANCEFLOOR_DEPTH_BASE 38 (the tree-scatter clearing extent). Same concept,
//      two owners → do NOT merge.
//
//  EXCLUDED — out of scope (not "tunable arrangement"):
//    - buildStage internal audience/chair/light/collider sub-layout
//      (chunks.js:2312-2444): the stage cluster's own BODY, not inter-cluster
//      spacing. Deferred to the grammar change / 6.4 sliders if needed.
//    - ANGLE_BINS 256, DRY_PROBES 6 (festival.js:90-91), MAX_POI_REACH 480
//      (festival.js:68): cross-engine determinism / R16 correctness machinery,
//      not arrangement. Touching them is a determinism change, never a tuning.
//    - SALT.* streams (constants.js:71): not tunable.

export const FESTIVAL_TUNING = {
  // ── Hub dancefloor clearing (planner) ──
  DANCEFLOOR_DEPTH_BASE: 38,        // festival.js:92 — ~3 stage-lengths of cleared floor
  DANCEFLOOR_HALFWIDTH_BASE: 17,    // festival.js:93

  // ── Stage scale (planner stageScaleOf == builder buildStage; MUST stay equal) ──
  STAGE_SCALE_MAJOR_BASE: 1.15, STAGE_SCALE_MAJOR_SPAN: 0.25,   // festival.js:110 / chunks.js:2319
  STAGE_SCALE_MINOR_BASE: 1.0,  STAGE_SCALE_MINOR_SPAN: 0.5,    // festival.js:110 / chunks.js:2320

  // ── Walk distances + offsets along approach roads (planner) ──
  FOOD_COURT_WALK_MAJOR: 86, FOOD_COURT_WALK_MINOR: 66, FOOD_COURT_WALK_SPAN: 28,  // festival.js:394
  FOOD_COURT_DRAG_FRAC: 0.45,       // festival.js:394 — cap walk at this fraction of road length
  FOOD_COURT_PERP: 16,              // festival.js:397 — perp offset past ROAD_WIDTH/2
  VENDOR_ROW_WALK_MAJOR: 66, VENDOR_ROW_WALK_MINOR: 50, VENDOR_ROW_WALK_SPAN: 18, // festival.js:417
  VENDOR_ROW_DRAG_FRAC: 0.34,       // festival.js:417
  BUBBLE_WALK_MAJOR: 55, BUBBLE_WALK_MINOR: 40, BUBBLE_WALK_SPAN: 20,             // festival.js:428
  BUBBLE_PERP: 5,                   // festival.js:430 — perp offset past ROAD_WIDTH/2
  BUBBLE_FALLBACK_SPREAD: 50,       // festival.js:434 — near-center scatter when no road
  POTTY_ATTACH_OFFSET: 9,           // festival.js:368 — porta-bank nudge off its parent cluster

  // ── Per-hub cluster counts (planner) ──
  COURT_N_MAJOR: 2, COURT_N_MINOR: 1,   // festival.js:391 (capped by roads.length)
  ROW_N_MAJOR: 2,   ROW_N_MINOR: 1,     // festival.js:414 (capped by roads.length)

  // ── Zone slotter (planner _computePlan, group 4 / D14) ──
  // The slotter packs each cluster's TRUE oriented extent (clusterShapes) against
  // the accumulating placed[] and OMITS on no-fit, replacing the old scatter-then-
  // resolveOverlaps scalar push. ZONE_MARGIN is the required clearance between two
  // placed zones (passed to clustersOverlap); COURT_MIN_STAGE_DIST is the extra
  // "don't crowd the stage" gate a food court must clear beyond geometric overlap.
  ZONE_MARGIN: 3,            // m — clearance between placed cluster zones
  COURT_MIN_STAGE_DIST: 28,  // m — a food court center must sit at least this far from the stage
  FOOD_COURT_STEP: 18,       // m — outward walk increment when a court must clear the vendor row on its road
  ARCH_DRAG_FRAC: 0.85,      // cap the arch's outward walk at this fraction of the drag length
  ARCH_MAJOR_PCT: 25,        // % of MAJOR hubs (beyond the always-arched spawn hub) that get an entrance arch (4B.4 — integer-hashed, keeps arrivals rare/varied, not every major)
  POTTY_GAP: 5,              // m past a parent cluster's solid edge to tuck its porta-bank

  // ── Drum-circle district band (planner treedDistrictSpot) ──
  DRUM_BAND: 130,           // festival.js:67  — max reach past core (bounds MAX_POI_REACH; R16)
  DRUM_CORE_PAD: 15,        // festival.js:270 — r0 = core + this
  DRUM_DISTRICT_FRAC: 0.7,  // festival.js:271 — r1 cap = district * this
  DRUM_FRONT_HALF: 0.7,     // festival.js:272 — ~40° wedge around +F kept clear (the dancefloor)

  // ── nudgeOff search ring (planner) ──
  NUDGE_R_MIN: 10, NUDGE_R_MAX: 28, NUDGE_R_STEP: 9,   // festival.js:253

  // ── Camp village coarse grid (planner) ──
  VILLAGE_CELL: 240,        // festival.js:202
  VILLAGE_PROB: 0.25,       // festival.js:203 — a discovery, not a carpet

  // ── Cluster footprint envelopes (planner KIND_FOOTPRINT, festival.js:196) ──
  KIND_FOOTPRINT: {
    main_stage: 11, side_stage: 8, tent_stage: 13, arch: 6, food_court: 16,
    vendor_row: 12, bubble_vendor: 3, drum_circle: 6, porta_bank: 3, camp_village: 32,
  },

  // ── Food-court ring (builder buildFoodCourtAt, chunks.js:1303) ──
  FOOD_COURT_COUNT_BASE: 3, FOOD_COURT_COUNT_SPAN: 3,   // chunks.js:1304 — 3..5 trucks
  FOOD_COURT_RING_MULT: 14,         // chunks.js:1305 — ring = MULT × FOOD_TRUCK_SCALE
  FOOD_COURT_SHACK_PROB: 0.35,      // chunks.js:1306
  FOOD_COURT_SHACK_RING_PAD: 2.5,   // chunks.js:1315 — shack sits ring+pad out
  FOOD_COURT_TRUCK_R_MULT: 4.4,     // chunks.js:1336 — truck footprint = MULT × FOOD_TRUCK_SCALE
  FOOD_COURT_BUBBLE_PROB: 0.4, FOOD_COURT_BUBBLE_RING_PAD: 3,   // chunks.js:1353-1354
  FOOD_COURT_TABLE_COUNT_BASE: 1, FOOD_COURT_TABLE_COUNT_SPAN: 3, // chunks.js:1365 — 1..3 tables
  FOOD_COURT_TABLE_RING_FRAC: 0.45, // chunks.js:1368 — tables within ring×frac of center
  FOOD_COURT_TABLE_MIN_SPACING: 3.2,// chunks.js:1371
  FOOD_COURT_TORCH_RING_PAD: 5, FOOD_COURT_TORCH_COUNT: 6,      // chunks.js:1389-1390

  // ── Vendor row (builder buildVendorRowAt, chunks.js:1251) ──
  VENDOR_ROW_COUNT_BASE: 5, VENDOR_ROW_COUNT_SPAN: 3,   // chunks.js:1252 — 5..7 per side
  VENDOR_ROW_SPACING: 5.0,          // chunks.js:1253 — booth-to-booth along road
  VENDOR_ROW_OFFSET: 7,             // chunks.js:1253 — half-width of the aisle
  VENDOR_CAMPER_PROB: 0.4,          // chunks.js:1278 — camper tent behind ~40% of stalls
  VENDOR_CAMPER_BACK_OFFSET: 6,     // chunks.js:1279 — added to VENDOR_ROW_OFFSET, behind the stall

  // ── Camp village packing (builder buildCampVillageAt, chunks.js:1409) ──
  CAMP_MIN_SPACING: 5.5, CAMP_RADIUS: 30,               // chunks.js:1414
  CAMP_TARGET_BASE: 12, CAMP_TARGET_SPAN: 9,            // chunks.js:1412 — fallback when plan tents absent
  CAMP_SIZE_SMALL_BELOW: 0.50, CAMP_SIZE_MEDIUM_BELOW: 0.85,    // chunks.js:1425
  CAMP_GUARD_RADIUS: 4,             // chunks.js:1420 — skip near existing buildings

  // ── Linter thresholds (lint.js group 4.7; Gary playtest 2026-06-12) ──────────
  // NOT arrangement constants — the planner/builders never read these. They are
  // the tunable cutoffs for the `drum-in-trees` + `arch-placement` quality rules,
  // parked here (Gary's call) so they live with the rest of the festival knobs.
  // Adding them is value-neutral for the world (no rng, no build read → goldens
  // + snapshots unaffected).
  DRUM_TREE_RADIUS: 30,        // m — radius around a drum circle sampled for tree presence
  DRUM_TREE_MIN: 6,            // registry: min forest_tree within radius to read as "in trees"
  DRUM_TREE_MIN_DENSITY: 0.2,  // plan: min treeDensity(x,z) for a treed pocket (no built trees to count)
  ARCH_MIN_STAGE_DIST: 30,     // m — spawn arch must sit at least this far from the stage (past the string-light rows)
};

// Live patch + epoch bump contract: callers (the 6.4 slider panel) do
//   setFestivalTuning({ VENDOR_ROW_OFFSET: 9 }); bumpWorldgen();
// in that order. setFestivalTuning stays import-free (no bump here).
export function setFestivalTuning(patch) {
  Object.assign(FESTIVAL_TUNING, patch);
}

// Model-derived dimensions COPIED here so the node linter (group 4 plan-mode,
// which cannot import src/models/*) can compute cluster extents. chunks.js
// drift-asserts these against the live model exports (dev-only, localhost) —
// if an assert fires, a model body changed and BOTH must be updated. These are
// NOT tunables (they mirror a mesh property), hence kept out of FESTIVAL_TUNING.
export const MODEL_DIMS = {
  FOOD_TRUCK_SCALE: 1.7,    // foodTruck.js:9
  SUGAR_SHACK_W: 6.4,       // sugarShack.js:37 FACADE_WIDTH
  SUGAR_SHACK_D: 9.0,       // sugarShack.js:48 DEPTH + 1.0
  POTTY_SPACING: 2.5,       // portaPotty.js:25
};

// ── Oriented cluster extents (group 3, design D3) ────────────────────────────
// `clusterExtent` (below) is the legacy SCALAR radius — conservative but it
// over-estimates the short axis of long clusters (a vendor row is an ~18×40 m
// rectangle, not a 22 m circle) and ignores orientation, which is exactly why
// `resolveOverlaps`' scalar-radius packing guaranteed clipping (ROADMAP
// "Festival layout" root cause). `clusterShapes` promotes each kind to its TRUE
// oriented occupancy as a list of convex primitives in WORLD coords:
//   { t:'circle', x, z, r }
//   { t:'obb',    x, z, ux, uz, hl, hw }   // center; UNIT forward axis (ux,uz);
//                                          //   hl = half-length along it, hw = half-width perp
// A cluster with distinct parts is one list — a stage is its deck CIRCLE plus the
// directional dancefloor OBB in front (D3: "deck + front dancefloor"; the D8
// "do-NOT-merge" dancefloor pair merges HERE — one dancefloor definition, shared
// by the planner's dancefloorRect and this extent). The group-4 zone slotter and
// the linter test occupancy with `clustersOverlap`; the overlay draws the shapes.
//
// yaw is the descriptor's three.js Y-rotation: a group at yaw θ maps its local
// +Z ("front") to world (sinθ, cosθ) — so the forward axis u = (sin yaw, cos yaw),
// matching festival.js roadFacingYaw. Derived from the SAME FESTIVAL_TUNING +
// MODEL_DIMS the builder reads, so plan extent == built extent by construction
// (the MODEL_DIMS drift guard — chunks.js assertTuningDrift + bin/check-model-dims
// — keeps the copied dims honest).
export function clusterShapes(kind, scale = 1, x = 0, z = 0, yaw = 0) {
  const T = FESTIVAL_TUNING;
  const ux = Math.sin(yaw), uz = Math.cos(yaw);   // unit forward axis (+Z under yaw)
  if (kind === 'vendor_row') {
    // Booth lines run ALONG the road (the descriptor yaw = π/2 − road-bearing, so
    // +Z is the road tangent = the long axis). Width = aisle half + camper band
    // behind the far side. Centered ON the road point (the drivable aisle).
    const hl = ((T.VENDOR_ROW_COUNT_BASE + T.VENDOR_ROW_COUNT_SPAN - 1) / 2) * T.VENDOR_ROW_SPACING;
    const hw = T.VENDOR_ROW_OFFSET + T.VENDOR_CAMPER_BACK_OFFSET + 2;
    return [{ t: 'obb', x, z, ux, uz, hl, hw }];
  }
  if (kind === 'main_stage' || kind === 'side_stage' || kind === 'tent_stage') {
    // Deck circle at center + the dancefloor clearing OBB extending +F. depth /
    // halfWidth are the planner dancefloorRect values (DANCEFLOOR_*_BASE × scale)
    // — one source, so a drum BEHIND the stage is NOT inside the (forward-only)
    // floor, the false-positive radial extents always produced.
    const deckR = (T.KIND_FOOTPRINT[kind] || 11) * scale;   // deck box scales with the stage (stage.js w/d × scale)
    const depth = T.DANCEFLOOR_DEPTH_BASE * scale;
    const halfWidth = T.DANCEFLOOR_HALFWIDTH_BASE * scale;
    return [
      { t: 'circle', x, z, r: deckR },
      { t: 'obb', x: x + ux * depth / 2, z: z + uz * depth / 2, ux, uz, hl: depth / 2, hw: halfWidth },
    ];
  }
  // Radial kinds (food court ring, camp village, porta-bank, bubble, drum, arch):
  // the legacy scalar extent IS the right circle for these.
  return [{ t: 'circle', x, z, r: clusterExtent(kind, scale) }];
}

// Overlap predicates over the convex primitives above. `margin` = required
// clearance between the two (two shapes are "too close" if within `margin`).
function _circCirc(a, b, m) { return Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r + m; }
function _circObb(c, o, m) {
  const rx = c.x - o.x, rz = c.z - o.z;
  const along = rx * o.ux + rz * o.uz;
  const lat = rx * -o.uz + rz * o.ux;
  const dx = along - Math.max(-o.hl, Math.min(o.hl, along));
  const dz = lat - Math.max(-o.hw, Math.min(o.hw, lat));
  return Math.hypot(dx, dz) < c.r + m;
}
function _obbObb(a, b, m) {
  // Separating-axis test over both boxes' face normals (all unit). Separated on
  // any axis ⇒ no overlap; `m` inflates the required gap.
  const axes = [[a.ux, a.uz], [-a.uz, a.ux], [b.ux, b.uz], [-b.uz, b.ux]];
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [px, pz] of axes) {
    const pa = Math.abs(a.ux * px + a.uz * pz) * a.hl + Math.abs(-a.uz * px + a.ux * pz) * a.hw;
    const pb = Math.abs(b.ux * px + b.uz * pz) * b.hl + Math.abs(-b.uz * px + b.ux * pz) * b.hw;
    if (Math.abs(dx * px + dz * pz) > pa + pb + m) return false;
  }
  return true;
}
export function shapesOverlap(a, b, m = 0) {
  if (a.t === 'circle' && b.t === 'circle') return _circCirc(a, b, m);
  if (a.t === 'circle') return _circObb(a, b, m);
  if (b.t === 'circle') return _circObb(b, a, m);
  return _obbObb(a, b, m);
}
// Any primitive of listA within `margin` of any primitive of listB.
export function clustersOverlap(listA, listB, m = 0) {
  for (const a of listA) for (const b of listB) if (shapesOverlap(a, b, m)) return true;
  return false;
}
// Is world point (x,z) inside any primitive of a cluster's shape list?
export function shapesContainPoint(list, x, z) {
  for (const s of list) {
    if (s.t === 'circle') { if (Math.hypot(s.x - x, s.z - z) <= s.r) return true; }
    else {
      const rx = x - s.x, rz = z - s.z;
      const along = rx * s.ux + rz * s.uz, lat = rx * -s.uz + rz * s.ux;
      if (Math.abs(along) <= s.hl && Math.abs(lat) <= s.hw) return true;
    }
  }
  return false;
}

// Conservative per-kind outer-extent (radius from the cluster center, meters)
// for the group-4 linter plan-mode + the map-sandbox overlay. APPROXIMATE by
// design — registry mode is the exact authority (design D-D). Derived from
// FESTIVAL_TUNING + MODEL_DIMS so it tracks live tuning. A stage's scale-driven
// growth is passed by the caller (default 1). Retained as the bounding radius
// `clusterShapes` builds its circles from; the oriented API above is the one the
// slotter + linter overlap tests should prefer.
export function clusterExtent(kind, scale = 1) {
  const T = FESTIVAL_TUNING, M = MODEL_DIMS;
  switch (kind) {
    case 'food_court': {
      const ring = T.FOOD_COURT_RING_MULT * M.FOOD_TRUCK_SCALE;
      const truckR = T.FOOD_COURT_TRUCK_R_MULT * M.FOOD_TRUCK_SCALE;
      const shackHalf = Math.hypot(M.SUGAR_SHACK_W, M.SUGAR_SHACK_D) / 2;
      // outermost = the torch ring, but a shack sits ring+pad+its own half out
      return Math.max(ring + T.FOOD_COURT_TORCH_RING_PAD,
                      ring + T.FOOD_COURT_SHACK_RING_PAD + shackHalf,
                      ring + truckR);
    }
    case 'vendor_row': {
      // half-length of the booth line + the camper tucked behind the far side
      const halfLen = ((T.VENDOR_ROW_COUNT_BASE + T.VENDOR_ROW_COUNT_SPAN - 1) / 2) * T.VENDOR_ROW_SPACING;
      const lateral = T.VENDOR_ROW_OFFSET + T.VENDOR_CAMPER_BACK_OFFSET + 2;
      return Math.hypot(halfLen, lateral);
    }
    case 'camp_village':
      return T.CAMP_RADIUS + T.CAMP_MIN_SPACING;
    case 'main_stage': case 'side_stage': case 'tent_stage':
      // deck + dancefloor clearing scales with the stage
      return (T.KIND_FOOTPRINT[kind] || 11) + T.DANCEFLOOR_DEPTH_BASE * scale;
    case 'porta_bank':
      // A bank of 3 units at POTTY_SPACING (units ~2.2 m wide) → bounding half-span =
      // one spacing out to the outer unit + half a unit. (Was POTTY_ATTACH_OFFSET +
      // POTTY_SPACING = 11.5, which wrongly folded in the 9 m offset-TO-PARENT — a
      // position, not a size — so the linter saw a ~23 m-wide potty and false-flagged a
      // drum 10 m away as "inside a porta_bank envelope". The slotter places potties by
      // KIND_FOOTPRINT.porta_bank and never commits their clusterShapes, so clusterExtent
      // for porta_bank is read by the linter + overlay ONLY → this fix is golden-free.)
      return M.POTTY_SPACING + 1.1;
    default:
      return T.KIND_FOOTPRINT[kind] || 4;
  }
}
