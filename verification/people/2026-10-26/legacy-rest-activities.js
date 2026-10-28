// Recorded hammock/picnic population methods before ownership migration.
export class RestOracle {
  _tryClaimHammock(npc) {
    // Find the nearest unoccupied hammock within 60m. (Was 30m — too tight for
    // sparse hammock spawn density; NPCs would idle near a chunk boundary and
    // never spot the hammock one chunk over.)
    const ids = registry.byKind.get('hammock');
    if (!ids) return false;
    let best = null;
    let bestD2 = 60 * 60;
    for (const id of ids) {
      const e = registry.entries.get(id);
      if (!e || !e.hammock || e.hammock.occupied) continue;
      const dx = e.position.x - npc.pos.x;
      const dz = e.position.z - npc.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    if (!best) return false;
    best.hammock.occupied = true;
    npc.hammockEntry = best;
    npc.target.copy(best.position);
    npc.state = 'walking_to_hammock';
    npc.stateTimer = 18;             // give up if can't reach in 18s
    return true;
  }

  _tickWalkingToHammock(dt, npc) {
    // Returns true if we handled the NPC fully this frame (skip rest of update).
    if (!npc.hammockEntry) {
      npc.state = 'idle';
      npc.stateTimer = 1;
      return true;
    }
    const target = npc.hammockEntry.hammock.seatPos;
    const tdx = target.x - npc.pos.x;
    const tdz = target.z - npc.pos.z;
    const td = Math.hypot(tdx, tdz);
    if (td < 0.7) {
      // Arrived — climb in
      npc.state = 'hammock_riding';
      npc.rideTimer = 12 + Math.random() * 18;  // 12-30s of swinging
      npc.hammockBob = 0;
      return true;
    }
    if (npc.stateTimer <= 0) {
      // Couldn't reach in time — release and go idle
      this._releaseHammock(npc);
      npc.state = 'idle';
      npc.stateTimer = 1;
      return true;
    }
    // Walk toward the hammock at jog speed
    const inv = 1 / (td || 1);
    npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, tdx * inv * 1.6 * npc.energy, Math.min(1, dt * 5));
    npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, tdz * inv * 1.6 * npc.energy, Math.min(1, dt * 5));
    npc.pos.x += npc.vel.x * dt;
    npc.pos.z += npc.vel.z * dt;
    // Face direction of motion
    const targetYaw = Math.atan2(-npc.vel.x, -npc.vel.z);
    const diff = wrapAngle(targetYaw - npc.yaw);
    npc.yaw += diff * Math.min(1, dt * 6);
    this._writeMatrices(npc);
    return true;
  }

  _tickHammockRiding(dt, npc) {
    if (!npc.hammockEntry) {
      npc.state = 'idle';
      npc.stateTimer = 1;
      return;
    }
    npc.rideTimer -= dt;
    npc.hammockBob += dt * 2.2;          // swing speed
    const h = npc.hammockEntry.hammock;
    const swingAmp = 0.18;
    // Sway PERPENDICULAR to the hammock's long axis (i.e. side-to-side, not
    // along its length) so it looks like the cloth is swinging.
    const perpX = -Math.sin(h.yaw);
    const perpZ = Math.cos(h.yaw);
    const sway = Math.sin(npc.hammockBob) * swingAmp;
    npc.pos.x = h.seatPos.x + perpX * sway;
    npc.pos.z = h.seatPos.z + perpZ * sway;
    npc.hammockY = h.seatPos.y + Math.sin(npc.hammockBob * 2) * 0.04;
    // Spine aligned with hammock long axis. Hammock poles are placed in
    // direction (cos(h.yaw), 0, sin(h.yaw)). _writeMatrices applies the supine
    // rotation: X=+π/2 (face up) then Y=npc.yaw. After both rotations the
    // body's head ends up in direction (sin(npc.yaw), 0, cos(npc.yaw)). For
    // that to equal (cos(h.yaw), 0, sin(h.yaw)) we need npc.yaw = π/2 − h.yaw.
    npc.yaw = Math.PI / 2 - h.yaw;
    npc.vel.set(0, 0, 0);

    if (npc.rideTimer <= 0) {
      this._releaseHammock(npc);
      npc.state = 'idle';
      npc.stateTimer = 1 + Math.random() * 2;
      // Step a bit out of the hammock so the next idle target makes sense
      npc.pos.x += (Math.random() - 0.5) * 0.8;
      npc.pos.z += (Math.random() - 0.5) * 0.8;
      npc.hammockY = undefined;
    }
    this._writeMatrices(npc);
  }

  _releaseHammock(npc) {
    if (npc.hammockEntry && npc.hammockEntry.hammock) {
      npc.hammockEntry.hammock.occupied = false;
    }
    npc.hammockEntry = null;
    npc.hammockY = undefined;
  }

  _seatFacingYaw(npc) {
    const c = npc.tableEntry.position, s = npc.tableSeat;
    return Math.atan2(s.x - c.x, s.z - c.z);
  }

  _tryClaimTable(npc) {
    const ids = registry.byKind.get('picnic_table');
    if (!ids) return false;
    // 45m — wide enough that the crowd ringing the food-court attractor can spot a
    // table across the plaza, but close enough that the walk actually completes
    // before the (distance-scaled) give-up timer below.
    let best = null, bestSeat = null, bestD2 = npc.party ? 18 * 18 : 45 * 45;
    for (const id of ids) {
      const e = registry.entries.get(id);
      if (!e || !e.tableSeats) continue;
      const dx = e.position.x - npc.pos.x;
      const dz = e.position.z - npc.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= bestD2) continue;
      const seat = e.tableSeats.find((s) => !s.occupied);
      if (!seat) continue;
      bestD2 = d2; best = e; bestSeat = seat;
    }
    if (!best) return false;
    bestSeat.occupied = true;
    npc.tableEntry = best;
    npc.tableSeat = bestSeat;
    npc.target.set(bestSeat.x, 0, bestSeat.z);
    npc.state = 'walking_to_table';
    // Give-up timer scaled to the walk (≈0.8 m/s effective at low energy) so a diner
    // committing to a seat across the plaza actually arrives instead of timing out
    // mid-walk and re-rolling. A flat 16s only covered ~16 m — far short of the 45 m
    // claim radius, so nobody ever sat.
    const d = Math.hypot(bestSeat.x - npc.pos.x, bestSeat.z - npc.pos.z);
    npc.stateTimer = Math.min(62, Math.max(14, d * 1.4 + 5));
    return true;
  }

  _tickWalkingToTable(dt, npc) {
    if (!npc.tableSeat) { npc.state = 'idle'; npc.stateTimer = 1; return true; }
    const seat = npc.tableSeat;
    const tdx = seat.x - npc.pos.x;
    const tdz = seat.z - npc.pos.z;
    const td = Math.hypot(tdx, tdz);
    if (td < 0.4) {
      // Arrived — sit: snap to the seat, face the table, start the dwell timer.
      npc.pos.x = seat.x;
      npc.pos.z = seat.z;
      npc.yaw = this._seatFacingYaw(npc);
      npc.vel.set(0, 0, 0);
      npc.state = 'table_seated';
      npc.rideTimer = 18 + Math.random() * 30;   // 18–48s of sitting/eating
      this._writeMatrices(npc);
      return true;
    }
    if (npc.stateTimer <= 0) {
      this._releaseTable(npc);
      npc.state = 'idle';
      npc.stateTimer = 1;
      return true;
    }
    const inv = 1 / (td || 1);
    npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, tdx * inv * 1.9 * npc.energy, Math.min(1, dt * 5));
    npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, tdz * inv * 1.9 * npc.energy, Math.min(1, dt * 5));
    npc.pos.x += npc.vel.x * dt;
    npc.pos.z += npc.vel.z * dt;
    const targetYaw = Math.atan2(-npc.vel.x, -npc.vel.z);
    npc.yaw += wrapAngle(targetYaw - npc.yaw) * Math.min(1, dt * 6);
    this._writeMatrices(npc);
    return true;
  }

  _tickTableSeated(dt, npc) {
    if (!npc.tableSeat) { npc.state = 'idle'; npc.stateTimer = 1; return; }
    npc.rideTimer -= dt;
    // Hold the seat, facing the table. The forward leg bend + butt-on-bench lift are
    // applied in _writeMatrices (the `seated` / table_seated branches).
    npc.pos.x = npc.tableSeat.x;
    npc.pos.z = npc.tableSeat.z;
    npc.yaw = this._seatFacingYaw(npc);
    npc.vel.set(0, 0, 0);
    if (npc.rideTimer <= 0) {
      this._releaseTable(npc);
      npc.state = 'idle';
      npc.stateTimer = 1 + Math.random() * 2;
      // Step off the bench so the next idle wander target makes sense.
      npc.pos.x += (Math.random() - 0.5) * 0.8;
      npc.pos.z += (Math.random() - 0.5) * 0.8;
    }
    this._writeMatrices(npc);
  }

  _releaseTable(npc) {
    if (npc.tableSeat) npc.tableSeat.occupied = false;
    npc.tableEntry = null;
    npc.tableSeat = null;
  }

}
