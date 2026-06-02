// Bubble-juice jug — a rare floating, glowing pickup. Drive over it to refill
// the bubble meter. Modeled on a classic gallon bubble-solution jug (white
// squarish body, coloured cap, bright label). Group-anchored at (0,0,0); the
// caller positions it (it floats slightly above ground). The contents sit on
// an inner pivot so `userData.anim(dt)` can bob + spin them without moving the
// group origin the spawner placed.
//
// Materials/geometries are module-pooled + tagged `userData.shared` so the
// chunk-unload disposal walk skips them (a jug is chunk-parented while it
// waits to be collected — perf footgun #6).

import * as THREE from 'three';

const _mat = {};
function mat(key, opts) {
  if (_mat[key]) return _mat[key];
  const m = new THREE.MeshStandardMaterial(opts);
  m.userData.shared = true;
  _mat[key] = m;
  return m;
}

const _geo = {};
function geo(key, make) {
  if (_geo[key]) return _geo[key];
  const g = make();
  g.userData.shared = true;
  _geo[key] = g;
  return g;
}

export function buildBubbleJug() {
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  group.add(pivot);

  // White translucent-ish body with a faint cyan inner glow so it reads as
  // full of glowing bubble juice (emissive + bloom makes it findable).
  const bodyMat = mat('body', {
    color: 0xeaf6ff, roughness: 0.35, metalness: 0.0,
    emissive: 0x2bb8e6, emissiveIntensity: 0.5, flatShading: true,
  });
  const capMat = mat('cap', { color: 0xff6f3c, roughness: 0.6, flatShading: true });
  const labelMat = mat('label', {
    color: 0xb5179e, roughness: 0.5,
    emissive: 0xff3df0, emissiveIntensity: 0.6, flatShading: true,
  });
  const bubbleMat = mat('bubble', {
    color: 0xffffff, roughness: 0.2,
    emissive: 0xbfeaff, emissiveIntensity: 0.7, flatShading: true,
  });

  // Body — squarish gallon jug.
  const body = new THREE.Mesh(geo('body', () => new THREE.BoxGeometry(0.42, 0.46, 0.34)), bodyMat);
  body.position.y = 0.25;
  body.castShadow = true;
  pivot.add(body);

  // Shoulder taper + neck + cap.
  const shoulder = new THREE.Mesh(geo('shoulder', () => new THREE.BoxGeometry(0.3, 0.12, 0.24)), bodyMat);
  shoulder.position.y = 0.52;
  pivot.add(shoulder);
  const neck = new THREE.Mesh(geo('neck', () => new THREE.CylinderGeometry(0.07, 0.08, 0.08, 8)), bodyMat);
  neck.position.y = 0.61;
  pivot.add(neck);
  const cap = new THREE.Mesh(geo('cap', () => new THREE.CylinderGeometry(0.095, 0.095, 0.08, 8)), capMat);
  cap.position.y = 0.68;
  pivot.add(cap);

  // Handle — a small loop on the back-left shoulder.
  const handle = new THREE.Mesh(geo('handle', () => new THREE.TorusGeometry(0.1, 0.028, 6, 12)), bodyMat);
  handle.position.set(-0.16, 0.5, 0);
  handle.rotation.y = Math.PI / 2;
  pivot.add(handle);

  // Front label panel + a few little bubbles printed on it.
  const label = new THREE.Mesh(geo('label', () => new THREE.BoxGeometry(0.3, 0.3, 0.02)), labelMat);
  label.position.set(0, 0.27, 0.18);
  pivot.add(label);
  const dotGeo = geo('dot', () => new THREE.SphereGeometry(0.035, 8, 6));
  for (const [dx, dy, r] of [[-0.07, 0.33, 1], [0.06, 0.3, 0.8], [0.0, 0.22, 1.1], [0.09, 0.2, 0.6]]) {
    const dot = new THREE.Mesh(dotGeo, bubbleMat);
    dot.position.set(dx, dy, 0.2);
    dot.scale.setScalar(r);
    pivot.add(dot);
  }

  // A soft emissive halo billboard so the jug glows from a distance (helps the
  // player spot a rare pickup). Cheap additive sprite-ish plane.
  const halo = new THREE.Mesh(
    geo('halo', () => new THREE.SphereGeometry(0.5, 10, 8)),
    mat('halo', { color: 0x7fe8ff, transparent: true, opacity: 0.12, emissive: 0x7fe8ff, emissiveIntensity: 0.8, depthWrite: false }),
  );
  halo.position.y = 0.3;
  pivot.add(halo);

  let t = Math.random() * 10;
  group.userData.anim = (dt) => {
    t += dt;
    pivot.rotation.y += dt * 0.8;
    pivot.position.y = Math.sin(t * 1.6) * 0.07;
  };
  group.userData.anim(0);
  return group;
}
