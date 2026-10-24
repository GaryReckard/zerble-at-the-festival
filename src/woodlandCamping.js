// Pure, query-window-independent woodland households for the live generator.
import { worldHash, mulberry32, getSessionSeed } from './rng.js';
import { treeDensity } from './worldgen/density.js';
import { nearestRoad } from './worldgen/roads.js';
import { lakeAt } from './worldgen/water.js';
import { CONFIG, worldgenEpoch } from './worldgen/constants.js';
import { heartsInBounds } from './worldgen/hearts.js';
import { festivalPlan,campVillagesNear,MAX_POI_REACH } from './worldgen/festival.js';
import { clusterExtent } from './worldgen/tuning.js';
import { planCampRecipe, planCampNeighborhood } from './campPlanning.js';

const CELL=192, REACH=280, cache=new Map();
let gate='';
function segmentDistance(x,z,path){
  const dx=path.bx-path.ax,dz=path.bz-path.az,length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((x-path.ax)*dx+(z-path.az)*dz)/length)):0;
  return Math.hypot(x-path.ax-t*dx,z-path.az-t*dz);
}
export function woodlandCampingClearance(x,z,districts,padding=0){
  for(const district of districts){
    for(const p of district.pitches)if(Math.hypot(x-p.worldx,z-p.worldz)<p.footprint+padding)return true;
    for(const path of district.paths)if(segmentDistance(x,z,path)<path.width/2+padding)return true;
  }
  return false;
}
function cellPlan(cx,cz){
  const key=`${cx},${cz}`;
  if(cache.has(key))return cache.get(key);
  const seed=worldHash(cx,cz,0x574f4f44),mx=(cx+.5)*CELL,mz=(cz+.5)*CELL;
  // Nearby POIs are derived from the pure world, never the loaded registry.
  let reserved;
  const reservations=()=>{
    if(reserved)return reserved;
    reserved=campVillagesNear({minX:mx-180,minZ:mz-180,maxX:mx+180,maxZ:mz+180});
    for(const h of heartsInBounds(mx-180-MAX_POI_REACH,mz-180-MAX_POI_REACH,mx+180+MAX_POI_REACH,mz+180+MAX_POI_REACH)) {
      for(const p of festivalPlan(h))if(Math.abs(p.x-mx)<=180&&Math.abs(p.z-mz)<=180)reserved.push(p);
    }
    return reserved;
  };
  const blocked=(x,z,r)=>{
    if(nearestRoad(x,z).dist<r+CONFIG.ROAD_WIDTH/2+2)return true;
    for(let i=0;i<12;i++){const a=i*Math.PI/6;if(lakeAt(x+Math.cos(a)*r,z+Math.sin(a)*r))return true;}
    if(lakeAt(x,z))return true;
    return reservations().some(p=>Math.hypot(x-p.x,z-p.z)<r+Math.max(p.footprint||0,clusterExtent(p.kind,p.scale||1))+4);
  };
  let result=null;
  for(let attempt=0;attempt<8&&!result;attempt++){
    const rng=mulberry32(seed^Math.imul(attempt+1,0x9e3779b9));
    const x=mx+(rng()-.5)*64,z=mz+(rng()-.5)*64,density=treeDensity(x,z);
    if(density<.18||density>.88)continue;
    let wooded=0;
    for(let i=0;i<8;i++){const a=i*Math.PI/4;if(treeDensity(x+Math.cos(a)*35,z+Math.sin(a)*35)>.14)wooded++;}
    if(wooded<6)continue;
    const road=nearestRoad(x,z);
    if(!Number.isFinite(road.dist)||road.dist>210||blocked(x,z,14))continue;
    const facing=Math.PI/2-road.dirAngle;
    const planned=planCampNeighborhood(8+Math.floor(rng()*9),{seed,envelope:48,phase:facing,density:'compact'});
    const pitches=[];
    for(const original of planned){
      const pitch=original.role==='host'?original:{...original,size:'small',footprint:7,
        recipe:planCampRecipe('small',{role:'satellite',archetype:original.archetype,seed:seed+planned.indexOf(original),tightSleeping:true})};
      const candidates=(original.alternatives||[original]).map(c=>pitch.role==='host'?c:{...c,x:c.x*.72,z:c.z*.72});
      for(const candidate of candidates){
        const worldx=x+candidate.x,worldz=z+candidate.z;
        if(treeDensity(worldx,worldz)<.11||blocked(worldx,worldz,pitch.footprint))continue;
        pitches.push({...pitch,x:candidate.x,z:candidate.z,worldx,worldz,facing:candidate.facing,seed:worldHash(cx*31+pitches.length,cz,0x50495443)});
        break;
      }
      if(pitch.role==='host'&&!pitches.length)break;
    }
    if(pitches.length<4)continue;
    const roadX=x+Math.cos(road.dirAngle)*road.dist,roadZ=z+Math.sin(road.dirAngle)*road.dist;
    const entry={x:x+Math.cos(road.dirAngle)*14,z:z+Math.sin(road.dirAngle)*14};
    const bend={x:(roadX+entry.x)/2-Math.sin(road.dirAngle)*(rng()-.5)*8,z:(roadZ+entry.z)/2+Math.cos(road.dirAngle)*(rng()-.5)*8};
    const paths=[{ax:roadX,az:roadZ,bx:bend.x,bz:bend.z,width:3.6},{ax:bend.x,az:bend.z,bx:entry.x,bz:entry.z,width:3.6}];
    const junctions=[entry];
    for(const p of pitches.slice(1)) {
      // Reserve informal walking gaps between neighboring frontages. They
      // keep trees out of the route without painting trails inside the camp.
      const target={x:p.worldx+Math.sin(p.facing)*3,z:p.worldz+Math.cos(p.facing)*3};
      let from=junctions[0];
      for(const j of junctions)if(Math.hypot(j.x-target.x,j.z-target.z)<Math.hypot(from.x-target.x,from.z-target.z))from=j;
      const dx=target.x-from.x,dz=target.z-from.z,length=Math.hypot(dx,dz)||1,offset=(rng()-.5)*3;
      const via={x:(from.x+target.x)/2-dz/length*offset,z:(from.z+target.z)/2+dx/length*offset};
      paths.push({ax:from.x,az:from.z,bx:via.x,bz:via.z,width:1.2,visible:false},{ax:via.x,az:via.z,bx:target.x,bz:target.z,width:1.2,visible:false});
      junctions.push(target);
    }
    // Reject wet or occupied access, rather than drawing a trail through a lake
    // or another festival venue. Small path widths keep understory between crews.
    let accessible=true;
    for(const path of paths)for(let k=0;k<=Math.ceil(Math.hypot(path.bx-path.ax,path.bz-path.az)/5);k++){
      const steps=Math.max(1,Math.ceil(Math.hypot(path.bx-path.ax,path.bz-path.az)/5)),t=k/steps,px=path.ax+(path.bx-path.ax)*t,pz=path.az+(path.bz-path.az)*t;
      if(lakeAt(px,pz)||reservations().some(p=>Math.hypot(px-p.x,pz-p.z)<Math.max(p.footprint||0,clusterExtent(p.kind,p.scale||1))+path.width/2+2))accessible=false;
    }
    if(!accessible)continue;
    const xs=[...pitches.flatMap(p=>[p.worldx-p.footprint-4,p.worldx+p.footprint+4]),...paths.flatMap(p=>[p.ax-8,p.ax+8,p.bx-8,p.bx+8])];
    const zs=[...pitches.flatMap(p=>[p.worldz-p.footprint-4,p.worldz+p.footprint+4]),...paths.flatMap(p=>[p.az-8,p.az+8,p.bz-8,p.bz+8])];
    result={id:`woodland:${cx},${cz}`,seed,x,z,owner:{x,z},pitches,paths,bounds:{minX:Math.min(...xs),minZ:Math.min(...zs),maxX:Math.max(...xs),maxZ:Math.max(...zs)}};
  }
  if(cache.size>=512)cache.delete(cache.keys().next().value);
  cache.set(key,result);return result;
}
// Reject irrelevant cells before asking for expensive festival plans. These
// are the exact candidate centers used above, with a conservative bounding
// box over their whole camp envelope and possible bent road access.
function cellMayReach(cx,cz,bounds) {
  const seed=worldHash(cx,cz,0x574f4f44),mx=(cx+.5)*CELL,mz=(cz+.5)*CELL;
  for(let attempt=0;attempt<8;attempt++) {
    const rng=mulberry32(seed^Math.imul(attempt+1,0x9e3779b9));
    const x=mx+(rng()-.5)*64,z=mz+(rng()-.5)*64;
    if(treeDensity(x,z)<.18)continue;
    const road=nearestRoad(x,z);if(!Number.isFinite(road.dist)||road.dist>210)continue;
    const rx=x+Math.cos(road.dirAngle)*road.dist,rz=z+Math.sin(road.dirAngle)*road.dist;
    if(Math.max(x+52,rx+12)>=bounds.minX&&Math.min(x-52,rx-12)<=bounds.maxX&&Math.max(z+52,rz+12)>=bounds.minZ&&Math.min(z-52,rz-12)<=bounds.maxZ)return true;
  }
  return false;
}
export function woodlandCampsNear(bounds){
  const current=`${getSessionSeed()}:${worldgenEpoch()}`;
  if(current!==gate){cache.clear();gate=current;}
  const out=[];
  for(let z=Math.floor((bounds.minZ-REACH)/CELL);z<=Math.floor((bounds.maxZ+REACH)/CELL);z++)for(let x=Math.floor((bounds.minX-REACH)/CELL);x<=Math.floor((bounds.maxX+REACH)/CELL);x++){
    if(!cache.has(`${x},${z}`)&&!cellMayReach(x,z,bounds))continue;
    const d=cellPlan(x,z);if(!d)continue;
    const b=d.bounds;
    if(b.maxX>=bounds.minX&&b.minX<=bounds.maxX&&b.maxZ>=bounds.minZ&&b.minZ<=bounds.maxZ)out.push(d);
  }
  return out;
}
