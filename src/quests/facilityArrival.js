// Generic requests accept any currently built matching facility. Named places
// retain their stored target; this lookup never rewrites rewards or deadlines.
const FACILITIES = Object.freeze({
  hammock: { kinds: ['hammock', 'hammock_dropoff'], radius: 25 },
  porta_potty: { kinds: ['porta_potty'], radius: 16 },
});

export function isGenericFacility(quest) {
  return Object.hasOwn(FACILITIES, quest?.kind);
}

export function resolveNearbyFacility(quest, player, registry) {
  if (!isGenericFacility(quest) || !registry || !Number.isFinite(player?.x) || !Number.isFinite(player?.z)) return null;
  const { kinds, radius } = FACILITIES[quest.kind];
  let nearest = null, best = radius * radius;
  // Only the matching live kind indexes, never world plans or all scenery.
  // Zero-footprint decorative markers deliberately do not enter collision grids.
  for (const kind of kinds) {
    for (const id of registry.byKind.get(kind) || []) {
      const entry = registry.entries.get(id), p = entry?.position;
      if (entry?.kind !== kind || !Number.isFinite(p?.x) || !Number.isFinite(p?.z)) continue;
      const d2 = (p.x - player.x) ** 2 + (p.z - player.z) ** 2;
      if (d2 > best || (nearest && d2 === best)) continue;
      best = d2; nearest = p;
    }
  }
  return nearest ? { x: nearest.x, z: nearest.z, radius } : null;
}

// No RNG, admission footprint, seat or attractor: adding a visible hammock's
// quest marker must not change subsequent scenery placement or NPC seating.
export function registerHammockDropoff(registry, x, y, z, chunkKey) {
  return registry.add({ kind: 'hammock_dropoff', position: { x, y, z }, footprint: 0, chunkKey });
}
