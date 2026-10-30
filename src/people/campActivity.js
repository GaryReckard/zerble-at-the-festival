import {
  campSlotAvailable,
  reserveCampSlot,
  campSlotValid,
  releaseCampSlot,
  prepareCampSlotTransfer,
  campExit,
} from "./campResources.js";
const vector = () => ({
  x: 0,
  y: 0,
  z: 0,
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  },
});
const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export class CampActivity {
  constructor(people, registry) {
    this.people = people;
    this.registry = registry;
    this.activityKey = "camp";
    this.states = new WeakMap();
    this.records = new Map();
    this.time = 0.25;
    this.disposed = false;
  }
  has(handle) {
    return this.records.has(handle);
  }
  _state(handle) {
    let s = this.states.get(handle);
    if (!s) {
      s = {
        person: handle,
        idx: handle.slot,
        pos: vector(),
        vel: vector(),
        target: vector(),
        campSlot: null,
        campEntry: null,
        campCooldown: 0,
        claim: null,
        publication: false,
      };
      this.states.set(handle, s);
    }
    return s;
  }
  setCooldown(handle, value) {
    if (handle && Number.isFinite(value) && value >= 0)
      this._state(handle).campCooldown = value;
  }
  readPlace(handle, out) {
    const s = this.records.get(handle);
    if (!s || !campSlotValid(this.people, this.registry, s.reservation))
      return false;
    out.slot = s.campSlot;
    out.entry = s.campEntry;
    out.bed = s.campBed;
    return true;
  }
  prepareSupportTransfer(handle, entry, attempt) {
    const s = this.records.get(handle);
    if (this.disposed || !s || !this.people.readCampMotion(handle,s)
      || s.state !== 'camp_seated' || s.campBed) return null;
    return prepareCampSlotTransfer(this.people,this.registry,s.reservation,entry,attempt);
  }
  exit(handle) {
    const s = this.records.get(handle);
    return s ? this._campExit(s) : null;
  }
  _campExit(s) {
    return campExit(this.registry, s.campSlot, s.campBed);
  }
  _acquire(s, entry, slot, bed) {
    const claim = this.people.claimActivity(
      s.person,
      {
        owner: this,
        release: (current) => {
          if (this.records.get(s.person) !== s || s.claim !== current) return;
          this._releaseCamp(s);
          this.records.delete(s.person);
          s.claim = null;
          this.people.releaseCampPose(current);
        },
      },
      { preserveMotion: true },
    );
    if (!claim) return false;
    const reservation = reserveCampSlot(
      this.people,
      this.registry,
      claim,
      entry,
      slot,
      bed,
    );
    if (!reservation) {
      this.people.endPersonActivity(claim, { reason: "rest-step" });
      return false;
    }
    s.claim = claim;
    s.reservation = reservation;
    s.campSlot = slot;
    s.campEntry = entry;
    s.campBed = bed;
    this.records.set(s.person, s);
    return true;
  }
  _releaseCamp(s) {
    if (s.campSlot) {
      if (s.state === "camp_sleeping" || s.state === "camp_seated") {
        const exit = this._campExit(s);
        if (exit) {
          s.pos.x = exit.x;
          s.pos.z = exit.z;
        }
      }
      releaseCampSlot(s.reservation);
    }
    s.reservation = null;
    s.campSlot = null;
    s.campEntry = null;
    s.campCooldown = 12 + (s.idx % 7) * 3;
  }
  _writeMatrices(s) {
    s.publication = true;
  }
  tick(dt, handle, time = 0.25) {
    if (this.disposed || !handle || typeof handle !== "object") return false;
    const s = this._state(handle);
    if (!this.people.readCampMotion(handle, s)) return false;
    s.publication = false;
    s.campCooldown = Math.max(0, (s.campCooldown || 0) - dt);
    this.time = time;
    const consumed = this._tickCamp(dt, s);
    if (s.claim) {
      s.campY = s.campSlot?.y;
      if (s.campSlot) this.people.commitCampMotion(s.claim, s);
      else this.people.finishCampMotion(s.claim, s);
    }
    return consumed;
  }
  release(handle) {
    const s = this.records.get(handle);
    if (!s) {
      this.setCooldown(handle, 12 + (handle?.slot % 7) * 3);
      return false;
    }
    if (this.people.readCampMotion(handle, s)) {
      s.publication = false;
      this._releaseCamp(s);
      return this.people.finishCampMotion(s.claim, s);
    }
    return this.people.endPersonActivity(s.claim);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const errors = [];
    for (const s of this.records.values())
      try {
        this.people.endPersonActivity(s.claim, { reason: "camp-disposed" });
      } catch (error) {
        errors.push(error);
      }
    this.states = new WeakMap();
    if (errors.length)
      throw new AggregateError(errors, "Camp activity cleanup failed.");
  }
  _tickCamp(dt, npc) {
    const t = this.time;
    const stagger = ((npc.idx * 73 + 19) % 101) / 101;
    const sleep = t >= 0.77 + stagger * 0.13 || t < 0.02 + stagger * 0.07;
    const gathering = t >= 0.48 && t < 0.92;
    const daytime = t >= 0.09 && t < 0.48;
    if (npc.state === "camp_seated") npc.campDwell -= dt;
    const active = npc.state.startsWith("camp_");
    if (active && !campSlotValid(this.people, this.registry, npc.reservation)) {
      this._releaseCamp(npc);
      npc.state = "idle";
      npc.stateTimer = 2;
      this._writeMatrices(npc);
      return true;
    }
    if (
      active &&
      ((npc.campEntry?.stageAudience && npc.campDwell <= 0) ||
        (npc.campBed && !sleep) ||
        (!npc.campBed && !npc.campEntry?.stageAudience &&
          (sleep || (!gathering && (!daytime || npc.campDwell <= 0)))))
    ) {
      const exit = this._campExit(npc);
      if (!exit) {
        this._writeMatrices(npc);
        return true;
      }
      // Emerge at the clear door, and stand off the chair before releasing it.
      npc.pos.x = exit.x;
      npc.pos.z = exit.z;
      this._releaseCamp(npc);
      npc.state = "idle";
      npc.stateTimer = 2;
      this._writeMatrices(npc);
      return true;
    }
    if (!active) {
      if (
        npc.claimed ||
        npc.grouped ||
        npc.campCooldown ||
        !["idle", "walking"].includes(npc.state) ||
        (!sleep && !gathering && !daytime)
      )
        return false;
      let entry = null,
        slot = null,
        distance = 28;
      for (const kind of ["campsite", "chair"]) for (const id of this.registry.byKind.get(kind) || []) {
        const camp = this.registry.entries.get(id);
        if (!camp || (camp.stageAudience && npc.idx % 5 !== 0)) continue;
        // All seat/bed coordinates lie inside the registered camp footprint.
        // A farther center cannot beat the current nearest claim, so avoid
        // visiting every individual slot in distant loaded neighborhoods.
        if (camp.position && Number.isFinite(camp.footprint)) {
          const reach = distance + camp.footprint,
            dx = camp.position.x - npc.pos.x,
            dz = camp.position.z - npc.pos.z;
          if (dx * dx + dz * dz > reach * reach) continue;
        }
        for (const candidate of (sleep && !camp.stageAudience ? camp.campBeds : camp.campSeats) ||
          []) {
          if (!campSlotAvailable(candidate)) continue;
          const d = Math.hypot(
            candidate.x - npc.pos.x,
            candidate.z - npc.pos.z,
          );
          if (d < distance) {
            entry = camp;
            slot = candidate;
            distance = d;
          }
        }
      }
      if (!slot) return false;
      if (!this._acquire(npc, entry, slot, sleep && !entry.stageAudience)) return false;
      npc.state = "camp_walking";
      npc.stateTimer = distance * 2 + 12;
      npc.campAtApproach = false;
    }
    const slot = npc.campSlot;
    if (npc.state === "camp_walking") {
      const tx = npc.campBed
        ? slot.doorX
        : npc.campAtApproach
          ? slot.x
          : (slot.approachX ?? slot.x);
      const tz = npc.campBed
        ? slot.doorZ
        : npc.campAtApproach
          ? slot.z
          : (slot.approachZ ?? slot.z);
      const dx = tx - npc.pos.x,
        dz = tz - npc.pos.z,
        d = Math.hypot(dx, dz);
      if (d < 0.25) {
        if (!npc.campBed && !npc.campAtApproach) npc.campAtApproach = true;
        else {
          npc.pos.x = slot.x;
          npc.pos.z = slot.z;
          npc.yaw = slot.yaw ?? npc.yaw;
          npc.vel.set(0, 0, 0);
          npc.state = npc.campBed ? "camp_sleeping" : "camp_seated";
          npc.campDwell = 18 + stagger * 22;
        }
      } else if (npc.stateTimer <= 0) {
        this._releaseCamp(npc);
        npc.state = "idle";
        npc.stateTimer = 3;
      } else {
        const step = Math.min(d, dt * (1.2 + npc.energy));
        let nx = npc.pos.x + (dx / d) * step,
          nz = npc.pos.z + (dz / d) * step;
        // Hard local solids remain authoritative during special-state walks.
        // Sliding around a circle prevents the direct seek from cutting tents.
        this.registry.collidersNear(nx, nz, 0.3, (e) => {
          if (!npc.campBed && npc.campAtApproach && e === slot.collider) return;
          const r = (e.collider?.radius || 0) + 0.28;
          if (r <= 0.28) return;
          const ox = nx - e.position.x,
            oz = nz - e.position.z,
            od = Math.hypot(ox, oz);
          if (od < r) {
            const a =
              Math.atan2(oz || dz, ox || dx) +
              (step / r) * (npc.idx % 2 ? 1 : -1);
            nx = e.position.x + Math.cos(a) * r;
            nz = e.position.z + Math.sin(a) * r;
          }
        });
        // Sequential projections can push into a second solid; reject any
        // unresolved overlap rather than teleporting through a tight cluster.
        let blocked = false;
        this.registry.collidersNear(nx, nz, 0.3, (e) => {
          if (!npc.campBed && npc.campAtApproach && e === slot.collider) return;
          const r = (e.collider?.radius || 0) + 0.28;
          if (
            r > 0.28 &&
            Math.hypot(nx - e.position.x, nz - e.position.z) < r - 0.001
          )
            blocked = true;
        });
        if (blocked) {
          nx = npc.pos.x;
          nz = npc.pos.z;
        }
        npc.vel.set(
          (nx - npc.pos.x) / Math.max(dt, 0.001),
          0,
          (nz - npc.pos.z) / Math.max(dt, 0.001),
        );
        npc.pos.x = nx;
        npc.pos.z = nz;
        npc.yaw +=
          wrapAngle(Math.atan2(-dx, -dz) - npc.yaw) * Math.min(1, dt * 6);
      }
    } else npc.vel.set(0, 0, 0);
    this._writeMatrices(npc);
    return true;
  }
}
