import { CELL, BLOCK_METERS, MAX_BLOCKS, emptyBlock, mergeBlock, cellAddress, blockKey, revealPoints, finitePoint } from './model.js';
import { EpochChanged } from './storage.js';
export class Discovery {
  constructor(world, storage, onChange = () => {}) {
    this.world = world; this.storage = storage; this.onChange = onChange;
    this.blocks = new Map(); this.epoch = 0; this.token = 0; this.revision = 0;
    this.storageOK = true; this.closed = false; this.busy = false; this.loading = 0;
    this.ready = storage.epoch(world).then(epoch => { this.epoch = epoch; }).catch(() => { this.storageOK = false; });
  }
  changed() { this.revision++; this.onChange(); }
  async adoptEpoch() {
    const token = ++this.token;
    try { const epoch = await this.storage.epoch(this.world); if (!this.closed && token === this.token) { this.epoch = epoch; this.blocks.clear(); this.previous = null; this.changed(); } }
    catch { this.storageOK = false; }
  }
  ensure(key) {
    if (this.closed) return null;
    let block = this.blocks.get(key);
    if (block) { this.blocks.delete(key); this.blocks.set(key, block); return block; }
    if (this.blocks.size >= MAX_BLOCKS) {
      // Never evict unsaved durable work. Storage failure explicitly retains a
      // bounded recent session window rather than claiming unlimited history.
      const victim = [...this.blocks].find(([, b]) => !b.loading && (!b.dirty || !this.storageOK));
      if (!victim) return null;
      this.blocks.delete(victim[0]);
    }
    block = { ...emptyBlock(), dirty: false, loading: true, version: 0 };
    this.blocks.set(key, block); this.loading++;
    const token = this.token;
    this.ready.then(() => this.storageOK ? this.storage.read(this.world, key, this.epoch) : null).then(saved => {
      if (this.closed || token !== this.token || this.blocks.get(key) !== block) return;
      if (saved) Object.assign(block, mergeBlock(saved, block));
      block.loading = false; block.version++; this.changed();
    }).catch(error => {
      if (this.closed || token !== this.token) return;
      block.loading = false;
      if (error instanceof EpochChanged) void this.adoptEpoch();
      else { this.storageOK = false; this.changed(); }
    }).finally(() => { this.loading--; });
    return block;
  }
  loadBounds(bounds) {
    for (let z = Math.floor(bounds.minZ / BLOCK_METERS); z <= Math.floor(bounds.maxZ / BLOCK_METERS); z++)
      for (let x = Math.floor(bounds.minX / BLOCK_METERS); x <= Math.floor(bounds.maxX / BLOCK_METERS); x++) this.ensure(`${x},${z}`);
  }
  signature(tile) {
    const parts=[];
    for(let z=Math.floor(tile.z/BLOCK_METERS);z<=Math.floor((tile.z+tile.size-1)/BLOCK_METERS);z++)
      for(let x=Math.floor(tile.x/BLOCK_METERS);x<=Math.floor((tile.x+tile.size-1)/BLOCK_METERS);x++)parts.push(this.blocks.get(`${x},${z}`)?.version??-1);
    return `${this.token}:${parts.join(',')}`;
  }
  has(x, z) {
    const { key, index } = cellAddress(x, z), b = this.blocks.get(key);
    return !!(b && b.bits[index >> 3] & (1 << (index & 7)));
  }
  reveal(point) {
    if (!finitePoint(point) || this.closed) return;
    let changed = false;
    revealPoints(this.previous, point, (x, z) => {
      const {key,index} = cellAddress(x,z), b = this.blocks.get(key) || this.ensure(key);
      if (!b) return;
      const mask = 1 << (index & 7);
      if (!(b.bits[index >> 3] & mask)) { b.bits[index >> 3] |= mask; b.dirty = true; b.version++; changed = true; }
    });
    this.previous = {x:point.x,z:point.z};
    if (changed) this.changed();
  }
  remember(marker) {
    if (!finitePoint(marker) || !this.has(marker.x, marker.z)) return;
    const b = this.ensure(blockKey(marker.x,marker.z));
    if (b && !b.landmarks[marker.id]) { b.landmarks[marker.id] = {...marker}; b.dirty = true; b.version++; this.changed(); }
  }
  landmarks(bounds) {
    const out = [];
    for (const b of this.blocks.values()) for (const m of Object.values(b.landmarks)) {
      if (m.x>=bounds.minX&&m.x<=bounds.maxX&&m.z>=bounds.minZ&&m.z<=bounds.maxZ&&this.has(m.x,m.z)) out.push(m);
    }
    return out;
  }
  async flush() {
    if (this.busy || this.closed || !this.storageOK) return;
    this.busy = true;
    const token = this.token;
    try {
      await this.ready;
      // Also detects resets by another tab while this tab stands still.
      if (await this.storage.epoch(this.world) !== this.epoch) { await this.adoptEpoch(); return; }
      let count = 0;
      for (const [key,b] of this.blocks) {
        if (count >= 8 || this.closed || token !== this.token) break;
        if (!b.dirty || b.loading) continue;
        const version = b.version;
        const saved = await this.storage.write(this.world,key,mergeBlock(b),this.epoch);
        if (this.closed || token !== this.token) break;
        Object.assign(b,mergeBlock(saved,b));
        if (version === b.version) b.dirty = false;
        count++;
      }
    } catch(error) {
      if (token === this.token && !this.closed) {
        if (error instanceof EpochChanged) await this.adoptEpoch();
        else { this.storageOK = false; this.changed(); }
      }
    } finally { this.busy = false; }
  }
  async reset() {
    const token = ++this.token;
    this.blocks.clear(); this.previous = null; this.changed();
    try { await this.ready; const epoch = await this.storage.reset(this.world); if (!this.closed && token === this.token) this.epoch = epoch; }
    catch { this.storageOK = false; }
  }
  snapshot() { return {blocks:this.blocks.size,dirty:[...this.blocks.values()].filter(b=>b.dirty).length,loading:this.loading,storageOK:this.storageOK,epoch:this.epoch}; }
  dispose() { this.closed = true; this.token++; this.storage.close(); this.blocks.clear(); }
}
