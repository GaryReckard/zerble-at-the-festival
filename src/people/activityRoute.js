// Bounded local routing for delivered facility visitors. Paths are planned once
// per transfer; every executed segment checks live support and collision again.
const CLEARANCE = .38;
export function activityPoint(people, registry, handle, x, z, ignore = null) {
  const ground = people.sampleActivityGround(handle, x, z, {});
  if (!ground || !Number.isFinite(ground.height)) return null;
  let blocked = false;
  registry.collidersNear?.(x, z, CLEARANCE, entry => {
    if (entry === ignore) return;
    const c = entry.collider;
    if (c.minY !== undefined && c.maxY !== undefined &&
        (ground.height > entry.position.y + c.maxY || ground.height + 2.2 < entry.position.y + c.minY)) return;
    if (Math.hypot(entry.position.x - x, entry.position.z - z) < c.radius + CLEARANCE) blocked = true;
  });
  return blocked ? null : { x, y: ground.height, z };
}
export function activityLine(people, registry, handle, from, to, ignore = null) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .25));
  for (let i = 1; i <= steps; i++) if (!activityPoint(people, registry, handle,
    from.x + (to.x - from.x) * i / steps, from.z + (to.z - from.z) * i / steps, ignore)) return false;
  return true;
}
export function planActivityRoute(people, registry, handle, from, to) {
  if (Math.hypot(to.x - from.x, to.z - from.z) > 45 || !activityPoint(people, registry, handle, to.x, to.z)) return null;
  if (activityLine(people, registry, handle, from, to)) return [to];
  const start = { x: from.x, z: from.z, cost: 0, score: 0, parent: null, key: '0,0', ix: 0, iz: 0 };
  const open = [start], best = new Map([[start.key, start]]);
  for (let expanded = 0; open.length && expanded < 700; expanded++) {
    open.sort((a, b) => a.score - b.score);
    const node = open.shift();
    if (best.get(node.key) !== node) continue;
    if (Math.hypot(to.x - node.x, to.z - node.z) < 2 && activityLine(people, registry, handle, node, to)) {
      const route = [to];
      for (let n = node; n.parent; n = n.parent) route.unshift({ x: n.x, z: n.z });
      const smooth = []; let previous = from;
      for (let i = 0; i < route.length;) {
        let next = route.length - 1;
        while (next > i && !activityLine(people, registry, handle, previous, route[next])) next--;
        smooth.push(route[next]); previous = route[next]; i = next + 1;
      }
      return smooth;
    }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const ix = node.ix + dx, iz = node.iz + dz;
      if (Math.abs(ix) > 40 || Math.abs(iz) > 40) continue;
      const key = `${ix},${iz}`, cost = node.cost + Math.hypot(dx, dz), old = best.get(key);
      if (cost > 60 || (old && old.cost <= cost)) continue;
      const point = { x: from.x + ix, z: from.z + iz };
      if (!activityLine(people, registry, handle, node, point)) continue;
      const next = { ...point, ix, iz, key, cost, score: cost + Math.hypot(to.x - point.x, to.z - point.z), parent: node };
      best.set(key, next); open.push(next);
    }
  }
  return null;
}
