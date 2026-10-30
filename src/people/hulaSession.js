import {sampleClassicHoopMotion} from './hoop/classic.js';
import {compileHoopScore,createHoopSample,sampleHoopScore,applyHoopGround} from './hoop/score.js';
const makeFoot=()=>({x:0,y:0,z:0,qx:0,qy:0,qz:0,qw:1,plantId:0,planted:false});
function copyFoot(source,target){
  target.x=source.x;target.y=source.y;target.z=source.z;
  target.qx=source.qx;target.qy=source.qy;target.qz=source.qz;target.qw=source.qw;
  target.plantId=source.plantId;target.planted=source.planted;
}
// A session retains its own place reservation while Crowd lends movement.
// Revoked claims are never reused, including when the same person resumes.
export class HulaSession {
  constructor({people,place,eligible,duration=20,speed=1.45,timeout=30,now=()=>0,cooldown=20}) {
    if(!people||!place||typeof eligible!=='function')throw new TypeError('Hula needs a population, place and eligibility policy.');
    this.people=people;this.place=place;this.eligible=eligible;this.duration=duration;this.speed=speed;this.timeout=timeout;this.now=now;this.cooldown=cooldown;
    this.activityKey='hula';this.interruptibleByCart=true;this.cartClearance=5;this.phase='idle';this.person=null;this.claim=null;this.reservation=null;
    this.elapsed=0;this.wait=0;this.phaseTime=0;this.view={};this.target={};this.disposed=false;
    this.style='classic';this.generation=0;this.version=0;this.scoreEpoch=0;this.scoreTime=0;
    this.flowSample=createHoopSample();this.classicSample=createHoopSample();this.flowPosition={x:0,y:0,z:0,heading:0};this.flowGroundValid=true;this.flowOptions={};this.flowAnchor={x:0,y:0,z:0,heading:0,scale:1};this.score=null;this.events=[];this.incomplete=false;

  }
  configure({style='classic',seed=1977,slot=0,profile='lyrical',hoops=1,duration=this.duration}={}) {
    if(this.phase!=='idle')throw new Error('Configure hooping only between sessions.');
    if(!['classic','flow'].includes(style)||!Number.isFinite(duration)||duration<4||duration>60)throw new RangeError('Invalid hoop performance.');
    this.style=style;this.duration=duration;this.flowOptions={seed,slot,profile,hoops};this.pendingScore=null;return this;
  }
  planFlow(){return this.pendingScore=compileHoopScore({...this.flowOptions,generation:(this.generation+1)*257+1,duration:this.duration});}
  sampleBodyPose(person,out){
    out.feet=null;out.rootY=0;out.articulated=false;
    if(this.person!==person||this.phase!=='hooping'){out.style='inactive';out.hoopCount=0;out.arms=null;out.stride=out.headYaw=out.headTilt=out.travelX=out.travelZ=out.turn=0;return null;}
    out.style=this.style;out.generation=this.generation;out.version=this.version;
    const a=out.flowArms??=(Object.seal({x:0,z:0,elbow:0,leftX:0,leftZ:0,leftElbow:0}));
    out.arms=a;out.hoopCount=0;
    out.articulated=true;
    const v=this.style==='classic'?this.classicSample:this.flowSample;
    out.bob=v.bob;out.leanX=v.leanX;out.leanZ=v.leanZ;out.hoopCount=this.style==='classic'?0:v.hoopCount;
    a.x=v.arms.x;a.z=v.arms.z;a.elbow=v.arms.elbow;a.leftX=v.arms.leftX;a.leftZ=v.arms.leftZ;a.leftElbow=v.arms.leftElbow;
    out.stride=v.stride??0;out.headYaw=v.headYaw??0;out.headTilt=v.headTilt??0;out.travelX=v.travelX??0;out.travelZ=v.travelZ??0;out.turn=v.turn??0;
    if(v.feet){
      const feet=out.flowFeet??=(Object.seal({left:makeFoot(),right:makeFoot()}));
      copyFoot(v.feet.left,feet.left);copyFoot(v.feet.right,feet.right);out.feet=feet;out.rootY=v.rootY;
    }
    out.hoopX=this.style==='classic'?v.hoopX:0;out.hoopY=this.style==='classic'?v.hoopY:0;out.hoopZ=this.style==='classic'?v.hoopZ:0;return out;
  }
  record(type,detail=null,time=this.elapsed){
    if(this.style!=='flow')return true;
    if(this.events.length>=256){this.incomplete=true;return false;}
    this.events.push({type,time,epoch:this.scoreEpoch,detail});return true;
  }
  prepareFlow(){
    this.scoreTime=0;this.scoreEpoch++;
    const a=this.flowAnchor;a.x=this.view.x;a.y=this.view.y;a.z=this.view.z;a.heading=this.view.heading;a.scale=this.view.scale??1;
    this.score=this.scoreEpoch===1&&this.pendingScore?this.pendingScore:compileHoopScore({...this.flowOptions,generation:this.generation*257+this.scoreEpoch,duration:this.duration-this.elapsed});
    this.pendingScore=null;
    if(!this.cacheFlow())return false;return this.record('score',{score:this.score,anchor:{...this.flowAnchor}});
  }
  cacheFlow(){
    const v=this.flowSample,a=this.flowAnchor,p=this.flowPosition;
    sampleHoopScore(this.score,this.scoreTime,v);
    const c=Math.cos(a.heading),s=Math.sin(a.heading),tx=v.travelX*a.scale,tz=v.travelZ*a.scale;
    p.x=a.x+c*tx+s*tz;p.z=a.z-s*tx+c*tz;p.heading=a.heading+v.turn;
    p.y=this.place.groundAt?.(p.x,p.z)??a.y;
    this.flowGroundValid=Number.isFinite(p.y);
    if(this.flowGroundValid&&v.feet){
      const left=this.footGround(v.feet.left),right=this.footGround(v.feet.right);
      this.flowGroundValid=Number.isFinite(left)&&Number.isFinite(right)&&
        applyHoopGround(v,(p.y-a.y)/a.scale,(left-p.y)/a.scale,(right-p.y)/a.scale);
    }
    v.generation=this.generation;v.version=++this.version;
    return this.flowGroundValid;
  }
  footGround(foot,v=this.flowSample,a=this.flowAnchor,p=this.flowPosition){
    if(!this.place.groundAt)return a.y;
    const cz=Math.cos(v.leanZ),sz=Math.sin(v.leanZ),cx=Math.cos(v.leanX),sx=Math.sin(v.leanX);
    const heading=a.heading+v.turn,cy=Math.cos(heading),sy=Math.sin(heading);
    let height=-Infinity;
    // A horizontal shoe rests on the highest terrain point under its four
    // sole corners. Sampling the root alone would let a planted toe sink on slopes.
    for(let corner=0;corner<4;corner++){
      const x=(corner&1)?.08:-.08,z=-.06+((corner&2)?.12:-.12);
      const tx=2*foot.qy*z,ty=2*(foot.qz*x-foot.qx*z),tz=-2*foot.qy*x;
      const fx=foot.x+x+foot.qw*tx+foot.qy*tz-foot.qz*ty;
      const fy=foot.y+foot.qw*ty+foot.qz*tx-foot.qx*tz;
      const fz=foot.z+z+foot.qw*tz+foot.qx*ty-foot.qy*tx;
      const rx=cz*fx-sz*fy,ry=sz*fx+cz*fy,rz=sx*ry+cx*fz;
      const worldX=p.x+a.scale*(cy*rx+sy*rz);
      const worldZ=p.z+a.scale*(-sy*rx+cy*rz);
      height=Math.max(height,this.place.groundAt(worldX,worldZ));
    }
    return height;
  }
  cacheClassic(){
    const v=this.classicSample,a=this.flowAnchor,p=this.flowPosition;
    a.x=this.view.x;a.y=this.view.y;a.z=this.view.z;a.heading=this.view.heading;a.scale=this.view.scale??1;
    p.x=a.x;p.y=a.y;p.z=a.z;p.heading=a.heading;
    sampleClassicHoopMotion(this.elapsed*5.25,1.65,v);
    const left=this.footGround(v.feet.left,v,a,p),right=this.footGround(v.feet.right,v,a,p);
    this.flowGroundValid=Number.isFinite(left)&&Number.isFinite(right)&&applyHoopGround(v,0,(left-a.y)/a.scale,(right-a.y)/a.scale);
    v.generation=this.generation;v.version=++this.version;return this.flowGroundValid;
  }
  publishFlowPose(){
    const p=this.flowPosition;
    return this.people.writeActivityPose(this.claim,p.x,p.y,p.z,p.heading);
  }
  rejectGround(){
    this.record('obstruction','terrain-reach');this.finish('terrain-reach');return false;
  }
  seekFlow(time){
    if(this.style!=='flow'||this.phase!=='hooping'||!Number.isFinite(time)||time<0||time>this.score.duration)return false;
    if(!this.people.readPerson(this.person,this.view)||!this.people.isPersonActivityCurrent(this.claim))return false;
    this.scoreTime=time;if(!this.cacheFlow())return this.rejectGround();
    return this.publishFlowPose();
  }
  exportReplay(){return JSON.parse(JSON.stringify({version:1,style:this.style,generation:this.generation,phase:this.phase,elapsed:this.elapsed,scoreTime:this.scoreTime,sampleVersion:this.version,anchor:this.flowAnchor,score:this.score,events:this.events,incomplete:this.incomplete,error:this.incomplete?'event-overflow':null}));}

  start(person) {
    if(this.disposed||this.phase!=='idle'||!this.people.readPerson(person,this.view)||!this.eligible(this.view))return false;
    const reservation=this.place.reserve(person);if(!reservation)return false;
    this.person=person;this.reservation=reservation;this.phase='approaching';this.elapsed=0;this.wait=0;this.phaseTime=0;
    this.generation++;this.scoreEpoch=0;this.events.length=0;this.incomplete=false;

    try{if(!this.acquire()){this.finish('unavailable');return false;}return true;}
    catch(error){try{this.finish('failed');}catch(cleanup){throw new AggregateError([error,cleanup],'Hula acquisition and cleanup failed.');}throw error;}
  }
  acquire() {
    const claim=this.people.claimActivity(this.person,{owner:this,prepare:()=>(this.style==='classic'||this.place.isLive(this.reservation))&&this.people.readPerson(this.person,this.view)&&this.eligible(this.view)&&!this.view.claimed,release:(released,reason)=>{
      if(this.claim!==released)return;
      this.claim=null;
      try{this.place.show(this.reservation,false);}catch(error){try{this.finish('hide-failed');}catch(cleanup){throw new AggregateError([error,cleanup],'Hula interruption cleanup failed.');}throw error;}
      if(reason==='honk'||reason==='dodge'){this.phase='interrupted';this.wait=0;this.version++;if(!this.record('interrupted',reason))this.finish('event-overflow');}
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
      if(this.style==='flow'){
        const before=this.flowSample.segment,beforeTime=this.scoreTime;this.scoreTime=Math.min(this.score.duration,this.scoreTime+dt);
        if(!this.cacheFlow()){this.rejectGround();return;}
        for(let boundary=before+1;boundary<=this.flowSample.segment;boundary++)if(!this.record('segment',boundary,this.elapsed-dt+this.score.segments[boundary].start-beforeTime)){this.finish('event-overflow');return;}
      }
      if(this.style==='classic'&&!this.cacheClassic()){this.rejectGround();return;}
      const publishing=this.claim;
      if(this.style==='flow')this.publishFlowPose();else this.people.writeActivityPose(publishing,this.view.x,this.view.y,this.view.z,this.view.heading,this.view.bob+dt*4);
      if(this.phase!=='hooping'||this.claim!==publishing)return;
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
    if(this.phase==='approaching'){
      if(this.style==='flow'&&this.duration-this.elapsed<4){this.finish('completed');return;}
      if(this.style==='flow'&&!this.prepareFlow()){if(this.flowGroundValid)this.finish('event-overflow');else this.rejectGround();return;}
      if(this.style==='flow'&&this.place.canPerform&&!this.place.canPerform(this.reservation)){this.record('obstruction','entrance');this.finish('obstruction');return;}
      if(this.style==='classic'&&!this.cacheClassic()){this.rejectGround();return;}
      this.phase='hooping';const publishing=this.claim,reservation=this.reservation;
      if(this.style==='flow')this.publishFlowPose();else this.people.writeActivityPose(publishing,this.view.x,this.view.y,this.view.z,this.view.heading);
      if(this.phase==='hooping'&&this.claim===publishing&&this.reservation===reservation&&this.people.isPersonActivityCurrent(publishing)&&this.place.isLive(reservation))this.place.show(reservation,true);
    }
    else this.finish('completed');
    } catch(error){try{this.finish('failed');}catch(cleanup){throw new AggregateError([error,cleanup],'Hula update and cleanup failed.');}throw error;}
  }
  finish(reason='cancelled') {
    if(this.phase==='idle')return;
    if(!this.incomplete)this.record('finish',reason);
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
    this.claim=null;this.person=null;this.reservation=null;this.phase='idle';this.version++;this.flowSample.hoopCount=0;
    if(reservation){try{this.place.show(reservation,false);}catch(error){errors.push(error);}try{this.place.release(reservation);}catch(error){errors.push(error);}}
    if(claim)try{this.people.endPersonActivity(claim,exit??{reason});}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'Hula cleanup failed.');
  }
  dispose(){if(this.disposed)return;this.finish('activity-removed');this.disposed=true;}
}
