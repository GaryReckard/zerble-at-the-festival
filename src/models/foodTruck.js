// Festival food trucks with three distinct service-rig silhouettes.
// Faces -X (the serving side opens to +Z). Caller positions/rotates the group.

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeStaticDecor, MODEL_DECOR_MERGE_ENABLED } from '../mergeDecor.js';

// Trucks read as too dainty next to Zerble. Caller-side colliders scale to match.
export const FOOD_TRUCK_SCALE = 1.7;

function shared(geometry) {
  geometry.userData.shared = true;
  return geometry;
}

function makeServingBody(width, height, depth, opening) {
  const [openX, openY, openWidth, openHeight] = opening;
  const halfW = width / 2, halfH = height / 2, halfD = depth / 2;
  const gap = 0.08;
  const pieces = [
    [width, 0.16, depth, 0, halfH - 0.08, 0], // roof
    [width, 0.16, depth, 0, -halfH + 0.08, 0], // floor
    [width, height, 0.08, 0, 0, -halfD + 0.04], // far wall
    [0.12, height, depth, -halfW + 0.06, 0, 0], // front wall
    [0.12, height, depth, halfW - 0.06, 0, 0], // rear wall
  ];
  const left = openX - openWidth / 2, right = openX + openWidth / 2;
  const bottom = openY - openHeight / 2, top = openY + openHeight / 2;
  const boxParts = pieces.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const geometries = boxParts.map((geometry) => geometry.toNonIndexed());
  for (const geometry of boxParts) geometry.dispose();
  const wallShape = new THREE.Shape();
  const radius = 0.16;
  wallShape.moveTo(-halfW + radius, -halfH);
  wallShape.lineTo(halfW - radius, -halfH);
  wallShape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + radius);
  wallShape.lineTo(halfW, halfH - radius);
  wallShape.quadraticCurveTo(halfW, halfH, halfW - radius, halfH);
  wallShape.lineTo(-halfW + radius, halfH);
  wallShape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - radius);
  wallShape.lineTo(-halfW, -halfH + radius);
  wallShape.quadraticCurveTo(-halfW, -halfH, -halfW + radius, -halfH);
  const hole = new THREE.Path();
  const hr = 0.045;
  hole.moveTo(left + hr, bottom);
  hole.lineTo(right - hr, bottom);
  hole.quadraticCurveTo(right, bottom, right, bottom + hr);
  hole.lineTo(right, top - hr);
  hole.quadraticCurveTo(right, top, right - hr, top);
  hole.lineTo(left + hr, top);
  hole.quadraticCurveTo(left, top, left, top - hr);
  hole.lineTo(left, bottom + hr);
  hole.quadraticCurveTo(left, bottom, left + hr, bottom);
  wallShape.holes.push(hole);
  const sideWall = new THREE.ExtrudeGeometry(wallShape, { depth: 0.08, bevelEnabled: false }).translate(0, 0, halfD - 0.08);
  const merged = BufferGeometryUtils.mergeGeometries([...geometries, sideWall], false);
  for (const geometry of geometries) geometry.dispose();
  sideWall.dispose();
  return shared(merged);
}

function makeRoundedCab() {
  const shape = new THREE.Shape();
  const w = 1.84, h = 2.04, r = 0.15;
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return shared(new THREE.ExtrudeGeometry(shape, {
    depth: 2.84, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1,
  }).translate(0, 0, -1.42));
}

function makeWindowFrame() {
  const bars = [
    new THREE.BoxGeometry(2.82, 0.09, 0.12).translate(0, -0.505, 0),
    new THREE.BoxGeometry(2.82, 0.09, 0.12).translate(0, 0.505, 0),
    new THREE.BoxGeometry(0.09, 0.92, 0.12).translate(-1.365, 0, 0),
    new THREE.BoxGeometry(0.09, 0.92, 0.12).translate(1.365, 0, 0),
  ];
  const geometry = BufferGeometryUtils.mergeGeometries(bars, false);
  for (const bar of bars) bar.dispose();
  return shared(geometry);
}

function makeSignTexture(style, menu = false) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = menu ? 192 : 512;
  canvas.height = menu ? 256 : 128;
  const ctx = canvas.getContext('2d');
  const profiles = [
    { brand: 'TACO LOCO', lines: ['TACOS', 'SALSA', 'HORCHATA'], color: '#e96b4e' },
    { brand: 'MOONBEAN', lines: ['COFFEE', 'COLD BREW', 'DONUTS'], color: '#6c493f' },
    { brand: 'PIZZA PIE', lines: ['PIZZA', 'GARLIC KNOTS', 'LEMONADE'], color: '#d94c45' },
  ];
  const profile = profiles[style];
  ctx.fillStyle = menu ? '#302a2d' : '#fff0d0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = profile.color;
  if (menu) {
    ctx.fillRect(0, 0, canvas.width, 38);
    ctx.fillStyle = '#fff7e5';
    ctx.font = 'bold 21px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MENU', canvas.width / 2, 27);
    ctx.textAlign = 'left';
    ctx.font = 'bold 17px sans-serif';
    profile.lines.forEach((line, i) => {
      const y = 84 + i * 54;
      ctx.fillStyle = profile.color;
      ctx.beginPath(); ctx.arc(22, y - 6, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff4df'; ctx.fillText(line, 39, y);
      ctx.fillStyle = '#85726e'; ctx.fillRect(39, y + 7, 126, 3);
    });
  } else {
    ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
    ctx.fillStyle = '#fff7e5';
    ctx.font = '900 57px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(profile.brand, canvas.width / 2, canvas.height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.shared = true;
  return texture;
}

const _GEO = {
  box: makeServingBody(6, 3, 3.2, [0.3, 0.45, 2.65, 0.92]),
  cab: makeRoundedCab(),
  stepVan: makeServingBody(6.7, 3.6, 3.2, [0.75, 0.3, 3.1, 0.92]),
  trailer: makeServingBody(6.4, 2.8, 3.4, [0.2, 0.23, 2.9, 0.92]),
  windshield: shared(new THREE.BoxGeometry(0.08, 1.15, 2.2)),
  wheel: shared(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14)),
  window: shared(new THREE.BoxGeometry(2.65, 0.92, 0.08)),
  windowFrame: makeWindowFrame(),
  signFace: shared(new THREE.PlaneGeometry(3.48, 0.48)),
  menuFace: shared(new THREE.PlaneGeometry(0.82, 1.08)),
  menuBoard: shared(new THREE.BoxGeometry(0.92, 1.18, 0.12)),
  counter: shared(new THREE.BoxGeometry(3.25, 0.12, 0.5)),
  kitchenCounter: shared(new THREE.BoxGeometry(1.5, 0.15, 0.55)),
  foodItem: shared(new THREE.SphereGeometry(0.13, 7, 5)),
  cup: shared(new THREE.CylinderGeometry(0.38, 0.28, 0.8, 10)),
  cupLid: shared(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 10)),
  triangleBadge: shared(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 3)),
  awning: shared(new THREE.BoxGeometry(3.35, 0.12, 1.05)),
  sign: shared(new THREE.BoxGeometry(3.7, 0.62, 0.18)),
  stripe: shared(new THREE.BoxGeometry(5.8, 0.32, 0.06)),
  vent: shared(new THREE.BoxGeometry(0.72, 0.24, 0.72)),
  ventStack: shared(new THREE.CylinderGeometry(0.19, 0.24, 0.56, 8)),
  tacoShell: shared(new THREE.TorusGeometry(0.4, 0.13, 6, 12, Math.PI)),
  fender: shared(new THREE.TorusGeometry(0.56, 0.075, 5, 12, Math.PI)),
  doorLine: shared(new THREE.BoxGeometry(0.035, 1.35, 0.035)),
  driverWindow: shared(new THREE.BoxGeometry(0.58, 0.72, 0.06)),
  towBeam: shared(new THREE.BoxGeometry(1.6, 0.14, 0.14)),
  jack: shared(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 7)),
  hitch: shared(new THREE.SphereGeometry(0.18, 8, 5)),
  jackFoot: shared(new THREE.BoxGeometry(0.42, 0.12, 0.42)),
  awningSupport: shared(new THREE.BoxGeometry(0.055, 1.12, 0.055)),
  headlight: shared(new THREE.BoxGeometry(0.12, 0.27, 0.46)),
  bumper: shared(new THREE.BoxGeometry(0.12, 0.2, 2.4)),
};

const _MATS = {
  serviceLight: new THREE.MeshStandardMaterial({ color: 0xffedbc, emissive: 0xffc979, emissiveIntensity: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x25252b, roughness: 0.82, flatShading: true }),
  glass: new THREE.MeshStandardMaterial({ color: 0x163846, roughness: 0.25, metalness: 0.12 }),
  interior: new THREE.MeshStandardMaterial({ color: 0x302729, roughness: 0.9 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xbac5c8, metalness: 0.72, roughness: 0.34 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xfff0cb, roughness: 0.66, flatShading: true }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffcc57, emissive: 0x81551a, emissiveIntensity: 0.2, roughness: 0.5 }),
  mint: new THREE.MeshStandardMaterial({ color: 0x68d9bd, roughness: 0.55, flatShading: true }),
  red: new THREE.MeshStandardMaterial({ color: 0xef625c, roughness: 0.55, flatShading: true }),
  blue: new THREE.MeshStandardMaterial({ color: 0x6ac7e8, roughness: 0.55, flatShading: true }),
  cocoa: new THREE.MeshStandardMaterial({ color: 0x49352d, roughness: 0.7, flatShading: true }),
  cheese: new THREE.MeshStandardMaterial({ color: 0xf7c34c, roughness: 0.7, flatShading: true }),
  lettuce: new THREE.MeshStandardMaterial({ color: 0x68b95d, roughness: 0.8, flatShading: true }),
};
for (const m of Object.values(_MATS)) m.userData.shared = true;

// A palette owns its body and awning colors; the sampled value selects one palette
// and one body style, so every truck still consumes exactly one rng() draw.
const _PALETTES = [
  { body: 0xff6f9c, accent: _MATS.cream, awning: _MATS.gold },
  { body: 0xffd28a, accent: _MATS.red, awning: _MATS.cream },
  { body: 0x66d9ff, accent: _MATS.cream, awning: _MATS.red },
  { body: 0x6fcf6a, accent: _MATS.gold, awning: _MATS.cream },
  { body: 0xb285ff, accent: _MATS.cream, awning: _MATS.mint },
  { body: 0xff8a5b, accent: _MATS.blue, awning: _MATS.cream },
];
const _bodyMatPool = new Map();
const _signMatPool = new Map();
const _truckGeometryPool = new Map();
function signMatFor(style, menu = false) {
  const key = `${style}:${menu}`;
  let material = _signMatPool.get(key);
  if (!material) {
    const map = makeSignTexture(style, menu);
    material = new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.8, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: menu ? 0.07 : 0.22 });
    material.userData.shared = true;
    _signMatPool.set(key, material);
  }
  return material;
}

function batchTruckGeometry(rig, cacheKey) {
  let batches = _truckGeometryPool.get(cacheKey);
  if (!batches) {
    rig.updateMatrixWorld(true);
    const inverseRig = new THREE.Matrix4().copy(rig.matrixWorld).invert();
    const buckets = new Map();
    for (const mesh of rig.children) {
      if (!mesh.isMesh) continue;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      // Every source in this model has one material group. Keeping this explicit
      // avoids flattening vertex colors or dropping the branded sign textures.
      if (materials.length !== 1) continue;
      const material = materials[0];
      let bucket = buckets.get(material);
      if (!bucket) buckets.set(material, bucket = { geometries: [], castShadow: false, receiveShadow: false, name: '' });
      if (mesh.name === 'food_truck_body') bucket.name = 'food_truck_body';
      const local = new THREE.Matrix4().multiplyMatrices(inverseRig, mesh.matrixWorld);
      const append = (matrix) => {
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        geometry.applyMatrix4(matrix);
        bucket.geometries.push(geometry);
      };
      if (mesh.isInstancedMesh) {
        const instance = new THREE.Matrix4(), transform = new THREE.Matrix4();
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, instance);
          transform.multiplyMatrices(local, instance);
          append(transform);
        }
      } else append(local);
      bucket.castShadow ||= mesh.castShadow;
      bucket.receiveShadow ||= mesh.receiveShadow;
    }
    batches = [];
    for (const [material, bucket] of buckets) {
      const geometry = BufferGeometryUtils.mergeGeometries(bucket.geometries, false);
      for (const part of bucket.geometries) part.dispose();
      if (!geometry) continue;
      batches.push({ geometry: shared(geometry), material, castShadow: bucket.castShadow, receiveShadow: bucket.receiveShadow, name: bucket.name });
    }
    _truckGeometryPool.set(cacheKey, batches);
  }
  rig.clear();
  for (const batch of batches) {
    const mesh = new THREE.Mesh(batch.geometry, batch.material);
    mesh.castShadow = batch.castShadow;
    mesh.receiveShadow = batch.receiveShadow;
    mesh.name = batch.name;
    rig.add(mesh);
  }
}
function bodyMatFor(hex) {
  let material = _bodyMatPool.get(hex);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.53, flatShading: true });
    material.userData.shared = true;
    _bodyMatPool.set(hex, material);
  }
  return material;
}

function addMesh(group, geometry, material, position, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}

function addWheels(group, positions) {
  for (const material of [_MATS.dark, _MATS.steel]) {
    const wheels = new THREE.InstancedMesh(_GEO.wheel, material, positions.length);
    const transform = new THREE.Object3D();
    positions.forEach(([x, y, z], index) => {
      const isHub = material === _MATS.steel;
      transform.position.set(x, y, z + (isHub ? Math.sign(z) * 0.08 : 0));
      transform.rotation.set(Math.PI / 2, 0, 0);
      transform.scale.setScalar(isHub ? 0.65 : 1);
      transform.updateMatrix();
      wheels.setMatrixAt(index, transform.matrix);
    });
    wheels.instanceMatrix.needsUpdate = true;
    group.add(wheels);
  }
  const fenders = new THREE.InstancedMesh(_GEO.fender, _MATS.dark, positions.length);
  const transform = new THREE.Object3D();
  positions.forEach(([x, y, z], index) => {
    transform.position.set(x, y, z + Math.sign(z) * 0.04);
    transform.rotation.set(0, z < 0 ? Math.PI : 0, 0);
    transform.updateMatrix();
    fenders.setMatrixAt(index, transform.matrix);
  });
  fenders.instanceMatrix.needsUpdate = true;
  group.add(fenders);
}

function addServingSide(group, palette, style, y, z, halfDepth, bodyRight, windowWidth = 2.65) {
  const frame = addMesh(group, _GEO.windowFrame, _MATS.steel, [0.8, y, z + 0.055]);
  frame.scale.x = windowWidth / 2.82;
  addMesh(group, _GEO.counter, _MATS.cream, [0.8, y - 0.57, z + 0.28]);
  // The wall is cut away at this point, so the customer can see into the truck.
  // Darken the back of the kitchen and put a small worktop behind the handoff.
  const recess = addMesh(group, _GEO.window, _MATS.interior, [0.8, y, halfDepth - 0.55]);
  recess.scale.x = windowWidth / 2.65;
  addMesh(group, _GEO.kitchenCounter, _MATS.steel, [0.8, y - 0.32, halfDepth - 0.4]);
  if (style === 0) {
    for (const [x, material] of [[0.4, _MATS.cheese], [0.78, _MATS.red], [1.16, _MATS.lettuce]]) {
      addMesh(group, _GEO.foodItem, material, [x, y - 0.1, halfDepth - 0.18]);
    }
  } else if (style === 1) {
    addMesh(group, _GEO.vent, _MATS.cocoa, [0.9, y + 0.02, halfDepth - 0.28]);
    addMesh(group, _GEO.cup, _MATS.cream, [1.55, y - 0.02, halfDepth - 0.16]);
    addMesh(group, _GEO.cupLid, _MATS.cocoa, [1.55, y + 0.43, halfDepth - 0.16]);
  } else {
    addMesh(group, _GEO.vent, _MATS.red, [0.35, y + 0.03, halfDepth - 0.22]);
    addMesh(group, _GEO.foodItem, _MATS.cheese, [1.1, y + 0.04, halfDepth - 0.18]);
  }
  // Raised gull-wing hatch, supported by two simple struts.
  addMesh(group, _GEO.awning, palette.awning, [0.8, y + 0.66, z + 0.65], [-0.16, 0, 0]);
  const supports = new THREE.InstancedMesh(_GEO.awningSupport, _MATS.steel, 2);
  const supportTransform = new THREE.Object3D();
  [-0.35, 1.95].forEach((x, index) => {
    supportTransform.position.set(x, y + 0.04, z + 0.39);
    supportTransform.rotation.set(0.08, 0, -0.2);
    supportTransform.updateMatrix();
    supports.setMatrixAt(index, supportTransform.matrix);
  });
  supports.instanceMatrix.needsUpdate = true;
  group.add(supports);
  const serviceLight = addMesh(group, _GEO.counter, _MATS.serviceLight, [0.8, y + 0.5, z + 0.19]);
  serviceLight.scale.set(0.8, 0.24, 0.18);
  const menuX = bodyRight - 0.48;
  addMesh(group, _GEO.menuBoard, _MATS.dark, [menuX, y, z + 0.08]);
  addMesh(group, _GEO.menuFace, signMatFor(style, true), [menuX, y, z + 0.15]);
}

function addFrontDetails(group, y, x) {
  addMesh(group, _GEO.windshield, _MATS.glass, [x, y, 0]);
  addMesh(group, _GEO.headlight, _MATS.gold, [x + 0.03, 0.85, -0.7]);
  addMesh(group, _GEO.headlight, _MATS.gold, [x + 0.03, 0.85, 0.7]);
  addMesh(group, _GEO.bumper, _MATS.steel, [x + 0.01, 0.42, 0]);
}

function buildCabTruck(group, palette, bodyMat) {
  const body = addMesh(group, _GEO.box, bodyMat, [0.5, 1.9, 0]);
  body.name = 'food_truck_body';
  addMesh(group, _GEO.cab, bodyMat, [-2.5, 1.4, 0]);
  addFrontDetails(group, 1.8, -3.45);
  addServingSide(group, palette, 0, 2.35, 1.64, 1.6, 3.5);
  addMesh(group, _GEO.driverWindow, _MATS.glass, [-2.55, 1.94, 1.53]);
  addMesh(group, _GEO.doorLine, _MATS.dark, [-2.0, 1.32, 1.53]);
  addMesh(group, _GEO.doorLine, _MATS.dark, [-3.38, 1.32, 1.53]);
  addMesh(group, _GEO.stripe, palette.accent, [0.5, 1.28, 1.63]);
  addMesh(group, _GEO.sign, palette.awning, [0.5, 3.75, 1.82], [-0.12, 0, 0]);
  addMesh(group, _GEO.signFace, signMatFor(0), [0.5, 3.75, 1.92], [-0.12, 0, 0]);
  addMesh(group, _GEO.vent, _MATS.steel, [1.95, 3.48, -0.5]);
  addMesh(group, _GEO.tacoShell, _MATS.cream, [2.4, 3.6, -0.55]);
  const tacoToppings = new THREE.InstancedMesh(_GEO.foodItem, _MATS.lettuce, 3);
  const toppingTransform = new THREE.Object3D();
  [2.15, 2.45, 2.7].forEach((x, index) => {
    toppingTransform.position.set(x, 3.95, -0.55);
    toppingTransform.updateMatrix();
    tacoToppings.setMatrixAt(index, toppingTransform.matrix);
  });
  tacoToppings.instanceMatrix.needsUpdate = true;
  group.add(tacoToppings);
  addWheels(group, [[-2.5, 0.5, -1.5], [-2.5, 0.5, 1.5], [1.5, 0.5, -1.5], [1.5, 0.5, 1.5]]);
}

function buildStepVan(group, palette, bodyMat) {
  // One tall walk-in body gives this rig the unmistakable delivery-van profile.
  const body = addMesh(group, _GEO.stepVan, bodyMat, [0.05, 2.05, 0]);
  body.name = 'food_truck_body';
  addFrontDetails(group, 2.2, -3.2);
  addServingSide(group, palette, 1, 2.35, 1.64, 1.6, 3.4, 3.1);
  addMesh(group, _GEO.driverWindow, _MATS.glass, [-2.45, 2.88, 1.63]);
  addMesh(group, _GEO.doorLine, _MATS.dark, [-1.55, 1.8, 1.63]);
  addMesh(group, _GEO.stripe, palette.accent, [0.05, 1.35, 1.63]);
  const brand = addMesh(group, _GEO.sign, palette.awning, [0.25, 4.1, 1.82]);
  brand.scale.y = 0.7;
  const brandFace = addMesh(group, _GEO.signFace, signMatFor(1), [0.25, 4.1, 1.92]);
  brandFace.scale.y = 0.9;
  addMesh(group, _GEO.vent, _MATS.steel, [-0.2, 3.85, -0.55]);
  addMesh(group, _GEO.ventStack, _MATS.steel, [2.0, 3.88, -0.65]);
  addMesh(group, _GEO.cup, _MATS.cream, [2.2, 4.0, -0.55]).scale.setScalar(0.38);
  addMesh(group, _GEO.cupLid, _MATS.cocoa, [2.2, 4.16, -0.55]).scale.setScalar(0.38);
  addWheels(group, [[-2.25, 0.55, -1.55], [-2.25, 0.55, 1.55], [2.3, 0.55, -1.55], [2.3, 0.55, 1.55]]);
}

function buildTrailer(group, palette, bodyMat) {
  // Compact concession trailer: tall serving box, tandem axle, and tow tongue.
  const body = addMesh(group, _GEO.trailer, bodyMat, [0.3, 1.72, 0]);
  body.name = 'food_truck_body';
  addMesh(group, _GEO.towBeam, _MATS.dark, [-2.87, 0.78, 0.35], [0, -2.65, 0]).scale.x = 0.8;
  addMesh(group, _GEO.towBeam, _MATS.dark, [-2.87, 0.78, -0.35], [0, 2.65, 0]).scale.x = 0.8;
  addMesh(group, _GEO.jack, _MATS.steel, [-3.2, 0.38, 0]);
  addMesh(group, _GEO.hitch, _MATS.steel, [-3.39, 0.82, 0]);
  addMesh(group, _GEO.jackFoot, _MATS.steel, [-3.2, 0.05, 0]);
  addServingSide(group, palette, 2, 1.95, 1.74, 1.7, 3.4, 2.9);
  addMesh(group, _GEO.stripe, palette.accent, [0.3, 0.98, 1.73]);
  addMesh(group, _GEO.sign, palette.awning, [0.65, 3.25, 1.92]);
  addMesh(group, _GEO.signFace, signMatFor(2), [0.65, 3.25, 2.02]);
  addMesh(group, _GEO.triangleBadge, _MATS.cheese, [2.55, 3.25, 2.12], [Math.PI / 2, 0, 0]);
  for (const [x, y] of [[2.35, 3.1], [2.65, 3.12], [2.5, 3.42]]) addMesh(group, _GEO.foodItem, _MATS.red, [x, y, 2.2]);
  addMesh(group, _GEO.vent, _MATS.steel, [2.15, 3.2, -0.55]);
  addWheels(group, [[-0.8, 0.5, -1.68], [-0.8, 0.5, 1.68], [1.35, 0.5, -1.68], [1.35, 0.5, 1.68]]);
}

export function buildFoodTruck(rng = Math.random) {
  const sample = Math.max(0, Math.min(0.999999, rng()));
  const slot = Math.floor(sample * _PALETTES.length * 3);
  const style = slot % 3;
  const palette = _PALETTES[Math.floor(slot / 3)];
  const bodyMat = bodyMatFor(palette.body);
  const group = new THREE.Group();
  const rig = new THREE.Group();

  if (style === 0) buildCabTruck(rig, palette, bodyMat);
  else if (style === 1) buildStepVan(rig, palette, bodyMat);
  else buildTrailer(rig, palette, bodyMat);
  batchTruckGeometry(rig, `${style}:${Math.floor(slot / 3)}`);
  group.userData.foodTruckStyle = ['taco', 'coffee', 'pizza'][style];
  group.userData.foodTruckPalette = Math.floor(slot / 3);
  group.userData.foodTruckOpening = [0.8, [2.35, 2.35, 1.95][style], [2.65, 3.1, 2.9][style], 0.92, [1.6, 1.6, 1.7][style]];
  rig.scale.setScalar(0.92); // All three rigs fit inside the existing collision radius.
  group.add(rig);

  // Main body owns the broad silhouette and one clear shadow; decorative pieces
  // stay cheap and shadow-free. This is a static prop in the streamed world.
  for (const mesh of rig.children) {
    if (mesh.material === bodyMat) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      break;
    }
  }
  group.scale.setScalar(FOOD_TRUCK_SCALE);
  if (MODEL_DECOR_MERGE_ENABLED) mergeStaticDecor(group, { castShadow: (mesh) => mesh.castShadow });
  return group;
}
