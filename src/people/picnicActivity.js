// Picnic selection and motion retain their own policy; the place owns seats,
// and the population commits a claim-checked seated/approach display profile.
const reservations = new WeakMap();
const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const lerp = (a, b, t) => (1 - t) * a + t * b;
export class PicnicActivity {
  constructor(people, registry, { random = () => Math.random() } = {}) {
    this.people = people;
    this.registry = registry;
    this.random = random;
    this.activityKey = 'picnic';
    this.records = new Map();
    this.disposed = false;
    this.view = {};
  }
  has(handle) {
    return this.records.has(handle);
  }
  valid(r) {
    return (
      this.registry.entries.get(r.entry.id) === r.entry &&
      r.entry.tableSeats?.includes(r.seat) &&
      r.seat.occupied &&
      reservations.get(r.seat) === r.reservation
    );
  }
  tryClaim(handle) {
    if (
      this.disposed ||
      !this.people.readPicnicMotion(handle, this.view) ||
      this.view.claimed ||
      !this.people.canUsePicnic(handle)
    )
      return false;
    let best = null,
      seat = null,
      bestD2 = this.view.grouped ? 18 * 18 : 45 * 45;
    for (const id of this.registry.byKind.get('picnic_table') ?? []) {
      const e = this.registry.entries.get(id);
      if (!e?.tableSeats) continue;
      const dx = e.position.x - this.view.x,
        dz = e.position.z - this.view.z,
        d2 = dx * dx + dz * dz;
      if (d2 >= bestD2) continue;
      const free = e.tableSeats.find(
        (s) => !s.occupied && !reservations.has(s)
      );
      if (free) {
        bestD2 = d2;
        best = e;
        seat = free;
      }
    }
    if (!best) return false;
    const record = {
      entry: best,
      seat,
      reservation: { person: handle },
      claim: null,
      step: {}
    };
    const claim = this.people.claimActivity(
      handle,
      {
        owner: this,
        prepare: (attempt) => {
          if (
            this.registry.entries.get(best.id) !== best ||
            !best.tableSeats.includes(seat) ||
            seat.occupied ||
            reservations.has(seat)
          )
            return false;
          reservations.set(seat, record.reservation);
          seat.occupied = true;
          attempt.own(() => {
            if (reservations.get(seat) === record.reservation) {
              reservations.delete(seat);
              seat.occupied = false;
            }
          });
          return true;
        },
        release: (current) => {
          if (this.records.get(handle)?.claim === current)
            this.records.delete(handle);
          this.people.releasePicnicPose(current);
        }
      },
      { preserveMotion: true }
    );
    if (!claim) return false;
    record.claim = claim;
    this.records.set(handle, record);
    if (this.disposed) {
      this.people.endPersonActivity(claim);
      return false;
    }
    const s = this.readStep(record, handle);
    if (!s) {
      this.release(handle);
      return false;
    }
    s.phase = 'approach';
    s.targetX = seat.x;
    s.targetY = 0;
    s.targetZ = seat.z;
    const d = Math.hypot(seat.x - s.x, seat.z - s.z);
    s.stateTimer = Math.min(62, Math.max(14, d * 1.4 + 5));
    return this.people.commitPicnicMotion(claim, s);
  }
  readStep(r, h) {
    const s = r.step;
    if (!this.people.readPicnicMotion(h, s)) return null;
    s.phase = s.state === 'table_seated' ? 'seated' : 'approach';
    s.publish = false;
    return s;
  }
  tickWalking(dt, handle) {
    const r = this.records.get(handle);
    if (!r) return false;
    const s = this.readStep(r, handle);
    if (!s || s.phase !== 'approach') return false;
    if (!this.valid(r))
      return this.finish(r, s, { stateTimer: 1, publish: true });
    const seat = r.seat,
      dx = seat.x - s.x,
      dz = seat.z - s.z,
      d = Math.hypot(dx, dz);
    if (d < 0.4) {
      s.x = seat.x;
      s.z = seat.z;
      s.heading = Math.atan2(
        seat.x - r.entry.position.x,
        seat.z - r.entry.position.z
      );
      s.vx = 0;
      s.vy = 0;
      s.vz = 0;
      s.phase = 'seated';
      s.picnicY = seat.y;
      s.rideTimer = 18 + this.random() * 30;
      s.publish = true;
    } else if (s.stateTimer <= 0)
      return this.finish(r, s, { stateTimer: 1, publish: false });
    else {
      const inv = 1 / (d || 1);
      s.vx = lerp(s.vx, dx * inv * 1.9 * s.energy, Math.min(1, dt * 5));
      s.vz = lerp(s.vz, dz * inv * 1.9 * s.energy, Math.min(1, dt * 5));
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.heading +=
        wrapAngle(Math.atan2(-s.vx, -s.vz) - s.heading) * Math.min(1, dt * 6);
      s.publish = true;
    }
    return this.people.commitPicnicMotion(r.claim, s);
  }
  tickSeated(dt, handle) {
    const r = this.records.get(handle);
    if (!r) return false;
    const s = this.readStep(r, handle);
    if (!s || s.phase !== 'seated') return false;
    if (!this.valid(r))
      return this.finish(r, s, { stateTimer: 1, publish: true });
    // Preserve the legacy activity decrement after Crowd's frame prelude.
    s.rideTimer -= dt;
    s.x = r.seat.x;
    s.z = r.seat.z;
    s.heading = Math.atan2(
      r.seat.x - r.entry.position.x,
      r.seat.z - r.entry.position.z
    );
    s.vx = 0;
    s.vy = 0;
    s.vz = 0;
    s.picnicY = r.seat.y;
    s.publish = true;
    if (s.rideTimer <= 0)
      return this.finish(r, s, {
        stateTimer: 1 + this.random() * 2,
        x: s.x + (this.random() - 0.5) * 0.8,
        z: s.z + (this.random() - 0.5) * 0.8,
        publish: true
      });
    return this.people.commitPicnicMotion(r.claim, s);
  }
  finish(r, s, exit) {
    Object.assign(s, exit, { phase: 'idle', picnicY: undefined });
    return this.people.finishPicnicMotion(r.claim, s);
  }
  release(handle, reason = 'rest-interrupted') {
    const r = this.records.get(handle);
    return r ? this.people.endPersonActivity(r.claim, { reason }) : false;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const errors = [];
    for (const h of this.records.keys())
      try {
        this.release(h, 'picnic-disposed');
      } catch (error) {
        errors.push(error);
      }
    if (errors.length)
      throw new AggregateError(errors, 'Picnic activity cleanup failed.');
  }
}
