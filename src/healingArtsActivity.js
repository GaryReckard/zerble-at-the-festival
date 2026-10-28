import {createHealingArtsMotion,sampleHealingArtsMotion} from './people/healingArtsMotion.js';
const WALK_ANGLES = [0,.6,-.6,1.2,-1.2];

// Population owners retain identity and storage. This place owns motion samples, rig slots
// and exclusive claims, and never keeps or edits a raw population record.
export class HealingArtsActivity {
  constructor(group,people,rng,canWalk=()=>true) {
    this.activityKey='healing-arts';this.active=true;
    this.scratch=group.position.clone();this.personScratch={};this.time=0;
    this.group=group;this.people=people;this.rng=rng;this.canWalk=canWalk;
    this.u=group.userData.healingArts;
    this.u.activityOwner?.dispose();
    this.u.managed=true;this.u.activityOwner=this;
    this.motion=createHealingArtsMotion(this.u,true);this.u.motion=this.motion;
    this.slots=this.motion.participants.filter(p=>!p.dj).map(p=>({p,person:null,claim:null,role:null,wait:0,reservation:null}));
    this.visitors=new Set();this.byPerson=new Map();
    this.phase='day';this.clock=0;this.next=0;this.nextArrival=0;this.lastNightness=0;this.initialized=false;
    this.c=Math.cos(group.rotation.y);this.s=Math.sin(group.rotation.y);
    this.selectFirst=(person,view)=>{if(this.eligible(person,view)){this.selection=person;return false;}};
    this.selectClosest=(person,view,distance)=>{if(distance<this.selectionDistance&&this.eligible(person,view)){this.selection=person;this.selectionDistance=distance;}};
    for(const slot of this.slots)this.addYoga(slot);
  }

  point(x,z) {
    const p=this.scratch.copy(this.group.position);
    p.x+=x*this.c+z*this.s;p.z+=-x*this.s+z*this.c;p.y=0;return p;
  }

  eligible(person,view) {
    return !view.claimed&&!view.grouped&&!view.photographer&&
      this.people.activityCooldown(person,this.activityKey)<=this.time&&['idle','walking','watching'].includes(view.state);
  }

  adopt(slot,person,role) {
    if(!this.active)return false;
    const reservation={};
    const claim=this.people.claimActivity(person,{owner:this,
      prepare:attempt=>{
        if(!this.active||slot.person||slot.reservation)return false;
        slot.reservation=reservation;
        attempt.own(()=>{if(slot.reservation===reservation){slot.reservation=null;slot.p.activity='hidden';}});
        return true;
      },
      release:(released,reason)=>this.released(slot,released,reason),
    });
    if(!claim)return false;
    if(!this.active){this.people.endPersonActivity(claim);return false;}
    slot.person=person;slot.claim=claim;slot.role=role;slot.wait=0;
    this.visitors.add(person);this.byPerson.set(person,slot);
    this.people.readPerson(person,this.personScratch);
    slot.p.shirt=this.personScratch.shirt;slot.p.skin=this.personScratch.skin;
    slot.p.activity=role==='yoga'?'yoga':'hidden';
    this.people.setActivityBinding(claim,role==='yoga');return true;
  }

  addYoga(slot) {
    if(!this.active||slot.person)return;
    const person=this.people.spawnPerson({pos:this.point(slot.p.x,slot.p.z),chunkKey:null,rng:this.rng,
      allowPhotographer:false,appearanceOverride:{shirt:slot.p.shirt,skin:slot.p.skin}});
    if(person){if(!this.adopt(slot,person,'yoga'))this.people.removePerson(person);}
    else {
      this.selection=null;
      this.people.forEachPersonNear(this.group.position.x,this.group.position.z,55,this.selectFirst);
      if(this.selection)this.adopt(slot,this.selection,'yoga_entering');else slot.p.activity='hidden';
    }
  }

  released(slot,claim) {
    if(slot.claim!==claim)return;
    const exit={cooldownUntil:this.time+60};
    if(this.people.readPerson(claim.person,this.personScratch)&&this.personScratch.state!=='fleeing') {
      const target=this.point((claim.person.slot%2?1:-1)*17,19);
      exit.targetX=target.x;exit.targetZ=target.z;
    }
    // The population commits exit metadata after all owned resources release;
    // this revoking activity never restores ordinary movement or a binding.
    this.people.requestActivityExit(claim,exit);
    this.visitors.delete(claim.person);this.byPerson.delete(claim.person);
    slot.p.activity='hidden';slot.person=null;slot.claim=null;slot.role=null;
  }

  releasePerson(person) {
    const slot=this.byPerson.get(person);
    if(slot)this.people.endPersonActivity(slot.claim);
  }

  leave(slot) {
    if(!slot.person)return;
    if(slot.role==='yoga'||slot.role==='dance') {
      const p=this.point(slot.p.currentX??slot.p.x,slot.p.currentZ??slot.p.z);
      this.people.writeActivityPose(slot.claim,p.x,p.y,p.z);
    }
    this.people.setActivityBinding(slot.claim,false);
    slot.wait=0;slot.role='leaving';slot.p.activity='hidden';
  }

  move(slot,target,dt) {
    const person=this.personScratch;
    if(!this.people.readPerson(slot.person,person))return false;
    const dx=target.x-person.x,dz=target.z-person.z,d=Math.hypot(dx,dz);
    if(d<.45)return true;
    const step=Math.min(d,dt*1.45);
    for(const angle of WALK_ANGLES) {
      const ca=Math.cos(angle),sa=Math.sin(angle),vx=(dx*ca-dz*sa)/d,vz=(dx*sa+dz*ca)/d;
      const x=person.x+vx*step,z=person.z+vz*step;
      if(!this.canWalk(x,z,slot.person)||this.people.hasPersonWithin(x,z,.75,slot.person))continue;
      this.people.writeActivityPose(slot.claim,x,person.y,z,Math.atan2(-vx,-vz),person.bob+dt*5);
      return false;
    }
    return false;
  }

  update(dt,time,nightness) {
    if(!this.active)return;
    this.clock+=dt;this.time=time;
    if(!this.initialized){this.initialized=true;if(nightness>.5){for(const slot of this.slots)this.releasePerson(slot.person);this.phase='night';}}
    const falling=nightness<this.lastNightness-.00001;
    if(this.phase==='day'&&nightness>.18){this.phase='dusk';this.next=this.clock;}
    if((this.phase==='night'||this.phase==='dusk')&&falling&&nightness<.45){this.phase='dawn';this.next=this.clock;}
    if(this.phase==='dusk'&&this.clock>=this.next){
      const slot=this.slots.find(s=>s.role==='yoga'||s.role==='yoga_entering');if(slot)this.leave(slot);
      this.next=this.clock+.9;
      if(!this.slots.some(s=>s.role==='yoga'||s.role==='yoga_entering')&&nightness>.5)this.phase='night';
    }
    if(this.phase==='dawn'&&this.clock>=this.next){
      const slot=this.slots.find(s=>s.role==='dance'||s.role==='entering');if(slot)this.leave(slot);
      this.next=this.clock+.8;
      if(!this.slots.some(s=>s.role==='dance'||s.role==='entering')&&nightness<.05)this.phase='day';
    }
    if(this.phase==='day'&&this.clock>=this.next){const slot=this.slots.find(s=>!s.person);if(slot)this.addYoga(slot);this.next=this.clock+1.3;}
    if((this.phase==='night'||this.phase==='dusk')&&nightness>.5&&this.clock>=this.nextArrival){
      const slot=this.slots.find(s=>!s.person);
      if(slot){this.selection=null;this.selectionDistance=55;this.people.forEachPersonNear(this.group.position.x,this.group.position.z,55,this.selectClosest);if(this.selection)this.adopt(slot,this.selection,'entering');}
      this.nextArrival=this.clock+1.7;
    }
    for(const slot of this.slots){
      const person=slot.person;if(!person)continue;
      if(!this.people.readPerson(person,this.personScratch)){this.releasePerson(person);continue;}
      if(this.personScratch.state==='fleeing'){this.releasePerson(person);continue;}
      if(slot.role==='yoga'||slot.role==='dance'){
        const p=this.point(slot.p.currentX??slot.p.x,slot.p.currentZ??slot.p.z);
        this.people.writeActivityPose(slot.claim,p.x,p.y,p.z);continue;
      }
      slot.wait+=dt;
      const side=person.slot%2?1:-1;
      const target=slot.role==='yoga_entering'?this.point(slot.p.x,slot.p.z):slot.role==='entering'?this.point(side*1.5,6.1):this.point(side*3,16);
      const arrived=this.move(slot,target,dt);
      if(!this.active)return;
      if(arrived){
        if(slot.role==='yoga_entering'){slot.role='yoga';slot.p.activity='yoga';this.people.setActivityBinding(slot.claim,true);}
        else if(slot.role==='entering'){
          slot.role='dance';slot.p.activity='dance';this.people.setActivityBinding(slot.claim,true);
          slot.p.entryX=(this.personScratch.x-this.group.position.x)*this.c-(this.personScratch.z-this.group.position.z)*this.s;
          slot.p.entryZ=(this.personScratch.x-this.group.position.x)*this.s+(this.personScratch.z-this.group.position.z)*this.c;
          slot.p.entryTime=time;
        }else this.releasePerson(person);
      }else if(slot.wait>45)this.releasePerson(person);
    }
    this.lastNightness=nightness;
  }

  sample(time,nightness) {if(this.active)sampleHealingArtsMotion(this.motion,time,nightness);}
  describePerson(person,out) {out.role=this.byPerson.get(person)?.role??null;out.phase=this.phase;}
  dispose() {
    if(!this.active)return;this.active=false;
    const errors=[];
    for(const person of [...this.visitors])try{this.releasePerson(person);}catch(error){errors.push(error);}
    this.motion.managed=false;
    if(this.u.activityOwner===this){this.u.activityOwner=null;this.u.managed=false;}
    if(errors.length)throw new AggregateError(errors,'Healing Arts cleanup failed.');
  }
}
