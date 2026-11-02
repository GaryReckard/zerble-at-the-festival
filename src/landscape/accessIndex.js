// Completed canonical plans are distinct from their render residency. Chunks
// consult this index before placing content, including along external spurs.
import { landscapeAdmissionCandidatesInBounds } from '../worldgen/landscape.js';
import { landscapeVersion } from '../worldgen/landscapeCandidates.js';
import { landscapeRoadPaths } from '../worldgen/landscapeRender.js';
const intersects=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
const distance=(x,z,points)=>{
  let closest=Infinity;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/length)):0;
    closest=Math.min(closest,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
  }return closest;
};
export class LandscapeAccessIndex {
  constructor(planner){this.planner=planner;this.roadCache=new WeakMap();this.boundsCache=new WeakMap();}
  query(bounds,{request=true}={}) {
    if(landscapeVersion()!==2)return [];
    return landscapeAdmissionCandidatesInBounds(bounds).sort((a,b)=>a.id.localeCompare(b.id)).map(candidate=>({candidate,
      state:candidate.kind==='wooded-ridge'?{status:'rejected',reason:'wilderness-form',plan:null}:request?this.planner.request(candidate):this.planner.read(candidate)||{status:'pending'}}));
  }
  ready(bounds){return this.query(bounds).every(({state})=>state.status==='ready'||state.status==='rejected');}
  roadsFor(candidate,state) {
    if(candidate.kind!=='mountain-top'||!['ready','rejected'].includes(state.status))return [];
    const key=state.plan||candidate;
    if(!this.roadCache.has(key))this.roadCache.set(key,Object.freeze(landscapeRoadPaths(candidate,state.plan).map((road,index)=>Object.freeze({
      ...road,ownerId:candidate.id,edgeId:`${candidate.id}:road:${index}`,surface:'dirt',surfaceId:'terrain',
      points:Object.freeze(road.points.map(p=>Object.freeze({x:p.x,z:p.z})))
    }))));
    return this.roadCache.get(key);
  }
  boundsFor(candidate,state){
    const key=state.plan||candidate;
    if(!this.boundsCache.has(key)){
      const bounds={...candidate.bounds};
      for(const road of this.roadsFor(candidate,state))for(const p of road.points){
        const r=road.width/2;bounds.minX=Math.min(bounds.minX,p.x-r);bounds.maxX=Math.max(bounds.maxX,p.x+r);bounds.minZ=Math.min(bounds.minZ,p.z-r);bounds.maxZ=Math.max(bounds.maxZ,p.z+r);
      }
      this.boundsCache.set(key,Object.freeze(bounds));
    }
    return this.boundsCache.get(key);
  }
  roads(bounds){
    return this.query(bounds).flatMap(({candidate,state})=>this.roadsFor(candidate,state).filter(road=>{
      const xs=road.points.map(p=>p.x),zs=road.points.map(p=>p.z),r=road.width/2;
      return intersects(bounds,{minX:Math.min(...xs)-r,maxX:Math.max(...xs)+r,minZ:Math.min(...zs)-r,maxZ:Math.max(...zs)+r});
    }));
  }
  // Unknown access is conservatively reserved; it never masquerades as an
  // absent district while a dependent chunk is deciding tree/prop placement.
  clearance(x,z,radius=0,{actors=false}={}) {
    if(![x,z,radius].every(Number.isFinite)||radius<0)throw new RangeError('Invalid landscape clearance');
    const bounds={minX:x-radius,maxX:x+radius,minZ:z-radius,maxZ:z+radius};
    for(const {candidate,state}of this.query(bounds)) {
      if(!['ready','rejected'].includes(state.status))return true;
      if(actors&&intersects(candidate.bounds,bounds))return true;
      if(candidate.kind!=='mountain-top')continue;
      const plan=state.plan,stream=candidate.stream;
      if(stream&&(distance(x,z,stream.points)<stream.bankWidth+radius||Math.hypot(x-stream.receiver.x,z-stream.receiver.z)<stream.receiver.radius+stream.bankWidth+radius))return true;
      for(const road of this.roadsFor(candidate,state))if(distance(x,z,road.points)<road.width/2+radius+1.5)return true;
      if(plan){
        if(plan.shelves.some(s=>intersects(s,bounds)))return true;
        if(plan.camps.some(p=>Math.hypot(x-p.x,z-p.z)<p.recipe.footprint+radius+2))return true;
        if(plan.accessPaths.some(p=>distance(x,z,p)<4.5+radius))return true;
        if(Math.hypot(x-plan.clearing.x,z-plan.clearing.z)<plan.clearing.radius+radius+2)return true;
      }
    }return false;
  }
  nearestRoad(x,z,legacy) {
    let best=legacy;
    for(const road of this.roads({minX:x-80,maxX:x+80,minZ:z-80,maxZ:z+80})) {
      const dist=distance(x,z,road.points);if(best&&dist>=best.dist)continue;
      let angle=0,nearest=Infinity;
      for(let i=1;i<road.points.length;i++){
        const segment=road.points.slice(i-1,i+1),d=distance(x,z,segment);
        if(d<nearest){const a=segment[0],b=segment[1],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));nearest=d;angle=Math.atan2(a.z+t*dz-z,a.x+t*dx-x);}
      }
      best={dist,onRoad:dist<=road.width/2,tier:'landscape',surface:'dirt',width:road.width,dirAngle:angle,edgeId:road.edgeId};
    }return best;
  }
}
