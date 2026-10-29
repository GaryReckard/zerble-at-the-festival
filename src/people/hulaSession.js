import {sampleHulaMotion} from '../personMotion.js';
// A session retains its own place reservation while Crowd lends movement.
// Revoked claims are never reused, including when the same person resumes.
export class HulaSession {
  constructor({people,place,eligible,duration=20,speed=1.45,timeout=30,now=()=>0,cooldown=20}) {
    if(!people||!place||typeof eligible!=='function')throw new TypeError('Hula needs a population, place and eligibility policy.');
    this.people=people;this.place=place;this.eligible=eligible;this.duration=duration;this.speed=speed;this.timeout=timeout;this.now=now;this.cooldown=cooldown;
    this.activityKey='hula';this.interruptibleByCart=true;this.cartClearance=5;this.phase='idle';this.person=null;this.claim=null;this.reservation=null;
    this.elapsed=0;this.wait=0;this.phaseTime=0;this.view={};this.target={};this.disposed=false;
  }
  sampleBodyPose(person,out){return this.person===person&&this.phase==='hooping'?sampleHulaMotion(this.elapsed*5.25,1.65,out):null;}
  start(person) {
    if(this.disposed||this.phase!=='idle'||!this.people.readPerson(person,this.view)||!this.eligible(this.view))return false;
    const reservation=this.place.reserve(person);if(!reservation)return false;
    this.person=person;this.reservation=reservation;this.phase='approaching';this.elapsed=0;this.wait=0;this.phaseTime=0;
    if(!this.acquire()){this.finish('unavailable');return false;}
    return true;
  }
  acquire() {
    const claim=this.people.claimActivity(this.person,{owner:this,release:(released,reason)=>{
      if(this.claim!==released)return;
      this.claim=null;this.place.show(this.reservation,false);
      if(reason==='honk'||reason==='dodge'){this.phase='interrupted';this.wait=0;}
      else this.finish(reason);
    }});
    if(!claim)return false;
    this.claim=claim;return true;
  }
  update(dt,{safe=true}={}) {
    if(this.disposed||this.phase==='idle')return;
    if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Hula requires an accepted frame delta.');
    try {
    if(!this.people.readPerson(this.person,this.view)||!this.place.isLive(this.reservation)){this.finish('unavailable');return;}
    if(this.phase==='interrupted'){
      this.wait+=dt;
      if(this.wait>this.timeout){this.finish('timeout');return;}
      if(!safe||this.view.state==='fleeing')return;
      if(!this.eligible(this.view)){this.finish('ineligible');return;}
      if(!this.acquire()){this.finish('unavailable');return;}
      this.phase='approaching';this.phaseTime=0;return;
    }
    if(!this.claim||!this.people.isPersonActivityCurrent(this.claim)){this.finish('unavailable');return;}
    if(this.phase!=='hooping'&&(this.phaseTime+=dt)>this.timeout){this.finish('timeout');return;}
    if(this.phase==='hooping'){
      this.elapsed+=dt;
      this.people.writeActivityPose(this.claim,this.view.x,this.view.y,this.view.z,this.view.heading,this.view.bob+dt*4);
      if(this.elapsed>=this.duration){this.phase='leaving';this.phaseTime=0;this.place.show(this.reservation,false);}
      return;
    }
    if(!this.place.target(this.reservation,this.phase,this.target)){this.finish('unavailable');return;}
    const dx=this.target.x-this.view.x,dz=this.target.z-this.view.z,d=Math.hypot(dx,dz);
    if(d>.05){const step=Math.min(d,this.speed*dt),x=this.view.x+dx/d*step,z=this.view.z+dz/d*step;
      if(this.place.canMove(this.reservation,x,z))this.people.writeActivityPose(this.claim,x,this.target.y,z,Math.atan2(-dx,-dz),null,dt);
      else this.people.writeActivityPose(this.claim,this.view.x,this.view.y,this.view.z,this.view.heading);
      return;
    }
    if(this.phase==='approaching'){this.phase='hooping';this.people.writeActivityPose(this.claim,this.view.x,this.view.y,this.view.z,this.view.heading);this.place.show(this.reservation,true);}
    else this.finish('completed');
    } catch(error){try{this.finish('failed');}catch(cleanup){throw new AggregateError([error,cleanup],'Hula update and cleanup failed.');}throw error;}
  }
  finish(reason='cancelled') {
    if(this.phase==='idle')return;
    const claim=this.claim,reservation=this.reservation,person=this.person;
    let exit=null;const errors=[];
    try {if(reason==='completed'&&claim&&reservation&&this.people.readPerson(person,this.view)&&this.place.target(reservation,'approaching',this.target)){
      const dx=this.view.x-this.target.x,dz=this.view.z-this.target.z,d=Math.hypot(dx,dz);
      if(d>.05){const ux=dx/d,uz=dz/d;let clear=true;
        for(let step=1;step<=4;step++)if(!this.place.canMove(reservation,this.view.x+ux*step,this.view.z+uz*step)){clear=false;break;}
        if(clear)exit={targetX:this.view.x+ux*4,targetZ:this.view.z+uz*4,reason};
      }
    }}catch(error){errors.push(error);}
    if(reason==='completed'&&claim)try{this.people.requestActivityExit(claim,{...(exit??{}),cooldownUntil:this.now()+this.cooldown});}catch(error){errors.push(error);}
    this.claim=null;this.person=null;this.reservation=null;this.phase='idle';
    if(reservation){try{this.place.show(reservation,false);}catch(error){errors.push(error);}try{this.place.release(reservation);}catch(error){errors.push(error);}}
    if(claim)try{this.people.endPersonActivity(claim,exit??{reason});}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'Hula cleanup failed.');
  }
  dispose(){if(this.disposed)return;this.finish('activity-removed');this.disposed=true;}
}
