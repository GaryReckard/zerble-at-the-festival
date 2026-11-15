// Passenger-quest thought bubbles: a small billboard above a rider's head
// showing where they want to go. One world-lifetime pool owns every sprite,
// material and texture here and none of them ever enters a chunk group, so
// this follows the instance-owned pooling shape (no `userData.shared` tags;
// dispose() is the only teardown path).
//
// The same canvas art feeds the DOM compass through iconDataURL(), so the
// icon over a rider's head and the one in the HUD always match.
import * as THREE from 'three';

const SIZE = 128;
const INK = '#3a2a4a';

// Each painter draws inside a 64-unit box centred on (0, 0).
const ICONS = {
  stage(c) {   // a deck with a pitched roof and a music note
    c.fillStyle = '#e8934a'; c.fillRect(-24, 8, 48, 10);
    c.fillStyle = '#7c4fb8'; c.beginPath(); c.moveTo(-28, -8); c.lineTo(0, -26); c.lineTo(28, -8); c.closePath(); c.fill();
    c.fillStyle = INK; c.fillRect(-23, -8, 4, 16); c.fillRect(19, -8, 4, 16);
    c.beginPath(); c.arc(-3, 3, 5, 0, Math.PI * 2); c.fill(); c.fillRect(0, -12, 3, 15); c.fillRect(0, -12, 10, 4);
  },
  tent(c) {    // a striped big top with a flag
    c.fillStyle = '#e25563'; c.beginPath(); c.moveTo(0, -24); c.lineTo(28, 2); c.lineTo(-28, 2); c.closePath(); c.fill();
    c.fillStyle = '#fff4dc'; c.beginPath(); c.moveTo(0, -24); c.lineTo(9, 2); c.lineTo(-9, 2); c.closePath(); c.fill();
    c.fillStyle = '#f2c14e'; c.fillRect(-24, 2, 48, 16);
    c.fillStyle = INK; c.fillRect(-5, 6, 10, 12); c.fillRect(-1, -32, 2, 9);
    c.fillStyle = '#4fb8a8'; c.beginPath(); c.moveTo(1, -32); c.lineTo(12, -28); c.lineTo(1, -24); c.closePath(); c.fill();
  },
  food(c) {    // a food truck with a serving hatch
    c.fillStyle = '#4fb8a8'; c.fillRect(-26, -14, 40, 26); c.fillStyle = '#3a9488'; c.fillRect(14, -4, 14, 16);
    c.fillStyle = '#fff4dc'; c.fillRect(-20, -8, 26, 11); c.fillStyle = '#e25563'; c.fillRect(-23, -18, 34, 6);
    c.fillStyle = INK; for (const x of [-15, 16]) { c.beginPath(); c.arc(x, 14, 6, 0, Math.PI * 2); c.fill(); }
  },
  market(c) {  // an awning stall with bunting
    c.fillStyle = '#8a5a3c'; c.fillRect(-22, -2, 4, 22); c.fillRect(18, -2, 4, 22); c.fillRect(-22, 8, 44, 5);
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#fff4dc' : '#e8934a'; c.fillRect(-26 + i * 13, -16, 13, 14); }
    c.fillStyle = '#7c4fb8'; c.beginPath(); c.arc(-8, 3, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4fb8a8'; c.beginPath(); c.arc(7, 3, 5, 0, Math.PI * 2); c.fill();
  },
  drum(c) {    // a hand drum with crossed lacing
    c.fillStyle = '#b8743c'; c.beginPath(); c.moveTo(-18, -12); c.lineTo(18, -12); c.lineTo(10, 20); c.lineTo(-10, 20); c.closePath(); c.fill();
    c.strokeStyle = '#fff4dc'; c.lineWidth = 3; c.beginPath(); c.moveTo(-14, -8); c.lineTo(8, 18); c.moveTo(14, -8); c.lineTo(-8, 18); c.stroke();
    c.fillStyle = '#fff4dc'; c.beginPath(); c.ellipse(0, -13, 19, 7, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  },
  camp(c) {    // a ridge tent beside a little fire
    c.fillStyle = '#5c9a4e'; c.beginPath(); c.moveTo(-8, -20); c.lineTo(18, 16); c.lineTo(-30, 16); c.closePath(); c.fill();
    c.fillStyle = INK; c.beginPath(); c.moveTo(-8, -2); c.lineTo(0, 16); c.lineTo(-16, 16); c.closePath(); c.fill();
    c.fillStyle = '#e8934a'; c.beginPath(); c.moveTo(24, 16); c.quadraticCurveTo(32, 4, 24, -6); c.quadraticCurveTo(16, 6, 24, 16); c.fill();
    c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(24, 11, 4, 0, Math.PI * 2); c.fill();
  },
  gate(c) {    // the entrance arch
    c.strokeStyle = '#e25563'; c.lineWidth = 9; c.beginPath(); c.moveTo(-20, 20); c.lineTo(-20, -4); c.arc(0, -4, 20, Math.PI, 0); c.lineTo(20, 20); c.stroke();
    c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(0, -24, 5, 0, Math.PI * 2); c.fill();
  },
  healing(c) { // a lotus
    c.fillStyle = '#c98ad6';
    for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) { c.save(); c.translate(0, 14); c.rotate(a); c.beginPath(); c.ellipse(0, -18, 7, 20, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.fillStyle = '#5c9a4e'; c.beginPath(); c.ellipse(0, 17, 24, 5, 0, 0, Math.PI * 2); c.fill();
  },
  beach(c) {   // sun over waves
    c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(8, -10, 13, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3f9ad6'; c.lineWidth = 5; c.lineCap = 'round';
    for (const y of [6, 17]) { c.beginPath(); c.moveTo(-26, y); c.quadraticCurveTo(-17, y - 8, -9, y); c.quadraticCurveTo(0, y + 8, 9, y); c.quadraticCurveTo(17, y - 8, 26, y); c.stroke(); }
  },
  hammock(c) { // a sling between two posts
    c.fillStyle = '#8a5a3c'; c.fillRect(-27, -18, 5, 38); c.fillRect(22, -18, 5, 38);
    c.fillStyle = '#e8934a'; c.beginPath(); c.moveTo(-23, -10); c.quadraticCurveTo(0, 26, 23, -10); c.quadraticCurveTo(0, 8, -23, -10); c.fill();
    c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-23, -10); c.quadraticCurveTo(0, 26, 23, -10); c.stroke();
  },
  potty(c) {   // the blue box, with urgency
    c.fillStyle = '#3f7fd6'; c.fillRect(-14, -18, 28, 38); c.fillStyle = '#2f5fa8'; c.fillRect(-17, -24, 34, 8);
    c.fillStyle = '#fff4dc'; c.fillRect(-9, -11, 18, 26); c.fillStyle = INK; c.beginPath(); c.arc(5, 3, 2.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e25563'; c.font = '900 22px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('!!', 24, -8);
  },
  mountain(c) { // twin peaks, a snow cap and a summit flag
    c.fillStyle = '#6f8f6a'; c.beginPath(); c.moveTo(-30, 18); c.lineTo(-10, -8); c.lineTo(6, 18); c.closePath(); c.fill();
    c.fillStyle = '#4f7a5c'; c.beginPath(); c.moveTo(-12, 18); c.lineTo(10, -20); c.lineTo(30, 18); c.closePath(); c.fill();
    c.fillStyle = '#fff4dc'; c.beginPath(); c.moveTo(10, -20); c.lineTo(17, -7); c.lineTo(10, -10); c.lineTo(3, -7); c.closePath(); c.fill();
    c.fillStyle = INK; c.fillRect(9, -32, 2, 13); c.fillStyle = '#e25563'; c.beginPath(); c.moveTo(11, -32); c.lineTo(22, -28); c.lineTo(11, -24); c.closePath(); c.fill();
  },
  monk(c) {    // a seated saffron figure
    c.fillStyle = '#e8934a'; c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(26, 4, 22, 20); c.lineTo(-22, 20); c.quadraticCurveTo(-26, 4, 0, -8); c.fill();
    c.fillStyle = '#d9a37a'; c.beginPath(); c.arc(0, -16, 9, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#b8743c'; c.lineWidth = 3; c.beginPath(); c.moveTo(-12, 0); c.lineTo(12, 14); c.stroke();
  },
};

export const QUEST_ICONS = Object.keys(ICONS);

// A bare icon (no bubble) for DOM use.
export function drawQuestIcon(ctx, icon, cx, cy, scale = 1) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  (ICONS[icon] || ICONS.gate)(ctx);
  ctx.restore();
}

function drawBubble(ctx, icon) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.fillStyle = '#fffaf0';
  // The cloud, then two trailing puffs toward the thinker's head.
  ctx.beginPath(); ctx.ellipse(66, 52, 54, 46, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(30, 104, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(14, 120, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  drawQuestIcon(ctx, icon, 66, 54, 1.32);
}

const _dataUrls = new Map();
export function iconDataURL(icon) {
  if (!_dataUrls.has(icon)) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
    drawQuestIcon(canvas.getContext('2d'), icon, 48, 48, 1.35);
    _dataUrls.set(icon, canvas.toDataURL());
  }
  return _dataUrls.get(icon);
}

const BASE_SCALE = 1.45;   // metres wide; reads at chase-camera distance without hiding the rider

export class QuestBubbles {
  constructor(scene, capacity = 4) {
    this.group = new THREE.Group();
    this.group.name = 'Passenger quest thought bubbles';
    scene.add(this.group);
    this._textures = new Map();
    this._slots = [];
    this._byId = new Map();
    for (let i = 0; i < capacity; i++) {
      // depthTest off: a bubble must stay readable through the cart roof and
      // foreground soap bubbles. Fog and tone mapping off keep the white card
      // legible at night; it is UI that happens to live in the world.
      const material = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false; sprite.renderOrder = 900; sprite.center.set(0.2, 0);   // anchored at the trailing puff
      this.group.add(sprite);
      this._slots.push({ sprite, material, id: null, shownAt: 0 });
    }
  }

  _texture(icon) {
    if (!this._textures.has(icon)) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
      drawBubble(canvas.getContext('2d'), icon);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      this._textures.set(icon, texture);
    }
    return this._textures.get(icon);
  }

  has(id) { return this._byId.has(id); }

  show(id, icon, time = 0) {
    let slot = this._byId.get(id) || this._slots.find((s) => s.id === null);
    if (!slot) return false;
    slot.id = id; slot.shownAt = time;
    slot.material.map = this._texture(icon); slot.material.needsUpdate = true;
    slot.sprite.visible = true;
    this._byId.set(id, slot);
    return true;
  }

  hide(id) {
    const slot = this._byId.get(id);
    if (!slot) return false;
    slot.sprite.visible = false; slot.id = null;
    this._byId.delete(id);
    return true;
  }

  hideAll() { for (const id of [...this._byId.keys()]) this.hide(id); }

  // `warmth` 0..1 brightens and, near the stop, pulses the bubble. `urgent`
  // makes it jitter. `stack` lifts a bubble clear of a neighbour's.
  place(id, x, y, z, { warmth = 0, urgent = false, stack = 0, reducedMotion = false } = {}, time = 0) {
    const slot = this._byId.get(id);
    if (!slot) return;
    const pop = Math.min(1, (time - slot.shownAt) / 0.35);              // appear with a little spring
    const spring = pop < 1 ? pop * (1.25 - 0.25 * pop) : 1;
    const pulse = reducedMotion ? 0 : warmth > 0.82 ? 0.09 * Math.sin(time * 7) : 0.025 * Math.sin(time * 2.2);
    const jitter = urgent && !reducedMotion ? 0.05 * Math.sin(time * 31) : 0;
    const scale = BASE_SCALE * (0.92 + 0.16 * warmth + pulse) * spring;
    slot.sprite.scale.set(scale, scale, 1);
    slot.sprite.position.set(x + jitter, y + 0.25 + stack * 0.5, z);
    slot.material.opacity = 0.55 + 0.45 * Math.min(1, warmth * 1.6);
    slot.material.color.setScalar(urgent ? 1 : 0.9 + 0.1 * warmth);
    if (urgent) slot.material.color.setRGB(1, 0.86 + 0.14 * Math.sin(time * 9) ** 2, 0.86 + 0.14 * Math.sin(time * 9) ** 2);
  }

  dispose() {
    for (const slot of this._slots) slot.material.dispose();
    for (const texture of this._textures.values()) texture.dispose();
    this._textures.clear(); this._byId.clear();
    this.group.removeFromParent();
  }
}
