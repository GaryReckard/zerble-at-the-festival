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
  const mesh = new THREE.Mesh(starGeometry(), starMat);
  mesh.position.y = baseY;
  group.add(mesh);
  const pillarMat = new THREE.MeshBasicMaterial({
    map: beamTexture(), color: 0xffffff, transparent: true, opacity: 0.4,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.42, 11, 10, 1, true), pillarMat
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
      pillarMat.opacity = 0.18 + 0.1 * (0.5 + 0.5 * Math.sin(time * 1.3));
    },
  };
}

// ── Tuning ──────────────────────────────────────────────────────────────
const LOVE_RADIUS   = 25;     // NPCs within this fall in love during the buff
const DURATION      = 15;     // total buff seconds (arm + hold + fade)
const ARM           = 0.25;   // env 0→1
const FADE          = 0.4;    // env 1→0
const WARN          = 3.0;    // last N seconds of the buff: strobe a warning
const COOLDOWN      = 100;    // seconds after a pickup before another can roll
const FIRST_DELAY   = 15;     // grace before the very first star can appear
const SPAWN_NEAR    = 150;    // star spawns this..FAR from the player
const SPAWN_FAR     = 300;
const DESPAWN_DIST  = 360;    // drift this far and it expires + re-rolls
const PICKUP_PAD    = 0.8;    // added to cart radius for the catch test
const HUE_RATE      = 0.55;   // hue cycles / second

const THREE_TMP_COLOR = new THREE.Color();   // scratch, reused per-frame

// Cart-local points sparkles stream off: roof corners, body sides, hood, eyes.
const SPARK_ANCHORS = [
  [0.72, 2.08, 0.72], [-0.72, 2.08, 0.72], [0.72, 2.08, -0.72], [-0.72, 2.08, -0.72],
  [0.62, 1.25, 0.2], [-0.62, 1.25, 0.2], [0, 1.35, 0.6], [0, 1.05, -1.45], [0, 1.8, -1.2],
];

// Shared, lazily-built star geometry + beam texture (one per process, reused by
// every spawned star and the sandbox preview; tagged userData.shared).
let _STAR_GEO = null;
let _BEAM_TEX = null;

// A real 5-pointed star — a flat star Shape extruded with a soft bevel, so it
// reads unmistakably as a star (not a sphere) and flattens to a thin line as it
// spins around Y (the classic invincibility-star tumble).
function starGeometry() {
  if (_STAR_GEO) return _STAR_GEO;
  const shape = new THREE.Shape();
  const spikes = 5, outer = 0.55, inner = 0.23;
  for (let i = 0; i < spikes * 2; i++) {
    const r = (i % 2 === 0) ? outer : inner;
    const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1, steps: 1,
  });
  geo.center();
  geo.userData.shared = true;
  _STAR_GEO = geo;
  return geo;
}

// Vertical gradient for the beacon: gold at the base fading to black at the top.
// Additive blending makes black invisible, so the beam reads as a soft column
// that dissolves upward instead of a hard opaque cylinder.
function beamTexture() {
  if (_BEAM_TEX) return _BEAM_TEX;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = 1; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgb(0,0,0)');         // canvas top → cylinder top: invisible
  g.addColorStop(0.7, 'rgb(90,70,24)');
  g.addColorStop(1, 'rgb(190,150,60)');    // base: dim gold
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1, h);
  const tex = new THREE.CanvasTexture(c);
  tex.userData.shared = true;
  _BEAM_TEX = tex;
  return tex;
}

// Soft round sparkle sprite — a radial-gradient dot baked once at module load.
function makeSparkTexture() {
  const s = 32;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.userData.shared = true;
  return tex;
}

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
  _blinkAccum: 0,    // strobe phase during the ending warning
  _fadeFrom:   1,    // env captured when fade begins (blink can start it low)

  // Spawn director
  _star:        null,   // { group, mesh, pillar, x, z, baseY, light } or null
  _cooldown:    FIRST_DELAY,
  _rollTimer:   0,

  // Pooled visuals
  _ring:   null,   // shared flat ring geometry
  _waves:  [],     // expanding love-wave rings (active only)
  _waveTimer: 0,
  _shock:  null,   // pickup shockwave ring
  // Rainbow tire tracks — dashes dropped at the rear wheels, faded via colour
  // (additive: black = invisible) on ONE InstancedMesh = one draw call.
  _tracks: null,   // { mesh, pool:[{alive,age,dur,x,z,yaw,hue}], idx }
  _trackTimer: 0,
  // Sparkles streaming off the body/roof — ONE THREE.Points draw call.
  _sparks: null,   // { points, geo, pos, col, life, max, vx, vy, vz, n }
  _sparkAccum: 0,
  _tmpV: null,     // scratch Vector3 for local→world anchors

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

    this._shock = mkRing();
    this._tmpV = new THREE.Vector3();

    // ── Rainbow tire tracks (one InstancedMesh) ──
    const trackN = 28;
    const trackGeo = new THREE.PlaneGeometry(0.42, 1.25);
    trackGeo.rotateX(-Math.PI / 2);   // lie flat; length runs along local +Z
    trackGeo.userData.shared = true;
    const trackMat = new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const trackMesh = new THREE.InstancedMesh(trackGeo, trackMat, trackN);
    trackMesh.frustumCulled = false;
    trackMesh.visible = false;
    const black = new THREE.Color(0, 0, 0);
    const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < trackN; i++) { trackMesh.setColorAt(i, black); trackMesh.setMatrixAt(i, zeroM); }
    this.scene.add(trackMesh);
    this._tracks = {
      mesh: trackMesh,
      pool: Array.from({ length: trackN }, () => ({ alive: false, age: 0, dur: 1, x: 0, z: 0, yaw: 0, hue: 0 })),
      idx: 0, dummy: new THREE.Object3D(), col: new THREE.Color(),
    };

    // ── Sparkles (one THREE.Points) ──
    const sparkN = lowTier ? 70 : 150;
    const sgeo = new THREE.BufferGeometry();
    const pos = new Float32Array(sparkN * 3);
    const col = new Float32Array(sparkN * 3);
    for (let i = 0; i < sparkN; i++) pos[i * 3 + 1] = -1000;   // park off-screen
    sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const smat = new THREE.PointsMaterial({
      size: 0.26, map: makeSparkTexture(), vertexColors: true,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(sgeo, smat);
    points.frustumCulled = false;
    points.visible = false;
    this.scene.add(points);
    this._sparks = {
      points, geo: sgeo, pos, col, n: sparkN,
      life: new Float32Array(sparkN), max: new Float32Array(sparkN),
      vx: new Float32Array(sparkN), vy: new Float32Array(sparkN), vz: new Float32Array(sparkN),
    };
  },

  isActive() {
    return this.state === 'arming' || this.state === 'active' || this.state === 'fading';
  },
  hasStar() { return !!this._star; },

  // Force all buff FX hidden — used when the sandbox switches away from the
  // demo entity (the per-frame updaters stop being called, so without this the
  // last frame's sparkles/tracks would freeze visible).
  _hideFx() {
    if (this._sparks) this._sparks.points.visible = false;
    if (this._tracks) this._tracks.mesh.visible = false;
    for (const w of this._waves) { w.alive = false; w.mesh.visible = false; }
    if (this._shock) { this._shock.alive = false; this._shock.mesh.visible = false; }
    this.state = 'idle'; this._env = 0; STAR_UNIFORMS.env.value = 0;
  },

  // ── Star mesh + pillar ──────────────────────────────────────────────
  _buildStar(x, z) {
    // Only one star is ever tracked (`this._star` is a single slot, and the
    // pickup test reads only it). Despawn any existing star first so a repeat
    // build — e.g. spamming `__dbg.starPower('spawn')` — can't strand orphaned,
    // pickup-less star meshes in the scene.
    if (this._star) this._despawnStar();
    const group = new THREE.Group();
    const baseY = 1.5;

    const starMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c0, emissive: 0xffd24a, emissiveIntensity: 2.5,
      roughness: 0.3, metalness: 0.4, flatShading: true,
    });
    const mesh = new THREE.Mesh(starGeometry(), starMat);
    mesh.position.y = baseY;
    mesh.castShadow = false;
    group.add(mesh);

    // Beacon pillar — a soft gold column that dissolves toward the top via the
    // gradient texture (gold base → black tip; additive makes black invisible).
    // Subtle: low opacity, the bloom pass does the visible-from-afar work.
    const pillarMat = new THREE.MeshBasicMaterial({
      map: beamTexture(), color: 0xffffff, transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.42, 11, 10, 1, true), pillarMat
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
        s.pillarMat.opacity = 0.16 + (0.06 + nightness * 0.13) * (0.5 + 0.5 * Math.sin(time * 1.3));
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
      case 'active': {
        this._phase += dt;
        const activeLen = DURATION - ARM - FADE;
        const left = activeLen - this._phase;
        if (left < WARN) {
          // Telegraph the ending: strobe the cart back toward its normal colours
          // at an accelerating rate so the player can brace for collisions
          // returning. Ghost mode itself stays on until the buff fully ends.
          const k = 1 - Math.max(0, left) / WARN;          // 0→1 approaching the end
          this._blinkAccum += dt * (3 + k * 10) * Math.PI * 2;
          this._env = 0.12 + 0.88 * (0.5 + 0.5 * Math.cos(this._blinkAccum));
        } else {
          this._env = 1;
        }
        if (this._phase >= activeLen) { this.state = 'fading'; this._phase = 0; this._fadeFrom = this._env; }
        break;
      }
      case 'fading':
        this._phase += dt;
        this._env = Math.max(0, this._fadeFrom * (1 - this._phase / FADE));
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
    this._updateTracks(dt, zerble);
    this._updateSparkles(dt, zerble);
    this._updateShock(dt);
  },

  // Cart-local (lx,ly,lz) → world, matching zerble.worldSeatPosition's basis
  // (local -Z is forward). Writes into this._tmpV and returns it.
  _l2w(zerble, lx, ly, lz) {
    const c = Math.cos(zerble.heading), s = Math.sin(zerble.heading);
    return this._tmpV.set(
      zerble.position.x + lx * c + lz * s,
      ly + zerble.position.y,
      zerble.position.z - lx * s + lz * c,
    );
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

  // Rainbow tire tracks — dashes dropped at both rear wheels while rolling,
  // fading via colour on one InstancedMesh. Dead instances scale to 0.
  _updateTracks(dt, zerble) {
    const tr = this._tracks;
    const T = tr.pool;
    // Emit a pair (left + right rear contact) on a short distance/time cadence
    // while the buff is on and the cart is actually moving.
    if (this.isActive() && Math.abs(zerble.speed) > 1.2) {
      this._trackTimer -= dt;
      if (this._trackTimer <= 0) {
        this._trackTimer = 0.06;
        for (const lx of [-0.92, 0.92]) {
          const w = this._l2w(zerble, lx, 0, 1.3);   // rear wheel ground contact
          const p = T[tr.idx % T.length]; tr.idx++;
          p.alive = true; p.age = 0; p.dur = 1.5;
          p.x = w.x; p.z = w.z; p.yaw = zerble.heading; p.hue = this._hue;
        }
      }
    }
    let any = false;
    for (let i = 0; i < T.length; i++) {
      const p = T[i];
      if (!p.alive) { tr.dummy.scale.set(0, 0, 0); tr.dummy.updateMatrix(); tr.mesh.setMatrixAt(i, tr.dummy.matrix); continue; }
      p.age += dt;
      const t = p.age / p.dur;
      if (t >= 1) { p.alive = false; tr.dummy.scale.set(0, 0, 0); tr.dummy.updateMatrix(); tr.mesh.setMatrixAt(i, tr.dummy.matrix); continue; }
      any = true;
      tr.dummy.position.set(p.x, 0.06, p.z);
      tr.dummy.rotation.set(0, p.yaw, 0);
      tr.dummy.scale.set(1, 1, 1);
      tr.dummy.updateMatrix();
      tr.mesh.setMatrixAt(i, tr.dummy.matrix);
      // Additive: fade by darkening toward black.
      const f = (1 - t) * 0.6;
      tr.col.setHSL((p.hue + t * 0.15) % 1, 0.95, 0.6).multiplyScalar(f);
      tr.mesh.setColorAt(i, tr.col);
    }
    tr.mesh.instanceMatrix.needsUpdate = true;
    if (tr.mesh.instanceColor) tr.mesh.instanceColor.needsUpdate = true;
    tr.mesh.visible = any;
  },

  // Sparkles streaming off the cart's body/roof anchors — one Points draw.
  _updateSparkles(dt, zerble) {
    const sp = this._sparks;
    const { pos, col, life, max, vx, vy, vz, n } = sp;
    // Emit while the envelope is up (rate scales with env so it ramps in/out).
    if (this._env > 0.01) {
      this._sparkAccum += this._env * (sp.n * 0.32) * dt;   // ~48/s at full on (150 pool)
      while (this._sparkAccum >= 1) {
        this._sparkAccum -= 1;
        // find a dead slot
        let slot = -1;
        for (let k = 0; k < n; k++) { if (life[k] >= max[k]) { slot = k; break; } }
        if (slot < 0) break;
        const a = SPARK_ANCHORS[(Math.random() * SPARK_ANCHORS.length) | 0];
        const w = this._l2w(zerble, a[0], a[1], a[2]);
        pos[slot * 3]     = w.x + (Math.random() - 0.5) * 0.25;
        pos[slot * 3 + 1] = w.y + (Math.random() - 0.5) * 0.2;
        pos[slot * 3 + 2] = w.z + (Math.random() - 0.5) * 0.25;
        vx[slot] = (Math.random() - 0.5) * 0.9;
        vy[slot] = 0.5 + Math.random() * 1.0;            // drift up
        vz[slot] = (Math.random() - 0.5) * 0.9;
        life[slot] = 0; max[slot] = 0.55 + Math.random() * 0.55;
        // colour is written each frame in the integrate loop below.
      }
    }
    let any = false;
    for (let k = 0; k < n; k++) {
      if (life[k] >= max[k]) {
        if (col[k * 3] !== 0 || col[k * 3 + 1] !== 0 || col[k * 3 + 2] !== 0) {
          col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = 0;   // snuff (additive)
        }
        continue;
      }
      any = true;
      life[k] += dt;
      const t = life[k] / max[k];
      vy[k] -= dt * 0.6;   // gentle gravity
      pos[k * 3]     += vx[k] * dt;
      pos[k * 3 + 1] += vy[k] * dt;
      pos[k * 3 + 2] += vz[k] * dt;
      const f = 1 - t;     // quadratic fade to black (additive blend)
      const hue = (this._hue + k * 0.013) % 1;
      const c = THREE_TMP_COLOR.setHSL(hue, 0.85, 0.7).multiplyScalar(f * f);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    sp.geo.attributes.position.needsUpdate = true;
    sp.geo.attributes.color.needsUpdate = true;
    sp.points.visible = any;
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
