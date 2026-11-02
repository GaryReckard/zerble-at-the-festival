// Bounded geometry checks shared by route admission and movement bindings.
const number = (v, name) => { if (!Number.isFinite(v)) throw new TypeError(`${name} must be finite`); return v; };
export function headingDelta(from, to) { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }

export function rectangleFootprint(halfWidth, halfLength, spacing = 1) {
  for (const v of [halfWidth, halfLength, spacing]) if (number(v, 'footprint dimension') <= 0) throw new RangeError('Footprint dimensions must be positive');
  const nx = Math.ceil(halfWidth * 2 / spacing), nz = Math.ceil(halfLength * 2 / spacing);
  if ((nx + 1) * (nz + 1) > 512) throw new RangeError('Footprint sampling limit');
  const result = [];
  for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++)
    result.push(Object.freeze({ x: -halfWidth + ix * halfWidth * 2 / nx, z: -halfLength + iz * halfLength * 2 / nz }));
  return Object.freeze(result);
}

export function* validateRouteSteps(world, points, { halfWidth = 4.5, halfLength = 2.8, spacing = .5,
  maxGrade = .2, maxCrossfall = .15, maxSamples = 200000, surfaceId = 'terrain' } = {}) {
  if (!Array.isArray(points) || points.length < 2 || points.length > 1024) throw new RangeError('A route needs 2–1024 points');
  if (number(spacing, 'route spacing') <= 0 || spacing > 1) throw new RangeError('Route spacing must be at most one metre');
  if (!Number.isInteger(maxSamples) || maxSamples < 1 || maxSamples > 1000000) throw new RangeError('Invalid route work limit');
  if (number(maxGrade, 'grade limit') < 0 || number(maxCrossfall, 'crossfall limit') < 0) throw new RangeError('Invalid route grade limit');
  for (const p of points) { number(p.x, 'route x'); number(p.z, 'route z'); }
  const footprint = rectangleFootprint(halfWidth, halfLength, 1), probe = {}, contact = {};
  const state = { x: points[0].x, z: points[0].z, height: 0, surfaceId };
  world.sampleSelected(state.x, state.z, surfaceId, probe);
  const result = { valid: true, reason: null, distance: 0, samples: 0, maxGrade: 0, maxCrossfall: 0, endSurfaceId: surfaceId };
  if (!probe.valid || !probe.traversable) return { ...result, valid: false, reason: 'invalid-start' };
  state.height = probe.height;
  function inspect(x, z, heading) {
    world.propose(x, z, state, probe);
    if (!probe.valid || !probe.traversable) { result.reason = probe.reason || 'forbidden-center'; return false; }
    const c = Math.cos(heading), s = Math.sin(heading);
    for (const p of footprint) {
      if (++result.samples > maxSamples) { result.reason = 'sample-limit'; return false; }
      world.sampleSelected(x + p.x * c + p.z * s, z - p.x * s + p.z * c, probe.surfaceId, contact);
      if (!contact.valid || !contact.traversable) { result.reason = contact.reason || 'unsupported-width'; return false; }
      const grade = Math.abs(-contact.dx * s - contact.dz * c), crossfall = Math.abs(contact.dx * c - contact.dz * s);
      result.maxGrade = Math.max(result.maxGrade, grade); result.maxCrossfall = Math.max(result.maxCrossfall, crossfall);
      if (grade > maxGrade || crossfall > maxCrossfall) { result.reason = grade > maxGrade ? 'road-grade' : 'road-crossfall'; return false; }
    }
    state.x = x; state.z = z; state.height = probe.height; state.surfaceId = probe.surfaceId;
    return true;
  }
  let previousHeading = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-8) continue;
    const heading = Math.atan2(a.x - b.x, a.z - b.z);
    if (previousHeading !== null) {
      const delta = headingDelta(previousHeading, heading), steps = Math.ceil(Math.abs(delta) / .04);
      for (let t = 0; t <= steps; t++) {
        if (!inspect(a.x, a.z, previousHeading + delta * (steps ? t / steps : 1))) return { ...result, valid: false };
        yield;
      }
    }
    const count = Math.ceil(length / spacing);
    // Bound work before walking a very long caller-supplied segment.
    if (count * footprint.length > maxSamples - result.samples) return { ...result, valid: false, reason: 'sample-limit' };
    for (let t = 0; t <= count; t++) {
      if (!inspect(a.x + (b.x - a.x) * t / count, a.z + (b.z - a.z) * t / count, heading)) return { ...result, valid: false };
      yield;
    }
    result.distance += length; previousHeading = heading;
  }
  result.endSurfaceId = state.surfaceId;
  if (!result.distance) return { ...result, valid: false, reason: 'zero-length' };
  return result;
}

// The synchronous oracle and cooperative runtime consume the same inspection
// sequence. A deadline never interrupts a pose halfway through its footprint.
export function validateRoute(world, points, options) {
  const iterator=validateRouteSteps(world,points,options);
  let step;do {step=iterator.next();} while(!step.done);return step.value;
}

export function createRouteValidation(world,points,options) {
  const iterator=validateRouteSteps(world,points,options);
  let done=false,result=null;
  return Object.freeze({
    get done(){return done;},get result(){return result;},
    step({maxSteps=8,deadline=Infinity}={}) {
      if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>128||typeof deadline!=='number'||Number.isNaN(deadline))throw new RangeError('Invalid route scheduling limit');
      let steps=0;
      while(!done&&steps<maxSteps&&performance.now()<deadline){
        const item=iterator.next();steps++;done=item.done;if(done)result=item.value;
      }
      return {done,result,steps};
    },
    cancel(){if(!done){iterator.return();done=true;result={valid:false,reason:'cancelled'};}}
  });
}

export function selectFeasibleRoute(world, candidates, options) {
  if (!Array.isArray(candidates) || candidates.length > 8) throw new RangeError('At most eight route alternatives');
  const rejected = [];
  for (const candidate of candidates) {
    const result = validateRoute(world, candidate.points, options);
    if (result.valid) return { ...result, route: candidate, rejected };
    rejected.push({ id: candidate.id, reason: result.reason });
  }
  return { valid: false, reason: 'no-feasible-route', route: null, rejected };
}

// Reproducible ordinary-control route driving for proofs, not pose teleportation.
export function followRouteInput(cart, points, state, out = {}) {
  state.index ??= 0;
  while (state.index < points.length - 1 && Math.hypot(cart.position.x - points[state.index].x, cart.position.z - points[state.index].z) < 3) state.index++;
  const goal = points[state.index], distance = Math.hypot(cart.position.x - goal.x, cart.position.z - goal.z);
  const error = headingDelta(cart.heading, Math.atan2(cart.position.x - goal.x, cart.position.z - goal.z));
  state.done = state.index === points.length - 1 && distance < 3;
  out.throttle = state.done ? 0 : 1; out.brake = state.done || (Math.abs(error) > 1.2 && Math.abs(cart.speed) > 3);
  out.steer = state.done ? 0 : Math.max(-1, Math.min(1, error * 2));
  out.slow = distance < 18 || Math.abs(error) > .2; out.boost = false;
  return out;
}

// Capsule clearance includes the junction disks, keeping every published solid
// outside the road's protected half-width rather than merely its centerline.
export function routeClearsSolids(points, solids, halfWidth=4.5) {
  if (!Number.isFinite(halfWidth) || halfWidth <= 0) throw new RangeError('Invalid protected route width');
  for (let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,lengthSq=dx*dx+dz*dz;
    for (const solid of solids) {
      const p=solid.position, radius=solid.radius ?? solid.collider?.radius;
      if (!p || !Number.isFinite(radius) || radius<0) throw new TypeError('Invalid route solid');
      const t=lengthSq ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/lengthSq)) : 0;
      if (Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)<halfWidth+radius) return false;
    }
  }
  return true;
}
