// World registry: every "thing in the world" with a footprint, collider, or attractor.
// Crowd AI queries this for avoidance and points-of-interest. The collision system
// queries it for hard colliders.

import * as THREE from 'three';
import { SpatialGrid } from './spatialGrid.js';

let nextId = 1;

// A footprint wider than this (metres) is an outlier versus the ~2–16 m props
// that fill the broadphase grid (8 m cells). Routing it to the linear _bigFp
// list instead of the grid keeps the grid's query pad (_maxFp) small. A single
// lake footprint is ~143 m: left in the grid it pads EVERY footprintsNear query
// by 143 m, which at 8 m cells is a ~39×39-cell walk per query — measured at
// ~25% of frame time in per-NPC building avoidance, the grid's pruning erased.
// 16 m = 2 cells. Determinism is unaffected (queries still return a superset and
// the caller's exact test runs per entry); only the candidate-pruning changes.
const OVERSIZE_FP = 16;
const SPATIAL_CELL_SIZE = 8;

function physicalNumber(value, name, minimum = -Infinity) {
  if (!Number.isFinite(value) || value < minimum) throw new TypeError(`${name} must be finite and at least ${minimum}`);
  return value;
}

function physicalPosition(value) {
  return { x: physicalNumber(value?.x, 'position.x'), y: physicalNumber(value?.y === undefined ? 0 : value.y, 'position.y'), z: physicalNumber(value?.z, 'position.z') };
}

function physicalRotation(value) {
  if (value === undefined) return { x: 0, y: 0, z: 0, w: 1 };
  const q = Object.fromEntries(['x', 'y', 'z', 'w'].map(axis => [axis, physicalNumber(value?.[axis], `rotation.${axis}`)]));
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  if (!Number.isFinite(length) || length < 1e-12) throw new TypeError('rotation must have nonzero finite length');
  for (const axis of ['x', 'y', 'z', 'w']) q[axis] /= length;
  return q;
}

// Generation guards also use immutable placement IDs to distinguish shared
// camp grounds and containing forest owners. Copy the wrapper and geometry so
// callbacks cannot replace those IDs or mutate canonical position/colliders.
function geometryCopy(entry) {
  return { id: entry.id, kind: entry.kind, chunkKey: entry.chunkKey, campNeighborhood: entry.campNeighborhood,
    position: { x: entry.position.x, y: entry.position.y ?? 0, z: entry.position.z },
    footprint: entry.footprint,
    collider: entry.collider ? { radius: entry.collider.radius, damage: entry.collider.damage } : null };
}

export class Registry {
  constructor({ maxPhysicalEntries = 256 } = {}) {
    if (!Number.isSafeInteger(maxPhysicalEntries) || maxPhysicalEntries < 0) throw new TypeError('maxPhysicalEntries must be a nonnegative safe integer');
    this.entries = new Map(); // id -> entry
    this.byKind = new Map(); // kind -> Set<id>
    // Membership is fixed between add/remove; positions and attractor weights stay live.
    this._byChunk = new Map(); // chunkKey -> insertion-ordered Set<id>, including undefined/null
    this._attractors = new Map(); // id -> entry, in registry insertion order
    // Keep live add/remove indexing for same-pass worldgen guards. Frame sync
    // updates only changed cells; stable id order matches a full rebuild and
    // preserves collision first-hit order when a mover re-enters a bucket.
    const insertionOrder = (a, b) => a.id - b.id;
    this._fpGrid = new SpatialGrid(SPATIAL_CELL_SIZE, insertionOrder);
    this._colGrid = new SpatialGrid(SPATIAL_CELL_SIZE, insertionOrder);
    this._spatialState = new Map();
    this._maxFp = 0;   // largest GRID footprint radius — pads query reach
    this._maxCol = 0;  // largest collider radius — pads query reach
    // Oversized footprints (>= OVERSIZE_FP: lakes, big festival zones) kept OUT
    // of _fpGrid and scanned linearly by every footprint query. There are only a
    // handful resident, so the linear pass is far cheaper than letting one 143 m
    // lake inflate _maxFp and blow up every query's cell walk. _maxFp therefore
    // reflects only the small grid footprints, keeping the pad tight.
    this._bigFp = [];
    // Only enrolled props retain canonical geometry. Untouched scenery keeps
    // using the ordinary grids, rather than duplicating the whole world index.
    this._physical = new Map();
    this._physicalKeys = new Map();
    this._maxPhysicalEntries = maxPhysicalEntries;
    this._physicalGeneration = 0;
  }

  // Add an entry. Returns its id.
  // entry = {
  //   kind: 'stage' | 'tent' | 'truck' | 'tree' | 'lamppost' | 'arch' | 'puppet' | ...
  //   position: Vector3,
  //   footprint: number,        // radius NPCs should stay outside of
  //   collider?: { radius, damage } // optional hard collider for Zerble
  //   attractor?: { radius, weight } // optional "crowds congregate here" zone
  //   chunkKey?: string         // optional, used to unload with chunks
  // }
  add(entry) {
    const id = nextId++;
    entry.id = id;
    if (!entry.position) entry.position = new THREE.Vector3();
    this.entries.set(id, entry);
    if (!this.byKind.has(entry.kind)) this.byKind.set(entry.kind, new Set());
    this.byKind.get(entry.kind).add(id);
    if (!this._byChunk.has(entry.chunkKey)) this._byChunk.set(entry.chunkKey, new Set());
    this._byChunk.get(entry.chunkKey).add(id);
    if (entry.attractor) this._attractors.set(id, entry);
    // Keep the broadphase grids LIVE (see constructor): index this entry now so
    // same-pass worldgen guards (closestBuilding in chunks/forests/lakes) can
    // see it. _maxFp/_maxCol grow monotonically here — a larger pad only widens
    // the query superset, never makes it a subset, so the exact test downstream
    // stays correct; rebuildSpatialIndex resets them to the true max each frame.
    if (entry.footprint >= OVERSIZE_FP) {
      this._bigFp.push(entry);
    } else if (entry.footprint > 0) {
      this._fpGrid.insert(entry.position.x, entry.position.z, entry);
      if (entry.footprint > this._maxFp) this._maxFp = entry.footprint;
    }
    if (entry.collider) {
      this._colGrid.insert(entry.position.x, entry.position.z, entry);
      if (entry.collider.radius > this._maxCol) this._maxCol = entry.collider.radius;
    }
    this._spatialState.set(id, {
      x: entry.position.x, z: entry.position.z,
      footprint: entry.footprint >= OVERSIZE_FP ? 'big' : entry.footprint > 0 ? 'grid' : 'none',
      collider: !!entry.collider,
    });
    return id;
  }

  remove(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    const physical = this._physical.get(id);
    if (physical) { this._physical.delete(id); this._physicalKeys.delete(physical.key); }
    this.entries.delete(id);
    this.byKind.get(entry.kind)?.delete(id);
    const ownerIds = this._byChunk.get(entry.chunkKey);
    ownerIds.delete(id);
    if (ownerIds.size === 0) this._byChunk.delete(entry.chunkKey);
    this._attractors.delete(id);
    // A mover can be removed after its position changed but before frame sync.
    // Remove from its indexed cell, which need not be its live cell anymore.
    const indexed = this._spatialState.get(id);
    if (indexed.footprint === 'grid') this._fpGrid.remove(indexed.x, indexed.z, entry);
    if (indexed.footprint === 'big') {
      const bigIndex = this._bigFp.indexOf(entry);
      if (bigIndex !== -1) this._bigFp.splice(bigIndex, 1);
    }
    if (indexed.collider) this._colGrid.remove(indexed.x, indexed.z, entry);
    this._spatialState.delete(id);
  }

  byChunk(chunkKey) {
    const out = [];
    // Map uses SameValueZero, but the original lookup used === (NaN never matches).
    if (chunkKey !== chunkKey) return out;
    const ids = this._byChunk.get(chunkKey);
    if (ids) for (const id of ids) out.push(this.entries.get(id));
    return out;
  }

  removeChunk(chunkKey) {
    if (chunkKey !== chunkKey) return;
    const ids = this._byChunk.get(chunkKey);
    if (ids) for (const id of ids) this.remove(id);
  }

  enrollPhysical(id, key) {
    if (typeof key !== 'string' || !key) throw new TypeError('Physical key must be a nonempty string');
    const entry = this.entries.get(id);
    if (!entry) return { ok: false, reason: 'missing-entry' };
    if (this._physical.has(id)) return { ok: false, reason: 'already-enrolled' };
    if (this._physicalKeys.has(key)) return { ok: false, reason: 'duplicate-key' };
    if (this._physical.size === this._maxPhysicalEntries) return { ok: false, reason: 'physical-capacity' };
    const canonical = geometryCopy(entry);
    canonical.position = physicalPosition(entry.position);
    canonical.footprint = physicalNumber(entry.footprint ?? 0, 'footprint', 0);
    if (canonical.collider) {
      physicalNumber(canonical.collider.radius, 'collider.radius', 0);
      if (canonical.collider.damage !== undefined) physicalNumber(canonical.collider.damage, 'collider.damage');
    }
    if (this._physicalGeneration === Number.MAX_SAFE_INTEGER) return { ok: false, reason: 'generation-exhausted' };
    const generation = ++this._physicalGeneration;
    this._physical.set(id, { key, generation, canonical,
      pose: { position: { ...canonical.position }, rotation: physicalRotation() } });
    this._physicalKeys.set(key, id);
    return { ok: true, token: { id, key, generation } };
  }

  _physicalRecord(token) {
    const record = token && this._physical.get(token.id);
    return record && record.key === token.key && record.generation === token.generation ? record : null;
  }

  unenrollPhysical(token) {
    const record = this._physicalRecord(token);
    if (!record) return { ok: false, reason: 'stale-token' };
    this._physical.delete(token.id); this._physicalKeys.delete(record.key);
    return { ok: true };
  }

  publishPhysical(token, value) {
    const record = this._physicalRecord(token);
    if (!record) return { ok: false, reason: 'stale-token' };
    const entry = this.entries.get(token.id);
    // Validate the entire publication before changing a live entry or index.
    const position = physicalPosition(value?.pose?.position);
    const rotation = physicalRotation(value?.pose?.rotation);
    const footprint = physicalNumber(value && Object.prototype.hasOwnProperty.call(value, 'footprint') ? value.footprint : entry.footprint ?? 0, 'footprint', 0);
    let collider = entry.collider;
    if (value && Object.prototype.hasOwnProperty.call(value, 'colliderRadius')) {
      collider = value.colliderRadius === null ? null : { ...entry.collider, radius: physicalNumber(value.colliderRadius, 'colliderRadius', 0) };
    }
    entry.position.x = position.x; entry.position.y = position.y; entry.position.z = position.z;
    entry.footprint = footprint; entry.collider = collider;
    record.pose = { position, rotation };
    this._syncPhysicalEntry(entry);
    return { ok: true };
  }

  _syncPhysicalEntry(entry) {
    const indexed = this._spatialState.get(entry.id), x = entry.position.x, z = entry.position.z;
    const footprint = entry.footprint >= OVERSIZE_FP ? 'big' : entry.footprint > 0 ? 'grid' : 'none';
    const collider = !!entry.collider;
    const cellChanged = Math.floor(x / SPATIAL_CELL_SIZE) !== Math.floor(indexed.x / SPATIAL_CELL_SIZE) || Math.floor(z / SPATIAL_CELL_SIZE) !== Math.floor(indexed.z / SPATIAL_CELL_SIZE);
    if (cellChanged || footprint !== indexed.footprint) {
      if (indexed.footprint === 'grid') this._fpGrid.remove(indexed.x, indexed.z, entry);
      if (footprint === 'grid') this._fpGrid.insert(x, z, entry);
    }
    if (indexed.footprint === 'big' && footprint !== 'big') {
      const index = this._bigFp.indexOf(entry);
      if (index !== -1) this._bigFp.splice(index, 1);
    }
    if (indexed.footprint !== 'big' && footprint === 'big') {
      const index = this._bigFp.findIndex(other => other.id > entry.id);
      this._bigFp.splice(index === -1 ? this._bigFp.length : index, 0, entry);
    }
    if (cellChanged || collider !== indexed.collider) {
      if (indexed.collider) this._colGrid.remove(indexed.x, indexed.z, entry);
      if (collider) this._colGrid.insert(x, z, entry);
    }
    if (footprint === 'grid') this._maxFp = Math.max(this._maxFp, entry.footprint);
    if (collider) this._maxCol = Math.max(this._maxCol, entry.collider.radius);
    Object.assign(indexed, { x, z, footprint, collider });
  }

  transferOwner(id, newChunkKey) {
    if (newChunkKey !== undefined && newChunkKey !== null && typeof newChunkKey !== 'string') throw new TypeError('New chunk owner must be a string, null or undefined');
    const entry = this.entries.get(id);
    if (!entry) return { ok: false, reason: 'missing-entry' };
    if (entry.chunkKey === newChunkKey) return { ok: true };
    const oldIds = this._byChunk.get(entry.chunkKey);
    if (!oldIds?.has(id)) return { ok: false, reason: 'owner-index-mismatch' };
    // Preserve registry insertion order even when an older prop moves into a
    // bucket whose ordinary entries were added more recently.
    const newIds = new Set([...(this._byChunk.get(newChunkKey) ?? []), id].sort((a, b) => a - b));
    oldIds.delete(id);
    if (!oldIds.size) this._byChunk.delete(entry.chunkKey);
    this._byChunk.set(newChunkKey, newIds); entry.chunkKey = newChunkKey;
    return { ok: true };
  }

  physicalCounts() { return { enrolled: this._physical.size, capacity: this._maxPhysicalEntries }; }

  // Like the live broadphase methods, these visit candidate supersets and the
  // callback owns its exact distance test. The extra canonical scan is bounded
  // by maxPhysicalEntries and never visits an enrolled prop at its live pose.
  generationFootprintsNear(x, z, reach, fn) {
    this.footprintsNear(x, z, reach, entry => { if (!this._physical.has(entry.id)) fn(geometryCopy(entry)); });
    for (const { canonical } of this._physical.values()) if (canonical.footprint > 0) fn(geometryCopy(canonical));
  }

  generationCollidersNear(x, z, reach, fn) {
    this.collidersNear(x, z, reach, entry => { if (!this._physical.has(entry.id)) fn(geometryCopy(entry)); });
    for (const { canonical } of this._physical.values()) if (canonical.collider) fn(geometryCopy(canonical));
  }

  closestGenerationBuilding(pos, radius, excludeKinds = new Set(['tree'])) {
    let best = null, bestDist = Infinity;
    this.generationFootprintsNear(pos.x, pos.z, radius, entry => {
      if (!entry.footprint || excludeKinds.has(entry.kind)) return;
      const distance = Math.hypot(entry.position.x - pos.x, entry.position.z - pos.z) - entry.footprint;
      if (distance < radius && distance < bestDist) { best = entry; bestDist = distance; }
    });
    return best;
  }

  // ---- Queries ----

  // All hard colliders Zerble can run into.
  *colliders() {
    for (const e of this.entries.values()) {
      if (e.collider) yield { position: e.position, radius: e.collider.radius, damage: e.collider.damage, kind: e.kind };
    }
  }

  // Avoidance footprints for NPCs (things they should walk around).
  *footprints() {
    for (const e of this.entries.values()) {
      if (e.footprint > 0) yield { position: e.position, radius: e.footprint, kind: e.kind };
    }
  }

  // ---- Spatial broadphase ----

  // Scan live values for movers and radius changes, but leave unchanged cells
  // alone. Thousands of static shore/tree colliders no longer get cleared and
  // reinserted every frame. Big-footprint order and query pads still refresh.
  rebuildSpatialIndex() {
    this._bigFp.length = 0;
    let maxFp = 0, maxCol = 0;
    for (const e of this.entries.values()) {
      const indexed = this._spatialState.get(e.id);
      const x = e.position.x, z = e.position.z;
      const footprint = e.footprint >= OVERSIZE_FP ? 'big' : e.footprint > 0 ? 'grid' : 'none';
      const collider = !!e.collider;
      const cellChanged = Math.floor(x / SPATIAL_CELL_SIZE) !== Math.floor(indexed.x / SPATIAL_CELL_SIZE) ||
        Math.floor(z / SPATIAL_CELL_SIZE) !== Math.floor(indexed.z / SPATIAL_CELL_SIZE);
      if (cellChanged || footprint !== indexed.footprint) {
        if (indexed.footprint === 'grid') this._fpGrid.remove(indexed.x, indexed.z, e);
        if (footprint === 'grid') this._fpGrid.insert(x, z, e);
      }
      if (cellChanged || collider !== indexed.collider) {
        if (indexed.collider) this._colGrid.remove(indexed.x, indexed.z, e);
        if (collider) this._colGrid.insert(x, z, e);
      }
      if (footprint === 'big') this._bigFp.push(e);
      else if (e.footprint > maxFp) maxFp = e.footprint;
      if (collider && e.collider.radius > maxCol) maxCol = e.collider.radius;
      indexed.x = x; indexed.z = z;
      indexed.footprint = footprint; indexed.collider = collider;
    }
    this._maxFp = maxFp;
    this._maxCol = maxCol;
  }

  // Visit footprint-bearing entries that could reach within `reach` of (x, z).
  // `reach` is padded by the largest footprint radius so big entries (stages,
  // trucks) are never missed from a neighbouring cell — the visited set is a
  // superset; fn does the exact test. fn receives the RAW entry (read
  // e.position / e.footprint / e.kind). Localized equivalent of footprints().
  footprintsNear(x, z, reach, fn) {
    this._fpGrid.forEachNear(x, z, reach + this._maxFp, fn);
    // Oversized footprints aren't in the grid; visit them all (few resident).
    // fn does the exact distance test, so visiting a far one is harmless.
    for (let i = 0; i < this._bigFp.length; i++) fn(this._bigFp[i]);
  }

  // As above for collider-bearing entries (read e.position / e.collider / e.kind).
  collidersNear(x, z, reach, fn) {
    this._colGrid.forEachNear(x, z, reach + this._maxCol, fn);
  }

  // Attractors — POIs where crowds tend to congregate.
  *attractors() {
    for (const e of this._attractors.values()) {
      yield { position: e.position, radius: e.attractor.radius, weight: e.attractor.weight, kind: e.kind };
    }
  }

  // Nearest attractor to a position (for "what should I walk toward")
  pickAttractor(rng) {
    if (this._attractors.size === 0) return null;
    // Keep left-to-right addition/subtraction and one RNG draw; callers use pure RNGs.
    let totalW = 0;
    for (const e of this._attractors.values()) totalW += e.attractor.weight;
    let r = rng() * totalW;
    let chosen;
    for (const e of this._attractors.values()) {
      chosen = e;
      r -= e.attractor.weight;
      if (r <= 0) break;
    }
    return { position: chosen.position, radius: chosen.attractor.radius, weight: chosen.attractor.weight, kind: chosen.kind };
  }

  // Quick lookup: are there any building footprints within `radius` of pos?
  // Returns the closest one, or null. Excludes the 'tree' kind by default.
  //
  // Grid-accelerated: a candidate qualifies when hypot(d) - footprint < radius,
  // i.e. hypot < radius + footprint <= radius + _maxFp, so every possible hit
  // lives within (radius + _maxFp) of pos — exactly the cells forEachNear walks.
  // The visited set is a superset; the exact test below makes the result
  // identical to the old full scan over this.entries. (Tie-breaks may pick a
  // different equal-distance entry than the scan did, but every one of the ~21
  // call sites uses the result purely as a boolean guard, so that's invisible.)
  closestBuilding(pos, radius, excludeKinds = new Set(['tree'])) {
    let best = null;
    let bestDist = Infinity;
    const test = (e) => {
      if (!e.footprint || excludeKinds.has(e.kind)) return;
      const dx = e.position.x - pos.x;
      const dz = e.position.z - pos.z;
      const d = Math.hypot(dx, dz) - e.footprint;
      if (d < radius && d < bestDist) {
        bestDist = d;
        best = e;
      }
    };
    this._fpGrid.forEachNear(pos.x, pos.z, radius + this._maxFp, test);
    // Oversized footprints (lakes, big zones) live outside the grid — the guard
    // must still see them (e.g. don't place a tree inside a lake's circle).
    for (let i = 0; i < this._bigFp.length; i++) test(this._bigFp[i]);
    return best;
  }
}

// One shared registry for the whole game.
export const registry = new Registry();
