// Crowd v2: pool of stateful NPCs spawned by chunks.
//
// Each NPC has:
//   - a personality (curiosity, skittishness, energy, social, talkativeness)
//   - a state: idle | walking | watching | approaching | fleeing | smiling
//   - a target (a registered attractor or random spot)
//   - a group affiliation (optional; group members hover near each other)
//
// Movement uses simple steering: seek target, repel from buildings (via registry),
// repel from neighbors slightly (separation), and a path-attraction nudge toward
// the chunk grid lines so people *tend* to use the dirt paths but don't have to.
//
// Smile mechanic:
//   - Eye-contact + bubble proximity raise happiness.
//   - On threshold: emit a smile pickup, record Zerble's position at-smile.
//   - The same NPC can't smile again until Zerble has driven SMILE_RESET_DIST
//     away (avoids parking-near-crowd farming) AND a small time cooldown.

import * as THREE from 'three';
// BufferGeometryUtils has no default-namespace export — it's a flat ES module.
// `import * as` collects all named exports under one identifier so we can keep
// the `BufferGeometryUtils.mergeGeometries(...)` call style.
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { registry } from './registry.js';
import { SpatialGrid } from './spatialGrid.js';
import { PERF, USE_WORLDGEN_V2 } from './perf.js';
import { CHUNK_SIZE } from './chunks.js';
import { DODGE, laneDodgeTest, laneDodgeDir, honkScatterParams } from './steering.js';
import { STINK_DUR, POTTY_DOOR_STAND, POTTY_SEAT_BACK, POTTY_SEAT_Y } from './models/portaPotty.js';
import {
  PHOTO_POSE_DURATION,
  PHOTO_FLASH_DURATION,
  PHOTO_STATE_NOTICE,
  PHOTO_STATE_POSE,
  advancePhotographerShot,
  isPhotographerState,
  photographerProfile,
  startPhotographerShot,
  tickPhotographerOpportunity,
} from './photographer.js';

const MAX_NPCS = PERF.crowdMax;

// Despawn NPCs that drift more than this far from Zerble. Anchored to the
// chunk-load radius so we keep NPCs alive across the area that's actually
// rendered, plus a half-chunk buffer to avoid visible blink-out at the edge.
// Riding/boarding NPCs are exempt — they're physically tied to the cart.
const DESPAWN_RADIUS = (PERF.chunkUnloadRadius + 0.5) * CHUNK_SIZE;
const DESPAWN_R2 = DESPAWN_RADIUS * DESPAWN_RADIUS;
// Base shirt palette — wider than before, with bolder tie-dye-flavored hues
// mixed in (magentas, lime greens, electric blues, sunset oranges). Plain
// shirts pick from here; tie-dyed shirts pick two distinct entries (base +
// accent) and the fragment shader blends them in a swirl pattern.
const NPC_ROW_SHIRT = [
  // Originals (the older festival pastels)
  0xff6f9c, 0xffd28a, 0x6fcf6a, 0x66d9ff, 0xb285ff,
  0xff8a5b, 0xf2e8cf, 0x8ecae6, 0xffb703, 0xc77dff,
  0x7bd389, 0xe07a5f, 0x81b29a, 0xf4a261,
  // Vivid tie-dye flavors
  0xff3d7f, 0xff5e3a, 0xffe14d, 0x4dffa5, 0x3acfd5,
  0x6c5bff, 0xff44dd, 0xb7ff5b, 0xff7b3c, 0x39d6c4,
  0x9b6bff, 0xff5577, 0xffd23f, 0x59ffa0,
];

// Fraction of NPCs that get a tie-dye swirl (vs. plain shirt). Around
// half feels festival-coded without overdoing it.
const TIE_DYE_FRACTION = 0.55;

// Awareness / charm
const NOTICE_RANGE = 22;             // NPC starts paying attention to Zerble
const SMILE_RANGE = 18;
const SMILE_CONE_DEG = 80;
const BUBBLE_RANGE = 6;
const HAPPINESS_THRESHOLD = 0.7;
const SMILE_RESET_DIST = 28;         // Zerble must drive this far for the same NPC to smile again
const SMILE_TIME_COOLDOWN = 3;       // ...AND wait this long
const FROWN_THRESHOLD = 0.9;         // builds a touch slower than a smile, but reliably
const FROWN_DURATION = 2.6;          // how long they frown + turn away before resuming
const HONK_BOOST = 0.8;
// States the star-power love-magnet leaves untouched (mid-interaction NPCs).
const STAR_LOVE_SKIP = new Set([
  'riding', 'boarding', 'disembarking', 'fleeing',
  'hammock_riding', 'walking_to_hammock', 'table_seated', 'walking_to_table',
  'seeking_potty', 'entering_potty', 'using_potty', 'exiting_potty', 'surprised_potty',
  PHOTO_STATE_NOTICE, PHOTO_STATE_POSE,
]);
const HONK_RANGE = 14;

// Trajectory dodge + speed-scaled honk math is shared with the kid gaggles —
// see src/steering.js (DODGE/HONK knobs, laneDodgeTest, laneDodgeDir,
// honkScatterParams). Tune there and both systems move together.
const _dodgeOut = { x: 0, z: 0 };   // reused scratch for laneDodgeDir (no per-frame alloc)

// Passenger system
const MAX_PASSENGERS = 10;
const ZERBLE_IDLE_SPEED = 0.6;       // |speed| below this counts as idle
const BOARD_RANGE = 1.3;              // close enough to a seat to sit down
const PASSENGER_BOARD_CHANCE_PER_SEC = 0.45;
const RIDE_MIN_TIME = 15;
const RIDE_MAX_TIME = 75;

// Behavior
const PATH_GRID = 80;                // matches CHUNK_SIZE — paths run along multiples of this
const PATH_PULL_WIDTH = 4;           // how wide the "near path" band is
const BUILDING_AVOID_RADIUS = 4;     // extra buffer beyond footprint
const SEPARATION_RADIUS = 1.9;       // soft separation force kicks in within this
const HARD_SEPARATION = 0.85;        // never let two NPCs get closer than this
const ARRIVE_RADIUS = 1.5;

// Porta-potty seeking. NPCs rarely decide they need the bathroom and head for
// the nearest unit. Tuned LOW so it reads as the occasional realistic detour,
// not a stampede — at this rate you'll see one or two of a crowd peel off over
// a minute. The search radius is generous (a potty a chunk over still counts).
const POTTY_URGE_RATE = 0.0025;      // per-second chance from idle (kept low — ~a couple % of the crowd in a potty trip at any time)
const POTTY_SEARCH_R2 = 90 * 90;     // only consider units within 90m
const POTTY_USE_MIN = 6;             // seconds spent inside
const POTTY_USE_MAX = 13;
const POTTY_LOCK_CHANCE = 0.7;       // odds the occupant locks the door

// Cheer: NPCs within this radius of a song-end position cheer for 5s.
const CHEER_RADIUS = 16;
const CHEER_RADIUS_SQ = CHEER_RADIUS * CHEER_RADIUS;
// Jump parameters: positive-half sine only so NPCs hop up, not bob through floor.
const HOP_HZ = 2 * Math.PI * 2.6;
const HOP_HEIGHT = 0.32;
const PHOTOGRAPHER_ELIGIBLE = new Set(['idle', 'walking', 'watching', 'approaching']);

export class Crowd {
  constructor(smiles) {
    this.smiles = smiles;
    // Set true from main.js when Zerble's bubble tank is dry — NPCs frown
    // instead of smile. `onFrown(npc)` fires when a frown lands (score sink).
    this.bubblesEmpty = false;
    // Set true from main.js while the star-power love buff is active — gates
    // the proximity flee so nobody runs from a Zerble everyone's smitten with.
    this.starActive = false;
    // Festival Run day ramp: main.js scales this up as days pass so crowds get
    // touchier (faster displeasure build). Stays 1.0 in Just Cruisin'.
    this.frownRateMult = 1.0;
    this.onFrown = null;
    // `onBoard(npc)` fires when an NPC actually climbs aboard (boarding→riding).
    this.onBoard = null;
    this.npcs = [];
    this.free = []; // indices available
    this.groups = new Map(); // groupId -> { center: Vector3, members: [npcs] }
    // Per-frame separation broadphase (cell = SEPARATION_RADIUS). Rebuilt from
    // live NPC positions at the top of update().
    this._sepGrid = new SpatialGrid(SEPARATION_RADIUS);
    // Opt-in steady-state instrumentation, toggled by the debug perf recorder
    // (setPerfRecording). When `on`, accumulates self-time for the two per-NPC
    // neighbourhood scans (separation + footprint avoidance) so a capture can
    // attribute the steady-state grind. Read + zeroed each perf sample. Off by
    // default → a single boolean check per scan, no timing cost in normal play.
    this._perf = { on: false, sepMs: 0, avoidMs: 0, frames: 0 };
    this._photographerCount = 0;
    this._photoDrawCount = 0;
    this._photoFree = [];

    this._buildInstanced();
  }

  _buildInstanced() {
    // ---- Legs: two cylinders merged, offsets baked into geometry ----
    const legL = new THREE.CylinderGeometry(0.10, 0.10, 0.65, 6);
    legL.translate(-0.12, 0.325, 0);
    const legR = new THREE.CylinderGeometry(0.10, 0.10, 0.65, 6);
    legR.translate(0.12, 0.325, 0);
    const legsGeo = BufferGeometryUtils.mergeGeometries([legL, legR]);
    legL.dispose(); legR.dispose();

    // ---- Shoes: two boxes merged, offsets baked in ----
    const shoeL = new THREE.BoxGeometry(0.16, 0.07, 0.24);
    shoeL.translate(-0.12, 0.035, -0.06);
    const shoeR = new THREE.BoxGeometry(0.16, 0.07, 0.24);
    shoeR.translate(0.12, 0.035, -0.06);
    const shoesGeo = BufferGeometryUtils.mergeGeometries([shoeL, shoeR]);
    shoeL.dispose(); shoeR.dispose();

    // ---- Body (torso): capsule centered at y=1.0 ----
    const bodyGeo = new THREE.CapsuleGeometry(0.26, 0.55, 3, 6);
    bodyGeo.translate(0, 1.0, 0);

    // ---- Arms: two single-segment capsules merged, shoulders at (±0.30, 1.10, 0) ----
    const armL = new THREE.CapsuleGeometry(0.075, 0.5, 3, 6);
    armL.translate(-0.30, 1.10, 0);
    const armR = new THREE.CapsuleGeometry(0.075, 0.5, 3, 6);
    armR.translate(0.30, 1.10, 0);
    const armsGeo = BufferGeometryUtils.mergeGeometries([armL, armR]);
    armL.dispose(); armR.dispose();

    // ---- Head: icosahedron at y=1.65 ----
    const headGeo = new THREE.IcosahedronGeometry(0.26, 1);
    headGeo.translate(0, 1.65, 0);

    // ---- Eyes: two small spheres baked at NPC-local (±0.08, 1.68, -0.22) ----
    const eyeL = new THREE.SphereGeometry(0.028, 6, 6);
    eyeL.translate(-0.08, 1.68, -0.22);
    const eyeR = new THREE.SphereGeometry(0.028, 6, 6);
    eyeR.translate(0.08, 1.68, -0.22);
    const eyesGeo = BufferGeometryUtils.mergeGeometries([eyeL, eyeR]);
    eyeL.dispose(); eyeR.dispose();

    // ---- Mouth: half-torus smile arc baked at the ORIGIN (positioned via matrix) ----
    // TorusGeometry lies in XY plane; default arc is top half. rotateZ(PI) flips it
    // so the arc opens upward (smile shape). Baked at origin so per-NPC matrix can
    // apply scale around its local center for the smile-pop effect.
    const mouthGeo = new THREE.TorusGeometry(0.06, 0.012, 4, 8, Math.PI);
    mouthGeo.rotateZ(Math.PI);

    // ---- Photographer camera: one dark merged prop, pooled by NPC slot ----
    // The camera lives in the crowd instancing system instead of adding a
    // separate Object3D per rare photographer. Its body, top bump, and lens are
    // one opaque geometry and one draw call. Local -Z is the NPC's forward.
    const cameraBody = new THREE.BoxGeometry(0.34, 0.22, 0.14);
    cameraBody.translate(0, 1.20, -0.36);
    const cameraTop = new THREE.BoxGeometry(0.12, 0.05, 0.10);
    cameraTop.translate(-0.07, 1.335, -0.36);
    const cameraLens = new THREE.CylinderGeometry(0.075, 0.09, 0.10, 8);
    cameraLens.rotateX(Math.PI / 2);
    cameraLens.translate(0, 1.20, -0.47);
    const cameraGeo = BufferGeometryUtils.mergeGeometries([cameraBody, cameraTop, cameraLens]);
    cameraBody.dispose(); cameraTop.dispose(); cameraLens.dispose();
    const flashGeo = new THREE.IcosahedronGeometry(0.16, 0);

    // ---- Materials ----
    const legsMat  = new THREE.MeshStandardMaterial({ color: 0x223a5c, roughness: 0.92, flatShading: true });
    const shoesMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8,  flatShading: true });
    const bodyMat  = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
    const armsMat  = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
    const headMat  = new THREE.MeshStandardMaterial({ color: 0xe6c098, roughness: 0.9,  flatShading: true });
    const featureMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const cameraMat = new THREE.MeshStandardMaterial({ color: 0x17151c, roughness: 0.58, metalness: 0.2, flatShading: true });
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff2ad, toneMapped: false, depthWrite: true });

    // Tie-dye injection — adds two per-instance attributes:
    //   shirtAccent (vec3)  — the secondary color woven through the shirt
    //   shirtTieDye (float) — 0 means plain (no swirl); >0 picks pattern
    //                          frequency + amplitude
    // The fragment shader builds a swirl from the geometry's local position
    // (capsule UVs are degenerate around the poles, position is more reliable)
    // and blends instanceColor with shirtAccent based on a sin/cos noise.
    // Applied to both body and arm materials so sleeves match.
    const tieDyeBeforeCompile = (shader) => {
      // Inject attribute + varying declarations at the very top of each stage.
      shader.vertexShader = `
        attribute vec3 shirtAccent;
        attribute float shirtTieDye;
        varying vec3 vShirtAccent;
        varying float vShirtTieDye;
        varying vec3 vLocalPos;
      ` + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vShirtAccent = shirtAccent;
         vShirtTieDye = shirtTieDye;
         vLocalPos = position;`
      );
      shader.fragmentShader = `
        varying vec3 vShirtAccent;
        varying float vShirtTieDye;
        varying vec3 vLocalPos;
      ` + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         if (vShirtTieDye > 0.01) {
           float freq = 8.0 + vShirtTieDye * 14.0;
           float phase = vShirtTieDye * 9.42;
           float swirl =
             sin(vLocalPos.y * freq + phase) +
             sin((vLocalPos.x + vLocalPos.z) * freq * 0.85 - phase * 1.3) * 0.85 +
             sin((vLocalPos.x - vLocalPos.y) * freq * 0.6 + phase * 2.1) * 0.6;
           float blend = smoothstep(-0.3, 0.5, swirl) * (0.45 + vShirtTieDye * 0.35);
           diffuseColor.rgb = mix(diffuseColor.rgb, vShirtAccent, blend);
         }`
      );
    };
    bodyMat.onBeforeCompile = tieDyeBeforeCompile;
    armsMat.onBeforeCompile = tieDyeBeforeCompile;
    // onBeforeCompile-modified materials need a unique customProgramCacheKey
    // so three.js doesn't reuse a vanilla MeshStandardMaterial program.
    bodyMat.customProgramCacheKey = () => 'crowd-tiedye-v1';
    armsMat.customProgramCacheKey = () => 'crowd-tiedye-v1';

    // ---- InstancedMeshes ----
    this.legsMesh  = new THREE.InstancedMesh(legsGeo,  legsMat,  MAX_NPCS);
    this.shoesMesh = new THREE.InstancedMesh(shoesGeo, shoesMat, MAX_NPCS);
    this.bodyMesh  = new THREE.InstancedMesh(bodyGeo,  bodyMat,  MAX_NPCS);
    this.armsMesh  = new THREE.InstancedMesh(armsGeo,  armsMat,  MAX_NPCS);
    this.headMesh  = new THREE.InstancedMesh(headGeo,  headMat,  MAX_NPCS);
    this.eyesMesh  = new THREE.InstancedMesh(eyesGeo,  featureMat, MAX_NPCS);
    this.mouthMesh = new THREE.InstancedMesh(mouthGeo, featureMat, MAX_NPCS);
    this.cameraMesh = new THREE.InstancedMesh(cameraGeo, cameraMat, MAX_NPCS);
    this.flashMesh = new THREE.InstancedMesh(flashGeo, flashMat, MAX_NPCS);

    // Per-NPC shirt color shared between body and arms (sleeves).
    this.bodyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_NPCS * 3), 3);
    this.armsMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_NPCS * 3), 3);

    // Tie-dye per-instance attributes. shirtAccent is the secondary color;
    // shirtTieDye is 0 for plain shirts and ~0.4-1.0 for tie-dyed ones. Both
    // bodyMesh + armsMesh share the same data references so sleeves match.
    const accentData = new Float32Array(MAX_NPCS * 3);
    const tieDyeData = new Float32Array(MAX_NPCS);
    const shirtAccentAttr_body = new THREE.InstancedBufferAttribute(accentData, 3);
    const shirtTieDyeAttr_body = new THREE.InstancedBufferAttribute(tieDyeData, 1);
    const shirtAccentAttr_arms = new THREE.InstancedBufferAttribute(accentData, 3);
    const shirtTieDyeAttr_arms = new THREE.InstancedBufferAttribute(tieDyeData, 1);
    bodyGeo.setAttribute('shirtAccent', shirtAccentAttr_body);
    bodyGeo.setAttribute('shirtTieDye', shirtTieDyeAttr_body);
    armsGeo.setAttribute('shirtAccent', shirtAccentAttr_arms);
    armsGeo.setAttribute('shirtTieDye', shirtTieDyeAttr_arms);
    this._shirtAccentData = accentData;
    this._shirtTieDyeData = tieDyeData;
    this._shirtAccentAttrs = [shirtAccentAttr_body, shirtAccentAttr_arms];
    this._shirtTieDyeAttrs = [shirtTieDyeAttr_body, shirtTieDyeAttr_arms];

    // InstancedMesh frustum culling uses a bounding sphere that's computed once
    // and cached — it does NOT auto-expand when instance matrices move. As
    // Zerble drives far from spawn, the cached sphere falls behind the camera
    // and the entire crowd vanishes (while game logic keeps running →
    // invisible collisions, invisible smiles). Bubbles already disables
    // culling for the same reason. One drawcall per mesh either way.
    const allMeshes = [this.legsMesh, this.shoesMesh, this.bodyMesh, this.armsMesh, this.headMesh,
      this.eyesMesh, this.mouthMesh, this.cameraMesh, this.flashMesh];
    for (const m of allMeshes) {
      m.castShadow = PERF.shadows;
      m.frustumCulled = false;
      m.count = MAX_NPCS;
    }
    // The tiny camera and instantaneous unlit flash do not justify two more
    // shadow casters. The flash is opaque and adds no light or transparency.
    this.cameraMesh.castShadow = false;
    this.flashMesh.castShadow = false;

    this.group = new THREE.Group();
    this.group.name = 'Crowd';
    for (const m of allMeshes) this.group.add(m);

    // Hide all slots initially (zero-scale matrix = invisible).
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this._zeroMat = zero;
    for (let i = 0; i < MAX_NPCS; i++) {
      for (const m of allMeshes) m.setMatrixAt(i, zero);
      this.free.push(i);
    }
    // Photographer props have their own packed slot map. Crowd NPC indices
    // currently allocate from the high end, so reusing npc.idx would submit
    // hundreds of zero-scale camera instances for one rare photographer.
    // Descending fill + pop hands out 0, 1, 2... and keeps GPU work proportional
    // to the actual photographer count.
    for (let i = MAX_NPCS - 1; i >= 0; i--) this._photoFree.push(i);
    for (const m of allMeshes) m.instanceMatrix.needsUpdate = true;
    this.cameraMesh.count = 0;
    this.flashMesh.count = 0;

    // Reusables — must be DISTINCT Vector3 instances; reusing one for both
    // position and scale args of Matrix4.compose() silently corrupts position.
    this._mat4 = new THREE.Matrix4();
    this._tmpV = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._tmpV3 = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpEuler = new THREE.Euler();
    this._tmpDanceMat = new THREE.Matrix4();
    this._tmpScale = new THREE.Vector3();
    this._mouthMat = new THREE.Matrix4();
    // Mouth is positioned as a child of the body matrix (see _writeMatrices):
    // _mouthLocalMat holds the face-local offset + smile-pop scale, identity
    // rotation, multiplied onto the body matrix so the smile inherits bob,
    // sway tilt, yaw wiggle, NPC scale, and seat/hammock lift.
    this._mouthLocalMat = new THREE.Matrix4();
    this._flashLocalMat = new THREE.Matrix4();
    this._flashMat = new THREE.Matrix4();
    this._identityQuat = new THREE.Quaternion();
    // 180° about Z flips the smile arc into a frown (mouth geo is symmetric
    // about Y, so the x-mirror is harmless).
    this._frownQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
    // Supine-pose scratch (used by hammock_riding NPCs to compose the supine
    // rotation: X=+π/2 to face up, then Y=yaw to align spine with hammock).
    this._supineQuatX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    this._supineQuatY = new THREE.Quaternion();
    this._axisY = new THREE.Vector3(0, 1, 0);

    // Seated-rider leg bend: seated cart passengers (bench / driver) get their
    // legs pivoted forward at the hip (~70°) so they sit instead of standing on
    // the seat. The legs+shoes are their own InstancedMeshes, so they take this
    // extra local transform on top of the (upright) body matrix. Constant, so
    // precompute once: translate to hip → rotate X forward → translate back.
    const HIP_Y = 0.62, SIT_BEND = 1.25;   // ~72° forward
    this._sitLegMat = new THREE.Matrix4()
      .makeTranslation(0, HIP_Y, 0)
      .multiply(new THREE.Matrix4().makeRotationX(SIT_BEND))
      .multiply(new THREE.Matrix4().makeTranslation(0, -HIP_Y, 0));
    this._legMat = new THREE.Matrix4();

    // Arms-up cheer pose: translate to the shoulder pivot (arms geometry is
    // centered at y≈1.10), rotate ~−150° about X (arms point up and slightly
    // back), translate back. Precomputed once; multiplied onto the arms
    // instance matrix when npc.cheerTimer > 0, mirroring _sitLegMat exactly.
    const SHOULDER_Y = 1.10, ARMS_UP_BEND = -2.618; // −150° in radians
    this._armsUpMat = new THREE.Matrix4()
      .makeTranslation(0, SHOULDER_Y, 0)
      .multiply(new THREE.Matrix4().makeRotationX(ARMS_UP_BEND))
      .multiply(new THREE.Matrix4().makeTranslation(0, -SHOULDER_Y, 0));
    this._armsMat = new THREE.Matrix4();
    this._photoArmsMat = new THREE.Matrix4()
      .makeTranslation(0, SHOULDER_Y, 0)
      .multiply(new THREE.Matrix4().makeRotationX(-1.52))
      .multiply(new THREE.Matrix4().makeTranslation(0, -SHOULDER_Y, 0));
    this._photoCrouchLegMat = new THREE.Matrix4()
      .makeTranslation(0, HIP_Y, 0)
      .multiply(new THREE.Matrix4().makeRotationX(0.82))
      .multiply(new THREE.Matrix4().makeTranslation(0, -HIP_Y, 0));

    // High-water mark: highest slot index ever written. count is set to
    // _maxIdx + 1 each frame so three.js skips unwritten slots above it.
    this._maxIdx = -1;
  }

  // Called by chunk generator.
  spawn({ pos, chunkKey, rng = Math.random, forcePhotographer = false }) {
    if (this.free.length === 0) return null;
    const idx = this.free.pop();

    // Personality
    const curiosity = rng();
    const skittish = (1 - curiosity) * rng();        // can't be both bold AND skittish
    const social = rng();
    const energy = 0.6 + rng() * 0.7;
    const dance = rng();                              // some people sway in place to music

    // Group: probability based on sociability
    let groupId = null;
    if (social > 0.55) {
      // Try to join an existing nearby group, else start one
      let joined = false;
      for (const [gid, g] of this.groups) {
        if (pos.distanceTo(g.center) < 9 && g.members.length < 6) {
          groupId = gid;
          g.members.push(idx);
          joined = true;
          break;
        }
      }
      if (!joined) {
        groupId = `g${idx}`;
        this.groups.set(groupId, { center: pos.clone(), members: [idx] });
      }
    }

    const shirt = NPC_ROW_SHIRT[Math.floor(rng() * NPC_ROW_SHIRT.length)];
    // Pick a tie-dye accent if this NPC will be tie-dyed. Accent must differ
    // from the base color so the swirl is actually visible.
    let tieDye = 0;
    let accentHex = shirt;
    if (rng() < TIE_DYE_FRACTION) {
      tieDye = 0.4 + rng() * 0.6;       // 0.4..1.0 — varies pattern frequency
      // Pick a distinct second color (loop a few times to avoid a self-match
      // which would be invisible).
      for (let tries = 0; tries < 4; tries++) {
        const pick = NPC_ROW_SHIRT[Math.floor(rng() * NPC_ROW_SHIRT.length)];
        if (pick !== shirt) { accentHex = pick; break; }
      }
    }

    const npc = {
      idx,
      pos: pos.clone(),
      vel: new THREE.Vector3(),
      target: pos.clone(),
      yaw: rng() * Math.PI * 2,
      baseYaw: rng() * Math.PI * 2,
      bob: rng() * Math.PI * 2,
      scale: 0.85 + rng() * 0.4,
      shirt,

      state: 'idle',
      stateTimer: rng() * 2,

      // Personality
      curiosity,
      skittish,
      social,
      energy,
      dance,

      // Group
      groupId,

      // Charm
      happiness: 0,
      displeasure: 0,        // builds when a bubble-less Zerble is in view
      frownTimer: 0,         // >0 = mouth is rendered as a frown
      smileTimeCooldown: 0,
      lastSmilePos: null,    // Zerble's position when this NPC last smiled
      // Watching state: how long they've been staring at Zerble, what
      // their personal attention span is, when they get bored and walk
      // off, etc. All start undefined; populated on first frame in
      // 'watching' so the values get re-rolled each new engagement.
      watchTimer: undefined,
      attentionSpan: undefined,
      shuffleTimer: undefined,
      shuffleTarget: null,
      // After the NPC walks away, they won't re-engage with Zerble for
      // this many seconds (epoch time). Lets you actually leave a crowd
      // behind instead of being permanently mobbed.
      disinterestedUntil: 0,

      // Porta-potty seeking. pottyEntry = the registry entry being targeted;
      // pottyTried = ids already attempted (occupied/locked) so "next closest"
      // skips them. Both null/undefined until an urge strikes (see 'idle').
      pottyEntry: null,
      pottyTried: null,
      pottyWait: 0,

      // Picnic-table seating. tableEntry = the registry entry; tableSeat = the
      // claimed world-space seat slot ({x,z,y,yaw,occupied}). Null until they sit.
      tableEntry: null,
      tableSeat: null,

      chunkKey,
    };

    Object.assign(npc, photographerProfile(pos, forcePhotographer));
    npc.photoSlot = -1;
    if (npc.isPhotographer) {
      npc.photoSlot = this._photoFree.pop();
      this._photographerCount++;
      if (npc.photoSlot + 1 > this._photoDrawCount) this._photoDrawCount = npc.photoSlot + 1;
    }

    this.npcs.push(npc);

    // Track the highest-ever slot index so we can narrow draw count each frame.
    if (idx > this._maxIdx) this._maxIdx = idx;

    // Color — shirt applied to both body (torso) and arms (sleeves) so they match.
    const c = new THREE.Color(shirt);
    this.bodyMesh.instanceColor.setXYZ(idx, c.r, c.g, c.b);
    this.bodyMesh.instanceColor.needsUpdate = true;
    this.armsMesh.instanceColor.setXYZ(idx, c.r, c.g, c.b);
    this.armsMesh.instanceColor.needsUpdate = true;
    // Tie-dye accent + amount. Both bodyMesh + armsMesh share the underlying
    // Float32Array but have separate InstancedBufferAttribute wrappers, so we
    // must flag needsUpdate on both attribute objects each time.
    const ac = new THREE.Color(accentHex);
    this._shirtAccentData[idx * 3 + 0] = ac.r;
    this._shirtAccentData[idx * 3 + 1] = ac.g;
    this._shirtAccentData[idx * 3 + 2] = ac.b;
    this._shirtTieDyeData[idx] = tieDye;
    for (const a of this._shirtAccentAttrs) a.needsUpdate = true;
    for (const a of this._shirtTieDyeAttrs) a.needsUpdate = true;

    // Initial transform
    this._writeMatrices(npc);

    return npc;
  }

  // Cheap debug/sandbox trigger. If the loaded crowd has no organic
  // photographer, promote one existing NPC with the same isolated profile
  // initializer, then run the real notice -> pose -> flash state machine.
  forcePhotographer(npc = null) {
    const target = npc || this.npcs.find((n) => n.isPhotographer) ||
      this.npcs.find((n) => PHOTOGRAPHER_ELIGIBLE.has(n.state)) || this.npcs[0];
    if (!target) return null;
    if (!target.isPhotographer) {
      Object.assign(target, photographerProfile(target.pos, true));
      target.photoSlot = this._photoFree.pop();
      this._photographerCount++;
      if (target.photoSlot + 1 > this._photoDrawCount) this._photoDrawCount = target.photoSlot + 1;
    }
    startPhotographerShot(target);
    this._writeMatrices(target);
    return target;
  }

  triggerPhotographer(npc = null) {
    const target = npc || this.npcs.find((n) => n.isPhotographer);
    if (!target) return null;
    startPhotographerShot(target);
    this._writeMatrices(target);
    return target;
  }

  previewPhotographerFlash(npc = null, duration = 0.6) {
    const target = npc || this.npcs.find((n) => n.isPhotographer);
    if (!target) return null;
    target.photoFlashTimer = Math.max(PHOTO_FLASH_DURATION, duration);
    this._writeMatrices(target);
    return target;
  }

  // Trigger a cheer wave centered at (x, z) — called by main.js when a song ends.
  // NPCs in available states (idle/walking/watching/onDancefloor) within
  // CHEER_RADIUS get 5s of jump+arms-up+smile. Riding/boarding/fleeing/hammock
  // states are skipped so riders don't ghost off their seats.
  cheerNear(x, z) {
    for (const npc of this.npcs) {
      const dx = npc.pos.x - x;
      const dz = npc.pos.z - z;
      if (dx * dx + dz * dz > CHEER_RADIUS_SQ) continue;
      const s = npc.state;
      if (s === 'riding' || s === 'boarding' || s === 'disembarking' ||
          s === 'fleeing' || s === 'walking_to_hammock' || s === 'hammock_riding' ||
          s === 'walking_to_table' || s === 'table_seated' || isPhotographerState(s)) continue;
      npc.cheerTimer = 5.0;
      npc.cheerX = x;
      npc.cheerZ = z;
      npc.smileTimeCooldown = SMILE_TIME_COOLDOWN;
    }
  }

  // Kept as a no-op for chunk-unload back-compat. Lifecycle is now driven by
  // distance from Zerble in update() — that way NPCs who wander across chunk
  // boundaries don't blink out when their *spawn* chunk unloads, and NPCs in
  // a still-loaded chunk don't linger after they've drifted out of view.
  unloadChunk(_chunkKey) {
    // intentionally empty
  }

  // Despawn NPCs farther than DESPAWN_RADIUS from Zerble. Skips riders and
  // boarders so passengers can't get yanked off the cart. Called from update().
  _despawnDistant(zerble) {
    const zx = zerble.position.x;
    const zz = zerble.position.z;
    const kept = [];
    const zero = this._zeroMat || (this._zeroMat = new THREE.Matrix4().makeScale(0, 0, 0));
    let freed = 0;
    for (const npc of this.npcs) {
      if (npc.state === 'riding' || npc.state === 'boarding') {
        kept.push(npc);
        continue;
      }
      const dx = npc.pos.x - zx;
      const dz = npc.pos.z - zz;
      if (dx * dx + dz * dz > DESPAWN_R2) {
        if (npc.seatSlot) {
          npc.seatSlot.occupied = false;
          npc.seatSlot = null;
        }
        // Release any hammock claim so it can be re-used.
        if (npc.hammockEntry && npc.hammockEntry.hammock) {
          npc.hammockEntry.hammock.occupied = false;
          npc.hammockEntry = null;
        }
        // Release any porta-potty claim (don't leave a unit stuck "occupied").
        if (npc.pottyEntry) { this._releasePotty(npc); }
        // Release any picnic-table seat claim (don't strand a seat "occupied").
        if (npc.tableSeat) { this._releaseTable(npc); }
        // Remove from any group it belonged to so dead idx's don't leak.
        if (npc.groupId) {
          const g = this.groups.get(npc.groupId);
          if (g) {
            const i = g.members.indexOf(npc.idx);
            if (i >= 0) g.members.splice(i, 1);
            if (g.members.length === 0) this.groups.delete(npc.groupId);
          }
        }
        this.legsMesh.setMatrixAt(npc.idx, zero);
        this.shoesMesh.setMatrixAt(npc.idx, zero);
        this.bodyMesh.setMatrixAt(npc.idx, zero);
        this.armsMesh.setMatrixAt(npc.idx, zero);
        this.headMesh.setMatrixAt(npc.idx, zero);
        this.eyesMesh.setMatrixAt(npc.idx, zero);
        this.mouthMesh.setMatrixAt(npc.idx, zero);
        if (npc.isPhotographer) {
          this.cameraMesh.setMatrixAt(npc.photoSlot, zero);
          this.flashMesh.setMatrixAt(npc.photoSlot, zero);
          this._photoFree.push(npc.photoSlot);
          this._photographerCount--;
        }
        this.free.push(npc.idx);
        freed++;
      } else {
        kept.push(npc);
      }
    }
    if (freed > 0) {
      this.npcs = kept;
      let photoHigh = -1;
      for (const npc of kept) {
        if (npc.isPhotographer && npc.photoSlot > photoHigh) photoHigh = npc.photoSlot;
      }
      this._photoDrawCount = photoHigh + 1;
      this.legsMesh.instanceMatrix.needsUpdate = true;
      this.shoesMesh.instanceMatrix.needsUpdate = true;
      this.bodyMesh.instanceMatrix.needsUpdate = true;
      this.armsMesh.instanceMatrix.needsUpdate = true;
      this.headMesh.instanceMatrix.needsUpdate = true;
      this.eyesMesh.instanceMatrix.needsUpdate = true;
      this.mouthMesh.instanceMatrix.needsUpdate = true;
      this.cameraMesh.instanceMatrix.needsUpdate = true;
      this.flashMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // -------------- per-frame --------------

  update(dt, zerble, bubbles) {
    if (this._perf.on) this._perf.frames++;
    // First sweep: free any NPC who has drifted too far from Zerble. Lifecycle
    // is intentionally distance-based (not chunk-based) so wandering NPCs
    // don't vanish when their spawn chunk unloads.
    this._despawnDistant(zerble);

    const cosCone = Math.cos((SMILE_CONE_DEG * Math.PI) / 180);

    // Collect live bubble positions once per frame
    const bubblePositions = [];
    if (bubbles) bubbles.forEachAlive((b) => bubblePositions.push(b.pos));

    // Passenger bookkeeping: count active passengers + record Zerble idle state
    const zerbleIdle = Math.abs(zerble.speed) < ZERBLE_IDLE_SPEED;
    let activePassengers = 0;
    for (const n of this.npcs) {
      if (n.state === 'boarding' || n.state === 'riding') activePassengers++;
    }

    // Rebuild the separation broadphase from this frame's positions (riding
    // NPCs excluded — the separation pass skips them anyway). One O(n) pass
    // that turns each NPC's O(n) neighbour scan into a ~9-cell query.
    this._sepGrid.clear();
    for (const n of this.npcs) {
      if (n.state !== 'riding') this._sepGrid.insert(n.pos.x, n.pos.z, n);
    }

    // D3 (perf-pass-4): one reusable ctx + passenger ref per frame instead of a
    // fresh closure literal per NPC (~330 short-lived objects/frame → GC churn).
    // `count` is re-snapshotted before each NPC so the boarding gate still reads
    // the live active-passenger total at that NPC's turn (crowd.js boarding
    // check); `add()` still mutates the shared frame counter. Semantically
    // identical to the old per-NPC `{ count, add }`, minus the allocations.
    const passengerRef = { count: activePassengers, add: () => { activePassengers++; } };
    const npcCtx = { zerbleIdle, activePassengersRef: passengerRef };
    for (const npc of this.npcs) {
      passengerRef.count = activePassengers;
      this._updateNpc(dt, npc, zerble, bubblePositions, cosCone, npcCtx);
    }

    this.legsMesh.instanceMatrix.needsUpdate = true;
    this.shoesMesh.instanceMatrix.needsUpdate = true;
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.armsMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.eyesMesh.instanceMatrix.needsUpdate = true;
    this.mouthMesh.instanceMatrix.needsUpdate = true;
    if (this._photographerCount > 0) {
      this.cameraMesh.instanceMatrix.needsUpdate = true;
      this.flashMesh.instanceMatrix.needsUpdate = true;
    }
    // Narrow draw count to the highest slot ever written + 1. Slots above
    // _maxIdx are untouched (zero matrix from init) and never drawn. Slots
    // below that mark that have been despawned are still in range but carry a
    // zero-scale matrix so the GPU skips them at near-zero cost.
    const drawCount = this._maxIdx + 1;
    if (drawCount < MAX_NPCS) {
      this.legsMesh.count = drawCount;
      this.shoesMesh.count = drawCount;
      this.bodyMesh.count = drawCount;
      this.armsMesh.count = drawCount;
      this.headMesh.count = drawCount;
      this.eyesMesh.count = drawCount;
      this.mouthMesh.count = drawCount;
    }
    this.cameraMesh.count = this._photoDrawCount;
    this.flashMesh.count = this._photoDrawCount;
  }

  _updateNpc(dt, npc, zerble, bubblePositions, cosCone, ctx) {
    if (npc.smileTimeCooldown > 0) npc.smileTimeCooldown -= dt;
    if (!isPhotographerState(npc.state)) npc.stateTimer -= dt;
    if (!isPhotographerState(npc.state) && npc.photoFlashTimer > 0) {
      npc.photoFlashTimer = Math.max(0, npc.photoFlashTimer - dt);
    }
    npc.bob += dt * (1 + 0.4 * npc.dance);
    if (npc.rideTimer != null) npc.rideTimer -= dt;

    // Dancefloor detection — NPC is in the front zone of a stage's audience
    // if they're within ~9m of any `stage_front` attractor. While there, the
    // `_writeMatrices` path layers a much bigger bounce + body sway on top
    // of the regular animation, giving the impression of a dance crowd.
    // Cheap O(stages) check per NPC per frame; with ≤4 stages in load
    // distance it's negligible.
    if (registry.byKind.has('stage_front')) {
      let nearest = Infinity;
      for (const id of registry.byKind.get('stage_front')) {
        const e = registry.entries.get(id);
        if (!e) continue;
        const fx = npc.pos.x - e.position.x;
        const fz = npc.pos.z - e.position.z;
        const fd = Math.hypot(fx, fz);
        if (fd < nearest) nearest = fd;
      }
      // 9m radius approximates the area between the deck and the chair band
      // (`9 * scale` dancefloor depth from chunks.js buildStage). NPCs that
      // wander past the chair clumps stop dancing.
      npc.onDancefloor = nearest < 9;
    } else {
      npc.onDancefloor = false;
    }

    const dx = zerble.position.x - npc.pos.x;
    const dz = zerble.position.z - npc.pos.z;
    const dToZerble = Math.hypot(dx, dz);

    // Photographer reactions use an isolated state machine and RNG stream.
    // Active shots take ownership of the pose for about 1.5 seconds, then hand
    // the NPC back to the existing watching state. Honks/collisions can still
    // replace the state with fleeing through the normal public reaction paths.
    if (isPhotographerState(npc.state)) {
      advancePhotographerShot(npc, dt);
      const photoYaw = Math.atan2(-dx, -dz);
      npc.yaw += wrapAngle(photoYaw - npc.yaw) * Math.min(1, dt * 7);
      this._writeMatrices(npc);
      return;
    }
    if (tickPhotographerOpportunity(
      npc, dt, dToZerble, PHOTOGRAPHER_ELIGIBLE.has(npc.state)
    )) {
      const photoYaw = Math.atan2(-dx, -dz);
      npc.yaw += wrapAngle(photoYaw - npc.yaw) * Math.min(1, dt * 7);
      this._writeMatrices(npc);
      return;
    }

    // --- Passenger states get their OWN handling (skip the proximity switch below) ---
    if (npc.state === 'riding') {
      this._tickRiding(dt, npc, zerble);
      return;
    }
    if (npc.state === 'boarding') {
      this._tickBoarding(dt, npc, zerble, ctx);
      return;
    }
    if (npc.state === 'hammock_riding') {
      this._tickHammockRiding(dt, npc);
      return;
    }
    if (npc.state === 'walking_to_hammock') {
      // If Zerble shows up nearby and the NPC is curious, abort the hammock plan.
      if (dToZerble < SMILE_RANGE && npc.curiosity > 0.65) {
        this._releaseHammock(npc);
        npc.state = 'approaching';
      } else if (this._tickWalkingToHammock(dt, npc)) {
        return;
      }
    }
    // --- Picnic-table seating (like the hammock: walk to a claimed seat, sit) ---
    if (npc.state === 'table_seated') {
      this._tickTableSeated(dt, npc);
      return;
    }
    if (npc.state === 'walking_to_table') {
      // If Zerble shows up nearby and the NPC is curious, abandon the seat.
      if (dToZerble < SMILE_RANGE && npc.curiosity > 0.65) {
        this._releaseTable(npc);
        npc.state = 'approaching';
      } else if (this._tickWalkingToTable(dt, npc)) {
        return;
      }
    }
    if (npc.state === 'disembarking') {
      this._tickDisembarking(dt, npc);
      // fall through to normal walking logic
    }

    // --- Porta-potty states get their own handling (like riding/hammock) ---
    if (npc.state === 'seeking_potty')  { this._tickSeekingPotty(dt, npc); return; }
    if (npc.state === 'entering_potty') { this._tickEnteringPotty(dt, npc); return; }
    if (npc.state === 'using_potty')    { this._tickUsingPotty(dt, npc); return; }
    if (npc.state === 'exiting_potty')  { this._tickExitingPotty(dt, npc); return; }
    if (npc.state === 'surprised_potty'){ this._tickSurprisedPotty(dt, npc); return; }

    // --- Cheering: NPC is reacting to a song end ---
    // Holds pose + facing for cheerTimer seconds; skips all other state logic.
    if (npc.cheerTimer > 0) {
      npc.cheerTimer -= dt;
      // Face the stage position that triggered the cheer (reuse watching math).
      const cdx = npc.cheerX - npc.pos.x;
      const cdz = npc.cheerZ - npc.pos.z;
      const ctarget = Math.atan2(-cdx, -cdz);
      npc.yaw += wrapAngle(ctarget - npc.yaw) * Math.min(1, dt * 4);
      this._writeMatrices(npc);
      return;
    }

    // --- Unhappy: a frown is active (dry-cart disappointment). Turn the back
    // to Zerble and walk off, no vibing, and don't re-engage the proximity
    // machine — they're done with this bubble-less cart for now. ---
    if (npc.frownTimer > 0) {
      npc.frownTimer -= dt;
      const awx = npc.pos.x - zerble.position.x;
      const awz = npc.pos.z - zerble.position.z;
      const al = Math.hypot(awx, awz) || 1;
      const sp = 1.9 * npc.energy;
      npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, (awx / al) * sp, Math.min(1, dt * 4));
      npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, (awz / al) * sp, Math.min(1, dt * 4));
      npc.pos.x += npc.vel.x * dt;
      npc.pos.z += npc.vel.z * dt;
      const yawAway = Math.atan2(-npc.vel.x, -npc.vel.z);   // face the way they're walking (away)
      npc.yaw += wrapAngle(yawAway - npc.yaw) * Math.min(1, dt * 5);
      npc.state = 'walking';
      this._writeMatrices(npc);
      return;
    }

    // --- state transitions driven by Zerble proximity ---
    // Honk-scatter and panic-cascade put the NPC into 'fleeing' with a
    // stateTimer ticking down. While that timer is positive we LOCK the
    // fleeing state — without this, the proximity reassignment below
    // would stomp the NPC back to 'watching' / 'approaching' on the very
    // next frame (since they're still within NOTICE_RANGE of Zerble),
    // and the honk would have no visible effect.
    const fleeingLocked = npc.state === 'fleeing' && npc.stateTimer > 0;
    // Disinterest cooldown — after an NPC has watched Zerble long enough
    // (see 'watching' case below), they walk away with a few seconds of
    // immunity from the proximity machine re-engaging them. Lets you
    // actually leave a crowd behind instead of being permanently mobbed.
    const nowSec = performance.now() * 0.001;
    const disinterested = npc.disinterestedUntil > nowSec;

    // --- Trajectory dodge (highest priority): get out of an approaching cart's
    // lane. Personality-independent and overrides disinterest — physical
    // safety beats "I'm bored of this cart" — but still suppressed by star
    // power (everyone's smitten) and skipped while already flee-locked. Judged
    // against the actual TRAVEL direction (forward * sign(speed)) so reversing
    // doesn't scatter people in front of the cart.
    // dx/dz point NPC->Zerble, so (-dx,-dz) is the cart->NPC vector the
    // shared corridor test wants. Suppressed under star power / while locked.
    const dodging = !fleeingLocked && !this.starActive &&
      laneDodgeTest(-dx, -dz, zerble.forwardWorld.x, zerble.forwardWorld.z, zerble.speed);

    if (dodging) {
      this._abandonSeat(npc);            // interrupting a walk-to-table/hammock? free the claim
      npc.state = 'fleeing';
      npc.fleeUrgency = 1;               // passive lane-dodge is calm; a honk raises this (applyHonk)
      npc.stateTimer = DODGE.LOCK;       // brief commit, then re-evaluate (re-dodges if still in the lane)
    } else if (!fleeingLocked && !disinterested) {
      if (dToZerble < NOTICE_RANGE) {
        // Star power suppresses fleeing — everyone's smitten, so a skittish
        // NPC stops and stares (falls through to watching/approaching) instead
        // of bolting. applyStarLove can't rescue an NPC already in 'fleeing'
        // (it's in STAR_LOVE_SKIP), so the gate has to be here at the trigger.
        if (!this.starActive && npc.skittish > 0.55 && dToZerble < SMILE_RANGE * 0.6) {
          npc.state = 'fleeing';
        } else if (npc.curiosity > 0.65 && dToZerble < NOTICE_RANGE && dToZerble > 4) {
          npc.state = 'approaching';
        } else {
          npc.state = 'watching';
        }

        // Boarding trigger: idle Zerble + curious NPC + open seat + under passenger
        // cap. Nobody climbs aboard a bubble-less cart — the party's no fun dry.
        if (
          !this.bubblesEmpty &&
          ctx.zerbleIdle &&
          npc.curiosity > 0.45 &&
          ctx.activePassengersRef.count < MAX_PASSENGERS &&
          dToZerble < 12 &&
          Math.random() < PASSENGER_BOARD_CHANCE_PER_SEC * dt
        ) {
          const slot = this._claimFreeSeat(zerble);
          if (slot) {
            npc.state = 'boarding';
            npc.seatSlot = slot;
            npc.stateTimer = 20; // give up trying after 20s if we can't reach
            ctx.activePassengersRef.add();
            return;
          }
        }
      } else if (npc.state !== 'idle' && npc.state !== 'walking' && npc.state !== 'disembarking') {
        // Lost interest — go back to ambient behavior
        npc.state = 'idle';
        npc.stateTimer = 1 + Math.random() * 3;
      }
    }

    // --- choose movement target based on state ---
    let speed = 0;
    let desiredX = npc.pos.x;
    let desiredZ = npc.pos.z;

    switch (npc.state) {
      case 'idle': {
        // Occasionally try to claim a nearby unoccupied hammock. Tired/sociable
        // NPCs are slightly more likely to nap; skittish ones almost never.
        // (Bumped from 0.05 to 0.4 — at the old rate Gary never saw anyone in
        // a hammock across a full play session.)
        if (
          npc.skittish < 0.5 &&
          npc.stateTimer < 5 &&
          Math.random() < dt * 0.4
        ) {
          const claimed = this._tryClaimHammock(npc);
          if (claimed) break;
        }
        // Sometimes peel off to sit at a nearby picnic table — the food-court
        // "people eating at the picnic area" read. Sociable, non-skittish folks are
        // likelier; gated so it's a steady trickle filling benches, not the whole
        // crowd rushing the tables at once. (The deeper food-truck → buy → carry →
        // eat loop is on ROADMAP; this is the sit half.)
        if (
          !npc.tableSeat &&
          npc.skittish < 0.6 &&
          npc.stateTimer < 5 &&
          Math.random() < dt * 0.5
        ) {
          if (this._tryClaimTable(npc)) break;
        }
        // Rare bathroom urge — peel off toward the nearest porta-potty. Gated
        // low (POTTY_URGE_RATE) so it's an occasional realistic detour. Skittish
        // folks (who'd rather not) almost never go.
        if (
          !npc.pottyEntry &&
          npc.skittish < 0.75 &&
          Math.random() < dt * POTTY_URGE_RATE
        ) {
          const e = this._findNearestPotty(npc, null);
          if (e) {
            npc.pottyEntry = e;
            npc.pottyTried = [e.id];
            npc.pottyWait = 0;
            npc.state = 'seeking_potty';
            npc.stateTimer = 30;   // overall give-up timer
            break;
          }
        }
        if (npc.stateTimer <= 0) {
          // Pick a new wander target: prefer an attractor, else random nearby spot.
          // Target a RING around the attractor (40-100% of its radius) so crowds
          // distribute around the POI instead of all piling on the same center spot.
          const at = registry.pickAttractor(Math.random);
          if (at && Math.hypot(at.position.x - npc.pos.x, at.position.z - npc.pos.z) < 60) {
            const ang = Math.random() * Math.PI * 2;
            const rad = (0.4 + Math.random() * 0.6) * at.radius;
            npc.target.set(
              at.position.x + Math.cos(ang) * rad,
              0,
              at.position.z + Math.sin(ang) * rad,
            );
          } else {
            npc.target.set(
              npc.pos.x + (Math.random() - 0.5) * 18,
              0,
              npc.pos.z + (Math.random() - 0.5) * 18
            );
          }
          npc.state = 'walking';
          npc.stateTimer = 10 + Math.random() * 12;
        }
        // Tiny in-place sway driven by music dance
        npc.yaw += Math.sin(npc.bob * 0.5) * 0.01 * npc.dance;
        break;
      }

      case 'walking': {
        const tdx = npc.target.x - npc.pos.x;
        const tdz = npc.target.z - npc.pos.z;
        const td = Math.hypot(tdx, tdz);
        if (td < ARRIVE_RADIUS || npc.stateTimer <= 0) {
          npc.state = 'idle';
          npc.stateTimer = 2 + Math.random() * 6;
        } else {
          desiredX = tdx / td;
          desiredZ = tdz / td;
          speed = 1.4 * npc.energy;
        }
        break;
      }

      case 'watching': {
        // Face Zerble; tiny dance bob if music-y. NPCs in 'watching' used
        // to stand totally still — zombie-like at a glance. Now they:
        //   1. Mill around with small random shuffles (~2-4s between picks)
        //   2. Track how long they've been watching, and once
        //      attentionSpan elapses, walk away with a brief disinterest
        //      cooldown so they don't immediately get re-engaged.
        const target = Math.atan2(-dx, -dz);
        const diff = wrapAngle(target - npc.yaw);
        // Looser yaw lerp + small per-NPC drift so heads aren't all
        // tracking in perfect sync.
        npc.yaw += diff * Math.min(1, dt * 4);

        // Track time spent watching; personality decides patience.
        if (npc.watchTimer === undefined) {
          npc.watchTimer = 0;
          // Attention span: more curious folks watch longer; tired ones
          // get bored faster. Range roughly 4-14 seconds.
          npc.attentionSpan = 4 + npc.curiosity * 10 - (1 - npc.energy) * 2;
        }
        npc.watchTimer += dt;

        // Mill around — pick a new shuffle target every 2-4s. Targets are
        // 0.5-1.5m offsets from current pos that bias slightly perpendicular
        // to the Zerble-facing direction (so they shift side-to-side
        // rather than walk into the cart).
        if (npc.shuffleTimer === undefined || npc.shuffleTimer <= 0) {
          const sideAng = Math.atan2(-dx, -dz) + Math.PI / 2 + (Math.random() - 0.5) * 1.2;
          const r = 0.5 + Math.random() * 1.0;
          npc.shuffleTarget = npc.shuffleTarget || new THREE.Vector3();
          npc.shuffleTarget.set(
            npc.pos.x + Math.cos(sideAng) * r,
            0,
            npc.pos.z + Math.sin(sideAng) * r,
          );
          npc.shuffleTimer = 2 + Math.random() * 2;
        }
        npc.shuffleTimer -= dt;
        const sdx = npc.shuffleTarget.x - npc.pos.x;
        const sdz = npc.shuffleTarget.z - npc.pos.z;
        const sd = Math.hypot(sdx, sdz);
        if (sd > 0.05) {
          desiredX = sdx / sd;
          desiredZ = sdz / sd;
          // Very slow shuffle — half the walking speed
          speed = 0.7 * npc.energy;
        }

        // Lost interest → walk away with cooldown. Curious NPCs sometimes
        // upgrade to 'approaching' instead of giving up cold.
        if (npc.watchTimer > npc.attentionSpan) {
          npc.watchTimer = undefined;
          npc.attentionSpan = undefined;
          npc.shuffleTimer = undefined;
          // Pick a wander target away from Zerble (3-7m radial)
          const awayAng = Math.atan2(-dx, -dz) + (Math.random() - 0.5) * 0.8;
          const awayR = 6 + Math.random() * 4;
          npc.target.set(
            npc.pos.x - Math.cos(awayAng) * awayR,
            0,
            npc.pos.z - Math.sin(awayAng) * awayR,
          );
          npc.state = 'walking';
          npc.stateTimer = 6 + Math.random() * 4;
          // Disinterest cooldown — won't re-engage with Zerble for ~6-10s
          npc.disinterestedUntil = nowSec + 6 + Math.random() * 4;
        }
        break;
      }

      case 'approaching': {
        // Walk toward Zerble, but stop ~5m away
        if (dToZerble > 5.5) {
          const inv = 1 / (dToZerble || 1);
          desiredX = dx * inv;
          desiredZ = dz * inv;
          speed = 1.7 * npc.energy;
        } else {
          npc.state = 'watching';
        }
        const target = Math.atan2(-dx, -dz);
        const diff = wrapAngle(target - npc.yaw);
        npc.yaw += diff * Math.min(1, dt * 6);
        break;
      }

      case 'fleeing': {
        // Step LATERALLY out of Zerble's lane — to whichever side of his
        // heading the NPC is already on — instead of running radially away.
        // A fast cart just plows through someone fleeing straight ahead of
        // it; a sideways dodge clears the lane with the least travel and
        // reads like a real "get out of the way" reaction.
        // Shared lane-perpendicular direction (toward the NPC's own side).
        const fwd = zerble.forwardWorld;
        laneDodgeDir(-dx, -dz, fwd.x, fwd.z, (npc.idx & 1) === 1, _dodgeOut);
        // Small per-frame wobble so the dodge curves a touch instead of being
        // a clean rail. No stable per-NPC jitter here — a fixed offset could
        // rotate some NPCs back toward the lane we're trying to clear.
        const wobble = Math.sin(performance.now() * 0.004 + npc.idx) * 0.12;
        const cosW = Math.cos(wobble);
        const sinW = Math.sin(wobble);
        desiredX = _dodgeOut.x * cosW - _dodgeOut.z * sinW;
        desiredZ = _dodgeOut.x * sinW + _dodgeOut.z * cosW;
        // Per-NPC speed variation (±15%) so even same-side neighbors don't
        // move in lockstep.
        const speedJitter = 0.85 + (npc.idx % 7) * 0.05;  // 0.85..1.15
        // fleeUrgency scales the scramble: 1 for a passive lane-dodge, up to
        // ~2 when a honk lands at speed (set in applyHonk). Default-safe.
        speed = 3.5 * npc.energy * speedJitter * (npc.fleeUrgency || 1);
        npc.yaw = Math.atan2(-desiredX, -desiredZ);
        if (dToZerble > NOTICE_RANGE + 4) {
          npc.state = 'idle';
          npc.stateTimer = 2;
          npc.fleeUrgency = 1;     // reset so the next flee starts polite
        }
        break;
      }
    }

    // --- NPC-NPC separation (always active — prevents the cluster-stack bug) ---
    let sepX = 0, sepZ = 0, sepCount = 0;
    let overlapPushX = 0, overlapPushZ = 0;
    // Broadphase: only the ~9 cells around this NPC (grid built from this
    // frame's positions at the top of update()). Same math, pruned candidates.
    const _tSep = this._perf.on ? performance.now() : 0;
    this._sepGrid.forEachNear(npc.pos.x, npc.pos.z, SEPARATION_RADIUS, (other) => {
      if (other === npc || other.state === 'riding') return;
      const ox = npc.pos.x - other.pos.x;
      const oz = npc.pos.z - other.pos.z;
      const d2 = ox * ox + oz * oz;
      if (d2 > 0 && d2 < SEPARATION_RADIUS * SEPARATION_RADIUS) {
        const d = Math.sqrt(d2);
        const inv = 1 / d;
        const force = (SEPARATION_RADIUS - d) / SEPARATION_RADIUS;
        sepX += ox * inv * force;
        sepZ += oz * inv * force;
        sepCount++;
        // Hard floor: directly resolve overlap if very close
        if (d < HARD_SEPARATION) {
          const push = (HARD_SEPARATION - d) * 0.5;
          overlapPushX += ox * inv * push;
          overlapPushZ += oz * inv * push;
        }
      }
    });
    if (this._perf.on) this._perf.sepMs += performance.now() - _tSep;
    // Apply hard-overlap push instantly (so NPCs never visually stack)
    npc.pos.x += overlapPushX;
    npc.pos.z += overlapPushZ;

    // --- steering modifiers ---
    if (speed > 0) {
      // Path attraction (LEGACY ONLY): nudge toward the nearest +-grid line so people
      // tend to use the dirt paths. In v2 the roads are worldgen arterials that are NOT
      // grid-aligned, so this would march everyone toward phantom grid lines that have no
      // road (the R13 trap). v2 instead seeds `path_node` attractors ALONG each road
      // (chunks.js placeWorldgenRoads), so the crowd clusters along roads through the
      // normal attractor system — no per-NPC `nearestRoad` (215us/call → unviable per-frame).
      if (!USE_WORLDGEN_V2) {
        const px = Math.round(npc.pos.x / PATH_GRID) * PATH_GRID;
        const pz = Math.round(npc.pos.z / PATH_GRID) * PATH_GRID;
        const offX = px - npc.pos.x;
        const offZ = pz - npc.pos.z;
        const closestPathOffset = Math.abs(offX) < Math.abs(offZ)
          ? { x: offX, z: 0 }
          : { x: 0, z: offZ };
        const pathDist = Math.hypot(closestPathOffset.x, closestPathOffset.z);
        if (pathDist > PATH_PULL_WIDTH) {
          const pull = THREE.MathUtils.clamp((pathDist - PATH_PULL_WIDTH) / 20, 0, 0.4);
          const pn = pathDist || 1;
          desiredX += (closestPathOffset.x / pn) * pull;
          desiredZ += (closestPathOffset.z / pn) * pull;
        }
      }

      // Building avoidance
      const _tAvoid = this._perf.on ? performance.now() : 0;
      const avoid = nearestFootprintAvoidance(npc.pos, BUILDING_AVOID_RADIUS);
      if (this._perf.on) this._perf.avoidMs += performance.now() - _tAvoid;
      if (avoid) {
        desiredX += avoid.x * avoid.strength;
        desiredZ += avoid.z * avoid.strength;
      }

      // Soft separation contributes to the heading
      if (sepCount > 0) {
        desiredX += sepX * 1.2;
        desiredZ += sepZ * 1.2;
      }

      const dn = Math.hypot(desiredX, desiredZ) || 1;
      desiredX /= dn;
      desiredZ /= dn;

      npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, desiredX * speed, Math.min(1, dt * 4));
      npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, desiredZ * speed, Math.min(1, dt * 4));
    } else {
      // Even when idle, drift apart slowly if neighbors are crowding in
      if (sepCount > 0) {
        npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, sepX * 0.6, Math.min(1, dt * 3));
        npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, sepZ * 0.6, Math.min(1, dt * 3));
      } else {
        npc.vel.multiplyScalar(Math.pow(0.5, dt * 6));
      }
    }

    // Apply velocity
    npc.pos.x += npc.vel.x * dt;
    npc.pos.z += npc.vel.z * dt;

    // Face direction of motion when walking/fleeing/approaching
    if (Math.abs(npc.vel.x) + Math.abs(npc.vel.z) > 0.4 && npc.state !== 'watching') {
      const targetYaw = Math.atan2(-npc.vel.x, -npc.vel.z);
      const diff = wrapAngle(targetYaw - npc.yaw);
      npc.yaw += diff * Math.min(1, dt * 6);
    }

    // --- charm logic --- (frownTimer is ticked + handled in the unhappy block above)
    if (
      npc.smileTimeCooldown <= 0 &&
      (npc.lastSmilePos === null || zerble.position.distanceTo(npc.lastSmilePos) > SMILE_RESET_DIST) &&
      dToZerble < SMILE_RANGE
    ) {
      const fwd = zerble.forwardWorld;
      const ndx = npc.pos.x - zerble.position.x;
      const ndz = npc.pos.z - zerble.position.z;
      const ndlen = Math.hypot(ndx, ndz) || 1;
      const dot = (ndx / ndlen) * fwd.x + (ndz / ndlen) * fwd.z;
      const inView = dot > cosCone && npc.state !== 'fleeing';
      const closeness = 1 - dToZerble / SMILE_RANGE;
      const aim = inView ? (dot - cosCone) / (1 - cosCone) : 0;

      if (this.bubblesEmpty) {
        // Dry cart → disappointment. Eye contact builds displeasure; at
        // threshold the NPC frowns and a smile is lost (onFrown). Slower to
        // build than a smile so it's a real "uh oh, I'm out" beat, not instant.
        // NOTE the frown's job is mode-dependent at the onFrown dispatch below:
        // Just Cruisin' keeps the dry-tank smile tax; Festival Run turns it
        // into vibe-meter feedback (strike in main.js's handler, tax suppressed
        // while sputtering), and frownRateMult ramps the build rate by day.
        npc.happiness = Math.max(0, npc.happiness - dt * 0.5);
        if (inView) npc.displeasure += 1.4 * this.frownRateMult * closeness * (0.55 + 0.45 * aim) * dt;
        else npc.displeasure = Math.max(0, npc.displeasure - dt * 0.25);
        if (npc.displeasure >= FROWN_THRESHOLD) {
          npc.displeasure = 0;
          npc.frownTimer = FROWN_DURATION;
          npc.smileTimeCooldown = 0;            // clear any leftover happy bounce/smile — they're not happy
          npc.lastSmilePos = zerble.position.clone();
          this.smiles.spawnLost(zerble.position, npc);   // reddish "lost smile" flies out to them
          if (this.onFrown) this.onFrown(npc);
        }
      } else {
        npc.displeasure = Math.max(0, npc.displeasure - dt * 0.6);
        let gain = 0;
        if (inView) gain += 1.4 * closeness * (0.4 + 0.6 * aim);
        for (const bp of bubblePositions) {
          const bd = Math.hypot(bp.x - npc.pos.x, bp.z - npc.pos.z);
          if (bd < BUBBLE_RANGE) {
            gain += 1.0 * (1 - bd / BUBBLE_RANGE);
            break;
          }
        }
        // Curious & approaching NPCs charm faster (they're really looking)
        if (npc.state === 'approaching' || npc.state === 'watching') gain *= 1.2;
        // Fleeing NPCs don't smile
        if (npc.state === 'fleeing') gain = 0;

        if (gain > 0) npc.happiness += gain * dt;

        if (npc.happiness >= HAPPINESS_THRESHOLD) {
          npc.happiness = 0;
          npc.smileTimeCooldown = SMILE_TIME_COOLDOWN;
          npc.lastSmilePos = zerble.position.clone();
          this.smiles.spawn(npc.pos);
        }
      }
    } else {
      npc.happiness = Math.max(0, npc.happiness - dt * 0.2);
      npc.displeasure = Math.max(0, npc.displeasure - dt * 0.4);
    }

    // Write transform
    this._writeMatrices(npc);
  }

  _writeMatrices(npc) {
    const m = this._mat4;
    const photographing = isPhotographerState(npc.state);
    const photoPose = npc.state === PHOTO_STATE_POSE;
    let photoPoseAmount = 0;
    if (photoPose) {
      const poseIn = Math.min(1, Math.max(0, (PHOTO_POSE_DURATION - npc.stateTimer) * 5));
      const poseOut = Math.min(1, Math.max(0, npc.stateTimer * 5));
      photoPoseAmount = Math.min(poseIn, poseOut);
    }
    // Reuse scratch Quaternion/Euler — avoids ~30k allocations/sec at 500 NPCs × 60fps.
    // hammock_riding NPCs need a supine rotation (X=+π/2 face up, then Y=yaw); all
    // others just rotate around Y by yaw. Build the right quat per branch.
    // Dancefloor NPCs bounce harder + sway more, on a phase seeded by their
    // dance value so neighbors aren't in lockstep. Unique-feeling moves come
    // from a sum of sin terms at staggered frequencies — different `dance`
    // values produce visibly different rhythms within the crowd. Computed
    // BEFORE the quat composition so the yaw wiggle can layer onto npc.yaw.
    let bobY;
    let danceTilt;
    let danceYawWiggle = 0;
    if (npc.onDancefloor) {
      const t = npc.bob;
      // Vertical bounce: a dominant low-frequency hop + a slight off-beat
      // ripple. Scale 0.06-0.10m so it reads clearly without floating.
      bobY = (Math.sin(t * 1.8) * 0.07 + Math.sin(t * 3.7 + npc.dance * 6) * 0.025);
      // Hip sway around Z axis — 0.18 rad peak (~10°) per personality.
      danceTilt = Math.sin(t * 1.5 + npc.dance * 3) * 0.18;
      // Yaw shimmy — a slow back-and-forth that varies per NPC.
      danceYawWiggle = Math.sin(t * 0.9 + npc.dance * 5) * 0.20;
    } else {
      bobY = Math.sin(npc.bob) * 0.04;
      danceTilt = npc.dance > 0.6 && (npc.state === 'idle' || npc.state === 'watching' || npc.state === 'riding')
        ? Math.sin(npc.bob * 2) * 0.05 * (npc.dance - 0.5)
        : 0;
    }
    // Unhappy NPCs don't vibe — kill the bounce + sway while frowning.
    if (npc.frownTimer > 0 || photographing) { bobY = 0; danceTilt = 0; danceYawWiggle = 0; }

    let quat;
    if (npc.state === 'hammock_riding') {
      // Compose Y * X — applies X first (supine), then Y (align with hammock yaw)
      this._supineQuatY.setFromAxisAngle(this._axisY, npc.yaw + danceYawWiggle);
      quat = this._tmpQuat.multiplyQuaternions(this._supineQuatY, this._supineQuatX);
    } else {
      // Yaw + per-NPC dance shimmy. The Z-axis hip tilt (`danceTilt`) is
      // applied SEPARATELY below via `m.multiply(this._tmpDanceMat)` — don't
      // double up here by adding it to the Euler.
      quat = this._tmpQuat.setFromEuler(this._tmpEuler.set(0, npc.yaw + danceYawWiggle, 0));
    }

    // Happy bounce: while smile cooldown is active the body bobs up by a small
    // sin wave (~6cm amplitude) so the whole figure (body + mouth) hops.
    const bouncing = npc.smileTimeCooldown > 0 && !photographing;
    const bounceY = bouncing
      ? Math.abs(Math.sin(performance.now() * 0.012 + npc.bob)) * 0.06
      : 0;

    // Cheer jump: positive-half sine so NPCs hop upward without clipping the floor.
    // Seeded by npc.idx so the crowd doesn't hop in perfect lockstep.
    const cheering = npc.cheerTimer > 0;
    const cheerY = cheering
      ? Math.max(0, Math.sin(performance.now() * 0.001 * HOP_HZ + npc.idx * 1.3)) * HOP_HEIGHT
      : 0;

    // All 5 body meshes share one matrix. The matrix's Y = "feet level" for this NPC.
    // Each geometry has its part offset baked in (legs at y≈0.325, torso at y=1.0,
    // arms at y=1.10, head at y=1.65, shoes at y≈0.035). Scale is applied uniformly
    // via compose() so the whole figure scales together from the feet origin.
    //
    // Special states: riding/hammock npcs are lifted off the ground. We derive the
    // feet-equivalent Y from the seat/hammock world height so the torso (baked at +1.0)
    // lands at the right visual position.
    //   - riding:        torso should sit at ≈ seatY - 0.05  →  feet Y = seatY - 1.05
    //   - hammock_riding: torso should sit at ≈ hammockY - 0.1 →  feet Y = hammockY - 1.1
    //   - normal:        feet at ground (npc.pos.y = 0 always from behavior code)
    // Seated riders (bench / driver / roof) sit with their butt on the seat;
    // running-board riders stand. Computed here so it drives both the lift and
    // the leg bend below.
    const seated = (npc.state === 'riding' && npc.seatSlot &&
      (npc.seatSlot.kind === 'bench' || npc.seatSlot.kind === 'driver_seat' || npc.seatSlot.kind === 'roof'))
      || npc.pottySitting                  // caught sitting on the potty — same forward leg bend
      || npc.state === 'table_seated';     // sitting on a picnic bench — same forward leg bend
    let feetY;
    if (npc.pottySitting && npc.seatY != null) {
      // Butt on the toilet seat; bent legs hang forward. seatY is the seat-top
      // height; drop the feet ~0.62 so the hip (bend pivot) lands on the seat.
      // No cheer-hop — they're seated.
      feetY = npc.seatY - 0.62 + bobY;
    } else if (npc.state === 'riding' && npc.seatY != null) {
      // Seated: butt rests on top of the seat cushion (the torso bottom sits ≈
      // at the cushion surface so the seat doesn't cut through the belly); the
      // bent legs hang forward below. Standing running-board riders stay low.
      feetY = (seated ? npc.seatY - 0.4 : npc.seatY - 1.05) + bobY + bounceY;
    } else if (npc.state === 'hammock_riding' && npc.hammockY != null) {
      // Supine: body lies horizontal with back pressed into the cloth. After
      // X=π/2 the body's "up" direction (away from back) is +Y. The torso
      // capsule is ~0.26 thick, but we want the back to SINK into the sag
      // slightly — so lift by only 0.16, not the full half-thickness.
      feetY = npc.hammockY + 0.16 + bobY + bounceY;
    } else if (npc.state === 'table_seated' && npc.tableSeat) {
      // Butt on the bench cushion; bent legs hang forward (the `seated` leg bend).
      // Same -0.4 hip drop a seated cart rider uses so the hip lands on the seat.
      feetY = npc.tableSeat.y - 0.4 + bobY;
    } else {
      feetY = bobY + bounceY + cheerY; // feet on the ground; npc.pos.y is always 0
    }
    if (photoPose && npc.photoCrouch) feetY -= 0.24 * photoPoseAmount;

    // CRITICAL: position and scale must be DISTINCT Vector3 instances.
    // Reusing this._tmpV for both args caused position to be overwritten by scale,
    // making every non-riding NPC render at (scale, scale, scale) ≈ (1,1,1).
    const posV = this._tmpV;
    const scaleV = this._tmpV2;

    if (npc.state === 'hammock_riding') {
      // Supine body extends in (sin(yaw), 0, cos(yaw)) direction from the matrix
      // origin (which is at feet after rotation). Shift matrix back by 0.825 in
      // the head direction so the body CENTER lands at npc.pos (hammock seat
      // + sway). Otherwise the body anchors feet-at-seat and head 1.65m out.
      const hx = Math.sin(npc.yaw);
      const hz = Math.cos(npc.yaw);
      posV.set(npc.pos.x - hx * 0.825, feetY, npc.pos.z - hz * 0.825);
    } else {
      posV.set(npc.pos.x, feetY, npc.pos.z);
    }
    scaleV.set(npc.scale, npc.scale, npc.scale);
    m.compose(posV, quat, scaleV);
    if (danceTilt) {
      // Reuse scratch Matrix4 — avoids per-NPC allocation for dancing crowd.
      this._tmpDanceMat.makeRotationZ(danceTilt);
      m.multiply(this._tmpDanceMat);
    }

    // Write the same transform to legs/shoes/body/arms/head/eyes — per-part offsets live in geometry.
    // Eyes also use this matrix (eyes geometry has offsets baked in, no scale reaction).
    // Exception: seated riders (bench / driver / roof — see `seated` above) get
    // their legs+shoes bent forward at the hip so they sit; the upright
    // body/arms/head still use `m`. Standing running-board riders keep straight legs.
    // Cheering NPCs get arms rotated up via _armsUpMat (same pattern as _sitLegMat).
    if (photoPose && npc.photoCrouch) {
      this._legMat.multiplyMatrices(m, this._photoCrouchLegMat);
      this.legsMesh.setMatrixAt(npc.idx, this._legMat);
      this.shoesMesh.setMatrixAt(npc.idx, this._legMat);
    } else if (seated) {
      this._legMat.multiplyMatrices(m, this._sitLegMat);
      this.legsMesh.setMatrixAt(npc.idx, this._legMat);
      this.shoesMesh.setMatrixAt(npc.idx, this._legMat);
    } else {
      this.legsMesh.setMatrixAt(npc.idx, m);
      this.shoesMesh.setMatrixAt(npc.idx, m);
    }
    this.bodyMesh.setMatrixAt(npc.idx, m);
    if (photographing) {
      this._armsMat.multiplyMatrices(m, this._photoArmsMat);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    } else if (cheering) {
      this._armsMat.multiplyMatrices(m, this._armsUpMat);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    } else {
      this.armsMesh.setMatrixAt(npc.idx, m);
    }
    this.headMesh.setMatrixAt(npc.idx, m);
    this.eyesMesh.setMatrixAt(npc.idx, m);

    // ---- Mouth: child of the body matrix, with its own smile-pop scale ----
    // Mouth geometry is baked at origin. We build a local matrix that places it
    // at the face offset (NPC body frame) with the smile-pop scale, then
    // multiply it ONTO the body matrix `m`. Deriving from `m` means the smile
    // inherits everything the head/eyes do — bob, the dance hip-sway tilt
    // (danceTilt), yaw wiggle, NPC scale, and the riding/hammock seat lift — so
    // it stays glued to the face instead of floating beside a swaying head.
    // Frowning (dry-cart disappointment) flips the arc + shows it full-size;
    // otherwise it's a smile, big right after smiling and small at rest.
    const frowning = npc.frownTimer > 0;
    const mouthScale = (frowning || npc.smileTimeCooldown > 0) ? 1.0 : 0.3;
    this._tmpV3.set(0, 1.55, -0.215); // face-local offset, NPC body frame
    this._tmpScale.set(mouthScale, mouthScale, mouthScale);
    this._mouthLocalMat.compose(this._tmpV3, frowning ? this._frownQuat : this._identityQuat, this._tmpScale);
    this._mouthMat.multiplyMatrices(m, this._mouthLocalMat);
    this.mouthMesh.setMatrixAt(npc.idx, this._mouthMat);

    if (npc.isPhotographer) {
      // Camera geometry has its local chest/face offset baked in, so it follows
      // the same pooled body matrix through walking, crouching, and posing.
      this.cameraMesh.setMatrixAt(npc.photoSlot, m);
      if (npc.photoFlashTimer > 0) {
        const flashT = npc.photoFlashTimer / PHOTO_FLASH_DURATION;
        const flashScale = 0.72 + Math.sin(Math.min(1, flashT) * Math.PI) * 0.55;
        this._tmpV3.set(0, 1.20, -0.62);
        this._tmpScale.set(flashScale, flashScale, flashScale);
        this._flashLocalMat.compose(this._tmpV3, this._identityQuat, this._tmpScale);
        this._flashMat.multiplyMatrices(m, this._flashLocalMat);
        this.flashMesh.setMatrixAt(npc.photoSlot, this._flashMat);
      } else {
        this.flashMesh.setMatrixAt(npc.photoSlot, this._zeroMat);
      }
    }
  }

  // ----- Passenger system helpers -----

  _claimFreeSeat(zerble) {
    if (!zerble.seatSlots) return null;
    // Try slots in a randomized order so passengers don't all stack the same way
    const order = zerble.seatSlots.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const idx of order) {
      const slot = zerble.seatSlots[idx];
      if (!slot.occupied) {
        slot.occupied = true;
        return slot;
      }
    }
    return null;
  }

  _releaseSeat(slot) {
    if (slot) slot.occupied = false;
  }

  _tickBoarding(dt, npc, zerble, ctx) {
    if (!npc.seatSlot || !ctx.zerbleIdle) {
      // Cart started moving (or we lost our slot) — abort
      this._releaseSeat(npc.seatSlot);
      npc.seatSlot = null;
      npc.state = 'watching';
      npc.stateTimer = 1;
      return;
    }
    const target = this._tmpV;
    zerble.worldSeatPosition(npc.seatSlot, target);

    const tdx = target.x - npc.pos.x;
    const tdz = target.z - npc.pos.z;
    const td = Math.hypot(tdx, tdz);

    if (td < BOARD_RANGE) {
      // Climb aboard
      npc.state = 'riding';
      npc.rideTimer = RIDE_MIN_TIME + Math.random() * (RIDE_MAX_TIME - RIDE_MIN_TIME);
      this._writeMatrices(npc); // snap into place
      if (this.onBoard) this.onBoard(npc);
      return;
    }

    // Steer toward seat at jog speed
    const invD = 1 / (td || 1);
    const dx = tdx * invD;
    const dz = tdz * invD;
    const speed = 2.4 * npc.energy;
    npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, dx * speed, Math.min(1, dt * 6));
    npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, dz * speed, Math.min(1, dt * 6));
    npc.pos.x += npc.vel.x * dt;
    npc.pos.z += npc.vel.z * dt;

    // Face direction of motion
    const targetYaw = Math.atan2(-npc.vel.x, -npc.vel.z);
    const diff = wrapAngle(targetYaw - npc.yaw);
    npc.yaw += diff * Math.min(1, dt * 6);

    // Timeout — give up if we can't reach the seat
    if (npc.stateTimer <= 0) {
      this._releaseSeat(npc.seatSlot);
      npc.seatSlot = null;
      npc.state = 'idle';
      npc.stateTimer = 2;
    }

    this._writeMatrices(npc);
  }

  _tickRiding(dt, npc, zerble) {
    if (!npc.seatSlot) {
      npc.state = 'idle';
      npc.stateTimer = 1;
      return;
    }
    // Lock position to the seat. Face the same way the cart is facing.
    const out = this._tmpV;
    zerble.worldSeatPosition(npc.seatSlot, out);
    npc.pos.x = out.x;
    npc.pos.z = out.z;
    // Stash seat Y on the npc — we use it in _writeMatrices to lift the body.
    npc.seatY = out.y;

    // Yaw matches cart heading (passengers face forward like the cart) plus slot's offset
    npc.yaw = zerble.heading + npc.seatSlot.yaw;

    // Slight dance bob even while riding (extra dance-y characters wiggle a bit)
    npc.bob += dt * (1.2 + 0.6 * npc.dance);

    // Disembark when the ride times out (and Zerble's idle), OR immediately if
    // the bubble tank ran dry — riders bail on a bubble-less cart.
    if (this.bubblesEmpty || (npc.rideTimer <= 0 && Math.abs(zerble.speed) < ZERBLE_IDLE_SPEED)) {
      this._releaseSeat(npc.seatSlot);
      const seatPos = { x: out.x, z: out.z };
      npc.seatSlot = null;
      npc.seatY = undefined;
      npc.state = 'disembarking';
      // Pick a destination 3-6m away from where we got off
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 3;
      npc.target.set(seatPos.x + Math.cos(a) * r, 0, seatPos.z + Math.sin(a) * r);
      npc.stateTimer = 5;
    }

    this._writeMatrices(npc);
  }

  _tickDisembarking(dt, npc) {
    // Just lean toward the disembark target; the regular walking loop below handles motion.
    const tdx = npc.target.x - npc.pos.x;
    const tdz = npc.target.z - npc.pos.z;
    const td = Math.hypot(tdx, tdz);
    if (td < ARRIVE_RADIUS || npc.stateTimer <= 0) {
      npc.state = 'idle';
      npc.stateTimer = 1 + Math.random() * 2;
    }
  }

  // ----- Hammock riding -----

  _tryClaimHammock(npc) {
    // Find the nearest unoccupied hammock within 60m. (Was 30m — too tight for
    // sparse hammock spawn density; NPCs would idle near a chunk boundary and
    // never spot the hammock one chunk over.)
    const ids = registry.byKind.get('hammock');
    if (!ids) return false;
    let best = null;
    let bestD2 = 60 * 60;
    for (const id of ids) {
      const e = registry.entries.get(id);
      if (!e || !e.hammock || e.hammock.occupied) continue;
      const dx = e.position.x - npc.pos.x;
      const dz = e.position.z - npc.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    if (!best) return false;
    best.hammock.occupied = true;
    npc.hammockEntry = best;
    npc.target.copy(best.position);
    npc.state = 'walking_to_hammock';
    npc.stateTimer = 18;             // give up if can't reach in 18s
    return true;
  }

  _tickWalkingToHammock(dt, npc) {
    // Returns true if we handled the NPC fully this frame (skip rest of update).
    if (!npc.hammockEntry) {
      npc.state = 'idle';
      npc.stateTimer = 1;
      return true;
    }
    const target = npc.hammockEntry.hammock.seatPos;
    const tdx = target.x - npc.pos.x;
    const tdz = target.z - npc.pos.z;
    const td = Math.hypot(tdx, tdz);
    if (td < 0.7) {
      // Arrived — climb in
      npc.state = 'hammock_riding';
      npc.rideTimer = 12 + Math.random() * 18;  // 12-30s of swinging
      npc.hammockBob = 0;
      return true;
    }
    if (npc.stateTimer <= 0) {
      // Couldn't reach in time — release and go idle
      this._releaseHammock(npc);
      npc.state = 'idle';
      npc.stateTimer = 1;
      return true;
    }
    // Walk toward the hammock at jog speed
    const inv = 1 / (td || 1);
    npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, tdx * inv * 1.6 * npc.energy, Math.min(1, dt * 5));
    npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, tdz * inv * 1.6 * npc.energy, Math.min(1, dt * 5));
    npc.pos.x += npc.vel.x * dt;
    npc.pos.z += npc.vel.z * dt;
    // Face direction of motion
    const targetYaw = Math.atan2(-npc.vel.x, -npc.vel.z);
    const diff = wrapAngle(targetYaw - npc.yaw);
    npc.yaw += diff * Math.min(1, dt * 6);
    this._writeMatrices(npc);
    return true;
  }

  _tickHammockRiding(dt, npc) {
    if (!npc.hammockEntry) {
      npc.state = 'idle';
      npc.stateTimer = 1;
      return;
    }
    npc.rideTimer -= dt;
    npc.hammockBob += dt * 2.2;          // swing speed
    const h = npc.hammockEntry.hammock;
    const swingAmp = 0.18;
    // Sway PERPENDICULAR to the hammock's long axis (i.e. side-to-side, not
    // along its length) so it looks like the cloth is swinging.
    const perpX = -Math.sin(h.yaw);
    const perpZ = Math.cos(h.yaw);
    const sway = Math.sin(npc.hammockBob) * swingAmp;
    npc.pos.x = h.seatPos.x + perpX * sway;
    npc.pos.z = h.seatPos.z + perpZ * sway;
    npc.hammockY = h.seatPos.y + Math.sin(npc.hammockBob * 2) * 0.04;
    // Spine aligned with hammock long axis. Hammock poles are placed in
    // direction (cos(h.yaw), 0, sin(h.yaw)). _writeMatrices applies the supine
    // rotation: X=+π/2 (face up) then Y=npc.yaw. After both rotations the
    // body's head ends up in direction (sin(npc.yaw), 0, cos(npc.yaw)). For
    // that to equal (cos(h.yaw), 0, sin(h.yaw)) we need npc.yaw = π/2 − h.yaw.
    npc.yaw = Math.PI / 2 - h.yaw;
    npc.vel.set(0, 0, 0);

    if (npc.rideTimer <= 0) {
      this._releaseHammock(npc);
      npc.state = 'idle';
      npc.stateTimer = 1 + Math.random() * 2;
      // Step a bit out of the hammock so the next idle target makes sense
      npc.pos.x += (Math.random() - 0.5) * 0.8;
      npc.pos.z += (Math.random() - 0.5) * 0.8;
      npc.hammockY = undefined;
    }
    this._writeMatrices(npc);
  }

  _releaseHammock(npc) {
    if (npc.hammockEntry && npc.hammockEntry.hammock) {
      npc.hammockEntry.hammock.occupied = false;
    }
    npc.hammockEntry = null;
    npc.hammockY = undefined;
  }

  // ----- Picnic-table seating -----
  //
  // Flow (mirrors the hammock): idle urge → claim a free seat on the nearest table
  // → walking_to_table (jog to the seat) → table_seated (sit, facing the table, for
  // a spell) → release the seat → idle. The registry entry carries an ARRAY of
  // world-space seat slots (`tableSeats`, two per bench) each with its own
  // `occupied` flag, so up to four NPCs share one table. Every state has a give-up
  // timeout, and the seat is released on arrival-fail / despawn / chunk-unload so a
  // slot is never stranded "occupied".

  // The crowd's yaw convention is forward = (−sin yaw, −cos yaw); to face the table
  // CENTER from a seat, yaw = atan2(seat.x − center.x, seat.z − center.z).
  _seatFacingYaw(npc) {
    const c = npc.tableEntry.position, s = npc.tableSeat;
    return Math.atan2(s.x - c.x, s.z - c.z);
  }

  _tryClaimTable(npc) {
    const ids = registry.byKind.get('picnic_table');
    if (!ids) return false;
    // 45m — wide enough that the crowd ringing the food-court attractor can spot a
    // table across the plaza, but close enough that the walk actually completes
    // before the (distance-scaled) give-up timer below.
    let best = null, bestSeat = null, bestD2 = 45 * 45;
    for (const id of ids) {
      const e = registry.entries.get(id);
      if (!e || !e.tableSeats) continue;
      const dx = e.position.x - npc.pos.x;
      const dz = e.position.z - npc.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= bestD2) continue;
      const seat = e.tableSeats.find((s) => !s.occupied);
      if (!seat) continue;
      bestD2 = d2; best = e; bestSeat = seat;
    }
    if (!best) return false;
    bestSeat.occupied = true;
    npc.tableEntry = best;
    npc.tableSeat = bestSeat;
    npc.target.set(bestSeat.x, 0, bestSeat.z);
    npc.state = 'walking_to_table';
    // Give-up timer scaled to the walk (≈0.8 m/s effective at low energy) so a diner
    // committing to a seat across the plaza actually arrives instead of timing out
    // mid-walk and re-rolling. A flat 16s only covered ~16 m — far short of the 45 m
    // claim radius, so nobody ever sat.
    const d = Math.hypot(bestSeat.x - npc.pos.x, bestSeat.z - npc.pos.z);
    npc.stateTimer = Math.min(62, Math.max(14, d * 1.4 + 5));
    return true;
  }

  _tickWalkingToTable(dt, npc) {
    if (!npc.tableSeat) { npc.state = 'idle'; npc.stateTimer = 1; return true; }
    const seat = npc.tableSeat;
    const tdx = seat.x - npc.pos.x;
    const tdz = seat.z - npc.pos.z;
    const td = Math.hypot(tdx, tdz);
    if (td < 0.4) {
      // Arrived — sit: snap to the seat, face the table, start the dwell timer.
      npc.pos.x = seat.x;
      npc.pos.z = seat.z;
      npc.yaw = this._seatFacingYaw(npc);
      npc.vel.set(0, 0, 0);
      npc.state = 'table_seated';
      npc.rideTimer = 18 + Math.random() * 30;   // 18–48s of sitting/eating
      this._writeMatrices(npc);
      return true;
    }
    if (npc.stateTimer <= 0) {
      this._releaseTable(npc);
      npc.state = 'idle';
      npc.stateTimer = 1;
      return true;
    }
    const inv = 1 / (td || 1);
    npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, tdx * inv * 1.9 * npc.energy, Math.min(1, dt * 5));
    npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, tdz * inv * 1.9 * npc.energy, Math.min(1, dt * 5));
    npc.pos.x += npc.vel.x * dt;
    npc.pos.z += npc.vel.z * dt;
    const targetYaw = Math.atan2(-npc.vel.x, -npc.vel.z);
    npc.yaw += wrapAngle(targetYaw - npc.yaw) * Math.min(1, dt * 6);
    this._writeMatrices(npc);
    return true;
  }

  _tickTableSeated(dt, npc) {
    if (!npc.tableSeat) { npc.state = 'idle'; npc.stateTimer = 1; return; }
    npc.rideTimer -= dt;
    // Hold the seat, facing the table. The forward leg bend + butt-on-bench lift are
    // applied in _writeMatrices (the `seated` / table_seated branches).
    npc.pos.x = npc.tableSeat.x;
    npc.pos.z = npc.tableSeat.z;
    npc.yaw = this._seatFacingYaw(npc);
    npc.vel.set(0, 0, 0);
    if (npc.rideTimer <= 0) {
      this._releaseTable(npc);
      npc.state = 'idle';
      npc.stateTimer = 1 + Math.random() * 2;
      // Step off the bench so the next idle wander target makes sense.
      npc.pos.x += (Math.random() - 0.5) * 0.8;
      npc.pos.z += (Math.random() - 0.5) * 0.8;
    }
    this._writeMatrices(npc);
  }

  _releaseTable(npc) {
    if (npc.tableSeat) npc.tableSeat.occupied = false;
    npc.tableEntry = null;
    npc.tableSeat = null;
  }

  // ----- Porta-potty seeking -----
  //
  // Flow: idle urge → seeking_potty (walk to the door) → on arrival, branch on
  // occupancy: vacant → entering_potty → using_potty (hidden inside, door shut,
  // timer) → exiting_potty (door opens, stink puff, walk off). Occupied+unlocked
  // → surprised_potty (peek, recoil, slam, try next). Occupied+locked → wait
  // briefly, then try the next closest. Every state has a give-up timeout so an
  // NPC can never get permanently stuck, and the claimed unit is always released
  // on abort/despawn/chunk-unload (no unit left phantom-"occupied").

  // Nearest registered porta-potty within range, skipping any in `tried`. The
  // seeking logic discovers occupancy on ARRIVAL (that's the surprise gag), so
  // this returns the closest candidate regardless of occupied state.
  _findNearestPotty(npc, tried) {
    const ids = registry.byKind.get('porta_potty');
    if (!ids) return null;
    let best = null, bestD2 = POTTY_SEARCH_R2;
    for (const id of ids) {
      if (tried && tried.includes(id)) continue;
      const e = registry.entries.get(id);
      if (!e || !e.potty) continue;
      const dx = e.position.x - npc.pos.x;
      const dz = e.position.z - npc.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    return best;
  }

  _npcByIdx(idx) {
    for (const n of this.npcs) if (n.idx === idx) return n;
    return null;
  }

  // Free a porta-potty this NPC had claimed + reset its potty bookkeeping.
  _releasePotty(npc) {
    const e = npc.pottyEntry;
    if (e && e.potty && e.potty.occupantId === npc.idx) {
      e.potty.occupied = false;
      e.potty.occupantId = null;
      e.potty.locked = false;
      e.potty.doorTarget = 0;
    }
    npc.pottyEntry = null;
    npc.pottyTried = null;
    npc.pottyWait = 0;
    npc.useTimer = 0;
    npc.pottyPeeked = 0;
    npc.pottySitting = false;
    npc.seatY = undefined;
  }

  // Give up the whole errand and return to ambient wandering.
  _abortPotty(npc) {
    this._releasePotty(npc);
    npc.state = 'idle';
    npc.stateTimer = 1 + Math.random() * 2;
  }

  // Common guard: the targeted entry vanished (chunk unloaded) → bail cleanly.
  _pottyEntryGone(npc) {
    const e = npc.pottyEntry;
    return !e || !e.potty || !registry.entries.has(e.id);
  }

  _tickSeekingPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) { this._abortPotty(npc); this._writeMatrices(npc); return; }
    if (npc.stateTimer <= 0) { this._abortPotty(npc); this._writeMatrices(npc); return; }
    const e = npc.pottyEntry;
    const p = e.potty;

    // Walk to the door stand point.
    const standX = e.position.x + p.outX * POTTY_DOOR_STAND;
    const standZ = e.position.z + p.outZ * POTTY_DOOR_STAND;
    const tdx = standX - npc.pos.x;
    const tdz = standZ - npc.pos.z;
    const td = Math.hypot(tdx, tdz);

    if (td > 0.7) {
      const inv = 1 / (td || 1);
      const speed = 1.8 * npc.energy;
      npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, tdx * inv * speed, Math.min(1, dt * 5));
      npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, tdz * inv * speed, Math.min(1, dt * 5));
      npc.pos.x += npc.vel.x * dt;
      npc.pos.z += npc.vel.z * dt;
      const yaw = Math.atan2(-npc.vel.x, -npc.vel.z);
      npc.yaw += wrapAngle(yaw - npc.yaw) * Math.min(1, dt * 6);
      this._writeMatrices(npc);
      return;
    }

    // Arrived at the door. Face into the unit (toward the door = -outward).
    npc.vel.set(0, 0, 0);
    npc.yaw += wrapAngle(Math.atan2(p.outX, p.outZ) - npc.yaw) * Math.min(1, dt * 8);

    if (!p.occupied) {
      // Vacant → go in. Roll whether the occupant will lock the door behind them.
      p.occupied = true;
      p.occupantId = npc.idx;
      p.locked = Math.random() < POTTY_LOCK_CHANCE;
      p.doorTarget = 1;
      npc.state = 'entering_potty';
      npc.stateTimer = 6;
      this._writeMatrices(npc);
      return;
    }

    // Occupied + the occupant forgot to lock → SURPRISE. Yank the door open,
    // both parties recoil. The occupant scrambles to lock it now.
    if (!p.locked) {
      if (!npc.pottyTried) npc.pottyTried = [];
      if (!npc.pottyTried.includes(e.id)) npc.pottyTried.push(e.id);
      p.doorTarget = 1;
      p.locked = true;
      const occ = this._npcByIdx(p.occupantId);
      if (occ && occ.state === 'using_potty') occ.pottyPeeked = 1.2;  // pop into the doorway, startled
      npc.state = 'surprised_potty';
      npc.stateTimer = 1.3;
      npc.cheerTimer = 1.3;   // arms-up startle pose (decayed inside the tick)
      this._writeMatrices(npc);
      return;
    }

    // Occupied + locked → wait a beat, then head to the next closest.
    npc.pottyWait = (npc.pottyWait || 0) + dt;
    if (npc.pottyWait < 2.5 && Math.random() < 0.6) { this._writeMatrices(npc); return; }
    npc.pottyWait = 0;
    if (!npc.pottyTried) npc.pottyTried = [];
    if (!npc.pottyTried.includes(e.id)) npc.pottyTried.push(e.id);
    const next = this._findNearestPotty(npc, npc.pottyTried);
    if (next) { npc.pottyEntry = next; npc.stateTimer = 30; }
    else { this._abortPotty(npc); }
    this._writeMatrices(npc);
  }

  _tickEnteringPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) { this._abortPotty(npc); this._writeMatrices(npc); return; }
    const e = npc.pottyEntry;
    const p = e.potty;

    const cx = e.position.x, cz = e.position.z;
    const tdx = cx - npc.pos.x, tdz = cz - npc.pos.z;
    const td = Math.hypot(tdx, tdz);

    if (td > 0.25 && npc.stateTimer > 0) {
      // Step in only once the door's actually open.
      if (p.doorOpen > 0.5) {
        const inv = 1 / (td || 1);
        const speed = 1.1 * npc.energy;
        npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, tdx * inv * speed, Math.min(1, dt * 6));
        npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, tdz * inv * speed, Math.min(1, dt * 6));
        npc.pos.x += npc.vel.x * dt;
        npc.pos.z += npc.vel.z * dt;
      }
      npc.yaw += wrapAngle(Math.atan2(p.outX, p.outZ) - npc.yaw) * Math.min(1, dt * 8);
      this._writeMatrices(npc);
      return;
    }

    // Inside — snap to centre, shut the door, hide, start the visit.
    npc.pos.x = cx;
    npc.pos.z = cz;
    npc.vel.set(0, 0, 0);
    p.doorTarget = 0;
    npc.state = 'using_potty';
    npc.useTimer = POTTY_USE_MIN + Math.random() * (POTTY_USE_MAX - POTTY_USE_MIN);
    this._hideNpc(npc);
  }

  _tickUsingPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) { this._unhideAbort(npc); return; }
    const e = npc.pottyEntry;
    const p = e.potty;

    // Someone yanked the (unlocked) door open — caught sitting on the toilet,
    // startled (arms up), facing the intruder, for a beat. Then they recover and
    // duck back to invisible-inside and carry on.
    if (npc.pottyPeeked > 0) {
      npc.pottyPeeked -= dt;
      npc.pottySitting = true;
      npc.cheerTimer = Math.max(0, npc.pottyPeeked);   // arms-up "EEP!" pose
      npc.seatY = POTTY_SEAT_Y;
      npc.pos.x = e.position.x - p.outX * POTTY_SEAT_BACK;  // on the toilet (back of unit)
      npc.pos.z = e.position.z - p.outZ * POTTY_SEAT_BACK;
      npc.yaw = Math.atan2(-p.outX, -p.outZ);          // face the door/intruder
      if (npc.pottyPeeked <= 0) {
        npc.cheerTimer = 0;
        npc.pottySitting = false;
        npc.seatY = undefined;
        npc.pos.x = e.position.x;
        npc.pos.z = e.position.z;
      }
      this._writeMatrices(npc);
      return;
    }

    npc.useTimer -= dt;
    this._hideNpc(npc);
    if (npc.useTimer <= 0) {
      p.doorTarget = 1;            // open up to leave
      npc.state = 'exiting_potty';
      npc.stateTimer = 5;
      npc.exitPhase = 0;
    }
  }

  _tickExitingPotty(dt, npc) {
    if (this._pottyEntryGone(npc)) { this._unhideAbort(npc); return; }
    const e = npc.pottyEntry;
    const p = e.potty;

    // Stay hidden until the door's open enough to step through.
    if (npc.exitPhase === 0 && p.doorOpen < 0.55 && npc.stateTimer > 0) {
      this._hideNpc(npc);
      return;
    }

    if (npc.exitPhase === 0) {
      npc.exitPhase = 1;
      // Step out to the stand point, free the unit, puff the stink, walk off.
      npc.pos.x = e.position.x + p.outX * (POTTY_DOOR_STAND * 0.55);
      npc.pos.z = e.position.z + p.outZ * (POTTY_DOOR_STAND * 0.55);
      npc.yaw = Math.atan2(-p.outX, -p.outZ);   // face outward (away)
      p.occupied = false;
      p.occupantId = null;
      p.locked = false;
      p.doorTarget = 0;            // close behind them
      p.stinkTimer = STINK_DUR;    // green puff
      const r = 3 + Math.random() * 3;
      npc.target.set(
        e.position.x + p.outX * r + (Math.random() - 0.5) * 2,
        0,
        e.position.z + p.outZ * r + (Math.random() - 0.5) * 2,
      );
      npc.pottyEntry = null;
      npc.pottyTried = null;
      npc.pottyWait = 0;
      npc.state = 'walking';       // actively walk away from the door (frees it for the next user)
      npc.stateTimer = 6;
      this._writeMatrices(npc);
    }
  }

  _tickSurprisedPotty(dt, npc) {
    npc.stateTimer -= dt;
    npc.cheerTimer = Math.max(0, npc.stateTimer);   // arms-up pose tracks the recoil
    const e = npc.pottyEntry;
    const p = e && e.potty;
    if (p) {
      npc.yaw += wrapAngle(Math.atan2(p.outX, p.outZ) - npc.yaw) * Math.min(1, dt * 8);
      const sp = 2.6 * npc.energy;
      npc.vel.x = THREE.MathUtils.lerp(npc.vel.x, p.outX * sp, Math.min(1, dt * 8));
      npc.vel.z = THREE.MathUtils.lerp(npc.vel.z, p.outZ * sp, Math.min(1, dt * 8));
      npc.pos.x += npc.vel.x * dt;
      npc.pos.z += npc.vel.z * dt;
    }
    if (npc.stateTimer <= 0) {
      npc.cheerTimer = 0;
      if (p) p.doorTarget = 0;   // slam it shut
      const next = this._findNearestPotty(npc, npc.pottyTried || []);
      if (next) {
        npc.pottyEntry = next;
        npc.state = 'seeking_potty';
        npc.stateTimer = 30;
        npc.pottyWait = 0;
      } else {
        this._abortPotty(npc);
      }
    }
    this._writeMatrices(npc);
  }

  // Zero-scale every body mesh for this NPC's slot (used while they're inside a
  // potty). instanceMatrix.needsUpdate is flagged globally each frame in update().
  _hideNpc(npc) {
    const z = this._zeroMat || (this._zeroMat = new THREE.Matrix4().makeScale(0, 0, 0));
    this.legsMesh.setMatrixAt(npc.idx, z);
    this.shoesMesh.setMatrixAt(npc.idx, z);
    this.bodyMesh.setMatrixAt(npc.idx, z);
    this.armsMesh.setMatrixAt(npc.idx, z);
    this.headMesh.setMatrixAt(npc.idx, z);
    this.eyesMesh.setMatrixAt(npc.idx, z);
    this.mouthMesh.setMatrixAt(npc.idx, z);
  }

  // Targeted unit vanished mid-visit (chunk unloaded). Drop the claim, pop back
  // to idle, and write a real matrix so the NPC reappears instead of staying hidden.
  _unhideAbort(npc) {
    this._releasePotty(npc);
    npc.state = 'idle';
    npc.stateTimer = 1 + Math.random() * 2;
    this._writeMatrices(npc);
  }

  // Called from main.js when Zerble rams a porta-potty that's in use: eject the
  // occupant (flustered, fleeing), fling the door open, puff the stink.
  // Festival Run: a damaging hit flips the struck NPC's mouth to a frown for
  // the standard frown beat (dispatched from main.js's damaging-hit gate —
  // the frown here is feedback only; the smile deduction stays in onFrown's
  // dry-cart path and the vibe strike lives in the run layer).
  frownAt(npc) {
    if (npc) npc.frownTimer = FROWN_DURATION;
  }

  onPottyHit(entry) {
    if (!entry || !entry.potty || !entry.potty.occupied) return;
    const p = entry.potty;
    const occ = this._npcByIdx(p.occupantId);
    if (occ && occ.pottyEntry === entry) {
      occ.pos.x = entry.position.x + p.outX * 1.0;
      occ.pos.z = entry.position.z + p.outZ * 1.0;
      occ.pottyEntry = null;
      occ.pottyTried = null;
      occ.useTimer = 0;
      occ.pottyPeeked = 0;
      occ.pottySitting = false;
      occ.seatY = undefined;
      occ.state = 'fleeing';
      occ.stateTimer = 3;
    }
    p.occupied = false;
    p.occupantId = null;
    p.locked = false;
    p.doorTarget = 1;
    p.stinkTimer = STINK_DUR;
  }

  // Called from main.js when Zerble drives into an NPC. Knockback the victim,
  // put them into a fleeing state, and spook nearby NPCs (panic cascade).
  onZerbleHit(victim, pushX, pushZ) {
    this._abandonSeat(victim);   // a rammed napper/diner gets up — free its claim
    victim.state = 'fleeing';
    victim.stateTimer = 3;
    victim.happiness = 0;
    // Apply an instant positional knockback so the cart doesn't keep grinding
    // through the same NPC frame after frame.
    victim.pos.x += pushX * 0.6;
    victim.pos.z += pushZ * 0.6;
    // Panic cascade: nearby NPCs (within 6m) of any reasonable skittishness flee too
    for (const other of this.npcs) {
      if (other === victim || other.state === 'riding' || other.state === 'boarding') continue;
      const dx = other.pos.x - victim.pos.x;
      const dz = other.pos.z - victim.pos.z;
      if (dx * dx + dz * dz > 36) continue;
      // Bolder/calmer folks may shrug it off
      if (other.skittish < 0.15 && Math.random() < 0.5) continue;
      this._abandonSeat(other);   // free any seat/hammock before the panic
      other.state = 'fleeing';
      other.stateTimer = 2.5;
    }
  }

  // Free any picnic-table seat or hammock an NPC holds before it's force-fled
  // (rammed, cascade-panicked, or honk-scattered), so the slot is never stranded
  // "occupied". Safe to call on any NPC — no-op if it holds neither.
  _abandonSeat(npc) {
    if (npc.tableSeat) this._releaseTable(npc);
    if (npc.hammockEntry) this._releaseHammock(npc);
  }

  // Star power love-magnet — called every frame from main.js while the buff is
  // active. Every NPC within LOVE_RADIUS of Zerble falls in love: a continuous
  // smile burst (per-NPC cooldown so one NPC doesn't fire every frame) and a
  // stop-and-stare. NPCs busy in an interaction (riding, potty, hammock, table,
  // fleeing) are left alone so we don't yank them out of a state machine.
  applyStarLove(zerble, dt, radius = 25) {
    const r2 = radius * radius;
    const px = zerble.position.x, pz = zerble.position.z;
    for (const npc of this.npcs) {
      if (STAR_LOVE_SKIP.has(npc.state)) continue;
      const dx = npc.pos.x - px, dz = npc.pos.z - pz;
      if (dx * dx + dz * dz > r2) continue;
      npc.happiness = HAPPINESS_THRESHOLD;        // smitten
      if (npc.starLoveCd === undefined) npc.starLoveCd = 0;
      npc.starLoveCd -= dt;
      if (npc.starLoveCd <= 0) {
        npc.starLoveCd = 1.4 + Math.random() * 0.4;
        npc.lastSmilePos = zerble.position.clone();
        this.smiles.spawn(npc.pos);
      }
      // Stop and stare. Reset watchTimer so the watching case re-rolls a fresh
      // (long) attention span and keeps facing Zerble through the buff.
      if (npc.state !== 'watching') {
        npc.state = 'watching';
        npc.watchTimer = 0;
        npc.attentionSpan = 16;
      }
    }
  }

  applyHonk(zerble) {
    // A honk scatters the forward arc at ANY speed (it used to fire only when
    // parked). Two passes:
    //   1. Front arc — anyone in the forward ~hemisphere within a speed-scaled
    //      range flees; the cart's speed sets the flee URGENCY (polite hop when
    //      slow/parked → urgent scramble at full tilt) and how far ahead the
    //      honk reaches.
    //   2. Behind — anyone close behind still hops briefly (a honk is LOUD).
    // The stateTimer-based fleeing lock (top of _updateNpc) keeps the proximity
    // machine from stomping these back to 'watching' next frame.
    const FRONT_CONE_DOT = -0.3;   // loose forward hemisphere (unnormalized dot, matches prior feel)
    const { t: speedT, frontRange, behindRange, urgency } = honkScatterParams(zerble.speed || 0);
    const frontSq = frontRange * frontRange;
    const behindSq = behindRange * behindRange;
    const fwd = zerble.forwardWorld;
    const vDir = (zerble.speed || 0) >= 0 ? 1 : -1;        // scatter along travel, not facing (reverse-safe)

    for (const npc of this.npcs) {
      const dx = npc.pos.x - zerble.position.x;
      const dz = npc.pos.z - zerble.position.z;

      // Scatter pass — fires at any speed now.
      // Boarding NPCs (would-be passengers approaching a seat slot) ALSO
      // scatter: a honk should "make them think better of it" rather than
      // them serenely walking to their seat through the racket. We release
      // their reserved seat slot first; the per-frame activePassengers recount
      // sees them leave 'boarding' next frame, so the cap auto-decrements.
      // 'riding' stays exempt — they're physically tied to the cart.
      if (fwd && npc.state !== 'riding') {
        const d2 = dx * dx + dz * dz;
        const dot = (dx * fwd.x + dz * fwd.z) * vDir;   // forward along travel direction
        const inFront = d2 < frontSq && dot > FRONT_CONE_DOT;
        const inRange = inFront || (d2 < behindSq);
        if (inRange) {
          if (npc.state === 'boarding' && npc.seatSlot) {
            this._releaseSeat(npc.seatSlot);
            npc.seatSlot = null;
          }
          this._abandonSeat(npc);   // get a seated diner/napper up + free the slot
          npc.state = 'fleeing';
          npc.fleeUrgency = inFront ? urgency : Math.min(urgency, 1.3);  // behind = a flinch, not a sprint
          // Front flees commit longer (longer still at speed); a behind flinch is brief.
          npc.stateTimer = inFront ? (1.5 + speedT * 0.6) : 0.8;
        }
      }

      const d = Math.hypot(dx, dz);
      if (d < HONK_RANGE && npc.smileTimeCooldown <= 0 && npc.state !== 'fleeing') {
        const k = 1 - d / HONK_RANGE;
        npc.happiness += HONK_BOOST * k;
        if (npc.happiness >= HAPPINESS_THRESHOLD) {
          // Apply the same distance/time gate as natural smiles
          if (npc.lastSmilePos === null || zerble.position.distanceTo(npc.lastSmilePos) > SMILE_RESET_DIST) {
            npc.happiness = 0;
            npc.smileTimeCooldown = SMILE_TIME_COOLDOWN;
            npc.lastSmilePos = zerble.position.clone();
            this.smiles.spawn(npc.pos);
          } else {
            // They're charmed but already smiled recently — just hold at threshold
            npc.happiness = HAPPINESS_THRESHOLD * 0.95;
          }
        }
      }
    }
  }
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Looks up nearby building footprints and returns a normalized repulsion direction.
function nearestFootprintAvoidance(pos, lookAheadRadius) {
  let pushX = 0, pushZ = 0, strength = 0;
  // Localized scan: only footprints in nearby cells (reach padded internally by
  // the registry's max footprint radius). Same per-entry math as the old full
  // registry.footprints() walk, including the tree/path_node skip.
  registry.footprintsNear(pos.x, pos.z, lookAheadRadius, (e) => {
    if (e.kind === 'tree' || e.kind === 'path_node') return;
    const dx = pos.x - e.position.x;
    const dz = pos.z - e.position.z;
    const d = Math.hypot(dx, dz);
    const intrusion = e.footprint + lookAheadRadius - d;
    if (intrusion > 0) {
      const inv = 1 / (d || 0.0001);
      const w = intrusion / lookAheadRadius;
      pushX += dx * inv * w;
      pushZ += dz * inv * w;
      strength += w;
    }
  });
  if (strength <= 0) return null;
  const n = Math.hypot(pushX, pushZ) || 1;
  return { x: pushX / n, z: pushZ / n, strength: Math.min(1.2, strength) };
}
