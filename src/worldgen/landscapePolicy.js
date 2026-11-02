// Optional runtime access truth, installed only by the experimental world.
// No planner, terrain or renderer imports are allowed here: upstream worldgen
// remains acyclic and worker planning never consults mutable scene residency.
let current=null;
export function installLandscapePolicy(policy){
  if(current)throw new Error('Landscape policy already installed');
  if(!policy||typeof policy.clearance!=='function'||typeof policy.nearestRoad!=='function')throw new TypeError('Invalid landscape policy');
  current=policy;return()=>{if(current===policy)current=null;};
}
export function landscapeClearance(x,z,radius=0,actors=false){return current?.clearance(x,z,radius,actors)||false;}
export function landscapeNearestRoad(x,z,legacy){return current?.nearestRoad(x,z,legacy)||legacy;}
