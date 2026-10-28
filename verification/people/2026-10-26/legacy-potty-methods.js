// Recorded bathroom behavior before person/resource ownership migration.
export class PottyOracle {
  _findNearestPotty(npc, tried) {
    const ids = registry.byKind.get('porta_potty');
    if (!ids) return null;
    let best = null, bestD2 = npc.party ? 22 * 22 : POTTY_SEARCH_R2;
    for (const id of ids) {
      if (tried && tried.includes(id)) continue;
      const e = registry.entries.get(id);
      if (!e || !e.potty) continue;
      const dx = e.position.x - npc.pos.x;
      const dz = e.position.z - npc.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    return best;
  }

  _npcByIdx(idx) {
    for (const n of this.npcs) if (n.idx === idx) return n;
    return null;
  }

  // Free a porta-potty this NPC had claimed + reset its potty bookkeeping.
  _releasePotty(npc) {
    const e = npc.pottyEntry;
    if (e && e.potty && e.potty.occupantId === npc.idx) {
      e.potty.occupied = false;
      e.potty.occupantId = null;
      e.potty.locked = false;
      e.potty.doorTarget = 0;
    }
    npc.pottyEntry = null;
    npc.pottyTried = null;
    npc.pottyWait = 0;
    npc.useTimer = 0;
    npc.pottyPeeked = 0;
    npc.pottySitting = false;
    npc.seatY = undefined;
  }

  // Give up the whole errand and return to ambient wandering.
  _abortPotty(npc) {
    this._releasePotty(npc);
    npc.state = 'idle';
    npc.stateTimer = 1 + Math.random() * 2;
  }

  // Common guard: the targeted entry vanished (chunk unloaded) → bail cleanly.
  _pottyEntryGone(npc) {
    const e = npc.pottyEntry;
    return !e || !e.potty || !registry.entries.has(e.id);
  }

  _tickSeekingPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) { this._abortPotty(npc); this._writeMatrices(npc); return; }
    if (npc.stateTimer <= 0) { this._abortPotty(npc); this._writeMatrices(npc); return; }
    const e = npc.pottyEntry;
    const p = e.potty;

    // Walk to the door stand point.
    const standX = e.position.x + p.outX * POTTY_DOOR_STAND;
    const standZ = e.position.z + p.outZ * POTTY_DOOR_STAND;
    const tdx = standX - npc.pos.x;
    const tdz = standZ - npc.pos.z;
    const td = Math.hypot(tdx, tdz);

    if (td > 0.7) {
      const inv = 1 / (td || 1);
      const speed = 1.8 * npc.energy;
      npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, tdx * inv * speed, Math.min(1, dt * 5));
      npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, tdz * inv * speed, Math.min(1, dt * 5));
      npc.pos.x += npc.vel.x * dt;
      npc.pos.z += npc.vel.z * dt;
      const yaw = Math.atan2(-npc.vel.x, -npc.vel.z);
      npc.yaw += wrapAngle(yaw - npc.yaw) * Math.min(1, dt * 6);
      this._writeMatrices(npc);
      return;
    }

    // Arrived at the door. Face into the unit (toward the door = -outward).
    npc.vel.set(0, 0, 0);
    npc.yaw += wrapAngle(Math.atan2(p.outX, p.outZ) - npc.yaw) * Math.min(1, dt * 8);

    if (!p.occupied) {
      // Vacant → go in. Roll whether the occupant will lock the door behind them.
      p.occupied = true;
      p.occupantId = npc.idx;
      p.locked = Math.random() < POTTY_LOCK_CHANCE;
      p.doorTarget = 1;
      npc.state = 'entering_potty';
      npc.stateTimer = 6;
      this._writeMatrices(npc);
      return;
    }

    // Occupied + the occupant forgot to lock → SURPRISE. Yank the door open,
    // both parties recoil. The occupant scrambles to lock it now.
    if (!p.locked) {
      if (!npc.pottyTried) npc.pottyTried = [];
      if (!npc.pottyTried.includes(e.id)) npc.pottyTried.push(e.id);
      p.doorTarget = 1;
      p.locked = true;
      const occ = this._npcByIdx(p.occupantId);
      if (occ && occ.state === 'using_potty') occ.pottyPeeked = 1.2;  // pop into the doorway, startled
      npc.state = 'surprised_potty';
      npc.stateTimer = 1.3;
      npc.cheerTimer = 1.3;   // arms-up startle pose (decayed inside the tick)
      this._writeMatrices(npc);
      return;
    }

    // Occupied + locked → wait a beat, then head to the next closest.
    npc.pottyWait = (npc.pottyWait || 0) + dt;
    if (npc.pottyWait < 2.5 && Math.random() < 0.6) { this._writeMatrices(npc); return; }
    npc.pottyWait = 0;
    if (!npc.pottyTried) npc.pottyTried = [];
    if (!npc.pottyTried.includes(e.id)) npc.pottyTried.push(e.id);
    const next = this._findNearestPotty(npc, npc.pottyTried);
    if (next) { npc.pottyEntry = next; npc.stateTimer = 30; }
    else { this._abortPotty(npc); }
    this._writeMatrices(npc);
  }

  _tickEnteringPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) { this._abortPotty(npc); this._writeMatrices(npc); return; }
    const e = npc.pottyEntry;
    const p = e.potty;

    const cx = e.position.x, cz = e.position.z;
    const tdx = cx - npc.pos.x, tdz = cz - npc.pos.z;
    const td = Math.hypot(tdx, tdz);

    if (td > 0.25 && npc.stateTimer > 0) {
      // Step in only once the door's actually open.
      if (p.doorOpen > 0.5) {
        const inv = 1 / (td || 1);
        const speed = 1.1 * npc.energy;
        npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, tdx * inv * speed, Math.min(1, dt * 6));
        npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, tdz * inv * speed, Math.min(1, dt * 6));
        npc.pos.x += npc.vel.x * dt;
        npc.pos.z += npc.vel.z * dt;
      }
      npc.yaw += wrapAngle(Math.atan2(p.outX, p.outZ) - npc.yaw) * Math.min(1, dt * 8);
      this._writeMatrices(npc);
      return;
    }

    // Inside — snap to centre, shut the door, hide, start the visit.
    npc.pos.x = cx;
    npc.pos.z = cz;
    npc.vel.set(0, 0, 0);
    p.doorTarget = 0;
    npc.state = 'using_potty';
    npc.useTimer = POTTY_USE_MIN + Math.random() * (POTTY_USE_MAX - POTTY_USE_MIN);
    this._hideNpc(npc);
  }

  _tickUsingPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) { this._unhideAbort(npc); return; }
    const e = npc.pottyEntry;
    const p = e.potty;

    // Someone yanked the (unlocked) door open — caught sitting on the toilet,
    // startled (arms up), facing the intruder, for a beat. Then they recover and
    // duck back to invisible-inside and carry on.
    if (npc.pottyPeeked > 0) {
      npc.pottyPeeked -= dt;
      npc.pottySitting = true;
      npc.cheerTimer = Math.max(0, npc.pottyPeeked);   // arms-up "EEP!" pose
      npc.seatY = POTTY_SEAT_Y;
      npc.pos.x = e.position.x - p.outX * POTTY_SEAT_BACK;  // on the toilet (back of unit)
      npc.pos.z = e.position.z - p.outZ * POTTY_SEAT_BACK;
      npc.yaw = Math.atan2(-p.outX, -p.outZ);          // face the door/intruder
      if (npc.pottyPeeked <= 0) {
        npc.cheerTimer = 0;
        npc.pottySitting = false;
        npc.seatY = undefined;
        npc.pos.x = e.position.x;
        npc.pos.z = e.position.z;
      }
      this._writeMatrices(npc);
      return;
    }

    npc.useTimer -= dt;
    this._hideNpc(npc);
    if (npc.useTimer <= 0) {
      p.doorTarget = 1;            // open up to leave
      npc.state = 'exiting_potty';
      npc.stateTimer = 5;
      npc.exitPhase = 0;
    }
  }

  _tickExitingPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) { this._unhideAbort(npc); return; }
    const e = npc.pottyEntry;
    const p = e.potty;

    // Stay hidden until the door's open enough to step through.
    if (npc.exitPhase === 0 && p.doorOpen < 0.55 && npc.stateTimer > 0) {
      this._hideNpc(npc);
      return;
    }

    if (npc.exitPhase === 0) {
      npc.exitPhase = 1;
      // Step out to the stand point, free the unit, puff the stink, walk off.
      npc.pos.x = e.position.x + p.outX * (POTTY_DOOR_STAND * 0.55);
      npc.pos.z = e.position.z + p.outZ * (POTTY_DOOR_STAND * 0.55);
      npc.yaw = Math.atan2(-p.outX, -p.outZ);   // face outward (away)
      p.occupied = false;
      p.occupantId = null;
      p.locked = false;
      p.doorTarget = 0;            // close behind them
      p.stinkTimer = STINK_DUR;    // green puff
      const r = 3 + Math.random() * 3;
      npc.target.set(
        e.position.x + p.outX * r + (Math.random() - 0.5) * 2,
        0,
        e.position.z + p.outZ * r + (Math.random() - 0.5) * 2,
      );
      npc.pottyEntry = null;
      npc.pottyTried = null;
      npc.pottyWait = 0;
      npc.state = 'walking';       // actively walk away from the door (frees it for the next user)
      npc.stateTimer = 6;
      this._writeMatrices(npc);
    }
  }

  _tickSurprisedPotty(dt, npc) {
    npc.stateTimer -= dt;
    npc.cheerTimer = Math.max(0, npc.stateTimer);   // arms-up pose tracks the recoil
    const e = npc.pottyEntry;
    const p = e && e.potty;
    if (p) {
      npc.yaw += wrapAngle(Math.atan2(p.outX, p.outZ) - npc.yaw) * Math.min(1, dt * 8);
      const sp = 2.6 * npc.energy;
      npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, p.outX * sp, Math.min(1, dt * 8));
      npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, p.outZ * sp, Math.min(1, dt * 8));
      npc.pos.x += npc.vel.x * dt;
      npc.pos.z += npc.vel.z * dt;
    }
    if (npc.stateTimer <= 0) {
      npc.cheerTimer = 0;
      if (p) p.doorTarget = 0;   // slam it shut
      const next = this._findNearestPotty(npc, npc.pottyTried || []);
      if (next) {
        npc.pottyEntry = next;
        npc.state = 'seeking_potty';
        npc.stateTimer = 30;
        npc.pottyWait = 0;
      } else {
        this._abortPotty(npc);
      }
    }
    this._writeMatrices(npc);
  }

  _unhideAbort(npc) {
    this._releasePotty(npc);
    npc.state = 'idle';
    npc.stateTimer = 1 + Math.random() * 2;
    this._writeMatrices(npc);
  }

  onPottyHit(entry) {
    if (!entry || !entry.potty || !entry.potty.occupied) return;
    const p = entry.potty;
    const occ = this._npcByIdx(p.occupantId);
    if (occ && occ.pottyEntry === entry) {
      occ.pos.x = entry.position.x + p.outX * 1.0;
      occ.pos.z = entry.position.z + p.outZ * 1.0;
      occ.pottyEntry = null;
      occ.pottyTried = null;
      occ.useTimer = 0;
      occ.pottyPeeked = 0;
      occ.pottySitting = false;
      occ.seatY = undefined;
      occ.state = 'fleeing';
      occ.stateTimer = 3;
    }
    p.occupied = false;
    p.occupantId = null;
    p.locked = false;
    p.doorTarget = 1;
    p.stinkTimer = STINK_DUR;
  }

}
