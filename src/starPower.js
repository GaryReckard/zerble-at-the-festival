// starPower.js — the rare floating star + the 15-second "star power" buff.
//
// A glowing star spawns on a long cooldown somewhere out near the player's
// exploration ring, marked by a thin pillar of light visible across the
// festival. Drive into it and Zerble enters star power: ghost mode (the
// collision resolver in main.js short-circuits while isActive()), the cart's
// polygons cycle through a silvery rainbow via a shared onBeforeCompile patch,
// a fast jaunty loop overrides the music bus, and every NPC within LOVE_RADIUS
// falls in love and spews smiles. Rainbow phantom drifting through the crowd.
//
// Design doc: .claude/star-power-design.md. This module mirrors trip.js's
// envelope/state-machine shape — an `_env` value ramps 0→1 on entry, holds,
// ramps 1→0 on exit, and every visual reads it.
//
// Spawn is intentionally worldgen-agnostic: it's a player-position director,
// not a per-chunk theme dice roll (which only ever existed in legacy v1).
// Validity is checked against the live registry + lakes, so it behaves the
// same under v2.

import * as THREE from 'three';
import { registry } from './registry.js';
import { isPointInLake, projectOutOfLake } from './lakes.js';
import { PERF } from './perf.js';

// ── Shared shader uniforms ──────────────────────────────────────────────
// zerble.js calls patchStarPowerMaterial() on every cart/driver/mustache
// material at construction. All patched programs reference these SAME uniform
// objects, so advancing them here recolours the whole cart in one write.
export const STAR_UNIFORMS = {
  env: { value: 0 },   // 0..1 buff envelope
  hue: { value: 0 },   // 0..1 cycling base hue
};

// GLSL HSV helpers + the rainbow override, injected after <color_fragment>
// (same hook the crowd tie-dye + wook patches use). Prepended function defs
// sit above main(); three.js's precision prefix is inserted before all of it.
const RAINBOW_GLSL_HEAD = /* glsl */`
  uniform float uStarEnv;
  uniform float uStarHue;
  varying vec3 vSpWorld;
  vec3 _sp_rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }
  vec3 _sp_hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
`;

const RAINBOW_GLSL_BODY = /* glsl */`#include <color_fragment>
  if (uStarEnv > 0.001) {
    vec3 hsv = _sp_rgb2hsv(diffuseColor.rgb);
    // Spatial rainbow: project world position onto a tilted axis so a band of
    // hues sweeps diagonally across the whole cart at once, and advance the
    // whole band over time with uStarHue. Reads as a moving rainbow at any
    // instant — not one flat flashing colour. Silvery = low-ish saturation,
    // pushed-up value.
    float sweep = dot(vSpWorld, vec3(0.14, 0.09, 0.14));
    hsv.x = fract(uStarHue + sweep + diffuseColor.r * 0.08);
    hsv.y = mix(hsv.y, 0.6, uStarEnv);
    hsv.z = mix(hsv.z, 1.0, uStarEnv * 0.55);
    vec3 rainbow = _sp_hsv2rgb(hsv);
    diffuseColor.rgb = mix(diffuseColor.rgb, rainbow, uStarEnv);
  }`;

// Patch a single material so star power can recolour it. Idempotent. Chains
// onto any existing onBeforeCompile (none on cart materials today, but safe).
export function patchStarPowerMaterial(mat) {
  if (!mat || mat.userData._starPatched) return;
  mat.userData._starPatched = true;
  const prevCompile = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => {
    if (typeof prevCompile === 'function') prevCompile(shader);
    shader.uniforms.uStarEnv = STAR_UNIFORMS.env;
    shader.uniforms.uStarHue = STAR_UNIFORMS.hue;
    shader.vertexShader = 'varying vec3 vSpWorld;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vSpWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;'
    );
    shader.fragmentShader = RAINBOW_GLSL_HEAD + shader.fragmentShader.replace(
      '#include <color_fragment>', RAINBOW_GLSL_BODY
    );
  };
  const prevKey = typeof mat.customProgramCacheKey === 'function'
    ? mat.customProgramCacheKey() : '';
  mat.customProgramCacheKey = () => prevKey + '|starpower-v1';
  mat.needsUpdate = true;
}

// Standalone star + pillar for the sandbox (no scene/registry coupling).
// Returns { group, update(dt, time) } — spins, bobs, pulses.
export function buildStarPreview() {
  const group = new THREE.Group();
  const baseY = 1.5;
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c0, emissive: 0xffd24a, emissiveIntensity: 2.5,
    roughness: 0.3, metalness: 0.4, flatShading: true,
  });
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), starMat);
  mesh.position.y = baseY;
  group.add(mesh);
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0xffd24a, transparent: true, opacity: 0.32,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.5, 11, 10, 1, true), pillarMat
  );
  pillar.position.y = 5.5;
  pillar.frustumCulled = false;
  group.add(pillar);
  return {
    group,
    update(dt, time) {
      mesh.rotation.y += dt * 1.5;
      mesh.position.y = baseY + Math.sin(time * 2) * 0.15;
      starMat.emissiveIntensity = 2.2 + Math.sin(time * 3) * 0.5;
      pillarMat.opacity = 0.24 + 0.14 * (0.5 + 0.5 * Math.sin(time * 1.3));
    },
  };
}

// ── Tuning ──────────────────────────────────────────────────────────────
const LOVE_RADIUS   = 25;     // NPCs within this fall in love during the buff
const DURATION      = 15;     // total buff seconds (arm + hold + fade)
const ARM           = 0.25;   // env 0→1
const FADE          = 0.4;    // env 1→0
const COOLDOWN      = 180;    // seconds after a pickup before another can roll
const FIRST_DELAY   = 25;     // grace before the very first star can appear
const SPAWN_NEAR    = 150;    // star spawns this..FAR from the player
const SPAWN_FAR     = 300;
const DESPAWN_DIST  = 360;    // drift this far and it expires + re-rolls
const PICKUP_PAD    = 0.8;    // added to cart radius for the catch test
const HUE_RATE      = 0.55;   // hue cycles / second

export const StarPower = {
  scene: null,

  // main.js sets these (mirrors Trip.onOffer/onAccept). Keeps this module from
  // importing Trip/Sound/bubbles/HUD directly.
  onTrigger: null,   // () => void — fired the instant a star is caught
  onEnd:     null,   // () => void — fired when the buff fully fades

  // Buff state
  state:   'idle',   // 'idle' | 'arming' | 'active' | 'fading'
  _env:    0,
  _phase:  0,        // seconds in the current buff phase
  _hue:    0,

  // Spawn director
  _star:        null,   // { group, mesh, pillar, x, z, baseY, light } or null
  _cooldown:    FIRST_DELAY,
  _rollTimer:   0,

  // Pooled visuals
  _ring:   null,   // shared flat ring geometry
  _waves:  [],     // expanding love-wave rings (active only)
  _waveTimer: 0,
  _trail:  [],     // rainbow comet pucks dropped behind the cart
  _trailIdx: 0,
  _trailTimer: 0,
  _shock:  null,   // pickup shockwave ring

  init({ scene }) {
    this.scene = scene;
    const lowTier = PERF.name === 'low';

    // Shared flat ring geometry for waves / trail / shockwave.
    this._ring = new THREE.RingGeometry(0.86, 1.0, 40);
    this._ring.rotateX(-Math.PI / 2);
    this._ring.userData.shared = true;

    const mkRing = () => {
      const m = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this._ring, m);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      return { mesh, mat: m, age: 0, dur: 1, alive: false };
    };

    // Love waves — visible proof of the LOVE_RADIUS field. One on low, three
    // staggered on mid/high.
    const waveN = lowTier ? 1 : 3;
    for (let i = 0; i < waveN; i++) this._waves.push(mkRing());

    // Comet trail — skipped entirely on low tier (draw-budget headroom).
    const trailN = lowTier ? 0 : 7;
    for (let i = 0; i < trailN; i++) this._trail.push(mkRing());

    this._shock = mkRing();
  },

  isActive() {
    return this.state === 'arming' || this.state === 'active' || this.state === 'fading';
  },
  hasStar() { return !!this._star; },

  // ── Star mesh + pillar ──────────────────────────────────────────────
  _buildStar(x, z) {
    const group = new THREE.Group();
    const baseY = 1.5;

    const starMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c0, emissive: 0xffd24a, emissiveIntensity: 2.5,
      roughness: 0.3, metalness: 0.4, flatShading: true,
    });
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), starMat);
    mesh.position.y = baseY;
    mesh.castShadow = false;
    group.add(mesh);

    // Beacon pillar — emissive, additive, thin. Visible from across the field;
    // the bloom pass handles its glow for free.
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xffd24a, transparent: true, opacity: 0.32,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 11, 10, 1, true), pillarMat
    );
    pillar.position.y = 5.5;
    pillar.frustumCulled = false;
    group.add(pillar);

    group.position.set(x, 0, z);
    this.scene.add(group);

    let light = null;
    if (PERF.contextLights) {
      light = new THREE.PointLight(0xffd86a, 1.4, 18, 2);
      light.position.set(0, baseY, 0);
      light.castShadow = false;
      group.add(light);
    }

    this._star = { group, mesh, pillar, pillarMat, x, z, baseY, light };
  },

  _despawnStar() {
    if (!this._star) return;
    const s = this._star;
    this.scene.remove(s.group);
    s.group.traverse((n) => {
      if (n.geometry && !n.geometry.userData.shared) n.geometry.dispose();
      if (n.material && !n.material.userData.shared) n.material.dispose();
    });
    this._star = null;
  },

  // Find a hidden-but-fair spot ahead of the player: open ground, no buildings
  // near, not in a lake. Returns {x,z} or null if no clean candidate found.
  _findSpawn(px, pz, heading) {
    for (let tries = 0; tries < 10; tries++) {
      // Bias toward where the player is heading so the pillar tends to appear
      // in view, with a wide spread so it still feels like a find.
      const ang = heading + (Math.random() - 0.5) * Math.PI * 1.3;
      const r = SPAWN_NEAR + Math.random() * (SPAWN_FAR - SPAWN_NEAR);
      const x = px + Math.sin(ang) * r;
      const z = pz + Math.cos(ang) * r;
      if (isPointInLake(x, z)) continue;
      // Reject spots crowded by footprints (stages/trucks/tents/etc.) — a star
      // tucked inside a vendor row is no fun to reach. 'tree' excluded so a
      // grove is fine.
      if (registry.closestBuilding({ x, z }, 14)) continue;
      return { x, z };
    }
    return null;
  },

  // Kick off the buff (called on pickup).
  trigger() {
    this.state = 'arming';
    this._phase = 0;
    this._env = 0;
    if (typeof this.onTrigger === 'function') this.onTrigger();
  },

  // ── Per-frame ───────────────────────────────────────────────────────
  update(dt, zerble, nightness, time) {
    this._hue = (this._hue + dt * HUE_RATE) % 1;
    STAR_UNIFORMS.hue.value = this._hue;

    // --- Spawn director (only while no buff is running) ---
    if (!this.isActive()) {
      if (this._star) {
        // Animate the resting star.
        const s = this._star;
        s.mesh.rotation.y += dt * 1.5;
        s.mesh.position.y = s.baseY + Math.sin(time * 2) * 0.15;
        s.mesh.material.emissiveIntensity = 2.2 + Math.sin(time * 3) * 0.5;
        s.pillarMat.opacity = 0.22 + (0.12 + nightness * 0.16) * (0.5 + 0.5 * Math.sin(time * 1.3));
        // Expire if the player wandered far away — re-roll later.
        const dx = zerble.position.x - s.x, dz = zerble.position.z - s.z;
        if (dx * dx + dz * dz > DESPAWN_DIST * DESPAWN_DIST) {
          this._despawnStar();
          this._cooldown = 8;   // brief re-roll gap, not the full pickup cooldown
        } else {
          // Pickup test.
          const pr = zerble.radius + PICKUP_PAD;
          if (dx * dx + dz * dz <= pr * pr) {
            this._fireShockwave(s.x, s.z);
            this._despawnStar();
            this._cooldown = COOLDOWN;
            this.trigger();
          }
        }
      } else {
        // No star present — count down, then roll periodically.
        this._cooldown -= dt;
        if (this._cooldown <= 0) {
          this._rollTimer -= dt;
          if (this._rollTimer <= 0) {
            this._rollTimer = 2.0;
            const spot = this._findSpawn(zerble.position.x, zerble.position.z, zerble.heading);
            if (spot) this._buildStar(spot.x, spot.z);
          }
        }
      }
    }

    // --- Buff state machine (mirrors trip.js envelope shape) ---
    switch (this.state) {
      case 'arming':
        this._phase += dt;
        this._env = Math.min(1, this._phase / ARM);
        if (this._phase >= ARM) { this.state = 'active'; this._phase = 0; this._env = 1; }
        break;
      case 'active':
        this._env = 1;
        this._phase += dt;
        if (this._phase >= DURATION - ARM - FADE) { this.state = 'fading'; this._phase = 0; }
        break;
      case 'fading':
        this._phase += dt;
        this._env = Math.max(0, 1 - this._phase / FADE);
        if (this._phase >= FADE) {
          this._env = 0;
          this.state = 'idle';
          this._endBuff(zerble);
        }
        break;
    }
    STAR_UNIFORMS.env.value = this._env;

    // --- Buff visuals ---
    this._updateWaves(dt, zerble);
    this._updateTrail(dt, zerble);
    this._updateShock(dt);
  },

  _endBuff(zerble) {
    // Lake escape — if the rainbow faded while phased into water, pop Zerble to
    // the nearest shore so the re-enabled collider ring doesn't shove him.
    if (isPointInLake(zerble.position.x, zerble.position.z)) {
      const shore = projectOutOfLake(zerble.position.x, zerble.position.z, 4);
      if (shore) {
        zerble.position.x = shore.x;
        zerble.position.z = shore.z;
      }
    }
    if (typeof this.onEnd === 'function') this.onEnd();
  },

  // Continuous love-wave rings expanding to exactly LOVE_RADIUS — visible cause
  // for the smile torrent the love-magnet pass produces.
  _updateWaves(dt, zerble) {
    const active = this.state === 'arming' || this.state === 'active';
    if (active) {
      this._waveTimer -= dt;
      if (this._waveTimer <= 0) {
        this._waveTimer = 1.2 / this._waves.length;
        const w = this._waves.find(w => !w.alive);
        if (w) { w.alive = true; w.age = 0; w.dur = 1.4; }
      }
    }
    for (const w of this._waves) {
      if (!w.alive) { w.mesh.visible = false; continue; }
      w.age += dt;
      const t = w.age / w.dur;
      if (t >= 1) { w.alive = false; w.mesh.visible = false; continue; }
      const r = LOVE_RADIUS * t;
      w.mesh.visible = true;
      w.mesh.position.set(zerble.position.x, 0.12, zerble.position.z);
      w.mesh.scale.set(r, 1, r);
      w.mat.color.setHSL((this._hue + t * 0.4) % 1, 0.9, 0.6);
      w.mat.opacity = (1 - t) * 0.5 * this._env;
    }
  },

  // Rainbow pucks dropped behind the cart, fading out.
  _updateTrail(dt, zerble) {
    if (this.isActive() && this._trail.length) {
      this._trailTimer -= dt;
      if (this._trailTimer <= 0) {
        this._trailTimer = 0.09;
        const p = this._trail[this._trailIdx % this._trail.length];
        this._trailIdx++;
        p.alive = true; p.age = 0; p.dur = 0.6;
        p.x = zerble.position.x; p.z = zerble.position.z;
        p.hue = this._hue;
      }
    }
    for (const p of this._trail) {
      if (!p.alive) { p.mesh.visible = false; continue; }
      p.age += dt;
      const t = p.age / p.dur;
      if (t >= 1) { p.alive = false; p.mesh.visible = false; continue; }
      const r = 1.6 + t * 2.4;
      p.mesh.visible = true;
      p.mesh.position.set(p.x, 0.14, p.z);
      p.mesh.scale.set(r, 1, r);
      p.mat.color.setHSL((p.hue + t * 0.2) % 1, 0.95, 0.6);
      p.mat.opacity = (1 - t) * 0.45;
    }
  },

  _fireShockwave(x, z) {
    const s = this._shock;
    s.alive = true; s.age = 0; s.dur = 0.75; s.x = x; s.z = z;
  },
  _updateShock(dt) {
    const s = this._shock;
    if (!s.alive) { s.mesh.visible = false; return; }
    s.age += dt;
    const t = s.age / s.dur;
    if (t >= 1) { s.alive = false; s.mesh.visible = false; return; }
    const r = 2 + t * 28;
    s.mesh.visible = true;
    s.mesh.position.set(s.x, 0.16, s.z);
    s.mesh.scale.set(r, 1, r);
    s.mat.color.setHSL((this._hue + t) % 1, 1.0, 0.65);
    s.mat.opacity = (1 - t) * 0.7;
  },
};
