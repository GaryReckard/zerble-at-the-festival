// Classic A-frame picnic table — a tabletop plank, two bench planks, four angled
// legs. Returns { group, footprint, seats } where `seats` are world-LOCAL {x, z, yaw}
// bench spots (yaw faces the table) so a caller can sit NPCs there (C2). Caller
// positions/rotates the group; `seats` are in the group's local frame.
//
// The whole table is ONE pre-merged BufferGeometry sharing one wood material, so a
// table is a SINGLE draw call (not 7 meshes) — keeps the food-court chunks within the
// low-tier draw budget. The merged geo + material are module-level + userData.shared
// so chunk disposal skips them (footgun #6); every table reuses the one upload.

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const TOP_W = 1.7, TOP_D = 0.7, TOP_T = 0.08, TOP_Y = 0.72;
const BENCH_W = 1.7, BENCH_D = 0.28, BENCH_T = 0.06, BENCH_Y = 0.44, BENCH_OFF = 0.62;

// Bake each plank's transform into a box geometry, then merge into one.
function placedBox(w, h, d, x, y, z, rx = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Matrix4().makeRotationX(rx);
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
}

const _parts = [placedBox(TOP_W, TOP_T, TOP_D, 0, TOP_Y, 0)];
for (const s of [-1, 1]) {
  _parts.push(placedBox(BENCH_W, BENCH_T, BENCH_D, 0, BENCH_Y, s * BENCH_OFF));
  for (const ex of [-1, 1]) _parts.push(placedBox(0.09, 0.86, 0.09, ex * (TOP_W / 2 - 0.18), 0.43, s * BENCH_OFF, s * 0.12));
}
const _TABLE_GEO = BufferGeometryUtils.mergeGeometries(_parts);
_TABLE_GEO.userData.shared = true;
for (const g of _parts) g.dispose();   // the merge copied the data; free the temporaries

const _WOOD_MAT = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.85, flatShading: true });
_WOOD_MAT.userData.shared = true;

// The four bench seats (local frame), facing the table, so people can sit at it.
const _SEATS = [
  { x: -0.4, z: -BENCH_OFF, yaw: 0 },
  { x: 0.4, z: -BENCH_OFF, yaw: 0 },
  { x: -0.4, z: BENCH_OFF, yaw: Math.PI },
  { x: 0.4, z: BENCH_OFF, yaw: Math.PI },
];

export function buildPicnicTable(rng = Math.random) {
  const group = new THREE.Group();
  group.name = 'picnic_table';
  const table = new THREE.Mesh(_TABLE_GEO, _WOOD_MAT);
  table.castShadow = true;   // one caster for the whole table; reads as a distinct shadow
  group.add(table);
  return { group, footprint: 1.2, seats: _SEATS };
}
