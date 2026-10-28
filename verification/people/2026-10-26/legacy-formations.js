// Frozen pre-ownership formation algorithms and route math for Task 2.11.
// Verification only; never imported by the game.
function avoidLakes(path) {
  for (let i = 0; i < path.length; i++) {
    const fixed = projectOutOfLake(path[i].x, path[i].z, 3.0);
    if (fixed) {
      path[i].x = fixed.x;
      path[i].z = fixed.z;
    }
  }
}

// ---- Loop relocation (puppet parade + brass band) ---------------------------
// Both the parade and the band march a fixed-shape loop that is *placed* at a
// random anchor rather than hardcoded near origin. The loop spawns 0..150m from
// world origin (so it isn't always sitting on the start area), and once the
// player has driven a long way off — LOOP_RECYCLE_DIST, deliberately farther
// than the wook recycle (300m) so relocation is a rarer event — the whole loop
// hops to a fresh anchor 150..300m around the player. That "far" reappear range
// means the unit shows up across the field (and, for the band, the music —
// inaudible at recycle distance — fades in naturally as you approach) rather
// than popping in right on top of you.
const LOOP_INITIAL_SPREAD = 150;   // initial spawn radius around world origin
const LOOP_RECYCLE_DIST   = 500;   // player must get this far from the loop to relocate
const LOOP_REAPPEAR_NEAR  = 150;   // relocate ring min, around the player
const LOOP_REAPPEAR_FAR   = 300;   // relocate ring max

// Rewrite `path` in place to `basePath` (the loop's local shape) shifted to a
// lake-free anchor picked at radius [rNear, rFar] from (cx, cz). Returns the
// chosen anchor so the caller can track the loop's center for the recycle test.
function placeLoop(path, basePath, cx, cz, rNear, rFar) {
  const a = _pickPositionAvoidingLakes(cx, cz, rNear, rFar);
  for (let i = 0; i < path.length; i++) {
    path[i].set(basePath[i].x + a.x, 0, basePath[i].z + a.z);
  }
  avoidLakes(path);
  return a;
}

// If the player has wandered past LOOP_RECYCLE_DIST from `anchor`, relocate the
// loop 150..300m around the player and return the new anchor; else return null.
// A null zerblePos (sandbox / no-player tick) never recycles.
function maybeRecycleLoop(path, basePath, anchor, zerblePos) {
  if (!zerblePos) return null;
  const dx = anchor.x - zerblePos.x;
  const dz = anchor.z - zerblePos.z;
  if (dx * dx + dz * dz <= LOOP_RECYCLE_DIST * LOOP_RECYCLE_DIST) return null;
  return placeLoop(path, basePath, zerblePos.x, zerblePos.z, LOOP_REAPPEAR_NEAR, LOOP_REAPPEAR_FAR);
}

export class PuppetParade {
  constructor({ preview = false } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'PuppetParade';

    // A patrol path that loops through the festival. The loop shape is fixed
    // (_basePath, local coords); placeLoop() shifts the whole thing to a random
    // anchor. It spawns 0..150m from origin (not always on the start area) and
    // relocates far around the player once you've driven off — see
    // maybeRecycleLoop() in update(). Uses Math.random() like the Wooks / Kids /
    // Frisbees (these mobile units aren't seed-deterministic, by design).
    this._basePath = [
      new THREE.Vector3(-70, 0, -10),
      new THREE.Vector3(-30, 0, 20),
      new THREE.Vector3(20, 0, 10),
      new THREE.Vector3(60, 0, -20),
      new THREE.Vector3(40, 0, -60),
      new THREE.Vector3(-20, 0, -50),
      new THREE.Vector3(-60, 0, -30),
    ];
    this.path = this._basePath.map((p) => p.clone());
    this._preview = preview;
    if (preview) {
      this._anchor = { x: -this._basePath[0].x, z: -this._basePath[0].z };
      for (const point of this.path) {
        point.x += this._anchor.x;
        point.z += this._anchor.z;
      }
    } else {
      this._anchor = placeLoop(this.path, this._basePath, 0, 0, 0, LOOP_INITIAL_SPREAD);
    }
    this.speed = 2.4;

    this.puppets = [];
    let ahead = 0;
    for (let i = 0; i < PARADE_ROSTER.length; i++) {
      const puppet = buildPuppet(PARADE_ROSTER[i], i);
      if (i) ahead += i <= 2 ? 7 : 4.5;
      puppet.userData.distance = -ahead;
      // Honk-scatter offset: while dodgeTimer > 0, the puppet's path-derived
      // position gets nudged perpendicular by (dodgeDirX, dodgeDirZ) * eased
      // amount, then snaps back as the timer winds down. Path progression
      // keeps running underneath so the parade still marches through.
      puppet.userData.dodgeTimer = 0;
      puppet.userData.dodgeDirX = 0;
      puppet.userData.dodgeDirZ = 0;
      this.group.add(puppet);
      this.puppets.push(puppet);
    }

    this.colliders = this.puppets.flatMap(p => p.userData.rig.carriers.map((carrier, i) => ({
      position: new THREE.Vector3(), radius: p.userData.kind === 'dragon' && i !== 1 ? 0.65 : 1.4,
      damage: 8, kind: 'puppet', carrier, puppet: p,
    })));

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
  }

  // Honk-scatter: puppets in front of parked Zerble get a temporary lateral
  // dodge offset. They keep walking along their path but sidestep by ~2.5m
  // for ~1.4s, then ease back.
  scatter(zerble) {
    if (!zerble || !zerble.forwardWorld) return;
    const FRONT_RANGE = 12;
    const FRONT_RANGE_SQ = FRONT_RANGE * FRONT_RANGE;
    const fx = zerble.forwardWorld.x;
    const fz = zerble.forwardWorld.z;
    for (const p of this.puppets) {
      const dx = p.position.x - zerble.position.x;
      const dz = p.position.z - zerble.position.z;
      if (dx * dx + dz * dz > FRONT_RANGE_SQ) continue;
      if (dx * fx + dz * fz <= 0) continue;
      const inv = 1 / Math.sqrt(dx * dx + dz * dz || 0.0001);
      p.userData.dodgeTimer = 1.4;
      p.userData.dodgeDirX = dx * inv;
      p.userData.dodgeDirZ = dz * inv;
    }
  }

  update(dt, zerblePos) {
    const recycled = this._preview ? null : maybeRecycleLoop(this.path, this._basePath, this._anchor, zerblePos);
    if (recycled) this._anchor = recycled;
    const totalLen = pathLength(this.path);
    for (let i = 0; i < this.puppets.length; i++) {
      const p = this.puppets[i];
      p.userData.distance = (p.userData.distance + this.speed * dt + totalLen * 100) % totalLen;
      const { pos, dir } = samplePath(this.path, p.userData.distance, this._tmpA, this._tmpB);
      p.position.copy(pos);
      // Apply dodge offset on top of the path position. Triangle pulse
      // (ramps up, holds, eases out) over the dodge timer's lifetime.
      if (p.userData.dodgeTimer > 0) {
        p.userData.dodgeTimer -= dt;
        const ratio = Math.max(0, p.userData.dodgeTimer / 1.4);  // 1 → 0
        // Bell curve: peaks mid-dodge so the offset eases in and out.
        const env = Math.sin((1 - ratio) * Math.PI);
        const DODGE_DIST = 2.5;
        p.position.x += p.userData.dodgeDirX * DODGE_DIST * env;
        p.position.z += p.userData.dodgeDirZ * DODGE_DIST * env;
      }
      // Their "front" geometry (eyes/mouth) is at local -Z, so face the direction of travel
      // by setting yaw so that local -Z points along dir.
      const yaw = Math.atan2(-dir.x, -dir.z);
      p.position.y = terrainHeight(p.position.x, p.position.z);
      p.rotation.y = yaw;

      // Per-puppet bob (sandbox calls the same tick — see models/puppet.js)
      setPuppetNightness(p, getTimeOfDay()?.nightness ?? 0);
      tickPuppet(p, dt);

    }
    this.group.updateMatrixWorld(true);
    for (const collider of this.colliders) {
      collider.carrier.getWorldPosition(collider.position);
      collider.position.y = collider.puppet.position.y + 1;
    }
  }
}

export class BrassBand {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'BrassBand';

    // Fixed loop shape (local coords). This was hardcoded near origin, so the
    // band always blared right at world spawn; now placeLoop() shifts it to a
    // random anchor 0..150m from origin, and it relocates far around the player
    // once you've driven off — same model as the puppet parade (maybeRecycleLoop
    // in update()). The music source (attached below) tracks the band leader,
    // so it travels with the relocation; recycle only fires at 500m+, where the
    // band is already inaudible, so the teleport is silent.
    this._basePath = [
      new THREE.Vector3(80, 0, 70),
      new THREE.Vector3(40, 0, 95),
      new THREE.Vector3(-30, 0, 95),
      new THREE.Vector3(-90, 0, 70),
      new THREE.Vector3(-95, 0, 10),
      new THREE.Vector3(-60, 0, -10),
      new THREE.Vector3(0, 0, 30),
      new THREE.Vector3(60, 0, 30),
      new THREE.Vector3(85, 0, 50),
    ];
    this.path = this._basePath.map((p) => p.clone());
    this._anchor = placeLoop(this.path, this._basePath, 0, 0, 0, LOOP_INITIAL_SPREAD);
    this.speed = 1.8;

    this.members = [];
    // Grand-marshal-led second-line formation: parasol up front, two
    // trumpets + sax behind, tuba + drum + trombone in the back row.
    // Distinct instruments per row gives the silhouette real variety.
    const formation = [
      [0, 1.6, 'parasol'],         // grand marshal up front (positive Z = ahead)
      [-1.4, 0, 'trumpet'],
      [1.4, 0, 'trumpet'],
      [0, -1.0, 'sax'],
      [-2.6, -2.2, 'trombone'],
      [0, -2.4, 'tuba'],
      [2.6, -2.2, 'drum'],
    ];

    for (const [offX, offZ, instrument] of formation) {
      const m = instrument === 'parasol' ? buildParasolMarshal() : buildBandMember(instrument, this.members.length);
      m.userData.formationOff = new THREE.Vector3(offX, 0, offZ);
      m.userData.instrument = instrument;
      this.group.add(m);
      this.members.push(m);
    }

    this.colliders = this.members.map(() => ({
      position: new THREE.Vector3(),
      radius: 1.0,
      damage: 6,
      kind: 'brass',
    }));

    this._parasolPhase = 0;

    this.distance = 0;
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();

    // Unit-level honk-scatter offset. The whole formation sidesteps together
    // when any member is in front of parked Zerble.
    this._dodgeTimer = 0;
    this._dodgeDirX = 0;
    this._dodgeDirZ = 0;

    // Continuous second-line groove that follows the band around the world.
    // Attached ONCE here — a constant seed keeps the tune stable across
    // reloads (only one brass band exists, so per-band variation is moot).
    // The band is built at module load, before the start-tap Sound.init, so
    // attachStageMusic returns a deferred handle that Sound.init adopts when
    // the AudioContext comes online; position updates before then are buffered.
    this._music = Sound.attachStageMusic(
      this.path[0].x, terrainHeight(this.path[0].x, this.path[0].z) + 1, this.path[0].z, 0xb4a55, 'second_line',
    );
  }

  scatter(zerble) {
    if (!zerble || !zerble.forwardWorld) return;
    const FRONT_RANGE = 14;        // bigger range because the formation spans ~6m
    const FRONT_RANGE_SQ = FRONT_RANGE * FRONT_RANGE;
    const fx = zerble.forwardWorld.x;
    const fz = zerble.forwardWorld.z;
    // Trigger if ANY member is in front + in range. Use member positions
    // (set by last update tick) — they reflect the current marching pose.
    for (const m of this.members) {
      const dx = m.position.x - zerble.position.x;
      const dz = m.position.z - zerble.position.z;
      if (dx * dx + dz * dz > FRONT_RANGE_SQ) continue;
      if (dx * fx + dz * fz <= 0) continue;
      // Direction = away from Zerble, derived from this triggering member.
      const inv = 1 / Math.sqrt(dx * dx + dz * dz || 0.0001);
      this._dodgeTimer = 1.6;
      this._dodgeDirX = dx * inv;
      this._dodgeDirZ = dz * inv;
      return;  // one trigger sidesteps the whole unit
    }
  }

  update(dt, zerblePos) {
    const recycled = maybeRecycleLoop(this.path, this._basePath, this._anchor, zerblePos);
    if (recycled) this._anchor = recycled;
    const totalLen = pathLength(this.path);
    this.distance = (this.distance + this.speed * dt + totalLen * 100) % totalLen;
    const { pos: leadPos, dir: leadDir } = samplePath(this.path, this.distance, this._tmpA, this._tmpB);
    // Face the direction of travel: yaw rotates local -Z to align with dir.
    const yaw = Math.atan2(-leadDir.x, -leadDir.z);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    // Unit-level dodge offset (honk scatter). Sidestep ~3m perpendicular for
    // the dodge timer's lifetime; bell-curve envelope eases in and out.
    let dodgeOX = 0, dodgeOZ = 0;
    if (this._dodgeTimer > 0) {
      this._dodgeTimer -= dt;
      const ratio = Math.max(0, this._dodgeTimer / 1.6);
      const env = Math.sin((1 - ratio) * Math.PI);
      const DODGE_DIST = 3.0;
      dodgeOX = this._dodgeDirX * DODGE_DIST * env;
      dodgeOZ = this._dodgeDirZ * DODGE_DIST * env;
    }

    for (let i = 0; i < this.members.length; i++) {
      const m = this.members[i];
      const off = m.userData.formationOff;
      // Rotate the offset into the band's heading
      const ox = off.x * cos + off.z * sin;
      const oz = -off.x * sin + off.z * cos;
      m.position.set(leadPos.x + ox + dodgeOX, 0, leadPos.z + oz + dodgeOZ);
      m.position.y = terrainHeight(m.position.x, m.position.z);
      m.rotation.y = yaw;

      // Marching bob + (for the marshal) parasol twirl — both live in
      // the model files now so the sandbox uses the same animation.
      if (m.userData.instrument === 'parasol') {
        tickParasolMarshal(m, dt);
      } else {
        tickBandMember(m, dt);
      }

      this.colliders[i].position.copy(m.position);
      this.colliders[i].position.y = m.position.y + 1;
    }

    // Move the spatial music source to the band leader's current position so
    // the music actually walks around the festival with them.
    if (this._music && this._music.setPosition) {
      this._music.setPosition(leadPos.x, terrainHeight(leadPos.x, leadPos.z) + 1, leadPos.z);
    }
  }
}

function pathLength(path) {
  let total = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    total += a.distanceTo(b);
  }
  return total;
}

function samplePath(path, distance, outPos, outDir) {
  let remaining = distance;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const seg = a.distanceTo(b);
    if (remaining <= seg) {
      const t = remaining / seg;
      outPos.lerpVectors(a, b, t);
      outDir.subVectors(b, a).normalize();
      return { pos: outPos, dir: outDir };
    }
    remaining -= seg;
  }
  outPos.copy(path[0]);
  outDir.set(0, 0, 1);
  return { pos: outPos, dir: outDir };
}
