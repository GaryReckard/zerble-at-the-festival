// Festival INFO KIOSK — the "info / welfare" half of a hub's amenity bundle: a
// canvas-gabled shelter over a flyer-pinned noticeboard and a service counter,
// with a tall pennant so it reads as a way-finding point from across the field.
// Real festivals put a recurring welfare bundle (toilets + water + shade/seating
// + info) at every busy node; this is the piece we had no model for. The planner
// sites it via the `welfare_post` cluster (worldgen/festival.js) — it is never a
// lone scattered prop.
//
// ONE DRAW PER KIOSK: every board, post, rail, roof slab, flyer and pennant is
// pre-merged into a module-level BufferGeometry with its color BAKED into a
// per-vertex `color` attribute (the picnicTable.js / tent.js idiom), so a kiosk
// is a single mesh under one shared vertexColors material. Three color variants
// (three merged uploads) cover the whole world. The merged geos + materials are
// `userData.shared` so chunk disposal skips them (footgun #6).
//
// The lamp under the ridge is the one separate mesh: a small always-emissive
// bulb, so a welfare point is legible at night without a per-frame nightness
// updater (the kiosk is otherwise fully static — no animatable to tick).

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Body dimensions. INFO_KIOSK_FOOTPRINT is the NPC-avoidance / planner radius —
// the roof overhang is the widest part, and worldgen/tuning.js MODEL_DIMS copies
// it (bin/check-model-dims guards the copy).
export const INFO_KIOSK_FOOTPRINT = 1.6;
export const INFO_KIOSK_COLLIDER_R = 1.15;

const POST_X = 0.95, POST_Z = 0.72, POST_T = 0.11, EAVE_Y = 2.15;
const RIDGE_Y = 2.62, ROOF_HALF_X = 1.32, ROOF_HALF_Z = 1.02;
const BOARD_W = 1.74, BOARD_H = 0.84, BOARD_Y = 1.16, BOARD_Z = 0.46, BOARD_TILT = -0.19;
const HEADER_H = 0.24;
const POLE_X = 1.24, POLE_Z = -0.84, POLE_TOP = 4.05;

const TIMBER = 0x7c5a36;      // posts, frame, counter legs
const TIMBER_DARK = 0x5e4227;
const CORK = 0x8a6a45;        // the pinned board face
const COUNTER = 0xa8794a;
const PLAQUE = 0xf2ece0;      // the "i" plate
const FLYER = [0xf2f0e6, 0xffd45e, 0xef7c5a, 0xa8d8e8, 0xf6f2ff];

// Canvas / accent per variant — a striped-awning festival palette.
const VARIANTS = [
  { canvasA: 0xd8523f, canvasB: 0xf0e6d2, accent: 0x2f6f8f },   // red-and-cream awning
  { canvasA: 0x2f7d6a, canvasB: 0xf0e6d2, accent: 0xc4622f },   // green-and-cream
  { canvasA: 0x3d5c9e, canvasB: 0xf7d97a, accent: 0xc23a52 },   // blue-and-gold
];

function bakedBox(w, h, d, x, y, z, hex, rx = 0) {
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

// Flyers pinned to the board, in the board's own tilted frame: [x, y, w, h].
// Fixed offsets (no rng) so all three variants pin the same believable jumble.
const FLYERS = [
  [-0.60, 0.17, 0.20, 0.24],
  [-0.22, 0.20, 0.24, 0.20],
  [0.16, 0.15, 0.21, 0.26],
  [0.56, 0.19, 0.23, 0.22],
  [-0.38, -0.18, 0.26, 0.19],
];

function buildVariantGeo(v) {
  const parts = [];

  // Four corner posts carrying the canopy.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push(bakedBox(POST_T, EAVE_Y, POST_T, sx * POST_X, EAVE_Y / 2, sz * POST_Z, sz > 0 ? TIMBER : TIMBER_DARK));
  }

  // Gable canopy: two pitched slabs meeting at a ridge beam, overhanging the posts.
  const rise = RIDGE_Y - EAVE_Y, run = ROOF_HALF_Z;
  const pitch = Math.atan2(rise, run);
  const slabLen = Math.hypot(rise, run);
  for (const sz of [-1, 1]) {
    // Alternating canvas stripes along the slab's run, so the roof reads as awning
    // cloth rather than a painted board.
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.5) / 4;                       // 0..1 from ridge to eave
      const segLen = slabLen / 4;
      const cz = sz * run * t, cy = RIDGE_Y - rise * t;
      parts.push(bakedBox(ROOF_HALF_X * 2, 0.07, segLen, 0, cy, cz,
        i % 2 ? v.canvasB : v.canvasA, sz > 0 ? pitch : -pitch));
    }
  }
  parts.push(bakedBox(ROOF_HALF_X * 2 + 0.08, 0.11, 0.13, 0, RIDGE_Y + 0.02, 0, TIMBER_DARK));
  // Scalloped valance along the front eave — the giveaway detail of a fair booth.
  for (let i = 0; i < 7; i++) {
    parts.push(bakedBox(0.3, 0.16, 0.05, (i - 3) * 0.36, EAVE_Y - 0.06, ROOF_HALF_Z - 0.02, i % 2 ? v.canvasA : v.canvasB));
  }

  // Noticeboard: a tilted cork face in a timber frame, with a solid accent header
  // carrying the white "i" glyph (boxes, not text — no texture, no font). Every
  // face-mounted piece is placed through `onBoard`, which maps a coordinate in the
  // board's own tilted frame out to world — so flyers and glyph sit ON the panel
  // instead of hovering off it.
  const tilt = BOARD_TILT, ct = Math.cos(tilt), st = Math.sin(tilt);
  const onBoard = (lx, ly, lz) => [lx, BOARD_Y + ly * ct - lz * st, BOARD_Z + ly * st + lz * ct];
  parts.push(bakedBox(BOARD_W + 0.12, BOARD_H + 0.12, 0.07, ...onBoard(0, 0, 0), TIMBER, tilt));
  parts.push(bakedBox(BOARD_W, BOARD_H, 0.03, ...onBoard(0, 0, 0.05), CORK, tilt));
  FLYERS.forEach(([fx, fy, fw, fh], i) => {
    parts.push(bakedBox(fw, fh, 0.012, ...onBoard(fx, fy, 0.075), FLYER[i % FLYER.length], tilt));
  });
  const headerY = BOARD_H / 2 + HEADER_H / 2 + 0.04;
  parts.push(bakedBox(BOARD_W + 0.12, HEADER_H, 0.08, ...onBoard(0, headerY, 0.01), v.accent, tilt));
  // The "i": a dot over a stem, punched proud of the header in off-white.
  parts.push(bakedBox(0.07, 0.07, 0.03, ...onBoard(0, headerY + 0.07, 0.055), PLAQUE, tilt));
  parts.push(bakedBox(0.07, 0.11, 0.03, ...onBoard(0, headerY - 0.045, 0.055), PLAQUE, tilt));

  // Gable sign standing proud of the ridge: the one piece nothing occludes, so the
  // "i" reads from the road instead of hiding under the awning.
  const signY = RIDGE_Y + 0.34;
  parts.push(bakedBox(0.09, 0.42, 0.09, -0.5, RIDGE_Y + 0.12, 0.02, TIMBER_DARK));
  parts.push(bakedBox(0.09, 0.42, 0.09, 0.5, RIDGE_Y + 0.12, 0.02, TIMBER_DARK));
  parts.push(bakedBox(1.42, 0.5, 0.09, 0, signY, 0.02, v.accent));
  parts.push(bakedBox(0.13, 0.13, 0.04, 0, signY + 0.14, 0.08, PLAQUE));
  parts.push(bakedBox(0.13, 0.2, 0.04, 0, signY - 0.08, 0.08, PLAQUE));

  // Service counter across the back, under the canopy — the staffed half.
  parts.push(bakedBox(1.94, 0.09, 0.46, 0, 0.97, -0.34, COUNTER));
  parts.push(bakedBox(1.86, 0.86, 0.06, 0, 0.53, -0.53, TIMBER_DARK));
  for (const sx of [-1, 1]) parts.push(bakedBox(0.09, 0.95, 0.09, sx * 0.82, 0.47, -0.16, TIMBER));

  // Pennant mast — the far-visible way-finding half. The flag tapers via two
  // stacked slabs (cheaper than a real triangle, reads the same at driving speed).
  parts.push(bakedBox(0.08, POLE_TOP, 0.08, POLE_X, POLE_TOP / 2, POLE_Z, TIMBER_DARK));
  parts.push(bakedBox(0.5, 0.46, 0.03, POLE_X + 0.29, POLE_TOP - 0.34, POLE_Z, v.canvasA));
  parts.push(bakedBox(0.42, 0.26, 0.03, POLE_X + 0.75, POLE_TOP - 0.34, POLE_Z, v.canvasA));

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  merged.userData.shared = true;
  return merged;
}

const KIOSK_GEOS = VARIANTS.map(buildVariantGeo);
const KIOSK_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, flatShading: true });
KIOSK_MAT.userData.shared = true;

const LAMP_GEO = new THREE.SphereGeometry(0.1, 8, 6);
LAMP_GEO.userData.shared = true;
const LAMP_MAT = new THREE.MeshStandardMaterial({ color: 0xfff0c4, emissive: 0xffd98a, emissiveIntensity: 1.25, roughness: 0.5 });
LAMP_MAT.userData.shared = true;

// Returns { group, footprint }. Caller positions/rotates; local +Z is the FRONT
// (the board, the valance and the "i" all face the traffic the planner aimed it at).
export function buildInfoKiosk(rng = Math.random) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(KIOSK_GEOS[Math.floor(rng() * KIOSK_GEOS.length) % KIOSK_GEOS.length], KIOSK_MAT);
  body.castShadow = true;      // one caster per kiosk — the canopy reads as a distinct shadow
  body.receiveShadow = true;
  group.add(body);

  const lamp = new THREE.Mesh(LAMP_GEO, LAMP_MAT);
  lamp.position.set(0, EAVE_Y - 0.2, ROOF_HALF_Z - 0.24);
  group.add(lamp);

  group.userData.footprint = INFO_KIOSK_FOOTPRINT;
  return { group, footprint: INFO_KIOSK_FOOTPRINT };
}
