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
// `src` is either a built Group (reads `.userData`) or a raw descriptor (reads
// `.perches`/`.crown` directly) — the instanced forest path (CG3) has no
// per-tree Group, so it passes the descriptor.
export function worldPerches(src, x, z) {
  const local = src.userData ? src.userData.perches : src.perches;
  if (!local) return [];
  return local.map((p) => ({ x: x + p.x, y: p.y, z: z + p.z }));
}

export function worldCrown(src, x, z) {
  const c = src.userData ? src.userData.crown : src.crown;
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

// ---- Descriptors: the single rng-order source of truth ----
//
// `describe*` consume rng() in the EXACT same order the old builders did and
// return a plain descriptor (no THREE objects, no rng left to draw). The Group
// builders (`build*`, below) and the instanced forest path (chunks.js/forests.js,
// CG3) both consume the descriptor — so there is ONE place that owns rng order,
// and reordering a field here is the only way to break determinism. The
// `bin/test-forest-determinism` golden hashes the rng stream these produce.
//
// A descriptor:
//   { type:'pine'|'oak'|'birch', trunkMat:'forest'|'birch', greenIdx, colorHex,
//     trunk:  { rTop, rBot, h, seg },
//     foliage:[ { shape:'cone'|'icosa', x,y,z, radius, height?, cast } ],
//     crown:  { x,y,z,r },  perches:[ {x,y,z} ] }
// `foliage`/`trunk` are render-ready for BOTH consumers: the Group builder makes
// the exact geometry; CG3 maps shape→unit geo and (radius,height)→instance scale,
// bucketing by shape+cast (crown/cone × caster/noshadow) + trunk.

export function describeTallPine(rng) {
  const trunkH = 12 + rng() * 6;          // 12-18m bare trunk
  const trunkR = 0.8 + rng() * 0.3;
  const greenIdx = Math.floor(rng() * _foliageMats.length);
  const tiers = 3 + Math.floor(rng() * 2);
  let baseY = trunkH - 1.0;
  let baseR = 3.0 + rng() * 1.0;
  const lowestBaseY = baseY;
  const lowestBaseR = baseR;
  const foliage = [];
  // 3-4 stacked cones, decreasing radius up. Only the lowest casts shadow — the
  // upper tiers barely change the ground silhouette and burn shadow-map budget.
  for (let i = 0; i < tiers; i++) {
    const h = 3.2 - i * 0.3;
    foliage.push({ shape: 'cone', x: 0, y: baseY + h / 2, z: 0, radius: baseR, height: h, cast: (i === 0) });
    baseY += h * 0.7;
    baseR *= 0.78;
  }
  return {
    type: 'pine', trunkMat: 'forest', greenIdx, colorHex: FOREST_GREENS[greenIdx],
    trunk: { rTop: trunkR * 0.55, rBot: trunkR, h: trunkH, seg: 7 },
    foliage,
    crown: { x: 0, y: trunkH + 1.5, z: 0, r: lowestBaseR },
    perches: ringAt(lowestBaseY + 0.5, lowestBaseR * 1.04, 4),
  };
}

export function describeOak(rng) {
  const trunkH = 7 + rng() * 3;           // 7-10m bare trunk
  const trunkR = 1.1 + rng() * 0.4;
  const greenIdx = Math.floor(rng() * _foliageMats.length);
  const mainR = 4.4 + rng() * 1.6;
  const mainY = trunkH + mainR * 0.6;
  const foliage = [{ shape: 'icosa', x: 0, y: mainY, z: 0, radius: mainR, cast: true }];
  // Bumps don't cast — the main crown's shadow already covers them.
  const bumpCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < bumpCount; i++) {
    const br = 1.8 + rng() * 1.4;
    const ang = rng() * Math.PI * 2;
    const dist = mainR * 0.6;
    const jitterY = (rng() - 0.3) * 1.6;
    foliage.push({ shape: 'icosa', x: Math.cos(ang) * dist, y: mainY + jitterY, z: Math.sin(ang) * dist, radius: br, cast: false });
  }
  return {
    type: 'oak', trunkMat: 'forest', greenIdx, colorHex: FOREST_GREENS[greenIdx],
    trunk: { rTop: trunkR * 0.7, rBot: trunkR, h: trunkH, seg: 8 },
    foliage,
    crown: { x: 0, y: mainY, z: 0, r: mainR },
    perches: crownRing(mainY, mainR, 6, 0.5, 1.05),
  };
}

export function describeBirch(rng) {
  const trunkH = 10 + rng() * 4;          // 10-14m
  const trunkR = 0.44 + rng() * 0.16;
  const greenIdx = Math.floor(rng() * _foliageMats.length);
  const crownCount = 2 + Math.floor(rng() * 2);
  let lowestCrownY = trunkH;
  let lowestCrownR = 1.8;
  const foliage = [];
  // Only the lowest puff casts shadow — birch crowns are small to begin with.
  for (let i = 0; i < crownCount; i++) {
    const cr = 1.8 + rng() * 0.8;
    const cy = trunkH + cr * 0.5 + i * cr * 0.7;
    const px = (rng() - 0.5) * 1.2;
    const pz = (rng() - 0.5) * 1.2;
    if (i === 0) { lowestCrownY = cy; lowestCrownR = cr; }
    foliage.push({ shape: 'icosa', x: px, y: cy, z: pz, radius: cr, cast: (i === 0) });
  }
  return {
    type: 'birch', trunkMat: 'birch', greenIdx, colorHex: FOREST_GREENS[greenIdx],
    trunk: { rTop: trunkR * 0.7, rBot: trunkR, h: trunkH, seg: 7 },
    foliage,
    crown: { x: 0, y: lowestCrownY, z: 0, r: lowestCrownR },
    perches: crownRing(lowestCrownY, lowestCrownR, 3, 0.45, 1.05),
  };
}

export function describeForestTree(rng = Math.random) {
  const r = rng();
  if (r < 0.45) return describeTallPine(rng);
  if (r < 0.80) return describeOak(rng);
  return describeBirch(rng);
}

// Build a Group from a descriptor — the exact (non-instanced) consumer. Stashes
// the descriptor on userData so CG3's instanced path can read it back, and keeps
// crown/perches on userData for worldPerches/worldCrown + the sandbox.
function buildForestFromDescriptor(d) {
  const group = new THREE.Group();
  const trunkMat = d.trunkMat === 'birch' ? _birchTrunkMat : _forestTrunkMat;
  const t = d.trunk;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(t.rTop, t.rBot, t.h, t.seg), trunkMat);
  trunk.position.y = t.h / 2;
  trunk.castShadow = true;
  group.add(trunk);
  const mat = _foliageMats[d.greenIdx];
  for (let i = 0; i < d.foliage.length; i++) {
    const f = d.foliage[i];
    const geo = f.shape === 'cone'
      ? new THREE.ConeGeometry(f.radius, f.height, 8)
      : new THREE.IcosahedronGeometry(f.radius, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(f.x, f.y, f.z);
    mesh.castShadow = f.cast;
    group.add(mesh);
  }
  group.userData.crown = d.crown;
  group.userData.perches = d.perches;
  group.userData.descriptor = d;
  return group;
}

export function buildForestTree(rng = Math.random) {
  return buildForestFromDescriptor(describeForestTree(rng));
}

// Exported for sandbox inspection — buildForestTree() picks one at random,
// but the sandbox lets the user pick a specific variant. Thin wrappers over the
// descriptor builder so rng order lives in exactly one place (describe*).
export function buildTallPine(rng) { return buildForestFromDescriptor(describeTallPine(rng)); }
export function buildOak(rng) { return buildForestFromDescriptor(describeOak(rng)); }
export function buildBirch(rng) { return buildForestFromDescriptor(describeBirch(rng)); }

// ---------- Instanced forest (CG3) ----------
//
// The production forest paths (chunks.js scatterWorldgenTrees, forests.js
// scatterForestTrees) accumulate descriptors per chunk and call
// `buildForestInstanced` to collapse a chunk's whole woods from ~344 per-mesh
// draws into ~5 InstancedMeshes. Geometry is a unit primitive scaled per
// instance; foliage/trunk shade rides `instanceColor` (depth/shadow pass ignores
// color, so instanceColor is orthogonal to the cast/no-cast bucket split).
//
// Unit geos are module-shared + tagged, so the chunk-unload disposal walk skips
// them (tree.js:32-54 pattern). The per-chunk InstancedMeshes are NOT tagged —
// they dispose with the chunk (chunks.js disposeChunkByKey frees them via
// `obj.isInstancedMesh && obj.dispose()`). Buckets follow the EXACT per-mesh cast
// lines the non-instanced trees used, so the 115→56 shadow-caster audit holds.
const _unitConeGeo = new THREE.ConeGeometry(1, 1, 8);
_unitConeGeo.userData.shared = true;
const _unitIcosaGeo = new THREE.IcosahedronGeometry(1, 1);
_unitIcosaGeo.userData.shared = true;
// Two trunk tapers keep radii EXACT (pine rTop = 0.55·rBot; oak/birch = 0.7·rBot);
// only the trunk segment count unifies 7→8 (imperceptible). Height + base radius
// come from the per-instance scale.
const _unitTrunkPineGeo = new THREE.CylinderGeometry(0.55, 1, 1, 8);
_unitTrunkPineGeo.userData.shared = true;
const _unitTrunkBroadGeo = new THREE.CylinderGeometry(0.7, 1, 1, 8);
_unitTrunkBroadGeo.userData.shared = true;

// White base so `instanceColor` (sRGB hex → linear, same path as a material's
// `color`) is the final shade. roughness/flatShading match the pooled tree mats.
function _makeInstMat() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, flatShading: true });
  m.userData.shared = true;
  return m;
}
const _instFoliageMat = _makeInstMat();
const _instTrunkMat = _makeInstMat();

const _IM = new THREE.Matrix4();
const _IR = new THREE.Matrix4();
const _IU = new THREE.Matrix4();
const _IT = new THREE.Matrix4();
const _IS = new THREE.Matrix4();
const _IC = new THREE.Color();

const _FOREST_BUCKETS = ['trunk_pine', 'trunk_broad', 'cone_caster', 'cone_noshadow', 'crown_caster', 'crown_noshadow'];
const _bucketGeo = {
  trunk_pine: _unitTrunkPineGeo, trunk_broad: _unitTrunkBroadGeo,
  cone_caster: _unitConeGeo, cone_noshadow: _unitConeGeo,
  crown_caster: _unitIcosaGeo, crown_noshadow: _unitIcosaGeo,
};
const _bucketCast = {
  trunk_pine: true, trunk_broad: true,
  cone_caster: true, cone_noshadow: false, crown_caster: true, crown_noshadow: false,
};
const _trunkBucket = (type) => (type === 'pine' ? 'trunk_pine' : 'trunk_broad');
const _foliageBucket = (f) => (f.shape === 'cone' ? 'cone_' : 'crown_') + (f.cast ? 'caster' : 'noshadow');

// `instances`: [{ d:descriptor, x, z, rotY, scale? }]. Returns InstancedMesh[]
// for the caller to add to its group (chunk OR lake — both dispose the group and
// free instance buffers). `scale` (default 1) is a uniform whole-tree scale: the
// chunk forest leaves it 1 (matrix byte-identical to the per-mesh path); the
// lakeside ring passes its per-tree `tree.scale.set(s)` value. Empty in → empty
// out (most chunks/lakes have no forest trees → zero overhead).
export function buildForestInstanced(instances) {
  if (instances.length === 0) return [];

  const counts = {};
  for (const b of _FOREST_BUCKETS) counts[b] = 0;
  for (let k = 0; k < instances.length; k++) {
    const d = instances[k].d;
    counts[_trunkBucket(d.type)]++;
    for (let i = 0; i < d.foliage.length; i++) counts[_foliageBucket(d.foliage[i])]++;
  }

  const mesh = {};
  const idx = {};
  for (const b of _FOREST_BUCKETS) {
    if (counts[b] === 0) continue;
    const isTrunk = b[0] === 't';
    const m = new THREE.InstancedMesh(_bucketGeo[b], isTrunk ? _instTrunkMat : _instFoliageMat, counts[b]);
    m.castShadow = _bucketCast[b];
    mesh[b] = m;
    idx[b] = 0;
  }

  // M = T(x,0,z) · Ry(rotY) · S(uniform) · T(local) · S(part) — the tree's group
  // transform composed with the part's local offset. Off-centre parts (oak bumps,
  // birch puffs) get the yaw applied to their offset, matching the per-mesh Group;
  // the uniform scale (lakeside trees) scales the whole tree about its base.
  const place = (b, sx, sy, sz, lx, ly, lz, x, z, rotY, scale, hex) => {
    _IM.makeTranslation(x, 0, z);
    _IR.makeRotationY(rotY); _IM.multiply(_IR);
    if (scale !== 1) { _IU.makeScale(scale, scale, scale); _IM.multiply(_IU); }
    _IT.makeTranslation(lx, ly, lz); _IM.multiply(_IT);
    _IS.makeScale(sx, sy, sz); _IM.multiply(_IS);
    const i = idx[b]++;
    mesh[b].setMatrixAt(i, _IM);
    mesh[b].setColorAt(i, _IC.setHex(hex));
  };

  for (let k = 0; k < instances.length; k++) {
    const { d, x, z, rotY } = instances[k];
    const scale = instances[k].scale ?? 1;
    const t = d.trunk;
    const trunkHex = d.trunkMat === 'birch' ? 0xe8e4d6 : 0x5a3f24;
    place(_trunkBucket(d.type), t.rBot, t.h, t.rBot, 0, t.h / 2, 0, x, z, rotY, scale, trunkHex);
    for (let i = 0; i < d.foliage.length; i++) {
      const f = d.foliage[i];
      const sz = f.shape === 'cone' ? f.height : f.radius;
      place(_foliageBucket(f), f.radius, sz, f.radius, f.x, f.y, f.z, x, z, rotY, scale, d.colorHex);
    }
  }

  const out = [];
  for (const b of _FOREST_BUCKETS) {
    const m = mesh[b];
    if (!m) continue;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();   // per-chunk bounds → off-screen chunks frustum-cull as a unit
    out.push(m);
  }
  return out;
}
