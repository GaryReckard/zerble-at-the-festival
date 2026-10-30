import {Matrix4,Vector3} from 'three';
import {sampleArmHand} from '../../personMotion.js';

const RADIUS=.58,MAX_EVENTS=256,TAU=Math.PI*2;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
function pose(){return {style:'flow',articulated:true,generation:0,version:0,bob:0,leanX:0,leanZ:0,travelX:0,travelZ:0,turn:0,stride:0,headYaw:0,headTilt:0,rootY:0,feet:null,time:0,segment:'partner-exchange',motif:'exchange-and-answer',hoopCount:0,arms:{x:0,z:0,elbow:0,leftX:0,leftZ:0,leftElbow:0}};}

// A distinct pair owns both claims. Its one hoop never belongs to either solo
// renderer, so interruption cannot leave two competing airborne prop owners.
export class HoopPairSession {
  constructor({people,place,eligible,duration=22,now=()=>0,cooldown=20}) {
    if(!people||!place||typeof eligible!=='function'||typeof now!=='function'||!Number.isFinite(cooldown)||cooldown<0||!Number.isFinite(duration)||duration<=0)throw new TypeError('A hoop exchange needs people, place, eligibility and a positive duration.');
    for(const method of ['reserve','isLive','release','show'])if(typeof place[method]!=='function')throw new TypeError('Missing hoop exchange place method: '+method);
    this.people=people;this.place=place;this.eligible=eligible;this.duration=duration;this.now=now;this.cooldown=cooldown;
    this.activityKey='hula';this.interruptibleByCart=true;this.cartClearance=5;
    this.phase='idle';this.persons=[];this.claims=[null,null];this.views=[{},{}];this.reservation=null;this.elapsed=0;this.generation=0;this.version=0;this.disposed=false;this.ending=false;
    this.samples=[pose(),pose()];this.matrices=[new Matrix4(),new Matrix4()];this.hands=[new Vector3(),new Vector3()];this.localHand=new Vector3();
    this.armScratch={x:0,z:0,elbow:0};this.direction={x:1,z:0};this.heading=0;
    this.hoop={x:0,y:0,z:0,qx:0,qy:0,qz:0,qw:1,spin:0,contact:'none',contactAngle:0,visible:false,radius:RADIUS};
    this.events=[];this.complete=true;this.error=null;this.contact='none';this.initial=null;
  }
  _eligible(person,out){return !!person&&this.people.readPerson(person,out)&&!out.claimed&&this.eligible(out);}
  start(a,b) {
    if(this.disposed||this.phase!=='idle'||!a||a===b||!this._eligible(a,this.views[0])||!this._eligible(b,this.views[1]))return false;
    const dx=this.views[1].x-this.views[0].x,dz=this.views[1].z-this.views[0].z,d=Math.hypot(dx,dz);
    const scaleA=this.views[0].scale??1,scaleB=this.views[1].scale??1;
    const minimum=.88*(scaleA+scaleB)+2*RADIUS*Math.min(scaleA,scaleB)+.25;
    if(!Number.isFinite(d)||!Number.isFinite(minimum)||scaleA<=0||scaleB<=0||d<minimum||d>8)return false;
    const reservation=this.place.reserve(a,b);if(!reservation)return false;
    this.persons=[a,b];this.reservation=reservation;this.phase='acquiring';this.elapsed=0;this.version=0;this.generation++;
    this.events=[];this.complete=true;this.error=null;this.contact='none';this.heading=Math.atan2(-dz,dx);this.direction.x=dx/d;this.direction.z=dz/d;
    this.initial={persons:this.views.map(v=>({x:v.x,y:v.y,z:v.z,scale:v.scale??1})),heading:this.heading};
    try {
      if(!this.place.isLive(reservation)||!this._acquire()){this.finish('unavailable');return false;}
      this.phase='playing';this._record('start');this._prepare(0);this._publish();this.place.show(reservation,true);
      if(this.phase!=='playing'||!this.claims.every(c=>this.people.isPersonActivityCurrent(c))||!this.place.isLive(reservation)){this.finish('unavailable');return false;}
      this.hoop.visible=true;return true;
    } catch(error){try{this.finish('failed');}catch(cleanup){throw new AggregateError([error,cleanup],'Hoop pair construction and cleanup failed.');}throw error;}
  }
  _acquire() {
    const persons=[...this.persons],reservation=this.reservation,generation=this.generation;
    for(let i=0;i<2;i++) {
      const claim=this.people.claimActivity(persons[i],{
        owner:this,
        prepare:()=>this.phase==='acquiring'&&this.generation===generation&&this.place.isLive(reservation)&&this._eligible(persons[i],this.views[i]),
        release:(released,reason)=>this._released(i,released,reason),
      });
      if(!claim)return false;
      // A claim callback can synchronously cancel the first acquisition while
      // the second call is still returning. The returned claim is still ours.
      if(this.phase!=='acquiring'||this.generation!==generation||this.reservation!==reservation){this.people.endPersonActivity(claim,{reason:'pair-acquisition-cancelled'});return false;}
      this.claims[i]=claim;
      if(!this.place.isLive(reservation)||!this.claims.slice(0,i+1).every(c=>this.people.isPersonActivityCurrent(c)))return false;
    }
    return this.claims.every(c=>c&&this.people.isPersonActivityCurrent(c));
  }
  _released(index,claim,reason) {
    if(this.claims[index]!==claim)return;
    this.claims[index]=null;
    if(!this.ending)this.finish(reason==='honk'||reason==='dodge'?'pair-interrupted':reason);
  }
  _record(kind,detail=null) {
    if(this.events.length>=MAX_EVENTS){this.complete=false;this.error='event-capacity-exceeded';return false;}
    this.events.push({time:this.elapsed,kind,detail});return true;
  }
  _prepare(time) {
    const entrance=Math.min(.8,this.duration*.1),outro=entrance;
    const lift=smooth(time/entrance)*smooth((this.duration-time)/outro);
    this.version++;
    for(const sample of this.samples) {
      sample.style='flow';sample.generation=this.generation;sample.version=this.version;sample.time=time;
      sample.bob=sample.leanX=sample.leanZ=0;sample.hoopCount=0;
      const arms=sample.arms;arms.x=arms.leftX=0;arms.z=1.45*lift;arms.elbow=-.15*lift;arms.leftZ=-1.45*lift;arms.leftElbow=.15*lift;
    }
  }
  sampleBodyPose(person,out) {
    out.style='inactive';out.articulated=false;out.hoopCount=0;out.generation=out.version=out.time=0;out.bob=out.leanX=out.leanZ=0;
    // Crowd reuses pose scratch after moving solo performers. A stationary
    // pair must overwrite their locomotion and gaze channels as well as arms.
    out.travelX=out.travelZ=out.turn=out.stride=out.headYaw=out.headTilt=out.rootY=0;out.feet=null;
    out.arms??={};const arms=out.arms;arms.x=arms.z=arms.elbow=arms.leftX=arms.leftZ=arms.leftElbow=0;
    if(this.phase!=='playing')return null;
    const index=this.persons.indexOf(person);if(index<0||!this.people.isPersonActivityCurrent(this.claims[index]))return null;
    const sample=this.samples[index];
    out.style='flow';out.articulated=true;out.generation=sample.generation;out.version=sample.version;out.bob=out.leanX=out.leanZ=0;out.time=sample.time;out.segment=sample.segment;out.motif=sample.motif;
    Object.assign(arms,sample.arms);
    return out;
  }
  _publish() {
    for(let i=0;i<2;i++) {
      const claim=this.claims[i],view=this.views[i];
      if(!this.people.readPerson(this.persons[i],view)||!this.people.writeActivityPose(claim,view.x,view.y,view.z,this.heading))throw new Error('Hoop pair lost authority while publishing.');
      if(!this.people.readActivityPresentation(claim,this.matrices[i]))throw new Error('Hoop pair presentation is unavailable.');
      const arms=this.samples[i].arms;
      this.armScratch.x=i?arms.leftX:arms.x;this.armScratch.z=i?arms.leftZ:arms.z;this.armScratch.elbow=i?arms.leftElbow:arms.elbow;
      sampleArmHand(this.armScratch,this.localHand);
      if(i)this.localHand.x-=.60;
      this.hands[i].copy(this.localHand).applyMatrix4(this.matrices[i]);
    }
    const scale=Math.min(this.views[0].scale??1,this.views[1].scale??1);
    const radius=RADIUS*scale;
    const ax=this.hands[0].x+this.direction.x*radius,ay=this.hands[0].y,az=this.hands[0].z+this.direction.z*radius;
    const bx=this.hands[1].x-this.direction.x*radius,by=this.hands[1].y,bz=this.hands[1].z-this.direction.z*radius;
    const entrance=Math.min(.8,this.duration*.1),available=Math.max(0,this.duration-entrance*2);
    // Complete outbound/return sentences fit before the resolution. Any final
    // spare beats are held, so completion never chops an airborne hoop in half.
    const cycles=Math.floor(available/6),active=Math.min(Math.max(0,this.elapsed-entrance),cycles*6);
    const half=Math.floor(active/3),within=active%3,reverse=half%2===1;
    const flying=active<cycles*6&&within>=.9&&within<2.1;
    let t=active>=cycles*6?0:(reverse?1:0),height=0;
    if(flying){const u=(within-.9)/1.2;t=reverse?1-smooth(u):smooth(u);height=.85*16*u*u*(1-u)*(1-u);}
    else if(active<cycles*6&&within>=2.1)t=reverse?0:1;
    const contact=flying?'flight':t===0?'right':'left';
    if(contact!==this.contact){this.contact=contact;if(!this._record('contact',contact)){this.finish('replay-overflow');return;}}
    const hoop=this.hoop;hoop.x=ax+(bx-ax)*t;hoop.y=ay+(by-ay)*t+height;hoop.z=az+(bz-az)*t;
    hoop.qx=0;hoop.qy=Math.sin(this.heading/2);hoop.qz=0;hoop.qw=Math.cos(this.heading/2);hoop.spin=this.elapsed*TAU*.65;
    hoop.radius=radius;hoop.contact=contact;hoop.contactAngle=contact==='right'?Math.PI:0;hoop.visible=this.phase==='playing';
  }
  update(dt,{safe=true}={}) {
    if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Hoop pair requires an accepted frame delta.');
    if(this.disposed||this.phase==='idle')return;
    try {
      if(!safe){this.finish('obstructed');return;}
      if(!this.place.isLive(this.reservation)||!this.persons.every((p,i)=>this.people.readPerson(p,this.views[i]))||!this.claims.every(c=>this.people.isPersonActivityCurrent(c))){this.finish('unavailable');return;}
      this.elapsed=Math.min(this.duration,this.elapsed+dt);this._prepare(this.elapsed);this._publish();
      if(this.elapsed>=this.duration)this.finish('completed');
    }catch(error){try{this.finish('failed');}catch(cleanup){throw new AggregateError([error,cleanup],'Hoop pair update and cleanup failed.');}throw error;}
  }
  finish(reason='cancelled') {
    if(this.phase==='idle')return;
    const claims=this.claims,reservation=this.reservation,errors=[];
    this.claims=[null,null];this.persons=[];this.reservation=null;this.phase='idle';this.ending=true;this.hoop.visible=false;this.hoop.contact='none';
    this._record('finish',reason);
    if(reason==='completed')for(const claim of claims)if(claim)try{this.people.requestActivityExit(claim,{cooldownUntil:this.now()+this.cooldown});}catch(error){errors.push(error);}
    if(reservation){try{this.place.show(reservation,false);}catch(error){errors.push(error);}try{this.place.release(reservation);}catch(error){errors.push(error);}}
    for(const claim of claims)if(claim)try{this.people.endPersonActivity(claim,{reason});}catch(error){errors.push(error);}
    this.ending=false;
    if(errors.length)throw new AggregateError(errors,'Hoop pair cleanup failed.');
  }
  inspect(out={}) {Object.assign(out,{phase:this.phase,active:this.phase==='playing'?2:0,elapsed:this.elapsed,duration:this.duration,generation:this.generation,version:this.version,contact:this.hoop.contact,hoops:this.hoop.visible?1:0,disposed:this.disposed,complete:this.complete,error:this.error});return out;}
  exportReplay(){return {type:'hoop-pair',version:1,duration:this.duration,elapsed:this.elapsed,generation:this.generation,initial:this.initial?structuredClone(this.initial):null,events:this.events.map(event=>({...event})),complete:this.complete,error:this.error};}
  dispose(){if(this.disposed)return;this.disposed=true;this.finish('activity-removed');}
}
