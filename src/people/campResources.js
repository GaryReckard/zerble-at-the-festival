// Camping and music share the same world-owned chairs. A reservation belongs to
// one concrete slot and person/claim lifetime, including during owner teardown.
const owners = new WeakMap();
export function campSlotAvailable(slot) {
  return !!slot && !slot.occupied && !slot.physicalUnavailable && !owners.has(slot);
}
export function reserveCampSlot(
  people,
  registry,
  claim,
  entry,
  slot,
  bed = false,
) {
  if (
    !people.isPersonActivityCurrent(claim) ||
    registry.entries.get(entry?.id) !== entry ||
    !(bed ? entry.campBeds : entry.campSeats)?.includes(slot) ||
    !campSlotAvailable(slot)
  )
    return null;
  const token = { person: claim.person, claim, entry, slot, bed };
  owners.set(slot, token);
  slot.occupied = true;
  return token;
}
export function campSlotValid(people, registry, token) {
  return (
    !!token &&
    owners.get(token.slot) === token &&
    people.isPersonActivityCurrent(token.claim) &&
    registry.entries.get(token.entry.id) === token.entry &&
    (token.bed ? token.entry.campBeds : token.entry.campSeats)?.includes(
      token.slot,
    )
  );
}
export function releaseCampSlot(token) {
  if (!token || owners.get(token.slot) !== token) return false;
  owners.delete(token.slot);
  token.slot.occupied = false;
  return true;
}
export function campExit(registry, slot, bed = false) {
  if (!slot) return null;
  const x = bed ? slot.doorX : (slot.approachX ?? slot.x),
    z = bed ? slot.doorZ : (slot.approachZ ?? slot.z);
  for (let i = 0; i < 33; i++) {
    const radius = i ? Math.ceil(i / 8) * 0.8 : 0,
      angle = (i * Math.PI) / 4,
      candidate = {
        x: x + Math.cos(angle) * radius,
        z: z + Math.sin(angle) * radius,
      };
    let clear = true;
    registry.collidersNear(candidate.x, candidate.z, 0.4, (e) => {
      if (
        Math.hypot(candidate.x - e.position.x, candidate.z - e.position.z) <
        (e.collider?.radius || 0) + 0.35
      )
        clear = false;
    });
    if (clear) return candidate;
  }
  return null;
}
