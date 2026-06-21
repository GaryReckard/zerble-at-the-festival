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
  }
  add(...objs) { this.children.push(...objs); return this; }
}
export class Group extends Object3DStub {}
export class Mesh extends Object3DStub {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
}

// Geometries: tree.js tags module-level ones with .userData.shared = true.
class GeometryStub { constructor() { this.userData = {}; } }
export class CylinderGeometry extends GeometryStub {}
export class IcosahedronGeometry extends GeometryStub {}
export class ConeGeometry extends GeometryStub {}
export class BoxGeometry extends GeometryStub {}

// Materials: constructed with an options object; tagged .userData.shared.
export class MeshStandardMaterial {
  constructor(params = {}) { this.userData = {}; Object.assign(this, params); }
}

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
}
export class Color {
  setHex() { return this; }
}
export class InstancedBufferAttribute {
  constructor(array) { this.array = array; this.needsUpdate = false; }
}
export class InstancedMesh {
  constructor(geometry, material, count) {
    this.geometry = geometry; this.material = material; this.count = count;
    this.userData = {}; this.castShadow = false;
    this.instanceMatrix = { needsUpdate: false };
    this.instanceColor = null;
  }
  setMatrixAt() {}
  setColorAt() { if (!this.instanceColor) this.instanceColor = { needsUpdate: false }; }
  computeBoundingSphere() {}
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
