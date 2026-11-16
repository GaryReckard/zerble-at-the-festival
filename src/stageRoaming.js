import {locomotionHipOffset} from './personMotion.js';

const points=[0,1,0,-1,0];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Roaming belongs to placed stage actors, never parade or standalone models.
// Each corridor is local to the deck and stays ahead of the stationary backline.
export function configureStageRoaming(actor,width,depth,onRiser=false) {
  const role=actor.userData.instrument;
  if(onRiser || !['lead_vocal','guitar','bass'].includes(role))return;
  const singer=role==='lead_vocal';
  actor.userData.stageRoam={x:actor.position.x,y:actor.position.y,z:actor.position.z,yaw:actor.rotation.y,
    width:singer?Math.min(2.8,width*.09):role==='guitar'?.32:.24,
    depth:singer?Math.min(.32,depth*.035):.16,
    elapsed:0,delay:singer?0:role==='guitar'?3:7,lastTime:NaN,playing:false,phase:0,stride:0};
}

export function sampleStageRoaming(actor,cue) {
  const r=actor.userData.stageRoam;
  if(!r || !Number.isFinite(cue?.time))return;
  const dt=Number.isFinite(r.lastTime)?Math.max(0,Math.min(.25,cue.time-r.lastTime)):0;
  r.lastTime=cue.time;
  if(cue.playing && r.playing)r.elapsed+=dt;
  r.playing=!!cue.playing;
  const singer=actor.userData.instrument==='lead_vocal';
  const time=Math.max(0,r.elapsed-r.delay);
  const period=singer?7:9, leg=Math.floor(time/period), local=time%period;
  const u=Math.min(1,local/(singer?4.8:4));
  const ease=u*u*u*(10+u*(-15+6*u));
  const index=leg%4, travel=points[index]+(points[index+1]-points[index])*ease;
  const x=r.x+travel*r.width,z=r.z+Math.sin(travel*Math.PI/2)*r.depth;
  const dx=x-actor.position.x,dz=z-actor.position.z,distance=Math.hypot(dx,dz);
  const speed=dt>0?distance/dt:0;
  r.phase+=distance*8;
  const target=cue.playing?Math.sin(r.phase)*Math.min(.30,speed*.55):0;
  r.stride+=(target-r.stride)*(1-Math.exp(-dt*18));
  const walking=speed>.035;
  const desired=r.yaw+(walking?wrap(Math.atan2(-dx,-dz)-r.yaw)*(singer?.85:.22):0);
  actor.rotation.y+=wrap(desired-actor.rotation.y)*(1-Math.exp(-dt*5));
  actor.position.set(x,r.y+locomotionHipOffset(r.stride,.8,.29)+.002,z);
  const legs=actor.userData.strideMesh;
  legs.morphTargetInfluences[0]=Math.sin(r.stride);
  legs.morphTargetInfluences[1]=Math.cos(r.stride)-1;
}
