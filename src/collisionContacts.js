// Ordered contact resolution shared by the game and verification surfaces.
// Providers own candidate lifetimes and selected reactions; scoring remains at
// main's existing damaging-hit gate. This module owns no actor/world storage.
import * as THREE from 'three';
export const APPROACH_DAMAGE_THRESHOLD = 1.2;
export const SOFT_PEOPLE_KINDS = new Set(['person', 'kid', 'wook', 'brass', 'hula_hoop', 'one_wheel']);

export function resolveCollision(zerble, colliders) {
  const eligible = !(zerble.invulnLeft > 0);
  // forward = (-sin(h), 0, -cos(h)); velocity = forward * speed
  const fx = -Math.sin(zerble.heading);
  const fz = -Math.cos(zerble.heading);
  const velX = fx * zerble.speed;
  const velZ = fz * zerble.speed;
  const zerbleParked = Math.abs(zerble.speed) < APPROACH_DAMAGE_THRESHOLD;

  for (const c of colliders) {
    // Passive colliders (e.g. the wook walking up to dose Zerble) are visible
    // but don't push Zerble or deal damage — otherwise their physical radius
    // would prevent Zerble from being inside the proximity trigger range.
    if (c.passive) continue;
    const person = SOFT_PEOPLE_KINDS.has(c.kind) || c.kind === 'lurleen' || c.kind === 'puppet';
    // Preserve person immunity while retaining solid scenery during cooldown.
    if (person && !eligible) continue;
    // Parked Zerble can be crowded by people without being pushed around.
    // (Approach-damage already needs Zerble to be moving fast, so this only
    // suppresses the non-damaging position-nudge path below.)
    if (zerbleParked && SOFT_PEOPLE_KINDS.has(c.kind)) continue;
    const tox = c.position.x - zerble.position.x;
    const toz = c.position.z - zerble.position.z;
    const d = Math.hypot(tox, toz);
    const minD = c.radius + zerble.radius;
    if (d >= minD) continue;

    const inv = 1 / (d || 0.0001);
    const approachSpeed = (velX * tox + velZ * toz) * inv;

    if (approachSpeed > APPROACH_DAMAGE_THRESHOLD) {
      // People keep their authored kickback. Solid scenery instead removes
      // the incoming motion and resolves overlap without forcing reverse.
      const pushDir = new THREE.Vector3(-tox * inv, 0, -toz * inv);
      if (person) {
        zerble.applyHit(pushDir);
      } else {
        zerble.applyObstacleHit(pushDir, approachSpeed, minD - d, eligible);
      }
      if (!eligible) return { damaging: false };
      // NPC-specific reaction: panic, knockback, infect neighbors.
      c.onContact?.(c,tox*inv,toz*inv);
      // Damage > 0 means "deduct smiles". Damage 0 entries (e.g. Lurleen, a
      // fleeing NPC) still need their contact response, plus a toast/SFX
      // for the named ones — return `notify` so the caller can react.
      const damaging = c.damage > 0;
      const notify = !damaging && (c.kind === 'lurleen');
      return { damaging, damage: c.damage, kind: c.kind, notify, entry:c.entry||null,onPeoplePenalty:c.onPeoplePenalty??null,onDamagingHit:c.onDamagingHit??null };
    }

    // Non-damaging contact: nudge Zerble out of overlap, kill any small approach speed.
    const overlap = minD - d;
    zerble.position.x -= tox * inv * overlap;
    zerble.position.z -= toz * inv * overlap;
    if (approachSpeed > 0 && zerble.speed > 0) {
      zerble.speed = Math.max(0, zerble.speed - approachSpeed * 0.6);
    }
    return { damaging: false };
  }
  return null;
}
