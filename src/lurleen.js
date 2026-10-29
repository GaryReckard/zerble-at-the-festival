// Lurleen — Zerble's love interest. A second anthropomorphic golf cart with
// pink puffy lips, googly eyes, gathered raffia/flower hair, and a wooden
// rear platform with side shelves.
//
// Spawned at a deterministic location far from origin so the player has to
// drive to find her. She wanders within ~60m of her spawn point. When Zerble
// gets within AWARE_RANGE, clusters of pink hearts erupt and she enters a
// brief "aware" pause, then transitions to "following" — driving after Zerble
// at FOLLOW_DIST. If Zerble drives off too far, she gives up and goes back
// to wandering.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registry } from './registry.js';
import { createHeartGeometry, sharedHeartGeometry as _heartGeo } from './models/heart.js';
import { worldHash, mulberry32, getSessionSeed } from './rng.js';
import { isPointInLake, projectOutOfLake } from './lakes.js';
import { terrainHeight } from './worldgen/terrain.js';

// Lakes load within 720m of the player; main.js boots `buildWorld()` (which
// triggers a lakeManager.update at origin) BEFORE constructing Lurleen, so any
// lake near her 200–280m spawn ring is already in the registry. Same for her
// 150–220m rehome drop. If the picked spot lands in water, push it out to the
// bounding circle + 50m so her wander radius (≈38m) never reaches the lake.
function avoidLake(x, z) {
  if (!isPointInLake(x, z)) return null;
  return projectOutOfLake(x, z, 50);
}

// Re-export so older imports (e.g. from sandbox.html or main) keep working.
export { createHeartGeometry };

const HOME_RADIUS = 55;
const AWARE_RANGE = 28;
const FORGET_RANGE = AWARE_RANGE * 3;
const FOLLOW_DIST = 11;
const SPEED_MAX = 16.0;    // close to Zerble's 18 — fast enough to keep up
const ACCEL = 18.0;
const TURN_RATE = 3.0;
const HEART_LIFETIME = 2.4;
const HEART_INTERVAL_AWARE = 0.18;
const HEART_INTERVAL_FOLLOW = 0.55;

// Seeded initial spawn — 2.5–3.5 chunks (200–280m) away on a ring. In v2 (H1) the
// ring is centered on the PLAYER's actual spawn (the hub), in a session-randomized
// direction, so Lurleen reliably starts "a distance away" wherever the player begins
// — not next to them. Legacy (no center) keeps the origin ring + fixed seed
// byte-identical (the (0,0) main-stage layout must not shift).
const SPAWN_RING_MIN = 200;
const SPAWN_RING_MAX = 280;

function pickInitialSpawn(center) {
  const seedHash = center ? (0xC4F18EE7 ^ (getSessionSeed() >>> 0)) : 0xC4F18EE7;
  const rng = mulberry32(worldHash(seedHash >>> 0, 0x5A7B19D3));
  const angle = rng() * Math.PI * 2;
  const radius = SPAWN_RING_MIN + rng() * (SPAWN_RING_MAX - SPAWN_RING_MIN);
  const bx = center ? center.x : 0, bz = center ? center.z : 0;
  return new THREE.Vector3(bx + Math.cos(angle) * radius, 0, bz + Math.sin(angle) * radius);
}

// Opportunistic re-home — if the player drives far without ever entering
// AWARE_RANGE, Lurleen quietly relocates near them so she stays findable.
// Triggered off-camera only (player must be >REHOME_DISTANCE_MIN away, well
// past render distance) so she never appears to "pop in."
const REHOME_INTERVAL = 25;        // seconds between rolls
const REHOME_DISTANCE_MIN = 300;   // gate — only relocate when she's offscreen-far
const REHOME_CHANCE = 0.5;         // 50% per roll, so avg ~50s to relocate
const REHOME_DROP_MIN = 150;       // place her at least this far from player
const REHOME_DROP_MAX = 220;       // …and at most this far
const FORWARD_CONE_CHANCE = 0.7;   // 70% of relocations bias toward player heading
const FORWARD_CONE_HALF_ANGLE = Math.PI / 4;  // ±45° = 90° forward cone

export class Lurleen {
  constructor(scene, center = null) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'Lurleen';

    const spawn = pickInitialSpawn(center);
    const dry = avoidLake(spawn.x, spawn.z);
    if (dry) spawn.set(dry.x, 0, dry.z);
    this.position = spawn.clone();
    this.heading = Math.PI;          // facing -z initially
    this.speed = 0;
    this.steerAngle = 0;
    this._terrainPoint = new THREE.Vector3();
    this.radius = 1.9;

    this.state = 'wandering';
    this.wanderTarget = spawn.clone();
    this.wanderTimer = 0;
    this.heartTimer = 0;
    this.awareTimer = 0;
    this.homePos = spawn.clone();
    this.eyes = [];
    // Festival Run scare-off: while > 0, the wandering→aware transition is
    // suppressed so a startled Lurleen isn't instantly re-acquired.
    this.scareCooldown = 0;

    // Re-home tracking — latches true the first time the player enters
    // AWARE_RANGE. Until that happens, the off-camera relocation rolls every
    // REHOME_INTERVAL seconds so a player who drove past Lurleen's initial
    // ring can still discover her. Sandbox sets autoRehome=false so she
    // doesn't teleport away from her pinned inspection spot.
    this._everMet = false;
    this._rehomeTimer = REHOME_INTERVAL;
    this.autoRehome = true;

    this._buildBody();
    this._buildWindshield();
    this._buildLips();
    this._buildEyes();
    this._buildHair();
    this._buildRearPlatform();
    this._buildRearEquipment();

    // Heart particles live in scene-space (not Lurleen's local space) so they
    // rise straight up rather than getting dragged along by her motion.
    this._heartGroup = new THREE.Group();
    this._heartGroup.name = 'LurleenHearts';
    scene.add(this._heartGroup);
    this._activeHearts = [];

    this.groundOnTerrain();
    scene.add(this.root);

    // Collider so Zerble bumps off her instead of driving through. Damage=0:
    // she's a friend, not an obstacle in the painful sense.
    this._registryId = registry.add({
      kind: 'lurleen',
      position: this.position,    // mutated each frame; registry holds the reference
      footprint: 2.0,
      collider: { radius: 2.0, damage: 0 },
    });
  }

  // Move Lurleen + her wander home to a new origin. Used by sandbox.html so
  // she doesn't immediately race off toward her seeded spawn, and by the
  // off-camera re-home logic in update().
  setSpawnAt(x, z) {
    this.position.set(x, 0, z);
    this.homePos.set(x, 0, z);
    this.wanderTarget.set(x, 0, z);
    this.wanderTimer = 9 + Math.random() * 8;   // pause before picking next target
    this.speed = 0;
    this.groundOnTerrain();
  }

  // Pick a fresh spot 150–220m from the player (mostly in their forward
  // cone, sometimes anywhere) and teleport there. Called only when the
  // player is far enough away to never see the move happen.
  _relocateNearPlayer(zerblePos, zerbleHeading) {
    const dist = REHOME_DROP_MIN + Math.random() * (REHOME_DROP_MAX - REHOME_DROP_MIN);
    // Zerble's "forward" world-vector is (x=-sin h, z=-cos h). Convert to a
    // standard atan2 world angle (measured from +x toward +z) so we can add
    // an offset within ±cone and recover xz with cos/sin below.
    const forwardWorldAngle = Math.atan2(-Math.cos(zerbleHeading), -Math.sin(zerbleHeading));
    let angle;
    if (Math.random() < FORWARD_CONE_CHANCE) {
      angle = forwardWorldAngle + (Math.random() * 2 - 1) * FORWARD_CONE_HALF_ANGLE;
    } else {
      angle = Math.random() * Math.PI * 2;
    }
    let nx = zerblePos.x + Math.cos(angle) * dist;
    let nz = zerblePos.z + Math.sin(angle) * dist;
    const dry = avoidLake(nx, nz);
    if (dry) { nx = dry.x; nz = dry.z; }
    this.setSpawnAt(nx, nz);
    // Face roughly back toward the player so she's not arbitrarily oriented.
    this.heading = Math.atan2(zerblePos.x - nx, zerblePos.z - nz) + Math.PI;
    this.groundOnTerrain();
  }

  // ---------- Body ----------

  _buildBody() {
    const dark = new THREE.MeshStandardMaterial({ color: 0x26282b, roughness: 0.72 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x171819, roughness: 1 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xd9d4b4, roughness: 0.75 });
    const seat = new THREE.MeshStandardMaterial({ color: 0xcbbc91, roughness: 0.95 });
    const box = (w, h, d, x, y, z, mat = dark, shadow = false) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow;
      this.root.add(mesh);
      return mesh;
    };
    box(1.8, 0.20, 3.0, 0, 0.65, 0, dark);
    const hoodProfile = new THREE.Shape();
    hoodProfile.moveTo(0.78, 0.78);
    hoodProfile.lineTo(0.78, 1.66);
    hoodProfile.bezierCurveTo(1.12, 1.66, 1.50, 1.45, 1.65, 1.16);
    hoodProfile.quadraticCurveTo(1.72, 1.02, 1.56, 0.99);
    hoodProfile.lineTo(1.30, 0.78);
    hoodProfile.closePath();
    const hoodGeo = new THREE.ExtrudeGeometry(hoodProfile, {
      depth: 1.84, bevelEnabled: true, bevelSize: 0.075,
      bevelThickness: 0.075, bevelSegments: 3, curveSegments: 10,
    });
    hoodGeo.translate(0, 0, -0.92).rotateY(Math.PI / 2);
    const cowl = new THREE.Mesh(hoodGeo, dark);
    cowl.name = 'Curved front cowl';
    cowl.castShadow = true;
    this.root.add(cowl);
    box(1.8, 0.16, 0.18, 0, 0.72, -1.58);
    box(1.6, 0.57, 0.75, 0, 1.02, 0.35, dark);
    const rearProfile = new THREE.Shape();
    rearProfile.moveTo(-0.05, 0.58);
    rearProfile.lineTo(-0.05, 1.20);
    rearProfile.quadraticCurveTo(-0.06, 1.38, -0.32, 1.38);
    rearProfile.lineTo(-1.30, 1.36);
    rearProfile.quadraticCurveTo(-1.65, 1.34, -1.67, 0.58);
    rearProfile.lineTo(-1.59, 0.58);
    rearProfile.absarc(-1.0, 0.58, 0.59, Math.PI, 0, true);
    rearProfile.lineTo(-0.05, 0.58);
    const rearParts = [];
    for (const x of [-0.96, 0.96]) {
      box(0.22, 0.10, 1.20, x, 0.73, -0.38);
      const panel = new THREE.ExtrudeGeometry(rearProfile, {
        depth: 0.10, bevelEnabled: true, bevelSize: 0.035,
        bevelThickness: 0.035, bevelSegments: 2, curveSegments: 10,
      });
      panel.translate(0, 0, -0.05).rotateY(Math.PI / 2).translate(x, 0, 0);
      rearParts.push(panel);
    }
    const rearBody = new THREE.Mesh(mergeGeometries(rearParts), dark);
    rearBody.name = 'Rounded rear wheel arches';
    this.root.add(rearBody);
    for (const panel of rearParts) panel.dispose();
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb59b65, roughness: 0.95 });
    box(2.22, 0.12, 2.65, 0, 3.85, -0.12, roofMat, true);
    this._roofY = 3.85;
    this._roofHalfW = 1.11;
    this._roofHalfD = 1.325;
    this._roofZ = -0.12;
    for (const x of [-0.96, 0.96]) {
      for (const z of [-1.3, 1.08]) box(0.065, 2.65, 0.065, x, 2.46, z);
    }
    box(1.68, 0.24, 0.72, 0, 1.43, 0.20, seat);
    box(1.68, 0.65, 0.18, 0, 1.79, 0.55, seat);
    const steering = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.028, 6, 20), dark);
    steering.position.set(-0.47, 1.94, -0.55);
    steering.rotation.x = -0.65;
    this.root.add(steering);
    const columnBase = new THREE.Vector3(-0.47, 1.02, -0.98);
    const columnTop = new THREE.Vector3(-0.47, 1.94, -0.55);
    const columnDirection = columnTop.clone().sub(columnBase);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, columnDirection.length(), 8), dark);
    column.position.copy(columnBase).add(columnTop).multiplyScalar(0.5);
    column.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), columnDirection.normalize());
    this.root.add(column);

    this._wheels = [];
    const tireGeo = new THREE.CylinderGeometry(0.51, 0.51, 0.42, 16).rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.30, 0.30, 0.44, 16).rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.47, 10).rotateZ(Math.PI / 2);
    const treadGeo = new THREE.BoxGeometry(0.25, 0.075, 0.13);
    const dummy = new THREE.Object3D();
    for (const [x, z] of [[-1.03,-1.0],[1.03,-1.0],[-1.03,1.0],[1.03,1.0]]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.53, z);
      const tire = new THREE.Mesh(tireGeo, rubber);
      tire.castShadow = true;
      wheel.add(tire, new THREE.Mesh(rimGeo, cream), new THREE.Mesh(hubGeo, dark));
      const treads = new THREE.InstancedMesh(treadGeo, rubber, 32);
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        for (let side = 0; side < 2; side++) {
          dummy.position.set((side ? 1 : -1) * 0.115, Math.cos(a)*0.51, Math.sin(a)*0.51);
          dummy.rotation.set(a, 0, (side ? 1 : -1)*0.48);
          dummy.updateMatrix();
          treads.setMatrixAt(i*2+side, dummy.matrix);
        }
      }
      treads.instanceMatrix.needsUpdate = true;
      wheel.add(treads);
      this.root.add(wheel);
      this._wheels.push({ mesh: wheel, baseY: 0.53, front: z < 0 });
    }
  }

  // ---------- Windshield — a clear plane between the front posts ----------
  // The googly eyes sit on this surface. Reference photo: the eyes are stuck
  // to the actual clear windshield, not floating in space.

  _buildWindshield() {
    // The front-of-cart edge of the roof is at z = roofZ - halfD = -1.45.
    // The chassis top is at y=1.2. The roof bottom is at y=3.76.
    // Match the front roof-posts at x = ±0.95.
    const windshieldGeo = new THREE.PlaneGeometry(2.0, 2.5);
    const windshieldMat = new THREE.MeshStandardMaterial({
      color: 0xa6d8ff,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    // Position: centered between the front posts, vertical between chassis & roof.
    // Front face of cart is at z = -1.5 (slightly past the front posts at z=-1.3).
    windshield.position.set(0, 2.45, -1.45);
    // A subtle tilt forward at the top (like a real golf cart windshield)
    windshield.rotation.x = 0.08;
    this.root.add(windshield);
    this._windshield = windshield;
  }

  // Closed, elliptical cross-sections give the stuffed fabric its side profile.
  _buildLips() {
    this._lipMaterial = new THREE.MeshStandardMaterial({color:0xee4685,roughness:1});
    this._lipOutlineMaterial = new THREE.MeshStandardMaterial({
      color:0xff74bd,emissive:0xff1684,emissiveIntensity:0,roughness:0.8,
    });
    const group = new THREE.Group();
    const seam = u => -0.025 + 0.065*Math.cos(u*Math.PI);
    const upper = u => Math.pow(Math.max(0,1-u*u),0.65)*(0.25+0.35*Math.sin(Math.PI*Math.abs(u)));
    const lower = u => -0.56*Math.pow(Math.max(0,1-u*u),0.65);
    const width=1.45, segments=40, rings=20;
    for (const isTop of [true,false]) {
      const positions=[], indices=[];
      for(let i=0;i<=segments;i++) {
        const u=i/segments*2-1;
        const edge = Math.max(0,1-u*u);
        const inner=seam(u)*edge;
        const outer=isTop?upper(u):lower(u);
        const center=(inner+outer)/2, radius=Math.abs(outer-inner)/2;
        const depth=(isTop?0.30:0.34)*Math.pow(edge,0.6);
        for(let j=0;j<=rings;j++) {
          const angle=j/rings*Math.PI*2;
          positions.push(u*width,center+radius*Math.cos(angle),depth*Math.sin(angle));
          if(i<segments && j<rings) {
            const n=i*(rings+1)+j;
            indices.push(n,n+1,n+rings+1,n+1,n+rings+2,n+rings+1);
          }
        }
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      group.add(new THREE.Mesh(geometry,this._lipMaterial));
    }
    // One outer cord and one curved mouth seam, rather than two doubled seams.
    const perimeter=[];
    for(let i=0;i<=40;i++){const u=i/20-1;perimeter.push(new THREE.Vector3(u*width,upper(u)*0.9+seam(u)*(1-u*u)*0.1,0.012+0.18*Math.pow(Math.max(0,1-u*u),0.6)));}
    for(let i=39;i>0;i--){const u=i/20-1;perimeter.push(new THREE.Vector3(u*width,lower(u)*0.9+seam(u)*(1-u*u)*0.1,0.012+0.204*Math.pow(Math.max(0,1-u*u),0.6)));}
    const mouth=[];
    for(let i=0;i<=40;i++){const u=i/20-1;mouth.push(new THREE.Vector3(u*width,seam(u)*(1-u*u),0.012+0.12*Math.pow(Math.max(0,1-u*u),0.6)));}
    for(const [points,closed] of [[perimeter,true],[mouth,false]]) {
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,closed),
        closed?100:50,0.014,4,closed),this._lipOutlineMaterial));
    }
    group.scale.set(0.60,0.78,1);
    group.position.set(0,1.42,-1.70);
    group.rotation.y=Math.PI;
    this.root.add(group);
  }

  // The white props are shallow domes, with pupils moving on their front caps.
  _buildEyes() {
    this._eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xfffdf1, emissive: 0xffc34d, emissiveIntensity: 0, roughness: 0.55,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x090909, roughness: 0.65 });
    for (const x of [-0.49, 0.49]) {
      const eye = new THREE.Group();
      eye.position.set(x, 2.24, -1.54);
      eye.rotation.y = Math.PI;
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.47, 24, 14, 0, Math.PI), this._eyeMaterial);
      white.scale.z = 0.56;
      eye.add(white);
      const backing = new THREE.Mesh(new THREE.CircleGeometry(0.47,24),dark);
      backing.rotation.y = Math.PI;
      backing.position.z = -0.005;
      eye.add(backing);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.465, 0.015, 5, 24), dark);
      eye.add(rim);
      const pupilGroup = new THREE.Group();
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 10), dark);
      pupil.scale.z = 0.15;
      pupil.position.z = 0.267;
      pupilGroup.add(pupil);
      eye.add(pupilGroup);
      for (let k = 0; k < 7; k++) {
        const a = 0.38 + k * 0.34;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(a)*0.44, Math.sin(a)*0.44, 0),
          new THREE.Vector3(Math.cos(a)*0.56, Math.sin(a)*0.56, 0.035),
          new THREE.Vector3(Math.cos(a)*0.64, Math.sin(a)*0.64, 0.12),
        ]);
        eye.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 5, 0.012, 3, false), dark));
      }
      this.root.add(eye);
      this.eyes.push({root: eye, pupil: pupilGroup, basePos: eye.position.clone(), wobbleX: 0.075, wobbleY: 0.07});
    }
  }

  _buildHair() {
    // A private stream keeps the decorative strands stable without advancing world RNG.
    const rng = mulberry32(0x1a71ee);
    const colors = [0xd4b477, 0xb78c4b, 0xe7cc91];
    const buckets = colors.map(() => []);
    const lightPositions = [];
    let strandIndex = 0;
    const strand = (points, radius, index) => {
      const curve = new THREE.CatmullRomCurve3(points);
      buckets[index % 3].push(new THREE.TubeGeometry(curve, 7, radius, 3, false));
      if (strandIndex++ % 3 === 0) lightPositions.push(curve.getPoint(0.15 + rng()*0.75));
    };
    const w = this._roofHalfW, d = this._roofHalfD, z = this._roofZ;
    const top = this._roofY - 0.02;
    const corners = [[-w,z-d],[w,z-d],[w,z+d],[-w,z+d]];
    for (let edge = 0; edge < 4; edge++) {
      const a = corners[edge], b = corners[(edge+1)%4];
      for (let i = 0; i < 48; i++) {
        const t = (i+0.5)/48;
        const x = a[0]+(b[0]-a[0])*t, zz = a[1]+(b[1]-a[1])*t;
        const c = t < 0.5 ? a : b;
        strand([
          new THREE.Vector3(x,top,zz),
          new THREE.Vector3(x*0.52+c[0]*0.48,top-0.34-rng()*0.10,zz*0.52+c[1]*0.48),
          new THREE.Vector3(c[0],top-0.72,c[1]),
        ], 0.012+rng()*0.009, i);
      }
    }
    const ribbon = new THREE.MeshStandardMaterial({color: 0x39ad3d, roughness: 0.6, side: THREE.DoubleSide});
    for (const [x, zz] of corners) {
      for (let i = 0; i < 36; i++) {
        const dx = (rng()-0.5)*0.22, dz = (rng()-0.5)*0.22;
        strand([
          new THREE.Vector3(x+dx*0.3,top-0.70,zz+dz*0.3),
          new THREE.Vector3(x+dx,top-1.10,zz+dz),
          new THREE.Vector3(x+dx*1.8,top-1.50-rng()*0.32,zz+dz*1.8),
        ], 0.009+rng()*0.006, i);
      }
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.105,0.035,5,12),ribbon);
      tie.rotation.x = Math.PI/2;
      tie.position.set(x,top-0.72,zz);
      this.root.add(tie);
      for (const side of [-1,1]) {
        const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.07,0.58),ribbon);
        tail.position.set(x+side*0.08,top-0.98,zz-0.13);
        tail.rotation.z = side*0.18;
        this.root.add(tail);
      }
    }
    this._hairMaterials = colors.map(color => new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0, roughness: 1,
    }));
    for (let i = 0; i < buckets.length; i++) {
      const geometry = mergeGeometries(buckets[i]);
      for (const part of buckets[i]) part.dispose();
      this.root.add(new THREE.Mesh(geometry,this._hairMaterials[i]));
    }
    const flowerMat = new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.8});
    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.065,0),flowerMat,120);
    const dummy = new THREE.Object3D();
    const flowerColors = [0xff3a71,0xffc933,0xb26ee4,0xf7e9c1,0xff7624];
    let index = 0;
    for (let edge = 0; edge < 4; edge++) {
      const a = corners[edge], b = corners[(edge+1)%4];
      for (let i = 0; i < 6; i++) {
        const t = (i+0.5)/6;
        for (let petal = 0; petal < 5; petal++) {
          const angle = petal*Math.PI*2/5;
          dummy.position.set(a[0]+(b[0]-a[0])*t+Math.cos(angle)*0.055,top+0.09+Math.sin(angle)*0.055,a[1]+(b[1]-a[1])*t);
          dummy.scale.set(1,1,0.55);
          dummy.updateMatrix();
          flowers.setMatrixAt(index,dummy.matrix);
          flowers.setColorAt(index++,new THREE.Color(flowerColors[(edge*6+i)%flowerColors.length]));
        }
      }
    }
    flowers.instanceMatrix.needsUpdate = true;
    flowers.instanceColor.needsUpdate = true;
    this.root.add(flowers);
    this._hairLightMaterial = new THREE.MeshStandardMaterial({color:0xffd875,emissive:0xffad32,emissiveIntensity:0});
    const bulbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.026,0),this._hairLightMaterial,lightPositions.length);
    for (let i = 0; i < lightPositions.length; i++) {
      dummy.position.copy(lightPositions[i]);
      dummy.position.z += lightPositions[i].z < this._roofZ ? -0.025 : 0.025;
      dummy.scale.setScalar(1);
      dummy.updateMatrix(); bulbs.setMatrixAt(i,dummy.matrix);
      bulbs.setColorAt(i,new THREE.Color(1,1,1));
    }
    bulbs.instanceMatrix.needsUpdate = true;
    this._hairLights = bulbs;
    this._twinkleColor = new THREE.Color();
    this.root.add(bulbs);
  }

  _buildRearPlatform() {
    const wood = new THREE.MeshStandardMaterial({color:0xb98d52,roughness:0.95});
    const frame = new THREE.MeshStandardMaterial({color:0x27282a,roughness:0.8});
    const parts = [];
    for (let i = 0; i < 7; i++) parts.push(new THREE.BoxGeometry(0.245,0.10,0.96).translate((i-3)*0.255,0.96,1.02));
    for (const x of [-0.80,0.80]) {
      const shelf = new THREE.Shape();
      shelf.moveTo(-0.20,-0.52);
      shelf.lineTo(-0.20,0.52);
      shelf.quadraticCurveTo(-0.20,0.70,0,0.70);
      shelf.quadraticCurveTo(0.20,0.70,0.20,0.52);
      shelf.lineTo(0.20,-0.52);
      shelf.quadraticCurveTo(0.20,-0.70,0,-0.70);
      shelf.quadraticCurveTo(-0.20,-0.70,-0.20,-0.52);
      const shelfGeo = new THREE.ExtrudeGeometry(shelf,{depth:0.065,bevelEnabled:true,bevelSize:0.018,bevelThickness:0.012,bevelSegments:2,curveSegments:8});
      shelfGeo.rotateX(-Math.PI/2).translate(x,1.44,1.15);
      const indexedShelf = shelfGeo.index ? shelfGeo : null;
      // Match BoxGeometry's indexed layout before combining the wooden parts.
      if (!indexedShelf) {
        const indices = Array.from({length:shelfGeo.attributes.position.count},(_,i)=>i);
        shelfGeo.setIndex(indices);
      }
      parts.push(shelfGeo);
      parts.push(new THREE.BoxGeometry(0.09,0.55,0.09).translate(x,1.19,1.48));
    }
    const platform = new THREE.Mesh(mergeGeometries(parts),wood);
    for (const part of parts) part.dispose();
    platform.castShadow = true;
    this.root.add(platform);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.05,0.16,0.17),frame);
    bumper.position.set(0,0.81,1.60);
    this.root.add(bumper);
  }

  _buildRearEquipment() {
    const dark = new THREE.MeshStandardMaterial({color:0x242329,roughness:0.8});
    const parts = [];
    const box = (w,h,d,x,y,z) => parts.push(new THREE.BoxGeometry(w,h,d).translate(x,y,z));
    box(0.95,0.06,0.50,0,1.64,1.03);
    for(const x of [-0.46,0.46]) {
      box(0.035,0.38,0.50,x,1.82,1.03);
      box(0.04,0.52,0.04,x,1.36,0.82);
    }
    for(const z of [0.79,1.27]) {
      for(const y of [1.69,1.83,1.99])box(0.95,0.025,0.025,0,y,z);
      for(let i=0;i<9;i++)box(0.02,0.30,0.025,(i-4)*0.11,1.83,z);
    }
    this._bubbleOutlets = [];
    this._machinePanelMaterial = new THREE.MeshStandardMaterial({
      color: 0xffecc1, emissive: 0xffd887, emissiveIntensity: 0, roughness: 0.55,
    });
    const panelParts = [], reservoirParts = [];
    for (const [x, color] of [[-1.18, 0x48a9db], [1.18, 0xe98dc0]]) {
      const z = 1.42;
      box(0.055, 0.80, 0.055, x, 3.12, z);
      box(0.24, 0.055, 0.055, x < 0 ? -1.07 : 1.07, 3.12, 1.25);
      const shellParts = [
        new THREE.CylinderGeometry(0.14, 0.12, 0.07, 8).translate(x, 3.60, z),
        new THREE.CylinderGeometry(0.235, 0.235, 0.055, 8).translate(x, 3.94, z),
        new THREE.CylinderGeometry(0.12, 0.235, 0.13, 8).translate(x, 4.025, z),
        new THREE.TorusGeometry(0.12, 0.023, 5, 16).rotateX(Math.PI / 2).translate(x, 4.11, z),
      ];
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const bar = new THREE.BoxGeometry(0.025, 0.32, 0.025);
        bar.rotateZ(-0.25).rotateY(-angle);
        bar.translate(x + Math.cos(angle) * 0.175, 3.77, z + Math.sin(angle) * 0.175);
        shellParts.push(bar);
      }
      const shell = new THREE.Mesh(mergeGeometries(shellParts),
        new THREE.MeshStandardMaterial({color, roughness: 0.5}));
      shell.name = x < 0 ? 'Blue bubble lantern' : 'Pink bubble lantern';
      this.root.add(shell);
      for (const part of shellParts) part.dispose();
      panelParts.push(new THREE.CylinderGeometry(0.205, 0.125, 0.28, 8).translate(x, 3.77, z));
      reservoirParts.push(new THREE.CylinderGeometry(0.09, 0.07, 0.22, 10).translate(x, 3.455, z));
      parts.push(new THREE.CylinderGeometry(0.095, 0.095, 0.015, 16).translate(x, 4.105, z));
      this._bubbleOutlets.push(new THREE.Vector3(x, 4.145, z));
    }
    this.root.add(new THREE.Mesh(mergeGeometries(panelParts), this._machinePanelMaterial));
    this.root.add(new THREE.Mesh(mergeGeometries(reservoirParts),
      new THREE.MeshStandardMaterial({color: 0xbdd6df, roughness: 0.3, metalness: 0.15})));
    for (const part of [...panelParts, ...reservoirParts]) part.dispose();
    const housing = new THREE.CylinderGeometry(0.18,0.16,0.18,10).rotateX(Math.PI/2).translate(0,1.41,1.28);
    parts.push(housing);
    this.root.add(new THREE.Mesh(mergeGeometries(parts),dark));
    for(const part of parts)part.dispose();
    this._discoMaterial = new THREE.MeshStandardMaterial({color:0xbb77ed,emissive:0xaa22ff,emissiveIntensity:0,flatShading:true});
    this._discoLens = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14,1),this._discoMaterial);
    this._discoLens.position.set(0,1.41,1.40);
    this.root.add(this._discoLens);
    const spotMat = new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
    this._discoSpots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.075,8),spotMat,24);
    const colors=[0xff3399,0x904dff,0x33ccff,0x55ff88];
    for(let i=0;i<24;i++)this._discoSpots.setColorAt(i,new THREE.Color(colors[i%4]));
    this._discoSpots.instanceColor.needsUpdate=true;
    this._discoSpots.frustumCulled=false;
    this._discoSpots.visible=false;
    this.root.add(this._discoSpots);
    this._rearFxTransform=new THREE.Object3D();
    this._rearFxPoint=new THREE.Vector3();
    this._rearFxTime=0;
    // A fixed visual pool stays in world space as the cart drives away.
    this._rearBubbles=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),
      new THREE.MeshStandardMaterial({color:0xb8ddff,roughness:0.15,metalness:0.25,transparent:true,opacity:0.22,depthWrite:false}),24);
    this._rearBubbles.frustumCulled=false;
    this._rearBubbles.visible=false;
    this._rearBubbleAges=Float32Array.from({length:24},(_,i)=>-i*0.16);
    this._rearBubblePositions=new Float32Array(72);
    this._rearFxTransform.scale.setScalar(0);this._rearFxTransform.updateMatrix();
    for(let i=0;i<24;i++)this._rearBubbles.setMatrixAt(i,this._rearFxTransform.matrix);
    this._rearBubbles.instanceMatrix.needsUpdate=true;
    this.scene.add(this._rearBubbles);
  }

  _updateRearEffects(dt, nightness) {
    this._rearFxTime+=dt;
    this._discoMaterial.emissive.setHSL((this._rearFxTime*0.12)%1,1,0.5);
    this._discoMaterial.emissiveIntensity=nightness*2.5;
    this._machinePanelMaterial.emissiveIntensity = nightness * 0.65;
    this._discoLens.rotation.z=this._rearFxTime;
    this._discoSpots.visible=nightness>0;
    this._discoSpots.material.opacity=nightness*0.6;
    const dummy=this._rearFxTransform;
    for(let i=0;i<24;i++) {
      const angle=i*Math.PI/12+this._rearFxTime*0.5;
      const radius=0.65+(i%3)*0.35;
      dummy.position.set(Math.cos(angle)*radius,0.025,1.6+Math.sin(angle)*radius);
      dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(1,1.6,1);dummy.updateMatrix();
      this._discoSpots.setMatrixAt(i,dummy.matrix);
    }
    this._discoSpots.instanceMatrix.needsUpdate=true;
    this.root.updateMatrixWorld(true);
    dummy.rotation.set(0,0,0);
    let liveBubbles=0;
    for(let i=0;i<24;i++) {
      const before=this._rearBubbleAges[i];
      let age=before+dt;
      if(age>=3.84)age-=3.84;
      const offset=i*3;
      if((before<0 && age>=0) || age<before || (before===0 && age>0)) {
        this._rearFxPoint.copy(this._bubbleOutlets[i%2]);
        this.root.localToWorld(this._rearFxPoint);
        this._rearFxPoint.toArray(this._rearBubblePositions,offset);
      }
      this._rearBubbleAges[i]=age;
      if(age<0)dummy.scale.setScalar(0);
      else {
        liveBubbles++;
        this._rearBubblePositions[offset]+=Math.sin(i*2.4)*dt*0.18;
        this._rearBubblePositions[offset+1]+=dt*0.27;
        this._rearBubblePositions[offset+2]+=dt*0.16;
        dummy.position.fromArray(this._rearBubblePositions,offset);
        dummy.scale.setScalar((0.055+(i%4)*0.013)*Math.min(1,age*4,(3.84-age)*4));
      }
      dummy.updateMatrix();this._rearBubbles.setMatrixAt(i,dummy.matrix);
    }
    this._rearBubbles.instanceMatrix.needsUpdate=true;
    this._rearBubbles.visible=liveBubbles>0;
  }

  // Use the same four-wheel contact approach as Zerble without changing the
  // autonomous X/Z steering, timers or random draws. Also called on teleports.
  groundOnTerrain() {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    let front = 0, back = 0, left = 0, right = 0;
    for (const w of this._wheels) {
      const p = w.mesh.position;
      const h = terrainHeight(this.position.x + p.x * c + p.z * s,
        this.position.z - p.x * s + p.z * c);
      if (w.front) front += h; else back += h;
      if (p.x < 0) left += h; else right += h;
    }
    const pitch = Math.atan2((front - back) / 2, 2);
    const roll = Math.atan2((right - left) / 2, 2.06);
    this.position.y = (front + back) / 4;
    this.root.position.copy(this.position);
    this.root.rotation.set(pitch, this.heading, roll, 'YXZ');
    this.root.updateMatrixWorld(true);
    const vertical = Math.cos(pitch) * Math.cos(roll), p = this._terrainPoint;
    this.terrainContactError = 0;
    for (const w of this._wheels) {
      // Preserve the old two-centimetre wheel clearance and visual jiggle in
      // the flat world; suspension compensates only for chassis/terrain tilt.
      const rest = w.baseY + (this.actorTime == null ? 0 :
        Math.sin(this.actorTime * 10 + w.mesh.position.x) * .02);
      w.mesh.position.y = rest;
      for (let i = 0; i < 4; i++) {
        p.copy(w.mesh.position).applyMatrix4(this.root.matrixWorld);
        const error = terrainHeight(p.x, p.z) + rest - p.y;
        w.mesh.position.y = THREE.MathUtils.clamp(
          w.mesh.position.y + error / vertical, w.baseY - .3, w.baseY + .3);
      }
      p.copy(w.mesh.position).applyMatrix4(this.root.matrixWorld);
      this.terrainContactError = Math.max(this.terrainContactError,
        Math.abs(p.y - terrainHeight(p.x, p.z) - rest));
    }
  }

  // ---------- Update ----------

  update(dt, zerblePos, zerbleHeading = 0, nightness = 0) {
    this.actorTime=(this.actorTime??0)+dt;
    this._eyeMaterial.emissiveIntensity = nightness * 1.5;
    this._lipMaterial.emissiveIntensity = 0;
    this._lipOutlineMaterial.emissiveIntensity = nightness * 3;
    this._hairLightMaterial.emissiveIntensity = nightness * 3;
    if (nightness > 0) {
      const time = this.actorTime;
      for (let i=0;i<this._hairLights.count;i++) {
        const shimmer=0.35+0.65*Math.pow(0.5+0.5*Math.sin(time*(1.1+i%5*0.13)+i*2.4),6);
        this._twinkleColor.setRGB(shimmer,shimmer,shimmer);
        this._hairLights.setColorAt(i,this._twinkleColor);
      }
      this._hairLights.instanceColor.needsUpdate=true;
    }
    for (const material of this._hairMaterials) material.emissiveIntensity = nightness * 0.12;
    const dx = zerblePos.x - this.position.x;
    const dz = zerblePos.z - this.position.z;
    const dToZerble = Math.hypot(dx, dz);

    // Off-camera re-home: only roll while the player has never met her AND
    // she's well past render distance. The 300m gate means she's deep in fog
    // / occluded by chunk fall-off, so a `setSpawnAt` here is invisible.
    if (this.autoRehome && !this._everMet) {
      this._rehomeTimer -= dt;
      if (this._rehomeTimer <= 0) {
        this._rehomeTimer = REHOME_INTERVAL;
        if (dToZerble > REHOME_DISTANCE_MIN && Math.random() < REHOME_CHANCE) {
          this._relocateNearPlayer(zerblePos, zerbleHeading);
          return;       // skip this frame's state machine — she just teleported
        }
      }
    }

    // State machine
    if (this.scareCooldown > 0) this.scareCooldown -= dt;
    if (this.state === 'wandering') {
      if (dToZerble < AWARE_RANGE && this.scareCooldown <= 0) {
        this.state = 'aware';
        this.awareTimer = 1.4;
        this.heartTimer = 0;
        this._everMet = true;
        // Burst of hearts immediately when first spotted
        this._burstHearts(7);
      }
      this._wander(dt);
    } else if (this.state === 'aware') {
      this.awareTimer -= dt;
      this._emitHearts(dt, /*intense=*/true);
      // Slow to a stop, face Zerble.
      this.speed *= Math.pow(0.5, dt * 4);
      this._faceToward(dt, dx, dz);
      if (this.awareTimer <= 0) {
        this.state = 'following';
      }
    } else if (this.state === 'following') {
      this._emitHearts(dt, /*intense=*/false);
      this._followZerble(dt, dx, dz, dToZerble);
      if (dToZerble > FORGET_RANGE) {
        // Zerble bailed — go back to wandering near current spot.
        this.state = 'wandering';
        this.homePos.copy(this.position);
        this.wanderTimer = 0;
      }
    }

    // Apply movement: forward = (-sin(h), 0, -cos(h)) — same convention as Zerble.
    this.position.x += -Math.sin(this.heading) * this.speed * dt;
    this.position.z += -Math.cos(this.heading) * this.speed * dt;
    // Wheel anim: spin proportional to speed, front wheels steer.
    for (const w of this._wheels) {
      w.mesh.rotation.x += this.speed * dt * 1.5;
      if (w.front) {
        w.mesh.rotation.y = THREE.MathUtils.lerp(w.mesh.rotation.y, this.steerAngle, Math.min(1, dt * 10));
      }
    }

    this.groundOnTerrain();

    // Eye wobble stays inside the shallow dome,
    // staying inside the rim. Lissajous-style motion mimics real googly eyes.
    const t = this.actorTime;
    for (const eye of this.eyes) {
      eye.root.position.y = eye.basePos.y + Math.sin(t * 1.4 + eye.basePos.x) * 0.03;
      eye.pupil.position.x = Math.sin(t * 0.9 + eye.basePos.x * 3) * eye.wobbleX;
      eye.pupil.position.y = Math.cos(t * 1.3 + eye.basePos.x * 2) * eye.wobbleY;
    }

    this._updateRearEffects(dt, nightness);
    this._updateHearts(dt);
  }

  get isFollowing() { return this.state === 'following'; }

  // Festival Run: Zerble hit somebody while she was smitten. Hearts cut, a
  // startled dart away, and a cooldown before she can be won back (the run
  // layer calls this from the damaging-hit gate in main.js — see design D16).
  scareOff(cooldownSec = 12) {
    if (this.state !== 'following' && this.state !== 'aware') return false;
    this.state = 'wandering';
    this.scareCooldown = Math.max(this.scareCooldown, cooldownSec);
    this.awareTimer = 0;
    this.homePos.copy(this.position);
    this.wanderTimer = 0;
    this.speed = Math.max(this.speed, 6);
    return true;
  }

  // ---------- Driving primitives ----------

  _wander(dt) {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * HOME_RADIUS * 0.7;
      this.wanderTarget.set(
        this.homePos.x + Math.cos(ang) * r,
        0,
        this.homePos.z + Math.sin(ang) * r,
      );
      this.wanderTimer = 9 + Math.random() * 8;
    }
    this._driveToward(dt, this.wanderTarget.x, this.wanderTarget.z, 0.6);
  }

  _followZerble(dt, dx, dz, dToZerble) {
    if (dToZerble < FOLLOW_DIST) {
      // Maintain follow distance — coast.
      this.speed *= Math.pow(0.5, dt * 3);
      this._faceToward(dt, dx, dz);
      return;
    }
    const inv = 1 / (dToZerble || 1);
    const reachX = this.position.x + dx * inv * (dToZerble - FOLLOW_DIST);
    const reachZ = this.position.z + dz * inv * (dToZerble - FOLLOW_DIST);
    this._driveToward(dt, reachX, reachZ, 1.0);
  }

  _faceToward(dt, dx, dz) {
    const dist = Math.hypot(dx, dz) || 1;
    const target = Math.atan2(-dx / dist, -dz / dist);
    let diff = target - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt);
    this.steerAngle = THREE.MathUtils.clamp(diff * 1.5, -0.5, 0.5);
  }

  _driveToward(dt, tx, tz, speedScale) {
    const ddx = tx - this.position.x;
    const ddz = tz - this.position.z;
    const dist = Math.hypot(ddx, ddz);
    if (dist < 1.0) {
      this.speed *= Math.pow(0.5, dt * 3);
      this.steerAngle *= 0.9;
      return;
    }
    const targetHeading = Math.atan2(-ddx / dist, -ddz / dist);
    let diff = targetHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt);
    this.steerAngle = THREE.MathUtils.clamp(diff * 1.5, -0.5, 0.5);

    // Speed scales with how aligned we are with the target direction — but
    // always at least a fraction of full speed so she can start moving while
    // still rotating to face the target. The previous `aligned > 0.4` gate
    // left her stuck at 0 speed during the initial turn-toward-Zerble.
    const aligned = Math.cos(diff);
    const driveFactor = Math.max(0.25, (aligned + 1) * 0.5);   // 0.25..1.0
    const target = SPEED_MAX * speedScale * driveFactor;
    if (this.speed < target) {
      this.speed = Math.min(target, this.speed + ACCEL * dt);
    } else {
      this.speed *= Math.pow(0.5, dt * 2);
    }
  }

  // ---------- Hearts ----------

  _emitHearts(dt, intense) {
    this.heartTimer -= dt;
    if (this.heartTimer > 0) return;
    this.heartTimer = intense ? HEART_INTERVAL_AWARE : HEART_INTERVAL_FOLLOW;
    this._burstHearts(intense ? 3 : 1);
  }

  _burstHearts(n) {
    for (let i = 0; i < n; i++) this._spawnHeart();
  }

  _spawnHeart() {
    // Heart-shaped extruded geometry, pink emissive material. Particles
    // billboard toward the camera each frame so the heart shape is always
    // readable.
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff4d8a,
      emissive: 0xff2266,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 1,
    });
    const heart = new THREE.Mesh(_heartGeo, mat);
    heart.position.set(
      this.position.x + (Math.random() - 0.5) * 1.4,
      2.4 + Math.random() * 0.4,
      this.position.z + (Math.random() - 0.5) * 1.4,
    );
    heart.userData = {
      age: 0,
      vy: 1.4 + Math.random() * 0.7,
      vx: (Math.random() - 0.5) * 0.6,
      vz: (Math.random() - 0.5) * 0.6,
      spinSign: Math.random() < 0.5 ? -1 : 1,
    };
    this._heartGroup.add(heart);
    this._activeHearts.push(heart);
  }

  _updateHearts(dt) {
    // Cache camera world position for billboarding (uses the live three.js
    // camera so hearts always face the player).
    const cam = window.__game?.camera;
    for (let i = this._activeHearts.length - 1; i >= 0; i--) {
      const h = this._activeHearts[i];
      h.userData.age += dt;
      if (h.userData.age >= HEART_LIFETIME) {
        this._heartGroup.remove(h);
        // Heart geometry is shared; only dispose the material.
        h.material.dispose();
        this._activeHearts.splice(i, 1);
        continue;
      }
      h.position.x += h.userData.vx * dt;
      h.position.y += h.userData.vy * dt;
      h.position.z += h.userData.vz * dt;
      h.userData.vy *= Math.pow(0.5, dt * 0.4);
      const fade = 1 - h.userData.age / HEART_LIFETIME;
      h.material.opacity = fade;
      h.scale.setScalar(1 + h.userData.age * 0.4);
      // Billboard toward the camera, then add a gentle rocking spin so it
      // doesn't look perfectly static.
      if (cam) {
        h.lookAt(cam.position);
      }
      h.rotation.z += dt * 1.5 * h.userData.spinSign;
    }
  }
}
