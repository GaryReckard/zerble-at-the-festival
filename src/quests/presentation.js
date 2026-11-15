// Everything the player SEES of a passenger quest that is not a toast:
// thought bubbles over riders, the compass strip and festival-map pins.
// It subscribes to the QuestRuntime, so the rules stay free of three.js and
// the DOM, and each layer may be absent (sandbox, tests, a hidden compass).
import { QuestBubbles, iconDataURL } from '../models/questBubble.js';
import { QuestCompass } from '../questHud.js';

const COMPASS_KEY = 'zerble.questCompass';   // 'off' hides the strip; absent = on

export function compassPreference() {
  try { return localStorage.getItem(COMPASS_KEY) !== 'off'; } catch { return true; }
}

export class QuestPresentation {
  constructor({ runtime, crowd, zerble, scene, compassRoot = null, festivalMap = null, reducedMotion = () => false, hum = null }) {
    Object.assign(this, { runtime, crowd, zerble, festivalMap, reducedMotion, hum });
    this._humIn = 6;
    this.bubbles = new QuestBubbles(scene, 4);
    this.compass = compassRoot ? new QuestCompass(compassRoot, {
      iconURL: iconDataURL,
      // Tapping a chip points the festival map's tracker at that stop.
      onPick: (id) => { festivalMap?.track(`quest:${id}`); },
    }) : null;
    this.compass?.setVisible(compassPreference());
    this.time = 0;
    this._pinsDirty = false;
    this._rider = {};
    this._player = { x: 0, z: 0, heading: 0 };
    this._off = runtime.subscribe((type, quest) => {
      if (type === 'offered') { this.bubbles.show(quest.id, quest.icon, this.time); this._pinsDirty = true; }
      else if (type === 'arrived' || type === 'gaveUp' || type === 'failed' || type === 'cancelled') { this.bubbles.hide(quest.id); this._pinsDirty = true; }
    });
  }

  setCompassVisible(on) {
    try { if (on) localStorage.removeItem(COMPASS_KEY); else localStorage.setItem(COMPASS_KEY, 'off'); } catch {}
    this.compass?.setVisible(on);
  }
  get compassVisible() { return this.compass?.visible ?? false; }

  update(dt) {
    this.time += dt;
    const quests = this.runtime.active;
    const motion = this.reducedMotion();
    let stack = 0;
    for (const quest of quests) {
      const options = { warmth: quest.warmth, urgent: quest.type === 'urgent', reducedMotion: motion };
      if (quest.type === 'party') {
        // One shared bubble floats over the cart for a whole party.
        const p = this.zerble.position;
        this.bubbles.place(quest.id, p.x, p.y + 4.6, p.z, options, this.time);
      } else if (this.crowd.riderInfo(quest.riderId, this._rider)) {
        // Bench riders sit shoulder to shoulder, so later bubbles step upward.
        this.bubbles.place(quest.id, this._rider.x, this._rider.y, this._rider.z, { ...options, stack: stack++ }, this.time);
      }
    }
    // The warmest rider hums now and then; louder as the stop nears.
    if (quests.length && this.hum) {
      this._humIn -= dt;
      if (this._humIn <= 0) {
        let warmest = 0;
        for (const quest of quests) if (quest.type !== 'urgent') warmest = Math.max(warmest, quest.warmth);
        this.hum(warmest);
        this._humIn = 5 + Math.random() * 5 - 3 * warmest;
      }
    }
    if (this.compass && (quests.length || this.compass.chips.size)) {
      const p = this.zerble.position;
      this._player.x = p.x; this._player.z = p.z; this._player.heading = this.zerble.heading;
      this.compass.sync(quests, this._player);
    }
    if (this._pinsDirty && this.festivalMap) {
      this._pinsDirty = false;
      this.festivalMap.setObjectives(quests.map((q) => ({ id: `quest:${q.id}`, x: q.x, z: q.z, label: q.short })));
    }
  }

  dispose() { this._off(); this.bubbles.dispose(); }
}
