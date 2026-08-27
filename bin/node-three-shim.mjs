// Node ESM resolve hook: map the bare `three` specifier to a minimal stub so
// browser-only src modules (registry.js, models/tree.js et al.) can be imported
// and unit-tested under plain `node` in this no-build repo. The stub exports just
// enough of the three.js surface those modules touch at load/exercise time.
// Vector3 covers registry.add()'s default-position fallback; the scene-graph +
// geometry/material stubs cover models/tree.js so bin/test-forest-determinism can
// import the REAL builders and hash their rng-derived descriptor stream (the
// stubs are no-ops — the gate hashes rng-derived numbers, not geometry math).
// Extend the stub source below if a module under test reaches for more of THREE.
//
// Register it before importing the module under test:
//   import { register } from 'node:module';
//   register('./node-three-shim.mjs', import.meta.url);
//   const mod = await import('../src/registry.js');

const STUB = `
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

// Scene-graph nodes: tree.js sets .position.y, .castShadow, .userData.* and
// calls .add(). No transforms are evaluated — just property bags.
class Object3DStub {
  constructor() {
    this.userData = {};
    this.children = [];
    this.castShadow = false;
    this.position = new Vector3();
    this.scale = new Vector3();
    this.rotation = new Vector3();
    this.matrix = new Matrix4();
  }
  add(...objs) { for (const o of objs) { this.children.push(o); o.parent = this; } return this; }
  remove(...objs) { this.children = this.children.filter((c) => !objs.includes(c)); for (const o of objs) o.parent = null; return this; }
  updateMatrix() { return this; }
}
export class Object3D extends Object3DStub {}
export class Group extends Object3DStub {}
export class Mesh extends Object3DStub {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
}

// Geometries: tree.js tags module-level ones with .userData.shared = true.
// disposeCount lets bin/test-far-field assert owner-only disposal idempotence.
class GeometryStub {
  constructor() { this.userData = {}; this.disposeCount = 0; this.boundingSphere = null; }
  dispose() { this.disposeCount++; }
}
export class CylinderGeometry extends GeometryStub {}
export class IcosahedronGeometry extends GeometryStub {}
export class ConeGeometry extends GeometryStub {}
export class BoxGeometry extends GeometryStub {}
export class RingGeometry extends GeometryStub {}
export class TorusGeometry extends GeometryStub {}
export class CapsuleGeometry extends GeometryStub {}
export class SphereGeometry extends GeometryStub {}
export class OctahedronGeometry extends GeometryStub {}

// BufferGeometry + BufferAttribute: farField.js's preallocated road ribbon
// writes typed arrays in place and exposes the active prefix via setDrawRange.
// The stub stores everything so tests can read the written arrays back.
export class BufferGeometry extends GeometryStub {
  constructor() { super(); this.attributes = {}; this.index = null; this.drawRange = { start: 0, count: Infinity }; }
  setAttribute(name, attr) { this.attributes[name] = attr; return this; }
  setIndex(attr) { this.index = attr; return this; }
  setDrawRange(start, count) { this.drawRange = { start, count }; return this; }
}
export class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.needsUpdate = false; }
  setUsage() { return this; }
}
export class Sphere {
  constructor(center = new Vector3(), radius = -1) { this.center = center; this.radius = radius; }
}
export const DynamicDrawUsage = 35048;

// Materials: constructed with an options object; tagged .userData.shared.
export class MeshStandardMaterial {
  constructor(params = {}) {
    this.userData = {};
    this.disposeCount = 0;
    Object.assign(this, params);
    this.color = new Color();               // always a Color object, like real three
    if (params.color != null) this.color.setHex(params.color);
  }
  dispose() { this.disposeCount++; }
}
export class MeshBasicMaterial extends MeshStandardMaterial {}
export const DoubleSide = 2;
export const AdditiveBlending = 2;

// Math + instancing: tree.js constructs Matrix4/Color at module scope (CG3
// instancing temps) and InstancedMesh inside buildForestInstanced. The
// determinism gate never calls buildForestInstanced (it hashes the rng-derived
// descriptor stream), so these only need to construct as chainable no-ops for
// the module to import. The methods return \`this\` so any future instancing
// unit-test can drive them without NaNs.
export class Matrix4 {
  makeTranslation() { return this; }
  makeRotationY() { return this; }
  makeScale() { return this; }
  multiply() { return this; }
  scale() { return this; }
  setPosition() { return this; }
}
export class Color {
  constructor() { this.r = 0; this.g = 0; this.b = 0; }
  setHex(hex) { const h = hex | 0; this.r = ((h >> 16) & 255) / 255; this.g = ((h >> 8) & 255) / 255; this.b = (h & 255) / 255; return this; }
  setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
  setScalar(s) { this.r = s; this.g = s; this.b = s; return this; }
  multiplyScalar(s) { this.r *= s; this.g *= s; this.b *= s; return this; }
}
export class InstancedBufferAttribute {
  constructor(array) { this.array = array; this.needsUpdate = false; }
}
export class InstancedMesh {
  constructor(geometry, material, count) {
    this.geometry = geometry; this.material = material; this.count = count;
    this.userData = {}; this.castShadow = false; this.receiveShadow = false;
    this.visible = true; this.frustumCulled = true; this.disposeCount = 0;
    this.position = new Vector3(); this.parent = null; this.boundingSphere = null;
    this.instanceMatrix = { needsUpdate: false, setUsage() { return this; } };
    this.instanceColor = null;
  }
  setMatrixAt() {}
  setColorAt() { if (!this.instanceColor) this.instanceColor = { needsUpdate: false }; }
  computeBoundingSphere() {}
  dispose() { this.disposeCount++; }
}
`;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return {
      url: 'data:text/javascript,' + encodeURIComponent(STUB),
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
