import { terrainHeight } from './worldgen/terrain.js';
// Infill an existing camp's shared empty ground with sleeping pitches. The
// owner supplies real water/road checks and adopts each accepted model before
// the next preflight, so lake lifecycle and collision truth stay synchronous.
import {mulberry32} from './rng.js';
import {planCampRecipe,CAMP_ARCHETYPES} from './campPlanning.js';
import {buildCampsite} from './models/campsite.js';
import {canPlaceCampsite} from './campRegistry.js';

export function populateCampClearing(registry,host,{seed,neighborhood,canUsePitch,onAccept}) {
  if(typeof canUsePitch!=='function'||typeof onAccept!=='function')throw new TypeError('Camp infill requires clearance and ownership callbacks');
  const rng=mulberry32(seed^0x494e4649),facing=host.group.rotation.y+(host.entranceYaw||0);
  const c=Math.cos(facing),s=Math.sin(facing),origin=host.group.position;
  const candidates=[];
  // A jittered lattice packs irregular gaps instead of imposing another ring
  // around the fire. Retain an open frontage towards the water.
  for(let row=-3;row<=3;row++)for(let column=-3;column<=3;column++){
    const side=column*5.25+(rng()-.5)*2.2,front=row*5.25+(rng()-.5)*2.2;
    const distance=Math.hypot(side,front);
    if(distance<5||distance>18||front>0&&Math.abs(side)<4)continue;
    candidates.push({x:origin.x+c*side+s*front,z:origin.z-s*side+c*front,rank:distance+rng()*2});
  }
  candidates.sort((a,b)=>a.rank-b.rank);
  const accepted=[],target=5+(seed>>>0)%4;
  for(let i=0;i<target;i++){
    const modelSeed=(seed^Math.imul(i+1,0x9e3779b9))>>>0;
    const archetype=CAMP_ARCHETYPES[(i+(seed>>>0))%CAMP_ARCHETYPES.length];
    const recipe=planCampRecipe('small',{role:'satellite',archetype,seed:modelSeed,tightSleeping:true});
    // Allocate one model per desired pitch, then try its actual geometry at
    // several positions. Rejected positions do not build discarded models.
    const camp=buildCampsite(mulberry32(modelSeed),'small',{plan:recipe});
    let placed=false;
    for(const candidate of candidates){
      if(!canUsePitch(candidate.x,candidate.z,camp.footprint))continue;
      camp.group.position.set(candidate.x, terrainHeight(candidate.x, candidate.z), candidate.z);
      const face=Math.atan2(origin.x-candidate.x,origin.z-candidate.z);
      camp.group.rotation.y=face-(camp.entranceYaw||0);
      if(!canPlaceCampsite(registry,camp,neighborhood,{waterChecked:true}))continue;
      onAccept(camp);accepted.push(camp);placed=true;break;
    }
    if(!placed)camp.group.traverse?.(obj=>{
      if(obj.isInstancedMesh)obj.dispose();
      if(obj.geometry&&!obj.geometry.userData.shared)obj.geometry.dispose();
      for(const material of obj.material?(Array.isArray(obj.material)?obj.material:[obj.material]):[])if(!material.userData.shared)material.dispose();
    });
  }
  return accepted;
}
