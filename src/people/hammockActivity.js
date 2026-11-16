// Activity intent and reservations use public person commands. The population
// retains record storage and applies only this activity's validated pose profile.
const reservations = new WeakMap();
// An ambient visitor should be visibly approaching before tying up a seat.
const AMBIENT_CLAIM_RADIUS = 6;
const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const lerp = (a, b, t) => (1 - t) * a + t * b;
export class HammockActivity {
  constructor(people, registry, { random = () => Math.random() } = {}) {
    this.people = people;
    this.registry = registry;
    this.random = random;
    this.activityKey = 'hammock';
    this.records = new Map();
    this.disposed = false;
    this.view = {};
  }
  has(handle) {
    return this.records.has(handle);
  }
  valid(record) {
    return (
      this.registry.entries.get(record.entry.id) === record.entry &&
      record.entry.hammock === record.resource &&
      record.resource.occupied &&
      reservations.get(record.resource) === record.reservation
    );
  }
  reserveArrival(handle, entry) {
    const resource = entry?.hammock;
    if (this.disposed || !resource || this.registry.entries.get(entry.id) !== entry || resource.occupied || reservations.has(resource)) return null;
    const ticket = { person: handle, entry, resource };
    reservations.set(resource, ticket);
    resource.occupied = true;
    resource.approaching = true;
    return ticket;
  }
  releaseArrival(ticket) {
    if (!ticket || reservations.get(ticket.resource) !== ticket) return false;
    reservations.delete(ticket.resource);
    ticket.resource.occupied = false;
    ticket.resource.approaching = false;
    return true;
  }
  tryClaim(handle, ticket = null) {
    if (
      this.disposed ||
      !this.people.readHammockMotion(handle, this.view) ||
      this.view.claimed ||
      this.view.grouped ||
      !['idle', 'walking'].includes(this.view.state)
    )
      return false;
    let best = ticket?.entry ?? null,
      bestD2 = AMBIENT_CLAIM_RADIUS * AMBIENT_CLAIM_RADIUS;
    for (const id of ticket ? [] : this.registry.byKind.get('hammock') ?? []) {
      const entry = this.registry.entries.get(id);
      if (
        !entry?.hammock ||
        entry.hammock.occupied ||
        reservations.has(entry.hammock)
      )
        continue;
      const dx = entry.position.x - this.view.x,
        dz = entry.position.z - this.view.z,
        d2 = dx * dx + dz * dz;
      if(d2>=bestD2)continue;
      if(this.people.canReachPlace&&!this.people.canReachPlace(handle,entry.position))continue;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = entry;
      }
    }
    if (!best) return false;
    const record = {
      entry: best,
      resource: best.hammock,
      reservation: { person: handle },
      delivery: !!ticket,
      route: ticket?.route ?? null,
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
            best.hammock !== record.resource ||
            (ticket ? ticket.person !== handle || reservations.get(record.resource) !== ticket : record.resource.occupied || reservations.has(record.resource))
          )
            return false;
          reservations.set(record.resource, record.reservation);
          record.resource.occupied = true;
          record.resource.approaching = true;
          attempt.own(() => {
            if (reservations.get(record.resource) === record.reservation) {
              reservations.delete(record.resource);
              record.resource.occupied = false;
              record.resource.approaching = false;
            }
          });
          return true;
        },
        release: (current) => {
          if (this.records.get(handle)?.claim === current)
            this.records.delete(handle);
          this.people.releaseHammockPose(current);
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
    const step = this.readStep(record, handle);
    if (!step) {
      this.release(handle);
      return false;
    }
    Object.assign(step, {
      phase: 'approach',
      targetX: best.position.x,
      targetY: best.position.y,
      targetZ: best.position.z,
      stateTimer: ticket ? 60 : 18,
      publish: false
    });
    const committed = this.people.commitHammockMotion(claim, step);
    if (!committed) this.release(handle, 'approach-rejected');
    return committed;
  }
  readStep(record, handle) {
    const s = record.step;
    if (!this.people.readHammockMotion(handle, s)) return null;
    s.phase = s.state === 'hammock_riding' ? 'swing' : 'approach';
    s.publish = false;
    return s;
  }
  tickWalking(dt, handle) {
    const record = this.records.get(handle);
    if (!record) return false;
    const s = this.readStep(record, handle);
    if (!s || s.phase !== 'approach') return false;
    if (!this.valid(record))
      return this.finish(record, s, { stateTimer: 1, publish: true });
    if (record.route?.length) {
      while (record.route.length > 1 && Math.hypot(record.route[0].x - s.x, record.route[0].z - s.z) < .08) record.route.shift();
      const target = record.route[0], distance = Math.hypot(target.x - s.x, target.z - s.z);
      if (distance > .05) {
        const stride = Math.min(distance, dt * 1.6 * s.energy);
        const next = { x: s.x + (target.x - s.x) / distance * stride, z: s.z + (target.z - s.z) / distance * stride };
        if (s.stateTimer <= 0 || !this.people.questActivityStepClear(handle, s, next)) return this.finish(record, s, { stateTimer: 1, publish: true });
        s.vx = (next.x - s.x) / dt; s.vz = (next.z - s.z) / dt;
        s.x = next.x; s.z = next.z; s.heading = Math.atan2(-s.vx, -s.vz); s.publish = true;
        if (!this.people.commitHammockMotion(record.claim, s)) this.release(handle, 'quest-path-blocked');
        return true;
      }
      record.route = null;
    }
    const target = record.resource.seatPos,
      dx = target.x - s.x,
      dz = target.z - s.z,
      d = Math.hypot(dx, dz);
    if (d < 0.7) {
      s.phase = 'swing';
      record.resource.approaching = false;
      s.rideTimer = 12 + this.random() * 18;
      s.hammockBob = 0;
      if (record.delivery) {
        s.x = record.resource.seatPos.x; s.z = record.resource.seatPos.z;
        s.hammockY = record.resource.seatPos.y;
        s.heading = Math.PI / 2 - record.resource.yaw;
        s.vx = 0; s.vy = 0; s.vz = 0; s.publish = true;
      }
    } else if (s.stateTimer <= 0)
      return this.finish(record, s, { stateTimer: 1, publish: false });
    else {
      const inv = 1 / (d || 1);
      s.vx = lerp(s.vx, dx * inv * 1.6 * s.energy, Math.min(1, dt * 5));
      s.vz = lerp(s.vz, dz * inv * 1.6 * s.energy, Math.min(1, dt * 5));
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      const yaw = Math.atan2(-s.vx, -s.vz);
      s.heading += wrapAngle(yaw - s.heading) * Math.min(1, dt * 6);
      s.publish = true;
    }
    const committed = this.people.commitHammockMotion(record.claim, s);
    if (!committed) this.release(handle, 'approach-blocked');
    return committed;
  }
  tickRiding(dt, handle) {
    const record = this.records.get(handle);
    if (!record) return false;
    const s = this.readStep(record, handle);
    if (!s || s.phase !== 'swing') return false;
    if (!this.valid(record))
      return this.finish(record, s, { stateTimer: 1, publish: true });
    const h = record.resource;
    // Crowd's accepted-frame prelude already decremented this timer once.
    // Preserve the second legacy decrement during this ownership migration.
    s.rideTimer -= dt;
    s.hammockBob += dt * 2.2;
    const sway = Math.sin(s.hammockBob) * 0.18;
    s.x = h.seatPos.x - Math.sin(h.yaw) * sway;
    s.z = h.seatPos.z + Math.cos(h.yaw) * sway;
    s.hammockY = h.seatPos.y + Math.sin(s.hammockBob * 2) * 0.04;
    s.heading = Math.PI / 2 - h.yaw;
    s.vx = 0;
    s.vy = 0;
    s.vz = 0;
    s.publish = true;
    if (s.rideTimer <= 0)
      return this.finish(record, s, {
        stateTimer: 1 + this.random() * 2,
        x: s.x + (this.random() - 0.5) * 0.8,
        z: s.z + (this.random() - 0.5) * 0.8,
        publish: true
      });
    const committed = this.people.commitHammockMotion(record.claim, s);
    if (!committed) this.release(handle, 'rest-support-lost');
    return committed;
  }
  finish(record, step, exit) {
    Object.assign(step, exit, { phase: 'idle', hammockY: undefined });
    const finished = this.people.finishHammockMotion(record.claim, step);
    if (!finished) this.release(record.claim.person, 'rest-exit-blocked');
    return finished;
  }
  release(handle, reason = 'rest-interrupted') {
    const record = this.records.get(handle);
    return record
      ? this.people.endPersonActivity(record.claim, { reason })
      : false;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const errors = [];
    for (const handle of this.records.keys())
      try {
        this.release(handle, 'hammock-disposed');
      } catch (error) {
        errors.push(error);
      }
    if (errors.length)
      throw new AggregateError(errors, 'Hammock activity cleanup failed.');
  }
}
