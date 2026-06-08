// LEAF entrance arch — two posts + half-torus arch + banner.
// Caller positions the returned group.

import * as THREE from 'three';

export function buildEntranceArch(leafTexture = null) {
  const g = new THREE.Group();
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x4f8a4d, roughness: 0.9, flatShading: true,
  });
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), sideMat);
  left.position.set(-6, 4, 0);
  left.castShadow = true;
  g.add(left);

  const right = left.clone();
  right.position.x = 6;
  g.add(right);

  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(6, 0.4, 8, 24, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xff6f9c, roughness: 0.7, flatShading: true })
  );
  arch.position.set(0, 8, 0);
  arch.castShadow = true;
  g.add(arch);

  if (leafTexture) {
    // Two back-to-back FrontSide planes, NOT one DoubleSide plane: a DoubleSide
    // banner shows the "FESTIVAL" text correct on the front but MIRRORED through
    // the back (A2). Each FrontSide plane renders only its own face, and the back
    // one is rotated 180° so its text reads correctly from behind too.
    const bannerMat = new THREE.MeshStandardMaterial({
      map: leafTexture.diffuse,
      emissive: 0xffe066,
      emissiveMap: leafTexture.emissive,
      emissiveIntensity: 0.55,
      roughness: 0.6,
      side: THREE.FrontSide,
    });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.2), bannerMat);
    front.position.set(0, 10.5, 0.06);
    g.add(front);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.2), bannerMat);
    back.position.set(0, 10.5, -0.06);
    back.rotation.y = Math.PI;
    g.add(back);
  }

  return g;
}
