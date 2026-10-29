import {bindLocomotion,addStrideMorphs,tickLocomotion} from './personLocomotion.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../rng.js';

const templates = new Map();
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
material.userData.shared = true;

function geometry(build) {
  const pieces = [];
  const add = (source, color, position = [0, 0, 0], scale = [1, 1, 1],side=0) => {
    const g = source.index ? source.toNonIndexed() : source.clone();
    source.dispose();
    g.deleteAttribute('uv');
    g.scale(...scale); g.translate(...position);
    const c = new THREE.Color(color), colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute('strideSide',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(side),1));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pieces.push(g);
  };
  const oval = (color, position, scale,side=0) => add(new THREE.SphereGeometry(1, 10, 7), color, position, scale,side);
  const box = (color, position, scale,side=0) => add(new THREE.BoxGeometry(1, 1, 1), color, position, scale,side);
  const rope = (points, radius, color) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 10, radius, 5, false), color);
  build({ add, oval, box, rope });
  const merged = mergeGeometries(pieces, false);
  pieces.forEach(g => g.dispose());
  merged.userData.shared = true;
  return merged;
}

function template(variant) {
  const rng = mulberry32(0x574f4f4b + variant);
  const skin = [0xd6a77d, 0xc79269, 0xe0b38b, 0xb57f59, 0xd4a077][variant];
  const cloth = [0x555943, 0x60554a, 0x435b59, 0x5b4d60, 0x65523f][variant];
  const cream = 0xc9bfa1, dark = 0x302c25;
  const hairColors = [0x342b20, 0x4b3b27, 0x665033, 0x887047, 0xa18a60];
  const body = geometry(({ add, oval, box, rope }) => {
    for (const side of [-1, 1]) {
      oval(0x494338, [side * .19, .42, .03], [.17, .34, .19],side);
      oval(skin, [side * .19, .12, -.09], [.14, .09, .24],side);
      box(0x302921, [side * .19, .045, -.08], [.29, .07, .47],side);
      box(dark, [side * .19, .16, -.13], [.27, .045, .10],side);
    }
    add(new THREE.CylinderGeometry(.39, .44, .98, 16, 1), cloth, [0, 1.14, 0], [1, 1, .8]);
    oval(cloth, [0, 1.59, .04], [.43, .19, .32]);
    // Stripes follow the hoodie surface rather than floating as flat decals.
    for (let i = 0; i < 32; i++) {
      const a = i * Math.PI * 2 / 32;
      add(new THREE.CylinderGeometry(.394, .444, .95, 1, 1, true, a, .065), i % 4 === 0 ? cream : dark, [0, 1.14, 0], [1, 1, .8]);
    }
    for (const y of [.73, .79]) add(new THREE.CylinderGeometry(.441, .444, .025, 16, 1, true), cream, [0, y, 0], [1, 1, .81]);
    oval(cloth, [0, 1.65, .16], [.34, .21, .25]);
    oval(dark, [0, 1.72, -.045], [.22, .10, .20]);
    oval(skin, [0, 1.83, 0], [.14, .20, .13]);
    oval(skin, [0, 2.12, -.055], [.275, .35, .25]);
    oval(hairColors[0], [0, 1.94, -.16], [.245, .23, .20]);
    oval(skin, [0, 2.025, -.286], [.14, .10, .045]);
    oval(0x503627, [0, 1.995, -.328], [.064, .025, .012]);
    for (const side of [-1, 1]) {
      oval(cream, [side * .105, 2.16, -.278], [.067, .023, .015]);
      oval(dark, [side * .105, 2.155, -.291], [.021, .013, .009]);
      oval(skin, [side * .105, 2.183, -.28], [.073, .032, .024]);
      rope([[side * .045, 2.225, -.277], [side * .11, 2.235, -.277], [side * .17, 2.22, -.251]], .014, hairColors[1]);
      oval(hairColors[1], [side * .055, 2.04, -.33], [.066, .025, .018]);
      rope([[side * .12, 1.72, -.23], [side * .13, 1.5, -.337], [side * .10, 1.38, -.35]], .012, cream);
    }
    oval(skin, [0, 2.10, -.31], [.047, .074, .06]);
    box(dark, [0, 1.02, -.351], [.43, .19, .028]);
    box(cloth, [0, 1.005, -.37], [.37, .14, .025]);
    add(new THREE.CylinderGeometry(.283, .293, .16, 20), 0x72502d, [0, 2.36, -.025], [1, 1, .90]);
    for (const y of [2.305, 2.365, 2.415]) add(new THREE.CylinderGeometry(.295, .295, .016, 20, 1, true), 0xa88148, [0, y, -.025], [1, 1, .90]);
  });
  addStrideMorphs(body,.76);
  const hair = geometry(({ oval, rope }) => {
    oval(hairColors[0], [0, 2.39, .08], [.33, .23, .29]);
    for (let i = 0; i < 28; i++) {
      // Leave the front wedge open so the expression and headband stay readable.
      const angle = -.30 + i / 27 * (Math.PI + .60);
      const x = Math.cos(angle), z = Math.sin(angle);
      const length = .95 + rng() * .65;
      const spread = .46 + rng() * .16;
      const rootY = 2.40 + rng() * .13;
      const points = [[x * .22, rootY, z * .22 + .04], [x * .43, 2.48 + rng() * .12, z * .36 + .05], [x * spread, 2.15, z * .46], [x * (spread + .04) + (rng() - .5) * .10, 1.80, z * .49 - .025], [x * (spread - .04 + rng() * .10), rootY - length, z * .47 - .06]];
      const radius = .048 + rng() * .026;
      rope(points, radius, hairColors[i % hairColors.length]);
      if (i % 5 === 0) {
        const p = points[3];
        oval(i % 2 ? 0x527d77 : 0xb98d47, p, [radius * 1.18, .05, radius * 1.18]);
      }
    }
  });
  const arm = geometry(({ add, oval }) => {
    add(new THREE.CylinderGeometry(.16, .12, .62, 10), cloth, [0, -.28, 0]);
    for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(.15 - i * .006, .148 - i * .006, .035, 10), i % 2 ? dark : cream, [0, -.08 - i * .10, 0]);
    oval(skin, [0, -.66, -.015], [.105, .14, .095]);
    oval(skin, [.08, -.64, -.06], [.045, .075, .045]);
  });
  hair.deleteAttribute('strideSide');arm.deleteAttribute('strideSide');
  return { body, hair, arm };
}

export function buildWook(rng = Math.random) {
  const variant = Math.min(4, Math.floor(rng() * 5));
  const phase = rng() * 100;
  // Preserve the legacy builder's RNG consumption: callers share it with spawn placement.
  for (let i = 0; i < 16; i++) rng();
  for (let i = 0; i < 14; i++) {
    rng(); rng();
    const segments = 4 + Math.floor(rng() * 2);
    for (let s = 0; s < segments; s++) { rng(); rng(); }
  }
  if (!templates.has(variant)) templates.set(variant, template(variant));
  const t = templates.get(variant), root = new THREE.Group(), body = new THREE.Group();
  root.name = 'Wook'; root.add(body);
  for (const [name, geo] of [['hoodie and face', t.body], ['dreadlocks', t.hair]]) {
    const mesh = new THREE.Mesh(geo, material); mesh.name = name;
    mesh.castShadow = true; body.add(mesh);
  }
  const walkArms=[];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(t.arm, material);
    arm.position.set(side * .43, 1.57, 0);
    arm.rotation.z = side * .12;
    body.add(arm);walkArms.push(arm);
  }
  root.userData.swayPhase = phase;
  bindLocomotion(root,{body,arms:walkArms,morphs:[body.children[0]],height:1.2,hip:.76,toe:.33,phase});
  return root;
}

export function tickWook(model, dt) {
  model.userData.animationTime=(model.userData.animationTime??0)+dt;
  const walk=tickLocomotion(model,dt);
  const t = model.userData.animationTime * 2 + model.userData.swayPhase;
  const body = model.children[0];
  if (!body) return;
  body.rotation.z = Math.sin(t) * (walk?.active?.035:0);
  body.rotation.x = Math.cos(t * .7) * (walk?.active?.02:0);
}
