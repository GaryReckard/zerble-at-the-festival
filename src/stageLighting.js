import * as THREE from 'three';
import {A11y} from './a11y.js';

const palettes={
 folk:[0xffc77e,0xffa85b,0xffdcab], jam:[0xffbd71,0x8bafff,0xd396eb],
 funk:[0xff914d,0xe576bf,0x60d6ca],brass:[0xffc965,0xff925a,0x6bd1bd],
 world:[0xffb367,0x5acbb9,0xd99aca],dance:[0x77bfff,0xcd8fff,0xff72c1],dub:[0x8dd8bb,0xffbc65,0xac96ed],
};
export function sampleStageLightCue(cue,seconds,nightness,calm,out={}){
 const style=cue?.style in palettes?cue.style:'jam',playing=!!cue?.playing;
 const section=cue?.section??'',big=section==='chorus'||section==='drop'||section==='solo';
 const warm=style==='folk',club=style==='dance'||style==='dub';
 out.style=style;out.palette=palettes[style];out.playing=playing;out.big=big;
 out.time=calm||!playing?0:cue.time;
 out.night=THREE.MathUtils.smoothstep(nightness,.15,.7);
 // A raised baseline and broad accents keep note attacks from becoming strobes.
 const accent=calm||!playing?0:Math.max(cue.kick||0,(cue.snare||0)*.7,(cue.chord||0)*.45,(cue.lead||0)*.25);
 out.energy=playing?(warm?.12:club?.32:.23)*accent:0;
 out.wash=out.night*(playing?(warm?15:big?26:20):9)*(1+out.energy);
 out.sweep=calm||!playing?0:warm?.25:club?(big?7:4):big?3.5:1.5;
 out.fan=out.night*(playing&&!calm?(warm?.22:club?big?1:.65:big?.58:.36):0);
 return out;
}

const shared=v=>{v.userData.shared=true;return v;};
const fanGeometry=shared(new THREE.CylinderGeometry(0,1,1,8,1,true).translate(0,-.5,0));
const rgba=new Float32Array(fanGeometry.attributes.position.count*4),uv=fanGeometry.attributes.uv;
for(let i=0;i<uv.count;i++){
 rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=1;
 rgba[i*4+3]=Math.sin(uv.getX(i)*Math.PI)**2*THREE.MathUtils.smoothstep(uv.getY(i),0,.65);
}
fanGeometry.setAttribute('color',new THREE.BufferAttribute(rgba,4));
const fanMaterial=shared(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.11,
 blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false}));
const DOWN=new THREE.Vector3(0,-1,0);
// One draw per venue; instances have no lights, shadow maps or noise shader.
export function createBeamFan(group,sources,scale=1){
 const mesh=new THREE.InstancedMesh(fanGeometry,fanMaterial,sources.length*2);
 mesh.name='Stage beam fans';mesh.visible=false;mesh.castShadow=mesh.receiveShadow=false;
 const bounds=new THREE.Box3().setFromPoints(sources);
 bounds.min.add(new THREE.Vector3(-10,-7,-2).multiplyScalar(scale));
 bounds.max.add(new THREE.Vector3(10,2,17).multiplyScalar(scale));
 mesh.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
 mesh.frustumCulled=true;group.add(mesh);
 const dummy=new THREE.Object3D(),direction=new THREE.Vector3(),color=new THREE.Color();
 dummy.scale.setScalar(0);dummy.updateMatrix();
 for(let i=0;i<sources.length*2;i++){mesh.setColorAt(i,color);mesh.setMatrixAt(i,dummy.matrix);}
 mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
 return {mesh,update(show,enabled=true,compact=false){
  mesh.visible=enabled&&show.fan>.001;if(!mesh.visible)return;
  const rays=mesh.userData.raysPerSource??1;mesh.count=sources.length*rays;
  for(let i=0;i<mesh.count;i++){
   const source=sources[Math.floor(i/rays)],side=rays===1?0:(i%2?1:-1),phase=show.time*(show.style==='folk'?.08:.22)+i*.8;
   const width=(compact?2.6:show.style==='folk'?1.2:6)*scale;
   direction.set(Math.sin(phase)*width+side*scale*2,
     compact?-1.5*scale:(show.big?-3:-5)*scale,(compact?8:14)*scale);
   const length=direction.length();direction.normalize();dummy.position.copy(source);
   dummy.quaternion.setFromUnitVectors(DOWN,direction);
   const radius=(compact?.65:show.big?1.35:.85)*scale;
   dummy.scale.set(radius,length,radius);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   color.setHex(show.palette[i%3]).multiplyScalar(show.fan*(show.big?1.2:.8));mesh.setColorAt(i,color);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
 }};
}

export function createStageLighting(group,lenses,beams,scale){
 const fan=createBeamFan(group,beams.map(ref=>ref.beam.position.clone()),scale);
 const color=new THREE.Color(),next=new THREE.Color(),show={};
 const controller={band:null,fansEnabled:true,calm:false,fan:fan.mesh,show,
 update(seconds,nightness,cue=null,near=true){
  sampleStageLightCue(cue,seconds,nightness,controller.calm||A11y.reducedMotion,show);
  for(let i=0;i<beams.length;i++){
   const ref=beams[i],phase=show.time*.20+i*1.7;
   color.setHex(show.palette[i%3]);next.setHex(show.palette[(i+1)%3]);
   color.lerp(next,show.playing&&!controller.calm&&!A11y.reducedMotion?(Math.sin(phase*.35)+1)*.18:0);
   ref.beam.color.copy(color);ref.beam.intensity=ref.wash?show.wash:show.night*(show.playing?7+show.energy*8:3);
   ref.target.position.x=ref.baseTargetX+Math.sin(phase)*(ref.wash?.35:show.sweep)*scale;
   ref.target.position.z=ref.baseTargetZ+Math.sin(phase*.7)*(ref.wash?.15:show.sweep*.35)*scale;
   lenses[i].material.color.copy(color);lenses[i].material.emissive.copy(color);
   lenses[i].material.emissiveIntensity=2+show.night*(1+show.energy*4);
  }
  fan.update(show,near&&controller.fansEnabled);return show;
 }};
 group.userData.stageLighting=controller;return controller;
}


export function createHealingPartyLighting(group,light){
 const fan=createBeamFan(group,[new THREE.Vector3(-4.8,3.25,-4.8),new THREE.Vector3(4.8,3.25,-4.8)]);
 const show={};
 const controller={fan:fan.mesh,show,calm:false,fansEnabled:true,update(cue,time,nightness,near=true){
  sampleStageLightCue(cue,time,nightness,controller.calm||A11y.reducedMotion,show);
  light.intensity=2+show.night*(23+show.energy*24);
  light.color.setHex(show.night>.35?show.palette[1]:0xffc48b);
  fan.update(show,near&&controller.fansEnabled,true);
 }};
 return controller;
}
