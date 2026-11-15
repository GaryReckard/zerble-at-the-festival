import * as THREE from 'three';
import {registry} from '../registry.js';
import {worldHash,mulberry32} from '../rng.js';
import {CornholeSession,cornholeEligible} from './cornholeSession.js';

export class CornholeActivity {
  constructor({people,runtime,maxCourts=2}){
    Object.assign(this,{people,runtime});this.maxCourts=Math.max(0,Math.min(2,maxCourts));this.group=new THREE.Group();this.group.name='CornholeActivities';this.slots=new Map();this.clock=0;this.scan=0;this.disposed=false;
    this.ownerToken=runtime.register({key:'cornhole',controller:this,schedule:[{slot:'roaming',run(dt,frame){this.update(dt,frame);}}]});
  }
  discover(){
    for(const [id,slot] of this.slots)if(registry.entries.get(id)!==slot.court){slot.session.dispose();this.slots.delete(id);}
    for(const id of registry.byKind.get('cornhole_game')??[]){
      if(this.slots.has(id))continue;const court=registry.entries.get(id);if(!court?.group||!court.cornhole)continue;
      const rng=mulberry32(worldHash(Math.round(court.position.x*10),Math.round(court.position.z*10),0x434f524e));
      const slot={court,rng,nextAvailable:this.clock+(rng()<.5?90+rng()*180:0),started:0,lastPlayers:[],recruitment:{nearby:0,eligible:0,reachable:0,eligibleWithin60:0}};
      slot.session=new CornholeSession({people:this.people,court,rng,now:()=>this.clock,isLive:()=>registry.entries.get(id)===court,
        onFinish:(reason,persons)=>{slot.lastPlayers=persons;const duration=this.clock-slot.started;slot.nextAvailable=this.clock+(reason==='completed'?Math.max(90,Math.min(600,duration*(.65+rng()*.4))):45+rng()*45);}});
      this.slots.set(id,slot);
    }
  }
  update(dt,frame={}){
    if(this.disposed)return;
    // Unload cleanup still runs while people are frozen.
    this.discover();if(frame.npcsFrozen)return;this.clock+=dt;this.scan-=dt;
    const cart=frame.zerble;
    for(const slot of this.slots.values()){
      const s=slot.session;if(s.phase==='idle')continue;
      if(cart&&Math.hypot(cart.position.x-slot.court.position.x,cart.position.z-slot.court.position.z)<9){s.finish('cart-nearby');continue;}
      s.update(dt);
    }
    if(this.scan>0)return;this.scan=4;
    let active=[...this.slots.values()].filter(s=>s.session.phase!=='idle').length;
    // Rotating selection starts from a local seeded rank, independent of other AI.
    const available=[...this.slots.values()].filter(s=>s.session.phase==='idle'&&s.nextAvailable<=this.clock).map(slot=>({slot,rank:slot.rng()})).sort((a,b)=>a.rank-b.rank);
    for(const {slot} of available){
      if(active>=this.maxCourts)break;const {court}=slot;
      const distance=cart?Math.hypot(cart.position.x-court.position.x,cart.position.z-court.position.z):40;
      if(distance<14||distance>100)continue;
      // A whole clear court stands outside occupied camp footprints, so recruit
      // from the surrounding commons rather than only its empty immediate rim.
      const candidates=[];
      const recruitment=slot.recruitment;for(const key of Object.keys(recruitment))recruitment[key]=0;
      this.people.forEachPersonNear(court.position.x,court.position.z,60,(handle,v,d)=>{
        const eligible=cornholeEligible(v)&&this.people.activityCooldown(handle,'cornhole')<=this.clock;
        if(eligible)recruitment.eligibleWithin60++;
        recruitment.nearby++;if(eligible)recruitment.eligible++;
        if(eligible&&(!this.people.canReachPlace||this.people.canReachPlace(handle,court.position))){recruitment.reachable++;candidates.push({handle,rank:slot.rng()+d/120+(slot.lastPlayers.includes(handle)?2:0)});}
      });
      candidates.sort((a,b)=>a.rank-b.rank);
      if(candidates.length>=2){slot.started=this.clock;if(slot.session.start(candidates[0].handle,candidates[1].handle))active++;}
    }
  }
  inspect(out={}){out.active=0;out.vacant=0;out.sessions=[];for(const slot of this.slots.values()){const s=slot.session;if(s.phase==='idle')out.vacant++;else out.active++;out.sessions.push({courtId:slot.court.id,phase:s.phase,score:[...s.score],round:s.round,winner:s.winner,nextAvailable:slot.nextAvailable,cooldown:Math.max(0,slot.nextAvailable-this.clock),recruitment:{...slot.recruitment}});}out.disposed=this.disposed;return out;}
  dispose(){if(this.disposed)return;this.disposed=true;const errors=[];if(this.runtime.isRegistered(this.ownerToken))try{this.runtime.unregister(this.ownerToken,'activity-disposed');}catch(e){errors.push(e);}for(const slot of this.slots.values())try{slot.session.dispose();}catch(e){errors.push(e);}this.slots.clear();this.group.removeFromParent();if(errors.length)throw new AggregateError(errors,'Cornhole disposal failed.');}
}
