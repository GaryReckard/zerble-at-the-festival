// Engine proof boundary: callers own logical identity, admission priority and
// mandatory-release reservations. This adapter owns every Rapier/WASM handle.
let enginePromise;
let adapterSerial = 0;

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

function hingeLimits(value) {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError('Hinge limits require [minimum, maximum] radians');
  const lower = scalar(value[0], 'hinge minimum', -Math.PI, Math.PI);
  const upper = scalar(value[1], 'hinge maximum', -Math.PI, Math.PI);
  if (lower > upper) throw new RangeError('Hinge minimum must not exceed maximum');
  return [lower, upper];
}

function composePose(parent, local) {
  const p = parent.position, q = parent.rotation, v = local.position, r = local.rotation;
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  return pose({ position: {
    x: p.x + v.x + q.w * tx + q.y * tz - q.z * ty,
    y: p.y + v.y + q.w * ty + q.z * tx - q.x * tz,
    z: p.z + v.z + q.w * tz + q.x * ty - q.y * tx,
  }, rotation: {
    x: q.w * r.x + q.x * r.w + q.y * r.z - q.z * r.y,
    y: q.w * r.y - q.x * r.z + q.y * r.w + q.z * r.x,
    z: q.w * r.z + q.x * r.y - q.y * r.x + q.z * r.w,
    w: q.w * r.w - q.x * r.x - q.y * r.y - q.z * r.z,
  } });
}

function meshCounts(spec) {
  if (!spec || spec.shape !== 'trimesh') return { vertices: 0, triangles: 0 };
  for (const name of ['vertices', 'indices']) {
    const data = spec[name];
    if ((!Array.isArray(data) && !ArrayBuffer.isView(data)) || !Number.isSafeInteger(data.length) || !data.length || data.length % 3) {
      throw new TypeError(`trimesh ${name} must contain complete nonempty triples`);
    }
  }
  if (spec.vertices.length < 9) throw new TypeError('trimesh requires at least three vertices');
  return { vertices: spec.vertices.length / 3, triangles: spec.indices.length / 3 };
}

function meshDescriptor(R, spec) {
  const count = meshCounts(spec);
  const vertices = new Float32Array(spec.vertices.length), indices = new Uint32Array(spec.indices.length);
  for (let i = 0; i < vertices.length; i++) vertices[i] = scalar(spec.vertices[i], `vertices[${i}]`);
  for (let i = 0; i < indices.length; i++) {
    const index = spec.indices[i];
    if (!Number.isSafeInteger(index) || index < 0 || index >= count.vertices || index > 0xffffffff) {
      throw new TypeError(`indices[${i}] must reference a mesh vertex`);
    }
    indices[i] = index;
  }
  // Check the copied float32 geometry that Rapier receives. Distinct doubles
  // can collapse to the same float32 point, making an authored triangle empty.
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = vertices[b] - vertices[a], uy = vertices[b + 1] - vertices[a + 1], uz = vertices[b + 2] - vertices[a + 2];
    const vx = vertices[c] - vertices[a], vy = vertices[c + 1] - vertices[a + 1], vz = vertices[c + 2] - vertices[a + 2];
    if (uy * vz - uz * vy === 0 && uz * vx - ux * vz === 0 && ux * vy - uy * vx === 0) {
      throw new TypeError(`trimesh triangle ${i / 3} is degenerate`);
    }
  }
  return R.ColliderDesc.trimesh(vertices, indices);
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
    case 'trimesh': descriptor = meshDescriptor(R, spec); break;
    default: throw new TypeError('Unknown collider shape');
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
    joints: limit(capacities.joints ?? 0, 'joints'),
    supportedLoads: limit(capacities.supportedLoads ?? 0, 'supportedLoads'),
    events: limit(capacities.events ?? 256, 'events'),
    // Configurable fixture storage bounds, not measured device budgets.
    meshVertices: limit(capacities.meshVertices ?? 65536, 'meshVertices'),
    meshTriangles: limit(capacities.meshTriangles ?? 131072, 'meshTriangles'),
  });
  const acceleration = vector(gravity, 'gravity');
  const R = await loadEngine();
  const world = new R.World(acceleration);
  let queue;
  try { queue = new R.EventQueue(true); } catch (error) { world.free(); throw error; }
  const bodies = new Map(), colliders = new Map(), joints = new Map(), jointOwner = ++adapterSerial;
  const supportedLoads = new Map();
  let loadGeneration = 0;
  let jointGeneration = 0;
  let pendingEvents = [], overflow = 0, totalOverflow = 0, disposed = false, generation = 0, steps = 0;
  let meshVertexCount = 0, meshTriangleCount = 0;

  function live() {
    if (disposed) throw new Error('Physics adapter has been disposed');
  }
  function record(id) { live(); return bodies.get(id); }
  function loadRecord(token) {
    live();
    const item = token?.owner === jointOwner && supportedLoads.get(token.id);
    return item && item.generation === token.generation ? item : null;
  }
  function refreshMass(body, originVelocity) {
    // Changing the COM changes what linvel describes. Keep the body's velocity
    // field continuous so a departing sitter doesn't kick the remaining sitter.
    body.recomputeMassPropertiesFromColliders();
    const origin = body.translation(), com = body.worldCom(), w = body.angvel();
    const x = com.x - origin.x, y = com.y - origin.y, z = com.z - origin.z;
    body.setLinvel({x:originVelocity.x+w.y*z-w.z*y,
      y:originVelocity.y+w.z*x-w.x*z,z:originVelocity.z+w.x*y-w.y*x},true);
  }
  function jointRecord(token) {
    live();
    const item = token?.owner === jointOwner && joints.get(token.id);
    return item && item.generation === token.generation ? item : null;
  }
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
    addSupportedLoad(spec) {
      live();
      if (typeof spec?.id !== 'string' || !spec.id || spec.id.length > 200) throw new TypeError('Load id must be a nonempty string of at most 200 characters');
      if (supportedLoads.has(spec.id)) return {ok:false,reason:'duplicate-load'};
      if (supportedLoads.size >= limits.supportedLoads) return {ok:false,reason:'load-capacity'};
      if (colliders.size >= limits.colliders) return {ok:false,reason:'collider-capacity'};
      const item = bodies.get(spec.bodyId);
      if (!item || item.generation !== spec.bodyGeneration) return {ok:false,reason:'stale-body'};
      if (item.type !== 'dynamic') return {ok:false,reason:'not-dynamic'};
      const position = vector(spec.position, 'load position');
      const mass = positive(spec.mass, 'load mass'), radius = positive(spec.radius, 'load radius');
      // A mass-bearing sensor contributes inertia but has no contacts or events.
      // Its capacity still counts as a collider; it is not a second person body.
      const desc = R.ColliderDesc.ball(radius).setMass(mass).setTranslation(position.x,position.y,position.z)
        .setSensor(true).setCollisionGroups(0).setSolverGroups(0).setActiveEvents(0);
      const originVelocity = vector(item.body.velocityAtPoint(item.body.translation()),'origin velocity');
      let collider;
      try {
        collider = world.createCollider(desc,item.body);
        refreshMass(item.body,originVelocity);
      } catch(error) {
        if(collider)world.removeCollider(collider,true);
        refreshMass(item.body,originVelocity);
        return {ok:false,reason:'engine-load-create-failed',message:error.message};
      }
      const serial = ++loadGeneration;
      supportedLoads.set(spec.id,{collider,bodyId:spec.bodyId,bodyGeneration:item.generation,generation:serial,mass,radius,position});
      item.colliders.push(collider.handle);
      colliders.set(collider.handle,{id:spec.bodyId,generation:item.generation,index:-1,sensor:true,shape:collider.shape,
        local:{position,rotation:{...IDENTITY}}});
      return {ok:true,token:Object.freeze({owner:jointOwner,id:spec.id,generation:serial})};
    },
    readSupportedLoad(token) {
      const load = loadRecord(token);
      if(!load)return null;
      const body = bodies.get(load.bodyId).body, position = vector(load.collider.translation(),'load world position');
      return {bodyId:load.bodyId,bodyGeneration:load.bodyGeneration,mass:load.mass,radius:load.radius,
        localPosition:{...load.position},position,rotation:rotation(body.rotation()),
        velocity:vector(body.velocityAtPoint(position),'load point velocity'),angularVelocity:vector(body.angvel(),'load angular velocity')};
    },
    moveSupportedLoad(token, value) {
      const load = loadRecord(token);
      if(!load)return false;
      const position = vector(value,'load position'), body = bodies.get(load.bodyId).body;
      const originVelocity = vector(body.velocityAtPoint(body.translation()),'origin velocity');
      load.collider.setTranslationWrtParent(position);
      load.position = position;
      colliders.get(load.collider.handle).local.position = position;
      refreshMass(body,originVelocity);
      return true;
    },
    removeSupportedLoad(token) {
      if(disposed)return false;
      const load = loadRecord(token);
      if(!load)return false;
      const item = bodies.get(load.bodyId), handle = load.collider.handle;
      const originVelocity = vector(item.body.velocityAtPoint(item.body.translation()),'origin velocity');
      world.removeCollider(load.collider,true);
      item.colliders.splice(item.colliders.indexOf(handle),1);colliders.delete(handle);supportedLoads.delete(token.id);
      refreshMass(item.body,originVelocity);
      return true;
    },
    addJoint(spec) {
      live();
      if (typeof spec?.id !== 'string' || !spec.id || spec.id.length > 200) throw new TypeError('Joint id must be a nonempty string of at most 200 characters');
      if (spec.type !== 'revolute') throw new TypeError('Only revolute joints are supported');
      if (joints.has(spec.id)) return { ok: false, reason: 'duplicate-joint' };
      if (joints.size >= limits.joints) return { ok: false, reason: 'joint-capacity' };
      const a = bodies.get(spec.bodyA), b = bodies.get(spec.bodyB);
      if (!a || !b) return { ok: false, reason: 'missing-body' };
      if (a === b) return { ok: false, reason: 'same-body' };
      if (a.type !== 'dynamic' && b.type !== 'dynamic') return { ok: false, reason: 'no-dynamic-body' };
      const anchorA = vector(spec.anchorA, 'anchorA'), anchorB = vector(spec.anchorB, 'anchorB');
      const axis = vector(spec.axis, 'axis'), length = Math.hypot(axis.x, axis.y, axis.z);
      if (length < 1e-12) throw new TypeError('Hinge axis must have nonzero length');
      for (const key of ['x', 'y', 'z']) axis[key] /= length;
      const bounds = hingeLimits(spec.limits);
      const contactsEnabled = spec.contactsEnabled ?? false;
      if (typeof contactsEnabled !== 'boolean') throw new TypeError('contactsEnabled must be a boolean');
      let joint;
      try {
        joint = world.createImpulseJoint(R.JointData.revolute(anchorA, anchorB, axis), a.body, b.body, true);
        joint.setContactsEnabled(contactsEnabled);
        joint.setLimits(...bounds);
      } catch (error) {
        if (joint) world.removeImpulseJoint(joint, true);
        return { ok: false, reason: 'engine-joint-create-failed', message: error.message };
      }
      const serial = ++jointGeneration;
      joints.set(spec.id, { joint, generation: serial, axis, bodyA: spec.bodyA, bodyB: spec.bodyB,
        generationA: a.generation, generationB: b.generation });
      return { ok: true, token: Object.freeze({ owner: jointOwner, id: spec.id, generation: serial }) };
    },
    readJoint(token) {
      const item = jointRecord(token);
      return item ? { token: { ...token }, type: 'revolute', bodyA: item.bodyA, bodyB: item.bodyB,
        generationA: item.generationA, generationB: item.generationB, axis: { ...item.axis },
        anchorA: vector(item.joint.anchor1(), 'anchorA'), anchorB: vector(item.joint.anchor2(), 'anchorB'),
        limits: [item.joint.limitsMin(), item.joint.limitsMax()], contactsEnabled: item.joint.contactsEnabled() } : null;
    },
    setJointLimits(token, value) {
      const item = jointRecord(token);
      if (!item) return false;
      item.joint.setLimits(...hingeLimits(value));
      bodies.get(item.bodyA)?.body.wakeUp(); bodies.get(item.bodyB)?.body.wakeUp();
      return true;
    },
    removeJoint(token) {
      if (disposed) return false;
      const item = jointRecord(token);
      if (!item) return false;
      world.removeImpulseJoint(item.joint, true);
      joints.delete(token.id);
      return true;
    },
    addBody(spec) {
      live();
      if (typeof spec?.id !== 'string' || !spec.id) return { ok: false, reason: 'invalid-id' };
      if (bodies.has(spec.id)) return { ok: false, reason: 'duplicate-id' };
      if (!Array.isArray(spec.colliders) || !spec.colliders.length) return { ok: false, reason: 'invalid-colliders' };
      // Reject before preparing an arbitrarily large compound or touching WASM.
      if (bodies.size + 1 > limits.bodies) return { ok: false, reason: 'body-capacity' };
      if (colliders.size + spec.colliders.length > limits.colliders) return { ok: false, reason: 'collider-capacity' };
      let bodyDesc, colliderDescs, addedVertices = 0, addedTriangles = 0;
      try {
        // Count every mesh in the compound before copying geometry or creating
        // engine resources, so one large mesh cannot bypass collider limits.
        for (const collider of spec.colliders) {
          const mesh = meshCounts(collider);
          if (mesh.vertices && spec.type !== 'fixed') throw new TypeError('trimesh colliders require a fixed body');
          addedVertices += mesh.vertices; addedTriangles += mesh.triangles;
          if (meshVertexCount + addedVertices > limits.meshVertices) return { ok: false, reason: 'mesh-vertex-capacity' };
          if (meshTriangleCount + addedTriangles > limits.meshTriangles) return { ok: false, reason: 'mesh-triangle-capacity' };
        }
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
        colliderDescs = spec.colliders.map(c => colliderDescriptor(R, c));
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
      bodies.set(spec.id, { body, type: spec.type, generation: serial, colliders: created.map(c => c.handle), meshVertices: addedVertices, meshTriangles: addedTriangles });
      meshVertexCount += addedVertices; meshTriangleCount += addedTriangles;
      created.forEach((c, index) => colliders.set(c.handle, {
        id: spec.id, generation: serial, index, sensor: c.isSensor(), shape: c.shape,
        local: { position: vector(c.translationWrtParent(), 'collider local position'), rotation: rotation(c.rotationWrtParent()) },
      }));
      return { ok: true, id: spec.id, generation: serial };
    },
    readBody(id) {
      const item = record(id);
      if (!item) return null;
      return {
        id, generation: item.generation, type: item.type, mass: item.body.mass(),
        centerOfMass: vector(item.body.worldCom(), 'world center of mass'),
        pose: { position: vector(item.body.translation(), 'solved position'), rotation: rotation(item.body.rotation()) },
        linearVelocity: vector(item.body.linvel(), 'solved linearVelocity'),
        angularVelocity: vector(item.body.angvel(), 'solved angularVelocity'), sleeping: item.body.isSleeping(),
        ccd: item.body.isCcdEnabled(), enabled: item.body.isEnabled(),
      };
    },
    setBodyEnabled(id, enabled) {
      const item = record(id);
      if (typeof enabled !== 'boolean') throw new TypeError('enabled must be a boolean');
      if (!item) return false;
      // Disabling retains allocation/identity while removing simulation and
      // collision participation. Callers own target-history reset and safe
      // separation before re-enabling an overlapping cart proxy.
      item.body.setEnabled(enabled);
      return true;
    },
    queryDynamicOverlaps(id, value, { maxTests = limits.colliders, maxResults = limits.bodies } = {}) {
      live();
      const supplied = pose(value);
      limit(maxTests, 'maxTests'); limit(maxResults, 'maxResults');
      if (maxTests > limits.colliders || maxResults > limits.bodies) throw new RangeError('Overlap query limits exceed admitted capacities');
      const source = bodies.get(id);
      if (!source || source.type !== 'kinematic') {
        return { ok: false, reason: source ? 'not-kinematic' : 'missing-body', overlaps: [], testedPairs: 0, exhausted: true };
      }
      const hulls = source.colliders.map(handle => colliders.get(handle)).filter(c => !c.sensor)
        .map(c => ({ shape: c.shape, pose: composePose(supplied, c.local) }));
      const result = { ok: true, overlaps: [], testedPairs: 0, exhausted: false };
      for (const [targetId, target] of bodies) {
        if (target === source || target.type !== 'dynamic' || !target.body.isEnabled()) continue;
        const targetPose = pose({ position: target.body.translation(), rotation: target.body.rotation() });
        let hit = false;
        for (const handle of target.colliders) {
          const candidate = colliders.get(handle);
          if (candidate.sensor) continue;
          const at = composePose(targetPose, candidate.local);
          for (const hull of hulls) {
            if (result.testedPairs === maxTests) { result.exhausted = true; return result; }
            result.testedPairs++;
            // Direct shape queries use current body poses and copied local
            // transforms, so neither a disabled hull nor an unstepped setPose
            // depends on the world's broadphase/collider-transform cache.
            if (hull.shape.intersectsShape(hull.pose.position, hull.pose.rotation, candidate.shape, at.position, at.rotation)) {
              hit = true; break;
            }
          }
          if (hit) break;
        }
        if (hit) {
          if (result.overlaps.length === maxResults) { result.exhausted = true; return result; }
          result.overlaps.push({ id: targetId, generation: target.generation });
        }
      }
      return result;
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
        bodies: bodies.size, colliders: colliders.size, joints: joints.size, supportedLoads: supportedLoads.size,
        engineJoints: disposed ? 0 : world.impulseJoints.len(),
        meshVertices: meshVertexCount, meshTriangles: meshTriangleCount,
        engineBodies: disposed ? 0 : world.bodies.len(), engineColliders: disposed ? 0 : world.colliders.len(),
        events: pendingEvents.length, overflow, totalOverflow, steps, disposed,
      };
    },
    removeBody(id) {
      if (disposed) return false;
      const item = bodies.get(id);
      if (!item) return false;
      world.removeRigidBody(item.body);
      // Rapier removes attached impulse joints with the body. Mirror that
      // lifetime here before a reused body id can resolve to a new generation.
      for (const [key, joint] of joints) if (joint.bodyA === id || joint.bodyB === id) joints.delete(key);
      for (const [key, load] of supportedLoads) if (load.bodyId === id) supportedLoads.delete(key);
      for (const handle of item.colliders) colliders.delete(handle);
      meshVertexCount -= item.meshVertices; meshTriangleCount -= item.meshTriangles;
      bodies.delete(id);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // Both own WASM resources. Free the world even if queue teardown throws.
      try { queue.free(); } finally {
        try { world.free(); } finally {
          bodies.clear(); colliders.clear(); joints.clear(); supportedLoads.clear(); pendingEvents = []; overflow = 0;
          meshVertexCount = meshTriangleCount = 0;
        }
      }
    },
  });
}
