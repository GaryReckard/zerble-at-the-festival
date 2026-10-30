// Bounded local recovery search. The caller supplies traversable, resident
// ground; queries use actual current engine shapes, including the old chair.
const key=c=>`${c.id}:${c.generation}`;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
function mixRotation(a,b,t) {
 const sign=a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w<0?-1:1;
 const q={x:lerp(a.x,b.x*sign,t),y:lerp(a.y,b.y*sign,t),z:lerp(a.z,b.z*sign,t),w:lerp(a.w,b.w*sign,t)};
 const length=Math.hypot(q.x,q.y,q.z,q.w);for(const k of ['x','y','z','w'])q[k]/=length;return q;
}
export function createStandRecovery({adapter,ground,radius=.3,halfHeight=.4,rootHeight=1,duration=1.4,automaticPreparation=true}) {
 if(typeof adapter?.queryBodyContacts!=='function'||typeof ground!=='function')throw new TypeError('Recovery requires collision and ground capabilities');
 if(![radius,halfHeight,rootHeight,duration].every(Number.isFinite)||radius<=0||halfHeight<0||rootHeight<radius+halfHeight||duration<.5||duration>4)throw new RangeError('Invalid recovery dimensions or duration');
 let plan=null,pending=null,candidate=0,elapsed=0,retry=0,lastReason=null,queries=0;
 function surface(x,z){const s=ground(x,z);return s?.traversable===true&&Number.isFinite(s.height)&&Number.isFinite(s.normalY)&&s.normalY>=.85?s:null;}
 function query(body,pose){queries++;return adapter.queryBodyContacts(body.id,body.generation,pose);}
 function allowed(result,initial,final=false) {
  if(!result.ok){lastReason=result.reason;return false;}
  for(const c of result.contacts) {
   if(c.distance>=-.005)continue;
   if(final||!initial.has(key(c))||c.distance<initial.get(key(c))-.005){lastReason='blocked-path';return false;}
  }
  return true;
 }
 function sample(p,t) {
  const slide=smooth(Math.min(1,t*2)),rise=smooth(Math.max(0,t*2-1));
  const x=lerp(p.start.position.x,p.target.x,slide),z=lerp(p.start.position.z,p.target.z,slide),s=surface(x,z);
  if(!s)return null;
  const rotation=mixRotation(p.start.rotation,p.rotation,rise),extent=radius+halfHeight*Math.abs(1-2*(rotation.x*rotation.x+rotation.z*rotation.z));
  const slideY=Math.max(p.start.position.y,s.height+extent+.035);
  const y=rise>0?s.height+extent+.035+(rootHeight-extent-.035)*rise:lerp(p.start.position.y,slideY,slide);
  return {position:{x,y,z},rotation};
 }
 function prepare(body,seatBlend) {
  if(pending&&(pending.bodyId!==body.id||pending.generation!==body.generation||Math.hypot(body.pose.position.x-pending.start.position.x,body.pose.position.y-pending.start.position.y,body.pose.position.z-pending.start.position.z)>.05||Math.abs(Object.keys(body.pose.rotation).reduce((sum,k)=>sum+body.pose.rotation[k]*pending.start.rotation[k],0))<.995))pending=null;
  if(!pending) {
   const initial=query(body,body.pose);if(!initial.ok){lastReason=initial.reason;return false;}
   const angle=(candidate%8)*Math.PI/4,distance=candidate<8?1.1:1.8;candidate=(candidate+1)%16;
   const target={x:body.pose.position.x+Math.cos(angle)*distance,z:body.pose.position.z+Math.sin(angle)*distance};
   const s=surface(target.x,target.z);if(!s){lastReason='unsupported-target';return false;}
   const q=body.pose.rotation,yaw=2*Math.atan2(q.y,q.w);
   pending={seatBlend,start:{position:{...body.pose.position},rotation:{...q}},target,rotation:{x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},initial:new Map(initial.contacts.map(c=>[key(c),c.distance])),bodyId:body.id,generation:body.generation,sample:1};
  }
  // Four path samples per accepted step, plus one initial-overlap query when
  // starting a candidate. Moving bodies are checked again during playback.
  for(let work=0;work<4;work++) {
   const i=pending.sample,pose=sample(pending,i/24);
   if(!pose||!allowed(query(body,pose),pending.initial,i===24)){pending=null;return false;}
   pending.sample++;
   if(i===24){plan=pending;pending=null;elapsed=0;lastReason=null;return true;}
  }
  lastReason='planning';return false;
 }

 return Object.freeze({
  prepare(body,{seatBlend=1}={}){if(!Number.isFinite(seatBlend)||seatBlend<0||seatBlend>1)throw new RangeError('Invalid recovery leg blend');return !!plan||prepare(body,seatBlend);},
  step(body,dt,{seatBlend=1}={}) {
   if(!Number.isFinite(seatBlend)||seatBlend<0||seatBlend>1)throw new RangeError('Invalid recovery leg blend');
   if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Recovery requires accepted time');
   if(dt===0)return {phase:plan?'recovering':'waiting'};
   if(plan&&(body.id!==plan.bodyId||body.generation!==plan.generation)) {plan=null;return {phase:'waiting',reason:'stale-body'};}
   if(!plan) {
    retry=Math.max(0,retry-dt);if(retry>0)return {phase:'waiting',reason:lastReason};
    if(!automaticPreparation)return {phase:'waiting',reason:lastReason??'planning'};
    if(!prepare(body,seatBlend)){if(!pending&&candidate===0)retry=.5;return {phase:'waiting',reason:lastReason};}
   }
   const nextTime=Math.min(duration,elapsed+dt),t=nextTime/duration,pose=sample(plan,t);
   if(!pose||!allowed(query(body,pose),plan.initial,t===1)) {plan=null;lastReason='path-changed';return {phase:'waiting',reason:lastReason};}
   elapsed=nextTime;
   const phase=t===1?'complete':'recovering',legBlend=plan.seatBlend*(1-smooth(Math.max(0,t*2-1)));
   return {phase,pose,seatBlend:legBlend};
  },
  cancel(){plan=null;pending=null;elapsed=0;retry=0;},
  inspect(){return {active:!!plan,candidate,elapsed,queries,lastReason};},
 });
}
