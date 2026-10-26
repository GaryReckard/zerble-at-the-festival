import * as THREE from 'three';
import { buildLantern, puppetRandom } from './paradeLanterns.js';
export { PARADE_ROSTER } from './paradeLanterns.js';

const UP = new THREE.Vector3(0, 1, 0);
const _from = new THREE.Vector3(), _to = new THREE.Vector3(), _delta = new THREE.Vector3();

export function buildPuppet(kind = 'heron', seed = 0) {
  const root = new THREE.Group();
  root.name = `Puppet-${kind}`;
  const lantern = buildLantern(kind, seed);
  const heldRig = new THREE.Group();
  root.add(heldRig);
  heldRig.add(lantern.group);
  const carriers = [], poles = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x55432f, roughness: 1 });
  for (let i = 0; i < lantern.attachments.length; i++) {
    const anchor = lantern.attachments[i];
    const carrier = buildSimpleNPC([0x363245, 0x425c55, 0x654858][i], 0xd8b493, { armPose: 'carry', pantsHex: 0x282936 });
    carrier.position.set(0, 0, kind === 'dragon' ? anchor[2] : 0.36);
    carrier.name = `${kind}-carrier-${i}`;
    root.add(carrier);
    carriers.push(carrier);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), poleMat);
    pole.name = `${kind}-support-${i}`;
    root.add(pole);
    poles.push({ mesh: pole, carrier, top: new THREE.Vector3(...anchor) });
  }
  root.userData = { kind, seed, phase: puppetRandom(seed, 101) * Math.PI * 2,
    time: 0, rig: { ...lantern, heldRig, carriers, poles } };
  setPuppetNightness(root, 0);
  setPuppetTime(root, 0);
  return root;
}

export function setPuppetTime(model, seconds) {
  const u = model.userData, rig = u.rig;
  u.time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const gait = u.time * Math.PI * 2 / 1.8 + u.phase;
  rig.heldRig.position.y = Math.sin(gait * 2) * 0.035;
  rig.heldRig.rotation.z = Math.sin(gait) * 0.012;
  for (const part of rig.moving) part.node.rotation[part.axis] = Math.sin(gait * part.rate + part.phase) * part.amount;
  for (let i = 0; i < rig.carriers.length; i++) {
    const carrier = rig.carriers[i];
    carrier.userData.carryRig.position.y = Math.sin(gait * 2) * 0.025;
    for (let j = 0; j < 2; j++) carrier.userData.walkLegs[j].rotation.x = Math.sin(gait + j * Math.PI + i * 0.2) * 0.22;
  }
  model.updateMatrixWorld(true);
  for (const pole of rig.poles) {
    // Hands share a central grip; the pole terminates at the moving frame.
    pole.carrier.userData.grip.getWorldPosition(_from);
    _to.copy(pole.top);
    rig.group.localToWorld(_to);
    model.worldToLocal(_from);
    model.worldToLocal(_to);
    _delta.subVectors(_to, _from);
    pole.mesh.position.copy(_from).add(_to).multiplyScalar(0.5);
    pole.mesh.scale.y = _delta.length();
    pole.mesh.quaternion.setFromUnitVectors(UP, _delta.normalize());
  }
  u.pose = (u.time / 1.8) % 1;
}

export function setPuppetNightness(model, nightness) {
  const n = THREE.MathUtils.clamp(nightness, 0, 1);
  for (const glow of model.userData.rig.glow) glow.material.emissiveIntensity = 0.025 + n * glow.intensity;
  model.userData.nightness = n;
}

export function tickPuppet(model, dt) {
  setPuppetTime(model, model.userData.time + (Number.isFinite(dt) ? Math.max(0, dt) : 0));
}

const _npcMatPool = new Map();
function _npcMat(hex, roughness, key) {
  const cacheKey = `${key}:${hex.toString(16)}`;
  if (!_npcMatPool.has(cacheKey)) {
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness, flatShading: true });
    m.userData.shared = true;
    _npcMatPool.set(cacheKey, m);
  }
  return _npcMatPool.get(cacheKey);
}
const _SHOE_MAT = _npcMat(0x111, 0.8, 'shoe');
const _EYE_MAT = _npcMat(0x111, 0.8, 'eye');
const _LEG_GEO = new THREE.CylinderGeometry(0.10, 0.10, 0.65, 8);
const _SHOE_GEO = new THREE.BoxGeometry(0.16, 0.07, 0.24);
const _TORSO_GEO = new THREE.CapsuleGeometry(0.26, 0.55, 4, 8);
const _UPPER_GEO = new THREE.CapsuleGeometry(0.08, 0.30, 4, 6);
const _LOWER_GEO = new THREE.CapsuleGeometry(0.07, 0.28, 4, 6);
const _HEAD_GEO = new THREE.IcosahedronGeometry(0.26, 1);
const _EYE_GEO = new THREE.SphereGeometry(0.028, 6, 6);
for (const geo of [_LEG_GEO, _SHOE_GEO, _TORSO_GEO, _UPPER_GEO, _LOWER_GEO, _HEAD_GEO, _EYE_GEO]) geo.userData.shared = true;

export function buildSimpleNPC(shirtHex, skinHex, opts = {}) {
  const { armPose = 'rest', pantsHex = 0x223a5c } = opts;
  const g = new THREE.Group();
  const shirtMat = _npcMat(shirtHex, 0.9, 'shirt');
  const skinMat = _npcMat(skinHex, 0.9, 'skin');
  const pantsMat = _npcMat(pantsHex, 0.92, 'pants');
  const carry = armPose === 'carry';
  const upperRoot = carry ? new THREE.Group() : g;
  const walkLegs = [];
  const shoulders = [], elbows = [];
  if (carry) g.add(upperRoot);
  for (const lx of [-0.12, 0.12]) {
    const pivot = carry ? new THREE.Group() : g;
    if (carry) { pivot.position.set(lx, 0.65, 0); g.add(pivot); walkLegs.push(pivot); }
    const leg = new THREE.Mesh(_LEG_GEO, pantsMat);
    leg.position.set(carry ? 0 : lx, carry ? -0.33 : 0.32, 0);
    pivot.add(leg);
    const shoe = new THREE.Mesh(_SHOE_GEO, _SHOE_MAT);
    shoe.position.set(carry ? 0 : lx, carry ? -0.62 : 0.03, -0.06);
    pivot.add(shoe);
  }
  const torso = new THREE.Mesh(_TORSO_GEO, shirtMat);
  torso.position.y = 1.0;
  torso.castShadow = true;
  upperRoot.add(torso);
  for (const sx of [-1, 1]) {
    if (carry) {
      const a = new THREE.Vector3(sx * 0.30, 1.20, 0);
      const b = new THREE.Vector3(sx * 0.26, 0.94, -0.18);
      const c = new THREE.Vector3(0, 1.38, -0.35);
      for (const [from, to, mat] of [[a, b, shirtMat], [b, c, skinMat]]) {
        const delta = to.clone().sub(from);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, delta.length(), 6), mat);
        arm.position.copy(from).add(to).multiplyScalar(0.5);
        arm.quaternion.setFromUnitVectors(UP, delta.normalize());
        upperRoot.add(arm);
      }
      continue;
    }
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.30, 1.20, 0);
    shoulder.rotation.z = sx * 0.05;
    const upper = new THREE.Mesh(_UPPER_GEO, shirtMat);
    upper.position.y = -0.18;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.36;
    if (armPose === 'instrument') { shoulder.rotation.x = 0.6; elbow.rotation.x = 0.5; }
    else if (armPose === 'trumpet') { shoulder.rotation.x = 0.6; shoulder.rotation.z = sx * 0.5; elbow.rotation.x = 1.6; }
    else if (armPose === 'overhead') { shoulder.rotation.z = Math.PI; elbow.rotation.z = sx * 0.12; }
    shoulder.add(elbow);
    const lower = new THREE.Mesh(_LOWER_GEO, skinMat);
    lower.position.y = -0.18;
    elbow.add(lower);
    g.add(shoulder);
    shoulders.push(shoulder); elbows.push(elbow);
  }
  const head = new THREE.Mesh(_HEAD_GEO, skinMat);
  head.position.y = 1.65;
  head.castShadow = true;
  upperRoot.add(head);
  for (const ex of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(_EYE_GEO, _EYE_MAT);
    eye.position.set(ex, 1.68, -0.22);
    upperRoot.add(eye);
  }
  if (carry) {
    const grip = new THREE.Object3D();
    grip.position.set(0, 1.38, -0.35);
    upperRoot.add(grip);
    g.userData = { grip, carryRig: upperRoot, walkLegs };
  }
  g.userData.shoulders = shoulders;
  g.userData.elbows = elbows;
  return g;
}
