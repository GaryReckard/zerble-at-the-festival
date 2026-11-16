import {bindLocomotion,tickLocomotion} from './personLocomotion.js';
import * as THREE from 'three';
import {buildPerformer} from './performer.js';
import {mulberry32} from '../rng.js';

export function buildBandMember(instrument,seed=0){
  const root=new THREE.Group();
  const rng=mulberry32((seed^0x62726173)>>>0);
  const performer=buildPerformer(instrument==='drum'?'march_drum':instrument,rng,{locomotion:true});
  root.add(performer);
  root.userData.bobPhase=rng()*Math.PI*2;
  root.userData.elapsed=0;
  root.userData.partCue={playing:false};
  // All horns and both hands stay together above the belt during a flourish.
  root.userData.marchingSpine=performer.getObjectByName('Performer torso').parent.parent;
  bindLocomotion(root,{body:performer,morphs:[performer.userData.strideMesh],height:1,hip:.8,toe:.29,ground:.005,phase:root.userData.bobPhase});
  return root;
}

export function tickBandMember(model,dt,ensemble=null){
  const performer=model.children[0];
  if(!performer)return;
  const u=model.userData;u.elapsed+=dt;
  const gait=tickLocomotion(model,dt);
  // The tuba and snare own their own lanes. Lower horns answer the trumpets
  // with a different pitch and must not finger the opening call in unison.
  const part=u.partCue;
  part.playing=!!ensemble?.playing;
  if(part.playing){
    part.time=ensemble.time; part.beat=ensemble.beat; part.beatPhase=ensemble.beatPhase;
    part.intensity=ensemble.intensity;
    const role=performer.userData.instrument;
    const counter=role==='trombone'||role==='sax';
    part.lead=counter?ensemble.counter:role==='trumpet'?ensemble.lead:0;
    part.leadPitch=counter?ensemble.counterPitch:role==='trumpet'?ensemble.leadPitch:0;
    part.bass=role==='tuba'?ensemble.bass:0;
    part.bassPitch=role==='tuba'?ensemble.bassPitch:0;
    part.kick=role==='march_drum'?ensemble.kick:0;
    part.snare=role==='march_drum'?ensemble.snare:0;
    part.chord=part.hat=0;
  }
  performer.userData.animate?.(u.elapsed+u.bobPhase,part);
  const spine=u.marchingSpine;
  // Follow the planted step with the shoulders. The upper body can lift a
  // sounding horn or turn inward on an answer without moving a foot/collider.
  spine.rotation.z += (gait?.stride ?? 0) * .13;
  if(part.playing){
    const side=Math.sign(u.formationOff?.x ?? 0);
    spine.rotation.y -= side*(part.lead ?? 0)*.19;
    spine.rotation.x += (part.lead ?? 0)*(ensemble.section==='shout'?.20:.085);
  }
}
