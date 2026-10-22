import {sampleWagonRoute} from './nutWagonRoute.js';

export const ONE_WHEEL_TUNING = Object.freeze({
  speed:3, acceleration:1.6, braking:4.5, turnSpeed:1.8,
  radius:.75, blockedSeconds:3, endpointPause:2.5, gatheringPause:7,
  encounterChance:.22, encounterCell:160, spawnMin:38, spawnMax:115,
  despawnDistance:210, maxRiders:2,
});
const T=ONE_WHEEL_TUNING, STEP=1/60;
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

// Fixed simulation steps keep encounters independent of render frame delivery.
// Position is committed only after clearance checks, including every substep.
export class OneWheelMotion {
  constructor(route,distance=0,direction=1) {
    if(!route || route.length<8)throw new Error('One-wheel route is too short');
    this.route=route;this.distance=Math.max(0,Math.min(route.length,distance));
    this.direction=direction<0?-1:1;this.sample={};this.next={};
    sampleWagonRoute(route,this.distance,this.sample);
    this.x=this.sample.x;this.z=this.sample.z;
    this.heading=this.sample.heading+(this.direction<0?Math.PI:0);
    this.speed=0;this.acceleration=0;this.turnRate=0;
    this.state='cruising';this.waitReason=null;this.pause=0;this.blocked=0;
    this.travelSinceStop=0;this.gatherCheck=0;this.remainder=0;this.time=0;
  }
  update(dt,environment) {
    if(!Number.isFinite(dt)||dt<=0)return;
    this.remainder+=Math.min(dt,.25);
    while(this.remainder+1e-10>=STEP){this.step(STEP,environment);this.remainder-=STEP;}
  }
  step(dt,env) {
    this.time+=dt;this.turnRate=0;this.acceleration=0;this.waitReason=null;
    if(this.pause>0){
      this.pause=Math.max(0,this.pause-dt);this.speed=0;this.state='paused';
      this.waitReason='taking a break';return;
    }
    const end=this.direction>0?this.distance>=this.route.length-.01:this.distance<=.01;
    if(end){this.direction*=-1;this.pause=T.endpointPause;this.speed=0;this.state='paused';return;}
    const probeDistance=Math.max(0,Math.min(this.route.length,this.distance+this.direction*.3));
    sampleWagonRoute(this.route,probeDistance,this.next);
    const targetHeading=this.next.heading+(this.direction<0?Math.PI:0);
    const delta=angleDelta(targetHeading,this.heading);
    const turn=Math.max(-T.turnSpeed*dt,Math.min(T.turnSpeed*dt,delta));
    this.heading+=turn;this.turnRate=turn/dt;
    if(Math.abs(delta)>.3){this.speed=0;this.state='turning';this.blocked=0;return;}
    const yieldReason=env.yieldAhead?.(this.x,this.z,this.heading,T.speed);
    const oldSpeed=this.speed;
    if(yieldReason){
      this.speed=Math.max(0,this.speed-T.braking*dt);
      this.state='yielding';this.waitReason=yieldReason;this.blocked=0;
      if(this.speed===0){this.acceleration=-oldSpeed/dt;return;}
    }
    if(!yieldReason)this.speed=Math.min(T.speed,this.speed+T.acceleration*dt);
    const nextDistance=Math.max(0,Math.min(this.route.length,this.distance+this.direction*this.speed*dt));
    sampleWagonRoute(this.route,nextDistance,this.next);
    if(!env.clear(this.next.x,this.next.z)){
      this.speed=0;this.state='blocked';this.waitReason='blocked path';this.blocked+=dt;
      if(this.blocked>=T.blockedSeconds){this.direction*=-1;this.pause=1;this.blocked=0;}
    }else{
      const travel=Math.hypot(this.next.x-this.x,this.next.z-this.z);
      this.x=this.next.x;this.z=this.next.z;this.distance=nextDistance;
      this.travelSinceStop+=travel;this.blocked=0;this.state=yieldReason?'yielding':'cruising';
      this.gatherCheck-=dt;
      if(this.gatherCheck<=0){
        this.gatherCheck=1;
        if(!yieldReason&&this.travelSinceStop>24&&env.gathering?.(this.x,this.z)){
          this.pause=T.gatheringPause;this.speed=0;this.travelSinceStop=0;this.state='paused';
        }
      }
    }
    this.acceleration=Math.max(-T.braking,Math.min(T.acceleration,(this.speed-oldSpeed)/dt));
  }
}

// Test both the current pedestrian position and a short velocity prediction.
// The envelope grows with speed so ordinary approaches stop before contact.
export function riderYieldReason(x,z,heading,speed,player,pedestrians) {
  const fx=Math.sin(heading),fz=Math.cos(heading),look=2.2+speed*.8;
  const threatens=(px,pz,radius)=>{
    const dx=px-x,dz=pz-z,along=dx*fx+dz*fz,side=Math.abs(dx*fz-dz*fx);
    return Math.hypot(dx,dz)<radius || (along>0&&along<look+radius&&side<radius);
  };
  if(player&&threatens(player.x,player.z,2.4))return 'yielding to Zerble';
  for(const n of pedestrians||[]){
    if(n.state==='riding'||n.state==='hammock_riding'||n.state==='table_seated')continue;
    if(threatens(n.pos.x,n.pos.z,1.35)||threatens(n.pos.x+(n.vel?.x||0)*.7,n.pos.z+(n.vel?.z||0)*.7,1.35))return 'yielding to pedestrians';
  }
  return null;
}
