export async function checkSmiles() {
  const { Smiles } = await import('../../src/smiles.js');
  const THREE = await import('three');
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const smiles = new Smiles();
  const target = { position: new THREE.Vector3(10, 0, 4) };
  let collected = 0;
  smiles.spawn(new THREE.Vector3());
  const first = smiles.active[0];
  assert(first.face && !first.face.castShadow, 'Earned orb needs a shadow-free face');
  assert(smiles._faceGeo.attributes.position.count / 3 === 64, 'Face must stay one small mesh');
  assert([...smiles._faceGeo.attributes.position.array].every(Number.isFinite), 'Face vertices must be finite');
  for (const dt of [0.1, 0.2, 0.016]) {
    const before = first.mesh.position.clone();
    smiles.update(dt, target, n => { collected += n; });
    const movement = first.mesh.position.clone().sub(before).normalize();
    const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(first.face.quaternion);
    assert(facing.dot(movement) > 0.999, 'Face must lead actual rise/homing motion');
  }
  target.position.set(-8, 2, -6);
  const before = first.mesh.position.clone();
  smiles.update(0.016, target, () => {});
  const movement = first.mesh.position.clone().sub(before).normalize();
  assert(new THREE.Vector3(0, 0, 1).applyQuaternion(first.face.quaternion).dot(movement) > 0.999, 'Face must follow changed target direction');
  smiles.spawn(new THREE.Vector3(0, 0, 0));
  assert(smiles.active[1].face.geometry === first.face.geometry && smiles.active[1].face.material === first.face.material, 'Earned faces must share resources');
  target.position.copy(smiles.active[1].mesh.position);
  smiles.update(0, target, n => { collected += n; });
  assert(collected === 1, 'Face must not change collection scoring');
  smiles.spawnLost(new THREE.Vector3(), { pos: new THREE.Vector3(20, 0, 0) });
  assert(!smiles.active.at(-1).mesh.getObjectByName('SmileFace'), 'Lost orbs must not wear a happy face');
  const geometries = new Set(), materials = new Set();
  smiles.group.traverse(n => { if (n.geometry) geometries.add(n.geometry); if (n.material) materials.add(n.material); });
  for (const geo of [smiles._geo, smiles._faceGeo, smiles._minusGeo, ...geometries]) geometries.add(geo);
  for (const mat of [smiles._mat, smiles._lostMat, smiles._faceMat, smiles._minusMat, ...materials]) materials.add(mat);
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
  return 'PASS: face geometry, sharing, rise/homing direction, target changes, scoring, and lost-smile distinction';
}
