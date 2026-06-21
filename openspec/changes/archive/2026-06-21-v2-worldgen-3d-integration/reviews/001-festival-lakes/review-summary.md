# Code Review Summary — v2-worldgen festival + spawn + lakes

## Review Metadata
- **Diff Scope:** custom — `git diff 0ee3c7c..HEAD` (commits 7ba2805 plan/deliberate-002, bc2f9f3 CG1, c5d8df1 CG2/CG3, 8548ecb D2.6 spawn, 92bd0c8 HANDOFF, 209e850 Group E lakes)
- **Reviewed Files:** 24 (code: chunks.js, lakes.js, main.js, worldgen/{festival,placement,hearts,roads,constants,selftest}.js, index.html, sandbox.html, map-sandbox.html; docs/openspec: the rest)
- **OpenSpec Change:** `openspec/changes/v2-worldgen-3d-integration`
- **Specialists Used:** review-rendering, review-performance, review-gameplay, review-audio, review-sandbox, review-docs (all 6, one parallel batch)
- **Date:** 2026-06-07

## Intent Match
The diff does what the CHANGELOG/commits/session-log claim: a pure `festival.js` POI layer
drives structured, feature-anchored clusters (stages, arches+lights, food-truck courts,
double-row vendor markets, drum circles, 12–20-site camp villages, porta banks) lining a
heart's approach roads; spawn relocates to the nearest major heart's arch facing the stage;
and Group E swaps `LakeManager` to read worldgen lakes so rendered water == the water the
layout plans around. All behind `?worldgen=1` (`DEFAULT_WORLDGEN_V2=false`). Three specialists
(rendering, audio, docs) returned **clean**; the others raised only P3s plus one P1 that was a
verification-confidence concern, now closed.

## Findings

### Resolved in this review-response commit
- [P2][low][review-sandbox] map-sandbox.html:26-28 - `worldgen/placement` missing from the `wg`
  cache-buster array. Inert today (map-sandbox doesn't import placement), but a consistency
  footgun for a future agent. **FIXED** — added to the array.
- [P3][low][review-gameplay] map-sandbox.html:418 - POI golden not shown in the on-screen
  self-test readout (only `queryPoint`), blocking the D2.8 browser cross-engine POI check.
  **FIXED** — the readout now prints `POI ${r.poiGoldenHash}`.
- [P3][low][review-gameplay] src/worldgen/festival.js:139 - `treedDistrictSpot` branches on a
  raw `qp.treeDensity >= 0.25` (R20's quantize-before-compare class). Assessed as the ACCEPTED
  cosmetic cross-engine fork (drum is the LAST consumer of the heart's poiLayout stream → no
  sibling desync; output quantized; single-engine fully reproducible; same class as the
  node-vs-browser golden disparity). **DOCUMENTED** in the festival.js determinism header +
  named in D2.7 so the sign-off pass rules on it deliberately (accept or quantize-and-re-record).
- [P3][low][review-rendering] src/lakes.js:437 - stale comment claimed WATER_MAT drives a
  "star shimmer" shader (the patch was removed). **FIXED** — comment corrected.

### Verified (no change needed)
- [P1→resolved][high][review-sandbox] The whole game-side payload is behind `USE_WORLDGEN_V2`
  (default OFF), so a default-flag smoke test proves nothing — verification MUST use `?worldgen=1`
  and cross chunks owning each cluster kind. **CONFIRMED DONE:** verification was run at
  `?worldgen=1&seed=1234` (noon + midnight, default + low tier). The two cluster kinds the prior
  passes hadn't streamed were closed in this review: `drum_circle` builds at (1034,-50) (registry
  entry, no crash) and a `camp_village` packs 12 campsites at (156,-842) (no crash). Combined with
  earlier coverage (stage/arch/court/vendor/lakeside-camps/spawn/lakes), every `buildWorldgenKind`
  return-shape path is exercised crash-free; zero console errors throughout.
- [P3][low][review-performance] Heart-owning chunk builds a full cluster-stack in one frame (R11),
  but bounded by `BUDGET_PER_FRAME=1` + `(seed,epoch)`-memoized plan. Gate = headless `chunkGenStats`
  at `?perf=low` boosting through a major (D2.0c/D2.8, still open). Not a regression.
- [P3][low][review-performance] `placePolePair` (chunks.js:2206) allocates un-pooled/un-instanced
  string-light geo per arch — pre-existing pattern (sugarShack.js already solved it with
  `STRING_BULB_GEO`+InstancedMesh), allocation-bounded, ~10 draws. Parkable cleanup, not a blocker.
- [P3][low][review-performance] Per-lake forest ring count unchanged; the real ring-density blowup
  (R9) is Group F's `density.js LAKE_RING_BAND`, not this diff. Re-budget when F lands.
- **review-rendering:** R5 winding chain sound (CCW → inward collider normal; water reverse-walk →
  +Y; DoubleSide backstop), disposal dispose-safe (WATER_MAT + sugar-shack pools tagged
  `userData.shared`; food-court re-keys `cookEntry.chunkKey`), return shapes correct per builder,
  no reflexive `castShadow`, InstancedMesh `needsUpdate` set, no `THREE.X=Y` anywhere.
- **review-gameplay:** `queryPoint` golden `63c8dea2` untouched (POI layer read-only); new salts
  `0x4D41_0B`/`0x4D41_0C` collision-free; `approachRoadsOf` adds zero rng draws; `nearestMajorHeart`
  +2-rings-after-hit proven sufficient (T6); `placement.js` half-open ownership = one owner/seam;
  `MAX_POI_REACH=480` covers the farthest (drum) cluster; lake colliders carry NO chunkKey (footgun
  #5); `cctx` clusterSeed severs build-rng from ctx.rng draw order (R19); spawn deterministic +
  null-safe; legacy lake branch byte-identical.
- **review-audio:** iOS sync-gesture chain intact (spawn block is module-eval, no async hop before
  `Sound.init`); attach-music-once holds (half-open ownership → one build → one attach; unload
  detaches by chunkKey).
- **review-docs:** CHANGELOG same-commit discipline clean (every slice dated 2026-06-07, project
  voice); ROADMAP correctly untrimmed (flag-off, not shipped); ARCHITECTURE.md I.6 rewrite correctly
  still tracked open; no Easter-egg leak; openspec docs consistent with shipped state.

## Verification Gap
- Sandbox-verified: N/A (festival/lakes are game-only, not entity-sandbox; map-sandbox 2D overlay
  verified the LAYOUT). Game-booted: YES — `?worldgen=1&seed=1234`, noon + midnight, default + low
  tier, zero console errors; every cluster kind streamed crash-free; lake collision blocks+damages+
  ejects; `?worldgen=0` byte-identical. Headless: self-test 24/24, goldens `63c8dea2`/`f8dc276d`;
  R5 winding CCW across 22 lakes; in-game point-in-poly == worldgen `lakeAt` within 0.3m.
- Open (tracked, NOT this diff): mid-tier (`?perf=mid`) full budget pass + headless `chunkGenStats`
  R11 gate (D2.0c/D2.8); browser POI golden cross-engine recording (D2.8, now readable via the
  map-sandbox readout fix); R27 spawn-clearance veto (large collider near spawn — deferred).

## Verdict
**Approve with changes** — and the changes (4 small fixes above) are applied in the review-response
commit. No P0/P1 code defects; the lone P1 was a verification-confidence flag, now satisfied. The
remaining P3s are pre-existing patterns or already-tracked Group-F/D2.8 follow-ups.
