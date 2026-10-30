import * as THREE from 'three';
import {prepareSeatRelease} from './seatRelease.js';
import {createSeatReaction} from './seatReaction.js';
import {createPersonRecovery} from './personRecovery.js';
import {campSlotAvailable} from '../people/campResources.js';

// Population access stays behind public capabilities. Each adopted furniture
// item owns an independent set of claims; the population still owns lifetimes.
export function createOccupiedSeats({people,adapter,budget,cartId,cart,groundAt}) {
 const activity={activityKey:'physical-seat',onPersonImpact};
 const participants=new Map();
 function onPersonImpact(handle,x,z,impact=null) {
  const p=participants.get(handle);if(!p||!people.isPersonActivityCurrent(p.claim))return false;
  if(!p.lease.fall().ok)return false;
  p.recovery.cancel();p.dismount?.cancel();
  const body=p.lease.read()?.body;if(!body)return false;
  const incoming=Number.isFinite(impact?.approachSpeed)?impact.approachSpeed:Math.abs(cart.speed);
  const impulse=body.mass*Math.max(1,Math.min(6,incoming*.6));
  adapter.applyImpulse(body.id,{x:x*impulse,y:body.mass*.5,z:z*impulse});
  p.controller.step(0);return true;
 }
 function canAdopt(entry) {
  return entry.physicalProp.seatSlots.every(slot=>slot.occupied?!!people.findPersonOnSupport(slot):campSlotAvailable(slot));
 }
 function adopt({entry,descriptor,bodyId,engineGeneration,initialPose}) {
  const slots=descriptor.seatSlots.filter(slot=>slot.occupied);
  if(!slots.length)return {ok:true,lease:null};
  const rows=[],q=new THREE.Quaternion().copy(initialPose.rotation),inverse=q.clone().invert(),origin=new THREE.Vector3().copy(initialPose.position);
  const chairYaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z));
  for(const slot of slots) {
   const handle=people.findPersonOnSupport(slot),view={};
   if(!handle||!people.readPerson(handle,view)||!Number.isFinite(view.scale)||view.scale<=0)return {ok:false,reason:'occupant-unavailable'};
   const scale=view.scale,center=new THREE.Vector3(view.x,slot.y-.465*scale+.01+scale,view.z).sub(origin).applyQuaternion(inverse);
   rows.push({handle,slot,scale,center,facing:view.heading-chairYaw,support:null,lease:null,claim:null,controller:null,recovery:null});
  }
  let reason='occupant-preparation';
  const claims=people.claimSupportReactions(rows.map(p=>({handle:p.handle,owner:activity,
   prepare(attempt) {
    p.support=people.preparePersonSupportTransfer(p.handle,entry,attempt);if(!p.support)return false;
    const prepared=prepareSeatRelease({adapter,budget,id:`${descriptor.logicalKey}:${p.handle.slot}:${p.handle.generation}`,bodyId,bodyGeneration:engineGeneration,position:p.center,mass:70,radius:.3*p.scale,halfHeight:.4*p.scale,attempt});
    if(!prepared.ok){reason=prepared.reason;return false;}p.lease=prepared.lease;
    // Cart/person consequences and impulses use the existing person contact
    // path; exclude this duplicate solver pair throughout the reaction.
    const body=p.lease.read().body,cartBody=adapter.readBody(cartId);
    const excluded=adapter.suppressBodyContacts({bodyA:cartId,generationA:cartBody.generation,bodyB:body.id,generationB:body.generation});
    if(!excluded.ok){reason=excluded.reason;return false;}
    attempt.own(()=>adapter.removeContactSuppression(excluded.token));
    return true;
   },
   release(){p.controller?.dispose();p.recovery?.cancel();p.dismount?.cancel();participants.delete(p.handle);},
  })));
  if(!claims)return {ok:false,reason};
  try {
   rows.forEach((p,i)=>{
    p.claim=claims[i];if(!p.support.commit(p.claim))throw new Error('Prepared support commit failed');
    const ground=(x,z)=>groundAt(entry,x,z,p.scale);
    p.recovery=createPersonRecovery({adapter,people,handle:p.handle,scale:p.scale,ground});
    p.dismount=createPersonRecovery({adapter,people,handle:p.handle,scale:p.scale,ground,motion:'dismount',duration:.8});
    p.controller=createSeatReaction({people,claim:p.claim,lease:p.lease,releaseSeat:()=>p.support.release(),facing:p.facing,rootOffset:{x:0,y:-p.scale,z:0},recovery:p.recovery,dismount:p.dismount,
     grounded(body){const at=groundAt(entry,body.pose.position.x,body.pose.position.z,p.scale);if(!at?.traversable)return false;const r=body.pose.rotation;return body.pose.position.y-(.3*p.scale+.4*p.scale*Math.abs(1-2*(r.x*r.x+r.z*r.z)))<=at.height+.06;}});
    participants.set(p.handle,p);p.controller.step(0);
   });
  } catch(error) {for(const claim of claims)people.endPersonActivity(claim,{reason:'physical-admission-failed'});throw error;}
  return {ok:true,lease:Object.freeze({
   requestDismount(){let count=0;for(const p of rows)if(people.isPersonActivityCurrent(p.claim)&&p.controller.requestDismount())count++;return count;},
   step(dt){for(const p of rows)if(people.isPersonActivityCurrent(p.claim)){const result=p.controller.step(dt);if(!result.ok)throw new Error(`Occupied reaction: ${result.reason}`);}},
   prepare(deadline,now){for(const p of rows)if(now()<deadline&&people.isPersonActivityCurrent(p.claim)){
    if(p.controller.inspect().phase==='settled'){const body=p.lease.read()?.body;if(body)p.recovery.prepare(body,{seatBlend:p.controller.inspect().seatBlend});}
    else p.controller.prepareDismount();
   }},
   bodies(){return rows.filter(p=>people.isPersonActivityCurrent(p.claim)).flatMap(p=>{const state=p.lease.read();return state?.state==='falling'&&state.body?[{...state.body,radius:1.5*p.scale}]:[];});},
   active(){return rows.filter(p=>people.isPersonActivityCurrent(p.claim)).length;},
   inspect(){return rows.map(p=>({person:p.handle.slot,current:people.isPersonActivityCurrent(p.claim),reaction:p.controller.inspect()}));},
   dispose(){for(const p of rows)people.endPersonActivity(p.claim,{reason:'physical-owner-removed'});},
  })};
 }
 return {canAdopt,adopt};
}
