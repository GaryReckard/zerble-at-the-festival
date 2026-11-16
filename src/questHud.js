// The quest compass strip: one chip per active passenger request, showing the
// destination icon, an arrow relative to the cart's nose and the distance
// left. Pure DOM; it only writes when a chip's quantized state changes.
import { chipState } from './quests/compassMath.js';

export class QuestCompass {
  constructor(root, { iconURL = () => '', onPick = null } = {}) {
    this.root = root;
    this.iconURL = iconURL;
    this.onPick = onPick;
    this.chips = new Map();   // quest id -> { el, arrow, text, clock, last }
    this.visible = true;
    const heading = document.createElement('div');
    heading.className = 'quest-heading'; heading.textContent = 'Passenger rides';
    const help = document.createElement('div');
    help.className = 'quest-help'; help.textContent = 'Follow arrows · tap to track on map';
    this.heading = heading; this.help = help;
    this.cards = document.createElement('div');
    this.cards.className = 'quest-cards';
    root.append(heading, help, this.cards);
    // Content and viewport changes schedule measurement outside the game loop.
    this._measure = () => {
      const bottom = this.visible && this.chips.size ? root.getBoundingClientRect().bottom + 8 : 0;
      root.parentElement?.style.setProperty('--quest-toast-top', `${bottom}px`);
    };
    this._resize = typeof ResizeObserver === 'function' ? new ResizeObserver(this._measure) : null;
    this._resize?.observe(root);
    globalThis.addEventListener?.('resize', this._measure);

    if (onPick) {
      // Preserve native button activation without also triggering the cart's horn.
      this._keydown = (event) => {
        if (event.key === ' ' && event.target.closest?.('button.quest-chip')) event.stopPropagation();
      };
      root.addEventListener('keydown', this._keydown);
      // #hud ignores pointer events; the strip's stylesheet re-enables its chips.
      this._click = (event) => {
        const chip = event.target.closest?.('.quest-chip');
        if (chip) onPick(Number(chip.dataset.quest));
      };
      root.addEventListener('click', this._click);
    }
  }

  setVisible(on) {
    this.visible = !!on;
    this.root.classList.toggle('hidden', !this.visible || this.chips.size === 0);
    this._measure();
  }

  _create(state) {
    const el = document.createElement(this.onPick ? 'button' : 'div');
    if (this.onPick) el.type = 'button';
    el.className = 'quest-chip';
    el.dataset.quest = String(state.id);
    const icon = document.createElement('img');
    icon.className = 'quest-icon'; icon.alt = ''; icon.src = this.iconURL(state.icon); icon.draggable = false;
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('class', 'quest-arrow'); arrow.setAttribute('viewBox', '0 0 24 32'); arrow.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 29V4M4 12L12 4L20 12');
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '3'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
    arrow.append(path);
    const direction = document.createElement('span'); direction.className = 'quest-direction';
    const copy = document.createElement('span'); copy.className = 'quest-copy';
    const name = document.createElement('span'); name.className = 'quest-name'; name.textContent = state.label;
    const help = document.createElement('span'); help.className = 'quest-rule'; help.textContent = state.help;
    copy.append(name, help);
    const text = document.createElement('span'); text.className = 'quest-dist';
    const clock = document.createElement('span'); clock.className = 'quest-clock';
    const navigation = document.createElement('span'); navigation.className = 'quest-navigation';
    navigation.append(arrow, direction, text, clock);
    el.append(icon, copy, navigation);
    this.cards.append(el);
    return { el, arrow, direction, text, clock, last: {} };
  }

  // `quests` is the engine's active list; `player` is { x, z, heading }.
  sync(quests, player) {
    const live = new Set();
    for (const quest of quests) {
      const state = chipState(quest, player);
      live.add(state.id);
      let chip = this.chips.get(state.id);
      if (!chip) { chip = this._create(state); this.chips.set(state.id, chip); }
      const last = chip.last;
      if (last.angle !== state.angle) {
        // Accumulate the shortest turn so the arrow never spins the long way
        // round when the bearing crosses straight behind (the ±180° wrap).
        const from = chip.shown ?? state.angle;
        chip.shown = from + ((((state.angle - from) % 360) + 540) % 360 - 180);
        chip.arrow.style.transform = `rotate(${chip.shown}deg)`;
      }
      if (last.direction !== state.direction) chip.direction.textContent = state.direction;
      if (last.showArrow !== state.showArrow) chip.el.classList.toggle('has-direction', state.showArrow);
      if (last.text !== state.text) chip.text.textContent = state.text;
      if (last.clock !== state.clock) chip.clock.textContent = state.clock;
      if (last.warm !== state.warm) chip.el.style.setProperty('--warm', String(state.warm));
      if (last.inside !== state.inside) chip.el.classList.toggle('is-inside', state.inside);
      if (last.urgent !== state.urgent) chip.el.classList.toggle('is-urgent', state.urgent);
      if (last.text !== state.text || last.clock !== state.clock || last.direction !== state.direction) {
        chip.el.setAttribute('aria-label', `${state.label}: ${state.direction ? `${state.direction}, ` : ''}${state.text}${state.clock ? `, ${state.clock} left` : ''}. ${state.help}. Tap to track on the map.`);
      }
      chip.last = state;
    }
    for (const [id, chip] of this.chips) if (!live.has(id)) { chip.el.remove(); this.chips.delete(id); }
    this.root.classList.toggle('hidden', !this.visible || this.chips.size === 0);
  }

  dispose() {
    this._resize?.disconnect();
    globalThis.removeEventListener?.('resize', this._measure);
    if (this._keydown) this.root.removeEventListener('keydown', this._keydown);
    if (this._click) this.root.removeEventListener('click', this._click);
    this.heading.remove(); this.help.remove(); this.cards.remove();
    this.chips.clear();
    this.root.classList.add('hidden');
    this.root.parentElement?.style.setProperty('--quest-toast-top', '0px');
  }
}
