// Festival tree — trunk + either rounded leaf or pine cone. Group-anchored
// at (0,0,0); caller sets position/rotation.
//
// `buildTree` is the standard chunk tree (small, sparse, no collider).
// `buildForestTree` is the bigger, more varied forest tree — taller, with
// three subspecies (tall pine, oak, birch). Forest trees register as
// `forest_tree` in the registry with a hard collider (the forests module
// handles registration; this just builds geometry).
//
// Scale: dimensions are ~2x the original first-pass trees so the woods read
// closer to real-world proportions (chunk trees ~11-12m, forest pines up to
// ~22m). Geometry-only change — no RNG call-order change, so existing chunk
// layouts regenerate in the same spots, just taller.
//
// Canopy perch anchors: birds land on the outer-lower foliage surface — there
// is deliberately no branch geometry (would blow the forest draw budget). Each
// tree exposes `userData.crown = {x,y,z,r}` (for the night roost-fade tuck
// point) and `userData.perches = [{x,y,z}...]` (local-space points on the
// canopy where a bird visibly sits). The ring is radially symmetric so the
// tree's random yaw doesn't matter — the forests/chunks registration code
// just offsets these by the tree's world position. See `birds.js`.

import * as THREE from 'three';

const TREE_GREENS = [0x4f8a4d, 0x5fa55d, 0x6dba6a, 0x4b7c4a, 0x82c277];
const FOREST_GREENS = [0x355a32, 0x3f6d3a, 0x2d4e2a, 0x4a7a45, 0x537f4d, 0x325438, 0x2b5532];

// Module-level pooled geo/mat. Tagged `userData.shared` so the chunk unload
// disposal walk (chunks.js `_unload`) skips them — disposing a shared material
// forces a shader recompile next frame for every other chunk still using it
// (perf footgun #6). Chunk trees DO unload past UNLOAD_RADIUS, so this matters.
const _trunkGeo = new THREE.CylinderGeometry(0.7, 1.0, 7.2, 8);
_trunkGeo.userData.shared = true;
const _trunkMat = new THREE.MeshStandardMaterial({
  color: 0x6a4a2a, roughness: 0.95, flatShading: true,
});
_trunkMat.userData.shared = true;

// Shared materials for forest trees so we don't allocate per-tree.
// Caller still constructs new geometries (sizes vary) but materials pool.
const _forestTrunkMat = new THREE.MeshStandardMaterial({
  color: 0x5a3f24, roughness: 1.0, flatShading: true,
});
_forestTrunkMat.userData.shared = true;
const _birchTrunkMat = new THREE.MeshStandardMaterial({
  color: 0xe8e4d6, roughness: 0.95, flatShading: true,
});
_birchTrunkMat.userData.shared = true;
// Foliage materials by green index (so all trees of one shade share a mat).
const _foliageMats = FOREST_GREENS.map((hex) => {
  const m = new THREE.MeshStandardMaterial({ color: hex, roughness: 1.0, flatShading: true });
  m.userData.shared = true;
  return m;
});

// A ring of `count` anchor points at world height `y` and horizontal radius
// `horizR`. Offsets are local-space; the registration code adds the tree's
// world position. The ring is radially symmetric, so the tree's yaw is moot.
function ringAt(y, horizR, count) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.4;
    pts.push({ x: Math.cos(a) * horizR, y, z: Math.sin(a) * horizR });
  }
  return pts;
}

// Perch anchors on the lower-outer SURFACE of a spherical crown (radius `r`,
// centered at local height `cy`). `down` (0..1) is how far below the crown's
// equator to sit — bigger = lower on the canopy, more visible from below. The
// horizontal radius is the sphere-surface radius at that height, nudged out by
// `out` so the perched bird sits proud of the foliage rather than buried in it.
function crownRing(cy, r, count, down = 0.5, out = 1.06) {
  const sinp = Math.min(0.95, down);
  const cosp = Math.sqrt(Math.max(0.05, 1 - sinp * sinp));
  return ringAt(cy - r * sinp, r * cosp * out, count);
}

// Transform a built tree's local perch/crown data (set by the builders below)
// into world-space, given the tree's planted (x, z). The perch ring is
// radially symmetric, so the tree's random yaw is ignored. Used by forests.js
// and chunks.js when they register a tree so the bird system can read perch
// targets straight off the registry entry.
export function worldPerches(tree, x, z) {
  const local = tree.userData.perches;
  if (!local) return [];
  return local.map((p) => ({ x: x + p.x, y: p.y, z: z + p.z }));
}

export function worldCrown(tree, x, z) {
  const c = tree.userData.crown;
  if (!c) return null;
  return { x: x + c.x, y: c.y, z: z + c.z, r: c.r };
}

export function buildTree(rng = Math.random) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(_trunkGeo, _trunkMat);
  trunk.position.y = 3.6;
  trunk.castShadow = true;
  tree.add(trunk);

  if (rng() < 0.65) {
    const r = 3.2 + rng() * 2.0;
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshStandardMaterial({
        color: TREE_GREENS[Math.floor(rng() * TREE_GREENS.length)],
        roughness: 0.95,
        flatShading: true,
      })
    );
    const leafY = 7.6 + rng() * 0.8;
    leaf.position.y = leafY;
    leaf.castShadow = true;
    tree.add(leaf);
    tree.userData.crown = { x: 0, y: leafY, z: 0, r };
    tree.userData.perches = crownRing(leafY, r, 4, 0.5, 1.05);
  } else {
    const h = 8 + rng() * 5;
    const coneR = 2.8;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(coneR, h, 8),
      new THREE.MeshStandardMaterial({ color: 0x2d5d3e, roughness: 0.95, flatShading: true })
    );
    const coneCenterY = 4 + h / 2;
    cone.position.y = coneCenterY;
    cone.castShadow = true;
    tree.add(cone);
    // Conifer: perch on the wide lower skirt, just outside the cone base.
    const baseY = coneCenterY - h / 2;
    tree.userData.crown = { x: 0, y: coneCenterY, z: 0, r: coneR };
    tree.userData.perches = ringAt(baseY + h * 0.12, coneR * 1.04, 4);
  }
  return tree;
}

// ---------- Forest trees ----------
//
// Three subspecies, picked randomly:
//   - Tall pine: stacked cones, total height ~16-22m
//   - Old oak: broad rounded foliage on a thick trunk, ~14-18m
//   - Birch: narrow white trunk with smaller crown, ~12-16m
//
// Sizes are ~2x the first-pass forest tree so a forest reads as real woods.

export function buildForestTree(rng = Math.random) {
  const r = rng();
  if (r < 0.45) return buildTallPine(rng);
  if (r < 0.80) return buildOak(rng);
  return buildBirch(rng);
}

// Exported for sandbox inspection — buildForestTree() picks one at random,
// but the sandbox lets the user pick a specific variant.
export function buildTallPine(rng) {
  const group = new THREE.Group();

  // Trunk: tall and slim, slight taper
  const trunkH = 12 + rng() * 6;         // 12-18m bare trunk
  const trunkR = 0.8 + rng() * 0.3;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.55, trunkR, trunkH, 7),
    _forestTrunkMat,
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // 3-4 stacked cones, decreasing radius going up.
  // Only the lowest tier casts shadow — the rest stack visually but adding
  // their shadow passes barely changes the ground silhouette and burns
  // shadow-map budget.
  const greenIdx = Math.floor(rng() * _foliageMats.length);
  const mat = _foliageMats[greenIdx];
  const tiers = 3 + Math.floor(rng() * 2);
  let baseY = trunkH - 1.0;
  let baseR = 3.0 + rng() * 1.0;
  const lowestBaseY = baseY;
  const lowestBaseR = baseR;
  for (let i = 0; i < tiers; i++) {
    const h = 3.2 - i * 0.3;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(baseR, h, 8), mat);
    cone.position.y = baseY + h / 2;
    cone.castShadow = (i === 0);
    group.add(cone);
    baseY += h * 0.7;
    baseR *= 0.78;
  }
  // Perch on the wide lowest tier, just outside the skirt.
  group.userData.crown = { x: 0, y: trunkH + 1.5, z: 0, r: lowestBaseR };
  group.userData.perches = ringAt(lowestBaseY + 0.5, lowestBaseR * 1.04, 4);
  return group;
}

export function buildOak(rng) {
  const group = new THREE.Group();

  // Trunk: thick and shorter than pine
  const trunkH = 7 + rng() * 3;           // 7-10m bare trunk
  const trunkR = 1.1 + rng() * 0.4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 8),
    _forestTrunkMat,
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // Broad rounded crown: one big icosphere + 2-3 smaller bumps offset
  const greenIdx = Math.floor(rng() * _foliageMats.length);
  const mat = _foliageMats[greenIdx];
  const mainR = 4.4 + rng() * 1.6;
  const mainY = trunkH + mainR * 0.6;
  const main = new THREE.Mesh(new THREE.IcosahedronGeometry(mainR, 1), mat);
  main.position.y = mainY;
  main.castShadow = true;
  group.add(main);

  // Bumps don't cast shadow — main crown's shadow already covers them visually.
  const bumpCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < bumpCount; i++) {
    const br = 1.8 + rng() * 1.4;
    const ang = rng() * Math.PI * 2;
    const dist = mainR * 0.6;
    const bump = new THREE.Mesh(new THREE.IcosahedronGeometry(br, 1), mat);
    bump.position.set(
      Math.cos(ang) * dist,
      mainY + (rng() - 0.3) * 1.6,
      Math.sin(ang) * dist,
    );
    group.add(bump);
  }
  // Oaks have the broadest crown — best perching, so more anchors.
  group.userData.crown = { x: 0, y: mainY, z: 0, r: mainR };
  group.userData.perches = crownRing(mainY, mainR, 6, 0.5, 1.05);
  return group;
}

export function buildBirch(rng) {
  const group = new THREE.Group();

  // Trunk: thin and tall, white-grey
  const trunkH = 10 + rng() * 4;          // 10-14m
  const trunkR = 0.44 + rng() * 0.16;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 7),
    _birchTrunkMat,
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // Small narrow crown — a few tight icospheres
  const greenIdx = Math.floor(rng() * _foliageMats.length);
  const mat = _foliageMats[greenIdx];
  // Only the lowest crown puff casts shadow — the upper stack reads fine
  // without (birch crowns are small to begin with).
  const crownCount = 2 + Math.floor(rng() * 2);
  let lowestCrownY = trunkH;
  let lowestCrownR = 1.8;
  for (let i = 0; i < crownCount; i++) {
    const cr = 1.8 + rng() * 0.8;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(cr, 1), mat);
    const cy = trunkH + cr * 0.5 + i * cr * 0.7;
    crown.position.set(
      (rng() - 0.5) * 1.2,
      cy,
      (rng() - 0.5) * 1.2,
    );
    if (i === 0) { crown.castShadow = true; lowestCrownY = cy; lowestCrownR = cr; }
    group.add(crown);
  }
  // Birch crown is narrow — fewer, tighter perches.
  group.userData.crown = { x: 0, y: lowestCrownY, z: 0, r: lowestCrownR };
  group.userData.perches = crownRing(lowestCrownY, lowestCrownR, 3, 0.45, 1.05);
  return group;
}
