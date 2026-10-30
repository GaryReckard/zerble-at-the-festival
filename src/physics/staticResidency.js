import { terrainHeight } from '../worldgen/terrain.js';

let serial = 0;
const HARD_CAPACITY = 512;
const MAX_BOUNDS_SPAN = 256;
const DEFAULT_KINDS = new Set([
  'arch', 'bench_ring', 'camp_chair', 'camp_cooler', 'camp_loveseat', 'camp_tent', 'camp_torch', 'campfire',
  'drum_circle', 'firepit', 'forest_drum_circle', 'forest_tree', 'hammock', 'info_kiosk', 'lake_edge', 'lamppost',
  'picnic', 'picnic_table', 'porta_potty', 'soundboard', 'stage', 'stage_front', 'tent', 'tree', 'truck',
]);
const DYNAMIC_KINDS = new Set(['kid', 'lurleen', 'nut_wagon', 'one_wheel', 'person', 'puppet', 'wook']);

function bounded(value, name, maximum = HARD_CAPACITY) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new RangeError(`${name} must be an integer from 1 to ${maximum}`);
  return value;
}

function orderedBounds(bounds) {
  const values = [bounds?.minX, bounds?.maxX, bounds?.minZ, bounds?.maxZ];
  if (!values.every(value => Number.isFinite(value) && Number.isFinite(Math.fround(value))) || values[0] >= values[1] || values[2] >= values[3]) {
    throw new RangeError('Static proxy bounds must be finite and have positive width and depth');
  }
  if (values[1] - values[0] > MAX_BOUNDS_SPAN || values[3] - values[2] > MAX_BOUNDS_SPAN) {
    throw new RangeError(`Static proxy bounds cannot exceed ${MAX_BOUNDS_SPAN} metres per side`);
  }
  return { minX: values[0], maxX: values[1], minZ: values[2], maxZ: values[3] };
}

function intersectsBounds(x, z, radius, bounds) {
  const dx = Math.max(bounds.minX - x, 0, x - bounds.maxX);
  const dz = Math.max(bounds.minZ - z, 0, z - bounds.maxZ);
  return dx * dx + dz * dz <= radius * radius;
}

function stableNumber(value, name) {
  if (!Number.isFinite(value) || !Number.isFinite(Math.fround(value))) throw new TypeError(`${name} must be finite`);
  return Object.is(value, -0) ? 0 : value;
}

function snapshot(entry) {
  const id = entry?.id;
  if (!Number.isSafeInteger(id) || id < 0) throw new TypeError('Static collider entries need a nonnegative safe integer id');
  const x = stableNumber(entry.position?.x, 'entry.position.x');
  const z = stableNumber(entry.position?.z, 'entry.position.z');
  const radius = stableNumber(entry.collider?.radius, 'entry.collider.radius');
  if (radius <= 0) throw new TypeError('Static collider radius must be positive');
  if (typeof entry.kind !== 'string' || !entry.kind || entry.kind.length > 80) throw new TypeError('Static collider kind must be a nonempty string of at most 80 characters');
  const kind = entry.kind, y = stableNumber(terrainHeight(x, z), 'terrainHeight');
  const signature = JSON.stringify([id, kind, x, y, z, radius]);
  const halfHeight = Math.max(.5, radius);
  return { key: signature, entryId: id, kind, x, y, z, radius, halfHeight,
    bounds: { minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius } };
}

function copyProxy(proxy) {
  return { key: proxy.key, entryId: proxy.entryId, kind: proxy.kind, state: proxy.state,
    position: { x: proxy.x, y: proxy.y, z: proxy.z }, radius: proxy.radius,
    halfHeight: proxy.halfHeight, attempts: proxy.attempts,
    rejection: proxy.rejection ? { ...proxy.rejection } : null };
}

/**
 * Bounded mirror of nearby static registry colliders for live physics movers.
 * Each source collider becomes a ground-anchored cylinder with its registered
 * horizontal radius and a conservative 2×radius vertical extent (minimum 1 m).
 * This intentionally approximates the source shape; it does not mirror moving
 * objects, source height, authored rotations, or detailed meshes.
 */
export function createStaticResidency({ registry, adapter, isDynamic, kinds = DEFAULT_KINDS,
  maxProxies = 128, maxOwners = 32, maxQueued = 64, maxCandidates = 256, maxRetries = 3,
  prefix = 'static-prop' } = {}) {
  if (!(registry?.collidersNear instanceof Function) || !(registry.entries instanceof Map)) throw new TypeError('Static residency requires a registry with entries and collidersNear');
  if (typeof adapter?.addBody !== 'function' || typeof adapter?.removeBody !== 'function' || typeof adapter?.readBody !== 'function') throw new TypeError('Static residency requires physics add, remove and read methods');
  if (typeof isDynamic !== 'function') throw new TypeError('Static residency requires an isDynamic(entry) predicate');
  const kindSet = kinds == null ? null : new Set(kinds);
  if (kindSet && (![...kindSet].every(kind => typeof kind === 'string' && kind.length > 0) || !kindSet.size)) throw new TypeError('Static residency kinds must be null or a nonempty set of names');
  bounded(maxProxies, 'maxProxies'); bounded(maxOwners, 'maxOwners'); bounded(maxQueued, 'maxQueued');
  bounded(maxCandidates, 'maxCandidates'); bounded(maxRetries, 'maxRetries', 8);
  if (typeof prefix !== 'string' || !prefix || prefix.length > 80) throw new TypeError('Static residency prefix must be a nonempty string of at most 80 characters');

  const namespace = `${prefix}:${++serial}`;
  const proxies = new Map(), owners = new Map();
  let disposed = false, rejections = 0, lastRejection = null;
  const timing = { pumps: 0, attempts: 0, created: 0, maxUnitMs: 0, lastPumpMs: 0 };
  const live = () => { if (disposed) throw new Error('Static residency disposed'); };

  function referenced(key) {
    for (const owner of owners.values()) if (owner.committed.has(key) || owner.wanted.has(key)) return true;
    return false;
  }
  function removeProxyBody(proxy) {
    if (proxy.state !== 'ready' && proxy.state !== 'cleanup-failed') return { ok: true };
    try {
      if (adapter.removeBody(proxy.bodyId)) return { ok: true };
      if (!adapter.readBody(proxy.bodyId)) return { ok: true };
      return { ok: false, reason: 'remove-refused' };
    } catch (error) {
      try {
        if (!adapter.readBody(proxy.bodyId)) return { ok: true };
      } catch { /* Keep the proxy record when engine ownership cannot be checked. */ }
      return { ok: false, reason: 'remove-failed', message: error.message };
    }
  }
  function prune(skipRetry = new Set()) {
    for (const [key, proxy] of proxies) if (!referenced(key)) {
      if (proxy.state === 'ready' || proxy.state === 'cleanup-failed') {
        if (skipRetry.has(key)) continue;
        const result = removeProxyBody(proxy);
        if (!result.ok) {
          proxy.state = 'cleanup-failed'; proxy.rejection = { reason: result.reason, ...(result.message ? { message: result.message } : {}) };
          lastRejection = { proxy: key, ...proxy.rejection };
          continue;
        }
      }
      proxies.delete(key);
    }
  }
  function commitReady(skipRetry = new Set()) {
    for (const owner of owners.values()) {
      if ([...owner.wanted].every(key => proxies.get(key)?.state === 'ready')) {
        owner.committed = new Set(owner.wanted);
      }
    }
    prune(skipRetry);
  }
  function snapshotForStatus(key) {
    const proxy = proxies.get(key);
    if (!proxy) return { key, state: 'missing' };
    return copyProxy(proxy);
  }
  function status(ownerKey) {
    const owner = owners.get(ownerKey);
    if (!owner) return { owner: ownerKey, state: disposed ? 'disposed' : 'absent', proxies: [], supporting: [], pending: 0 };
    const desired = [...owner.wanted].map(snapshotForStatus);
    const failed = desired.find(proxy => proxy.state === 'failed' || proxy.state === 'cleanup-failed');
    const pending = desired.filter(proxy => proxy.state !== 'ready').length;
    const cleanupPending = [...proxies.values()].filter(proxy => proxy.state === 'cleanup-failed').map(copyProxy);
    const state = owner.failure?.state ?? (failed ? 'failed' : pending ? 'pending' : cleanupPending.length ? 'cleanup-pending' : 'ready');
    return { owner: ownerKey, state, proxies: desired, supporting: [...owner.committed].map(snapshotForStatus), pending, cleanupPending,
      rejection: owner.failure ? { ...owner.failure } : failed?.rejection ?? null };
  }
  function reject(ownerKey, reason, state = 'rejected') {
    rejections++; lastRejection = { owner: ownerKey, reason };
    let owner = owners.get(ownerKey);
    if (!owner && owners.size < maxOwners) { owner = { wanted: new Set(), committed: new Set(), failure: null }; owners.set(ownerKey, owner); }
    if (owner) owner.failure = { reason, state };
    return { ok: false, reason, ...(owner ? { previous: status(ownerKey) } : {}) };
  }
  function candidatesFor(bounds) {
    const centerX = (bounds.minX + bounds.maxX) / 2, centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const reach = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2;
    const found = new Map();
    let visited = 0, truncated = false, invalid = null;
    registry.collidersNear(centerX, centerZ, reach, entry => {
      visited++;
      if (visited > maxCandidates) { truncated = true; return; }
      if (!entry?.collider || (kindSet && !kindSet.has(entry.kind)) || isDynamic(entry)) return;
      try {
        const item = snapshot(entry);
        if (intersectsBounds(item.x, item.z, item.radius, bounds)) found.set(item.key, item);
      } catch (error) { invalid = error; }
    });
    if (invalid) return { error: invalid };
    if (truncated) return { truncated: true, visited };
    return { items: [...found.values()].sort((a, b) => a.entryId - b.entryId), visited };
  }
  function request(ownerKey, inputBounds) {
    live();
    if (typeof ownerKey !== 'string' || !ownerKey || ownerKey.length > 200) throw new TypeError('Static owner must be a nonempty string of at most 200 characters');
    const bounds = orderedBounds(inputBounds);
    if (!owners.has(ownerKey) && owners.size >= maxOwners) return reject(ownerKey, 'owner-capacity');
    const result = candidatesFor(bounds);
    if (result.error) return reject(ownerKey, 'invalid-candidate', 'failed');
    if (result.truncated) return reject(ownerKey, 'candidate-capacity', 'truncated');
    prune();
    const desired = new Map(result.items.map(item => [item.key, item]));
    // A failed handoff must not be mistaken for either an available static body
    // or a missing body that can be recreated under the same identity.
    const stuck = [...desired.keys()].find(key => proxies.get(key)?.state === 'cleanup-failed');
    if (stuck) return reject(ownerKey, 'proxy-cleanup-pending', 'failed');
    const retained = new Set(desired.keys());
    for (const [key, proxy] of proxies) if (proxy.state === 'cleanup-failed') retained.add(key);
    for (const [key, owner] of owners) {
      for (const oldKey of owner.committed) retained.add(oldKey);
      if (key !== ownerKey) for (const oldKey of owner.wanted) retained.add(oldKey);
    }
    if (retained.size > maxProxies) return reject(ownerKey, 'proxy-capacity');
    let queued = 0;
    for (const key of retained) {
      const proxy = proxies.get(key);
      if (!proxy || proxy.state === 'pending' || (proxy.state === 'failed' && desired.has(key))) queued++;
    }
    if (queued > maxQueued) return reject(ownerKey, 'queue-capacity');
    let owner = owners.get(ownerKey);
    if (!owner) { owner = { wanted: new Set(), committed: new Set(), failure: null }; owners.set(ownerKey, owner); }
    owner.wanted = new Set(desired.keys()); owner.failure = null;
    prune();
    for (const [key, item] of desired) {
      let proxy = proxies.get(key);
      if (!proxy) {
        proxy = { ...item, bodyId: `${namespace}:${item.key}`, state: 'pending', attempts: 0, rejection: null };
        proxies.set(key, proxy);
      } else if (proxy.state === 'failed') {
        proxy.state = 'pending'; proxy.attempts = 0; proxy.rejection = null;
      }
    }
    commitReady();
    return { ok: true, candidates: result.items.length, ...status(ownerKey) };
  }
  function pump({ deadline, now, maxCreations } = {}) {
    live();
    if (!Number.isFinite(deadline) || typeof now !== 'function' || !Number.isSafeInteger(maxCreations) || maxCreations < 0 || maxCreations > HARD_CAPACITY) {
      throw new TypeError('Static pump requires a finite shared deadline, clock and bounded maxCreations');
    }
    const readTime = () => {
      const value = now();
      if (!Number.isFinite(value)) throw new TypeError('Static pump clock must return finite time');
      return value;
    };
    const started = readTime();
    let attempted = 0, created = 0, rejected = 0;
    const visited = new Set();
    while (attempted < maxCreations && readTime() < deadline) {
      const entry = [...proxies].find(([key, proxy]) => proxy.state === 'pending' && referenced(key) && !visited.has(key));
      if (!entry) break;
      const [key, proxy] = entry;
      visited.add(key); attempted++; timing.attempts++; proxy.attempts++;
      const unitStart = readTime();
      let result;
      try {
        result = adapter.addBody({ id: proxy.bodyId, type: 'fixed',
          pose: { position: { x: proxy.x, y: proxy.y + proxy.halfHeight, z: proxy.z } },
          colliders: [{ shape: 'cylinder', halfHeight: proxy.halfHeight, radius: proxy.radius, friction: .8, restitution: 0 }] });
      } catch (error) { result = { ok: false, reason: 'static-proxy-create-failed', message: error.message }; }
      timing.maxUnitMs = Math.max(timing.maxUnitMs, Math.max(0, readTime() - unitStart));
      if (result?.ok) { proxy.state = 'ready'; proxy.rejection = null; created++; timing.created++; }
      else {
        rejected++; rejections++;
        proxy.rejection = { reason: result?.reason ?? 'static-proxy-create-failed', ...(result?.message ? { message: result.message } : {}) };
        lastRejection = { proxy: key, ...proxy.rejection };
        if (proxy.attempts >= maxRetries) proxy.state = 'failed';
      }
      commitReady();
    }
    timing.pumps++; timing.lastPumpMs = Math.max(0, readTime() - started);
    return { attempted, created, rejected, ...stats() };
  }
  function release(ownerKey) {
    live();
    const removed = owners.delete(ownerKey);
    if (removed) prune();
    return removed;
  }
  function removeEntry(entryId) {
    live();
    if (!Number.isSafeInteger(entryId) || entryId < 0) throw new TypeError('Static entry ID must be a nonnegative safe integer');
    const keys = [...proxies].filter(([, proxy]) => proxy.entryId === entryId).map(([key]) => key);
    for (const owner of owners.values()) for (const key of keys) {
      owner.wanted.delete(key); owner.committed.delete(key);
    }
    const errors = [], retryLater = new Set();
    let removed = 0;
    for (const key of keys) {
      const proxy = proxies.get(key);
      const result = removeProxyBody(proxy);
      if (!result.ok) {
        proxy.state = 'cleanup-failed'; proxy.rejection = { reason: result.reason, ...(result.message ? { message: result.message } : {}) };
        lastRejection = { proxy: key, ...proxy.rejection }; retryLater.add(key);
        errors.push({ entryId, key, ...proxy.rejection });
      } else { proxies.delete(key); removed++; }
    }
    commitReady(retryLater);
    return { ok: errors.length === 0, entryId, versions: keys.length, removed, errors,
      cleanupPending: keys.filter(key => proxies.get(key)?.state === 'cleanup-failed').map(snapshotForStatus) };
  }
  function stats() {
    let ready = 0, pending = 0, failed = 0, cleanupPending = 0;
    for (const proxy of proxies.values()) {
      if (proxy.state === 'ready') ready++; else if (proxy.state === 'pending') pending++; else failed++;
      if (proxy.state === 'cleanup-failed') cleanupPending++;
    }
    return { disposed, proxies: proxies.size, ready, pending, failed, cleanupPending, owners: owners.size, rejections,
      capacities: { proxies: maxProxies, owners: maxOwners, queued: maxQueued, candidates: maxCandidates },
      approximation: 'ground-anchored cylinder; registered radius; half-height max(0.5 m, radius)',
      timing: { ...timing }, lastRejection: lastRejection ? { ...lastRejection } : null };
  }
  return Object.freeze({ request, pump, status, release, removeEntry, stats,
    dispose() {
      if (disposed) return;
      const errors = [];
      for (const [key, proxy] of proxies) {
        const result = removeProxyBody(proxy);
        if (!result.ok) errors.push({ key, ...result });
      }
      if (errors.length) return { ok: false, errors, cleanupPending: errors.length };
      proxies.clear(); owners.clear(); disposed = true;
      return { ok: true, errors: [] };
    } });
}
