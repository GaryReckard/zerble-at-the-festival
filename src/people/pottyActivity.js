// The person claim covers the whole errand; a unit is reserved only on arrival,
// preserving occupied-door discovery. Motion caches contain copied values, never
// population records. Unit ownership validates the full handle/claim incarnation.
import {
  STINK_DUR,
  POTTY_DOOR_STAND,
  POTTY_SEAT_BACK,
  POTTY_SEAT_Y,
} from "../models/portaPotty.js";
const POTTY_SEARCH_R2 = 90 * 90,
  POTTY_USE_MIN = 6,
  POTTY_USE_MAX = 13,
  POTTY_LOCK_CHANCE = 0.7;
const occupants = new WeakMap();
const OCCUPYING_STATES = new Set([
  "entering_potty",
  "using_potty",
  "exiting_potty",
]);
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
const lerp = (a, b, t) => (1 - t) * a + t * b;
const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export class PottyActivity {
  constructor(people, registry, { random = () => Math.random() } = {}) {
    this.people = people;
    this.registry = registry;
    this.random = random;
    this.activityKey = "bathroom";
    this.records = new Map();
    this.disposed = false;
    this.occupantView = {};
  }
  has(handle) {
    return this.records.has(handle);
  }
  _setEntry(s, entry) {
    s.pottyEntry = entry;
    s.pottyResource = entry?.potty ?? null;
  }
  tryClaim(handle) {
    if (this.disposed || !this.people.canUsePotty(handle)) return false;
    const motion = {
      person: handle,
      idx: handle.slot,
      pos: vector(),
      vel: vector(),
      target: vector(),
      pottyEntry: null,
      pottyTried: null,
      pottyWait: 0,
      useTimer: 0,
      pottyPeeked: 0,
      pottySitting: false,
      exitPhase: 0,
      publication: null,
    };
    if (!this.people.readPottyMotion(handle, motion) || motion.claimed)
      return false;
    const entry = this._findNearestPotty(motion, null);
    if (!entry) return false;
    const record = { motion, claim: null, occupied: null };
    const claim = this.people.claimActivity(
      handle,
      {
        owner: this,
        release: (current) => {
          const owned = this.records.get(handle);
          if (owned?.claim !== current) return;
          owned.motion.ownedOccupancy = owned.occupied;
          this.records.delete(handle);
          this._releasePotty(owned.motion);
          this.people.releasePottyPose(current);
        },
      },
      { preserveMotion: true },
    );
    if (!claim) return false;
    record.claim = claim;
    motion.claim = claim;
    this.records.set(handle, record);
    if (this.disposed) {
      this.people.endPersonActivity(claim);
      return false;
    }
    this._setEntry(motion, entry);
    motion.pottyTried = [entry.id];
    motion.state = "seeking_potty";
    motion.stateTimer = 30;
    return this.people.commitPottyMotion(claim, motion);
  }
  _claimOccupancy(s) {
    const p = s.pottyEntry?.potty,
      r = this.records.get(s.person);
    if (
      !r ||
      r.claim !== s.claim ||
      this._pottyEntryGone(s) ||
      p.occupied ||
      occupants.has(p)
    )
      return false;
    const reservation = {
      activity: this,
      person: s.person,
      claim: s.claim,
      resource: p,
      entry: s.pottyEntry,
    };
    occupants.set(p, reservation);
    r.occupied = reservation;
    p.occupied = true;
    p.occupantId = s.person.slot;
    return true;
  }
  _ownsOccupancy(s) {
    const owned = this.records.get(s.person)?.occupied;
    return (
      !!owned &&
      owned.claim === s.claim &&
      owned.resource === s.pottyResource &&
      occupants.get(owned.resource) === owned
    );
  }
  _releaseOccupancy(s, { stink = false } = {}) {
    const r = this.records.get(s.person),
      owned = r?.occupied ?? s.ownedOccupancy;
    if (!owned || occupants.get(owned.resource) !== owned) return false;
    occupants.delete(owned.resource);
    const p = owned.resource;
    p.occupied = false;
    p.occupantId = null;
    p.locked = false;
    p.doorTarget = 0;
    if (stink) p.stinkTimer = STINK_DUR;
    if (r) r.occupied = null;
    s.ownedOccupancy = null;
    return true;
  }
  _notifyPeek(p) {
    const owned = occupants.get(p),
      r = owned?.activity.records.get(owned.person);
    if (
      r?.claim === owned.claim &&
      owned.activity.people.readPerson(owned.person, this.occupantView) &&
      this.occupantView.state === "using_potty"
    )
      r.motion.pottyPeeked = 1.2;
  }
  _writeMatrices(s) {
    s.publication = "show";
  }
  _hideNpc(s) {
    s.publication = "hide";
  }
  tick(dt, handle) {
    const r = this.records.get(handle);
    if (this.disposed || !r || !this.people.readPottyMotion(handle, r.motion))
      return false;
    const s = r.motion;
    s.publication = null;
    const method = POTTY_TICKS[s.state];
    if (!method) return false;
    this[method](dt, s);
    return this._commit(r);
  }
  _commit(r) {
    const s = r.motion;
    if (!POTTY_TICKS[s.state]) return this.people.finishPottyMotion(r.claim, s);
    return this.people.commitPottyMotion(r.claim, s);
  }
  release(handle, reason = "rest-interrupted") {
    const r = this.records.get(handle);
    if (!r) return false;
    r.motion.ownedOccupancy = r.occupied;
    return this.people.endPersonActivity(r.claim, { reason });
  }
  onHit(entry) {
    if (
      this.disposed ||
      !entry?.potty?.occupied ||
      this.registry.entries.get(entry.id) !== entry
    )
      return false;
    const p = entry.potty,
      owned = occupants.get(p),
      r = owned?.activity.records.get(owned.person);
    if (
      r?.claim === owned.claim &&
      owned.entry === entry &&
      owned.activity.people.readPottyMotion(owned.person, r.motion)
    ) {
      const s = r.motion;
      s.pos.x = entry.position.x + p.outX;
      s.pos.z = entry.position.z + p.outZ;
      owned.activity._releasePotty(s);
      s.state = "fleeing";
      s.stateTimer = 3;
      s.publication = null;
      owned.activity._commit(r);
    }
    p.occupied = false;
    p.occupantId = null;
    p.locked = false;
    p.doorTarget = 1;
    p.stinkTimer = STINK_DUR;
    return true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const errors = [];
    for (const h of this.records.keys())
      try {
        this.release(h, "bathroom-disposed");
      } catch (error) {
        errors.push(error);
      }
    if (errors.length)
      throw new AggregateError(errors, "Bathroom activity cleanup failed.");
  }
  _findNearestPotty(npc, tried) {
    const ids = this.registry.byKind.get("porta_potty");
    if (!ids) return null;
    let best = null,
      bestD2 = npc.grouped ? 22 * 22 : POTTY_SEARCH_R2;
    for (const id of ids) {
      if (tried && tried.includes(id)) continue;
      const e = this.registry.entries.get(id);
      if (!e || !e.potty) continue;
      const dx = e.position.x - npc.pos.x;
      const dz = e.position.z - npc.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }

  // Free a porta-potty this NPC had claimed + reset its potty bookkeeping.
  _releasePotty(npc) {
    this._releaseOccupancy(npc);
    npc.pottyEntry = null;
    npc.pottyResource = null;
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
    npc.state = "idle";
    npc.stateTimer = 1 + this.random() * 2;
  }

  // Common guard: the targeted entry vanished (chunk unloaded) → bail cleanly.
  _pottyEntryGone(npc) {
    const e = npc.pottyEntry;
    return (
      !e ||
      this.registry.entries.get(e.id) !== e ||
      e.potty !== npc.pottyResource ||
      (OCCUPYING_STATES.has(npc.state) && !this._ownsOccupancy(npc))
    );
  }

  _tickSeekingPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) {
      this._abortPotty(npc);
      this._writeMatrices(npc);
      return;
    }
    if (npc.stateTimer <= 0) {
      this._abortPotty(npc);
      this._writeMatrices(npc);
      return;
    }
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
      npc.vel.x = lerp(npc.vel.x, tdx * inv * speed, Math.min(1, dt * 5));
      npc.vel.z = lerp(npc.vel.z, tdz * inv * speed, Math.min(1, dt * 5));
      npc.pos.x += npc.vel.x * dt;
      npc.pos.z += npc.vel.z * dt;
      const yaw = Math.atan2(-npc.vel.x, -npc.vel.z);
      npc.yaw += wrapAngle(yaw - npc.yaw) * Math.min(1, dt * 6);
      this._writeMatrices(npc);
      return;
    }

    // Arrived at the door. Face into the unit (toward the door = -outward).
    npc.vel.set(0, 0, 0);
    npc.yaw +=
      wrapAngle(Math.atan2(p.outX, p.outZ) - npc.yaw) * Math.min(1, dt * 8);

    if (!p.occupied) {
      // Vacant → go in. Roll whether the occupant will lock the door behind them.
      if (!this._claimOccupancy(npc)) {
        this._writeMatrices(npc);
        return;
      }
      p.locked = this.random() < POTTY_LOCK_CHANCE;
      p.doorTarget = 1;
      npc.state = "entering_potty";
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
      this._notifyPeek(p); // pop into the doorway, startled
      npc.state = "surprised_potty";
      npc.stateTimer = 1.3;
      npc.cheerTimer = 1.3; // arms-up startle pose (decayed inside the tick)
      this._writeMatrices(npc);
      return;
    }

    // Occupied + locked → wait a beat, then head to the next closest.
    npc.pottyWait = (npc.pottyWait || 0) + dt;
    if (npc.pottyWait < 2.5 && this.random() < 0.6) {
      this._writeMatrices(npc);
      return;
    }
    npc.pottyWait = 0;
    if (!npc.pottyTried) npc.pottyTried = [];
    if (!npc.pottyTried.includes(e.id)) npc.pottyTried.push(e.id);
    const next = this._findNearestPotty(npc, npc.pottyTried);
    if (next) {
      this._setEntry(npc, next);
      npc.stateTimer = 30;
    } else {
      this._abortPotty(npc);
    }
    this._writeMatrices(npc);
  }

  _tickEnteringPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) {
      this._abortPotty(npc);
      this._writeMatrices(npc);
      return;
    }
    const e = npc.pottyEntry;
    const p = e.potty;

    const cx = e.position.x,
      cz = e.position.z;
    const tdx = cx - npc.pos.x,
      tdz = cz - npc.pos.z;
    const td = Math.hypot(tdx, tdz);

    if (td > 0.25 && npc.stateTimer > 0) {
      // Step in only once the door's actually open.
      if (p.doorOpen > 0.5) {
        const inv = 1 / (td || 1);
        const speed = 1.1 * npc.energy;
        npc.vel.x = lerp(npc.vel.x, tdx * inv * speed, Math.min(1, dt * 6));
        npc.vel.z = lerp(npc.vel.z, tdz * inv * speed, Math.min(1, dt * 6));
        npc.pos.x += npc.vel.x * dt;
        npc.pos.z += npc.vel.z * dt;
      }
      npc.yaw +=
        wrapAngle(Math.atan2(p.outX, p.outZ) - npc.yaw) * Math.min(1, dt * 8);
      this._writeMatrices(npc);
      return;
    }

    // Inside — snap to centre, shut the door, hide, start the visit.
    npc.pos.x = cx;
    npc.pos.z = cz;
    npc.vel.set(0, 0, 0);
    p.doorTarget = 0;
    npc.state = "using_potty";
    npc.useTimer =
      POTTY_USE_MIN + this.random() * (POTTY_USE_MAX - POTTY_USE_MIN);
    this._hideNpc(npc);
  }

  _tickUsingPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) {
      this._unhideAbort(npc);
      return;
    }
    const e = npc.pottyEntry;
    const p = e.potty;

    // Someone yanked the (unlocked) door open — caught sitting on the toilet,
    // startled (arms up), facing the intruder, for a beat. Then they recover and
    // duck back to invisible-inside and carry on.
    if (npc.pottyPeeked > 0) {
      npc.pottyPeeked -= dt;
      npc.pottySitting = true;
      npc.cheerTimer = Math.max(0, npc.pottyPeeked); // arms-up "EEP!" pose
      npc.seatY = POTTY_SEAT_Y;
      npc.pos.x = e.position.x - p.outX * POTTY_SEAT_BACK; // on the toilet (back of unit)
      npc.pos.z = e.position.z - p.outZ * POTTY_SEAT_BACK;
      npc.yaw = Math.atan2(-p.outX, -p.outZ); // face the door/intruder
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
      p.doorTarget = 1; // open up to leave
      npc.state = "exiting_potty";
      npc.stateTimer = 5;
      npc.exitPhase = 0;
    }
  }

  _tickExitingPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) {
      this._unhideAbort(npc);
      return;
    }
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
      npc.yaw = Math.atan2(-p.outX, -p.outZ); // face outward (away)
      this._releaseOccupancy(npc, { stink: true });
      const r = 3 + this.random() * 3;
      npc.target.set(
        e.position.x + p.outX * r + (this.random() - 0.5) * 2,
        0,
        e.position.z + p.outZ * r + (this.random() - 0.5) * 2,
      );
      npc.pottyEntry = null;
      npc.pottyTried = null;
      npc.pottyWait = 0;
      npc.state = "walking"; // actively walk away from the door (frees it for the next user)
      npc.stateTimer = 6;
      this._writeMatrices(npc);
    }
  }

  _tickSurprisedPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) {
      this._abortPotty(npc);
      this._writeMatrices(npc);
      return;
    }
    npc.stateTimer -= dt;
    npc.cheerTimer = Math.max(0, npc.stateTimer); // arms-up pose tracks the recoil
    const e = npc.pottyEntry;
    const p = e && e.potty;
    if (p) {
      npc.yaw +=
        wrapAngle(Math.atan2(p.outX, p.outZ) - npc.yaw) * Math.min(1, dt * 8);
      const sp = 2.6 * npc.energy;
      npc.vel.x = lerp(npc.vel.x, p.outX * sp, Math.min(1, dt * 8));
      npc.vel.z = lerp(npc.vel.z, p.outZ * sp, Math.min(1, dt * 8));
      npc.pos.x += npc.vel.x * dt;
      npc.pos.z += npc.vel.z * dt;
    }
    if (npc.stateTimer <= 0) {
      npc.cheerTimer = 0;
      if (p) p.doorTarget = 0; // slam it shut
      const next = this._findNearestPotty(npc, npc.pottyTried || []);
      if (next) {
        this._setEntry(npc, next);
        npc.state = "seeking_potty";
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
    npc.state = "idle";
    npc.stateTimer = 1 + this.random() * 2;
    this._writeMatrices(npc);
  }
}
const POTTY_TICKS = Object.freeze({
  seeking_potty: "_tickSeekingPotty",
  entering_potty: "_tickEnteringPotty",
  using_potty: "_tickUsingPotty",
  exiting_potty: "_tickExitingPotty",
  surprised_potty: "_tickSurprisedPotty",
});
