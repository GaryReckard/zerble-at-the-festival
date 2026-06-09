// Curved cloth hammock between two posts.
// Returns { group, seatPos, yaw } so callers can decide where an NPC sits.

import * as THREE from 'three';

export function buildHammock(x, z, rng = Math.random) {
  const group = new THREE.Group();
  group.name = 'hammock';

  const postMat = new THREE.MeshStandardMaterial({
    color: 0x6a4a2a, roughness: 0.95, flatShading: true,
  });
  const slingColors = [0xff6f9c, 0xffd28a, 0x6fcf6a, 0x66d9ff, 0xb285ff];
  const slingColor = slingColors[Math.floor(rng() * slingColors.length)];

  const yaw = rng() * Math.PI * 2;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const halfLen = 2.0;
  const restY = 1.5;
  const sagDepth = 0.55;
  const slingW = 1.05;

  // Two posts at ±halfLen along the rotated long axis
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 2.2, 8), postMat,
    );
    post.position.set(x + s * halfLen * cosY, 1.1, z + s * halfLen * sinY);
    // Hammock post — sling casts the readable shadow.
    group.add(post);
  }

  // Curved sling: cosine sag along the long axis
  const segments = 16;
  const verts = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = (t - 0.5) * 2;
    const along = u * halfLen;
    const sag = -Math.cos(u * Math.PI / 2) * sagDepth;
    const py = restY + sag;
    for (const side of [-1, 1]) {
      const sideOff = side * slingW / 2;
      const lx = along * cosY - sideOff * sinY;
      const lz = along * sinY + sideOff * cosY;
      verts.push(x + lx, py, z + lz);
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  const slingGeo = new THREE.BufferGeometry();
  slingGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  slingGeo.setIndex(indices);
  slingGeo.computeVertexNormals();

  const sling = new THREE.Mesh(
    slingGeo,
    new THREE.MeshStandardMaterial({
      color: slingColor,
      roughness: 0.95,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
  );
  sling.castShadow = true;
  sling.receiveShadow = true;
  group.add(sling);

  const seatPos = new THREE.Vector3(x, restY - sagDepth + 0.2, z);

  return { group, seatPos, yaw };
}

// Post-LESS hammock strung directly between two tree trunks (C1). The trees ARE the
// posts, so we just hang the sagging sling between anchor points (ax,az)-(bx,bz) at
// trunk height. Verts are in world coords (group stays at origin); returns { group,
// seatPos } for an optional rester. Decorative — it lives in the un-driveable gap
// between two close trunks, so it needs no collider.
export function buildTreeHammock(ax, az, bx, bz, rng = Math.random) {
  const group = new THREE.Group();
  group.name = 'tree_hammock';
  const slingColors = [0xff6f9c, 0xffd28a, 0x6fcf6a, 0x66d9ff, 0xb285ff];
  const slingColor = slingColors[Math.floor(rng() * slingColors.length)];

  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz) || 1e-3;
  const ux = dx / len, uz = dz / len;       // along-axis unit
  const px = -uz, pz = ux;                   // perpendicular unit (sling width)
  const restY = 1.45, sagDepth = 0.5, slingW = 0.95;
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  const halfLen = len / 2;

  const segments = 16;
  const verts = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = (t - 0.5) * 2;
    const along = u * halfLen;
    const py = restY - Math.cos(u * Math.PI / 2) * sagDepth;
    for (const side of [-1, 1]) {
      const so = side * slingW / 2;
      verts.push(cx + along * ux + so * px, py, cz + along * uz + so * pz);
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const sling = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: slingColor, roughness: 0.95, side: THREE.DoubleSide, flatShading: true,
  }));
  sling.castShadow = true;
  group.add(sling);

  return { group, seatPos: new THREE.Vector3(cx, restY - sagDepth + 0.2, cz) };
}
