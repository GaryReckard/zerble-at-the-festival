import { ENGINE_WATER_HEIGHT } from '../vehicleTuning.js';
// One dynamic chassis is authoritative on the ground and in the air. This owner
// consumes the live world's clock; it never reads an interpolated render pose.
export const VEHICLE_SURFACES = Object.freeze({
  asphalt:Object.freeze({grip:3.4,side:1,drag:.45,speed:1}),
  bridge:Object.freeze({grip:3,side:.95,drag:.55,speed:.96}),
  dirt:Object.freeze({grip:2.5,side:.85,drag:.8,speed:.95}),
  grass:Object.freeze({grip:1.8,side:.7,drag:1.15,speed:.88}),
  riverbed:Object.freeze({grip:1.25,side:.6,drag:1.5,speed:.75}),
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const identity=()=>({x:0,y:0,z:0,w:1});
const length=v=>Math.hypot(v.x,v.y,v.z);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
function rotated(v,q,out={}){
  const tx=2*(q.y*v.z-q.z*v.y),ty=2*(q.z*v.x-q.x*v.z),tz=2*(q.x*v.y-q.y*v.x);
  out.x=v.x+q.w*tx+q.y*tz-q.z*ty;out.y=v.y+q.w*ty+q.z*tx-q.x*tz;out.z=v.z+q.w*tz+q.x*ty-q.y*tx;return out;
}
const poseOf=cart=>({position:{x:cart.position.x,y:cart.position.y,z:cart.position.z},rotation:{x:cart.root.quaternion.x,y:cart.root.quaternion.y,z:cart.root.quaternion.z,w:cart.root.quaternion.w}});
const copyVector=(out,v)=>out?.copy?out.copy(v):Object.assign(out||{},v);
const WHEELS=Object.freeze([{x:-1.45,z:-1.5,front:true},{x:1.45,z:-1.5,front:true},{x:-1.6,z:1.4,front:false},{x:1.6,z:1.4,front:false}]);

export function createPlayerVehicle({adapter,cart,id='live-cart',sampleSurface=(_x,_z,out={})=>Object.assign(out,{surfaceClass:'grass'}),sampleWater=(_x,_z,out={})=>Object.assign(out,{wet:false,depth:0}),canRecover=()=>false}={}){
  if(!adapter?.addVehicle||!cart?.position||!cart.root)throw new TypeError('Physical player requires adapter and cart');
  const existing=adapter.readBody(id);
  if(existing)throw new Error(`Player body already exists: ${id}`);
  const radius=cart._tireR||.62,mass=320;
  const body=adapter.addBody({id,type:'dynamic',pose:poseOf(cart),ccd:true,canSleep:false,angularDamping:1.1,
    colliders:[{shape:'cuboid',halfExtents:{x:1.48,y:.42,z:2.14},position:{x:0,y:.78,z:-.17},mass:mass-5,friction:.3,restitution:.03,forceEvents:true,forceThreshold:600,vehicleSupport:false},
      {shape:'cuboid',halfExtents:{x:1.7,y:.125,z:1.2},position:{x:0,y:3.75,z:-.6},mass:5,friction:.3,restitution:.02,forceEvents:true,forceThreshold:600,vehicleSupport:false}]});
  if(!body.ok)throw new Error(`Physical player admission failed: ${body.reason}`);
  const rest=.65,stiffness=30,hardY=rest+radius-9.81/(4*stiffness);
  const result=adapter.addVehicle({id:`${id}:vehicle`,bodyId:id,bodyGeneration:body.generation,
    wheels:WHEELS.map(w=>({position:{x:w.x,y:hardY,z:w.z},radius,restLength:rest,stiffness,compression:4.4,relaxation:3.2,travel:.35,maxForce:12000}))});
  if(!result.ok){adapter.removeBody(id);throw new Error(`Player controller admission failed: ${result.reason}`);}
  const token=result.token;
  let enabled=true,disposed=false,contacts=0,steering=0,surface='grass',airTime=0,recoveryTime=0,recoveries=0,resetCount=0,lastReset='restart';
  let impactSpeed=0,landingSpeed=0,impactNormal={x:0,y:0,z:0},expectedVelocity={x:0,y:0,z:0},previousVelocity={x:0,y:0,z:0};
  let lastInput={throttle:0,boost:false},water={wet:false,depth:0,surfaceY:0},immersion=0;
  const forward={},up={},sample={},wetSample={},normal={},wheelControls=WHEELS.map(()=>({engineForce:0,brake:0,steering:0,frictionSlip:2.5,sideFrictionStiffness:1}));
  const engine={throttle:0,load:0,revs:0,wet:0,submersion:0,running:true,grounded:false,boost:false};
  cart.velocity=cart.velocity||{x:0,y:0,z:0};cart.engineState=engine;cart.grounded=false;
  let solved=adapter.readBody(id),wheelState=adapter.readVehicle(token),previousPose=solved.pose,renderPose=null;
  const renderQuaternion=cart.root.quaternion.clone?.();
  function readWater(position){
    wetSample.wet=false;wetSample.depth=0;wetSample.height=0;wetSample.surfaceY=undefined;
    sampleWater(position.x,position.z,wetSample);
    const height=wetSample.surfaceY??wetSample.height??0;
    const wet=wetSample.wet===true||(wetSample.coverage>=0&&wetSample.depth>0);
    water={wet,depth:Math.max(0,wetSample.depth||0),surfaceY:height,kind:wetSample.kind??null};
    immersion=wet?Math.max(0,height-position.y):0;
  }
  function beforeStep(dt,input={}){
    if(disposed)return;
    solved=adapter.readBody(id);if(!solved)return;
    wheelState=adapter.readVehicle(token);
    rotated({x:0,y:0,z:-1},solved.pose.rotation,forward);rotated({x:0,y:1,z:0},solved.pose.rotation,up);
    const velocity=solved.linearVelocity,speed=dot(velocity,forward),throttle=clamp(input.throttle||0,-1,1),steer=clamp(input.steer||0,-1,1);
    readWater(solved.pose.position);
    contacts=wheelState.wheels.filter(w=>w.contact).length;
    steering+=(steer*(.52/(1+Math.abs(speed)*.015))-steering)*(1-Math.exp(-9*dt));
    let drag=0,speedScale=0,grip=0;normal.x=normal.y=normal.z=0;
    for(const [index,w] of wheelState.wheels.entries()){
      sample.surfaceClass='grass';
      if(w.contact)sampleSurface(w.point.x,w.point.z,sample,w.point.y);
      const profile=VEHICLE_SURFACES[sample.surfaceClass]||VEHICLE_SURFACES.grass;
      if(w.contact){surface=sample.surfaceClass||'grass';drag+=profile.drag;speedScale+=profile.speed;grip+=profile.grip;normal.x+=w.normal.x;normal.y+=w.normal.y;normal.z+=w.normal.z;}
      Object.assign(wheelControls[index],{engineForce:0,brake:0,steering:0,frictionSlip:profile.grip,sideFrictionStiffness:.001});
    }
    lastInput={throttle,boost:!!input.boost&&throttle>0&&!input.slow&&!cart.sputtering};
    const powered=immersion<ENGINE_WATER_HEIGHT;
    if(contacts&&enabled){
      drag/=contacts;speedScale/=contacts;grip/=contacts;
      const nlen=length(normal)||1;normal.x/=nlen;normal.y/=nlen;normal.z/=nlen;
      // The contact plane defines forces, never a replacement pose. Assistance
      // fades with missing wheels, steep support and immersion; gravity still wins
      // on banks, and departure removes every driving/steering impulse.
      const support=contacts/4,traction=clamp((normal.y-.55)/.35,0,1)*Math.min(1,grip/1.8)*support;
      const slope=dot(forward,normal),tlen=Math.hypot(forward.x-normal.x*slope,forward.y-normal.y*slope,forward.z-normal.z*slope)||1;
      const tangent={x:(forward.x-normal.x*slope)/tlen,y:(forward.y-normal.y*slope)/tlen,z:(forward.z-normal.z*slope)/tlen};
      const side={x:tangent.y*normal.z-tangent.z*normal.y,y:tangent.z*normal.x-tangent.x*normal.z,z:tangent.x*normal.y-tangent.y*normal.x};
      const along=dot(velocity,tangent),lateral=dot(velocity,side);
      const cap=(input.slow?7.2:lastInput.boost?27.9:18)*(cart.sputtering?.35:1)*speedScale;
      const max=throttle<0?7*(cart.sputtering?.35:1):cap;
      const braking=!!input.brake||(throttle&&throttle*along<-.3);
      const accel=18*(input.slow?.45:1)*(lastInput.boost?1.55:1)*traction;
      let longitudinal=0;
      if(braking)longitudinal=clamp(-along/dt,-28*traction,28*traction);
      else if(powered&&throttle){
        // Grade feed-forward holds a legible powered target on ordinary hills,
        // within the same finite force budget. It cannot hold a steep bank.
        const demand=(max-Math.abs(along))/.15+9.81*tangent.y*Math.sign(throttle);
        longitudinal=throttle*clamp(demand,0,accel);
      }
      const resistance=1-Math.exp(-(throttle&&powered&&!braking?drag*.3:Math.max(1,drag))*dt);
      const vn=dot(velocity,normal);
      adapter.applyImpulse(id,{x:(tangent.x*longitudinal*dt-(velocity.x-normal.x*vn)*resistance)*mass,y:(tangent.y*longitudinal*dt-(velocity.y-normal.y*vn)*resistance)*mass,z:(tangent.z*longitudinal*dt-(velocity.z-normal.z*vn)*resistance)*mass});
      // Bounded lateral and yaw forces recover the familiar commanded turn rate.
      // Native wheels retain suspension; lateral tire response is negligible
      // because this controller owns grip. Steering is visual only
      // so a second wheel-angle controller cannot fight the yaw target.
      const wetGrip=1/(1+immersion*3),authority=traction*wetGrip;
      const targetYaw=steer*2.1*clamp(Math.abs(along)/6,0,1)*Math.sign(along);
      const lateralAccel=clamp(-lateral*10,-grip*9.81*3,grip*9.81*3)*authority;
      adapter.applyImpulse(id,{x:side.x*lateralAccel*mass*dt,y:side.y*lateralAccel*mass*dt,z:side.z*lateralAccel*mass*dt});
      const yawAccel=clamp((targetYaw-dot(solved.angularVelocity,normal))*12,-12,12)*authority;
      // Equal/opposite impulses around the COM create only torque. 750 kg m²
      // approximates this chassis' yaw inertia, with feedback absorbing variance.
      const impulse=yawAccel*750*dt/2,com=solved.centerOfMass;
      adapter.applyImpulse(id,{x:-side.x*impulse,y:-side.y*impulse,z:-side.z*impulse},{x:com.x+tangent.x,y:com.y+tangent.y,z:com.z+tangent.z});
      adapter.applyImpulse(id,{x:side.x*impulse,y:side.y*impulse,z:side.z*impulse},{x:com.x-tangent.x,y:com.y-tangent.y,z:com.z-tangent.z});
    }
    if(immersion>0){
      const resistance=1-Math.exp(-Math.min(10,2.8*immersion*immersion)*dt);
      adapter.applyImpulse(id,{x:-velocity.x*mass*resistance,y:0,z:-velocity.z*mass*resistance});
      // Partial buoyancy softens entry, but this cart cannot float indefinitely.
      adapter.applyImpulse(id,{x:0,y:mass*9.81*clamp(immersion/3,0,.55)*dt,z:0});
    }
    adapter.setVehicleControls(token,{wheels:wheelControls,enabled});
    previousVelocity={...velocity};
    const afterForces=adapter.readBody(id).linearVelocity;
    expectedVelocity={x:afterForces.x,y:afterForces.y-9.81*dt,z:afterForces.z};
    engine.throttle=Math.abs(throttle);engine.load=contacts&&throttle?clamp(.3+immersion*.45+Math.max(0,forward.y)*.8+Math.max(0,1-Math.abs(speed)/12)*.3,0,1):0;
    engine.revs=powered?clamp(.1+(contacts?Math.abs(speed)/27*.45:0)+Math.abs(throttle)*(contacts?.35:.7)+(lastInput.boost?.15:0),0,1):0;
    engine.wet=clamp(immersion/ENGINE_WATER_HEIGHT,0,1);engine.submersion=immersion;engine.running=powered;engine.grounded=contacts>0;engine.boost=lastInput.boost;
  }
  function publish(){
    copyVector(cart.position,solved.pose.position);if(cart.root.quaternion.copy)cart.root.quaternion.copy(solved.pose.rotation);else Object.assign(cart.root.quaternion,solved.pose.rotation);
    rotated({x:0,y:0,z:-1},solved.pose.rotation,forward);rotated({x:0,y:1,z:0},solved.pose.rotation,up);
    const horizontal=Math.hypot(forward.x,forward.z);
    if(horizontal>.05)cart.heading=Math.atan2(-forward.x,-forward.z);
    cart.speed=dot(solved.linearVelocity,forward);copyVector(cart.velocity,solved.linearVelocity);cart.grounded=contacts>0;
    cart.airborne=contacts===0;cart.waterDepth=water.depth;cart.submersion=immersion;cart.vehicleUp={...up};
    if(cart.wheels)for(const [index,w] of wheelState.wheels.entries()){
      const visual=cart.wheels[index];if(!visual)continue;
      visual.group.position.y=hardY-w.suspensionLength;visual.group.rotation.y=WHEELS[index].front?steering:0;
      visual.spin.rotation.x=-w.rotation;
    }
    cart.root.updateMatrixWorld?.(true);
  }
  function afterStep(dt){
    if(disposed)return;
    previousPose=solved.pose;
    solved=adapter.readBody(id);if(!solved)return;
    wheelState=adapter.readVehicle(token);const previousContacts=contacts;
    contacts=wheelState.wheels.filter(w=>w.contact).length;
    airTime=contacts?0:airTime+dt;
    const dv={x:solved.linearVelocity.x-expectedVelocity.x,y:solved.linearVelocity.y-expectedVelocity.y,z:solved.linearVelocity.z-expectedVelocity.z};
    // Contacts in the same native step include suspension impulses; only retain
    // changes larger than ordinary support/drive for consequence consumers.
    impactSpeed=length(dv);const inv=impactSpeed?1/impactSpeed:0;impactNormal={x:dv.x*inv,y:dv.y*inv,z:dv.z*inv};
    landingSpeed=contacts&&!previousContacts?Math.max(0,-previousVelocity.y):0;
    readWater(solved.pose.position);publish();
    recoveryTime=up.y<.25&&length(solved.linearVelocity)<1&&length(solved.angularVelocity)<.7?recoveryTime+dt:0;
    if(recoveryTime>2&&immersion<.8){
      sample.surfaceClass='grass';sample.height=undefined;sampleSurface(cart.position.x,cart.position.z,sample,cart.position.y);
      const q={x:0,y:Math.sin(cart.heading/2),z:0,w:Math.cos(cart.heading/2)},candidate={position:{x:cart.position.x,y:(sample.height??cart.position.y)+.12,z:cart.position.z},rotation:q};
      const contact=adapter.queryBodyContacts(id,body.generation,solved.pose,{margin:.06});
      if(contact.ok&&contact.contacts.length&&canRecover(candidate)===true){adapter.setPose(id,candidate);adapter.setVelocity(id);solved=adapter.readBody(id);previousPose=solved.pose;recoveries++;recoveryTime=0;publish();}
    }
    return state();
  }
  function reset(reason='teleport'){
    if(typeof reason!=='string'||!reason)throw new TypeError('A reset reason is required');
    if(disposed||!adapter.readBody(id))return false;
    const next=poseOf(cart),speed=Number.isFinite(cart.speed)?cart.speed:0;
    adapter.setPose(id,next);rotated({x:0,y:0,z:-1},next.rotation,forward);
    adapter.setVelocity(id,{linear:{x:forward.x*speed,y:forward.y*speed,z:forward.z*speed}});
    contacts=0;airTime=0;impactSpeed=landingSpeed=0;steering=0;resetCount++;lastReset=reason;
    for(const w of wheelControls)Object.assign(w,{engineForce:0,brake:0,steering:0});
    adapter.setVehicleControls(token,{wheels:wheelControls,enabled});solved=adapter.readBody(id);previousPose=solved.pose;wheelState=adapter.readVehicle(token);readWater(next.position);publish();return true;
  }
  // Interpolate only during presentation; gameplay and the next physics step
  // always see the authoritative solved pose.
  function beginRender(alpha){
    if(disposed||renderPose||!renderQuaternion)return;
    renderPose={position:{...solved.pose.position},rotation:{...solved.pose.rotation}};
    const a=clamp(alpha,0,1),p=previousPose.position,q=previousPose.rotation,n=solved.pose.position;
    cart.position.set(p.x+(n.x-p.x)*a,p.y+(n.y-p.y)*a,p.z+(n.z-p.z)*a);
    cart.root.quaternion.copy(q).slerp(renderQuaternion.copy(solved.pose.rotation),a);
    cart.root.updateMatrixWorld?.(true);
  }
  function endRender(){if(!renderPose)return;copyVector(cart.position,renderPose.position);cart.root.quaternion.copy(renderPose.rotation);renderPose=null;cart.root.updateMatrixWorld?.(true);}
  function state(){return {id,bodyGeneration:body.generation,contacts,grounded:contacts>0,speed:cart.speed,velocity:{...cart.velocity},position:{x:cart.position.x,y:cart.position.y,z:cart.position.z},surface,water:{...water},immersion,airTime,impactSpeed,landingSpeed,impactNormal:{...impactNormal},up:{...up},engine:{...engine},recoveries,resets:resetCount,lastReset,disposed};}
  function dispose(){if(disposed)return;disposed=true;adapter.removeVehicle(token);adapter.removeBody(id);cart.grounded=false;}
  reset('restart');
  return {id,token,beforeStep,afterStep,reset,state,dispose,beginRender,endRender,setEnabled(value){if(typeof value!=='boolean')throw new TypeError('Enabled must be boolean');enabled=value;if(!disposed)adapter.setVehicleControls(token,{wheels:wheelControls,enabled});}};
}
