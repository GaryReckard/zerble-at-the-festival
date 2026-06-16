// Low festival shrub / bush — a chunky low-poly cluster of icosahedron foliage
// blobs in the same green family as the tree crowns, sitting low to the ground.
// Used as the "soft buffer" dressing along a seam where a loud cluster (a stage)
// abuts a quieter one (drum circle, camp), so they read as separated rather than
// bleeding together — and as general low ground cover among the woods.
//
// Returns a THREE.Group anchored at (0,0,0). Each shrub is ONE mesh referencing a
// pre-merged, shared cluster geometry + a shared green material, so a hedge of
// them is one draw per shrub and fully pooled. No castShadow — small detail
// reads as part of the larger foliage shadow, not a distinct shape (perf audit).

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Slightly more olive/saturated than the tree greens so a shrub reads as
// undergrowth, not a tiny tree.
const SHRUB_GREENS = [0x4f7a3d, 0x5d8a44, 0x436b35, 0x6a9a4e, 0x3c6230];

// Color-keyed pooled materials (one per green). Tagged shared so the chunk/lake
// disposal walk skips them.
const _matCache = new Map();
function shrubMat(hex) {
  let m = _matCache.get(hex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: 1.0, flatShading: true });
    m.userData.shared = true;
    _matCache.set(hex, m);
  }
  return m;
}

// Pre-merge a few blob clusters into single shared geometries (built once at
// module load). detail-0 icosahedra → chunky low-poly blobs, distinct from the
// rounder detail-1 tree crowns. Blobs sit at y≈r so the cluster rests on y=0.
function makeShrubGeo(blobs) {
  const geos = blobs.map((b) => {
    const g = new THREE.IcosahedronGeometry(b.r, 0);
    g.translate(b.x, b.y, b.z);
    return g;
  });
  const merged = BufferGeometryUtils.mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  merged.userData.shared = true;
  return merged;
}

const _SHRUB_GEOS = [
  makeShrubGeo([{ r: 0.45, x: 0, y: 0.40, z: 0 }, { r: 0.34, x: 0.34, y: 0.30, z: 0.12 }, { r: 0.30, x: -0.30, y: 0.28, z: -0.10 }]),
  makeShrubGeo([{ r: 0.40, x: 0, y: 0.36, z: 0 }, { r: 0.30, x: 0.28, y: 0.28, z: -0.18 }, { r: 0.26, x: -0.26, y: 0.26, z: 0.16 }, { r: 0.22, x: 0.05, y: 0.54, z: 0.05 }]),
  makeShrubGeo([{ r: 0.52, x: 0, y: 0.44, z: 0 }, { r: 0.30, x: -0.34, y: 0.28, z: 0.10 }]),
];

export function buildShrub(rng = Math.random) {
  const g = new THREE.Group();
  g.name = 'shrub';
  const geo = _SHRUB_GEOS[Math.floor(rng() * _SHRUB_GEOS.length)];
  const mesh = new THREE.Mesh(geo, shrubMat(SHRUB_GREENS[Math.floor(rng() * SHRUB_GREENS.length)]));
  mesh.scale.setScalar(0.8 + rng() * 0.7);
  mesh.rotation.y = rng() * Math.PI * 2;
  g.add(mesh);
  return g;
}
