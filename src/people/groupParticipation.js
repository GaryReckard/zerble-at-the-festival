import {sampleWalkMotion} from '../personMotion.js';
// Population-internal adapter for shared travel intent. Groups hold handles and
// proposals; only this boundary touches the population's records and bindings.
import {terrainHeight} from '../worldgen/terrain.js';
const AMBIENT=new Set(['idle','walking','watching','approaching']);

export class GroupParticipation {
  #crowd;#owner;#closed=false;#reservation=null;
  constructor(crowd,owner,root){
    this.#crowd=crowd;this.#owner=owner;this.root=root;
    crowd.parties.add(owner);crowd.group.add(root);
  }
  get capacity(){return this.#closed||this.#crowd._disposed?0:this.#crowd.free.length;}
  get bubblesEmpty(){return this.#crowd.bubblesEmpty;}
  #record(handle){const n=this.#crowd.peopleHandles.resolve(handle);return n?.party===this.#owner?n:null;}
  read(handle,out){
    const n=this.#record(handle);if(!n)return false;
    this.#crowd.readPerson(handle,out);out.seated=!!n.seatSlot;return true;
  }
  spawn(options){
    if(this.#closed)return null;
    const n=this.#crowd.spawn(options);if(!n)return null;
    if(n.groupId){const old=this.#crowd.groups.get(n.groupId);if(old){old.members=old.members.filter(id=>id!==n.idx);if(!old.members.length)this.#crowd.groups.delete(n.groupId);}}
    n.groupId=null;n.party=this.#owner;return n.personHandle;
  }
  bind(handle,profile,binding){
    const n=this.#record(handle);
    if(this.#closed||!n||n._groupBinding)return false;
    for(const key of ['scale','energy','curiosity','skittish','dance'])if(!Number.isFinite(profile[key]))throw new TypeError('Group spawn profile must be finite.');
    if(typeof binding.publish!=='function'||typeof binding.hide!=='function'||typeof binding.release!=='function')throw new TypeError('Group binding requires publication and lifecycle hooks.');
    for(const key of ['scale','energy','curiosity','skittish','dance'])n[key]=profile[key];
    const ownedBinding={...binding,release:()=>{this.#releaseSeat(handle);binding.release();}};
    n._groupBinding={owner:this.#owner,binding:ownedBinding,pose:{}};
    this.#crowd._publishPerson(n);return true;
  }
  proposeWalk(handle,x,y,z){
    const n=this.#record(handle);
    if(this.#closed||!n||!AMBIENT.has(n.state)||this.#crowd.activityClaims.current.has(handle))return false;
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))throw new TypeError('Group destination must be finite.');
    const distance=(n.pos.x-x)**2+(n.pos.y-y)**2+(n.pos.z-z)**2;
    if(distance>2.2*2.2){n.target.set(x,y,z);n.state='walking';n.stateTimer=30;}
    else if(n.state==='walking'){n.state='idle';n.stateTimer=3;}
    return true;
  }
  reserve(handles,vehicle,slots){
    if(this.#closed||this.#reservation||handles.length!==slots.length||handles.length<4||new Set(handles).size!==handles.length||new Set(slots).size!==slots.length)return null;
    const records=handles.map(h=>this.#record(h));
    if(records.some((n,i)=>!n||!AMBIENT.has(n.state)||n.seatSlot||this.#crowd.activityClaims.current.has(handles[i])))return null;
    const reservations=this.#crowd.seatReservations.reserveMany(handles.map((person,i)=>({person,vehicle,slot:slots[i]})));
    if(!reservations)return null;
    const token=Object.freeze({owner:this.#owner,vehicle});
    this.#reservation={token,entries:handles.map((handle,i)=>({handle,slot:slots[i],reservation:reservations[i]}))};
    records.forEach((n,i)=>{n.seatSlot=slots[i];n._seatReservation=reservations[i];n._groupSeatReservation=token;n.state='boarding';n.stateTimer=22;n.rideTimer=Infinity;});
    return token;
  }
  hasSeat(handle,token){
    if(!this.#reservation||this.#reservation.token!==token)return false;
    const entry=this.#reservation.entries.find(e=>e.handle===handle),n=this.#record(handle);
    return !!entry&&!!n&&n.seatSlot===entry.slot&&n._seatReservation===entry.reservation&&this.#crowd.seatReservations.isLive(entry.reservation);
  }
  completeBoarding(token,notify){
    const reservation=this.#reservation;
    if(this.#closed||!reservation||reservation.token!==token||reservation.entries.some(e=>!this.hasSeat(e.handle,token)))return false;
    for(const {handle} of reservation.entries){const n=this.#record(handle);if(!n)continue;n.state='riding';n.rideTimer=Infinity;if(notify)this.#crowd.onBoard?.(n);}
    return true;
  }
  #releaseSeat(handle){
    const reservation=this.#reservation,entry=reservation?.entries.find(e=>e.handle===handle);
    if(entry)this.#crowd.seatReservations.release(entry.reservation);
  }
  cancelReservation(token){
    if(!this.#reservation||this.#reservation.token!==token)return false;
    for(const entry of this.#reservation.entries)this.#releaseSeat(entry.handle);
    this.#reservation=null;return true;
  }
  leave(token,members,center){
    if(this.#closed||!this.#reservation||this.#reservation.token!==token)return false;
    const reservation=this.#reservation;this.#reservation=null;
    for(const entry of reservation.entries)this.#crowd.seatReservations.release(entry.reservation);
    for(const member of members){const n=this.#record(member.handle),entry=reservation.entries.find(e=>e.handle===member.handle);
      if(!n||!entry||(n.seatSlot&&n.seatSlot!==entry.slot)||this.#crowd.activityClaims.current.has(member.handle))continue;
      n.seatSlot=null;n._seatReservation=null;n._groupSeatReservation=null;n.seatY=undefined;n.rideTimer=undefined;
      n.target.copy(center).add(member.offset);n.state='walking';n.stateTimer=12;
    }
    return true;
  }
  remove(handle){
    // Owner teardown has already stopped runtime dispatch, but its retiring
    // records must still be released before the group's display root disappears.
    const people=this.#crowd.peopleHandles,n=people.owns(handle)?people.entries.get(handle.slot).record:null;
    if(n?.party!==this.#owner||n._removing)return false;
    this.#crowd.removeNpc(n);return true;
  }
  close(){this.#closed=true;}
  dispose(){
    this.#closed=true;
    this.cancelReservation(this.#reservation?.token);
    this.#crowd.parties.delete(this.#owner);this.root.removeFromParent();
  }
}

// Called only by the population's publication/removal barriers. The group sees
// a copied display pose, never the mutable person, seat, camp or activity record.
export function publishGroupBinding(npc){
  const state=npc._groupBinding;if(!state)return;
  const riding=npc.state==='riding',sitting=(riding&&npc.seatSlot?.kind!=='standing')||npc.state==='table_seated'||npc.pottySitting;
  const groundY=npc.state==='hammock_riding'&&npc.hammockY!=null?npc.hammockY:npc.state==='camp_seated'&&npc.campY!==undefined?npc.campY:terrainHeight(npc.pos.x,npc.pos.z);
  const p=state.pose;
  const walk=sampleWalkMotion(npc,state.walk??={});
  p.stride=walk.stride;p.arm=walk.arm;
  p.visible=npc.state!=='using_potty'&&npc.state!=='camp_sleeping'&&!npc._activityBinding?.hidden;
  p.x=npc.pos.x;p.y=sitting&&npc.seatY!=null?npc.seatY-.62*npc.scale:riding&&npc.seatY!=null?npc.seatY-(npc.seatSlot?.vehicle?0:1.05):groundY;p.z=npc.pos.z;
  p.heading=npc.yaw;p.scale=npc.scale;p.bob=npc.bob;p.speed=riding?0:Math.hypot(npc.vel.x,npc.vel.z);p.sitting=!!sitting;p.pole=riding&&npc.seatSlot?.name==='platform';
  state.binding.publish(p);
}
export function hideGroupBinding(npc){npc._groupBinding?.binding.hide();}
export function releaseGroupBinding(npc,handle){
  const state=npc._groupBinding;npc._groupBinding=null;
  if(!state)return;
  try{state.binding.release();}finally{state.owner.memberRemoved(handle);}
}
