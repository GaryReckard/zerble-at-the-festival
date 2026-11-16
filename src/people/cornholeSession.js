import * as THREE from 'three';
import {registry} from '../registry.js';
import {terrainHeight} from '../worldgen/terrain.js';
import {CornholeRules} from './cornholeRules.js';
export const CORNHOLE_WAIT=Object.freeze({x:1.35,z:5.6});
export const cornholeEligible=v=>!v.claimed&&!v.grouped&&!v.photographer&&!v.seated&&!v.hidden&&['idle','walking','watching'].includes(v.state);

// This owner borrows ordinary bodies. All destinations are transformed from the
// court, so a rotated/translated streamed court has the same choreography.
export class CornholeSession {
  constructor({people,court,isLive,rng,now=()=>0,onFinish=()=>{}}){
    Object.assign(this,{people,court,isLive,rng,now,onFinish});
    this.activityKey='cornhole';this.interruptibleByCart=true;this.phase='idle';this.persons=[];this.claims=[];this.views=[{},{}];this.end=0;this.clock=0;this.point=new THREE.Vector3();this.hand=new THREE.Vector3();this.rules=new CornholeRules();this.bagStates=[];this.detours=[null,null];this.disposed=false;
  }
  get score(){return this.rules.score;} get round(){return this.rules.round;} get winner(){return this.rules.winner;}
  start(a,b){
    if(this.disposed||this.phase!=='idle'||a===b||![a,b].every((p,i)=>this.people.readPerson(p,this.views[i])&&cornholeEligible(this.views[i])))return false;
    this.persons=[a,b];this.detours=[null,null];this.phase='approaching';this.end=0;this.clock=0;this.rules=new CornholeRules();
    this.bagStates=this.court.cornhole.bags.map((mesh,i)=>({mesh,player:i%2,state:'landed',point:mesh.position.clone(),origin:new THREE.Vector3()}));
    try{
      for(let i=0;i<2;i++){
        const claim=this.people.claimActivity(this.persons[i],{owner:this,release:(c,reason)=>{if(this.claims.includes(c))this.finish(reason);}});
        if(!claim){this.finish('claim-failed');return false;}this.claims.push(claim);
        this.people.requestActivityExit(claim,{cooldownUntil:this.now()+180});
      }
      if(!this.isLive()){this.finish('unavailable');return false;}return true;
    }catch(error){this.finish('failed');throw error;}
  }
  world(x,y,z,out=this.point){out.set(x,y,z);return this.court.group.localToWorld(out);}
  stand(i,end=this.end){return this.world(i===0?-1:1,0,end===0?-4.2:4.2);}
  move(i,target,dt){
    const v=this.views[i],dx=target.x-v.x,dz=target.z-v.z,d=Math.hypot(dx,dz);
    if(d<.09)return true;
    const step=Math.min(d,1.35*dt);let heading=Math.atan2(dz,dx);
    const detour=this.detours[i];if(detour&&detour.left>0){heading=detour.heading;detour.left-=dt;}
    for(const offset of [0,.45,-.45,.9,-.9,1.3,-1.3,1.7,-1.7]){
      const angle=heading+offset,x=v.x+Math.cos(angle)*step,z=v.z+Math.sin(angle)*step;
      if(!this.clearStep(i,x,z))continue;
      if(offset!==0&&(!detour||detour.left<=0))this.detours[i]={heading:angle,left:.9};
      this.people.writeActivityPose(this.claims[i],x,terrainHeight(x,z),z,Math.atan2(v.x-x,v.z-z),null,dt);break;
    }
    return false;
  }
  clearStep(i,x,z){
    const v=this.views[i];let clear=true;
    registry.collidersNear(x,z,.3,entry=>{
      if(!clear||entry.kind==='cornhole_game')return;
      let next,current;
      if(entry.kind==='cornhole_board'&&entry.cornholeBoard){
        const b=entry.cornholeBoard,c=Math.cos(b.yaw),s=Math.sin(b.yaw);
        const distance=(px,pz)=>{const dx=px-entry.position.x,dz=pz-entry.position.z;return Math.hypot(Math.max(0,Math.abs(c*dx-s*dz)-b.width/2),Math.max(0,Math.abs(s*dx+c*dz)-b.length/2));};
        next=distance(x,z);current=distance(v.x,v.z);
      }else {next=Math.hypot(x-entry.position.x,z-entry.position.z)-(entry.collider?.radius??0);current=Math.hypot(v.x-entry.position.x,v.z-entry.position.z)-(entry.collider?.radius??0);}
      // A newly spawned overlapping adult may walk out, but never deeper in.
      if(next<.3&&next<=current+.00001)clear=false;
    });
    return clear&&(!this.people.hasPersonWithin||!this.people.hasPersonWithin(x,z,.55,this.persons[i]));
  }
  arms(i,action,amount,dt){
    this.people.writeActivityArmPose(this.claims[i],action,amount,dt);
  }
  faceBag(i,x,z){
    const v=this.views[i],target=this.world(x,0,z);
    const dx=target.x-v.x,dz=target.z-v.z,distance=Math.hypot(dx,dz);
    // Aim the right-hand socket at the bag across the player's shoulder width.
    const yaw=Math.atan2(-dx,-dz)+Math.asin(Math.min(1,.30*v.scale/Math.max(.001,distance)));
    this.people.writeActivityPose(this.claims[i],v.x,v.y,v.z,yaw);
  }
  reach(i,time,dt,bagHeight=.04){
    const t=Math.max(0,Math.min(1,time/.42,(1-time)/.4));
    this.people.writeActivityArmPose(this.claims[i],'pickup',t*t*(3-2*t),dt,bagHeight);
  }
  enter(phase){this.phase=phase;this.clock=0;}
  prepareThrow(){this.timer=3+this.rng()*3;this.enter('aiming');}
  update(dt){
    if(this.disposed||this.phase==='idle')return;
    if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Cornhole requires accepted delta.');
    try{
      if(!this.isLive()||!this.persons.every((p,i)=>this.people.readPerson(p,this.views[i]))||!this.claims.every(c=>this.people.isPersonActivityCurrent(c))){this.finish('unavailable');return;}
      this.clock+=dt;
      // A blocked approach/retrieval cannot retain people or a streamed court forever.
      if(this.clock>70&&['approaching','crossing','collecting','returning','meeting','tidying'].includes(this.phase)){this.finish('blocked');return;}
      if(this.phase==='approaching'||this.phase==='returning'){
        let ready=true;for(let i=0;i<2;i++){this.arms(i,'relaxed',0,dt);if(!this.move(i,this.stand(i),dt))ready=false;}
        if(ready){if(this.phase==='approaching'){this.pickTimers=[0,0];this.enter('collecting');}else this.prepareThrow();}
      }else if(this.phase==='aiming'){
        const i=this.rules.turn,v=this.views[i],target=this.world(0,0,this.end===0?4.2:-4.2);
        this.people.writeActivityPose(this.claims[i],v.x,v.y,v.z,Math.atan2(v.x-target.x,v.z-target.z));
        this.arms(i,'underhand',Math.min(1,Math.max(0,(this.clock-(this.timer-1.1))/1.1)),dt);this.arms(1-i,'relaxed',0,dt);
        if(this.clock>=this.timer)this.launch(i);
      }else if(this.phase==='flying'){
        const b=this.flying,t=Math.min(1,this.clock/1.25);
        b.mesh.position.copy(b.origin).lerp(b.point,t);b.mesh.position.y+=Math.sin(Math.PI*t)*2.15;b.mesh.rotation.x+=dt*4;
        if(t===1){b.state='landed';b.mesh.position.copy(b.point);b.mesh.rotation.set(0,0,0);this.rules.toss(b.points);
          if(this.rules.throws.length===8){this.end=1-this.end;this.enter('crossing');}else this.prepareThrow();}
      }else if(this.phase==='crossing'){
        let ready=true;for(let i=0;i<2;i++){this.arms(i,'relaxed',0,dt);if(!this.move(i,this.stand(i),dt))ready=false;}
        if(ready){this.pickTimers=[0,0];this.enter('collecting');}
      }else if(this.phase==='collecting'){
        const bag=this.bagStates.find(b=>b.state==='landed'||b.state==='lifting');
        const done=!bag;
        for(let i=0;i<2;i++){
          if(!bag){this.arms(i,'relaxed',0,dt);continue;}
          if(i!==bag.player){
            this.arms(i,'relaxed',0,dt);
            this.move(i,this.world(i===0?-CORNHOLE_WAIT.x:CORNHOLE_WAIT.x,0,this.end===0?-CORNHOLE_WAIT.z:CORNHOLE_WAIT.z),dt);
            continue;
          }
          // Approach the near edge even for a bag tucked under the hole.
          const side=Math.sign(bag.point.x)||(i===0?-1:1);
          const target=this.world(bag.point.x+side*.80*this.views[i].scale,0,bag.point.z);
          if(!this.move(i,target,dt)){this.arms(i,'relaxed',0,dt);continue;}
          this.faceBag(i,bag.point.x,bag.point.z);
          this.pickTimers[i]+=dt;
          const bagY=this.world(bag.point.x,bag.point.y,bag.point.z).y;
          this.reach(i,this.pickTimers[i],dt,(bagY-this.views[i].y)/this.views[i].scale);
          if(this.pickTimers[i]>=.54)bag.state='lifting';
          if(this.pickTimers[i]>=1){bag.state='carried';this.pickTimers[i]=0;}
        }
        if(done){if(this.winner!==null)this.enter('reacting');else {if(this.rules.throws.length===8)this.rules.nextRound();this.enter('returning');}}
      }else if(this.phase==='reacting'){
        const weight=Math.max(0,Math.min(1,this.clock/.45,(3.5-this.clock)/.45));
        for(let i=0;i<2;i++)this.arms(i,i===this.winner?'celebrate':'pout',weight,dt);
        if(this.clock>3.5)this.enter('meeting');
      }else if(this.phase==='meeting'){
        let ready=true;for(let i=0;i<2;i++){const p=this.world(i===0?-.42:.42,0,this.end===0?-3.05:3.05);if(!this.move(i,p,dt))ready=false;}
        if(ready)this.enter('handshake');
      }else if(this.phase==='handshake'){
        for(let i=0;i<2;i++){const v=this.views[i],o=this.views[1-i];this.people.writeActivityPose(this.claims[i],v.x,v.y,v.z,Math.atan2(v.x-o.x,v.z-o.z));this.arms(i,'handshake',1,dt);}
        if(this.clock>2){this.tidyTime=0;this.enter('tidying');}
      }else if(this.phase==='tidying'){
        let ready=true;
        const z=this.end===0?-4.2:4.2;
        for(let i=0;i<2;i++){
          const side=i===0?-1:1;
          if(!this.move(i,this.world(side*(.72+.80*this.views[i].scale),0,z),dt))ready=false;
        }
        if(ready)this.tidyTime+=dt;
        for(let i=0;i<2;i++){
          if(ready){
            this.faceBag(i,i===0?-.72:.72,z);
            this.reach(i,this.tidyTime,dt);
          }else this.arms(i,'relaxed',0,dt);
        }
        if(this.tidyTime>=.54){
          this.bagStates.forEach((bag,index)=>{
            if(bag.state==='stored')return;
            bag.state='stored';
            bag.mesh.position.set(bag.player===0?-.72:.72,.06+Math.floor(index/2)*.055,z);
          });
        }
        if(this.tidyTime>=1){this.finish('completed');return;}
      }
      for(const b of this.bagStates)if(b.state==='carried'||b.state==='lifting'){
        if(this.people.readActivityHand(this.claims[b.player],this.hand)){this.court.group.worldToLocal(this.hand);b.mesh.position.copy(this.hand);b.mesh.position.y+=Math.floor(this.bagStates.indexOf(b)/2)*.045;b.mesh.rotation.set(0,0,0);}
      }
    }catch(error){this.finish('failed');throw error;}
  }
  launch(i){
    const b=this.bagStates.find(b=>b.player===i&&b.state==='carried');if(!b)throw new Error('Missing cornhole bag.');
    const roll=this.rng();b.points=roll<.23?3:roll<.76?1:0;
    const z=this.end===0?4.2:-4.2,sign=this.end===0?1:-1,board=this.court.cornhole.boards?.[1-this.end],baseY=board?.group.position.y??0;
    if(b.points===3)b.point.set((this.rng()-.5)*.06,baseY+.055,z+sign*.40);
    else if(b.points===1){let along=(this.rng()-.5)*.65;const x=(this.rng()-.5)*.45;
      // Include the bag's half-diagonal, keeping one-point bags wholly clear
      // of the physical opening rather than merely keeping their centers out.
      if(Math.hypot(x,along-sign*.40)<.20)along=sign*.19;
      b.point.set(x,baseY+.21+along*sign*.177,z+along);}
    else {b.point.set((this.rng()<.5?-1:1)*(.48+this.rng()*.55),.055,z+(this.rng()-.5)*1.6);
      this.world(b.point.x,0,b.point.z,this.hand);this.hand.y=terrainHeight(this.hand.x,this.hand.z)+.025;this.court.group.worldToLocal(this.hand);b.point.y=this.hand.y;}
    b.origin.copy(b.mesh.position);b.state='flying';this.flying=b;this.enter('flying');
  }
  finish(reason='cancelled'){
    if(this.phase==='idle')return;
    const claims=this.claims,persons=this.persons;this.claims=[];this.persons=[];this.phase='idle';
    const errors=[];
    for(const claim of claims)try{this.people.requestActivityExit(claim,{cooldownUntil:this.now()+180});this.people.endPersonActivity(claim,{reason});}catch(e){errors.push(e);}
    // Interrupted players leave a physical court behind. Preserve landed bags,
    // and drop borrowed/flying bags vertically for the next pair to retrieve.
    if(reason!=='completed'&&this.isLive())try{
      for(const bag of this.bagStates)if(bag.state==='carried'||bag.state==='lifting'||bag.state==='flying'){
        this.world(bag.mesh.position.x,bag.mesh.position.y,bag.mesh.position.z,this.hand);
        this.hand.y=terrainHeight(this.hand.x,this.hand.z)+.025;
        this.court.group.worldToLocal(this.hand);bag.mesh.position.y=this.hand.y;
        bag.mesh.rotation.set(0,0,0);bag.mesh.visible=true;
      }
    }catch(e){errors.push(e);}
    this.bagStates=[];this.flying=null;this.onFinish(reason,persons);
    if(errors.length)throw new AggregateError(errors,'Cornhole cleanup failed.');
  }
  dispose(){if(this.disposed)return;this.finish('activity-removed');this.disposed=true;}
}
