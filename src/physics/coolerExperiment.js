import {createRapierAdapter} from './rapierAdapter.js';

// Bounded comparison fixture, not live admission policy. Both alternatives use
// the same hollow body, lid contact shape and six reserved contents slots.
const hinge={x:0,y:.372,z:-.223},identity={x:0,y:0,z:0,w:1};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rotate(v,q){const x=2*(q.y*v.z-q.z*v.y),y=2*(q.z*v.x-q.x*v.z),z=2*(q.x*v.y-q.y*v.x);return {x:v.x+q.w*x+q.y*z-q.z*y,y:v.y+q.w*y+q.z*x-q.x*z,z:v.z+q.w*z+q.x*y-q.y*x};}
function mul(a,b){return {x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z};}
function inverse(q){return {x:-q.x,y:-q.y,z:-q.z,w:q.w};}
function worldPoint(p,v){const r=rotate(v,p.rotation);return {x:p.position.x+r.x,y:p.position.y+r.y,z:p.position.z+r.z};}
function lidPose(base,angle){return {position:worldPoint(base,hinge),rotation:mul(base.rotation,{x:-Math.sin(angle/2),y:0,z:0,w:Math.cos(angle/2)})};}
const box=(x,y,z,hx,hy,hz,mass)=>({shape:'cuboid',position:{x,y,z},halfExtents:{x:hx,y:hy,z:hz},mass,friction:.6,restitution:.05});
export async function createCoolerExperiment({mode='physical',contents=6,inverted=false}={}) {
 if(!['physical','controlled'].includes(mode)||!Number.isInteger(contents)||contents<0||contents>6)throw new RangeError('Invalid cooler experiment');
 const adapter=await createRapierAdapter({capacities:{bodies:9,colliders:13,joints:1,contactPairs:1,events:64}});
 let joint=null,latched=true,angle=0,angularSpeed=0,previousVelocity={x:0,y:0,z:0},steps=0,disposed=false;
 let maxAngle=0,maxAnchorError=0,maxSpeed=0,maxLimitError=0;
 const ids=[];
 function add(spec){const result=adapter.addBody(spec);if(!result.ok)throw Error(result.reason);ids.push(spec.id);return result;}
 try {
  add({id:'floor',type:'fixed',pose:{position:{x:0,y:-.1,z:0}},colliders:[box(0,0,0,1000,.1,1000,1)]});
  const start={position:{x:0,y:inverted?1.4:.01,z:0},rotation:inverted?{x:0,y:0,z:1,w:0}:identity};
  const base=add({id:'base',type:'dynamic',pose:start,ccd:true,linearDamping:.1,angularDamping:.2,colliders:[
   box(0,.055,0,.285,.025,.195,2.4),box(-.265,.215,0,.025,.135,.195,2.4),box(.265,.215,0,.025,.135,.195,2.4),
   box(0,.215,-.17,.24,.135,.025,2.4),box(0,.215,.17,.24,.135,.025,2.4),
  ]});
  const lid=add({id:'lid',type:mode==='physical'?'dynamic':'kinematic',pose:lidPose(start,0),ccd:true,angularDamping:.5,
   colliders:[box(0,.035,.223,.31,.035,.225,1.4)]});
  if(mode==='physical'){
   const result=adapter.addJoint({id:'lid-hinge',type:'revolute',bodyA:'base',bodyB:'lid',anchorA:hinge,anchorB:{x:0,y:0,z:0},axis:{x:-1,y:0,z:0},limits:[0,0],contactsEnabled:false});
   if(!result.ok)throw Error(result.reason);joint=result.token;
  }else{
   const result=adapter.suppressBodyContacts({bodyA:'base',generationA:base.generation,bodyB:'lid',generationB:lid.generation});if(!result.ok)throw Error(result.reason);
  }
  for(let i=0;i<contents;i++)add({id:`can-${i}`,type:'dynamic',ccd:true,pose:{position:worldPoint(start,{x:(i%3-1)*.12,y:.165,z:(Math.floor(i/3)-.5)*.11}),rotation:start.rotation},
   colliders:[{shape:'cylinder',radius:.04,halfHeight:.07,mass:.35,friction:.5,restitution:.12}]});
 }catch(error){adapter.dispose();throw error;}
 function read(){
  const base=adapter.readBody('base'),lid=adapter.readBody('lid');
  const relative=mul(inverse(base.pose.rotation),lid.pose.rotation);
  let measured=-2*Math.atan2(relative.x,relative.w);if(measured>Math.PI)measured-=2*Math.PI;if(measured< -Math.PI)measured+=2*Math.PI;
  const anchor=worldPoint(base.pose,hinge),error=Math.hypot(anchor.x-lid.pose.position.x,anchor.y-lid.pose.position.y,anchor.z-lid.pose.position.z);
  return {mode,steps,latched,angle:measured,anchorError:error,base,lid,contents:ids.filter(id=>id.startsWith('can-')).map(id=>adapter.readBody(id)),
   maxima:{angle:maxAngle,anchorError:maxAnchorError,speed:maxSpeed,limitError:maxLimitError},counts:adapter.counts()};
 }
 return Object.freeze({
  read,
  unlatch(){if(disposed)return false;latched=false;if(joint)adapter.setJointLimits(joint,[0,1.85]);return true;},
  impact(impulse={x:4,y:3,z:-24}){
   if(disposed)return false;
   const base=adapter.readBody('base');
   // Shared experiment policy: a native-body velocity change of 1.2 m/s opens
   // the latch. Production contact attribution will supply this decision later.
   if(Math.hypot(impulse.x,impulse.y,impulse.z)/base.mass>=1.2){latched=false;if(joint)adapter.setJointLimits(joint,[0,1.85]);}
   return adapter.applyImpulse('base',impulse,worldPoint(base.pose,{x:.2,y:.25,z:.2}));
  },
  step(dt=1/60){
   if(disposed)throw Error('Disposed cooler experiment');
   if(!Number.isFinite(dt)||dt<0||dt>1/60)throw RangeError('Experiment step must be within 0..1/60');
   if(!dt)return read();
   if(mode==='controlled'){
    const base=adapter.readBody('base'),v=base.linearVelocity;
    const force=rotate({x:clamp(-(v.x-previousVelocity.x)/dt,-80,80),y:clamp(-9.81-(v.y-previousVelocity.y)/dt,-80,80),z:clamp(-(v.z-previousVelocity.z)/dt,-80,80)},inverse(base.pose.rotation));
    previousVelocity={...v};
    if(!latched){
     // One-degree-of-freedom visual controller. It responds to translation and
     // gravity, but cannot transfer hinge torque or a can's impulse to the base.
     const torque=(.223*Math.cos(angle)*force.y-.223*Math.sin(angle)*force.z)/.07;
     angularSpeed=clamp((angularSpeed+torque*dt)*Math.exp(-2*dt),-8,8);
     angle=clamp(angle+angularSpeed*dt,0,1.85);if((angle===0&&angularSpeed<0)||(angle===1.85&&angularSpeed>0))angularSpeed=0;
    }
    adapter.setKinematicTarget('lid',lidPose(base.pose,angle));
   }
   adapter.step(dt);adapter.drainEvents();steps++;
   const state=read();maxAngle=Math.max(maxAngle,state.angle);maxAnchorError=Math.max(maxAnchorError,state.anchorError);
   maxLimitError=Math.max(maxLimitError,-state.angle,state.angle-(latched?0:1.85));
   for(const body of [state.base,state.lid,...state.contents])maxSpeed=Math.max(maxSpeed,Math.hypot(body.linearVelocity.x,body.linearVelocity.y,body.linearVelocity.z));
   return read();
  },
  dispose(){if(disposed)return false;disposed=true;adapter.dispose();return true;},
  counts:()=>adapter.counts(),
 });
}
