// Engine proof boundary: callers own logical identity, admission priority and
// mandatory-release reservations. This adapter owns every Rapier/WASM handle.
let enginePromise;

async function loadEngine() {
  if (!enginePromise) {
    enginePromise = import('@dimforge/rapier3d-compat').then(async engine => {
      await engine.init();
      return engine;
    }).catch(error => {
      enginePromise = undefined;
      throw error;
    });
  }
  return enginePromise;
}

const ZERO = Object.freeze({ x: 0, y: 0, z: 0 });
const IDENTITY = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });

function scalar(value, name, minimum = -Infinity, maximum = Infinity) {
  if (!Number.isFinite(value) || !Number.isFinite(Math.fround(value)) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be finite and within [${minimum}, ${maximum}]`);
  }
  return value;
}

function vector(value, name) {
  return { x: scalar(value?.x, `${name}.x`), y: scalar(value?.y, `${name}.y`), z: scalar(value?.z, `${name}.z`) };
}

function rotation(value = IDENTITY) {
  const q = { ...vector(value, 'rotation'), w: scalar(value.w, 'rotation.w') };
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  if (length < 1e-12) throw new TypeError('rotation must have nonzero length');
  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
}

function pose(value = {}) {
  return { position: vector(value.position ?? ZERO, 'position'), rotation: rotation(value.rotation) };
}

function limit(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a nonnegative safe integer`);
  return value;
}

function positive(value, name) {
  scalar(value, name, 0);
  if (value === 0) throw new TypeError(`${name} must be positive`);
  return value;
}

function colliderDescriptor(R, spec) {
  let descriptor;
  switch (spec?.shape) {
    case 'cuboid': {
      const half = vector(spec.halfExtents, 'halfExtents');
      descriptor = R.ColliderDesc.cuboid(positive(half.x, 'halfExtents.x'), positive(half.y, 'halfExtents.y'), positive(half.z, 'halfExtents.z'));
      break;
    }
    case 'ball': descriptor = R.ColliderDesc.ball(positive(spec.radius, 'radius')); break;
    case 'capsule': descriptor = R.ColliderDesc.capsule(positive(spec.halfHeight, 'halfHeight'), positive(spec.radius, 'radius')); break;
    case 'cylinder': descriptor = R.ColliderDesc.cylinder(positive(spec.halfHeight, 'halfHeight'), positive(spec.radius, 'radius')); break;
    case 'trimesh': {
      if(!(spec.vertices instanceof Float32Array)||!(spec.indices instanceof Uint16Array||spec.indices instanceof Uint32Array)||spec.vertices.length<9||spec.vertices.length%3||spec.vertices.length>65535*3||!spec.indices.length||spec.indices.length%3||spec.indices.length>131072*3)throw new TypeError('Invalid bounded triangle mesh');
      const vertices=new Float32Array(spec.vertices),indices=new Uint32Array(spec.indices),count=vertices.length/3;
      for(const value of vertices)scalar(value,'mesh vertex');
      for(const index of indices)if(index>=count)throw new TypeError('Mesh index outside vertices');
      descriptor=R.ColliderDesc.trimesh(vertices,indices);break;
    }
    default: throw new TypeError('Unknown primitive collider shape');
  }
  const local = pose(spec);
  descriptor.setTranslation(local.position.x, local.position.y, local.position.z).setRotation(local.rotation);
  if (spec.friction !== undefined) descriptor.setFriction(scalar(spec.friction, 'friction', 0));
  if (spec.restitution !== undefined) descriptor.setRestitution(scalar(spec.restitution, 'restitution', 0, 1));
  if (spec.density !== undefined && spec.mass !== undefined) throw new TypeError('Specify collider density or mass, not both');
  if (spec.density !== undefined) descriptor.setDensity(scalar(spec.density, 'density', 0));
  if (spec.mass !== undefined) descriptor.setMass(positive(spec.mass, 'mass'));
  descriptor.setSensor(spec.sensor === true);
  // Start/end and force are deliberately separate signals. Force is measured
  // in newtons at metre/kilogram/second world scale, never an inferred impulse.
  const events = (spec.collisionEvents !== false ? R.ActiveEvents.COLLISION_EVENTS : 0)
    | (spec.forceEvents === true ? R.ActiveEvents.CONTACT_FORCE_EVENTS : 0);
  descriptor.setActiveEvents(events);
  descriptor.setContactForceEventThreshold(scalar(spec.forceThreshold ?? 0, 'forceThreshold', 0));
  return descriptor;
}

/** Async WASM initialization is isolated here; do not await this in an audio-unlock gesture chain. */
export async function createRapierAdapter({ gravity = { x: 0, y: -9.81, z: 0 }, capacities = {} } = {}) {
  const limits = Object.freeze({
    bodies: limit(capacities.bodies ?? 64, 'bodies'),
    colliders: limit(capacities.colliders ?? 256, 'colliders'),
    events: limit(capacities.events ?? 256, 'events'),
  });
  const acceleration = vector(gravity, 'gravity');
  const R = await loadEngine();
  const world = new R.World(acceleration);
  let queue;
  try { queue = new R.EventQueue(true); } catch (error) { world.free(); throw error; }
  const bodies = new Map(), colliders = new Map();
  let pendingEvents = [], overflow = 0, totalOverflow = 0, disposed = false, generation = 0, steps = 0;

  function live() {
    if (disposed) throw new Error('Physics adapter has been disposed');
  }
  function record(id) { live(); return bodies.get(id); }
  function emit(event) {
    if (pendingEvents.length < limits.events) pendingEvents.push(event);
    else { overflow++; totalOverflow++; }
  }
  function pair(a, b) {
    const first = colliders.get(a), second = colliders.get(b);
    if (!first || !second) return null;
    return {
      a: first.id, b: second.id, generationA: first.generation, generationB: second.generation,
      colliderA: first.index, colliderB: second.index, sensor: first.sensor || second.sensor,
    };
  }

  return Object.freeze({
    engineVersion: R.version(),
    capacities: limits,
    addBody(spec) {
      live();
      if (typeof spec?.id !== 'string' || !spec.id) return { ok: false, reason: 'invalid-id' };
      if (bodies.has(spec.id)) return { ok: false, reason: 'duplicate-id' };
      if (!Array.isArray(spec.colliders) || !spec.colliders.length) return { ok: false, reason: 'invalid-colliders' };
      // Reject before preparing an arbitrarily large compound or touching WASM.
      if (bodies.size + 1 > limits.bodies) return { ok: false, reason: 'body-capacity' };
      if (colliders.size + spec.colliders.length > limits.colliders) return { ok: false, reason: 'collider-capacity' };
      let bodyDesc, colliderDescs;
      try {
        switch (spec.type) {
          case 'fixed': bodyDesc = R.RigidBodyDesc.fixed(); break;
          case 'kinematic': bodyDesc = R.RigidBodyDesc.kinematicPositionBased(); break;
          case 'dynamic': bodyDesc = R.RigidBodyDesc.dynamic(); break;
          default: throw new TypeError('Unknown rigid body type');
        }
        const initial = pose(spec.pose);
        bodyDesc.setTranslation(initial.position.x, initial.position.y, initial.position.z).setRotation(initial.rotation);
        if (spec.linearVelocity) { const v = vector(spec.linearVelocity, 'linearVelocity'); bodyDesc.setLinvel(v.x, v.y, v.z); }
        if (spec.angularVelocity) bodyDesc.setAngvel(vector(spec.angularVelocity, 'angularVelocity'));
        bodyDesc.setCcdEnabled(spec.ccd === true);
        bodyDesc.setCanSleep(spec.canSleep !== false);
        if (spec.linearDamping !== undefined) bodyDesc.setLinearDamping(scalar(spec.linearDamping, 'linearDamping', 0));
        if (spec.angularDamping !== undefined) bodyDesc.setAngularDamping(scalar(spec.angularDamping, 'angularDamping', 0));
        colliderDescs = spec.colliders.map(c => {
          if(c?.shape==='trimesh'&&spec.type!=='fixed')throw new TypeError('Triangle meshes require fixed ownership');
          return colliderDescriptor(R,c);
        });
      } catch (error) { return { ok: false, reason: 'invalid-descriptor', message: error.message }; }
      let body;
      const created = [];
      try {
        body = world.createRigidBody(bodyDesc);
        for (const desc of colliderDescs) created.push(world.createCollider(desc, body));
      } catch (error) {
        // Removing a body also removes all successfully attached colliders.
        if (body) world.removeRigidBody(body);
        return { ok: false, reason: 'engine-create-failed', message: error.message };
      }
      const serial = ++generation;
      bodies.set(spec.id, { body, type: spec.type, generation: serial, colliders: created.map(c => c.handle) });
      created.forEach((c, index) => colliders.set(c.handle, { id: spec.id, generation: serial, index, sensor: spec.colliders[index].sensor === true }));
      return { ok: true, id: spec.id, generation: serial };
    },
    readBody(id) {
      const item = record(id);
      if (!item) return null;
      return {
        id, generation: item.generation, type: item.type,
        pose: { position: vector(item.body.translation(), 'solved position'), rotation: rotation(item.body.rotation()) },
        linearVelocity: vector(item.body.linvel(), 'solved linearVelocity'),
        angularVelocity: vector(item.body.angvel(), 'solved angularVelocity'), sleeping: item.body.isSleeping(),
        ccd: item.body.isCcdEnabled(),
      };
    },
    setKinematicTarget(id, value) {
      const item = record(id);
      if (!item || item.type !== 'kinematic') return false;
      const next = pose(value);
      item.body.setNextKinematicTranslation(next.position);
      item.body.setNextKinematicRotation(next.rotation);
      return true;
    },
    setPose(id, value) {
      const item = record(id);
      if (!item) return false;
      const next = pose(value);
      item.body.setTranslation(next.position, true);
      item.body.setRotation(next.rotation, true);
      if (item.type === 'kinematic') {
        item.body.setNextKinematicTranslation(next.position);
        item.body.setNextKinematicRotation(next.rotation);
      }
      return true;
    },
    setVelocity(id, { linear = ZERO, angular = ZERO } = {}) {
      const item = record(id);
      if (!item) return false;
      const v = vector(linear, 'linear'), w = vector(angular, 'angular');
      item.body.setLinvel(v, true); item.body.setAngvel(w, true);
      return true;
    },
    applyImpulse(id, impulse, point) {
      const item = record(id);
      if (!item || item.type !== 'dynamic') return false;
      const force = vector(impulse, 'impulse');
      if (point) item.body.applyImpulseAtPoint(force, vector(point, 'point'), true);
      else item.body.applyImpulse(force, true);
      return true;
    },
    step(dt) {
      live(); positive(dt, 'dt');
      world.timestep = dt;
      world.step(queue);
      steps++;
      queue.drainCollisionEvents((a, b, started) => {
        const contact = pair(a, b);
        if (contact) emit({ ...contact, type: `${contact.sensor ? 'sensor' : 'contact'}-${started ? 'start' : 'end'}`, step: steps });
      });
      queue.drainContactForceEvents(event => {
        const contact = pair(event.collider1(), event.collider2());
        if (contact) emit({
          ...contact, type: 'contact-force', step: steps, units: 'N',
          totalForce: vector(event.totalForce(), 'contact force'), totalForceMagnitude: scalar(event.totalForceMagnitude(), 'contact force magnitude', 0),
          maxForceDirection: vector(event.maxForceDirection(), 'contact direction'), maxForceMagnitude: scalar(event.maxForceMagnitude(), 'maximum contact force', 0),
        });
      });
    },
    drainEvents() {
      live();
      const result = { events: pendingEvents, overflow };
      pendingEvents = []; overflow = 0;
      return result;
    },
    debugRender() {
      live();
      const buffers = world.debugRender();
      return { vertices: buffers.vertices.slice(), colors: buffers.colors.slice() };
    },
    counts() {
      return {
        bodies: bodies.size, colliders: colliders.size, joints: 0,
        engineBodies: disposed ? 0 : world.bodies.len(), engineColliders: disposed ? 0 : world.colliders.len(),
        events: pendingEvents.length, overflow, totalOverflow, steps, disposed,
      };
    },
    removeBody(id) {
      if (disposed) return false;
      const item = bodies.get(id);
      if (!item) return false;
      world.removeRigidBody(item.body);
      for (const handle of item.colliders) colliders.delete(handle);
      bodies.delete(id);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // Both own WASM resources. Free the world even if queue teardown throws.
      try { queue.free(); } finally {
        try { world.free(); } finally { bodies.clear(); colliders.clear(); pendingEvents = []; overflow = 0; }
      }
    },
  });
}
