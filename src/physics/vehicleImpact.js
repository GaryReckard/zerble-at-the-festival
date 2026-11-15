import { impactDamageFor } from '../vehicleCondition.js';

export const MIN_DAMAGE_AIRTIME=.5;
// Wheels can touch before the chassis bottoms out. Keep both in one touchdown
// episode without making a later, ordinary grounded bump a landing.
export const LANDING_EPISODE_SECONDS=.25;
export function landingNormalSpeed(velocity,wheels) {
  let x=0,y=0,z=0;
  for(const wheel of wheels)if(wheel.contact&&wheel.normal){x+=wheel.normal.x;y+=wheel.normal.y;z+=wheel.normal.z;}
  const length=Math.hypot(x,y,z);
  return length?Math.max(0,-(velocity.x*x+velocity.y*y+velocity.z*z)/length):0;
}
export function selectVehicleImpact({state,before,events,step,cartId='live-cart',isSupport=()=>false,bodyKind=()=> 'solid'}) {
  const seriousFlight=state.landingAirTime>=MIN_DAMAGE_AIRTIME;
  let severity=seriousFlight?state.landingSpeed:0,kind='landing',damage=impactDamageFor(severity,kind);
  for(const event of events){
    if(event.type!=='contact-force'||event.a!==cartId&&event.b!==cartId)continue;
    const bodyId=event.a===cartId?event.b:event.a,direction=event.maxForceDirection,v=before.linearVelocity;
    const incoming=Math.abs(v.x*direction.x+v.y*direction.y+v.z*direction.z);
    const closing=Math.min(incoming,event.totalForceMagnitude*step/before.mass);
    // Only upward-facing terrain/deck impacts are landings. Cliff faces and
    // obstacles still hurt, including when the cart happens to be airborne.
    const support=isSupport(bodyId)&&Math.abs(direction.y)>=.55;
    const candidateKind=support?'landing':bodyKind(bodyId);
    const candidate= support&&!seriousFlight?0:impactDamageFor(closing,candidateKind);
    if(candidate>damage){severity=closing;kind=candidateKind;damage=candidate;}
  }
  return {severity,kind,damage};
}
