// Pure defining dimensions and colors shared by the built models and the
// far-field silhouettes. Keep placement and decorative variation elsewhere.
export const STAGE_SHAPES = Object.freeze({
  main: Object.freeze({ width: 24, depth: 12, trussHeight: 9, roofRise: 2.6,
    roofOverhang: 1, roofColor: 0x6e4a2c, hasRoof: true }),
  side: Object.freeze({ width: 14, depth: 8, trussHeight: 9, roofRise: 0,
    roofOverhang: 0, roofColor: null, hasRoof: false }),
});

export const MARQUEE_SHAPE = Object.freeze({
  width: 28, depth: 38, eaveHeight: 5.5, ridgeHeight: 11,
  roofColor: 0xfff8eb,
});

export const VENDOR_ROOF_SHAPE = Object.freeze({
  radius: 3.2, height: 1.8, centerY: 3.4, color: 0xfff8eb,
});
