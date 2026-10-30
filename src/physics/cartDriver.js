import { Zerble } from '../zerble.js';

// The ordinary controller remains the sole driving authority. Rendering may
// interpolate its root, so restore the solved controller pose before updating.
export function createFixtureCartDriver({ speed = 4, angle = 0, slope = 0, surfaceSampler = null } = {}) {
  const cart = new Zerble();
  const heading = angle * Math.PI / 180;
  const gradient = Math.tan(slope);
  cart.surfaceSampler = surfaceSampler || ((x, z, out = {}) => Object.assign(out, {
    height: x * gradient, dx: gradient, dz: 0, traversable: true,
    nx: -Math.sin(slope), ny: Math.cos(slope), nz: 0,
  }));
  cart.position.set(Math.sin(heading) * 5, 0, Math.cos(heading) * 5);
  cart.heading = heading;
  cart.groundOnSurface();
  let started = false, distance = 0;
  let solved = snapshot();
  function snapshot() {
    const p = cart.position, q = cart.root.quaternion;
    return { position:{x:p.x,y:p.y,z:p.z},rotation:{x:q.x,y:q.y,z:q.z,w:q.w} };
  }
  return {
    root: cart.root,
    pose: () => structuredClone(solved),
    advance(dt, running) {
      cart.position.copy(solved.position); cart.root.quaternion.copy(solved.rotation);
      if (running && !started) { cart.speed = speed; started = true; }
      if (running) {
        const beforeX=cart.position.x, beforeZ=cart.position.z;
        cart.update(dt, {throttle:0,steer:0,boost:false,slow:false,brake:distance>=10},0);
        distance += Math.hypot(cart.position.x-beforeX,cart.position.z-beforeZ);
      }
      solved = snapshot();
      return structuredClone(solved);
    },
  };
}
