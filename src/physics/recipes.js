// Experimental contact recipes in model-local metres. These deliberately retain
// open space beneath the seat; they are not a collider per decorative tube.
const box = (x, y, z, hx, hy, hz, density = 120) => ({
  shape: 'cuboid', halfExtents: { x: hx, y: hy, z: hz },
  position: { x, y, z }, density, friction: .65, restitution: .06,
  collisionEvents: true, forceEvents: true, forceThreshold: 2,
});
export function chairRecipe(style = 'sling') {
  if (!['sling', 'director', 'low', 'loveseat'].includes(style)) throw new RangeError('Unknown chair style');
  const low = style === 'low', double = style === 'loveseat';
  const width = double ? 1.1 : .58, depth = low ? .54 : .48;
  const seat = low ? .25 : style === 'director' ? .48 : .44;
  const back = low ? .56 : style === 'director' ? .38 : .49;
  const parts = [box(0, seat - .03, 0, width / 2, .03, depth / 2),
    box(0, seat + back / 2, -depth / 2 - (low ? .075 : .02), width / 2, back / 2, .025, 60)];
  for (const x of [-width / 2, width / 2]) for (const z of [-depth / 2, depth / 2]) {
    parts.push(box(x, seat / 2, z, .035, seat / 2, .035, 180));
  }
  return parts;
}
export function coolerRecipe() { return [box(0, .225, 0, .31, .225, .225, 180)]; }
