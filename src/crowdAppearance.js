import { mulberry32, worldHash } from './rng.js';

export const CROWD_SKIN = [0xf0c9a6, 0xdba77f, 0xc98e68, 0xa96f50, 0x80543f, 0x5b3b31];
export const CROWD_HAIR = [0x201b1a, 0x44302a, 0x70462f, 0xb47b3f, 0xc6b8a1, 0x4c5360];
export const CROWD_SHIRTS = [
  0xb95d67, 0xc38a50, 0x638978, 0x547c94, 0x8b719c, 0xd0b878,
  0x9c5942, 0x6c8390, 0x9d8069, 0x698365, 0xc16f54, 0x827a9b,
];
export const CROWD_ACCENTS = [0xe2c88c, 0xc7d5c2, 0xd7a0a4, 0x99b4bf, 0xd9d1b8, 0x91a58e];
export const CROWD_DRINKS = [0xd99a4f, 0xb85c4d, 0x6f9b81, 0xc5b36a];

export function crowdAppearanceRng(pos) {
  const x = Math.round(pos.x * 256);
  const z = Math.round(pos.z * 256);
  return mulberry32(worldHash(x, z, 0x43525041));
}

export function rollCrowdAppearance(rng) {
  const pick = (values) => values[Math.floor(rng() * values.length)];
  const hasDrink = rng() < 0.07;
  const tieDye = rng() < 0.32;
  return {
    skin: pick(CROWD_SKIN),
    hair: pick(CROWD_HAIR),
    shirt: pick(CROWD_SHIRTS),
    accent: pick(CROWD_ACCENTS),
    outfit: Math.floor(rng() * 4),
    hairStyle: Math.floor(rng() * 3),
    tieDye,
    tieDyeAmount: tieDye ? 0.4 + rng() * 0.6 : 0,
    hasDrink,
    drink: hasDrink ? pick(CROWD_DRINKS) : CROWD_DRINKS[0],
  };
}
