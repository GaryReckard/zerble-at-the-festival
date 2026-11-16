// Generic requests accept any currently built matching facility. Named places
// retain their stored target; this lookup never rewrites rewards or deadlines.
const FACILITIES = Object.freeze({
  hammock: { kinds: ['hammock'], radius: 25 },
  porta_potty: { kinds: ['porta_potty'], radius: 16 },
});

export function isGenericFacility(quest) {
  return Object.hasOwn(FACILITIES, quest?.kind);
}

export function resolveNearbyFacility(quest, player, registry, canAccept, { occupied = false } = {}) {
  if (!isGenericFacility(quest) || !registry || !Number.isFinite(player?.x) || !Number.isFinite(player?.z)) return null;
  const { kinds, radius } = FACILITIES[quest.kind];
  let nearest = null, best = radius * radius;
  // Only the matching live kind indexes, never world plans or all scenery.
  // Zero-footprint tree hammocks deliberately do not enter collision grids.
  for (const kind of kinds) {
    for (const id of registry.byKind.get(kind) || []) {
      const entry = registry.entries.get(id), p = entry?.position;
      if (entry?.kind !== kind || !Number.isFinite(p?.x) || !Number.isFinite(p?.z)) continue;
      const d2 = (p.x - player.x) ** 2 + (p.z - player.z) ** 2;
      if (d2 > best || (nearest && d2 === best)) continue;
      const resource = quest.kind === 'hammock' ? entry.hammock : entry.potty;
      if (!resource || !!resource.occupied !== occupied) continue;
      const approach = canAccept ? canAccept(entry, quest) : (entry.hammock?.approaches?.[0] ?? p);
      if (!approach || !Number.isFinite(approach.x) || !Number.isFinite(approach.z)) continue;
      best = d2; nearest = { x: p.x, z: p.z, radius, entryId: id, approach,
        ...(occupied && resource.approaching ? { approaching: true } : {}) };
    }
  }
  return nearest;
}

// Metadata only: neither registration nor approach creation advances world RNG.
// The fabric midpoint can differ from the trunk midpoint when their radii differ.
export function hammockResource(model, groundY, groundAt) {
  const seatPos = model.seatPos.clone();
  seatPos.y += groundY;
  const { yaw } = model;
  const approaches = [-1, 1].map(side => {
    const x = seatPos.x - Math.sin(yaw) * side * 1.2;
    const z = seatPos.z + Math.cos(yaw) * side * 1.2;
    return { x, y: groundAt(x, z), z };
  });
  return { seatPos, yaw, occupied: false, approaches };
}

export function registerTreeHammock(registry, model, groundY, chunkKey, groundAt) {
  const hammock = hammockResource(model, groundY, groundAt);
  const { x, z } = hammock.seatPos;
  // Zero footprint preserves subsequent tree/prop admission exactly. The existing
  // trunks own collision; the activity owner validates access before claiming.
  return registry.add({ kind: 'hammock', position: { x, y: groundAt(x, z), z },
    footprint: 0, chunkKey, hammock });
}
