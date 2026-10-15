export const SPECIAL = Object.freeze({
  baseRate: 0.5,
  rateMaxMult: 3,
  blastMult: 2,
  sizeMin: 1.6,
  sizeMax: 2.4,
  lifeMult: 1.2,
  pool: 48,
  burstSec: 4,
  burstRate: 6,
  nightMin: 0.6,
});

export const CHARM = Object.freeze({ perUpgrade: 0.04, maxLevel: 10 });

export const CHALLENGE = Object.freeze({
  musicStages: 3,
  stageRadius: 30,
  rainbowHubs: 8,
  drumRadius: 20,
  shoreRing: 18,
  paradeRadius: 20,
  bandRadius: 15,
  lifetimeSmiles: 1000,
  tickSec: 0.5,
});

const pop = (colors, count, life = 0.45, speed = 1, rise = 0) => ({ colors, count, life, speed, rise });
const look = (shell, tint, anim = 'steady', nightBoost = 0.4, scale = [1, 1, 1], droplets = pop([tint], 10)) => ({
  shell, tint, anim, nightBoost, scale, pop: droplets,
});

export const BUBBLE_TYPES = Object.freeze([
  { id: 'heart', name: 'Heart Bubbles', order: 1, secret: false, hint: 'Somebody special is cruising the grounds. Go find her.', earnedLine: null,
    look: look('heart', 0xff5fa2, 'steady', 0.4, [1, 1, 1], pop([0xff5fa2, 0xffd1e6], 12)),
    boost: (ctx) => ctx.lurleenNear ? 4 : 1 },
  { id: 'music', name: 'Music Bubbles', order: 2, secret: false, hint: 'Catch three different stages.', earnedLine: null,
    look: look('sphere', 0x8a7dff, 'pulse', 0.3, [1, 1, 1], pop([0x8a7dff, 0x56e0c2], 10)),
    boost: (ctx) => ctx.nearStage ? 3 : 1 },
  { id: 'ember', name: 'Ember Bubbles', order: 3, secret: false, hint: 'Join a drum circle after dark.', earnedLine: null,
    look: look('sphere', 0xff8a2a, 'flicker', 0.55, [1, 1, 1], pop([0xff8a2a, 0xffc05a], 10, 0.8, 0.7, 0.25)),
    boost: (ctx) => ctx.nearDrum ? 3 : (ctx.nightness >= SPECIAL.nightMin ? 1.5 : 1) },
  { id: 'firefly', name: 'Firefly Bubbles', order: 4, secret: false, hint: "Find the water's edge at night.", earnedLine: null,
    look: look('sphere', 0x2f5a4a, 'blink', 0.2, [1, 1, 1], pop([0xd8ff6a, 0xb7e65a], 6, 1, 0.55)),
    boost: (ctx) => ctx.nightness >= SPECIAL.nightMin ? 2 : (ctx.nightness < 0.1 ? 0.5 : 1) },
  { id: 'rainbow', name: 'Rainbow Bubbles', order: 5, secret: false, hint: 'Roam far: reach eight festival hubs in one trip.', earnedLine: null,
    look: look('sphere', 0xffffff, 'hue', 0.25, [1, 1, 1], pop([0xff5fa2, 0xffd84a, 0x49d9c7, 0x8a7dff], 12)),
    boost: () => 1 },
  { id: 'sparkler', name: 'Sparkler Bubbles', order: 6, secret: false, hint: 'Stay up for the midnight fireworks.', earnedLine: null,
    look: look('sphere', 0xffe39a, 'twinkle', 0.65, [1, 1, 1], pop([0xffe39a, 0xffffff], 14, 0.6, 1.5)),
    boost: (ctx) => ctx.nightness >= SPECIAL.nightMin ? 2 : 1 },
  { id: 'lantern', name: 'Lantern Bubbles', order: 7, secret: false, hint: 'Catch up to the lantern parade.', earnedLine: null,
    look: look('sphere', 0xff6a3d, 'lantern', 0.75, [1, 1.2, 1], pop([0xff6a3d, 0xffbb66], 8)),
    boost: (ctx) => ctx.nearParade ? 3 : (ctx.nightness >= SPECIAL.nightMin ? 1.5 : 1) },
  { id: 'smile', name: 'Smile Bubbles', order: 8, secret: false, hint: 'Collect 1,000 smiles, all-time.', earnedLine: null,
    look: look('sphere', 0xffd84a, 'steady', 0.25, [1, 1, 1], pop([0xffd84a, 0xfff2a6], 10)),
    boost: () => 1 },
  { id: 'confetti', name: 'Confetti Bubbles', order: 9, secret: false, hint: 'Make it to day two of a Festival Run.', earnedLine: null,
    look: look('sphere', 0xff8ab4, 'confetti', 0.25, [1, 1, 1], pop([0xff8ab4, 0xffdf78, 0x76ddc5, 0xa996ff], 16, 0.8, 0.7, -0.3)),
    boost: () => 1 },
  { id: 'mushroom', name: 'Mushroom Bubbles', order: 10, secret: true, hint: 'Never shown before it is earned.', earnedLine: 'A gift from a new friend.',
    look: look('sphere', 0x9b5de5, 'swirl', 0.35, [1, 1, 1], pop([0x9b5de5, 0x3ddc97], 10)),
    boost: (ctx) => ctx.tripActive ? 3 : 1 },
  { id: 'brass', name: 'Brass Bubbles', order: 11, secret: false, hint: 'Roll with the brass band.', earnedLine: null,
    look: look('sphere', 0xd9a520, 'glint', 0.4, [1, 1, 1], pop([0xd9a520, 0xffe39a], 10)),
    boost: (ctx) => ctx.nearBand ? 3 : 1 },
]);

const TYPE_BY_ID = new Map(BUBBLE_TYPES.map((type) => [type.id, type]));
const CONFETTI = [0xff8ab4, 0xffdf78, 0x76ddc5, 0xa996ff];
const TAU = Math.PI * 2;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function pickSpecial(eligibleIds, ctx = {}, rand = Math.random) {
  let total = 0;
  for (let i = 0; i < eligibleIds.length; i++) {
    const id = eligibleIds[i];
    const type = TYPE_BY_ID.get(id);
    if (type) total += Math.max(0, type.boost(ctx));
  }
  if (!(total > 0)) return null;
  let roll = rand() * total;
  for (let i = 0; i < eligibleIds.length; i++) {
    const id = eligibleIds[i];
    const type = TYPE_BY_ID.get(id);
    if (!type) continue;
    roll -= Math.max(0, type.boost(ctx));
    if (roll < 0) return id;
  }
  return null;
}

export function specialRate(eligibleIds, ctx = {}) {
  let maxWeight = 0;
  for (let i = 0; i < eligibleIds.length; i++) {
    const id = eligibleIds[i];
    const type = TYPE_BY_ID.get(id);
    if (type) maxWeight = Math.max(maxWeight, type.boost(ctx));
  }
  return maxWeight > 0 ? SPECIAL.baseRate * clamp(maxWeight, 1, SPECIAL.rateMaxMult) : 0;
}

export function charmLevel(earnedCount) {
  return Math.min(CHARM.maxLevel, Math.max(0, Math.floor(Number.isFinite(earnedCount) ? earnedCount : 0)));
}

export function charmGain(level) {
  return 1 + CHARM.perUpgrade * Math.min(CHARM.maxLevel, Math.max(0, Math.floor(Number.isFinite(level) ? level : 0)));
}

function rgb(hex, out) {
  out.r = ((hex >> 16) & 255) / 255;
  out.g = ((hex >> 8) & 255) / 255;
  out.b = (hex & 255) / 255;
}

function hsvToRgb(h, out) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = 0;
  const q = 1 - f;
  const t = f;
  switch (i % 6) {
    case 0: out.r = 1; out.g = t; out.b = p; break;
    case 1: out.r = q; out.g = 1; out.b = p; break;
    case 2: out.r = p; out.g = 1; out.b = t; break;
    case 3: out.r = p; out.g = q; out.b = 1; break;
    case 4: out.r = t; out.g = p; out.b = 1; break;
    default: out.r = 1; out.g = p; out.b = q; break;
  }
}

function mixHex(a, b, amount, out) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  out.r = (ar + (br - ar) * amount) / 255;
  out.g = (ag + (bg - ag) * amount) / 255;
  out.b = (ab + (bb - ab) * amount) / 255;
}

export function computeTint(bubbleLook, t, nightness, seed, out) {
  const phase = (Number.isFinite(seed) ? seed : 0) * TAU;
  const time = Number.isFinite(t) ? t : 0;
  const night = clamp(Number.isFinite(nightness) ? nightness : 0, 0, 1);
  const base = bubbleLook.tint >>> 0;
  let brightness = 1 + (bubbleLook.nightBoost || 0) * night;
  let scale = 1;

  switch (bubbleLook.anim) {
    case 'pulse': {
      const wave = Math.sin(time * TAU * 2 + phase);
      scale = 1 + wave * 0.08;
      brightness += wave * 0.08;
      rgb(base, out);
      break;
    }
    case 'flicker': {
      brightness += 0.12 * Math.sin(time * 17 + phase) + 0.07 * Math.sin(time * 31 + phase * 1.7);
      rgb(base, out);
      break;
    }
    case 'blink': {
      const blink = Math.pow(Math.max(0, Math.sin(time * 2.2 + phase)), 8);
      brightness += blink * 1.2 - 0.08;
      mixHex(base, 0xd8ff6a, blink, out);
      break;
    }
    case 'hue':
      hsvToRgb(((time * 0.3 + seed) % 1 + 1) % 1, out);
      break;
    case 'twinkle': {
      const wave = Math.max(0, Math.sin(time * 4.3 + phase));
      brightness += wave * wave * wave * 0.75;
      rgb(base, out);
      break;
    }
    case 'lantern':
      brightness = 0.58 + night * 0.72;
      rgb(base, out);
      break;
    case 'confetti':
      rgb(CONFETTI[Math.floor((((seed % 1) + 1) % 1) * CONFETTI.length)], out);
      break;
    case 'swirl': {
      const blend = (Math.sin(time * TAU / 6 + phase) + 1) * 0.5;
      scale = 1 + Math.sin(time * TAU * 0.4 + phase) * 0.06;
      mixHex(0x9b5de5, 0x3ddc97, blend, out);
      break;
    }
    case 'glint': {
      const wave = Math.max(0, Math.cos(time * TAU / 1.5 + phase));
      brightness += wave * wave * 0.65;
      rgb(base, out);
      break;
    }
    default:
      rgb(base, out);
  }

  out.r = clamp(out.r, 0, 1);
  out.g = clamp(out.g, 0, 1);
  out.b = clamp(out.b, 0, 1);
  out.a = Math.max(0, brightness);
  return scale;
}

export function visibleCatalog(earnedSet) {
  const earned = earnedSet instanceof Set ? earnedSet : new Set(earnedSet || []);
  const entries = BUBBLE_TYPES.filter((type) => !type.secret || earned.has(type.id));
  const found = entries.reduce((count, type) => count + (earned.has(type.id) ? 1 : 0), 0);
  return { entries, found, total: entries.length };
}
