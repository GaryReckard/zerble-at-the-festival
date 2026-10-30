import { TERRAIN_STEP, terrainVertexHeight } from '../worldgen/terrain.js';

export const MAX_TERRAIN_PATCH_CELLS = 4096;
const DEFAULT_MAX_CELLS = 256;

/**
 * Build one bounded collision/render patch on the production terrain lattice.
 * The caller owns the returned arrays and places them at origin; this function
 * neither changes the terrain gate/seed nor retains a patch or engine handle.
 */
export function buildTerrainPatch(bounds, { maxCells = DEFAULT_MAX_CELLS } = {}) {
  const { minX, minZ, maxX, maxZ } = bounds ?? {};
  if (![minX, minZ, maxX, maxZ].every(Number.isFinite) || minX >= maxX || minZ >= maxZ) {
    throw new RangeError('Terrain patch bounds must be finite and have positive width and depth');
  }
  if (!Number.isInteger(maxCells) || maxCells < 1 || maxCells > MAX_TERRAIN_PATCH_CELLS) {
    throw new RangeError(`Terrain patch maxCells must be an integer from 1 to ${MAX_TERRAIN_PATCH_CELLS}`);
  }
  // Global cell indices, rather than an arbitrary local grid, preserve the
  // sampler's triangle creases and shared boundaries at negative coordinates.
  const x0 = Math.floor(minX / TERRAIN_STEP), x1 = Math.ceil(maxX / TERRAIN_STEP);
  const z0 = Math.floor(minZ / TERRAIN_STEP), z1 = Math.ceil(maxZ / TERRAIN_STEP);
  if (![x0, x1, z0, z1].every(value => Number.isSafeInteger(value * TERRAIN_STEP))) {
    throw new RangeError('Terrain patch bounds exceed precise world lattice coordinates');
  }
  const columns = x1 - x0, rows = z1 - z0, cellCount = columns * rows;
  if (columns < 1 || rows < 1 || columns > maxCells || rows > maxCells || cellCount > maxCells) {
    throw new RangeError(`Terrain patch exceeds the ${maxCells}-cell limit after lattice alignment`);
  }
  const origin = { x: x0 * TERRAIN_STEP, y: 0, z: z0 * TERRAIN_STEP };
  const stride = columns + 1;
  const vertices = new Float32Array(stride * (rows + 1) * 3);
  const indices = new Uint32Array(cellCount * 6);
  let minY = Infinity, maxY = -Infinity;
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const offset = (row * stride + column) * 3;
      vertices[offset] = column * TERRAIN_STEP;
      vertices[offset + 1] = terrainVertexHeight((x0 + column) * TERRAIN_STEP, (z0 + row) * TERRAIN_STEP);
      vertices[offset + 2] = row * TERRAIN_STEP;
      minY = Math.min(minY, vertices[offset + 1]);
      maxY = Math.max(maxY, vertices[offset + 1]);
    }
  }
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * stride + column, b = a + 1, c = a + stride, d = c + 1;
      // Both normals point up. The b-c diagonal is the same u+v=1 split
      // used by sampleTerrain, so no triangle bridges a terrain crease.
      indices[index++] = a; indices[index++] = c; indices[index++] = b;
      indices[index++] = b; indices[index++] = c; indices[index++] = d;
    }
  }
  return { vertices, indices, origin,
    bounds: { minX: origin.x, minY, minZ: origin.z, maxX: x1 * TERRAIN_STEP, maxY, maxZ: z1 * TERRAIN_STEP },
    cells: { x: columns, z: rows, total: cellCount }, step: TERRAIN_STEP };
}
