import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const MERGED_MATS = {
  opaque: new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    flatShading: true,
  }),
  transparent: new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.2,
    transparent: true,
    opacity: 0.85,
    flatShading: true,
  }),
};
for (const mat of Object.values(MERGED_MATS)) mat.userData.shared = true;

// Measurement-only opt-in for the two rejected perf-pass-4 model merges. Tent
// merging predates this pass and stays enabled so ?modelMerge=1 reproduces the
// food-truck + Sugar Shack experiment without changing unrelated scene content.
export const MODEL_DECOR_MERGE_ENABLED = (() => {
  try {
    return new URLSearchParams(globalThis.location?.search || '').get('modelMerge') === '1';
  } catch (_) {
    return false;
  }
})();

const TRACK_MERGE_DECOR = (() => {
  try {
    const host = globalThis.location?.hostname || '';
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.github.dev');
  } catch (_) {
    return false;
  }
})();
const MERGE_DECOR_STATS = { created: 0, disposed: 0 };
export function getMergeDecorStats() {
  return { ...MERGE_DECOR_STATS, live: MERGE_DECOR_STATS.created - MERGE_DECOR_STATS.disposed };
}

function bakeForMerge(geometry, color, matrix) {
  if (!geometry || !geometry.attributes.position || !color) return null;
  let baked = geometry.clone();
  baked.applyMatrix4(matrix);
  if (baked.index) baked = baked.toNonIndexed();
  for (const name of Object.keys(baked.attributes)) {
    if (name !== 'position' && name !== 'normal') baked.deleteAttribute(name);
  }
  if (!baked.attributes.normal) baked.computeVertexNormals();
  const count = baked.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  baked.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return baked;
}

export function mergeStaticDecor(root, options = {}) {
  const castShadow = options.castShadow || {
    opaque: true,
    transparent: false,
  };
  root.updateWorldMatrix(true, true);
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();

  const walk = (object) => {
    if (object !== root && object.userData.noMerge) return;
    // InstancedMesh.isMesh, but its geometry is only the unplaced template.
    if (object.isInstancedMesh) return;
    if (object.isMesh && !object.userData.noMerge) {
      const material = object.material;
      const emissive = material && material.emissive &&
        (material.emissiveIntensity || 0) > 0 &&
        (material.emissive.r || material.emissive.g || material.emissive.b);
      // Texture coordinates cannot be baked into the flat vertex-color material.
      if (material && !Array.isArray(material) && !material.map && !emissive) {
        const blend = material.transparent ? 'transparent' : 'opaque';
        const shadow = typeof castShadow === 'function'
          ? !!castShadow(object, blend)
          : !!castShadow[blend];
        const key = `${blend}:${shadow ? 'cast' : 'no-cast'}`;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { blend, shadow, geometries: [], sources: [] };
          buckets.set(key, bucket);
        }
        const local = new THREE.Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld);
        const baked = bakeForMerge(object.geometry, material.color, local);
        if (baked) {
          bucket.geometries.push(baked);
          bucket.sources.push(object);
        }
      }
    }
    for (const child of object.children) walk(child);
  };
  walk(root);

  for (const bucket of buckets.values()) {
    if (!bucket.geometries.length) continue;
    const merged = BufferGeometryUtils.mergeGeometries(bucket.geometries, false);
    for (const geometry of bucket.geometries) geometry.dispose();
    if (!merged) continue;
    if (TRACK_MERGE_DECOR) {
      merged.userData.mergeDecor = true;
      MERGE_DECOR_STATS.created++;
      let disposalRecorded = false;
      merged.addEventListener('dispose', () => {
        if (disposalRecorded) return;
        disposalRecorded = true;
        MERGE_DECOR_STATS.disposed++;
      });
    }
    for (const object of bucket.sources) {
      object.parent.remove(object);
      if (object.geometry && !object.geometry.userData.shared) object.geometry.dispose();
      if (object.material && !object.material.userData.shared) object.material.dispose();
    }
    const mesh = new THREE.Mesh(merged, MERGED_MATS[bucket.blend]);
    mesh.castShadow = bucket.shadow;
    root.add(mesh);
  }
}
