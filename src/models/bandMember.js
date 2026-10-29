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
  bindLocomotion(root,{body:performer,morphs:[performer.userData.strideMesh],height:1,hip:.8,toe:.29,ground:.005,phase:root.userData.bobPhase});
  return root;
}

export function tickBandMember(model,dt){
  const performer=model.children[0];
  if(!performer)return;
  const u=model.userData;u.elapsed+=dt;
  tickLocomotion(model,dt);
  performer.userData.animate?.(u.elapsed+u.bobPhase);
}
