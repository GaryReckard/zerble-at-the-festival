// A supported sitter reserves its actual disabled fall body up front. Admission
// pays allocation cost; tipping only transfers pose/mass and enables that body.
// Person claims, seat ownership, visuals and recovery remain with the caller.
export function prepareSeatRelease({adapter,budget,id,bodyId,bodyGeneration,position,mass,radius,halfHeight=0,attempt}) {
  if(typeof id!=='string'||!id||id.length>180)throw new TypeError('Seat release requires a short stable id.');
  if(typeof attempt?.own!=='function')throw new TypeError('Seat release requires activity preparation.');
  const reserved=budget.reserve(`seat-release:${id}`,{resident:{bodies:1,colliders:2}});
  if(!reserved.ok)return reserved;
  const fallId=`seat-release:${id}`,budgetToken=reserved.token;
  let bodyGenerationOwned=null,loadToken=null,contactToken=null,state='preparing',snapshot=null;
  function ownedBody() {
    const body=adapter.readBody(fallId);
    return body?.generation===bodyGenerationOwned?body:null;
  }
  function cleanup() {
    if(state==='disposed')return false;
    // Do not release accounting if an engine removal throws. The lease can be
    // retried, and failed cleanup remains visible to ActivityClaims.
    if(!adapter.counts().disposed) {
      if(loadToken){if(!adapter.removeSupportedLoad(loadToken)&&adapter.readSupportedLoad(loadToken))throw new Error('Seat load cleanup failed.');loadToken=null;}
      if(bodyGenerationOwned!==null&&ownedBody()&&!adapter.removeBody(fallId)&&ownedBody())throw new Error('Fall body cleanup failed.');
    }
    contactToken=null;budget.release(budgetToken);state='disposed';return true;
  }
  try {
    attempt.own(cleanup);
    const body=adapter.addBody({id:fallId,type:'dynamic',colliders:[{shape:halfHeight?'capsule':'ball',halfHeight,radius,mass,friction:.7,restitution:.04}],ccd:true,linearDamping:.15,angularDamping:.3});
    if(!body.ok){cleanup();return body;}
    bodyGenerationOwned=body.generation;
    if(!adapter.setBodyEnabled(fallId,false))throw new Error('Reserved fall body disappeared.');
    const suppression=adapter.suppressBodyContacts({bodyA:bodyId,generationA:bodyGeneration,bodyB:fallId,generationB:bodyGenerationOwned});
    if(!suppression.ok){cleanup();return suppression;}
    contactToken=suppression.token;
    const load=adapter.addSupportedLoad({id:`seat-load:${id}`,bodyId,bodyGeneration,position,mass,radius,halfHeight});
    if(!load.ok){cleanup();return load;}
    loadToken=load.token;state='supported';
  } catch(error) {
    try {cleanup();} catch(cleanupError){throw new AggregateError([error,cleanupError],'Seat release preparation and rollback failed.');}
    throw error;
  }
  return {ok:true,lease:Object.freeze({
    read() {
      if(state==='disposed'||adapter.counts().disposed)return null;
      return {state,bodyId:fallId,bodyGeneration:bodyGenerationOwned,
        support:loadToken?adapter.readSupportedLoad(loadToken):null,body:ownedBody()};
    },
    fall() {
      if(state==='disposed')return {ok:false,reason:'disposed'};
      if(adapter.counts().disposed)return {ok:false,reason:'adapter-disposed'};
      if(!ownedBody())return {ok:false,reason:'reserved-body-missing'};
      if(state==='falling')return {ok:true,bodyId:fallId,generation:bodyGenerationOwned};
      if(state==='supported') {
        const current=adapter.readSupportedLoad(loadToken);
        if(!current)return {ok:false,reason:'support-missing'};
        // All potentially failing pose writes precede removal of seated mass.
        // No step or callback may run inside this synchronous handoff.
        if(!adapter.setPose(fallId,{position:current.position,rotation:current.rotation})
          ||!adapter.setVelocity(fallId,{linear:current.velocity,angular:current.angularVelocity}))return {ok:false,reason:'reserved-body-missing'};
        if(!adapter.removeSupportedLoad(loadToken))return {ok:false,reason:'support-missing'};
        loadToken=null;snapshot=current;state='activating';
        const updated=budget.update(budgetToken,{resident:{bodies:1,colliders:1}});
        if(!updated.ok)throw new Error('Seat release accounting lost its reservation.');
      }
      // An exceptional activation failure can be retried without allocating a
      // second body, removing mass twice, or resampling a moving chair.
      if(!adapter.setBodyEnabled(fallId,true))return {ok:false,reason:'reserved-body-missing'};
      state='falling';return {ok:true,bodyId:fallId,generation:bodyGenerationOwned};
    },
    resumeSupportContacts(options) {
      if(state!=='falling')return {ok:false,reason:'not-falling'};
      if(adapter.counts().disposed)return {ok:false,reason:'adapter-disposed'};
      if(!ownedBody())return {ok:false,reason:'reserved-body-missing'};
      if(!contactToken)return {ok:true};
      const result=adapter.resumeSeparatedContacts(contactToken,options);
      // Removing the original support also removes its pair. A replacement
      // using the same id has no inherited exclusion.
      if(result.ok||result.reason==='stale-pair'){contactToken=null;return {ok:true};}
      return result;
    },
    releaseSnapshot() {return snapshot?{...snapshot,position:{...snapshot.position},rotation:{...snapshot.rotation},velocity:{...snapshot.velocity},angularVelocity:{...snapshot.angularVelocity},localPosition:{...snapshot.localPosition}}:null;},
    dispose:cleanup,
  })};
}
