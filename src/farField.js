// FarField — the render-only festival horizon (festival-horizon change).
//
// A PEER of ChunkManager/LakeManager owned by world.js, never another chunk
// ring: it draws batched far-distance silhouettes (roads, stage canopies, roof
// peaks; later trusses + night markers) from the same deterministic worldgen
// descriptors the real builders consume, and dissolves each proxy when its
// owning real chunk finishes building. It owns NOTHING gameplay-side: no
// registry entries, colliders, NPCs, audio, pickups, real lights, shadow
// casters, or per-prop animation, and it never calls a real cluster builder.
//
// This module currently contains the PURE planning core (group 1 of the
// change): compact record copying, deterministic selection, fixed-capacity
// nearest retention, versioned pending snapshots, and the enablement gate.
// The batched three.js pools land in group 2; nothing here may import 'three'
// until then, which keeps the core runnable in plain node for
// bin/test-far-field.
//
// Contracts this file is built around (design D1-D7, audit V2-V8):
// - Enablement is `farFieldRequested && USE_WORLDGEN_V2` (perf.js resolves
//   it); disabled means ZERO work — no allocation, no planning, no GPU
//   resources ever.
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

// Only worldgen imports here — chunks.js (and through it three.js) must stay
// out of this module until the group-2 pools land, so the pure core runs in
// plain node. ownerCellCoord's default cell size IS the 80m chunk rule.
import { ownerCellCoord } from './worldgen/placement.js';

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

// ---------- The world-facing peer (shell — pools land in group 2) ----------
//
// Constructed by world.js beside the chunk/lake managers. When `enabled` is
// false (the shipped default, or ?farField=1 forced off by ?worldgen=0) the
// constructor stores two booleans and RETURNS: no planner, no records, no
// arrays, no GPU resources, no shader programs — and update()/dispose() bail
// on the first line. bin/test-far-field locks this no-op shape.

export class FarField {
  constructor({ enabled, tier } = {}) {
    this.enabled = !!enabled;
    this.disposed = false;
    if (!this.enabled) return;
    this.tier = tier;                       // PERF.farField: radius/density/caps
    this.planner = new SnapshotPlanner();
    this.stats = { active: 0, overflow: 0, rebuilds: 0, superseded: 0 };
  }

  update() {
    if (!this.enabled || this.disposed) return;
    // Group 3 wires: boundary detection, planner stepping under the remaining
    // world-owned streaming deadline, handoff envelopes.
  }

  // Idempotent, owner-only teardown. Group 2 extends it to release the pools;
  // it must stay safe to call twice and touch nothing shared.
  dispose() {
    if (!this.enabled || this.disposed) return;
    this.disposed = true;
    this.planner = null;
  }
}
