// Global performer pool, with independently owned person lifetimes and place
// footprints. Relocation changes the place, not the person's identity.
import * as THREE from 'three';
import {terrainHeight} from '../worldgen/terrain.js';
import {registry} from '../registry.js';
import {buildHulaHooper,tickHulaHooper} from '../models/hulaHooper.js';
import {PeopleRuntime} from './runtime.js';
import {PersonHandles} from './personHandle.js';
import {disposeSceneResources} from './sceneResources.js';
const TAU=Math.PI*2;

const HOOPER_ATTRACTOR_KINDS = new Set([
  'stage', 'stage_front', 'drum_circle', 'firepit', 'leaf_drum_circle',
]);
const HOOPER_HOOP_RADIUS = 0.58;          // matches model
const HOOPER_AVOID_RADIUS = HOOPER_HOOP_RADIUS + 0.6;  // crowd footprint
const HOOPER_MAX = 8;                     // global pool size
const HOOPER_SEARCH_RANGE = 120;          // attractors within this of Zerble
const HOOPER_RECYCLE_DIST2 = 220 * 220;   // recycle if drifted this far

export class HulaHoopers {
  constructor({runtime=null,key='hoopers', collisionOrder=50}={}) {
    this.group = new THREE.Group();
    this.group.name = 'HulaHoopers';
    this.hoopers = [];
    this.colliders = [];
    this._scanCooldown = 0;
    this._tmp = new THREE.Vector3();
    this._disposed=false;this.peopleRuntime=runtime??new PeopleRuntime();
    this.ownerToken=this.peopleRuntime.register({key,controller:this,
      schedule:[{slot:'roaming',run(dt,frame){this.update(dt,frame.zerble.position,frame.nightness);}}],
      capabilities:{colliders:this.appendColliders,nearby:this.forEachPersonNear},
      capabilityOrder:{nearby:collisionOrder,colliders:collisionOrder},
    });
    this.peopleHandles=new PersonHandles({runtime:this.peopleRuntime,ownerToken:this.ownerToken,read:(h,out)=>this._readPerson(h,out)});
    this.peopleView=this.peopleHandles.view;
  }

  _readPerson(h,out){out.x=h.position.x;out.y=h.position.y;out.z=h.position.z;out.heading=h.rotation.y;out.state=h.visible?'performing':'unplaced';out.grouped=false;out.hidden=!h.visible;}
  readPerson(handle,out){return this.peopleView.read(handle,out);}
  forEachPersonNear(x,z,radius,visit,queryScratch=null){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0||typeof visit!=='function')throw new TypeError('Invalid nearby-person query.');
    if(this._disposed)return;
    const scratch=queryScratch??(this._personQueryScratch??={});
    for(const h of this.hoopers){if(!h.visible)continue;const distance=Math.hypot(h.position.x-x,h.position.z-z);if(distance>=radius)continue;this.peopleHandles.readOwnedRecord(h,scratch);if(visit(h.userData.personHandle,scratch,distance)===false)return;}
  }
  appendColliders(out){if(!this._disposed)for(let i=0;i<this.hoopers.length;i++)if(this.hoopers[i].visible)out.push(this.colliders[i]);}
  _publishFootprint(h){
    const entry=registry.entries.get(h.userData.footprintId);if(!entry)return;
    entry.footprint=h.visible?HOOPER_AVOID_RADIUS:0;
    entry.position.set(h.position.x,h.visible?terrainHeight(h.position.x,h.position.z):-1000,h.position.z);
    // The established frame spatial-index barrier publishes moving footprints.
  }
  inspect(out){out.population=this.hoopers.length;out.active=0;for(const h of this.hoopers)if(h.visible)out.active++;out.disposed=this._disposed;}
  dispose(reason='population-disposed'){
    if(this._disposed)return;this._disposed=true;
    const errors=[],release=fn=>{try{fn();}catch(error){errors.push(error);}};
    if(this.peopleRuntime.isRegistered(this.ownerToken))release(()=>this.peopleRuntime.unregister(this.ownerToken,reason));
    release(()=>this.peopleHandles.dispose());
    for(const h of this.hoopers){const id=h.userData.footprintId;h.userData.footprintId=null;if(id!=null)release(()=>registry.remove(id));}
    release(()=>disposeSceneResources(this.group));this.group.removeFromParent();this.hoopers.length=0;this.colliders.length=0;
    if(errors.length)throw new AggregateError(errors,'Hooper teardown failed.');
  }

  // Called once per frame from main.js.
  //   zerblePos: Vector3        (player position)
  //   nightness: 0..1           (drives hoop glow)
  update(dt, zerblePos, nightness = 0) {
    if(this._disposed)return;
    this._scanCooldown -= dt;
    if (zerblePos && this._scanCooldown <= 0) {
      this._scanCooldown = 2.5;            // re-scan every 2.5s
      this._rescan(zerblePos);
    }

    for (let i = 0; i < this.hoopers.length; i++) {
      const h = this.hoopers[i];
      if (!h.visible) continue;
      const u = h.userData;
      // Body sway + hoop spin + glow all live in tickHulaHooper so the
      // sandbox and the game can't drift out of sync. See models/hulaHooper.js.

      // Slight random drift: every few seconds pick a new tiny offset target
      // near the anchor, then ease toward it at a snail's pace. Keeps the
      // hooper from feeling rooted to the spot without abandoning the POI.
      u.driftTimer -= dt;
      if (u.driftTimer <= 0) {
        u.driftTimer = 4 + Math.random() * 5;
        const ang = Math.random() * TAU;
        const r = 0.4 + Math.random() * 0.9;
        u.driftTargetX = u.anchorX + Math.cos(ang) * r;
        u.driftTargetZ = u.anchorZ + Math.sin(ang) * r;
      }
      const ddx = u.driftTargetX - h.position.x;
      const ddz = u.driftTargetZ - h.position.z;
      const dd = Math.hypot(ddx, ddz);
      if (dd > 0.04) {
        const step = Math.min(dd, 0.25 * dt);   // ~25cm/s — barely a shuffle
        h.position.x += (ddx / dd) * step;
        h.position.z += (ddz / dd) * step;
        this._publishFootprint(h);
      }

      h.position.y = terrainHeight(h.position.x, h.position.z);
      tickHulaHooper(h,dt,nightness);
      // Collider — at chest height, body radius only (hoop itself isn't solid)
      this.colliders[i].position.copy(h.position);
      this.colliders[i].position.y += 0.9;
    }
  }

  // Find valid attractor anchors near Zerble and (re)place hoopers that have
  // no anchor or drifted too far away.
  _rescan(zerblePos) {
    // Collect candidate attractors within range, sorted by attractor weight
    const candidates = [];
    for (const e of registry.entries.values()) {
      if (!e.attractor || !HOOPER_ATTRACTOR_KINDS.has(e.kind)) continue;
      const dx = e.position.x - zerblePos.x;
      const dz = e.position.z - zerblePos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > HOOPER_SEARCH_RANGE * HOOPER_SEARCH_RANGE) continue;
      candidates.push({ entry: e, d2 });
    }
    // Tally existing hoopers per attractor id
    const perAttractor = new Map();
    for (const h of this.hoopers) {
      const aid = h.userData.attractorId;
      if (aid != null) perAttractor.set(aid, (perAttractor.get(aid) || 0) + 1);
    }

    // Recycle stale hoopers (no anchor, or anchor too far from Zerble, or
    // anchor entry no longer exists in registry).
    for (const h of this.hoopers) {
      const u = h.userData;
      const stillValid = u.attractorId != null && registry.entries.has(u.attractorId);
      const dx = h.position.x - zerblePos.x;
      const dz = h.position.z - zerblePos.z;
      const tooFar = dx * dx + dz * dz > HOOPER_RECYCLE_DIST2;
      if (!stillValid || tooFar) {
        if (u.attractorId != null) {
          const c = perAttractor.get(u.attractorId) || 0;
          if (c > 0) perAttractor.set(u.attractorId, c - 1);
        }
        u.attractorId = null;
        h.visible = false;
        this._publishFootprint(h);
      }
    }

    // Try to (re)place any hooper that has no anchor. Most attractors come
    // up empty (rolling against a low chance), keeping the average to 0-1.
    for (const h of this.hoopers) {
      if (h.userData.attractorId != null) continue;
      // Shuffle candidates for variety
      shuffleInPlace(candidates);
      for (const cand of candidates) {
        const e = cand.entry;
        const already = perAttractor.get(e.id) || 0;
        // Cap per attractor; bigger attractors (high weight) get higher cap
        const maxHere = e.attractor.weight >= 2 ? 3 : (e.attractor.weight >= 1 ? 2 : 1);
        if (already >= maxHere) continue;
        // Most candidates roll empty. Weighted by attractor weight so big
        // stages are more likely to attract a hooper than a tent.
        const accept = Math.random() < 0.18 * Math.min(2.5, e.attractor.weight);
        if (!accept) continue;
        // Place on a ring inside the attractor radius
        const ang = Math.random() * TAU;
        const rad = (0.45 + Math.random() * 0.5) * e.attractor.radius;
        const x = e.position.x + Math.cos(ang) * rad;
        const z = e.position.z + Math.sin(ang) * rad;
        // Don't drop onto a hard collider
        if (registry.closestBuilding(new THREE.Vector3(x, 0, z), HOOPER_AVOID_RADIUS)) continue;
        h.position.set(x, terrainHeight(x, z), z);
        // Face roughly inward toward the attractor center
        h.rotation.y = Math.atan2(e.position.x - x, e.position.z - z);
        h.visible = true;
        h.userData.attractorId = e.id;
        // Re-roll phase so newly placed hoopers don't all sync up. Their
        // gyrSpeed + hoopSpinMult were picked at buildHulaHooper time and
        // stay stable across re-placements — feels like the same person
        // relocating, not a different one each time.
        h.userData.phase = Math.random() * TAU;
        // Drift state: anchor + an offset target inside a ~1m bubble around it
        h.userData.anchorX = x;
        h.userData.anchorZ = z;
        h.userData.driftTargetX = x;
        h.userData.driftTargetZ = z;
        h.userData.driftTimer = 2 + Math.random() * 4;
        // Bump the per-attractor count so the next hooper doesn't double-stack
        perAttractor.set(e.id, already + 1);
        this._publishFootprint(h);
        break;
      }
    }
  }
}

// Construct hoopers lazily on first use so the pool isn't allocated until the
// world is built (otherwise the registry would be empty during _rescan and we
// might as well not bother). Factory pattern mirrors how main.js owns the
// other obstacle classes.
HulaHoopers.create = function create(options={}) {
  const hh = new HulaHoopers(options);
  try {
  for (let i = 0; i < HOOPER_MAX; i++) {
    const h = buildHulaHooper();
    h.visible = false;
    h.userData.attractorId = null;
    h.userData.phase = 0;
    h.userData.gyrSpeed = 1.8;
    hh.group.add(h);
    h.userData.personHandle=hh.peopleHandles.create(hh.hoopers.length,h);
    hh.hoopers.push(h);
    hh.colliders.push({
      position: new THREE.Vector3(),
      radius: 0.55,
      damage: 4,
      kind: 'hula_hoop',
    });
    // Identity remains in the global pool while inactive. A zero-radius
    // footprint disables X/Z avoidance until this person has an active place.
    const fpId = registry.add({
      kind: 'hula_hoop',
      position: new THREE.Vector3(0, -1000, 0),
      footprint: 0,
    });
    h.userData.footprintId = fpId;
  }
  return hh;
  } catch(error){
    try{hh.dispose('construction-failed');}catch(cleanupError){throw new AggregateError([error,cleanupError],'Hooper construction and cleanup failed.');}
    throw error;
  }
};

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
