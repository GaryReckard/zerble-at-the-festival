import * as THREE from 'three';
import { chairRecipe } from './recipes.js';

let serial = 0;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const copyPose = value => ({ position: { ...value.position }, rotation: { ...value.rotation } });
class Rejection extends Error {
  constructor(stage, reason) { super(`${stage}: ${reason}`); this.stage = stage; this.reason = reason; }
}
function required(result, stage) {
  if (!result?.ok) throw new Rejection(stage, result?.reason ?? 'operation-failed');
  return result;
}
function poseAndScale(descriptor) {
  const value = descriptor.worldPose;
  const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  for (const axis of ['x', 'y', 'z']) {
    for (const field of ['position', 'rotation', 'scale']) {
      const number = value?.[field]?.[axis];
      if (!Number.isFinite(number) || !Number.isFinite(Math.fround(number)) || (field === 'scale' && number <= 0)) throw new TypeError('Chair worldPose requires finite position/rotation and positive scale');
    }
    position[axis] = value.position[axis]; rotation[axis] = value.rotation[axis]; scale[axis] = value.scale[axis];
  }
  if (!Number.isFinite(value.rotation.w)) throw new TypeError('Chair rotation.w must be finite');
  rotation.w = value.rotation.w;
  if (rotation.lengthSq() < 1e-20) throw new TypeError('Chair rotation must have nonzero length');
  rotation.normalize();
  return { position, rotation, scale };
}

/** Transactional empty-chair adoption only. Origin regeneration and distance policy remain outside this owner. */
export function createChairOwnership({ registry, adapter, budget, rendering, supportReady, campSlotAvailable, originAlive, maxChairs = 16 } = {}) {
  if (!Number.isSafeInteger(maxChairs) || maxChairs < 1 || maxChairs > 256) throw new RangeError('maxChairs must be an integer from 1 to 256');
  if (!(registry?.entries instanceof Map) || ![registry.enrollPhysical, registry.publishPhysical, registry.transferOwner, registry.unenrollPhysical,
    adapter?.addBody, adapter?.removeBody, adapter?.readBody, budget?.reserve, budget?.release, budget?.update, budget?.read, rendering?.acquire,
    supportReady, campSlotAvailable, originAlive].every(value => typeof value === 'function')) throw new TypeError('Chair ownership requires registry, physics, budget, rendering and explicit support/seat/origin callbacks');
  const namespace = `chair-ownership:${++serial}`, records = new Map();
  const worldMatrix = new THREE.Matrix4(), point = new THREE.Vector3();
  let generation = 0, disposed = false, rejections = 0;
  function resolve(token) {
    const record = token && records.get(token.key);
    return record && record.generation === token.generation ? record : null;
  }
  function reject(stage, reason, extra = {}) { rejections++; return { ok: false, stage, reason, ...extra }; }
  function bodyWorld(record, pose) {
    worldMatrix.compose(new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
      new THREE.Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w), record.scale);
    return worldMatrix;
  }
  function footprint(record, matrix) {
    let radius = 0;
    for (const x of [record.bounds.min.x, record.bounds.max.x]) for (const y of [record.bounds.min.y, record.bounds.max.y]) for (const z of [record.bounds.min.z, record.bounds.max.z]) {
      point.set(x, y, z).applyMatrix4(matrix);
      radius = Math.max(radius, Math.hypot(point.x - matrix.elements[12], point.z - matrix.elements[14]));
    }
    return radius;
  }
  function restoreSeats(record) {
    for (const seat of record.seats) {
      if (seat.had) seat.slot.physicalUnavailable = seat.previous;
      else delete seat.slot.physicalUnavailable;
    }
  }
  function originalPublication(record) {
    return { pose: { position: { ...record.original.position }, rotation: { ...record.initialPose.rotation } },
      footprint: record.original.footprint, colliderRadius: record.original.colliderRadius };
  }
  function attempt(errors, resource, action) {
    try { action(); return true; }
    catch (error) { errors.push({ resource, message: error.message }); return false; }
  }
  function rollbackOriginal(record, errors) {
    let restored = true;
    if (record.hideAttempted) restored = attempt(errors, 'origin-visibility', () => {
      if (record.descriptor.renderBinding.setVisible(true) !== true) throw new Error('Origin binding refused restoration');
      record.hideAttempted = false;
    }) && restored;
    let geometry = true, owner = true;
    if (record.registryToken) geometry = attempt(errors, 'original-pose', () => required(registry.publishPhysical(record.registryToken, originalPublication(record)), 'rollback'));
    if (record.transferred) owner = attempt(errors, 'original-owner', () => {
      required(registry.transferOwner(record.entryId, record.original.chunkKey), 'rollback'); record.transferred = false;
    });
    if (geometry && owner && record.registryToken) restored = attempt(errors, 'registry-enrollment', () => {
      required(registry.unenrollPhysical(record.registryToken), 'rollback'); record.registryToken = null;
    }) && restored;
    record.rollbackPending = !restored || !geometry || !owner;
  }
  function destroyOwned(record, errors) {
    if (record.bodyOwned) attempt(errors, 'physics-body', () => {
      if (!adapter.removeBody(record.bodyId) && adapter.readBody(record.bodyId)) throw new Error('Physics body removal failed');
      record.bodyOwned = false;
    });
    if (record.renderOwned) attempt(errors, 'render-binding', () => {
      if (!record.render.release() && record.render.isLive()) throw new Error('Render binding removal failed');
      record.renderOwned = false;
    });
    attempt(errors, 'seat-flags', () => {
      if (record.cleanupMode === 'retire' || record.bodyOwned || record.renderOwned) {
        // Retired furniture has no visible source to sit on. Failed removal
        // also keeps seats blocked until its surviving representations vanish.
        for (const seat of record.seats) seat.slot.physicalUnavailable = true;
        record.seatsRestored = record.cleanupMode === 'retire';
      } else { restoreSeats(record); record.seatsRestored = true; }
    });
    if (record.budgetToken) attempt(errors, 'budget', () => {
      if (record.bodyOwned || record.renderOwned) {
        required(budget.update(record.budgetToken, { resident: { bodies: record.bodyOwned ? 1 : 0,
          colliders: record.bodyOwned ? record.colliderCount : 0, renderSlots: record.renderOwned ? record.partCount : 0 } }), 'cleanup-budget');
      } else {
        const result = budget.release(record.budgetToken);
        if (!result.ok && budget.read(record.budgetToken)) required(result, 'cleanup-budget');
        record.budgetToken = null;
      }
    });
    record.cleanupErrors = errors.map(error => ({ ...error }));
    if (!record.bodyOwned && !record.renderOwned && !record.budgetToken && !record.rollbackPending && !record.registryRetirePending && record.seatsRestored) records.delete(record.key);
    else { record.state = 'cleanup-pending'; records.set(record.key, record); }
  }
  function adopt(entryId) {
    if (disposed) return reject('admission', 'disposed');
    const entry = registry.entries.get(entryId), descriptor = entry?.physicalProp;
    if (!descriptor || !['camp_chair', 'camp_loveseat'].includes(descriptor.kind)) return reject('admission', 'not-a-chair');
    if (typeof descriptor.logicalKey !== 'string' || !descriptor.logicalKey) return reject('admission', 'missing-key');
    const key = descriptor.logicalKey;
    if (records.has(key)) return reject('admission', 'already-owned');
    if (records.size >= maxChairs) return reject('admission', 'chair-capacity');
    if (!Array.isArray(descriptor.seatSlots) || descriptor.seatSlots.length !== (descriptor.style === 'loveseat' ? 2 : 1)) return reject('admission', 'incomplete-seats');
    if (descriptor.seatSlots.some(slot => slot.occupied || campSlotAvailable(slot) !== true)) return reject('admission', 'occupied-or-unavailable');
    if (supportReady(descriptor, entry) !== true) return reject('admission', 'support-pending');
    if (originAlive(descriptor, entry) !== true) return reject('admission', 'origin-unavailable');
    if (generation === Number.MAX_SAFE_INTEGER) return reject('admission', 'generation-exhausted');
    let record;
    try {
      if (!descriptor.renderBinding || typeof descriptor.renderBinding.describe !== 'function' || typeof descriptor.renderBinding.setVisible !== 'function') throw new Rejection('admission', 'missing-origin-binding');
      const pose = poseAndScale(descriptor), recipe = chairRecipe(descriptor.style), parts = descriptor.renderBinding.describe();
      if (!parts.length) throw new Rejection('admission', 'missing-origin-parts');
      const bounds = new THREE.Box3(), partBounds = new THREE.Box3();
      for (const part of parts) {
        if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
        bounds.union(partBounds.copy(part.geometry.boundingBox).applyMatrix4(part.localMatrix));
      }
      for (const shape of recipe) {
        const p = shape.position, h = shape.halfExtents;
        bounds.expandByPoint(new THREE.Vector3(p.x - h.x, p.y - h.y, p.z - h.z));
        bounds.expandByPoint(new THREE.Vector3(p.x + h.x, p.y + h.y, p.z + h.z));
      }
      const initialPose = { position: { x: pose.position.x, y: pose.position.y, z: pose.position.z },
        rotation: { x: pose.rotation.x, y: pose.rotation.y, z: pose.rotation.z, w: pose.rotation.w } };
      const original = { position: { x: entry.position.x, y: entry.position.y ?? 0, z: entry.position.z },
        footprint: entry.footprint ?? 0, colliderRadius: entry.collider?.radius ?? null, chunkKey: entry.chunkKey };
      record = { key, entryId, descriptor, generation: ++generation, bodyId: `${namespace}:${key}`,
        bounds, scale: pose.scale, initialPose, original, owner: `physical:${key}`, colliderCount: recipe.length, partCount: parts.length,
        bodyOwned: false, renderOwned: false, transferred: false, hideAttempted: false, state: 'active',
        seats: descriptor.seatSlots.map(slot => ({ slot, had: own(slot, 'physicalUnavailable'), previous: slot.physicalUnavailable })) };
      record.lastPublication = originalPublication(record);
      record.budgetToken = required(budget.reserve(`${namespace}:${key}`, { resident: { bodies: 1, colliders: recipe.length, renderSlots: parts.length }, release: {} }), 'budget').token;
      record.registryToken = required(registry.enrollPhysical(entryId, key), 'registry').token;
      const initialMatrix = new THREE.Matrix4().compose(pose.position, pose.rotation, pose.scale);
      record.render = required(rendering.acquire(`${namespace}:${key}`, parts, initialMatrix), 'render').binding;
      record.renderOwned = true;
      const colliders = recipe.map(shape => ({ ...shape,
        position: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, shape.position[axis] * pose.scale[axis]])),
        halfExtents: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, shape.halfExtents[axis] * pose.scale[axis]])) }));
      const created = required(adapter.addBody({ id: record.bodyId, type: 'dynamic', pose: initialPose, colliders, ccd: true, linearDamping: .12, angularDamping: .2 }), 'physics');
      record.engineGeneration = created.generation;
      record.bodyOwned = true;
      required(registry.transferOwner(entryId, record.owner), 'transfer'); record.transferred = true;
      const radius = footprint(record, initialMatrix);
      required(registry.publishPhysical(record.registryToken, { pose: initialPose, footprint: radius, colliderRadius: radius }), 'publication');
      record.hideAttempted = true;
      if (descriptor.renderBinding.setVisible(false) !== true) throw new Rejection('origin', 'stale-origin-binding');
      for (const seat of record.seats) seat.slot.physicalUnavailable = true;
      record.lastPublication = { pose: copyPose(initialPose), footprint: radius, colliderRadius: radius };
      records.set(key, record);
      return { ok: true, token: Object.freeze({ key, generation: record.generation }) };
    } catch (error) {
      const cleanupErrors = [];
      if (record) {
        record.cleanupMode = 'rollback'; rollbackOriginal(record, cleanupErrors); destroyOwned(record, cleanupErrors);
      }
      return reject(error.stage ?? 'admission', error.reason ?? 'exception', { message: error.message,
        ...(cleanupErrors.length ? { cleanupErrors } : {}), ...(record && records.has(key) ? { cleanupToken: { key, generation: record.generation } } : {}) });
    }
  }
  function publish(token) {
    const record = resolve(token);
    if (!record || disposed) return { ok: false, reason: 'stale-token' };
    if (record.state !== 'active') return { ok: false, reason: 'cleanup-pending' };
    const body = adapter.readBody(record.bodyId);
    if (!body) return { ok: false, reason: 'missing-body' };
    if (!record.render.isLive()) return { ok: false, reason: 'stale-render-binding' };
    const matrix = bodyWorld(record, body.pose), radius = footprint(record, matrix);
    const publication = { pose: copyPose(body.pose), footprint: radius, colliderRadius: radius };
    const result = registry.publishPhysical(record.registryToken, publication);
    if (!result.ok) return result;
    try {
      if (!record.render.setWorldMatrix(matrix)) throw new Rejection('publication', 'stale-render-binding');
    } catch (error) {
      const cleanupErrors = [];
      attempt(cleanupErrors, 'registry-publication-rollback', () => required(registry.publishPhysical(record.registryToken, record.lastPublication), 'publication-rollback'));
      return { ok: false, reason: error.reason ?? 'render-publication-failed', message: error.message, ...(cleanupErrors.length ? { cleanupErrors } : {}) };
    }
    record.lastPublication = publication;
    return { ok: true, pose: copyPose(body.pose), footprint: radius };
  }
  function release(token, { mode } = {}) {
    const record = resolve(token);
    if (!record) return { ok: false, reason: 'stale-token' };
    if (!['restore-original', 'retire'].includes(mode)) throw new TypeError('Chair release requires restore-original or retire');
    const cleanupErrors = [];
    if (record.cleanupMode === 'rollback') rollbackOriginal(record, cleanupErrors);
    else if (record.cleanupMode === 'restored') { /* The original is already restored; retry only owned resource cleanup. */ }
    else if (mode === 'restore-original' && !record.cleanupMode) {
      if (originAlive(record.descriptor, registry.entries.get(record.entryId)) !== true) return { ok: false, reason: 'origin-unavailable' };
      if (record.descriptor.renderBinding.setVisible(true) !== true) return { ok: false, reason: 'stale-origin-binding' };
      try {
        required(registry.publishPhysical(record.registryToken, originalPublication(record)), 'restore-publication');
        required(registry.transferOwner(record.entryId, record.original.chunkKey), 'restore-owner');
        required(registry.unenrollPhysical(record.registryToken), 'restore-enrollment');
      } catch (error) {
        attempt(cleanupErrors, 'origin-hide-rollback', () => { if (!record.descriptor.renderBinding.setVisible(false)) throw new Error('Origin binding refused hide'); });
        attempt(cleanupErrors, 'owner-rollback', () => required(registry.transferOwner(record.entryId, record.owner), 'restore-rollback'));
        attempt(cleanupErrors, 'pose-rollback', () => required(registry.publishPhysical(record.registryToken, record.lastPublication), 'restore-rollback'));
        return { ok: false, stage: error.stage, reason: error.reason, ...(cleanupErrors.length ? { cleanupErrors } : {}) };
      }
      record.registryToken = null; record.cleanupMode = 'restored'; record.hideAttempted = false;
    } else {
      record.cleanupMode = 'retire'; record.registryRetirePending = true;
      attempt(cleanupErrors, 'registry-entry', () => {
        registry.remove(record.entryId);
        if (registry.entries.has(record.entryId)) throw new Error('Registry entry removal failed');
        record.registryRetirePending = false; record.registryToken = null;
      });
    }
    destroyOwned(record, cleanupErrors);
    return cleanupErrors.length || records.has(record.key) ? { ok: false, reason: 'cleanup-failed', cleanupErrors } : { ok: true };
  }
  return Object.freeze({ adopt, publish, release,
    read(token) {
      const record = resolve(token);
      return record ? { token: { key: record.key, generation: record.generation }, entryId: record.entryId,
        bodyId: record.bodyId, engineGeneration: record.engineGeneration,
        pose: copyPose(record.lastPublication.pose), footprint: record.lastPublication.footprint, originOwner: record.descriptor.originOwner,
        state: record.state, resources: { body: record.bodyOwned, render: record.renderOwned, budget: !!record.budgetToken },
        cleanupErrors: record.cleanupErrors?.map(error => ({ ...error })) ?? [] } : null;
    },
    stats() { return { disposed, chairs: records.size, cleanupPending: [...records.values()].filter(record => record.state === 'cleanup-pending').length, capacity: maxChairs, rejections,
      limitations: ['Empty chairs only; origin-regeneration suppression and distance reset are not integrated.'] }; },
    dispose() {
      disposed = true;
      const results = [];
      for (const record of [...records.values()]) results.push(release({ key: record.key, generation: record.generation }, { mode: 'retire' }));
      return { ok: results.every(result => result.ok), results };
    },
  });
}
