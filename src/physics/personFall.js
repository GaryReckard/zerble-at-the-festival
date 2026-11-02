// Ordinary people reserve one disabled body during nearby preparation. Impact
// activation uses that allocation; the population claim still owns the person.
export function preparePersonFall({adapter,budget,id,mass=70,radius=.3,halfHeight=.4,attempt}) {
 if(typeof id!=='string'||!id||id.length>180||typeof attempt?.own!=='function')throw new TypeError('Person fall requires an identity and cleanup owner');
 if(![mass,radius,halfHeight].every(Number.isFinite)||mass<=0||radius<=0||halfHeight<0)throw new RangeError('Invalid fall body dimensions');
 const bodyId=`person-fall:${id}`,reservation=budget.reserve(bodyId,{resident:{bodies:1,colliders:1}});
 if(!reservation.ok)return reservation;
 let generation=null,state='reserved';
 const body=()=>{const current=adapter.readBody(bodyId);return current?.generation===generation?current:null;};
 function dispose() {
  if(state==='disposed')return false;
  if(!adapter.counts().disposed&&body()&&!adapter.removeBody(bodyId)&&body())throw new Error('Person fall cleanup failed');
  budget.release(reservation.token);state='disposed';return true;
 }
 try {
  attempt.own(dispose);
  const created=adapter.addBody({id:bodyId,type:'dynamic',colliders:[{shape:halfHeight?'capsule':'ball',radius,halfHeight,mass,friction:.7,restitution:.04}],ccd:true,linearDamping:.35,angularDamping:1.2});
  if(!created.ok){dispose();return created;}
  generation=created.generation;
  if(!adapter.setBodyEnabled(bodyId,false))throw new Error('Reserved person body disappeared');
 } catch(error) {try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Person fall rollback failed');}throw error;}
 return {ok:true,lease:Object.freeze({
  read(){return state==='disposed'||adapter.counts().disposed?null:{state,bodyId,bodyGeneration:generation,support:null,body:body()};},
  activate({pose,linear,angular}) {
   if(state!=='reserved')return {ok:false,reason:state==='falling'?'already-active':'disposed'};
   if(!body())return {ok:false,reason:'reserved-body-missing'};
   if(!adapter.setPose(bodyId,pose)||!adapter.setVelocity(bodyId,{linear,angular})||!adapter.setBodyEnabled(bodyId,true))return {ok:false,reason:'reserved-body-missing'};
   state='falling';return {ok:true,bodyId,generation};
  },
  fall(){return state==='falling'&&body()?{ok:true,bodyId,generation}:{ok:false,reason:'not-active'};},
  resumeSupportContacts(){return {ok:true};},
  moveForRecovery(pose){return state==='falling'&&!!body()&&adapter.setPose(bodyId,pose)&&adapter.setVelocity(bodyId,{linear:{x:0,y:0,z:0},angular:{x:0,y:0,z:0}});},
  dispose,
 })};
}
