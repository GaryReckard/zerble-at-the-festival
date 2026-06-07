// Forests / tree-density (deliberation CG4, reworked per Gary 2026-06-06).
//
// Forests are a GAP-FILLING layer derived AFTER the structure (hearts, roads,
// lakes), not before. They are organic (domain-warped multi-octave noise →
// irregular blobs, not circles), cleared at festival cores, ramping in through
// districts, and they grow a tree-ring hugging each lobed lakeshore — with
// causeway GAPS so campsites + the shore path stay reachable. Roads draw on top
// in the sandbox, so they read as paths threading through the woods.
//
// This is a render/role field (never hashed downstream), so float noise is fine.
// Reads CONFIG.* per-call; relies on memoized heart/lake cells for speed.

import { worldHash } from '../rng.js';
import { CONFIG, SALT, heartNeighborhoodCells } from './constants.js';
import { nearestHeart } from './hearts.js';
import { lakeAt, nearestLake } from './water.js';

function vnoise(x, z, cell, salt) {
  const gx = Math.floor(x / cell), gz = Math.floor(z / cell);
  const fx = x / cell - gx, fz = z / cell - gz;
  const c = (ix, iz) => worldHash(ix, iz, salt) / 4294967296;
  const n00 = c(gx, gz), n10 = c(gx + 1, gz), n01 = c(gx, gz + 1), n11 = c(gx + 1, gz + 1);
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = n00 + (n10 - n00) * sx, b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sz;
}

// Domain-warped 2-octave woodland noise — gives organic, lobed forest masses
// instead of grid-aligned or circular ones.
function organic(x, z) {
  const cell = CONFIG.DENSITY_CELL;
  const wx = vnoise(x + 1234, z - 987, cell * 2.4, SALT.density ^ 0x11) * 2 - 1;
  const wz = vnoise(x - 555, z + 777, cell * 2.4, SALT.density ^ 0x22) * 2 - 1;
  const ox = x + wx * cell * 0.85, oz = z + wz * cell * 0.85;   // warp
  return vnoise(ox, oz, cell, SALT.density) * 0.66
       + vnoise(ox, oz, cell * 0.45, SALT.density ^ 0x33) * 0.34;
}

// Tree-ring around the nearest lake, hugging its (lobed) shore, with ~30% of the
// angular sectors left as causeway gaps (shore access for camps + the path).
function lakeRingBoost(x, z) {
  const { lake, dist } = nearestLake(x, z);
  if (!lake) return 0;
  const band = CONFIG.LAKE_RING_BAND;               // ring width beyond the shore
  // shore radius at this angle (sample the lobed outline)
  const ang = Math.atan2(z - lake.z, x - lake.x);
  const idx = (Math.round(((ang + Math.PI) / (Math.PI * 2)) * lake.outline.length)) % lake.outline.length;
  const v = lake.outline[idx];
  const shoreR = Math.hypot(v.x - lake.x, v.z - lake.z);
  if (dist <= shoreR || dist > shoreR + band) return 0;
  const sector = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 8) & 7;
  const gap = (worldHash(lake.cx, lake.cz, SALT.density ^ (0x100 + sector)) >>> 0) / 4294967296;
  if (gap < 0.30) return 0;                          // causeway sector
  return 0.62 * (1 - (dist - shoreR) / band);        // dense at shore, fading out
}

export function treeDensity(x, z) {
  if (lakeAt(x, z)) return 0;                         // no trees on water

  // organic woodland, thresholded so the blob EDGES are irregular (not a wash)
  const thr = CONFIG.DENSITY_THRESHOLD;
  let f = Math.max(0, (organic(x, z) - thr) / Math.max(0.05, 1 - thr));

  // gap-fill: cleared at a heart core, ramping back in across its district.
  // Use the DERIVED window — a major district (1000m) exceeds a 2-cell window,
  // and a too-small window drops the district ramp near big hubs (visible
  // forest discontinuity). Memoized cells keep this cheap per-pixel.
  const { heart, dist } = nearestHeart(x, z, heartNeighborhoodCells());
  if (heart) {
    if (dist < heart.core) f = 0;
    else if (dist < heart.district) f *= (dist - heart.core) / (heart.district - heart.core);
  }

  f = Math.max(f, lakeRingBoost(x, z));              // keep the lakeshore trees
  return f > 1 ? 1 : f;
}
