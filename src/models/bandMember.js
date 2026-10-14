import * as THREE from 'three';
import {buildPerformer} from './performer.js';
import {mulberry32} from '../rng.js';

export function buildBandMember(instrument,seed=0){
  const root=new THREE.Group();
  const rng=mulberry32((seed^0x62726173)>>>0);
  const performer=buildPerformer(instrument==='drum'?'march_drum':instrument,rng);
  root.add(performer);
  root.userData.bobPhase=rng()*Math.PI*2;
  root.userData.elapsed=0;
  return root;
}

export function tickBandMember(model,dt){
  const performer=model.children[0];
  if(!performer)return;
  const u=model.userData;u.elapsed+=dt;
  const phase=u.elapsed*3.6+u.bobPhase;
  performer.position.y=Math.abs(Math.sin(phase))*0.055;
  performer.userData.animate?.(u.elapsed+u.bobPhase);
}
