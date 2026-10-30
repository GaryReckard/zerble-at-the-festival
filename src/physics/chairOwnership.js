import * as THREE from 'three';
import {createCoolerLid} from './coolerLid.js';
import { chairRecipe, coolerRecipe } from './recipes.js';

let serial = 0;
const ORIGIN_LIFETIME = Symbol('physicalChairOriginLifetime');
const MAX_ORIGIN_LIFETIMES = 256;
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

/** Transactional adoption for chairs and articulated cooler assemblies.
 * The historical chair-owner API remains shared so origins use one authority. */
export function createChairOwnership({ registry, adapter, budget, rendering, supportReady, campSlotAvailable, originAlive, occupants = null, maxChairs = 16 } = {}) {
  if (!Number.isSafeInteger(maxChairs) || maxChairs < 1 || maxChairs > 256) throw new RangeError('maxChairs must be an integer from 1 to 256');
  if (!(registry?.entries instanceof Map) || ![registry.enrollPhysical, registry.publishPhysical, registry.transferOwner, registry.unenrollPhysical,
    adapter?.addBody, adapter?.removeBody, adapter?.readBody, budget?.reserve, budget?.release, budget?.update, budget?.read, rendering?.acquire,
    supportReady, campSlotAvailable, originAlive].every(value => typeof value === 'function')) throw new TypeError('Chair ownership requires registry, physics, budget, rendering and explicit support/seat/origin callbacks');
  const namespace = `chair-ownership:${++serial}`, records = new Map(), originLifetimes = new Set();
  const worldMatrix = new THREE.Matrix4(), point = new THREE.Vector3();
  let generation = 0, disposed = false, rejections = 0, originReplacements = 0;
  function detachOriginLifetime(descriptor) { descriptor?.[ORIGIN_LIFETIME]?.(); }
  function installOriginLifetime(record) {
    const descriptor = record.descriptor, entryId = record.entryId, originalOwner = record.original.chunkKey;
    const entry = registry.entries.get(entryId);
    if (!entry) throw new Error('Restored chair registry entry is missing');
    detachOriginLifetime(descriptor);
    if (originLifetimes.size >= MAX_ORIGIN_LIFETIMES) throw new Error('Restored origin lifetime capacity exhausted');
    const mesh = descriptor.renderBinding.describe()[0]?.mesh;
    if (!mesh?.isInstancedMesh) throw new Error('A restored chair needs a live source instance mesh');
    const detach = () => {
      mesh.removeEventListener('dispose', onDispose); originLifetimes.delete(detach);
      if (descriptor[ORIGIN_LIFETIME] === detach) delete descriptor[ORIGIN_LIFETIME];
    };
    const onDispose = () => {
      detach();
      // Lakes copy origin IDs before restoration. Their source batch is the
      // lifetime adapter for a restored child that was excluded from that list.
      if (registry.entries.get(entryId) === entry && entry.physicalProp === descriptor && entry.chunkKey === originalOwner) {
        registry.remove(entryId);
        for (const slot of descriptor.seatSlots) slot.physicalUnavailable = true;
      }
    };
    descriptor[ORIGIN_LIFETIME] = detach; originLifetimes.add(detach);
    mesh.addEventListener('dispose', onDispose);
  }
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
    if(record.occupants&&!attempt(errors,'occupants',()=>{record.occupants.dispose();record.occupants=null;})) {
      record.state='cleanup-pending';records.set(record.key,record);return;
    }
    if(record.lid&&!attempt(errors,'cooler-lid',()=>{record.lid.dispose();record.lid=null;})) {
      record.cleanupErrors=errors.map(error=>({...error}));
      record.state='cleanup-pending';records.set(record.key,record);return;
    }
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
    if (!record.bodyOwned && !record.renderOwned && !record.budgetToken && record.cleanupMode === 'restored') {
      record.originLifetimePending = !attempt(errors, 'origin-lifetime', () => installOriginLifetime(record));
    }
    record.cleanupErrors = errors.map(error => ({ ...error }));
    if (!record.bodyOwned && !record.renderOwned && !record.budgetToken && !record.rollbackPending && !record.registryRetirePending && !record.originLifetimePending && record.seatsRestored) records.delete(record.key);
    else { record.state = 'cleanup-pending'; records.set(record.key, record); }
  }
  function adopt(entryId) {
    if (disposed) return reject('admission', 'disposed');
    const entry = registry.entries.get(entryId), descriptor = entry?.physicalProp;
    if (!descriptor || !['camp_chair', 'camp_loveseat', 'camp_cooler'].includes(descriptor.kind)) return reject('admission', 'not-a-chair');
    if (typeof descriptor.logicalKey !== 'string' || !descriptor.logicalKey) return reject('admission', 'missing-key');
    const key = descriptor.logicalKey;
    if (records.has(key)) return reject('admission', 'already-owned');
    if (records.size >= maxChairs) return reject('admission', 'chair-capacity');
    if (originLifetimes.size + records.size - (descriptor[ORIGIN_LIFETIME] ? 1 : 0) >= MAX_ORIGIN_LIFETIMES) return reject('admission', 'origin-lifetime-capacity');
    if (!Array.isArray(descriptor.seatSlots) || descriptor.seatSlots.length !== (descriptor.kind === 'camp_cooler' ? 0 : descriptor.style === 'loveseat' ? 2 : 1)) return reject('admission', 'incomplete-seats');
    if (descriptor.seatSlots.some(slot => slot.occupied || campSlotAvailable(slot) !== true) && occupants?.canAdopt(entry)!==true) return reject('admission', 'occupied-or-unavailable');
    if (supportReady(descriptor, entry) !== true) return reject('admission', 'support-pending');
    if (originAlive(descriptor, entry) !== true) return reject('admission', 'origin-unavailable');
    if (generation === Number.MAX_SAFE_INTEGER) return reject('admission', 'generation-exhausted');
    let record;
    try {
      if (!descriptor.renderBinding || typeof descriptor.renderBinding.describe !== 'function' || typeof descriptor.renderBinding.setVisible !== 'function') throw new Rejection('admission', 'missing-origin-binding');
      const pose = poseAndScale(descriptor), recipe = descriptor.kind === 'camp_cooler' ? coolerRecipe({articulated:true}) : chairRecipe(descriptor.style), parts = descriptor.renderBinding.describe();
      const isCooler=descriptor.kind==='camp_cooler';
      if(isCooler&&!parts.some(part=>part.partId==='lid'))throw new Rejection('admission','missing-lid-part');
      if(isCooler&&(Math.abs(pose.scale.x-pose.scale.y)>1e-6||Math.abs(pose.scale.x-pose.scale.z)>1e-6))throw new Rejection('admission','cooler-uniform-scale-required');
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
      // Contain the lid's complete hinge arc, not only its closed bounds.
      if(isCooler){bounds.expandByPoint(new THREE.Vector3(-.31,.30,-.75));bounds.expandByPoint(new THREE.Vector3(.31,.9,.24));}
      const initialPose = { position: { x: pose.position.x, y: pose.position.y, z: pose.position.z },
        rotation: { x: pose.rotation.x, y: pose.rotation.y, z: pose.rotation.z, w: pose.rotation.w } };
      const original = { position: { x: entry.position.x, y: entry.position.y ?? 0, z: entry.position.z },
        footprint: entry.footprint ?? 0, colliderRadius: entry.collider?.radius ?? null, chunkKey: entry.chunkKey };
      // A sphere around the body origin contains these scaled model/collider
      // bounds under every rotation, including between pose publications.
      const supportRadius = Math.hypot(...['x','y','z'].map(axis =>
        Math.max(Math.abs(bounds.min[axis]),Math.abs(bounds.max[axis])) * pose.scale[axis]));
      record = { key, entryId, descriptor, generation: ++generation, bodyId: `${namespace}:${key}`,
        bounds, supportRadius, scale: pose.scale, initialPose, original, owner: `physical:${key}`, colliderCount: recipe.length, partCount: parts.length,
        bodyOwned: false, renderOwned: false, transferred: false, hideAttempted: false, state: 'active',
        seats: descriptor.seatSlots.map(slot => ({ slot, had: own(slot, 'physicalUnavailable'), previous: slot.physicalUnavailable })) };
      record.lastPublication = originalPublication(record);
      record.budgetToken = required(budget.reserve(`${namespace}:${key}`, { resident: { bodies: isCooler?2:1, colliders: recipe.length+(isCooler?1:0), joints:isCooler?1:0, renderSlots: parts.length }, release: {} }), 'budget').token;
      record.registryToken = required(registry.enrollPhysical(entryId, key), 'registry').token;
      const initialMatrix = new THREE.Matrix4().compose(pose.position, pose.rotation, pose.scale);
      record.render = required(rendering.acquire(`${namespace}:${key}`, parts, initialMatrix), 'render').binding;
      record.renderOwned = true;
      const colliders = recipe.map(shape => ({ ...shape,
        ...(shape.mass===undefined?{}:{mass:shape.mass*pose.scale.x*pose.scale.y*pose.scale.z}),
        position: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, shape.position[axis] * pose.scale[axis]])),
        halfExtents: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, shape.halfExtents[axis] * pose.scale[axis]])) }));
      const created = required(adapter.addBody({ id: record.bodyId, type: 'dynamic', pose: initialPose, colliders, ccd: true, linearDamping: .12, angularDamping: .2 }), 'physics');
      record.engineGeneration = created.generation;
      record.bodyOwned = true;
      if(isCooler)record.lid=createCoolerLid({adapter,bodyId:record.bodyId,scale:record.scale,render:record.render});
      required(registry.transferOwner(entryId, record.owner), 'transfer'); record.transferred = true;
      const radius = footprint(record, initialMatrix);
      required(registry.publishPhysical(record.registryToken, { pose: initialPose, footprint: radius, colliderRadius: radius }), 'publication');
      record.hideAttempted = true;
      if (descriptor.renderBinding.setVisible(false) !== true) throw new Rejection('origin', 'stale-origin-binding');
      for (const seat of record.seats) seat.slot.physicalUnavailable = true;
      const occupied=occupants?.adopt({entry,descriptor,bodyId:record.bodyId,engineGeneration:record.engineGeneration,initialPose});
      if(occupied){required(occupied,'occupants');record.occupants=occupied.lease;}
      detachOriginLifetime(descriptor);
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
      if(record.lid&&!record.lid.publish())throw new Rejection('publication','stale-lid-binding');
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
      detachOriginLifetime(record.descriptor);
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
  function registerOrigin(descriptor, child) {
    const record = records.get(descriptor?.logicalKey);
    if (!record) return null;
    const entry = registry.entries.get(record.entryId);
    if (!entry) throw new Error(`Cannot suppress regenerated chair ${record.key}: adopted registry entry is missing`);
    if (child?.chunkKey !== record.original.chunkKey) throw new Error(`Cannot suppress regenerated chair ${record.key}: origin owner changed`);
    if (descriptor.kind !== record.descriptor.kind || descriptor.style !== record.descriptor.style) throw new Error(`Cannot suppress regenerated chair ${record.key}: recipe changed without a new identity`);
    if (!Array.isArray(descriptor.seatSlots) || descriptor.seatSlots.length !== record.seats.length) throw new Error(`Cannot suppress regenerated chair ${record.key}: seat claims changed`);
    if (descriptor.seatSlots.some(slot => slot.occupied)) throw new Error(`Cannot suppress regenerated chair ${record.key}: new source is occupied`);
    if (descriptor.renderBinding?.setVisible(false) !== true) throw new Error(`Cannot suppress regenerated chair ${record.key}: source binding refused hide`);
    const seats = descriptor.seatSlots.map(slot => ({ slot, had: own(slot, 'physicalUnavailable'), previous: slot.physicalUnavailable }));
    for (const seat of seats) seat.slot.physicalUnavailable = true;
    detachOriginLifetime(record.descriptor);
    record.descriptor = descriptor; record.seats = seats; record.hideAttempted = true;
    entry.physicalProp = descriptor;
    // This is the origin's deterministic child geometry, not a new live entry.
    // The original canonical snapshot remains with registry.enrollPhysical.
    originReplacements++;
    return entry;
  }
  function originEntryIds(camp, options = {}) {
    const position = camp?.group?.position;
    if (!position) return [];
    const provenance = options.originOwner ?? (options.chunkKey !== undefined ? `chunk:${options.chunkKey}`
      : options.forestOwnerKey !== undefined ? `chunk:${options.forestOwnerKey}`
        : options.lakeOwnerKey !== undefined ? `lake:${options.lakeOwnerKey}` : null);
    const localKeys = new Set([...(camp.physicalChairs ?? []),...(camp.physicalCoolers ?? [])].map(chair => chair.localKey));
    const found = [];
    for (const record of records.values()) {
      const descriptor = record.descriptor, origin = descriptor.originPosition;
      if (!origin || !['x', 'y', 'z'].every(axis => origin[axis] === position[axis]) || !localKeys.has(descriptor.localKey)) continue;
      if (provenance !== null && descriptor.originOwner !== provenance) continue;
      if (options.campNeighborhood !== undefined && descriptor.originNeighborhood !== options.campNeighborhood) continue;
      if (registry.entries.get(record.entryId)?.chunkKey === record.owner) found.push(record.entryId);
    }
    return found;
  }
  return Object.freeze({ adopt, publish, release, registerOrigin, originEntryIds,
    requestDismount(token){return resolve(token)?.occupants?.requestDismount()??0;},
    stepPeople(dt){for(const record of records.values()){if(dt>0)record.lid?.step();record.occupants?.step(dt);}},
    preparePeople(deadline,now){for(const record of records.values())if(now()<deadline)record.occupants?.prepare(deadline,now);},
    ownsBody(token,id){const record=resolve(token);return !!record&&(record.bodyId===id||record.lid?.bodyId===id);},
    impact(token){return resolve(token)?.lid?.unlatch()??false;},
    propBodies(token){const record=resolve(token);return record?[record.bodyId,...(record.lid?[record.lid.bodyId]:[])].map(id=>adapter.readBody(id)).filter(Boolean):[];},
    personBodies(token){return resolve(token)?.occupants?.bodies()??[];},
    isAdopted(entryId) { return [...records.values()].some(record => record.entryId === entryId); },
    read(token) {
      const record = resolve(token);
      return record ? { token: { key: record.key, generation: record.generation }, entryId: record.entryId,
        bodyId: record.bodyId, engineGeneration: record.engineGeneration,
        pose: copyPose(record.lastPublication.pose), footprint: record.lastPublication.footprint, supportRadius: record.supportRadius, originOwner: record.descriptor.originOwner,
        originRegistryId: record.descriptor.originRegistryId,
        occupants:record.occupants?.inspect()??[],lid:record.lid?.inspect()??null,
        state: record.state, resources: { body: record.bodyOwned, render: record.renderOwned, budget: !!record.budgetToken },
        cleanupErrors: record.cleanupErrors?.map(error => ({ ...error })) ?? [] } : null;
    },
    stats() { return { disposed, chairs: records.size, cleanupPending: [...records.values()].filter(record => record.state === 'cleanup-pending').length,
      originReplacements, originLifetimes: originLifetimes.size, originLifetimeCapacity: MAX_ORIGIN_LIFETIMES, capacity: maxChairs, rejections,
      limitations: ['Chairs, eligible seated occupants and articulated coolers; coherent arrangement reset is not integrated. Restored lake children follow their source batch lifetime.'] }; },
    dispose() {
      disposed = true;
      const results = [];
      for (const record of [...records.values()]) results.push(release({ key: record.key, generation: record.generation }, { mode: 'retire' }));
      for (const detach of [...originLifetimes]) detach();
      return { ok: results.every(result => result.ok), results };
    },
  });
}
