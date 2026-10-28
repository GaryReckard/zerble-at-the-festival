// Frozen before Task 2.17 ambient camp migration.
export class CampOracle {
  _campExit(npc) {
    const slot = npc.campSlot;
    const x = npc.campBed ? slot.doorX : (slot.approachX ?? slot.x);
    const z = npc.campBed ? slot.doorZ : (slot.approachZ ?? slot.z);
    for (let i = 0; i < 33; i++) {
      const radius = i ? Math.ceil(i / 8) * 0.8 : 0;
      const angle = i * Math.PI / 4;
      const candidate = {x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius};
      let clear = true;
      registry.collidersNear(candidate.x, candidate.z, 0.4, e => {
        if (Math.hypot(candidate.x - e.position.x, candidate.z - e.position.z) < (e.collider?.radius || 0) + 0.35) clear = false;
      });
      if (clear) return candidate;
    }
    return null;
  }

  _releaseCamp(npc) {
    this.campJams?.releaseNpc(npc);
    if (npc.campSlot) {
      if (npc.state === 'camp_sleeping' || npc.state === 'camp_seated') {
        const exit = this._campExit(npc);
        if (exit) { npc.pos.x = exit.x; npc.pos.z = exit.z; }
      }
      npc.campSlot.occupied = false;
    }
    npc.campSlot = null;
    npc.campEntry = null;
    npc.campCooldown = 12 + (npc.idx % 7) * 3;
  }

  _tickCamp(dt, npc) {
    npc.campCooldown = Math.max(0, (npc.campCooldown || 0) - dt);
    const t = this.campTimeOfDay?.t ?? getTimeOfDay()?.t ?? 0.25;
    const stagger = ((npc.idx * 73 + 19) % 101) / 101;
    const sleep = t >= 0.77 + stagger * 0.13 || t < 0.02 + stagger * 0.07;
    const gathering = t >= 0.48 && t < 0.92;
    const daytime = t >= 0.09 && t < 0.48;
    if (npc.state === 'camp_seated') npc.campDwell -= dt;
    const active = npc.state.startsWith('camp_');
    if (active && (!npc.campEntry || registry.entries.get(npc.campEntry.id) !== npc.campEntry)) {
      this._releaseCamp(npc);
      npc.state = 'idle'; npc.stateTimer = 2;
      this._writeMatrices(npc);
      return true;
    }
    if (active && ((npc.campBed && !sleep) || (!npc.campBed && (sleep || (!gathering && (!daytime || npc.campDwell <= 0)))))) {
      const exit = this._campExit(npc);
      if (!exit) { this._writeMatrices(npc); return true; }
      // Emerge at the clear door, and stand off the chair before releasing it.
      npc.pos.x = exit.x;
      npc.pos.z = exit.z;
      this._releaseCamp(npc);
      npc.state = 'idle'; npc.stateTimer = 2;
      this._writeMatrices(npc);
      return true;
    }
    if (!active) {
      if (npc.party || npc.campCooldown || !['idle', 'walking'].includes(npc.state) || (!sleep && !gathering && !daytime)) return false;
      let entry = null, slot = null, distance = 28;
      for (const id of registry.byKind.get('campsite') || []) {
        const camp = registry.entries.get(id);
        if (!camp) continue;
        // All seat/bed coordinates lie inside the registered camp footprint.
        // A farther center cannot beat the current nearest claim, so avoid
        // visiting every individual slot in distant loaded neighborhoods.
        if (camp.position && Number.isFinite(camp.footprint)) {
          const reach=distance+camp.footprint,dx=camp.position.x-npc.pos.x,dz=camp.position.z-npc.pos.z;
          if(dx*dx+dz*dz>reach*reach)continue;
        }
        for (const candidate of (sleep ? camp.campBeds : camp.campSeats) || []) {
          if (candidate.occupied) continue;
          const d = Math.hypot(candidate.x - npc.pos.x, candidate.z - npc.pos.z);
          if (d < distance) { entry = camp; slot = candidate; distance = d; }
        }
      }
      if (!slot) return false;
      slot.occupied = true;
      npc.campSlot = slot; npc.campEntry = entry; npc.campBed = sleep;
      npc.state = 'camp_walking'; npc.stateTimer = distance * 2 + 12;
      npc.campAtApproach = false;
    }
    const slot = npc.campSlot;
    if (npc.state === 'camp_walking') {
      const tx = npc.campBed ? slot.doorX : npc.campAtApproach ? slot.x : (slot.approachX ?? slot.x);
      const tz = npc.campBed ? slot.doorZ : npc.campAtApproach ? slot.z : (slot.approachZ ?? slot.z);
      const dx = tx - npc.pos.x, dz = tz - npc.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.25) {
        if (!npc.campBed && !npc.campAtApproach) npc.campAtApproach = true;
        else {
          npc.pos.x = slot.x; npc.pos.z = slot.z;
          npc.yaw = slot.yaw ?? npc.yaw;
          npc.vel.set(0, 0, 0);
          npc.state = npc.campBed ? 'camp_sleeping' : 'camp_seated';
          npc.campDwell = 18 + stagger * 22;
        }
      } else if (npc.stateTimer <= 0) {
        this._releaseCamp(npc); npc.state = 'idle'; npc.stateTimer = 3;
      } else {
        const step = Math.min(d, dt * (1.2 + npc.energy));
        let nx = npc.pos.x + dx / d * step, nz = npc.pos.z + dz / d * step;
        // Hard local solids remain authoritative during special-state walks.
        // Sliding around a circle prevents the direct seek from cutting tents.
        registry.collidersNear(nx, nz, 0.3, e => {
          if (!npc.campBed && npc.campAtApproach && e === slot.collider) return;
          const r = (e.collider?.radius || 0) + 0.28;
          if (r <= 0.28) return;
          const ox = nx - e.position.x, oz = nz - e.position.z, od = Math.hypot(ox, oz);
          if (od < r) {
            const a = Math.atan2(oz || dz, ox || dx) + step / r * (npc.idx % 2 ? 1 : -1);
            nx = e.position.x + Math.cos(a) * r; nz = e.position.z + Math.sin(a) * r;
          }
        });
        // Sequential projections can push into a second solid; reject any
        // unresolved overlap rather than teleporting through a tight cluster.
        let blocked = false;
        registry.collidersNear(nx, nz, 0.3, e => {
          if (!npc.campBed && npc.campAtApproach && e === slot.collider) return;
          const r = (e.collider?.radius || 0) + 0.28;
          if (r > 0.28 && Math.hypot(nx - e.position.x, nz - e.position.z) < r - 0.001) blocked = true;
        });
        if (blocked) { nx = npc.pos.x; nz = npc.pos.z; }
        npc.vel.set((nx - npc.pos.x) / Math.max(dt, 0.001), 0, (nz - npc.pos.z) / Math.max(dt, 0.001));
        npc.pos.x = nx; npc.pos.z = nz;
        npc.yaw += wrapAngle(Math.atan2(-dx, -dz) - npc.yaw) * Math.min(1, dt * 6);
      }
    } else npc.vel.set(0, 0, 0);
    this._writeMatrices(npc);
    return true;
  }

}
