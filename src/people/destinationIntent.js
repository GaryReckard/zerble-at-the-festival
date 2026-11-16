// A completed ride borrows walking authority briefly, then returns the person
// to the existing venue owners. It never grants rewards or invents venue props.
const WATCH = new Set(['main_stage', 'side_stage', 'tent_stage', 'drum_circle']);
const KINDS = {
  main_stage: ['stage_front'], side_stage: ['stage_front'], tent_stage: ['stage_front'],
  drum_circle: ['drum_circle', 'forest_drum_circle'], food_court: ['picnic_table', 'picnic'],
  vendor_row: ['tent'], camp_village: ['campsite'], beach: ['beach'],
  healing_arts: ['healing_arts'], arch: ['arch'], mountaintop: ['campsite'],
};

export class DestinationIntent {
  constructor(people, registry, {maxActive = 3, getTime = () => .25} = {}) {
    this.people = people; this.registry = registry; this.getTime = getTime;
    this.maxActive = Math.max(1, Math.min(10, maxActive));
    this.records = new Map(); this.disposed = false; this.activityKey = 'destination-intent';
    this.view = {}; this.ground = {};
  }
  start(handle, quest) {
    if (this.disposed || this.records.has(handle) || this.records.size >= this.maxActive ||
        !KINDS[quest?.kind] || !Number.isFinite(quest.x) || !Number.isFinite(quest.z) ||
        !this.people.readPerson(handle, this.view) || this.view.grouped || this.view.claimed ||
        this.view.seated || this.view.hidden || Math.hypot(quest.x - this.view.x, quest.z - this.view.z) > 60) return false;
    this.records.set(handle, {handle, kind: quest.kind, x: quest.x, z: quest.z,
      age: 0, wait: 2.6, dwell: 0, claim: null, target: null, entry: null});
    return true;
  }
  groundPoint(handle, x, z) {
    const ground = this.people.sampleActivityGround?.(handle, x, z, this.ground);
    if (!ground || !ground.valid || !ground.traversable || !Number.isFinite(ground.height)) return null;
    let blocked = false;
    this.registry.collidersNear(x, z, .35, entry => {
      if (Math.hypot(x - entry.position.x, z - entry.position.z) < entry.collider.radius + .35) blocked = true;
    });
    return blocked ? null : {x, y: ground.height, z};
  }
  clearLine(handle, from, to) {
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .5));
    for (let i = 1; i <= steps; i++) {
      if (!this.groundPoint(handle, from.x + (to.x - from.x) * i / steps,
        from.z + (to.z - from.z) * i / steps)) return false;
    }
    return true;
  }
  select(record, from) {
    const entries = [];
    for (const kind of KINDS[record.kind]) for (const id of this.registry.byKind.get(kind) ?? []) {
      const e = this.registry.entries.get(id);
      if (!e || Math.hypot(e.position.x - record.x, e.position.z - record.z) > 35) continue;
      if (record.kind === 'vendor_row' && (!e.vendor?.userData.market?.open || e.vendor.userData.market.customer)) continue;
      entries.push(e);
    }
    entries.sort((a, b) => Math.hypot(a.position.x - record.x, a.position.z - record.z) -
      Math.hypot(b.position.x - record.x, b.position.z - record.z));
    // Missing live venues must not turn a stale plan into a walk through scenery.
    if (!entries.length && record.kind !== 'mountaintop') return false;
    for (const entry of entries.slice(0, 8).concat(entries.length ? [] : [null])) {
      let x = entry?.position.x ?? record.x, z = entry?.position.z ?? record.z;
      if (record.kind === 'vendor_row') {
        const yaw = entry.vendor.rotation.y;
        x += Math.sin(yaw) * 3.2; z += Math.cos(yaw) * 3.2;
      }
      for (const radius of record.kind === 'vendor_row' ? [0] : [0, 2, 4, 6]) {
        for (let i = 0; i < (radius ? 8 : 1); i++) {
          const tx = x + Math.cos(i * Math.PI / 4) * radius;
          const tz = z + Math.sin(i * Math.PI / 4) * radius;
          if (Math.hypot(tx - from.x, tz - from.z) > 45) continue;
          const target = this.groundPoint(record.handle, tx, tz);
          if (!target || !this.clearLine(record.handle, from, target)) continue;
          record.target = target; record.entry = entry; return true;
        }
      }
    }
    return false;
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt < 0 || dt > .05) throw new RangeError('Destination intent requires accepted frame delta.');
    if (this.disposed) return;
    for (const record of this.records.values()) {
      try { this.step(record, dt); }
      catch (error) { this.stop(record, 'destination-failed'); throw error; }
    }
  }
  step(record, dt) {
    const {handle} = record;
    record.age += dt;
    if (record.age > 32 || !this.people.readPerson(handle, this.view) ||
        (record.entry && this.registry.entries.get(record.entry.id) !== record.entry)) {
      this.stop(record, 'destination-unavailable'); return;
    }
    if (!record.claim) {
      if (this.view.claimed || this.view.grouped || this.view.hidden || this.view.seated ||
          ['riding', 'boarding', 'disembarking', 'fleeing'].includes(this.view.state)) {
        this.stop(record, 'destination-interrupted'); return;
      }
      record.wait -= dt;
      if (record.wait > 0) return;
      if (!['idle', 'walking', 'watching', 'smiling'].includes(this.view.state) || !this.select(record, this.view)) {
        this.stop(record, 'destination-unreachable'); return;
      }
      record.claim = this.people.claimActivity(handle, {owner: this,
        release: () => { this.records.delete(handle); record.claim = null; }});
      if (!record.claim) this.records.delete(handle);
      return;
    }
    const dx = record.target.x - this.view.x, dz = record.target.z - this.view.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= .15) {
      record.dwell += dt;
      // Hold the intended gathering point briefly before releasing to ordinary
      // venue behavior, so an unsupported owner does not cause an instant U-turn.
      if (record.dwell < 3) {
        if (!this.people.writeActivityPose(record.claim, this.view.x, this.view.y, this.view.z, null, null, 0))
          this.stop(record, 'destination-interrupted');
        return;
      }
      this.stop(record, 'destination-arrived');
      if (WATCH.has(record.kind)) this.people.invitePersonToWatch(handle);
      else if (record.kind === 'food_court') this.people.picnics?.tryClaim(handle);
      else if (record.kind === 'vendor_row') this.people.markets?.tryVisit(handle, record.entry, this.getTime());
      else if (record.kind === 'camp_village' || record.kind === 'mountaintop') {
        this.people.camps?.setCooldown(handle, 0);
        this.people.camps?.tick(0, handle, this.getTime());
      }
      return;
    }
    const stride = Math.min(distance, dt * 2);
    const point = this.groundPoint(handle, this.view.x + dx / distance * stride, this.view.z + dz / distance * stride);
    if (!point || !this.people.writeActivityPose(record.claim, point.x, point.y, point.z,
      Math.atan2(-dx, -dz), null, dt)) this.stop(record, 'destination-blocked');
  }
  stop(record, reason) {
    this.records.delete(record.handle);
    if (record.claim) this.people.endPersonActivity(record.claim, {reason});
    record.claim = null;
  }
  clear() {
    const errors = [];
    for (const record of this.records.values()) try { this.stop(record, 'destination-cleared'); } catch (error) { errors.push(error); }
    this.records.clear();
    if (errors.length) throw new AggregateError(errors, 'Destination intent cleanup failed.');
  }
  dispose() { this.disposed = true; this.clear(); }
}
