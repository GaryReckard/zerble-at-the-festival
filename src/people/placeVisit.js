// A small extension example: one visit behavior over public people operations
// and a place-owned reservation/target adapter. No population or venue switches.
export class PlaceVisitActivity {
  constructor({people,place,eligible,speed=1.45,duration=2,timeout=45,hidden=false,key='place-visit'}) {
    if(typeof eligible!=='function'||!people||!place)throw new TypeError('A visit requires explicit people, place and eligibility.');
    for(const value of [speed,duration,timeout])if(!Number.isFinite(value)||value<0)throw new RangeError('Visit timing and speed must be finite and nonnegative.');
    this.people=people;this.place=place;this.eligible=eligible;this.speed=speed;
    this.duration=duration;this.timeout=timeout;this.hidden=hidden;this.activityKey=key;
    this.person=null;this.claim=null;this.reservation=null;this.phase='idle';this.elapsed=0;this.disposed=false;
    this.view={};this.target={};
  }

  start(person) {
    if(this.disposed||this.claim||!this.people.readPerson(person,this.view)||!this.eligible(this.view))return false;
    let reservation=null;
    const claim=this.people.claimActivity(person,{owner:this,
      prepare:attempt=>{reservation=this.place.reserve(person,attempt);return !!reservation;},
      release:released=>{
        if(this.claim!==released)return;
        this.claim=null;this.person=null;this.reservation=null;this.phase='idle';this.elapsed=0;
      },
    });
    if(!claim)return false;
    if(this.disposed||!this.place.isLive(reservation)){this.people.endPersonActivity(claim,{reason:'unavailable'});return false;}
    this.person=person;this.claim=claim;this.reservation=reservation;this.phase='approaching';this.elapsed=0;
    return true;
  }

  update(dt) {
    if(this.disposed||!this.claim)return;
    if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Visit requires accepted frame delta.');
    try {
      if(!this.people.readPerson(this.person,this.view)||!this.place.isLive(this.reservation)){this.stop('unavailable');return;}
      this.elapsed+=dt;
      if(this.phase==='visiting') {
        if(this.elapsed>=this.duration){this.phase='leaving';this.elapsed=0;this.place.leave?.(this.reservation);this.people.setActivityBinding(this.claim,false);}
        return;
      }
      if(this.elapsed>this.timeout){this.stop('timeout');return;}
      if(!this.place.readTarget(this.reservation,this.phase,this.target)){this.stop('unavailable');return;}
      const {x,y,z}=this.target;
      if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))throw new TypeError('Place target must be finite.');
      const dx=x-this.view.x,dz=z-this.view.z,d=Math.hypot(dx,dz);
      if(d>.05){
        const step=Math.min(d,this.speed*dt),nx=this.view.x+dx/d*step,nz=this.view.z+dz/d*step;
        if(this.place.canApproach(this.reservation,nx,nz))this.people.writeActivityPose(this.claim,nx,y,nz,Math.atan2(-dx,-dz));
        return;
      }
      if(this.phase==='approaching'){
        this.phase='visiting';this.elapsed=0;
        this.people.setActivityBinding(this.claim,this.hidden);
        this.place.enter?.(this.reservation);
      }else this.stop('completed');
    } catch(error) {
      try {this.stop('failed');} catch(cleanupError) {throw new AggregateError([error,cleanupError],'Visit and cleanup failed.');}
      throw error;
    }
  }

  stop(reason='interrupted') {return this.claim?this.people.endPersonActivity(this.claim,{reason}):false;}
  describePerson(person,out) {out.role=person===this.person?this.phase:null;}
  dispose() {if(this.disposed)return;this.disposed=true;this.stop('activity-removed');}
}
