import {
  campSlotAvailable,
  reserveCampSlot,
  campSlotValid,
  releaseCampSlot,
  campExit,
} from "./people/campResources.js";
import { registry } from "./registry.js";
import { Sound } from "./sound.js";
import {
  buildCampInstrument,
  updateCampInstrument,
} from "./models/campInstruments.js";

const KINDS = ["guitar", "banjo", "bass", "fiddle", "mandolin"];
const ELIGIBLE = new Set(["idle", "walking", "camp_seated"]);
const angleDelta = (value) => Math.atan2(Math.sin(value), Math.cos(value));
function hash(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

// This is an activity controller, not another crowd renderer or audio clock.
// Claims belong to jobs and are released in one place on every interruption.
export class CampJamActivity {
  constructor(people, { places = registry } = {}) {
    this.registry = places;
    this.jobs = new Map();
    this.activityKey = "camp-music";
    this.disposed = false;
    this.people = people;
    this.sessions = [];
    this.cooldowns = new Map();
    this.clock = 0;
    this.nextScan = 3;
  }

  update(dt, cart, dayT) {
    if (this.disposed) return;
    this.clock += Math.max(0, Number.isFinite(dt) ? dt : 0);
    const t = typeof dayT === "number" ? dayT : (dayT?.t ?? 0.25);
    for (const session of [...this.sessions]) {
      const alive = this.registry.entries.get(session.host.id) === session.host;
      if (!alive) {
        for (const job of [...session.jobs]) this.release(job.person);
        continue;
      }
      for (const job of [...session.jobs]) {
        if (
          !this.people.readCampMusicMotion(job.person, job.motion) ||
          this.registry.entries.get(job.entry.id) !== job.entry ||
          (!ELIGIBLE.has(job.motion.state) &&
            !job.motion.state.startsWith("camp_music_"))
        )
          this.release(job.person);
      }
      const ready = session.jobs.filter(
        (job) => job.stage === "ready" || job.stage === "playing",
      );
      if (
        !session.returning &&
        (t < 0.53 ||
          t >= 0.78 ||
          this.clock - session.created > 130 ||
          (session.playedAt !== null &&
            (this.clock - session.playedAt > session.duration ||
              ready.length < 2)))
      )
        this._end(session);
      if (
        !session.returning &&
        session.playedAt === null &&
        ready.length >= 2 &&
        (ready.length === session.jobs.length ||
          this.clock - session.created > 35)
      ) {
        // Start with the people who actually made it to the fire. A late
        // participant returns their instrument rather than mime a silent part.
        for (const job of session.jobs)
          if (!ready.includes(job)) {
            job.stage = "leave";
            job.age = 0;
          }
        session.playedAt = this.clock;
        session.sound = Sound.attachCampJam(
          session.fire.x,
          session.fire.z,
          session.seed,
          ready.map((job) => job.kind),
        );
        for (const job of ready) job.stage = "playing";
      }
      if (!session.jobs.length) this._drop(session);
    }
    if (this.clock < this.nextScan) return;
    this.nextScan = this.clock + 5;
    for (const [id] of this.cooldowns)
      if (!this.registry.entries.has(id)) this.cooldowns.delete(id);
    if (t < 0.54 || t >= 0.75 || this.sessions.length >= 2) return;
    const pos = cart?.position || cart?.pos || cart;
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return;
    for (const id of this.registry.byKind.get("campsite") || []) {
      const host = this.registry.entries.get(id);
      if (
        !host?.campFire ||
        (this.cooldowns.get(id) || 0) > this.clock ||
        this.sessions.some((s) => s.host === host)
      )
        continue;
      if (Math.hypot(host.campFire.x - pos.x, host.campFire.z - pos.z) > 80)
        continue;
      if (this._start(host) && this.sessions.length >= 2) break;
    }
  }

  _clear(x, z, ignore = null) {
    let clear = true;
    this.registry.collidersNear(x, z, 0.36, (entry) => {
      if (
        entry !== ignore &&
        Math.hypot(x - entry.position.x, z - entry.position.z) <
          (entry.collider?.radius || 0) + 0.34
      )
        clear = false;
    });
    return clear;
  }

  _start(host) {
    const seed = hash(
      Math.round(host.position.x * 31) ^
        Math.round(host.position.z * 197) ^
        Math.floor(this.clock / 180),
    );
    const family = [];
    for (const id of this.registry.byKind.get("campsite") || []) {
      const entry = this.registry.entries.get(id);
      if (
        entry &&
        (entry === host ||
          (host.campNeighborhood &&
            entry.campNeighborhood === host.campNeighborhood))
      )
        family.push(entry);
    }
    const beds = family.flatMap((entry) =>
      (entry.campBeds || []).map((bed) => ({ entry, bed })),
    );
    if (!beds.length) return false;
    const candidates = [];
    this.people.forEachPersonNear(
      host.campFire.x,
      host.campFire.z,
      28,
      (handle) => {
        if (!this.people.canPlayCampMusic(handle)) return;
        const motion = this._newMotion(handle);
        if (!this.people.readCampMusicMotion(handle, motion)) return;
        const place = {};
        if (this.people.readCampPlace(handle, place)) {
          motion.campSlot = place.slot;
          motion.campEntry = place.entry;
          motion.campBed = place.bed;
        }
        candidates.push(motion);
      },
    );
    candidates.sort((a, b) => hash(a.idx ^ seed) - hash(b.idx ^ seed));
    const session = {
      host,
      fire: host.campFire,
      seed,
      jobs: [],
      created: this.clock,
      playedAt: null,
      duration: 45 + (seed % 31),
      sound: null,
      returning: false,
    };
    const kinds = [...KINDS].sort(
      (a, b) =>
        hash(seed ^ ((KINDS.indexOf(a) + 1) * 391)) -
        hash(seed ^ ((KINDS.indexOf(b) + 1) * 391)),
    );
    const seats = family
      .flatMap((entry) =>
        (entry.campSeats || []).map((slot) => ({ entry, slot })),
      )
      .filter(
        ({ slot }) =>
          Math.hypot(slot.x - session.fire.x, slot.z - session.fire.z) <= 7,
      );
    const count = 2 + (seed % 3);
    for (const npc of candidates) {
      if (session.jobs.length >= count) break;
      const kind = kinds[session.jobs.length];
      // A seated volunteer must have an actual way to stand before fetching.
      if (npc.campSlot && !this._campExit(npc)) continue;
      const chair =
        kind === "bass"
          ? null
          : seats.find(
              (seat) =>
                campSlotAvailable(seat.slot) || seat.slot === npc.campSlot,
            );
      let target = null;
      if (!chair) {
        for (let i = 0; i < 16; i++) {
          const a = ((i + session.jobs.length * 3) * Math.PI) / 8,
            radius = 3.2 + Math.floor(i / 8) * 1.1;
          const p = {
            x: session.fire.x + Math.sin(a) * radius,
            z: session.fire.z + Math.cos(a) * radius,
          };
          if (
            this._clear(p.x, p.z) &&
            session.jobs.every(
              (job) => Math.hypot(job.target.x - p.x, job.target.z - p.z) > 1,
            )
          ) {
            target = p;
            break;
          }
        }
        if (!target) continue;
      }
      if (npc.campSlot) {
        const exit = this._campExit(npc);
        npc.pos.x = exit.x;
        npc.pos.z = exit.z;
      }
      const home = beds[hash(npc.idx ^ seed) % beds.length];
      const job = {
        motion: npc,
        person: npc.person,
        claim: null,
        reservation: null,
        session,
        kind,
        entry: chair?.entry || home.entry,
        home: home.entry,
        door: { x: home.bed.doorX, z: home.bed.doorZ },
        slot: chair?.slot || null,
        target: chair ? { x: chair.slot.x, z: chair.slot.z } : target,
        stage: "fetch_walk",
        age: 0,
        instrument: null,
      };
      const priorSlot = npc.campSlot;
      const claim = this.people.claimActivity(
        npc.person,
        {
          owner: this,
          prepare: () =>
            this.registry.entries.get(job.entry.id) === job.entry &&
            this.registry.entries.get(job.home.id) === job.home &&
            (!job.slot ||
              campSlotAvailable(job.slot) ||
              job.slot === priorSlot),
          release: (current) => {
            if (this.jobs.get(job.person) === job && job.claim === current)
              this._cleanupJob(job, current);
          },
        },
        { preserveMotion: true },
      );
      if (!claim) continue;
      job.claim = claim;
      if (job.slot) {
        job.reservation = reserveCampSlot(
          this.people,
          this.registry,
          claim,
          job.entry,
          job.slot,
        );
        if (!job.reservation) {
          this.people.endPersonActivity(claim, { reason: "rest-step" });
          continue;
        }
      }
      this.jobs.set(job.person, job);
      npc.campSlot = job.slot;
      npc.campEntry = job.entry;
      npc.campBed = false;
      npc.state = "camp_music_walk";
      npc.campJamHidden = false;
      session.jobs.push(job);
      this._commit(job, false);
    }
    this.cooldowns.set(host.id, this.clock + 150 + (seed % 90));
    if (session.jobs.length < 2) {
      for (const job of [...session.jobs]) this.release(job.person);
      return false;
    }
    this.sessions.push(session);
    return true;
  }

  _move(npc, target, dt, ignore = null) {
    let remaining = Math.min(0.25, Math.max(0, dt));
    while (remaining > 0) {
      const substep = Math.min(0.045, remaining);
      remaining -= substep;
      const dx = target.x - npc.pos.x,
        dz = target.z - npc.pos.z,
        d = Math.hypot(dx, dz);
      if (d < 0.16) {
        npc.vel.set(0, 0, 0);
        return true;
      }
      const step = Math.min(d, substep * (1.2 + (npc.energy || 1)));
      let nx = npc.pos.x + (dx / d) * step,
        nz = npc.pos.z + (dz / d) * step;
      this.registry.collidersNear(nx, nz, 0.36, (entry) => {
        if (entry === ignore) return;
        const radius = (entry.collider?.radius || 0) + 0.35;
        const ox = nx - entry.position.x,
          oz = nz - entry.position.z;
        if (Math.hypot(ox, oz) < radius) {
          const angle =
            Math.atan2(oz || dz, ox || dx) +
            (step / radius) * (npc.idx % 2 ? 1 : -1);
          nx = entry.position.x + Math.cos(angle) * radius;
          nz = entry.position.z + Math.sin(angle) * radius;
        }
      });
      if (this._clear(nx, nz, ignore)) {
        npc.vel.set((nx - npc.pos.x) / substep, 0, (nz - npc.pos.z) / substep);
        npc.pos.x = nx;
        npc.pos.z = nz;
      } else npc.vel.set(0, 0, 0);
      npc.yaw +=
        angleDelta(Math.atan2(-dx, -dz) - npc.yaw) * Math.min(1, substep * 6);
    }
    return false;
  }

  tickPerson(dt, handle) {
    const job = this.jobs.get(handle);
    if (
      this.disposed ||
      !job ||
      !this.people.readCampMusicMotion(handle, job.motion)
    )
      return false;
    const npc = job.motion;
    job.age += Math.max(0, Number.isFinite(dt) ? dt : 0);
    const trapped = npc.state === "camp_seated" && !this._campExit(npc);
    if (
      this.registry.entries.get(job.home.id) !== job.home ||
      (job.reservation &&
        !campSlotValid(this.people, this.registry, job.reservation)) ||
      (job.age > 65 && !["ready", "playing"].includes(job.stage) && !trapped)
    ) {
      this.release(handle, { publish: true });
      return true;
    }
    const next = (stage) => {
      job.stage = stage;
      job.age = 0;
    };
    if (job.stage === "fetch_walk") {
      if (this._move(npc, job.door, dt)) {
        next("fetch");
        npc.campJamHidden = true;
      }
    } else if (job.stage === "fetch") {
      npc.vel.set(0, 0, 0);
      if (job.age >= 0.8) {
        job.instrument = buildCampInstrument(job.kind);
        npc.campInstrument = job.instrument;
        this.people.attachCampInstrument(job.claim, job.instrument);
        npc.campJamHidden = false;
        next("approach");
      }
    } else if (job.stage === "approach") {
      const approach = job.slot
        ? { x: job.slot.approachX, z: job.slot.approachZ }
        : job.target;
      if (this._move(npc, approach, dt)) next(job.slot ? "seat" : "ready");
    } else if (job.stage === "seat") {
      if (this._move(npc, job.target, dt, job.slot.collider)) {
        npc.pos.x = job.slot.x;
        npc.pos.z = job.slot.z;
        npc.yaw = job.slot.yaw;
        npc.state = "camp_seated";
        next("ready");
      }
    } else if (job.stage === "ready" || job.stage === "playing") {
      npc.vel.set(0, 0, 0);
      if (!job.slot) {
        npc.state = "camp_music_standing";
        npc.yaw = Math.atan2(
          npc.pos.x - job.session.fire.x,
          npc.pos.z - job.session.fire.z,
        );
      }
      if (
        job.stage === "ready" &&
        job.age > 28 &&
        job.session.playedAt === null
      )
        this._end(job.session);
    } else if (job.stage === "leave") {
      if (job.slot && npc.state === "camp_seated") {
        const exit = this._campExit(npc);
        if (!exit) {
          this._commit(job, true);
          return true;
        }
        npc.pos.x = exit.x;
        npc.pos.z = exit.z;
      }
      releaseCampSlot(job.reservation);
      job.reservation = null;
      npc.campSlot = null;
      job.slot = null;
      npc.state = "camp_music_walk";
      next("return");
    } else if (job.stage === "return") {
      if (this._move(npc, job.door, dt)) {
        next("putaway");
        npc.campJamHidden = true;
      }
    } else if (job.stage === "putaway" && job.age >= 0.7) {
      this.release(handle, { publish: true });
      return true;
    }
    if (job.instrument)
      updateCampInstrument(job.instrument, this.clock, job.stage === "playing");
    this._commit(job, true);
    return true;
  }

  _end(session) {
    if (session.returning) return;
    session.returning = true;
    const sound = session.sound;
    session.sound = null;
    try {
      sound?.stop();
    } finally {
      for (const job of session.jobs) {
        job.stage = job.instrument ? "leave" : "return";
        job.age = 0;
        job.motion.campJamHidden = false;
        this._commit(job, false);
      }
    }
  }
  _drop(session) {
    const sound = session.sound;
    session.sound = null;
    const index = this.sessions.indexOf(session);
    if (index !== -1) this.sessions.splice(index, 1);
    sound?.stop();
  }

  _newMotion(handle) {
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
    return {
      person: handle,
      idx: handle.slot,
      pos: vector(),
      vel: vector(),
      target: vector(),
      campSlot: null,
      campEntry: null,
      campBed: false,
      campJamHidden: false,
    };
  }
  has(handle) {
    return this.jobs.has(handle);
  }
  exit(handle) {
    const job = this.jobs.get(handle);
    return job ? this._campExit(job.motion) : null;
  }
  _campExit(npc) {
    return campExit(this.registry, npc.campSlot, npc.campBed);
  }
  _commit(job, publish) {
    const s = job.motion;
    s.publication = publish;
    s.campMusic = true;
    s.campMusicStage = job.stage;
    s.campY = job.slot?.y;
    return this.people.commitCampMusicMotion(job.claim, s);
  }
  release(handle, { publish = false } = {}) {
    const job = this.jobs.get(handle);
    if (!job) return false;
    const npc = job.motion;
    if (!this.people.readCampMusicMotion(handle, npc))
      return this.people.endPersonActivity(job.claim, {
        reason: "camp-music-disposed",
      });
    if (job.slot && npc.state === "camp_seated") {
      const exit = this._campExit(npc);
      if (exit) {
        npc.pos.x = exit.x;
        npc.pos.z = exit.z;
      }
    }
    npc.campJamHidden = false;
    npc.campMusic = false;
    npc.campMusicStage = null;
    npc.campY = undefined;
    npc.publication = publish;
    if (npc.state === "camp_seated" || npc.state.startsWith("camp_music_")) {
      npc.state = "idle";
      npc.stateTimer = 2;
    }
    return this.people.finishCampMusicMotion(job.claim, npc);
  }
  _cleanupJob(job, claim) {
    const errors = [],
      run = (fn) => {
        try {
          fn();
        } catch (error) {
          errors.push(error);
        }
      };
    run(() => releaseCampSlot(job.reservation));
    job.reservation = null;
    this.jobs.delete(job.person);
    run(() => this.people.releaseCampMusicPose(claim));
    run(() => this.people.setCampCooldown(job.person, 20));
    const index = job.session.jobs.indexOf(job);
    if (index !== -1) job.session.jobs.splice(index, 1);
    if (!job.session.jobs.length) run(() => this._drop(job.session));
    else if (
      job.session.playedAt !== null &&
      job.session.jobs.filter((j) => j.stage === "playing").length < 2
    )
      run(() => this._end(job.session));
    if (errors.length)
      throw new AggregateError(errors, "Camp music borrower cleanup failed.");
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const errors = [];
    for (const job of this.jobs.values())
      try {
        this.people.endPersonActivity(job.claim, {
          reason: "camp-music-disposed",
        });
      } catch (error) {
        errors.push(error);
      }
    for (const session of [...this.sessions])
      try {
        this._drop(session);
      } catch (error) {
        errors.push(error);
      }
    this.cooldowns.clear();
    if (errors.length)
      throw new AggregateError(errors, "Camp music cleanup failed.");
  }
}
