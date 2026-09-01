// FarField — the render-only festival horizon (festival-horizon change).
//
// A PEER of ChunkManager/LakeManager owned by world.js, never another chunk
// ring: it draws batched far-distance silhouettes (roads, stage canopies, roof
// peaks, trusses, coarse forest masses + night markers) from the same
// deterministic worldgen descriptors/fields the real builders consume, and
// dissolves each proxy when its owning real chunk finishes building. It owns NOTHING gameplay-side: no
// registry entries, colliders, NPCs, audio, pickups, real lights, shadow
// casters, or per-prop animation, and it never calls a real cluster builder.
//
// Contracts this file is built around (design D1-D7, audit V2-V8):
// - Enablement is `farFieldRequested && USE_WORLDGEN_V2` (perf.js resolves
//   it); disabled means ZERO work — no allocation, no planning, no GPU
//   resources ever. Nothing here constructs a three.js object at module
//   evaluation; all materials/geometries/pools are built per-instance at
//   construction time, only when enabled.
// - Worldgen descriptors and road polylines are SHARED MEMOIZED TRUTH. They
//   are copied field-by-field into FarField-owned compact records and never
//   sorted, clipped, annotated, or otherwise mutated in place.
// - Cluster ownership goes through ownerCellCoord (placement.js) — the one
//   half-open center-anchored rule — and chunk completion through the narrow
//   ChunkManager.isLoaded(cx, cz) predicate. No loaded-Map access, no chunk
//   key strings, no re-derived cell math.
// - Planning is incremental per coarse cell (never one monolithic ~1km²
//   queryRegion — cold arterial queries were a measured multi-second stall
//   before per-cell caching) and pending snapshots are versioned by the
//   requesting player cell so rapid teleports supersede stale work.
//
// bin/test-far-field runs this module under plain node by registering
// bin/node-three-shim.mjs (the same resolve hook the forest-determinism gate
// uses), so the `three` import below maps to a property-bag stub there.

import * as THREE from 'three';
import { ownerCellCoord } from './worldgen/placement.js';
import { heartsInBounds } from './worldgen/hearts.js';
import { festivalPlan, campVillagesNear } from './worldgen/festival.js';
import { roadsInBounds } from './worldgen/roads.js';
import { treeDensity } from './worldgen/density.js';
import { CONFIG } from './worldgen/constants.js';

// Handoff dissolve length (design D4). Reduced motion skips it and snaps.
export const HANDOFF_ENVELOPE_S = 0.3;

// Road underlay elevation (design D3 / audit V12): strictly between the ground
// plane (y=0) and the authoritative road ribbon (y=0.06), so the real road
// covers the proxy with no z-fighting and no per-segment handoff.
export const ROAD_UNDERLAY_Y = 0.03;

// Coarse planning cell (design D3). One planning step processes one coarse
// cell; 240m = 3x3 chunks, matching the granularity the per-cell road cache
// already amortizes.
export const COARSE_CELL = 240;

// Night marker batches (warm lights + stage beacons) stay hidden below this
// nightness (design D5) — by day the horizon is silhouettes only.
export const NIGHT_MARKER_THRESHOLD = 0.12;

// The underlay ribbon is deliberately narrower than the authoritative road
// (CONFIG.ROAD_WIDTH) so the real ribbon always covers it edge-to-edge.
const FAR_ROAD_WIDTH_FRAC = 0.8;
// Mirrors FESTIVAL_TUNING.VENDOR_ROW_OFFSET (the half-width of the drivable
// aisle the two booth lines straddle). COPIED, not imported: worldgen/tuning.js
// is the render-agnostic layer and farField.js is a render module, so the arrow
// would point the wrong way. Same copy discipline as tuning.js MODEL_DIMS.
const VENDOR_AISLE_HALF = 7;
// Mirrors FESTIVAL_TUNING.CAMP_RADIUS — camp pitches scatter across a SQUARE of
// ±this, not a disc (chunks.js buildCampVillageAt). Copied for the same reason as
// VENDOR_AISLE_HALF above.
const CAMP_SQUARE_HALF = 30;
// Real body dimensions the proxies have to AGREE with, copied from the models
// (same discipline as VENDOR_AISLE_HALF above — farField.js is a render module
// and must not import worldgen or models). Gary 2026-09-01: "the tent tops and
// tree greens are way too low, they don't line up with where the real vendor
// tent tops are, or tree tops". Every one of these was measured, not guessed:
//   stage.js      trussH = 9 * scale        — the roof rides the TRUSS top, and
//                                             the proxy had it at 3.4 * scale
//   tentStage.js  28 m wide, ridge 11 m, cloth 0xfff8eb — and NOT scaled: the
//                                             builder takes no scale argument
//   tent.js       roof cone r3.2 h1.8 at y3.4 → apex 4.3 m, 6.4 m across
//   tree.js       pine 16-22 m, birch 10-14 + crown, oak 7-10 + crown
const STAGE_TRUSS_H = 9;          // × scale
const TENT_STAGE_HALF_W = 14;     // FIXED — buildTentStage takes no scale
const TENT_STAGE_RIDGE = 11;      // FIXED
const TENT_STAGE_HEX = 0xfff8eb;  // the real marquee canvas
const BOOTH_APEX = 4.3;           // market-tent apex above ground

// Coarse forest masses (the ROADMAP follow-up promoted 2026-08-28): the
// density FIELD is sampled on a fixed global grid (tier.forestStep meters),
// never the exact far-tree scatter — reproducing per-tree placement would
// spend exactly the CPU this layer exists to avoid.
//
// The threshold used to be 0.45, on the reasoning that a sparse fringe should
// not be "promised by a solid silhouette mass". Measured, that reasoning cost
// far more than it saved: `scatterTrees` grows trees from about 0.05 up
// (`floor(density * 18)` per chunk, so 0.2 still plants three), and a 4 km
// sample says only 5.2% of ground clears 0.45 while 36.7% grows real trees —
// so 87.5% of treed ground had NO horizon representation at all and the woods
// arrived out of thin air as chunks completed (Gary 2026-08-31: "trees pop up
// out of nowhere with no far-field rep showing up first"). The fix is to lower
// the gate AND make the mass honest about what it is standing in for: the
// clump size below now ramps from the threshold, so thin ground reads as low
// scrub and only genuinely dense forest reads as a wall. Tier `forestStep`
// grew alongside it, which keeps the instance count in the same range while
// covering roughly eight times the ground.
export const FOREST_DENSITY_THRESHOLD = 0.15;

// Flat-color hex palettes (plain numbers at module scope — THREE.Color
// instances are built at construction time, never module evaluation).
const CANOPY_PALETTE = [0xd8433f, 0xe8823a, 0x3f8fd8, 0x9a5fd0, 0x2fa46a, 0xd84f8e];
// The REAL booth cloth (models/tent.js CLOTH_COLORS) — a proxy that hands off
// to a warmer tent than it drew is a visible seam at the handoff distance.
const PEAK_PALETTE = [0xfff4d0, 0xe7c995, 0xfddfa5, 0xd0c2a8, 0xf4d6c4];
const BEACON_PALETTE = [0xff5a4d, 0x4da2ff, 0xffd24d, 0xb56aff];
// The REAL camp tent fabric (models/campsite.js TENT_COLORS). Saturated, and
// deliberately nothing like the vendor cream — a camp and a market should read
// as different districts from across the field, not as the same pale triangles.
const VILLAGE_PALETTE = [0x2d5a3a, 0xc24b2a, 0x2c4d75, 0xd9a834, 0x6a3b6a, 0x8a3a2a];
// Darker cuts of tree.js's FOREST_GREENS — far masses read through fog.
const FOREST_PALETTE = [0x355a32, 0x3f6d3a, 0x2d4e2a, 0x4a7a45];
const TRUSS_HEX = 0x2e2a33;
const WARM_HEX = 0xffb054;
const ROAD_HEX = 0x9c7c58;   // a shade darker than the real road's 0xb89570

// ---------- Pure helpers ----------

// Reduced-motion handoff policy (audit V8): the flag must be READ LIVE at each
// handoff (A11y.init() resolves the persisted/OS preference after buildWorld),
// so this takes the current value, never caches one.
export function handoffMode(reducedMotionNow) {
  return reducedMotionNow ? 'snap' : 'envelope';
}

// Deterministic coarse-cell spiral around the player's coarse cell, covering
// `radius` meters plus one-cell hysteresis, nearest-first with a stable
// tie-break so planning order (and therefore any capacity truncation
// downstream) is byte-stable for a given player cell.
export function coarseCellsFor(px, pz, radius, coarseSize = COARSE_CELL) {
  const ccx = ownerCellCoord(px, coarseSize);
  const ccz = ownerCellCoord(pz, coarseSize);
  const reach = Math.ceil(radius / coarseSize) + 1;   // +1 cell hysteresis
  const cells = [];
  for (let dz = -reach; dz <= reach; dz++) {
    for (let dx = -reach; dx <= reach; dx++) {
      cells.push({ cx: ccx + dx, cz: ccz + dz, d2: dx * dx + dz * dz });
    }
  }
  cells.sort((a, b) => a.d2 - b.d2 || a.cx - b.cx || a.cz - b.cz);
  return cells;
}

// Copy ONE heart's plan into FarField-owned compact records: the guaranteed
// stage anchor plus at most `vendorRowMax` vendor rows, in plan order (which
// is deterministic per heart). Only scalar fields are copied — no references
// to the memoized descriptor objects or arrays survive into the records, so
// the shared plan cannot be mutated through them.
const STAGE_KINDS = new Set(['main_stage', 'tent_stage', 'side_stage']);
export function copyHeartRecords(heart, plan, vendorRowMax) {
  const out = [];
  let vendorRows = 0;
  for (const d of plan) {
    const isStage = STAGE_KINDS.has(d.kind);
    if (!isStage && d.kind !== 'vendor_row') continue;
    if (!isStage && vendorRows >= vendorRowMax) continue;
    if (!isStage) vendorRows++;
    out.push({
      kind: d.kind,
      x: +d.x,
      z: +d.z,
      yaw: +d.yaw,
      scale: +(d.scale || 1),
      footprint: +(d.footprint || 4),
      // heart.rank is the STRING enum 'major'/'minor' (a naive `| 0` folds it
      // to 0 and the palette stops differentiating rank — caught by review).
      rank: d.rank === 'major' ? 1 : 0,
      clusterSeed: d.clusterSeed >>> 0,
      // Owner cell via THE rule — hides/shows against isLoaded(ownerCx, ownerCz).
      ownerCx: ownerCellCoord(d.x),
      ownerCz: ownerCellCoord(d.z),
      heartCx: heart.cx | 0,
      heartCz: heart.cz | 0,
    });
  }
  return out;
}

// Copy ONE camp village into a FarField-owned compact record. Villages are not
// part of any heart's plan — `campVillagesNear` puts them on an independent
// coarse grid — which is exactly why they had no horizon representation at all
// until now: a 22-pitch camp simply blinked into being when its chunk built
// (Gary 2026-08-31). Same scalar-only copy discipline as copyHeartRecords, plus
// `tents` so the proxy's pitch count tracks the real camp's size. `heartCx/Cz`
// are 0 by contract: a village has no owning heart.
export function copyVillageRecord(v) {
  return {
    kind: 'camp_village',
    x: +v.x,
    z: +v.z,
    yaw: +(v.yaw || 0),
    scale: 1,
    footprint: +(v.footprint || CAMP_SQUARE_HALF),
    rank: v.rank === 'major' ? 1 : 0,
    tents: v.tents | 0,
    clusterSeed: v.clusterSeed >>> 0,
    ownerCx: ownerCellCoord(v.x),
    ownerCz: ownerCellCoord(v.z),
    heartCx: 0,
    heartCz: 0,
  };
}

// Copy a shared cached road polyline into a FarField-owned flat Float64Array
// of [x0, z0, x1, z1, ...]. The input array/points are never touched.
export function copyPolyline(points) {
  const flat = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    flat[i * 2] = +points[i].x;
    flat[i * 2 + 1] = +points[i].z;
  }
  return flat;
}

// One coarse cell's forest-mass records: the global sample grid (step meters,
// world-anchored so clumps never move when the player does) restricted to the
// grid points this coarse cell OWNS (half-open, same rule as hearts — no
// duplicates across cells). Each qualifying sample becomes one record with a
// deterministic hash-jittered position (breaks the visible grid alignment)
// and the density it sampled; expansion turns density into clump size.
// `sample` is injectable for fixture-driven tests; the game passes nothing
// and gets the real density field. Pure — zero shared-RNG draws.
export function forestRecordsForCell(cellCx, cellCz, step, sample = treeDensity) {
  const half = COARSE_CELL / 2;
  const minX = cellCx * COARSE_CELL - half, maxX = cellCx * COARSE_CELL + half;
  const minZ = cellCz * COARSE_CELL - half, maxZ = cellCz * COARSE_CELL + half;
  const out = [];
  const gx0 = Math.ceil(minX / step), gx1 = Math.ceil(maxX / step) - 1;
  const gz0 = Math.ceil(minZ / step), gz1 = Math.ceil(maxZ / step) - 1;
  for (let gz = gz0; gz <= gz1; gz++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const sx = gx * step, sz = gz * step;
      const d = sample(sx, sz);
      if (d < FOREST_DENSITY_THRESHOLD) continue;
      const seed = (Math.imul(gx, 0x85ebca6b) ^ Math.imul(gz, 0xc2b2ae35)) >>> 0;
      const jx = (instHash(seed, 1) - 0.5) * step * 0.7;
      const jz = (instHash(seed, 2) - 0.5) * step * 0.7;
      out.push({ kind: '__forest', x: sx + jx, z: sz + jz, density: d, step, gx, gz, forestSeed: seed });
    }
  }
  return out;
}

// Fixed-capacity retention (spec "A dense seed exceeds a pool"): keep the
// `cap` records nearest to (px, pz), deterministically — ties break on x then
// z so identical inputs always keep the identical subset. Returns new arrays;
// never mutates `records`.
export function selectNearest(records, px, pz, cap) {
  if (records.length <= cap) return { kept: records.slice(), overflow: 0 };
  const scored = records.map((r) => ({
    r,
    d2: (r.x - px) * (r.x - px) + (r.z - pz) * (r.z - pz),
  }));
  scored.sort((a, b) => a.d2 - b.d2 || a.r.x - b.r.x || a.r.z - b.r.z);
  return { kept: scored.slice(0, cap).map((s) => s.r), overflow: records.length - cap };
}

// Stable palette bucket from descriptor identity (design D3): pure integer
// mapping, consumes zero generator draws. Knuth multiplicative hash over the
// cluster seed, folded with rank so sibling clusters vary.
export function paletteIndex(record, buckets) {
  const h = (((record.clusterSeed ^ (record.rank * 0x9e3779b9)) >>> 0) * 2654435761) >>> 0;
  return h % buckets;
}

// Proxy-only Bayer screen-door dissolve (design D4): the material stays
// opaque + depth-writing (no transparent sort), fading via a per-instance
// `aFade` attribute and an ordered-dither discard. Injected through
// documented shader chunks with a STABLE cache key so the five proxy
// batches share ONE program and never churn recompiles. The road underlay
// deliberately does NOT get this — the real road covers it by Δy alone.
const DITHER_CACHE_KEY = 'zerble:farField:dither:1';
const FF_BAYER_GLSL = `
float ffBayer(vec2 p) {
  float x = mod(p.x, 4.0), y = mod(p.y, 4.0);
  float v =
    x < 1.0 ? (y < 1.0 ? 0.0 : y < 2.0 ? 12.0 : y < 3.0 ? 3.0 : 15.0) :
    x < 2.0 ? (y < 1.0 ? 8.0 : y < 2.0 ? 4.0 : y < 3.0 ? 11.0 : 7.0) :
    x < 3.0 ? (y < 1.0 ? 2.0 : y < 2.0 ? 14.0 : y < 3.0 ? 1.0 : 13.0) :
              (y < 1.0 ? 10.0 : y < 2.0 ? 6.0 : y < 3.0 ? 9.0 : 5.0);
  return (v + 0.5) / 16.0;
}`;
export function applyProxyDither(mat) {
  mat.customProgramCacheKey = () => DITHER_CACHE_KEY;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float aFade;\nvarying float vFade;\n' +
      shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n\tvFade = aFade;');
    shader.fragmentShader = 'varying float vFade;\n' + FF_BAYER_GLSL + '\n' +
      shader.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n\tif (vFade < 0.999 && vFade < ffBayer(gl_FragCoord.xy)) discard;');
  };
}

// Per-instance variation in [0,1) from (clusterSeed, index) — same class of
// pure integer mapping as paletteIndex: NO shared RNG stream is consumed, so
// worldgen goldens can't move.
export function instHash(seed, i) {
  let h = ((seed >>> 0) ^ Math.imul(i + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Expand compact records into per-pool instance descriptors (pure — testable
// without pools). Each instance carries its OWNING RECORD's chunk cell, not
// the cell its own xz lands in: the whole cluster proxy hides when the chunk
// that will build the real cluster completes, even for parts that spill over
// a chunk edge (matching how the real builder places whole clusters from the
// owning chunk).
//
// The semantic vocabulary (design D2/D3): a stage becomes canopy + two truss
// posts + a truss beam + one colored beacon; a vendor row becomes a strip of
// roof peaks with warm light markers alongside. Sizes are coarse on purpose —
// these read through 300-500m of fog, not up close.
export function expandFarInstances(records, densityMul) {
  const out = { canopy: [], truss: [], peak: [], warm: [], beacon: [], forest: [], roads: [] };
  for (const r of records) {
    if (r.kind === '__road') { out.roads.push(r.flat); continue; }
    if (r.kind === '__forest') {
      // One squashed low-poly dome per sample. Radius overlaps the grid step
      // so adjacent qualifying samples merge into a continuous mass instead of
      // reading as one giant tree per point. Both size axes ramp from the
      // THRESHOLD rather than from zero density: at the gate a sample is thin
      // scrub (a small, low dome with gaps to its neighbours) and only fully
      // dense ground grows the overlapping wall. That ramp is what lets the
      // gate sit at 0.15 without carpeting the outskirts in solid forest.
      // The ramp lives almost entirely in the RADIUS, not the height: a tree is
      // about as tall whether it stands alone or in a wood, so thin ground has
      // to read as a small isolated clump — not as a wide flat pancake, which is
      // what ramping the height instead produces. At the gate a clump spans well
      // under the grid step (isolated, gaps between neighbours); at full density
      // it spans comfortably more than the step, so adjacent samples merge into
      // the continuous mass a real forest reads as.
      const t = Math.min(1, Math.max(0, (r.density - FOREST_DENSITY_THRESHOLD) / (1 - FOREST_DENSITY_THRESHOLD)));
      // Sized against the real canopy: pines reach 16-22 m and birch/oak crowns
      // 12-18 m, but these domes topped out at 7-13 m while spanning up to 69 m,
      // which is precisely how you get "a big green wall" instead of treetops.
      // Taller and narrower now: the top lands at 12-20 m, and the radius only
      // has to exceed HALF the grid step for neighbours to merge, not 0.86 of it.
      const rad = r.step * (0.14 + t * 0.44 + instHash(r.forestSeed, 3) * 0.12);
      const h = 13.0 + t * 7.0 + instHash(r.forestSeed, 4) * 2.0;
      out.forest.push({
        x: r.x, z: r.z, y: h * 0.32, yaw: instHash(r.forestSeed, 5) * Math.PI * 2,
        sx: rad, sy: h * 0.6, sz: rad * (0.85 + instHash(r.forestSeed, 6) * 0.3),
        color: FOREST_PALETTE[(r.forestSeed >>> 3) % FOREST_PALETTE.length],
        ownerCx: ownerCellCoord(r.x), ownerCz: ownerCellCoord(r.z),
      });
      continue;
    }
    const own = { ownerCx: r.ownerCx, ownerCz: r.ownerCz };
    if (STAGE_KINDS.has(r.kind)) {
      const s = r.scale;
      const deckR = r.footprint * s;
      const postH = STAGE_TRUSS_H * s;   // the roof rides the real truss top
      const rightYaw = r.yaw + Math.PI / 2;              // stage width axis
      const rx = Math.sin(rightYaw), rz = Math.cos(rightYaw);
      const color = CANOPY_PALETTE[paletteIndex(r, CANOPY_PALETTE.length)];
      // The proxy has to agree with what you find when you arrive (Gary
      // 2026-08-31: "certain roofed stages showing up as triangle tents that
      // doesn't make sense"). Every stage kind used to expand to the same
      // 6-sided cone, but only `tent_stage` is actually a marquee —
      // main_stage / side_stage are flat-roofed trussed decks. So the shape now
      // follows the kind: a slab on posts for the decks, a full-height peak for
      // the marquee. The marquee borrows the PEAK pool's 4-sided cone rather
      // than earning its own InstancedMesh, so this costs no extra draw call
      // (and 12 tris instead of 18).
      if (r.kind === 'tent_stage') {
        // The marquee is a FIXED 28 m x 11 m body (the builder takes no scale),
        // and its canvas is near-white — the palette colour belongs to the
        // ROOFED stages. Gary saw an orange triangle at distance resolve into a
        // white marquee up close; that was this line taking CANOPY_PALETTE.
        out.peak.push({
          x: r.x, z: r.z, y: TENT_STAGE_RIDGE / 2, yaw: r.yaw,
          sx: TENT_STAGE_HALF_W, sy: TENT_STAGE_RIDGE, sz: TENT_STAGE_HALF_W,
          color: TENT_STAGE_HEX, ...own,
        });
      } else {
        const roofT = 1.1 * s;
        out.canopy.push({
          x: r.x, z: r.z, y: postH + roofT / 2, yaw: r.yaw,
          sx: deckR * 1.15, sy: roofT, sz: deckR * 1.15, color, ...own,
        });
        const postOff = deckR * 0.85;
        out.truss.push(
          { x: r.x + rx * postOff, z: r.z + rz * postOff, y: postH / 2, yaw: 0, sx: 0.5, sy: postH, sz: 0.5, ...own },
          { x: r.x - rx * postOff, z: r.z - rz * postOff, y: postH / 2, yaw: 0, sx: 0.5, sy: postH, sz: 0.5, ...own },
          // Beam long axis is local +Z, so yaw = the width-axis bearing.
          { x: r.x, z: r.z, y: postH, yaw: rightYaw, sx: 0.4, sy: 0.4, sz: deckR * 1.8, ...own },
        );
      }
      const bs = 0.8 + instHash(r.clusterSeed, 3) * 0.3;
      const beaconY = r.kind === 'tent_stage' ? TENT_STAGE_RIDGE + 0.9 : postH + 1.6 * s;
      out.beacon.push({
        x: r.x, z: r.z, y: beaconY, yaw: 0, sx: bs, sy: bs, sz: bs,
        color: BEACON_PALETTE[paletteIndex(r, BEACON_PALETTE.length)], ...own,
      });
    } else if (r.kind === 'camp_village') {
      // A scatter of small pitched tents across the same ±CAMP_SQUARE_HALF square
      // the builder packs into, plus one campfire glow at the middle. The
      // positions are HASH-scattered rather than a replay of the builder's
      // rejection sampling — reproducing per-tent placement is exactly the CPU
      // this layer exists to avoid, and at 500 m what has to be true is "a camp
      // of about this size sits here", not "that tent is at that metre".
      // Reuses the `peak` cone pool, so a village costs no extra draw call.
      const n = Math.max(4, Math.min(14, Math.round(r.tents * 0.6 * densityMul)));
      const baseIdx = paletteIndex(r, VILLAGE_PALETTE.length);
      for (let i = 0; i < n; i++) {
        const ix = r.x + (instHash(r.clusterSeed, i * 2 + 1) - 0.5) * 2 * CAMP_SQUARE_HALF;
        const iz = r.z + (instHash(r.clusterSeed, i * 2 + 2) - 0.5) * 2 * CAMP_SQUARE_HALF;
        // The real camp tent is 2.2 m wide and 1.7 m tall (campsite.js buildCampTent).
        const w = 1.25 + instHash(r.clusterSeed, i + 71) * 0.45;
        const h = 1.7 + instHash(r.clusterSeed, i + 131) * 0.7;
        out.peak.push({
          x: ix, z: iz, y: h / 2, yaw: instHash(r.clusterSeed, i + 191) * Math.PI * 2,
          sx: w, sy: h, sz: w,
          color: VILLAGE_PALETTE[(baseIdx + i) % VILLAGE_PALETTE.length], ...own,
        });
      }
      const fs = 0.42 + instHash(r.clusterSeed, 7) * 0.16;
      out.warm.push({ x: r.x, z: r.z, y: 1.0, yaw: 0, sx: fs, sy: fs, sz: fs, ...own });
    } else if (r.kind === 'vendor_row') {
      // A vendor row is TWO booth lines straddling the road (the descriptor
      // centers ON the road point and the builder lays 5-7 stalls per side at
      // ±VENDOR_ROW_OFFSET). The proxy used to draw ONE line of `L/6` peaks —
      // 4 on mid/high, and literally 2 on low — standing in for 10-14 real
      // tents, which is why arriving at one felt like the whole market appeared
      // out of a couple of white triangles (Gary 2026-08-31). It now draws both
      // lines at the real aisle offset, at a per-side count matching the builder.
      const s = r.scale;
      const L = 2 * r.footprint * s;
      const n = Math.max(3, Math.round((L / 5) * densityMul));   // ~5/side at densityMul 1
      const ax = Math.sin(r.yaw), az = Math.cos(r.yaw);       // row axis
      const px = Math.cos(r.yaw), pz = -Math.sin(r.yaw);      // row perpendicular
      const baseIdx = paletteIndex(r, PEAK_PALETTE.length);
      for (let side = -1; side <= 1; side += 2) {
        const ox = px * VENDOR_AISLE_HALF * side, oz = pz * VENDOR_AISLE_HALF * side;
        for (let i = 0; i < n; i++) {
          // Stagger the far side by half a bay so the two lines don't collapse
          // into one doubled silhouette from an oblique angle.
          const j = side > 0 ? i : i + 0.5;
          const t = ((n === 1 ? 0.5 : j / (n - 1)) - 0.5) * L * 0.9;
          const k = i + (side > 0 ? 0 : 53);                  // per-side variation salt
          const w = 2.4 + instHash(r.clusterSeed, k) * 1.4;
          const h = BOOTH_APEX - 0.4 + instHash(r.clusterSeed, k + 101) * 0.9;
          const ix = r.x + ax * t + ox, iz = r.z + az * t + oz;
          out.peak.push({
            x: ix, z: iz, y: h / 2, yaw: r.yaw, sx: w, sy: h, sz: w,
            color: PEAK_PALETTE[(baseIdx + k) % PEAK_PALETTE.length], ...own,
          });
          // One warm marker per bay-pair, on the AISLE side — the strung lights
          // over the street you actually drive down.
          if (i % 2 === 0) {
            const ws = 0.32 + instHash(r.clusterSeed, k + 211) * 0.12;
            out.warm.push({
              x: ix - px * 2.2 * side, z: iz - pz * 2.2 * side, y: 2.9, yaw: 0,
              sx: ws, sy: ws, sz: ws, ...own,
            });
          }
        }
      }
    }
  }
  return out;
}

// ---------- Versioned incremental planning (design D3 / audit V4) ----------
//
// A snapshot plan is built one coarse cell per step() while the previous
// complete snapshot stays visible. The version is the requesting player cell:
// begin() with a newer version discards any pending work, so a stale snapshot
// can never commit after a rapid teleport. The planner is pure bookkeeping —
// the caller provides `planCell(cx, cz)` returning that cell's records — so
// bin/test-far-field can drive it deterministically with fixtures.

export class SnapshotPlanner {
  constructor() {
    this.pending = null;       // { version, cells, next, records }
    this.committed = null;     // { version, records }
    this.superseded = 0;       // debug counter: pending plans discarded
  }

  // Start planning for `version` (e.g. `${pcx},${pcz}`) over `cells`.
  // A begin() for the version already pending or committed is a no-op.
  begin(version, cells) {
    if (this.pending && this.pending.version === version) return;
    if (!this.pending && this.committed && this.committed.version === version) return;
    if (this.pending) this.superseded++;
    this.pending = { version, cells, next: 0, records: [] };
  }

  // Plan up to `maxCells` coarse cells (default 1). Returns true when the
  // pending snapshot completed and was committed atomically this call.
  step(planCell, maxCells = 1) {
    const p = this.pending;
    if (!p) return false;
    let n = 0;
    while (p.next < p.cells.length && n < maxCells) {
      const cell = p.cells[p.next++];
      const recs = planCell(cell.cx, cell.cz);
      if (recs && recs.length) p.records.push(...recs);
      n++;
    }
    if (p.next < p.cells.length) return false;
    this.committed = { version: p.version, records: p.records };
    this.pending = null;
    return true;
  }
}

// ---------- The world-facing peer ----------
//
// Constructed by world.js beside the chunk/lake managers. When `enabled` is
// false (?farField=0, or the horizon killed by ?worldgen=0) the
// constructor stores two booleans and RETURNS: no planner, no records, no
// arrays, no GPU resources, no shader programs — and update()/dispose() bail
// on the first line. bin/test-far-field locks this no-op shape.
//
// When enabled, the constructor allocates the fixed-capacity pools ONCE
// (materials + geometries + instance buffers — design D2: construction time,
// never module evaluation, never per rebuild) and defers all PLANNING to the
// first update() (design D1: nothing rides the boot chain).

export class FarField {
  constructor({ enabled, tier, scene, isLoaded } = {}) {
    this.enabled = !!enabled;
    this.disposed = false;
    if (!this.enabled) return;
    this.tier = tier;                       // PERF.farField: radius/density/caps
    this.planner = new SnapshotPlanner();
    this.stats = {
      active: 0, overflow: 0, rebuilds: 0, superseded: 0,
      roadVertsUsed: 0, roadsClipped: 0, maxColdStepMs: 0, handoffs: 0,
    };
    // The narrow completion predicate (design D1/D4): "is (cx,cz) fully
    // built". The ONLY window into chunk lifecycle this system gets.
    this._isLoaded = isLoaded || null;
    this._vendorRowMax = Math.max(1, Math.round(3 * (tier.densityMul || 1)));
    this._playerCell = null;
    this._planAnchor = { x: 0, z: 0 };
    this._roadSeen = null;
    this._todQ = -1;
    this._nightOn = false;
    this._active = { canopy: [], truss: [], peak: [], warm: [], beacon: [], forest: [] };
    this._ownerCells = new Map();   // 'cx,cz' -> { cx, cz, loaded, insts: [{pool, i}] }
    this._handoffs = [];            // active envelopes: { pool, i, target }
    this._ownershipOverride = null; // null (live) | 'proxy' (all shown) | 'real' (all dissolved)
    this._buildPools(scene || null);
  }

  // Effective completion state for one owner cell: the debug/sandbox override
  // wins, else the narrow isLoaded predicate (absent predicate = never loaded).
  _cellLoaded(cx, cz) {
    if (this._ownershipOverride === 'proxy') return false;
    if (this._ownershipOverride === 'real') return true;
    return this._isLoaded ? !!this._isLoaded(cx, cz) : false;
  }

  // ---- Deterministic forcing controls (task 4.2 — __dbg + hub sandbox) ----

  // Force every proxy shown ('proxy'), every proxy dissolved ('real'), or
  // return to live predicate-driven handoff (null/'live'). Snaps immediately
  // (fixed A/B captures want a stable frame, not an animation).
  setOwnershipOverride(mode) {
    if (!this.enabled || this.disposed) return;
    this._ownershipOverride = (mode === 'proxy' || mode === 'real') ? mode : null;
    this._handoffs.length = 0;
    for (const cell of this._ownerCells.values()) {
      cell.loaded = this._cellLoaded(cell.cx, cell.cz);
      for (const ref of cell.insts) {
        ref.pool.fade.array[ref.i] = cell.loaded ? 0 : 1;
        ref.pool.fade.needsUpdate = true;
      }
    }
  }

  // Drop the committed + pending snapshots so the next update replans from
  // scratch at the current player cell (same plan, byte-identical — for
  // deterministic rebuild timing/lifecycle captures).
  forceReplan() {
    if (!this.enabled || this.disposed) return;
    this._playerCell = null;
    this.planner.pending = null;
    this.planner.committed = null;
  }

  _buildPools(scene) {
    const caps = this.tier.caps;
    // Owner-only scratch (no module-level THREE objects — see header).
    this._m4 = new THREE.Matrix4();
    this._v3 = new THREE.Vector3();
    this._col = new THREE.Color();

    this.group = new THREE.Group();
    this.group.name = 'farField';

    const mkMat = (hex) => new THREE.MeshBasicMaterial({ color: hex });
    this._mats = {
      canopy: mkMat(0xffffff),   // white base × per-instance color
      truss: mkMat(TRUSS_HEX),
      peak: mkMat(0xffffff),
      warm: mkMat(WARM_HEX),
      beacon: mkMat(0xffffff),
      forest: mkMat(0xffffff),   // white base × per-instance FOREST_PALETTE color
      road: mkMat(ROAD_HEX),     // opaque, depthWrite:true (default) — audit V12
    };
    this._geos = {
      canopy: new THREE.BoxGeometry(1, 1, 1),   // roofed-stage roof slab (a tent stage uses `peak`)
      truss: new THREE.BoxGeometry(1, 1, 1),
      peak: new THREE.ConeGeometry(1, 1, 4),
      warm: new THREE.OctahedronGeometry(1, 0),
      beacon: new THREE.OctahedronGeometry(1, 0),
      // Detail-0 icosa (20 tris) — the ROADMAP's sanctioned far-crown shape.
      forest: new THREE.IcosahedronGeometry(1, 0),
    };

    // The horizon RINGS the player, so per-batch frustum culling would almost
    // never reject a batch — and three r160 culls InstancedMesh against the
    // BASE geometry's bounds, not the instances. Culling is therefore
    // deliberately disabled per batch (the sanctioned design-D2 alternative);
    // owner-computed bounding spheres are still maintained after every
    // committed rewrite so bounds stay truthful for raycast/debug reads.
    this._pools = {};
    const hasColor = { canopy: true, truss: false, peak: true, warm: false, beacon: true, forest: true };
    for (const name of ['canopy', 'truss', 'peak', 'warm', 'beacon', 'forest']) {
      const mesh = new THREE.InstancedMesh(this._geos[name], this._mats[name], caps[name]);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
      mesh.name = 'farField:' + name;
      // Per-instance dissolve state for the completion handoff (design D4).
      const fade = new THREE.InstancedBufferAttribute(new Float32Array(caps[name]).fill(1), 1);
      fade.setUsage(THREE.DynamicDrawUsage);
      this._geos[name].setAttribute('aFade', fade);
      applyProxyDither(this._mats[name]);
      this._pools[name] = { name, mesh, fade, hasColor: hasColor[name], cap: caps[name] };
      this.group.add(mesh);
    }

    // Road underlay: ONE preallocated draw. Positions/indices are typed
    // arrays sized to the tier cap, rewritten in place on commit;
    // setDrawRange exposes the active prefix (design D2/D3).
    const roadGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(new Float32Array(caps.roadVerts * 3), 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const idxAttr = new THREE.BufferAttribute(new Uint16Array(caps.roadIndices), 1);
    idxAttr.setUsage(THREE.DynamicDrawUsage);
    roadGeo.setAttribute('position', posAttr);
    roadGeo.setIndex(idxAttr);
    roadGeo.setDrawRange(0, 0);
    roadGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    const roadMesh = new THREE.Mesh(roadGeo, this._mats.road);
    roadMesh.position.y = ROAD_UNDERLAY_Y;
    roadMesh.visible = false;
    roadMesh.frustumCulled = false;
    roadMesh.castShadow = false;
    roadMesh.receiveShadow = false;
    roadMesh.name = 'farField:road';
    this._road = { mesh: roadMesh, geo: roadGeo, posAttr, idxAttr };
    this.group.add(roadMesh);

    if (scene) scene.add(this.group);
  }

  // Per-frame entry point. Planning is boundary-triggered: crossing an 80m
  // player cell begins a fresh versioned snapshot; while one is pending,
  // coarse cells are planned one at a time under `opts.budgetMs` — the
  // REMAINDER of the world-owned streaming wall handed down by world.js
  // (design D3: there is no second budget) — or exactly one cell per call
  // when no budget is given. Steady-state frames (no boundary, no pending
  // plan) allocate nothing and return immediately.
  update(px, pz, opts = {}) {
    if (!this.enabled || this.disposed) return;
    if (opts.nightness != null) this._applyTimeOfDay(opts.nightness);
    if (px == null || pz == null) return;

    const pcx = ownerCellCoord(px);
    const pcz = ownerCellCoord(pz);
    const version = pcx + ',' + pcz;
    if (version !== this._playerCell) {
      this._playerCell = version;
      // Anchor capacity selection to the CELL CENTER (not raw px/pz) so the
      // committed pool contents are byte-stable for a given player cell.
      this._planAnchor.x = pcx * 80;
      this._planAnchor.z = pcz * 80;
      this._roadSeen = new Set();
      this.planner.begin(version, coarseCellsFor(this._planAnchor.x, this._planAnchor.z, this.tier.radius));
    }

    // Planning spends only the REMAINDER of the world-owned streaming wall
    // (design D3: chunks consume first, there is no second budget). A zero
    // remainder plans nothing this frame; a positive one may overshoot by at
    // most one indivisible cold step, which stats.maxColdStepMs measures and
    // the tier's maxColdStepMs gate judges. With no budget given (tests,
    // sandbox), exactly one cell is planned per call.
    if (this.planner.pending && !(opts.budgetMs != null && opts.budgetMs <= 0)) {
      const t0 = performance.now();
      for (;;) {
        const c0 = performance.now();
        const committed = this.planner.step((cx, cz) => this._planCellRecords(cx, cz, this._roadSeen), 1);
        const cellMs = performance.now() - c0;
        if (cellMs > this.stats.maxColdStepMs) this.stats.maxColdStepMs = cellMs;
        if (committed) {
          this._applySnapshot(this.planner.committed.records);
          break;
        }
        if (!this.planner.pending) break;
        if (opts.budgetMs == null || performance.now() - t0 >= opts.budgetMs) break;
      }
    }

    this._updateHandoffs(opts.dt == null ? 0.016 : opts.dt, !!opts.reducedMotion);
  }

  // One coarse cell's records: hearts OWNED by the cell (dedupe across the
  // padded heartsInBounds window via the same owner-cell rule), their plan
  // records, plus road polylines first seen by this snapshot (polylines span
  // cells; the per-snapshot `roadSeen` set dedupes by the cached polyline's
  // identity, which is stable within a worldgen epoch).
  _planCellRecords(cellCx, cellCz, roadSeen) {
    const half = COARSE_CELL / 2;
    const minX = cellCx * COARSE_CELL - half, maxX = cellCx * COARSE_CELL + half;
    const minZ = cellCz * COARSE_CELL - half, maxZ = cellCz * COARSE_CELL + half;
    const out = [];
    for (const h of heartsInBounds(minX, minZ, maxX, maxZ)) {
      if (ownerCellCoord(h.x, COARSE_CELL) !== cellCx || ownerCellCoord(h.z, COARSE_CELL) !== cellCz) continue;
      const recs = copyHeartRecords(h, festivalPlan(h), this._vendorRowMax);
      if (recs.length) out.push(...recs);
    }
    for (const road of roadsInBounds(minX, minZ, maxX, maxZ)) {
      if (roadSeen.has(road.points)) continue;
      roadSeen.add(road.points);
      out.push({ kind: '__road', flat: copyPolyline(road.points) });
    }
    // Camp villages ride their own coarse grid, so they are gathered separately
    // from the hearts above — and deduped by the SAME owner-cell rule, since a
    // village whose grid cell overlaps this box may belong to a neighbour.
    // `campVillagesNear` also returns each village's welfare post; only the
    // village itself gets a silhouette.
    for (const v of campVillagesNear({ minX, minZ, maxX, maxZ })) {
      if (v.kind !== 'camp_village') continue;
      if (ownerCellCoord(v.x, COARSE_CELL) !== cellCx || ownerCellCoord(v.z, COARSE_CELL) !== cellCz) continue;
      out.push(copyVillageRecord(v));
    }
    out.push(...forestRecordsForCell(cellCx, cellCz, this.tier.forestStep || 48));
    return out;
  }

  // Atomic pool rewrite from a committed snapshot (design D2/D3): expand,
  // keep the nearest under each fixed cap, write matrices/colors in place,
  // flip needsUpdate, recompute the owner-maintained bounds. Never touches
  // the registry, never disposes or reallocates a buffer.
  _applySnapshot(records) {
    const ax = this._planAnchor.x, az = this._planAnchor.z;
    const expanded = expandFarInstances(records, this.tier.densityMul || 1);
    // A (re)plan snaps every proxy's ownership state without an envelope
    // (design D1/D4) — clear active envelopes, rebuild the owner-cell index.
    this._ownerCells.clear();
    this._handoffs.length = 0;
    let active = 0, overflow = 0;
    for (const name of ['canopy', 'truss', 'peak', 'warm', 'beacon', 'forest']) {
      const pool = this._pools[name];
      const sel = selectNearest(expanded[name], ax, az, pool.cap);
      this._active[name] = sel.kept;
      overflow += sel.overflow;
      active += sel.kept.length;
      this._writePool(pool, sel.kept);
    }
    this._writeRoads(expanded.roads);
    this._applyNightVisibility();
    this.stats.active = active;
    this.stats.overflow = overflow;
    this.stats.rebuilds++;
    this.stats.superseded = this.planner.superseded;
  }

  _writePool(pool, kept) {
    const mesh = pool.mesh;
    const m = this._m4, s = this._v3, c = this._col;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let maxExt = 0;
    for (let i = 0; i < kept.length; i++) {
      const inst = kept[i];
      m.makeRotationY(inst.yaw || 0);
      m.scale(s.set(inst.sx, inst.sy, inst.sz));
      m.setPosition(inst.x, inst.y, inst.z);
      mesh.setMatrixAt(i, m);
      if (pool.hasColor) {
        c.setHex(inst.color);
        mesh.setColorAt(i, c);
      }
      // Ownership snap + owner-cell index for the completion handoff.
      const key = inst.ownerCx + ',' + inst.ownerCz;
      let cell = this._ownerCells.get(key);
      if (!cell) {
        cell = {
          cx: inst.ownerCx, cz: inst.ownerCz,
          loaded: this._cellLoaded(inst.ownerCx, inst.ownerCz),
          insts: [],
        };
        this._ownerCells.set(key, cell);
      }
      cell.insts.push({ pool, i });
      pool.fade.array[i] = cell.loaded ? 0 : 1;
      if (inst.x < minX) minX = inst.x;
      if (inst.y < minY) minY = inst.y;
      if (inst.z < minZ) minZ = inst.z;
      if (inst.x > maxX) maxX = inst.x;
      if (inst.y > maxY) maxY = inst.y;
      if (inst.z > maxZ) maxZ = inst.z;
      const e = Math.max(inst.sx, inst.sy, inst.sz);
      if (e > maxExt) maxExt = e;
    }
    mesh.count = kept.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (pool.hasColor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    pool.fade.needsUpdate = true;
    mesh.visible = kept.length > 0;
    if (kept.length > 0) {
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
      const dx = maxX - cx, dy = maxY - cy, dz = maxZ - cz;
      mesh.boundingSphere.center.set(cx, cy, cz);
      mesh.boundingSphere.radius = Math.sqrt(dx * dx + dy * dy + dz * dz) + maxExt;
    } else {
      mesh.boundingSphere.center.set(0, 0, 0);
      mesh.boundingSphere.radius = 0;
    }
  }

  // Fill the preallocated road buffers from the snapshot's copied polylines.
  // Same miter math as the real chunk ribbon (chunks.js buildRibbonFromPolyline)
  // so joints read smoothly; a polyline that would overflow either cap is
  // skipped WHOLE (deterministic capacity behavior — never a half ribbon),
  // counted in stats.roadsClipped.
  _writeRoads(flats) {
    const { geo, posAttr, idxAttr, mesh } = this._road;
    const capV = this.tier.caps.roadVerts, capI = this.tier.caps.roadIndices;
    const pos = posAttr.array, idx = idxAttr.array;
    const halfW = (CONFIG.ROAD_WIDTH * FAR_ROAD_WIDTH_FRAC) / 2;
    // roadsInBounds pads its query by ROAD_MAX_EDGE_CELLS heart cells, so the
    // coarse-cell sweep discovers arterials far beyond the horizon. Keep only
    // polylines that come within radius(+one coarse cell) of the plan anchor,
    // nearest-first with a stable tie-break, so the fixed buffer always holds
    // the roads the player can actually see (deterministic capacity behavior).
    const ax = this._planAnchor.x, az = this._planAnchor.z;
    const reach = this.tier.radius + COARSE_CELL;
    const scored = [];
    for (const flat of flats) {
      let best = Infinity;
      for (let i = 0; i < flat.length; i += 2) {
        const d = Math.hypot(flat[i] - ax, flat[i + 1] - az);
        if (d < best) best = d;
      }
      if (best <= reach) scored.push({ flat, d: best });
    }
    scored.sort((a, b) => a.d - b.d || a.flat[0] - b.flat[0] || a.flat[1] - b.flat[1]);
    let v = 0, ix = 0, clipped = 0;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const { flat } of scored) {
      const n = flat.length / 2;
      if (n < 2) continue;
      if (v + n * 2 > capV || ix + (n - 1) * 6 > capI) { clipped++; continue; }
      const base = v;
      for (let i = 0; i < n; i++) {
        const cxp = flat[i * 2], czp = flat[i * 2 + 1];
        let tx, tz;
        if (i > 0 && i < n - 1) {
          const p0x = flat[(i - 1) * 2], p0z = flat[(i - 1) * 2 + 1];
          const p2x = flat[(i + 1) * 2], p2z = flat[(i + 1) * 2 + 1];
          const d1x = cxp - p0x, d1z = czp - p0z, l1 = Math.hypot(d1x, d1z) || 1;
          const d2x = p2x - cxp, d2z = p2z - czp, l2 = Math.hypot(d2x, d2z) || 1;
          tx = d1x / l1 + d2x / l2; tz = d1z / l1 + d2z / l2;
        } else if (i < n - 1) {
          tx = flat[(i + 1) * 2] - cxp; tz = flat[(i + 1) * 2 + 1] - czp;
        } else {
          tx = cxp - flat[(i - 1) * 2]; tz = czp - flat[(i - 1) * 2 + 1];
        }
        const tl = Math.hypot(tx, tz) || 1;
        const pxn = -(tz / tl), pzn = tx / tl;
        const o = (base + i * 2) * 3;
        pos[o] = cxp + pxn * halfW; pos[o + 1] = 0; pos[o + 2] = czp + pzn * halfW;
        pos[o + 3] = cxp - pxn * halfW; pos[o + 4] = 0; pos[o + 5] = czp - pzn * halfW;
        if (cxp - halfW < minX) minX = cxp - halfW;
        if (cxp + halfW > maxX) maxX = cxp + halfW;
        if (czp - halfW < minZ) minZ = czp - halfW;
        if (czp + halfW > maxZ) maxZ = czp + halfW;
      }
      for (let i = 0; i < n - 1; i++) {
        const a = base + i * 2, b = a + 1, cIdx = a + 2, d = a + 3;
        idx[ix] = a; idx[ix + 1] = cIdx; idx[ix + 2] = b;
        idx[ix + 3] = b; idx[ix + 4] = cIdx; idx[ix + 5] = d;
        ix += 6;
      }
      v += n * 2;
    }
    posAttr.needsUpdate = true;
    idxAttr.needsUpdate = true;
    geo.setDrawRange(0, ix);
    mesh.visible = ix > 0;
    if (v > 0) {
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      geo.boundingSphere.center.set(cx, 0, cz);
      geo.boundingSphere.radius = Math.hypot(maxX - cx, maxZ - cz) + 1;
    } else {
      geo.boundingSphere.center.set(0, 0, 0);
      geo.boundingSphere.radius = 0;
    }
    this.stats.roadVertsUsed = v;
    this.stats.roadsClipped = clipped;
  }

  // Shared Noon→Midnight behavior (design D5, task 2.4): whole-batch
  // material color updates only — no per-marker animation, no transparency,
  // no lights, no bloom writer, and (via the 1/64 quantization latch) no
  // per-frame work while nightness is stable.
  _applyTimeOfDay(nightness) {
    const q = Math.round(Math.min(1, Math.max(0, nightness)) * 64);
    if (q === this._todQ) return;
    this._todQ = q;
    const n = q / 64;
    const dayB = 1 - 0.82 * n;
    this._mats.canopy.color.setScalar(dayB);
    this._mats.peak.color.setScalar(dayB);
    this._mats.forest.color.setScalar(dayB);
    this._mats.truss.color.setHex(TRUSS_HEX).multiplyScalar(dayB);
    this._mats.road.color.setHex(ROAD_HEX).multiplyScalar(1 - 0.85 * n);
    this._nightOn = n > NIGHT_MARKER_THRESHOLD;
    const glow = this._nightOn ? Math.min(1, (n - NIGHT_MARKER_THRESHOLD) / 0.25) : 0;
    this._mats.warm.color.setHex(WARM_HEX).multiplyScalar(0.3 + 0.7 * glow);
    this._mats.beacon.color.setScalar(0.3 + 0.7 * glow);
    this._applyNightVisibility();
  }

  // Completion handoff (design D4, task 3.2): each owner cell's target
  // visibility follows the narrow isLoaded predicate — loaded → fade 0
  // (dissolved, the real chunk has its props), unloaded → fade 1 (proxy
  // shown again after a chunk unload). Only ACTIVE handoffs are stepped
  // (0.3s envelope); reduced motion is read live per call and snaps.
  // Steady-state frames with no ownership change and no running envelope
  // do one boolean check per owner cell and allocate nothing.
  _updateHandoffs(dt, reducedMotion) {
    if ((this._isLoaded || this._ownershipOverride) && this._ownerCells.size) {
      for (const cell of this._ownerCells.values()) {
        const cur = this._cellLoaded(cell.cx, cell.cz);
        if (cur === cell.loaded) continue;
        cell.loaded = cur;
        this.stats.handoffs++;
        const target = cur ? 0 : 1;
        const snap = handoffMode(reducedMotion) === 'snap';
        for (const ref of cell.insts) this._setFadeTarget(ref.pool, ref.i, target, snap);
      }
    }
    if (this._handoffs.length === 0) return;
    const stepAmt = dt / HANDOFF_ENVELOPE_S;
    for (let k = this._handoffs.length - 1; k >= 0; k--) {
      const h = this._handoffs[k];
      const arr = h.pool.fade.array;
      const cur = arr[h.i];
      const next = cur < h.target
        ? Math.min(h.target, cur + stepAmt)
        : Math.max(h.target, cur - stepAmt);
      arr[h.i] = next;
      h.pool.fade.needsUpdate = true;
      if (next === h.target) {
        this._handoffs[k] = this._handoffs[this._handoffs.length - 1];
        this._handoffs.pop();
      }
    }
  }

  _setFadeTarget(pool, i, target, snap) {
    // One envelope per instance: retarget an existing entry instead of
    // stacking a second (a chunk can load and unload mid-dissolve).
    let entry = null;
    for (let k = 0; k < this._handoffs.length; k++) {
      const h = this._handoffs[k];
      if (h.pool === pool && h.i === i) { entry = h; break; }
    }
    if (snap) {
      pool.fade.array[i] = target;
      pool.fade.needsUpdate = true;
      if (entry) {
        const k = this._handoffs.indexOf(entry);
        this._handoffs[k] = this._handoffs[this._handoffs.length - 1];
        this._handoffs.pop();
      }
      return;
    }
    if (entry) entry.target = target;
    else this._handoffs.push({ pool, i, target });
  }

  _applyNightVisibility() {
    for (const name of ['warm', 'beacon']) {
      const mesh = this._pools[name].mesh;
      mesh.visible = this._nightOn && mesh.count > 0;
    }
  }

  // Idempotent, OWNER-ONLY teardown: releases exactly the pools, geometries
  // and materials this instance built (nothing here is `userData.shared`, and
  // nothing shared ever enters this group). Safe to call twice — for
  // hub-sandbox rebuilds and page teardown.
  dispose() {
    if (!this.enabled || this.disposed) return;
    this.disposed = true;
    this.planner = null;
    if (this._pools) {
      for (const name of Object.keys(this._pools)) this._pools[name].mesh.dispose();
      for (const name of Object.keys(this._geos)) this._geos[name].dispose();
      for (const name of Object.keys(this._mats)) this._mats[name].dispose();
      this._road.geo.dispose();
      if (this.group.parent) this.group.parent.remove(this.group);
    }
    this._pools = null;
    this._geos = null;
    this._mats = null;
    this._road = null;
    this._active = null;
    this._ownerCells = null;
    this._handoffs = null;
    this.group = null;
  }
}
