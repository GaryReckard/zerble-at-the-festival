// Formation owns carrier identities and path intent; lanterns remain display rigs.
import * as THREE from 'three';
import {terrainHeight} from '../worldgen/terrain.js';
import {buildPuppet,tickPuppet,setPuppetNightness,PARADE_ROSTER} from '../models/puppet.js';
import {getTimeOfDay} from '../world.js';
import {PeopleRuntime} from './runtime.js';
import {PersonHandles} from './personHandle.js';
import {disposeSceneResources} from './sceneResources.js';
import {LOOP_INITIAL_SPREAD,placeLoop,maybeRecycleLoop,pathLength,samplePath} from './formationRoute.js';

export class PuppetParade {
  constructor({ preview = false, runtime = null, key = 'puppet-parade', collisionOrder=10, parkedHonkOrder = 0 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'PuppetParade';

    this.puppets=[];this.colliders=[];
    this._disposed=false;this.peopleRuntime=runtime??new PeopleRuntime();
    this.ownerToken=this.peopleRuntime.register({key,controller:this,
      schedule:[{slot:'formations',run(dt,frame){this.update(dt,frame.zerble.position);}}],
      capabilities:{parkedHonk:this.scatter,colliders:this.appendColliders,nearby:this.forEachPersonNear},
      capabilityOrder:{nearby:collisionOrder,parkedHonk:parkedHonkOrder,colliders:collisionOrder},
    });
    this.peopleHandles=new PersonHandles({runtime:this.peopleRuntime,ownerToken:this.ownerToken,read:(collider,out)=>this._readPerson(collider,out)});
    this.peopleView=this.peopleHandles.view;
    try {
      // A patrol path that loops through the festival. The loop shape is fixed
      // (_basePath, local coords); placeLoop() shifts the whole thing to a random
      // anchor. It spawns 0..150m from origin (not always on the start area) and
      // relocates far around the player once you've driven off — see
      // maybeRecycleLoop() in update(). Uses Math.random() like the Wooks / Kids /
      // Frisbees (these mobile units aren't seed-deterministic, by design).
      this._basePath = [
        new THREE.Vector3(-70, 0, -10),
        new THREE.Vector3(-30, 0, 20),
        new THREE.Vector3(20, 0, 10),
        new THREE.Vector3(60, 0, -20),
        new THREE.Vector3(40, 0, -60),
        new THREE.Vector3(-20, 0, -50),
        new THREE.Vector3(-60, 0, -30),
      ];
      this.path = this._basePath.map((p) => p.clone());
      this._preview = preview;
      if (preview) {
        this._anchor = { x: -this._basePath[0].x, z: -this._basePath[0].z };
        for (const point of this.path) {
          point.x += this._anchor.x;
          point.z += this._anchor.z;
        }
      } else {
        this._anchor = placeLoop(this.path, this._basePath, 0, 0, 0, LOOP_INITIAL_SPREAD);
      }
      this.speed = 2.4;

      let ahead = 0;
      for (let i = 0; i < PARADE_ROSTER.length; i++) {
        const puppet = buildPuppet(PARADE_ROSTER[i], i);
        if (i) ahead += i <= 2 ? 7 : 4.5;
        puppet.userData.distance = -ahead;
        // Honk-scatter offset: while dodgeTimer > 0, the puppet's path-derived
        // position gets nudged perpendicular by (dodgeDirX, dodgeDirZ) * eased
        // amount, then snaps back as the timer winds down. Path progression
        // keeps running underneath so the parade still marches through.
        puppet.userData.dodgeTimer = 0;
        puppet.userData.dodgeDirX = 0;
        puppet.userData.dodgeDirZ = 0;
        this.group.add(puppet);
        this.puppets.push(puppet);
      }

      this.colliders = this.puppets.flatMap(p => p.userData.rig.carriers.map((carrier, i) => ({
        position: new THREE.Vector3(), radius: p.userData.kind === 'dragon' && i !== 1 ? 0.65 : 1.4,
        damage: 8, kind: 'puppet', carrier, puppet: p,
      })));

      this._tmpA = new THREE.Vector3();
      this._tmpB = new THREE.Vector3();

    for(let slot=0;slot<this.colliders.length;slot++)this.colliders[slot].personHandle=this.peopleHandles.create(slot,this.colliders[slot]);
    } catch(error) {
      try {this.dispose('construction-failed');}catch(cleanupError){throw new AggregateError([error,cleanupError],'Parade construction and cleanup failed.');}
      throw error;
    }

  }

  // Honk-scatter: puppets in front of parked Zerble get a temporary lateral
  // dodge offset. They keep walking along their path but sidestep by ~2.5m
  // for ~1.4s, then ease back.
  scatter(zerble) {
    if (this._disposed || !zerble || !zerble.forwardWorld) return;
    const FRONT_RANGE = 12;
    const FRONT_RANGE_SQ = FRONT_RANGE * FRONT_RANGE;
    const fx = zerble.forwardWorld.x;
    const fz = zerble.forwardWorld.z;
    for (const p of this.puppets) {
      const dx = p.position.x - zerble.position.x;
      const dz = p.position.z - zerble.position.z;
      if (dx * dx + dz * dz > FRONT_RANGE_SQ) continue;
      if (dx * fx + dz * fz <= 0) continue;
      const inv = 1 / Math.sqrt(dx * dx + dz * dz || 0.0001);
      p.userData.dodgeTimer = 1.4;
      p.userData.dodgeDirX = dx * inv;
      p.userData.dodgeDirZ = dz * inv;
    }
  }

  _readPerson(collider,out) {
    out.x=collider.position.x;out.y=collider.position.y-1;out.z=collider.position.z;
    out.heading=collider.puppet.rotation.y;out.state='marching';out.grouped=true;out.hidden=!collider.puppet.visible;
  }
  readPerson(handle,out){return this.peopleView.read(handle,out);}
  forEachPersonNear(x,z,radius,visit,queryScratch=null){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0||typeof visit!=='function')throw new TypeError('Invalid nearby-person query.');
    if(this._disposed)return;
    const scratch=queryScratch??(this._personQueryScratch??={});
    for(const collider of this.colliders){const distance=Math.hypot(collider.position.x-x,collider.position.z-z);if(distance>=radius)continue;this.peopleHandles.readOwnedRecord(collider,scratch);if(visit(collider.personHandle,scratch,distance)===false)return;}
  }
  appendColliders(out){if(!this._disposed)for(const collider of this.colliders)out.push(collider);}
  inspect(out){out.population=this.colliders.length;out.formations=this.puppets.length;out.disposed=this._disposed;}
  dispose(reason='population-disposed'){
    if(this._disposed)return;this._disposed=true;
    const errors=[],release=fn=>{try{fn();}catch(error){errors.push(error);}};
    if(this.peopleRuntime.isRegistered(this.ownerToken))release(()=>this.peopleRuntime.unregister(this.ownerToken,reason));
    release(()=>this.peopleHandles.dispose());release(()=>disposeSceneResources(this.group));
    this.group.removeFromParent();this.puppets.length=0;this.colliders.length=0;
    if(errors.length)throw new AggregateError(errors,'Parade teardown failed.');
  }

  update(dt, zerblePos, nightness = null) {
    if(this._disposed)return;
    const recycled = this._preview ? null : maybeRecycleLoop(this.path, this._basePath, this._anchor, zerblePos);
    if (recycled) this._anchor = recycled;
    const totalLen = pathLength(this.path);
    for (let i = 0; i < this.puppets.length; i++) {
      const p = this.puppets[i];
      p.userData.distance = (p.userData.distance + this.speed * dt + totalLen * 100) % totalLen;
      const { pos, dir } = samplePath(this.path, p.userData.distance, this._tmpA, this._tmpB);
      p.position.copy(pos);
      // Apply dodge offset on top of the path position. Triangle pulse
      // (ramps up, holds, eases out) over the dodge timer's lifetime.
      if (p.userData.dodgeTimer > 0) {
        p.userData.dodgeTimer -= dt;
        const ratio = Math.max(0, p.userData.dodgeTimer / 1.4);  // 1 → 0
        // Bell curve: peaks mid-dodge so the offset eases in and out.
        const env = Math.sin((1 - ratio) * Math.PI);
        const DODGE_DIST = 2.5;
        p.position.x += p.userData.dodgeDirX * DODGE_DIST * env;
        p.position.z += p.userData.dodgeDirZ * DODGE_DIST * env;
      }
      // Their "front" geometry (eyes/mouth) is at local -Z, so face the direction of travel
      // by setting yaw so that local -Z points along dir.
      const yaw = Math.atan2(-dir.x, -dir.z);
      p.position.y = terrainHeight(p.position.x, p.position.z);
      p.rotation.y = yaw;

      // Per-puppet bob (sandbox calls the same tick — see models/puppet.js)
      setPuppetNightness(p, nightness ?? getTimeOfDay()?.nightness ?? 0);
      tickPuppet(p, dt);

    }
    this.group.updateMatrixWorld(true);
    for (const collider of this.colliders) {
      collider.carrier.getWorldPosition(collider.position);
      collider.position.y = collider.puppet.position.y + 1;
    }
  }
}
