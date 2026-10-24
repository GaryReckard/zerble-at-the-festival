import { registry } from './registry.js';
import { Sound } from './sound.js';
import { buildCampInstrument, updateCampInstrument } from './models/campInstruments.js';

const KINDS = ['guitar', 'banjo', 'bass', 'fiddle', 'mandolin'];
const ELIGIBLE = new Set(['idle', 'walking', 'camp_seated']);
const angleDelta = value => Math.atan2(Math.sin(value), Math.cos(value));
function hash(n) { n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return (n ^ n >>> 16) >>> 0; }

// This is an activity controller, not another crowd renderer or audio clock.
// Claims belong to jobs and are released in one place on every interruption.
export class CampJamActivity {
  constructor(crowd) {
    this.crowd = crowd;
    this.sessions = [];
    this.cooldowns = new Map();
    this.clock = 0;
    this.nextScan = 3;
  }

  update(dt, cart, dayT) {
    this.clock += Math.max(0, Number.isFinite(dt) ? dt : 0);
    const t = typeof dayT === 'number' ? dayT : dayT?.t ?? .25;
    for (const session of [...this.sessions]) {
      const alive = registry.entries.get(session.host.id) === session.host;
      if (!alive) { for (const job of [...session.jobs]) this.releaseNpc(job.npc); continue; }
      for (const job of [...session.jobs]) {
        if (!this.crowd.npcs.includes(job.npc) || registry.entries.get(job.entry.id) !== job.entry
            || !ELIGIBLE.has(job.npc.state) && !job.npc.state.startsWith('camp_music_')) this.releaseNpc(job.npc);
      }
      const ready = session.jobs.filter(job => job.stage === 'ready' || job.stage === 'playing');
      if (!session.returning && (t < .53 || t >= .78 || this.clock - session.created > 130
          || session.playedAt !== null && (this.clock - session.playedAt > session.duration || ready.length < 2))) this._end(session);
      if (!session.returning && session.playedAt === null && ready.length >= 2
          && (ready.length === session.jobs.length || this.clock - session.created > 35)) {
        // Start with the people who actually made it to the fire. A late
        // participant returns their instrument rather than mime a silent part.
        for (const job of session.jobs) if (!ready.includes(job)) { job.stage = 'leave'; job.age = 0; }
        session.playedAt = this.clock;
        session.sound = Sound.attachCampJam(session.fire.x, session.fire.z, session.seed, ready.map(job => job.kind));
        for (const job of ready) job.stage = 'playing';
      }
      if (!session.jobs.length) this._drop(session);
    }
    if (this.clock < this.nextScan) return;
    this.nextScan = this.clock + 5;
    for (const [id] of this.cooldowns) if (!registry.entries.has(id)) this.cooldowns.delete(id);
    if (t < .54 || t >= .75 || this.sessions.length >= 2) return;
    const pos = cart?.position || cart?.pos || cart;
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return;
    for (const id of registry.byKind.get('campsite') || []) {
      const host = registry.entries.get(id);
      if (!host?.campFire || (this.cooldowns.get(id) || 0) > this.clock || this.sessions.some(s => s.host === host)) continue;
      if (Math.hypot(host.campFire.x - pos.x, host.campFire.z - pos.z) > 80) continue;
      if (this._start(host) && this.sessions.length >= 2) break;
    }
  }

  _clear(x, z, ignore = null) {
    let clear = true;
    registry.collidersNear(x, z, .36, entry => {
      if (entry !== ignore && Math.hypot(x - entry.position.x, z - entry.position.z) < (entry.collider?.radius || 0) + .34) clear = false;
    });
    return clear;
  }

  _start(host) {
    const seed = hash(Math.round(host.position.x * 31) ^ Math.round(host.position.z * 197) ^ Math.floor(this.clock / 180));
    const family = [];
    for (const id of registry.byKind.get('campsite') || []) {
      const entry = registry.entries.get(id);
      if (entry && (entry === host || host.campNeighborhood && entry.campNeighborhood === host.campNeighborhood)) family.push(entry);
    }
    const beds = family.flatMap(entry => (entry.campBeds || []).map(bed => ({ entry, bed })));
    if (!beds.length) return false;
    const candidates = this.crowd.npcs.filter(npc => !npc.campJam && !npc.party && ELIGIBLE.has(npc.state)
      && Math.hypot(npc.pos.x - host.campFire.x, npc.pos.z - host.campFire.z) < 28);
    candidates.sort((a, b) => hash(a.idx ^ seed) - hash(b.idx ^ seed));
    const session = { host, fire: host.campFire, seed, jobs: [], created: this.clock,
      playedAt: null, duration: 45 + seed % 31, sound: null, returning: false };
    const kinds = [...KINDS].sort((a, b) => hash(seed ^ (KINDS.indexOf(a) + 1) * 391) - hash(seed ^ (KINDS.indexOf(b) + 1) * 391));
    const seats = family.flatMap(entry => (entry.campSeats || []).map(slot => ({ entry, slot })))
      .filter(({ slot }) => Math.hypot(slot.x - session.fire.x, slot.z - session.fire.z) <= 7);
    const count = 2 + seed % 3;
    for (const npc of candidates) {
      if (session.jobs.length >= count) break;
      const kind = kinds[session.jobs.length];
      // A seated volunteer must have an actual way to stand before fetching.
      if (npc.campSlot && !this.crowd._campExit(npc)) continue;
      const chair = kind === 'bass' ? null : seats.find(seat => !seat.slot.occupied || seat.slot === npc.campSlot);
      let target = null;
      if (!chair) {
        for (let i = 0; i < 16; i++) {
          const a = (i + session.jobs.length * 3) * Math.PI / 8, radius = 3.2 + Math.floor(i / 8) * 1.1;
          const p = { x: session.fire.x + Math.sin(a) * radius, z: session.fire.z + Math.cos(a) * radius };
          if (this._clear(p.x, p.z) && session.jobs.every(job => Math.hypot(job.target.x - p.x, job.target.z - p.z) > 1)) { target = p; break; }
        }
        if (!target) continue;
      }
      if (npc.campSlot) {
        const exit = this.crowd._campExit(npc);
        npc.pos.x = exit.x; npc.pos.z = exit.z;
        npc.campSlot.occupied = false;
      }
      const home = beds[hash(npc.idx ^ seed) % beds.length];
      const job = { npc, session, kind, entry: chair?.entry || home.entry, home: home.entry,
        door: { x: home.bed.doorX, z: home.bed.doorZ }, slot: chair?.slot || null,
        target: chair ? { x: chair.slot.x, z: chair.slot.z } : target,
        stage: 'fetch_walk', age: 0, instrument: null };
      if (job.slot) job.slot.occupied = true;
      npc.campSlot = job.slot; npc.campEntry = job.entry; npc.campBed = false;
      npc.campJam = job; npc.state = 'camp_music_walk'; npc.campJamHidden = false;
      session.jobs.push(job);
    }
    this.cooldowns.set(host.id, this.clock + 150 + seed % 90);
    if (session.jobs.length < 2) { for (const job of [...session.jobs]) this.releaseNpc(job.npc); return false; }
    this.sessions.push(session);
    return true;
  }

  _move(npc, target, dt, ignore = null) {
    let remaining = Math.min(.25, Math.max(0, dt));
    while (remaining > 0) {
      const substep = Math.min(.045, remaining); remaining -= substep;
      const dx = target.x - npc.pos.x, dz = target.z - npc.pos.z, d = Math.hypot(dx, dz);
      if (d < .16) { npc.vel.set(0, 0, 0); return true; }
      const step = Math.min(d, substep * (1.2 + (npc.energy || 1)));
      let nx = npc.pos.x + dx / d * step, nz = npc.pos.z + dz / d * step;
      registry.collidersNear(nx, nz, .36, entry => {
        if (entry === ignore) return;
        const radius = (entry.collider?.radius || 0) + .35;
        const ox = nx - entry.position.x, oz = nz - entry.position.z;
        if (Math.hypot(ox, oz) < radius) {
          const angle = Math.atan2(oz || dz, ox || dx) + step / radius * (npc.idx % 2 ? 1 : -1);
          nx = entry.position.x + Math.cos(angle) * radius;
          nz = entry.position.z + Math.sin(angle) * radius;
        }
      });
      if (this._clear(nx, nz, ignore)) {
        npc.vel.set((nx - npc.pos.x) / substep, 0, (nz - npc.pos.z) / substep);
        npc.pos.x = nx; npc.pos.z = nz;
      } else npc.vel.set(0, 0, 0);
      npc.yaw += angleDelta(Math.atan2(-dx, -dz) - npc.yaw) * Math.min(1, substep * 6);
    }
    return false;
  }

  tickNpc(dt, npc) {
    const job = npc.campJam;
    if (!job) return false;
    job.age += Math.max(0, Number.isFinite(dt) ? dt : 0);
    const trapped = npc.state === 'camp_seated' && !this.crowd._campExit(npc);
    if (registry.entries.get(job.home.id) !== job.home || job.age > 65 && !['ready', 'playing'].includes(job.stage) && !trapped) {
      this.releaseNpc(npc); this.crowd._writeMatrices(npc); return true;
    }
    const next = stage => { job.stage = stage; job.age = 0; };
    if (job.stage === 'fetch_walk') {
      if (this._move(npc, job.door, dt)) { next('fetch'); npc.campJamHidden = true; }
    } else if (job.stage === 'fetch') {
      npc.vel.set(0, 0, 0);
      if (job.age >= .8) {
        job.instrument = buildCampInstrument(job.kind); npc.campInstrument = job.instrument;
        this.crowd.group.add(job.instrument.group); npc.campJamHidden = false; next('approach');
      }
    } else if (job.stage === 'approach') {
      const approach = job.slot ? { x: job.slot.approachX, z: job.slot.approachZ } : job.target;
      if (this._move(npc, approach, dt)) next(job.slot ? 'seat' : 'ready');
    } else if (job.stage === 'seat') {
      if (this._move(npc, job.target, dt, job.slot.collider)) {
        npc.pos.x = job.slot.x; npc.pos.z = job.slot.z; npc.yaw = job.slot.yaw;
        npc.state = 'camp_seated'; next('ready');
      }
    } else if (job.stage === 'ready' || job.stage === 'playing') {
      npc.vel.set(0, 0, 0);
      if (!job.slot) {
        npc.state = 'camp_music_standing';
        npc.yaw = Math.atan2(npc.pos.x - job.session.fire.x, npc.pos.z - job.session.fire.z);
      }
      if (job.stage === 'ready' && job.age > 28 && job.session.playedAt === null) this._end(job.session);
    } else if (job.stage === 'leave') {
      if (job.slot && npc.state === 'camp_seated') {
        const exit = this.crowd._campExit(npc);
        if (!exit) { this.crowd._writeMatrices(npc); return true; }
        npc.pos.x = exit.x; npc.pos.z = exit.z;
      }
      if (job.slot) job.slot.occupied = false;
      npc.campSlot = null; job.slot = null; npc.state = 'camp_music_walk'; next('return');
    } else if (job.stage === 'return') {
      if (this._move(npc, job.door, dt)) { next('putaway'); npc.campJamHidden = true; }
    } else if (job.stage === 'putaway' && job.age >= .7) this.releaseNpc(npc);
    if (job.instrument) updateCampInstrument(job.instrument, this.clock, job.stage === 'playing');
    this.crowd._writeMatrices(npc);
    return true;
  }

  _end(session) {
    if (session.returning) return;
    session.returning = true; session.sound?.stop(); session.sound = null;
    for (const job of session.jobs) { job.stage = job.instrument ? 'leave' : 'return'; job.age = 0; job.npc.campJamHidden = false; }
  }

  _drop(session) {
    session.sound?.stop(); session.sound = null;
    const index = this.sessions.indexOf(session);
    if (index !== -1) this.sessions.splice(index, 1);
  }

  releaseNpc(npc) {
    const job = npc.campJam;
    if (!job) return;
    if (job.slot) {
      if (npc.state === 'camp_seated') {
        const exit = this.crowd._campExit(npc);
        if (exit) { npc.pos.x = exit.x; npc.pos.z = exit.z; }
      }
      job.slot.occupied = false;
    }
    if (job.instrument) this.crowd.group.remove(job.instrument.group);
    npc.campJam = null; npc.campInstrument = null; npc.campJamHidden = false;
    npc.campSlot = null; npc.campEntry = null; npc.campBed = false; npc.campCooldown = 20;
    if (npc.state === 'camp_seated' || npc.state.startsWith('camp_music_')) { npc.state = 'idle'; npc.stateTimer = 2; }
    const index = job.session.jobs.indexOf(job);
    if (index !== -1) job.session.jobs.splice(index, 1);
    if (!job.session.jobs.length) this._drop(job.session);
    else if (job.session.playedAt !== null && job.session.jobs.filter(j => j.stage === 'playing').length < 2) this._end(job.session);
  }

  dispose() {
    for (const session of [...this.sessions]) for (const job of [...session.jobs]) this.releaseNpc(job.npc);
    this.cooldowns.clear();
  }
}
