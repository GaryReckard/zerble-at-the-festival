import * as THREE from 'three';
import {registry} from '../registry.js';
import {terrainHeight} from '../worldgen/terrain.js';
import {laneDodgeTest} from '../steering.js';
import {getSessionSeed} from '../rng.js';
import {buildHulaHoopGeometry,buildHulaHoopMaterial} from './hoop/appearance.js';
import {HulaSession} from './hulaSession.js';
import {HoopPairSession} from './hoop/pairSession.js';

const KINDS=new Set(['stage','stage_front','drum_circle','firepit','leaf_drum_circle']);
const MAX=8;
const eligible=v=>!v.claimed&&!v.grouped&&!v.photographer&&!v.seated&&!v.hidden&&['idle','walking','watching'].includes(v.state);
const flowByDefault=()=>!(['localhost','127.0.0.1','::1'].includes(globalThis.location?.hostname)&&new URLSearchParams(globalThis.location?.search??'').get('hoopFlow')==='0');

// The activity owns hoops and reservations; Crowd owns every participant and collider.
export class HulaActivity {
  constructor({people,runtime,rootSeed=getSessionSeed(),autoRecruit=true,flow=flowByDefault()}) {
    this.rootSeed=rootSeed;this.autoRecruit=autoRecruit;this.flow=flow;this.pairSession=null;this.pairSlots=null;this.envelopes=new Map();this.emptyKinds=new Set();
    this.people=people;this.runtime=runtime;this.group=new THREE.Group();this.group.name='HulaActivities';
    this.geometries=[];this.material=buildHulaHoopMaterial();
    this.slots=[];this.clock=0;this.scan=0;this.disposed=false;this.view={};this.neighborView={};this.envelopeView={};this.testPoint=new THREE.Vector3();
    try {
    for(let i=0;i<MAX;i++){
      const geometry=buildHulaHoopGeometry(i);this.geometries.push(geometry);
      const hoop=new THREE.Mesh(geometry,this.material);hoop.visible=false;
      const pivot=new THREE.Group();pivot.add(hoop);hoop.rotation.x=Math.PI/2;hoop.position.x=.27;
      const root=new THREE.Group();root.add(pivot);this.group.add(root);
      const secondPivot=new THREE.Group(),secondHoop=new THREE.Mesh(geometry,this.material);secondHoop.visible=false;secondPivot.add(secondHoop);root.add(secondPivot);
      const slot={index:i,hoop,pivot,root,hoops:[hoop,secondHoop],pivots:[pivot,secondPivot],motion:{},entry:null,reservation:null,x:0,z:0,lastSegment:-1,lastEpoch:-1,pairOwner:null};

      const place={
        reserve:person=>{if(slot.reservation||!slot.entry||registry.entries.get(slot.entry.id)!==slot.entry)return null;return slot.reservation={person,entry:slot.entry};},
        isLive:r=>!!r&&slot.reservation===r&&registry.entries.get(r.entry.id)===r.entry,
        release:r=>{if(slot.reservation===r){slot.reservation=null;this.envelopes.delete(r);}},
        show:(r,on)=>{if(r&&slot.reservation===r)hoop.visible=on;if(!on){hoop.visible=false;secondHoop.visible=false;}},
        target:(r,phase,out)=>{if(!place.isLive(r))return false;const sign=(i&1)?1:-1;const x=slot.x+(phase==='leaving'?sign*3:0),z=slot.z+(phase==='leaving'?3:0);Object.assign(out,{x,y:terrainHeight(x,z),z});return true;},
        canMove:(r,x,z)=>place.isLive(r)&&!registry.closestBuilding(this.testPoint.set(x,0,z),.45),
        groundAt:terrainHeight,
        canPerform:r=>place.isLive(r)&&this.people.readPerson(slot.session.person,this.neighborView)&&this.envelopeClear(slot,slot.session.score.envelope.radius*this.neighborView.scale,[slot.session.person]),
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
      if(slot.pairOwner)continue;
      if(slot.hoop.visible&&session.person&&this.people.readPerson(session.person,this.view)){
        const motion=session.sampleBodyPose(session.person,slot.motion);
        if(!motion){this.hideSlot(slot);continue;}
        if(motion.style==='flow'){
          const sample=session.flowSample;
          if(slot.lastEpoch!==session.scoreEpoch||slot.lastSegment!==sample.segment){
            slot.lastEpoch=session.scoreEpoch;slot.lastSegment=sample.segment;
            const radius=session.score.envelope.radius*this.view.scale;
            if(!this.envelopeClear(slot,radius,[session.person])){
              session.record('obstruction',sample.segment);session.finish('obstruction');continue;
            }
            const envelope=this.envelopes.get(slot.reservation);if(envelope)envelope.radius=radius;
          }
          this.renderFlow(slot,session);
        }else{
          slot.root.matrixAutoUpdate=false;
          if(!this.people.readActivityPresentation(session.claim,slot.root.matrix)){this.hideSlot(slot);continue;}
          slot.root.matrixWorldNeedsUpdate=true;
          slot.pivot.position.set(0,.85,0);slot.pivot.rotation.set(motion.hoopX,motion.hoopY,motion.hoopZ);
          slot.hoop.position.set(.27,0,0);slot.hoop.rotation.set(Math.PI/2,0,0);slot.hoop.scale.setScalar(1);
          slot.hoops[1].visible=false;
        }
      }
    }
    this.material.emissiveIntensity=.05+2.5*frame.nightness;
    if(this.pairSession){
      const pair=this.pairSession;pair.update(dt,{safe:true});
      if(pair.phase==='idle')this.clearPair();else{
        const token=pair.reservation,envelope=this.envelopes.get(token);
        if(envelope&&pair.hoop.contact!==this.pairContact){
          this.pairContact=pair.hoop.contact;
          if(!this.envelopeClear({x:envelope.x,z:envelope.z,reservation:token},envelope.radius,pair.persons))pair.finish('obstruction');
        }
        if(pair.phase==='idle')this.clearPair();else this.renderPair();
      }
    }
    if(!this.autoRecruit||this.scan>0)return;this.scan=2.5;
    for(const slot of this.slots){
      if(slot.session.phase!=='idle'||slot.pairOwner)continue;
      const style=this.flow&&(slot.index%2===1)?'flow':'classic';
      const profile=slot.index===7?'aerial':['lyrical','playful','aerial'][slot.index%3],hoops=slot.index===5?2:1;
      let flowRadius=0;
      if(style==='flow'){slot.session.configure({style,seed:this.rootSeed,slot:slot.index,profile,hoops,duration:18+slot.index});flowRadius=slot.session.planFlow().envelope.radius;}
      for(const e of registry.entries.values()){
        if(!e.attractor||!KINDS.has(e.kind)||Math.hypot(e.position.x-cart.position.x,e.position.z-cart.position.z)>120)continue;
        let selected=null,best=Infinity;
        this.people.forEachPersonNear(e.position.x,e.position.z,e.attractor.radius,(handle,view,distance)=>{
          if(eligible(view)&&Math.hypot(view.x-cart.position.x,view.z-cart.position.z)>6&&!this.slots.some(other=>other.session.person&&this.people.readPerson(other.session.person,this.neighborView)&&Math.hypot(view.x-this.neighborView.x,view.z-this.neighborView.z)<2.2)&&this.people.activityCooldown(handle,'hula')<=this.clock&&distance<best){
            // A blocked nearest candidate must not starve every clear dancer.
            // The nested clearance query uses separate public-view scratch.
            slot.x=view.x;slot.z=view.z;
            if(style==='flow'&&!this.envelopeClear(slot,flowRadius*view.scale,[handle]))return;
            selected=handle;best=distance;
          }
        });
        if(!selected||!this.people.readPerson(selected,this.view))continue;
        if(slot.index===6&&this.flow&&this.slots[7].session.phase==='idle'){
          let partner=null;
          this.people.forEachPersonNear(this.view.x,this.view.z,4.5,(h,v,d)=>{if(!partner&&h!==selected&&eligible(v)&&d>2.4&&Math.abs(v.y-this.view.y)<.3&&this.people.activityCooldown(h,'hula')<=this.clock)partner=h;});
          if(partner&&this.startPair({slots:[6,7],persons:[selected,partner],entry:e}))break;
        }
        if(this.startPerformance({slot:slot.index,person:selected,entry:e,x:this.view.x,z:this.view.z,style,profile,hoops,duration:18+slot.index}))break;
      }
    }
  }
  hideSlot(slot){for(const hoop of slot.hoops)hoop.visible=false;}
  envelopeClear(slot,radius,except){
    this.testPoint.set(slot.x,0,slot.z);
    if(registry.closestBuilding(this.testPoint,radius,this.emptyKinds))return false;
    for(const [token,e] of this.envelopes)if(token!==slot.reservation&&Math.hypot(e.x-slot.x,e.z-slot.z)<e.radius+radius)return false;
    let clear=true;
    this.people.forEachPersonNear(slot.x,slot.z,radius+.4,(h)=>{if(!except.includes(h))clear=false;},this.envelopeView);
    return clear;
  }
  startPerformance({slot:index=0,person,entry,x,z,style='flow',profile='lyrical',hoops=1,duration=22,seed=this.rootSeed}={}){
    const slot=this.slots[index];
    if(this.disposed||!slot||slot.pairOwner||slot.session.phase!=='idle'||registry.entries.get(entry?.id)!==entry||!this.people.readPerson(person,this.view))return false;
    slot.entry=entry;slot.x=x??this.view.x;slot.z=z??this.view.z;slot.lastSegment=-1;
    slot.session.configure({style,seed,slot:index,profile,hoops,duration});
    // Validate the complete score before claiming a person or publishing props.
    const radius=style==='flow'?slot.session.planFlow().envelope.radius*this.view.scale:0;
    if(style==='flow'&&!this.envelopeClear(slot,radius,[person]))return false;
    if(!slot.session.start(person))return false;
    if(style==='flow')this.envelopes.set(slot.reservation,{x:slot.x,z:slot.z,radius});
    return true;
  }
  renderFlow(slot,session){
    if(!this.people.readActivityPresentation(session.claim,slot.root.matrix)){this.hideSlot(slot);return;}
    slot.root.matrixAutoUpdate=false;slot.root.matrixWorldNeedsUpdate=true;
    const sample=session.flowSample;
    for(let i=0;i<2;i++){
      const hoop=slot.hoops[i],pivot=slot.pivots[i];hoop.visible=i<sample.hoopCount;
      if(!hoop.visible)continue;const h=sample.hoops[i];
      pivot.position.set(h.x,h.y,h.z);pivot.quaternion.set(h.qx,h.qy,h.qz,h.qw);
      hoop.position.set(0,0,0);hoop.rotation.set(0,0,h.spin);hoop.scale.setScalar(h.radius/.58);
    }
  }
  startPair({slots:indices=[6,7],persons,entry}={}){
    if(this.disposed||this.pairSession||!persons||persons.length!==2||indices.length!==2||indices[0]===indices[1])return false;
    const a=this.slots[indices[0]],b=this.slots[indices[1]];
    if(!a||!b||a.session.phase!=='idle'||b.session.phase!=='idle'||a.pairOwner||b.pairOwner||registry.entries.get(entry?.id)!==entry)return false;
    const va={},vb={};if(!this.people.readPerson(persons[0],va)||!this.people.readPerson(persons[1],vb))return false;
    const dx=va.x-vb.x,dz=va.z-vb.z,d=Math.hypot(dx,dz);if(d<2.4||d>8||Math.abs(va.y-vb.y)>.3)return false;
    const token={entry},x=(va.x+vb.x)/2,z=(va.z+vb.z)/2,radius=d/2+1.3*Math.max(va.scale,vb.scale);
    const fixture={x,z,reservation:token};if(!this.envelopeClear(fixture,radius,persons))return false;
    let reserved=false;
    const place={reserve:()=>{if(reserved||registry.entries.get(entry.id)!==entry)return null;reserved=true;this.envelopes.set(token,{x,z,radius});return token;},
      isLive:r=>reserved&&r===token&&registry.entries.get(entry.id)===entry,
      release:r=>{if(r===token){reserved=false;this.envelopes.delete(token);}},
      show:(r,on)=>{if(!on){this.hideSlot(a);this.hideSlot(b);}},
    };
    const pair=new HoopPairSession({people:this.people,place,eligible,now:()=>this.clock});
    if(!pair.start(persons[0],persons[1])){pair.dispose();return false;}
    this.pairSession=pair;this.pairContact=null;this.pairSlots=[a,b];a.pairOwner=b.pairOwner=pair;this.renderPair();return pair;
  }
  renderPair(){
    const pair=this.pairSession,slot=this.pairSlots[0],h=pair.hoop;
    slot.root.matrixAutoUpdate=false;slot.root.matrix.identity();slot.root.matrixWorldNeedsUpdate=true;
    slot.hoop.visible=!!h.visible;slot.hoops[1].visible=false;
    slot.pivot.position.set(h.x,h.y,h.z);slot.pivot.quaternion.set(h.qx,h.qy,h.qz,h.qw);
    slot.hoop.position.set(0,0,0);slot.hoop.rotation.set(0,0,h.spin);slot.hoop.scale.setScalar((h.radius??.58)/.58);
    this.hideSlot(this.pairSlots[1]);
  }
  clearPair(){
    if(!this.pairSession)return;
    const pair=this.pairSession;this.pairSession=null;
    for(const slot of this.pairSlots){slot.pairOwner=null;this.hideSlot(slot);}
    this.pairSlots=null;pair.dispose();
  }
  inspect(out){out.active=0;out.flow=0;out.classic=0;out.hoops=0;
    for(const s of this.slots){if(s.session.phase!=='idle'){out.active++;out[s.session.style]++;}for(const h of s.hoops)if(h.visible)out.hoops++;}
    if(this.pairSession)out.active+=2;out.paired=!!this.pairSession;out.envelopes=this.envelopes.size;out.disposed=this.disposed;
  }
  dispose(){if(this.disposed)return;this.disposed=true;const errors=[];
    if(this.runtime.isRegistered(this.ownerToken))try{this.runtime.unregister(this.ownerToken,'activity-disposed');}catch(e){errors.push(e);}
    if(this.pairSession)try{this.clearPair();}catch(e){errors.push(e);}
    for(const slot of this.slots){this.hideSlot(slot);try{slot.session.dispose();}catch(e){errors.push(e);}}
    this.envelopes.clear();this.group.removeFromParent();
    for(const geometry of this.geometries)try{geometry.dispose();}catch(e){errors.push(e);}
    try{this.material?.dispose();}catch(e){errors.push(e);}
    if(errors.length)throw new AggregateError(errors,'Hula activity teardown failed.');
  }
}
