import * as THREE from 'three';
import { createRapierAdapter } from './rapierAdapter.js';
import { FixedStepClock } from './fixedStep.js';
import { CartProxy } from './cartProxy.js';
import { createTerrainResidency } from './terrainResidency.js';
import { createStaticResidency } from './staticResidency.js';
import { AdmissionBudget } from './admissionBudget.js';
import { createActivePropRendering } from './activePropRendering.js';
import { createChairOwnership } from './chairOwnership.js';
import { createOccupiedSeats } from './occupiedSeats.js';
import { sampleTerrain } from '../worldgen/terrain.js';
import { campSlotAvailable } from '../people/campResources.js';
import { findChairApproach } from './encounter.js';
import { APPROACH_DAMAGE_THRESHOLD } from '../collisionContacts.js';
import { containsSupport, supportWindow } from './supportWindow.js';

const MAX_CHAIRS = 8;
const poseOf = cart => ({position:{x:cart.position.x,y:cart.position.y,z:cart.position.z},
  rotation:{x:cart.root.quaternion.x,y:cart.root.quaternion.y,z:cart.root.quaternion.z,w:cart.root.quaternion.w}});

// Opt-in integration proof. The owner consumes the game's clock and streaming
// deadline; it never creates a timer, animation loop or independent budget.
export async function createLivePhysics({scene,registry,cart,camera,people=null,isWet=()=>false,now=()=>performance.now()}) {
  const adapter = await createRapierAdapter({capacities:{bodies:256,colliders:512,events:256,supportedLoads:16,contactPairs:32}});
  let rendering,terrain,solids,owner;
  try {
  const clock = new FixedStepClock(), records = new Map(), entryRecords = new Map(), rejected = new Map();
  rendering = createActivePropRendering({maxBuckets:48,maxSlots:3072,slotsPerBucket:64});
  terrain = createTerrainResidency(adapter,{maxTiles:64,maxQueued:32,maxOwners:MAX_CHAIRS});
  solids = createStaticResidency({registry,adapter,isDynamic:entry=>!!entryRecords.get(entry.id)?.token,maxProxies:128,maxOwners:MAX_CHAIRS,maxQueued:128});
  const budget = new AdmissionBudget({capacities:{bodies:256,colliders:512,joints:0,renderSlots:3072,events:256},maxRecords:MAX_CHAIRS*3+1});
  // Reserve the worst-case fixed support and cart allocations before chairs.
  budget.reserve('world-support',{resident:{bodies:193,colliders:193,events:256}});
  let preparationCalls=0,lastCandidates=0,nearbyChairs=0,preferredEncounter=null;
  let disposed=false, resetReason='restart', suspended=false, blocked=null, frames=0, hits=0, overflow=0, rejects=0, lastReject=null;
  const frustum=new THREE.Frustum(), projection=new THREE.Matrix4(), sphere=new THREE.Sphere();
  const occupants=people?createOccupiedSeats({people,adapter,budget,cartId:'live-cart',cart,
    groundAt(entry,x,z,scale){
      const record=entryRecords.get(entry.id);
      if(!record?.token||!containsSupport(record.bounds,{x,z},1.5*scale)||isWet(x,z))return null;
      const surface=sampleTerrain(x,z,{});return {height:surface.height,normalY:surface.ny,traversable:surface.traversable};
    }}):null;
  const eligibleSeats=entry=>entry.physicalProp?.seatSlots.every(campSlotAvailable)||occupants?.canAdopt(entry)===true;
  owner = createChairOwnership({registry,adapter,budget,rendering,occupants,maxChairs:MAX_CHAIRS,campSlotAvailable,
    originAlive:descriptor=>registry.entries.has(descriptor.originRegistryId),
    supportReady:descriptor=>{
      const record=records.get(descriptor.logicalKey);
      return !!record && terrain.status(record.supportKey).state==='ready' && solids.status(record.supportKey).state==='ready';
    }});
  const previousOwner=registry.physicalChairOwner;
  if(previousOwner) {adapter.dispose();throw new Error('A physical chair owner is already installed');}
  registry.physicalChairOwner=owner;
  scene.add(rendering.root);
  const cartId='live-cart';
  const admitted=adapter.addBody({id:cartId,type:'kinematic',pose:poseOf(cart),colliders:[{shape:'cuboid',halfExtents:{x:1.85,y:.6,z:2.3},position:{x:0,y:.65,z:-.17},friction:.4,collisionEvents:true,forceEvents:true,forceThreshold:2}]});
  if(!admitted.ok) {dispose();throw new Error(`Cart proxy: ${admitted.reason}`);}
  const proxy=new CartProxy({adapter,id:cartId,pose:poseOf(cart),isClear:pose=>{
    const result=adapter.queryDynamicOverlaps(cartId,pose);
    return result.ok&&!result.exhausted&&!result.overlaps.length;
  }});
  function rejection(reason) {rejects++;lastReject=reason;}
  function forget(record) {
    terrain.release(record.supportKey);solids.release(record.supportKey);
    entryRecords.delete(record.entryId);records.delete(record.key);
  }
  function considerRetirement(record) {
    if(!record.token)return false;
    const state=owner.read(record.token),entry=registry.entries.get(record.entryId);
    if(!state||!entry||state.occupants?.some(p=>p.current))return false;
    const p=state.pose.position,origin=record.origin;
    if(Math.hypot(cart.position.x-p.x,cart.position.z-p.z)<180 || Math.hypot(cart.position.x-origin.x,cart.position.z-origin.z)<180)return false;
    if(camera) {
      camera.updateMatrixWorld();projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
      sphere.center.set(p.x,p.y,p.z);sphere.radius=state.footprint+3;
      if(frustum.intersectsSphere(sphere))return false;
    }
    const result=owner.release(record.token,{mode:'retire'});
    if(!result.ok){rejection(result.reason);return false;}
    forget(record);rejected.clear();return true;
  }
  function prepare(deadline) {
    if(disposed)return;
    preparationCalls++;
    for(const [key,failure] of rejected) {
      const entry=registry.entries.get(failure.entryId);
      if(!entry||Math.hypot(entry.position.x-cart.position.x,entry.position.z-cart.position.z)>48
        ||(failure.reason==='occupied-or-unavailable'&&eligibleSeats(entry)))rejected.delete(key);
    }
    const candidates=[];nearbyChairs=0;
    if(records.size<MAX_CHAIRS && rejected.size<64 && now()<deadline) {
      const preferred=registry.entries.get(preferredEncounter),preferredProp=preferred?.physicalProp;
      if(preferredProp&&!records.has(preferredProp.logicalKey)&&!rejected.has(preferredProp.logicalKey)
        &&Math.hypot(preferred.position.x-cart.position.x,preferred.position.z-cart.position.z)<24&&eligibleSeats(preferred))candidates.push(preferred);
      registry.collidersNear(cart.position.x,cart.position.z,24,entry=>{
        const descriptor=entry.physicalProp;
        if(descriptor)nearbyChairs++;
        if(!candidates.includes(entry) && candidates.length<MAX_CHAIRS && descriptor && !records.has(descriptor.logicalKey) && !rejected.has(descriptor.logicalKey)
          && Math.hypot(entry.position.x-cart.position.x,entry.position.z-cart.position.z)<24
          && (descriptor.kind==='camp_cooler'||descriptor.seatSlots.length) && eligibleSeats(entry)) candidates.push(entry);
      });
      lastCandidates=candidates.length;
      for(const entry of candidates) {
        if(records.size>=MAX_CHAIRS||now()>=deadline)break;
        const descriptor=entry.physicalProp,key=descriptor.logicalKey;
        if(records.has(key))continue;
        const record={key,entryId:entry.id,supportKey:key,origin:{...descriptor.worldPose.position},token:null,bounds:null,wanted:null,lastHit:-Infinity,lastTouch:-Infinity,penalized:false,contacts:new Set()};
        records.set(key,record);entryRecords.set(entry.id,record);
      }
    }
    for(const record of [...records.values()]) {
      if(now()>=deadline)break;
      if(considerRetirement(record))continue;
      if(record.handoffPending) {
        record.handoffPending=!solids.removeEntry(record.entryId).ok;
        if(record.handoffPending){rejection('static-handoff');continue;}
      }
      const entry=registry.entries.get(record.entryId);
      if(!entry && !record.token){forget(record);continue;}
      if(!record.token && Math.hypot(cart.position.x-record.origin.x,cart.position.z-record.origin.z)>32){forget(record);continue;}
      const state=record.token?owner.read(record.token):null;
      const p=state?.pose.position??record.origin;
      const body=record.token?adapter.readBody(record.bodyId):null;
      const wanted={...supportWindow(p,body?.linearVelocity,state?.supportRadius??2,record.wanted)};
      for(const person of record.token?owner.personBodies(record.token):[]) {
        const area=supportWindow(person.pose.position,person.linearVelocity,person.radius+2);
        wanted.minX=Math.min(wanted.minX,area.minX);wanted.minZ=Math.min(wanted.minZ,area.minZ);
        wanted.maxX=Math.max(wanted.maxX,area.maxX);wanted.maxZ=Math.max(wanted.maxZ,area.maxZ);
      }
      const ground=terrain.request(record.supportKey,wanted),nearby=solids.request(record.supportKey,wanted);
      if(!ground.ok||!nearby.ok){rejection(!ground.ok?ground.reason:nearby.reason);continue;}
      record.wanted=wanted;
    }
    if(now()<deadline)terrain.pump({deadline,now,maxCreations:2});
    if(now()<deadline)solids.pump({deadline,now,maxCreations:2});
    let admissions=0;
    for(const record of records.values()) {
      if(now()>=deadline)break;
      if(terrain.status(record.supportKey).state!=='ready'||solids.status(record.supportKey).state!=='ready')continue;
      record.bounds=record.wanted;
      if(!record.token && admissions<1) {
        const result=owner.adopt(record.entryId);
        if(result.ok){record.token=result.token;record.bodyId=owner.read(result.token).bodyId;record.handoffPending=!solids.removeEntry(record.entryId).ok;admissions++;}
        else {rejection(result.reason);rejected.set(record.key,{entryId:record.entryId,reason:result.reason});forget(record);}
      }
    }
    owner.preparePeople(deadline,now);
    for(const record of records.values())registry.entries.get(record.entryId)?.physicalProp?.renderBatch?.flush();
    rendering.flush();
  }
  function advance(dt,{ghost=false,corrected=false,eligible=true}={}) {
    if(disposed)return null;
    frames++;
    let hit=null;
    // Check again before every substep: a contact impulse can change velocity
    // during the preceding step of the same presentation frame.
    function canStep(step) {
      for(const record of records.values())if(record.token) {
        if(record.handoffPending){blocked='static-handoff';suspended=true;return false;}
        const state=owner.read(record.token),body=adapter.readBody(record.bodyId);
        if(!state||!body)continue;
        const predicted={x:body.pose.position.x+body.linearVelocity.x*step,z:body.pose.position.z+body.linearVelocity.z*step};
        if(!containsSupport(record.bounds,predicted,state.supportRadius+.5)){blocked='support-frontier';suspended=true;return false;}
        for(const person of owner.personBodies(record.token)) {
          const next={x:person.pose.position.x+person.linearVelocity.x*step,z:person.pose.position.z+person.linearVelocity.z*step};
          if(!containsSupport(record.bounds,next,person.radius+.5)){blocked='person-support-frontier';suspended=true;return false;}
        }
      }
      return true;
    }
    blocked=null;
    const reason=resetReason??(corrected?'legacy-correction':suspended?'dropped-time':null);
    if(dt===0&&!reason&&ghost===proxy.ghost)return null;
    proxy.accept(clock.time+clock.remainder,dt,poseOf(cart),{ghost,resetReason:reason});
    resetReason=null;suspended=false;
    clock.advance(dt,(step,time)=>{
      proxy.beforeStep(time);adapter.step(step);owner.stepPeople(step);
      const drained=adapter.drainEvents();overflow+=drained.overflow;
      for(const event of drained.events) {
        if(event.a!==cartId&&event.b!==cartId)continue;
        const bodyId=event.a===cartId?event.b:event.a;
        const record=[...records.values()].find(record=>record.bodyId===bodyId);
        if(!record)continue;
        const pair=`${event.colliderA}:${event.colliderB}`;
        if(event.type==='contact-start') {
          if(!record.contacts.size&&time-record.lastTouch>.3)record.penalized=false;
          record.contacts.add(pair);
        } else if(event.type==='contact-end') {
          record.contacts.delete(pair);record.lastTouch=time;continue;
        } else if(event.type!=='contact-force')continue;
        record.lastTouch=time;
        if(ghost||hit||record.penalized)continue;
        const body=adapter.readBody(bodyId),entry=registry.entries.get(record.entryId);
        if(!body||!entry)continue;
        const dx=body.pose.position.x-cart.position.x,dz=body.pose.position.z-cart.position.z,d=Math.hypot(dx,dz)||1;
        const approach=(-Math.sin(cart.heading)*cart.speed*dx-Math.cos(cart.heading)*cart.speed*dz)/d;
        if(approach<=APPROACH_DAMAGE_THRESHOLD)continue;
        record.lastHit=time;record.penalized=true;hits++;
        // A furniture touch is not itself a person incident. The existing person
        // contact path owns occupant penalties and sends their physical impulse.
        hit={damaging:false,damage:0,objectBump:eligible,kind:entry.kind,entry,physical:true,
          mass:body.mass,approachSpeed:approach,push:{x:-dx/d,z:-dz/d}};
      }
    },{canStep});
    for(const record of records.values())if(record.token) {
      const result=owner.publish(record.token);
      if(!result.ok){blocked=result.reason;rejection(result.reason);}
    }
    rendering.flush();
    return hit;
  }
  function stats() {return {enabled:!disposed,phase:'physical-props-prototype',preparationCalls,lastCandidates,nearbyChairs,rejectedCandidates:rejected.size,player:{x:cart.position.x,z:cart.position.z},frames,clock:{steps:clock.steps,dropped:clock.dropped},blocked,hits,overflow,rejects,lastReject,
    chairs:[...records.values()].map(record=>({key:record.key,kind:registry.entries.get(record.entryId)?.kind,entryId:record.entryId,active:!!record.token,state:record.token?owner.read(record.token):null})),
    engine:adapter.counts(),terrain:terrain.stats(),solids:solids.stats(),render:rendering.stats(),ownership:owner.stats(),cart:proxy.state(),
    limitations:['Occupied chair adoption is opt-in; full incident and device acceptance remain pending.','Static cylinders are conservative approximations.','Secondary-person attribution and device acceptance are pending.','Support-frontier exhaustion visibly stops this opt-in prototype.']};}
  function dispose() {
    if(disposed)return;disposed=true;
    if(registry.physicalChairOwner===owner)delete registry.physicalChairOwner;
    const errors=[];
    for(const [name,action] of [['chairs',()=>owner.dispose()],['solids',()=>solids.dispose()],['terrain',()=>terrain.dispose()],['render',()=>rendering.dispose()],['engine',()=>adapter.dispose()]]) {
      try {const result=action();if(result?.ok===false)errors.push({name,result});}catch(error){errors.push({name,message:error.message});}
    }
    rendering.root.removeFromParent();records.clear();entryRecords.clear();rejected.clear();
    return {ok:!errors.length,errors};
  }
  return {prepare,advance,stats,dispose,reset(reason){resetReason=reason;},owns(entry){return !!entryRecords.get(entry.id)?.token;},
    approach(isWet,requestedKind=null){
      const candidates=[];
      for(const kind of ['chair','camp_chair','camp_loveseat','camp_cooler'])for(const id of registry.byKind.get(kind)??[]) {
        const entry=registry.entries.get(id),descriptor=entry?.physicalProp;
        if(requestedKind==='occupied'){if(!descriptor?.seatSlots.some(slot=>slot.occupied))continue;}
        else if(requestedKind&&descriptor?.kind!==requestedKind)continue;
        if(!descriptor||(descriptor.kind!=='camp_cooler'&&!descriptor.seatSlots.length)||(!entryRecords.get(id)?.token&&!eligibleSeats(entry)))continue;
        candidates.push(entry);
      }
      candidates.sort((a,b)=>(Number(!!entryRecords.get(b.id)?.token)-Number(!!entryRecords.get(a.id)?.token))||Math.hypot(a.position.x-cart.position.x,a.position.z-cart.position.z)-Math.hypot(b.position.x-cart.position.x,b.position.z-cart.position.z));
      const approach=findChairApproach({registry,entries:candidates,radius:Math.max(2.95,cart.radius??0),isWet});
      preferredEncounter=approach?.entryId??null;return approach;
    }};
  } catch(error) {
    if(registry.physicalChairOwner===owner)delete registry.physicalChairOwner;
    const cleanupErrors=[];
    for(const resource of [owner,solids,terrain,rendering,adapter])try{resource?.dispose();}catch(cleanup){cleanupErrors.push(cleanup.message);}
    rendering?.root.removeFromParent();
    if(cleanupErrors.length)error.cleanupErrors=cleanupErrors;
    throw error;
  }
}
