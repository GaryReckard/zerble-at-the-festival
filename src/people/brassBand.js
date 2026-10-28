// Group intent and member identities remain with this formation; its spatial
// music handle is released before its owned render resources.
import * as THREE from 'three';
import {terrainHeight} from '../worldgen/terrain.js';
import {buildBandMember,tickBandMember} from '../models/bandMember.js';
import {buildParasolMarshal,tickParasolMarshal} from '../models/parasolMarshal.js';
import {Sound} from '../sound.js';
import {PeopleRuntime} from './runtime.js';
import {PersonHandles} from './personHandle.js';
import {disposeSceneResources} from './sceneResources.js';
import {LOOP_INITIAL_SPREAD,placeLoop,maybeRecycleLoop,pathLength,samplePath} from './formationRoute.js';

export class BrassBand {
  constructor({runtime=null,key='brass-band', collisionOrder=20,parkedHonkOrder=0,preview=false}={}) {
    this.group = new THREE.Group();
    this.group.name = 'BrassBand';

    this.members=[];this.colliders=[];this._music=null;this._disposed=false;
    this.peopleRuntime=runtime??new PeopleRuntime();
    this.ownerToken=this.peopleRuntime.register({key,controller:this,
      schedule:[{slot:'formations',run(dt,frame){this.update(dt,frame.zerble.position);}}],
      capabilities:{parkedHonk:this.scatter,colliders:this.appendColliders,nearby:this.forEachPersonNear},
      capabilityOrder:{nearby:collisionOrder,parkedHonk:parkedHonkOrder,colliders:collisionOrder},
    });
    this.peopleHandles=new PersonHandles({runtime:this.peopleRuntime,ownerToken:this.ownerToken,read:(member,out)=>this._readPerson(member,out)});
    this.peopleView=this.peopleHandles.view;
    try {
      // Fixed loop shape (local coords). This was hardcoded near origin, so the
      // band always blared right at world spawn; now placeLoop() shifts it to a
      // random anchor 0..150m from origin, and it relocates far around the player
      // once you've driven off — same model as the puppet parade (maybeRecycleLoop
      // in update()). The music source (attached below) tracks the band leader,
      // so it travels with the relocation; recycle only fires at 500m+, where the
      // band is already inaudible, so the teleport is silent.
      this._basePath = [
        new THREE.Vector3(80, 0, 70),
        new THREE.Vector3(40, 0, 95),
        new THREE.Vector3(-30, 0, 95),
        new THREE.Vector3(-90, 0, 70),
        new THREE.Vector3(-95, 0, 10),
        new THREE.Vector3(-60, 0, -10),
        new THREE.Vector3(0, 0, 30),
        new THREE.Vector3(60, 0, 30),
        new THREE.Vector3(85, 0, 50),
      ];
      this.path = this._basePath.map((p) => p.clone());
      this._preview=preview;
      if(preview){this._anchor={x:-this._basePath[0].x,z:-this._basePath[0].z};for(const point of this.path){point.x+=this._anchor.x;point.z+=this._anchor.z;}}
      else this._anchor = placeLoop(this.path, this._basePath, 0, 0, 0, LOOP_INITIAL_SPREAD);
      this.speed = 1.8;

      // Grand-marshal-led second-line formation: parasol up front, two
      // trumpets + sax behind, tuba + drum + trombone in the back row.
      // Distinct instruments per row gives the silhouette real variety.
      const formation = [
        [0, 1.6, 'parasol'],         // grand marshal up front (positive Z = ahead)
        [-1.4, 0, 'trumpet'],
        [1.4, 0, 'trumpet'],
        [0, -1.0, 'sax'],
        [-2.6, -2.2, 'trombone'],
        [0, -2.4, 'tuba'],
        [2.6, -2.2, 'drum'],
      ];

      for (const [offX, offZ, instrument] of formation) {
        const m = instrument === 'parasol' ? buildParasolMarshal() : buildBandMember(instrument, this.members.length);
        m.userData.formationOff = new THREE.Vector3(offX, 0, offZ);
        m.userData.instrument = instrument;
        this.group.add(m);
        m.userData.personHandle=this.peopleHandles.create(this.members.length,m);
        this.members.push(m);
      }

      this.colliders = this.members.map(() => ({
        position: new THREE.Vector3(),
        radius: 1.0,
        damage: 6,
        kind: 'brass',
      }));

      this._parasolPhase = 0;

      this.distance = 0;
      this._tmpA = new THREE.Vector3();
      this._tmpB = new THREE.Vector3();

      // Unit-level honk-scatter offset. The whole formation sidesteps together
      // when any member is in front of parked Zerble.
      this._dodgeTimer = 0;
      this._dodgeDirX = 0;
      this._dodgeDirZ = 0;

      // Continuous second-line groove that follows the band around the world.
      // Attached ONCE here — a constant seed keeps the tune stable across
      // reloads (only one brass band exists, so per-band variation is moot).
      // The band is built at module load, before the start-tap Sound.init, so
      // attachStageMusic returns a deferred handle that Sound.init adopts when
      // the AudioContext comes online; position updates before then are buffered.
      this._music = Sound.attachStageMusic(
        this.path[0].x, terrainHeight(this.path[0].x, this.path[0].z) + 1, this.path[0].z, 0xb4a55, 'second_line',
      );
    } catch(error) {
      try {this.dispose('construction-failed');}catch(cleanupError){throw new AggregateError([error,cleanupError],'Band construction and cleanup failed.');}
      throw error;
    }

  }

  scatter(zerble) {
    if (this._disposed || !zerble || !zerble.forwardWorld) return;
    const FRONT_RANGE = 14;        // bigger range because the formation spans ~6m
    const FRONT_RANGE_SQ = FRONT_RANGE * FRONT_RANGE;
    const fx = zerble.forwardWorld.x;
    const fz = zerble.forwardWorld.z;
    // Trigger if ANY member is in front + in range. Use member positions
    // (set by last update tick) — they reflect the current marching pose.
    for (const m of this.members) {
      const dx = m.position.x - zerble.position.x;
      const dz = m.position.z - zerble.position.z;
      if (dx * dx + dz * dz > FRONT_RANGE_SQ) continue;
      if (dx * fx + dz * fz <= 0) continue;
      // Direction = away from Zerble, derived from this triggering member.
      const inv = 1 / Math.sqrt(dx * dx + dz * dz || 0.0001);
      this._dodgeTimer = 1.6;
      this._dodgeDirX = dx * inv;
      this._dodgeDirZ = dz * inv;
      return;  // one trigger sidesteps the whole unit
    }
  }

  _readPerson(member,out){out.x=member.position.x;out.y=member.position.y;out.z=member.position.z;out.heading=member.rotation.y;out.state='marching';out.grouped=true;out.hidden=!member.visible;}
  readPerson(handle,out){return this.peopleView.read(handle,out);}
  forEachPersonNear(x,z,radius,visit,queryScratch=null){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0||typeof visit!=='function')throw new TypeError('Invalid nearby-person query.');
    if(this._disposed)return;
    const scratch=queryScratch??(this._personQueryScratch??={});
    for(const member of this.members){const distance=Math.hypot(member.position.x-x,member.position.z-z);if(distance>=radius)continue;this.peopleHandles.readOwnedRecord(member,scratch);if(visit(member.userData.personHandle,scratch,distance)===false)return;}
  }
  appendColliders(out){if(!this._disposed)for(const collider of this.colliders)out.push(collider);}
  inspect(out){out.population=this.members.length;out.disposed=this._disposed;out.music=!!this._music;}
  dispose(reason='population-disposed'){
    if(this._disposed)return;this._disposed=true;
    const errors=[],release=fn=>{try{fn();}catch(error){errors.push(error);}};
    if(this.peopleRuntime.isRegistered(this.ownerToken))release(()=>this.peopleRuntime.unregister(this.ownerToken,reason));
    release(()=>this.peopleHandles.dispose());
    const music=this._music;this._music=null;if(music)release(()=>Sound.detachStageMusic(music));
    release(()=>disposeSceneResources(this.group));this.group.removeFromParent();this.members.length=0;this.colliders.length=0;
    if(errors.length)throw new AggregateError(errors,'Band teardown failed.');
  }

  update(dt, zerblePos) {
    if(this._disposed)return;
    const recycled = this._preview ? null : maybeRecycleLoop(this.path, this._basePath, this._anchor, zerblePos);
    if (recycled) this._anchor = recycled;
    const totalLen = pathLength(this.path);
    this.distance = (this.distance + this.speed * dt + totalLen * 100) % totalLen;
    const { pos: leadPos, dir: leadDir } = samplePath(this.path, this.distance, this._tmpA, this._tmpB);
    // Face the direction of travel: yaw rotates local -Z to align with dir.
    const yaw = Math.atan2(-leadDir.x, -leadDir.z);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    // Unit-level dodge offset (honk scatter). Sidestep ~3m perpendicular for
    // the dodge timer's lifetime; bell-curve envelope eases in and out.
    let dodgeOX = 0, dodgeOZ = 0;
    if (this._dodgeTimer > 0) {
      this._dodgeTimer -= dt;
      const ratio = Math.max(0, this._dodgeTimer / 1.6);
      const env = Math.sin((1 - ratio) * Math.PI);
      const DODGE_DIST = 3.0;
      dodgeOX = this._dodgeDirX * DODGE_DIST * env;
      dodgeOZ = this._dodgeDirZ * DODGE_DIST * env;
    }

    for (let i = 0; i < this.members.length; i++) {
      const m = this.members[i];
      const off = m.userData.formationOff;
      // Rotate the offset into the band's heading
      const ox = off.x * cos + off.z * sin;
      const oz = -off.x * sin + off.z * cos;
      m.position.set(leadPos.x + ox + dodgeOX, 0, leadPos.z + oz + dodgeOZ);
      m.position.y = terrainHeight(m.position.x, m.position.z);
      m.rotation.y = yaw;

      // Marching bob + (for the marshal) parasol twirl — both live in
      // the model files now so the sandbox uses the same animation.
      if (m.userData.instrument === 'parasol') {
        tickParasolMarshal(m, dt);
      } else {
        tickBandMember(m, dt);
      }

      this.colliders[i].position.copy(m.position);
      this.colliders[i].position.y = m.position.y + 1;
    }

    // Move the spatial music source to the band leader's current position so
    // the music actually walks around the festival with them.
    if (this._music && this._music.setPosition) {
      this._music.setPosition(leadPos.x, terrainHeight(leadPos.x, leadPos.z) + 1, leadPos.z);
    }
  }
}
