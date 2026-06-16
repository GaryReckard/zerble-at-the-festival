// Procedural festival, generated in chunks. Each chunk picks a theme based on its
// (cx, cz) seed and lays out props + spawns NPCs accordingly. Chunks are generated
// lazily as Zerble explores; for simplicity they stay loaded once created.
//
// Themes:
//   main_stage  — only at (0,0). Big stage with a dense audience.
//   side_stage  — smaller stage with audience.
//   food_plaza  — cluster of food trucks + tables.
//   vendor_row  — row of craft tents.
//   drum_circle — open area with a drum + congregated crowd.
//   grove       — dense trees, a few hammocks, sparse crowd.
//   open_lawn   — sparse — picnic blankets, room to drive.
//
// Every chunk also drops a path stripe along its primary axis so the player
// can see where to go, and NPC AI prefers walking near paths.

import * as THREE from 'three';
import { registry } from './registry.js';
import { hash2, worldHash, mulberry32 } from './rng.js';
import { Sound } from './sound.js';
import { PERF, USE_WORLDGEN_V2 } from './perf.js';
import { register as registerContextLight } from './contextLights.js';
import { placeChunkProps } from './worldgen/placement.js';
import { queryRegion, queryPoint } from './worldgen/index.js';
import { treeDensity } from './worldgen/density.js';
import { dancefloorRectsNear, drumClearingsNear, festivalPlan, campVillagesNear, seamHedgesNear, MAX_POI_REACH } from './worldgen/festival.js';
import { CONFIG } from './worldgen/constants.js';
import { roadsInBounds, nearestRoad } from './worldgen/roads.js';
import { FESTIVAL_TUNING, MODEL_DIMS, clusterExtent } from './worldgen/tuning.js';
import { chunkOverlapsLake, chunkInLake, isPointInLake } from './lakes.js';
import { getForestAt, buildForestChunk, chunkInForest, forestAnimatables, forestDrumCircles, forestDrumMusic, buildWorldgenDrumCircle } from './forests.js';
import { buildCampsite, buildCampChair, buildTorchField, buildCampTent } from './models/campsite.js';
import { buildTent } from './models/tent.js';
import { buildFoodTruck, FOOD_TRUCK_SCALE } from './models/foodTruck.js';
import { buildBubbleJug } from './models/bubbleJug.js';
import { buildBubbleVendor } from './models/bubbleVendor.js';
import { buildSugarShack, SUGAR_SHACK_WIDTH, SUGAR_SHACK_DEPTH, sugarShackCooks } from './models/sugarShack.js';
import { buildPortaPotty, createPottyState, POTTY_SPACING, POTTY_FOOTPRINT, POTTY_COLLIDER_R } from './models/portaPotty.js';
import { buildHammock as buildHammockModel, buildTreeHammock } from './models/hammock.js';
import { buildPicnicTable } from './models/picnicTable.js';
import { buildEntranceArch as buildEntranceArchModel } from './models/entranceArch.js';
import { buildStage as buildStageModel, placeBandOnStage } from './models/stage.js';
import { buildTentStage } from './models/tentStage.js';
import { buildTree, buildForestTree, worldPerches, worldCrown } from './models/tree.js';
import { buildShrub } from './models/shrub.js';
import { leafBannerTextures } from './models/leafBanner.js';

export const CHUNK_SIZE = 80;
const LOAD_RADIUS = PERF.chunkLoadRadius;   // mobile: 1 (3x3), desktop: 2 (5x5)
const UNLOAD_RADIUS = PERF.chunkUnloadRadius; // hysteresis

// Bands placed on stages — animated lightly each frame by the main loop.
export const stagePerformers = [];

// Spatial music handles, one per stage, tagged by chunkKey so we can detach on unload.
const stageMusic = [];

// Fresh salt — must not match any existing worldHash salt in this file so
// style selection is independent of all other chunk-rng streams.
const STYLE_SALT = 0xC4FE7B2A | 0;
// Salt for the seeded near-spawn jug positions (distinct from STYLE_SALT).
const SPAWN_JUG_SALT = 0x5A17B0BB | 0;
// Fresh salt for the porta-potty placement RNG. Distinct from every other salt
// so adding/removing potties never shifts theme, prop, jug, or style streams
// (footgun #4 — new randomness gets its own salt, never reorders an existing one).
const POTTY_SALT = 0x9E3779B1 | 0;

// World-spawn point (zerble.position in main.js). The guaranteed intro jugs ring
// around here. Mutable: with v2 worldgen, main.js relocates spawn onto the nearest
// hub's dancefloor front and calls setSpawnPoint BEFORE the ChunkManager is built,
// so the intro jugs ring the real arrival point, not the legacy origin.
const SPAWN_POINT = { x: 0, z: 65 };
export function setSpawnPoint(x, z) { SPAWN_POINT.x = x; SPAWN_POINT.z = z; }

// Guaranteed bubble-juice jugs near world-spawn, so a new player meets the pickup
// early and doesn't run dry before stumbling on a random one. Positions are
// session-seeded — a different spread every load, fixed under ?seed= — fanned
// around spawn at distinct angles within a 22–58m ring (so they don't clump or
// park in front of the cart). Dropped when their containing chunk first generates;
// that ring sits inside the boot-load ring, so they're present from the start. The
// rare per-chunk scatter (scatterBubbleJugs) still runs everywhere on top of these.
const SPAWN_JUG_COUNT = 4;   // bumped from 2 — a more generous welcome at the arrival heart
function computeSpawnJugTargets() {
  const u = (a, b) => worldHash(a, b, SPAWN_JUG_SALT) / 4294967296;
  const jugs = [];
  for (let i = 0; i < SPAWN_JUG_COUNT; i++) {
    // Even angular fan + per-jug jitter so they encircle the arrival, never clump.
    const ang = (i / SPAWN_JUG_COUNT) * Math.PI * 2 + (u(8101 + i, 3) - 0.5) * 1.1;
    const rad = 22 + u(4099, 19 + i) * 36;           // 22–58 m
    jugs.push({
      x: SPAWN_POINT.x + Math.cos(ang) * rad,
      z: SPAWN_POINT.z + Math.sin(ang) * rad,
      placed: false,
    });
  }
  return jugs;
}

// Picks a music style from `palette` using the chunk's worldHash seed.
// A fresh salt keeps this stream isolated from theme, prop, and drum seeds.
function pickStageStyle(seed, palette) {
  const rng = mulberry32(seed >>> 0);
  return palette[Math.floor(rng() * palette.length)];
}

// Stage light lens meshes — the day/night system samples these for the night
// "light show" pulse + color. Each entry: { lens: Mesh, chunkKey, baseColor }.
export const stageLightLenses = [];

// Stage spotlight beams projecting INTO the audience. Each entry mirrors
// stageBeams from models/stage.js plus a chunkKey for unload tracking and
// scale so the sweep amplitude reads correctly on differently-sized stages.
// { beam, target, baseTargetX, baseTargetZ, phaseOffset, scale, chunkKey }
export const stageBeamRefs = [];

export function updateStagePerformers(t) {
  for (let i = 0; i < stagePerformers.length; i++) {
    const p = stagePerformers[i];
    const phase = t * 3 + p.phase;
    p.group.position.y = p.baseY + Math.abs(Math.sin(phase)) * 0.08;
    p.group.rotation.z = Math.sin(phase * 0.5) * 0.05;
    p.group.rotation.y = p.baseYaw + Math.sin(phase * 0.3) * 0.15;
  }
}

// Stage-light show: during the day the lenses just sit there with their
// baseline emissive. At night they pulse and cycle through a club-like
// rainbow palette and the audience-facing SpotLight beams sweep across
// the crowd. `t` is seconds since start, `nightness` 0..1 from the
// time-of-day system, `zerblePos` is THREE.Vector3 used to pool the
// closest beams (only MAX_ACTIVE_STAGE_LIGHTS SpotLights are lit per frame).
const MAX_ACTIVE_STAGE_LIGHTS = 6;
const _showColors = [0xff3380, 0xffae33, 0xffe066, 0x66ff88, 0x33d9ff, 0xc080ff];
const _tmpC1 = new THREE.Color();
const _tmpC2 = new THREE.Color();
// Scratch vector to avoid per-frame allocation when computing distances.
const _tmpVec = new THREE.Vector3();
// Scratch buffers for the beam-distance sort — lazily resized, reused every frame.
let _beamDistances = new Float32Array(64);
let _beamIndices = Array.from({ length: 64 }, (_, i) => i);
let _beamScratchCap = 64;
export function updateStageLightShow(t, nightness, zerblePos) {
  // ---- Lens colors / pulse ----
  for (let i = 0; i < stageLightLenses.length; i++) {
    const entry = stageLightLenses[i];
    const mat = entry.lens.material;
    if (nightness < 0.05) {
      mat.emissiveIntensity = 2.4 + Math.sin(t * 1.5 + i) * 0.2;
      const base = _tmpC1.setHex(entry.baseColor);
      mat.color.lerp(base, 0.05);
      mat.emissive.lerp(base, 0.05);
    } else {
      const phase = t * 1.4 + i * 0.7;
      const colorIdx = Math.floor((t * 0.4 + i) % _showColors.length);
      const nextIdx = (colorIdx + 1) % _showColors.length;
      const blend = (t * 0.4 + i) % 1;
      _tmpC1.setHex(_showColors[colorIdx]);
      _tmpC2.setHex(_showColors[nextIdx]);
      const c = _tmpC1.lerp(_tmpC2, blend);
      mat.color.copy(c);
      mat.emissive.copy(c);
      const pulse = 0.5 + 0.5 * Math.sin(phase);
      mat.emissiveIntensity = 2.0 + pulse * 5.0 * nightness;
    }
  }

  // ---- Audience-facing SpotLight beams ----
  // Beams swing left/right + forward/back in lissajous patterns so each
  // stage paints a moving rainbow across the crowd. Three beams per stage
  // chase different patterns so they don't lockstep.
  //
  // Performance pool: rank all loaded beams by their stage's distance to
  // Zerble and only enable the closest MAX_ACTIVE_STAGE_LIGHTS. Beams
  // outside the pool get intensity = 0 so the GPU skips their fragment
  // work entirely. Animation state (target position, color) still advances
  // every frame for all beams so there's no visual pop when a stage enters
  // or leaves the active pool.
  const PATTERNS = [
    // {ax: amplitudeX, az: amplitudeZ, rateX, rateZ, phaseZ}
    { ax: 6, az: 3, rateX: 0.9, rateZ: 1.3, phaseZ: 0.0 },     // wide sweep
    { ax: 2, az: 5, rateX: 1.4, rateZ: 0.7, phaseZ: 1.5 },     // depth pump
    { ax: 5, az: 4, rateX: 0.6, rateZ: 1.1, phaseZ: 2.4 },     // diagonal
  ];
  const beamOn = THREE.MathUtils.smoothstep(nightness, 0.15, 0.7);
  const totalBeams = stageBeamRefs.length;

  // Build a sorted distance list only when we have more beams than the pool
  // size AND we have a valid zerblePos to compare against. When beam count is
  // within the pool cap, every beam is active — no sorting needed.
  let activeSet = null; // null means "all beams are active"
  if (zerblePos && totalBeams > MAX_ACTIVE_STAGE_LIGHTS) {
    // Compute squared distance for each beam (cheap; avoids sqrt).
    // Group by stage world position so three beams from the same stage share
    // one distance lookup (each ref carries stageWorldPos).
    // Grow scratch buffers only when beam count exceeds current capacity.
    if (totalBeams > _beamScratchCap) {
      _beamDistances = new Float32Array(totalBeams);
      _beamIndices = Array.from({ length: totalBeams }, (_, i) => i);
      _beamScratchCap = totalBeams;
    }
    for (let i = 0; i < totalBeams; i++) {
      const ref = stageBeamRefs[i];
      if (ref.stageWorldPos) {
        _tmpVec.copy(ref.stageWorldPos).sub(zerblePos);
        _beamDistances[i] = _tmpVec.x * _tmpVec.x + _tmpVec.z * _tmpVec.z;
      } else {
        // No world position stored — treat as closest so it's never culled.
        _beamDistances[i] = 0;
      }
      _beamIndices[i] = i; // reset before sort (reused buffer)
    }
    // Sort indices by distance ascending (in-place on reused array).
    _beamIndices.length = totalBeams;
    _beamIndices.sort((a, b) => _beamDistances[a] - _beamDistances[b]);
    // The active set is the closest MAX_ACTIVE_STAGE_LIGHTS beam indices.
    activeSet = new Set(_beamIndices.slice(0, MAX_ACTIVE_STAGE_LIGHTS));
  }

  for (let i = 0; i < totalBeams; i++) {
    const ref = stageBeamRefs[i];
    const pattern = PATTERNS[i % PATTERNS.length];
    const phase = t + ref.phaseOffset;

    // Always advance animation state so beams are in-phase when they re-enter
    // the active pool — avoids a visible jump in sweep position / color.
    ref.target.position.x = ref.baseTargetX
      + Math.sin(phase * pattern.rateX) * pattern.ax * ref.scale;
    ref.target.position.z = ref.baseTargetZ
      + Math.sin(phase * pattern.rateZ + pattern.phaseZ) * pattern.az * ref.scale;
    // Color chase — shifts through the palette out of phase with the lens.
    const colorIdx = Math.floor((t * 0.35 + i * 1.3) % _showColors.length);
    const nextIdx = (colorIdx + 1) % _showColors.length;
    const blend = (t * 0.35 + i * 1.3) % 1;
    _tmpC1.setHex(_showColors[colorIdx]);
    _tmpC2.setHex(_showColors[nextIdx]);
    ref.beam.color.copy(_tmpC1.lerp(_tmpC2, blend));

    // Intensity: full animation for active pool; zero for culled beams.
    const inPool = activeSet === null || activeSet.has(i);
    if (inPool) {
      const pulse = 0.55 + 0.45 * Math.sin(phase * 2.2);
      ref.beam.intensity = beamOn * pulse * 9.0;
    } else {
      ref.beam.intensity = 0;
    }
  }
}

// ---------- Chunk generation timing stats ----------
//
// Phase 1 instrumentation (perf-pass-4). No behavior change — purely
// observational. Sampled by debug.js for the backtick HUD panel so we can
// see whether forest chunks (which contain ~400 meshes) are the spike source
// before committing to the heavier fixes in phases 4A/4B.

export const chunkGenStats = {
  count:    0,      // total chunks generated this session
  slowCount: 0,     // chunks that took > SLOW_THRESHOLD_MS
  slowest:  0,      // worst single generation time (ms)
  lastMs:   0,      // most recent chunk generation time (ms)
  _totalMs: 0,      // running sum — used to compute avgMs
  get avgMs() {
    return this.count > 0 ? this._totalMs / this.count : 0;
  },
};

// Per-cluster rng draw counts — the layout-harness canary (task 1.4). At a
// fixed perf tier each worldgen cluster draws a FIXED number of times from its
// cluster-local rng; a changed count (even when every position still matches)
// means a draw was added, dropped, or reordered — the invisible class of
// determinism break the position snapshot can't see. Keyed `kind@x,z`. Read by
// __dbg.dumpDrawCounts / emitted into layout snapshots. The wrapper that fills
// this COUNTS, it does not draw, so it cannot shift draw order (guardrail #4).
export const worldgenDrawCounts = new Map();

const SLOW_THRESHOLD_MS = 8;

// ---------- Public API ----------

export class ChunkManager {
  constructor(scene, crowd) {
    this.scene = scene;
    this.crowd = crowd;
    this.loaded = new Map(); // key -> { group, cx, cz, theme }
    // Seeded near-spawn intro jugs (see computeSpawnJugTargets). Computed once
    // here so they're stable for the session; SESSION_SEED is already set by
    // the time the world (and this manager) is built.
    this._spawnJugs = computeSpawnJugTargets();
  }

  update(playerPos) {
    const ccx = Math.round(playerPos.x / CHUNK_SIZE);
    const ccz = Math.round(playerPos.z / CHUNK_SIZE);

    // Load nearby chunks. First pass (boot): generate the entire ring
    // synchronously so the world isn't empty at start. Subsequent frames:
    // budget to BUDGET_PER_FRAME chunks, with closer chunks prioritized.
    //
    // Why: at boost speed (~28 m/s) the player crosses a chunk every ~2.8s,
    // and crossing a corner can demand 3-5 fresh chunks in one frame.
    // Generating that synchronously stalls the main thread long enough to
    // *feel* like the cart's movement stutters mid-boost. Spreading the
    // load over a few frames is invisible; the player keeps moving smoothly
    // and the new chunks pop in 50-100ms later.
    const firstLoad = this.loaded.size === 0;
    const BUDGET_PER_FRAME = 1;
    let budget = firstLoad ? Infinity : BUDGET_PER_FRAME;

    // Build a candidate list sorted by squared distance to the player, so
    // we always generate the closest missing chunk first under budget.
    const candidates = [];
    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
      for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
        const cx = ccx + dx;
        const cz = ccz + dz;
        const key = chunkKey(cx, cz);
        if (!this.loaded.has(key)) {
          // Distance from player to chunk center, squared.
          const cxw = cx * CHUNK_SIZE;
          const czw = cz * CHUNK_SIZE;
          const ddx = cxw - playerPos.x;
          const ddz = czw - playerPos.z;
          candidates.push({ cx, cz, d2: ddx * ddx + ddz * ddz });
        }
      }
    }
    candidates.sort((a, b) => a.d2 - b.d2);
    for (const c of candidates) {
      if (budget-- <= 0) break;
      const t0 = performance.now();
      this._generate(c.cx, c.cz);
      const ms = performance.now() - t0;
      chunkGenStats.count++;
      chunkGenStats._totalMs += ms;
      chunkGenStats.lastMs = ms;
      if (ms > chunkGenStats.slowest) chunkGenStats.slowest = ms;
      if (ms > SLOW_THRESHOLD_MS) {
        chunkGenStats.slowCount++;
        console.warn(`[chunk slow] (${c.cx},${c.cz}) ${ms.toFixed(1)}ms`);
      }
    }

    // Unload distant chunks (hysteresis: only beyond UNLOAD_RADIUS, so we don't
    // thrash when straddling a boundary)
    for (const [key, chunk] of this.loaded) {
      const ddx = Math.abs(chunk.cx - ccx);
      const ddz = Math.abs(chunk.cz - ccz);
      if (ddx > UNLOAD_RADIUS || ddz > UNLOAD_RADIUS) {
        this._unload(key, chunk);
      }
    }
  }

  _unload(key, chunk) {
    // Shared teardown (task 6.1): dispose non-shared geo/mats, remove from the
    // scene, sweep every by-key side-list. Extracted so the hub viewer rebuilds
    // a hub the SAME way (footgun #6: module-level `userData.shared` survives).
    disposeChunkByKey(this.scene, chunk.group, key, this.crowd);
    this.loaded.delete(key);
  }

  _generate(cx, cz) {
    const key = chunkKey(cx, cz);
    const group = new THREE.Group();

    // Origin chunk (the main stage + entrance arch) is intentionally pinned
    // across sessions — its rng uses pure hash2, ignoring the session seed.
    // Every other chunk's props re-roll with the seed via worldHash.
    const isOriginChunk = (cx === 0 && cz === 0);
    const chunkSeed = isOriginChunk ? hash2(cx, cz) : worldHash(cx, cz);

    // ── v2 worldgen path (USE_WORLDGEN_V2; default OFF while building → ?worldgen=1 to test) ──
    // A SINGLE branch (R10): the legacy +-grid / pickTheme / THEME_BUILDERS /
    // 5x5 forests / path_node attractors do NOT co-run with v2. Built up across
    // Groups C (roads) / D (anchors+scatter) / F (trees) / G (crowd); Group B
    // ships it empty to prove the buildWorld → _generate → placement wiring
    // boots clean (R2) before any content lands.
    if (USE_WORLDGEN_V2) {
      group.name = `chunk-v2(${cx},${cz})`;
      const ctx = {
        cx, cz, key,
        cxWorld: cx * CHUNK_SIZE,
        czWorld: cz * CHUNK_SIZE,
        rng: mulberry32(chunkSeed),
        group,
        crowd: this.crowd,
      };
      this._generateWorldgen(ctx);
      this._placeSpawnJugs(ctx);   // intro pickups near spawn stay (theme-independent)
      this.scene.add(group);
      this.loaded.set(key, { group, cx, cz, theme: 'worldgen' });
      return;
    }

    // ── v1 legacy path (?worldgen=0) — the per-chunk theme dice roll ──────────
    // Forests preempt the normal theme: if this chunk is part of a forest's
    // 3x3 block, we hand it off to forests.js entirely (which builds dense
    // trees + perimeter colliders + — eventually — the clearing).
    const forest = getForestAt(cx, cz);
    const theme = forest ? 'forest' : pickTheme(cx, cz);
    group.name = `chunk(${cx},${cz},${theme})`;
    const ctx = {
      cx, cz, key,
      theme,
      cxWorld: cx * CHUNK_SIZE,
      czWorld: cz * CHUNK_SIZE,
      rng: mulberry32(chunkSeed),
      group,
      crowd: this.crowd,
    };

    if (forest) {
      // Forest chunks skip the normal path grid, theme builders, ambient
      // crowd, and chunk-tree scatter. Everything is handled inside
      // buildForestChunk so reasoning about "what's in a forest chunk?"
      // stays in forests.js.
      buildForestChunk(ctx, forest);
    } else {
      // Every chunk: paths along its grid axes (skipped if the chunk overlaps a lake)
      placePaths(ctx);

      // Suppress theme content (stages, food trucks, vendor rows, drum circles,
      // hammocks, picnic blankets) when the chunk center sits inside a lake.
      // Otherwise these get placed on top of the water. Trees + sparse ambient
      // crowd still happen — they consult registry footprints individually so
      // they naturally land on the shoreline.
      const inWater = chunkInLake(ctx.cxWorld, ctx.czWorld);
      if (!inWater) {
        THEME_BUILDERS[theme](ctx);
      }

      // Scatter trees — will dodge the buildings + lake footprints registered.
      const treeDensity = inWater ? 0 : THEME_PROPS[theme].treeDensity;
      scatterTrees(ctx, treeDensity);

      // Porta-potties — placed near the chunk's gathering spot (stage, plaza,
      // drum circle, camp village) but off to the side. Runs after the theme
      // builder + trees so it can read this chunk's attractors + dodge props.
      scatterPortaPotties(ctx, inWater);

      // Ambient crowd
      const crowdCount = inWater ? 0 : THEME_PROPS[theme].ambientCrowd;
      spawnAmbientCrowd(ctx, crowdCount);

      // Rare floating bubble-juice jug pickup.
      scatterBubbleJugs(ctx, inWater);
    }

    // Guaranteed near-spawn intro jugs — independent of theme/forest; drop here
    // if a seeded target lands in this chunk.
    this._placeSpawnJugs(ctx);

    this.scene.add(group);
    this.loaded.set(key, { group, cx, cz, theme });
  }

  // v2 worldgen-driven chunk content. Built incrementally:
  //   Group C — chunk-clipped RAW arterial road ribbons (DONE)
  //   Group D/D2 — festival clusters along the heart's approach roads (placement.js + festival.js) (DONE)
  //   Group F — treeDensity woods scatter (clamped to the old ~80/chunk cap) (DONE)
  //   Group G — heart-influence-weighted ambient crowd (TODO)
  // One `queryRegion` per chunk (D-A / R7 — never sample per-m²); the hearts/lakes
  // it also returns are consumed by Groups D/F. Stored on ctx for those groups.
  _generateWorldgen(ctx) {
    const half = CHUNK_SIZE / 2;
    ctx.region = queryRegion({
      minX: ctx.cxWorld - half, minZ: ctx.czWorld - half,
      maxX: ctx.cxWorld + half, maxZ: ctx.czWorld + half,
    });
    placeWorldgenRoads(ctx, ctx.region.roads);
    placeWorldgenProps(ctx);     // Group D/D2 — festival clusters along the heart's roads
    scatterWorldgenTrees(ctx);   // Group F — treeDensity woods (dodge roads, water, clusters)
    // Group G — ambient crowd, CONCENTRATED at hearts: count ∝ heart influence (~16 at a
    // core center → 0 in deep outskirts). The festival clusters + road waypoints register
    // the attractors `spawnAmbientCrowd` fills; this sets how many wander this chunk. One
    // queryPoint/chunk (chunk-gen, not per-frame); PERF.crowdMax caps steady state.
    const qpc = queryPoint(ctx.cxWorld, ctx.czWorld);
    const crowdCount = qpc.heartInfluence < 0.04 ? 0 : Math.round(1 + qpc.heartInfluence * 15);
    spawnAmbientCrowd(ctx, crowdCount);
    // Rare floating bubble-juice jug pickup (~1 in 9 chunks). The v1 scatter only
    // ran in the legacy else-branch, so worldgen=1 had jugs ONLY at the spawn ring
    // (Gary 2026-06-16: "not seeing any jugs of bubble juice anywhere"). Gated on
    // the chunk-center lake test (queryPoint already computed it), and placed after
    // the crowd so it shares v1's crowd-then-jugs ctx.rng ordering.
    scatterBubbleJugs(ctx, qpc.inLake);
    scatterWorldgenCampsites(ctx, qpc);
    placeSeamHedges(ctx);
  }

  // Drop any guaranteed near-spawn jug whose seeded target lands in this chunk.
  // Uses no ctx.rng so it can't shift the chunk's deterministic prop layout
  // (footgun #4); nudges off buildings/water with fixed offsets if needed.
  _placeSpawnJugs(ctx) {
    const half = CHUNK_SIZE / 2;
    for (const j of this._spawnJugs) {
      if (j.placed) continue;
      if (Math.abs(j.x - ctx.cxWorld) > half || Math.abs(j.z - ctx.czWorld) > half) continue;
      j.placed = true;   // claimed by this chunk — its target can't fall in another
      const free = (px, pz) => !registry.closestBuilding(new THREE.Vector3(px, 0, pz), 3) && !isPointInLake(px, pz);
      let x = j.x, z = j.z;
      if (!free(x, z)) {
        // Spiral out (deterministic ring sweep) for a clear gap. A v2 spawn sits at
        // a dense festival heart, so the old ±7m offsets weren't enough — search to
        // ~26m so the welcome jug lands in a gap between stalls rather than vanishing.
        let spot = null;
        for (const r of [5, 9, 14, 20, 26]) {
          for (let k = 0; k < 8 && !spot; k++) {
            const a = (k / 8) * Math.PI * 2;
            const px = j.x + Math.cos(a) * r, pz = j.z + Math.sin(a) * r;
            if (free(px, pz)) spot = [px, pz];
          }
          if (spot) break;
        }
        if (!spot) continue;   // no clear spot within range — skip cleanly (rare)
        x = spot[0]; z = spot[1];
      }
      const jug = buildBubbleJug();
      jug.position.set(x, 0.7, z);
      ctx.group.add(jug);
      registry.add({
        kind: 'bubble_jug',
        position: new THREE.Vector3(x, 0.7, z),
        chunkKey: ctx.key,
        obj: jug,
        juice: 1.0,
      });
    }
  }
}

// Shared chunk teardown (extracted for the hub viewer, task 6.1). Disposes a
// built group's non-shared geometry/materials, removes it from the scene, and
// sweeps every by-key side-list (registry, crowd, stage performers/music/lenses/
// beams, sugar-shack cooks, forest animatables/drum-circles/drum-music) tagged
// with `key`. Behaviour-identical to the old inline `_unload` body — `_unload`
// now just calls this then drops the loaded entry. The hub viewer reuses it to
// rebuild a hub cleanly (the 10-rebuild leak check, task 6.3). `crowd` may be
// null (a crowd-less rebuild). Module-level `userData.shared` geos/mats survive
// (footgun #6); InstancedMesh.dispose frees only its own instance buffers.
export function disposeChunkByKey(scene, group, key, crowd) {
  group.traverse((obj) => {
    if (obj.isMesh) {
      if (!obj.geometry?.userData?.shared) obj.geometry?.dispose();
      const m = obj.material;
      if (Array.isArray(m)) {
        for (const sub of m) if (!sub?.userData?.shared) sub?.dispose?.();
      } else if (!m?.userData?.shared) {
        m?.dispose?.();
      }
      if (obj.isInstancedMesh) obj.dispose();
    }
  });
  scene.remove(group);

  // Clean up registry + crowd + stage performers + stage music tagged with this chunk
  registry.removeChunk(key);
  if (crowd) crowd.unloadChunk(key);
  for (let i = stagePerformers.length - 1; i >= 0; i--) {
    if (stagePerformers[i].chunkKey === key) stagePerformers.splice(i, 1);
  }
  for (let i = stageMusic.length - 1; i >= 0; i--) {
    if (stageMusic[i].chunkKey === key) {
      Sound.detachStageMusic(stageMusic[i].handle);
      stageMusic.splice(i, 1);
    }
  }
  for (let i = stageLightLenses.length - 1; i >= 0; i--) {
    if (stageLightLenses[i].chunkKey === key) stageLightLenses.splice(i, 1);
  }
  for (let i = stageBeamRefs.length - 1; i >= 0; i--) {
    if (stageBeamRefs[i].chunkKey === key) stageBeamRefs.splice(i, 1);
  }
  for (let i = sugarShackCooks.length - 1; i >= 0; i--) {
    if (sugarShackCooks[i].chunkKey === key) sugarShackCooks.splice(i, 1);
  }
  // Sweep forest animatables (campsite firepit / torch flicker state).
  for (let i = forestAnimatables.length - 1; i >= 0; i--) {
    if (forestAnimatables[i].chunkKey === key) forestAnimatables.splice(i, 1);
  }
  // Sweep LEAF drum-circle animatables (fire mesh pulse + PointLight flicker).
  for (let i = forestDrumCircles.length - 1; i >= 0; i--) {
    if (forestDrumCircles[i].chunkKey === key) forestDrumCircles.splice(i, 1);
  }
  // Detach forest-drum spatial music and free its oscillators.
  for (let i = forestDrumMusic.length - 1; i >= 0; i--) {
    if (forestDrumMusic[i].chunkKey === key) {
      Sound.detachStageMusic(forestDrumMusic[i].handle);
      forestDrumMusic.splice(i, 1);
    }
  }
}

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

// ---------- Theme picking ----------

function pickTheme(cx, cz) {
  if (cx === 0 && cz === 0) return 'main_stage';

  const dist = Math.hypot(cx, cz);
  // Closer to origin: denser/more interesting; far: more groves and lawns.
  // salt=1 keeps the "what theme?" RNG decoupled from the chunk's prop rng
  // (which is salt=0 via worldHash / mulberry32(worldHash(cx,cz))).
  const rng = mulberry32(worldHash(cx, cz, 1));
  const r = rng();

  // Spawn-corridor chunk — directly north of origin, where Zerble starts at
  // (0, 65).  Any stage or food plaza here can place large collidable geometry
  // (tent walls, stage deck, food-truck ring) within 5–10 m of the spawn
  // point, putting Zerble immediately inside or in front of a structure.
  // Restrict to themes whose props cluster around the chunk centre (z≈80)
  // and leave the southern edge (z≈40-65) clear.
  if (cx === 0 && cz === 1) {
    if (r < 0.35) return 'drum_circle';
    if (r < 0.60) return 'vendor_row';
    if (r < 0.80) return 'grove';
    return 'open_lawn';
  }

  // INNER ring (chunks immediately around the main stage): keep this band
  // light on stages so spawn doesn't feel cluttered with concert decks. The
  // main stage already lives at (0,0) — neighbors should be food/vendors
  // and ambient lawn, with at most an occasional smaller stage. Camp
  // villages don't appear in the inner ring — they read as "back of the
  // festival," not front-and-center.
  if (dist <= 1.5) {
    if (r < 0.05) return 'tent_stage';     // rare
    if (r < 0.12) return 'side_stage';     // was 35% → 7%
    if (r < 0.35) return 'food_plaza';
    if (r < 0.65) return 'vendor_row';
    if (r < 0.80) return 'drum_circle';
    if (r < 0.92) return 'grove';
    return 'open_lawn';
  }
  // Middle ring picks up the camp_village theme at 7% — visible enough to
  // be a regular sight while still feeling like a discovery.
  if (dist <= 3.5) {
    if (r < 0.07) return 'camp_village';
    if (r < 0.15) return 'tent_stage';
    if (r < 0.25) return 'side_stage';
    if (r < 0.42) return 'food_plaza';
    if (r < 0.62) return 'vendor_row';
    if (r < 0.74) return 'drum_circle';
    if (r < 0.90) return 'grove';
    return 'open_lawn';
  }
  // Outer rings — keep stages discoverable far from spawn; camp villages
  // bump to ~12% out here where the festival reads as more residential.
  if (r < 0.12) return 'camp_village';
  if (r < 0.17) return 'tent_stage';
  if (r < 0.24) return 'side_stage';
  if (r < 0.32) return 'food_plaza';
  if (r < 0.40) return 'drum_circle';
  if (r < 0.52) return 'vendor_row';
  if (r < 0.77) return 'grove';
  return 'open_lawn';
}

// Density tuning — forests with 15+ campsites inside felt busier than
// the open festival around them. Bumped ambient crowd counts across
// most themes so the festival reads as a real festival, not an empty
// fairgrounds.
const THEME_PROPS = {
  main_stage:   { treeDensity: 0.15, ambientCrowd: 42 },
  side_stage:   { treeDensity: 0.25, ambientCrowd: 24 },
  tent_stage:   { treeDensity: 0.10, ambientCrowd: 30 },   // dense crowd inside
  food_plaza:   { treeDensity: 0.2,  ambientCrowd: 22 },
  vendor_row:   { treeDensity: 0.3,  ambientCrowd: 20 },
  drum_circle:  { treeDensity: 0.4,  ambientCrowd: 18 },
  grove:        { treeDensity: 1.0,  ambientCrowd: 11 },
  open_lawn:    { treeDensity: 0.2,  ambientCrowd: 14 },
  // Camp village — sparse trees + a relaxed living-in-the-woods crowd. Most
  // campers are at their own sites, not wandering, so the ambient crowd is
  // intentionally lower than open_lawn even though the chunk is "populated."
  camp_village: { treeDensity: 0.45, ambientCrowd: 8 },
};

const THEME_BUILDERS = {
  main_stage: buildMainStage,
  side_stage: buildSideStage,
  tent_stage: buildTentStageTheme,
  food_plaza: buildFoodPlaza,
  vendor_row: buildVendorRow,
  drum_circle: buildDrumCircle,
  grove: buildGrove,
  open_lawn: buildOpenLawn,
  camp_village: buildCampVillage,
};

// ---------- Path placement ----------

function placePaths(ctx) {
  // Two dirt trails through the chunk — they enter/exit at the chunk's edge
  // midpoints (so they always connect with neighbors) but wiggle in between
  // so they don't read as a perfect grid. Each chunk's wiggle is seeded by
  // (cx, cz) so it's deterministic + consistent on reload.
  //
  // Skip paths if any lake intersects this chunk — water has its own causeway
  // and we don't want paths submerging into the lake.
  if (chunkOverlapsLake(ctx.cxWorld, ctx.czWorld, CHUNK_SIZE / 2)) return;

  const pathColor = 0xb89570;
  const mat = new THREE.MeshStandardMaterial({
    color: pathColor,
    roughness: 1,
    metalness: 0,
    // polygonOffset pulls the path "toward camera" in depth so it draws on top
    // of the ground even when the terrain has tiny variations. depthWrite off
    // prevents the path from blocking decals stacked above it.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    depthWrite: false,
  });

  // E-W trail: enters at (cxWorld - chunk/2, czWorld), exits at (cxWorld + chunk/2, czWorld)
  const ewMesh = buildCurvedPath(
    ctx.cxWorld - CHUNK_SIZE / 2 - 1, ctx.czWorld,
    ctx.cxWorld + CHUNK_SIZE / 2 + 1, ctx.czWorld,
    5,   // width
    ctx.rng,
    mat,
  );
  ctx.group.add(ewMesh);

  // N-S trail
  const nsMesh = buildCurvedPath(
    ctx.cxWorld, ctx.czWorld - CHUNK_SIZE / 2 - 1,
    ctx.cxWorld, ctx.czWorld + CHUNK_SIZE / 2 + 1,
    5,
    ctx.rng,
    mat,
  );
  ctx.group.add(nsMesh);

  // A small dirt pad at the intersection — kept circular as a visual anchor.
  const padGeo = new THREE.CircleGeometry(5, 16);
  const pad = new THREE.Mesh(padGeo, mat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(ctx.cxWorld, 0.06, ctx.czWorld);
  ctx.group.add(pad);

  // Register path waypoints for NPCs (chunk-local + 4 edge points)
  registry.add({
    kind: 'path_node',
    position: new THREE.Vector3(ctx.cxWorld, 0, ctx.czWorld),
    footprint: 0,
    attractor: { radius: 6, weight: 0.5 },
    chunkKey: ctx.key,
  });
}

// Builds a flat ribbon mesh from (x1,z1) to (x2,z2) that follows a gentle
// curve. The curve is a Catmull-Rom through jittered interior control points
// (deterministic via the passed rng), and the ribbon has constant width with
// edges offset perpendicular to the local tangent. Lying flat at y=0.06.
export function buildCurvedPath(x1, z1, x2, z2, width, rng, material) {
  const segments = 16;
  const halfW = width / 2;

  // Build control points: start, 3 jittered interior, end.
  const lineLen = Math.hypot(x2 - x1, z2 - z1);
  const tangent = { x: (x2 - x1) / lineLen, z: (z2 - z1) / lineLen };
  const perpendicular = { x: -tangent.z, z: tangent.x };
  const maxOffset = Math.min(width * 1.5, lineLen * 0.10); // wiggle amplitude

  const ctrl = [{ x: x1, z: z1 }];
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const baseX = x1 + tangent.x * lineLen * t;
    const baseZ = z1 + tangent.z * lineLen * t;
    const off = (rng() - 0.5) * 2 * maxOffset;
    ctrl.push({ x: baseX + perpendicular.x * off, z: baseZ + perpendicular.z * off });
  }
  ctrl.push({ x: x2, z: z2 });

  const curve = new THREE.CatmullRomCurve3(
    ctrl.map((p) => new THREE.Vector3(p.x, 0, p.z)),
    false,
    'catmullrom',
    0.5,
  );

  // Build ribbon: for each step along the curve, emit two vertices offset
  // perpendicularly by ±halfW.
  const verts = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPoint(t);
    const tg = curve.getTangent(t);
    // Perpendicular in XZ plane (rotate tangent 90° around Y).
    const px = -tg.z;
    const pz = tg.x;
    verts.push(p.x + px * halfW, 0, p.z + pz * halfW); // left
    verts.push(p.x - px * halfW, 0, p.z - pz * halfW); // right
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, material);
  mesh.position.y = 0.06;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- v2 worldgen roads (Group C) ----------
//
// Chunk-clipped RAW arterial ribbons. The whole arterial is one deterministic,
// pair-owned worldgen polyline; each chunk renders only the portion crossing its
// own AABB. Because adjacent chunks clip the SAME polyline at the SAME shared
// boundary, the two halves meet at the identical point with the identical tangent
// → no seam kink (D-D), and the ribbon traces the exact segments `nearestRoad`
// uses, so the rendered road and the `noBuild`/`facing` gate agree (R1, RAW
// source-of-truth). Roads are passable (no collider).

// Shared dirt-road material. Created LAZILY on first use (during chunk
// generation), NOT at module-eval — a `depthWrite:false` MeshStandardMaterial
// constructed at module-eval time renders INVISIBLY in-game (its meshes draw
// under the player-centered ground plane; verified by an in-game A/B). The
// legacy `+`-grid path material (placePaths) renders fine precisely because it
// is built per-chunk at RUNTIME; this mirrors that timing while staying a single
// shared instance. Tagged `userData.shared` so the chunk-unload disposal walk
// skips it (footgun #6 / R6) — otherwise the first chunk unload frees it and
// every other chunk's road forces a shader recompile.
let _roadMat = null;
function roadMat() {
  if (!_roadMat) {
    _roadMat = new THREE.MeshStandardMaterial({
      color: 0xb89570,
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      depthWrite: false,
    });
    _roadMat.userData.shared = true;
  }
  return _roadMat;
}

// Visible ribbon width. The worldgen noBuild corridor is ±CONFIG.ROAD_WIDTH of the
// centerline; rendering the ribbon at the full ROAD_WIDTH leaves a cleared shoulder
// on each side (corridor − ribbon) so props sit beside the road, never on it.
const ROAD_RIBBON_WIDTH = CONFIG.ROAD_WIDTH;

// Liang-Barsky clip of segment a→b to the box. Returns the clipped endpoints plus
// the t0/t1 params on the original segment (so the caller can tell whether a
// clipped end is a box-boundary crossing vs. an original interior vertex), or null
// if the segment misses the box entirely.
function clipSegmentLB(x0, z0, x1, z1, minX, minZ, maxX, maxZ) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dz = z1 - z0;
  const p = [-dx, dx, -dz, dz];
  const q = [x0 - minX, maxX - x0, z0 - minZ, maxZ - z0];
  for (let k = 0; k < 4; k++) {
    if (p[k] === 0) {
      if (q[k] < 0) return null;       // parallel and outside this edge
    } else {
      const r = q[k] / p[k];
      if (p[k] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else          { if (r < t0) return null; if (r < t1) t1 = r; }
    }
  }
  return { x0: x0 + t0 * dx, z0: z0 + t0 * dz, x1: x0 + t1 * dx, z1: z0 + t1 * dz, t0, t1 };
}

// Clip a polyline to an axis-aligned box, returning the in-box runs (each ≥2
// points). A run breaks whenever the polyline leaves the box (so a road that
// enters, exits, and re-enters this chunk yields two separate ribbons).
function clipPolylineToBox(pts, minX, minZ, maxX, maxZ) {
  const EPS = 1e-6;
  const runs = [];
  let run = null;
  const add = (x, z) => {
    if (!run) { run = []; runs.push(run); }
    const last = run[run.length - 1];
    if (!last || Math.abs(last.x - x) > EPS || Math.abs(last.z - z) > EPS) run.push({ x, z });
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const seg = clipSegmentLB(a.x, a.z, b.x, b.z, minX, minZ, maxX, maxZ);
    if (!seg) { run = null; continue; }      // segment misses the chunk → break run
    if (seg.t0 > EPS) run = null;            // entered mid-segment → start a fresh run
    add(seg.x0, seg.z0);
    add(seg.x1, seg.z1);
    if (seg.t1 < 1 - EPS) run = null;        // exited mid-segment → close the run
  }
  return runs.filter((r) => r.length >= 2);
}

// Build a flat ribbon that follows a polyline's actual vertices (NOT a re-jittered
// curve — the worldgen polyline IS the road). Interior vertices use an averaged
// (miter) tangent for a smooth joint; run endpoints — which on a clipped run are
// always the chunk-boundary crossings — use the single adjacent-segment tangent, so
// they match the neighbor chunk's ribbon edge exactly.
function buildRibbonFromPolyline(pts, width, material) {
  const halfW = width / 2;
  const n = pts.length;
  const verts = [];
  const indices = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[i - 1], cur = pts[i], next = pts[i + 1];
    let tx, tz;
    if (prev && next) {
      const d1x = cur.x - prev.x, d1z = cur.z - prev.z, l1 = Math.hypot(d1x, d1z) || 1;
      const d2x = next.x - cur.x, d2z = next.z - cur.z, l2 = Math.hypot(d2x, d2z) || 1;
      tx = d1x / l1 + d2x / l2; tz = d1z / l1 + d2z / l2;
    } else if (next) {
      tx = next.x - cur.x; tz = next.z - cur.z;
    } else {
      tx = cur.x - prev.x; tz = cur.z - prev.z;
    }
    const tl = Math.hypot(tx, tz) || 1;
    const pxn = -(tz / tl), pzn = (tx / tl);   // perpendicular in XZ
    verts.push(cur.x + pxn * halfW, 0, cur.z + pzn * halfW);  // left edge
    verts.push(cur.x - pxn * halfW, 0, cur.z - pzn * halfW);  // right edge
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.y = 0.06;
  mesh.receiveShadow = true;
  return mesh;
}

// Render the worldgen arterials passing through this chunk + register one
// chunk-keyed road waypoint so the crowd drifts along roads (replaces the legacy
// `+`-grid `path_node`; the legacy one only runs in the ?worldgen=0 branch — C.3).
function placeWorldgenRoads(ctx, roads) {
  if (!roads || roads.length === 0) return;
  const half = CHUNK_SIZE / 2;
  const minX = ctx.cxWorld - half, maxX = ctx.cxWorld + half;
  const minZ = ctx.czWorld - half, maxZ = ctx.czWorld + half;
  const mat = roadMat();
  for (const road of roads) {
    const runs = clipPolylineToBox(road.points, minX, minZ, maxX, maxZ);
    for (const run of runs) {
      ctx.group.add(buildRibbonFromPolyline(run, ROAD_RIBBON_WIDTH, mat));
      placeRoadWaypoints(ctx, run);   // Group G — crowd drifts ALONG the road via these
    }
  }
}

// Seed `path_node` crowd attractors at ~WAYPOINT_SPACING intervals along an in-chunk
// road run. This is the v2 replacement for the legacy +-grid crowd pull (crowd.js):
// the ambient crowd clusters along the chain of waypoints → people line the roads,
// with NO per-NPC `nearestRoad` query (that's 215us/call — unviable per-frame, R13).
// Cheap + deterministic: registered at chunk-gen, chunk-keyed so it unloads cleanly.
// E1 — crowd road-follow strength is a LEVER (Gary): tighter spacing + a bit more
// weight makes ambient wanderers line the roads more between clusters, without
// over-pulling them off stages (stage_front weight 3.5 + the forced stage audience
// keep stage crowds dense). Push WAYPOINT_WEIGHT up / SPACING down for stronger
// road-following; keep weight well under the stage weight so hubs stay the draw.
const WAYPOINT_SPACING = 20;
const WAYPOINT_WEIGHT = 0.85;
const WAYPOINT_RADIUS = 7;
function placeRoadWaypoints(ctx, run) {
  let acc = WAYPOINT_SPACING * 0.5;   // first waypoint ~half a step in from the run start
  for (let i = 0; i < run.length - 1; i++) {
    const ax = run[i].x, az = run[i].z;
    const ex = run[i + 1].x - ax, ez = run[i + 1].z - az;
    const segLen = Math.hypot(ex, ez);
    if (segLen < 1e-3) continue;
    while (acc < segLen) {
      const t = acc / segLen;
      registry.add({
        kind: 'path_node',
        position: new THREE.Vector3(ax + ex * t, 0, az + ez * t),
        footprint: 0,
        attractor: { radius: WAYPOINT_RADIUS, weight: WAYPOINT_WEIGHT },
        chunkKey: ctx.key,
      });
      acc += WAYPOINT_SPACING;
    }
    acc -= segLen;
  }
}

// ---------- Worldgen woods (Group F — treeDensity scatter) ----------
//
// Replaces BOTH the legacy decorative chunk-trees AND the 5x5 forest system with
// one continuous, density-driven scatter. The woodland mass comes from worldgen's
// `treeDensity(x,z)` field (organic gap-fill noise, cleared at heart cores, ramping
// in across districts, with a dense ring hugging each lakeshore). Dense regions
// become drive-around woods; clearings (treeDensity ~0 — cores, between blobs) stay
// open. The drum-circle-in-woods experience is re-homed via festival.js (its drum
// lands at a treed district spot that Group F then surrounds with trees), so the
// legacy forest's interior content (paths, campsites, the LEAF drum circle) is NOT
// ported here — it's superseded by the festival POI layer + the lake camp/forest rings.
//
// R3 (BINDING gate): clamped to the proven ~80-trees/chunk ceiling (the legacy
// FOREST_TREE_TARGET_DENSITY 0.022 × 6400 m²), scaled by PERF.forestTreeDensityMul
// (0.7 on low). Each tree is the collidable `buildForestTree` (damage 3) — woods are
// walls, like the legacy forests; the festival/road/clearing areas are treeDensity ~0
// so they stay open. Placement rng is a FRESH per-chunk stream (worldHash, session-
// seeded), never `ctx.rng`, so the candidate count can't desync any other consumer.
const MAX_WORLDGEN_TREES = 80;       // R3 cap — matches the legacy ~80/chunk ceiling
const WG_TREE_MIN_SPACING = 4.0;     // metres between trunks (matches the legacy forest)
// Trees may grow freely near these (the lakeshore ring is the POINT — don't let the
// lake's huge `footprint` read as a blocker; spacing handles tree-vs-tree). Trees
// DODGE everything else (stages/trucks/tents/shacks/arches/portas/drum/camps).
const TREE_GUARD_SKIP = new Set([
  'lake', 'lake_edge', 'shore', 'beach', 'tree', 'forest_tree', 'path_node', 'bubble_jug',
]);

function scatterWorldgenTrees(ctx) {
  const half = CHUNK_SIZE / 2;
  const minX = ctx.cxWorld - half, minZ = ctx.czWorld - half;
  const rng = mulberry32(worldHash(ctx.cx * 73 + 19, ctx.cz * 91 + 41));
  const target = Math.max(0, Math.floor(MAX_WORLDGEN_TREES * PERF.forestTreeDensityMul));
  const roadHalf = ROAD_RIBBON_WIDTH / 2 + 2.0;   // keep trunks off the ribbon + a small margin
  // Dancefloor clearings (A4 / D3.7): the no-tree rects in front of every nearby
  // hub's stage so woods nestle the BACK/sides but never the audience side. A
  // CROSS-CHUNK query (a stage's dancefloor spills past its own 80m chunk), keyed
  // off owning hearts via the MAX_POI_REACH AABB-expand — fetched ONCE here, then
  // a cheap oriented point-in-rect test per candidate (NOT a per-tree worldgen
  // query; the rects' computeFrontAxis is memoized → ~2ms cold for the chunk, R7).
  const danceRects = dancefloorRectsNear(minX, minZ, minX + CHUNK_SIZE, minZ + CHUNK_SIZE);
  // ALL arterials crossing this chunk (cross-heart, deduped) — not just this
  // chunk's owning region. `ctx.region.roads` is one heart's roads, so a road from
  // a NEIGHBOUR heart that clips the chunk was invisible and trees landed on it
  // (Gary 2026-06-14: "several trees spawned in the middle of road"). Fetched ONCE
  // like danceRects; `pointNearWorldgenRoad` then does the cheap polyline test.
  const chunkRoads = roadsInBounds(minX - roadHalf, minZ - roadHalf, minX + CHUNK_SIZE + roadHalf, minZ + CHUNK_SIZE + roadHalf);
  // Drum-circle inner clearings (Gary 2026-06-14: "trees in the middle of a drum
  // circle") — keep the firepit/bench ring clear while the surrounding pocket stays
  // treed. Plan-side, fetched once, load-order-independent (see drumClearingsNear).
  const drumClears = drumClearingsNear(minX, minZ, minX + CHUNK_SIZE, minZ + CHUNK_SIZE);
  const placed = [];
  const placeTree = (x, z) => {
    const tree = buildForestTree(rng);
    tree.position.set(x, 0, z);
    tree.rotation.y = rng() * Math.PI * 2;
    ctx.group.add(tree);
    registry.add({
      kind: 'forest_tree',
      position: new THREE.Vector3(x, 0, z),
      footprint: 2.0,
      collider: { radius: 1.3, damage: 3 },
      chunkKey: ctx.key,
      perches: worldPerches(tree, x, z),
      crown: worldCrown(tree, x, z),
    });
    placed.push({ x, z });
  };
  const clearOfStuff = (x, z, spacing) => {
    if (pointInDancefloor(x, z, danceRects)) return false;          // keep the stage's audience side clear (A4)
    if (pointNearWorldgenRoad(x, z, chunkRoads, roadHalf)) return false;   // off EVERY nearby arterial, not just this region's
    for (let i = 0; i < drumClears.length; i++) { const dc = drumClears[i]; if ((dc.x - x) * (dc.x - x) + (dc.z - z) * (dc.z - z) < dc.r * dc.r) return false; }
    for (let i = 0; i < placed.length; i++) if (Math.hypot(placed[i].x - x, placed[i].z - z) < spacing) return false;
    if (registry.closestBuilding(new THREE.Vector3(x, 0, z), 2.5, TREE_GUARD_SKIP)) return false;
    return true;
  };
  for (let attempt = 0; attempt < target * 4 && placed.length < target; attempt++) {
    const x = minX + rng() * CHUNK_SIZE;
    const z = minZ + rng() * CHUNK_SIZE;
    const d = treeDensity(x, z);          // 0..1 — already 0 on worldgen water + heart cores
    if (d <= 0.05) continue;              // clearing / open lawn
    if (rng() > d) continue;              // place ∝ density (sparse fringes fall out naturally)
    // Thicket gradient (Gary 2026-06-16: "ok with some impassable, but drive through
    // some areas"). Spacing shrinks with density: open woods stay at the drive-through
    // 4.0 m, but a deep core packs to 2.2 m — tighter than the trunk collider diameter
    // (r 1.3 → 2.6 m), so trunks overlap into a genuine wall you can't thread. The 80-tree
    // R3 cap is unchanged, so dense cores just fill denser while fringes stay sparse + open.
    const spacing = WG_TREE_MIN_SPACING - Math.min(1, Math.max(0, (d - 0.5) / 0.5)) * 1.8;
    if (!clearOfStuff(x, z, spacing)) continue;
    placeTree(x, z);
  }
  // F1 — the occasional LONE tree even in the big open fields: treeDensity below the
  // woods threshold but above 0 (water + heart cores are forced to exactly 0, so a
  // small floor excludes both). Big spacing → reads as a landmark tree, not a thin
  // forest; capped under the R3 budget so dense chunks are unaffected.
  const loneCap = PERF.forestTreeDensityMul < 0.9 ? 2 : 3;
  let lone = 0;
  for (let attempt = 0; attempt < 14 && lone < loneCap && placed.length < target; attempt++) {
    const x = minX + rng() * CHUNK_SIZE, z = minZ + rng() * CHUNK_SIZE;
    const d = treeDensity(x, z);
    if (d <= 0.004 || d > 0.05) continue;        // open field only (not water/cores at 0, not the woods at >0.05)
    if (rng() > 0.5) continue;                   // sparse
    if (!clearOfStuff(x, z, 24)) continue;       // 24m spacing → genuinely lone
    placeTree(x, z);
    lone++;
  }
  // C1 — string a post-less hammock between the occasional pair of CLOSE trees (the
  // trunks ARE the posts). It hangs in the un-driveable gap between two trunks, so
  // it's decorative (visual-only, no collider/registry entry — disposed with the
  // chunk group). Capped so it stays a woodland discovery, not a carpet.
  let hammocks = 0;
  for (let i = 0; i < placed.length && hammocks < 2; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const d = Math.hypot(placed[i].x - placed[j].x, placed[i].z - placed[j].z);
      if (d < 3.0 || d > 5.5) continue;
      if (rng() > 0.22) continue;
      ctx.group.add(buildTreeHammock(placed[i].x, placed[i].z, placed[j].x, placed[j].z, rng).group);
      hammocks++;
      break;
    }
  }
  // Posted hammocks slung in the woods — the REGISTERED, NPC-loungeable kind
  // ('hammock', with a seatPos crowd.js parks a wook in). v1 placed these in
  // buildGrove, which worldgen=1 never runs, so the v2 woods had none (Gary
  // 2026-06-16: "fix missing hammocks" — same gap as the bubble jugs). Uses the
  // LOCAL tree rng, so it can't desync the ctx.rng order the crowd/jugs/camps
  // ride. Density-gated + capped so they stay a woodland discovery, not a carpet.
  if (placed.length >= 6) {
    const hCount = rng() < 0.45 ? 1 + Math.floor(rng() * 2) : 0;   // 0..2, ~45% of woods chunks
    let hung = 0;
    for (let attempt = 0; attempt < 16 && hung < hCount; attempt++) {
      const hx = minX + rng() * CHUNK_SIZE, hz = minZ + rng() * CHUNK_SIZE;
      if (treeDensity(hx, hz) < 0.08) continue;         // in/near the woods, not hub core or open field
      // 3.5 m clearance = a real pocket to hang in (posts ~3 m apart) without jamming it
      // inside a trunk; still off roads / dancefloors / buildings via clearOfStuff.
      if (!clearOfStuff(hx, hz, 3.5)) continue;
      buildHammock(ctx, hx, hz, rng);
      placed.push({ x: hx, z: hz });                    // later trees keep clear of it
      hung++;
    }
  }
  // Low shrubs as woodland undergrowth + ground cover — visual-only (soft bushes
  // you drive over; no collider/registry entry, disposed with the chunk group),
  // on the LOCAL tree rng so they don't shift the ctx.rng order. Cluster mostly at
  // tree bases (undergrowth read), a few in the open scrub. Off roads/dancefloors;
  // treeDensity gates out water (0 there) + the bare hub cores.
  const nShrubs = placed.length >= 6 ? 8 + Math.floor(rng() * 9) : (placed.length >= 2 ? 2 + Math.floor(rng() * 4) : 0);
  for (let i = 0; i < nShrubs; i++) {
    let sx, sz;
    if (placed.length && rng() < 0.8) {
      const t = placed[Math.floor(rng() * placed.length)];
      const a = rng() * Math.PI * 2, d = 1.2 + rng() * 2.6;
      sx = t.x + Math.cos(a) * d; sz = t.z + Math.sin(a) * d;
    } else {
      sx = minX + rng() * CHUNK_SIZE; sz = minZ + rng() * CHUNK_SIZE;
    }
    if (treeDensity(sx, sz) < 0.05) continue;
    if (pointNearWorldgenRoad(sx, sz, chunkRoads, roadHalf)) continue;
    if (pointInDancefloor(sx, sz, danceRects)) continue;
    if (registry.closestBuilding(new THREE.Vector3(sx, 0, sz), 1.5, TREE_GUARD_SKIP)) continue;
    const shrub = buildShrub(rng);
    shrub.position.set(sx, 0, sz);
    ctx.group.add(shrub);
  }
}

// Is (x,z) inside any hub's oriented dancefloor rect? Project onto the rect's +F
// axis (along ∈ [0,depth]) and its perpendicular (|perp| <= halfWidth). Cheap
// scalar math, no worldgen query (the rects came pre-computed from festival.js).
function pointInDancefloor(x, z, rects) {
  for (const r of rects) {
    const dx = x - r.cx, dz = z - r.cz;
    const along = dx * r.dirx + dz * r.dirz;
    if (along < 0 || along > r.depth) continue;
    const perp = -dx * r.dirz + dz * r.dirx;
    if (perp >= -r.halfWidth && perp <= r.halfWidth) return true;
  }
  return false;
}

// Cheap local "is (x,z) on a road" test against this chunk's raw arterial polylines
// (ctx.region.roads) — point-to-segment distance, no per-attempt worldgen query (R7).
function pointNearWorldgenRoad(x, z, roads, halfW) {
  if (!roads || roads.length === 0) return false;
  const h2 = halfW * halfW;
  for (const road of roads) {
    const pts = road.points;
    if (!pts) continue;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, az = pts[i].z, ex = pts[i + 1].x - ax, ez = pts[i + 1].z - az;
      const L2 = ex * ex + ez * ez || 1;
      let t = ((x - ax) * ex + (z - az) * ez) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - (ax + ex * t), dz = z - (az + ez * t);
      if (dx * dx + dz * dz < h2) return true;
    }
  }
  return false;
}

// ---------- Worldgen festival placement (D2 — feature-anchored clusters) ----------
//
// The build+register half of the v2 placement split: `worldgen/festival.js` (pure)
// decides the festival LAYOUT — a heart's stage/arch/courts/vendor-rows/drum/potties
// lining its approach roads, plus camp villages in the districts — as plain cluster
// descriptors; `placement.js` filters them to this chunk (cluster-center ownership);
// this side maps each descriptor's `kind` → buildX() → registry.add. Replaces the
// Group-D per-point random scatter (deliberation 002 / design.md D-K..D-Q).
// The cluster-center guard exists to stop a cluster stacking on a big SOLID
// structure (stage / food-truck / market tent). festival.js already lays a heart's
// clusters out without self-overlap, and isPointInLake handles water — so the guard
// must IGNORE everything else: trees, the dense `lake_edge` sphere ring around every
// shore (a lakeside cluster is desirable), shore/beach markers, non-solid waypoints/
// decals, AND a cluster's own small companions (porta banks, arches, bubble vendors,
// drum circles). `closestBuilding` measures EDGE distance, so without this the 9 m
// companion porta a court plants beside itself would read as a blocker and silently
// eat the court. Only stage / truck / tent block a new cluster.
const CLUSTER_GUARD_SKIP = new Set([
  // Trees (both legacy decorative `tree` AND Group-F worldgen `forest_tree`) must NOT
  // block a cluster: a cluster's PRESENCE can't depend on chunk load order (a neighbor
  // chunk's trees may register before this cluster's chunk generates — esp. the
  // off-road drum circle, which lands in a treed pocket). The cluster builds; its own
  // chunk's trees dodge it (built first), and a rare cross-chunk tree clipping a cluster
  // edge is cosmetic. Big SOLID structures (stage/truck/tent) still block (no stacking).
  'tree', 'forest_tree', 'lake', 'lake_edge', 'shore', 'beach', 'path_node', 'chair', 'picnic', 'picnic_table', 'stage_front',
  'porta_potty', 'arch', 'bubble_vendor', 'drum_circle', 'hammock', 'campsite', 'bubble_jug', 'lamppost',
]);

// (Removed `neighbourCourtHere` in 4B.3c — the cross-hub food-court SHARE is now the
// principled, order-independent `merged_court` seam response in festivalPlan: the yielder's
// food_court descriptor is suppressed plan-side, so it never reaches this builder. Same for
// the drum-yields-to-a-neighbour-stage band-aid, now the `yield` seam response.)

function placeWorldgenProps(ctx) {
  const descs = placeChunkProps(ctx.cx, ctx.cz, CHUNK_SIZE, ctx.region);
  for (const d of descs) {
    if (isPointInLake(d.x, d.z)) continue;   // worldgen water (Group E: rendered water == worldgen lakeAt)
    // Cross-hub clashes (food-court merge, drum-yield, vendor trim) are resolved PLAN-SIDE by
    // the 4B seam grammar — suppressed descriptors never arrive here. This builder keeps only
    // the load-order graceful-degradation backstop: a non-anchor cluster dodges an already-built
    // BUILDING at its center (the cluster builders manage their own internal spacing). Anchors
    // (stage/arch, near the heart center) are priority and never dodge.
    if (d.kind === 'drum_circle') {
      // Dodge an already-built neighbour cluster the bench ring would overlap (load-order backstop).
      const drumR = clusterExtent('drum_circle') + 2;   // firepit + bench arc
      if (registry.closestBuilding(new THREE.Vector3(d.x, 0, d.z), drumR, CLUSTER_GUARD_SKIP)) continue;
    } else if (!d.anchor) {
      const guard = Math.min(8, Math.max(2, (d.footprint || 4) * 0.5));
      if (registry.closestBuilding(new THREE.Vector3(d.x, 0, d.z), guard, CLUSTER_GUARD_SKIP)) continue;
    }
    buildWorldgenKind(ctx, d);
  }
}

// Map a cluster descriptor → its builder. Each cluster gets a CLUSTER-LOCAL rng
// (`mulberry32(clusterSeed)`) instead of the chunk's `ctx.rng`, so the build half's
// model variation never rides `ctx.rng` draw order — a change in the descriptor list
// length can't desync the chunk's other consumers (R19). Return-shape extraction is
// per-builder (R2): buildStage/buildDrumCircleAt register internally; the *At helpers
// extract `.group`/bare-Group exactly as each model demands.
// Dev-only drift guard (design D-B; PROMOTED to throw, task 3.3 / D12): tuning.js
// MODEL_DIMS copies a few model dimensions so the node linter (which can't import
// src/models/*) can compute ORIENTED cluster extents (clusterShapes). If a model
// body is retuned and MODEL_DIMS isn't updated, those extents silently go stale —
// and now that they're load-bearing for placement, the node linter reads the
// stale copy and reports a hub CLEAN while the game builds a clip. chunks.js
// legally imports both, so it's the one place that can catch the drift in-game.
// One-shot, localhost-only, now THROWS (was console.warn) so a stale copy fails
// loud at dev boot instead of shipping a silent clip — the headless half of the
// same guard is bin/check-model-dims. PROD is never affected (isDevHost gate).
// The arrangement multipliers themselves (× FOOD_TRUCK_SCALE) read the live
// export at the call site, so there's nothing to drift there.
let _tuningDriftChecked = false;
function assertTuningDrift() {
  if (_tuningDriftChecked) return;
  _tuningDriftChecked = true;
  if (typeof location === 'undefined') return;
  const h = location.hostname;
  const isDevHost = h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' ||
    h.endsWith('.local') || /^10\./.test(h) || /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.includes('claude-preview') || h.includes('happycog');
  if (!isDevHost) return;
  const M = MODEL_DIMS;
  const checks = [
    ['FOOD_TRUCK_SCALE', M.FOOD_TRUCK_SCALE, FOOD_TRUCK_SCALE],
    ['SUGAR_SHACK_W', M.SUGAR_SHACK_W, SUGAR_SHACK_WIDTH],
    ['SUGAR_SHACK_D', M.SUGAR_SHACK_D, SUGAR_SHACK_DEPTH],
    ['POTTY_SPACING', M.POTTY_SPACING, POTTY_SPACING],
  ];
  const drifts = checks.filter(([, copied, live]) => copied !== live)
    .map(([name, copied, live]) => `MODEL_DIMS.${name}=${copied} but live model export=${live}`);
  if (drifts.length) {
    throw new Error(`[tuning drift] ${drifts.join('; ')} — update tuning.js MODEL_DIMS (and re-check clusterShapes/clusterExtent), then re-run bin/check-model-dims. (dev-host only)`);
  }
}

function buildWorldgenKind(ctx, d) {
  assertTuningDrift();
  // Transparent counting passthrough over the cluster-local rng (task 1.4
  // canary). `realRng()` is the same mulberry32 stream in the same order; the
  // wrapper only tallies calls — zero behavior change.
  const realRng = mulberry32((d.clusterSeed >>> 0) || 0x1A2B3C);
  let _draws = 0;
  const cctx = { ...ctx, rng: () => { _draws++; return realRng(); } };
  switch (d.kind) {
    case 'main_stage':    buildStage(cctx, d.x, d.z, true, d.yaw); break;
    case 'side_stage':    buildStage(cctx, d.x, d.z, false, d.yaw); break;
    case 'tent_stage':    buildTentStageTheme(cctx, d.x, d.z, d.yaw); break;   // B1 — tent-stage variety
    case 'arch':          buildEntranceArchAt(cctx, d.x, d.z, d.yaw); break;
    case 'food_court':    buildFoodCourtAt(cctx, d.x, d.z); break;
    case 'vendor_row':    buildVendorRowAt(cctx, d.x, d.z, d.yaw); break;
    case 'bubble_vendor': buildBubbleVendorAt(cctx, d.x, d.z, d.yaw); break;
    case 'porta_bank':    buildPottyBankAt(cctx, d.x, d.z, d.yaw); break;
    case 'drum_circle':   buildWorldgenDrumCircle(cctx, d.x, d.z, d.yaw); buildDrumAccessPath(cctx, d.x, d.z); break;   // B2 — FULL leaf drum circle + winding access path
    case 'camp_village':  buildCampVillageAt(cctx, d.x, d.z, d.tents); break;   // D2 — tent count ∝ local crowd
    default: break;       // unknown kind → place nothing (forward-compatible)
  }
  worldgenDrawCounts.set(`${d.kind}@${Math.round(d.x)},${Math.round(d.z)}`, _draws);
}

// Build ONE festival hub on a flat plane for the hub viewer (task 6.2). Reuses
// the EXACT game build path: every cluster goes through `buildWorldgenKind`,
// whose rng is `mulberry32(clusterSeed)` — CHUNK-INDEPENDENT — so a cluster
// builds byte-identically whether the game builds it (spread across chunks) or
// the viewer builds the whole hub at once. That's what lets the viewer match the
// game's `dumpRegistry` at the same seed/hub/tier (the 6.3 acceptance), modulo
// explainable crowd-pool-state diffs.
//
// `opts`: { crowd, lakes }.
//  - crowd — a real `Crowd` (NEVER omit): `crowd.spawn` draws from the cluster
//    rng stream AND early-returns drawing nothing when its pool is exhausted
//    (crowd.js:338), so leaving it out shifts every later draw in `buildStage`.
//    A fresh crowd matches a fresh hub load; where the GAME's pool was already
//    drained by neighbours, the diff is explainable (D6 / the pinned tier).
//  - lakes — a `LakeManager`; its worldgen lakes are loaded+registered BEFORE
//    building so the water-skip (`isPointInLake`) + dodge match the game.
// Tear down with `disposeChunkByKey(scene, group, key, crowd)` (6.1) — that path
// sweeps the same by-key side-lists `buildWorldgenKind` pushes to, so repeated
// rebuilds don't leak (the 10-rebuild check, 6.3).
export function buildHubPreview(scene, heart, opts = {}) {
  const { crowd = null, lakes = null } = opts;
  const pos = new THREE.Vector3(heart.x, 0, heart.z);
  if (lakes) lakes.update(scene, pos);     // register this hub's lakes first

  const key = `hub:${heart.cx},${heart.cz}`;
  const group = new THREE.Group();
  group.name = `hub-preview(${heart.cx},${heart.cz})`;
  scene.add(group);
  const reach = MAX_POI_REACH;
  const region = queryRegion({ minX: heart.x - reach, minZ: heart.z - reach, maxX: heart.x + reach, maxZ: heart.z + reach });
  const ctx = {
    cx: heart.cx, cz: heart.cz, key,
    cxWorld: heart.x, czWorld: heart.z,
    // ctx.rng is NOT consumed by the cluster builders (they use the per-cluster
    // clusterSeed stream); present only for ctx-shape parity with _generateWorldgen.
    rng: mulberry32(worldHash(heart.cx, heart.cz)),
    group, region, crowd,
  };

  // Same per-descriptor water-skip + non-anchor dodge guard as placeWorldgenProps,
  // but over the WHOLE hub (festivalPlan(heart) is NOT chunk-clipped) + its
  // back-of-festival camp villages within reach. The dodge runs against the PAGE
  // registry (this hub only), so a cluster the GAME dropped because a NEIGHBOUR
  // chunk's building blocked it can build here — an explainable 6.3 difference.
  const build = (d) => {
    if (isPointInLake(d.x, d.z)) return;
    if (!d.anchor) {
      const guard = Math.min(8, Math.max(2, (d.footprint || 4) * 0.5));
      if (registry.closestBuilding(new THREE.Vector3(d.x, 0, d.z), guard, CLUSTER_GUARD_SKIP)) return;
    }
    buildWorldgenKind(ctx, d);
  };
  for (const d of festivalPlan(heart)) build(d);
  for (const v of campVillagesNear({ minX: heart.x - reach, minZ: heart.z - reach, maxX: heart.x + reach, maxZ: heart.z + reach })) {
    if (Math.hypot(v.x - heart.x, v.z - heart.z) <= reach) build(v);
  }
  return { group, key, heart };
}

// Entrance arch + a string-light pole pair across its opening, rotated to face the
// stage. The "you've arrived" gateway (the spawn heart's arch is where Zerble spawns).
function buildEntranceArchAt(ctx, x, z, yaw) {
  const arch = buildEntranceArchModel(leafBannerTextures('#fff4d0', '#ff6f9c', '#ffe066'));
  arch.position.set(x, 0, z);
  arch.rotation.y = yaw;
  ctx.group.add(arch);
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const rot = (lx, lz) => ({ x: x + lx * cosY + lz * sinY, z: z - lx * sinY + lz * cosY });
  for (const lx of [-6, 6]) {
    const w3 = rot(lx, 0);
    registry.add({ kind: 'arch', position: new THREE.Vector3(w3.x, 1, w3.z), footprint: 0.8, collider: { radius: 1.0, damage: 4 }, chunkKey: ctx.key });
  }
  // A festive string-light pair straddling the arch (poles just outside the posts).
  const a = rot(-9, 0), b = rot(9, 0);
  placePolePair(ctx, a.x, a.z, b.x, b.z);
}

// A single refuel bubble vendor (buildBubbleVendor returns a bare Group). `yaw`
// faces the road. Refuel is the core verb, so festival.js guarantees one per heart.
// True if an entity of `kind` is already registered within `r` of (x,z).
// Build-time proximity check (chunk-gen, not per-frame). The "exclusionary
// principle" for SUPPORT entities (Gary 2026-06-16): if a parent already has a
// bubble vendor / porta-bank nearby, don't spawn a second one on top of it.
function kindNear(kind, x, z, r) {
  const r2 = r * r;
  for (const e of registry.entries.values()) {
    if (e.kind !== kind) continue;
    const dx = e.position.x - x, dz = e.position.z - z;
    if (dx * dx + dz * dz < r2) return true;
  }
  return false;
}

function buildBubbleVendorAt(ctx, x, z, yaw) {
  // Exclusionary principle: one bubble vendor per neighbourhood. Skip if another
  // is already within 30 m — covers a food court doubling up on the hub's
  // guaranteed booth AND two adjacent hubs each placing one near the seam.
  if (kindNear('bubble_vendor', x, z, 30)) return;
  const vendor = buildBubbleVendor(ctx.rng);
  vendor.position.set(x, 0, z);
  vendor.rotation.y = yaw;
  ctx.group.add(vendor);
  registry.add({
    kind: 'bubble_vendor',
    position: new THREE.Vector3(x, 0, z),
    footprint: 2.4,
    collider: { radius: 1.5, damage: 2 },
    attractor: { radius: 7, weight: 1.0 },
    chunkKey: ctx.key,
    obj: vendor,
    refuel: 0.4,
  });
}

// A small porta-potty bank (1-2 units), reusing the legacy row builder. Doors face
// the road (the worldgen `yaw`). Skips if the row can't fit clear of buildings/water.
function buildPottyBankAt(ctx, x, z, yaw) {
  const count = 1 + (ctx.rng() < 0.4 ? 1 : 0);
  // Exclusionary principle: in a dense hub, neighbouring clusters (stage, food
  // court, vendor row) each request a porta-bank and they pile into a 2-2-1 clump
  // (Gary 2026-06-16). Skip this bank if potties already sit within 20 m — the
  // existing bank serves this cluster too.
  if (kindNear('porta_potty', x, z, 20)) return;
  if (!pottyRowClear(x, z, yaw, count)) return;
  buildPottyBank(ctx, ctx.rng, x, z, yaw, count);
}

// Two parallel rows of market tents, world-positioned, running ALONG the road (the
// row axis is local +Z; `yaw` = π/2 − roadBearing from festival.js aligns +Z to the
// road tangent). Ported from the legacy buildVendorRow (5-7/side, 5 m spacing, 7 m
// offset). Sugar shacks do NOT appear here — only in the food court (kills the
// solo-shack bug).
function buildVendorRowAt(ctx, x, z, yaw) {
  const T = FESTIVAL_TUNING;
  const count = T.VENDOR_ROW_COUNT_BASE + Math.floor(ctx.rng() * T.VENDOR_ROW_COUNT_SPAN);
  const spacing = T.VENDOR_ROW_SPACING, rowOffset = T.VENDOR_ROW_OFFSET;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const place = (lx, lz) => ({ x: x + lx * cosY + lz * sinY, z: z - lx * sinY + lz * cosY });  // +Z = along road
  for (let i = 0; i < count; i++) {
    const t = i - (count - 1) / 2;
    for (const side of [-1, 1]) {
      const w = place(side * rowOffset, t * spacing);
      if (isPointInLake(w.x, w.z)) continue;
      // The row is a STRAIGHT booth line straddling the road by ±rowOffset. Where the road
      // CURVES through the row's span it bends toward one side, putting that side's booths
      // ON the visible road (Gary 2026-06-14: "the road turned in the middle, so it also
      // crosses a road"). Skip a booth that lands on the road ribbon — the row keeps a gap
      // at the bend instead of crossing. Chunk-gen only; same skip-before-buildTent pattern
      // as the backstops below, so the cluster-local rng + goldens are unaffected.
      if (nearestRoad(w.x, w.z).dist < ROAD_RIBBON_WIDTH / 2 + 1) continue;
      // Group-5 backstop: skip a booth that would clip an already-built solid (a stage
      // deck the row runs past, a neighbour's truck) — the graceful-degradation guard the
      // legacy theme builders had. Chunk-gen only; clusterSeed stream, so goldens unaffected.
      if (registry.closestBuilding(new THREE.Vector3(w.x, 0, w.z), 2.2, CLUSTER_GUARD_SKIP)) continue;
      const tent = buildTent(ctx.rng);
      tent.position.set(w.x, 0, w.z);
      // Face the central aisle (the road, after round-2 C). The two rows were
      // rotated to face OUTWARD; +π flips each booth's open front in toward the
      // aisle so the row reads as a market street you drive down.
      tent.rotation.y = yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI;
      ctx.group.add(tent);
      registry.add({
        kind: 'tent',
        position: new THREE.Vector3(w.x, 0, w.z),
        footprint: 2.6,
        collider: { radius: 2.2, damage: 5 },
        attractor: { radius: 4, weight: 0.5 },
        chunkKey: ctx.key,
      });
      // D3: a camper's tent tucked BEHIND ~40% of the stalls (back side, away from
      // the aisle) — "vendors camp behind their stalls."
      if (ctx.rng() < T.VENDOR_CAMPER_PROB) {
        const cw = place(side * (rowOffset + T.VENDOR_CAMPER_BACK_OFFSET), t * spacing + (ctx.rng() - 0.5) * 2);
        // The row straddles the road and bends across it; the booths already skip
        // on-road slots (above) but the camper behind them never did (Gary 06-16).
        if (!isPointInLake(cw.x, cw.z) && nearestRoad(cw.x, cw.z).dist >= ROAD_RIBBON_WIDTH / 2 + 1) {
          const camp = buildCampTent(ctx.rng).group;   // buildCampTent returns { group, color, footprint }, not a bare Group (R2)
          camp.position.set(cw.x, 0, cw.z);
          camp.rotation.y = yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI + (ctx.rng() - 0.5) * 0.5;
          ctx.group.add(camp);
          registry.add({
            kind: 'campsite',
            position: new THREE.Vector3(cw.x, 0, cw.z),
            footprint: 1.6,
            collider: { radius: 1.3, damage: 3 },
            chunkKey: ctx.key,
          });
        }
      }
    }
  }
}

// A food-truck court ring centered at (x,z) — the festival's food street. Ported from
// buildFoodPlaza (3-5 trucks on a ~24 m ring, inward-facing, ~35% one sugar shack,
// a bubble vendor at the edge), world-positioned, with an inter-truck overlap guard
// the legacy ring lacked (the only thing that kept it from overlapping was the
// spawn-corridor hack — D2.3 surgery).
function buildFoodCourtAt(ctx, x, z) {
  const T = FESTIVAL_TUNING;
  const count = T.FOOD_COURT_COUNT_BASE + Math.floor(ctx.rng() * T.FOOD_COURT_COUNT_SPAN);
  const ring = T.FOOD_COURT_RING_MULT * FOOD_TRUCK_SCALE;
  const wantShack = ctx.rng() < T.FOOD_COURT_SHACK_PROB;
  const shackSlot = wantShack ? Math.floor(ctx.rng() * count) : -1;
  const placed = [];
  const overlaps = (px, pz, r) => placed.some((p) => {
    const dx = p.x - px, dz = p.z - pz; return dx * dx + dz * dz < (p.r + r) * (p.r + r);
  });
  // The court hugs the drag (D2.3), but the ~24 m truck ring overshoots the road
  // it parks near — the road-side trucks/shack land ON the pavement (Gary playtest
  // 2026-06-16: "Sugar Shack right on the road, another food truck also on the road").
  // Skip any ring slot on the road ribbon; the ring keeps a gap there, exactly like
  // the vendor row's road-skip (line ~1383). Chunk-gen only — clusterSeed stream, so
  // the POI + queryPoint goldens are unaffected.
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + ctx.rng() * 0.4;
    if (i === shackSlot) {
      const shackRing = ring + T.FOOD_COURT_SHACK_RING_PAD;
      const sx = x + Math.cos(ang) * shackRing, sz = z + Math.sin(ang) * shackRing;
      const half = Math.hypot(SUGAR_SHACK_WIDTH, SUGAR_SHACK_DEPTH) / 2;
      if (isPointInLake(sx, sz) || nearestRoad(sx, sz).dist < ROAD_RIBBON_WIDTH / 2 + 1 || overlaps(sx, sz, half)) continue;
      const shack = buildSugarShack(ctx.rng);
      shack.position.set(sx, 0, sz);
      shack.rotation.y = Math.atan2(x - sx, z - sz);   // front faces the court center
      ctx.group.add(shack);
      if (shack.userData.cookEntry) shack.userData.cookEntry.chunkKey = ctx.key;
      registry.add({
        kind: 'truck',
        position: new THREE.Vector3(sx, 1.5, sz),
        footprint: half + 0.5,
        collider: { radius: half - 0.2, damage: 10 },
        attractor: { radius: half + 6, weight: 1.4 },
        chunkKey: ctx.key,
      });
      placed.push({ x: sx, z: sz, r: half });
      continue;
    }
    const tx = x + Math.cos(ang) * ring, tz = z + Math.sin(ang) * ring;
    const tr = T.FOOD_COURT_TRUCK_R_MULT * FOOD_TRUCK_SCALE;
    if (isPointInLake(tx, tz) || nearestRoad(tx, tz).dist < ROAD_RIBBON_WIDTH / 2 + 1 || overlaps(tx, tz, tr)) continue;
    const truck = buildFoodTruck(ctx.rng);
    truck.position.set(tx, 0, tz);
    truck.rotation.y = Math.atan2(x - tx, z - tz);   // face inward
    ctx.group.add(truck);
    registry.add({
      kind: 'truck',
      position: new THREE.Vector3(tx, 1.5 * FOOD_TRUCK_SCALE, tz),
      footprint: tr,
      collider: { radius: 3.6 * FOOD_TRUCK_SCALE, damage: 12 },
      attractor: { radius: 8 * FOOD_TRUCK_SCALE, weight: 1.2 },
      chunkKey: ctx.key,
    });
    placed.push({ x: tx, z: tz, r: tr });
  }
  // A bubble vendor at the court edge ~40% of the time (refuel near the food) —
  // but skip it if the hub's guaranteed bubble vendor (or a neighbour court's)
  // is already nearby, so two identical booths don't end up cheek-to-cheek
  // (Gary 2026-06-16: "TWO bubble booths, shouldnt find them so close"). The rng
  // rolls below still happen regardless, so the chunk's draw stream is unchanged.
  if (ctx.rng() < T.FOOD_COURT_BUBBLE_PROB) {
    const ang = ctx.rng() * Math.PI * 2, vr = ring + T.FOOD_COURT_BUBBLE_RING_PAD;
    const vx = x + Math.cos(ang) * vr, vz = z + Math.sin(ang) * vr;
    if (!isPointInLake(vx, vz) && !overlaps(vx, vz, 2.4)) {
      buildBubbleVendorAt(ctx, vx, vz, Math.atan2(x - vx, z - vz));   // dedups internally (kindNear)
    }
  }
  // C2 / A7: picnic tables in the open center plaza (inside the truck ring), so the
  // court has a place to sit + eat. Each is a soft attractor so the ambient crowd
  // gathers around the tables (the "people at the picnic area" read; the precise
  // butts-on-benches seated pose is a tracked follow-up). Spaced so Zerble can still
  // weave between them within the ring.
  const tableN = T.FOOD_COURT_TABLE_COUNT_BASE + Math.floor(ctx.rng() * T.FOOD_COURT_TABLE_COUNT_SPAN);   // 1-3
  const tablesPlaced = [];
  for (let i = 0; i < tableN; i++) {
    const ang = ctx.rng() * Math.PI * 2, rad = ctx.rng() * (ring * T.FOOD_COURT_TABLE_RING_FRAC);
    const tx = x + Math.cos(ang) * rad, tz = z + Math.sin(ang) * rad;
    if (isPointInLake(tx, tz)) continue;
    if (tablesPlaced.some((p) => Math.hypot(p.x - tx, p.z - tz) < T.FOOD_COURT_TABLE_MIN_SPACING)) continue;
    const pt = buildPicnicTable(ctx.rng);
    pt.group.position.set(tx, 0, tz);
    pt.group.rotation.y = ctx.rng() * Math.PI * 2;
    ctx.group.add(pt.group);
    registry.add({
      kind: 'picnic_table',
      position: new THREE.Vector3(tx, 0, tz),
      footprint: pt.footprint,
      collider: { radius: 1.0, damage: 3 },
      attractor: { radius: 4, weight: 0.6 },
      chunkKey: ctx.key,
    });
    tablesPlaced.push({ x: tx, z: tz });
  }

  // C3: tiki torches ringing the court perimeter (just outside the truck ring).
  const courtTorches = [];
  const torchR = ring + T.FOOD_COURT_TORCH_RING_PAD;
  const torchCount = T.FOOD_COURT_TORCH_COUNT;
  for (let i = 0; i < torchCount; i++) {
    const ang = (i / torchCount) * Math.PI * 2 + 0.3;
    const tx = x + Math.cos(ang) * torchR, tz = z + Math.sin(ang) * torchR;
    if (!isPointInLake(tx, tz)) courtTorches.push({ x: tx, z: tz });
  }
  if (courtTorches.length) {
    const tf = buildTorchField(courtTorches, ctx.rng);
    ctx.group.add(tf.group);
    if (tf.animatables && tf.animatables.length) forestAnimatables.push({ chunkKey: ctx.key, animatables: tf.animatables });
  }
}

// A packed camp village centered at (x,z) — the "back of the festival" residential
// cluster. Ports the legacy buildCampVillage packing engine (12-20 sites, 50/35/15
// small/medium/large, 5.5 m spacing, 30 m envelope) but anchored to a worldgen
// district cell instead of a chunk CORNER. The chunk-corner anchor was a chunk-grid
// artifact — the packing rule was always good (CHANGELOG.md:611-613, the three failed
// framings). Sites spill into neighbour chunks but stay parented to this chunk's
// group, unloading as a unit.
function buildCampVillageAt(ctx, x, z, tentTarget) {
  // D2: target tent count comes from the plan (∝ local crowd density); falls back
  // to the legacy 12-20 if a caller doesn't supply one (keeps the legacy path intact).
  const T = FESTIVAL_TUNING;
  const target = tentTarget != null ? tentTarget : T.CAMP_TARGET_BASE + Math.floor(ctx.rng() * T.CAMP_TARGET_SPAN);
  const placed = [];
  const MIN_SPACING = T.CAMP_MIN_SPACING, RADIUS = T.CAMP_RADIUS;
  let attempts = 0;
  while (placed.length < target && attempts < target * 16) {
    attempts++;
    const px = x + (ctx.rng() - 0.5) * 2 * RADIUS, pz = z + (ctx.rng() - 0.5) * 2 * RADIUS;
    if (isPointInLake(px, pz)) continue;
    if (nearestRoad(px, pz).dist < ROAD_RIBBON_WIDTH / 2 + 4) continue;   // footprint-aware: camps beside roads, never ON them (Gary 2026-06-14, strengthened 06-16 — onRoad corridor had an edge case)
    if (registry.closestBuilding(new THREE.Vector3(px, 0, pz), T.CAMP_GUARD_RADIUS, CLUSTER_GUARD_SKIP)) continue;
    let tooClose = false;
    for (const p of placed) { const dx = p.x - px, dz = p.z - pz; if (dx * dx + dz * dz < MIN_SPACING * MIN_SPACING) { tooClose = true; break; } }
    if (tooClose) continue;
    const r = ctx.rng();
    const size = r < T.CAMP_SIZE_SMALL_BELOW ? 'small' : (r < T.CAMP_SIZE_MEDIUM_BELOW ? 'medium' : 'large');
    placeSingleCampsite(ctx, px, pz, size);
    placed.push({ x: px, z: pz });
  }
}

// ---------- Tree scattering ----------

function scatterTrees(ctx, density) {
  const targetCount = Math.floor(density * 18);
  let placed = 0;
  let tries = 0;
  while (placed < targetCount && tries < targetCount * 5) {
    tries++;
    const x = ctx.cxWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE - 6);
    const z = ctx.czWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE - 6);
    // Avoid the path strip and existing buildings
    if (Math.abs(x - ctx.cxWorld) < 4 && Math.abs(z - ctx.czWorld) < CHUNK_SIZE * 0.5) continue;
    if (Math.abs(z - ctx.czWorld) < 4 && Math.abs(x - ctx.cxWorld) < CHUNK_SIZE * 0.5) continue;
    if (registry.closestBuilding(new THREE.Vector3(x, 0, z), 2.5)) continue;

    const tree = buildTree(ctx.rng);
    tree.position.set(x, 0, z);
    tree.rotation.y = ctx.rng() * Math.PI * 2;
    ctx.group.add(tree);

    registry.add({
      kind: 'tree',
      position: new THREE.Vector3(x, 0, z),
      footprint: 1.8,
      attractor: { radius: 4, weight: 0.15 },
      chunkKey: ctx.key,
      // Canopy perch anchors (world-space) for the bird system.
      perches: worldPerches(tree, x, z),
      crown: worldCrown(tree, x, z),
    });
    placed++;
  }
}

// ---------- Theme builders ----------

function buildMainStage(ctx) {
  const x = ctx.cxWorld;
  const z = ctx.czWorld - 20; // slightly off center in the chunk
  buildStage(ctx, x, z, true);
  buildEntranceArch(ctx, x, ctx.czWorld + 30);
  // Add string lights along the main path
  for (let s = -25; s <= 25; s += 16) {
    placePolePair(ctx, x - 18, ctx.czWorld + s, x + 18, ctx.czWorld + s);
  }
}

function buildSideStage(ctx) {
  const x = ctx.cxWorld + (ctx.rng() - 0.5) * 10;
  const z = ctx.czWorld + (ctx.rng() - 0.5) * 10;
  buildStage(ctx, x, z, false);
}

// Tent stage theme — the big white-tent stage. Legacy theme path drops it at the
// chunk center with a random yaw; the v2 worldgen path (B1 tent-stage variety)
// passes an explicit (cx, cz, yaw) so it lands at a hub facing +F like any stage.
// The tent model is built FIRST so the legacy rng draw order (tent build, THEN the
// fallback yaw draw) is byte-identical — never make `yaw` a default param (that
// would draw rng before the body).
function buildTentStageTheme(ctx, cxArg, czArg, yawArg) {
  const tex = leafBannerTextures('#fff4d0', '#6fcf6a', '#ffd28a');
  const tent = buildTentStage({ rng: ctx.rng, leafTexture: tex });
  const cx = cxArg != null ? cxArg : ctx.cxWorld;
  const cz = czArg != null ? czArg : ctx.czWorld;
  // Worldgen passes a road-facing yaw; the legacy path draws a random one (same
  // rng position as before, after the tent build).
  const yaw = yawArg != null ? yawArg : ctx.rng() * Math.PI * 2;
  tent.group.position.set(cx, 0, cz);
  tent.group.rotation.y = yaw;
  ctx.group.add(tent.group);

  // Track the tent's stage lights with the rest of the light show.
  for (const lens of tent.stageLights) {
    stageLightLenses.push({
      lens, chunkKey: ctx.key, baseColor: lens.material.color.getHex(),
    });
  }
  // ...and its audience-facing beams. The tent stage's world position is the
  // chunk center (tent.group.position is set to cxWorld/czWorld above).
  if (tent.stageBeams) {
    const tentWorldPos = new THREE.Vector3(cx, 0, cz);
    for (const b of tent.stageBeams) {
      stageBeamRefs.push({ ...b, chunkKey: ctx.key, scale: tent.stageScale || 1.0, stageWorldPos: tentWorldPos });
    }
  }

  // Helper: rotate a local (lx, lz) into world coordinates given the yaw.
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const worldXZ = (lx, lz) => ({
    x: cx + lx * cosY + lz * sinY,
    z: cz + -lx * sinY + lz * cosY,
  });

  // Stage colliders: re-use the inscribed-spheres approach from buildStage.
  // Local stage coordinates are at tent.stagePos.
  const w = tent.stageWidth;
  const d = tent.stageDepth;
  const sphereR = 2.5;
  const innerW = Math.max(0.001, w - sphereR * 2);
  const innerD = Math.max(0.001, d - sphereR * 2);
  const cols = Math.max(2, Math.ceil(innerW / 3.5) + 1);
  const rows = Math.max(2, Math.ceil(innerD / 3.5) + 1);
  for (let cc = 0; cc < cols; cc++) {
    for (let rr = 0; rr < rows; rr++) {
      const localX = tent.stagePos.x + (-innerW / 2 + (cc / (cols - 1)) * innerW);
      const localZ = tent.stagePos.z + (-innerD / 2 + (rr / (rows - 1)) * innerD);
      const w3 = worldXZ(localX, localZ);
      registry.add({
        kind: 'stage',
        position: new THREE.Vector3(w3.x, 1, w3.z),
        footprint: sphereR,
        collider: { radius: sphereR, damage: 9 },
        chunkKey: ctx.key,
      });
    }
  }

  // Tent pole colliders so Zerble bounces off the four corners.
  const halfW = tent.width / 2;
  const halfD = tent.depth / 2;
  for (const [lx, lz] of [
    [-halfW, -halfD], [halfW, -halfD], [-halfW, halfD], [halfW, halfD],
  ]) {
    const w3 = worldXZ(lx, lz);
    registry.add({
      kind: 'tent',
      position: new THREE.Vector3(w3.x, 0, w3.z),
      footprint: 0.5,
      collider: { radius: 0.5, damage: 3 },
      chunkKey: ctx.key,
    });
  }

  // Soundbooth platform collider (so Zerble can't drive through the mixer)
  {
    const w3 = worldXZ(tent.mixerPos.x, tent.mixerPos.z);
    registry.add({
      kind: 'tent',
      position: new THREE.Vector3(w3.x, 0.5, w3.z),
      footprint: 1.4,
      collider: { radius: 1.4, damage: 5 },
      attractor: { radius: 3, weight: 0.6 },
      chunkKey: ctx.key,
    });
  }

  // Attractor in front of the stage so crowds gather there even outside the
  // tent placement loop below.
  {
    const w3 = worldXZ(0, tent.stagePos.z + d / 2 + 4);
    registry.add({
      kind: 'stage_front',
      position: new THREE.Vector3(w3.x, 0, w3.z),
      footprint: 0,
      attractor: { radius: 10, weight: 2.5 },
      chunkKey: ctx.key,
    });
  }

  // Spawn the in-tent crowd directly so they actually appear inside the tent
  // (the ambient-crowd pass spawns globally on the chunk, which would scatter
  // them across the grass too).
  if (ctx.crowd) {
    for (const spot of tent.crowdSpots) {
      const w3 = worldXZ(spot.x, spot.z);
      ctx.crowd.spawn({
        pos: new THREE.Vector3(w3.x, 0, w3.z),
        chunkKey: ctx.key,
        rng: ctx.rng,
      });
    }
    // Sound engineer at the mixer
    const m3 = worldXZ(tent.mixerPos.x, tent.mixerPos.z + 0.6);
    ctx.crowd.spawn({
      pos: new THREE.Vector3(m3.x, 0, m3.z),
      chunkKey: ctx.key,
      rng: ctx.rng,
    });
  }

  // ----- Chair clumps INSIDE the tent -----
  //
  // Layout (tent-local +Z = away from stage = toward sound booth / opening):
  //   stage deck:    z ≈ tent.stagePos.z ± stageDepth/2
  //   stage front:   z ≈ stagePos.z + stageDepth/2
  //   dance area:    front 1/3 of the audience floor (closest to stage,
  //                  no chairs — people dance here)
  //   chair band:    back 2/3 of the audience floor, INSIDE the tent
  //   sound booth:   tent.mixerPos.z (near the tent's front opening)
  //   tent opening:  z = tent.depth/2
  //
  // Chairs face the stage (toward -Z in tent-local), so after the tent's
  // random `yaw` they face `yaw + π` plus a small per-chair jitter.
  // Lateral spread stays inside the tent's width.
  //
  // Original "outdoor audience" pass that I had here is gone — the tent
  // already populates `crowdSpots` (18 NPCs inside) + a sound engineer,
  // so the tent has its own indoor crowd and doesn't need an outdoor
  // audience fan like open stages do.
  {
    const stageFrontZ = tent.stagePos.z + tent.stageDepth / 2;
    const audBackZ = tent.mixerPos.z - 1.5;       // just in front of the booth
    const audDepth = audBackZ - stageFrontZ;
    const danceDepth = audDepth / 3;              // front third = dance
    const chairBandStart = stageFrontZ + danceDepth;
    const chairBandEnd = audBackZ;
    const lateralSpread = tent.width - 5;         // inside tent walls
    const clumpCount = 4 + Math.floor(ctx.rng() * 2);
    for (let ci = 0; ci < clumpCount; ci++) {
      const clumpLocalX = (ctx.rng() - 0.5) * lateralSpread;
      const clumpLocalZ = chairBandStart + ctx.rng() * (chairBandEnd - chairBandStart);
      const chairsInClump = 3 + Math.floor(ctx.rng() * 4);
      for (let chi = 0; chi < chairsInClump; chi++) {
        const offX = (ctx.rng() - 0.5) * 2.8;
        const offZ = (ctx.rng() - 0.5) * 2.0;
        const lx = clumpLocalX + offX;
        const lz = clumpLocalZ + offZ;
        const w3 = worldXZ(lx, lz);
        const chair = buildCampChair(ctx.rng);
        chair.group.position.set(w3.x, 0, w3.z);
        // Face the stage: chair-local +Z is "forward"; the stage is at
        // tent-local -Z, so the chair needs to face tent-local -Z =
        // world (yaw + π) plus a small jitter.
        chair.group.rotation.y = yaw + Math.PI + (ctx.rng() - 0.5) * 0.7;
        ctx.group.add(chair.group);
        registry.add({
          kind: 'chair',
          position: new THREE.Vector3(w3.x, 0, w3.z),
          footprint: 0.5,
          chunkKey: ctx.key,
        });
      }
    }
    // One extra clump BEHIND the sound booth (still under tent canvas) for
    // variety — captures the "some can be behind the booth, that's fine"
    // part of the design.
    if (ctx.rng() < 0.7) {
      const behindLocalX = (ctx.rng() - 0.5) * (lateralSpread - 4);
      const behindLocalZ = tent.mixerPos.z + 1.5 + ctx.rng() * 2.0;
      const chairsInClump = 2 + Math.floor(ctx.rng() * 3);
      for (let chi = 0; chi < chairsInClump; chi++) {
        const offX = (ctx.rng() - 0.5) * 2.5;
        const offZ = (ctx.rng() - 0.5) * 1.5;
        const lx = behindLocalX + offX;
        const lz = behindLocalZ + offZ;
        const w3 = worldXZ(lx, lz);
        const chair = buildCampChair(ctx.rng);
        chair.group.position.set(w3.x, 0, w3.z);
        chair.group.rotation.y = yaw + Math.PI + (ctx.rng() - 0.5) * 0.7;
        ctx.group.add(chair.group);
        registry.add({
          kind: 'chair',
          position: new THREE.Vector3(w3.x, 0, w3.z),
          footprint: 0.5,
          chunkKey: ctx.key,
        });
      }
    }
  }

  // Spatial music — style varies per chunk from the tent palette.
  const musicSeed = worldHash(ctx.cx * 13 + 23, ctx.cz * 19 + 17);
  const tentStyleSeed = worldHash(ctx.cx * 13 + 23 + STYLE_SALT, ctx.cz * 19 + 17 + STYLE_SALT);
  const tentStyle = pickStageStyle(tentStyleSeed, ['jam', 'dance', 'world']);
  const m3 = worldXZ(0, tent.stagePos.z);
  const handle = Sound.attachStageMusic(m3.x, 4, m3.z, musicSeed, tentStyle);
  if (handle) stageMusic.push({ handle, chunkKey: ctx.key });
}

function buildFoodPlaza(ctx) {
  // 3-5 food trucks arranged around a central area. Trucks are scaled up
  // visually (FOOD_TRUCK_SCALE) — push the ring outward + scale colliders to
  // match so we don't end up parked-on-truck-roof.
  //
  // Roughly one in three plazas gets a Sugar Shack swapped in for one of the
  // ring positions. Determined per-chunk so a given plaza is stable across
  // reloads. The shack is wider than a truck, so we shift its ring slot
  // outward and size its collider to the actual footprint.
  const count = 3 + Math.floor(ctx.rng() * 3);
  const centerX = ctx.cxWorld;
  const centerZ = ctx.czWorld;
  const ring = 14 * FOOD_TRUCK_SCALE;
  const wantShack = ctx.rng() < 0.35;
  const shackSlot = wantShack ? Math.floor(ctx.rng() * count) : -1;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + ctx.rng() * 0.4;
    if (i === shackSlot) {
      // Shack is ~12m wide vs truck's ~10m; nudge outward so it doesn't poke
      // into the plaza's center walkable area.
      const shackRing = ring + 2.5;
      const x = centerX + Math.cos(ang) * shackRing;
      const z = centerZ + Math.sin(ang) * shackRing;
      const shack = buildSugarShack(ctx.rng);
      shack.position.set(x, 0, z);
      shack.rotation.y = Math.atan2(centerX - x, centerZ - z); // front faces inward
      ctx.group.add(shack);
      // Tag the cook patrol entry so chunk unload can sweep it.
      if (shack.userData.cookEntry) shack.userData.cookEntry.chunkKey = ctx.key;

      // Collider sized to the actual canopy. The shack is rectangular, not
      // round, so the radius is a compromise — half the diagonal of the
      // footprint gives a slight overlap on the corners which is fine.
      const half = Math.hypot(SUGAR_SHACK_WIDTH, SUGAR_SHACK_DEPTH) / 2;
      registry.add({
        kind: 'truck',           // reuses the truck toast + sfx — "don't hit the food trucks"
        position: new THREE.Vector3(x, 1.5, z),
        footprint: half + 0.5,
        collider: { radius: half - 0.2, damage: 10 },
        attractor: { radius: half + 6, weight: 1.4 },
        chunkKey: ctx.key,
      });
      continue;
    }

    const x = centerX + Math.cos(ang) * ring;
    const z = centerZ + Math.sin(ang) * ring;
    const truck = buildFoodTruck(ctx.rng);
    truck.position.set(x, 0, z);
    truck.rotation.y = Math.atan2(centerX - x, centerZ - z); // face inward
    ctx.group.add(truck);

    registry.add({
      kind: 'truck',
      position: new THREE.Vector3(x, 1.5 * FOOD_TRUCK_SCALE, z),
      footprint: 4.4 * FOOD_TRUCK_SCALE,
      collider: { radius: 3.6 * FOOD_TRUCK_SCALE, damage: 12 },
      attractor: { radius: 8 * FOOD_TRUCK_SCALE, weight: 1.2 },
      chunkKey: ctx.key,
    });
  }

  // ~40% of plazas get a bubble-juice vendor at the edge — drive up to refill
  // (free). Faces the plaza centre (its -Z customer side toward the player).
  if (ctx.rng() < 0.4) {
    const ang = ctx.rng() * Math.PI * 2;
    const vr = ring + 3;
    const x = centerX + Math.cos(ang) * vr;
    const z = centerZ + Math.sin(ang) * vr;
    const vendor = buildBubbleVendor(ctx.rng);
    vendor.position.set(x, 0, z);
    vendor.rotation.y = Math.atan2(centerX - x, centerZ - z);
    ctx.group.add(vendor);
    registry.add({
      kind: 'bubble_vendor',
      position: new THREE.Vector3(x, 0, z),
      footprint: 2.4,
      // Solid booth — Zerble bounces off it (light bonk) instead of driving
      // through. Radius is smaller than the refuel range so you can still nose
      // up close enough to refill. Light damage; it's a friendly stand.
      collider: { radius: 1.5, damage: 2 },
      attractor: { radius: 7, weight: 1.0 },
      chunkKey: ctx.key,
      obj: vendor,
      refuel: 0.4,            // juice/sec while Zerble lingers in range
    });
  }
}

// Rare floating bubble-juice jug pickup — roughly 1 in 9 chunks gets one, at a
// random open spot. Drive over it to refill (handled in main.js). The jug
// floats + bobs (its obj.userData.anim is ticked from the main loop).
function scatterBubbleJugs(ctx, inWater) {
  if (inWater || ctx.rng() > 0.11) return;
  for (let attempt = 0; attempt < 8; attempt++) {
    const x = ctx.cxWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE - 10);
    const z = ctx.czWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE - 10);
    if (registry.closestBuilding(new THREE.Vector3(x, 0, z), 3)) continue;
    const jug = buildBubbleJug();
    jug.position.set(x, 0.7, z);
    ctx.group.add(jug);
    registry.add({
      kind: 'bubble_jug',
      position: new THREE.Vector3(x, 0.7, z),
      chunkKey: ctx.key,
      obj: jug,
      juice: 1.0,            // a full meter — jugs stack past 1 (stockpile)
    });
    return;
  }
}

// v2 outskirts campsite scatter. The worldgen path uses neither the 5x5 forest
// system NOR the grove/lawn theme camp scatter (both v1-only), so v2's treed
// outskirts had ZERO camping — the only campsites in v2 were the camp_village
// POI clusters packed at hub cores (Gary 2026-06-16, twice: "MORE clusters of
// campsites of all sizes in areas like this!", out in the deep outskirts).
// Scatter mixed-size clumps in the low-influence ground AWAY from cores (which
// already get a village). Uses ctx.rng (after the jug scatter) — deterministic
// per chunk, and campsites/jugs aren't in any golden, so the layer is golden-safe.
function scatterWorldgenCampsites(ctx, qpc) {
  // Skip ONLY the immediate hub core (its camp_village + dense clusters fill it);
  // the dense hub design keeps heartInfluence high (0.6-0.7) far out, and those
  // mid-zone/outskirts areas are exactly where Gary wants camping, so the cap is
  // generous. The building-proximity dodge below keeps clumps out of clusters.
  if (qpc.inLake || qpc.heartInfluence > 0.85) return;
  if (ctx.rng() > 0.28) return;                          // ~28% of outskirts chunks get a clump
  // Pick a clump centre clear of water, roads, and existing structures.
  let ccx = 0, ccz = 0, ok = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    const x = ctx.cxWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE * 0.6);
    const z = ctx.czWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE * 0.6);
    if (queryPoint(x, z).noBuild) continue;              // off water + river + road corridor
    if (registry.closestBuilding(new THREE.Vector3(x, 0, z), 12)) continue;
    ccx = x; ccz = z; ok = true; break;
  }
  if (!ok) return;
  // A tight clump of 3-5 mixed-size sites ("a crew camped out in the woods").
  const n = 3 + Math.floor(ctx.rng() * 3);
  const placed = [];
  for (let i = 0; i < n; i++) {
    const r = 4 + ctx.rng() * 5, a = ctx.rng() * Math.PI * 2;
    const x = ccx + Math.cos(a) * r, z = ccz + Math.sin(a) * r;
    // queryPoint.noBuild covers water/river; the authoritative nearestRoad check
    // (footprint-aware) keeps the tent body off the visible road ribbon — the thin
    // onRoad corridor test has an edge case that let tents onto roads (Gary 06-16).
    if (queryPoint(x, z).noBuild || nearestRoad(x, z).dist < ROAD_RIBBON_WIDTH / 2 + 4) continue;
    if (placed.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 36)) continue;   // 6m between tents
    if (registry.closestBuilding(new THREE.Vector3(x, 0, z), 3)) continue;
    const sr = ctx.rng();
    const size = sr < 0.5 ? 'small' : (sr < 0.85 ? 'medium' : 'large');
    placeSingleCampsite(ctx, x, z, size);
    placed.push({ x, z });
  }
}

// 4B.7 soft-buffer dressing: a sparse hedge of shrubs along each soft_buffer seam
// crossing this chunk (where a loud cluster abuts a quieter one). Each shrub is
// placed by the chunk that CONTAINS its position (ownership by-position → no
// double-placement) and seeded per-position off the seam hash, so the hedge is
// identical regardless of which chunk renders which part. Visual-only (soft bushes,
// no collider/registry), off roads/water. A loose line — a soft hint of separation,
// not a wall — and these are 1-draw pooled shrubs.
function placeSeamHedges(ctx) {
  const half = CHUNK_SIZE / 2;
  const minX = ctx.cxWorld - half, minZ = ctx.czWorld - half;
  const maxX = ctx.cxWorld + half, maxZ = ctx.czWorld + half;
  const hedges = seamHedgesNear(minX, minZ, maxX, maxZ);
  if (!hedges.length) return;
  const SPAN = 13, N = 6;                       // ~6 shrubs across a 13 m seam line
  for (const h of hedges) {
    for (let i = 0; i <= N; i++) {
      const sr = mulberry32(((h.seamHash ^ (i * 0x9E3779B1)) >>> 0) || 1);
      if (sr() < 0.3) { continue; }             // ~30% gaps → a loose hint, not a wall
      const t = (i / N - 0.5) * SPAN;
      const x = h.x + h.dirx * t + (sr() - 0.5) * 1.0;
      const z = h.z + h.dirz * t + (sr() - 0.5) * 1.0;
      if (x < minX || x >= maxX || z < minZ || z >= maxZ) continue;   // ownership: this chunk only
      if (isPointInLake(x, z)) continue;
      if (nearestRoad(x, z).dist < ROAD_RIBBON_WIDTH / 2 + 0.5) continue;
      const shrub = buildShrub(sr);
      shrub.position.set(x, 0, z);
      ctx.group.add(shrub);
    }
  }
}

// Shared dirt-path material for the drum access footpaths (matches the v1 grid
// path look). Tagged shared so chunk unload skips it.
const _DRUM_PATH_MAT = new THREE.MeshStandardMaterial({
  color: 0xb89570, roughness: 1, metalness: 0,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false,
});
_DRUM_PATH_MAT.userData.shared = true;

// A winding footpath from the nearest road into a drum circle's treed clearing —
// the v1 "discover the drum down a path in the woods" composition (forests.js
// buildForestPath), ported to the v2 district drums (which already sit in a
// tree-cleared pocket via drumClearingsNear). Built where the drum is dispatched,
// so it's owned by the drum's chunk (no double-placement); the wiggle is seeded off
// the drum position (NOT ctx.rng), so it can't shift the chunk's prop order. Skips
// when the drum is already roadside or no road is within reach. Narrower (3 m) than
// the 5 m arterial trails — a footpath, not a road.
function buildDrumAccessPath(ctx, dx, dz) {
  const nr = nearestRoad(dx, dz);
  if (nr.dist < 10 || nr.dist > 100) return;
  const ux = Math.cos(nr.dirAngle), uz = Math.sin(nr.dirAngle);          // drum → nearest road
  const ex = dx + ux * nr.dist, ez = dz + uz * nr.dist;                   // road entry point
  const startX = ex - ux * (ROAD_RIBBON_WIDTH / 2 + 0.5), startZ = ez - uz * (ROAD_RIBBON_WIDTH / 2 + 0.5);
  const clearR = (FESTIVAL_TUNING.KIND_FOOTPRINT.drum_circle || 6) + 1;
  const endX = dx + ux * clearR, endZ = dz + uz * clearR;                 // stop at the clearing edge, not the firepit
  const prng = mulberry32(worldHash(Math.round(dx), Math.round(dz), 0x9A7) >>> 0);
  const pathMesh = buildCurvedPath(startX, startZ, endX, endZ, 3, prng, _DRUM_PATH_MAT);
  pathMesh.name = 'drum_path';
  ctx.group.add(pathMesh);
}

// ---------- Porta-potties ----------
//
// Festival sanitation: banks of 1, 2, or 5 units placed near a gathering spot
// (stage, food plaza, drum circle, vendor row, camp village) but pushed off to
// the side, the way real festivals tuck them just past the crowd. Uses a fully
// salted RNG (POTTY_SALT) so it's independent of the chunk's prop stream.
//
// Per-theme: how likely a chunk gets a bank, and the {size: weight} mix. Themes
// not listed get none.
// Chances kept on the low side so a bank is a "there's the toilets" moment, not
// a fixture of every chunk. Sizes are the {group-size: weight} mix.
const POTTY_THEME = {
  main_stage:   { chance: 0.80, sizes: [[5, 0.6], [2, 0.4]] },
  side_stage:   { chance: 0.45, sizes: [[2, 0.5], [5, 0.3], [1, 0.2]] },
  tent_stage:   { chance: 0.55, sizes: [[2, 0.5], [5, 0.4], [1, 0.1]] },
  food_plaza:   { chance: 0.60, sizes: [[2, 0.45], [5, 0.35], [1, 0.2]] },
  vendor_row:   { chance: 0.35, sizes: [[2, 0.6], [1, 0.3], [5, 0.1]] },
  drum_circle:  { chance: 0.30, sizes: [[1, 0.5], [2, 0.5]] },
  camp_village: { chance: 0.70, sizes: [[5, 0.5], [2, 0.4], [1, 0.1]] },
  grove:        { chance: 0.10, sizes: [[1, 0.8], [2, 0.2]] },
  open_lawn:    { chance: 0.18, sizes: [[1, 0.7], [2, 0.3]] },
};

function pickPottyCount(prng, sizes) {
  const total = sizes.reduce((s, e) => s + e[1], 0);
  let r = prng() * total;
  for (const [n, w] of sizes) { r -= w; if (r <= 0) return n; }
  return sizes[0][0];
}

// The chunk's strongest gathering point (highest-weight attractor registered by
// the theme builder), or the chunk centre + a generous radius as a fallback.
function pickPottyAnchor(ctx) {
  let best = null, bestW = 0;
  for (const e of registry.byChunk(ctx.key)) {
    if (!e.attractor) continue;
    if (e.kind === 'path_node') continue;             // paths aren't gathering spots
    if (e.attractor.weight > bestW) { bestW = e.attractor.weight; best = e; }
  }
  if (best) return { x: best.position.x, z: best.position.z, r: best.attractor.radius };
  // No strong attractor (rare) — fall back to the chunk centre. Camp villages
  // normally land here via a campsite attractor (weight 0.5), so their bank
  // sits among the tents rather than at the geometric centre.
  return { x: ctx.cxWorld, z: ctx.czWorld, r: 10 };
}

function scatterPortaPotties(ctx, inWater) {
  if (inWater) return;
  const cfg = POTTY_THEME[ctx.theme];
  if (!cfg) return;
  const prng = mulberry32(worldHash(ctx.cx, ctx.cz, POTTY_SALT));
  if (prng() > cfg.chance) return;
  const count = pickPottyCount(prng, cfg.sizes);
  const anchor = pickPottyAnchor(ctx);

  // Try a few bearings/distances to find a clear spot just outside the anchor,
  // off the path cross, clear of buildings + water for the whole row.
  for (let attempt = 0; attempt < 16; attempt++) {
    const bearing = prng() * Math.PI * 2;
    const dist = anchor.r + 3.5 + prng() * 8;
    const bx = anchor.x + Math.cos(bearing) * dist;
    const bz = anchor.z + Math.sin(bearing) * dist;
    // Keep the bank inside this chunk's footprint and off the path stripes.
    if (Math.abs(bx - ctx.cxWorld) > CHUNK_SIZE * 0.5 ||
        Math.abs(bz - ctx.czWorld) > CHUNK_SIZE * 0.5) continue;
    if (Math.abs(bx - ctx.cxWorld) < 5 && Math.abs(bz - ctx.czWorld) < CHUNK_SIZE * 0.5) continue;
    if (Math.abs(bz - ctx.czWorld) < 5 && Math.abs(bx - ctx.cxWorld) < CHUNK_SIZE * 0.5) continue;
    // Doors face the anchor (people exit toward the crowd, approach from it).
    const yaw = Math.atan2(anchor.x - bx, anchor.z - bz);
    if (!pottyRowClear(bx, bz, yaw, count)) continue;
    buildPottyBank(ctx, prng, bx, bz, yaw, count);
    return;
  }
}

// Local +X in world for a given yaw — the row extends along this axis.
function _pottyRowRight(yaw) { return { rx: Math.cos(yaw), rz: -Math.sin(yaw) }; }

function pottyRowClear(bx, bz, yaw, count) {
  const { rx, rz } = _pottyRowRight(yaw);
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * POTTY_SPACING;
    const x = bx + rx * off, z = bz + rz * off;
    if (registry.closestBuilding(new THREE.Vector3(x, 0, z), 2.0)) return false;
    if (isPointInLake(x, z)) return false;
  }
  return true;
}

function buildPottyBank(ctx, prng, bx, bz, yaw, count) {
  const { rx, rz } = _pottyRowRight(yaw);
  const outX = Math.sin(yaw), outZ = Math.cos(yaw);   // door-outward (local +Z)
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * POTTY_SPACING;
    const x = bx + rx * off, z = bz + rz * off;
    const built = buildPortaPotty(prng);
    built.group.position.set(x, 0, z);
    built.group.rotation.y = yaw;
    ctx.group.add(built.group);

    const potty = createPottyState(built);
    potty.outX = outX;
    potty.outZ = outZ;
    registry.add({
      kind: 'porta_potty',
      position: new THREE.Vector3(x, 0, z),
      footprint: built.footprint,
      // Hard collider — a solid plastic box. Light damage (it's not a stage),
      // but it bonks. main.js reads `.potty` on the entry for the occupied gag.
      collider: { radius: POTTY_COLLIDER_R, damage: 4 },
      chunkKey: ctx.key,
      potty,
    });
  }
}

function buildVendorRow(ctx) {
  // Two parallel rows of tents along one axis. Tent canopies are ~3.2m
  // radius; tight spacing (~5m) keeps adjacent canopies nearly touching so
  // the row reads as a real market stall lineup, not isolated tents.
  const axisH = ctx.rng() < 0.5;
  const count = 5 + Math.floor(ctx.rng() * 3);
  const spacing = 5.0;
  const rowOffset = 7;
  for (let i = 0; i < count; i++) {
    for (const side of [-1, 1]) {
      const t = i - (count - 1) / 2;
      const x = ctx.cxWorld + (axisH ? t * spacing : side * rowOffset);
      const z = ctx.czWorld + (axisH ? side * rowOffset : t * spacing);
      const tent = buildTent(ctx.rng);
      tent.position.set(x, 0, z);
      tent.rotation.y = axisH ? (side < 0 ? 0 : Math.PI) : (side < 0 ? Math.PI / 2 : -Math.PI / 2);
      ctx.group.add(tent);

      registry.add({
        kind: 'tent',
        position: new THREE.Vector3(x, 0, z),
        footprint: 2.6,
        collider: { radius: 2.2, damage: 5 },
        attractor: { radius: 4, weight: 0.5 },
        chunkKey: ctx.key,
      });
    }
  }
}

function buildDrumCircle(ctx) {
  // A small fire pit + bench ring + a big drum, jittered around the chunk center.
  const x = ctx.cxWorld + (ctx.rng() - 0.5) * 8;
  const z = ctx.czWorld + (ctx.rng() - 0.5) * 8;
  buildDrumCircleAt(ctx, x, z);
}

// World-positioned drum circle (fire pit + proxy light + stones + djembe +
// polyrhythm music). The legacy theme centers it on the chunk; the worldgen
// scatter path places it at an arbitrary off-road point.
function buildDrumCircleAt(ctx, x, z) {
  // Fire (emissive)
  const fire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.6, 1),
    new THREE.MeshStandardMaterial({
      color: 0xff7733,
      emissive: 0xff5511,
      emissiveIntensity: 2.5,
      roughness: 0.8,
    })
  );
  fire.position.set(x, 0.6, z);
  ctx.group.add(fire);

  // Proxy PointLight — small chunk-level drum-circle pit. Single light per
  // cluster, modest intensity (the emissive fire mesh already carries the
  // visual; this just lets nearby props pick up some warm orange). PERF-
  // gated. Lifecycle is tied to the chunk: when the chunk unloads, the
  // group is removed from the scene and the light stops contributing.
  if (PERF.contextLights) {
    const proxy = new THREE.PointLight(0xff8540, 1.5, 12, 1.2);
    proxy.position.set(x, 1.0, z);
    proxy.castShadow = false;
    ctx.group.add(proxy);
    registerContextLight(proxy);
  }

  // Stones around fire
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const sx = x + Math.cos(ang) * 1.4;
    const sz = z + Math.sin(ang) * 1.4;
    const stone = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.3 + ctx.rng() * 0.15, 0),
      new THREE.MeshStandardMaterial({ color: 0x6a6a78, roughness: 1, flatShading: true })
    );
    stone.position.set(sx, 0.3, sz);
    // Tiny rocks — skip shadow casting (firepit emissive does the work).
    ctx.group.add(stone);
  }

  // Big djembe drum
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.55, 1.4, 14),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9, flatShading: true })
  );
  drum.position.set(x + 3, 0.7, z + 1);
  // Keep the drum itself off shadow casting too — the player walks past it
  // briefly, not worth a shadow draw per chunk.
  ctx.group.add(drum);

  registry.add({
    kind: 'drum_circle',
    position: new THREE.Vector3(x, 0, z),
    footprint: 1.5,
    collider: { radius: 1.2, damage: 4 },
    attractor: { radius: 12, weight: 2.2 },
    chunkKey: ctx.key,
  });

  // Polyrhythmic drum music, anchored at the fire pit. Lower pan height than
  // stages so it feels grounded.
  const drumSeed = worldHash(ctx.cx * 13 + 7, ctx.cz * 17 + 11);
  const handle = Sound.attachStageMusic(x, 1, z, drumSeed, 'drum');
  if (handle) stageMusic.push({ handle, chunkKey: ctx.key });
}

function buildGrove(ctx) {
  // Already covered by tree scattering — add a few hammocks (was 1-2, now 2-4)
  const count = 2 + Math.floor(ctx.rng() * 3);
  for (let i = 0; i < count; i++) {
    const x = ctx.cxWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE * 0.6);
    const z = ctx.czWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE * 0.6);
    if (Math.abs(x - ctx.cxWorld) < 6 && Math.abs(z - ctx.czWorld) < 6) continue;
    buildHammock(ctx, x, z);
  }
  // Pitch tents under the trees — treed groves should read as prime camping
  // ground, so most get sites and half of those become a tight clump ("a crew
  // of friends camped together"). Raised from 0.5/0.20 after Gary's 2026-06-16
  // playtest ("should see a lot more campsite clusters in forests like these").
  scatterChunkCampsites(ctx, { chance: 0.7, max: 2, clumpChance: 0.5 });
}

function buildOpenLawn(ctx) {
  // Picnic blankets — was 1-3, now 3-6 so open lawns read as bustling
  // festival commons instead of empty grass fields.
  const count = 3 + Math.floor(ctx.rng() * 4);
  for (let i = 0; i < count; i++) {
    const x = ctx.cxWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE * 0.7);
    const z = ctx.czWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE * 0.7);
    const colors = [0xff6f9c, 0xffd28a, 0x6fcf6a, 0x66d9ff, 0xb285ff, 0xff8a5b];
    const blanket = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshStandardMaterial({
        color: colors[Math.floor(ctx.rng() * colors.length)],
        roughness: 0.9,
        side: THREE.DoubleSide,
      })
    );
    blanket.rotation.x = -Math.PI / 2;
    blanket.position.set(x, 0.06, z);
    blanket.rotation.z = ctx.rng() * Math.PI * 2;
    ctx.group.add(blanket);

    registry.add({
      kind: 'picnic',
      position: new THREE.Vector3(x, 0, z),
      footprint: 0,
      attractor: { radius: 3, weight: 0.4 },
      chunkKey: ctx.key,
    });
  }
  // Open lawns are prime camping ground — most of them get a tent or two,
  // and ~30% upgrade to a tight 3-6 site clump (a "campground patch" out
  // in the open festival grass).
  scatterChunkCampsites(ctx, { chance: 0.65, max: 2, clumpChance: 0.30 });
}

// ---------- Festival-ground campsite scatter ----------
//
// Sprinkles 0-N small campsites across the chunk. Called from open_lawn /
// grove theme builders so the festival has tents pitched here and there in
// the open areas, not just inside forests.
//
// Skips positions near the chunk-grid path (so cars can still drive through)
// and near any registered building/stage/lake. Animatables (firepit + torch
// flicker) reuse the forestAnimatables list — naming aside, it's a generic
// "chunk-bound campsite animatables" sink.
function scatterChunkCampsites(ctx, { chance = 0.5, max = 2, clumpChance = 0 } = {}) {
  if (ctx.rng() > chance) return;
  // Roll for clump mode: 3-6 campsites tightly bunched around a single point
  // rather than scattered across the whole chunk. Reads as "a group of
  // friends pitched camp together" — a real campground vignette in the open
  // festival, not just isolated tents.
  const clump = clumpChance > 0 && ctx.rng() < clumpChance;
  if (clump) {
    placeCampsiteClump(ctx);
  } else {
    placeScatteredCampsites(ctx, 1 + Math.floor(ctx.rng() * max));
  }
}

function placeScatteredCampsites(ctx, count) {
  for (let i = 0; i < count; i++) {
    let chosen = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = ctx.cxWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE * 0.7);
      const z = ctx.czWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE * 0.7);
      // Stay off the chunk-grid path strip
      if (Math.abs(x - ctx.cxWorld) < 6 || Math.abs(z - ctx.czWorld) < 6) continue;
      if (registry.closestBuilding(new THREE.Vector3(x, 0, z), 4)) continue;
      chosen = { x, z };
      break;
    }
    if (!chosen) continue;
    placeSingleCampsite(ctx, chosen.x, chosen.z);
  }
}

// Place a tight cluster of 3-6 campsites around a single picked centre.
// Sites are arranged on a small ring (radius 6-9m) with random angle so
// they read as a cohesive group rather than a strict circle. Min 5m
// between sites to keep props from overlapping.
function placeCampsiteClump(ctx) {
  // Pick a clump centre off the path strip + clear of buildings.
  let centre = null;
  for (let attempt = 0; attempt < 14; attempt++) {
    const cx = ctx.cxWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE * 0.55);
    const cz = ctx.czWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE * 0.55);
    if (Math.abs(cx - ctx.cxWorld) < 12 || Math.abs(cz - ctx.czWorld) < 12) continue;
    if (registry.closestBuilding(new THREE.Vector3(cx, 0, cz), 14)) continue;
    centre = { x: cx, z: cz };
    break;
  }
  if (!centre) return;

  const siteCount = 3 + Math.floor(ctx.rng() * 4);   // 3-6 sites
  const placed = [];
  const MIN_SPACING = 5;
  for (let i = 0; i < siteCount; i++) {
    let chosen = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const a = ctx.rng() * Math.PI * 2;
      const r = 4 + ctx.rng() * 6;
      const x = centre.x + Math.cos(a) * r;
      const z = centre.z + Math.sin(a) * r;
      // Spacing check vs prior placements
      let tooClose = false;
      for (let j = 0; j < placed.length; j++) {
        const dx = placed[j].x - x, dz = placed[j].z - z;
        if (dx * dx + dz * dz < MIN_SPACING * MIN_SPACING) { tooClose = true; break; }
      }
      if (tooClose) continue;
      if (registry.closestBuilding(new THREE.Vector3(x, 0, z), 3)) continue;
      chosen = { x, z };
      break;
    }
    if (!chosen) continue;
    placeSingleCampsite(ctx, chosen.x, chosen.z);
    placed.push(chosen);
  }
}

function placeSingleCampsite(ctx, x, z, size = 'small') {
  const camp = buildCampsite(ctx.rng, size);
  camp.group.position.set(x, 0, z);
  camp.group.rotation.y = ctx.rng() * Math.PI * 2;
  ctx.group.add(camp.group);

  if (camp.animatables && camp.animatables.length > 0) {
    forestAnimatables.push({ chunkKey: ctx.key, animatables: camp.animatables });
  }

  registry.add({
    kind: 'campsite',
    position: new THREE.Vector3(x, 0, z),
    footprint: camp.footprint,
    attractor: { radius: 4, weight: 0.5 },
    chunkKey: ctx.key,
  });
}

// Camp village theme — packs 12–20 campsites of varying sizes into a green
// "cell" of the road grid. Paths run through every chunk's center (cxWorld,
// czWorld), so the cell bounded by 4 paths sits at a chunk CORNER, halfway
// between 4 adjacent chunk centers. We pick one of THIS chunk's 4 corners
// and pack campsites around it; the village ends up nestled in the grass
// square with paths along all 4 of its sides (this chunk's own E–W and N–S
// paths form 2 of the borders; the corresponding neighbor chunks' paths
// form the other 2).
//
// Sizes mix small/medium/large so the village has visible hierarchy —
// singletons among medium clusters with the occasional "big rig" large
// anchor (3-tent setup + extra chairs/torches per buildCampsite). Although
// the campsite groups visually extend into 3 neighbor chunks, they stay
// parented to THIS chunk's group so they unload as a unit when the chunk
// drops — no cross-chunk lifecycle to manage.
function buildCampVillage(ctx) {
  // Pick which of the 4 chunk corners hosts the village. ±1 maps the corner
  // to (cxWorld ± 40, czWorld ± 40), which is the centre of the cell that
  // sits between THIS chunk's path cross and the diagonally-adjacent
  // neighbor chunk's path cross.
  const cornerX = ctx.rng() < 0.5 ? -1 : 1;
  const cornerZ = ctx.rng() < 0.5 ? -1 : 1;
  const cellX = ctx.cxWorld + cornerX * (CHUNK_SIZE / 2);
  const cellZ = ctx.czWorld + cornerZ * (CHUNK_SIZE / 2);

  const target = 12 + Math.floor(ctx.rng() * 9);    // 12–20
  const placed = [];
  const MIN_SPACING = 5.5;
  // The four bordering paths run along x = cellX ± CHUNK_SIZE/2 and
  // z = cellZ ± CHUNK_SIZE/2 (i.e., the paths through the 4 surrounding
  // chunk centers). Keep campsites within ±RADIUS of the cell centre so
  // even with their footprint they stay off the paths. RADIUS = 30 leaves
  // ~10m clear between the outermost campsite edge and the path centerline.
  const RADIUS = 30;

  let attempts = 0;
  while (placed.length < target && attempts < target * 16) {
    attempts++;
    const x = cellX + (ctx.rng() - 0.5) * 2 * RADIUS;
    const z = cellZ + (ctx.rng() - 0.5) * 2 * RADIUS;
    if (registry.closestBuilding(new THREE.Vector3(x, 0, z), 4)) continue;
    let tooClose = false;
    for (const p of placed) {
      const dx = p.x - x, dz = p.z - z;
      if (dx * dx + dz * dz < MIN_SPACING * MIN_SPACING) { tooClose = true; break; }
    }
    if (tooClose) continue;
    // Size mix: 50% small, 35% medium, 15% large.
    const r = ctx.rng();
    const size = r < 0.50 ? 'small' : (r < 0.85 ? 'medium' : 'large');
    placeSingleCampsite(ctx, x, z, size);
    placed.push({ x, z });
  }
}


// ---------- Reusable builders ----------

// Pooled picnic-blanket geometry + a small color-keyed material cache (G1 — a few
// blankets sprinkled near each stage, like the chairs). userData.shared so chunk
// disposal skips them (footgun #6 / perf-pooling).
const BLANKET_GEO = new THREE.PlaneGeometry(2.6, 2.6);
BLANKET_GEO.userData.shared = true;
const BLANKET_COLORS = [0xff6f9c, 0xffd28a, 0x6fcf6a, 0x66d9ff, 0xb285ff, 0xff8a5b];
const _blanketMats = new Map();
function blanketMat(color) {
  let m = _blanketMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });
    m.userData.shared = true;
    _blanketMats.set(color, m);
  }
  return m;
}
function placePicnicBlanket(ctx, x, z) {
  const blanket = new THREE.Mesh(BLANKET_GEO, blanketMat(BLANKET_COLORS[Math.floor(ctx.rng() * BLANKET_COLORS.length)]));
  blanket.rotation.x = -Math.PI / 2;
  blanket.rotation.z = ctx.rng() * Math.PI * 2;
  blanket.position.set(x, 0.06, z);
  ctx.group.add(blanket);
  registry.add({ kind: 'picnic', position: new THREE.Vector3(x, 0, z), footprint: 0, attractor: { radius: 3, weight: 0.4 }, chunkKey: ctx.key });
}

function buildStage(ctx, x, z, isMain, yaw = 0) {
  // ----- Visual model — the deck, banner, truss, speakers, lights -----
  // Per-stage scale gives the festival real variety. Main stage gets a
  // mild boost (1.15-1.4) because it anchors spawn; side stages range from
  // 1.0 to 1.5x for more obvious differences. The coefficients are plan DATA
  // (D3.3): this draw MUST stay byte-identical to the planner's `stageScaleOf`
  // (festival.js) — same FESTIVAL_TUNING.STAGE_SCALE_* fields, same single
  // first-rng-draw structure — or the dancefloor rect would size a different
  // stage than the one built here.
  const T = FESTIVAL_TUNING;
  const scale = isMain
    ? T.STAGE_SCALE_MAJOR_BASE + ctx.rng() * T.STAGE_SCALE_MAJOR_SPAN
    : T.STAGE_SCALE_MINOR_BASE + ctx.rng() * T.STAGE_SCALE_MINOR_SPAN;
  const leafTex = isMain ? leafBannerTextures('#fff4d0', '#6fcf6a', '#ffd28a') : null;
  const stage = buildStageModel({ isMain, leafTexture: leafTex, rng: ctx.rng, scale });
  stage.group.position.set(x, 0, z);
  // The stage's audience side is local +Z (the crowd attractor sits in +Z). `yaw`
  // (0 in the legacy theme path → byte-identical; the worldgen anchor passes a
  // road-facing yaw) rotates the whole group — deck, banner, lights, beams, and
  // band all ride the group transform. Registry world positions below are NOT
  // children of the group, so they're rotated explicitly via `rot()` (the proven
  // buildTentStageTheme worldXZ pattern).
  stage.group.rotation.y = yaw;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const rot = (lx, lz) => ({ x: x + lx * cosY + lz * sinY, z: z - lx * sinY + lz * cosY });
  ctx.group.add(stage.group);

  const w = stage.deckWidth;
  const d = stage.deckDepth;
  const h = stage.deckHeight;
  // Track lens meshes for the day-night light show
  for (const lens of stage.stageLights) {
    stageLightLenses.push({ lens, chunkKey: ctx.key, baseColor: lens.material.color.getHex() });
  }
  // Track audience-facing spotlight beams. Store the stage's world position
  // so the spotlight pool can rank beams by distance to Zerble each frame.
  const stageWorldPos = new THREE.Vector3(x, 0, z);
  for (const b of stage.stageBeams) {
    stageBeamRefs.push({ ...b, chunkKey: ctx.key, scale, stageWorldPos });
  }

  // ----- Colliders: spheres INSCRIBED in the deck rectangle -----
  // Sphere radius scales with the stage so larger stages have proportionally
  // larger spheres (still inscribed, never extending past the visible deck).
  const sphereR = 2.5 * scale;
  const collDamage = isMain ? 14 : 9;
  const innerW = Math.max(0.001, w - sphereR * 2);
  const innerD = Math.max(0.001, d - sphereR * 2);
  // Use spacing of ~3.5m * scale so spheres overlap on bigger stages too.
  const cols = Math.max(2, Math.ceil(innerW / (3.5 * scale)) + 1);
  const rows = Math.max(2, Math.ceil(innerD / (3.5 * scale)) + 1);
  for (let cc = 0; cc < cols; cc++) {
    for (let rr = 0; rr < rows; rr++) {
      const lx = -innerW / 2 + (cc / (cols - 1)) * innerW;
      const lz = -innerD / 2 + (rr / (rows - 1)) * innerD;
      const w3 = rot(lx, lz);
      registry.add({
        kind: 'stage',
        position: new THREE.Vector3(w3.x, 1, w3.z),
        footprint: sphereR,
        collider: { radius: sphereR, damage: collDamage },
        chunkKey: ctx.key,
      });
    }
  }

  // Attractor in front of the stage so crowds gather there (scaled too).
  const frontW = rot(0, d / 2 + 6 * scale);
  registry.add({
    kind: 'stage_front',
    position: new THREE.Vector3(frontW.x, 0, frontW.z),
    footprint: 0,
    attractor: { radius: 14 * scale, weight: isMain ? 3.5 : 2.0 },
    chunkKey: ctx.key,
  });

  // Guaranteed audience — spawn NPCs directly in front of the stage instead
  // of relying on ambient-crowd attraction. Without this a stage can be
  // completely empty if ambient spawns happen to scatter away from it. The
  // audience fans out in a wide arc, denser near the front rail.
  if (ctx.crowd) {
    const audienceCount = isMain ? 22 : 12;
    const frontLocalZ = d / 2 + 4 * scale;   // audience band start, local +Z
    const arcWidth = 14 * scale;
    for (let i = 0; i < audienceCount; i++) {
      // Three-row fan: front row close, back rows further out. Random per-NPC
      // jitter so they don't look gridded.
      const row = i < audienceCount * 0.4 ? 0 : (i < audienceCount * 0.75 ? 1 : 2);
      const rowDist = 1.5 + row * 3.0;
      const u = (Math.random() - 0.5) * arcWidth;
      const v = Math.random() * 2.5;
      const ap = rot(u, frontLocalZ + rowDist + v);
      ctx.crowd.spawn({
        pos: new THREE.Vector3(ap.x, 0, ap.z),
        chunkKey: ctx.key,
        rng: ctx.rng,
      });
    }
  }

  // ----- Camp-chair clumps in the audience zone -----
  // Festival-goers sit in loose clumps behind the dancefloor — not lined up,
  // not at the front rail. The front "dancefloor" stays chair-free so people
  // can dance there. Layout: 3-5 clumps in a band beyond the dancefloor, each
  // clump 3-6 chairs facing the stage with a bit of rotation jitter so they
  // don't look soldier-straight.
  //
  // Zones (in stage-local +Z = "in front of stage"):
  //   Dancefloor (no chairs):  z + d/2  to  z + d/2 + dancefloorDepth
  //   Chair band:              z + d/2 + dancefloorDepth  to  z + d/2 + chairBandEnd
  //   Lateral spread: ±lateral from stage X axis
  const dancefloorDepth = 9 * scale;
  const chairBandStart = d / 2 + dancefloorDepth;
  const chairBandEnd = d / 2 + dancefloorDepth + 14 * scale;
  const lateralSpread = 11 * scale;
  const clumpCount = isMain ? 4 + Math.floor(ctx.rng() * 2) : 2 + Math.floor(ctx.rng() * 2);
  for (let ci = 0; ci < clumpCount; ci++) {
    // Clump center — random offset within the audience band.
    const clumpX = (ctx.rng() - 0.5) * lateralSpread * 2;
    const clumpZ = chairBandStart + ctx.rng() * (chairBandEnd - chairBandStart);
    const chairsInClump = 3 + Math.floor(ctx.rng() * 4);
    for (let chi = 0; chi < chairsInClump; chi++) {
      // Each chair sits within ~1.4m of the clump center.
      const chairOffX = (ctx.rng() - 0.5) * 2.8;
      const chairOffZ = (ctx.rng() - 0.5) * 2.0;
      // buildCampChair returns { group, color, footprint } — not the Group.
      const chair = buildCampChair(ctx.rng);
      const cw = rot(clumpX + chairOffX, clumpZ + chairOffZ);
      chair.group.position.set(cw.x, 0, cw.z);
      // Face the stage: stage is at -Z direction in this local frame, but
      // chair default faces +Z (per buildCampChair), so we rotate π. The whole
      // layout rides `yaw`, so the chair's facing is yaw + π + a small jitter.
      chair.group.rotation.y = yaw + Math.PI + (ctx.rng() - 0.5) * 0.7;
      ctx.group.add(chair.group);
      // Soft footprint so NPCs steer around the chair without big penalties.
      registry.add({
        kind: 'chair',
        position: new THREE.Vector3(cw.x, 0, cw.z),
        footprint: 0.5,
        chunkKey: ctx.key,
      });
    }
  }

  // ----- G1: a few picnic blankets sprinkled near the stage (not carpeted) -----
  const blanketCount = isMain ? 4 + Math.floor(ctx.rng() * 2) : 2 + Math.floor(ctx.rng() * 2);
  for (let bi = 0; bi < blanketCount; bi++) {
    const bw = rot((ctx.rng() - 0.5) * lateralSpread * 2.4, chairBandStart + ctx.rng() * (chairBandEnd - chairBandStart + 6 * scale));
    placePicnicBlanket(ctx, bw.x, bw.z);
  }

  // ----- C3: tiki torches marking the dancefloor boundary (4 at the corners) -----
  const torchWorld = [
    [-(lateralSpread + 2), d / 2 + 2], [(lateralSpread + 2), d / 2 + 2],
    [-(lateralSpread + 2), d / 2 + dancefloorDepth + 4], [(lateralSpread + 2), d / 2 + dancefloorDepth + 4],
  ].map(([lx, lz]) => { const w = rot(lx, lz); return { x: w.x, z: w.z }; });
  const stageTorches = buildTorchField(torchWorld, ctx.rng);
  ctx.group.add(stageTorches.group);
  if (stageTorches.animatables && stageTorches.animatables.length) {
    forestAnimatables.push({ chunkKey: ctx.key, animatables: stageTorches.animatables });
  }

  // ----- B (round-2): string lights across the dancefloor front (port the legacy
  // main-stage look — "the arch, then 3-4 rows of string lights"). Rows of
  // bulb-strung pole pairs span the dancefloor width at a few +Z depths, framing the
  // dancefloor the player spawns behind. Main stage gets the full set; side/tent
  // stages a lighter pair. Reuses placePolePair (poles chunkKey'd; per-call materials
  // freed on unload — disposal-safe).
  const lightRows = isMain ? 3 : 2;
  const lightSpan = lateralSpread + 3;                       // cables reach just past the dancefloor edge
  const lightZStart = d / 2 + 4;                             // just in front of the deck
  const lightZEnd = d / 2 + dancefloorDepth + 12 * scale;    // out across the dancefloor + front audience
  for (let li = 0; li < lightRows; li++) {
    const lz = lightRows === 1 ? lightZStart : lightZStart + (li * (lightZEnd - lightZStart)) / (lightRows - 1);
    const la = rot(-lightSpan, lz), lb = rot(lightSpan, lz);
    placePolePair(ctx, la.x, la.z, lb.x, lb.z);
  }

  // ----- Spatial music for this stage -----
  // Seed mixes chunk coords + stage flag so main vs side stages get distinct music.
  // Origin main stage stays on pure hash2 so its music + band layout don't
  // shift with the session seed — matches the chunk's pinned visual layout.
  const pinOrigin = isMain && ctx.cx === 0 && ctx.cz === 0;
  const stageHash = pinOrigin ? hash2 : worldHash;
  const musicSeed = stageHash(ctx.cx * 7 + (isMain ? 1 : 2), ctx.cz * 11 + (isMain ? 3 : 5));
  // Origin (0,0) main stage is always jam — deterministic across sessions.
  // Other main stages roll from a jam-weighted palette; side stages from a brass-weighted one.
  let stageStyle;
  if (pinOrigin) {
    stageStyle = 'jam';
  } else {
    const styleSeed = worldHash(ctx.cx * 7 + (isMain ? 1 : 2) + STYLE_SALT, ctx.cz * 11 + (isMain ? 3 : 5) + STYLE_SALT);
    stageStyle = isMain
      ? pickStageStyle(styleSeed, ['jam', 'jam', 'dance', 'world', 'dub'])
      : pickStageStyle(styleSeed, ['brass', 'brass', 'dance', 'world', 'dub']);
  }
  // The origin (0,0) main stage opens its first song at the closing section so
  // a freshly-spawned player hears the band finish and the crowd applaud within
  // ~10s — the festival's first applause moment. Other stages play full songs.
  const handle = Sound.attachStageMusic(x, 4, z, musicSeed, stageStyle,
    pinOrigin ? { introFinaleSeconds: 10 } : undefined);
  if (handle) stageMusic.push({ handle, chunkKey: ctx.key });

  // ----- The band on stage -----
  // Main stage gets a bigger ensemble (6 performers). Side stages get a trio.
  // placeBandOnStage adds the performers as children of stage.group at LOCAL
  // coords; we record world-space positions via stage.group's transform so the
  // animator can wiggle them around the stage's height/yaw.
  const instruments = isMain
    ? ['lead_vocal', 'guitar', 'guitar', 'bass', 'drum', 'sax']
    : ['lead_vocal', 'guitar', 'drum'];
  const performers = placeBandOnStage(stage.group, instruments, {
    deckWidth: w, deckDepth: d, deckHeight: h, rng: ctx.rng,
  });
  for (const performer of performers) {
    stagePerformers.push({
      group: performer,
      chunkKey: ctx.key,
      baseY: h,
      baseYaw: Math.PI,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

// EntranceArch wrapper — uses the model and registers post colliders.
function buildEntranceArch(ctx, x, z) {
  const arch = buildEntranceArchModel(leafBannerTextures('#fff4d0', '#ff6f9c', '#ffe066'));
  arch.position.set(x, 0, z);
  ctx.group.add(arch);

  registry.add({
    kind: 'arch',
    position: new THREE.Vector3(x - 6, 1, z),
    footprint: 0.8,
    collider: { radius: 1.0, damage: 4 },
    chunkKey: ctx.key,
  });
  registry.add({
    kind: 'arch',
    position: new THREE.Vector3(x + 6, 1, z),
    footprint: 0.8,
    collider: { radius: 1.0, damage: 4 },
    chunkKey: ctx.key,
  });
}

// Hammock wrapper — uses the model and registers the entry crowd.js consults.
function buildHammock(ctx, x, z, rng = ctx.rng) {
  const { group, seatPos, yaw } = buildHammockModel(x, z, rng);
  ctx.group.add(group);

  registry.add({
    kind: 'hammock',
    position: new THREE.Vector3(x, 0, z),
    footprint: 1.6,
    attractor: { radius: 3, weight: 0.6 },
    chunkKey: ctx.key,
    hammock: { seatPos, yaw, occupied: false },
  });
}

// Sandbox helper — back-compat with the old export shape (returns a Group).
export function buildHammockStandalone(x, z, rng = Math.random) {
  const { group } = buildHammockModel(x, z, rng);
  group.name = 'sandbox-hammock';
  return group;
}

function placePolePair(ctx, ax, az, bx, bz) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a1f3a, roughness: 0.7, flatShading: true });
  const h = 6;
  for (const [px, pz] of [[ax, az], [bx, bz]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, h, 8), poleMat);
    pole.position.set(px, h / 2, pz);
    // Slim lamppost — skip shadow casting.
    ctx.group.add(pole);
    registry.add({
      kind: 'lamppost',
      position: new THREE.Vector3(px, 0, pz),
      footprint: 0.5,
      collider: { radius: 0.4, damage: 2 },
      chunkKey: ctx.key,
    });
  }
  const startTop = new THREE.Vector3(ax, h - 0.1, az);
  const endTop = new THREE.Vector3(bx, h - 0.1, bz);
  const mid = startTop.clone().add(endTop).multiplyScalar(0.5);
  mid.y -= 0.6 + startTop.distanceTo(endTop) * 0.02;
  const curve = new THREE.QuadraticBezierCurve3(startTop, mid, endTop);

  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 12, 0.03, 4, false),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
  );
  ctx.group.add(cable);

  const bulbHues = [0xffd28a, 0xff6f9c, 0x8ecae6, 0x6fcf6a, 0xc77dff, 0xffd166];
  const bulbGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const count = 6;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const p = curve.getPoint(t);
    const hue = bulbHues[i % bulbHues.length];
    const bulb = new THREE.Mesh(
      bulbGeo,
      new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 1.2 })
    );
    bulb.position.copy(p);
    bulb.position.y -= 0.13;
    ctx.group.add(bulb);
  }
}

// ---------- Crowd spawning ----------

function spawnAmbientCrowd(ctx, count) {
  if (!ctx.crowd || count <= 0) return;

  // Collect attractors that live in this chunk so we can cluster crowds around them.
  const chunkAttractors = [];
  for (const e of registry.byChunk(ctx.key)) {
    if (e.attractor && e.attractor.weight >= 0.5) chunkAttractors.push(e);
  }

  for (let i = 0; i < count; i++) {
    let x, z;
    let tries = 0;
    let blocked;
    do {
      // 70% chance to spawn near an attractor (if any), 30% random in chunk
      if (chunkAttractors.length > 0 && ctx.rng() < 0.7) {
        const att = chunkAttractors[Math.floor(ctx.rng() * chunkAttractors.length)];
        const a = ctx.rng() * Math.PI * 2;
        const r = Math.sqrt(ctx.rng()) * att.attractor.radius;
        x = att.position.x + Math.cos(a) * r;
        z = att.position.z + Math.sin(a) * r;
      } else {
        x = ctx.cxWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE - 8);
        z = ctx.czWorld + (ctx.rng() - 0.5) * (CHUNK_SIZE - 8);
      }
      tries++;
      // Reject positions inside a lake's actual outline. Shore-attractor
      // spawns can land inside the water on lobed lakes; this catches them.
      blocked = registry.closestBuilding(new THREE.Vector3(x, 0, z), 1.5)
        || isPointInLake(x, z);
    } while (blocked && tries < 8);
    if (blocked) continue;   // 8 retries blocked → skip this slot rather than spawn in water

    ctx.crowd.spawn({
      pos: new THREE.Vector3(x, 0, z),
      chunkKey: ctx.key,
      rng: ctx.rng,
    });
  }
}
