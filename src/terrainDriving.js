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
    const previousHeading = cart.heading;
    const throttle = clamp(input.throttle || 0, -1, 1);
    const cap = (input.slow ? 7.2 : input.boost && !cart.sputtering ? 27.9 : 18) * (cart.sputtering ? 0.35 : 1);
    const dir = input.steeringDirection?.(cart.speed) ?? steerDirFor(throttle, cart.speed);
    cart.heading += (input.steer || 0) * 2.1 * clamp(Math.abs(cart.speed) / 6, 0.2, 1) * dir * h;
    const fx = -Math.sin(cart.heading), fz = -Math.cos(cart.heading);
    const grade = probe.dx * fx + probe.dz * fz;
    const tangent = 1 / Math.hypot(1, grade);
    const gravity = -9.81 * grade * tangent;
    if(cart.surfaceBinding?.allowSteepTerrain) {
      // Speed is distance along the ground. Gravity and normal-load traction
      // determine climbability, so a run-up can carry the cart past its motor's
      // sustainable grade and a stalled climb naturally rolls back downhill.
      const normalY=1/Math.hypot(1,probe.dx,probe.dz),normalLoad=9.81*normalY;
      // Keep the original arcade launch grip on shallow ground, fading that
      // assistance into the bank's lower grip as the surface steepens.
      const grip=(probe.surfaceClass==='dirt'||probe.surfaceClass==='bridge'?1.05:.95)+normalY**4;
      const traction=grip*normalLoad,poweredCap=throttle<0?7:cap;
      const driveDirection=Math.sign(throttle),slowScale=input.slow?.45:1;
      // Limit propulsion as it reaches its target, rather than tapering torque
      // across the whole speed range or clamping existing downhill momentum.
      const motor=throttle*Math.min(18*slowScale,traction,Math.max(0,(poweredCap-cart.speed*driveDirection)/h));
      const slowing=input.slow&&cart.speed>cap;
      const excess=Math.max(0,cart.speed*driveDirection-poweredCap);
      let next=cart.speed;
      if(!throttle&&!input.brake)next*=Math.pow(.78,h*4);
      next+=(gravity+(input.brake||slowing?0:motor))*h;
      if(input.brake||slowing||throttle&&excess>0){
        const speed=Math.abs(cart.speed);
        const resistance=(input.brake?28*slowScale:slowing?8.1:.15+.045*speed+.003*speed*speed+.03*excess*excess)*h;
        next=Math.sign(next)*Math.max(0,Math.abs(next)-resistance);
      }
      // Preserve a clean flat-ground stop without introducing a parking hold
      // that could block supported downhill travel on even a gentle slope.
      if(!throttle&&!input.brake&&gravity===0&&Math.abs(next)<.3)next=0;
      cart.speed=next;
    } else {
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
    }
    const x = cart.position.x + fx * cart.speed * tangent * h;
    const z = cart.position.z + fz * cart.speed * tangent * h;
    if (cart.surfaceBinding) cart.surfaceBinding.propose(x, z, nextProbe, cart.heading);
    else sample(x, z, nextProbe);
    if (nextProbe.traversable === false) {
      cart.speed = 0;
      if (cart.surfaceBinding) cart.heading = previousHeading;
    }
    else {
      if (cart.surfaceBinding) cart.surfaceBinding.commit(x, z, nextProbe);
      cart.position.x = x; cart.position.z = z;
    }
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
