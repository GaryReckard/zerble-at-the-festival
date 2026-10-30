import { getSessionSeed } from '../rng.js';
import { worldgenEpoch } from '../worldgen/constants.js';
import { TERRAIN_STEP, TERRAIN_VERSION, terrainEnabled } from '../worldgen/terrain.js';
import { buildTerrainPatch } from './terrainProxy.js';

let serial = 0;
const HARD_CAPACITY = 256;
function capacity(value, name, maximum = HARD_CAPACITY) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new RangeError(`${name} must be an integer from 1 to ${maximum}`);
  return value;
}
function orderedBounds(bounds) {
  const values = ['minX', 'minZ', 'maxX', 'maxZ'].map(key => bounds?.[key]);
  if (!values.every(Number.isFinite) || values[0] >= values[2] || values[1] >= values[3]) {
    throw new RangeError('Terrain support bounds must be finite and have positive width and depth');
  }
  return Object.fromEntries(['minX', 'minZ', 'maxX', 'maxZ'].map((key, index) => [key, values[index]]));
}

export function sweptTerrainBounds({ from, to, radius }) {
  if (![from?.x, from?.z, to?.x, to?.z, radius].every(Number.isFinite) || radius <= 0) {
    throw new RangeError('Terrain sweep requires finite endpoints and a positive radius');
  }
  return orderedBounds({ minX: Math.min(from.x, to.x) - radius, minZ: Math.min(from.z, to.z) - radius,
    maxX: Math.max(from.x, to.x) + radius, maxZ: Math.max(from.z, to.z) + radius });
}

/**
 * Explicit support reservations, with no timer or separate streaming allowance.
 * Owners must retain their claim while a body can still rely on its ground.
 * Replacement keeps old support until every requested tile has been installed.
 */
export function createTerrainResidency(adapter, { tileSize = 20, maxTiles = 64, maxQueued = 16,
  maxOwners = 64, maxRetries = 3, prefix = 'terrain' } = {}) {
  if (!adapter || typeof adapter.addBody !== 'function' || typeof adapter.removeBody !== 'function') throw new TypeError('Terrain residency requires a physics adapter');
  if (!Number.isSafeInteger(tileSize / TERRAIN_STEP) || tileSize < TERRAIN_STEP || tileSize > TERRAIN_STEP * 4) {
    throw new RangeError('Terrain tileSize must be one to four production lattice cells');
  }
  capacity(maxTiles, 'maxTiles'); capacity(maxQueued, 'maxQueued'); capacity(maxOwners, 'maxOwners'); capacity(maxRetries, 'maxRetries', 8);
  if (typeof prefix !== 'string' || !prefix || prefix.length > 100) throw new TypeError('Terrain prefix must be a nonempty string of at most 100 characters');
  const namespace = `${prefix}:${++serial}`;
  const source = { seed: getSessionSeed(), enabled: terrainEnabled(), epoch: worldgenEpoch(), version: TERRAIN_VERSION };
  const tiles = new Map(), owners = new Map();
  let disposed = false, rejections = 0, lastRejection = null;
  const timing = { pumps: 0, attempts: 0, created: 0, preparationMs: 0, adapterMs: 0, maxUnitMs: 0, lastPumpMs: 0 };
  function live() { if (disposed) throw new Error('Terrain residency disposed'); }
  function sameSource() {
    if (source.seed !== getSessionSeed() || source.enabled !== terrainEnabled() || source.epoch !== worldgenEpoch()) {
      throw new Error('Terrain source changed; release or dispose existing terrain residency before rebuilding');
    }
  }
  function referenced(key) {
    for (const owner of owners.values()) if (owner.committed.has(key) || owner.wanted.has(key)) return true;
    return false;
  }
  function prune() {
    for (const [key, tile] of tiles) if (!referenced(key)) {
      if (tile.state === 'ready') adapter.removeBody(tile.id);
      tiles.delete(key);
    }
  }
  function commitReady() {
    for (const owner of owners.values()) if ([...owner.wanted].every(key => tiles.get(key)?.state === 'ready')) {
      owner.committed = new Set(owner.wanted);
    }
    prune();
  }
  function tileSnapshot(key) {
    const tile = tiles.get(key);
    return { key, state: tile.state, bounds: { ...tile.bounds }, attempts: tile.attempts,
      rejection: tile.rejection ? { ...tile.rejection } : null };
  }
  function status(ownerKey) {
    const owner = owners.get(ownerKey);
    if (!owner) return { owner: ownerKey, state: disposed ? 'disposed' : 'absent', tiles: [], supporting: [], pending: 0 };
    const desired = [...owner.wanted].map(tileSnapshot);
    const failed = desired.find(tile => tile.state === 'failed');
    const pending = desired.filter(tile => tile.state !== 'ready').length;
    return { owner: ownerKey, state: failed ? 'failed' : pending ? 'pending' : 'ready',
      tiles: desired, supporting: [...owner.committed].map(tileSnapshot), pending,
      rejection: failed?.rejection ?? null };
  }
  function reject(owner, reason) {
    rejections++;
    lastRejection = { owner, reason };
    return { ok: false, reason, previous: status(owner) };
  }
  function desiredTiles(bounds) {
    const b = orderedBounds(bounds);
    const x0 = Math.floor(b.minX / tileSize), x1 = Math.ceil(b.maxX / tileSize);
    const z0 = Math.floor(b.minZ / tileSize), z1 = Math.ceil(b.maxZ / tileSize);
    if (![x0, x1, z0, z1].every(value => Number.isSafeInteger(value * tileSize))) throw new RangeError('Terrain support bounds exceed precise tile coordinates');
    if (x1 <= x0 || z1 <= z0 || x1 - x0 > maxTiles || z1 - z0 > maxTiles || (x1 - x0) * (z1 - z0) > maxTiles) return null;
    const desired = new Map();
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
      const key = `${x},${z}`;
      desired.set(key, { minX: x * tileSize, minZ: z * tileSize, maxX: (x + 1) * tileSize, maxZ: (z + 1) * tileSize });
    }
    return desired;
  }
  function request(ownerKey, bounds) {
    live(); sameSource();
    if (typeof ownerKey !== 'string' || !ownerKey || ownerKey.length > 200) throw new TypeError('Terrain owner must be a nonempty string of at most 200 characters');
    if (!owners.has(ownerKey) && owners.size >= maxOwners) return reject(ownerKey, 'owner-capacity');
    const desired = desiredTiles(bounds);
    if (!desired) return reject(ownerKey, 'tile-capacity');
    const retained = new Set(desired.keys());
    for (const [key, owner] of owners) {
      for (const tile of owner.committed) retained.add(tile);
      if (key !== ownerKey) for (const tile of owner.wanted) retained.add(tile);
    }
    if (retained.size > maxTiles) return reject(ownerKey, 'tile-capacity');
    let queued = 0;
    for (const key of retained) {
      const tile = tiles.get(key);
      if (!tile || tile.state === 'pending' || (tile.state === 'failed' && desired.has(key))) queued++;
    }
    if (queued > maxQueued) return reject(ownerKey, 'queue-capacity');
    const owner = owners.get(ownerKey) ?? { committed: new Set() };
    owner.wanted = new Set(desired.keys());
    owners.set(ownerKey, owner);
    prune();
    for (const [key, bounds] of desired) {
      let tile = tiles.get(key);
      if (!tile) {
        tile = { id: `${namespace}:${key}`, bounds, state: 'pending', attempts: 0, rejection: null };
        tiles.set(key, tile);
      } else if (tile.state === 'failed') {
        tile.state = 'pending'; tile.attempts = 0; tile.rejection = null;
      }
    }
    commitReady();
    return { ok: true, ...status(ownerKey) };
  }
  function pump({ deadline, now, maxCreations } = {}) {
    live(); sameSource();
    if (!Number.isFinite(deadline) || typeof now !== 'function' || !Number.isSafeInteger(maxCreations) || maxCreations < 0 || maxCreations > HARD_CAPACITY) {
      throw new TypeError('Terrain pump requires a finite shared deadline, clock and bounded maxCreations');
    }
    const readTime = () => {
      const value = now();
      if (!Number.isFinite(value)) throw new TypeError('Terrain pump clock must return finite time');
      return value;
    };
    const started = readTime();
    let attempted = 0, created = 0, rejected = 0;
    const visited = new Set();
    while (attempted < maxCreations && readTime() < deadline) {
      const entry = [...tiles].find(([key, tile]) => tile.state === 'pending' && !visited.has(key));
      if (!entry) break;
      const [key, tile] = entry;
      visited.add(key); attempted++; timing.attempts++; tile.attempts++;
      const unitStart = readTime();
      let result;
      try {
        const patch = buildTerrainPatch(tile.bounds, { maxCells: (tileSize / TERRAIN_STEP) ** 2 });
        const prepared = readTime();
        timing.preparationMs += Math.max(0, prepared - unitStart);
        result = adapter.addBody({ id: tile.id, type: 'fixed', pose: { position: patch.origin },
          colliders: [{ shape: 'trimesh', vertices: patch.vertices, indices: patch.indices, friction: .7, collisionEvents: false }] });
        timing.adapterMs += Math.max(0, readTime() - prepared);
      } catch (error) { result = { ok: false, reason: 'terrain-create-failed', message: error.message }; }
      timing.maxUnitMs = Math.max(timing.maxUnitMs, Math.max(0, readTime() - unitStart));
      if (result.ok) {
        tile.state = 'ready'; tile.rejection = null; created++; timing.created++;
      } else {
        rejected++; rejections++;
        tile.rejection = { reason: result.reason, ...(result.message ? { message: result.message } : {}) };
        lastRejection = { tile: key, ...tile.rejection };
        if (tile.attempts >= maxRetries) tile.state = 'failed';
      }
      commitReady();
    }
    timing.pumps++;
    timing.lastPumpMs = Math.max(0, readTime() - started);
    return { attempted, created, rejected, ...stats() };
  }
  function release(ownerKey) {
    live();
    const removed = owners.delete(ownerKey);
    if (removed) prune();
    return removed;
  }
  function stats() {
    let ready = 0, pending = 0, failed = 0;
    for (const tile of tiles.values()) {
      if (tile.state === 'ready') ready++; else if (tile.state === 'pending') pending++; else failed++;
    }
    return { disposed, tiles: tiles.size, ready, pending, failed, owners: owners.size, rejections,
      source: { ...source }, tileSize, capacities: { tiles: maxTiles, queued: maxQueued, owners: maxOwners, retries: maxRetries },
      timing: { ...timing }, lastRejection: lastRejection ? { ...lastRejection } : null };
  }
  return Object.freeze({ request, requestSweep: (owner, sweep) => request(owner, sweptTerrainBounds(sweep)), pump, status, release, stats,
    dispose() {
      if (disposed) return;
      for (const tile of tiles.values()) if (tile.state === 'ready') adapter.removeBody(tile.id);
      tiles.clear(); owners.clear(); disposed = true;
    } });
}
