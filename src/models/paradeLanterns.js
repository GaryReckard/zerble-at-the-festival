import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PARADE_ROSTER = Object.freeze(['heron', 'dragon', 'seahorse', 'jellyfish', 'moon', 'star']);

let paperTexture;
function getPaperTexture() {
  if (paperTexture) return paperTexture;
  const data = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const fiber = puppetRandom(x + y * 64, 991);
    const fold = Math.pow(Math.abs(Math.sin(x * 0.37 + Math.sin(y * 0.19) * 1.8)), 18);
    const value = Math.round(222 + fiber * 26 - fold * 23);
    const i = (y * 64 + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value;
    data[i + 3] = 255;
  }
  paperTexture = new THREE.DataTexture(data, 64, 64);
  paperTexture.wrapS = paperTexture.wrapT = THREE.RepeatWrapping;
  paperTexture.magFilter = THREE.LinearFilter;
  paperTexture.needsUpdate = true;
  paperTexture.userData.shared = true;
  return paperTexture;
}

export function puppetRandom(seed, salt) {
  let n = Math.imul((seed | 0) ^ salt, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// Each articulated piece batches its paper, spars, and LEDs separately.
function piece(parent, name, position = [0, 0, 0]) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  parent.add(group);
  const batches = new Map();
  return {
    group,
    add(geometry, material) {
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material).push(geometry.index ? geometry.toNonIndexed() : geometry);
      if (geometry.index) geometry.dispose();
    },
    finish() {
      for (const [mat, geometries] of batches) {
        const geometry = mergeGeometries(geometries);
        for (const source of geometries) source.dispose();
        geometry.computeBoundingSphere();
        group.add(new THREE.Mesh(geometry, mat));
      }
      return group;
    },
  };
}

function tube(part, points, radius, mat, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)), closed);
  part.add(new THREE.TubeGeometry(curve, Math.max(8, points.length * 2), radius, 4, closed), mat);
}

function ellipsoid(part, center, scale, mat) {
  const geo = new THREE.SphereGeometry(1, 12, 8);
  geo.scale(...scale).translate(...center);
  part.add(geo, mat);
}

// A section follows a curve in the YZ plane. The frame uses these exact same
// sections, slightly proud of the opaque paper, rather than floating hoops.
function shell(part, controls, paper, frame, { rings = 24, sides = 12, ribEvery = 3, seed = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(controls.map(p => new THREE.Vector3(0, p[0], p[1])));
  const centers = [], sections = [], positions = [], indices = [], uvs = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const p = curve.getPoint(t), tangent = curve.getTangent(t);
    const k = Math.min(controls.length - 2, Math.floor(t * (controls.length - 1)));
    const f = t * (controls.length - 1) - k;
    const rx = THREE.MathUtils.lerp(controls[k][2], controls[k + 1][2], f);
    const ry = THREE.MathUtils.lerp(controls[k][3], controls[k + 1][3], f);
    const section = [];
    for (let j = 0; j < sides; j++) {
      const a = j / sides * Math.PI * 2;
      const wrinkle = 1 + (puppetRandom(seed, i * sides + j + 7) - 0.5) * 0.045;
      const x = Math.cos(a) * rx * wrinkle;
      const y = Math.sin(a) * ry * wrinkle * -tangent.z;
      const z = Math.sin(a) * ry * wrinkle * tangent.y;
      section.push(new THREE.Vector3(x * 1.012, p.y + y * 1.012, p.z + z * 1.012));
      positions.push(x, p.y + y, p.z + z);
      uvs.push(j / sides, t);
      if (i < rings) {
        const n = i * sides + j, next = i * sides + (j + 1) % sides;
        indices.push(n, n + sides, next, next, n + sides, next + sides);
      }
    }
    centers.push(p);
    sections.push(section);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  part.add(geo, paper);
  for (let i = ribEvery; i < rings; i += ribEvery) tube(part, sections[i], 0.011, frame, true);
  for (const j of [0, sides / 4, sides / 2, sides * 3 / 4]) {
    tube(part, sections.map(s => s[Math.floor(j)]), 0.009, frame);
  }
  return { centers, sections };
}

function panel(part, outline, mat, frame, thickness = 0.07) {
  const shape = new THREE.Shape();
  outline.forEach(([y, z], i) => i ? shape.lineTo(z, y) : shape.moveTo(z, y));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  // Shape XY -> puppet ZY, with thickness along X.
  geo.rotateY(-Math.PI / 2).translate(thickness / 2, 0, 0);
  part.add(geo, mat);
  for (const x of [-thickness / 2 - 0.006, thickness / 2 + 0.006]) {
    tube(part, outline.map(([y, z]) => [x, y, z]), 0.012, frame, true);
  }
}

function eyes(part, y, z, width, gold, dark) {
  for (const side of [-1, 1]) {
    ellipsoid(part, [side * width, y, z], [0.022, 0.085, 0.085], gold);
    ellipsoid(part, [side * (width + 0.025), y, z - 0.012], [0.018, 0.047, 0.045], dark);
  }
}

export function buildLantern(kind, seed) {
  if (!PARADE_ROSTER.includes(kind)) throw new Error(`Unknown parade lantern: ${kind}`);
  const group = new THREE.Group();
  group.name = `${kind}-lantern`;
  const glow = [];
  const mat = (color, emission = null, intensity = 0.7) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0,
      ...(emission === null ? {} : { emissive: emission, emissiveIntensity: 0,
        map: getPaperTexture(), emissiveMap: getPaperTexture() }) });
    if (emission !== null) glow.push({ material: m, intensity });
    return m;
  };
  const paper = mat(kind === 'dragon' ? 0xe9672e : 0xe4dce9, kind === 'dragon' ? 0xff5515 : 0xc5b0ed);
  const warm = mat(0xf9c775, 0xffa938, 1.05);
  const frame = mat(kind === 'dragon' ? 0x733620 : 0x75657a);
  const dark = mat(0x26232c);
  const gold = mat(0xe8b944, 0xffb624, 0.35);
  const led = mat(0xfff2dc, 0xffe8c4, 2.0);
  const moving = [];
  const attachments = [];
  const main = piece(group, `${kind}-shell`);

  if (kind === 'heron') {
    shell(main, [[2.12, 0.86, 0.025, 0.03], [2.65, 0.52, 0.43, 0.49],
      [3.35, 0.25, 0.65, 0.72], [3.87, -0.02, 0.39, 0.36], [3.97, -0.18, 0.09, 0.1]], paper, frame, { seed });
    const neck = piece(group, 'heron-neck', [0, 3.84, -0.16]);
    const neckSurface = shell(neck, [[0, 0, 0.17, 0.20], [-0.28, -0.36, 0.17, 0.19],
      [-0.65, -0.69, 0.15, 0.16], [-0.58, -1.03, 0.125, 0.14],
      [0.03, -1.16, 0.105, 0.12], [0.95, -1.17, 0.105, 0.12],
      [1.72, -1.24, 0.13, 0.14]], paper, frame, { rings: 36, ribEvery: 3, seed });
    for (let i = 2; i < 35; i += 3) {
      for (const j of [0, 6]) ellipsoid(neck, neckSurface.sections[i][j].toArray(), [0.018, 0.027, 0.025], led);
    }
    const head = piece(neck.group, 'heron-head', [0, 1.73, -1.24]);
    shell(head, [[-0.05, 0.18, 0.015, 0.025], [0.08, 0, 0.23, 0.27],
      [0.015, -0.29, 0.17, 0.17], [-0.08, -1.18, 0.005, 0.006]], paper, frame, { rings: 20, ribEvery: 4, seed });
    for (const side of [-1, 1]) tube(head, [[side * 0.17, -0.055, -0.2], [side * 0.09, -0.085, -0.68], [0, -0.09, -1.18]], 0.013, dark);
    eyes(head, 0.09, -0.17, 0.205, gold, dark);
    head.finish();
    neck.finish();
    moving.push({ node: neck.group, axis: 'x', amount: 0.022, phase: 0.4, rate: 0.5 });
    for (const side of [-1, 1]) {
      const wing = piece(group, `heron-folded-wing-${side}`, [side * 0.47, 3.67, 0.09]);
      panel(wing, [[0.12, -0.32], [-0.09, 0.46], [-0.63, 0.81], [-1.69, 0.78],
        [-1.37, 0.43], [-1.04, 0.2], [-0.7, -0.15]], paper, frame, 0.18);
      for (let i = 0; i < 5; i++) {
        const y = -0.14 - i * 0.25;
        for (const x of [-0.10, 0.10]) tube(wing, [[x, y, 0.04 + i * 0.11], [x, y - 0.15, 0.49], [x, y - 0.26, 0.70]], 0.01, frame);
      }
      wing.group.rotation.y = side * 0.12;
      wing.finish();
      const leg = piece(group, `heron-puppet-leg-${side}`, [side * 0.27, 2.8, 0.15]);
      tube(leg, [[0, 0, 0], [0, -1.44, 0.12], [0, -2.65, -0.51]], 0.031, paper);
      tube(leg, [[0, -2.65, -0.51], [side * 0.14, -2.7, -0.77]], 0.021, paper);
      for (let i = 1; i <= 11; i++) {
        const t = i / 11;
        const y = -2.65 * t, z = t < 0.54 ? 0.12 * t / 0.54 : 0.12 - (t - 0.54) / 0.46 * 0.63;
        ellipsoid(leg, [0.035 * side, y, z], [0.022, 0.034, 0.025], led);
      }
      leg.finish();
      moving.push({ node: leg.group, axis: 'x', amount: 0.025, phase: side, rate: 1 });
    }
    attachments.push([0, 3.5, 0.1]);
  } else if (kind === 'dragon') {
    const belly = mat(0xffbc58, 0xffa527, 1.25);
    shell(main, [[3.78, -2.32, 0.1, 0.16], [3.28, -1.94, 0.44, 0.42],
      [2.83, -1.40, 0.54, 0.52], [2.84, -0.40, 0.54, 0.56],
      [2.80, 0.7, 0.42, 0.42], [2.53, 1.8, 0.27, 0.27],
      [2.13, 2.63, 0.17, 0.18], [1.98, 3.04, 0.12, 0.13],
      [2.32, 3.23, 0.075, 0.08], [2.62, 2.79, 0.008, 0.01]], paper, frame, { rings: 48, seed });
    for (const side of [-1, 1]) {
      const inset = piece(group, `dragon-belly-${side}`, [side * 0.43, 0, 0]);
      panel(inset, [[2.98, -1.5], [2.42, -1.18], [2.37, 0.65], [2.61, 1.15], [2.76, 0.5]], belly, frame, 0.025);
      inset.finish();
    }
    const head = piece(group, 'dragon-head', [0, 3.66, -2.15]);
    shell(head, [[0, 0.16, 0.06, 0.08], [0.37, -0.03, 0.32, 0.35],
      [0.42, -0.47, 0.31, 0.23], [0.18, -0.92, 0.16, 0.11], [0.12, -1.04, 0.015, 0.02]], paper, frame, { rings: 20, seed });
    eyes(head, 0.47, -0.35, 0.31, gold, dark);
    for (const side of [-1, 1]) {
      tube(head, [[side * 0.28, 0.24, -0.38], [side * 0.21, 0.11, -0.79], [side * 0.13, 0.11, -0.98]], 0.027, dark);
      const horn = new THREE.ConeGeometry(0.10, 0.48, 5).translate(side * 0.24, 0.91, -0.02);
      head.add(horn, warm);
    }
    head.finish();
    moving.push({ node: head.group, axis: 'x', amount: 0.04, phase: 0.7, rate: 0.5 });
    for (let i = 0; i < 12; i++) {
      const z = -1.7 + i * 0.38;
      const y = i < 7 ? 3.35 - i * 0.025 : 3.2 - (i - 6) * 0.17;
      panel(main, [[y, z], [y + 0.34 - i * 0.012, z + 0.1], [y - 0.02, z + 0.31]], warm, frame, 0.055);
    }
    for (const side of [-1, 1]) {
      const wing = piece(group, `dragon-wing-${side}`, [side * 0.35, 3.13, -0.85]);
      const outline = [[0, 0, 0], [side * 0.95, 0.68, -0.20], [side * 2.15, 0.48, 0.08],
        [side * 1.77, 0.03, 0.62], [side * 1.38, -0.04, 0.29], [side * 1.11, -0.12, 1.08],
        [side * 0.69, -0.17, 0.63], [side * 0.3, -0.13, 1.14]];
      const points = [];
      for (let i = 1; i < outline.length - 1; i++) points.push(...outline[0], ...outline[i], ...outline[i + 1]);
      const membrane = new THREE.BufferGeometry();
      membrane.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      membrane.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap((_, i) => i % 3 ? [] : [points[i], points[i + 2]]), 2));
      membrane.computeVertexNormals();
      const wingMat = mat(0xb93625, 0xef3d14, 0.65);
      wingMat.side = THREE.DoubleSide;
      wing.add(membrane, wingMat);
      tube(wing, outline, 0.018, frame, true);
      for (const i of [2, 3, 5, 7]) tube(wing, [outline[0], outline[1], outline[i]], 0.014, frame);
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        ellipsoid(wing, [side * (0.15 + 1.94 * t), 0.12 + 0.5 * Math.sin(t * 2), -0.05], [0.024, 0.024, 0.024], led);
      }
      wing.finish();
      moving.push({ node: wing.group, axis: 'z', amount: 0.055, phase: side, rate: 0.5 });
    }
    attachments.push([0, 3.35, -1.65], [0, 2.84, 0], [0, 2.51, 1.8]);
  } else if (kind === 'seahorse') {
    shell(main, [[1.64, -0.8, 0.015, 0.018], [1.28, -0.82, 0.10, 0.11],
      [1.13, -0.4, 0.15, 0.16], [1.44, 0, 0.17, 0.19], [2.10, 0.12, 0.25, 0.33],
      [2.77, -0.17, 0.40, 0.55], [3.40, -0.24, 0.34, 0.43],
      [3.98, -0.34, 0.27, 0.29], [4.15, -0.67, 0.22, 0.27],
      [3.83, -1.02, 0.18, 0.18], [3.52, -1.16, 0.09, 0.10]], paper, frame, { rings: 48, seed });
    eyes(main, 4.03, -0.62, 0.245, gold, dark);
    panel(main, [[3.98, -0.07], [4.45, 0.02], [4.29, 0.23], [3.85, 0.34],
      [3.44, 0.3], [2.83, 0.47], [2.28, 0.4]], paper, frame, 0.08);
    const fin = piece(group, 'seahorse-fin', [0.27, 2.97, 0.2]);
    panel(fin, [[0.15, 0], [0.47, 0.57], [0.08, 0.48], [-0.26, 0.68], [-0.25, 0]], paper, frame);
    fin.finish();
    moving.push({ node: fin.group, axis: 'y', amount: 0.09, phase: 0, rate: 1 });
    attachments.push([0, 2.8, 0]);
  } else if (kind === 'jellyfish') {
    shell(main, [[4.07, 0, 0.012, 0.012], [4, 0, 0.53, 0.53],
      [3.78, 0, 0.81, 0.81], [3.47, 0, 0.91, 0.91]], paper, frame, { rings: 18, ribEvery: 6, seed });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const strand = piece(group, `jellyfish-ribbon-${i}`, [Math.cos(a) * 0.76, 3.5, Math.sin(a) * 0.76]);
      const length = 1.3 + puppetRandom(seed, i + 80) * 0.65;
      const points = Array.from({ length: 9 }, (_, k) => [Math.sin(k * 1.2 + i) * 0.075, -k / 8 * length, Math.sin(k + i) * 0.055]);
      tube(strand, points, i % 3 === 0 ? 0.037 : 0.018, paper);
      for (let j = 1; j < 8; j += 2) ellipsoid(strand, points[j], [0.024, 0.035, 0.024], led);
      strand.finish();
      moving.push({ node: strand.group, axis: 'z', amount: 0.09, phase: i * 0.7, rate: 0.5 });
    }
    attachments.push([0, 3.77, 0]);
  } else if (kind === 'moon') {
    shell(main, [[3.48, 0, 0.015, 0.015], [3.34, 0, 0.33, 0.33],
      [3.06, 0, 0.43, 0.43], [2.79, 0, 0.32, 0.32], [2.67, 0, 0.01, 0.01]], warm, frame, { rings: 20, ribEvery: 5, seed });
    const patch = mat(0xda9b4c, 0xf28b28, 0.65);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, y = 2.85 + puppetRandom(seed, i + 31) * 0.45;
      ellipsoid(main, [Math.cos(a) * 0.35, y, Math.sin(a) * 0.35], [0.085, 0.06, 0.06], patch);
    }
    attachments.push([0, 3.06, 0]);
  } else {
    const outline = Array.from({ length: 10 }, (_, i) => {
      const a = i / 10 * Math.PI * 2, r = i % 2 ? 0.25 : 0.58;
      return [3.1 + Math.cos(a) * r, Math.sin(a) * r];
    });
    panel(main, outline, warm, frame, 0.18);
    for (const x of [-0.1, 0.1]) for (let i = 0; i < 10; i += 2) tube(main, [[x, 3.1, 0], [x, ...outline[i]]], 0.012, frame);
    group.rotation.y = Math.PI / 2;
    attachments.push([0, 3.1, 0]);
  }
  main.finish();
  // Only materials actually used by the finished meshes belong to this model.
  const used = new Set();
  group.traverse(n => { if (n.material) used.add(n.material); });
  for (const m of [paper, warm, frame, dark, gold, led]) if (!used.has(m)) m.dispose();
  return { group, moving, attachments, glow: glow.filter(g => used.has(g.material)) };
}
