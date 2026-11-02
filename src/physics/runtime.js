import { createRapierAdapter } from './rapierAdapter.js';
import { FixedStepClock } from './fixedStep.js';
import { CartProxy } from './cartProxy.js';
import { chairRecipe, coolerRecipe } from './recipes.js';
import { hash2 } from '../rng.js';

const identity = () => ({ x: 0, y: 0, z: 0, w: 1 });
const copyPose = pose => ({ position: { ...pose.position }, rotation: { ...pose.rotation } });
function interpolate(a, b, t) {
  const position = {};
  for (const axis of ['x', 'y', 'z']) position[axis] = a.position[axis] + (b.position[axis] - a.position[axis]) * t;
  // Shortest-arc normalized interpolation is sufficient between adjacent fixed steps.
  const sign = ['x', 'y', 'z', 'w'].reduce((sum, axis) => sum + a.rotation[axis] * b.rotation[axis], 0) < 0 ? -1 : 1;
  const rotation = {};
  for (const axis of ['x', 'y', 'z', 'w']) rotation[axis] = a.rotation[axis] * (1 - t) + sign * b.rotation[axis] * t;
  const length = Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w);
  for (const axis of ['x', 'y', 'z', 'w']) rotation[axis] /= length;
  return { position, rotation };
}

// Experimental fixture only. Production controller, terrain streaming, people
// claims and world admission remain separate acceptance gates.
export async function createPhysicalFixture({ fixture = 'chair', seed = 1, style = 'sling',
  speed = 4, angle = 0, physics = true, capacity = 32, cartDriver = null, terrainPatch = null, surfaceSampler = null } = {}) {
  if (!['chair', 'pair', 'slope', 'solid', 'cooler', 'terrain'].includes(fixture)) throw new RangeError('Unsupported fixture');
  if (!Number.isInteger(seed) || !Number.isFinite(speed) || speed < 0 || speed > 20 ||
      !Number.isFinite(angle) || Math.abs(angle) > 180 || !Number.isInteger(capacity) || capacity < 1 || capacity > 256) {
    throw new RangeError('Invalid fixture parameters');
  }
  const chairShapes = chairRecipe(style);
  const slope = fixture === 'slope' ? .12 : 0;
  const tilt = { x: 0, y: 0, z: Math.sin(slope / 2), w: Math.cos(slope / 2) };
  const ground = { slope, width: terrainPatch ? 40 : 24, depth: terrainPatch ? 40 : 24, productionTerrain:!!terrainPatch };
  const radians = angle * Math.PI / 180;
  const direction = { x: Math.sin(radians), z: Math.cos(radians) };
  const groundHeight = (x,z=0) => surfaceSampler ? surfaceSampler(x,z).height : Math.tan(slope) * x;
  const props = [];
  let adapter, disposed = false, strikeTime = null, events = [], eventOverflow = 0, historyEvictions = 0;
  let stepMs = 0, maxStepMs = 0, totalStepMs = 0, activationMs = 0, presentCurrent = true;
  const clock = new FixedStepClock();
  let cartProxy;
  const limits = { bodies: capacity, colliders: capacity * 8, events: 128 };
  function add(key, kind, position, colliders, type = 'dynamic', size) {
    const pose = { position, rotation: kind === 'chair' ? { ...tilt } : identity() };
    if (adapter) {
      const result = adapter.addBody({ id: key, type, pose, colliders, ccd: type === 'dynamic' });
      if (!result.ok) throw new Error(`Fixture admission rejected: ${key}: ${result.reason}`);
    }
    props.push({ key, kind, style, size, colorSeed: (seed ^ hash2(props.length, 0x50485953)) >>> 0,
      variant: seed >>> 0, previous: copyPose(pose), current: copyPose(pose) });
  }
  try {
    const start = performance.now();
    if (physics) {
      adapter = await createRapierAdapter({ capacities: limits });
      const result = adapter.addBody({ id: 'ground', type: 'fixed',
        pose: terrainPatch ? {position:{x:0,y:0,z:0},rotation:identity()} : { position: { x: .2 * Math.sin(slope), y: -.2 * Math.cos(slope), z: 0 }, rotation: tilt },
        colliders: terrainPatch ? [{shape:'trimesh',vertices:terrainPatch.vertices,indices:terrainPatch.indices,friction:.7}] : [{ shape: 'cuboid', halfExtents: { x: 12, y: .2, z: 12 }, friction: .7 }] });
      if (!result.ok) throw new Error(`Ground admission rejected: ${result.reason}`);
    }
    add('chair-0', 'chair', { x: 0, y: groundHeight(0,0)+.015, z: 0 }, chairShapes);
    if (fixture === 'pair') add('chair-1', 'chair', { x: .25, y: .015, z: -1.15 }, chairRecipe(style));
    if (fixture === 'cooler') add('cooler-0', 'cooler', { x: .2, y: .015, z: -1.1 }, coolerRecipe());
    if (fixture === 'solid') add('solid-0', 'solid', { x: .85, y: .6, z: -1.3 },
      [{ shape: 'cuboid', halfExtents: { x: .4, y: .6, z: .4 }, friction: .7 }], 'fixed', [.8, 1.2, .8]);
    add('cart', 'cart', { x: direction.x * 4, y: .4 + groundHeight(direction.x * 4), z: direction.z * 4 },
      [{ shape: 'cuboid', halfExtents: { x: .5, y: .4, z: .7 }, friction: .4,
        collisionEvents: true, forceEvents: true, forceThreshold: 2 }], 'kinematic', [1, .8, 1.4]);
    if (cartDriver) {
      const pose = cartDriver.pose();
      const cart = props.find(prop => prop.key === 'cart');
      cart.size = [3.7,1.2,4.6];
      cart.previous = cart.current = copyPose(pose);
      if (adapter) {
        adapter.removeBody('cart');
        const admitted = adapter.addBody({ id: 'cart', type: 'kinematic', pose,
          colliders: [{shape:'cuboid',halfExtents:{x:1.85,y:.6,z:2.3},
            position:{x:0,y:.65,z:-.17},friction:.4,collisionEvents:true,forceEvents:true,forceThreshold:2}] });
        if (!admitted.ok) throw new Error(`Controller proxy admission rejected: ${admitted.reason}`);
        cartProxy = new CartProxy({ adapter, id: 'cart', pose, isClear(candidate) {
          const query = adapter.queryDynamicOverlaps('cart', candidate);
          return query.ok && !query.exhausted && query.overlaps.length === 0;
        } });
      }
    }
    activationMs = performance.now() - start;
  } catch (error) { adapter?.dispose(); throw error; }

  function tick(dt, time) {
    for (const prop of props) prop.previous = copyPose(prop.current);
    if (cartProxy && adapter) {
      cartProxy.beforeStep(time);
    } else if (strikeTime !== null && adapter) {
      const travel = Math.min(10, Math.max(0, time - strikeTime) * speed);
      const x = direction.x * (4 - travel), z = direction.z * (4 - travel);
      adapter.setKinematicTarget('cart', { position: { x, y: .4 + groundHeight(x), z }, rotation: identity() });
    }
    if (adapter) {
      const start = performance.now();
      adapter.step(dt);
      stepMs = performance.now() - start; maxStepMs = Math.max(maxStepMs, stepMs); totalStepMs += stepMs;
      const drained = adapter.drainEvents();
      eventOverflow += drained.overflow;
      const combined = events.concat(drained.events);
      historyEvictions += Math.max(0, combined.length - 64);
      events = combined.slice(-64);
      for (const prop of props) {
        const body = adapter.readBody(prop.key);
        prop.current = copyPose(body.pose); prop.sleeping = body.sleeping;
      }
    }
  }
  function live() { if (disposed) throw new Error('Fixture disposed'); }
  function getState() {
    const counts = adapter?.counts() || { bodies: 0, colliders: 0 };
    return { props: disposed ? [] : props.map(({ previous, current, ...prop }) => ({ ...prop, size: prop.size?.slice(),
      ...interpolate(previous, current, presentCurrent ? 1 : clock.alpha) })),
      ground: { ...ground }, physics, time: clock.time, events: structuredClone(events), cartProxy: cartProxy?.state() || null,
      stats: { ...counts, steps: clock.steps, droppedSeconds: clock.dropped, alpha: clock.alpha,
        stepMs, maxStepMs, meanStepMs: clock.steps ? totalStepMs / clock.steps : 0, activationMs,
        eventOverflow, historyEvictions, renderProps: disposed ? 0 : props.length, disposed },
      limitations: [cartDriver ? 'Production controller; live-game contact barrier and registry integration pending.' : 'Experimental cart proxy; production controller/registry integration pending.',
        terrainPatch ? 'Production terrain triangles in a bounded fixture. No occupants, streaming or release claims yet.' : 'Slope is a fixture plane, not production terrain. No occupants, streaming or release claims yet.',
        'Static reference mode is not the legacy game collision path. Capacities are experimental, not device limits.'] };
  }
  return {
    getState,
    advance(dt) {
      live();
      if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid accepted delta');
      if (cartDriver && physics && dt > 0) {
        const accepted = Math.min(dt, clock.step * clock.maxSteps);
        const pose = cartDriver.advance(accepted, strikeTime !== null);
        const discontinuous = dt > accepted;
        cartProxy.accept(clock.time + clock.remainder, accepted, pose,
          {resetReason: discontinuous ? 'dropped-time' : null});
      }
      if (clock.advance(dt, tick)) presentCurrent = false;
      return getState();
    },
    step() {
      live();
      if (cartDriver && physics) {
        cartProxy.accept(clock.time, clock.step, cartDriver.advance(clock.step, strikeTime !== null));
      }
      clock.singleStep(tick); presentCurrent = true; return getState();
    },
    strike() { live(); if (strikeTime !== null || !physics) return false; strikeTime = clock.time; return true; },
    setCartGhost(ghost) {
      live();
      if (!cartProxy) return false;
      cartProxy.accept(clock.time + clock.remainder, 0, cartDriver.pose(), {ghost});
      return true;
    },
    debugGeometry() { live(); return adapter?.debugRender() || { vertices: new Float32Array(), colors: new Float32Array() }; },
    dispose() { if (disposed) return; disposed = true; adapter?.dispose(); props.length = 0; events = []; },
  };
}
