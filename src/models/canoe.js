import {makePersonHair} from '../crowdHair.js';
// Open, pointed canoe. Long axis is Z; the caller owns placement and motion.
import * as THREE from 'three';

const shared = resource => { resource.userData.shared = true; return resource; };
const material = color => shared(new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }));
const M = {
  hull: material(0x936134), rim: material(0x4f301e), seat: material(0xc49860),
  skin: material(0xe6bb8c), paddle: material(0x6c4928),
  blade: material(0xc09359), shorts: material(0x34485c),
  shirts: [0x66d9ff, 0xff6f9c, 0xffd28a, 0x6fcf6a, 0xb285ff, 0xff8a5b].map(material),
};
const G = {
  seat: shared(new THREE.BoxGeometry(0.82, 0.075, 0.22)),
  body: shared(new THREE.CapsuleGeometry(0.18, 0.37, 3, 6)),
  head: shared(new THREE.IcosahedronGeometry(0.19, 1)),
  limb: shared(new THREE.CylinderGeometry(0.055, 0.055, 1, 6)),
  paddle: shared(new THREE.CylinderGeometry(0.027, 0.027, 1, 6)),
  blade: shared(new THREE.BoxGeometry(0.22, 0.42, 0.055)),
};

const RINGS = 24;
const halfLength = 2.45;
function widthAt(u) { return 0.52 * Math.pow(Math.max(0, 1 - u * u), 0.78); }
function rimY(u) { return 0.50 + 0.10 * Math.pow(Math.abs(u), 3); }

function makeHull() {
  const verts = [], indices = [];
  // The section walks along the outer hull, folds over the lip, then returns
  // along the inner hull. The open center is actual empty space.
  for (let i = 0; i <= RINGS; i++) {
    const u = i / RINGS * 2 - 1;
    const w = Math.max(0.012, widthAt(u)), y = rimY(u);
    const section = [
      [-w, y], [-w * .84, .27], [-w * .46, .115], [0, .075],
      [w * .46, .115], [w * .84, .27], [w, y],
      [w * .87, y - .045], [w * .67, .29], [w * .36, .19],
      [0, .165], [-w * .36, .19], [-w * .67, .29], [-w * .87, y - .045],
    ];
    for (const [x, py] of section) verts.push(x, py, u * halfLength);
    if (i === RINGS) continue;
    for (let j = 0; j < section.length; j++) {
      const a = i * section.length + j;
      const b = i * section.length + (j + 1) % section.length;
      const c = a + section.length, d = b + section.length;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return shared(geo);
}
G.hull = makeHull();
for (const side of [-1, 1]) {
  const pts = [];
  for (let i = 0; i <= RINGS; i++) {
    const u = i / RINGS * 2 - 1;
    pts.push(new THREE.Vector3(side * Math.max(.012, widthAt(u)), rimY(u), u * halfLength));
  }
  G['rim' + side] = shared(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), RINGS, .032, 5, false));
}

const up = new THREE.Vector3(0, 1, 0);
function beam(group, geo, mat, a, b) {
  const mesh = new THREE.Mesh(geo, mat);
  const delta = new THREE.Vector3().subVectors(b, a);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(up, delta.clone().normalize());
  mesh.scale.y = delta.length();
  group.add(mesh);
}

export function buildCanoe(group, rng = Math.random) {
  const hull = new THREE.Mesh(G.hull, M.hull);
  hull.name = 'canoe_open_hull';
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);
  for (const side of [-1, 1]) group.add(new THREE.Mesh(G['rim' + side], M.rim));

  for (const z of [-0.7, 0.7]) {
    const seat = new THREE.Mesh(G.seat, M.seat);
    seat.position.set(0, .43, z);
    group.add(seat);
  }

  // Keep the original one occupancy draw and one shirt draw per paddler.
  const rearOccupied = rng() < 0.55;
  for (const z of [-0.7, 0.7]) {
    if (z > 0 && !rearOccupied) continue;
    const shirt = M.shirts[Math.floor(rng() * M.shirts.length)];
    const side = z < 0 ? -1 : 1;
    const body = new THREE.Mesh(G.body, shirt);
    body.position.set(0, .78, z);
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(G.head, M.skin);
    head.position.set(0, 1.16, z);
    group.add(head);
    group.add(makePersonHair({color:0x493125,radii:[.19,.19,.19],center:[0,1.16,z]}));

    // Bent knees stay inside the gunwales, while the outside arm reaches the shaft.
    for (const legSide of [-1, 1]) {
      beam(group, G.limb, M.shorts,
        new THREE.Vector3(legSide * .12, .58, z + .06),
        new THREE.Vector3(legSide * .23, .30, z - .25));
    }
    const grip = new THREE.Vector3(side * .48, .82, z - .18);
    beam(group, G.limb, M.skin, new THREE.Vector3(side * .15, .96, z), grip);
    beam(group, G.limb, M.skin, new THREE.Vector3(-side * .15, .96, z),
      new THREE.Vector3(side * .16, 1.18, z + .12));
    const top = new THREE.Vector3(side * .18, 1.26, z + .14);
    const bottom = new THREE.Vector3(side * .86, .12, z - .37);
    beam(group, G.paddle, M.paddle, top, bottom);
    const blade = new THREE.Mesh(G.blade, M.blade);
    blade.position.copy(bottom).lerp(top, .12);
    blade.rotation.z = side * .45;
    group.add(blade);
  }
}
