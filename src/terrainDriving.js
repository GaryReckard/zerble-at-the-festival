// Opt-in grounded arcade movement. The live flat-world path remains unchanged.
import { steerDirFor } from './steering.js';
const probe = {};
const nextProbe = {};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export function stepTerrainDrive(cart, input, dt, sample) {
  // Bounded substeps keep grade transitions and braking stable at 30/60/120 Hz.
  let remaining = clamp(dt, 0, 0.1);
  while (remaining > 1e-9) {
    const h = Math.min(remaining, 1 / 120); remaining -= h;
    sample(cart.position.x, cart.position.z, probe);
    const throttle = clamp(input.throttle || 0, -1, 1);
    const cap = (input.slow ? 7.2 : input.boost && !cart.sputtering ? 27.9 : 18) * (cart.sputtering ? 0.35 : 1);
    const dir = input.steeringDirection?.(cart.speed) ?? steerDirFor(throttle, cart.speed);
    cart.heading += (input.steer || 0) * 2.1 * clamp(Math.abs(cart.speed) / 6, 0.2, 1) * dir * h;
    const fx = -Math.sin(cart.heading), fz = -Math.cos(cart.heading);
    const grade = probe.dx * fx + probe.dz * fz;
    const tangent = 1 / Math.hypot(1, grade);
    const gravity = -9.81 * grade * tangent;
    const braking = input.brake || (throttle !== 0 && throttle * cart.speed < -0.05);
    if (braking) {
      cart.speed = Math.sign(cart.speed) * Math.max(0, Math.abs(cart.speed) - (28 * (input.slow ? 0.45 : 1) - Math.abs(gravity)) * h);
    } else if (!throttle && Math.abs(cart.speed) < 0.15) {
      cart.speed = 0; // Parking hold on the supported fixture.
    } else {
      const poweredCap = throttle < 0 ? 7 : cap;
      // Match the game's acceleration, boost, slow mode and release drag on
      // level ground. Grade changes propulsion without replacing its feel.
      const slowScale = input.slow ? 0.45 : 1;
      if (throttle) {
        cart.speed += (throttle * 18 * slowScale + gravity) * h;
        const gradeCap = poweredCap - grade * Math.sign(throttle) * 10;
        cart.speed = clamp(cart.speed, throttle < 0 ? -Math.max(2, gradeCap) : -7,
          throttle > 0 ? Math.max(2, gradeCap) : cap);
      } else {
        cart.speed = cart.speed * Math.pow(0.78, h * 4) + gravity * h;
        if (Math.abs(cart.speed) < 0.3) cart.speed = 0;
      }
      if (input.slow && cart.speed > cap) cart.speed = Math.max(cap, cart.speed - 8.1 * h);
    }
    const x = cart.position.x + fx * cart.speed * tangent * h;
    const z = cart.position.z + fz * cart.speed * tangent * h;
    sample(x, z, nextProbe);
    if (nextProbe.traversable === false) cart.speed = 0;
    else { cart.position.x = x; cart.position.z = z; }
    cart.terrainGrade = grade;
  }
}

export const TERRAIN_REPLAY_SECONDS = 28;
// Recorded intent: accelerate up the ridge, coast over/down it, drive to the
// plateau, then brake and hold. Time is simulation time, never wall time.
export function terrainReplayInput(time, out = {}) {
  out.throttle = time < 8.8 || (time >= 10 && time < 23.5) ? 1 : 0;
  out.steer = 0; out.boost = false; out.brake = time >= 23.5;
  return out;
}
