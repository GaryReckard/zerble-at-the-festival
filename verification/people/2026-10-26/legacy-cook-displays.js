export function updateSugarShackCooks(dt) {
  for (let i = 0; i < sugarShackCooks.length; i++) {
    const e = sugarShackCooks[i];
    if (e.holdLeft > 0) {
      e.holdLeft -= dt;
      if (e.holdLeft <= 0) {
        // Pick a different waypoint than the current one. With 5 wps and
        // a uniform random pick, collisions average 1-in-5 — cheap retry.
        let next = e.currentIdx;
        let tries = 0;
        while (next === e.currentIdx && tries++ < 6) {
          next = Math.floor(Math.random() * e.waypoints.length);
        }
        e.targetIdx = next;
      }
      continue;
    }
    const wp = e.waypoints[e.targetIdx];
    const dx = wp.x - e.cook.position.x;
    const dz = wp.z - e.cook.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      // Arrived — snap to position + waypoint facing, start idle hold.
      e.cook.position.x = wp.x;
      e.cook.position.z = wp.z;
      e.cook.rotation.y = wp.facing;
      e.currentIdx = e.targetIdx;
      e.holdLeft = wp.holdMin + Math.random() * (wp.holdMax - wp.holdMin);
      continue;
    }
    const step = Math.min(e.walkSpeed * dt, d);
    const inv = 1 / d;
    e.cook.position.x += dx * inv * step;
    e.cook.position.z += dz * inv * step;
    // Face direction of travel: NPC local -Z is forward, so yaw rotates
    // -Z to align with (dx, dz). yaw = atan2(-dx, -dz).
    e.cook.rotation.y = Math.atan2(-dx, -dz);
  }
}
