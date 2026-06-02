// Birds — small low-poly creatures that fly over the festival and perch in
// trees. Group-anchored at (0,0,0), local frame: +Z = forward (beak), +Y = up.
//
// This file is the single source of truth for bird geometry + per-species
// config. `buildBird()` returns a fully articulated Group (separate wing
// meshes you can flap) used by the sandbox and any low-count case. The game's
// flocking system (`birds.js`) reuses the SAME cached geometries to build
// per-species InstancedMeshes, so the sandbox silhouette matches the game.
//
// Species vary by size, colour, cruising altitude band, flock tendency, and
// song style (the song key is consumed by `sound.js`). Geometries + materials
// are module-pooled and tagged `userData.shared = true` so the chunk/lake
// disposal walks never free them (perf footgun #6).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// altitude: [min, max] metres above ground the species cruises at.
// flock: 0..1 boids cohesion tendency (crows loosely, sparrows tightly).
// speed: nominal cruise m/s. song: key into the bird-song bank in sound.js.
export const BIRD_SPECIES = {
  sparrow: { label: 'Sparrow', size: 0.50, body: 0x7a5a3a, wing: 0x5e4327, beak: 0x33260f, altitude: [5, 15],  speed: 7.0, flock: 0.95, song: 'sparrow' },
  finch:   { label: 'Finch',   size: 0.46, body: 0xd8c23a, wing: 0xb2492a, beak: 0x222018, altitude: [6, 17],  speed: 7.5, flock: 0.85, song: 'finch'   },
  jay:     { label: 'Jay',     size: 0.72, body: 0x3f6fd0, wing: 0x2a4f9c, beak: 0x161616, altitude: [8, 22],  speed: 8.0, flock: 0.40, song: 'jay'     },
  crow:    { label: 'Crow',    size: 1.00, body: 0x171b23, wing: 0x0d1016, beak: 0x0a0a0a, altitude: [14, 40], speed: 9.0, flock: 0.60, song: 'crow'    },
  dove:    { label: 'Dove',    size: 0.82, body: 0xb9b2a8, wing: 0x968e84, beak: 0x3a3a3a, altitude: [7, 19],  speed: 6.5, flock: 0.50, song: 'dove'    },
};

export const BIRD_KEYS = Object.keys(BIRD_SPECIES);

// Shared material cache, keyed by colour. DoubleSide so the right wing can be
// mirrored with scale.x = -1 (instanced or in the sandbox group) without the
// back-face being culled — birds are small + distant so the cost is nil.
const _matCache = new Map();
export function birdMaterial(hex) {
  let m = _matCache.get(hex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
    m.userData.shared = true;
    _matCache.set(hex, m);
  }
  return m;
}

// Per-species geometry, built once. Returns { s, body, head, beak, tail, wing }.
// The wing's hinge is at local x = 0 and it extends toward +X, so a rotation
// about the body's forward (Z) axis flaps it; the right wing mirrors with
// scale.x = -1.
const _geoCache = new Map();
export function birdGeometries(speciesKey) {
  let g = _geoCache.get(speciesKey);
  if (g) return g;
  const sp = BIRD_SPECIES[speciesKey] || BIRD_SPECIES.sparrow;
  const s = sp.size;

  const body = new THREE.IcosahedronGeometry(0.34 * s, 1);
  body.scale(1, 0.82, 1.5);                 // ellipsoid, longer fore-aft
  const head = new THREE.IcosahedronGeometry(0.2 * s, 1);
  const beak = new THREE.ConeGeometry(0.06 * s, 0.22 * s, 4);
  beak.rotateX(Math.PI / 2);                // point +Z (forward)
  const tail = new THREE.BoxGeometry(0.36 * s, 0.05 * s, 0.55 * s);
  const wing = new THREE.BoxGeometry(0.82 * s, 0.05 * s, 0.5 * s);
  wing.translate(0.41 * s, 0, 0);           // hinge at x=0, blade extends +X

  for (const geo of [body, head, beak, tail, wing]) geo.userData.shared = true;
  g = { s, body, head, beak, tail, wing };
  _geoCache.set(speciesKey, g);
  return g;
}

// Build an articulated bird Group. `perched` starts it in the folded-wing
// resting pose. The returned group carries `userData.anim(dt)` — call it each
// frame to flap (flying) or idle-bob (perched), and `userData.setPerched(bool)`
// to switch poses at runtime (landing / taking off).
export function buildBird(speciesKey = 'sparrow', { perched = false } = {}) {
  const sp = BIRD_SPECIES[speciesKey] || BIRD_SPECIES.sparrow;
  const g = birdGeometries(speciesKey);
  const s = g.s;

  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  const body = new THREE.Mesh(g.body, birdMaterial(sp.body));
  body.castShadow = true;
  bodyPivot.add(body);

  const head = new THREE.Mesh(g.head, birdMaterial(sp.body));
  head.position.set(0, 0.16 * s, 0.42 * s);
  bodyPivot.add(head);

  const beak = new THREE.Mesh(g.beak, birdMaterial(sp.beak));
  beak.position.set(0, 0.13 * s, 0.6 * s);
  bodyPivot.add(beak);

  const tail = new THREE.Mesh(g.tail, birdMaterial(sp.wing));
  tail.position.set(0, 0.03 * s, -0.55 * s);
  tail.rotation.x = -0.25;                   // tail tips up a touch
  bodyPivot.add(tail);

  const wingL = new THREE.Mesh(g.wing, birdMaterial(sp.wing));
  wingL.position.set(0.04 * s, 0.1 * s, 0);
  bodyPivot.add(wingL);
  const wingR = new THREE.Mesh(g.wing, birdMaterial(sp.wing));
  wingR.position.set(-0.04 * s, 0.1 * s, 0);
  wingR.scale.x = -1;                        // mirror to the left side
  bodyPivot.add(wingR);

  let t = Math.random() * 10;
  let isPerched = perched;
  const flapHz = 4.5 + (1 - s) * 3;          // small birds flap faster

  group.userData.species = speciesKey;
  group.userData.parts = { bodyPivot, wingL, wingR };
  group.userData.setPerched = (v) => { isPerched = v; };
  group.userData.anim = (dt) => {
    t += dt;
    if (isPerched) {
      // Wings folded against the body, gentle idle bob.
      wingL.rotation.z = -1.05;
      wingR.rotation.z = -1.05;
      bodyPivot.position.y = Math.sin(t * 2.2) * 0.012 * s;
    } else {
      // Symmetric flap about the forward axis. Mirrored right wing reads the
      // same rotation value and tips in the same vertical direction.
      const flap = Math.sin(t * Math.PI * 2 * flapHz) * 0.95 + 0.2;
      wingL.rotation.z = flap;
      wingR.rotation.z = flap;
      bodyPivot.position.y = Math.sin(t * Math.PI * 2 * flapHz) * 0.03 * s;
    }
  };
  // Prime the pose so a static (un-ticked) bird still looks right.
  group.userData.anim(0);
  return group;
}

// ---------- Instancing geometry (for birds.js) ----------
//
// The flocking system draws all birds with three InstancedMeshes per species
// (body, left wing, right wing) — ~15 draws total regardless of bird count.
// The body cluster (body + head + beak + tail) is merged into one geometry
// with baked vertex colours so a single shared material covers every species;
// the wing is a separate geometry the system mirrors per side via the instance
// matrix. The merged silhouette matches `buildBird` exactly.

function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

const _instGeoCache = new Map();
// Returns { body, wing, s, wingX, wingY } — merged body geo + wing geo +
// size + wing hinge offsets. Cached + shared-flagged.
export function birdInstanceGeo(speciesKey) {
  let g = _instGeoCache.get(speciesKey);
  if (g) return g;
  const sp = BIRD_SPECIES[speciesKey] || BIRD_SPECIES.sparrow;
  const s = sp.size;

  // mergeGeometries requires uniform index presence — Icosahedron is already
  // non-indexed but Box/Cone are indexed, so flatten only the indexed ones
  // (calling toNonIndexed on an already-non-indexed geo just warns). Transforms
  // apply fine pre-flatten; the colour attribute is added after so its count
  // matches the expanded vertices.
  const part = (geo, hex) => { const g = geo.index ? geo.toNonIndexed() : geo; return paint(g, hex); };
  const body = part((() => { const b = new THREE.IcosahedronGeometry(0.34 * s, 1); b.scale(1, 0.82, 1.5); return b; })(), sp.body);
  const head = part((() => { const h = new THREE.IcosahedronGeometry(0.2 * s, 1); h.translate(0, 0.16 * s, 0.42 * s); return h; })(), sp.body);
  const beak = part((() => { const k = new THREE.ConeGeometry(0.06 * s, 0.22 * s, 4); k.rotateX(Math.PI / 2); k.translate(0, 0.13 * s, 0.6 * s); return k; })(), sp.beak);
  const tail = part((() => { const ta = new THREE.BoxGeometry(0.36 * s, 0.05 * s, 0.55 * s); ta.rotateX(-0.25); ta.translate(0, 0.03 * s, -0.55 * s); return ta; })(), sp.wing);
  const bodyMerged = mergeGeometries([body, head, beak, tail], false);
  bodyMerged.userData.shared = true;

  const wing = new THREE.BoxGeometry(0.82 * s, 0.05 * s, 0.5 * s); wing.translate(0.41 * s, 0, 0); paint(wing, sp.wing);
  wing.userData.shared = true;

  g = { body: bodyMerged, wing, s, wingX: 0.04 * s, wingY: 0.1 * s };
  _instGeoCache.set(speciesKey, g);
  return g;
}

let _instMat = null;
export function birdInstanceMaterial() {
  if (!_instMat) {
    _instMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.DoubleSide });
    _instMat.userData.shared = true;
  }
  return _instMat;
}

// Convenience for the sandbox: a loose flock of one species at staggered
// positions + headings, each with its own flap phase.
export function buildBirdFlock(speciesKey = 'sparrow', count = 7) {
  const flock = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const b = buildBird(speciesKey, { perched: false });
    const ang = (i / count) * Math.PI * 2;
    const r = 1.5 + (i % 3) * 0.9;
    b.position.set(Math.cos(ang) * r, (i % 4) * 0.6, Math.sin(ang) * r);
    b.rotation.y = ang + Math.PI / 2;
    flock.add(b);
  }
  flock.userData.anim = (dt) => flock.children.forEach((b) => b.userData.anim?.(dt));
  return flock;
}
