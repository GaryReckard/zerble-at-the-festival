const WALK_ANGLES = [0,.6,-.6,1.2,-1.2];

// Crowd owns each person throughout the class, walk-out, arrival and dance.
// The tent temporarily supplies their articulated render rig, never a second NPC.
export class HealingArtsActivity {
  constructor(group, crowd, rng, canWalk = () => true) {
    this.scratch = group.position.clone(); this.time = 0;
    this.group = group; this.crowd = crowd; this.rng = rng; this.canWalk = canWalk;
    this.u = group.userData.healingArts; this.u.managed = true;
    this.slots = this.u.participants.filter(p => !p.dj).map(p => ({p,npc:null,role:null}));
    this.visitors = new Set(); this.phase = 'day'; this.clock = 0; this.next = 0;
    this.nextArrival = 0; this.lastNightness = 0; this.initialized = false;
    this.c = Math.cos(group.rotation.y); this.s = Math.sin(group.rotation.y);
    for (const slot of this.slots) this.addYoga(slot);
  }
  point(x,z) {
    const p = this.scratch.copy(this.group.position);
    p.x += x*this.c+z*this.s; p.z += -x*this.s+z*this.c; p.y=0;
    return p;
  }
  adopt(slot,npc,role) {
    slot.npc=npc; slot.role=role;
    npc.festivalVisit={owner:this,hidden:role==='yoga',slot,stage:0,wait:0};
    this.visitors.add(npc); npc.state='idle'; npc.vel.set(0,0,0);
    slot.p.shirt=npc.appearance.shirt; slot.p.skin=npc.appearance.skin;
    slot.p.activity=role==='yoga'?'yoga':'hidden';
  }
  addYoga(slot) {
    if(slot.npc)return;
    const npc=this.crowd.spawn({pos:this.point(slot.p.x,slot.p.z),chunkKey:null,rng:this.rng,
      allowPhotographer:false,appearanceOverride:{shirt:slot.p.shirt,skin:slot.p.skin}});
    if(npc)this.adopt(slot,npc,'yoga');
    else {
      const regular=this.crowd.npcs.find(n=>!n.festivalVisit&&!n.party&&!n.isPhotographer&&
        (n.healingCooldownUntil||0)<=this.time&&['idle','walking','watching'].includes(n.state)&&
        Math.hypot(n.pos.x-this.group.position.x,n.pos.z-this.group.position.z)<55);
      if(regular)this.adopt(slot,regular,'yoga_entering');else slot.p.activity='hidden';
    }
  }
  releaseNpc(npc) {
    if(!npc)return;
    const visit=npc.festivalVisit;
    if(!visit || visit.owner!==this)return;
    if(visit.slot){visit.slot.p.activity='hidden';visit.slot.npc=null;visit.slot.role=null;}
    npc.festivalVisit=null; npc.healingCooldownUntil=this.time+60; this.visitors.delete(npc);
    if(npc.state!=='fleeing') {
      npc.state='walking'; npc.stateTimer=12;
      npc.target.copy(this.point((npc.idx%2?1:-1)*17,19));npc.vel.set(0,0,0);
    }
    this.crowd._writeMatrices(npc);
  }
  leave(slot) {
    const npc=slot.npc;if(!npc)return;
    const p=slot.p;
    if(slot.role==='yoga'||slot.role==='dance') npc.pos.copy(this.point(p.currentX??p.x,p.currentZ??p.z));
    npc.festivalVisit.hidden=false; npc.festivalVisit.stage=0; npc.festivalVisit.wait=0;
    slot.role='leaving';p.activity='hidden';
  }
  move(npc,target,dt) {
    const dx=target.x-npc.pos.x,dz=target.z-npc.pos.z,d=Math.hypot(dx,dz);
    if(d<.45)return true;
    const step=Math.min(d,dt*1.45);
    // A blocked direct route tries stable shoulders, then yields rather than
    // walking through a pole, another person, or an intervening building.
    for(const angle of WALK_ANGLES) {
      const ca=Math.cos(angle),sa=Math.sin(angle);
      const vx=(dx*ca-dz*sa)/d,vz=(dx*sa+dz*ca)/d;
      const x=npc.pos.x+vx*step,z=npc.pos.z+vz*step;
      if(!this.canWalk(x,z,npc))continue;
      let blocked=false;
      for(const other of this.crowd.npcs) {
        if(other===npc)continue;
        if(Math.hypot(x-other.pos.x,z-other.pos.z)<.75){blocked=true;break;}
      }
      if(blocked)continue;
      npc.pos.x=x;npc.pos.z=z;npc.yaw=Math.atan2(-vx,-vz);npc.bob+=dt*5;
      return false;
    }
    return false;
  }
  update(dt,time,nightness) {
    this.clock+=dt; this.time=time;
    if(!this.initialized){
      this.initialized=true;
      if(nightness>.5){for(const slot of this.slots)this.releaseNpc(slot.npc);this.phase='night';}
    }
    const falling=nightness<this.lastNightness-.00001;
    if(this.phase==='day' && nightness>.18){this.phase='dusk';this.next=this.clock;}
    if((this.phase==='night'||this.phase==='dusk') && falling && nightness<.45){this.phase='dawn';this.next=this.clock;}
    if(this.phase==='dusk' && this.clock>=this.next){
      const slot=this.slots.find(s=>s.role==='yoga'||s.role==='yoga_entering');
      if(slot)this.leave(slot);
      this.next=this.clock+.9;
      if(!this.slots.some(s=>s.role==='yoga'||s.role==='yoga_entering')&&nightness>.5)this.phase='night';
    }
    if(this.phase==='dawn' && this.clock>=this.next){
      const slot=this.slots.find(s=>s.role==='dance'||s.role==='entering');
      if(slot)this.leave(slot);
      this.next=this.clock+.8;
      if(!this.slots.some(s=>s.role==='dance'||s.role==='entering')&&nightness<.05)this.phase='day';
    }
    if(this.phase==='day' && this.clock>=this.next){
      const slot=this.slots.find(s=>!s.npc);if(slot)this.addYoga(slot);this.next=this.clock+1.3;
    }
    if((this.phase==='night'||this.phase==='dusk')&&nightness>.5&&this.clock>=this.nextArrival){
      const slot=this.slots.find(s=>!s.npc);
      if(slot){
        let best=null,dist=55;
        for(const npc of this.crowd.npcs){
          if((npc.healingCooldownUntil||0)>time||npc.festivalVisit||npc.party||npc.isPhotographer||!['idle','walking','watching'].includes(npc.state))continue;
          const d=Math.hypot(npc.pos.x-this.group.position.x,npc.pos.z-this.group.position.z);
          if(d<dist){best=npc;dist=d;}
        }
        if(best)this.adopt(slot,best,'entering');
      }
      this.nextArrival=this.clock+1.7;
    }
    for(const slot of this.slots){
      const npc=slot.npc;if(!npc)continue;
      if(!this.crowd.npcs.includes(npc)){this.visitors.delete(npc);slot.npc=null;slot.role=null;slot.p.activity='hidden';continue;}
      const visit=npc.festivalVisit;
      if(!visit||visit.owner!==this){slot.npc=null;slot.role=null;slot.p.activity='hidden';continue;}
      if(npc.state==='fleeing'){this.releaseNpc(npc);continue;}
      if(slot.role==='yoga'||slot.role==='dance'){
        npc.pos.copy(this.point(slot.p.currentX??slot.p.x,slot.p.currentZ??slot.p.z));
        continue;
      }
      visit.wait+=dt;
      const target=slot.role==='yoga_entering'?this.point(slot.p.x,slot.p.z):slot.role==='entering'?this.point((npc.idx%2?1:-1)*1.5,6.1):this.point((npc.idx%2?1:-1)*3,16);
      if(this.move(npc,target,dt)){
        if(slot.role==='yoga_entering'){slot.role='yoga';slot.p.activity='yoga';visit.hidden=true;}
        else if(slot.role==='entering'){
          slot.role='dance';slot.p.activity='dance';visit.hidden=true;
          slot.p.entryX=(npc.pos.x-this.group.position.x)*this.c-(npc.pos.z-this.group.position.z)*this.s;
          slot.p.entryZ=(npc.pos.x-this.group.position.x)*this.s+(npc.pos.z-this.group.position.z)*this.c;
          slot.p.entryTime=time;
        }else this.releaseNpc(npc);
      }else if(visit.wait>45)this.releaseNpc(npc);
    }
    this.lastNightness=nightness;
  }
  dispose(){for(const npc of [...this.visitors])this.releaseNpc(npc);this.u.managed=false;}
}
