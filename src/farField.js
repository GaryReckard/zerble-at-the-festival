import {landscapeClearance} from './worldgen/landscapePolicy.js';
import { pavedCutters, trimRoadTriangles } from './roadGeometry.js';
import { terrainHeight, terrainEnabled, terrainGenerationKey, drapeTerrainTriangles, prepareTerrainHeight, prepareTerrainArea } from './worldgen/terrain.js';
// FarField — the render-only festival horizon (festival-horizon change).
//
// A PEER of ChunkManager/LakeManager owned by world.js, never another chunk
// ring: it draws batched far-distance silhouettes (roads, gabled stage and
// marquee roofs, vendor peaks, trusses, coarse forest masses + night markers) from the same
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
import { ownerCellCoord, vendorRowSlots } from './worldgen/placement.js';
import { mulberry32 } from './rng.js';
import { FESTIVAL_TUNING } from './worldgen/tuning.js';
import { STAGE_SHAPES, STAGE_SURFACES, MARQUEE_SHAPE, VENDOR_ROOF_SHAPE, VENDOR_LEG_SHAPE, vendorCanopyAppearance } from './festivalShapes.js';
import { heartsInBounds } from './worldgen/hearts.js';
import { festivalPlan, campVillagesNear } from './worldgen/festival.js';
import { roadsInBounds } from './worldgen/roads.js';
import { treeDensity } from './worldgen/density.js';
import { CONFIG } from './worldgen/constants.js';
import { planCampNeighborhood } from './campPlanning.js';

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
const BEACON_PALETTE = [0xff5a4d, 0x4da2ff, 0xffd24d, 0xb56aff];
// Match the near camp's muted fabric palette so streaming does not recolor it.
const VILLAGE_PALETTE = [0x75816a, 0x969d94, 0x667b6b, 0xb2a66f, 0xd0ceb9, 0xe0dfd1];
// Darker cuts of tree.js's FOREST_GREENS — far masses read through fog.
const FOREST_PALETTE = [0x355a32, 0x3f6d3a, 0x2d4e2a, 0x4a7a45];
const TRUSS_HEX = 0x2e2a33;
const WARM_HEX = 0xffb054;
const ROAD_HEX = 0x9c7c58;   // a shade darker than the real road's 0xb89570

// MeshBasicMaterial ignores the sun, hemisphere and ambient lights that shade
// the real canvas. These are LINEAR-space multipliers: even 0.18 becomes a
// conspicuous pale grey after sRGB output conversion at midnight. Keep the
// non-emissive horizon subdued at noon and let it settle close to the night
// fog color; the intentional warm/beacon markers retain their own glow curve.
const SURFACE_DAY_BRIGHTNESS = 0.6;
const SURFACE_NIGHT_BRIGHTNESS = 0.04;
const ROAD_DAY_BRIGHTNESS = 0.8;
const ROAD_NIGHT_BRIGHTNESS = 0.035;

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
    footprint: +(v.footprint || FESTIVAL_TUNING.KIND_FOOTPRINT.camp_village),
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
// The semantic vocabulary (design D2/D3): a stage becomes its defining deck,
// backdrop, roof or rear wall, truss and beacon; a vendor row becomes a strip
// of roof peaks with warm light markers alongside. Sizes are coarse on purpose —
// these read through 300-500m of fog, not up close.
// Ground heights are DEFERRED: every instance carries the point it stands on
// (gx, gz) and up to two vertical offsets (ya, yb), and `groundFarInstance`
// resolves `y` later. Sampling terrain here made each rewrite pay for every
// candidate before the pool caps discarded more than half of them, and the
// discarded ones are the farthest, whose terrain tiles are the coldest (a cold
// tile runs festival and woodland planning). Selection reads x/z only, so the
// kept set is unchanged by resolving heights afterwards.
export function planFarInstances(records, densityMul) {
  const out = { canopy: [], marqueeWall: [], truss: [], peak: [], vendorLegs: [], warm: [], beacon: [], forest: [], roads: [] };
  for (const r of records) {
    if (r.kind === '__road') { out.roads.push({flat:r.flat,width:r.width,surface:r.surface}); continue; }
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
        x: r.x, z: r.z, y: 0, yaw: instHash(r.forestSeed, 5) * Math.PI * 2,
        sx: rad, sy: h * 0.6, sz: rad * (0.85 + instHash(r.forestSeed, 6) * 0.3),
        color: FOREST_PALETTE[(r.forestSeed >>> 3) % FOREST_PALETTE.length],
        ownerCx: ownerCellCoord(r.x), ownerCz: ownerCellCoord(r.z),
        gx: r.x, gz: r.z, ya: h * 0.32,
      });
      continue;
    }
    // Every instance of a cluster stands on the cluster's own ground sample
    // unless it overrides gx/gz (camp pitches, vendor bays).
    const own = { ownerCx: r.ownerCx, ownerCz: r.ownerCz, gx: r.x, gz: r.z };
    if (STAGE_KINDS.has(r.kind)) {
      const s = r.scale;
      if (r.kind === 'tent_stage') {
        const rise = MARQUEE_SHAPE.ridgeHeight - MARQUEE_SHAPE.eaveHeight;
        out.canopy.push({
          x: r.x, z: r.z, y: 0, ya: MARQUEE_SHAPE.eaveHeight, yb: rise / 2, yaw: r.yaw,
          sx: MARQUEE_SHAPE.width, sy: rise, sz: MARQUEE_SHAPE.depth,
          color: MARQUEE_SHAPE.roofColor, ...own,
        });
        const backZ = -MARQUEE_SHAPE.depth / 2;
        out.marqueeWall.push({
          x: r.x + Math.sin(r.yaw) * backZ, z: r.z + Math.cos(r.yaw) * backZ,
          y: 0, yaw: r.yaw,
          sx: MARQUEE_SHAPE.width, sy: MARQUEE_SHAPE.ridgeHeight, sz: 1,
          color: MARQUEE_SHAPE.roofColor, ...own,
        });
      } else {
        const shape = r.kind === 'main_stage' ? STAGE_SHAPES.main : STAGE_SHAPES.side;
        const postH = shape.trussHeight * s;
        const postOff = (shape.width / 2 - 0.3) * s;
        const rightYaw = r.yaw + Math.PI / 2;
        const rx = Math.sin(rightYaw), rz = Math.cos(rightYaw);
        const deckH = STAGE_SURFACES.deckHeight * s;
        out.truss.push({
          x: r.x, z: r.z, y: 0, ya: deckH / 2, yaw: r.yaw,
          sx: shape.width * s, sy: deckH, sz: shape.depth * s,
          color: STAGE_SURFACES.deckColor, ...own,
        });
        const bannerZ = -(shape.depth / 2 + STAGE_SURFACES.bannerThickness / 2) * s;
        const bannerRng = mulberry32((r.clusterSeed >>> 0) || 0x1A2B3C);
        bannerRng(); // real buildStage consumes the scale draw before buildStageModel selects the banner
        const bannerColor = r.kind === 'main_stage' ? STAGE_SURFACES.mainBannerColor
          : STAGE_SURFACES.sideBannerColors[Math.floor(bannerRng() * STAGE_SURFACES.sideBannerColors.length)];
        out.truss.push({
          x: r.x + Math.sin(r.yaw) * bannerZ, z: r.z + Math.cos(r.yaw) * bannerZ,
          y: 0, ya: STAGE_SURFACES.bannerCenterY * s, yaw: r.yaw,
          sx: shape.width * s, sy: STAGE_SURFACES.bannerHeight * s,
          sz: STAGE_SURFACES.bannerThickness * s,
          color: bannerColor, ...own,
        });
        if (shape.hasRoof) {
          out.canopy.push({
            x: r.x, z: r.z, y: 0, ya: postH, yb: shape.roofRise * s / 2,
            yaw: rightYaw,
            sx: (shape.depth + 2 * shape.roofOverhang) * s,
            sy: shape.roofRise * s,
            sz: (shape.width + 2 * shape.roofOverhang) * s,
            color: shape.roofColor, ...own,
          });
          const backZ = -(shape.depth / 2 + 0.3) * s;
          out.truss.push({
            x: r.x + Math.sin(r.yaw) * backZ, z: r.z + Math.cos(r.yaw) * backZ,
            y: 0, ya: postH / 2, yaw: r.yaw,
            sx: shape.width * s, sy: postH, sz: 0.4 * s,
            color: shape.roofColor, ...own,
          });
        }
        out.truss.push(
          { x: r.x + rx * postOff, z: r.z + rz * postOff, y: 0, ya: postH / 2, yaw: 0, sx: 0.5 * s, sy: postH, sz: 0.5 * s, color: TRUSS_HEX, ...own },
          { x: r.x - rx * postOff, z: r.z - rz * postOff, y: 0, ya: postH / 2, yaw: 0, sx: 0.5 * s, sy: postH, sz: 0.5 * s, color: TRUSS_HEX, ...own },
          { x: r.x, z: r.z, y: 0, ya: postH, yaw: rightYaw, sx: 0.4 * s, sy: 0.4 * s, sz: shape.width * s, color: TRUSS_HEX, ...own },
        );
      }
      const bs = 0.8 + instHash(r.clusterSeed, 3) * 0.3;
      const roofTop = r.kind === 'tent_stage' ? MARQUEE_SHAPE.ridgeHeight
        : (r.kind === 'main_stage' ? STAGE_SHAPES.main.trussHeight + STAGE_SHAPES.main.roofRise : STAGE_SHAPES.side.trussHeight) * s;
      const beaconY = roofTop + bs + 0.4 * (r.kind === 'tent_stage' ? 1 : s);
      out.beacon.push({
        x: r.x, z: r.z, y: 0, ya: beaconY, yaw: 0, sx: bs, sy: bs, sz: bs,
        color: BEACON_PALETTE[paletteIndex(r, BEACON_PALETTE.length)], ...own,
      });
    } else if (r.kind === 'camp_village') {
      // Match the real builder's first two cluster draws and shared pure plan.
      // Registry-driven rejection and outward retries remain near-field truth;
      // the horizon represents nominal pitches without constructing gameplay.
      const rng = mulberry32((r.clusterSeed >>> 0) || 0x1A2B3C);
      const phase = rng() * Math.PI * 2, seed = Math.floor(rng() * 0x100000000);
      const pitches = planCampNeighborhood(r.tents, { envelope: r.footprint, phase, seed,
        density: seed % 5 === 0 ? 'roomy' : 'compact' });
      const baseIdx = paletteIndex(r, VILLAGE_PALETTE.length);
      let index = 0;
      for (const pitch of pitches) {
        const { recipe } = pitch;
        const pitchAt = { gx: r.x + pitch.x, gz: r.z + pitch.z };
        for (const [i, family] of recipe.tentFamilies.entries()) {
          const slot = index++;
          if (slot > 0 && densityMul < 1 && instHash(r.clusterSeed, slot + 401) >= densityMul) continue;
          const yaw = pitch.facing - (i - (recipe.tentFamilies.length - 1) / 2) * recipe.tentArcStep;
          const distance = recipe.tentRadius * 2;
          const [w, h, d] = family === 'octagon' ? [7.12, 4.7, 7.12]
            : family === 'multiroom' ? [6.4, 4.36, 5.1]
            : family === 'cabin' ? [5.1, 4.36, 5.1]
            : family === 'dome' ? [6.32, 3.3, 6.32] : [4.4, 3.4, 5];
          out.peak.push({ x: r.x + pitch.x - Math.sin(yaw) * distance,
            z: r.z + pitch.z - Math.cos(yaw) * distance, y: 0, ya: h / 2, yaw,
            sx: w, sy: h, sz: d,
            color: VILLAGE_PALETTE[(baseIdx + slot) % VILLAGE_PALETTE.length], ...own, ...pitchAt });
        }
        if (recipe.kitchen) {
          const distance = (recipe.layoutRadius * .85 + .35) * 2;
          out.canopy.push({ x: r.x + pitch.x + Math.sin(pitch.facing) * distance,
            z: r.z + pitch.z + Math.cos(pitch.facing) * distance,
            y: 0, ya: 5.15, yaw: pitch.facing, sx: 6, sy: .7, sz: 6,
            color: 0x3a82c0, ...own, ...pitchAt });
        }
      }
      const fs = 0.42 + instHash(r.clusterSeed, 7) * 0.16;
      out.warm.push({ x: r.x, z: r.z, y: 0, ya: 1.0, yaw: 0, sx: fs, sy: fs, sz: fs, ...own });
    } else if (r.kind === 'vendor_row') {
      // The first cluster-local RNG draw is the real builder's booth count.
      // Lower tiers may omit slots, but surviving roofs stay on the exact
      // candidate grid and never stagger or slide when detail arrives.
      const rng = mulberry32((r.clusterSeed >>> 0) || 0x1A2B3C);
      const T = FESTIVAL_TUNING;
      const n = T.VENDOR_ROW_COUNT_BASE + Math.floor(rng() * T.VENDOR_ROW_COUNT_SPAN);
      const px = Math.cos(r.yaw), pz = -Math.sin(r.yaw);      // row perpendicular
      for (const slot of vendorRowSlots(r.x, r.z, r.yaw, n, T)) {
        const { i, side, x: ix, z: iz } = slot;
        if (densityMul < 1 && instHash(r.clusterSeed, i * 2 + (side > 0 ? 1 : 0)) >= densityMul) continue;
        const appearance = vendorCanopyAppearance(ix, iz);
        out.peak.push({
          x: ix, z: iz, y: 0, ya: VENDOR_ROOF_SHAPE.centerY,
          yaw: r.yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI + appearance.roofYaw,
          sx: VENDOR_ROOF_SHAPE.radius, sy: VENDOR_ROOF_SHAPE.height, sz: VENDOR_ROOF_SHAPE.radius,
          color: appearance.roof, vendor: true, ...own, gx: ix, gz: iz,
        });
        out.vendorLegs.push({ x: ix, z: iz, y: 0,
          yaw: r.yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI,
          sx: 1, sy: 1, sz: 1, ...own, gx: ix, gz: iz });
        // One warm marker per bay-pair, on the AISLE side — the strung lights
        // over the street you actually drive down.
        if (i % 2 === 0) {
          const ws = 0.32 + instHash(r.clusterSeed, i + (side > 0 ? 0 : 53) + 211) * 0.12;
          out.warm.push({
            x: ix - px * 2.2 * side, z: iz - pz * 2.2 * side, y: 0, ya: 2.9, yaw: 0,
            sx: ws, sy: ws, sz: ws, ...own, gx: ix, gz: iz,
          });
        }
      }
    }
  }
  return out;
}

// y = ground + ya + yb, summed left to right exactly as the original inline
// expressions were, so a deferred height is bit-identical to an eager one. An
// absent offset is skipped rather than added as zero: `-0 + 0` is `+0`, and a
// ground sample of negative zero must survive.
export function groundFarInstance(inst) {
  let y = terrainHeight(inst.gx, inst.gz);
  if (inst.ya !== undefined) y += inst.ya;
  if (inst.yb !== undefined) y += inst.yb;
  inst.y = y;
  return inst;
}

// Eager form for tests and tools that want every candidate fully placed.
export function expandFarInstances(records, densityMul) {
  const out = planFarInstances(records, densityMul);
  for (const name in out) if (name !== 'roads') out[name].forEach(groundFarInstance);
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

function gableRoofGeometry() {
  // Unit open gable: eaves at y=-0.5, ridge at y=+0.5 along local Z.
  // Main-stage instances turn it 90° so their ridge runs along local X;
  // marquee instances keep the long ridge on Z. Two roof panels, four tris.
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.5, -0.5, -0.5, 0, 0.5, -0.5, -0.5, -0.5, 0.5, 0, 0.5, 0.5,
     0, 0.5, -0.5, 0.5, -0.5, -0.5, 0, 0.5, 0.5, 0.5, -0.5, 0.5,
  ]), 3));
  geo.setIndex([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]);
  geo.computeVertexNormals();
  return geo;
}

function marqueeWallGeometry() {
  // One closed rear pentagon. The roof pool supplies the two sloping panels;
  // the front and both sides remain open like the built tent.
  const eave = MARQUEE_SHAPE.eaveHeight / MARQUEE_SHAPE.ridgeHeight;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.5, 0, 0, -0.5, eave, 0, 0, 1, 0, 0.5, eave, 0, 0.5, 0, 0,
  ]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4]);
  geo.computeVertexNormals();
  return geo;
}

// Four open-ended square posts, eight triangles each. No hidden end caps,
// shadow pass, collider, or per-frame facing update is needed at this distance.
function vendorLegGeometry() {
  const positions = [], indices = [];
  const { offset, height, width } = VENDOR_LEG_SHAPE, h = width / 2;
  for (const x of [-offset, offset]) for (const z of [-offset, offset]) {
    const base = positions.length / 3;
    positions.push(x-h,0,z-h, x+h,0,z-h, x+h,0,z+h, x-h,0,z+h,
      x-h,height,z-h, x+h,height,z-h, x+h,height,z+h, x-h,height,z+h);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      indices.push(base+i,base+i+4,base+j,base+j,base+i+4,base+j+4);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}

function peakRoofGeometry() {
  // An open square pyramid preserves the four-sided roof silhouette without
  // drawing the hidden underside on every vendor booth and camp pitch.
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    1, -0.5, 0, 0, -0.5, 1, -1, -0.5, 0, 0, -0.5, -1, 0, 0.5, 0,
  ]), 3));
  geo.setIndex([0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0]);
  geo.computeVertexNormals();
  return geo;
}

// ---------- Road underlay geometry ----------

const POOL_ORDER = ['canopy', 'marqueeWall', 'truss', 'peak', 'vendorLegs', 'warm', 'beacon', 'forest'];
// Roads within reach of one anchor number in the low hundreds; this leaves
// room for the cells around it without growing for a whole session.
const ROAD_MEMO_LIMIT = 768;
const boxesMeet = (a, b) => a.maxX >= b.minX && a.minX <= b.maxX && a.maxZ >= b.minZ && a.minZ <= b.maxZ;

// One road's finished underlay: a mitered ribbon, with paved footprints cut
// out of dirt, split along the terrain lattice. The result depends only on
// the polyline, its width, the cutters that overlap it and the terrain, never
// on where it lands in the shared buffer, which is what makes it reusable
// from one snapshot to the next. Rebuilding every road on every 80 m cell
// crossing was about half of the measured rewrite.
//
// Values pass through Math.fround wherever the single-pass writer stored a
// number in the Float32 position buffer and read it back, so this is
// bit-identical to that writer.
//
// Returns { vertices: Float32Array, indices: number[] (0-based), trimCount,
// draped }. `trimCount` is the vertex count after trimming, or -1 when no
// trim ran; the planner replays the capacity checks with it.
export function buildFarRoad(flat, width, cutters) {
  const f = Math.fround;
  const halfW = width * FAR_ROAD_WIDTH_FRAC / 2;
  const n = flat.length / 2;
  let vertices = new Array(n * 6), indices = [];
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
    const o = i * 6;
    vertices[o] = f(cxp + pxn * halfW); vertices[o + 1] = f(terrainHeight(vertices[o], czp + pzn * halfW)); vertices[o + 2] = f(czp + pzn * halfW);
    vertices[o + 3] = f(cxp - pxn * halfW); vertices[o + 4] = f(terrainHeight(vertices[o + 3], czp - pzn * halfW)); vertices[o + 5] = f(czp - pzn * halfW);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  let trimCount = -1;
  if (cutters && cutters.length) {
    const triangles = [];
    for (let j = 0; j < indices.length; j += 3) triangles.push([0, 1, 2].map(k => ({ x: vertices[indices[j + k] * 3], z: vertices[indices[j + k] * 3 + 2] })));
    const trimmed = trimRoadTriangles(triangles, cutters);
    vertices = []; indices = [];
    for (const tri of trimmed) for (const p of tri) {
      indices.push(vertices.length / 3);
      vertices.push(f(p.x), f(terrainHeight(p.x, p.z)), f(p.z));
    }
    trimCount = indices.length;
  }
  const draped = terrainEnabled();
  if (draped) ({ vertices, indices } = drapeTerrainTriangles(vertices, indices));
  return { vertices: Float32Array.from(vertices), indices, trimCount, draped };
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
  constructor({ enabled, tier, scene, isLoaded, lighting = 'unlit' } = {}) {
    this.enabled = !!enabled;
    this.disposed = false;
    if (!this.enabled) return;
    this.tier = tier;                       // PERF.farField: radius/density/caps
    this._lighting = lighting;
    this.planner = new SnapshotPlanner();
    this.stats = {
      active: 0, overflow: 0, rebuilds: 0, superseded: 0,
      roadVertsUsed: 0, roadsClipped: 0, maxColdStepMs: 0, handoffs: 0,
      // Publication of a committed snapshot: longest single slice, frames the
      // last one took, publications abandoned by a cell change, memo traffic.
      maxApplyStepMs: 0, applyFrames: 0, applySuperseded: 0, roadMemoHits: 0, roadMemoMisses: 0,
      demandByPool: {}, overflowByPool: {},
    };
    // The narrow completion predicate (design D1/D4): "is (cx,cz) fully
    // built". The ONLY window into chunk lifecycle this system gets.
    this._isLoaded = isLoaded || null;
    this._vendorRowMax = Math.max(1, Math.round(3 * (tier.densityMul || 1)));
    this._playerCell = null;
    this._planAnchor = { x: 0, z: 0 };
    this._roadSeen = null;
    this._job = null;               // in-flight publication of a committed snapshot
    this._roadMemo = new Map();     // content key -> draped geometry per polyline
    this._roadMemoGen = '';
    this._todQ = -1;
    this._nightOn = false;
    this._active = { canopy: [], marqueeWall: [], truss: [], peak: [], vendorLegs: [], warm: [], beacon: [], forest: [] };
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
    this._job = null;
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
    const mkSurface = (hex, options = {}) => this._lighting === 'lit'
      ? new THREE.MeshLambertMaterial({ color: hex, ...options })
      : new THREE.MeshBasicMaterial({ color: hex, ...options });
    this._mats = {
      canopy: mkSurface(0xffffff, { side: THREE.DoubleSide }),
      marqueeWall: mkSurface(0xffffff, { side: THREE.DoubleSide }),
      truss: mkSurface(0xffffff),
      peak: mkSurface(0xffffff, { side: THREE.DoubleSide }),
      vendorLegs: mkSurface(VENDOR_LEG_SHAPE.color),
      warm: mkMat(WARM_HEX),
      beacon: mkMat(0xffffff),
      forest: mkSurface(0xffffff),   // white base × per-instance FOREST_PALETTE color
      road: new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true}),     // opaque, depthWrite:true (default) — audit V12
    };
    this._geos = {
      canopy: gableRoofGeometry(),
      marqueeWall: marqueeWallGeometry(),
      truss: new THREE.BoxGeometry(1, 1, 1),
      peak: peakRoofGeometry(),
      vendorLegs: vendorLegGeometry(),
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
    const hasColor = { canopy: true, marqueeWall: true, truss: true, peak: true, vendorLegs: false, warm: false, beacon: true, forest: true };
    for (const name of ['canopy', 'marqueeWall', 'truss', 'peak', 'vendorLegs', 'warm', 'beacon', 'forest']) {
      const cap = name === 'vendorLegs' ? (caps.vendorLegs ?? caps.peak) : caps[name];
      const mesh = new THREE.InstancedMesh(this._geos[name], this._mats[name], cap);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
      mesh.name = 'farField:' + name;
      // Per-instance dissolve state for the completion handoff (design D4).
      const fade = new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(1), 1);
      fade.setUsage(THREE.DynamicDrawUsage);
      this._geos[name].setAttribute('aFade', fade);
      applyProxyDither(this._mats[name]);
      this._pools[name] = { name, mesh, fade, hasColor: hasColor[name], cap };
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
    const colorAttr = new THREE.BufferAttribute(new Float32Array(caps.roadVerts * 3), 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    roadGeo.setAttribute('color', colorAttr);
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
    this._road = { mesh: roadMesh, geo: roadGeo, posAttr, idxAttr, colorAttr };
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
      // A publication still in flight belongs to the cell just left. Its road
      // and height work is retained by the caches, so dropping it loses little.
      if (this._job) { this._job = null; this.stats.applySuperseded++; }
      this.planner.begin(version, coarseCellsFor(this._planAnchor.x, this._planAnchor.z, this.tier.radius));
    }

    // Planning spends only the REMAINDER of the world-owned streaming wall
    // (design D3: chunks consume first, there is no second budget). A zero
    // remainder plans nothing this frame; a positive one may overshoot by at
    // most one indivisible cold step, which stats.maxColdStepMs measures and
    // the tier's maxColdStepMs gate judges. With no budget given (tests,
    // sandbox), exactly one cell is planned per call.
    if (!(opts.budgetMs != null && opts.budgetMs <= 0)) {
      const t0 = performance.now();
      const deadline = opts.budgetMs == null ? Infinity : t0 + opts.budgetMs;
      while (this.planner.pending) {
        const c0 = performance.now();
        const committed = this.planner.step((cx, cz) => this._planCellRecords(cx, cz, this._roadSeen), 1);
        const cellMs = performance.now() - c0;
        if (cellMs > this.stats.maxColdStepMs) this.stats.maxColdStepMs = cellMs;
        if (committed) {
          this._job = this._beginApply(this.planner.committed.records);
          break;
        }
        if (opts.budgetMs == null || performance.now() >= deadline) break;
      }
      // The committed snapshot is published in bounded pieces: the previous
      // horizon stays on screen until every height and road is ready, then the
      // pools are rewritten at once. Without a budget this finishes here.
      if (this._job) {
        const a0 = performance.now();
        const done = this._advanceApply(this._job, deadline);
        const stepMs = performance.now() - a0;
        this._job.frames++;
        if (stepMs > this.stats.maxApplyStepMs) this.stats.maxApplyStepMs = stepMs;
        if (done) {
          this.stats.applyFrames = this._job.frames;
          this._commitApply(this._job);
          this._job = null;
        }
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
      out.push({ kind: '__road', flat: copyPolyline(road.points), width:road.width, surface:road.surface });
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
    out.push(...forestRecordsForCell(cellCx, cellCz, this.tier.forestStep || 48,(x,z)=>landscapeClearance(x,z,3)?0:treeDensity(x,z)));
    return out;
  }

  // Pool rewrite from a committed snapshot (design D2/D3), in three parts so
  // the expensive middle can be spread over frames:
  //   _beginApply   expand to candidates and keep the nearest under each cap
  //                 (x/z arithmetic only, no terrain);
  //   _advanceApply resolve ground heights for the KEPT instances and prepare
  //                 road geometry, stopping at the deadline;
  //   _commitApply  write matrices, colors, roads and bounds in place.
  // Only the last part touches a pool, so the rewrite the player sees is still
  // atomic. It never touches the registry and never reallocates a buffer.
  // The 2026-11-08 iPad route measured 424 ms for this work as one call.
  _applySnapshot(records) {
    const job = this._beginApply(records);
    this._advanceApply(job, Infinity);
    this._commitApply(job);
  }

  _beginApply(records) {
    const ax = this._planAnchor.x, az = this._planAnchor.z;
    const expanded = planFarInstances(records, this.tier.densityMul || 1);
    const kept = {}, demandByPool = {}, overflowByPool = {};
    let active = 0, overflow = 0;
    // Legs follow only retained vendor roofs, including capacity pressure in
    // the roof pool; both then use the same owner-cell completion envelope.
    const key = p => `${p.x},${p.z}`;
    for (const name of POOL_ORDER) {
      let candidates = expanded[name];
      if (name === 'vendorLegs') {
        const roofs = new Set(kept.peak.filter(p => p.vendor).map(key));
        candidates = candidates.filter(p => roofs.has(key(p)));
      }
      const sel = selectNearest(candidates, ax, az, this._pools[name].cap);
      sel.overflow += expanded[name].length - candidates.length;
      demandByPool[name] = expanded[name].length;
      overflowByPool[name] = sel.overflow;
      kept[name] = sel.kept;
      overflow += sel.overflow;
      active += sel.kept.length;
    }
    return { kept, roads: expanded.roads, roadPlan: null, pool: 0, next: 0, frames: 0,
      active, overflow, demandByPool, overflowByPool };
  }

  // Returns true once every kept instance is grounded and the road plan is
  // complete. Each call makes progress before it looks at the clock, so a
  // deadline that has already passed still cannot stall publication.
  _advanceApply(job, deadline) {
    while (job.pool < POOL_ORDER.length) {
      const list = job.kept[POOL_ORDER[job.pool]];
      while (job.next < list.length) {
        const inst = list[job.next];
        // A cold terrain tile is the one expensive thing a height can need.
        // Warm it in bounded pieces first; the height itself is then cheap.
        if (!prepareTerrainHeight(inst.gx, inst.gz, deadline)) return false;
        groundFarInstance(inst);
        job.next++;
        if ((job.next & 15) === 0 && performance.now() >= deadline) return false;
      }
      job.pool++; job.next = 0;
    }
    if (!job.roadPlan) job.roadPlan = this._planRoads(job.roads, null, deadline);
    return !!job.roadPlan;
  }

  _commitApply(job) {
    // A (re)plan snaps every proxy's ownership state without an envelope
    // (design D1/D4) — clear active envelopes, rebuild the owner-cell index.
    this._ownerCells.clear();
    this._handoffs.length = 0;
    for (const name of POOL_ORDER) {
      this._active[name] = job.kept[name];
      this._writePool(this._pools[name], job.kept[name]);
    }
    this._commitRoads(job.roadPlan);
    this._applyNightVisibility();
    this.stats.active = job.active;
    this.stats.overflow = job.overflow;
    this.stats.demandByPool = job.demandByPool;
    this.stats.overflowByPool = job.overflowByPool;
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
      const e = Math.max(inst.sx, inst.sy, inst.sz) * (pool.name === 'vendorLegs' ? 4 : 1);
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
    this._commitRoads(this._planRoads(flats, null, Infinity));
  }

  // One memo entry per distinct polyline (content, width, surface). The
  // snapshot's records are fresh copies on every plan, so identity cannot key
  // this; a short content key finds the entry and a full comparison confirms it.
  _roadEntry(record) {
    const original = Array.isArray(record) || ArrayBuffer.isView(record) ? record : record.flat;
    const width = record.width ?? CONFIG.ROAD_WIDTH, surface = record.surface;
    const n = original.length;
    const key = `${surface}|${width}|${n}|${original[0]},${original[1]},${original[n - 2]},${original[n - 1]}`;
    let entry = this._roadMemo.get(key);
    if (entry) {
      let same = entry.original.length === n;
      for (let i = 0; same && i < n; i++) same = entry.original[i] === original[i];
      if (same) {
        // Refresh recency: eviction below removes the oldest insertion.
        this._roadMemo.delete(key); this._roadMemo.set(key, entry);
        return entry;
      }
    }
    // The horizon bends long segments onto the terrain lattice every 10 m.
    let flat = original;
    if (terrainEnabled()) {
      flat = [original[0], original[1]];
      for (let i = 2; i < n; i += 2) {
        const ax = original[i - 2], az = original[i - 1], bx = original[i], bz = original[i + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 10));
        for (let j = 1; j <= steps; j++) flat.push(ax + (bx - ax) * j / steps, az + (bz - az) * j / steps);
      }
    }
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < flat.length; i += 2) {
      if (flat[i] < minX) minX = flat[i];
      if (flat[i] > maxX) maxX = flat[i];
      if (flat[i + 1] < minZ) minZ = flat[i + 1];
      if (flat[i + 1] > maxZ) maxZ = flat[i + 1];
    }
    // The ribbon offsets each point by exactly half its width. The extra
    // centimetre covers float32 rounding of the stored vertices.
    const pad = width * FAR_ROAD_WIDTH_FRAC / 2 + 0.01;
    entry = { original: Float64Array.from(original), flat, width, surface,
      bounds: { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad },
      cutters: null, cutterBounds: null, geo: null, variants: [], warm: 0 };
    if (this._roadMemo.size >= ROAD_MEMO_LIMIT) this._roadMemo.delete(this._roadMemo.keys().next().value);
    this._roadMemo.set(key, entry);
    return entry;
  }

  // The footprints a paved road cuts out of any dirt it crosses, with one box
  // around all of them for the cheap "could this touch that" test.
  _roadCutters(entry) {
    if (!entry.cutters) {
      const flat = entry.flat;
      entry.cutters = pavedCutters([{ surface: entry.surface, width: entry.width,
        points: Array.from({ length: flat.length / 2 }, (_, i) => ({ x: flat[i * 2], z: flat[i * 2 + 1] })) }],
        null, Infinity, FAR_ROAD_WIDTH_FRAC);
      const box = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
      for (const c of entry.cutters) {
        box.minX = Math.min(box.minX, c.bounds.minX); box.maxX = Math.max(box.maxX, c.bounds.maxX);
        box.minZ = Math.min(box.minZ, c.bounds.minZ); box.maxZ = Math.max(box.maxZ, c.bounds.maxZ);
      }
      entry.cutterBounds = box;
    }
    return entry.cutters;
  }

  // Decide which roads fit and prepare their geometry WITHOUT touching the
  // live buffers. Returns null when the deadline passes with geometry still to
  // build; whatever was built stays in the memo, so the retry resumes there.
  _planRoads(flats, reservedPaved, deadline, progress = { built: 0 }) {
    const generation = terrainGenerationKey();
    if (generation !== this._roadMemoGen) { this._roadMemo.clear(); this._roadMemoGen = generation; }

    // roadsInBounds pads its query by ROAD_MAX_EDGE_CELLS heart cells, so the
    // coarse-cell sweep discovers arterials far beyond the horizon. Keep only
    // polylines that come within radius(+one coarse cell) of the plan anchor,
    // nearest-first with a stable tie-break, so the fixed buffer always holds
    // the roads the player can actually see (deterministic capacity behavior).
    const ax = this._planAnchor.x, az = this._planAnchor.z;
    const reach = this.tier.radius + COARSE_CELL;
    const scored = [];
    for (const record of flats) {
      const entry = this._roadEntry(record), flat = entry.flat;
      let best = Infinity;
      for (let i = 0; i < flat.length; i += 2) {
        const d = Math.hypot(flat[i] - ax, flat[i + 1] - az);
        if (d < best) best = d;
      }
      // `key` is the record's own array: two records may share one memo entry,
      // but each keeps its own capacity reservation.
      if (best <= reach) scored.push({ entry, flat, d: best, key: record.flat || record });
    }
    scored.sort((a, b) => a.d - b.d || a.flat[0] - b.flat[0] || a.flat[1] - b.flat[1]);

    // Paved roads that cut dirt, nearest-first. A second pass (below) keeps
    // only the pavement the first pass could afford.
    const paved = [];
    for (const { entry, key } of scored) {
      if (entry.surface === 'asphalt' && (!reservedPaved || reservedPaved.has(key)) && this._roadCutters(entry).length) paved.push(entry);
    }
    let allCutters = null;
    const committedPaved = new Map(), items = [];
    let reserveV = 0, reserveI = 0, asphaltScored = 0;
    if (reservedPaved) for (const size of reservedPaved.values()) { reserveV += size.vertices; reserveI += size.indices; }
    let v = 0, ix = 0, clipped = 0;
    for (const { entry, flat, key } of scored) {
      const asphalt = entry.surface === 'asphalt';
      if (asphalt) asphaltScored++;
      if (reservedPaved && asphalt) {
        const size = reservedPaved.get(key); if (!size) { clipped++; continue; }
        reserveV -= size.vertices; reserveI -= size.indices;
      }
      const capV = this.tier.caps.roadVerts - reserveV, capI = this.tier.caps.roadIndices - reserveI;
      const n = flat.length / 2;
      if (n < 2) continue;
      if (v + n * 2 > capV || ix + (n - 1) * 6 > capI) { clipped++; continue; }

      // Find or build this road's geometry. Pavement depends on nothing else;
      // dirt depends on exactly the paved roads that can reach it, in order.
      let geo, touching = null;
      if (asphalt || !paved.length) {
        geo = asphalt ? entry.geo : (entry.variants.find(x => x.plain) || {}).geo;
      } else {
        touching = paved.filter(p => boxesMeet(entry.bounds, p.cutterBounds));
        const hit = entry.variants.find(x => !x.plain && x.touching.length === touching.length && x.touching.every((p, i) => p === touching[i]));
        geo = hit && hit.geo;
      }
      if (geo) this.stats.roadMemoHits++;
      else {
        if (progress.built > 0 && performance.now() >= deadline) return null;
        // Warm the terrain under the ribbon before building on it. `warm` is a
        // resume cursor, so a road that spans many cold tiles spreads out too.
        const pad = entry.width * FAR_ROAD_WIDTH_FRAC / 2 + 11;
        for (; entry.warm < flat.length; entry.warm += 2) {
          const x = flat[entry.warm], z = flat[entry.warm + 1];
          if (!prepareTerrainArea(x - pad, z - pad, x + pad, z + pad, deadline)) return null;
        }
        progress.built++; this.stats.roadMemoMisses++;
        const trim = !asphalt && paved.length > 0;
        if (trim && !allCutters) allCutters = paved.flatMap(p => p.cutters);
        geo = buildFarRoad(flat, entry.width, trim ? allCutters : null);
        if (asphalt) entry.geo = geo;
        else {
          if (entry.variants.length >= 4) entry.variants.shift();
          entry.variants.push(trim ? { plain: false, touching, geo } : { plain: true, geo });
        }
      }

      // Replay the capacity checks the single-pass writer made after trimming
      // and after draping, so a road is kept or skipped exactly as before.
      const base = v, firstIndex = ix;
      if (geo.trimCount >= 0 && (base + geo.trimCount > capV || firstIndex + geo.trimCount > capI)) { clipped++; continue; }
      if (geo.draped && (base + geo.vertices.length / 3 > capV || firstIndex + geo.indices.length > capI)) { clipped++; continue; }
      v = base + geo.vertices.length / 3; ix = firstIndex + geo.indices.length;
      if (asphalt) committedPaved.set(key, { vertices: v - base, indices: ix - firstIndex });
      items.push({ geo, asphalt });
    }
    // A capacity-omitted paved road must not cut holes in retained dirt. If the
    // first nearest-first pass dropped pavement, plan once more using only kept
    // paved footprints and reserve their exact sizes before admitting dirt.
    // The second pass is bounded and cannot evict its reserved cutters.
    if (!reservedPaved && committedPaved.size < asphaltScored) return this._planRoads(flats, committedPaved, deadline, progress);
    return { items, clipped };
  }

  _commitRoads(plan) {
    const { geo, posAttr, idxAttr, colorAttr, mesh } = this._road;
    const pos = posAttr.array, idx = idxAttr.array, col = colorAttr.array;
    const color = this._col;
    let v = 0, ix = 0;
    for (const { geo: g, asphalt } of plan.items) {
      pos.set(g.vertices, v * 3);
      for (let i = 0; i < g.indices.length; i++) idx[ix + i] = v + g.indices[i];
      color.setHex(asphalt ? 0x505458 : ROAD_HEX);
      const count = g.vertices.length / 3;
      for (let j = v; j < v + count; j++) { const o = j * 3; col[o] = color.r; col[o + 1] = color.g; col[o + 2] = color.b; }
      v += count; ix += g.indices.length;
    }
    // Clipping introduces vertices on terrain creases, so derive bounds from
    // the final committed buffer rather than the original ribbon endpoints.
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for(let i=0;i<v;i++){const o=i*3;minX=Math.min(minX,pos[o]);maxX=Math.max(maxX,pos[o]);minY=Math.min(minY,pos[o+1]);maxY=Math.max(maxY,pos[o+1]);minZ=Math.min(minZ,pos[o+2]);maxZ=Math.max(maxZ,pos[o+2]);}
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    idxAttr.needsUpdate = true;
    geo.setDrawRange(0, ix);
    mesh.visible = ix > 0;
    if (v > 0) {
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const cy = (minY + maxY) / 2;
      geo.boundingSphere.center.set(cx, cy, cz);
      geo.boundingSphere.radius = Math.hypot(maxX - cx, maxY - cy, maxZ - cz) + 1;
    } else {
      geo.boundingSphere.center.set(0, 0, 0);
      geo.boundingSphere.radius = 0;
    }
    this.stats.roadVertsUsed = v;
    this.stats.roadsClipped = plan.clipped;
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
    const daylight = (1 - n) * (1 - n);
    const dayB = this._lighting === 'lit' ? 1
      : SURFACE_NIGHT_BRIGHTNESS + (SURFACE_DAY_BRIGHTNESS - SURFACE_NIGHT_BRIGHTNESS) * daylight;
    this._mats.canopy.color.setScalar(dayB);
    this._mats.marqueeWall.color.setScalar(dayB);
    this._mats.peak.color.setScalar(dayB);
    this._mats.vendorLegs.color.setHex(VENDOR_LEG_SHAPE.color).multiplyScalar(dayB);
    this._mats.forest.color.setScalar(dayB);
    this._mats.truss.color.setScalar(dayB);
    const roadB = ROAD_NIGHT_BRIGHTNESS + (ROAD_DAY_BRIGHTNESS - ROAD_NIGHT_BRIGHTNESS) * daylight;
    this._mats.road.color.setHex(0xffffff).multiplyScalar(roadB);
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
    this._job = null;
    this._roadMemo = null;
    this.group = null;
  }
}
