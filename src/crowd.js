import {hoopFootLift} from './people/hoop/feet.js';
import {validateHoopFeet} from './people/hoop/leg.js';
import {ARM_SHOULDER_Y,isStageDancing,sampleDanceArmPose,sampleThrowPose,sampleArmHand,sampleWalkMotion,walkingArrivalSpeed,idleSwayDelta,armShader,crossLegShader,flowLegShader} from './personMotion.js';
import {CampActivity} from './people/campActivity.js';
import {MarketActivity} from './people/marketActivity.js';
import {PottyActivity} from './people/pottyActivity.js';
import {PicnicActivity} from './people/picnicActivity.js';
import {HammockActivity} from './people/hammockActivity.js';
import {SeatReservations} from './people/seatReservations.js';
import {GroupParticipation,publishGroupBinding,hideGroupBinding,releaseGroupBinding} from './people/groupParticipation.js';
import {canSmile,movedSinceSmile,resetSmile} from './people/smilePolicy.js';
import { PeopleRuntime } from './people/runtime.js';
import { PersonHandles } from './people/personHandle.js';
import {disposeSceneResources} from './people/sceneResources.js';
import { ActivityClaims } from './people/activityClaims.js';
import { mulberry32 } from './rng.js';
import { terrainHeight } from './worldgen/terrain.js';
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
import { getTimeOfDay } from './world.js';
import { CampJamActivity } from './campJamActivity.js';
import { buildCrowdHair } from './crowdHair.js';
import { CROWD_HAIR_STYLES, crowdAppearanceRng, rollCrowdAppearance } from './crowdAppearance.js';
import { SpatialGrid } from './spatialGrid.js';
import { PERF, USE_WORLDGEN_V2 } from './perf.js';
import { CHUNK_SIZE } from './chunks.js';
import { DODGE, laneDodgeTest, laneDodgeDir, laneDodgeUrgency, honkScatterParams } from './steering.js';
import {
  PHOTO_FLASH_DURATION,
  PHOTO_STATE_NOTICE,
  PHOTO_STATE_POSE,
  advancePhotographerShot,
  isPhotographerState,
  photographerProfile,
  samplePhotographerPose,
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
const LEGACY_NPC_ROW_SHIRT = [0xff6f9c,0xffd28a,0x6fcf6a,0x66d9ff,0xb285ff,0xff8a5b,0xf2e8cf,0x8ecae6,
  0xffb703,0xc77dff,0x7bd389,0xe07a5f,0x81b29a,0xf4a261,0xff3d7f,0xff5e3a,0xffe14d,0x4dffa5,
  0x3acfd5,0x6c5bff,0xff44dd,0xb7ff5b,0xff7b3c,0x39d6c4,0x9b6bff,0xff5577,0xffd23f,0x59ffa0];

function mergeGeometrySet(parts) {
  const normalized = parts.map((part) => part.index ? part.toNonIndexed() : part.clone());
  for (const part of parts) part.dispose();
  const merged = BufferGeometryUtils.mergeGeometries(normalized);
  for (const part of normalized) part.dispose();
  return merged;
}

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
  'camp_walking', 'camp_seated', 'camp_sleeping',
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


// Cheer: NPCs within this radius of a song-end position cheer for 5s.
const CHEER_RADIUS = 16;
const CHEER_RADIUS_SQ = CHEER_RADIUS * CHEER_RADIUS;
// Jump parameters: positive-half sine only so NPCs hop up, not bob through floor.
const HOP_HZ = 2 * Math.PI * 2.6;
const HOP_HEIGHT = 0.32;
const ORDINARY_SOCIAL_STATES = new Set(['idle', 'walking', 'watching', 'approaching']);
const POTTY_STATES=Object.freeze({seeking_potty:'seeking_potty',entering_potty:'entering_potty',using_potty:'using_potty',exiting_potty:'exiting_potty',surprised_potty:'surprised_potty',idle:'idle',walking:'walking',fleeing:'fleeing'});
const CAMP_STATES=Object.freeze({camp_walking:'camp_walking',camp_seated:'camp_seated',camp_sleeping:'camp_sleeping',idle:'idle',walking:'walking',fleeing:'fleeing'});
const CAMP_MUSIC_STATES=Object.freeze({...CAMP_STATES,camp_music_walk:'camp_music_walk',camp_music_standing:'camp_music_standing'});
const MARKET_STATES=Object.freeze({market_walking:'market_walking',market_browsing:'market_browsing',market_chatting:'market_chatting',market_buying:'market_buying',idle:'idle',walking:'walking',fleeing:'fleeing',watching:'watching',approaching:'approaching'});
const PICNIC_STATES=Object.freeze({approach:'walking_to_table',seated:'table_seated',idle:'idle'});
const HAMMOCK_STATES=Object.freeze({approach:'walking_to_hammock',swing:'hammock_riding',idle:'idle'});
const HAMMOCK_OPTIONAL_FIELDS=Object.freeze(['hammockBob','hammockY']);
const REST_MOTION_FIELDS=Object.freeze(['x','z','heading','vx','vy','vz','stateTimer','targetX','targetY','targetZ']);

const BODY_RADIUS = 0.26;
const BODY_LENGTH = 0.55;
const BODY_CENTER_Y = 1.0;
const BODY_SEATED_BOTTOM = BODY_CENTER_Y - BODY_LENGTH / 2 - BODY_RADIUS;

function groundNpc(npc) {
  if (npc.state === 'riding' && npc.seatY != null) npc.pos.y = npc.seatY;
  else if (npc.state === 'hammock_riding' && npc.hammockY != null) npc.pos.y = npc.hammockY;
  else if (npc.state === 'camp_seated' && npc.campY!==undefined) npc.pos.y = npc.campY;
  else if (npc.state === 'table_seated' && npc.picnicY!=null) npc.pos.y = npc.picnicY;
  else if (npc.pottySitting && npc.seatY != null) npc.pos.y = npc.seatY;
  else npc.pos.y = terrainHeight(npc.pos.x, npc.pos.z);
}

export class Crowd {
  constructor(smiles, {runtime=null,key='crowd',collisionOrder=70,honkOrder=10}={}) {
    if(!Number.isFinite(collisionOrder)||!Number.isFinite(honkOrder))throw new TypeError('Crowd capability order must be finite.');
    this.smiles = smiles;
    // Set true from main.js when Zerble's bubble tank is dry — NPCs frown
    // instead of smile. `onFrown(handle)` fires when a frown lands (score sink).
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
    this.groups = new Map(); // groupId -> { center: Vector3, members: [indices] }
    this.parties = new Set();
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
    this._drinkFree = [];
    this._drinkDrawCount = 0;
    this._hairFree = CROWD_HAIR_STYLES.map(() => []);
    this._hairDrawCounts = CROWD_HAIR_STYLES.map(() => 0);

    this._buildInstanced();
    this._disposed=false;this.actorTime=0;
    this.peopleRuntime=runtime??new PeopleRuntime();
    this.ownerToken=this.peopleRuntime.register({key,controller:this,
      schedule:[{slot:'adults',run(dt,frame){this.update(dt,frame.zerble,frame.bubbles);}},{slot:'star-love',run(dt,frame){this.applyStarLove(frame.zerble,dt);}}],
      capabilities:{honk:this.applyHonk,colliders:this.appendColliders,nearby:this.forEachPersonNear,cheer:this.cheerNear},
      capabilityOrder:{nearby:collisionOrder,colliders:collisionOrder,honk:honkOrder},
    });
    this.peopleHandles=new PersonHandles({runtime:this.peopleRuntime,ownerToken:this.ownerToken,
      read:(npc,out)=>this._readPerson(npc,out),
    });
    this.peopleView=this.peopleHandles.view;
    this.seatReservations=new SeatReservations(this.peopleHandles);
    this.activityClaims=new ActivityClaims({people:this.peopleHandles,
      eligible:handle=>this._canAcquireActivity(handle),
      resume:(handle,reason,claim)=>this._resumeActivityPerson(handle,reason,claim),
      finalize:claim=>this._finalizeActivityRelease(claim),
    });
    this.hammocks=new HammockActivity(this,registry);
    this.picnics=new PicnicActivity(this,registry);
    this.bathrooms=new PottyActivity(this,registry);
    this.markets=new MarketActivity(this,registry);
    this.camps=new CampActivity(this,registry);
    this.campJams=new CampJamActivity(this);
    this._inlineActivities=new Set([this.hammocks,this.picnics,this.bathrooms,this.markets,this.camps,this.campJams]);
  }

  _buildInstanced() {
    // ---- Legs: two cylinders merged, offsets baked into geometry ----
    const legL = new THREE.CylinderGeometry(0.10, 0.10, 0.65, 6, 2);
    legL.translate(-0.12, 0.325, 0);
    const legR = new THREE.CylinderGeometry(0.10, 0.10, 0.65, 6, 2);
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

    const crossed=new Float32Array(MAX_NPCS);
    for(const geo of [legsGeo,shoesGeo])geo.setAttribute('crossLegged',new THREE.InstancedBufferAttribute(crossed,1));
    const strides=new Float32Array(MAX_NPCS);
    for(const geo of [legsGeo,shoesGeo])geo.setAttribute('walkStride',new THREE.InstancedBufferAttribute(strides,1));
    for(const name of ['flowLeftFoot','flowRightFoot','flowLeftQuat','flowRightQuat']){
      const data=new Float32Array(MAX_NPCS*4);
      for(const geo of [legsGeo,shoesGeo])geo.setAttribute(name,new THREE.InstancedBufferAttribute(data,4));
    }

    // ---- Body (torso): capsule centered at y=1.0 ----
    const bodyGeo = new THREE.CapsuleGeometry(BODY_RADIUS, BODY_LENGTH, 3, 6);
    bodyGeo.translate(0, BODY_CENTER_Y, 0);

    // Two joints per arm, merged into the existing single instanced draw.
    // Low-poly caps keep the joint upgrade close to the old triangle budget.
    const armParts=[];
    for(const side of [-1,1])for(const lower of [0,1]){
      const geo=new THREE.CapsuleGeometry(.075,.29,1,6);
      geo.translate(side*.30,ARM_SHOULDER_Y-(lower?.435:.145),0);
      geo.setAttribute('armLower',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(lower),1));
      armParts.push(geo);
    }
    const armsGeo=mergeGeometrySet(armParts);
    armsGeo.setAttribute('armLeftPose',new THREE.InstancedBufferAttribute(new Float32Array(MAX_NPCS*2),2));
    armsGeo.setAttribute('armPose',new THREE.InstancedBufferAttribute(new Float32Array(MAX_NPCS*4),4));

    // ---- Head: icosahedron at y=1.65 ----
    const headGeo = new THREE.IcosahedronGeometry(0.26, 1);
    headGeo.translate(0, 1.65, 0);
    const noseGeo = new THREE.IcosahedronGeometry(0.045, 0);
    noseGeo.scale(0.8, 0.8, 1.15);
    noseGeo.translate(0, 1.65, -0.245);
    const headWithNose = mergeGeometrySet([headGeo, noseGeo]);

    // ---- Eyes: two small spheres baked at NPC-local (±0.08, 1.68, -0.22) ----
    const eyeL = new THREE.SphereGeometry(0.018, 6, 6);
    eyeL.translate(-0.08, 1.68, -0.25);
    const eyeR = new THREE.SphereGeometry(0.018, 6, 6);
    eyeR.translate(0.08, 1.68, -0.25);
    const whiteL = new THREE.SphereGeometry(0.04, 7, 5);
    whiteL.scale(1, 0.78, 0.56); whiteL.translate(-0.08, 1.68, -0.228);
    const whiteR = new THREE.SphereGeometry(0.04, 7, 5);
    whiteR.scale(1, 0.78, 0.56); whiteR.translate(0.08, 1.68, -0.228);
    const eyeColor = (geo, hex) => {
      const color = new THREE.Color(hex);
      const colors = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geo;
    };
    const eyesGeo = mergeGeometrySet([eyeColor(eyeL, 0x17151a), eyeColor(eyeR, 0x17151a),
      eyeColor(whiteL, 0xf5eadb), eyeColor(whiteR, 0xf5eadb)]);

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

    const hairGeos = buildCrowdHair();

    // The cup is held in local right hand space and shares the crowd transform.
    const cup = new THREE.CylinderGeometry(0.055, 0.043, 0.16, 7);
    cup.translate(0, 1.0, -0.27);
    const cupLid = new THREE.CylinderGeometry(0.06, 0.06, 0.018, 7);
    cupLid.translate(0, 1.09, -0.27);
    const straw = new THREE.CylinderGeometry(0.008, 0.008, 0.09, 5);
    straw.translate(0.012, 1.14, -0.27);
    const drinkGeo = mergeGeometrySet([cup, cupLid, straw]);

    const bagBox = new THREE.BoxGeometry(.25, .3, .13);
    bagBox.translate(.38, .59, -.08);
    const bagHandle = new THREE.TorusGeometry(.065, .012, 4, 8);
    bagHandle.translate(.38, .78, -.08);
    const bagGeo = mergeGeometrySet([bagBox, bagHandle]);

    // ---- Materials ----
    const legsMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true });
    const shoesMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8,  flatShading: true });
    const bodyMat  = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
    const armsMat  = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
    const headMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9,  flatShading: true });
    const featureMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true, vertexColors: true });
    const cameraMat = new THREE.MeshStandardMaterial({ color: 0x17151c, roughness: 0.58, metalness: 0.2, flatShading: true });
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff2ad, toneMapped: false, depthWrite: true });
    const hairMats = hairGeos.map(() => new THREE.MeshStandardMaterial({ roughness: 0.9 }));
    const drinkMat = new THREE.MeshStandardMaterial({ roughness: 0.72, flatShading: true });

    // Tie-dye injection — adds two per-instance attributes:
    //   shirtAccent (vec3)  — the secondary color woven through the shirt
    //   shirtTieDye (float) — 0 means plain (no swirl); >0 picks pattern
    //                          frequency + amplitude
    // The fragment shader builds a swirl from the geometry's local position
    // (capsule UVs are degenerate around the poles, position is more reliable)
    // and blends instanceColor with shirtAccent based on a sin/cos noise.
    // Applied to both body and arm materials so sleeves match.
    const tieDyeBeforeCompile = (shader, body = false) => {
      // Inject attribute + varying declarations at the very top of each stage.
      shader.vertexShader = `
        attribute vec3 shirtAccent;
        attribute float shirtTieDye;
        attribute vec3 npcSkin;
        attribute float armSkinMask;
        attribute float shirtStyle;
        varying vec3 vShirtAccent;
        varying float vShirtTieDye;
        varying vec3 vLocalPos;
        varying vec3 vNpcSkin;
        varying float vArmSkinMask;
        varying float vShirtStyle;
      ` + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vShirtAccent = shirtAccent;
         vShirtTieDye = shirtTieDye;
         vLocalPos = position;`
         + `vNpcSkin = npcSkin;
         vArmSkinMask = armSkinMask;
         vShirtStyle = shirtStyle;`
      );
      shader.fragmentShader = `
        varying vec3 vShirtAccent;
        varying float vShirtTieDye;
        varying vec3 vLocalPos;
        varying vec3 vNpcSkin;
        varying float vArmSkinMask;
        varying float vShirtStyle;
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
         }
         if (vShirtStyle > 0.1 && vShirtStyle < 1.1 && abs(vLocalPos.x) < 0.035 && vLocalPos.y < 1.28 && vLocalPos.y > 0.72) {
           diffuseColor.rgb = mix(diffuseColor.rgb, vShirtAccent, 0.75);
         } else if (vShirtStyle >= 1.1 && vShirtStyle < 2.1 && vLocalPos.y > 1.31) {
           diffuseColor.rgb = mix(diffuseColor.rgb, vShirtAccent, 0.85);
         } else if (vShirtStyle >= 2.1 && abs(vLocalPos.x) > 0.19 && abs(vLocalPos.x) < 0.25 && vLocalPos.y < 1.30) {
           diffuseColor.rgb = mix(diffuseColor.rgb, vShirtAccent, 0.75);
         }
         diffuseColor.rgb = mix(diffuseColor.rgb, vNpcSkin, vArmSkinMask);`
      );
    };
    bodyMat.onBeforeCompile = (shader) => tieDyeBeforeCompile(shader, true);
    armsMat.onBeforeCompile = shader => {
      tieDyeBeforeCompile(shader,false);
      shader.vertexShader=armShader+shader.vertexShader
        .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=articulateArm(objectNormal,true);')
        .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=articulateArm(transformed,false);');
    };
    // onBeforeCompile-modified materials need a unique customProgramCacheKey
    // so three.js doesn't reuse a vanilla MeshStandardMaterial program.
    bodyMat.customProgramCacheKey = () => 'crowd-appearance-v2';
    armsMat.customProgramCacheKey = () => 'crowd-articulated-v1';

    for(const [mat,shoe] of [[legsMat,false],[shoesMat,true]]){
      mat.onBeforeCompile=shader=>{shader.vertexShader=crossLegShader+flowLegShader+shader.vertexShader
        .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=flowHoopLeg(objectNormal,true,'+shoe+');')
        .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=flowHoopLeg(transformed,false,'+shoe+');');};
      mat.customProgramCacheKey=()=> 'crowd-planted-v1-'+(shoe?'shoes':'legs');
    }
    // ---- InstancedMeshes ----
    this.legsMesh  = new THREE.InstancedMesh(legsGeo,  legsMat,  MAX_NPCS);
    this.shoesMesh = new THREE.InstancedMesh(shoesGeo, shoesMat, MAX_NPCS);
    for(const mesh of [this.legsMesh,this.shoesMesh]){
      mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
      const shoe=mesh===this.shoesMesh;
      mesh.customDepthMaterial.onBeforeCompile=shader=>{shader.vertexShader=crossLegShader+flowLegShader+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=flowHoopLeg(transformed,false,'+shoe+');');};
      mesh.customDepthMaterial.customProgramCacheKey=()=> 'crowd-planted-depth-v1-'+(shoe?'shoes':'legs');
    }
    this.bodyMesh  = new THREE.InstancedMesh(bodyGeo,  bodyMat,  MAX_NPCS);
    this.armsMesh  = new THREE.InstancedMesh(armsGeo,  armsMat,  MAX_NPCS);
    // Shadow silhouettes must use the same joints as the visible body.
    this.armsMesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
    this.armsMesh.customDepthMaterial.onBeforeCompile=shader=>{
      shader.vertexShader=armShader+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=articulateArm(transformed,false);');
    };
    this.armsMesh.customDepthMaterial.customProgramCacheKey=()=> 'crowd-arm-depth-v1';
    this.headMesh  = new THREE.InstancedMesh(headWithNose, headMat, MAX_NPCS);
    this.eyesMesh  = new THREE.InstancedMesh(eyesGeo, eyeMat, MAX_NPCS);
    this.mouthMesh = new THREE.InstancedMesh(mouthGeo, featureMat, MAX_NPCS);
    this.cameraMesh = new THREE.InstancedMesh(cameraGeo, cameraMat, MAX_NPCS);
    this.flashMesh = new THREE.InstancedMesh(flashGeo, flashMat, MAX_NPCS);
    this.hairMeshes = hairGeos.map((geo, style) => new THREE.InstancedMesh(geo, hairMats[style], MAX_NPCS));
    this.drinkMesh = new THREE.InstancedMesh(drinkGeo, drinkMat, MAX_NPCS);
    this.shoppingBagMesh = new THREE.InstancedMesh(bagGeo,
      new THREE.MeshStandardMaterial({color: 0xba864c, roughness: .95}), MAX_NPCS);

    // Per-NPC shirt color shared between body and arms (sleeves).
    this.bodyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_NPCS * 3), 3);
    this.armsMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_NPCS * 3), 3);
    this.headMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_NPCS * 3), 3);
    this.legsMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_NPCS * 3), 3);
    for (const mesh of this.hairMeshes) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_NPCS * 3), 3);
    this.drinkMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_NPCS * 3), 3);

    // Tie-dye per-instance attributes. shirtAccent is the secondary color;
    // shirtTieDye is 0 for plain shirts and ~0.4-1.0 for tie-dyed ones. Both
    // bodyMesh + armsMesh share the same data references so sleeves match.
    const accentData = new Float32Array(MAX_NPCS * 3);
    const tieDyeData = new Float32Array(MAX_NPCS);
    const skinData = new Float32Array(MAX_NPCS * 3);
    const styleData = new Float32Array(MAX_NPCS);
    bodyGeo.setAttribute('armSkinMask', new THREE.BufferAttribute(new Float32Array(bodyGeo.attributes.position.count), 1));
    armsGeo.setAttribute('shirtStyle', new THREE.BufferAttribute(new Float32Array(armsGeo.attributes.position.count), 1));
    const armMask = new Float32Array(armsGeo.attributes.position.count);
    for (let i = 0; i < armMask.length; i++) {
      const y = armsGeo.attributes.position.getY(i);
      armMask[i] = y < 0.98 ? 1 : 0;
    }
    armsGeo.setAttribute('armSkinMask', new THREE.BufferAttribute(armMask, 1));
    const shirtAccentAttr_body = new THREE.InstancedBufferAttribute(accentData, 3);
    const shirtTieDyeAttr_body = new THREE.InstancedBufferAttribute(tieDyeData, 1);
    const shirtAccentAttr_arms = new THREE.InstancedBufferAttribute(accentData, 3);
    const shirtTieDyeAttr_arms = new THREE.InstancedBufferAttribute(tieDyeData, 1);
    const skinAttr_arms = new THREE.InstancedBufferAttribute(skinData, 3);
    const styleAttr_body = new THREE.InstancedBufferAttribute(styleData, 1);
    const skinAttr_body = new THREE.InstancedBufferAttribute(skinData, 3);
    bodyGeo.setAttribute('shirtAccent', shirtAccentAttr_body);
    bodyGeo.setAttribute('shirtTieDye', shirtTieDyeAttr_body);
    armsGeo.setAttribute('shirtAccent', shirtAccentAttr_arms);
    armsGeo.setAttribute('shirtTieDye', shirtTieDyeAttr_arms);
    armsGeo.setAttribute('npcSkin', skinAttr_arms);
    bodyGeo.setAttribute('npcSkin', skinAttr_body);
    bodyGeo.setAttribute('shirtStyle', styleAttr_body);
    this._shirtAccentData = accentData;
    this._shirtTieDyeData = tieDyeData;
    this._skinData = skinData;
    this._styleData = styleData;
    this._shirtAccentAttrs = [shirtAccentAttr_body, shirtAccentAttr_arms];
    this._shirtTieDyeAttrs = [shirtTieDyeAttr_body, shirtTieDyeAttr_arms];
    this._skinAttrs = [skinAttr_body, skinAttr_arms];
    this._styleAttrBody = styleAttr_body;

    // InstancedMesh frustum culling uses a bounding sphere that's computed once
    // and cached — it does NOT auto-expand when instance matrices move. As
    // Zerble drives far from spawn, the cached sphere falls behind the camera
    // and the entire crowd vanishes (while game logic keeps running →
    // invisible collisions, invisible smiles). Bubbles already disables
    // culling for the same reason. One drawcall per mesh either way.
    const allMeshes = [this.legsMesh, this.shoesMesh, this.bodyMesh, this.armsMesh, this.headMesh,
      this.eyesMesh, this.mouthMesh, this.cameraMesh, this.flashMesh, ...this.hairMeshes, this.drinkMesh, this.shoppingBagMesh];
    for (const m of allMeshes) {
      m.castShadow = PERF.shadows;
      m.frustumCulled = false;
      m.count = MAX_NPCS;
    }
    // The tiny camera and instantaneous unlit flash do not justify two more
    // shadow casters. The flash is opaque and adds no light or transparency.
    this.cameraMesh.castShadow = false;
    this.flashMesh.castShadow = false;
    for (const mesh of this.hairMeshes) mesh.castShadow = false;
    this.drinkMesh.castShadow = false;
    this.shoppingBagMesh.castShadow = false;

    this.group = new THREE.Group();
    this.group.name = 'Crowd';
    for (const m of allMeshes) this.group.add(m);

    // Hide all slots initially (zero-scale matrix = invisible).
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this._zeroMat = zero;
    for (let i = 0; i < MAX_NPCS; i++) {
      for (const m of allMeshes) m.setMatrixAt(i, zero);
    }
    for (let i = MAX_NPCS - 1; i >= 0; i--) {
      this.free.push(i);
      for (const slots of this._hairFree) slots.push(i);
      this._drinkFree.push(i);
    }
    // Photographer and beverage props have independent packed slot maps so
    // their draw ranges follow the rare live instances, not crowd slot IDs.
    for (let i = MAX_NPCS - 1; i >= 0; i--) this._photoFree.push(i);
    for (const m of allMeshes) m.instanceMatrix.needsUpdate = true;
    this.cameraMesh.count = 0;
    this.flashMesh.count = 0;
    this.drinkMesh.count = 0;
    for (const mesh of this.hairMeshes) mesh.count = 0;

    // Reusables — must be DISTINCT Vector3 instances; reusing one for both
    // position and scale args of Matrix4.compose() silently corrupts position.
    this._mat4 = new THREE.Matrix4();
    this._tmpV = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._tmpV3 = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpEuler = new THREE.Euler();
    this._tmpDanceMat = new THREE.Matrix4();
    this._hairLocalMat = new THREE.Matrix4();
    this._hairMat = new THREE.Matrix4();
    this._drinkLocalMat = new THREE.Matrix4();
    this._drinkMat = new THREE.Matrix4();
    this._tmpScale = new THREE.Vector3();
    this._mouthMat = new THREE.Matrix4();
    // Mouth is positioned as a child of the body matrix (see _writeMatrices):
    // _mouthLocalMat holds the face-local offset + smile-pop scale, identity
    // rotation, multiplied onto the body matrix so the smile inherits bob,
    // sway tilt, yaw wiggle, NPC scale, and seat/hammock lift.
    this._mouthLocalMat = new THREE.Matrix4();
    this._flashLocalMat = new THREE.Matrix4();
    this._flashMat = new THREE.Matrix4();
    this._photoRenderProfile={};
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

    // Rigid poses and shader joints must share the same torso attachment.
    // Rotating around the old arm center moved shoulders down toward the waist.
    const SHOULDER_Y = ARM_SHOULDER_Y, ARMS_UP_BEND = -2.618;
    this._armsUpMat = new THREE.Matrix4()
      .makeTranslation(0, SHOULDER_Y, 0)
      .multiply(new THREE.Matrix4().makeRotationX(ARMS_UP_BEND))
      .multiply(new THREE.Matrix4().makeTranslation(0, -SHOULDER_Y, 0));
    this._armsMat = new THREE.Matrix4();
    this._flowHeadMat = new THREE.Matrix4();this._flowHeadLocalMat = new THREE.Matrix4();
    this._musicArmMat = new THREE.Matrix4();
    this._musicPivotMat = new THREE.Matrix4();
    this._instrumentLocalMat = new THREE.Matrix4();
    this._photoCameraMat = new THREE.Matrix4();
    this._photoCameraLocalMat = new THREE.Matrix4();

    // High-water mark: highest occupied crowd slot, kept compact on release.
    this._maxIdx = -1;
  }

  // Called by chunk generator.
  spawn({ pos, chunkKey, rng = Math.random, forcePhotographer = false, allowPhotographer = true, appearanceOverride = null, scale = null }) {
    if(scale!==null&&(!Number.isFinite(scale)||scale<.5||scale>2))throw new RangeError('Person scale must be between .5 and 2.');
    if (this._disposed || this.free.length === 0) return null;
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

    const legacyShirt = LEGACY_NPC_ROW_SHIRT[Math.floor(rng() * LEGACY_NPC_ROW_SHIRT.length)];
    const legacyTieDye = rng() < 0.55;
    if (legacyTieDye) {
      rng();
      for (let tries = 0; tries < 4; tries++) {
        const pick = LEGACY_NPC_ROW_SHIRT[Math.floor(rng() * LEGACY_NPC_ROW_SHIRT.length)];
        if (pick !== legacyShirt) break;
      }
    }
    const rolledAppearance = rollCrowdAppearance(crowdAppearanceRng(pos));
    const appearance = appearanceOverride ? {...rolledAppearance,...appearanceOverride} : rolledAppearance;
    const shirt = appearance.shirt;
    let tieDye = 0;
    if (appearance.tieDye) tieDye = appearance.tieDyeAmount;
    const accentHex = appearance.accent;

    const npc = {
      idx,
      behaviorSeed: MAX_NPCS - 1 - idx,
      pos: pos.clone(),
      vel: new THREE.Vector3(),
      target: pos.clone(),
      yaw: rng() * Math.PI * 2,
      baseYaw: rng() * Math.PI * 2,
      bob: rng() * Math.PI * 2,
      scale: 0.85 + rng() * 0.4,
      shirt,
      appearance,
      hairSlot: this._hairFree[appearance.hairStyle].pop(),

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
      // this many seconds (accepted population time). Lets you actually leave a crowd
      // behind instead of being permanently mobbed.
      disinterestedUntil: 0,

      // A seated display height, with reservation authority held by the activity.
      picnicY: undefined,

      chunkKey,
    };

    Object.assign(npc, photographerProfile(pos, forcePhotographer));
    if (!allowPhotographer) npc.isPhotographer = false;
    npc.photoSlot = -1;
    npc.drinkSlot = appearance.hasDrink ? this._drinkFree.pop() : -1;
    if (npc.drinkSlot >= 0) this._drinkDrawCount = Math.max(this._drinkDrawCount, npc.drinkSlot + 1);
    if (npc.isPhotographer) {
      npc.photoSlot = this._photoFree.pop();
      this._photographerCount++;
      if (npc.photoSlot + 1 > this._photoDrawCount) this._photoDrawCount = npc.photoSlot + 1;
    }

    this.npcs.push(npc);
    npc.personHandle=this.peopleHandles.create(npc.idx,npc);

    // Track the highest-ever slot index so we can narrow draw count each frame.
    if (idx > this._maxIdx) this._maxIdx = idx;

    // Color — shirt applied to both body (torso) and arms (sleeves) so they match.
    const c = new THREE.Color(shirt);
    this.bodyMesh.instanceColor.setXYZ(idx, c.r, c.g, c.b);
    this.bodyMesh.instanceColor.needsUpdate = true;
    this.armsMesh.instanceColor.setXYZ(idx, c.r, c.g, c.b);
    this.armsMesh.instanceColor.needsUpdate = true;
    const skin = new THREE.Color(appearance.skin);
    const hair = new THREE.Color(appearance.hair);
    const pants = new THREE.Color([0x444c56, 0x675a4e, 0x394d5a, 0x6e665b][appearance.outfit]);
    const drink = new THREE.Color(appearance.drink);
    this.headMesh.instanceColor.setXYZ(idx, skin.r, skin.g, skin.b);
    this.legsMesh.instanceColor.setXYZ(idx, pants.r, pants.g, pants.b);
    const hairMesh = this.hairMeshes[appearance.hairStyle];
    hairMesh.instanceColor.setXYZ(npc.hairSlot, hair.r, hair.g, hair.b);
    this._hairDrawCounts[appearance.hairStyle] = Math.max(this._hairDrawCounts[appearance.hairStyle], npc.hairSlot + 1);
    if (npc.drinkSlot >= 0) this.drinkMesh.instanceColor.setXYZ(npc.drinkSlot, drink.r, drink.g, drink.b);
    this.headMesh.instanceColor.needsUpdate = true;
    this.legsMesh.instanceColor.needsUpdate = true;
    hairMesh.instanceColor.needsUpdate = true;
    if (npc.drinkSlot >= 0) this.drinkMesh.instanceColor.needsUpdate = true;
    // Tie-dye accent + amount. Both bodyMesh + armsMesh share the underlying
    // Float32Array but have separate InstancedBufferAttribute wrappers, so we
    // must flag needsUpdate on both attribute objects each time.
    const ac = new THREE.Color(accentHex);
    this._shirtAccentData[idx * 3 + 0] = ac.r;
    this._shirtAccentData[idx * 3 + 1] = ac.g;
    this._shirtAccentData[idx * 3 + 2] = ac.b;
    this._shirtTieDyeData[idx] = tieDye;
    this._styleData[idx] = appearance.outfit;
    this._skinData[idx * 3] = skin.r;
    this._skinData[idx * 3 + 1] = skin.g;
    this._skinData[idx * 3 + 2] = skin.b;
    for (const a of this._shirtAccentAttrs) a.needsUpdate = true;
    for (const a of this._shirtTieDyeAttrs) a.needsUpdate = true;
    for (const a of this._skinAttrs) a.needsUpdate = true;
    this._styleAttrBody.needsUpdate = true;

    // Keep the ordinary scale draw even in fixtures so later personality draws agree.
    if(scale!==null)npc.scale=scale;
    // Initial transform
    this._writeMatrices(npc);

    return npc;
  }

  // Cheap debug/sandbox trigger. If the loaded crowd has no organic
  // photographer, promote one existing NPC with the same isolated profile
  // initializer, then run the real notice -> pose -> flash state machine.
  _photographerTarget(handle,requireRole=false) {
    const eligible=n=>this.peopleHandles.isLive(n.personHandle)&&!n.party&&!n.seatSlot&&!this.activityClaims.current.has(n.personHandle)
      &&(ORDINARY_SOCIAL_STATES.has(n.state)||isPhotographerState(n.state))&&(!requireRole||n.isPhotographer);
    if(handle!==null){const n=this.peopleHandles.resolve(handle);return n&&eligible(n)?n:null;}
    return this.npcs.find(n=>n.isPhotographer&&eligible(n))??(!requireRole?this.npcs.find(eligible):null)??null;
  }
  forcePhotographer(handle=null) {
    const target=this._photographerTarget(handle);if(!target)return null;
    if(!target.isPhotographer){
      if(!this._photoFree.length)return null;
      Object.assign(target,photographerProfile(target.pos,true));target.photoSlot=this._photoFree.pop();this._photographerCount++;
      this._photoDrawCount=Math.max(this._photoDrawCount,target.photoSlot+1);
    }
    startPhotographerShot(target);this._writeMatrices(target);return target.personHandle;
  }
  triggerPhotographer(handle=null) {
    const target=this._photographerTarget(handle,true);if(!target)return null;
    startPhotographerShot(target);this._writeMatrices(target);return target.personHandle;
  }
  previewPhotographerFlash(handle=null,duration=.6) {
    const target=handle===null?this.npcs.find(n=>n.isPhotographer&&this.peopleHandles.isLive(n.personHandle)):this.peopleHandles.resolve(handle);
    if(!target?.isPhotographer)return null;
    if(!Number.isFinite(duration)||duration<0)throw new TypeError('Photographer preview duration must be finite and nonnegative.');
    target.photoFlashTimer=Math.max(PHOTO_FLASH_DURATION,duration);this._writeMatrices(target);return target.personHandle;
  }
  readPhotographer(handle,out) {
    const n=this.peopleHandles.resolve(handle);if(!n)return false;
    this.peopleHandles.readOwnedRecord(n,out);out.photographer=!!n.isPhotographer;out.crouch=!!n.photoCrouch;out.flash=n.photoFlashTimer??0;return true;
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
      if (s.startsWith('camp_')) continue;
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
    if(this._removalSweep)return;
    const zx=zerble.position.x,zz=zerble.position.z,kept=[];
    let freed=0;let errors=null;
    this._removalSweep=true;this._removedDuringSweep=false;
    try {
      for(const npc of this.npcs) {
        if(npc._removing){freed++;continue;}
        if(npc.party||npc.state==='riding'||npc.state==='boarding'){kept.push(npc);continue;}
        const dx=npc.pos.x-zx,dz=npc.pos.z-zz;
        if(dx*dx+dz*dz>DESPAWN_R2){try{this._releaseNpc(npc);}catch(error){(errors??=[]).push(error);}freed++;}
        else kept.push(npc);
      }
    } finally {this._removalSweep=false;}
    if(freed||this._removedDuringSweep){
      // Borrower callbacks can remove a peer already visited by this sweep.
      // Keep the source array stable until traversal ends, then compact once.
      let live=0;for(const npc of kept)if(!npc._removing)kept[live++]=npc;
      kept.length=live;this.npcs=kept;this._publishPopulationRanges();
    }
    if(errors)throw new AggregateError(errors,'Distance cleanup failed.');
  }

  // -------------- per-frame --------------

  update(dt, zerble, bubbles) {
    if(this._disposed)return;
    this.actorTime=(this.actorTime??0)+dt;
    if (this._perf.on) this._perf.frames++;
    // First sweep: free any NPC who has drifted too far from Zerble. Lifecycle
    // is intentionally distance-based (not chunk-based) so wandering NPCs
    // don't vanish when their spawn chunk unloads.
    this._despawnDistant(zerble);
    this.frameTrace?.mark('crowd.despawn', this.npcs.length);
    this.campJams.update(dt, zerble, this.campTimeOfDay?.t ?? getTimeOfDay()?.t ?? .25);
    this.frameTrace?.mark('crowd.camp-sessions');
    for (const party of this.parties) party.update(dt, zerble);
    this.frameTrace?.mark('crowd.parties');

    const cosCone = Math.cos((SMILE_CONE_DEG * Math.PI) / 180);

    // Collect live bubble positions once per frame
    const bubblePositions = [];
    if (bubbles) bubbles.forEachAlive((b) => bubblePositions.push(b.pos));

    // Passenger bookkeeping: count active passengers + record Zerble idle state
    const zerbleIdle = Math.abs(zerble.speed) < ZERBLE_IDLE_SPEED;
    let activePassengers = 0;
    for (const n of this.npcs) {
      if ((n.state === 'boarding' || n.state === 'riding') && !n.seatSlot?.vehicle) activePassengers++;
    }

    // Rebuild the separation broadphase from this frame's positions (riding
    // NPCs excluded — the separation pass skips them anyway). One O(n) pass
    // that turns each NPC's O(n) neighbour scan into a ~9-cell query.
    this._sepGrid.clear();
    for (const n of this.npcs) {
      if (n.state !== 'riding' && n.state !== 'camp_sleeping' && !n.campJamHidden) this._sepGrid.insert(n.pos.x, n.pos.z, n);
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
    this.frameTrace?.mark('crowd.individuals');

    this.legsMesh.instanceMatrix.needsUpdate = true;
    this.shoesMesh.instanceMatrix.needsUpdate = true;
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.armsMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.eyesMesh.instanceMatrix.needsUpdate = true;
    this.mouthMesh.instanceMatrix.needsUpdate = true;
    for (let style = 0; style < this.hairMeshes.length; style++) {
      if (this._hairDrawCounts[style] > 0) this.hairMeshes[style].instanceMatrix.needsUpdate = true;
      this.hairMeshes[style].count = this._hairDrawCounts[style];
    }
    if (this._photographerCount > 0) {
      this.cameraMesh.instanceMatrix.needsUpdate = true;
      this.flashMesh.instanceMatrix.needsUpdate = true;
    }
    if (this._drinkDrawCount > 0) this.drinkMesh.instanceMatrix.needsUpdate = true;
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
    this.drinkMesh.count = this._drinkDrawCount;
    this.shoppingBagMesh.count = this._maxIdx + 1;
    this.shoppingBagMesh.visible = this.npcs.some(n => n.shoppingBagTime > 0);
    this.shoppingBagMesh.instanceMatrix.needsUpdate = true;
    this.frameTrace?.mark('crowd.render-publication');
  }

  _interruptActivityForCart(npc, zerble) {
    const active=this.activityClaims.current.get(npc.personHandle);
    if(!active||!(active.claim.owner.canInterruptForCart?.(npc.personHandle)??active.claim.owner.interruptibleByCart)||!zerble?.forwardWorld)return false;
    const dx=npc.pos.x-zerble.position.x,dz=npc.pos.z-zerble.position.z;
    const tooClose=Math.hypot(dx,dz)<(active.claim.owner.cartClearance??0);
    if(!tooClose&&(this.starActive||!laneDodgeTest(dx,dz,zerble.forwardWorld.x,zerble.forwardWorld.z,zerble.speed)))return false;
    if(this._abandonSeat(npc)===false)return false;
    this.activityClaims.removePerson(npc.personHandle,'dodge');
    npc.state='fleeing';npc.fleeUrgency=laneDodgeUrgency(zerble.speed);npc.stateTimer=DODGE.LOCK;
    return true;
  }

  _updateNpc(dt, npc, zerble, bubblePositions, cosCone, ctx) {
    const external=this.activityClaims.current.get(npc.personHandle);
    if (external&&!this._inlineActivities.has(external.claim.owner)) {
      if(!this._interruptActivityForCart(npc,zerble)){this._writeMatrices(npc);return;}
    }
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

    npc.shoppingBagTime = Math.max(0, (npc.shoppingBagTime || 0) - dt);
    if (this._tickMarket(dt, npc, zerble)) return;
    if (this.campJams.tickPerson(dt,npc.personHandle)) return;
    if (this._tickCamp(dt, npc)) return;

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
      npc, dt, dToZerble, ORDINARY_SOCIAL_STATES.has(npc.state)
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
    const nowSec = this.actorTime??0;
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
      if(this._abandonSeat(npc)===false)return; // wait for a clear way out
      npc.state = 'fleeing';
      // Speed-scaled: calm sidestep for a cruising cart, urgent scramble for a
      // fast one (hits on fleeing NPCs count now — the dodge must be winnable).
      npc.fleeUrgency = laneDodgeUrgency(zerble.speed);
      npc.stateTimer = DODGE.LOCK;       // brief commit, then re-evaluate (re-dodges if still in the lane)
    } else if (!npc.party && !fleeingLocked && !disinterested) {
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
          const slot = this._claimFreeSeat(zerble,npc);
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
          !npc.party && npc.skittish < 0.5 &&
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
          (!npc.party || npc.party.allowActivity(npc.personHandle)) && !this.picnics.has(npc.personHandle) &&
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
          (!npc.party || npc.party.allowActivity(npc.personHandle)) && !this.bathrooms.has(npc.personHandle) &&
          npc.skittish < 0.75 &&
          Math.random() < dt * POTTY_URGE_RATE
        ) {
          if (this.bathrooms.tryClaim(npc.personHandle)) break;
        }
        if (npc.party) break;
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
        npc.yaw += idleSwayDelta(npc.bob,npc.dance,dt);
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
          speed = walkingArrivalSpeed(1.4*npc.energy,td,ARRIVE_RADIUS);
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
        laneDodgeDir(-dx, -dz, fwd.x, fwd.z, (npc.behaviorSeed & 1) === 1, _dodgeOut);
        // Small per-frame wobble so the dodge curves a touch instead of being
        // a clean rail. No stable per-NPC jitter here — a fixed offset could
        // rotate some NPCs back toward the lane we're trying to clear.
        const wobble = Math.sin((this.actorTime??0) * 4 + npc.behaviorSeed) * 0.12;
        const cosW = Math.cos(wobble);
        const sinW = Math.sin(wobble);
        desiredX = _dodgeOut.x * cosW - _dodgeOut.z * sinW;
        desiredZ = _dodgeOut.x * sinW + _dodgeOut.z * cosW;
        // Per-NPC speed variation (±15%) so even same-side neighbors don't
        // move in lockstep.
        const speedJitter = 0.85 + (npc.behaviorSeed % 7) * 0.05;  // 0.85..1.15
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
      canSmile(npc,zerble.position,dToZerble,SMILE_RANGE,SMILE_RESET_DIST)
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
          this.smiles.spawnLost(zerble.position, npc.personHandle, this.peopleView);   // reddish "lost smile" flies out to them
          if (this.onFrown) this.onFrown(npc.personHandle);
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
          resetSmile(npc,zerble.position,SMILE_TIME_COOLDOWN);
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
    const reaction=npc._reactionPose&&this.activityClaims.canWrite(npc._reactionPose.claim)?npc._reactionPose:null;
    if(!reaction)groundNpc(npc);
    if (npc.state === 'camp_sleeping' || npc.campJamHidden || npc._activityBinding?.hidden) { this._hideNpc(npc); return; }
    if (npc.party) { this._hideNpc(npc); publishGroupBinding(npc); return; }
    // Bo is rendered by the wagon, while the crowd still owns his reserved seat.
    if (npc.seatSlot?.permanent && npc.seatSlot.vehicle?.driverModel) {
      this._hideNpc(npc);
      if (npc.isPhotographer) {
        this.cameraMesh.setMatrixAt(npc.photoSlot, this._zeroMat);
        this.flashMesh.setMatrixAt(npc.photoSlot, this._zeroMat);
      }
      return;
    }
    const walk=reaction?(this._reactionWalkPose??={active:false,stride:0,arm:0,bob:0}):sampleWalkMotion(npc,this._walkPose??={});
    const m = this._mat4;
    const photo=npc.isPhotographer
      ? samplePhotographerPose(npc.state,npc.stateTimer,npc.photoCrouch,npc.photoFlashTimer,this._photoRenderProfile??={})
      : (this._noPhotoRenderProfile??={photographing:false,crouch:false,crouchDrop:0});
    const photographing=photo.photographing;
    // Reuse scratch Quaternion/Euler — avoids ~30k allocations/sec at 500 NPCs × 60fps.
    // hammock_riding NPCs need a supine rotation (X=+π/2 face up, then Y=yaw); all
    // others just rotate around Y by yaw. Build the right quat per branch.
    // Dancefloor NPCs bounce harder + sway more, on a phase seeded by their
    // dance value so neighbors aren't in lockstep. Unique-feeling moves come
    // from a sum of sin terms at staggered frequencies — different `dance`
    // values produce visibly different rhythms within the crowd. Computed
    // BEFORE the quat composition so the yaw wiggle can layer onto npc.yaw.
    const activityOwner=this.activityClaims.current.get(npc.personHandle)?.claim.owner;
    const hula=!reaction&&activityOwner?.sampleBodyPose?.(npc.personHandle,this._activityBodyPose??={});
    if(hula&&(!Number.isFinite(hula.bob)||!Number.isFinite(hula.leanX)||!Number.isFinite(hula.leanZ)))throw new TypeError('Activity body pose must be finite.');
    const articulated=hula?.articulated===true;
    const flowFeet=articulated?hula.feet:null;
    if(flowFeet){validateHoopFeet(flowFeet);if(!Number.isFinite(hula.rootY))throw new TypeError('Planted flow requires a finite root height.');}
    const flowSupport=articulated?(flowFeet?hula.rootY:hoopFootLift(hula.stride??0,hula.leanX,hula.leanZ))*npc.scale:0;
    const danceActivity=!reaction&&!!activityOwner?.isDancePerson?.(npc.personHandle);
    const stageDancing=!activityOwner&&isStageDancing(npc.state,npc.onDancefloor,npc.dance);
    let bobY;
    let danceTilt;
    let danceYawWiggle = 0;
    if (stageDancing || danceActivity) {
      const beat=npc.bob*3.8+npc.dance*6;
      bobY=Math.max(0,Math.sin(beat*2))*.12*npc.scale;
      danceTilt=Math.sin(beat)*.13;
      danceYawWiggle=Math.sin(beat*.5)*.12;
    } else {
      // Idle feet stay grounded; locomotion owns the small hip rise/reach.
      bobY = walk.active ? walk.bob : 0;
      danceTilt = npc.dance > 0.6 && (npc.state === 'idle' || npc.state === 'watching' || npc.state === 'riding')
        ? Math.sin(npc.bob * 2) * 0.05 * (npc.dance - 0.5)
        : 0;
    }
    if(hula){bobY=articulated?flowSupport:hula.bob*npc.scale;danceTilt=hula.leanZ;danceYawWiggle=0;}
    // Unhappy NPCs don't vibe — kill the bounce + sway while frowning.
    if (npc.frownTimer > 0 || photographing) { bobY = flowSupport; danceTilt = 0; danceYawWiggle = 0; }

    // Chair contact stays fixed even near dancefloors or while smiling. A
    // feet-origin bob/tilt moves the pelvis through the supporting fabric.
    if (npc.state === 'camp_seated' || npc.picnicCrossLegged || npc.campMusic) { bobY = 0; danceTilt = 0; danceYawWiggle = 0; }
    if(reaction){bobY=0;danceTilt=0;danceYawWiggle=0;}

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
    const bouncing = !reaction && npc.smileTimeCooldown > 0 && !photographing && !npc.campMusic;
    const bounceY = bouncing
      ? Math.abs(Math.sin((this.actorTime??0) * 12 + npc.bob)) * 0.06
      : 0;

    // Cheer jump: positive-half sine so NPCs hop upward without clipping the floor.
    // Seeded by the stable behavior slot so pooling stays visually decoupled.
    const cheering = !reaction && npc.cheerTimer > 0 && !npc.campMusic && !photographing;
    const cheerY = cheering
      ? Math.max(0, Math.sin((this.actorTime??0) * HOP_HZ + npc.behaviorSeed * 1.3)) * HOP_HEIGHT
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
    //   - normal:        feet at the sampled ground position
    // Seated riders (bench / driver / roof) sit with their butt on the seat;
    // running-board riders stand. Computed here so it drives both the lift and
    // the leg bend below.
    const seated = reaction?reaction.seated:(npc.state === 'riding' && npc.seatSlot &&
      (npc.seatSlot.kind === 'bench' || npc.seatSlot.kind === 'driver_seat' || npc.seatSlot.kind === 'roof'))
      || npc.pottySitting                  // caught sitting on the potty — same forward leg bend
      || npc.state === 'table_seated' || npc.state === 'camp_seated';     // sitting on a picnic bench — same forward leg bend
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
      // Wagon cushions use the actual hip pivot; Zerble retains its existing pose.
      const hipOffset = npc.seatSlot?.vehicle ? .62 * npc.scale : .4;
      feetY = (seated ? npc.seatY - hipOffset : npc.seatSlot?.vehicle ? npc.seatY : npc.seatY - 1.05) + bobY + bounceY;
    } else if (npc.state === 'hammock_riding' && npc.hammockY != null) {
      // Supine: body lies horizontal with back pressed into the cloth. After
      // X=π/2 the body's "up" direction (away from back) is +Y. The torso
      // capsule is ~0.26 thick, but we want the back to SINK into the sag
      // slightly — so lift by only 0.16, not the full half-thickness.
      feetY = npc.hammockY + 0.16 + bobY + bounceY;
    } else if (npc.state === 'camp_seated' && npc.campY!==undefined) {
      // The torso capsule extends below the leg pivot. Align its rounded
      // bottom to the actual fabric height, keeping a centimetre of clearance.
      feetY = npc.campY - BODY_SEATED_BOTTOM * npc.scale + 0.01;
    } else if (npc.state === 'table_seated' && npc.picnicY!=null) {
      // Butt on the bench cushion; bent legs hang forward (the `seated` leg bend).
      // Same -0.4 hip drop a seated cart rider uses so the hip lands on the seat.
      feetY = npc.picnicCrossLegged ? npc.picnicY-BODY_SEATED_BOTTOM*npc.scale+.01 : npc.picnicY - 0.4 + bobY;
    } else {
      feetY = npc.pos.y + bobY + bounceY + cheerY; // authoritative ground position plus animation
    }
    // A planted score owns its full pelvis height; generic happy/cheer hops
    // would slide both authored soles through their fixed ground contacts.
    if(flowFeet)feetY=npc.pos.y+flowSupport;
    feetY-=photo.crouchDrop*npc.scale;

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
    if(reaction){posV.set(reaction.x,reaction.y,reaction.z);quat.set(reaction.qx,reaction.qy,reaction.qz,reaction.qw);}
    m.compose(posV, quat, scaleV);
    if (danceTilt && !hula) {
      // Reuse scratch Matrix4 — avoids per-NPC allocation for dancing crowd.
      this._tmpDanceMat.makeRotationZ(danceTilt);
      m.multiply(this._tmpDanceMat);
    }

    if(hula){this._tmpDanceMat.makeRotationFromEuler(this._tmpEuler.set(hula.leanX,0,hula.leanZ));m.multiply(this._tmpDanceMat);}

    // Write the same transform to legs/shoes/body/arms/head/eyes — per-part offsets live in geometry.
    // Eyes also use this matrix (eyes geometry has offsets baked in, no scale reaction).
    // Exception: seated riders (bench / driver / roof — see `seated` above) get
    // their legs+shoes bent forward at the hip so they sit; the upright
    // body/arms/head still use `m`. Standing running-board riders keep straight legs.
    // Cheering NPCs get arms rotated up via _armsUpMat (same pattern as _sitLegMat).
    // Keep the relaxed knee bend between shots, but leave travel and special
    // activities to their own leg poses. Photo soles cancel the pelvis drop.
    const plantedPhoto=npc.isPhotographer&&(photographing||ORDINARY_SOCIAL_STATES.has(npc.state))&&!walk.active&&!seated&&!hula&&!cheering;
    this._writeHoopFeet(npc,flowFeet??(plantedPhoto?photo.feet:null));
    const folded=!reaction&&!!npc.picnicCrossLegged&&npc.state==='table_seated';
    for(const mesh of [this.legsMesh,this.shoesMesh]){const a=mesh.geometry.getAttribute('crossLegged');a.setX(npc.idx,folded?1:0);a.needsUpdate=true;}
    for(const mesh of [this.legsMesh,this.shoesMesh]){
      const stride=mesh.geometry.getAttribute('walkStride');
      stride.setX(npc.idx,articulated?(hula.stride??0):folded||seated||photo.crouch||hula||stageDancing||danceActivity?0:walk.stride);
      stride.needsUpdate=true;
    }
    if(folded){this.legsMesh.setMatrixAt(npc.idx,m);this.shoesMesh.setMatrixAt(npc.idx,m);}
    else if (photo.crouch) {
      this.legsMesh.setMatrixAt(npc.idx, m);
      this.shoesMesh.setMatrixAt(npc.idx, m);
    } else if (seated) {
      let legPose=this._sitLegMat;
      if(reaction&&reaction.seatBlend<1) {
        const bend=1.25*reaction.seatBlend;
        legPose=this._reactionLegMat??=new THREE.Matrix4();
        legPose.makeRotationX(bend).setPosition(0,.62*(1-Math.cos(bend)),-.62*Math.sin(bend));
      }
      this._legMat.multiplyMatrices(m, legPose);
      this.legsMesh.setMatrixAt(npc.idx, this._legMat);
      this.shoesMesh.setMatrixAt(npc.idx, this._legMat);
    } else {
      this.legsMesh.setMatrixAt(npc.idx, m);
      this.shoesMesh.setMatrixAt(npc.idx, m);
    }
    this.bodyMesh.setMatrixAt(npc.idx, m);
    const armPose=npc._activityArmPose;
    const hasArmPose=!!armPose&&this.activityClaims.canWrite(armPose.claim);
    const holdingCamera=npc.isPhotographer&&(photographing||ORDINARY_SOCIAL_STATES.has(npc.state)||walk.active)&&!seated&&!npc.campInstrument&&!npc.campMusic&&!hasArmPose&&!hula&&!cheering;
    this.shoppingBagMesh?.setMatrixAt(npc.idx, npc.shoppingBagTime > 0 && !holdingCamera ? m : this._zeroMat);
    const dancing=!holdingCamera&&!seated&&!npc.campMusic&&!npc.campInstrument&&!photographing&&!npc.seatSlot&&npc.frownTimer<=0&&(stageDancing||danceActivity);
    if (npc.campInstrument) {
      const active = npc.campMusicStage === 'playing';
      const bend = npc.campInstrument.kind === 'fiddle' ? 1.45 : 1.12;
      this._musicArmMat.makeTranslation(0, ARM_SHOULDER_Y, 0)
        .multiply(this._tmpDanceMat.makeRotationX(bend + (active ? Math.sin(npc.bob * 7) * .07 : 0)))
        .multiply(this._musicPivotMat.makeTranslation(0, -ARM_SHOULDER_Y, 0));
      this._armsMat.multiplyMatrices(m, this._musicArmMat);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    } else if (!holdingCamera && (npc.state === 'market_chatting' || npc.state === 'market_buying')) {
      this._musicArmMat.makeTranslation(0, ARM_SHOULDER_Y, 0)
        .multiply(this._tmpDanceMat.makeRotationX(.65 + Math.sin(npc.bob * 3) * .14))
        .multiply(this._musicPivotMat.makeTranslation(0, -ARM_SHOULDER_Y, 0));
      this._armsMat.multiplyMatrices(m, this._musicArmMat);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    } else if (holdingCamera) {
      this._armsMat.copy(m);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    } else if (hasArmPose || hula || dancing) {
      // An articulated pose already rotates at each shoulder. A cheer can
      // still move the body, but must not add a second arm-space rotation.
      this._armsMat.copy(m);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    } else if (cheering || (npc.state === 'riding' && npc.seatSlot?.name === 'platform')) {
      this._armsMat.multiplyMatrices(m, this._armsUpMat);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    } else {
      this._armsMat.copy(m);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    }
    const armAttr=this.armsMesh.geometry.getAttribute('armPose');
    const leftAttr=this.armsMesh.geometry.getAttribute('armLeftPose');
    leftAttr.setXY(npc.idx,(hasArmPose||hula) ? .03 : 0,0);
    if(holdingCamera){
      armAttr.setXYZW(npc.idx,photo.armX,photo.armZ,photo.elbow,-photo.armZ);
      leftAttr.setXY(npc.idx,photo.armX,-photo.elbow);
    }else if(hasArmPose){
      armAttr.setXYZW(npc.idx,armPose.x,armPose.z,armPose.elbow,armPose.leftZ);
      sampleArmHand(armPose,armPose.hand).applyMatrix4(this._armsMat);
    }else if(articulated){
      const a=hula.arms;
      if(!a||!Number.isFinite(a.x)||!Number.isFinite(a.z)||!Number.isFinite(a.elbow)||!Number.isFinite(a.leftX)||!Number.isFinite(a.leftZ)||!Number.isFinite(a.leftElbow))throw new TypeError('Flow arms must be finite.');
      armAttr.setXYZW(npc.idx,a.x,a.z,a.elbow,a.leftZ);leftAttr.setXY(npc.idx,a.leftX,a.leftElbow);
    }else if(hula){armAttr.setXYZW(npc.idx,.03,2.45,-.20,-2.45);}
    else if(dancing){const pose=sampleDanceArmPose(npc.bob,npc.dance,this._danceArmPose??={});armAttr.setXYZW(npc.idx,pose.x,pose.z,pose.elbow,pose.leftZ);leftAttr.setXY(npc.idx,pose.leftX,pose.leftElbow);}
    else if(walk.active&&!seated&&!photographing&&!cheering&&!npc.campInstrument&&!npc.campMusic){
      // Keep occupied hands steady so their existing rigid props stay attached.
      armAttr.setXYZW(npc.idx,npc.drinkSlot>=0?0:walk.arm,0,0,0);
      leftAttr.setXY(npc.idx,npc.shoppingBagTime>0?0:-walk.arm,0);
    }
    else {armAttr.setXYZW(npc.idx,0,0,0,0);}
    armAttr.needsUpdate=true;leftAttr.needsUpdate=true;
    let headM=m;
    if(articulated){
      this._tmpDanceMat.makeRotationFromEuler(this._tmpEuler.set(0,hula.headYaw??0,hula.headTilt??0));
      this._flowHeadLocalMat.makeTranslation(0,1.65,0).multiply(this._tmpDanceMat).multiply(this._musicPivotMat.makeTranslation(0,-1.65,0));
      headM=this._flowHeadMat.multiplyMatrices(m,this._flowHeadLocalMat);
    }
    this.headMesh.setMatrixAt(npc.idx, headM);
    this.eyesMesh.setMatrixAt(npc.idx, headM);
    const hairStyle = npc.appearance?.hairStyle || 0;
    const hairYScale = hairStyle === 0 ? 0.92 : 1;
    this._tmpV3.set(0, 1.78 * (1 - hairYScale), 0);
    this._tmpScale.set(0.98, hairYScale, hairStyle === 2 ? 1.02 : 0.98);
    this._hairLocalMat.compose(this._tmpV3, this._identityQuat, this._tmpScale);
    this._hairMat.multiplyMatrices(headM, this._hairLocalMat);
    this.hairMeshes[hairStyle].setMatrixAt(npc.hairSlot, this._hairMat);
    if (npc.drinkSlot >= 0 && !holdingCamera && !photographing && !npc.campInstrument && !armPose && !hula) {
      this._tmpV3.set(0.34, 0, -0.07);
      this._tmpScale.set(0.76, 0.76, 0.76);
      this._drinkLocalMat.compose(this._tmpV3, this._identityQuat, this._tmpScale);
      this._drinkMat.multiplyMatrices(this._armsMat, this._drinkLocalMat);
      this.drinkMesh.setMatrixAt(npc.drinkSlot, this._drinkMat);
    } else if (npc.drinkSlot >= 0) {
      this.drinkMesh.setMatrixAt(npc.drinkSlot, this._zeroMat);
    }
    if (npc.campInstrument) this._writeCampInstrument(npc, m);

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
    this._mouthMat.multiplyMatrices(headM, this._mouthLocalMat);
    this.mouthMesh.setMatrixAt(npc.idx, this._mouthMat);

    if (npc.isPhotographer) {
      // The hands and prop share the same eased lift, including the flash.
      this._photoCameraLocalMat.makeTranslation(0,photo.cameraY-1.20,0);
      this._photoCameraMat.multiplyMatrices(m,this._photoCameraLocalMat);
      this.cameraMesh.setMatrixAt(npc.photoSlot, this._photoCameraMat);
      if (photo.flashVisible) {
        const flashScale=photo.flashScale;
        this._tmpV3.set(0, photo.cameraY, -0.62);
        this._tmpScale.set(flashScale, flashScale, flashScale);
        this._flashLocalMat.compose(this._tmpV3, this._identityQuat, this._tmpScale);
        this._flashMat.multiplyMatrices(m, this._flashLocalMat);
        this.flashMesh.setMatrixAt(npc.photoSlot, this._flashMat);
      } else {
        this.flashMesh.setMatrixAt(npc.photoSlot, this._zeroMat);
      }
    }
  }

  _writeCampInstrument(npc, bodyMatrix) {
    const model = npc.campInstrument;
    const performing = ['ready', 'playing'].includes(npc.campMusicStage);
    const bass = model.kind === 'bass', fiddle = model.kind === 'fiddle';
    this._tmpV3.set(bass ? .38 : fiddle && performing ? .07 : .1,
      bass ? .57 : fiddle && performing ? 1.43 : performing ? .95 : .85,
      bass ? -.35 : fiddle && performing ? -.34 : -.4);
    this._tmpScale.set(1, 1, 1);
    this._tmpQuat.setFromEuler(this._tmpEuler.set(0, Math.PI, bass ? 0 : fiddle && performing ? -1.28 : performing ? -1.02 : -.25));
    this._instrumentLocalMat.compose(this._tmpV3, this._tmpQuat, this._tmpScale);
    model.group.matrixAutoUpdate = false;
    model.group.matrix.copy(bodyMatrix).multiply(this._instrumentLocalMat);
    model.group.matrixWorldNeedsUpdate = true;
    model.group.visible = true;
  }

  // ----- Passenger system helpers -----

  _claimFreeSeat(zerble,npc) {
    if (!zerble.seatSlots) return null;
    // Try slots in a randomized order so passengers don't all stack the same way
    const order = zerble.seatSlots.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const idx of order) {
      const slot = zerble.seatSlots[idx];
      if(!slot.occupied&&this._reservePassenger(npc,zerble,slot))return slot;
    }
    return null;
  }

  _reservePassenger(npc,vehicle,slot,{allowPermanent=false}={}) {
    if(!this.peopleHandles.isLive(npc.personHandle)||npc.seatSlot||this.activityClaims.current.has(npc.personHandle))return false;
    const reservation=this.seatReservations.reserve({person:npc.personHandle,vehicle,slot,allowPermanent});
    if(!reservation)return false;
    npc.seatSlot=slot;npc._seatReservation=reservation;return true;
  }

  beginBoarding(handle,vehicle,{slot,timeout=20,cooldownKey=null,cooldownUntil=null}={}) {
    const npc=this.peopleHandles.resolve(handle);
    if(!Number.isFinite(timeout)||timeout<0||(cooldownUntil!==null&&!Number.isFinite(cooldownUntil))
      ||(cooldownUntil!==null&&(typeof cooldownKey!=='string'||!cooldownKey)))throw new TypeError('Boarding timing and cooldown ownership must be explicit.');
    if(!npc||npc.party||!['idle','walking','watching','approaching'].includes(npc.state)||!this._reservePassenger(npc,vehicle,slot))return false;
    npc.state='boarding';npc.stateTimer=timeout;
    if(cooldownUntil!==null){npc._activityCooldowns??=new Map();npc._activityCooldowns.set(cooldownKey,cooldownUntil);}
    return true;
  }

  seatPerson(handle,vehicle,slot,{rideTime=Infinity,allowPermanent=false,scale=null,snap=true}={}) {
    const npc=this.peopleHandles.resolve(handle);
    if((!Number.isFinite(rideTime)&&rideTime!==Infinity)||rideTime<0||(scale!==null&&(!Number.isFinite(scale)||scale<=0)))throw new TypeError('Passenger pose settings must be valid.');
    if(!npc||npc.party||!['idle','walking','watching','approaching'].includes(npc.state)||!this._reservePassenger(npc,vehicle,slot,{allowPermanent}))return false;
    npc.state='riding';npc.rideTimer=rideTime;if(scale!==null)npc.scale=scale;
    if(snap){const out=this._tmpV;vehicle.worldSeatPosition(slot,out);npc.pos.set(out.x,0,out.z);npc.seatY=out.y;npc.yaw=vehicle.heading+slot.yaw;}
    this._publishPerson(npc);return true;
  }

  _releaseSeat(npc) {
    const released=this.seatReservations?.release(npc._seatReservation);
    npc._seatReservation=null;return !!released;
  }

  releaseVehiclePassengers(vehicle) {
    for(const npc of this.npcs)if(npc._seatReservation?.vehicle===vehicle){
      this._releaseSeat(npc);npc.seatSlot=null;npc.seatY=undefined;npc.state='idle';npc.stateTimer=2;
      this._publishPerson(npc);
    }
    this.seatReservations.releaseVehicle(vehicle);
  }

  _tickBoarding(dt, npc, zerble, ctx) {
    const vehicle = npc.seatSlot?.vehicle;
    if (vehicle) zerble = vehicle;
    if (!npc.seatSlot || !this.seatReservations.isLive(npc._seatReservation) || (vehicle ? vehicle.state !== 'parked' : !ctx.zerbleIdle)) {
      if (npc.party) { npc.party.leave(); return; }
      // Cart started moving (or we lost our slot) — abort
      this._releaseSeat(npc);
      npc.seatSlot = null;
      npc.state = 'watching';
      npc.stateTimer = 1;
      return;
    }
    const target = this._tmpV;
    this.seatReservations.readTarget(npc._seatReservation,target);

    const tdx = target.x - npc.pos.x;
    const tdz = target.z - npc.pos.z;
    const td = Math.hypot(tdx, tdz);

    if (td < BOARD_RANGE) {
      if (npc.party) {
        npc.vel.set(0, 0, 0);
        npc.party.arrive(npc.personHandle,npc._groupSeatReservation);
        if (npc.state === 'riding') this._tickRiding(0, npc, zerble);
        else this._writeMatrices(npc);
        return;
      }
      // Climb aboard
      npc.state = 'riding';
      npc.rideTimer = RIDE_MIN_TIME + Math.random() * (RIDE_MAX_TIME - RIDE_MIN_TIME);
      this._writeMatrices(npc); // snap into place
      if (this.onBoard && !vehicle) this.onBoard(npc);
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
      if (npc.party) { npc.party.leave(); return; }
      this._releaseSeat(npc);
      npc.seatSlot = null;
      npc.state = 'idle';
      npc.stateTimer = 2;
    }

    this._writeMatrices(npc);
  }

  _tickRiding(dt, npc, zerble) {
    const vehicle = npc.seatSlot?.vehicle;
    if (vehicle) zerble = vehicle;
    if (!npc.seatSlot||!this.seatReservations.isLive(npc._seatReservation)) {
      this._releaseSeat(npc);npc.seatSlot=null;npc.seatY=undefined;
      npc.state = 'idle';
      npc.stateTimer = 1;
      return;
    }
    // Lock position to the seat. Face the same way the cart is facing.
    const out = this._tmpV;
    this.seatReservations.readTarget(npc._seatReservation,out);
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
    if (!npc.party && ((!vehicle && this.bubblesEmpty) || (npc.rideTimer <= 0 && (vehicle ? vehicle.state === 'parked' : Math.abs(zerble.speed) < ZERBLE_IDLE_SPEED)))) {
      this._releaseSeat(npc);
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

  _tryClaimHammock(npc) {return this.hammocks.tryClaim(npc.personHandle);}
  _tickWalkingToHammock(dt,npc) {return this.hammocks.tickWalking(dt,npc.personHandle);}
  _tickHammockRiding(dt,npc) {return this.hammocks.tickRiding(dt,npc.personHandle);}
  _releaseHammock(npc) {return this.hammocks.release(npc.personHandle);}

  readActivityMotion(handle,out) {
    const npc=this.peopleHandles.resolve(handle);if(!npc)return false;
    this._readActivityMotion(npc,out);return true;
  }
  _readActivityMotion(npc,out) {
    this.peopleHandles.readOwnedRecord(npc,out);
    out.vx=npc.vel.x;out.vy=npc.vel.y;out.vz=npc.vel.z;out.energy=npc.energy;
    out.stateTimer=npc.stateTimer;out.rideTimer=npc.rideTimer;
    out.targetX=npc.target.x;out.targetY=npc.target.y;out.targetZ=npc.target.z;
  }
  readHammockMotion(handle,out) {
    const npc=this.peopleHandles.resolve(handle);if(!npc)return false;
    this._readActivityMotion(npc,out);out.hammockBob=npc.hammockBob;out.hammockY=npc.hammockY;return true;
  }
  readPicnicMotion(handle,out) {
    const npc=this.peopleHandles.resolve(handle);if(!npc)return false;
    this._readActivityMotion(npc,out);out.picnicY=npc.picnicY;out.picnicCrossLegged=npc.picnicCrossLegged;return true;
  }

  _applyRestMotion(claim,step,owner,states) {
    if(claim?.owner!==owner||!this.activityClaims.canWrite(claim))return null;
    const state=Object.hasOwn(states,step.phase)?states[step.phase]:null;
    if(!state)throw new TypeError('Invalid rest motion phase.');
    for(const key of REST_MOTION_FIELDS)if(!Number.isFinite(step[key]))throw new TypeError('Invalid rest motion profile.');
    // Passenger seating uses +Infinity for unlimited rides; later activities
    // copy that timer until they replace it with their own finite duration.
    if(step.rideTimer!==undefined&&step.rideTimer!==Infinity&&!Number.isFinite(step.rideTimer))throw new TypeError('Invalid rest timing profile.');
    const npc=this.peopleHandles.resolve(claim.person);
    npc.pos.x=step.x;npc.pos.z=step.z;npc.vel.x=step.vx;npc.vel.y=step.vy;npc.vel.z=step.vz;npc.yaw=step.heading;
    npc.state=state;npc.stateTimer=step.stateTimer;npc.rideTimer=step.rideTimer;
    npc.target.set(step.targetX,step.targetY,step.targetZ);return npc;
  }
  _applyHammockMotion(claim,step) {
    if(claim?.owner!==this.hammocks||!this.activityClaims.canWrite(claim))return null;
    for(const key of HAMMOCK_OPTIONAL_FIELDS)if(step[key]!==undefined&&!Number.isFinite(step[key]))throw new TypeError('Invalid hammock timing or display profile.');
    const npc=this._applyRestMotion(claim,step,this.hammocks,HAMMOCK_STATES);if(!npc)return null;
    npc.hammockBob=step.hammockBob;npc.hammockY=step.hammockY;return npc;
  }
  commitHammockMotion(claim,step) {const npc=this._applyHammockMotion(claim,step);if(!npc)return false;if(step.publish)this._writeMatrices(npc);return true;}
  finishHammockMotion(claim,step) {
    const npc=this._applyHammockMotion(claim,step);if(!npc)return false;
    this.activityClaims.release(claim,'rest-step');
    if(step.publish)this._writeMatrices(npc);return true;
  }
  releaseHammockPose(claim) {
    if(claim?.owner!==this.hammocks||!this.activityClaims.canRelease(claim))return false;
    this.peopleHandles.entries.get(claim.person.slot).record.hammockY=undefined;return true;
  }

  _campExit(npc) {return this.camps?.exit(npc.personHandle)??this.campJams?.exit(npc.personHandle)??null;}
  _releaseCamp(npc) {this.campJams?.release(npc.personHandle);return this.camps?.release(npc.personHandle);}
  _tickCamp(dt,npc) {return this.camps.tick(dt,npc.personHandle,this.campTimeOfDay?.t??getTimeOfDay()?.t??.25);}
  isPersonActivityCurrent(claim) {return this.activityClaims.canWrite(claim);}
  readCampPlace(handle,out) {return this.camps.readPlace(handle,out);}
  readPersonSupport(handle,out) {
    const n=this.peopleHandles.resolve(handle),owner=this.activityClaims.current.get(handle)?.claim.owner;
    if(!n||this._disposed||n.state!=='camp_seated'||n.party||n.seatSlot||n.isPhotographer||n.campJamHidden||this.hasHiddenBinding(handle)
      ||(owner!==this.camps&&owner!==this.campJams))return false;
    return owner.readPlace(handle,out);
  }
  preparePersonSupportTransfer(handle,entry,attempt) {
    if(!this.readPersonSupport(handle,this._supportView??={}))return null;
    return this.activityClaims.current.get(handle).claim.owner.prepareSupportTransfer(handle,entry,attempt);
  }
  setCampCooldown(handle,value) {return this.camps.setCooldown(handle,value);}
  canPlayCampMusic(handle) {
    const n=this.peopleHandles.resolve(handle);if(!n||n.party||!['idle','walking','camp_seated'].includes(n.state))return false;
    const active=this.activityClaims.current.get(handle);return !active||active.claim.owner===this.camps;
  }
  _readCampMotion(n,out) {
    this._readActivityMotion(n,out);out.pos.set(n.pos.x,n.pos.y,n.pos.z);out.vel.set(n.vel.x,n.vel.y,n.vel.z);out.target.set(n.target.x,n.target.y,n.target.z);out.yaw=n.yaw;
  }
  readCampMotion(handle,out) {const n=this.peopleHandles.resolve(handle);if(!n)return false;this._readCampMotion(n,out);return true;}
  readCampMusicMotion(handle,out) {const n=this.peopleHandles.resolve(handle);if(!n)return false;this._readCampMotion(n,out);out.campJamHidden=!!n.campJamHidden;return true;}
  _applyCampProfile(claim,step,owner,states) {
    if(claim?.owner!==owner||!this.activityClaims.canWrite(claim))return null;
    if(step.campY!==undefined&&!Number.isFinite(step.campY))throw new TypeError('Invalid camp display height.');
    step.phase=step.state;step.x=step.pos.x;step.z=step.pos.z;step.heading=step.yaw;step.vx=step.vel.x;step.vy=step.vel.y;step.vz=step.vel.z;
    step.targetX=step.target.x;step.targetY=step.target.y;step.targetZ=step.target.z;
    const n=this._applyRestMotion(claim,step,owner,states);if(!n)return null;n.campY=step.campY;return n;
  }
  commitCampMotion(claim,step) {const n=this._applyCampProfile(claim,step,this.camps,CAMP_STATES);if(!n)return false;if(step.publication)this._writeMatrices(n);return true;}
  finishCampMotion(claim,step) {const n=this._applyCampProfile(claim,step,this.camps,CAMP_STATES);if(!n)return false;this.activityClaims.release(claim,'rest-step');if(step.publication)this._writeMatrices(n);return true;}
  releaseCampPose(claim) {if(claim?.owner!==this.camps||!this.activityClaims.canRelease(claim))return false;this.peopleHandles.entries.get(claim.person.slot).record.campY=undefined;return true;}
  _applyCampMusicProfile(claim,step) {
    if(claim?.owner!==this.campJams||!this.activityClaims.canWrite(claim))return null;
    const n=this._applyCampProfile(claim,step,this.campJams,CAMP_MUSIC_STATES);if(!n)return null;
    n.campMusic=!!step.campMusic;n.campMusicStage=step.campMusicStage;n.campJamHidden=!!step.campJamHidden;return n;
  }
  commitCampMusicMotion(claim,step) {const n=this._applyCampMusicProfile(claim,step);if(!n)return false;if(step.publication)this._writeMatrices(n);return true;}
  finishCampMusicMotion(claim,step) {const n=this._applyCampMusicProfile(claim,step);if(!n)return false;this.activityClaims.release(claim,'rest-step');if(step.publication)this._writeMatrices(n);return true;}
  attachCampInstrument(claim,instrument) {
    if(claim?.owner!==this.campJams||!this.activityClaims.canWrite(claim))return false;
    if(!instrument?.group)throw new TypeError('A camp instrument needs its owned model.');
    const n=this.peopleHandles.resolve(claim.person);if(n._campInstrumentClaim&&n._campInstrumentClaim!==claim)return false;
    n.campInstrument=instrument;n._campInstrumentClaim=claim;this.group.add(instrument.group);return true;
  }
  releaseCampMusicPose(claim) {
    if(claim?.owner!==this.campJams||!this.activityClaims.canRelease(claim))return false;
    const n=this.peopleHandles.entries.get(claim.person.slot).record;
    try{if(n._campInstrumentClaim===claim)this.group.remove(n.campInstrument.group);}
    finally{if(n._campInstrumentClaim===claim){n.campInstrument=null;n._campInstrumentClaim=null;}n.campY=undefined;n.campMusic=false;n.campMusicStage=null;n.campJamHidden=false;}return true;
  }

  // Market movement retains the original pre-camp barrier. The activity owns
  // its isolated RNG, cooldown and frontage; this population owns final display.
  _releaseMarket(npc) {return this.markets?.release(npc.personHandle);}
  _tickMarket(dt,npc,cart) {return this.markets.tick(dt,npc.personHandle,cart,this.campTimeOfDay?.t??getTimeOfDay()?.t??.25,this.starActive);}
  readMarketMotion(handle,out) {
    const n=this.peopleHandles.resolve(handle);if(!n)return false;
    this._readActivityMotion(n,out);out.pos.set(n.pos.x,n.pos.y,n.pos.z);out.vel.set(n.vel.x,n.vel.y,n.vel.z);out.target.set(n.target.x,n.target.y,n.target.z);
    out.yaw=n.yaw;out.behaviorSeed=n.behaviorSeed;out.cheerTimer=n.cheerTimer??0;out.frownTimer=n.frownTimer??0;
    out.camping=!!this.camps?.has(handle);out.jamming=!!n.campMusic;out.shoppingBagTime=n.shoppingBagTime;out.marketPurchases=n.marketPurchases;out.onDancefloor=n.onDancefloor;return true;
  }
  _applyMarketMotion(claim,step) {
    if(claim?.owner!==this.markets||!this.activityClaims.canWrite(claim))return null;
    if((step.shoppingBagTime!==undefined&&!Number.isFinite(step.shoppingBagTime))
      ||(step.marketPurchases!==undefined&&(!Number.isSafeInteger(step.marketPurchases)||step.marketPurchases<0)))throw new TypeError('Invalid market purchase profile.');
    step.phase=step.state;step.x=step.pos.x;step.z=step.pos.z;step.heading=step.yaw;
    step.vx=step.vel.x;step.vy=step.vel.y;step.vz=step.vel.z;step.targetX=step.target.x;step.targetY=step.target.y;step.targetZ=step.target.z;
    const n=this._applyRestMotion(claim,step,this.markets,MARKET_STATES);if(!n)return null;
    n.shoppingBagTime=step.shoppingBagTime;n.marketPurchases=step.marketPurchases;n.onDancefloor=step.onDancefloor;return n;
  }
  commitMarketMotion(claim,step) {const n=this._applyMarketMotion(claim,step);if(!n)return false;if(step.publication)this._writeMatrices(n);return true;}
  finishMarketMotion(claim,step) {if(claim?.owner!==this.markets||!this.activityClaims.canWrite(claim))return false;const current=this.peopleHandles.resolve(claim.person);if(!Object.hasOwn(MARKET_STATES,step.state)&&step.state===current.state){this.activityClaims.release(claim,'rest-step');return true;}const n=this._applyMarketMotion(claim,step);if(!n)return false;this.activityClaims.release(claim,'rest-step');if(step.publication)this._writeMatrices(n);return true;}

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
  _tryClaimTable(npc) {return this.picnics.tryClaim(npc.personHandle);}
  _tickWalkingToTable(dt,npc) {return this.picnics.tickWalking(dt,npc.personHandle);}
  _tickTableSeated(dt,npc) {return this.picnics.tickSeated(dt,npc.personHandle);}
  _releaseTable(npc) {return this.picnics.release(npc.personHandle);}
  canUsePicnic(handle) {const n=this.peopleHandles.resolve(handle);return !!n&&['idle','walking'].includes(n.state)&&(!n.party||n.party.allowActivity(handle));}
  _applyPicnicMotion(claim,step) {
    if(claim?.owner!==this.picnics||!this.activityClaims.canWrite(claim))return null;
    if(step.picnicY!==undefined&&!Number.isFinite(step.picnicY))throw new TypeError('Invalid picnic display profile.');
    const npc=this._applyRestMotion(claim,step,this.picnics,PICNIC_STATES);if(!npc)return null;
    npc.picnicY=step.picnicY;npc.picnicCrossLegged=step.phase==='seated'&&step.picnicCrossLegged===true;return npc;
  }
  commitPicnicMotion(claim,step) {const npc=this._applyPicnicMotion(claim,step);if(!npc)return false;if(step.publish)this._writeMatrices(npc);return true;}
  finishPicnicMotion(claim,step) {const npc=this._applyPicnicMotion(claim,step);if(!npc)return false;this.activityClaims.release(claim,'rest-step');if(step.publish)this._writeMatrices(npc);return true;}
  releasePicnicPose(claim) {if(claim?.owner!==this.picnics||!this.activityClaims.canRelease(claim))return false;const npc=this.peopleHandles.entries.get(claim.person.slot).record;npc.picnicY=undefined;npc.picnicCrossLegged=false;return true;}

  // ----- Porta-potty seeking -----
  //
  // Flow: idle urge → seeking_potty (walk to the door) → on arrival, branch on
  // occupancy: vacant → entering_potty → using_potty (hidden inside, door shut,
  // timer) → exiting_potty (door opens, stink puff, walk off). Occupied+unlocked
  // → surprised_potty (peek, recoil, slam, try next). Occupied+locked → wait
  // briefly, then try the next closest. Every state has a give-up timeout so an
  // NPC can never get permanently stuck, and the claimed unit is always released
  // on abort/despawn/chunk-unload (no unit left phantom-"occupied").

  canUsePotty(handle) {const n=this.peopleHandles.resolve(handle);return !!n&&['idle','walking'].includes(n.state)&&(!n.party||n.party.allowActivity(handle));}
  readPottyMotion(handle,out) {
    const n=this.peopleHandles.resolve(handle);if(!n)return false;
    this._readActivityMotion(n,out);
    out.pos.set(n.pos.x,n.pos.y,n.pos.z);out.vel.set(n.vel.x,n.vel.y,n.vel.z);out.target.set(n.target.x,n.target.y,n.target.z);
    out.yaw=n.yaw;out.cheerTimer=n.cheerTimer??0;out.pottySitting=n.pottySitting??false;out.seatY=n.seatY;return true;
  }
  _applyPottyMotion(claim,step) {
    if(claim?.owner!==this.bathrooms||!this.activityClaims.canWrite(claim))return null;
    if(!Number.isFinite(step.cheerTimer)||(step.seatY!==undefined&&!Number.isFinite(step.seatY))
      ||(step.publication!==null&&step.publication!=='show'&&step.publication!=='hide'))throw new TypeError('Invalid bathroom display profile.');
    step.phase=step.state;step.x=step.pos.x;step.z=step.pos.z;step.heading=step.yaw;
    step.vx=step.vel.x;step.vy=step.vel.y;step.vz=step.vel.z;
    step.targetX=step.target.x;step.targetY=step.target.y;step.targetZ=step.target.z;
    const n=this._applyRestMotion(claim,step,this.bathrooms,POTTY_STATES);if(!n)return null;
    n.cheerTimer=step.cheerTimer;n.pottySitting=step.pottySitting;n.seatY=step.seatY;return n;
  }
  _publishPottyMotion(n,step) {if(step.publication==='show')this._writeMatrices(n);else if(step.publication==='hide')this._hideNpc(n);}
  commitPottyMotion(claim,step) {const n=this._applyPottyMotion(claim,step);if(!n)return false;this._publishPottyMotion(n,step);return true;}
  finishPottyMotion(claim,step) {const n=this._applyPottyMotion(claim,step);if(!n)return false;this.activityClaims.release(claim,'rest-step');this._publishPottyMotion(n,step);return true;}
  releasePottyPose(claim) {if(claim?.owner!==this.bathrooms||!this.activityClaims.canRelease(claim))return false;const n=this.peopleHandles.entries.get(claim.person.slot).record;n.pottySitting=false;n.seatY=undefined;return true;}
  _releasePotty(npc) {return this.bathrooms.release(npc.personHandle);}
  _tickSeekingPotty(dt,npc) {return this.bathrooms.tick(dt,npc.personHandle);}
  _tickEnteringPotty(dt,npc) {return this.bathrooms.tick(dt,npc.personHandle);}
  _tickUsingPotty(dt,npc) {return this.bathrooms.tick(dt,npc.personHandle);}
  _tickExitingPotty(dt,npc) {return this.bathrooms.tick(dt,npc.personHandle);}
  _tickSurprisedPotty(dt,npc) {return this.bathrooms.tick(dt,npc.personHandle);}


  _readPerson(npc,out) {
    out.x=npc.pos.x;out.y=npc.pos.y;out.z=npc.pos.z;out.heading=npc.yaw;out.bob=npc.bob;out.state=npc.state;
    out.shirt=npc.appearance.shirt;out.skin=npc.appearance.skin;out.scale=npc.scale;
    out.grouped=!!npc.party;out.photographer=!!npc.isPhotographer;
    out.vx=npc.vel.x;out.vz=npc.vel.z;out.seated=!!npc.seatSlot;
    out.claimed=this.activityClaims.current.has(npc.personHandle);out.hidden=!!npc._activityBinding?.hidden;
  }

  createPersonGroup(owner,root) {return new GroupParticipation(this,owner,root);}

  readPerson(handle,out) {return this.peopleView.read(handle,out);}
  spawnPerson(options) {return this.spawn(options)?.personHandle??null;}
  get populationSize(){return this.npcs.length;}
  invitePersonToWatch(handle){
    const person=this.peopleHandles.resolve(handle);
    if(!person||person.party||person.seatSlot||this.activityClaims.current.has(handle)||!ORDINARY_SOCIAL_STATES.has(person.state))return false;
    person.state='watching';return true;
  }
  removePerson(handle) {const npc=this.peopleHandles.resolve(handle);if(!npc)return false;this.removeNpc(npc);return true;}
  hasHiddenBinding(handle) {return !!this.peopleHandles.resolve(handle)?._activityBinding?.hidden;}

  // Physical reactions start with unclaimed ordinary adults. Occupied support
  // needs its own prepared transfer; it must never bypass a seat's exit rules
  // by using this entry point as a generic activity interruption.
  canClaimPersonReaction(handle) {
    const n=this.peopleHandles.resolve(handle);
    return !!n&&!this._disposed&&!n.party&&!n.isPhotographer&&!n.seatSlot
      &&!n.campSlot&&!n.campMusic&&!n.campInstrument&&!n.campJamHidden
      &&!n._activityBinding?.hidden&&!this.activityClaims.current.has(handle)
      &&(ORDINARY_SOCIAL_STATES.has(n.state)||n.state==='fleeing');
  }

  claimPersonReaction(handle,options) {
    if(!options?.owner||!this.canClaimPersonReaction(handle))return null;
    const prepare=options.prepare??(()=>true);
    return this.claimActivity(handle,{...options,prepare:attempt=>{
      const prepared=prepare(attempt);
      if(prepared?.then)throw new TypeError('Reaction preparation must be synchronous.');
      return prepared===true&&this.canClaimPersonReaction(handle);
    }},{preserveMotion:true});
  }
  isInActivity(handle,key) {return this.peopleHandles.isLive(handle)&&this.activityClaims.current.get(handle)?.claim.owner.activityKey===key;}

  activitySummary(handle,out={}) {
    const state=this.activityClaims.current.get(handle);
    if(!state||!this.peopleHandles.isLive(handle))return null;
    out.key=state.claim.owner.activityKey??null;out.role=null;out.phase=null;
    state.claim.owner.describePerson?.(handle,out);return out;
  }

  forEachPersonNear(x,z,radius,visit,queryScratch=null) {
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0||typeof visit!=='function')throw new TypeError('Invalid nearby-person query.');
    const scratch=queryScratch??(this._personQueryScratch??={});
    for(const npc of this.npcs){
      if(!this.peopleHandles.isLive(npc.personHandle))continue;
      const distance=Math.hypot(npc.pos.x-x,npc.pos.z-z);
      if(distance>=radius)continue;
      this.peopleHandles.readOwnedRecord(npc,scratch);
      if(visit(npc.personHandle,scratch,distance)===false)return;
    }
  }

  hasPersonWithin(x,z,radius,except) {
    for(const npc of this.npcs)if(npc.personHandle!==except&&!npc._removing&&Math.hypot(x-npc.pos.x,z-npc.pos.z)<radius)return true;
    return false;
  }

  hasBoardingGroup(vehicle) {return this.npcs.some(n=>n.party&&n.state==='boarding'&&n.seatSlot?.vehicle===vehicle);}

  activityCooldown(handle,key) {return this.peopleHandles.resolve(handle)?._activityCooldowns?.get(key)??0;}

  requestActivityExit(claim,{targetX=null,targetZ=null,cooldownUntil=null}={}) {
    if(!this.activityClaims.canRelease(claim))return false;
    if((targetX!==null&&!Number.isFinite(targetX))||(targetZ!==null&&!Number.isFinite(targetZ))||(cooldownUntil!==null&&!Number.isFinite(cooldownUntil)))throw new TypeError('Activity exit policy must be finite.');
    const key=claim.owner.activityKey;
    if(cooldownUntil!==null&&(typeof key!=='string'||!key))throw new TypeError('Cooldown owner needs an activity key.');
    const npc=this.peopleHandles.entries.get(claim.person.slot).record;
    let plan=npc._activityReleasePlan;
    if(plan?.claim!==claim)plan=npc._activityReleasePlan={claim,targetX:null,targetZ:null,cooldownUntil:null,key};
    if(targetX!==null)plan.targetX=targetX;if(targetZ!==null)plan.targetZ=targetZ;if(cooldownUntil!==null)plan.cooldownUntil=cooldownUntil;
    return true;
  }

  _finalizeActivityRelease(claim) {
    if(!this.peopleHandles.owns(claim.person))return;
    const npc=this.peopleHandles.entries.get(claim.person.slot).record,plan=npc._activityReleasePlan;
    if(plan?.claim!==claim)return;
    npc._activityReleasePlan=null;
    if(plan.targetX!==null&&plan.targetZ!==null)npc.target.set(plan.targetX,0,plan.targetZ);
    if(plan.cooldownUntil!==null){npc._activityCooldowns??=new Map();npc._activityCooldowns.set(plan.key,plan.cooldownUntil);}
  }

  _canAcquireActivity(handle) {const npc=this.peopleHandles.resolve(handle);return !!npc&&!['riding','boarding','disembarking','camp_sleeping'].includes(npc.state);}
  _resumeActivityPerson(handle,reason,claim) {
    if(this._inlineActivities?.has(claim?.owner)&&(reason==='rest-step'||reason==='rest-interrupted'))return;
    const npc=this.peopleHandles.resolve(handle);
    if(npc){if(npc.state!=='fleeing'){npc.state='walking';npc.stateTimer=12;npc.vel.set(0,0,0);}this._publishPerson(npc);}
  }

  claimActivity(handle,options={}, {preserveMotion=false}={}) {
    const release=options.release;
    const claim=this.activityClaims.acquire(handle,{...options,release:(current,reason)=>{
      try {release?.(current,reason);}
      finally {this.releaseActivityBinding(current);}
    }});
    if(claim&&!preserveMotion){const npc=this.peopleHandles.resolve(handle);npc._activityWalk=null;npc.state='idle';npc.vel.set(0,0,0);}
    return claim;
  }

  writeActivityPose(claim,x,y,z,heading=null,bob=null,travelDt=null) {
    if(!this.activityClaims.canWrite(claim))return false;
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||(heading!==null&&!Number.isFinite(heading))||(bob!==null&&!Number.isFinite(bob)))throw new TypeError('Activity pose must be finite.');
    if(travelDt!==null&&(!Number.isFinite(travelDt)||travelDt<0||travelDt>.05))throw new TypeError('Activity travel requires an accepted delta.');
    const npc=this.peopleHandles.resolve(claim.person);
    if(npc._reactionPose)npc._reactionPose=null;
    const distance=Math.hypot(x-npc.pos.x,z-npc.pos.z);
    if(travelDt!==null){const walk=npc._activityWalk??={};walk.claim=claim;walk.speed=travelDt>0&&distance<.5?distance/travelDt:0;}
    else npc._activityWalk=null;
    npc.pos.set(x,y,z);if(heading!==null)npc.yaw=heading;if(bob!==null)npc.bob=bob;
    // Hidden rigs have no ordinary transform to publish; avoid redundant writes.
    if(!npc._activityBinding?.hidden)this._publishPerson(npc);
    return true;
  }

  // Full feet-origin transform for the current reaction. The population keeps
  // its existing instance slots, appearance and attachment transforms.
  writeReactionPose(claim,{position,rotation,seated=false,seatBlend=seated?1:0}={}) {
    if(!this.activityClaims.canWrite(claim))return false;
    const npc=this.peopleHandles.resolve(claim.person);
    if(npc.party||npc.seatSlot||npc.isPhotographer||npc.campInstrument||npc.campJamHidden||npc._activityBinding?.hidden)return false;
    const values=[position?.x,position?.y,position?.z,rotation?.x,rotation?.y,rotation?.z,rotation?.w];
    if(!values.every(value=>Number.isFinite(value)&&Number.isFinite(Math.fround(value)))||typeof seated!=='boolean'||!Number.isFinite(seatBlend)||seatBlend<0||seatBlend>1)throw new TypeError('Reaction pose requires finite position, quaternion and a seated boolean.');
    const length=Math.hypot(rotation.x,rotation.y,rotation.z,rotation.w);
    if(length<1e-12)throw new TypeError('Reaction rotation must have nonzero length.');
    const pose=npc._reactionPose??={};
    pose.claim=claim;pose.x=position.x;pose.y=position.y;pose.z=position.z;
    pose.qx=rotation.x/length;pose.qy=rotation.y/length;pose.qz=rotation.z/length;pose.qw=rotation.w/length;pose.seated=seatBlend>0;pose.seatBlend=seatBlend;
    npc._activityWalk=null;npc.pos.set(pose.x,pose.y,pose.z);
    this._publishPerson(npc);return true;
  }

  writeActivityArmPose(claim,action,amount=0,dt=.05) {
    if(!this.activityClaims.canWrite(claim))return false;
    if((action!=='relaxed'&&action!=='catch'&&action!=='throw')||!Number.isFinite(amount)||amount<0||amount>1||!Number.isFinite(dt)||dt<0||dt>.05)throw new TypeError('Invalid activity arm pose.');
    const npc=this.peopleHandles.resolve(claim.person);
    if(npc._activityBinding?.hidden||npc.party)return false;
    const pose=npc._activityArmPose??={claim,hand:new THREE.Vector3()};
    const target=sampleThrowPose(action,amount,this._armTarget??={}),alpha=1-Math.exp(-14*dt);
    if(pose.x===undefined){pose.x=target.x;pose.z=target.z;pose.elbow=target.elbow;pose.leftZ=target.leftZ;}
    else {pose.x+=(target.x-pose.x)*alpha;pose.z+=(target.z-pose.z)*alpha;pose.elbow+=(target.elbow-pose.elbow)*alpha;pose.leftZ+=(target.leftZ-pose.leftZ)*alpha;}
    pose.claim=claim;this._publishPerson(npc);return true;
  }

  readActivityHand(claim,out) {
    if(!this.activityClaims.canWrite(claim))return false;
    const npc=this.peopleHandles.resolve(claim.person);
    if(npc._activityBinding?.hidden||npc.party)return false;
    const pose=npc._activityArmPose;
    if(pose?.claim!==claim)return false;
    out.copy(pose.hand);return true;
  }

  // Copy the published transform, including reaction precedence, instead of
  // asking props to approximate the body's scale, bob and lean a second time.
  readActivityPresentation(claim,out) {
    if(!this.activityClaims.canWrite(claim))return false;
    const npc=this.peopleHandles.resolve(claim.person);
    if(npc._activityBinding?.hidden||npc.party)return false;
    this.armsMesh.getMatrixAt(npc.idx,out);return true;
  }

  setActivityBinding(claim,hidden) {
    if(!this.activityClaims.canWrite(claim))return false;
    const npc=this.peopleHandles.resolve(claim.person);
    if(npc._activityBinding?.claim===claim&&npc._activityBinding.hidden===!!hidden)return true;
    npc._activityBinding={claim,hidden:!!hidden};this._publishPerson(npc);return true;
  }

  releaseActivityBinding(claim) {
    if(!this.activityClaims.canRelease(claim))return false;
    const npc=this.peopleHandles.entries.get(claim.person.slot)?.record;
    let released=false;
    if(npc?._activityWalk?.claim===claim){npc._activityWalk=null;released=true;}
    if(npc?._activityArmPose?.claim===claim){npc._activityArmPose=null;released=true;}
    if(npc?._reactionPose?.claim===claim){npc._reactionPose=null;released=true;}
    if(npc?._activityBinding?.claim===claim){npc._activityBinding=null;released=true;}
    if(released&&this.peopleHandles.isLive(claim.person))this._publishPerson(npc);
    return released;
  }

  endPersonActivity(claim,{targetX=null,targetZ=null,reason='ended'}={}) {
    if(!claim||this.activityClaims.current.get(claim.person)?.claim!==claim)return false;
    if(targetX!==null||targetZ!==null)this.requestActivityExit(claim,{targetX,targetZ});
    return this.activityClaims.release(claim,reason);
  }

  _publishPerson(npc) {
    // Legacy display grounding must not overwrite an activity's authoritative Y.
    // The ordinary population update still grounds its records at its own barrier.
    const y=npc.pos.y;
    try {this._writeMatrices(npc);} finally {npc.pos.y=y;}
    this.shoppingBagMesh.instanceMatrix.needsUpdate=true;
    this.legsMesh.instanceMatrix.needsUpdate=true;this.shoesMesh.instanceMatrix.needsUpdate=true;
    this.bodyMesh.instanceMatrix.needsUpdate=true;this.armsMesh.instanceMatrix.needsUpdate=true;
    this.headMesh.instanceMatrix.needsUpdate=true;this.eyesMesh.instanceMatrix.needsUpdate=true;this.mouthMesh.instanceMatrix.needsUpdate=true;
    if(npc.hairSlot>=0)this.hairMeshes[npc.appearance.hairStyle].instanceMatrix.needsUpdate=true;
    if(npc.drinkSlot>=0)this.drinkMesh.instanceMatrix.needsUpdate=true;
    if(npc.isPhotographer){this.cameraMesh.instanceMatrix.needsUpdate=true;this.flashMesh.instanceMatrix.needsUpdate=true;}
  }

  inspect(out) {out.population=this.npcs.length;out.disposed=this._disposed;out.claims=this.activityClaims.current.size;}

  // Lifetime invalidation precedes borrowers, which still see retiring metadata
  // and live render resources. Both explicit and distance removal use this core.
  _releaseNpc(npc) {
    if(npc._removing)return false;
    npc._removing=true;
    const handle=this.peopleHandles.handleFor(npc),errors=[];
    const release=fn=>{try{fn();}catch(error){errors.push(error);}};
    this.peopleHandles.remove(handle,()=>{
      release(()=>this.activityClaims.removePerson(handle));
      release(()=>this._releaseMarket(npc));
      release(()=>this._releaseSeat(npc));
      if(this.hammocks?.has(npc.personHandle))release(()=>this._releaseHammock(npc));
      if(this.picnics?.has(npc.personHandle))release(()=>this._releaseTable(npc));
      release(()=>this._releaseCamp(npc));
      if(this.bathrooms?.has(npc.personHandle))release(()=>this._releasePotty(npc));
      const group=this.groups.get(npc.groupId);
      if(group){const index=group.members.indexOf(npc.idx);if(index>=0)group.members.splice(index,1);if(!group.members.length)this.groups.delete(npc.groupId);}
      this._hideNpc(npc);
      if(npc.isPhotographer){this._photoFree.push(npc.photoSlot);this._photographerCount--;npc.photoSlot=-1;}
      if(npc.drinkSlot>=0){this._drinkFree.push(npc.drinkSlot);npc.drinkSlot=-1;}
      if(npc.hairSlot>=0){this._hairFree[npc.appearance.hairStyle].push(npc.hairSlot);npc.hairSlot=-1;}
      if(npc._groupBinding)release(()=>releaseGroupBinding(npc,handle));npc.party=null;npc.seatSlot=null;
      this.free.push(npc.idx);
    });
    if(errors.length)throw new AggregateError(errors,'Person borrower cleanup failed.');
    return true;
  }

  _publishPopulationRanges() {
    this._maxIdx=-1;this._hairDrawCounts.fill(0);
    let drinkHigh=-1,photoHigh=-1;
    for(const npc of this.npcs){
      this._maxIdx=Math.max(this._maxIdx,npc.idx);
      const style=npc.appearance.hairStyle;
      this._hairDrawCounts[style]=Math.max(this._hairDrawCounts[style],npc.hairSlot+1);
      drinkHigh=Math.max(drinkHigh,npc.drinkSlot);
      if(npc.isPhotographer)photoHigh=Math.max(photoHigh,npc.photoSlot);
    }
    this._drinkDrawCount=drinkHigh+1;this._photoDrawCount=photoHigh+1;
    for(const mesh of [this.legsMesh,this.shoesMesh,this.bodyMesh,this.armsMesh,this.headMesh,this.eyesMesh,this.mouthMesh,this.shoppingBagMesh]){mesh.count=this._maxIdx+1;mesh.instanceMatrix.needsUpdate=true;}
    for(let style=0;style<this.hairMeshes.length;style++){this.hairMeshes[style].count=this._hairDrawCounts[style];this.hairMeshes[style].instanceMatrix.needsUpdate=true;}
    this.drinkMesh.count=this._drinkDrawCount;this.cameraMesh.count=this._photoDrawCount;this.flashMesh.count=this._photoDrawCount;
    for(const mesh of [this.drinkMesh,this.cameraMesh,this.flashMesh])mesh.instanceMatrix.needsUpdate=true;
  }

  removeNpc(npc) {
    const index=this.npcs.indexOf(npc);
    if(index<0||npc._removing)return;
    try{this._releaseNpc(npc);}
    finally {
      if(this._removalSweep)this._removedDuringSweep=true;
      else {const remaining=this.npcs.indexOf(npc);if(remaining>=0)this.npcs.splice(remaining,1);this._publishPopulationRanges();}
    }
  }

  dispose(reason='population-disposed') {
    if(this._disposed)return;
    this._disposed=true;
    const errors=[],release=fn=>{try{fn();}catch(error){errors.push(error);}};
    if(this.peopleRuntime.isRegistered(this.ownerToken))release(()=>this.peopleRuntime.unregister(this.ownerToken,reason));
    release(()=>this.activityClaims.dispose());
    release(()=>this.hammocks.dispose());
    release(()=>this.picnics.dispose());
    release(()=>this.bathrooms.dispose());
    release(()=>this.markets.dispose());
    release(()=>this.camps.dispose());
    for(const party of [...this.parties])release(()=>party.dispose());
    release(()=>this.campJams.dispose());
    for(const npc of [...this.npcs])release(()=>this.removeNpc(npc));
    release(()=>this.seatReservations.dispose());
    release(()=>this.peopleHandles.dispose());
    for(const mesh of [this.armsMesh,this.legsMesh,this.shoesMesh])release(()=>mesh.customDepthMaterial?.dispose());
    release(()=>disposeSceneResources(this.group));
    this.group.removeFromParent();
    if(errors.length)throw new AggregateError(errors,'Crowd teardown failed.');
  }

  _writeHoopFeet(npc,feet) {
    for(let meshIndex=0;meshIndex<2;meshIndex++){
      const mesh=meshIndex===0?this.legsMesh:this.shoesMesh;
      for(let side=0;side<2;side++){
        const left=side===0,attr=mesh.geometry?.getAttribute(left?'flowLeftFoot':'flowRightFoot');
        if(!attr)continue;
        const quat=mesh.geometry.getAttribute(left?'flowLeftQuat':'flowRightQuat'),foot=feet?.[left?'left':'right'];
        if(foot){attr.setXYZW(npc.idx,foot.x,foot.y,foot.z,1);quat.setXYZW(npc.idx,foot.qx,foot.qy,foot.qz,foot.qw);}
        else{attr.setXYZW(npc.idx,0,0,0,0);quat.setXYZW(npc.idx,0,0,0,1);}
        attr.needsUpdate=true;quat.needsUpdate=true;
      }
    }
  }

  _hideNpc(npc) {
    this._writeHoopFeet(npc,null);
    this.shoppingBagMesh?.setMatrixAt(npc.idx, this._zeroMat);
    if (npc.campInstrument) npc.campInstrument.group.visible = false;
    const z = this._zeroMat || (this._zeroMat = new THREE.Matrix4().makeScale(0, 0, 0));
    this.legsMesh.setMatrixAt(npc.idx, z);
    this.shoesMesh.setMatrixAt(npc.idx, z);
    this.bodyMesh.setMatrixAt(npc.idx, z);
    this.armsMesh.setMatrixAt(npc.idx, z);
    this.headMesh.setMatrixAt(npc.idx, z);
    this.eyesMesh.setMatrixAt(npc.idx, z);
    this.mouthMesh.setMatrixAt(npc.idx, z);
    if (npc.hairSlot >= 0) this.hairMeshes[npc.appearance.hairStyle].setMatrixAt(npc.hairSlot, z);
    if (npc.drinkSlot >= 0) this.drinkMesh.setMatrixAt(npc.drinkSlot, z);
    if(npc._groupBinding)hideGroupBinding(npc);
    if (npc.isPhotographer) {
      this.cameraMesh.setMatrixAt(npc.photoSlot, z);
      this.flashMesh.setMatrixAt(npc.photoSlot, z);
    }
  }

  // Festival Run: a damaging hit flips the struck NPC's mouth to a frown for
  // the standard frown beat (dispatched from main.js's damaging-hit gate —
  // the frown here is feedback only; the smile deduction stays in onFrown's
  // dry-cart path and the vibe strike lives in the run layer). A fleeing
  // victim keeps fleeing: the frown branch in _updateNpc force-writes
  // `walking`, which would strip the damage-0 anti-double-hit grace the
  // fleeing state carries — panic outranks a mouth flip.
  frownPerson(handle) {
    const n=this.peopleHandles.resolve(handle);if(!n||n.state==='fleeing')return false;
    n.frownTimer=FROWN_DURATION;return true;
  }

  // A persistent candidate belongs to one person lifetime. Its copied position
  // cannot mutate population storage, and its callbacks reject retired handles.
  appendColliders(out,cart) {
    if(this._disposed||!cart?.position)return;
    for(const n of this.npcs){
      const handle=n.personHandle;if(!this.peopleHandles.isLive(handle))continue;
      if(n.state==='riding'||n.state==='boarding'||n.state==='disembarking'||n.state==='camp_sleeping'||n.campJamHidden||this.hasHiddenBinding(handle))continue;
      const dx=n.pos.x-cart.position.x,dz=n.pos.z-cart.position.z;if(dx*dx+dz*dz>36)continue;
      let c=n._personCollider;
      if(!c)c=n._personCollider={position:{x:0,y:0,z:0},radius:.45,damage:1,kind:'person',passive:false,entry:null,personHandle:handle,
        onContact:(_candidate,x,z)=>this.hitPerson(handle,x,z),onPeoplePenalty:()=>this.frownPerson(handle)};
      c.position.x=n.pos.x;c.position.y=n.pos.y;c.position.z=n.pos.z;out.push(c);
    }
  }

  hitPerson(handle,pushX,pushZ) {
    const n=this.peopleHandles.resolve(handle);if(!n)return false;
    if(!Number.isFinite(pushX)||!Number.isFinite(pushZ))throw new TypeError('Person hit direction must be finite.');
    return this._onZerbleHit(n,pushX,pushZ);
  }

  // Called from main.js when Zerble rams a porta-potty that's in use: eject the
  // occupant (flustered, fleeing), fling the door open, puff the stink.
  onPottyHit(entry) {return this.bathrooms.onHit(entry);}

  // Called from main.js when Zerble drives into an NPC. Knockback the victim,
  // put them into a fleeing state, and spook nearby NPCs (panic cascade).
  _onZerbleHit(victim, pushX, pushZ) {
    const handle=this.peopleHandles.handleFor(victim);
    if(!this.peopleHandles.isLive(handle))return false;
    const hadActivity=this.activityClaims.current.has(handle);
    // Preserve the physical exit preflight before revoking a camp reservation.
    if(this._abandonSeat(victim)===false)return false; // a trapped sitter waits
    this.activityClaims.removePerson(handle,'hit');
    victim.state = 'fleeing';
    victim.stateTimer = 3;
    victim.happiness = 0;
    // Apply an instant positional knockback so the cart doesn't keep grinding
    // through the same NPC frame after frame.
    victim.pos.x += pushX * 0.6;
    victim.pos.z += pushZ * 0.6;
    if(hadActivity)this._publishPerson(victim);
    // Panic cascade: nearby NPCs (within 6m) of any reasonable skittishness flee too
    for (const other of this.npcs) {
      if (other === victim || other.state === 'riding' || other.state === 'boarding' || other.state === 'camp_sleeping' || other.campJamHidden) continue;
      const dx = other.pos.x - victim.pos.x;
      const dz = other.pos.z - victim.pos.z;
      if (dx * dx + dz * dz > 36) continue;
      // Bolder/calmer folks may shrug it off
      if (other.skittish < 0.15 && Math.random() < 0.5) continue;
      if(this._abandonSeat(other)===false)continue;
      this.activityClaims.removePerson(other.personHandle,'panic');
      other.state = 'fleeing';
      other.stateTimer = 2.5;
    }
    return true;
  }

  // Free any picnic-table seat or hammock an NPC holds before it's force-fled
  // (rammed, cascade-panicked, or honk-scattered), so the slot is never stranded
  // "occupied". Safe to call on any NPC — no-op if it holds neither.
  _abandonSeat(npc) {
    if(this.bathrooms?.has(npc.personHandle))this._releasePotty(npc);
    this._releaseMarket(npc);
    // A trapped sitter cannot stand inside its own solid chair. Keep the
    // reservation until an exit opens, just as for a scheduled departure.
    if((this.camps?.has(npc.personHandle)||this.campJams?.has(npc.personHandle)) && (npc.state==='camp_seated'||npc.state==='camp_sleeping') && !this._campExit(npc))return false;
    if (this.picnics?.has(npc.personHandle)) this._releaseTable(npc);
    this._releaseCamp(npc);
    if (this.hammocks?.has(npc.personHandle)) this._releaseHammock(npc);
    return true;
  }

  // Star power love-magnet — called every frame from main.js while the buff is
  // active. Every NPC within LOVE_RADIUS of Zerble falls in love: a continuous
  // smile burst (per-NPC cooldown so one NPC doesn't fire every frame) and a
  // stop-and-stare. NPCs busy in an interaction (riding, potty, hammock, table,
  // fleeing) are left alone so we don't yank them out of a state machine.
  applyStarLove(zerble, dt, radius = 25) {
    if(this._disposed)return;
    const r2 = radius * radius;
    const px = zerble.position.x, pz = zerble.position.z;
    for (const npc of this.npcs) {
      if (this.activityClaims.current.has(npc.personHandle)||npc.campMusic || STAR_LOVE_SKIP.has(npc.state)) continue;
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
    if(this._disposed)return;
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
      if (npc.state === 'camp_sleeping' || npc.campJamHidden || npc._activityBinding?.hidden) continue;
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
            this._releaseSeat(npc);
            npc.seatSlot = null;
          }
          if(this._abandonSeat(npc)===false)continue;
          this.activityClaims.removePerson(npc.personHandle,'honk');
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
          if (movedSinceSmile(npc,zerble.position,SMILE_RESET_DIST)) {
            resetSmile(npc,zerble.position,SMILE_TIME_COOLDOWN);
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
    if (e.kind === 'tree' || e.kind === 'path_node' || e.kind === 'campsite') return;
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
