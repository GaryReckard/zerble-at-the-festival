// Classic A-frame picnic table — a planked oak top, two bench boards, and a darker
// pine frame (two splayed end A-frames, a bench cross-support per end, and a center
// spine). Returns { group, footprint, seats } where `seats` are world-LOCAL {x, z,
// yaw} bench spots (yaw faces the table) so a caller can sit NPCs there (C2). Caller
// positions/rotates the group; `seats` are in the group's local frame.
//
// The whole table is ONE pre-merged BufferGeometry with the real plank/frame colors
// BAKED into a per-vertex `color` attribute (the tent.js mergeStaticDecor idiom), so
// a two-tone weathered table is still a SINGLE draw call (not a mesh per board) under
// one shared vertexColors material — keeps the food-court chunks within the low-tier
// draw budget. The merged geo + material are module-level + userData.shared so chunk
// disposal skips them (footgun #6); every table reuses the one upload.

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Sized so two crowd NPCs (scale 0.85–1.25) sit side-by-side on each bench (4
// total) without overlapping — seats are spread to x = ±0.6 on a 2.2 m table.
const TOP_Y = 0.74, TOP_T = 0.06, TOP_D = 0.72, TABLE_LEN = 2.2;
const BENCH_T = 0.05, BENCH_D = 0.27, BENCH_Y = 0.45, BENCH_OFF = 0.62;
const BENCH_TOP = BENCH_Y + BENCH_T / 2;   // cushion surface — the seated-NPC butt height
const END_X = 0.7;         // the two A-frames sit inset from the ends
const FOOT_Z = 0.78;       // leg feet splay out past the benches
const TOP_UNDER = TOP_Y - TOP_T / 2;   // underside of the tabletop — where legs meet

// Plank oak (slight board-to-board variation) vs the darker structural pine frame.
const OAK = [0x9c6b3f, 0x90602f, 0xa3714a];
const BENCH_COL = 0x986838;
const PINE = 0x6f4d2c;

// Bake a box's transform (a rotation about X for the splayed legs, then a
// translation) AND a flat vertex color into one geometry, ready to merge.
function bakedBox(w, h, d, x, y, z, rx, hex) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Matrix4().makeRotationX(rx);
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const _parts = [];

// Tabletop — 3 lengthwise planks with thin gaps, so it reads as boards not a slab.
for (let i = 0; i < 3; i++) {
  const z = (i - 1) * (TOP_D / 3);     // -, center, +
  _parts.push(bakedBox(TABLE_LEN, TOP_T, TOP_D / 3 - 0.02, 0, TOP_Y, z, 0, OAK[i]));
}

// Two bench boards.
for (const s of [-1, 1]) _parts.push(bakedBox(TABLE_LEN, BENCH_T, BENCH_D, 0, BENCH_Y, s * BENCH_OFF, 0, BENCH_COL));

// Two end A-frames: a pair of legs splayed from feet (out past the benches) up to
// the underside of the tabletop, a bench cross-support carrying both benches, and a
// short cleat under the top.
const legLen = Math.hypot(FOOT_Z, TOP_UNDER) + 0.04;
const legTilt = Math.atan2(FOOT_Z, TOP_UNDER);
for (const ex of [-1, 1]) {
  const x = ex * END_X;
  for (const s of [-1, 1]) {
    // foot at (x, 0, s*FOOT_Z), apex at (x, TOP_UNDER, 0) → a pure X-rotation.
    _parts.push(bakedBox(0.085, legLen, 0.085, x, TOP_UNDER / 2, s * FOOT_Z / 2, -s * legTilt, PINE));
  }
  _parts.push(bakedBox(0.09, 0.06, FOOT_Z * 2 + 0.06, x, BENCH_Y - 0.035, 0, 0, PINE));   // bench cross-support
  _parts.push(bakedBox(0.09, 0.055, TOP_D - 0.04, x, TOP_UNDER - 0.03, 0, 0, PINE));        // cleat under the top
}

// Center spine tying the two A-frames together under the tabletop.
_parts.push(bakedBox(TABLE_LEN - 0.34, 0.06, 0.085, 0, TOP_UNDER - 0.07, 0, 0, PINE));

const _TABLE_GEO = BufferGeometryUtils.mergeGeometries(_parts);
_TABLE_GEO.userData.shared = true;
for (const g of _parts) g.dispose();   // the merge copied the data; free the temporaries

const _WOOD_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
_WOOD_MAT.userData.shared = true;

// The four bench seats (local frame), two per bench, facing the table — `y` is the
// cushion height so a caller can sit an NPC butt-on-bench. Caller rotates these into
// world space (see chunks.js picnic_table registration).
const _SEATS = [
  { x: -0.6, z: -BENCH_OFF, y: BENCH_TOP, yaw: 0 },
  { x: 0.6, z: -BENCH_OFF, y: BENCH_TOP, yaw: 0 },
  { x: -0.6, z: BENCH_OFF, y: BENCH_TOP, yaw: Math.PI },
  { x: 0.6, z: BENCH_OFF, y: BENCH_TOP, yaw: Math.PI },
];

export function buildPicnicTable(rng = Math.random) {
  const group = new THREE.Group();
  group.name = 'picnic_table';
  const table = new THREE.Mesh(_TABLE_GEO, _WOOD_MAT);
  table.castShadow = true;   // one caster for the whole table; reads as a distinct shadow
  group.add(table);
  return { group, footprint: 1.4, seats: _SEATS };
}
