import { ENGINE_WATER_HEIGHT, SUBMERSION_GRACE_SECONDS } from './vehicleTuning.js';
const LIGHT_CHAIRS=new Set(['chair','camp_chair','camp_loveseat']);
export function impactDamageFor(closingSpeed,kind='solid') {
  const damage=Math.max(0,closingSpeed-4)**2*.32;
  // Lightweight seating should dent the cart slightly, not count as a tree.
  return LIGHT_CHAIRS.has(kind)?Math.min(3,damage*.06):damage;
}
// Consequences consume solved impacts, never render-frame overlap or speed alone.
export class VehicleCondition {
  constructor() { this.damage=0;this.submersion=0;this.cause=null;this.impacts=new Map(); }
  impact(closingSpeed,time,key='chassis',kind='solid') {
    if(!Number.isFinite(closingSpeed)||closingSpeed<0||!Number.isFinite(time))throw new TypeError('Impact requires finite speed and time');
    if(this.cause||closingSpeed<=4)return 0;
    const previous=this.impacts.get(key);
    if(previous!==undefined&&time-previous<.75)return 0;
    for(const [id,last]of this.impacts)if(time-last>2)this.impacts.delete(id);
    if(this.impacts.size>=64)this.impacts.delete(this.impacts.keys().next().value);
    this.impacts.set(key,time);
    const added=Math.min(100-this.damage,impactDamageFor(closingSpeed,kind));
    this.damage+=added;
    if(this.damage>=100)this.cause='wrecked';
    return added;
  }
  step(dt,immersion=0) {
    if(!Number.isFinite(dt)||dt<0||!Number.isFinite(immersion))throw new TypeError('Condition requires finite time and immersion');
    if(!this.cause){
      // Brief splashes do not end a run; the engine must remain below water.
      this.submersion=immersion>=ENGINE_WATER_HEIGHT?this.submersion+dt:Math.max(0,this.submersion-dt*2);
      if(this.submersion>=SUBMERSION_GRACE_SECONDS)this.cause='submerged';
    }
    return this.cause;
  }
  restore(amount) {
    if(!Number.isFinite(amount)||amount<0)throw new TypeError('Restoration must be finite and nonnegative');
    if(!this.cause)this.damage=Math.max(0,this.damage-amount);
    return this.damage;
  }
  snapshot(){return {damage:this.damage,fraction:this.damage/100,submersion:this.submersion,cause:this.cause};}
}
