// Fireworks — the day/night cycle's climax. A rocket whistles up from the
// festival with a sparky trail, then bursts into a coloured shell with a boom;
// a director schedules them through the deep of night, building to a once-per-
// night finale barrage at peak midnight.
//
// Design notes for the next agent:
//
//   * ONE additive InstancedMesh carries every spark (rocket trails + burst
//     sparks) — a single draw call regardless of how many shells are in the
//     air. Same pooled pattern as bubbles.js: a fixed `particles` array, dead
//     slots reused, `instanceMatrix.needsUpdate` each frame.
//   * Fade + twinkle are encoded into the per-instance COLOUR, not opacity.
//     With AdditiveBlending a single material can't vary opacity per instance,
//     but scaling a spark's colour toward black makes it vanish — so brightness
//     IS the colour multiplier. `setColorAt` + `instanceColor.needsUpdate`.
//   * Bloom (already on at night, main.js gates it on nightness) does the
//     glow for free — sparks are emissive-bright MeshBasic, no lights needed.
//     An optional per-burst flash PointLight exists but is gated behind
//     PERF.contextLights (off by default), same doctrine as campfires/torches.
//   * NOT chunk content: no registry entry, no determinism seed — purely
//     time + Math.random driven, so it's outside the worldgen golden surface.
//   * Idle by day: update() early-returns the scheduler below the night
//     threshold and the mesh hides when no spark is alive, so it costs nothing
//     until dusk.

import * as THREE from 'three';
import { PERF } from './perf.js';
import { Sound } from './sound.js';

const POOL = PERF.fireworksPoolMax || 550;

// Scheduler thresholds.
const NIGHT_ON = 0.85;          // ambient shows fire above this nightness
const FINALE_NIGHT = 0.97;      // the once-per-night barrage fires at peak dark
const GAP_MIN = 2.6, GAP_MAX = 6.5;   // seconds between ambient shells

// Rocket flight.
const ROCKET_GRAV = -9.0;       // decel on the way up
const APEX_VY = 5.0;            // burst when the rocket's rise slows to this
const TRAIL_PER_SEC = 34;       // trail sparks shed while climbing

// Spark physics base (scaled per recipe).
const GRAV = 9.8;

// Vibrant palette — [r,g,b] in 0..1, kept bright so additive + bloom pops.
const HUE = {
  red:     [1.00, 0.16, 0.18],
  gold:    [1.00, 0.78, 0.26],
  green:   [0.28, 1.00, 0.42],
  blue:    [0.34, 0.52, 1.00],
  magenta: [1.00, 0.28, 0.78],
  cyan:    [0.36, 1.00, 1.00],
  white:   [1.00, 1.00, 1.00],
  orange:  [1.00, 0.48, 0.16],
  purple:  [0.72, 0.40, 1.00],
};
const HUE_KEYS = Object.keys(HUE);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const rand = (a, b) => a + Math.random() * (b - a);

// All shell types the director rotates through (also the sandbox cycle order).
export const SHELL_TYPES = [
  'peony', 'chrysanthemum', 'willow', 'palm', 'ring',
  'crackle', 'strobe', 'colorchange', 'bicolor',
];

// ---- Burst-pattern direction samplers -------------------------------------
// Each fills `out` with a UNIT direction. Some need per-burst state (the ring's
// tilt plane), so makeRecipe() closes over that state below.

function sampleSphere(out) {
  // Uniform on the unit sphere.
  const u = Math.random() * 2 - 1;
  const th = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  out.set(r * Math.cos(th), u, r * Math.sin(th));
}

function sampleUpHemisphere(out) {
  sampleSphere(out);
  out.y = Math.abs(out.y) * 0.7 + 0.35;   // bias upward for palm fronds
  out.normalize();
}

// ---- Recipe factory --------------------------------------------------------
// Returns a fresh per-launch config (its own palette + any per-burst geometry).
// Fields:
//   count      base spark count (tier-scaled in _burst)
//   sample(out) unit-direction sampler
//   speed()    outward launch speed for a spark
//   life()     spark lifetime (s)
//   gravity    gravity multiplier (×GRAV)
//   drag       per-frame velocity damping base (^(dt*60))
//   size       spark size
//   upBias     extra +Y velocity added to every spark (counters droop)
//   fadePow    brightness curve exponent (higher = sharper late fade)
//   twinkle    0 none · 1 glitter flicker (late life) · 2 hard strobe
//   colorFor(i,n) -> [r,g,b]
//   colorShift when set, sparks lerp baseColor -> this over life
//   boom/crackle SFX flags
//   rocketHue  trail/rocket tint
export function makeRecipe(type) {
  type = type || pick(SHELL_TYPES);
  const main = HUE[pick(HUE_KEYS)];

  // Shared ring basis (only the ring uses it, but cheap to always build).
  const n = new THREE.Vector3(); sampleSphere(n);
  const u = new THREE.Vector3(0, 1, 0).cross(n);
  if (u.lengthSq() < 1e-4) u.set(1, 0, 0);
  u.normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();

  const base = {
    type, count: 110, gravity: 0.55, drag: 0.985, size: 0.85, upBias: 1.6,
    fadePow: 1.4, twinkle: 0, colorShift: null, boom: true, crackle: false,
    rocketHue: HUE.gold,
    sample: sampleSphere,
    speed: () => rand(15, 22),
    life: () => rand(1.1, 1.7),
    colorFor: () => main,
  };

  switch (type) {
    case 'peony':
      return base;

    case 'chrysanthemum':
      // Spherical, but slower + longer-lived + draggier so each spark leaves a
      // soft drooping streak.
      return Object.assign(base, {
        count: 124, drag: 0.965, gravity: 0.8, size: 0.8, upBias: 2.2,
        fadePow: 1.1, speed: () => rand(11, 17), life: () => rand(1.7, 2.4),
      });

    case 'willow': {
      // Long, slow, heavy golden droop — the graceful one. Gold/amber only.
      const w = pick([HUE.gold, HUE.orange, HUE.white]);
      return Object.assign(base, {
        count: 96, drag: 0.95, gravity: 1.5, size: 0.78, upBias: 3.0,
        fadePow: 0.8, boom: true, crackle: false,
        speed: () => rand(9, 14), life: () => rand(2.4, 3.4),
        colorFor: () => w,
      });
    }

    case 'palm': {
      // A few fat upward fronds that arc over — palm tree.
      const p = pick([HUE.gold, HUE.green, HUE.orange]);
      return Object.assign(base, {
        count: 60, sample: sampleUpHemisphere, drag: 0.955, gravity: 1.2,
        size: 1.05, upBias: 4.0, fadePow: 0.9,
        speed: () => rand(13, 20), life: () => rand(1.9, 2.7),
        colorFor: () => p,
      });
    }

    case 'ring': {
      // A flat halo: every spark on the tilted (u,v) plane.
      const r = pick([HUE.cyan, HUE.magenta, HUE.green, HUE.gold]);
      return Object.assign(base, {
        count: 88, gravity: 0.4, size: 0.85, upBias: 1.2, fadePow: 1.3,
        speed: () => rand(17, 20),
        life: () => rand(1.3, 1.8),
        colorFor: () => r,
        sample: (out) => {
          const a = Math.random() * Math.PI * 2;
          const jitter = (Math.random() - 0.5) * 0.12;
          out.copy(u).multiplyScalar(Math.cos(a))
            .addScaledVector(v, Math.sin(a))
            .addScaledVector(n, jitter)
            .normalize();
        },
      });
    }

    case 'crackle':
      // Bright burst that dissolves into a field of rapid glitter + a crackle.
      return Object.assign(base, {
        count: 132, gravity: 0.6, size: 0.7, upBias: 1.8, fadePow: 1.0,
        twinkle: 1, crackle: true,
        speed: () => rand(13, 19), life: () => rand(1.5, 2.2),
      });

    case 'strobe': {
      // White flashbulb sparks that blink hard on/off.
      return Object.assign(base, {
        count: 92, gravity: 0.5, size: 0.95, upBias: 1.6, fadePow: 0.6,
        twinkle: 2, crackle: true,
        speed: () => rand(12, 18), life: () => rand(1.6, 2.3),
        colorFor: () => HUE.white,
      });
    }

    case 'colorchange': {
      // Sparks born one colour, dying another (red→gold, blue→magenta…).
      const a = pick(HUE_KEYS);
      let b = pick(HUE_KEYS); if (b === a) b = HUE_KEYS[(HUE_KEYS.indexOf(a) + 3) % HUE_KEYS.length];
      return Object.assign(base, {
        count: 112, gravity: 0.6, size: 0.85, upBias: 1.8, fadePow: 1.1,
        speed: () => rand(14, 20), life: () => rand(1.6, 2.3),
        colorFor: () => HUE[a], colorShift: HUE[b], rocketHue: HUE[a],
      });
    }

    case 'bicolor': {
      // Sphere split into two colours by hemisphere — a two-tone peony.
      let a = pick(HUE_KEYS), b = pick(HUE_KEYS);
      if (b === a) b = HUE_KEYS[(HUE_KEYS.indexOf(a) + 4) % HUE_KEYS.length];
      const ca = HUE[a], cb = HUE[b];
      const dir = new THREE.Vector3(); sampleSphere(dir);   // split plane normal
      return Object.assign(base, {
        count: 122, gravity: 0.55, size: 0.85, upBias: 1.6, fadePow: 1.3,
        speed: () => rand(15, 21), life: () => rand(1.3, 1.9),
        sample: (out) => { sampleSphere(out); out.userSide = out.dot(dir) >= 0; },
        colorFor: (i, nC, lastDir) => (lastDir && lastDir.userSide ? ca : cb),
      });
    }

    default:
      return base;
  }
}

export class Fireworks {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Fireworks';

    const geo = new THREE.IcosahedronGeometry(0.5, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,           // keep sparks at full brightness for bloom
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, POOL);
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;   // bursts sit above/around the player
    this.mesh.count = POOL;
    this.group.add(this.mesh);

    // Allocate instanceColor + hide every instance at scale 0.
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    const c0 = new THREE.Color(0, 0, 0);
    for (let i = 0; i < POOL; i++) {
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, c0);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;

    this.particles = new Array(POOL).fill(null).map(() => ({
      alive: false, kind: 0,          // 0 spark · 1 rocket · 2 trail
      pos: new THREE.Vector3(), vel: new THREE.Vector3(),
      age: 0, life: 1, size: 1, gravity: 0.55, drag: 0.985,
      fadePow: 1.4, twinkle: 0,
      r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, shift: false,
      phase: 0,
      recipe: null, trailAcc: 0,      // rocket-only
    }));

    // Optional burst flash lights (gated off by default; bloom carries it).
    this._lights = [];
    this._lightT = [];
    if (PERF.contextLights) {
      for (let i = 0; i < 3; i++) {
        const L = new THREE.PointLight(0xffffff, 0, 90, 1.4);
        L.castShadow = false;
        this.group.add(L);
        this._lights.push(L);
        this._lightT.push(0);
      }
    }

    // Director state.
    this._nextGap = rand(GAP_MIN, GAP_MAX);
    this._finaleArmed = false;
    this._finaleFired = false;
    this._finaleQueue = 0;
    this._finaleTimer = 0;
    this._anyAlive = false;

    // Scratch.
    this._mat = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._col = new THREE.Color();
    this._dir = new THREE.Vector3();
    this._player = new THREE.Vector3();

    // Reaction hook — main.js sets this to throttle a crowd cheer per burst.
    this.onBurst = null;
  }

  // Manually fire a shell (sandbox + __dbg.firework). `playerPos` frames where
  // it appears; omit `type` for a random shell.
  launch(playerPos, type) {
    this._player.copy(playerPos || this._player);
    const ang = Math.random() * Math.PI * 2;
    const dist = rand(28, 95);
    const x = this._player.x + Math.cos(ang) * dist;
    const z = this._player.z + Math.sin(ang) * dist;
    const recipe = makeRecipe(type);

    const idx = this._dead();
    if (idx === -1) return;
    const p = this.particles[idx];
    p.alive = true; p.kind = 1; p.age = 0; p.trailAcc = 0; p.recipe = recipe;
    p.pos.set(x, 1.2, z);
    const climb = rand(32, 47);
    p.vel.set(rand(-3, 3), climb, rand(-3, 3));
    p.size = 1.3;
    const rh = recipe.rocketHue;
    p.r = rh[0]; p.g = rh[1]; p.b = rh[2];
    this._writeColor(idx, p.r, p.g, p.b);
    this._writeMatrix(idx, p.pos, p.size);

    Sound.playFireworkLaunch(x, z);
  }

  // dt, current nightness (0..1), the player position to centre shows on.
  update(dt, nightness, playerPos) {
    if (playerPos) this._player.copy(playerPos);

    // ---- Director (skip entirely by day) ----
    if (nightness >= NIGHT_ON) {
      // Finale: arm on entering deep night, fire once at the peak, reset by day.
      if (nightness >= FINALE_NIGHT && this._finaleArmed && !this._finaleFired) {
        this._finaleFired = true;
        this._finaleQueue = 14;     // a rapid barrage
        this._finaleTimer = 0;
      }
      this._finaleArmed = true;

      if (this._finaleQueue > 0) {
        this._finaleTimer -= dt;
        if (this._finaleTimer <= 0) {
          this.launch(this._player, pick(SHELL_TYPES));
          this._finaleQueue--;
          this._finaleTimer = rand(0.18, 0.5);
        }
      } else {
        this._nextGap -= dt;
        if (this._nextGap <= 0) {
          this.launch(this._player, pick(SHELL_TYPES));
          this._nextGap = rand(GAP_MIN, GAP_MAX);
        }
      }
    } else if (nightness < 0.5) {
      // Back to day — re-arm next night's finale.
      this._finaleArmed = false;
      this._finaleFired = false;
    }

    // ---- Particle sim (always runs so in-flight shells finish) ----
    let anyAlive = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      anyAlive = true;
      p.age += dt;

      if (p.kind === 1) { this._tickRocket(i, p, dt); continue; }

      if (p.age >= p.life) {
        p.alive = false;
        this._mat.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._mat);
        continue;
      }

      // Physics: gravity + drag.
      p.vel.y -= GRAV * p.gravity * dt;
      const damp = Math.pow(p.drag, dt * 60);
      p.vel.multiplyScalar(damp);
      p.pos.addScaledVector(p.vel, dt);

      // Brightness curve + twinkle.
      const lifeT = p.age / p.life;
      let bright = Math.pow(1 - lifeT, p.fadePow);
      if (p.twinkle === 1 && lifeT > 0.45) {
        // Glitter: rapid flicker that intensifies toward the end.
        bright *= 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.age * 38 + p.phase));
      } else if (p.twinkle === 2) {
        // Strobe: hard on/off.
        bright *= (Math.sin(p.age * 22 + p.phase) > 0 ? 1 : 0.05);
      }

      // Colour (optional shift over life), pre-multiplied by brightness.
      let cr = p.r, cg = p.g, cb = p.b;
      if (p.shift) {
        cr = p.r + (p.r2 - p.r) * lifeT;
        cg = p.g + (p.g2 - p.g) * lifeT;
        cb = p.b + (p.b2 - p.b) * lifeT;
      }
      this._writeColor(i, cr * bright, cg * bright, cb * bright);
      this._writeMatrix(i, p.pos, p.size * (0.55 + 0.45 * bright));
    }

    // ---- Flash lights decay ----
    for (let i = 0; i < this._lights.length; i++) {
      if (this._lightT[i] > 0) {
        this._lightT[i] -= dt;
        this._lights[i].intensity = Math.max(0, this._lightT[i] / 0.6) * 6;
      }
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.visible = anyAlive;
    this._anyAlive = anyAlive;
  }

  _tickRocket(i, p, dt) {
    p.vel.y += ROCKET_GRAV * dt;
    p.pos.addScaledVector(p.vel, dt);

    // Shed a sparky trail.
    p.trailAcc += TRAIL_PER_SEC * dt;
    while (p.trailAcc >= 1) {
      p.trailAcc -= 1;
      this._emitTrail(p);
    }

    // Flicker the rocket head a touch.
    const fl = 0.7 + 0.3 * Math.sin(p.age * 30);
    this._writeColor(i, p.r * fl, p.g * fl, p.b * fl);
    this._writeMatrix(i, p.pos, p.size);

    // Burst at apex.
    if (p.vel.y <= APEX_VY) {
      p.alive = false;
      this._mat.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this._mat);
      this._burst(p.pos, p.recipe);
    }
  }

  _burst(pos, recipe) {
    // Tier-scale the count by pool headroom so low-end doesn't starve.
    const scale = THREE.MathUtils.clamp(POOL / 750, 0.5, 1);
    const count = Math.max(20, (recipe.count * scale) | 0);

    for (let k = 0; k < count; k++) {
      const idx = this._dead();
      if (idx === -1) break;          // pool full — natural cap
      const p = this.particles[idx];
      recipe.sample(this._dir);
      const sp = recipe.speed();
      const c = recipe.colorFor(k, count, this._dir);

      p.alive = true; p.kind = 0; p.age = 0;
      p.pos.copy(pos);
      p.vel.copy(this._dir).multiplyScalar(sp);
      p.vel.y += recipe.upBias;
      p.life = recipe.life();
      p.size = recipe.size * rand(0.85, 1.15);
      p.gravity = recipe.gravity;
      p.drag = recipe.drag;
      p.fadePow = recipe.fadePow;
      p.twinkle = recipe.twinkle;
      p.phase = Math.random() * Math.PI * 2;
      p.r = c[0]; p.g = c[1]; p.b = c[2];
      p.shift = !!recipe.colorShift;
      if (p.shift) { p.r2 = recipe.colorShift[0]; p.g2 = recipe.colorShift[1]; p.b2 = recipe.colorShift[2]; }
      this._writeColor(idx, p.r, p.g, p.b);
      this._writeMatrix(idx, p.pos, p.size);
    }

    // Audio — boom (+ optional crackle), distance-delayed like real fireworks.
    const dist = Math.hypot(pos.x - this._player.x, pos.z - this._player.z);
    Sound.playFireworkBurst(pos.x, pos.z, {
      boom: recipe.boom, crackle: recipe.crackle,
      delay: Math.min(0.65, dist / 340),
    });

    // Optional flash light.
    if (this._lights.length) {
      let slot = this._lightT.findIndex((t) => t <= 0);
      if (slot === -1) slot = 0;
      const L = this._lights[slot];
      L.position.copy(pos);
      L.color.setRGB(recipe.rocketHue[0] * 0.4 + 0.6, recipe.rocketHue[1] * 0.4 + 0.6, recipe.rocketHue[2] * 0.4 + 0.6);
      this._lightT[slot] = 0.6;
    }

    if (this.onBurst) this.onBurst(pos.x, pos.z);
  }

  _emitTrail(rocket) {
    const idx = this._dead();
    if (idx === -1) return;
    const p = this.particles[idx];
    p.alive = true; p.kind = 0; p.age = 0;
    p.pos.copy(rocket.pos);
    p.pos.x += (Math.random() - 0.5) * 0.3;
    p.pos.z += (Math.random() - 0.5) * 0.3;
    p.vel.set((Math.random() - 0.5) * 1.2, -rand(0.5, 2.0), (Math.random() - 0.5) * 1.2);
    p.life = rand(0.3, 0.6);
    p.size = 0.5;
    p.gravity = 0.3; p.drag = 0.9; p.fadePow = 1.6; p.twinkle = 0; p.shift = false;
    const h = rocket.recipe ? rocket.recipe.rocketHue : HUE.gold;
    p.r = h[0]; p.g = h[1]; p.b = h[2];
    this._writeColor(idx, p.r, p.g, p.b);
    this._writeMatrix(idx, p.pos, p.size);
  }

  _dead() {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].alive) return i;
    }
    return -1;
  }

  _writeMatrix(i, pos, scale) {
    this._s.setScalar(scale);
    this._mat.compose(pos, this._q, this._s);
    this.mesh.setMatrixAt(i, this._mat);
  }

  _writeColor(i, r, g, b) {
    this._col.setRGB(r, g, b);
    this.mesh.setColorAt(i, this._col);
  }
}
