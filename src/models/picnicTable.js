// Classic A-frame picnic table — a tabletop plank, two bench planks, two angled
// leg frames. Returns { group, footprint, seats } where `seats` are world-LOCAL
// {x, z, yaw} bench spots (yaw faces the table) so a caller can sit NPCs there
// (C2). Caller positions/rotates the group; `seats` are in the group's local frame.
//
// Pooled geometry + a shared wood material (userData.shared) so chunk disposal
// skips them — many tables across the food courts share one upload (footgun #6).

import * as THREE from 'three';

const TOP_W = 1.7, TOP_D = 0.7, TOP_T = 0.08, TOP_Y = 0.72;
const BENCH_W = 1.7, BENCH_D = 0.28, BENCH_T = 0.06, BENCH_Y = 0.44, BENCH_OFF = 0.62;

const _TOP_GEO = new THREE.BoxGeometry(TOP_W, TOP_T, TOP_D);
const _BENCH_GEO = new THREE.BoxGeometry(BENCH_W, BENCH_T, BENCH_D);
const _LEG_GEO = new THREE.BoxGeometry(0.09, 0.86, 0.09);
for (const g of [_TOP_GEO, _BENCH_GEO, _LEG_GEO]) g.userData.shared = true;

const _WOOD_MAT = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.85, flatShading: true });
_WOOD_MAT.userData.shared = true;

export function buildPicnicTable(rng = Math.random) {
  const group = new THREE.Group();
  group.name = 'picnic_table';

  const top = new THREE.Mesh(_TOP_GEO, _WOOD_MAT);
  top.position.y = TOP_Y;
  top.castShadow = true;   // the tabletop reads as a distinct shadow; legs/benches don't
  group.add(top);

  for (const s of [-1, 1]) {
    const bench = new THREE.Mesh(_BENCH_GEO, _WOOD_MAT);
    bench.position.set(0, BENCH_Y, s * BENCH_OFF);
    group.add(bench);
    // Angled leg frame at each end, spanning bench-to-bench.
    for (const ex of [-1, 1]) {
      const leg = new THREE.Mesh(_LEG_GEO, _WOOD_MAT);
      leg.position.set(ex * (TOP_W / 2 - 0.18), 0.43, s * BENCH_OFF);
      leg.rotation.x = s * 0.12;
      group.add(leg);
    }
  }

  // Slight random yaw jitter is the caller's job; expose the two bench seats
  // (local frame) so people can sit facing the table.
  const seats = [
    { x: -0.4, z: -BENCH_OFF, yaw: 0 },        // far bench → faces +z (toward table)
    { x: 0.4, z: -BENCH_OFF, yaw: 0 },
    { x: -0.4, z: BENCH_OFF, yaw: Math.PI },   // near bench → faces -z
    { x: 0.4, z: BENCH_OFF, yaw: Math.PI },
  ];

  return { group, footprint: 1.2, seats };
}
