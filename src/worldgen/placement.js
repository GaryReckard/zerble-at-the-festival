// Placement — the pure, render-agnostic mapping from worldgen role/rank to "what
// props belong in this chunk" (deliberation Group D / D-B). It returns plain
// DESCRIPTORS; the 3D side (chunks.js) does build → position → registry.add. This
// module MUST stay pure: NO `three`, NO `models/*` import — that keeps the
// generator self-test + map-sandbox.html runnable and the 2D→3D boundary clean
// (Architect #3). Group B ships the skeleton (returns nothing) so the wiring can
// boot empty; Group D fills in the anchors + scatter.
//
// ── Determinism (footgun #4) ─────────────────────────────────────────────────
// All placement jitter draws from `cellRng(cx, cz, SALT.placement)` — a fresh
// 0x4D41_0A stream that does NOT collide with the worldgen salts or the chunks.js
// salts (theme=1, STYLE 0xC4FE7B2A, SPAWN_JUG 0x5A17B0BB, POTTY 0x9E3779B1).
//
// ── Keying: the (roleTier, heart.rank) TUPLE — two DISTINCT enums (R4) ─────────
//   roleTier   = 'core' | 'district' | 'outskirts'   (a DISTANCE BAND, roles.js)
//   heart.rank = 'minor' | 'major'                    (a SIZE CLASS, hearts.js)
// The table below keys on the tuple `${roleTier}×${rank}` — NEVER conflate the two
// axes (a switch on the wrong one silently places nothing and still passes the
// green self-test). Plus the heart-CENTER distinction (isHeartCenterChunk): a
// `core`-but-not-center chunk scatters; only the center chunk builds the anchor
// (R2 / D-C). That distinction is NOT in the table — it's the explicit test below.

import { CONFIG, SALT } from './constants.js';
import { cellRng, quantize } from '../rng.js';

// A placement descriptor (WORLD coords). chunks.js maps `kind` → buildX() → Group
// positioned at (x, 0, z), rotated by `yaw`, registered with `footprint`/etc.
//   { kind, x, z, yaw, footprint, role, rank, anchor }
// `anchor: true` marks the single per-heart structure owned by the center chunk.

// Role×rank → intended prop kinds. STUB (Group D fills the real placement logic +
// counts + offsets). Mirrors map-sandbox's tuned `wouldHost()` mapping.
export const ROLE_THEME = {
  'core×major':     { anchor: ['main_stage', 'food_court', 'vendor_rows'], scatter: ['vendor', 'porta_potty'] },
  'core×minor':     { anchor: ['side_stage'],                              scatter: ['food_truck', 'vendor'] },
  'district×major': { anchor: [],                                         scatter: ['campsite', 'drum_circle', 'porta_potty', 'vendor'] },
  'district×minor': { anchor: [],                                         scatter: ['campsite', 'vendor', 'porta_potty'] },
  'outskirts×major':{ anchor: [],                                         scatter: ['campsite'] },
  'outskirts×minor':{ anchor: [],                                         scatter: ['campsite'] },
};

export function roleKey(roleTier, rank) { return `${roleTier}×${rank}`; }

// The explicit "is this the chunk that OWNS the heart's anchor?" test (R2 / D-C):
// exactly the one chunk whose cell contains the heart center. A core chunk that is
// NOT the center must scatter only — never build a second anchor.
export function isHeartCenterChunk(heart, cx, cz, chunkSize) {
  if (!heart) return false;
  return Math.floor(heart.x / chunkSize) === cx && Math.floor(heart.z / chunkSize) === cz;
}

// Per-chunk placement descriptors. Group B: skeleton returns []. Group D will:
//  1. sample queryPoint/queryRegion over the chunk; for the heart-center chunk,
//     emit the anchor descriptors at the heart center (honoring noBuild/facing);
//  2. scatter the role×rank `scatter` kinds at jittered points where !noBuild,
//     re-deriving everything from worldgen math (never a registry lookup of the
//     possibly-unloaded anchor — R2 / D-C).
export function placeChunkProps(cx, cz, chunkSize = 80) {
  void cx; void cz; void chunkSize; void CONFIG; void SALT; void cellRng; void quantize; void ROLE_THEME;
  return [];
}
