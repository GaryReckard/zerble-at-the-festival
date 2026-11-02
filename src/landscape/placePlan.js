import { landscapeToWorld } from '../worldgen/landscapeCandidates.js';
import { freezeLandscapePlan } from './campingPlan.js';
export function placeDistrictPlan(candidate,local) {
  if(!local.valid||candidate.kind!=='mountain-top')throw new TypeError('A complete occupied arrangement is required');
  const point=p=>({...p,...landscapeToWorld(candidate,p.x,p.z)}),path=values=>values.map(point),yaw=candidate.turns*Math.PI/2;
  const rectangle=b=>{
    const corners=[[b.minX,b.minZ],[b.maxX,b.minZ],[b.minX,b.maxZ],[b.maxX,b.maxZ]].map(([x,z])=>landscapeToWorld(candidate,x,z));
    return {...b,minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minZ:Math.min(...corners.map(p=>p.z)),maxZ:Math.max(...corners.map(p=>p.z))};
  };
  return freezeLandscapePlan({...local,id:candidate.id,version:candidate.version,form:candidate.plan.form,bounds:candidate.bounds,
    camps:local.camps.map((p,i)=>({...point(p),id:`${candidate.id}:camp:${i}`,facing:p.facing-yaw})),
    commons:point(local.commons),meadowFire:local.meadowFire?point(local.meadowFire):null,
    // Drum-circle bearings use atan2(z,x); camp roots use Three.js yaw.
    clearing:{...point(local.clearing),facing:local.clearing.facing+yaw},
    mainRoad:path(local.mainRoad),narrowPath:path(local.narrowPath),route:path(local.route),accessPaths:local.accessPaths.map(path),visitorRoute:path(local.visitorRoute),
    shelves:local.shelves.map(rectangle),treeShelves:local.shelves,ports:candidate.ports,
    frame:{origin:candidate.origin,turns:candidate.turns}});
}
