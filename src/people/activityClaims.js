// Exclusive movement/binding authority. Resource-specific reservation validation
// stays with its owner; this layer orders preparation, revocation and resume.
export class ActivityClaims {
  constructor({people,eligible=()=>true,resume=()=>{},finalize=()=>{}}) {
    this.people=people;this.eligible=eligible;this.resume=resume;this.finalize=finalize;
    this.current=new Map();this.states=new WeakMap();this.transitioning=new Set();
    this.serial=0;this.closing=false;
  }

  acquire(handle,{owner,prepare=()=>true,release=()=>{}}) {
    if(this.closing||this.transitioning.has(handle)||!this.people.isLive(handle)||!owner||!this.eligible(handle,owner))return null;
    const resources=[];let preparing=true,revokedOld=false,failure=null;
    const attempt=Object.freeze({own:cleanup=>{
      if(!preparing)throw new Error('Activity preparation has ended.');
      if(typeof cleanup!=='function')throw new TypeError('A tentative resource needs cleanup.');
      resources.push(cleanup);
    }});
    this.transitioning.add(handle);
    let transferred=false;
    try {
      const prepared=prepare(attempt);preparing=false;
      if(prepared?.then)throw new TypeError('Activity preparation must be synchronous.');
      if(prepared!==true||!this.people.isLive(handle)||this.closing)return null;
      const old=this.current.get(handle);
      if(old){this.current.delete(handle);revokedOld=true;this.cleanup(old,'replaced');}
      if(!this.people.isLive(handle)||this.closing)return null;
      const claim=Object.freeze({person:handle,owner,incarnation:++this.serial});
      const state={claim,status:'active',resources,release};
      this.states.set(claim,state);this.current.set(handle,state);transferred=true;
      return claim;
    } catch(error) {
      failure=error;throw error;
    } finally {
      preparing=false;
      const errors=[];
      try {if(!transferred)this.releaseResources(resources);}catch(error){errors.push(error);}
      try {if(failure&&revokedOld&&!this.closing&&this.people.isLive(handle))this.resume(handle,'replacement-failed',null);}catch(error){errors.push(error);}
      this.transitioning.delete(handle);
      if(errors.length)throw new AggregateError(failure?[failure,...errors]:errors,'Activity rollback failed.');
    }
  }

  // A shared support must reserve every sitter before replacing any of their
  // activities. Individual acquire calls cannot roll back the first sitter
  // when preparation for the second runs out of capacity.
  acquireBatch(requests) {
    if(!Array.isArray(requests)||!requests.length||requests.length>16||new Set(requests.map(r=>r.handle)).size!==requests.length)throw new TypeError('Activity batch requires 1–16 distinct people');
    if(this.closing||requests.some(r=>this.transitioning.has(r.handle)||!this.people.isLive(r.handle)||!r.owner||!this.eligible(r.handle,r.owner)))return null;
    const rows=requests.map(r=>({...r,resources:[],old:this.current.get(r.handle),revoked:false,preparing:false}));
    for(const row of rows)this.transitioning.add(row.handle);
    let transferred=false,failure=null;
    try {
      for(const row of rows) {
        row.preparing=true;
        const attempt=Object.freeze({own:cleanup=>{
          if(!row.preparing)throw new Error('Activity preparation has ended.');
          if(typeof cleanup!=='function')throw new TypeError('A tentative resource needs cleanup.');
          row.resources.push(cleanup);
        }});
        const ready=(row.prepare??(()=>true))(attempt);row.preparing=false;
        if(ready?.then)throw new TypeError('Activity preparation must be synchronous.');
        if(ready!==true)return null;
      }
      if(this.closing||rows.some(r=>!this.people.isLive(r.handle)||!this.eligible(r.handle,r.owner)||this.current.get(r.handle)!==r.old))return null;
      for(const row of rows)if(row.old) {
        // A previous owner's cleanup may remove another batch participant.
        if(this.closing||!this.people.isLive(row.handle)||this.current.get(row.handle)!==row.old)return null;
        this.current.delete(row.handle);row.revoked=true;this.cleanup(row.old,'replaced');
      }
      if(this.closing||rows.some(r=>!this.people.isLive(r.handle)))return null;
      const claims=rows.map(row=>{
        const claim=Object.freeze({person:row.handle,owner:row.owner,incarnation:++this.serial});
        const state={claim,status:'active',resources:row.resources,release:row.release??(()=>{})};
        this.states.set(claim,state);this.current.set(row.handle,state);return claim;
      });
      transferred=true;return claims;
    } catch(error) {failure=error;throw error;}
    finally {
      const errors=[];
      for(const row of rows)row.preparing=false;
      if(!transferred) {
        for(const row of [...rows].reverse())try{this.releaseResources(row.resources);}catch(error){errors.push(error);}
        for(const row of rows)if(row.revoked&&!this.closing&&this.people.isLive(row.handle))try{this.resume(row.handle,'replacement-failed',null);}catch(error){errors.push(error);}
      }
      for(const row of rows)this.transitioning.delete(row.handle);
      if(errors.length)throw new AggregateError(failure?[failure,...errors]:errors,'Activity batch rollback failed.');
    }
  }

  canWrite(claim) {
    const state=claim&&this.states.get(claim);
    return !!state&&state.status==='active'&&this.current.get(claim.person)===state&&this.people.isLive(claim.person)&&!this.closing;
  }

  canRelease(claim) {
    const state=claim&&this.states.get(claim);
    return !!state&&state.status!=='released'&&this.people.owns(claim.person);
  }

  releaseResources(resources) {
    const errors=[];
    for(const release of resources.splice(0).reverse())try{release();}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'Activity resource cleanup failed.');
  }

  cleanup(state,reason) {
    state.status='revoking';
    const errors=[];
    try{state.release(state.claim,reason);}catch(error){errors.push(error);}
    try{this.releaseResources(state.resources);}catch(error){errors.push(error);}
    state.release=null;state.status='released';
    try{this.finalize(state.claim,reason);}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'Activity release failed.');
  }

  release(claim,reason='ended') {
    const state=claim&&this.states.get(claim),handle=claim?.person;
    if(!state||state.status!=='active'||this.current.get(handle)!==state||this.transitioning.has(handle))return false;
    this.transitioning.add(handle);this.current.delete(handle);
    try {this.cleanup(state,reason);}
    finally {
      try {if(!this.closing&&this.people.isLive(handle))this.resume(handle,reason,claim);}
      finally {this.transitioning.delete(handle);}
    }
    return true;
  }

  removePerson(handle,reason='person-removed') {
    const state=this.current.get(handle);
    if(!state)return false;
    // Lifetime teardown can interrupt preparation, which must not strand the
    // outgoing activity merely because ordinary reentrant handoffs are blocked.
    const transitioning=this.transitioning.has(handle);
    this.transitioning.add(handle);this.current.delete(handle);
    try {this.cleanup(state,reason);}
    finally {if(!transitioning)this.transitioning.delete(handle);}
    return true;
  }

  dispose() {
    if(this.closing)return;
    this.closing=true;
    const states=[...this.current.values()],errors=[];
    this.current.clear();
    for(const state of states)try{this.cleanup(state,'controller-removed');}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'Activity teardown failed.');
  }
}
