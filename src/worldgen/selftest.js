// Determinism harness (deliberation CG1.5) — REAL teeth, not "query twice in
// two orders" (queryPoint is already pure, so that proves nothing).
//
// Tests, with failure LOCALIZATION (offending coord + field + the two values),
// so an on-screen red light is actionable:
//   T1 round-trip   — queryPoint == JSON.parse(JSON.stringify(queryPoint))
//                      (catches -0/NaN/format drift) and re-call equality.
//   T2 window-inv   — near a heart, nearestHeart at the default window and
//                      window+1 agree (the heart window is sufficient near-field,
//                      where roleTier/influence depend on it).
//   T3 negative ctl — window 0 (own cell only) DIFFERS from the default for at
//                      least one sampled point; if it never differs the sample
//                      isn't exercising cross-cell lookup → the test has no teeth.
//   golden hash     — FNV-1a over queryPoint tuples across a fixed sample grid ×
//                      seeds; the future 3D port re-computes this on Safari /
//                      Firefox to catch Math-transcendental cross-engine forks.
//
// The FULL proximity-graph window-invariance + derived-radius negative control
// (the road-seam determinism proof) lands with roads.js at GATE 2 / CG3.

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

    // T3 — negative control: window 0 must DIFFER somewhere (proves teeth)
    let t3 = { name: `negative control (seed ${s})`, pass: false, detail: 'window 0 never differed — sample lacks teeth' };
    for (const p of pts) {
      const base = nearestHeart(p.x, p.z, heartNeighborhoodCells());
      const tiny = nearestHeart(p.x, p.z, 0);
      const differ = (!base.heart) !== (!tiny.heart) ||
        (base.heart && tiny.heart &&
          (base.heart.cx !== tiny.heart.cx || base.heart.cz !== tiny.heart.cz));
      if (differ) { t3.pass = true; t3.detail = `confirmed at (${p.x},${p.z})`; break; }
    }
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

    // T5 — road negative control: a too-small (1-cell) window MUST disagree
    // somewhere, proving the road lookup genuinely needs the multi-cell window.
    let t5 = { name: `road negative control (seed ${s})`, pass: false, detail: 'window 1 never differed — lacks teeth' };
    for (const p of pts) {
      if (nearestRoad(p.x, p.z, R).dist !== nearestRoad(p.x, p.z, 1).dist) {
        t5.pass = true; t5.detail = `confirmed at (${p.x},${p.z})`; break;
      }
    }
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
    //   POI golden         21fcd163 (recent node V8 ≥ v24 == Chromium class; GROUP 4B)
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
    //   The POI fork is a V8-VERSION cosmetic class (the older-V8 value differs; the
    //   accepted treedDistrictSpot/front-axis transcendental class — file header).
    //   poiGoldenHash is returned for manual comparison, NOT a hard-fail result.
    //   queryPoint golden stays FROZEN eddf8e50 (no road/water-existence change — D5).
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
  const pass = results.every(r => r.pass);
  return { pass, results, goldenHash, poiGoldenHash };
}
