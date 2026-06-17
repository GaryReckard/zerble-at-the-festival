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

export class Registry {
  constructor() {
    this.entries = new Map(); // id -> entry
    this.byKind = new Map(); // kind -> Set<id>
    // Broadphase grids for nearest-X queries. Maintained TWO ways, both needed:
    //   - LIVE on add()/remove() — so a worldgen query (closestBuilding) sees
    //     buildings added earlier in the SAME generation pass, and a chunk that
    //     unloads mid-frame leaves no phantom behind. Static buildings never
    //     move between add and remove, so incremental maintenance is exact.
    //   - REBUILT once per frame by rebuildSpatialIndex() (from main.js) — so
    //     moving entries (Lurleen, drifting hula-hoopers) re-index from their
    //     live positions with nothing to invalidate, and _maxFp/_maxCol reset
    //     to the exact frame max.
    // ~8m cells. Query accelerators only — they consume no rng, so determinism
    // is untouched; closestBuilding returns the same set a full scan would.
    this._fpGrid = new SpatialGrid(8);
    this._colGrid = new SpatialGrid(8);
    this._maxFp = 0;   // largest GRID footprint radius — pads query reach
    this._maxCol = 0;  // largest collider radius — pads query reach
    // Oversized footprints (>= OVERSIZE_FP: lakes, big festival zones) kept OUT
    // of _fpGrid and scanned linearly by every footprint query. There are only a
    // handful resident, so the linear pass is far cheaper than letting one 143 m
    // lake inflate _maxFp and blow up every query's cell walk. _maxFp therefore
    // reflects only the small grid footprints, keeping the pad tight.
    this._bigFp = [];
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
    return id;
  }

  remove(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.delete(id);
    this.byKind.get(entry.kind)?.delete(id);
    // Mirror add(): drop it from the live grids so a chunk unloading mid-frame
    // can't leave a phantom for a later same-frame query. Static buildings don't
    // move, so e.position addresses the same cell it was inserted into; movers
    // get fully re-indexed by rebuildSpatialIndex() next frame regardless.
    if (entry.footprint >= OVERSIZE_FP) {
      const i = this._bigFp.indexOf(entry);
      if (i !== -1) { this._bigFp[i] = this._bigFp[this._bigFp.length - 1]; this._bigFp.pop(); }
    } else if (entry.footprint > 0) {
      this._fpGrid.remove(entry.position.x, entry.position.z, entry);
    }
    if (entry.collider) this._colGrid.remove(entry.position.x, entry.position.z, entry);
  }

  byChunk(chunkKey) {
    const out = [];
    for (const e of this.entries.values()) {
      if (e.chunkKey === chunkKey) out.push(e);
    }
    return out;
  }

  removeChunk(chunkKey) {
    for (const e of [...this.entries.values()]) {
      if (e.chunkKey === chunkKey) this.remove(e.id);
    }
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

  // ---- Spatial broadphase (rebuilt once per frame) ----

  // Re-index every footprint/collider entry from its CURRENT position. O(n),
  // called once per frame from main.js before any consumer (crowd steering,
  // kid push-out, Zerble collision). Cheap vs. the per-NPC full scans it
  // replaces, and rebuilding from live positions means moving entries need no
  // invalidation bookkeeping.
  rebuildSpatialIndex() {
    this._fpGrid.clear();
    this._colGrid.clear();
    this._bigFp.length = 0;
    let maxFp = 0, maxCol = 0;
    for (const e of this.entries.values()) {
      if (e.footprint >= OVERSIZE_FP) {
        this._bigFp.push(e);
      } else if (e.footprint > 0) {
        this._fpGrid.insert(e.position.x, e.position.z, e);
        if (e.footprint > maxFp) maxFp = e.footprint;
      }
      if (e.collider) {
        this._colGrid.insert(e.position.x, e.position.z, e);
        if (e.collider.radius > maxCol) maxCol = e.collider.radius;
      }
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
    for (const e of this.entries.values()) {
      if (e.attractor) yield { position: e.position, radius: e.attractor.radius, weight: e.attractor.weight, kind: e.kind };
    }
  }

  // Nearest attractor to a position (for "what should I walk toward")
  pickAttractor(rng) {
    const ats = [...this.attractors()];
    if (ats.length === 0) return null;
    // Weighted random
    const totalW = ats.reduce((s, a) => s + a.weight, 0);
    let r = rng() * totalW;
    for (const a of ats) {
      r -= a.weight;
      if (r <= 0) return a;
    }
    return ats[ats.length - 1];
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
