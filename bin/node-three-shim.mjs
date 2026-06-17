// Node ESM resolve hook: map the bare `three` specifier to a minimal stub so
// browser-only src modules (registry.js et al.) can be imported and unit-tested
// under plain `node` in this no-build repo. The stub exports just enough of the
// three.js surface those modules touch at load/exercise time (currently only
// Vector3, used by registry.add()'s default-position fallback). Extend the stub
// source below if a module under test reaches for more of THREE.
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
