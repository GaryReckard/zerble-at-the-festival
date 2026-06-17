// Constant-count light pool for PERF.contextLights-gated proxy lights
// (campsite firepits, drum-circle pits, Sugar Shack spots, etc).
//
// Three.js's forward renderer runs the per-fragment lighting equation
// against EVERY active light in the scene for every fragment of every
// lit material. Even a "far away" light with short distance falloff
// still pays this cost — `distance` clamps the CONTRIBUTION, not the
// shader work. So we want only the handful of nearest lights live.
//
// NAIVE APPROACH (and why it's gone): toggle `light.visible` on the
// model-owned lights. That works visually, but three.js BAKES the active
// light count (NUM_POINT_LIGHTS / NUM_SPOT_LIGHTS) into every material's
// shader program cache key. As the camera drives and the visible count
// wobbles 0..8, the renderer compiles — and caches forever — a fresh
// program per (pointCount, spotCount, material-config) combo. Driving a
// few hubs leaked ~220 MeshStandardMaterial programs (renderer.info.
// programs climbing 13 -> 220) and stuttered worse the longer you played.
//
// FIX: keep a FIXED pool of pool-lights, always in the scene, always
// visible, so the scene's point/spot counts NEVER change and the program
// cache stops growing. Model-owned lights become invisible param/transform
// carriers; each frame we copy the nearest ones' world position + color +
// intensity (+ spot aim) into the pool slots and dim the unused slots to
// intensity 0. An intensity-0 light still counts toward NUM_*_LIGHTS — that
// constant cost (POINT_POOL + SPOT_POOL lights) is exactly the budget this
// system was always meant to cap at, just held steady instead of wobbling.
//
// Models still call `register(light)` once when they build, and the light
// stays parented to the model group so it world-tracks and prunes lazily
// on chunk unload (orphaned == no `.parent`).

import * as THREE from 'three';

const _registry = [];
const _tmpV = new THREE.Vector3();
const _tmpTarget = new THREE.Vector3();

const MAX_DISTANCE = 45;
const MAX_DISTANCE_SQ = MAX_DISTANCE * MAX_DISTANCE;

// Constant pool sizes. The scene's point/spot light counts are pinned here
// and never change at runtime, which is the whole point. Sized to cover the
// realistic worst case of each type independently (a 6-SpotLight stage; a
// cluster of campfire/drum PointLights) without the old mixed-budget wobble.
// Bump these if a denser cluster needs more simultaneous lights.
const POINT_POOL = 6;
const SPOT_POOL = 6;

// Cached sort buffer — reused each frame to avoid GC churn.
const _candidates = [];

let _pool = null;

function _ensurePool(scene) {
  if (_pool) return;
  _pool = { point: [], spot: [] };
  for (let i = 0; i < POINT_POOL; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 0, 2);
    l.castShadow = false;
    l.userData.shared = true; // chunk/lake disposal walks skip shared resources
    scene.add(l);
    _pool.point.push(l);
  }
  for (let i = 0; i < SPOT_POOL; i++) {
    const l = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 6, 0.3, 2);
    l.castShadow = false;
    l.userData.shared = true;
    scene.add(l);
    scene.add(l.target);
    _pool.spot.push(l);
  }
}

export function register(light) {
  // Becomes an invisible carrier: never rendered directly, so it contributes
  // nothing to the (constant) scene light count. The pool does the rendering.
  light.visible = false;
  _registry.push(light);
}

// Optional explicit unregistration. Not required — the dead-parent prune in
// update() handles cleanup lazily on chunk unload.
export function unregister(light) {
  const idx = _registry.indexOf(light);
  if (idx >= 0) _registry.splice(idx, 1);
}

export function update(cameraPos, scene) {
  // Stay a pure no-op on the shipped default path. `register()` is gated by
  // PERF.contextLights at every call site, so with the feature off nothing
  // ever registers and `_registry` stays empty — in that case we must NOT
  // spin up the pool, or every default player's scene would gain 12 always-on
  // lights (bumping NUM_*_LIGHTS for the whole game). The pool only ever
  // materializes once a model has registered a light, i.e. the feature is on.
  if (!_pool && _registry.length === 0) return;

  _ensurePool(scene);

  // Lazy prune orphans (chunk unloaded -> parent chain gone). Keep every
  // surviving carrier dark; the pool is the only thing that renders.
  for (let i = _registry.length - 1; i >= 0; i--) {
    const l = _registry[i];
    if (!l.parent) {
      _registry.splice(i, 1);
    } else if (l.visible) {
      l.visible = false;
    }
  }

  _candidates.length = 0;
  for (const light of _registry) {
    light.getWorldPosition(_tmpV);
    const dx = _tmpV.x - cameraPos.x;
    const dy = _tmpV.y - cameraPos.y;
    const dz = _tmpV.z - cameraPos.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > MAX_DISTANCE_SQ) continue;
    _candidates.push(light);
    light.userData._ctxD2 = d2;
  }

  // Closest first, so the nearest sources win their pool slots.
  _candidates.sort((a, b) => a.userData._ctxD2 - b.userData._ctxD2);

  let pi = 0;
  let si = 0;
  for (const src of _candidates) {
    if (src.isSpotLight) {
      if (si >= SPOT_POOL) continue;
      const dst = _pool.spot[si++];
      src.getWorldPosition(_tmpV);
      dst.position.copy(_tmpV);
      src.target.getWorldPosition(_tmpTarget);
      dst.target.position.copy(_tmpTarget);
      dst.angle = src.angle;
      dst.penumbra = src.penumbra;
      dst.color.copy(src.color);
      dst.intensity = src.intensity;
      dst.distance = src.distance;
      dst.decay = src.decay;
    } else {
      if (pi >= POINT_POOL) continue;
      const dst = _pool.point[pi++];
      src.getWorldPosition(_tmpV);
      dst.position.copy(_tmpV);
      dst.color.copy(src.color);
      dst.intensity = src.intensity;
      dst.distance = src.distance;
      dst.decay = src.decay;
    }
  }

  // Dim the slots no source claimed this frame (they stay visible — the
  // light count must not change — but contribute nothing).
  for (; pi < POINT_POOL; pi++) _pool.point[pi].intensity = 0;
  for (; si < SPOT_POOL; si++) _pool.spot[si].intensity = 0;
}

export function _debugRegistrySize() {
  return _registry.length;
}
