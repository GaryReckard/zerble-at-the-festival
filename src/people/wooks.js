// Specialized wook population. Preserve approach/dodge/recycle policy while
// publishing identity, scheduling, collision and readonly query capabilities.
import * as THREE from 'three';
import {terrainHeight} from '../worldgen/terrain.js';
import {buildWook,tickWook} from '../models/wook.js';
import {projectOutOfLake,isPointInLake} from '../lakes.js';
import {PeopleRuntime} from './runtime.js';
import {PersonHandles} from './personHandle.js';
import {disposeSceneResources} from './sceneResources.js';
import {_pickPositionAvoidingLakes} from './placement.js';
const TAU=Math.PI*2;

export class Wooks {
  constructor({runtime=null,key='wooks', collisionOrder=40,initialNear=60,initialFar=160,parkedHonkOrder=0}={}) {
    if(!Number.isFinite(initialNear)||!Number.isFinite(initialFar)||initialNear<0||initialFar<initialNear)throw new RangeError('Invalid wook initial spread.');
    this.group = new THREE.Group();
    this.group.name = 'Wooks';
    this.wooks = [];
    this.colliders = [];
    this._disposed=false;this.peopleRuntime=runtime??new PeopleRuntime();
    this.ownerToken=this.peopleRuntime.register({key,controller:this,
      schedule:[{slot:'roaming',run(dt,frame){this.update(dt,frame.zerble.position,Math.abs(frame.zerble.speed));}}],
      capabilities:{parkedHonk:this.scatter,colliders:this.appendColliders,nearby:this.forEachPersonNear},
      capabilityOrder:{nearby:collisionOrder,parkedHonk:parkedHonkOrder,colliders:collisionOrder},
    });
    this.peopleHandles=new PersonHandles({runtime:this.peopleRuntime,ownerToken:this.ownerToken,read:(w,out)=>this._readPerson(w,out)});
    this.peopleView=this.peopleHandles.view;

    // Wook count was 7 — too dense around spawn, easy to accidentally trigger
    // a trip just by parking. Dropped to 5 + larger initial spread + spread
    // check on recycle (see update()) so two wooks don't cluster.
    try {
      const WOOK_COUNT = 5;
      for (let i = 0; i < WOOK_COUNT; i++) {
        const w = buildWook();
        // Drift in slow circles around random anchor points
        const ang = Math.random() * TAU;
        const rad = initialNear + Math.random() * (initialFar-initialNear);  // was 40+80; now 60-160m initial radius
        w.userData.anchor = new THREE.Vector3(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
        w.userData.radius = 2.5 + Math.random() * 3;
        w.userData.phase = Math.random() * TAU;
        w.userData.speed = 0.4 + Math.random() * 0.4;

        // Honk-scatter dodge timer. While > 0, the wook walks straight away
        // from Zerble instead of orbiting its anchor. When it expires we
        // re-anchor to the new position so orbit resumes from there.
        w.userData.dodgeTimer = 0;
        w.userData.dodgeDirX = 0;
        w.userData.dodgeDirZ = 0;

        this.group.add(w);
        w.userData.personHandle=this.peopleHandles.create(this.wooks.length,w);
        this.wooks.push(w);
        this.colliders.push({
          position: new THREE.Vector3(),
          radius: 0.9,
          damage: 5,
          kind: 'wook',
        });
      }
    } catch(error) {
      try {this.dispose('construction-failed');}catch(cleanupError){throw new AggregateError([error,cleanupError],'Wook construction and cleanup failed.');}
      throw error;
    }
  }

  // Honk-scatter trigger. Wooks in front of a parked Zerble (within
  // FRONT_RANGE) get a short dodge timer + direction-away vector. Mirrors
  // KidGaggle.scatter — same convention: dot(rel, zerble.forwardWorld) > 0
  // means in front, since forwardWorld points along the cart's nose.
  scatter(zerble) {
    if (this._disposed || !zerble || !zerble.forwardWorld) return;
    const FRONT_RANGE = 10;
    const FRONT_RANGE_SQ = FRONT_RANGE * FRONT_RANGE;
    const fx = zerble.forwardWorld.x;
    const fz = zerble.forwardWorld.z;
    for (const w of this.wooks) {
      const dx = w.position.x - zerble.position.x;
      const dz = w.position.z - zerble.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > FRONT_RANGE_SQ) continue;
      if (dx * fx + dz * fz <= 0) continue;
      const inv = 1 / Math.sqrt(d2 || 0.0001);
      w.userData.dodgeTimer = 1.4;
      w.userData.dodgeDirX = dx * inv;
      w.userData.dodgeDirZ = dz * inv;
    }
  }

  _readPerson(w,out) {
    out.x=w.position.x;out.y=w.position.y;out.z=w.position.z;out.heading=w.rotation.y;
    out.state=w.userData.dodgeTimer>0?'scattering':this.colliders[w.userData.personHandle.slot]?.passive?'approaching':'wandering';
    out.grouped=false;out.hidden=!w.visible;
  }
  readPerson(handle,out){return this.peopleView.read(handle,out);}
  forEachPersonNear(x,z,radius,visit,queryScratch=null) {
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0||typeof visit!=='function')throw new TypeError('Invalid nearby-person query.');
    if(this._disposed)return;
    const scratch=queryScratch??(this._personQueryScratch??={});
    for(const w of this.wooks){const distance=Math.hypot(w.position.x-x,w.position.z-z);if(distance>=radius)continue;this.peopleHandles.readOwnedRecord(w,scratch);if(visit(w.userData.personHandle,scratch,distance)===false)return;}
  }
  appendColliders(out){if(!this._disposed)for(const collider of this.colliders)out.push(collider);}
  copyPositions(out) {
    for(let i=0;i<this.wooks.length;i++){out[i]??=new THREE.Vector3();out[i].copy(this.wooks[i].position);}
    out.length=this.wooks.length;return out;
  }
  inspect(out){out.population=this.wooks.length;out.disposed=this._disposed;out.approaching=0;for(const collider of this.colliders)if(collider.passive)out.approaching++;}
  dispose(reason='population-disposed') {
    if(this._disposed)return;this._disposed=true;
    const errors=[],release=fn=>{try{fn();}catch(error){errors.push(error);}};
    if(this.peopleRuntime.isRegistered(this.ownerToken))release(()=>this.peopleRuntime.unregister(this.ownerToken,reason));
    release(()=>this.peopleHandles.dispose());
    release(()=>disposeSceneResources(this.group));
    this.group.removeFromParent();this.wooks.length=0;this.colliders.length=0;
    if(errors.length)throw new AggregateError(errors,'Wook teardown failed.');
  }

  // Wooks normally drift in slow circles around fixed anchors. But if Zerble
  // parks within DETECTION_RANGE, the closest wook breaks formation and walks
  // straight to him — he's about to dose the driver. zerblePos/zerbleSpeed
  // are optional; if omitted, wooks only do their default orbit (sandbox case).
  update(dt, zerblePos, zerbleSpeed) {
    if(this._disposed)return;
    const DETECTION_RANGE = 25;     // wooks notice a stopped Zerble within this
    const APPROACH_SPEED  = 1.8;    // m/s when walking up to the driver
    const REST_SPEED      = 0.5;    // |zerble.speed| below this counts as stopped
    const FAR_THRESHOLD2  = 300 * 300;  // recycle a wook whose anchor is this far
    const RECYCLE_MIN     = 90;     // re-anchor within this minimum distance (was 60 — too close)
    const RECYCLE_MAX     = 160;    // ...and this maximum, around Zerble
    const WOOK_SPREAD     = 40;     // min metres between wook anchors after recycle

    // Recycle wooks whose anchor drifted too far from Zerble — without this,
    // the wooks spawned at world origin stay at radius 60-160m forever, so
    // anyone who drives 800m away never encounters one. Recycled positions
    // honour WOOK_SPREAD (min distance between two wook anchors) so two
    // wooks don't cluster within trip-trigger range of each other.
    if (zerblePos) {
      for (let i = 0; i < this.wooks.length; i++) {
        const w = this.wooks[i];
        const a = w.userData.anchor;
        const adx = a.x - zerblePos.x;
        const adz = a.z - zerblePos.z;
        if (adx * adx + adz * adz > FAR_THRESHOLD2) {
          // Try up to 8 angles to find a position with adequate spread
          // AND not inside a lake.
          let placed = false;
          for (let attempt = 0; attempt < 8; attempt++) {
            const ang = Math.random() * TAU;
            const dist = RECYCLE_MIN + Math.random() * (RECYCLE_MAX - RECYCLE_MIN);
            const nx = zerblePos.x + Math.cos(ang) * dist;
            const nz = zerblePos.z + Math.sin(ang) * dist;
            if (isPointInLake(nx, nz)) continue;
            let tooClose = false;
            for (let j = 0; j < this.wooks.length; j++) {
              if (j === i) continue;
              const oa = this.wooks[j].userData.anchor;
              const ddx = nx - oa.x, ddz = nz - oa.z;
              if (ddx * ddx + ddz * ddz < WOOK_SPREAD * WOOK_SPREAD) { tooClose = true; break; }
            }
            if (!tooClose) {
              a.set(nx, 0, nz);
              placed = true;
              break;
            }
          }
          // Fallback: if spread + lake-avoid couldn't be satisfied (unlikely
          // with only 5 wooks), accept any non-lake spot — better than not
          // recycling. The per-frame projection below catches the remainder.
          if (!placed) {
            const p = _pickPositionAvoidingLakes(
              zerblePos.x, zerblePos.z, RECYCLE_MIN, RECYCLE_MAX,
            );
            a.set(p.x, 0, p.z);
          }
          // Re-randomize so all recycled wooks don't lock to the same orbit phase
          w.userData.phase = Math.random() * TAU;
        }
      }
    }

    // Pick the wook that should approach: closest to Zerble, if Zerble is at rest
    // and within detection range. -1 means no one is approaching this frame.
    let approachIdx = -1;
    if (zerblePos && zerbleSpeed != null && zerbleSpeed < REST_SPEED) {
      let bestD2 = DETECTION_RANGE * DETECTION_RANGE;
      for (let i = 0; i < this.wooks.length; i++) {
        const w = this.wooks[i];
        const dx = w.position.x - zerblePos.x;
        const dz = w.position.z - zerblePos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestD2) { bestD2 = d2; approachIdx = i; }
      }
    }

    for (let i = 0; i < this.wooks.length; i++) {
      const w = this.wooks[i];
      const isApproaching = (i === approachIdx && zerblePos);
      const isDodging = w.userData.dodgeTimer > 0;

      if (isDodging) {
        // Walk straight away from Zerble at dodge speed. Overrides orbit
        // AND approach so a honked-at "approaching" wook also backs off.
        const DODGE_SPEED = 3.5;
        w.position.x += w.userData.dodgeDirX * DODGE_SPEED * dt;
        w.position.z += w.userData.dodgeDirZ * DODGE_SPEED * dt;
        // Face direction of travel.
        w.rotation.y = Math.atan2(-w.userData.dodgeDirX, -w.userData.dodgeDirZ);
        w.userData.dodgeTimer -= dt;
        if (w.userData.dodgeTimer <= 0) {
          // Re-anchor at the new position so the orbit resumes from here
          // instead of snapping back to the old spot.
          w.userData.anchor.set(w.position.x, 0, w.position.z);
          w.userData.phase = 0;
        }
      } else if (isApproaching) {
        // Leave room for Zerble's 1.9m footprint, the wook's 0.9m
        // collider and a little clearance, even across a long frame.
        const dx = zerblePos.x - w.position.x;
        const dz = zerblePos.z - w.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 3.1) {
          const inv = 1 / (d || 1);
          const step = Math.min(APPROACH_SPEED * dt, d - 3.1);
          w.position.x += dx * inv * step;
          w.position.z += dz * inv * step;
        }
        // Face Zerble — local -z is forward
        w.rotation.y = Math.atan2(-dx, -dz);
      } else {
        // Default behavior: orbit the anchor
        w.userData.phase += w.userData.speed * dt;
        const a = w.userData.anchor;
        const px = a.x + Math.cos(w.userData.phase) * w.userData.radius;
        const pz = a.z + Math.sin(w.userData.phase * 0.7) * w.userData.radius;
        w.position.set(px, 0, pz);
        w.rotation.y = -w.userData.phase + Math.PI;
      }

      // Sway (applies to everyone — including the creep walking up to you).
      // See models/wook.js for the math; sandbox calls the same tick.
      tickWook(w, dt);

      // An offering wook must not shove or damage the parked cart.
      // Approach movement itself maintains clearance outside both footprints.
      this.colliders[i].passive = isApproaching;
      this.colliders[i].damage = isApproaching ? 0 : 5;
    }

    // Per-frame safety net — any wook whose orbit/dodge ended up inside a
    // lake gets projected to the shore (and re-anchored there so they don't
    // orbit straight back in). Same pattern as KidGaggle.update.
    for (let i = 0; i < this.wooks.length; i++) {
      const w = this.wooks[i];
      if (isPointInLake(w.position.x, w.position.z)) {
        const shore = projectOutOfLake(w.position.x, w.position.z, 3.0);
        if (shore) {
          w.position.x = shore.x;
          w.position.z = shore.z;
          w.userData.anchor.set(shore.x, 0, shore.z);
        }
      }
      w.position.y = terrainHeight(w.position.x, w.position.z);
      this.colliders[i].position.copy(w.position);
      this.colliders[i].position.y += 1;
    }
  }
}
