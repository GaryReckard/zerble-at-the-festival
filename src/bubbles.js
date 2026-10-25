import { terrainHeight } from './worldgen/terrain.js';
// Bubble particle system. InstancedMesh of transmissive spheres with simple physics.

import * as THREE from 'three';
import { PERF } from './perf.js';
import { BUBBLE_TYPES, SPECIAL, pickSpecial, specialRate } from './bubbleTypes.js';
import { SpecialBubbleRenderer } from './specialBubbles.js';

// Pool size is tier-aware (see PERF.bubblePoolMax). The previous fixed 200
// was already saturated at normal play — every G-key blast just churned
// existing bubbles instead of producing a denser cloud. High tier now sees
// 600 so blast mode actually reads as a visible fountain.
const MAX_BUBBLES = PERF.bubblePoolMax || 200;
const SPAWN_PER_SEC = 40;

// Bubble-juice meter (resource layer on the core verb). The tank drains while
// bubbling and ~3x faster while the G blast is held. When it runs dry the
// bubbles STOP (the last 0.25 sputters out to nothing) — and a dry Zerble
// makes NPCs frown (see crowd.js). Refueled by drive-over jugs + the bubble
// vendor (models/bubbleJug.js, models/bubbleVendor.js).
//
// Zelda-style stockpile: no cap — gather as many jugs as you can find.
// Jugs each add a full meter (stacking past 1), so you can load up arbitrarily
// deep; the vendor only tops the current meter (cap 1). The HUD shows the
// working meter as a bar + the spare whole meters as a "N× jug" count. (The
// physical under-seat jugs in zerble.js still cap at a poolful — the cavity
// just packs full — but the stockpile number itself is unbounded.)
const JUICE_DRAIN_PER_SEC = 0.0072;  // ~140s of normal bubbling per meter (20% slower than the 0.009 first pass — drains a touch too quick)
const JUICE_BLAST_DRAIN = 3.0;       // the G blast burns it ~3x faster
export const JUICE_STACK_MAX = Infinity;   // no stockpile cap — Gary wanted unlimited jugs
const GRAVITY = -0.45;
const BUOYANCY = 1.0;
const LIFETIME = 22;     // ~2.75x the original 8s — bubbles linger long enough to feel like a trail
const POP_TIME = 0.25;
const DROPLETS_PER_POP = 7;
const MAX_DROPLETS = 128;

// Reused across every _writeInstance call — avoids a Vector3 allocation per live bubble per frame.
const _AXIS_Y = new THREE.Vector3(0, 1, 0);
const TYPE_INDEX = new Map(BUBBLE_TYPES.map((type, index) => [type.id, index]));
const EMPTY_CONTEXT = Object.freeze({});

// Slowly varying global wind so all bubbles drift coherently most of the time.
// Amplitudes are tuned so bubbles travel several meters from spawn before popping.
let _windT = 0;
const _windScratch = { x: 0, z: 0 };
function sampleWind(t) {
  _windScratch.x = Math.sin(t * 0.21) * 2.4 + Math.cos(t * 0.07) * 1.6 + Math.sin(t * 0.43) * 0.8;
  _windScratch.z = Math.cos(t * 0.18) * 2.4 + Math.sin(t * 0.05) * 1.6 + Math.cos(t * 0.37) * 0.8;
  return _windScratch;
}

export class Bubbles {
  constructor() {
    const geo = new THREE.IcosahedronGeometry(0.11, 1); // about half the previous size

    // Fancy material — full physical (transmission, iridescence, sheen).
    // Built once here so adaptive downgrades never trigger a shader compile.
    this._fancyMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.95,
      thickness: 0.4,
      ior: 1.2,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      // Iridescent rim tint
      iridescence: 0.6,
      iridescenceIOR: 1.3,
      sheen: 0.4,
      sheenColor: new THREE.Color(0xff9ad1),
      // No emissive — bubbles stay transparent. At night the iridescence/sheen
      // ramps up in update() to give a glint effect instead of white blobs.
      emissive: 0x000000,
      emissiveIntensity: 0,
    });

    // Cheap material — plain Standard (no transmission/iridescence). Pre-built
    // here so setCheapMaterial() just swaps a reference with zero allocation.
    // It's already `transparent`, so opacity is free to lower — the draw path
    // is unchanged. Was opacity 0.55 + metalness 0.25, which read as fairly
    // solid white/grey marbles under daylight (the metalness reflected the
    // bright sky). Dropped opacity to 0.32 so they're properly see-through and
    // trimmed metalness to 0.1 so they stop picking up the grey sky as a
    // specular wash — closer to the fancy material's glassy look, still cheap.
    this._cheapMat = new THREE.MeshStandardMaterial({
      color: 0xd0eeff,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.InstancedMesh(geo, this._fancyMat, MAX_BUBBLES);
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.activeCount = 0;

    // A single child draw keeps the little soap flecks inside the existing
    // bubble render path, including its scene attachment and lifecycle.
    const dropletGeometry = new THREE.IcosahedronGeometry(0.025, 0);
    const dropletMaterial = new THREE.MeshBasicMaterial({
      color: 0xbcecff, transparent: true, opacity: 0.38, depthWrite: false,
    });
    this._dropletMesh = new THREE.InstancedMesh(dropletGeometry, dropletMaterial, MAX_DROPLETS);
    this._dropletMesh.count = MAX_DROPLETS;
    this._dropletMesh.frustumCulled = false;
    this._dropletMesh.castShadow = false;
    this._dropletMatrix = new THREE.Matrix4();
    this._dropletPosition = new THREE.Vector3();
    this._dropletScale = new THREE.Vector3();
    for (let i = 0; i < MAX_DROPLETS; i++) {
      this._dropletMesh.setMatrixAt(i, this._dropletMatrix.makeScale(0, 0, 0));
    }
    this._droplets = Array.from({ length: MAX_DROPLETS }, () => ({
      alive: false, age: 0, life: POP_TIME,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    }));
    this._dropletCursor = 0;
    this._dropletCount = 0;
    this._popSerial = 0;
    this.mesh.add(this._dropletMesh);

    // Hide all instances initially by scaling to 0.
    const m = new THREE.Matrix4();
    m.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_BUBBLES; i++) {
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    this.particles = new Array(MAX_BUBBLES).fill(null).map(() => ({
      alive: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      size: 1,
      age: 0,
      life: LIFETIME,
      popping: false,
      spin: Math.random() * Math.PI * 2,
      // Personality, assigned at spawn:
      //   0 = follower (mostly the global wind, tiny jitter)
      //   1 = wanderer (ignores wind, strong own-drift)
      //   2 = spinner  (corkscrew motion around a vertical axis)
      //   3 = sprinter (high initial outward kick, then slows)
      kind: 0,
      // Per-bubble unique drift direction (for wanderers/sprinters)
      driftX: 0,
      driftZ: 0,
      driftMag: 0,
      // Per-bubble spinner phase + radius
      swirlPhase: 0,
      swirlRate: 0,
      swirlRadius: 0,
    }));

    this._specialRenderer = new SpecialBubbleRenderer();
    this.specialRoot = this._specialRenderer.root;
    this.specialParticles = Array.from({ length: SPECIAL.pool }, () => ({
      alive: false,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(),
      size: 1, age: 0, life: LIFETIME, popping: false, spin: 0,
      kind: 0, driftX: 0, driftZ: 0, driftMag: 0,
      swirlPhase: 0, swirlRate: 0, swirlRadius: 0,
      type: -1, seed: 0,
    }));
    this.specialActiveCount = 0;
    this._specialSpawnAcc = 0;
    this._specialEligible = [];
    this._specialContext = EMPTY_CONTEXT;
    this._progress = null;
    this._forcedSpecial = null;
    this._burstType = null;
    this._burstRemaining = 0;
    this._burstAcc = 0;

    this.emittedCount = 0;
    this._spawnAcc = 0;
    this._tmpMat = new THREE.Matrix4();
    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpScale = new THREE.Vector3();

    // Blast mode — when on, spawn rate is multiplied by BLAST_MULT for a
    // dramatic bubble fountain. Toggled per-frame from main.js based on the
    // G key. ~2.8× sits between the requested 2-3×.
    this.blastMode = false;

    // Star power multiplier — set by main.js while the buff is active. Boosts
    // emit without the extra juice drain blast costs (star power is a gift).
    this.starBoost = 1;

    // Bubble-juice reserve (0..JUICE_STACK_MAX, in meters). Session-scoped —
    // fresh single tank each run.
    this.juice = 1.0;
  }

  setBlast(on) {
    this.blastMode = !!on;
  }

  setStarPower(on) {
    this.starBoost = on ? 2.5 : 1;
  }

  setProgress(progress) {
    this._progress = progress;
  }

  setSpecialContext(ctx) {
    this._specialContext = ctx || EMPTY_CONTEXT;
  }

  forceSpecial(id = null) {
    this._forcedSpecial = id !== null && TYPE_INDEX.has(id) ? id : null;
  }

  unlockBurst(id) {
    if (!TYPE_INDEX.has(id)) return;
    this._burstType = id;
    this._burstRemaining = SPECIAL.burstSec;
    this._burstAcc = 0;
  }

  // Refuel. `cap` is the most this call will fill TO (default = full stockpile).
  // Jugs pass the default (stack deep); the vendor passes 1.0 (tops only the
  // current meter). Never reduces juice if it's already above `cap`.
  addJuice(amt, cap = JUICE_STACK_MAX) {
    if (this.juice >= cap) return;
    this.juice = Math.min(cap, this.juice + (amt || 0));
  }

  // Called by main.js via the AdaptiveQuality onLevelChange hook.
  // Swaps between the pre-built fancy (MeshPhysical) and cheap (MeshStandard)
  // materials with zero allocation — no shader compile mid-frame.
  setCheapMaterial(on) {
    this.mesh.material = on ? this._cheapMat : this._fancyMat;
  }

  // dt: frame delta. zerble: cart for spawn pose. nightness: 0..1 from the
  // time-of-day system — bubbles emit more light at night so they pick up
  // the festival glow instead of going invisible.
  update(dt, zerble, nightness = 0, camera = null) {
    // Nightness ramp only applies to the fancy material — cheap Standard doesn't
    // have iridescence/sheen properties and they'd be silently ignored anyway.
    if (this.mesh.material === this._fancyMat) {
      this._fancyMat.iridescence    = THREE.MathUtils.lerp(0.2, 0.85, nightness);
      this._fancyMat.iridescenceIOR = THREE.MathUtils.lerp(1.3, 1.7, nightness);
      this._fancyMat.sheen          = THREE.MathUtils.lerp(0.0, 0.6, nightness);
      this._fancyMat.sheenColor.setHex(0xffffff);
    }
    _windT += dt;
    // Spawn rate scales with cart speed — at rest, slow ambient drip; moving, full stream.
    // Blast mode (G key) multiplies the rate ~2.8× regardless of speed for
    // an extra-thick bubble fountain.
    const speed = Math.abs(zerble.speed);
    const BLAST_MULT = 2.8;
    const blast = this.blastMode ? BLAST_MULT : 1.0;
    // Drain the juice tank (faster on blast). Bubbles flow full while there's
    // any meaningful charge and sputter to a stop over the final 0.25 — so an
    // empty tank means NO bubbles (the stakes that make NPCs frown).
    this.juice = Math.max(0, this.juice - JUICE_DRAIN_PER_SEC * (this.blastMode ? JUICE_BLAST_DRAIN : 1.0) * dt);
    const juiceFactor = Math.min(1, this.juice / 0.25);
    const rate = SPAWN_PER_SEC * (0.55 + Math.min(1, speed / 8) * 0.45) * blast * this.starBoost * juiceFactor;
    this._spawnAcc += rate * dt;

    while (this._spawnAcc >= 1) {
      this._spawnAcc -= 1;
      this._spawnOne(zerble);
    }

    this._specialRenderer.beginFrame(camera, nightness, dt);
    if (this._progress) {
      this._specialEligible.length = 0;
      for (let i = 0; i < BUBBLE_TYPES.length; i++) {
        const type = BUBBLE_TYPES[i];
        if (this._progress.isEnabled(type.id)) this._specialEligible.push(type.id);
      }
      const specialBaseRate = this._forcedSpecial
        ? SPECIAL.baseRate * 3
        : specialRate(this._specialEligible, this._specialContext);
      const specialEmissionRate = specialBaseRate * juiceFactor
        * (0.55 + Math.min(1, speed / 8) * 0.45)
        * (this.blastMode ? SPECIAL.blastMult : 1);
      this._specialSpawnAcc += specialEmissionRate * dt;
      while (this._specialSpawnAcc >= 1) {
        this._specialSpawnAcc -= 1;
        const id = this._forcedSpecial || pickSpecial(this._specialEligible, this._specialContext);
        if (id) this._spawnSpecialOne(zerble, id);
      }
      if (this._burstRemaining > 0) {
        const burstDt = Math.min(dt, this._burstRemaining);
        this._burstRemaining -= burstDt;
        if (this._burstRemaining < 1e-9) this._burstRemaining = 0;
        this._burstAcc += SPECIAL.burstRate * burstDt;
        while (this._burstAcc >= 1 - 1e-9) {
          this._burstAcc = Math.max(0, this._burstAcc - 1);
          this._spawnSpecialOne(zerble, this._burstType);
        }
      }
    }

    let activeCount = 0;
    let renderCount = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;

      p.age += dt;

      if (p.popping) {
        this._popBubble(i, p);
        continue;
      }

      if (p.age >= p.life) {
        this._popBubble(i, p);
        continue;
      }

      if (this._stepParticle(p, i, dt, 1)) {
        this._popBubble(i, p);
        continue;
      }

      activeCount++;
      renderCount = i + 1;
      this._writeInstance(i, p.pos, p.size, p.spin);
    }

    let specialActiveCount = 0;
    for (let i = 0; i < this.specialParticles.length; i++) {
      const p = this.specialParticles[i];
      if (!p.alive) continue;
      p.age += dt;
      if (p.popping || p.age >= p.life || this._stepParticle(p, MAX_BUBBLES + i, dt, 0.5)) {
        this._popSpecial(p);
        continue;
      }
      specialActiveCount++;
      this._specialRenderer.write(p.type, p.pos, p.size, p.spin, p.age, p.seed);
    }
    this.specialActiveCount = specialActiveCount;
    this._specialRenderer.endFrame(dt);

    this._updateDroplets(dt);
    this.activeCount = activeCount;
    // r160 uses this cached sphere for transparency sorting even with culling off.
    // Preserve the original full-pool bound, including zero-scaled dead slots.
    if (activeCount > 0 && this.mesh.boundingSphere === null) {
      this.mesh.count = MAX_BUBBLES;
      this.mesh.computeBoundingSphere();
    }
    // Keep slot order (it drives motion and transparency), skipping only the dead tail.
    this.mesh.count = renderCount;
    this.mesh.visible = activeCount > 0 || this._dropletCount > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  _stepParticle(p, i, dt, windFactor) {
    p.vel.y += (BUOYANCY + GRAVITY) * dt;
    const wind = sampleWind(_windT + i * 0.13);
    switch (p.kind) {
      case 0: {
        const jitterX = Math.sin(p.age * (1.4 + (i % 7) * 0.2) + i) * 1.2;
        const jitterZ = Math.cos(p.age * (1.1 + (i % 5) * 0.27) + i * 1.3) * 1.2;
        p.vel.x += (wind.x * windFactor + jitterX) * dt;
        p.vel.z += (wind.z * windFactor + jitterZ) * dt;
        break;
      }
      case 1: {
        p.vel.x += (p.driftX * p.driftMag + wind.x * 0.1 * windFactor) * dt;
        p.vel.z += (p.driftZ * p.driftMag + wind.z * 0.1 * windFactor) * dt;
        p.vel.x += Math.sin(p.age * 3 + i) * 1.6 * dt;
        p.vel.z += Math.cos(p.age * 2.4 + i * 1.7) * 1.6 * dt;
        break;
      }
      case 2: {
        p.swirlPhase += p.swirlRate * dt;
        const tangX = -Math.sin(p.swirlPhase);
        const tangZ = Math.cos(p.swirlPhase);
        const swirlMag = p.swirlRadius * Math.abs(p.swirlRate);
        p.vel.x += (tangX * swirlMag + wind.x * 0.3 * windFactor) * dt;
        p.vel.z += (tangZ * swirlMag + wind.z * 0.3 * windFactor) * dt;
        p.vel.y += 0.4 * dt;
        break;
      }
      case 3: {
        const burst = Math.max(0, 1 - p.age);
        p.vel.x += (p.driftX * p.driftMag * 2 * burst + wind.x * 0.4 * windFactor) * dt;
        p.vel.z += (p.driftZ * p.driftMag * 2 * burst + wind.z * 0.4 * windFactor) * dt;
        break;
      }
    }
    const dampingExp = p.kind === 0 ? 0.92 : (p.kind === 3 ? 0.96 : 0.95);
    p.vel.multiplyScalar(Math.pow(dampingExp, dt * 60));
    p.pos.addScaledVector(p.vel, dt);
    p.spin += dt * 0.5;
    return p.pos.y < terrainHeight(p.pos.x, p.pos.z) + 0.2;
  }

  _popBubble(i, p) {
    if (!p.alive) return;
    p.alive = false;
    p.popping = true;
    this._tmpMat.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(i, this._tmpMat);

    // Fibonacci-sphere directions spread each pop across the full sphere and
    // rotate successive bursts without consuming the world's random stream.
    const serial = this._popSerial++;
    const phase = serial * 2.399963229728653;
    for (let j = 0; j < DROPLETS_PER_POP; j++) {
      const slot = this._dropletCursor;
      this._dropletCursor = (slot + 1) % MAX_DROPLETS;
      const d = this._droplets[slot];
      if (!d.alive) this._dropletCount++;
      const y = 1 - 2 * (j + 0.5) / DROPLETS_PER_POP;
      const radius = Math.sqrt(1 - y * y);
      const angle = phase + j * 2.399963229728653;
      const speed = 1.0 + ((serial + j * 3) % 5) * 0.15;
      const shellRadius = 0.11 * p.size;
      d.alive = true;
      d.age = 0;
      d.life = POP_TIME;
      d.x = p.pos.x + Math.cos(angle) * radius * shellRadius;
      d.y = p.pos.y + y * shellRadius;
      d.z = p.pos.z + Math.sin(angle) * radius * shellRadius;
      d.vx = Math.cos(angle) * radius * speed;
      d.vy = y * speed;
      d.vz = Math.sin(angle) * radius * speed;
    }
  }

  _updateDroplets(dt) {
    let live = 0;
    for (let i = 0; i < MAX_DROPLETS; i++) {
      const d = this._droplets[i];
      if (!d.alive) continue;
      d.age += dt;
      const t = d.age / d.life;
      if (t >= 1) {
        d.alive = false;
        this._dropletCount--;
        this._dropletMesh.setMatrixAt(i, this._dropletMatrix.makeScale(0, 0, 0));
        continue;
      }
      const damping = Math.pow(0.88, dt * 60);
      d.vx *= damping; d.vy *= damping; d.vz *= damping;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      this._dropletPosition.set(d.x, d.y, d.z);
      this._dropletScale.setScalar(1 - t);
      this._dropletMatrix.compose(this._dropletPosition, this._tmpQuat, this._dropletScale);
      this._dropletMesh.setMatrixAt(i, this._dropletMatrix);
      live++;
    }
    this._dropletMesh.visible = live > 0;
    this._dropletMesh.instanceMatrix.needsUpdate = true;
  }

  _spawnOne(zerble) {
    // Find a dead slot
    let idx = -1;
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].alive) {
        idx = i;
        break;
      }
    }
    if (idx === -1) return;

    const p = this.particles[idx];
    p.alive = true;
    p.popping = false;
    p.age = 0;
    p.life = LIFETIME * (0.7 + Math.random() * 0.6);
    p.size = 0.7 + Math.random() * 1.3;
    p.pos.copy(zerble.nozzleWorld);
    p.pos.x += (Math.random() - 0.5) * 0.15;
    p.pos.z += (Math.random() - 0.5) * 0.15;

    // Roll a personality
    const r = Math.random();
    if (r < 0.55) p.kind = 0;       // follower (most bubbles)
    else if (r < 0.78) p.kind = 1;  // wanderer
    else if (r < 0.92) p.kind = 2;  // spinner
    else p.kind = 3;                // sprinter

    // Per-bubble random drift direction (used by wanderer/sprinter)
    const ang = Math.random() * Math.PI * 2;
    p.driftX = Math.cos(ang);
    p.driftZ = Math.sin(ang);
    p.driftMag = 2 + Math.random() * 3;

    // Spinner config
    p.swirlPhase = Math.random() * Math.PI * 2;
    p.swirlRate = (Math.random() < 0.5 ? 1 : -1) * (3 + Math.random() * 3);
    p.swirlRadius = 0.3 + Math.random() * 0.6;

    // Initial velocity: launched straight out the back, mostly horizontal
    const back = zerble.forwardWorld.clone().multiplyScalar(-1);
    p.vel.set(back.x * 2.6, 0.3 + Math.random() * 0.5, back.z * 2.6);
    p.vel.x += (Math.random() - 0.5) * 1.2;
    p.vel.z += (Math.random() - 0.5) * 1.2;
    p.vel.y += (Math.random() - 0.5) * 0.4;

    p.spin = Math.random() * Math.PI * 2;

    this._writeInstance(idx, p.pos, p.size, p.spin);
    this.emittedCount++;
  }

  _spawnSpecialOne(zerble, id) {
    const typeIndex = TYPE_INDEX.get(id);
    if (typeIndex === undefined) return false;
    let p = null;
    for (let i = 0; i < this.specialParticles.length; i++) {
      if (!this.specialParticles[i].alive) {
        p = this.specialParticles[i];
        break;
      }
    }
    if (!p) return false;
    p.alive = true;
    p.popping = false;
    p.age = 0;
    p.life = LIFETIME * (0.7 + Math.random() * 0.6) * SPECIAL.lifeMult;
    p.size = SPECIAL.sizeMin + Math.random() * (SPECIAL.sizeMax - SPECIAL.sizeMin);
    p.pos.copy(zerble.nozzleWorld);
    p.pos.x += (Math.random() - 0.5) * 0.15;
    p.pos.z += (Math.random() - 0.5) * 0.15;
    const r = Math.random();
    if (r < 0.55) p.kind = 0;
    else if (r < 0.78) p.kind = 1;
    else if (r < 0.92) p.kind = 2;
    else p.kind = 3;
    const ang = Math.random() * Math.PI * 2;
    p.driftX = Math.cos(ang);
    p.driftZ = Math.sin(ang);
    p.driftMag = 2 + Math.random() * 3;
    p.swirlPhase = Math.random() * Math.PI * 2;
    p.swirlRate = (Math.random() < 0.5 ? 1 : -1) * (3 + Math.random() * 3);
    p.swirlRadius = 0.3 + Math.random() * 0.6;
    p.vel.set(-zerble.forwardWorld.x * 2.6, 0.3 + Math.random() * 0.5,
      -zerble.forwardWorld.z * 2.6);
    p.vel.x += (Math.random() - 0.5) * 1.2;
    p.vel.z += (Math.random() - 0.5) * 1.2;
    p.vel.y += (Math.random() - 0.5) * 0.4;
    p.spin = Math.random() * Math.PI * 2;
    p.type = typeIndex;
    p.seed = Math.random();
    this.emittedCount++;
    return true;
  }

  _popSpecial(p) {
    if (!p.alive) return;
    p.alive = false;
    p.popping = true;
    this._specialRenderer.pop(p.type, p.pos, p.size);
  }

  _writeInstance(i, pos, scale, spin) {
    this._tmpPos.copy(pos);
    this._tmpQuat.setFromAxisAngle(_AXIS_Y, spin);
    this._tmpScale.setScalar(scale);
    this._tmpMat.compose(this._tmpPos, this._tmpQuat, this._tmpScale);
    this.mesh.setMatrixAt(i, this._tmpMat);
  }

  // Iterate live bubbles — used by crowd to detect nearby bubbles.
  forEachAlive(cb) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.alive && !p.popping) cb(p);
    }
    for (let i = 0; i < this.specialParticles.length; i++) {
      const p = this.specialParticles[i];
      if (p.alive && !p.popping) cb(p);
    }
  }
}
