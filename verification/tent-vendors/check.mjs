import * as THREE from 'three';
import { buildTent, TENT_VENDOR_PROFILES } from '../../src/models/tent.js';
import { mulberry32 } from '../../src/rng.js';

function invariant(condition, message) {
  if (!condition) throw new Error(`tent vendor check failed: ${message}`);
}

function signature(root) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const parts = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    const positions = object.geometry?.attributes?.position?.array || [];
    let sample = '';
    for (let i = 0; i < positions.length; i += Math.max(1, Math.floor(positions.length / 19))) {
      sample += `${Math.round(positions[i] * 1000)},`;
    }
    parts.push(`${object.name}:${positions.length}:${sample}`);
  });
  return `${bounds.min.toArray().map((n) => n.toFixed(4))}|${bounds.max.toArray().map((n) => n.toFixed(4))}|${parts.join(';')}`;
}

function countedRng(seed) {
  const source = mulberry32(seed);
  let calls = 0;
  return { rng: () => { calls++; return source(); }, calls: () => calls };
}

function measure(root) {
  let meshCount = 0;
  let triangles = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshCount++;
    const geometry = object.geometry;
    triangles += geometry?.index
      ? geometry.index.count / 3
      : (geometry?.attributes?.position?.count || 0) / 3;
  });
  return { meshCount, triangles };
}

// Called from the browser console or sandbox fixture after importing this module.
// Builds every trade through the production builder, with a repeatable local RNG.
export function checkTentVendors() {
  const names = [];
  for (let seedIndex = 0; seedIndex < 64; seedIndex++) {
    const profile = TENT_VENDOR_PROFILES[seedIndex % TENT_VENDOR_PROFILES.length];
    const callerSeed = (0x9a410000 + seedIndex) >>> 0;
    const baselineStream = countedRng(callerSeed);
    const baseline = buildTent(baselineStream.rng);
    const expectedCallerDraws = baselineStream.calls();
    const callerStream = countedRng(callerSeed);
    const enhanced = buildTent(callerStream.rng, {
      rng: mulberry32(0x7e170000 + seedIndex), profile: profile.id,
    });
    invariant(callerStream.calls() === expectedCallerDraws,
      `seed ${seedIndex} changed caller RNG consumption (${callerStream.calls()} vs ${expectedCallerDraws})`);
    const before = measure(baseline);
    const after = measure(enhanced);
    invariant(after.meshCount <= before.meshCount + 2,
      `${profile.id} adds more than two draws at seed ${seedIndex}: ${before.meshCount} → ${after.meshCount}`);
    invariant(after.triangles <= before.triangles + 3000,
      `${profile.id} adds more than 3,000 triangles at seed ${seedIndex}: ${before.triangles} → ${after.triangles}`);
  }

  for (let index = 0; index < TENT_VENDOR_PROFILES.length; index++) {
    const { id } = TENT_VENDOR_PROFILES[index];
    const callerStream = countedRng(0x9a410000 + index);
    const tent = buildTent(callerStream.rng, {
      rng: mulberry32(0x7e170000 + index),
      profile: id,
    });
    invariant(tent.userData.vendorProfile === id, `${id} profile metadata is missing`);

    const unmerged = buildTent(() => 0.37, {
      rng: mulberry32(0x7e170000 + index), profile: id, merge: false,
    });
    unmerged.updateMatrixWorld(true);
    const merchandiseBounds = new THREE.Box3();
    let foundMerchandise = false;
    let foundPrimaryDisplay = false;
    unmerged.traverse((object) => {
      if (!object.userData.vendorMerchandise) return;
      const bounds = new THREE.Box3().setFromObject(object);
      merchandiseBounds.union(bounds);
      foundMerchandise = true;
      if (object.userData.primaryDisplay && object.userData.vendorLayout === TENT_VENDOR_PROFILES[index].layouts[0]) {
        foundPrimaryDisplay = true;
      }
    });
    invariant(foundMerchandise, `${id} has no inspectable merchandise display`);
    invariant(foundPrimaryDisplay, `${id} is missing its guaranteed primary merchandise`);
    invariant(merchandiseBounds.min.x >= -2.25 && merchandiseBounds.max.x <= 2.25,
      `${id} merchandise exceeds the 4.5m tent width`);
    invariant(merchandiseBounds.min.z >= -2.25 && merchandiseBounds.max.z <= 2.25,
      `${id} merchandise exceeds the 4.5m tent depth`);

    let casters = 0;
    let sharedResources = 0;
    const pooled = new Set();
    tent.traverse((object) => {
      if (object.isMesh) {
        if (object.castShadow) casters++;
      }
      for (const resource of [object.geometry, ...(Array.isArray(object.material) ? object.material : [object.material])]) {
        if (resource?.userData?.shared) { sharedResources++; pooled.add(resource); }
      }
    });
    invariant(casters <= 3, `${id} has unexpected shadow caster growth (${casters})`);
    invariant(sharedResources > 0, `${id} lost shared pooled resources`);

    const again = buildTent(mulberry32(0x9a410000 + index), {
      rng: mulberry32(0x7e170000 + index),
      profile: id,
    });
    invariant(signature(tent) === signature(again), `${id} is not deterministic for a fixed seed`);
    let sharedAcrossBuilds = false;
    again.traverse((object) => {
      for (const resource of [object.geometry, ...(Array.isArray(object.material) ? object.material : [object.material])]) {
        if (pooled.has(resource)) sharedAcrossBuilds = true;
      }
    });
    invariant(sharedAcrossBuilds, `${id} does not reuse shared resources across builds`);
    names.push(id);
  }
  return { pass: true, profiles: names, count: names.length };
}
