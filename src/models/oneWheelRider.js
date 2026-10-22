import * as THREE from 'three';
import { bakePerformancePart } from './performer.js';

const WHEEL_RADIUS = .28;
const INK = 0x20232c, RUBBER = 0x161a20, TEAL = 0x59c5bd;
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82 });
material.userData.shared = true;
const templates = new Map();
let boardGeometry, wheelGeometry, ledGeometry;

function boardParts() {
  if (boardGeometry) return;
  boardGeometry = bakePerformancePart(({ add, box }) => {
    for (const side of [-1, 1]) {
      box(0x596770, [side * .225, .015, 0], [.045, .075, 1.19]);
      box(TEAL, [side * .25, .02, 0], [.012, .025, 1.06]);
      box(0x9b7653, [0, .045, side * .435], [.46, .075, .34]);
      box(0x30343a, [0, .09, side * .435], [.42, .025, .30]);
      box(INK, [0, -.005, side * .59], [.47, .10, .075]);
      // Thin grip stripes and the wood edge keep the two footpads readable.
      for (const x of [-.14, 0, .14]) box(0x51565b, [x, .104, side * .435], [.018, .003, .25]);
    }
    // Upper half of a cylinder, open underneath, forms the central fender.
    add(new THREE.CylinderGeometry(.315, .315, .40, 14, 1, true, 0, Math.PI),
      0x35565c, [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
  });
  wheelGeometry = bakePerformancePart(({ add, box }) => {
    add(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, .35, 20),
      RUBBER, [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(.18, .18, .018, 16),
        0x424b55, [side * .184, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
      add(new THREE.TorusGeometry(.13, .018, 5, 16),
        TEAL, [side * .198, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0]);
      add(new THREE.CylinderGeometry(.06, .06, .025, 10),
        0x9faeb4, [side * .20, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
      box(0x8ba1a4, [side * .20, .085, 0], [.015, .075, .026]);
    }
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      box(0x2d3237, [0, Math.cos(a) * .279, Math.sin(a) * .279],
        [.31, .006, .025], [a, 0, 0]);
    }
  });
  ledGeometry = new THREE.BoxGeometry(.32, .025, .012);
  ledGeometry.userData.shared = true;
}

function riderParts(variant) {
  if (templates.has(variant)) return templates.get(variant);
  const skin = [0xbd815e, 0x8e593d, 0xe0ae88][variant];
  const shirt = [0xa2359c, 0x7256bc, 0xc34c87][variant];
  const body = bakePerformancePart(({ add, oval, box, rod }) => {
    for (const s of [-1, 1]) {
      // Hips and shoes lie along Z: the rider stands across the direction of travel.
      rod(0x45304f, [0, .91, s * .16], [.13, .61, s * .27], .105);
      rod(skin, [.13, .61, s * .27], [0, .21, s * .43], .073);
      oval(skin, [.13, .59, s * .28], [.087, .09, .085]);
      box(0xd8d3ce, [.035, .125, s * .43], [.32, .045, .18]);
      oval(INK, [.035, .18, s * .43], [.17, .07, .10]);
      for (const x of [.01, .06, .11]) box(0xe8ded9, [x, .241, s * .43], [.018, .009, .10]);
    }
    oval(shirt, [0, 1.17, 0], [.155, .31, .255]);
    box(0xefd0a1, [.155, 1.20, 0], [.014, .13, .13], [Math.PI / 4, 0, 0]);
    box(0x563157, [0, .925, 0], [.29, .065, .39]);
    rod(skin, [0, 1.39, 0], [0, 1.51, 0], .075);
    // A small sling bag and diagonal strap give the outfit a festival silhouette.
    oval(0x315d60, [-.16, 1.12, -.015], [.08, .19, .14]);
    rod(0xdbc795, [.15, 1.39, -.17], [.16, .99, .16], .018);
    add(new THREE.TorusGeometry(.045, .008, 4, 8), 0xe8c879,
      [.175, 1.24, -.10], [1, 1, 1], [0, Math.PI / 2, 0]);
  });
  const head = bakePerformancePart(({ add, oval, box, rod }) => {
    oval(skin, [0, 0, 0], [.155, .205, .16]);
    oval(0x35262b, [-.055, .025, 0], [.13, .19, .165]);
    oval(skin, [.153, -.015, 0], [.035, .042, .035]);
    for (const s of [-1, 1]) {
      oval(skin, [0, -.02, s * .16], [.035, .06, .025]);
      box(INK, [.142, .035, s * .063], [.025, .047, .082]);
      rod(INK, [.03, .10, s * .17], [.06, -.16, s * .05], .012);
    }
    box(0x8bc9cc, [.158, .048, .063], [.006, .011, .045]);
    box(0x78413f, [.139, -.095, 0], [.014, .015, .065]);
    // Helmet shell is a capped dome with a contrasting rim and visible vents.
    add(new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      TEAL, [0, .075, 0], [.195, .19, .205]);
    oval(0x344a51, [0, .075, 0], [.20, .035, .21]);
    for (const z of [-.085, 0, .085]) box(0x31545a, [0, .252, z], [.105, .012, .024]);
    oval(0x35262b, [-.145, -.105, 0], [.08, .14, .075]);
  });
  const arms = [-1, 1].map(s => bakePerformancePart(({ oval, rod }) => {
    rod(skin, [0, 0, 0], [.07, -.23, s * .10], .066);
    rod(skin, [.07, -.23, s * .10], [.18, -.37, s * .15], .052);
    oval(INK, [.19, -.39, s * .15], [.065, .075, .055]);
    rod(s === 1 ? TEAL : 0xf2b757, [.155, -.34, s * .14], [.17, -.36, s * .145], .062);
  }));
  const result = { body, head, arms };
  templates.set(variant, result);
  return result;
}

/** Ground-origin model; travel is +Z and the single tire's axle is X. */
export function buildOneWheelRider({ rng = () => .5 } = {}) {
  boardParts();
  const variant = Math.min(2, Math.max(0, Math.floor(rng() * 3)));
  const parts = riderParts(variant);
  const root = new THREE.Group();
  root.name = 'One-wheel rider';
  const lean = new THREE.Group();
  lean.position.y = WHEEL_RADIUS;
  root.add(lean);
  const board = new THREE.Mesh(boardGeometry, material);
  const wheel = new THREE.Mesh(wheelGeometry, material);
  wheel.name = 'Single rolling tire';
  lean.add(board, wheel);
  const rider = new THREE.Group();
  lean.add(rider);
  const body = new THREE.Mesh(parts.body, material);
  body.castShadow = true;
  rider.add(body);
  const head = new THREE.Mesh(parts.head, material);
  head.position.y = 1.66;
  head.rotation.y = -.9;
  rider.add(head);
  const arms = parts.arms.map((geometry, i) => {
    const arm = new THREE.Mesh(geometry, material);
    arm.position.set(0, 1.36, i === 0 ? -.22 : .22);
    rider.add(arm);
    return arm;
  });
  // These two materials belong to this rider; shared geometry remains pooled.
  const front = new THREE.Mesh(ledGeometry, new THREE.MeshStandardMaterial({
    color: 0xaac6c4, emissive: 0xd9f4f0, emissiveIntensity: 0, roughness: .5,
  }));
  const rear = new THREE.Mesh(ledGeometry, new THREE.MeshStandardMaterial({
    color: 0x782e31, emissive: 0xff3339, emissiveIntensity: 0, roughness: .5,
  }));
  front.position.set(0, .015, .634);
  rear.position.set(0, .015, -.634);
  lean.add(front, rear);
  root.userData.oneWheel = { wheelRadius: WHEEL_RADIUS, footprintRadius: .75,
    wheel, board, lean, rider, head, arms, front, rear, phase: rng() * Math.PI * 2, time: 0 };
  return root;
}

/** Speed is signed metres/second and turnRate is signed radians/second. */
export function updateOneWheelRider(group, dt, {
  speed = 0, acceleration = 0, turnRate = 0, nightness = 0, time,
} = {}) {
  const u = group.userData.oneWheel;
  if (!u) return;
  const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  u.time = Number.isFinite(time) ? time : u.time + step;
  const t = u.time + u.phase;
  const blend = 1 - Math.exp(-step * 8);
  const roll = THREE.MathUtils.clamp(-turnRate * speed * .09, -.16, .16);
  const pitch = THREE.MathUtils.clamp(acceleration * .025, -.07, .07);
  u.lean.rotation.z += (roll - u.lean.rotation.z) * blend;
  u.lean.rotation.x += (pitch - u.lean.rotation.x) * blend;
  u.wheel.rotation.x += speed * step / WHEEL_RADIUS;
  u.rider.rotation.z = Math.sin(t * 1.6) * .008;
  u.head.rotation.y = -.9 + Math.sin(t * .7) * .12 - turnRate * .06;
  for (let i = 0; i < 2; i++) {
    u.arms[i].rotation.x = Math.sin(t * 1.5 + i * Math.PI) * .035 + roll * (i ? .6 : -.6);
    u.arms[i].rotation.z = -pitch * 1.5;
  }
  const night = THREE.MathUtils.smoothstep(nightness, .15, .8);
  u.front.material.emissiveIntensity = night * 1.15;
  u.rear.material.emissiveIntensity = night * .85;
}
