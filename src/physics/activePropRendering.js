import * as THREE from 'three';

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
function limit(value, name, maximum) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new RangeError(`${name} must be an integer from 1 to ${maximum}`);
  return value;
}
function matrix(value) {
  if (!value?.isMatrix4 || !value.elements.every(Number.isFinite)) throw new TypeError('A finite Matrix4 is required');
  return value;
}

/** A bounded, independent render owner. Geometry/material ownership stays with the builders. */
export function createActivePropRendering({ maxBuckets = 16, maxSlots = 512, slotsPerBucket = Math.min(32, maxSlots) } = {}) {
  limit(maxBuckets, 'maxBuckets', 128); limit(maxSlots, 'maxSlots', 8192); limit(slotsPerBucket, 'slotsPerBucket', maxSlots);
  const root = new THREE.Group(); root.name = 'active_physical_props';
  const buckets = new Set(), records = new Map(), dirty = new Map(), disposedMeshes = new WeakSet();
  const inverse = new THREE.Matrix4(), parentLocal = new THREE.Matrix4(), scratch = new THREE.Matrix4();
  const boundsMatrix = new THREE.Matrix4(), partBounds = new THREE.Box3();
  let disposed = false, allocatedSlots = 0, liveSlots = 0, generation = 0, rejections = 0, uploadRequestedBytes = 0;
  function reject(reason, message) { rejections++; return { ok: false, reason, ...(message ? { message } : {}) }; }
  function touch(bucket, slot) {
    const range = dirty.get(bucket);
    if (range) { range.min = Math.min(range.min, slot); range.max = Math.max(range.max, slot); }
    else dirty.set(bucket, { min: slot, max: slot });
  }
  function convert(worldMatrix) {
    matrix(worldMatrix);
    root.updateWorldMatrix(true, false);
    if (Math.abs(root.matrixWorld.determinant()) < 1e-12) throw new RangeError('Active render parent is singular');
    inverse.copy(root.matrixWorld).invert();
    return parentLocal.multiplyMatrices(inverse, worldMatrix);
  }
  function validateProduct(parent, local) {
    scratch.multiplyMatrices(parent, local);
    if (!scratch.elements.every(value => Number.isFinite(value) && Number.isFinite(Math.fround(value)))) throw new RangeError('Active render transform exceeds finite Float32 coordinates');
    return scratch.clone();
  }
  function retire(bucket) {
    dirty.delete(bucket);
    bucket.mesh.removeEventListener('dispose', bucket.onDispose);
    bucket.mesh.removeFromParent();
    if (!disposedMeshes.has(bucket.mesh)) { disposedMeshes.add(bucket.mesh); bucket.mesh.dispose(); }
    if (buckets.delete(bucket)) allocatedSlots -= slotsPerBucket;
  }
  function makeBucket(geometry, material) {
    const mesh = new THREE.InstancedMesh(geometry, material, slotsPerBucket);
    mesh.name = 'active_prop_parts'; mesh.castShadow = false;
    for (let slot = 0; slot < slotsPerBucket; slot++) mesh.setMatrixAt(slot, HIDDEN);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const bucket = { geometry, material, mesh, used: new Set(), free: Array.from({ length: slotsPerBucket }, (_, i) => slotsPerBucket - i - 1), generations: new Float64Array(slotsPerBucket) };
    bucket.onDispose = () => { disposedMeshes.add(mesh); dispose(); };
    mesh.addEventListener('dispose', bucket.onDispose);
    return bucket;
  }
  function acquire(key, parts, worldMatrix) {
    if (disposed) return reject('disposed');
    if (typeof key !== 'string' || !key || key.length > 200) throw new TypeError('Active prop key must be a nonempty string of at most 200 characters');
    if (records.has(key)) return reject('duplicate-key');
    if (!Array.isArray(parts) || !parts.length) throw new TypeError('Active prop parts must be a nonempty array');
    if (parts.length > maxSlots) return reject('slot-capacity');
    const local = convert(worldMatrix).clone(), plans = [], prepared = [];
    for (const part of parts) {
      if (!part.geometry?.isBufferGeometry || !part.material?.isMaterial) throw new TypeError('Active parts require BufferGeometry and one Material');
      const localMatrix = matrix(part.localMatrix).clone();
      let plan = plans.find(p => p.geometry === part.geometry && p.material === part.material
        && p.needed < (p.bucket?.free.length ?? slotsPerBucket));
      if (!plan) {
        // A geometry/material pair may occupy several fixed-size buffers. Use
        // every existing free slot before planning another bounded allocation.
        const bucket = [...buckets].find(b => b.geometry === part.geometry && b.material === part.material
          && b.free.length && !plans.some(p => p.bucket === b));
        plan = { geometry: part.geometry, material: part.material, bucket, needed: 0 }; plans.push(plan);
      }
      plan.needed++;
      prepared.push({ plan, localMatrix, initial: validateProduct(local, localMatrix) });
    }
    const additions = plans.filter(plan => !plan.bucket);
    if (buckets.size + additions.length > maxBuckets) return reject('bucket-capacity');
    if (allocatedSlots + additions.length * slotsPerBucket > maxSlots) return reject('slot-capacity');
    const allocated = [];
    try {
      // Acquire every new buffer before touching any previously live slot.
      for (const plan of additions) {
        const bucket = makeBucket(plan.geometry, plan.material);
        allocated.push(bucket); plan.bucket = bucket; root.add(bucket.mesh);
      }
    } catch (error) {
      for (const bucket of allocated) retire(bucket);
      return reject('allocation-failed', error.message);
    }
    for (const bucket of allocated) {
      buckets.add(bucket); allocatedSlots += slotsPerBucket;
      // The first upload allocates the complete fixed instance buffer.
      dirty.set(bucket, { min: 0, max: slotsPerBucket - 1 });
    }
    const token = { generation: ++generation, live: true, parts: [], local };
    for (const part of prepared) {
      const bucket = part.plan.bucket, slot = bucket.free.pop();
      const slotGeneration = ++bucket.generations[slot];
      bucket.used.add(slot); bucket.mesh.count = Math.max(bucket.mesh.count, slot + 1);
      bucket.mesh.setMatrixAt(slot, part.initial); touch(bucket, slot); liveSlots++;
      token.parts.push({ bucket, slot, slotGeneration, localMatrix: part.localMatrix });
    }
    records.set(key, token);
    function isLive() {
      return !disposed && token.live && records.get(key) === token
        && token.parts.every(part => part.bucket.generations[part.slot] === part.slotGeneration && part.bucket.used.has(part.slot));
    }
    const binding = Object.freeze({ generation: token.generation, isLive,
      setWorldMatrix(worldMatrix) {
        if (!isLive()) return false;
        const next = convert(worldMatrix).clone();
        if (next.equals(token.local)) return true;
        const matrices = token.parts.map(part => validateProduct(next, part.localMatrix));
        token.local.copy(next);
        token.parts.forEach((part, index) => { part.bucket.mesh.setMatrixAt(part.slot, matrices[index]); touch(part.bucket, part.slot); });
        return true;
      },
      describe() {
        if (!isLive()) return [];
        return token.parts.map(part => ({ geometry: part.bucket.geometry, material: part.bucket.material,
          mesh: part.bucket.mesh, slot: part.slot, generation: part.slotGeneration, localMatrix: part.localMatrix.clone() }));
      },
      release() {
        if (!isLive()) return false;
        token.live = false; records.delete(key);
        const changed = new Set();
        for (const part of token.parts) {
          const { bucket, slot } = part;
          bucket.mesh.setMatrixAt(slot, HIDDEN); touch(bucket, slot);
          bucket.used.delete(slot); bucket.free.push(slot); liveSlots--; changed.add(bucket);
        }
        for (const bucket of changed) {
          if (!bucket.used.size) retire(bucket);
          else while (bucket.mesh.count && !bucket.used.has(bucket.mesh.count - 1)) bucket.mesh.count--;
        }
        return true;
      },
    });
    return { ok: true, binding };
  }
  function flush() {
    if (disposed) return { buckets: 0, matrixBytes: 0 };
    let matrixBytes = 0;
    for (const [bucket, { min, max }] of dirty) {
      const attribute = bucket.mesh.instanceMatrix;
      let start = min * 16, end = (max + 1) * 16;
      for (const range of attribute.updateRanges) { start = Math.min(start, range.start); end = Math.max(end, range.start + range.count); }
      attribute.clearUpdateRanges(); attribute.addUpdateRange(start, end - start); attribute.needsUpdate = true;
      if (!bucket.geometry.boundingBox) bucket.geometry.computeBoundingBox();
      const box = bucket.mesh.boundingBox ??= new THREE.Box3();
      box.makeEmpty();
      for (const slot of bucket.used) {
        bucket.mesh.getMatrixAt(slot, boundsMatrix);
        box.union(partBounds.copy(bucket.geometry.boundingBox).applyMatrix4(boundsMatrix));
      }
      // Ignore zeroed holes, which otherwise pin distant bounds at the origin.
      // A sphere derived from the box also encloses sheared transforms, unlike
      // scaling each geometry sphere by its largest matrix-column length.
      box.getBoundingSphere(bucket.mesh.boundingSphere ??= new THREE.Sphere());
      matrixBytes += (end - start) * Float32Array.BYTES_PER_ELEMENT;
    }
    const count = dirty.size; dirty.clear(); uploadRequestedBytes += matrixBytes;
    return { buckets: count, matrixBytes };
  }
  function stats() {
    return Object.freeze({ disposed, props: records.size, buckets: buckets.size, slots: liveSlots, allocatedSlots,
      matrixBufferBytes: allocatedSlots * 16 * Float32Array.BYTES_PER_ELEMENT, uploadRequestedBytes, rejections,
      capacities: Object.freeze({ buckets: maxBuckets, slots: maxSlots, slotsPerBucket, matrixBufferBytes: maxSlots * 64 }) });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const token of records.values()) token.live = false;
    records.clear();
    for (const bucket of [...buckets]) retire(bucket);
    dirty.clear(); liveSlots = 0; root.removeFromParent();
  }
  return Object.freeze({ root, acquire, flush, stats, dispose });
}
