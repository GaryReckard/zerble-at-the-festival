// Authored proof fixture, version 1. No RNG or world-layout dependencies.
// Contact and rendering use the same one-metre world lattice and diagonal.
export const TERRAIN_VERSION = 1;
export const TERRAIN_BOUNDS = Object.freeze({ minX: -60, maxX: 60, minZ: -420, maxZ: 35 });
export const TERRAIN_STOPS = Object.freeze([
  { name: 'Start · level run-up', z: 12 },
  { name: 'Ascent · feel the pull', z: -65 },
  { name: 'Crest · look over the ridge', z: -133 },
  { name: 'Descent · coast downhill', z: -172 },
  { name: 'Sideways slope · lean into it', z: -260 },
  { name: 'Plateau · park at the lookout', z: -365 },
]);
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
export function terrainVertexHeight(x, z) {
  const d = -z;
  const ridge = 13 * smooth((d - 30) / 100) - 13 * smooth((d - 145) / 85);
  const plateau = 10 * smooth((d - 295) / 55);
  const bank = smooth((d - 230) / 20) * (1 - smooth((d - 280) / 20));
  return ridge + plateau + x * 0.14 * bank;
}
export function sampleTerrain(x, z, out = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) throw new RangeError('Surface coordinates must be finite');
  const ix = Math.floor(x), iz = Math.floor(z), u = x - ix, v = z - iz;
  const a = terrainVertexHeight(ix, iz), b = terrainVertexHeight(ix + 1, iz);
  const c = terrainVertexHeight(ix, iz + 1), d = terrainVertexHeight(ix + 1, iz + 1);
  // Diagonal runs from (0,0) to (1,1), also used by the mesh builder.
  const dx = u >= v ? b - a : d - c;
  const dz = u >= v ? d - b : c - a;
  out.height = a + u * dx + v * dz;
  const length = Math.hypot(dx, 1, dz);
  out.nx = -dx / length; out.ny = 1 / length; out.nz = -dz / length;
  out.dx = dx; out.dz = dz; out.grade = Math.hypot(dx, dz);
  out.traversable = x >= -57 && x <= 57 && z >= -417 && z <= 32 && out.grade <= 0.55;
  out.surfaceClass = 'grass';
  return out;
}
