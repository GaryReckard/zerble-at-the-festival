// Tapered fabric hammocks. All positions are world coordinates, including the
// returned NPC seat point; callers keep their existing placement contract.
import * as THREE from 'three';

const shared = resource => { resource.userData.shared = true; return resource; };
const postMat = shared(new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: .95, flatShading: true }));
const ropeMat = shared(new THREE.MeshStandardMaterial({ color: 0xd7ba85, roughness: 1, flatShading: true }));
const clothMat = shared(new THREE.MeshStandardMaterial({
  color: 0xffffff, roughness: .95, side: THREE.DoubleSide, vertexColors: true,
}));
const postGeo = shared(new THREE.CylinderGeometry(.12, .15, 2.2, 8));
const ropeGeo = shared(new THREE.CylinderGeometry(.018, .018, 1, 5));
const slingColors = [0xff6f9c, 0xffd28a, 0x6fcf6a, 0x66d9ff, 0xb285ff];
const up = new THREE.Vector3(0, 1, 0);

function rope(group, a, b, name) {
  const mesh = new THREE.Mesh(ropeGeo, ropeMat);
  const delta = new THREE.Vector3().subVectors(b, a);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(up, delta.clone().normalize());
  mesh.scale.y = delta.length();
  group.add(mesh);
}

function fabric(group, cx, cz, ux, uz, halfCloth, restY, sagDepth, width, color) {
  const px = -uz, pz = ux, verts = [], colors = [], indices = [];
  const base = new THREE.Color(color);
  const lengthSteps = 20, crossSteps = 4;
  for (let i = 0; i <= lengthSteps; i++) {
    const u = i / lengthSteps * 2 - 1;
    const gather = Math.pow(Math.max(0, 1 - u * u), .6);
    const halfWidth = width * (.055 + .445 * gather);
    const y = restY - Math.cos(u * Math.PI / 2) * sagDepth;
    const stripe = (i >= 3 && i <= 4) || (i >= 16 && i <= 17) ? .72 : 1;
    for (let j = 0; j <= crossSteps; j++) {
      const v = j / crossSteps * 2 - 1;
      const sideways = v * halfWidth;
      verts.push(cx + u * halfCloth * ux + sideways * px,
        y + .13 * v * v * gather,
        cz + u * halfCloth * uz + sideways * pz);
      const shade = stripe * (1 - .08 * Math.abs(v));
      colors.push(base.r * shade, base.g * shade, base.b * shade);
      if (i === lengthSteps || j === crossSteps) continue;
      const a = i * (crossSteps + 1) + j;
      const b = a + crossSteps + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const sling = new THREE.Mesh(geo, clothMat);
  sling.name = 'hammock_cradle';
  sling.castShadow = true;
  sling.receiveShadow = true;
  group.add(sling);
  return geo;
}

function slingWithRopes(group, cx, cz, ux, uz, halfSupport, restY, sagDepth, width, color) {
  const halfCloth = Math.max(.35, halfSupport - .46);
  fabric(group, cx, cz, ux, uz, halfCloth, restY, sagDepth, width, color);
  const px = -uz, pz = ux;
  for (const end of [-1, 1]) {
    const tip = new THREE.Vector3(cx + end * halfCloth * ux, restY, cz + end * halfCloth * uz);
    const anchor = new THREE.Vector3(cx + end * halfSupport * ux, restY + .18,
      cz + end * halfSupport * uz);
    for (const side of [-1, 1]) {
      const edge = tip.clone().add(new THREE.Vector3(side * px * width * .028, 0, side * pz * width * .028));
      rope(group, edge, anchor, 'hammock_suspension');
    }
  }
}

// The rope endpoints sit on the facing sides of the trunks, outside the bark
// by a small allowance for the rope's own radius. Callers pass the trunk radii
// measured at the hammock's local support height.
export function treeHammockAnchors(ax, az, bx, bz, radiusA, radiusB, clearance = .04) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz) || 1e-3;
  const ux = dx / len, uz = dz / len;
  const ra = Math.max(0, Number(radiusA) || 0) + clearance;
  const rb = Math.max(0, Number(radiusB) || 0) + clearance;
  const anchorA = { x: ax + ux * ra, z: az + uz * ra };
  const anchorB = { x: bx - ux * rb, z: bz - uz * rb };
  const anchorDx = anchorB.x - anchorA.x, anchorDz = anchorB.z - anchorA.z;
  const halfSupport = Math.hypot(anchorDx, anchorDz) / 2;
  return {
    ax: anchorA.x, az: anchorA.z, bx: anchorB.x, bz: anchorB.z,
    cx: (anchorA.x + anchorB.x) / 2, cz: (anchorA.z + anchorB.z) / 2,
    ux: anchorDx / (halfSupport * 2 || 1), uz: anchorDz / (halfSupport * 2 || 1),
    halfSupport,
  };
}

export function buildHammock(x, z, rng = Math.random) {
  const group = new THREE.Group();
  group.name = 'hammock';
  const color = slingColors[Math.floor(rng() * slingColors.length)];
  const yaw = rng() * Math.PI * 2;
  const ux = Math.cos(yaw), uz = Math.sin(yaw);
  const halfLen = 2, restY = 1.5, sagDepth = .55;
  for (const end of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.name = 'hammock_post';
    post.position.set(x + end * halfLen * ux, 1.1, z + end * halfLen * uz);
    group.add(post);
  }
  slingWithRopes(group, x, z, ux, uz, halfLen, restY, sagDepth, 1.05, color);
  return { group, seatPos: new THREE.Vector3(x, restY - sagDepth + .2, z), yaw };
}

export function buildTreeHammock(ax, az, bx, bz, rng = Math.random, radiusA = .7, radiusB = radiusA) {
  const group = new THREE.Group();
  group.name = 'tree_hammock';
  const color = slingColors[Math.floor(rng() * slingColors.length)];
  const anchors = treeHammockAnchors(ax, az, bx, bz, radiusA, radiusB);
  const restY = 1.45, sagDepth = .5;
  slingWithRopes(group, anchors.cx, anchors.cz, anchors.ux, anchors.uz,
    anchors.halfSupport, restY, sagDepth, .95, color);
  return { group, seatPos: new THREE.Vector3(anchors.cx, restY - sagDepth + .2, anchors.cz) };
}
