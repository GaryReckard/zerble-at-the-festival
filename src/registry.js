// World registry: every "thing in the world" with a footprint, collider, or attractor.
// Crowd AI queries this for avoidance and points-of-interest. The collision system
// queries it for hard colliders.

import * as THREE from 'three';
import { SpatialGrid } from './spatialGrid.js';

let nextId = 1;

export class Registry {
  constructor() {
    this.entries = new Map(); // id -> entry
    this.byKind = new Map(); // kind -> Set<id>
    // Broadphase grids for nearest-X queries, rebuilt once per frame by
    // rebuildSpatialIndex() (called from main.js). ~8m cells. Rebuilding from
    // live positions every frame keeps moving entries (Lurleen, drifting
    // hula-hoopers) correctly placed with nothing to invalidate. Query
    // accelerators only — they consume no rng, so determinism is untouched.
    this._fpGrid = new SpatialGrid(8);
    this._colGrid = new SpatialGrid(8);
    this._maxFp = 0;   // largest footprint radius — pads query reach
    this._maxCol = 0;  // largest collider radius — pads query reach
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
    return id;
  }

  remove(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.delete(id);
    this.byKind.get(entry.kind)?.delete(id);
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
    let maxFp = 0, maxCol = 0;
    for (const e of this.entries.values()) {
      if (e.footprint > 0) {
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
  closestBuilding(pos, radius, excludeKinds = new Set(['tree'])) {
    let best = null;
    let bestDist = Infinity;
    for (const e of this.entries.values()) {
      if (!e.footprint || excludeKinds.has(e.kind)) continue;
      const dx = e.position.x - pos.x;
      const dz = e.position.z - pos.z;
      const d = Math.hypot(dx, dz) - e.footprint;
      if (d < radius && d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }
}

// One shared registry for the whole game.
export const registry = new Registry();
