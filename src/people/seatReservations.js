// Vehicle slots remain vehicle-owned. A reservation ties one resource incarnation
// to one person lifetime, so an old release cannot clear its replacement.
const owners=new WeakMap();
export class SeatReservations {
  constructor(people){this.people=people;this.states=new Map();this.byPerson=new Map();this.closing=false;}
  #eligible({person,vehicle,slot,allowPermanent=false}){
    return !this.closing&&this.people.isLive(person)&&!this.byPerson.has(person)
      &&!!slot&&vehicle?.seatSlots?.includes(slot)&&vehicle.active!==false
      &&!slot.occupied&&!owners.has(slot)&&(!slot.permanent||allowPermanent===true);
  }
  reserve(request){return this.reserveMany([request])?.[0]??null;}
  reserveMany(requests){
    if(!requests.length||new Set(requests.map(r=>r.person)).size!==requests.length
      ||new Set(requests.map(r=>r.slot)).size!==requests.length||requests.some(r=>!this.#eligible(r)))return null;
    const tokens=requests.map(({person,vehicle,slot})=>Object.freeze({person,vehicle,slot}));
    for(const token of tokens){this.states.set(token,token);this.byPerson.set(token.person,token);owners.set(token.slot,token);token.slot.occupied=true;}
    return tokens;
  }
  isLive(token){return this.states.has(token)&&owners.get(token.slot)===token&&this.people.isLive(token.person)
    &&token.vehicle.active!==false&&token.vehicle.seatSlots?.includes(token.slot)&&token.slot.occupied;}
  readTarget(token,out){if(!this.isLive(token))return false;token.vehicle.worldSeatPosition(token.slot,out);return true;}
  release(token){
    if(!this.states.delete(token))return false;
    if(this.byPerson.get(token.person)===token)this.byPerson.delete(token.person);
    if(owners.get(token.slot)===token){owners.delete(token.slot);token.slot.occupied=false;}
    return true;
  }
  releasePerson(person){const token=this.byPerson.get(person);return token?this.release(token):false;}
  releaseVehicle(vehicle){for(const token of this.states.keys())if(token.vehicle===vehicle)this.release(token);}
  dispose(){if(this.closing)return;this.closing=true;for(const token of this.states.keys())this.release(token);}
}
