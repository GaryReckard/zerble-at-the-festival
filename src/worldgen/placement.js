// Placement — the pure, render-agnostic mapping from worldgen role/rank to "what
// props belong in this chunk" (deliberation Group D / D-B). It returns plain
// DESCRIPTORS; the 3D side (chunks.js) does build → position → registry.add. This
// module MUST stay pure: NO `three`, NO `models/*` import — that keeps the
// generator self-test + map-sandbox.html runnable and the 2D→3D boundary clean
// (Architect #3). It MAY import sibling worldgen modules (queryPoint etc.) — they
// are pure data too. Group B shipped the skeleton (returns nothing); Group D fills
// in the anchors + scatter.
//
// ── Determinism (footgun #4) ─────────────────────────────────────────────────
// All placement jitter draws from `cellRng(cx, cz, SALT.placement)` — a fresh
// 0x4D41_0A stream that does NOT collide with the worldgen salts or the chunks.js
// salts (theme=1, STYLE 0xC4FE7B2A, SPAWN_JUG 0x5A17B0BB, POTTY 0x9E3779B1). The
// stream is consumed in a FIXED order per chunk (anchor sub-offsets, then the N
// scatter slots) so the same seed + chunk → the same descriptor list every time.
//
// ── Keying: the (roleTier, heart.rank) TUPLE — two DISTINCT enums (R4) ─────────
//   roleTier   = 'core' | 'district' | 'outskirts'   (a DISTANCE BAND, roles.js)
//   heart.rank = 'minor' | 'major'                    (a SIZE CLASS, hearts.js)
// The table below keys on the tuple `${roleTier}×${rank}` — NEVER conflate the two
// axes (a switch on the wrong one silently places nothing and still passes the
// green self-test). Plus the heart-CENTER distinction (isHeartCenterChunk): a
// `core`-but-not-center chunk scatters; only the center chunk builds the anchor
// (R2 / D-C). That distinction is NOT in the table — it's the explicit test below.

import { SALT } from './constants.js';
import { cellRng } from '../rng.js';
import { queryPoint } from './index.js';

// A placement descriptor (WORLD coords). chunks.js maps `kind` → buildX() → Group
// positioned at (x, 0, z), rotated by `yaw`, registered with `footprint`/etc.
//   { kind, x, z, yaw, footprint, role, rank, anchor }
// `anchor: true` marks a per-heart structure owned by the center chunk; `yaw` is a
// three.js Y-rotation (already converted from worldgen `facing`, see roadFacingYaw).

// Role×rank → intended prop kinds. `anchor` = the per-heart structures the CENTER
// chunk builds at (near) the heart center. `scatter` = the per-chunk palette every
// chunk draws from at jittered off-road points, scaled by role density. Mirrors the
// `wouldHost()` mapping tuned in map-sandbox, promoted to real placement (D-B).
export const ROLE_THEME = {
  'core×major':     { anchor: ['main_stage', 'food_court'], scatter: ['vendor', 'food_truck', 'porta_potty'] },
  'core×minor':     { anchor: ['side_stage'],               scatter: ['food_truck', 'vendor', 'porta_potty'] },
  'district×major': { anchor: [],                           scatter: ['campsite', 'drum_circle', 'vendor', 'porta_potty'] },
  'district×minor': { anchor: [],                           scatter: ['campsite', 'vendor', 'porta_potty'] },
  'outskirts×major':{ anchor: [],                           scatter: ['campsite'] },
  'outskirts×minor':{ anchor: [],                           scatter: ['campsite'] },
};

// Suggested clear-radius (m) per kind, for intra-chunk spacing rejection. chunks.js
// registers each prop with the MODEL's real footprint; this is only the spacing hint.
const KIND_FOOTPRINT = {
  main_stage: 10, side_stage: 8, food_court: 16,
  food_truck: 5, vendor: 3, porta_potty: 3, campsite: 4.5, drum_circle: 6,
};

// Per-role scatter density: how often a candidate slot actually places, and the
// per-chunk cap. Core reads busy; outskirts stays sparse (the "space between hearts"
// that makes a heart feel like arriving somewhere — hearts.js header).
const SCATTER_DENSITY = {
  core:      { prob: 0.62, max: 4 },
  district:  { prob: 0.48, max: 3 },
  outskirts: { prob: 0.14, max: 2 },
};

// Candidate scatter points sampled per chunk. Each costs ONE queryPoint call
// (nearestRoad-bound — memoized after warm-up); keep this small so the per-chunk
// sampler stays well under the 8ms R7 gate (Group C measured queryPoint warm
// <0.4ms). 10 candidates × <0.4ms ≈ <4ms warm.
const SCATTER_SLOTS = 10;

// Deterministic anchor sub-offsets from the heart center, per anchor kind beyond
// the primary stage (which sits AT the center). Bearings are jittered per heart so
// majors don't all look identical. Distances keep the court near but clear of the
// stage's audience zone.
const ANCHOR_OFFSET = { food_court: 30 };

export function roleKey(roleTier, rank) { return `${roleTier}×${rank}`; }

// worldgen `facing` (radians, atan2(Δz,Δx) pointing TOWARD the nearest road) → a
// three.js Y-rotation that turns a model's local +Z (its "front"/audience side)
// toward the road. Derivation: a group at yaw θ maps local +Z to world
// (sinθ, cosθ); setting that equal to (cos f, sin f) gives θ = π/2 − f.
function roadFacingYaw(facing, fallbackRng) {
  if (facing == null) return fallbackRng() * Math.PI * 2;
  return Math.PI / 2 - facing;
}

// The explicit "is this the chunk that OWNS the heart's anchor?" test (R2 / D-C):
// exactly the one chunk whose cell contains the heart center. A core chunk that is
// NOT the center must scatter only — never build a second anchor.
export function isHeartCenterChunk(heart, cx, cz, chunkSize) {
  if (!heart) return false;
  return Math.floor(heart.x / chunkSize) === cx && Math.floor(heart.z / chunkSize) === cz;
}

// Per-chunk placement descriptors (WORLD coords). `region` is the chunk's single
// queryRegion result (D-A / R7 — never re-query): `region.hearts` drives anchors,
// `queryPoint` (called for a bounded number of scatter slots) drives scatter.
//   1. For the heart whose CENTER is in this chunk, emit the anchor descriptors at
//      (near) the heart center, off `noBuild`, facing the nearest road.
//   2. Scatter the role×rank palette at jittered points where `!noBuild`, RE-DERIVING
//      role/rank from worldgen math at each point (never a registry lookup of the
//      possibly-unloaded anchor — R2 / D-C).
export function placeChunkProps(cx, cz, chunkSize = 80, region = null) {
  const out = [];
  const rng = cellRng(cx, cz, SALT.placement);
  const cxWorld = cx * chunkSize, czWorld = cz * chunkSize;
  // Points already claimed in this chunk (anchors first, then scatter) so later
  // placements keep their distance. Each: { x, z, r }.
  const claimed = [];
  const tooClose = (x, z, r) => claimed.some((c) => {
    const dx = c.x - x, dz = c.z - z;
    return dx * dx + dz * dz < (c.r + r) * (c.r + r);
  });

  // ── 1. Anchors — only the chunk that owns a heart center builds them ─────────
  const hearts = (region && region.hearts) || [];
  for (const heart of hearts) {
    if (!isHeartCenterChunk(heart, cx, cz, chunkSize)) continue;
    // The center is always 'core' (dist→0 < core for every rank). Key on the TUPLE.
    const theme = ROLE_THEME[roleKey('core', heart.rank)];
    if (!theme) continue;
    for (const kind of theme.anchor) {
      // The stage sits AT the center; other anchors (food court) sub-offset around it.
      let px = heart.x, pz = heart.z;
      if (ANCHOR_OFFSET[kind] != null) {
        const bearing = rng() * Math.PI * 2;
        px = heart.x + Math.cos(bearing) * ANCHOR_OFFSET[kind];
        pz = heart.z + Math.sin(bearing) * ANCHOR_OFFSET[kind];
      }
      const spot = nudgeOffNoBuild(px, pz, rng);
      if (!spot) continue;   // heart sits in unbuildable terrain (lake/road) all around — skip
      const qp = queryPoint(spot.x, spot.z);
      const fp = KIND_FOOTPRINT[kind] || 4;
      out.push({
        kind, x: spot.x, z: spot.z,
        yaw: roadFacingYaw(qp.facing, rng),
        footprint: fp, role: 'core', rank: heart.rank, anchor: true,
      });
      claimed.push({ x: spot.x, z: spot.z, r: fp });
    }
  }

  // ── 2. Scatter — every chunk, role/rank re-derived PER POINT ─────────────────
  let placed = 0;
  for (let i = 0; i < SCATTER_SLOTS; i++) {
    // Draw the jittered candidate FIRST (fixed rng order), then decide on it.
    const px = cxWorld + (rng() - 0.5) * (chunkSize - 6);
    const pz = czWorld + (rng() - 0.5) * (chunkSize - 6);
    const kindRoll = rng();     // consumed every slot so the stream stays in lockstep
    const probRoll = rng();

    const qp = queryPoint(px, pz);
    if (qp.noBuild) continue;                       // off road + off water (worldgen)
    const role = qp.roleTier;
    const dens = SCATTER_DENSITY[role];
    if (!dens || placed >= dens.max) continue;
    if (probRoll > dens.prob) continue;

    const rank = qp.heart ? qp.heart.rank : 'minor';   // heartless outskirts default
    const theme = ROLE_THEME[roleKey(role, rank)];
    const palette = theme && theme.scatter;
    if (!palette || palette.length === 0) continue;
    const kind = palette[Math.floor(kindRoll * palette.length)];
    const fp = KIND_FOOTPRINT[kind] || 4;
    if (tooClose(px, pz, fp)) continue;

    out.push({
      kind, x: px, z: pz,
      yaw: roadFacingYaw(qp.facing, rng),
      footprint: fp, role, rank, anchor: false,
    });
    claimed.push({ x: px, z: pz, r: fp });
    placed++;
  }

  return out;
}

// Nudge a point off `noBuild` (worldgen road corridor / lake). Tries the point
// itself, then a deterministic ring of offsets. Returns {x,z} or null if nowhere
// nearby is buildable (a fully lake/road-locked heart — rare; skip the anchor).
function nudgeOffNoBuild(x, z, rng) {
  if (!queryPoint(x, z).noBuild) return { x, z };
  const baseA = rng() * Math.PI * 2;
  for (let r = 10; r <= 30; r += 10) {
    for (let k = 0; k < 6; k++) {
      const a = baseA + (k / 6) * Math.PI * 2;
      const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
      if (!queryPoint(nx, nz).noBuild) return { x: nx, z: nz };
    }
  }
  return null;
}
