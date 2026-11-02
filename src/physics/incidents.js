// Causal history is bounded independently of physical bodies. Keys include the
// caller's generation, so recycled engine handles never inherit attribution.
export function createIncidentLedger({maxIncidents=32,maxBodies=64,maxTargets=32,maxHops=4,maxAge=5}={}) {
 for(const [name,value] of Object.entries({maxIncidents,maxBodies,maxTargets,maxHops}))if(!Number.isSafeInteger(value)||value<1)throw new RangeError(`Invalid ${name}`);
 if(!Number.isFinite(maxAge)||maxAge<=0)throw new RangeError('Invalid incident lifetime');
 const incidents=new Map(),bodies=new Map();let serial=0,clock=0,rejections=0;
 const key=value=>{if(typeof value!=='string'||!value||value.length>512)throw new TypeError('Incident identity must be a bounded string');return value;};
 function advance(time) {
  if(!Number.isFinite(time)||time<clock)throw new RangeError('Incident time must be finite and monotonic');
  clock=time;
  for(const [id,event] of incidents)if(time-event.started>=maxAge)incidents.delete(id);
  for(const [body,ref] of bodies)if(!incidents.has(ref.id))bodies.delete(body);
 }
 function prune() {const used=new Set([...bodies.values()].map(ref=>ref.id));for(const id of incidents.keys())if(!used.has(id))incidents.delete(id);}
 function reject(reason){rejections++;return {ok:false,reason};}
 function snapshot(ref) {const event=incidents.get(ref?.id);return event?{id:event.id,instigator:event.instigator,source:event.source,started:event.started,expires:event.started+maxAge,hops:ref.hops,targets:event.targets.size}:null;}
 return Object.freeze({
  advance,
  start(source,instigator,time) {
   key(source);key(instigator);advance(time);
   if(!bodies.has(source)&&bodies.size>=maxBodies)return reject('body-capacity');
   // Replacing the only reference can reuse its incident slot without evicting
   // anyone else's live causal history.
   const old=bodies.get(source),exclusive=old&&![...bodies].some(([body,ref])=>body!==source&&ref.id===old.id);
   if(incidents.size>=maxIncidents&&!exclusive)return reject('incident-capacity');
   if(serial===Number.MAX_SAFE_INTEGER)return reject('generation-exhausted');
   if(exclusive)incidents.delete(old.id);
   const id=++serial,event={id,instigator,source,started:time,targets:new Set()};
   incidents.set(id,event);bodies.set(source,{id,hops:0});prune();return {ok:true,incident:snapshot(bodies.get(source))};
  },
  propagate(source,target,time) {
   key(source);key(target);advance(time);
   const from=bodies.get(source);if(!from)return reject('unattributed-source');
   const existing=bodies.get(target);
   if(existing?.id===from.id){
    const shorter=from.hops+1<existing.hops;if(shorter)existing.hops=from.hops+1;
    return {ok:true,changed:shorter,incident:snapshot(existing)};
   }
   if(from.hops>=maxHops)return reject('hop-limit');
   if(existing&&existing.id>from.id)return {ok:true,changed:false,incident:snapshot(existing)};
   if(!existing&&bodies.size>=maxBodies)return reject('body-capacity');
   const ref={id:from.id,hops:from.hops+1};bodies.set(target,ref);prune();return {ok:true,changed:true,incident:snapshot(ref)};
  },
  claimTarget(source,target,time) {
   key(source);key(target);advance(time);const ref=bodies.get(source),event=incidents.get(ref?.id);
   if(!event)return reject('unattributed-source');
   if(event.targets.has(target))return {ok:false,reason:'duplicate-target'};
   if(event.targets.size>=maxTargets)return reject('target-capacity');
   event.targets.add(target);return {ok:true,incident:snapshot(ref)};
  },
  read(source,time=clock){key(source);advance(time);return snapshot(bodies.get(source));},
  forget(source){key(source);const removed=bodies.delete(source);prune();return removed;},
  clear(){incidents.clear();bodies.clear();},
  stats(){return {incidents:incidents.size,bodies:bodies.size,targets:[...incidents.values()].reduce((n,e)=>n+e.targets.size,0),rejections,clock,capacities:{maxIncidents,maxBodies,maxTargets,maxHops,maxAge}};},
 });
}
