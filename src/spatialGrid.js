// Uniform spatial-hash grid — a runtime broadphase for "what's near (x, z)?"
// neighbourhood queries.
//
// This is a pure QUERY ACCELERATOR. It consumes no rng, feeds no world
// generation, and changes no placement, so determinism (see rng.js) is
// untouched. Callers still run the exact distance test inside the visit
// callback; the grid only prunes the candidate set from "every entry" to
// "entries in nearby cells". A query returns a SUPERSET of the true in-radius
// set — never a subset — so results match a full linear scan exactly.
//
// Cell key packs two integer cell coords into one number. It is 1:1 (no
// collisions, so forEachNear never double-visits an item) for |coord| < 32768
// cells — at our cell sizes that's tens of km from origin, far beyond any play
// session. Past that the pack can collide, which would only ever ADD extra
// candidates (still distance-tested) — it can't produce wrong results.

export class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this._inv = 1 / cellSize;
    this.cells = new Map(); // packed cell key -> array of items
  }

  _key(cx, cz) {
    // multiply+add (not `<< 16`) so the key stays a safe integer past 2^31.
    return (cx + 32768) * 65536 + (cz + 32768);
  }

  // Empty every bucket for reuse, and drop buckets that stayed empty last frame
  // so the Map can't grow unbounded as the player roams across new cells.
  // (Deleting during Map iteration is spec-safe.)
  clear() {
    for (const [k, arr] of this.cells) {
      if (arr.length) arr.length = 0;
      else this.cells.delete(k);
    }
  }

  insert(x, z, item) {
    const k = this._key(Math.floor(x * this._inv), Math.floor(z * this._inv));
    const arr = this.cells.get(k);
    if (arr) arr.push(item);
    else this.cells.set(k, [item]);
  }

  // Visit every item in the cells covering [pos ± radius]. The visited set is a
  // superset of the true in-radius set; `fn` is responsible for the exact
  // distance test.
  forEachNear(x, z, radius, fn) {
    const cr = Math.ceil(radius * this._inv);
    const cx = Math.floor(x * this._inv);
    const cz = Math.floor(z * this._inv);
    for (let iz = cz - cr; iz <= cz + cr; iz++) {
      for (let ix = cx - cr; ix <= cx + cr; ix++) {
        const arr = this.cells.get(this._key(ix, iz));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) fn(arr[i]);
      }
    }
  }
}
