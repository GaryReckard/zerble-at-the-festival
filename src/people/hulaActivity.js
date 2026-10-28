import * as THREE from 'three';
import {registry} from '../registry.js';
import {terrainHeight} from '../worldgen/terrain.js';
import {laneDodgeTest} from '../steering.js';
import {buildHulaHoopGeometry,buildHulaHoopMaterial} from '../models/hulaHooper.js';
import {HulaSession} from './hulaSession.js';

const KINDS=new Set(['stage','stage_front','drum_circle','firepit','leaf_drum_circle']);
const MAX=8;
const eligible=v=>!v.claimed&&!v.grouped&&!v.photographer&&!v.seated&&!v.hidden&&['idle','walking','watching'].includes(v.state);

// The activity owns hoops and reservations; Crowd owns every participant and collider.
export class HulaActivity {
  constructor({people,runtime}) {
    this.people=people;this.runtime=runtime;this.group=new THREE.Group();this.group.name='HulaActivities';
    this.geometries=[];this.material=buildHulaHoopMaterial();
    this.slots=[];this.clock=0;this.scan=0;this.disposed=false;this.view={};this.neighborView={};this.testPoint=new THREE.Vector3();
    try {
    for(let i=0;i<MAX;i++){
      const geometry=buildHulaHoopGeometry(i);this.geometries.push(geometry);
      const hoop=new THREE.Mesh(geometry,this.material);hoop.visible=false;
      const pivot=new THREE.Group();pivot.add(hoop);hoop.rotation.x=Math.PI/2;hoop.position.x=.27;
      const root=new THREE.Group();root.add(pivot);this.group.add(root);
      const slot={hoop,pivot,root,motion:{},entry:null,reservation:null,x:0,z:0};
      const place={
        reserve:person=>{if(slot.reservation||!slot.entry||registry.entries.get(slot.entry.id)!==slot.entry)return null;return slot.reservation={person,entry:slot.entry};},
        isLive:r=>!!r&&slot.reservation===r&&registry.entries.get(r.entry.id)===r.entry,
        release:r=>{if(slot.reservation===r)slot.reservation=null;},
        show:(r,on)=>{if(slot.reservation===r)hoop.visible=on;else if(!on)hoop.visible=false;},
        target:(r,phase,out)=>{if(!place.isLive(r))return false;const sign=(i&1)?1:-1;const x=slot.x+(phase==='leaving'?sign*3:0),z=slot.z+(phase==='leaving'?3:0);Object.assign(out,{x,y:terrainHeight(x,z),z});return true;},
        canMove:(r,x,z)=>place.isLive(r)&&!registry.closestBuilding(this.testPoint.set(x,0,z),.45),
      };
      slot.session=new HulaSession({people,place,eligible,duration:18+i,speed:1.45,now:()=>this.clock});this.slots.push(slot);
    }
    this.ownerToken=runtime.register({key:'hoopers',controller:this,schedule:[{slot:'roaming',run(dt,frame){this.update(dt,frame);}}]});
    } catch(error){try{this.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Hula construction and cleanup failed.');}throw error;}
  }
  update(dt,frame){
    if(this.disposed||frame.npcsFrozen)return;this.clock+=dt;this.scan-=dt;
    const cart=frame.zerble;
    for(const slot of this.slots){
      const session=slot.session;
      let safe=false;
      if(session.person&&this.people.readPerson(session.person,this.view)){
        const dx=this.view.x-cart.position.x,dz=this.view.z-cart.position.z;
        const tx=slot.x-cart.position.x,tz=slot.z-cart.position.z;
        safe=Math.hypot(dx,dz)>20&&Math.hypot(tx,tz)>20&&(!cart.forwardWorld||(!laneDodgeTest(dx,dz,cart.forwardWorld.x,cart.forwardWorld.z,cart.speed)&&!laneDodgeTest(tx,tz,cart.forwardWorld.x,cart.forwardWorld.z,cart.speed)&&!laneDodgeTest((dx+tx)/2,(dz+tz)/2,cart.forwardWorld.x,cart.forwardWorld.z,cart.speed)));
      }
      session.update(dt,{safe});
      if(slot.hoop.visible&&session.person&&this.people.readPerson(session.person,this.view)){
        const motion=session.sampleBodyPose(session.person,slot.motion);
        slot.root.position.set(this.view.x,this.view.y,this.view.z);
        slot.root.rotation.y=this.view.heading;slot.pivot.position.y=.85;
        slot.root.scale.setScalar(this.view.scale);
        slot.pivot.rotation.set(motion.hoopX,motion.hoopY,motion.hoopZ);
      }
    }
    this.material.emissiveIntensity=.05+2.5*frame.nightness;
    if(this.scan>0)return;this.scan=2.5;
    for(const slot of this.slots){
      if(slot.session.phase!=='idle')continue;
      for(const e of registry.entries.values()){
        if(!e.attractor||!KINDS.has(e.kind)||Math.hypot(e.position.x-cart.position.x,e.position.z-cart.position.z)>120)continue;
        let selected=null,best=Infinity;
        this.people.forEachPersonNear(e.position.x,e.position.z,e.attractor.radius,(handle,view,distance)=>{
          if(eligible(view)&&Math.hypot(view.x-cart.position.x,view.z-cart.position.z)>6&&!this.slots.some(other=>other.session.person&&this.people.readPerson(other.session.person,this.neighborView)&&Math.hypot(view.x-this.neighborView.x,view.z-this.neighborView.z)<2.2)&&this.people.activityCooldown(handle,'hula')<=this.clock&&distance<best){selected=handle;best=distance;}
        });
        if(!selected||!this.people.readPerson(selected,this.view))continue;
        slot.entry=e;slot.x=this.view.x;slot.z=this.view.z;
        if(slot.session.start(selected))break;
      }
    }
  }
  inspect(out){out.active=this.slots.filter(s=>s.session.phase!=='idle').length;out.disposed=this.disposed;}
  dispose(){if(this.disposed)return;this.disposed=true;const errors=[];
    if(this.runtime.isRegistered(this.ownerToken))try{this.runtime.unregister(this.ownerToken,'activity-disposed');}catch(e){errors.push(e);}
    for(const slot of this.slots)try{slot.session.dispose();}catch(e){errors.push(e);}
    this.group.removeFromParent();for(const geometry of this.geometries)geometry.dispose();this.material.dispose();
    if(errors.length)throw new AggregateError(errors,'Hula activity teardown failed.');
  }
}
