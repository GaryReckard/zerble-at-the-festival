// Global world setup: sky, lights, ground, mountains, fog. Owns the chunk manager
// that lazily generates festival content as Zerble explores.

import * as THREE from 'three';
import { buildMountains } from './mountains.js';
import { ChunkManager, updateVendorTents } from './chunks.js';
import { LakeManager } from './lakes.js';
import { FarField } from './farField.js';
import { hash2 } from './rng.js';
import { terrainHeight, terrainEnabled } from './worldgen/terrain.js';
import { TimeOfDay } from './timeOfDay.js';
import { PERF, USE_FAR_FIELD } from './perf.js';
import { A11y } from './a11y.js';

const SKY_TOP = 0x6fb6e8;
const SKY_BOTTOM = 0xffd0a8;
const SUN_COLOR = 0xffe1b0;
const HEMI_SKY = 0xa9d6ff;
const HEMI_GROUND = 0xc89265;
const FOG_COLOR = 0xffcfae;
const GROUND_GREEN = 0x7cb37a;
const DIRT = 0xc69566;
const GROUND_DARK = new THREE.Color(0x669b69);
const GROUND_LIGHT = new THREE.Color(0x91bd7a);
const GROUND_BASE = new THREE.Color(GROUND_GREEN);
const GROUND_DRY = new THREE.Color(DIRT);
const groundColor = new THREE.Color();

const GROUND_SIZE = 1400; // very large flat-ish plane
const GROUND_SEG = 140;
const GROUND_SNAP = 40; // multiple of the 10m vertex spacing, so recoloring does not pop
const GRASS_TILE_METERS = 128;
const GRASS_TEX_SIZE = 512;

let chunkManager = null;
let lakeManager = null;
let farField = null;
let groundMesh = null;
let mountainsGroup = null;
let skyMesh = null;
let starsMesh = null;
let moonMesh = null;
let sun = null;
let hemi = null;
let ambient = null;
let _scene = null;
let timeOfDay = null;

export function getTimeOfDay() {
  return timeOfDay;
}

export function getFarField() {
  return farField;
}

// `playerPos` seeds the first lake + chunk preload neighbourhood. main.js
// relocates Zerble to the v2 spawn hub (which can be km from origin) BEFORE
// calling this, so the initial pass must load around the SPAWN, not (0,0) —
// otherwise the title-card backdrop + __dbg.start() briefly look at an unloaded
// neighbourhood until the first post-Start updateWorld() streams it in. Defaults
// to origin for any headless/legacy caller.
export function buildWorld(scene, crowd, playerPos = new THREE.Vector3(0, 0, 0)) {
  _scene = scene;
  skyMesh = buildSky(scene);
  starsMesh = buildStars(scene);
  moonMesh = buildMoon(scene);
  const lights = buildLightsAndFog(scene);
  sun = lights.sun;
  hemi = lights.hemi;
  ambient = lights.ambient;
  const groundX = Math.round(playerPos.x / GROUND_SNAP) * GROUND_SNAP;
  const groundZ = Math.round(playerPos.z / GROUND_SNAP) * GROUND_SNAP;
  groundMesh = buildGround(scene, groundX, groundZ);
  _groundLastResampleX = groundX;
  _groundLastResampleZ = groundZ;
  mountainsGroup = buildMountains(scene);

  timeOfDay = new TimeOfDay(scene);
  timeOfDay.attach({ sky: skyMesh, sun, hemi, ambient });

  // Lakes must materialize BEFORE the initial chunk pass — they register
  // footprints + colliders that chunks consult to avoid placing paths and
  // props on top of water.
  lakeManager = new LakeManager();
  lakeManager.update(scene, playerPos);

  chunkManager = new ChunkManager(scene, crowd);
  // Pre-load the chunks around the player's spawn so the first frame (and the
  // title-card backdrop) looks alive at the actual spawn hub, not origin.
  chunkManager.update(playerPos);

  // The far-field horizon is a PEER of the chunk/lake managers (festival-
  // horizon design D1), built last so it can hold the narrow isLoaded
  // completion predicate. Construction allocates its fixed pools when the
  // horizon is on; ALL planning defers to the first enabled updateWorld —
  // nothing here touches the title/start or synchronous iOS-audio chain, and
  // the disabled path constructs an inert two-boolean shell.
  farField = new FarField({
    enabled: USE_FAR_FIELD,
    tier: PERF.farField,
    scene,
    isLoaded: (cx, cz) => chunkManager.isLoaded(cx, cz),
  });

  return { chunkManager, lakeManager, farField };
}

// Snap the moving ground to world coordinates so its colors and texture stay
// fixed beneath roads and props while it follows the player.
let _groundLastResampleX = NaN;
let _groundLastResampleZ = NaN;

export function updateWorld(playerPos, dt = 0.016) {
  // One world-owned streaming deadline (festival-horizon design D3): lakes +
  // full chunks consume it first; the far-field horizon plans only in the
  // remainder. There is no second budget.
  const streamStartedAt = performance.now();
  // Lakes update first (same reason as boot: chunks consult lake footprints).
  if (lakeManager) lakeManager.update(_scene, playerPos, dt);
  if (chunkManager) chunkManager.update(playerPos, streamStartedAt + PERF.chunkBudgetMs);
  // The horizon's remainder is measured HERE — lakes + full chunks are the
  // streaming spend that consumes the wall first; time-of-day is not
  // streaming work and doesn't count against it.
  const streamRemainderMs = Math.max(0, PERF.chunkBudgetMs - (performance.now() - streamStartedAt));
  if (timeOfDay) {
    timeOfDay.update(dt);
    updateVendorTents(timeOfDay.t, timeOfDay.nightness);
  }
  if (farField && farField.enabled) {
    farField.update(playerPos.x, playerPos.z, {
      dt,
      nightness: timeOfDay ? timeOfDay.nightness : 0,
      // Read LIVE each frame (design D4/D8): A11y.init() resolves the
      // persisted/OS preference only after buildWorld has already run.
      reducedMotion: A11y.reducedMotion,
      budgetMs: streamRemainderMs,
    });
  }
  // Keep the sky dome, ground plane and mountain ring centered on the player
  // so the world feels infinite — chunks at fixed world coords slide past,
  // but the backdrops always look the same distance away.
  if (skyMesh) skyMesh.position.set(playerPos.x, 0, playerPos.z);
  if (starsMesh) {
    starsMesh.position.set(playerPos.x, 0, playerPos.z);
    // Drive the star shader's nightness uniform so they fade in at dusk and
    // disappear at dawn. Also push current time for the twinkle wobble.
    const n = timeOfDay ? timeOfDay.nightness : 0;
    starsMesh.material.uniforms.nightness.value = n;
    starsMesh.material.uniforms.time.value += dt;
    starsMesh.visible = n > 0.05;   // hard-skip the draw at full daylight
  }
  if (moonMesh && timeOfDay) {
    // Moon arcs through the sky during the night phase (t in 0.55..0.95),
    // east → overhead → west, parallel to how the sun behaves during the day.
    // Hidden during the day so it doesn't compete with the sun.
    const t = timeOfDay.t;
    const nightPhase = t > 0.55 && t < 0.95;
    if (nightPhase) {
      const moonArc = (t - 0.55) * Math.PI / 0.40;
      const moonDist = 850;
      // Same east → west sweep as the sun, parametric on moonArc instead of arcAng
      const mx = Math.cos(moonArc) * moonDist * 0.55;     // 55% of sky radius
      const my = Math.max(40, Math.sin(moonArc) * moonDist * 0.55);
      const mz = -moonDist * 0.45;                         // opposite of sun's z=60 → opposite half of sky
      moonMesh.position.set(playerPos.x + mx, my, playerPos.z + mz);
      moonMesh.visible = true;
    } else {
      moonMesh.visible = false;
    }
  }
  if (groundMesh) {
    const groundX = Math.round(playerPos.x / GROUND_SNAP) * GROUND_SNAP;
    const groundZ = Math.round(playerPos.z / GROUND_SNAP) * GROUND_SNAP;
    if (
      groundX !== _groundLastResampleX ||
      groundZ !== _groundLastResampleZ
    ) {
      groundMesh.position.set(groundX, 0, groundZ);
      resampleGroundSurface(groundMesh, groundX, groundZ);
      _groundLastResampleX = groundX;
      _groundLastResampleZ = groundZ;
    }
  }
  if (mountainsGroup) mountainsGroup.position.set(playerPos.x, 0, playerPos.z);
  // Keep the sun's shadow frustum centered on the player too, so shadows
  // continue to render no matter how far Zerble drives. The TimeOfDay system
  // owns the *offset* (sun arc + below-horizon at night); we only translate
  // that offset to the player's position so the shadow camera stays on top
  // of where the action is.
  if (sun) {
    // TimeOfDay sets sun.position to the WORLD offset relative to origin —
    // add the player position so the sun stays at that bearing relative to
    // them rather than at world (0,0).
    sun.position.x += playerPos.x;
    sun.position.z += playerPos.z;
    sun.target.position.set(playerPos.x, 0, playerPos.z);
    sun.target.updateMatrixWorld();
  }
}

function resampleGroundSurface(mesh, originX, originZ) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const colors = geo.attributes.color.array;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    pos.setY(i, terrainHeight(originX + lx, originZ + lz));
    writeGroundColor(colors, i * 3, originX + lx, originZ + lz);
  }
  pos.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  mesh.material.map.offset.set(
    (originX - GROUND_SIZE / 2) / GRASS_TILE_METERS,
    -(originZ + GROUND_SIZE / 2) / GRASS_TILE_METERS,
  );
  // Changed relief needs matching lighting and bounds after every recenter.
  if (terrainEnabled()) { geo.computeVertexNormals(); geo.computeBoundingSphere(); }
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function worldNoise(x, z, scale, salt) {
  const sx = x / scale;
  const sz = z / scale;
  const ix = Math.floor(sx);
  const iz = Math.floor(sz);
  const gx = ix + salt;
  const gz = iz - salt;
  const u = smoothstep(sx - ix);
  const v = smoothstep(sz - iz);
  const a = hash2(gx, gz) / 4294967295 * (1 - u)
    + hash2(gx + 1, gz) / 4294967295 * u;
  const b = hash2(gx, gz + 1) / 4294967295 * (1 - u)
    + hash2(gx + 1, gz + 1) / 4294967295 * u;
  return a * (1 - v) + b * v;
}

function writeGroundColor(colors, index, x, z) {
  const lush = worldNoise(x, z, 96, 311);
  const worn = worldNoise(x, z, 35, 947);
  groundColor.copy(GROUND_BASE);
  if (lush < 0.5) groundColor.lerp(GROUND_DARK, (0.5 - lush) * 0.85);
  else groundColor.lerp(GROUND_LIGHT, (lush - 0.5) * 0.85);
  const dry = Math.max(0, (worn - 0.58) / 0.42);
  groundColor.lerp(GROUND_DRY, dry * dry * 0.28);
  colors[index] = groundColor.r;
  colors[index + 1] = groundColor.g;
  colors[index + 2] = groundColor.b;
}

function makeGrassTexture() {
  const size = GRASS_TEX_SIZE;
  const data = new Uint8Array(size * size * 4);
  const grids = [8, 32, 128].map((cells, layer) => {
    const grid = new Float32Array(cells * cells);
    for (let z = 0; z < cells; z++) {
      for (let x = 0; x < cells; x++) {
        grid[z * cells + x] = hash2(x + layer * 137, z - layer * 271) / 4294967295;
      }
    }
    return { grid, cells };
  });
  const sample = ({ grid, cells }, x, z) => {
    const fx = x * cells / size;
    const fz = z * cells / size;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const u = smoothstep(fx - ix);
    const v = smoothstep(fz - iz);
    const nextX = (ix + 1) % cells;
    const nextZ = (iz + 1) % cells;
    const a = grid[iz * cells + ix] * (1 - u) + grid[iz * cells + nextX] * u;
    const b = grid[nextZ * cells + ix] * (1 - u) + grid[nextZ * cells + nextX] * u;
    return a * (1 - v) + b * v;
  };
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const broad = sample(grids[0], x, z);
      const middle = sample(grids[1], x, z);
      const fine = sample(grids[2], x, z);
      const grain = (hash2(x + 5021, z - 3011) & 255) / 255;
      const shade = 245 + (broad - 0.5) * 22 + (middle - 0.5) * 17
        + (fine - 0.5) * 14 + (grain - 0.5) * 7;
      const straw = grain > 0.985 && broad > 0.48;
      const i = (z * size + x) * 4;
      data[i] = Math.min(255, shade + (straw ? 8 : 0));
      data[i + 1] = Math.min(255, shade + 2);
      data[i + 2] = Math.min(255, shade - 5 - (straw ? 12 : 0));
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'Ground grass';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.repeat.set(GROUND_SIZE / GRASS_TILE_METERS, GROUND_SIZE / GRASS_TILE_METERS);
  texture.needsUpdate = true;
  return texture;
}

// ---------------- internals ----------------

function buildSky(scene) {
  const skyGeo = new THREE.SphereGeometry(900, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(SKY_TOP) },
      bottomColor: { value: new THREE.Color(SKY_BOTTOM) },
      offset: { value: 30 },
      exponent: { value: 0.85 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  return sky;
}

// Starfield — 1200 points scattered across the upper hemisphere of a sphere
// just inside the sky dome. Each star gets a random size, a randomized colour
// (mostly white, with a sprinkle of warm + cool tints), and an independent
// twinkle phase so the field shimmers rather than blinking uniformly.
//
// Driven entirely by a custom ShaderMaterial — uses gl_PointSize for per-star
// scale and AdditiveBlending so they glow against the dark sky. nightness
// uniform fades them in/out as the day cycles.
function buildStars(scene) {
  const STAR_COUNT = 1200;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const colors = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    // Upper hemisphere distribution: phi all the way around, theta only the
    // top ~80° (some stars near the horizon, none below).
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.acos(Math.random() * 0.95);  // 0..~78° from straight-up
    const r = 850;                                    // just inside sky radius 900
    positions[i * 3]     = r * Math.sin(theta) * Math.cos(phi);
    positions[i * 3 + 1] = r * Math.cos(theta);
    positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);

    // Size — pow(rand, 4) biases toward small with a few bright "named star"
    // outliers. Range roughly 1.0..5.5 device-pixel units.
    sizes[i] = 1.0 + Math.pow(Math.random(), 4) * 4.5;

    // Colour — 70% white, 15% blue-white, 10% yellow-white, 5% orange-white.
    const cp = Math.random();
    let r0, g0, b0;
    if      (cp < 0.70) { r0 = 1.00; g0 = 1.00; b0 = 1.00; }
    else if (cp < 0.85) { r0 = 0.85; g0 = 0.92; b0 = 1.00; }
    else if (cp < 0.95) { r0 = 1.00; g0 = 0.95; b0 = 0.85; }
    else                { r0 = 1.00; g0 = 0.85; b0 = 0.72; }
    colors[i * 3]     = r0;
    colors[i * 3 + 1] = g0;
    colors[i * 3 + 2] = b0;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      nightness: { value: 0 },
      time:      { value: 0 },
      pixelRatio:{ value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float time;
      uniform float pixelRatio;
      void main() {
        vColor = color;
        // Per-star twinkle phase from position — deterministic, unique per star.
        float phase = position.x * 0.013 + position.z * 0.019 + position.y * 0.007;
        vTwinkle = 0.65 + 0.35 * sin(time * 1.6 + phase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * pixelRatio;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float nightness;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        // Soft round splat — alpha falls off from center to edge.
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float falloff = smoothstep(0.5, 0.0, d);
        float alpha = falloff * nightness * vTwinkle;
        gl_FragColor = vec4(vColor * vTwinkle, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });

  const stars = new THREE.Points(geo, mat);
  stars.renderOrder = -1;   // draw early — keeps additive blend out of crowd of bubbles
  scene.add(stars);
  return stars;
}

// Moon — visible sphere mesh that orbits the night sky in parallel to the
// sun's day arc. Slightly emissive so it glows against the dark sky, with a
// subtler "highlight + shadow" feel from a secondary darker patch on one
// side. Not a light source — the hemisphere/sun handle world illumination.
function buildMoon(scene) {
  const group = new THREE.Group();
  group.name = 'moon';

  // Main moon body — pale cream, slight emissive so it pops against the
  // night sky. Big enough to read from anywhere in the world (radius 14 at
  // sky distance ~850 subtends ~1° — about real-moon size).
  const moon = new THREE.Mesh(
    new THREE.IcosahedronGeometry(14, 2),
    new THREE.MeshBasicMaterial({
      color: 0xfaf2dc,
      // MeshBasicMaterial ignores lighting — exactly what we want for a
      // self-luminous moon. The MeshStandardMaterial sun wouldn't light it
      // anyway since they're both above the horizon together (well, never;
      // moon only when sun is down — but still cleaner this way).
    }),
  );
  group.add(moon);

  // Slightly darker patch offset to one side — gives the moon a subtle
  // "mare" / phase hint without going full lunar map. Small icosphere
  // overlapping the front face of the main sphere.
  const mare = new THREE.Mesh(
    new THREE.IcosahedronGeometry(11, 2),
    new THREE.MeshBasicMaterial({ color: 0xc8b89a }),
  );
  mare.position.set(2.5, 1.5, 4);
  mare.scale.set(0.65, 0.55, 0.45);
  group.add(mare);

  // Soft halo — a larger faintly-emissive sphere with additive blending so it
  // looks like the moon has a gentle glow around it.
  const halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(22, 1),
    new THREE.MeshBasicMaterial({
      color: 0xb8c4e0,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(halo);

  // Celestial depth belongs behind every ridge, independent of the compact
  // orbit used to stay inside the camera's far plane. Keep the halo there too.
  group.traverse((mesh) => {
    if (!mesh.isMesh) return;
    mesh.material.fog = false;
    mesh.material.depthWrite = false;
    mesh.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n gl_Position.z = gl_Position.w * 0.999999;');
    };
    mesh.material.customProgramCacheKey = () => 'celestial-depth-v1';
  });
  moon.renderOrder = 1;
  mare.renderOrder = 2;
  group.visible = false;  // updateWorld toggles based on night phase
  scene.add(group);
  return group;
}

function buildLightsAndFog(scene) {
  scene.fog = new THREE.Fog(FOG_COLOR, 120, 520);

  const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(SUN_COLOR, 1.35);
  sun.position.set(80, 130, 60);
  sun.castShadow = PERF.shadows;
  // Tier-aware shadow map size (per threejs-lighting skill: "smaller shadow
  // maps; 512-1024 often sufficient"). The world's sun is the only shadow
  // caster in the scene, so map size is the lever — 512 on mid, 1024 on
  // high. Low tier has shadows off entirely.
  const shadowMapSize = PERF.name === 'high' ? 1024 : 512;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  // Tighter shadow frustum on mid (the chunk draw radius is smaller, so we
  // don't need to cover the full 100m × 100m area) — gets more resolution
  // out of the smaller map.
  const shadowD = PERF.name === 'high' ? 100 : 60;
  sun.shadow.camera.left = -shadowD;
  sun.shadow.camera.right = shadowD;
  sun.shadow.camera.top = shadowD;
  sun.shadow.camera.bottom = -shadowD;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);

  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);
  return { sun, hemi, ambient };
}

function buildGround(scene, originX, originZ) {
  const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEG, GROUND_SEG);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  // The 10m lattice remains anchored in world space across 40m recenters.

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(originX + x, originZ + z));

    writeGroundColor(colors, i * 3, originX + x, originZ + z);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: makeGrassTexture(),
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });
  mat.map.offset.set(
    (originX - GROUND_SIZE / 2) / GRASS_TILE_METERS,
    -(originZ + GROUND_SIZE / 2) / GRASS_TILE_METERS,
  );
  const ground = new THREE.Mesh(geo, mat);
  ground.position.set(originX, 0, originZ);
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}
