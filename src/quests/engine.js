// The passenger-quest state machine. It knows riders only as opaque ids and
// the cart only as { x, z, speed }, so it runs in Node and never touches NPC
// records, three.js or the DOM. main.js turns its events into toasts, sound,
// thought bubbles, map pins and crowd calls.
import { QUEST, DESTINATIONS, linesFor } from './catalog.js';

const clamp01 = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v);

export class PassengerQuests {
  constructor({ random = Math.random } = {}) {
    this.random = random;
    this.quests = [];
    this.completed = 0;
    this.offeredEver = 0;
    this._hintCooldown = 0;
    this._nextId = 1;
  }

  get active() { return this.quests; }
  get full() { return this.quests.length >= QUEST.MAX_ACTIVE; }
  has(riderId) { return this.quests.some((q) => q.riderId === riderId); }
  get(riderId) { return this.quests.find((q) => q.riderId === riderId) || null; }
  activeKinds() { return this.quests.map((q) => q.kind); }

  _line(kind, type) {
    const lines = linesFor(kind, type);
    return lines.length ? lines[Math.min(lines.length - 1, Math.floor(this.random() * lines.length))] : '';
  }

  // Should an un-hailed boarder carry a quest? Rarely: hailing is the main
  // way requests start, so walk-ups must not fill the strip on their own.
  rollOffer() {
    if (this.full) return false;
    return this.random() < QUEST.CHANCE;
  }

  // `dest` is { kind, x, z, radius?, label? }. `members` is the head count for
  // a party sharing one quest. Returns the quest, or null when refused.
  offer(riderId, origin, dest, { type = 'ride', members = 1, voice = null } = {}, emit = null) {
    const info = DESTINATIONS[dest?.kind];
    if (!info || this.full || this.has(riderId) || !Number.isFinite(dest.x) || !Number.isFinite(dest.z)) return null;
    const startDist = Math.hypot(dest.x - origin.x, dest.z - origin.z);
    const radius = Math.max(info.radius ?? QUEST.ARRIVE_RADIUS, dest.radius ?? 0);
    const total = type === 'urgent' ? QUEST.URGENT_BASE_SECONDS + startDist / QUEST.URGENT_METRES_PER_SECOND : 0;
    const quest = {
      id: this._nextId++, riderId, type, kind: dest.kind, icon: info.icon, voice: voice || dest.kind,
      label: dest.label || info.label, short: info.short,
      x: dest.x, z: dest.z, radius, members: Math.max(1, members | 0),
      originX: origin.x, originZ: origin.z,
      startDist, dist: startDist, best: startDist, lastHintDist: startDist,
      age: 0, stall: 0, idle: 0, idleSaid: false,
      entered: false, missed: false, nearSaid: false, senseSaid: false,
      hintTimer: QUEST.HINT_MIN * 0.6 + this.random() * QUEST.HINT_SPAN,
      totalTime: total, timeLeft: total, warmth: 0,
      // An optional waypoint (the foot of a mountain road). The compass aims
      // at `aim`, which is the waypoint until the cart has reached it.
      via: dest.via && Number.isFinite(dest.via.x) && Number.isFinite(dest.via.z) ? { x: dest.via.x, z: dest.via.z } : null,
      viaReached: false, aim: null,
    };
    quest.aim = quest.via || quest;
    this.quests.push(quest);
    this.offeredEver++;
    this._hintCooldown = QUEST.HINT_GAP;
    emit?.('offered', quest, { line: this._line(quest.voice, 'ask') });
    return quest;
  }

  reward(quest) {
    let n;
    const distance = quest.rewardDist ?? quest.startDist;
    if (quest.type === 'urgent') n = QUEST.URGENT_REWARD + Math.round(QUEST.URGENT_BONUS * clamp01(quest.timeLeft / (quest.totalTime || 1)));
    else if (quest.type === 'summit') n = 10 + Math.floor(distance / 60);
    else if (quest.type === 'party') n = QUEST.PARTY_REWARD_EACH * quest.members;
    else n = 6 + Math.floor(distance / 50);
    return quest.missed ? Math.ceil(n / 2) : n;
  }

  _remove(quest) {
    const i = this.quests.indexOf(quest);
    if (i >= 0) this.quests.splice(i, 1);
  }

  // The rider left for a reason the engine did not cause (scattered, dry
  // tank, lost seat, restart). No reward and no remark.
  cancel(riderId, emit = null, reason = 'left') {
    const quest = this.get(riderId);
    if (!quest) return false;
    this._remove(quest);
    emit?.('cancelled', quest, { reason });
    return true;
  }

  clear(emit = null) {
    for (const quest of [...this.quests]) { this._remove(quest); emit?.('cancelled', quest, { reason: 'reset' }); }
  }

  _say(quest, type, emit, event = 'hint') {
    const line = this._line(quest.voice, type);
    if (!line) return false;
    this._hintCooldown = QUEST.HINT_GAP;
    emit?.(event, quest, { line, tone: type });
    return true;
  }

  update(dt, player, emit = null, prepareArrival = null) {
    if (!(dt > 0)) return;
    this._hintCooldown = Math.max(0, this._hintCooldown - dt);
    const speed = Math.abs(player.speed || 0);
    for (const quest of [...this.quests]) {
      quest.age += dt;
      const dist = Math.hypot(quest.x - player.x, quest.z - player.z);
      quest.dist = dist;
      const span = Math.max(1, quest.startDist - quest.radius);
      quest.warmth = clamp01(1 - (dist - quest.radius) / span);
      const inside = dist <= quest.radius;
      if (quest.via && !quest.viaReached && (inside || Math.hypot(quest.via.x - player.x, quest.via.z - player.z) < QUEST.VIA_RADIUS)) {
        quest.viaReached = true; quest.aim = quest;
        if (!inside) { this._say(quest, 'via', emit, 'via'); }
      }

      // The host must finish the physical exit before we commit rewards. A
      // rejected landing leaves the quest active so another stop can retry.
      const stop = quest.arrivalTarget;
      const atStop = stop ? Math.hypot(stop.x - player.x, stop.z - player.z) <= stop.radius : inside;
      if (atStop && speed < QUEST.ARRIVE_SPEED && (!prepareArrival || prepareArrival(quest))) {
        // Accepting a closer interchangeable facility must not pay the longer
        // suggested trip's distance bonus. Keep the offered deadline unchanged.
        if (stop) quest.rewardDist = Math.min(quest.startDist, Math.hypot(stop.x - quest.originX, stop.z - quest.originZ));
        this._remove(quest);
        this.completed++;
        emit?.('arrived', quest, { reward: this.reward(quest), line: this._line(quest.voice, 'thanks') });
        continue;
      }

      if (quest.type === 'urgent') {
        quest.timeLeft -= dt;
        if (quest.timeLeft <= 0) {
          quest.timeLeft = 0;
          this._remove(quest);
          emit?.('failed', quest, { penalty: QUEST.URGENT_PENALTY, line: this._line(quest.voice, 'failed') });
          continue;
        }
      }

      // Drove through the stop without slowing, then carried on.
      if (inside) quest.entered = true;
      else if (quest.entered && dist > quest.radius + QUEST.MISSED_DISTANCE) {
        quest.entered = false;
        const first = !quest.missed;
        quest.missed = true;
        quest.best = dist;   // the way back counts as fresh progress
        if (first) { this._say(quest, 'missed', emit, 'missed'); continue; }
      }

      // Patience only drains while the cart is not getting closer, and never
      // while it is already at the destination.
      if (dist < quest.best - QUEST.STALL_PROGRESS) { quest.best = dist; quest.stall = 0; }
      else if (!inside && quest.type !== 'urgent') quest.stall += dt;
      if (quest.stall > QUEST.STALL_SECONDS) {
        this._remove(quest);
        emit?.('gaveUp', quest, { line: this._line(quest.voice, 'gaveUp') });
        continue;
      }

      if (!quest.nearSaid && dist < quest.radius + QUEST.NEAR_MARGIN) {
        quest.nearSaid = true;
        this._say(quest, 'near', emit, 'near');
        continue;
      }

      if (speed < 0.6 && !inside) {
        quest.idle += dt;
        if (!quest.idleSaid && quest.idle > QUEST.IDLE_SECONDS && this._hintCooldown <= 0) {
          quest.idleSaid = true;
          this._say(quest, 'idle', emit);
          continue;
        }
      } else { quest.idle = 0; quest.idleSaid = false; }

      quest.hintTimer -= dt;
      if (quest.hintTimer <= 0 && this._hintCooldown <= 0 && speed >= 0.6) {
        quest.hintTimer = QUEST.HINT_MIN + this.random() * QUEST.HINT_SPAN;
        const info = DESTINATIONS[quest.kind];
        const closer = dist < quest.lastHintDist - 3;
        quest.lastHintDist = dist;
        if (!quest.senseSaid && quest.voice === quest.kind && info.sense && dist < (info.senseRange || 0) + quest.radius && closer) {
          quest.senseSaid = true;
          this._say(quest, 'sense', emit);
        } else this._say(quest, closer ? 'warm' : 'cold', emit);
      }
    }
  }

  snapshot() {
    return this.quests.map((q) => ({
      id: q.id, riderId: q.riderId, type: q.type, kind: q.kind, label: q.label,
      x: q.x, z: q.z, radius: q.radius, dist: Math.round(q.dist), startDist: Math.round(q.startDist),
      warmth: +q.warmth.toFixed(2), stall: Math.round(q.stall), missed: q.missed,
      timeLeft: q.type === 'urgent' ? +q.timeLeft.toFixed(1) : null, reward: this.reward(q),
      via: q.via, viaReached: q.viaReached,
    }));
  }
}
