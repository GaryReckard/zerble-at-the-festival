// Determinism harness (deliberation CG1.5) — REAL teeth, not "query twice in
// two orders" (queryPoint is already pure, so that proves nothing).
//
// `runSelfTest()` returns `{ pass, teeth, results, goldenHash, poiGoldenHash }`.
//   `pass`  — the GATE: generator CORRECTNESS only (the contract tests T1/T2/T4/T6
//             below). Trustworthy to treat as a green/red health check.
//   `teeth` — an ADVISORY: did the negative controls (T3/T5) confirm the contract
//             tests are non-vacuous? Reported separately so an under-sampled
//             control can never paint `pass` red on a correct generator.
//
// Tests, with failure LOCALIZATION (offending coord + field + the two values):
//   T1 round-trip    [contract] — queryPoint == JSON round-trip + re-call equality
//                      (catches -0/NaN/format drift).
//   T2 heart window  [contract] — nearestHeart at the default window and window+1
//                      agree near a heart (the window is sufficient near-field).
//   T3 heart neg-ctl [teeth]    — window 0 (own cell) DIFFERS from the default
//                      somewhere, proving T2 isn't vacuous.
//   T4 road window   [contract] — nearestRoad at the derived radius R and R+1 agree.
//   T5 road neg-ctl  [teeth]    — a 1-cell window DIFFERS from R somewhere, proving
//                      T4 isn't vacuous.
//   T6 major window  [contract] — bounded nearestMajorHeart scan is sufficient.
//   golden hash      — FNV-1a over queryPoint tuples across a fixed sample × seeds;
//                      the 3D port re-checks on Safari/Firefox for Math forks.
//
// Negative controls search the shared sample first, then ring-scan near hearts
// (where roads concentrate) — the uniform ±6 km sample under-samples that band on
// some seeds. They assert TEST QUALITY, not correctness, so they never gate.

import { setSeed, getSeed, queryPoint } from './index.js';
import { nearestHeart, nearestMajorHeart, heartsInBounds } from './hearts.js';
import { nearestRoad } from './roads.js';
import { festivalPlan, campVillagesNear } from './festival.js';
import { CONFIG, heartNeighborhoodCells, roadNeighborhoodCells } from './constants.js';

// Deterministic sample points (no Math.random) spread across ~±6 km.
function samplePoints(n = 240) {
  const pts = [];
  let a = 0x12345678 >>> 0;
  for (let i = 0; i < n; i++) {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const x = Math.round((r - 0.5) * 12000);
    const z = Math.round((((a >>> 8) & 0xffff) / 65536 - 0.5) * 12000);
    pts.push({ x, z });
  }
  return pts;
}

function fnv1a(str) {
  let h = 0x811C9DC5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

// A negative control proves a contract test is NON-VACUOUS (has "teeth"): that a
// deliberately-too-narrow window DISAGREES with the real one SOMEWHERE — otherwise
// the contract test (e.g. "window R is sufficient") could pass with R=1 and prove
// nothing. It asserts TEST QUALITY, not generator correctness, so it must NEVER
// fail the `pass` gate. `probe(x,z)` returns true where the narrow/full windows
// disagree. Search the shared sample first (fast path); if it misses, ring-scan
// near heart centres — roads + heart-window effects concentrate there, and the
// uniform ±6 km sample under-samples that thin band on some seeds (e.g. 0, 2). If
// even the targeted scan finds nothing, the control is N/A (the property doesn't
// bite at this scale), which is informative, not a failure.
function negativeControl(probe, pts) {
  for (const p of pts) {
    if (probe(p.x, p.z)) return { pass: true, detail: `confirmed at (${p.x},${p.z})` };
  }
  const CELL = CONFIG.HEART_CELL;
  const reach = roadNeighborhoodCells();
  for (const h of heartsInBounds(-3000, -3000, 3000, 3000)) {
    const hx = h.cx * CELL + CELL / 2, hz = h.cz * CELL + CELL / 2;
    for (let rad = CELL * 0.5; rad <= CELL * reach; rad += CELL * 0.5) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        const x = Math.round(hx + Math.cos(a) * rad), z = Math.round(hz + Math.sin(a) * rad);
        if (probe(x, z)) return { pass: true, detail: `confirmed at (${x},${z}) [targeted scan]` };
      }
    }
  }
  return { pass: true, na: true, detail: 'no window disagreement at this scale — negative control N/A (not a failure)' };
}

export function runSelfTest(seeds = [0, 1, 1234, 0x95128419]) {
  const prevSeed = getSeed();
  const results = [];
  let goldenAcc = '';
  let poiAcc = '';   // SEPARATE golden over the festival POI layer (D2.0a / R18) —
                     // the queryPoint golden is additive-blind to it, so it proves
                     // nothing about festivalPlan/nearestMajorHeart determinism.

  for (const s of seeds) {
    setSeed(s);
    const pts = samplePoints();

    // T1 — round-trip + re-call equality
    let t1 = { name: `round-trip (seed ${s})`, pass: true, detail: '' };
    for (const p of pts) {
      const a = queryPoint(p.x, p.z);
      const b = queryPoint(p.x, p.z);
      const sa = JSON.stringify(a), sb = JSON.stringify(b);
      const sr = JSON.stringify(JSON.parse(sa));
      goldenAcc += sa;
      if (sa !== sb) { t1.pass = false; t1.detail = `re-call differs at (${p.x},${p.z})`; break; }
      if (sa !== sr) { t1.pass = false; t1.detail = `serialize round-trip differs at (${p.x},${p.z})`; break; }
    }
    results.push(t1);

    // T2 — near-field heart window invariance
    let t2 = { name: `heart window-invariance (seed ${s})`, pass: true, detail: '' };
    for (const p of pts) {
      const base = nearestHeart(p.x, p.z, heartNeighborhoodCells());
      if (!base.heart) continue;   // assert invariance across the FULL sample (incl. far field)
      const wider = nearestHeart(p.x, p.z, heartNeighborhoodCells() + 1);
      if (!wider.heart ||
          wider.heart.cx !== base.heart.cx || wider.heart.cz !== base.heart.cz ||
          wider.dist !== base.dist) {
        t2.pass = false;
        t2.detail = `at (${p.x},${p.z}): window ${heartNeighborhoodCells()} → cell (${base.heart.cx},${base.heart.cz}) d=${base.dist}; window ${heartNeighborhoodCells() + 1} → ${wider.heart ? `cell (${wider.heart.cx},${wider.heart.cz}) d=${wider.dist}` : 'null'}`;
        break;
      }
    }
    results.push(t2);

    // T3 — heart negative control: window 0 (own cell only) must DIFFER from the
    // default heart window somewhere, proving T2 genuinely needs the wider window.
    const t3 = negativeControl((x, z) => {
      const base = nearestHeart(x, z, heartNeighborhoodCells());
      const tiny = nearestHeart(x, z, 0);
      return (!base.heart) !== (!tiny.heart) ||
        (base.heart && tiny.heart && (base.heart.cx !== tiny.heart.cx || base.heart.cz !== tiny.heart.cz));
    }, pts);
    t3.name = `heart negative control (seed ${s})`;
    results.push(t3);

    // T4 — road window-invariance: the DERIVED road radius is sufficient
    // (same nearest-road distance at radius R and R+1).
    const R = roadNeighborhoodCells();
    let t4 = { name: `road window-invariance (seed ${s})`, pass: true, detail: '' };
    for (const p of pts) {
      const a = nearestRoad(p.x, p.z, R).dist;
      const b = nearestRoad(p.x, p.z, R + 1).dist;
      if (a !== b) { t4.pass = false; t4.detail = `nearest-road dist differs at (${p.x},${p.z}): R=${R}→${a} vs R+1→${b}`; break; }
    }
    results.push(t4);

    // T5 — road negative control: a too-small (1-cell) window MUST disagree with
    // R somewhere, proving T4's "R is sufficient" is non-vacuous.
    const t5 = negativeControl((x, z) => nearestRoad(x, z, R).dist !== nearestRoad(x, z, 1).dist, pts);
    t5.name = `road negative control (seed ${s})`;
    results.push(t5);

    // T6 — major-heart window-invariance (R17): the bounded nearestMajorHeart scan
    // must be sufficient — widening the ring cap does NOT find a closer major.
    // Majors are ~4% so this re-opens the window-truncation class; spawn orientation
    // forks if it isn't invariant.
    let t6 = { name: `major window-invariance (seed ${s})`, pass: true, detail: '' };
    for (const p of pts) {
      const a = nearestMajorHeart(p.x, p.z, 28);
      const b = nearestMajorHeart(p.x, p.z, 44);
      const same = (!a) === (!b) && (!a || (a.cx === b.cx && a.cz === b.cz));
      if (!same) {
        t6.pass = false;
        t6.detail = `major differs at (${p.x},${p.z}): r28 ${a ? `(${a.cx},${a.cz})` : 'null'} vs r44 ${b ? `(${b.cx},${b.cz})` : 'null'}`;
        break;
      }
    }
    results.push(t6);

    // POI golden — festivalPlan per heart in a fixed box (stable cell order) +
    // nearestMajorHeart(0,0) + camp villages. Catches cross-engine forks in the
    // festival LAYOUT (the queryPoint golden can't see this layer). A per-engine
    // transcendental fork is EXPECTED (the accepted cosmetic class). Baseline @ the
    // FESTIVAL LAYOUT GRAMMAR rewrite (D3, deliberation 003) — HEART_CELL 200 /
    // noneBelow 0.05, seed 1234:
    //   queryPoint golden  node eddf8e50  /  browser eddf8e50 (recorded 2026-06-10, H.2)
    //   POI golden         94a6a001 (recent node V8 ≥ v24 == Chromium class; GROUP 4B+)
    // ^ HISTORICAL. The chain below stops at 94a6a001, but post-2026-06-16 worldgen
    //   work moved both without updating this block; the CURRENT pair is
    //   queryPoint dd6c3f13 / POI 3a0cc079 (see the tail of the chain). The
    //   independently-recorded pair from `festival-horizon` task group 1 —
    //   dd6c3f13 / 4e580ed7 — is the one the welfare-bundle entry below moves from.
    // ^ GROUP 4 (festival-zone-grammar, 2026-06-14) moved the POI golden in TWO steps,
    //   then GROUP 4B (2026-06-15) once more — all flag-off on an unmerged branch (D6):
    //     4825fd0b → a0edfaea  the slotting commit (a338ed2): single-pass oriented-zone
    //                          slotter (omit-on-no-fit), planner-owned arch, stable
    //                          clusterSeed indices (D14/D15/D16/D17).
    //     a0edfaea → 49ec28fc  the playtest-fix commit (D18, Gary's K-marker round): ONE
    //                          arch at the spawn hub only, arch ≥ 2 dancefloor-lengths +
    //                          always-places ladder, drum OMITTED when no treed pocket,
    //                          food courts on side roads, potties past the parent edge.
    //     49ec28fc → c1920e52  the cross-hub seam grammar (4B.3b/c, deliberation 002):
    //                          festivalPlan = base plan + seam suppressions (merge food+food
    //                          → one court, yield drum vs neighbour stage, trim/suppress
    //                          vendor row); neighbourCourtHere + stageDeckClips band-aids
    //                          removed. INTEGER-only (isqrt gate) so no NEW node/browser fork
    //                          class; queryPoint frozen (no road/water change — D5/N6).
    //     c1920e52 → 449f07e1  no-festival-in-a-lake (Group 6 water-clear burndown,
    //                          2026-06-15): a hub whose heart center is in a lake emits
    //                          NO festival (_festivalSuppressed — stage deck + dancefloor
    //                          are both heart-anchored, so a wet center drowned both), and
    //                          the SPAWN hub is now the nearest *dry* major (spawnHeart) so
    //                          the game never opens on a stage in water. Gated on `lakeAt`,
    //                          already part of the frozen queryPoint golden → integer/no new
    //                          fork class; queryPoint frozen. water-clear errors 368→1 over a
    //                          10-seed sweep (the 1 residual is a dancefloor-mouth-on-water,
    //                          parked — a front-axis fix is higher-risk; ROADMAP).
    //     449f07e1 → b996d7c0  drum-in-trees burndown (same pass): a drum whose treed spot
    //                          sat on a road EDGE got nudged off-road into the adjacent bare
    //                          clearing; treedDistrictSpot now re-checks tree density AFTER
    //                          nudgeOff and OMITS the drum if it landed bare (same >=0.25 bar
    //                          as acceptance). Omitting skips that hub's drum-yaw rng draw
    //                          (the existing variable-draw class), so potty/bubble shift too.
    //                          drum-in-trees 5→1 over 10 seeds; queryPoint frozen.
    //     b996d7c0 → 21fcd163  4B.4 emergent arrival (D9): the road→arch→stage composition is
    //                          now a MAJOR-hub grammar feature — spawn always + ~ARCH_MAJOR_PCT%
    //                          (25) of other majors via an integer hash gate (SALT.archGate),
    //                          revising D18's world-single-arch. PURELY ADDITIVE (the arch block
    //                          consumes no rng) so only arch descriptors enter the hash; queryPoint
    //                          frozen. No new arch-placement lint errors over 10 seeds.
    //     21fcd163 → 736f05b4  stage flood fix (festival-zone-grammar, 2026-06-16, Gary's
    //                          "tent stage partially flooded" round): the stage spot is now
    //                          FOOTPRINT-AWARE — nudgeOffStage tests a 16+8-point rosette at the
    //                          deck radius for open water (not just the center point), relocating
    //                          a stage whose deck corner dipped into a shore (12 dirs × out to
    //                          ~52 m; whole composition rides stageSpot). The nudge is HASH-seeded
    //                          (rng-free), so only water-adjacent stages move + the hubs whose
    //                          center was on road/lake (their stageKind draw shifts forward of the
    //                          now-rng-free nudge); dry hubs unchanged. Across 5 seeds: center-
    //                          flooded stages 26-35 → 0-4 thin single-cell edge touches, ZERO
    //                          corner-in-water (wet≥3); residual = genuinely lake-hemmed hubs
    //                          (least-wet, same parked class as the dancefloor-mouth case).
    //                          queryPoint frozen (no road/water-existence change — D5).
    //     736f05b4 → 5da2d515  "quiet behind, loud in front" (2026-06-16): the drum circle —
    //                          the hub's quiet destination — now biases to the REAR hemisphere
    //                          (behind the stage, away from the dancefloor) instead of anywhere
    //                          but the front wedge. treedDistrictSpot maps its angle onto an arc
    //                          centered on the rear bearing (F+π), out of the front wedge by
    //                          construction, skewed toward rear (|u|^2.2). ~52% of drums now sit
    //                          dead-rear / ~37% side / ~10% front-edge (was ~uniform over the
    //                          non-front arc). Same one angle-draw → same variable-draw class;
    //                          queryPoint frozen.
    //     5da2d515 → 480291ba  welfare bundle (2026-06-16): the bubble vendor IS the hub's
    //                          water/refill amenity, so it now co-locates with the STAGE's
    //                          porta-bank (a deterministic fan tucks it on the plaza-facing
    //                          side, clear + dry) to read as one welfare station by the busy
    //                          core, rather than a prop on a quiet road. ~95% of hubs land the
    //                          bubble < 12 m from a potty (avg ~9.6 m); the ~5% fallback to the
    //                          old road-walk are hubs whose stage had no potty. Bubble positions
    //                          shift → POI golden moves; queryPoint frozen.
    //     480291ba → 94a6a001  drum road-clip fix (festival-zone-grammar, 2026-06-16, Gary's
    //                          K-marker "drum circle spawning in a road, blocking the road"):
    //                          the drum's final off-road nudge is now FOOTPRINT-AWARE —
    //                          nudgeOffDrum keeps the drum's clearR keep-out disk (≈ footprint+2,
    //                          matching drumClearingsNear) off the road CORRIDOR, not just its
    //                          center (the center-only nudgeOff let a drum whose center cleared
    //                          the road still spill its ring across it). The road is a polyline
    //                          of half-width ROAD_WIDTH, so the test is EXACT: reject a center
    //                          within ROAD_WIDTH + clearR + 1 of the nearest centerline (one
    //                          nearestRoad call, no probe-resolution gap). HASH-seeded (rng-free),
    //                          so only road/water-clipping drums move, and the hubs whose drum
    //                          clipped no longer spend the old rng nudge draw → their potty/bubble
    //                          shift too — the SAME golden-move class as the stage flood fix
    //                          (736f05b4). Ring-clips-road 0 across 7 seeds (1718 drums), drum
    //                          count unchanged. queryPoint frozen (eddf8e50; no road/water change).
    //     4e580ed7 → aaf5bead  WELFARE / AMENITY BUNDLES (2026-08-31, ROADMAP "Welfare/
    //                          amenity bundles attached to hubs"): the plan's lone
    //                          `porta_bank` attachments become TIERED `welfare_post`
    //                          bundles (minimal = toilets, standard = + shade table +
    //                          info kiosk, plaza = + the hub's bubble refill), committed
    //                          to the slotter's placed[] so siblings pack around each
    //                          other and the arch can't thread through one. Three plan
    //                          deltas move the hash: the kind string + `tier`/`scale`/
    //                          `parentSeed` fields, the STAGE post moving from a
    //                          degenerate hub-outward fan to a dancefloor-flanking
    //                          candidate list, and the bubble taking the plaza post's
    //                          reserved slot. Draw ORDER is unchanged (the candidate
    //                          lists are rng-free; only `nudgeOff`'s conditional draw
    //                          can differ, the same variable-draw class as the stage
    //                          flood fix). Plan-mode lint across the 10-seed gallery is
    //                          UNCHANGED on every pre-existing rule (1 error / 233 warn,
    //                          the known seed-256 nudgeOffDrum regression) — the only new
    //                          findings are 6 from the new `amenity-bundle` rule itself.
    //                          queryPoint frozen dd6c3f13 (no road/water change — D5).
    //     aaf5bead → fe7803f1  CAMP-VILLAGE WELFARE (2026-08-31 follow-up, Gary: "camp
    //                          villages should get at least a single, or a double porta-
    //                          potty"): `campVillagesNear` now emits a MINIMAL welfare post
    //                          per village, just past the pitch SQUARE's edge (±CAMP_RADIUS,
    //                          so the clearance is the square's boundary along the chosen
    //                          bearing — 30 m cardinal, ~42 m diagonal — not the radius) on
    //                          the road side, doors facing back into the camp. Bank size is
    //                          tent-driven, not rolled: 1 unit, or 2 at VILLAGE_WELFARE_DOUBLE
    //                          (196/98 across 5 seeds, 294 villages, 0 unserved). PURELY
    //                          ADDITIVE and RNG-FREE — it consumes no draw from the village
    //                          cell's stream, so every existing village keeps its exact
    //                          position and tent count; only the new descriptors enter the
    //                          hash. queryPoint frozen dd6c3f13.
    //   The POI fork is a V8-VERSION cosmetic class (the older-V8 value differs; the
    //   accepted treedDistrictSpot/front-axis transcendental class — file header).
    //   poiGoldenHash is returned for manual comparison, NOT a hard-fail result.
    //   queryPoint golden stays FROZEN dd6c3f13 (no road/water-existence change — D5).
    // The plan now carries each stage's front-axis bin (`fbin`) + `scale`, so the
    // golden + T6 window-invariance exercise F. (Prior baselines for reference:
    // 340/0.25 → POI node 4e335f21; the pre-grammar 200/0.05 → POI node 6fa977c8;
    // the layout-grammar baseline → POI node 3b9fc6b6.)
    // ROUND-2 landing ① (2026-06-09) moved the POI golden 3b9fc6b6 → 01532955:
    // vendor_row now centers ON the road (aisle = the drag, C) instead of offset to
    // one side, and the drum spot gets nudged off any road corridor it lands on (D).
    // Both are festival.js _computePlan/treedDistrictSpot edits; queryPoint golden
    // (eddf8e50) is untouched. Flag-off, expected.
    // The node-vs-browser POI fork remains the accepted cosmetic class. H.2
    // (the one non-cosmetic cross-engine gate) LANDED 2026-06-10: the detour
    // side decision in roads.js _computeArterial is cross/dot-product
    // arithmetic now, no transcendentals — road existence can't fork
    // per-engine. Both goldens held (probe: 2171 detour edges across 5 seeds,
    // old vs new decision agreed on every one).
    const boxHearts = heartsInBounds(-3000, -3000, 3000, 3000)
      .slice().sort((h1, h2) => h1.cx - h2.cx || h1.cz - h2.cz);
    for (const h of boxHearts) poiAcc += JSON.stringify(festivalPlan(h));
    const mh = nearestMajorHeart(0, 0);
    poiAcc += mh ? `|M${mh.cx},${mh.cz}|` : '|Mnull|';
    poiAcc += JSON.stringify(campVillagesNear({ minX: -1500, minZ: -1500, maxX: 1500, maxZ: 1500 }));
  }

  setSeed(prevSeed);
  const goldenHash = fnv1a(goldenAcc);
  const poiGoldenHash = fnv1a(poiAcc);
  // `pass` is the GATE — generator correctness only (T1/T2/T4/T6). Negative
  // controls (T3/T5) assert TEST QUALITY, not correctness, so they're reported
  // separately as `teeth` and never drag `pass` red on a contract-clean run.
  // (Before this split, an under-sampled negative control returned pass:false on
  // some seeds, training everyone to ignore red.) `teeth` is true when every
  // negative control confirmed a disagreement (none fell back to N/A).
  const isNegControl = (r) => /negative control/.test(r.name);
  const pass = results.filter(r => !isNegControl(r)).every(r => r.pass);
  const teeth = results.filter(isNegControl).every(r => r.pass && !r.na);
  return { pass, teeth, results, goldenHash, poiGoldenHash };
}
