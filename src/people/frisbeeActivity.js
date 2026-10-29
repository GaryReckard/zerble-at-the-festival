import * as THREE from 'three';
import {registry} from '../registry.js';
import {isPointInLake} from '../lakes.js';
import {terrainHeight} from '../worldgen/terrain.js';
import {laneDodgeTest} from '../steering.js';
import {buildFrisbeeDisc,tickFrisbeeDisc} from '../models/frisbeePlayer.js';
import {disposeSceneResources} from './sceneResources.js';
import {FrisbeeSession} from './frisbeeSession.js';
const eligible=v=>!v.claimed&&!v.grouped&&!v.photographer&&!v.seated&&!v.hidden&&['idle','walking','watching'].includes(v.state);

// Open-ground play is limited to nearby uncommitted adults; the pair owns a disc,
// never either participant's lifetime or collider.
export class FrisbeeActivity {
  constructor({people,runtime}){
    this.people=people;this.runtime=runtime;this.group=new THREE.Group();this.group.name='FrisbeeActivities';this.slots=[];this.scan=0;this.clock=0;this.point=new THREE.Vector3();this.disposed=false;
    try {
    for(let i=0;i<5;i++){
      const disc=buildFrisbeeDisc(()=>((i*37+17)%100)/100);disc.visible=false;this.group.add(disc);
      const slot={disc,reservation:null,holder:0,catcher:1,timer:0,age:0,velocity:new THREE.Vector3(),views:[{},{}]};
      const place={
        reserve:(a,b)=>{if(slot.reservation||!people.readPerson(a,slot.views[0])||!people.readPerson(b,slot.views[1]))return null;return slot.reservation={a,b,ax:slot.views[0].x,az:slot.views[0].z,bx:slot.views[1].x,bz:slot.views[1].z};},
        isLive:r=>!!r&&slot.reservation===r&&!isPointInLake(r.ax,r.az)&&!isPointInLake(r.bx,r.bz)&&!registry.closestBuilding(this.point.set(r.ax,0,r.az),.45)&&!registry.closestBuilding(this.point.set(r.bx,0,r.bz),.45),
        release:r=>{if(slot.reservation===r)slot.reservation=null;},
        hide:()=>{disc.visible=false;},
        settle:()=>{if(isPointInLake(disc.position.x,disc.position.z)){for(const person of slot.session.persons){if(people.readPerson(person,slot.views[0])){disc.position.x=slot.views[0].x;disc.position.z=slot.views[0].z;break;}}}disc.position.y=terrainHeight(disc.position.x,disc.position.z)+.05;slot.velocity.set(0,0,0);disc.visible=true;},
      };
      slot.session=new FrisbeeSession({people,place,eligible,now:()=>this.clock});this.slots.push(slot);
    }
    this.ownerToken=runtime.register({key:'frisbees',controller:this,schedule:[{slot:'roaming',run(dt,frame){this.update(dt,frame);}}]});
    } catch(error){try{this.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Frisbee construction and cleanup failed.');}throw error;}
  }
  update(dt,frame){
    if(this.disposed||frame.npcsFrozen)return;
    const cart=frame.zerble;this.clock+=dt;this.scan-=dt;
    for(const slot of this.slots){
      const s=slot.session;if(s.phase==='idle')continue;
      let safe=true;
      for(let i=0;i<s.persons.length;i++){const v=slot.views[i];if(!this.people.readPerson(s.persons[i],v)){safe=false;break;}
        const dx=v.x-cart.position.x,dz=v.z-cart.position.z;
        if(Math.hypot(dx,dz)<20||(cart.forwardWorld&&laneDodgeTest(dx,dz,cart.forwardWorld.x,cart.forwardWorld.z,cart.speed)))safe=false;
      }
      s.update(dt,{safe});if(s.phase!=='playing')continue;
      if(!s.persons.every((p,i)=>this.people.readPerson(p,slot.views[i]))){s.finish('unavailable');continue;}
      slot.age+=dt;if(slot.age>45){s.finish('completed');continue;}
      const holder=slot.views[slot.holder],catcher=slot.views[slot.catcher],disc=slot.disc;
      this.posePlayers(slot,dt);
      if(s.discState==='held'){
        this.people.readActivityHand(s.claims[slot.holder],disc.position);disc.visible=true;
        slot.timer-=dt;
        if(slot.timer<=0){const dx=catcher.x-holder.x,dz=catcher.z-holder.z,d=Math.hypot(dx,dz)||1;
          slot.velocity.set(dx/d*9.5,5.2,dz/d*9.5);s.discState='flying';}
      }else if(s.discState==='flying'){
        disc.position.addScaledVector(slot.velocity,dt);slot.velocity.y-=5.88*dt;
        if(disc.position.y<=terrainHeight(disc.position.x,disc.position.z)+.05){disc.position.y=terrainHeight(disc.position.x,disc.position.z)+.05;s.discState='landed';}
        else if(Math.hypot(disc.position.x-catcher.x,disc.position.z-catcher.z)<.7&&disc.position.y<catcher.y+1.7&&disc.position.y>catcher.y+.6){
          [slot.holder,slot.catcher]=[slot.catcher,slot.holder];slot.timer=1;s.discState='held';
        } else {
          const height=disc.position.y-(terrainHeight(catcher.x,catcher.z)+.4),vy=slot.velocity.y;
          const root=vy*vy+2*5.88*height,t=root>=0?Math.max(0,(vy+Math.sqrt(root))/5.88):0;
          this.moveCatcher(slot,catcher,disc.position.x+slot.velocity.x*t,disc.position.z+slot.velocity.z*t,dt);
        }
      }
      if(s.discState==='landed'){
        const dx=disc.position.x-catcher.x,dz=disc.position.z-catcher.z,d=Math.hypot(dx,dz);
        if(d<.7){[slot.holder,slot.catcher]=[slot.catcher,slot.holder];slot.timer=1;s.discState='held';}
        else this.moveCatcher(slot,catcher,disc.position.x,disc.position.z,dt);
      }
      if(s.discState==='held')this.people.readActivityHand(s.claims[slot.holder],disc.position);
      tickFrisbeeDisc(disc,dt,s.discState,frame.nightness);
    }
    if(this.scan>0)return;this.scan=3;
    for(const slot of this.slots){
      if(slot.session.phase!=='idle')continue;
      const candidates=[];
      this.people.forEachPersonNear(cart.position.x,cart.position.z,80,(handle,v,d)=>{if(d>25&&eligible(v)&&this.people.activityCooldown(handle,'frisbee')<=this.clock&&!isPointInLake(v.x,v.z)&&!registry.closestBuilding(this.point.set(v.x,0,v.z),1))candidates.push({handle,x:v.x,z:v.z});});
      let a=null,b=null;
      for(let i=0;i<candidates.length&&!a;i++)for(let j=i+1;j<candidates.length;j++){
        const d=Math.hypot(candidates[i].x-candidates[j].x,candidates[i].z-candidates[j].z);
        if(d>=8&&d<=18){a=candidates[i];b=candidates[j];break;}
      }
      if(a&&slot.session.start(a.handle,b.handle)){slot.holder=0;slot.catcher=1;slot.timer=1;slot.age=0;this.posePlayers(slot,0);this.people.readActivityHand(slot.session.claims[slot.holder],slot.disc.position);slot.disc.visible=true;}
    }
  }
  posePlayers(slot,dt){
    const s=slot.session,disc=slot.disc;
    // Face the partner, then pose the original body through its validated
    // render claim. The disc's held origin is the same joint the GPU renders.
    for(let i=0;i<2;i++){
      const v=slot.views[i],other=slot.views[1-i];
      this.people.writeActivityPose(s.claims[i],v.x,v.y,v.z,Math.atan2(v.x-other.x,v.z-other.z));
      const throwing=s.discState==='held'&&i===slot.holder;
      const reach=s.discState==='flying'&&i===slot.catcher?Math.max(0,1-Math.hypot(disc.position.x-v.x,disc.position.z-v.z)/4):0;
      this.people.writeActivityArmPose(s.claims[i],throwing?'throw':reach>0?'catch':'relaxed',throwing?Math.min(1,(1-slot.timer)/.9):reach,dt);
    }
  }
  moveCatcher(slot,catcher,tx,tz,dt){
    const dx=tx-catcher.x,dz=tz-catcher.z,d=Math.hypot(dx,dz);if(d<.05)return;
    const step=Math.min(d,2.6*dt),x=catcher.x+dx/d*step,z=catcher.z+dz/d*step,s=slot.session;
    if(!isPointInLake(x,z)&&!registry.closestBuilding(this.point.set(x,0,z),.45)&&!this.people.hasPersonWithin(x,z,.7,s.persons[slot.catcher]))
      this.people.writeActivityPose(s.claims[slot.catcher],x,terrainHeight(x,z),z,Math.atan2(-dx,-dz),null,dt);
  }
  inspect(out){out.active=this.slots.filter(s=>s.session.phase!=='idle').length;out.disposed=this.disposed;}
  dispose(){if(this.disposed)return;this.disposed=true;const errors=[];
    if(this.runtime.isRegistered(this.ownerToken))try{this.runtime.unregister(this.ownerToken,'activity-disposed');}catch(e){errors.push(e);}
    for(const slot of this.slots)try{slot.session.dispose();}catch(e){errors.push(e);}
    try{disposeSceneResources(this.group);}catch(e){errors.push(e);}this.group.removeFromParent();
    if(errors.length)throw new AggregateError(errors,'Frisbee activity teardown failed.');
  }
}
