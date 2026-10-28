// Recorded population passenger methods before seat ownership migration.
export class BoardingOracle {
  _claimFreeSeat(zerble) {
    if (!zerble.seatSlots) return null;
    // Try slots in a randomized order so passengers don't all stack the same way
    const order = zerble.seatSlots.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const idx of order) {
      const slot = zerble.seatSlots[idx];
      if (!slot.occupied) {
        slot.occupied = true;
        return slot;
      }
    }
    return null;
  }

  _releaseSeat(slot) {
    if (slot) slot.occupied = false;
  }

  _tickBoarding(dt, npc, zerble, ctx) {
    const vehicle = npc.seatSlot?.vehicle;
    if (vehicle) zerble = vehicle;
    if (!npc.seatSlot || (vehicle ? vehicle.state !== 'parked' : !ctx.zerbleIdle)) {
      if (npc.party) { npc.party.leave(); return; }
      // Cart started moving (or we lost our slot) — abort
      this._releaseSeat(npc.seatSlot);
      npc.seatSlot = null;
      npc.state = 'watching';
      npc.stateTimer = 1;
      return;
    }
    const target = this._tmpV;
    zerble.worldSeatPosition(npc.seatSlot, target);

    const tdx = target.x - npc.pos.x;
    const tdz = target.z - npc.pos.z;
    const td = Math.hypot(tdx, tdz);

    if (td < BOARD_RANGE) {
      if (npc.party) {
        npc.vel.set(0, 0, 0);
        npc.party.arrive(npc.personHandle,npc._groupSeatReservation);
        if (npc.state === 'riding') this._tickRiding(0, npc, zerble);
        else this._writeMatrices(npc);
        return;
      }
      // Climb aboard
      npc.state = 'riding';
      npc.rideTimer = RIDE_MIN_TIME + Math.random() * (RIDE_MAX_TIME - RIDE_MIN_TIME);
      this._writeMatrices(npc); // snap into place
      if (this.onBoard && !vehicle) this.onBoard(npc);
      return;
    }

    // Steer toward seat at jog speed
    const invD = 1 / (td || 1);
    const dx = tdx * invD;
    const dz = tdz * invD;
    const speed = 2.4 * npc.energy;
    npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, dx * speed, Math.min(1, dt * 6));
    npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, dz * speed, Math.min(1, dt * 6));
    npc.pos.x += npc.vel.x * dt;
    npc.pos.z += npc.vel.z * dt;

    // Face direction of motion
    const targetYaw = Math.atan2(-npc.vel.x, -npc.vel.z);
    const diff = wrapAngle(targetYaw - npc.yaw);
    npc.yaw += diff * Math.min(1, dt * 6);

    // Timeout — give up if we can't reach the seat
    if (npc.stateTimer <= 0) {
      if (npc.party) { npc.party.leave(); return; }
      this._releaseSeat(npc.seatSlot);
      npc.seatSlot = null;
      npc.state = 'idle';
      npc.stateTimer = 2;
    }

    this._writeMatrices(npc);
  }

  _tickRiding(dt, npc, zerble) {
    const vehicle = npc.seatSlot?.vehicle;
    if (vehicle) zerble = vehicle;
    if (!npc.seatSlot) {
      npc.state = 'idle';
      npc.stateTimer = 1;
      return;
    }
    // Lock position to the seat. Face the same way the cart is facing.
    const out = this._tmpV;
    zerble.worldSeatPosition(npc.seatSlot, out);
    npc.pos.x = out.x;
    npc.pos.z = out.z;
    // Stash seat Y on the npc — we use it in _writeMatrices to lift the body.
    npc.seatY = out.y;

    // Yaw matches cart heading (passengers face forward like the cart) plus slot's offset
    npc.yaw = zerble.heading + npc.seatSlot.yaw;

    // Slight dance bob even while riding (extra dance-y characters wiggle a bit)
    npc.bob += dt * (1.2 + 0.6 * npc.dance);

    // Disembark when the ride times out (and Zerble's idle), OR immediately if
    // the bubble tank ran dry — riders bail on a bubble-less cart.
    if (!npc.party && ((!vehicle && this.bubblesEmpty) || (npc.rideTimer <= 0 && (vehicle ? vehicle.state === 'parked' : Math.abs(zerble.speed) < ZERBLE_IDLE_SPEED)))) {
      this._releaseSeat(npc.seatSlot);
      const seatPos = { x: out.x, z: out.z };
      npc.seatSlot = null;
      npc.seatY = undefined;
      npc.state = 'disembarking';
      // Pick a destination 3-6m away from where we got off
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 3;
      npc.target.set(seatPos.x + Math.cos(a) * r, 0, seatPos.z + Math.sin(a) * r);
      npc.stateTimer = 5;
    }

    this._writeMatrices(npc);
  }

  _tickDisembarking(dt, npc) {
    // Just lean toward the disembark target; the regular walking loop below handles motion.
    const tdx = npc.target.x - npc.pos.x;
    const tdz = npc.target.z - npc.pos.z;
    const td = Math.hypot(tdx, tdz);
    if (td < ARRIVE_RADIUS || npc.stateTimer <= 0) {
      npc.state = 'idle';
      npc.stateTimer = 1 + Math.random() * 2;
    }
  }

}
