import * as THREE from 'three';
import { buildPuppet, setPuppetTime, tickPuppet, setPuppetNightness, buildSimpleNPC, PARADE_ROSTER } from '../../src/models/puppet.js';
import { PuppetParade } from '../../src/obstacles.js';

function assert(test, message) { if (!test) throw new Error(message); }

export function disposePuppet(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse(n => {
    if (n.geometry && !n.geometry.userData.shared) geometries.add(n.geometry);
    if (n.material && !n.material.userData.shared) materials.add(n.material);
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
}

function geometryHash(root) {
  let hash = 2166136261;
  root.traverse(n => {
    if (!n.geometry) return;
    for (const value of n.geometry.attributes.position.array) hash = Math.imul(hash ^ Math.round(value * 1e5), 16777619);
  });
  return hash >>> 0;
}

function checkPose(model) {
  model.updateMatrixWorld(true);
  let maximumError = 0;
  for (const pole of model.userData.rig.poles) {
    const bottom = new THREE.Vector3(0, -0.5, 0).applyMatrix4(pole.mesh.matrixWorld);
    const top = new THREE.Vector3(0, 0.5, 0).applyMatrix4(pole.mesh.matrixWorld);
    const grip = pole.carrier.userData.grip.getWorldPosition(new THREE.Vector3());
    const attachment = model.userData.rig.group.localToWorld(pole.top.clone());
    maximumError = Math.max(maximumError, bottom.distanceTo(grip), top.distanceTo(attachment));
  }
  assert(maximumError < 1e-6, `${model.name}: disconnected pole (${maximumError})`);
  model.traverse(n => assert(n.matrixWorld.elements.every(Number.isFinite), `${n.name}: invalid transform`));
  return maximumError;
}

export function checkParade() {
  const subjects = [];
  for (const kind of PARADE_ROSTER) {
    const model = buildPuppet(kind, 7), duplicate = buildPuppet(kind, 7);
    try {
      assert(geometryHash(model) === geometryHash(duplicate), `${kind}: nondeterministic geometry`);
      let draws = 0, triangles = 0;
      const geometries = new Set(), materials = new Set();
      model.traverse(n => {
        if (!n.isMesh) return;
        draws++;
        assert(n.geometry, `${kind}: failed geometry merge`);
        for (const key of ['position', 'normal']) assert(n.geometry.attributes[key].array.every(Number.isFinite), `${kind}: invalid ${key}`);
        triangles += (n.geometry.index?.count ?? n.geometry.attributes.position.count) / 3;
        geometries.add(n.geometry);
        materials.add(n.material);
      });
      const bounds = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      assert(bounds.y > 2.5 && bounds.y < 6.5, `${kind}: invalid height ${bounds.y}`);
      model.position.set(20, 0, -13);
      model.rotation.y = 1.3;
      const parent = new THREE.Group();
      parent.position.set(-7, 0, 5);
      parent.rotation.y = -0.8;
      parent.add(model);
      parent.updateMatrixWorld(true);
      let poleError = 0;
      for (let i = 0; i <= 120; i++) {
        setPuppetTime(model, i * 1.8 / 120);
        poleError = Math.max(poleError, checkPose(model));
      }
      assert(model.position.x === 20 && model.rotation.y === 1.3, `${kind}: ticker changed root`);
      setPuppetTime(model, 0.4);
      const pose = model.userData.rig.heldRig.matrixWorld.clone();
      tickPuppet(model, 0);
      model.updateMatrixWorld(true);
      assert(pose.equals(model.userData.rig.heldRig.matrixWorld), `${kind}: dt=0 moved pose`);
      for (let i = 0; i < 120; i++) tickPuppet(model, 0.016);
      model.traverse(n => {
        if (n.isMesh) assert(geometries.has(n.geometry) && materials.has(n.material), `${kind}: resources replaced on tick`);
      });
      setPuppetNightness(model, 0);
      const day = model.userData.rig.glow.map(g => g.material.emissiveIntensity);
      setPuppetNightness(model, 1);
      assert(model.userData.rig.glow.every((g, i) => g.material.emissiveIntensity > day[i]), `${kind}: night glow missing`);
      subjects.push({ kind, draws, triangles, bounds: bounds.toArray(), poleError });
    } finally { disposePuppet(model); disposePuppet(duplicate); }
  }
  const parade = new PuppetParade({ preview: true });
  try {
    assert(parade.puppets.length === 6 && parade.colliders.length === 8, 'roster/collider count');
    const identities = [...parade.puppets];
    for (let i = 0; i < 1800; i++) {
      if (i === 60) parade.scatter({ position: parade.puppets[1].position.clone().add(new THREE.Vector3(0, 0, 4)), forwardWorld: new THREE.Vector3(0, 0, -1) });
      parade.update(0.1, null);
      for (const c of parade.colliders) {
        const actual = c.carrier.getWorldPosition(new THREE.Vector3());
        assert(Math.hypot(c.position.x - actual.x, c.position.z - actual.z) < 1e-6, 'collider drift');
        assert(c.kind === 'puppet' && c.damage === 8, 'collision policy changed');
      }
    }
    parade._preview = false;
    parade.update(0, new THREE.Vector3(4000, 0, 4000));
    assert(parade.puppets.every((p, i) => p === identities[i]), 'relocation rebuilt models');
    for (const p of parade.puppets) checkPose(p);
  } finally { disposePuppet(parade.group); }
  const npc = buildSimpleNPC(0x123456, 0xabcdef);
  assert(npc.children.length === 10 && !npc.userData.carryRig, 'default NPC structure changed');
  disposePuppet(npc);
  return { pass: true, subjects, controllerSteps: 1800, colliders: 8 };
}
