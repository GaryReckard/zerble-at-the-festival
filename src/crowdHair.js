import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Head-local authored shapes, baked in the same standing coordinates as Crowd.
// Each returned geometry belongs to its Crowd instance, not to a global cache.
function merge(parts) {
  const flat = parts.map(g => g.index ? g.toNonIndexed() : g.clone());
  // Hair uses instance color only; primitives also supply unused UVs.
  for (const g of flat) g.deleteAttribute('uv');
  const result = mergeGeometries(flat);
  for (const g of [...parts, ...flat]) g.dispose();
  return result;
}

function surface(rows, columns, point) {
  const positions = [], indices = [];
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    positions.push(...point(row / rows, col / columns));
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + columns + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function cap(swept = false) {
  return surface(5, 16, (v, u) => {
    const a = u * Math.PI * 2;
    const front = Math.max(0, Math.cos(a));
    // Raised forehead, temples and a lower nape follow the skull, rather than
    // hiding the eyes behind a horizontal hemisphere rim.
    const edgeY = 1.57 + .21 * front ** 3 + .035 * Math.abs(Math.sin(a));
    const theta = v * Math.acos((edgeY - 1.65) / .292);
    const wave = 1 + .025 * Math.sin(a * 5 + v * 2);
    const lift = swept ? .045 * Math.sin(theta) * Math.max(0, -Math.sin(a)) : 0;
    return [Math.sin(a) * Math.sin(theta) * .282 * wave,
      1.65 + Math.cos(theta) * .292 + lift,
      -Math.cos(a) * Math.sin(theta) * .282 * wave];
  });
}

function lock(points, radii, sides = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const up = new THREE.Vector3(0, 0, 1);
  return surface(radii.length - 1, sides, (t, u) => {
    const p = curve.getPoint(t), tangent = curve.getTangent(t);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    const radius = radii[Math.round(t * (radii.length - 1))];
    const a = u * Math.PI * 2;
    p.addScaledVector(normal, Math.cos(a) * radius);
    p.addScaledVector(binormal, Math.sin(a) * radius);
    return p.toArray();
  });
}

export function buildCrowdHair() {
  const shortHair = merge([cap(true), lock([
    [.16, 1.85, -.16], [.06, 1.91, -.19], [-.09, 1.87, -.22], [-.20, 1.76, -.15],
  ], [0, .065, .073, .045, 0])]);

  const curlParts = [cap()];
  // Staggered coils overlap a continuous scalp so no bald holes show on orbit.
  for (let ring = 0; ring < 3; ring++) {
    const count = [3, 7, 10][ring];
    for (let i = 0; i < count; i++) {
      const a = (i + ring * .45) * Math.PI * 2 / count;
      const theta = [.25, .78, 1.45 - .50 * Math.max(0, Math.cos(a))][ring];
      const coil = new THREE.SphereGeometry(.085 + .008 * Math.sin(i * 2.4 + ring), 6, 3);
      coil.scale(1, .88, 1);
      coil.rotateY(a);
      coil.translate(Math.sin(a) * Math.sin(theta) * .255,
        1.66 + Math.cos(theta) * .285, -Math.cos(a) * Math.sin(theta) * .255);
      curlParts.push(coil);
    }
  }
  const curls = merge(curlParts);

  // Open at the face; a scalloped hem and broad longitudinal folds replace
  // the old rectangular back slab. The top is embedded in the scalp cap.
  const curtain = surface(5, 16, (v, u) => {
    const a = .88 + u * (Math.PI * 2 - 1.76);
    const fold = .015 * Math.cos(u * Math.PI * 12 + v * .6);
    const radius = .245 + .035 * Math.sin(v * Math.PI) + fold;
    return [Math.sin(a) * radius, 1.76 - .69 * v + .027 * v * Math.cos(u * Math.PI * 8),
      -Math.cos(a) * radius + .035 * v];
  });
  const longParts = [cap(), curtain];
  for (const side of [-1, 1]) longParts.push(lock([
    [side * .09, 1.91, -.10], [side * .235, 1.76, -.13],
    [side * .25, 1.44, -.08], [side * .22, 1.12, .015],
  ], [0, .058, .063, .055, .033, 0]));
  const longHair = merge(longParts);

  const ponytail = merge([cap(), lock([
    [0, 1.80, .20], [0, 1.75, .35], [.035, 1.47, .40], [.07, 1.18, .33],
  ], [0, .075, .105, .09, .065, .035, 0], 8)]);

  const bunParts = [cap()];
  const bunCore = new THREE.IcosahedronGeometry(.135, 1);
  bunCore.scale(1, .85, 1); bunCore.translate(0, 1.98, .14);
  bunParts.push(bunCore);
  // A wrapped seam makes the updo read as gathered hair at close range.
  bunParts.push(lock([
    [-.08, 1.95, .06], [-.10, 2.02, .14], [0, 2.08, .18], [.10, 2.01, .19], [.06, 1.92, .18],
  ], [0, .028, .03, .03, .025, 0], 5));
  const bun = merge(bunParts);

  const braidParts = [cap()];
  for (const side of [-1, 1]) for (const strand of [0, 1]) {
    const points = [], radii = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, phase = t * Math.PI * 6 + strand * Math.PI;
      const weave = .025 * (1 - t * .55);
      points.push([side * (.225 + .025 * Math.sin(t * Math.PI)) + Math.sin(phase) * weave,
        1.73 - t * .65, .06 + .055 * t + Math.cos(phase) * weave]);
      radii.push(i === 12 ? 0 : .033 * (1 - .55 * t));
    }
    braidParts.push(lock(points, radii, 4));
  }
  const braids = merge(braidParts);
  return [shortHair, curls, longHair, ponytail, bun, braids];
}

const personGeometries = new Map(), personMaterials = new Map();
const styleNames = ['cropped', 'curls', 'long', 'ponytail', 'bun', 'braids'];

// Unit head radii, centered on the skull, facing -Z. Specialist models use
// different skull proportions and origins; never fit hair to the whole body.
export function getPersonHairGeometry(style = 'cropped') {
  if (!personGeometries.size) {
    const shapes = buildCrowdHair();
    const close = cap();
    close.translate(0, -1.65, 0); close.scale(1, .96, 1); close.translate(0, 1.65, 0);
    shapes.push(close);
    [...styleNames, 'close'].forEach((name, i) => {
      const geo = shapes[i];
      geo.translate(0, -1.65, 0); geo.scale(1 / .26, 1 / .26, 1 / .26);
      geo.userData.shared = true;
      personGeometries.set(name, geo);
    });
  }
  const geometry = personGeometries.get(style);
  if (!geometry) throw new Error(`Unknown person hair style: ${style}`);
  return geometry;
}

export function copyPersonHairGeometry(style, radii = [.26, .26, .26], center = [0, 1.65, 0], yaw = 0) {
  const geo = getPersonHairGeometry(style).clone();
  // Baking consumers own this copy and may dispose it after merging.
  // BufferGeometry.copy aliases userData in Three r160, so replace that object.
  geo.userData = {};
  geo.scale(...radii); geo.rotateY(yaw); geo.translate(...center);
  return geo;
}

export function makePersonHair({style = 'cropped', color = 0x493125, radii = [.26, .26, .26], center = [0, 1.65, 0], yaw = 0} = {}) {
  if (!personMaterials.has(color)) {
    const mat = new THREE.MeshStandardMaterial({color, roughness: .9});
    mat.userData.shared = true;
    personMaterials.set(color, mat);
  }
  const mesh = new THREE.Mesh(getPersonHairGeometry(style), personMaterials.get(color));
  mesh.name = `Hair: ${style}`;
  mesh.scale.set(...radii); mesh.position.set(...center); mesh.rotation.y = yaw;
  mesh.castShadow = false;
  return mesh;
}

// Authored dreadlocks retain their character-specific paths and colors.
export { lock as buildHairLock };
