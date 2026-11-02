import * as THREE from 'three';

// One owner per batch. Bindings retain part-local transforms after the source
// meshes are removed; they never own the shared geometries or materials.
export function batchPropGroups(root, groups) {
  const buckets = new Map(), dirty = new Map(), bindings = [], meshes = [];
  let disposed = false, teardownComplete = false;
  const disposedMeshes = new WeakSet();
  for (const group of groups) {
    const partIds = new Set();
    if (group.parent !== root) throw new TypeError('Prop groups must be direct children of the batch root');
    for (const mesh of group.children) {
      if (!mesh.isMesh || mesh.isInstancedMesh || mesh.children.length) throw new TypeError('Prop batching requires direct leaf meshes');
      const id = mesh.userData.physicalPart;
      if (id !== undefined) {
        if (typeof id !== 'string' || !id || id.length > 80 || partIds.has(id)) throw new TypeError('Physical part ids must be unique nonempty strings of at most 80 characters');
        partIds.add(id);
      }
    }
  }
  const scratch = new THREE.Matrix4(), inverse = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  function touch(bucket, slot) {
    const range = dirty.get(bucket);
    if (range) { range.min = Math.min(range.min, slot); range.max = Math.max(range.max, slot); }
    else dirty.set(bucket, { min: slot, max: slot });
  }
  for (const group of groups) {
    const parts = [];
    group.updateMatrix();
    for (const mesh of [...group.children]) {
      mesh.updateMatrix();
      let materials = buckets.get(mesh.geometry);
      if (!materials) { materials = new Map(); buckets.set(mesh.geometry, materials); }
      let bucket = materials.get(mesh.material);
      if (!bucket) { bucket = { geometry: mesh.geometry, material: mesh.material, matrices: [] }; materials.set(mesh.material, bucket); }
      const slot = bucket.matrices.length, local = mesh.matrix.clone();
      bucket.matrices.push(new THREE.Matrix4().multiplyMatrices(group.matrix, local));
      parts.push({ bucket, slot, local, partId: mesh.userData.physicalPart });
    }
    // Validate this group's full shape before detaching any of its parts.
    group.clear();
    let live = true, visible = true;
    const current = group.matrix.clone();
    function publish() {
      for (const { bucket, slot, local } of parts) {
        bucket.mesh.setMatrixAt(slot, visible ? scratch.multiplyMatrices(current, local) : hidden);
        touch(bucket, slot);
      }
    }
    bindings.push({
      group,
      // World-space publication handles translated/rotated/scaled owners.
      // The source metadata anchor is deliberately not mutated here; registry
      // and person publication must happen through their own explicit barrier.
      setWorldMatrix(matrix) {
        if (disposed || !live) return false;
        if (!matrix?.elements?.every(Number.isFinite)) throw new TypeError('Finite prop matrix required');
        root.updateWorldMatrix(true, false);
        if (Math.abs(root.matrixWorld.determinant()) < 1e-12) throw new RangeError('Prop batch parent is singular');
        inverse.copy(root.matrixWorld).invert();
        scratch.multiplyMatrices(inverse, matrix);
        if (current.equals(scratch)) return true;
        current.copy(scratch);
        publish();
        return true;
      },
      setVisible(value) {
        if (disposed || !live) return false;
        if (typeof value !== 'boolean') throw new TypeError('Visibility must be boolean');
        if (visible !== value) { visible = value; publish(); }
        return true;
      },
      release() {
        if (disposed || !live) return false;
        visible = false; publish(); live = false;
        return true;
      },
      describe() {
        return parts.map(({bucket,slot,local,partId}) => ({partId,geometry:bucket.geometry,material:bucket.material,
          mesh:bucket.mesh,slot,localMatrix:local.clone()}));
      },
    });
  }
  for (const materials of buckets.values()) for (const bucket of materials.values()) {
    const mesh = bucket.mesh = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.matrices.length);
    bucket.matrices.forEach((matrix, slot) => mesh.setMatrixAt(slot, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    // External chunk/lake teardown already disposes InstancedMesh buffers.
    // Invalidate bindings immediately, so a late callback cannot republish.
    mesh.addEventListener('dispose', () => { disposed = true; disposedMeshes.add(mesh); dirty.clear(); });
    delete bucket.matrices;
    root.add(mesh); meshes.push(mesh);
  }
  return {
    bindings, meshes,
    flush() {
      if (disposed) return { buckets: 0, matrixBytes: 0 };
      let matrixBytes = 0;
      for (const [bucket, {min,max}] of dirty) {
        const attribute = bucket.mesh.instanceMatrix;
        // Merge with uploads queued before a render, bounding range metadata.
        let start = min * 16, end = (max + 1) * 16;
        for (const range of attribute.updateRanges) { start = Math.min(start, range.start); end = Math.max(end, range.start + range.count); }
        attribute.clearUpdateRanges(); attribute.addUpdateRange(start, end - start);
        attribute.needsUpdate = true;
        bucket.mesh.computeBoundingBox(); bucket.mesh.computeBoundingSphere();
        matrixBytes += (end - start) * Float32Array.BYTES_PER_ELEMENT;
      }
      const count = dirty.size; dirty.clear();
      return { buckets: count, matrixBytes };
    },
    dispose() {
      if (teardownComplete) return;
      teardownComplete = disposed = true; dirty.clear();
      for (const mesh of meshes) { mesh.removeFromParent(); if (!disposedMeshes.has(mesh)) mesh.dispose(); }
    },
  };
}
