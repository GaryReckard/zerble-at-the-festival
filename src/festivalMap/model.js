// Pure map contracts. Discovery coordinates are independent of streaming chunks.
export const CELL = 16, BLOCK = 32, BLOCK_METERS = CELL * BLOCK;
export const VERSION = 'festival-map-1-layout-20261029';
export const REVEAL = 80, NEARBY = 120, MAX_BLOCKS = 96;
export const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
export const blockKey = (x, z) => `${Math.floor(x / BLOCK_METERS)},${Math.floor(z / BLOCK_METERS)}`;
export const emptyBlock = () => ({ bits: new Uint8Array(BLOCK * BLOCK / 8), landmarks: {} });
export function cellAddress(x, z) {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  const bx = Math.floor(cx / BLOCK), bz = Math.floor(cz / BLOCK);
  return { key: `${bx},${bz}`, index: (cz - bz * BLOCK) * BLOCK + cx - bx * BLOCK };
}
export function mergeBlock(a = emptyBlock(), b = emptyBlock()) {
  const bits = new Uint8Array(128);
  for (let i = 0; i < 128; i++) bits[i] = (a.bits?.[i] || 0) | (b.bits?.[i] || 0);
  return { bits, landmarks: { ...a.landmarks, ...b.landmarks } };
}
export const landmarkId = (namespace, kind, x, z) => `${namespace}:${kind}:${x}:${z}`;
export function revealPoints(from, to, visit, radius = REVEAL) {
  if (!finitePoint(to)) return;
  // A debug relocation is not a drive across the connecting landscape.
  const distance = finitePoint(from) ? Math.hypot(to.x - from.x, to.z - from.z) : Infinity;
  const steps = distance <= 128 ? Math.max(1, Math.ceil(distance / (CELL / 2))) : 1;
  for (let i = 1; i <= steps; i++) {
    const p = distance <= 128 ? { x: from.x + (to.x - from.x) * i / steps, z: from.z + (to.z - from.z) * i / steps } : to;
    for (let z = Math.floor((p.z - radius) / CELL); z <= Math.floor((p.z + radius) / CELL); z++) {
      for (let x = Math.floor((p.x - radius) / CELL); x <= Math.floor((p.x + radius) / CELL); x++) {
        if (Math.hypot((x + .5) * CELL - p.x, (z + .5) * CELL - p.z) <= radius) visit(x * CELL, z * CELL);
      }
    }
  }
}
export function projectPin(player, target, width, height, scale, padding = 20, shape = 'rectangle') {
  const dx = (target.x - player.x) * scale, dz = (target.z - player.z) * scale;
  const hx = Math.max(1, width / 2 - padding), hz = Math.max(1, height / 2 - padding);
  // Blend the boundary while the viewport changes shape, preserving bearing.
  const roundness = typeof shape === 'number' ? Math.max(0, Math.min(1, shape)) : shape === 'circle' ? 1 : 0;
  const rectangle = Math.max(Math.abs(dx) / hx, Math.abs(dz) / hz);
  const circle = Math.hypot(dx, dz) / Math.min(hx, hz);
  const factor = Math.max(1, rectangle + (circle - rectangle) * roundness);
  const distance = Math.hypot(target.x - player.x, target.z - player.z);
  return { x: width / 2 + dx / factor, y: height / 2 + dz / factor,
    edge: factor > 1, angle: Math.atan2(dz, dx), distance,
    size: 7 + 6 / (1 + distance / 240) };
}
export function tileView(player, width, height, scale) {
  // At most 6 by 6 tiles even at the widest supported aspect ratio.
  const span = Math.max(width, height) / scale;
  const size = Math.max(256, 2 ** Math.ceil(Math.log2(span / 4)));
  const bounds = { minX: player.x - width / scale / 2, maxX: player.x + width / scale / 2,
    minZ: player.z - height / scale / 2, maxZ: player.z + height / scale / 2 };
  const tiles = [];
  for (let z = Math.floor(bounds.minZ / size); z <= Math.floor(bounds.maxZ / size); z++) {
    for (let x = Math.floor(bounds.minX / size); x <= Math.floor(bounds.maxX / size); x++) tiles.push({ key: `${size}:${x},${z}`, x: x * size, z: z * size, size });
  }
  return tiles.sort((a, b) => Math.hypot(a.x + size / 2 - player.x, a.z + size / 2 - player.z) - Math.hypot(b.x + size / 2 - player.x, b.z + size / 2 - player.z));
}
