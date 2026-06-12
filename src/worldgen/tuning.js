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
//    - buildVendorRow (legacy theme, chunks.js:1935-1936): spacing 5.0, offset 7
//      — SAME numbers as VENDOR_ROW_*, but the legacy non-worldgen theme path.
//      Left as literals; coupling it to FESTIVAL_TUNING is grammar-change work.
//    - buildCampVillage (legacy theme, chunks.js:2217-2239): MIN_SPACING 5.5,
//      RADIUS 30, target 12+rng*9, mix 0.50/0.85 — SAME numbers as CAMP_*,
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
  STAGE_SCALE_MAJOR_BASE: 1.15, STAGE_SCALE_MAJOR_SPAN: 0.25,   // festival.js:107 / chunks.js:2279
  STAGE_SCALE_MINOR_BASE: 1.0,  STAGE_SCALE_MINOR_SPAN: 0.5,    // festival.js:107 / chunks.js:2280

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

// Conservative per-kind outer-extent (radius from the cluster center, meters)
// for the group-4 linter plan-mode + the map-sandbox overlay. APPROXIMATE by
// design — registry mode is the exact authority (design D-D). Derived from
// FESTIVAL_TUNING + MODEL_DIMS so it tracks live tuning. A stage's scale-driven
// growth is passed by the caller (default 1).
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
      return T.POTTY_ATTACH_OFFSET + M.POTTY_SPACING;
    default:
      return T.KIND_FOOTPRINT[kind] || 4;
  }
}
