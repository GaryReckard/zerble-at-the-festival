// Two deliberately different resource layouts behind the same visit contract.
// These demonstrate adapters; they do not change live stage or market policy.
export class SlotPlace {
  constructor({x=2,z=0,capacity=2,onEnter=()=>{},onLeave=()=>{},onRelease=()=>{}}={}) {
    this.x=x;this.z=z;this.slots=Array(capacity).fill(null);this.active=true;
    this.onEnter=onEnter;this.onLeave=onLeave;this.onRelease=onRelease;
  }
  reserve(person,attempt) {
    if(!this.active)return null;
    const slot=this.slots.indexOf(null);if(slot<0)return null;
    const reservation={person,slot};this.slots[slot]=reservation;
    attempt.own(()=>{if(this.slots[slot]===reservation){this.slots[slot]=null;this.onRelease(reservation);}});
    return reservation;
  }
  isLive(reservation){return this.active&&this.slots[reservation.slot]===reservation;}
  readTarget(reservation,phase,out){if(!this.isLive(reservation))return false;Object.assign(out,{x:this.x+reservation.slot,y:0,z:this.z+(phase==='leaving'?2:0)});return true;}
  canApproach(reservation){return this.isLive(reservation);}
  enter(reservation){this.onEnter(reservation);}
  leave(reservation){this.onLeave(reservation); }
  unload(){this.active=false;}
}
export class CounterPlace {
  constructor({x=-2,z=0,onEnter=()=>{},onLeave=()=>{},onRelease=()=>{}}={}) {
    this.x=x;this.z=z;this.epoch=1;this.customer=null;this.active=true;
    this.onEnter=onEnter;this.onLeave=onLeave;this.onRelease=onRelease;
  }
  reserve(person,attempt) {
    if(!this.active||this.customer)return null;
    const reservation={person,epoch:this.epoch};this.customer=reservation;
    attempt.own(()=>{if(this.customer===reservation){this.customer=null;this.onRelease(reservation);}});
    return reservation;
  }
  isLive(reservation){return this.active&&reservation.epoch===this.epoch&&this.customer===reservation;}
  readTarget(reservation,phase,out){if(!this.isLive(reservation))return false;Object.assign(out,{x:this.x,y:0,z:this.z+(phase==='leaving'?3:0)});return true;}
  canApproach(reservation){return this.isLive(reservation);}
  enter(reservation){this.onEnter(reservation);}
  leave(reservation){this.onLeave(reservation); }
  unload(){this.active=false;this.epoch++;}
}
