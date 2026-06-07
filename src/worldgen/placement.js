// Placement — the per-chunk FILTER over the festival POI layer (deliberation 002 /
// D2.5). The pure DECISION lives in `festival.js` (festivalPlan per heart +
// campVillagesNear); this picks the clusters whose CENTER falls in this chunk —
// "cluster-center ownership": the owning chunk builds + chunk-keys the whole
// cluster, which may spill into neighbours (exactly like the legacy camp village).
// chunks.js maps each returned descriptor's `kind` → buildX() → registry.add.
//
// MUST stay pure: NO `three`, NO `models/*` — keeps the self-test + map-sandbox.html
// runnable and the 2D→3D boundary clean (Architect #3).
//
// ── Determinism / window-invariance (R16/R18) ────────────────────────────────
// `festivalPlan(heart)` is (seed,epoch)-memoized and takes ONLY the heart;
// `campVillagesNear` is seeded off a coarse grid cell. Neither depends on the
// querying chunk, so the per-chunk WINDOW here only SELECTS — it never seeds. A
// cluster therefore can't appear/vanish based on which overlapping chunk asks.
// Ownership enumerates hearts by EXPANDING the chunk AABB by MAX_POI_REACH (the
// furthest a cluster center sits from its heart), so any cluster centered in this
// chunk is GUARANTEED to enumerate its owning heart — correct for any HEART_CELL,
// not relying on the heartsInBounds pad (R16, the Architect/Profiler synthesis).

import { festivalPlan, campVillagesNear, MAX_POI_REACH } from './festival.js';
import { heartsInBounds } from './hearts.js';

export function placeChunkProps(cx, cz, chunkSize = 80, region = null) {
  void region;   // ownership uses an explicit MAX_POI_REACH-expanded scan, not region.hearts (R16)
  const half = chunkSize / 2;
  const minX = cx * chunkSize - half, maxX = cx * chunkSize + half;
  const minZ = cz * chunkSize - half, maxZ = cz * chunkSize + half;
  // Half-open so a cluster on a chunk boundary belongs to exactly ONE chunk (no
  // double-build across the seam).
  const inChunk = (p) => p.x >= minX && p.x < maxX && p.z >= minZ && p.z < maxZ;
  const out = [];
  const ccx = cx * chunkSize, ccz = cz * chunkSize;
  // A cluster center in this chunk sits <= MAX_POI_REACH from its heart and <= half*√2
  // (the chunk's corner radius) from the chunk center, so its heart is within this of center.
  const reach = MAX_POI_REACH + half * Math.SQRT2;
  // Hearts whose festival could reach this chunk (center within MAX_POI_REACH).
  const hearts = heartsInBounds(minX - MAX_POI_REACH, minZ - MAX_POI_REACH, maxX + MAX_POI_REACH, maxZ + MAX_POI_REACH);
  for (const h of hearts) {
    // Skip the plan compute for hearts too far to drop a cluster in THIS chunk —
    // spreads the (memoized) per-heart plan cost across chunks instead of a boot spike.
    if (Math.hypot(h.x - ccx, h.z - ccz) > reach) continue;
    for (const p of festivalPlan(h)) if (inChunk(p)) out.push(p);
  }
  // Camp villages (coarse grid, independent of hearts) whose center is in this chunk.
  for (const v of campVillagesNear({ minX, minZ, maxX, maxZ })) if (inChunk(v)) out.push(v);
  return out;
}
