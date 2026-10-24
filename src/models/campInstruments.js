import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CAMP_INSTRUMENT_KINDS = Object.freeze(['guitar', 'banjo', 'bass', 'fiddle', 'mandolin']);
const pools = new Map();
const materials = [0xc18c48, 0x493023, 0xd5c7a4, 0x252729].map(color => {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: .78, flatShading: true });
  mat.userData.shared = true;
  return mat;
});
function makePool(kind) {
  const parts = [[], [], [], []], bass = kind === 'bass', fiddle = kind === 'fiddle';
  const width = bass ? .43 : fiddle ? .21 : kind === 'mandolin' ? .23 : .33;
  const bodyHeight = bass ? .66 : fiddle ? .34 : kind === 'mandolin' ? .32 : .42;
  const neckLength = bass ? .67 : fiddle ? .3 : kind === 'mandolin' ? .3 : .46;
  const thickness = bass ? .17 : .105;
  function add(geo, bucket, x = 0, y = 0, z = 0) { geo.translate(x, y, z); parts[bucket].push(geo); }
  function box(bucket, x, y, z, sx, sy, sz) { add(new THREE.BoxGeometry(sx, sy, sz), bucket, x, y, z); }
  function disc(bucket, radius, depth, x, y, z) {
    const geo = new THREE.CylinderGeometry(radius, radius, depth, 16);
    geo.rotateX(Math.PI / 2); add(geo, bucket, x, y, z);
  }
  if (kind === 'banjo') {
    disc(1, width / 2 + .014, thickness, 0, 0, 0);
    disc(2, width / 2, .012, 0, 0, thickness / 2 + .007);
    // Metal tension hooks distinguish the drum head from a guitar sound box.
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      box(2, Math.cos(angle) * (width / 2 + .012), Math.sin(angle) * (width / 2 + .012), 0, .012, .025, thickness * 1.1);
    }
  } else {
    const shape = new THREE.Shape();
    const w = width / 2, h = bodyHeight / 2;
    // Pinched waists and separate bouts make these read as acoustic bodies,
    // rather than oval signs; mandolin uses a small teardrop body instead.
    shape.moveTo(0, -h);
    if (kind === 'mandolin') {
      shape.bezierCurveTo(-w * 1.5, -h, -w * 1.4, h * .2, 0, h);
      shape.bezierCurveTo(w * 1.4, h * .2, w * 1.5, -h, 0, -h);
    } else {
      shape.bezierCurveTo(-w * 1.3, -h, -w * 1.1, -h * .25, -w * .58, h * .1);
      shape.bezierCurveTo(-w * 1.1, h * .58, -w * .68, h, 0, h);
      shape.bezierCurveTo(w * .68, h, w * 1.1, h * .58, w * .58, h * .1);
      shape.bezierCurveTo(w * 1.1, -h * .25, w * 1.3, -h, 0, -h);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 5 });
    add(geo, 0, 0, 0, -thickness / 2);
    if (bass || fiddle) {
      // Paired f-hole marks, deliberately just wide enough to read at a fire.
      for (const x of [-width * .26, width * .26]) {
        box(3, x, -.015, thickness / 2 + .004, .014, bodyHeight * .24, .006);
        disc(3, .012, .007, x - .006, bodyHeight * .12 - .015, thickness / 2 + .004);
        disc(3, .012, .007, x + .006, -bodyHeight * .12 - .015, thickness / 2 + .004);
      }
    } else disc(3, width * .15, .008, 0, bodyHeight * .16, thickness / 2 + .005);
  }
  const bodyTop = kind === 'banjo' ? width / 2 : bodyHeight / 2;
  box(1, 0, bodyTop + neckLength / 2 - .025, .008, width * .16, neckLength, .045);
  box(3, 0, bodyTop + neckLength / 2 - .04, .034, width * .145, neckLength * .96, .009);
  box(1, 0, bodyTop + neckLength + .015, .008, width * .25, .12, .05);
  box(1, 0, -bodyHeight * .19, thickness / 2 + .011, width * .44, .027, .022);
  const strings = kind === 'bass' || fiddle ? 4 : kind === 'banjo' ? 5 : kind === 'mandolin' ? 8 : 6;
  const stringTop = bodyTop + neckLength + .055, stringBottom = -bodyHeight * .2;
  for (let i = 0; i < strings; i++) {
    const x = kind === 'mandolin' ? (Math.floor(i / 2) - 1.5) * .009 + (i % 2 ? .0018 : -.0018)
      : (i - (strings - 1) / 2) * .006;
    box(2, x, (stringTop + stringBottom) / 2, thickness / 2 + .025, .0018, stringTop - stringBottom, .0018);
  }
  for (let i = 0; i < strings; i++) {
    box(2, (i % 2 ? -1 : 1) * width * .17, bodyTop + neckLength - .015 + Math.floor(i / 2) * .025, .008, .025, .014, .025);
  }
  if (bass) box(2, 0, -bodyHeight / 2 - .12, 0, .014, .24, .014);
  const geometries = parts.map(bucket => {
    if (!bucket.length) return null;
    const geometry = mergeGeometries(bucket, false);
    for (const part of bucket) part.dispose();
    geometry.userData.shared = true;
    return geometry;
  });
  const bowGeometries = fiddle ? [new THREE.BoxGeometry(.62, .009, .012), new THREE.BoxGeometry(.6, .004, .008)] : [];
  for (const geo of bowGeometries) geo.userData.shared = true;
  return { geometries, bowGeometries,
    grip: { left: [0, bodyTop + neckLength * .52, thickness / 2 + .04], right: [width * .12, 0, thickness / 2 + .07] },
    height: bodyTop + neckLength + .075 + bodyHeight / 2 + (bass ? .24 : 0), width };
}

// Body origin is the acoustic sound box center, the neck points +Y and the
// strings face +Z. The actor rig owns all placement and torso attachment.
export function buildCampInstrument(kind = 'guitar') {
  if (!CAMP_INSTRUMENT_KINDS.includes(kind)) kind = 'guitar';
  if (!pools.has(kind)) pools.set(kind, makePool(kind));
  const pool = pools.get(kind), group = new THREE.Group();
  group.name = `camp-instrument-${kind}`;
  for (let i = 0; i < pool.geometries.length; i++) if (pool.geometries[i]) group.add(new THREE.Mesh(pool.geometries[i], materials[i]));
  let bow = null;
  if (kind === 'fiddle') {
    bow = new THREE.Group();
    const stick = new THREE.Mesh(pool.bowGeometries[0], materials[1]);
    const hair = new THREE.Mesh(pool.bowGeometries[1], materials[2]); hair.position.y = -.018;
    bow.add(stick, hair); bow.position.set(.15, -.025, .11); bow.rotation.z = .12;
    group.add(bow);
  }
  const instrument = { group, kind, bow, grip: pool.grip, height: pool.height, width: pool.width,
    posture: kind === 'bass' ? 'standing' : 'seated' };
  group.userData.campInstrument = instrument;
  return instrument;
}

export function updateCampInstrument(instrument, time, playing = true) {
  if (!instrument?.bow) return;
  const phase = Number.isFinite(time) ? time * 5.2 : 0;
  instrument.bow.position.x = .15 + (playing ? Math.sin(phase) * .12 : 0);
  instrument.bow.rotation.z = .12 + (playing ? Math.sin(phase) * .045 : 0);
}
