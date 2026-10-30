import {preparePersonFall} from './personFall.js';
import {createSeatReaction} from './seatReaction.js';
import {createPersonRecovery} from './personRecovery.js';
import {containsSupport,supportWindow} from './supportWindow.js';
import {findChairApproach} from './encounter.js';
import {sampleTerrain} from '../worldgen/terrain.js';

// Prewarm a bounded neighborhood without taking movement authority. A hit may
// claim only a still-eligible person whose actual landing support is resident.
export function createOrdinaryPeople({people,adapter,budget,terrain,solids,cart,isWet,now,registry,maxPeople=4}) {
 const records=new Map(),activity={activityKey:'physical-person',onPersonImpact:hit};
 let disposed=false,lastReject=null,started=0,completed=0;
 function release(record) {
  record.controller?.dispose();record.recovery?.cancel();
  const errors=[];
  for(let i=record.cleanups.length-1;i>=0;i--)try{record.cleanups[i]();record.cleanups.splice(i,1);}catch(error){errors.push(error);}
  record.cleanupPending=errors.length>0;
  if(errors.length)throw new AggregateError(errors,'Ordinary fall cleanup failed');
  terrain.release(record.key);solids.release(record.key);records.delete(record.handle);
 }
 const uninstall=people.installPersonImpactHandler(hit);
 function ready(record) {
  return terrain.status(record.key).state==='ready'&&solids.status(record.key).state==='ready';
 }
 function ground(record,x,z) {
  if(!ready(record)||!containsSupport(record.bounds,{x,z},1.5*record.scale)||isWet(x,z))return null;
  const s=sampleTerrain(x,z,{});return {height:s.height,normalY:s.ny,traversable:s.traversable};
 }
 function hit(handle,x,z,impact) {
  const record=records.get(handle);if(!record||disposed||record.cleanupPending)return false;
  const speed=Number.isFinite(impact?.approachSpeed)?impact.approachSpeed:Math.abs(cart.speed);
  if(!record.claim) {
   const view={};if(!people.readPerson(handle,view)||!people.canClaimPersonReaction(handle)||view.scale!==record.scale||!ready(record)
     ||!containsSupport(record.bounds,{x:view.x,z:view.z},record.scale*1.5+1)){lastReject='person-support-pending';return false;}
   const half=view.heading/2;
   const claim=people.claimPersonReaction(handle,{owner:activity,prepare:()=>true,release:(_claim,reason)=>{if(reason==='physical-recovered')completed++;release(record);}});
   if(!claim)return false;record.claim=claim;
   const result=record.lease.activate({pose:{position:{x:view.x,y:view.y+record.scale,z:view.z},rotation:{x:0,y:Math.sin(half),z:0,w:Math.cos(half)}},linear:{x:view.vx??0,y:0,z:view.vz??0},angular:{x:0,y:0,z:0}});
   if(!result.ok){lastReject=result.reason;people.endPersonActivity(claim,{reason:'physical-activation-failed'});return false;}
   started++;
   record.recovery=createPersonRecovery({adapter,people,handle,scale:record.scale,ground:(x,z)=>ground(record,x,z)});
   record.controller=createSeatReaction({people,claim,lease:record.lease,recovery:record.recovery,initialSeatBlend:0,facing:0,rootOffset:{x:0,y:-record.scale,z:0},releaseSeat(){},grounded(body){
    const s=ground(record,body.pose.position.x,body.pose.position.z),q=body.pose.rotation;
    return !!s?.traversable&&body.pose.position.y-record.scale*(.3+.4*Math.abs(1-2*(q.x*q.x+q.z*q.z)))<=s.height+.06;
   }});
  }
  const body=record.lease.read()?.body;if(!body)return false;
  record.recovery.cancel();
  const strength=body.mass*Math.min(6,Math.max(1,speed*.6));
  adapter.applyImpulse(body.id,{x:x*strength,y:body.mass*.5,z:z*strength},{...body.pose.position,y:body.pose.position.y+.25*record.scale});
  record.controller.step(0);return true;
 }
 function prepare(deadline) {
  if(disposed)return;
  for(const record of [...records.values()]) {
   if(record.cleanupPending){try{release(record);}catch{lastReject='person-cleanup-pending';}continue;}
   if(record.claim)continue;
   const view={};if(!people.readPerson(record.handle,view)||!people.canClaimPersonReaction(record.handle)||Math.hypot(view.x-cart.position.x,view.z-cart.position.z)>24)release(record);
  }
  let creations=0;
  if(now()<deadline&&records.size<maxPeople)people.forEachPersonNear(cart.position.x,cart.position.z,14,(handle,view)=>{
   if(now()>=deadline||creations>=1||records.size>=maxPeople)return false;
   if(records.has(handle)||!people.canClaimPersonReaction(handle))return;
   if(!Number.isFinite(view.scale)||view.scale<=0){lastReject='invalid-person-scale';return;}
   const record={handle,key:`ordinary:${handle.slot}:${handle.generation}`,scale:view.scale,cleanups:[],claim:null,bounds:null,controller:null,recovery:null};
   const result=preparePersonFall({adapter,budget,id:record.key,radius:.3*view.scale,halfHeight:.4*view.scale,attempt:{own:fn=>record.cleanups.push(fn)}});
   if(!result.ok){lastReject=result.reason;release(record);return false;}
   record.lease=result.lease;
   const body=record.lease.read().body,cartBody=adapter.readBody('live-cart');
   const pair=adapter.suppressBodyContacts({bodyA:cartBody.id,generationA:cartBody.generation,bodyB:body.id,generationB:body.generation});
   if(!pair.ok){lastReject=pair.reason;release(record);return false;}
   record.cleanups.push(()=>adapter.removeContactSuppression(pair.token));records.set(handle,record);creations++;
  });
  for(const record of records.values()) {
   if(now()>=deadline)break;
   const view={};if(!people.readPerson(record.handle,view))continue;
   const body=record.claim?record.lease.read()?.body:null;
   const p=body?.pose.position??{x:view.x,z:view.z};
   const wanted=supportWindow(p,body?.linearVelocity??{x:view.vx??0,z:view.vz??0},record.scale*1.5+2,record.bounds);
   const t=terrain.request(record.key,wanted),s=solids.request(record.key,wanted);
   if(t.ok&&s.ok)record.bounds=wanted;else lastReject=t.ok?s.reason:t.reason;
  }
 }
 return Object.freeze({prepare,
  approach(){for(const r of records.values())if(!r.claim&&ready(r)){const v={};if(!people.readPerson(r.handle,v)||!people.canClaimPersonReaction(r.handle))continue;
   const result=findChairApproach({registry,entries:[{id:null,position:{x:v.x,y:v.y,z:v.z},collider:{radius:.45}}],radius:2.95,isWet});
   if(result)return {...result,person:{slot:r.handle.slot,generation:r.handle.generation}};
  }return null;},
  prepareRecovery(deadline){for(const r of records.values())if(now()<deadline&&r.controller?.inspect().phase==='settled')r.recovery.prepare(r.lease.read().body,{seatBlend:r.controller.inspect().seatBlend});},
  canStep(dt){for(const r of records.values())if(r.cleanupPending)return false;else if(r.claim){const body=r.lease.read()?.body;if(!body||!ready(r)||!containsSupport(r.bounds,{x:body.pose.position.x+body.linearVelocity.x*dt,z:body.pose.position.z+body.linearVelocity.z*dt},r.scale*1.5+.5))return false;}return true;},
  step(dt){for(const r of records.values())if(r.claim){const result=r.controller.step(dt);if(!result.ok)throw new Error(`Ordinary reaction: ${result.reason}`);}},
  stats(){return {capacity:maxPeople,lastReject,started,completed,people:[...records.values()].map(r=>({slot:r.handle.slot,generation:r.handle.generation,ready:ready(r),active:!!r.claim,cleanupPending:!!r.cleanupPending,reaction:r.controller?.inspect()??null,body:r.claim?r.lease.read()?.body:null}))};},
  dispose(){disposed=true;uninstall();const errors=[];for(const r of [...records.values()])try{if(r.claim&&people.isPersonActivityCurrent(r.claim))people.endPersonActivity(r.claim,{reason:'physical-world-removed'});else release(r);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Ordinary people disposal failed');},
 });
}
