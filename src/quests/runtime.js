// Game-side glue for passenger quests: turns boardings into offers and engine
// events into toasts, sound, smile bursts and crowd calls. main.js constructs
// one of these and calls onBoard() / update(); everything a quest touches goes
// through the narrow services passed in, so each layer (thought bubbles,
// compass, map pins, sound) can be absent without breaking the loop.
import { PassengerQuests } from './engine.js';
import { planOffer } from './pick.js';
import { QUEST, DESTINATIONS } from './catalog.js';
import { gatherDestinations } from './worldSource.js';

const CELEBRATE_SECONDS = 2.6;

export class QuestRuntime {
  constructor({
    crowd, zerble, smiles, registry, worldgen = true,
    toast = () => {}, sound = null, analytics = null,
    deductSmiles = () => {},            // urgent-run failure penalty
    extraDestinations = () => [],       // summit candidates etc.
    log = null,                         // createQuestLog(); null = no record kept
    onCompleted = () => {},             // (quest, log) => bubble unlocks etc.
    random = Math.random,
  }) {
    Object.assign(this, { crowd, zerble, smiles, registry, worldgen, toast, sound, analytics, deductSmiles, extraDestinations, random, log, onCompleted });
    this.hails = [];                // people on foot asking for a ride
    this.hailing = true;
    this._hailIn = QUEST.HAIL_FIRST; this._hailId = 1; this._hailTip = false; this._walker = {};
    this.engine = new PassengerQuests({ random });
    this.enabled = true;
    this.parties = new Map();       // party key -> { leave() }
    this.listeners = new Set();     // presentation layers: (type, quest, data) => void
    this.lastGatherMs = 0;
    this.lastEvent = null;
    this._rider = {};
    this._burst = { x: 0, y: 0, z: 0 };
    this._emit = (type, quest, data = {}) => this._handle(type, quest, data);
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  get active() { return this.engine.active; }

  _player() {
    const p = this.zerble.position;
    return { x: p.x, z: p.z, speed: this.zerble.speed || 0 };
  }

  // A rider just sat down on Zerble. `force` (debug) skips the chance roll and
  // may name a kind, 'urgent' or 'summit'.
  onBoard(handle, { force = null } = {}) {
    if (!this.enabled || this.engine.has(handle)) return null;
    // Someone the player stopped for: their request was chosen when they
    // started hailing, so it carries over as it was shown.
    const hail = this.hails.find((h) => h.handle === handle);
    if (hail && !force) {
      this._endHail(hail, 'boarded');
      const quest = this.engine.offer(handle, this._player(), hail.plan.dest, { type: hail.plan.type }, this._emit);
      if (quest) { this.crowd.holdRide(handle, true); if (quest.type === 'urgent') this.crowd.setRideMood(handle, 'urgent'); }
      return quest;
    }
    if (!force && !this.engine.rollOffer()) return null;
    if (this.engine.full) return null;
    const origin = this._player();
    const started = performance.now();
    const candidates = gatherDestinations(origin, {
      registry: this.registry, worldgen: this.worldgen, reach: Math.max(QUEST.MAX_DIST, QUEST.URGENT_MAX),
    });
    // Summit candidates sit far beyond the ordinary reach, so their source
    // supplies them whole and planOffer applies the summit distance band.
    for (const c of this.extraDestinations(origin) || []) candidates.push(c);
    this.lastGatherMs = performance.now() - started;
    const plan = planOffer(candidates, origin, {
      random: this.random, activeKinds: this.engine.activeKinds(),
      force: force === true ? null : force,
    });
    if (!plan) return null;
    const quest = this.engine.offer(handle, origin, plan.dest, { type: plan.type }, this._emit);
    if (quest) { this.crowd.holdRide(handle, true); if (quest.type === 'urgent') this.crowd.setRideMood(handle, 'urgent'); }
    return quest;
  }

  // A party sharing one destination (monks). `key` identifies the party and
  // `party` supplies { leave() } so the whole group steps off together. The
  // party picks an ordinary destination but speaks in its own voice.
  offerParty(key, party, members, { voice = 'monk_party', force = null } = {}) {
    if (!this.enabled || this.engine.full || this.engine.has(key)) return null;
    const origin = this._player();
    const candidates = gatherDestinations(origin, { registry: this.registry, worldgen: this.worldgen, reach: QUEST.MAX_DIST });
    const plan = planOffer(candidates, origin, { random: this.random, activeKinds: this.engine.activeKinds(), allowUrgent: false, allowSummit: false, force });
    if (!plan) return null;
    const quest = this.engine.offer(key, origin, plan.dest, { type: 'party', members, voice }, this._emit);
    if (quest) this.parties.set(key, party);
    return quest;
  }

  cancel(riderId, reason = 'left') { return this.engine.cancel(riderId, this._emit, reason); }

  _candidates(origin) {
    const candidates = gatherDestinations(origin, { registry: this.registry, worldgen: this.worldgen, reach: Math.max(QUEST.MAX_DIST, QUEST.URGENT_MAX) });
    for (const c of this.extraDestinations(origin) || []) candidates.push(c);
    return candidates;
  }

  _endHail(hail, reason) {
    const i = this.hails.indexOf(hail);
    if (i < 0) return;
    this.hails.splice(i, 1);
    this.crowd.setHailing(hail.handle, false);
    for (const listener of this.listeners) listener('hailEnded', hail, { reason });
  }

  // Pick someone nearby to start flagging the cart down. `force` (debug) may
  // name a kind, 'urgent' or 'summit'. Returns the hail or null.
  startHail({ force = null } = {}) {
    if (!this.enabled || this.hails.length >= QUEST.HAIL_MAX || this.engine.active.length + this.hails.length >= QUEST.MAX_ACTIVE) return null;
    const pool = [];
    this.crowd.forEachHailCandidate(this.zerble, QUEST.HAIL_MIN_DIST, QUEST.HAIL_MAX_DIST, (handle, x, z, d) => pool.push({ handle, x, z, d }));
    if (!pool.length) return null;
    const person = pool[Math.min(pool.length - 1, Math.floor(this.random() * pool.length))];
    const origin = { x: person.x, z: person.z };
    const started = performance.now();
    const kinds = [...this.engine.activeKinds(), ...this.hails.map((h) => h.plan.dest.kind)];
    const plan = planOffer(this._candidates(origin), origin, { random: this.random, activeKinds: kinds, force });
    this.lastGatherMs = performance.now() - started;
    if (!plan) return null;
    const info = DESTINATIONS[plan.dest.kind];
    const hail = { id: `hail:${this._hailId++}`, handle: person.handle, plan, icon: info.icon, label: info.label, urgent: plan.type === 'urgent', age: 0, waveIn: 0.5, boarding: false };
    this.hails.push(hail);
    this.crowd.setHailing(hail.handle, true);
    for (const listener of this.listeners) listener('hailed', hail, {});
    return hail;
  }

  _updateHails(dt) {
    const p = this.zerble.position, speed = Math.abs(this.zerble.speed || 0);
    for (const hail of [...this.hails]) {
      hail.age += dt;
      if (!this.crowd.walkerInfo(hail.handle, this._walker)) { this._endHail(hail, 'gone'); continue; }
      const d = Math.hypot(this._walker.x - p.x, this._walker.z - p.z);
      if (this._walker.boarding) { hail.boarding = true; continue; }
      // They were walking to a seat and the cart pulled away: back to hailing.
      hail.boarding = false;
      if (hail.age > QUEST.HAIL_PATIENCE || d > QUEST.HAIL_LEASH) { this._endHail(hail, d > QUEST.HAIL_LEASH ? 'left_behind' : 'timeout'); continue; }
      if (speed < 0.6 && d < QUEST.HAIL_PICKUP) {
        if (this.crowd.hailBoard(hail.handle, this.zerble)) hail.boarding = true;
        continue;
      }
      hail.waveIn -= dt;
      if (hail.waveIn <= 0 && d < 45) {
        hail.waveIn = 3.2 + this.random() * 2;
        this.crowd.hailWave(hail.handle, this.zerble);
        if (!this._hailTip && d < 30) { this._hailTip = true; this.toast('Someone is flagging you down. Stop beside them to give them a lift!', 3600); }
      }
    }
    if (!this.hailing) return;
    this._hailIn -= dt;
    if (this._hailIn <= 0) { this._hailIn = QUEST.HAIL_EVERY; this.startHail(); }
  }

  update(dt) {
    this._updateHails(dt);
    if (!this.engine.active.length) return;
    // Notice riders who left for any other reason (ordinary timeout cannot
    // happen while held, but a dry tank, a scatter or a despawn can).
    for (const quest of [...this.engine.active]) {
      if (quest.type === 'party') continue;   // the party owner reports its own exits
      if (!this.crowd.riderInfo(quest.riderId, this._rider)) this.engine.cancel(quest.riderId, this._emit, 'left');
    }
    this.engine.update(dt, this._player(), this._emit);
  }

  clear() { for (const hail of [...this.hails]) this._endHail(hail, 'reset'); for (const q of [...this.engine.active]) if (q.type !== 'party') this.crowd.holdRide(q.riderId, false); this.engine.clear(this._emit); }

  _spawnBurst(count) {
    const p = this.zerble.position;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.random() * 0.6;
      const r = 3.2 + this.random() * 2.2;
      this._burst.x = p.x + Math.cos(a) * r; this._burst.y = p.y + this.random() * 0.8; this._burst.z = p.z + Math.sin(a) * r;
      this.smiles.spawn(this._burst);
    }
  }

  _handle(type, quest, data) {
    this.lastEvent = { type, kind: quest.kind, riderId: quest.riderId, ...data };
    const solo = quest.type !== 'party';
    const party = solo ? null : this.parties.get(quest.riderId);
    if (type !== 'offered' && type !== 'hint' && type !== 'near' && type !== 'missed' && type !== 'via') this.parties.delete(quest.riderId);
    // Riders speak in quotes; a party's lines are narration.
    const say = (icon, line, tail = '') => (solo ? `${icon} “${line}”${tail}` : `🙏 ${line}${tail}`);
    switch (type) {
      case 'offered':
        this.toast(say('💭', data.line), quest.type === 'urgent' ? 3600 : 3000);
        this.sound?.playQuestAsk?.(quest.type === 'urgent');
        this.analytics?.questOffered?.(quest.type, quest.kind, quest.startDist);
        break;
      case 'hint': case 'near': case 'missed': case 'via':
        this.toast(say('💭', data.line), 2400);
        break;
      case 'arrived':
        if (solo) {
          this.crowd.endRide(quest.riderId, this.zerble, { celebrate: CELEBRATE_SECONDS });
          if (quest.type === 'urgent') this.crowd.sendToPotty(quest.riderId);
        } else party?.leave();
        this._spawnBurst(data.reward);
        {
          const total = this.log ? this.log.record({ type: quest.type, kind: quest.kind, label: quest.label, reward: data.reward }) : 0;
          this.toast(say('😄', data.line, `  +${data.reward}${total ? `  ·  ride #${total}` : ''}`), 2800);
          this.onCompleted(quest, this.log);
        }
        this.sound?.playQuestArrive?.();
        this.analytics?.questCompleted?.(quest.type, quest.kind, quest.age, data.reward, quest.missed);
        break;
      case 'gaveUp':
        if (solo) this.crowd.holdRide(quest.riderId, false); else party?.leave();
        this.toast(say('💭', data.line), 2800);
        this.analytics?.questEnded?.(quest.type, quest.kind, 'gave_up', quest.age);
        break;
      case 'failed':
        if (solo) this.crowd.endRide(quest.riderId, this.zerble, { flee: true });
        this.deductSmiles(data.penalty);
        this.toast(`😳 “${data.line}”  −${data.penalty}`, 3200);
        this.sound?.playQuestFail?.();
        this.analytics?.questEnded?.(quest.type, quest.kind, 'failed', quest.age);
        break;
      case 'cancelled':
        // The rider is already gone or the world reset; release the hold if
        // they are somehow still seated.
        if (solo) this.crowd.holdRide(quest.riderId, false);
        if (data.reason === 'left') this.analytics?.questEnded?.(quest.type, quest.kind, 'left', quest.age);
        break;
    }
    for (const listener of this.listeners) listener(type, quest, data);
  }

  snapshot() {
    return { enabled: this.enabled, completed: this.engine.completed, offered: this.engine.offeredEver,
      hails: this.hails.map((h) => ({ id: h.id, type: h.plan.type, kind: h.plan.dest.kind, label: h.label, age: Math.round(h.age), boarding: h.boarding })),
      log: this.log?.snapshot() ?? null,
      lastGatherMs: +this.lastGatherMs.toFixed(2), lastEvent: this.lastEvent, active: this.engine.snapshot() };
  }
}
