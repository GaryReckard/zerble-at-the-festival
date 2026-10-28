// A pair owns one resource and coordinates two independently validated claims.
export class FrisbeeSession {
  constructor({people,place,eligible,timeout=30,now=()=>0,cooldown=20}) {
    if(!people||!place||typeof eligible!=='function')throw new TypeError('Frisbee needs people, place and eligibility.');
    this.people=people;this.place=place;this.eligible=eligible;this.timeout=timeout;this.now=now;this.cooldown=cooldown;
    this.activityKey='frisbee';this.interruptibleByCart=true;this.phase='idle';this.persons=[];this.claims=[null,null];
    this.views=[{},{}];this.reservation=null;this.discState='held';this.wait=0;this.ending=false;this.disposed=false;
  }
  start(a,b){
    if(this.disposed||this.phase!=='idle'||!a||a===b)return false;
    if(!this.people.readPerson(a,this.views[0])||!this.people.readPerson(b,this.views[1])||!this.views.every(this.eligible))return false;
    const reservation=this.place.reserve(a,b);if(!reservation)return false;
    this.persons=[a,b];this.reservation=reservation;this.phase='acquiring';this.discState='held';
    try {
      if(!this.place.isLive(reservation)||!this.acquire()){this.finish('unavailable');return false;}
      this.phase='playing';return true;
    } catch(error){try{this.finish('failed');}catch(cleanup){throw new AggregateError([error,cleanup],'Frisbee acquisition and cleanup failed.');}throw error;}
  }
  acquire(){
    for(let i=0;i<2;i++){
      const claim=this.people.claimActivity(this.persons[i],{owner:this,release:(released,reason)=>this.released(i,released,reason)});
      if(!claim)return false;
      this.claims[i]=claim;
    }
    return true;
  }
  released(index,claim,reason){
    if(this.claims[index]!==claim)return;
    this.claims[index]=null;if(this.ending)return;
    if(reason!=='honk'&&reason!=='dodge'){this.finish(reason);return;}
    this.phase='interrupted';this.wait=0;this.ending=true;
    const errors=[];
    try {this.place.settle(this.reservation,this.discState);this.discState='landed';}catch(error){errors.push(error);}
    for(let i=0;i<2;i++){const other=this.claims[i];this.claims[i]=null;if(other)try{this.people.endPersonActivity(other,{reason:'pair-interrupted'});}catch(error){errors.push(error);}}
    this.ending=false;
    if(errors.length){try{this.finish('interruption-failed');}catch(error){errors.push(error);}throw new AggregateError(errors,'Frisbee interruption failed.');}
  }
  update(dt,{safe=true}={}){
    if(this.disposed||this.phase==='idle')return;
    if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Frisbee requires accepted frame delta.');
    try {
    if(!this.place.isLive(this.reservation)||!this.persons.every((p,i)=>this.people.readPerson(p,this.views[i]))){this.finish('unavailable');return;}
    if(this.phase==='interrupted'){
      this.wait+=dt;if(this.wait>this.timeout){this.finish('timeout');return;}
      if(!safe||this.views.some(v=>v.state==='fleeing'))return;
      if(this.views.some(v=>!this.eligible(v))){this.finish('ineligible');return;}
      this.phase='acquiring';if(!this.acquire()){this.finish('unavailable');return;}this.phase='playing';
    }
    if(this.phase==='playing'&&!this.claims.every(c=>this.people.isPersonActivityCurrent(c)))this.finish('unavailable');
    } catch(error){try{this.finish('failed');}catch(cleanup){throw new AggregateError([error,cleanup],'Frisbee update and cleanup failed.');}throw error;}
  }
  finish(reason='cancelled'){
    if(this.phase==='idle')return;
    const claims=this.claims,reservation=this.reservation;
    const errors=[];
    if(reason==='completed')for(const claim of claims)if(claim)try{this.people.requestActivityExit(claim,{cooldownUntil:this.now()+this.cooldown});}catch(error){errors.push(error);}
    this.claims=[null,null];this.persons=[];this.reservation=null;this.phase='idle';this.ending=true;
    if(reservation){try{this.place.hide(reservation);}catch(e){errors.push(e);}try{this.place.release(reservation);}catch(e){errors.push(e);}}
    for(const claim of claims)if(claim)try{this.people.endPersonActivity(claim,{reason});}catch(e){errors.push(e);}
    this.ending=false;if(errors.length)throw new AggregateError(errors,'Frisbee cleanup failed.');
  }
  dispose(){if(this.disposed)return;this.finish('activity-removed');this.disposed=true;}
}
