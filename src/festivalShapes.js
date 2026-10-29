import { worldHash, mulberry32 } from './rng.js';

// Pure defining dimensions and colors shared by the built models and the
// far-field silhouettes, plus the pure canopy appearance selector shared by
// both representations. This module never builds render resources.
export const STAGE_SHAPES = Object.freeze({
  main: Object.freeze({ width: 24, depth: 12, trussHeight: 9, roofRise: 2.6,
    roofOverhang: 1, roofColor: 0x6e4a2c, hasRoof: true }),
  side: Object.freeze({ width: 14, depth: 8, trussHeight: 9, roofRise: 0,
    roofOverhang: 0, roofColor: null, hasRoof: false }),
});

export const STAGE_SURFACES = Object.freeze({
  deckHeight: 1.5, deckColor: 0x4a3a2a,
  bannerHeight: 7, bannerCenterY: 4.5, bannerThickness: 0.4,
  mainBannerColor: 0x6fcf6a,
  sideBannerColors: Object.freeze([0xff9a8b, 0xc77dff, 0x66d9ff, 0xffd28a]),
});

export const MARQUEE_SHAPE = Object.freeze({
  width: 28, depth: 38, eaveHeight: 5.5, ridgeHeight: 11,
  roofColor: 0xfff8eb,
});

export const VENDOR_ROOF_SHAPE = Object.freeze({
  radius: 3.2, height: 1.8, centerY: 3.4,
});

export const VENDOR_LEG_SHAPE = Object.freeze({
  offset: 2, height: 2.5, width: .15, color: 0x3a2e22,
});

// Shared visual vocabulary for vendor EZ-ups. Position-keyed appearance is
// independent of skipped neighbours and their variable-length builder RNG.
export const VENDOR_CANOPY_PALETTES = Object.freeze([
  { roof: 0xe87859, cloth: 0xf2c0a7 }, // coral
  { roof: 0x4f9b69, cloth: 0xb8d59a }, // leaf green
  { roof: 0x4f7faf, cloth: 0xaac9dc }, // blue
  { roof: 0xc39437, cloth: 0xe6ce8a }, // marigold
  { roof: 0x9165a5, cloth: 0xd0b3d8 }, // violet
  { roof: 0x369b91, cloth: 0x9dd1bd }, // teal
].map(Object.freeze));
export const VENDOR_TRIM_COLORS = Object.freeze([
  0xff6f9c, 0x6fcf6a, 0xffd28a, 0xb285ff, 0x66d9ff, 0xff8a5b,
]);
export function vendorCanopyAppearance(x, z) {
  const rng = mulberry32(worldHash(Math.round(x * 256), Math.round(z * 256), 0x455a5550));
  const palette = VENDOR_CANOPY_PALETTES[Math.floor(rng() * VENDOR_CANOPY_PALETTES.length)];
  const roofYaw = Math.PI / 4 + (rng() - .5) * .06;
  const trim = VENDOR_TRIM_COLORS[Math.floor(rng() * VENDOR_TRIM_COLORS.length)];
  return { ...palette, roofYaw, trim };
}
