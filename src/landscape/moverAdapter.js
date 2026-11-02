import {createSupportBinding} from './support.js';
import {rectangleFootprint} from './routes.js';
const inside=(b,p)=>p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ;
const project=(point,path)=>{
  let best=null,along=0;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),t=length?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(length*length))):0,x=a.x+t*dx,z=a.z+t*dz,d=Math.hypot(x-point.x,z-point.z);
    if(!best||d<best.dist)best={x,z,dist:d,distance:along+t*length};along+=length;
  }return best;
};
const along=(path,d)=>{for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(d<=length)return {x:a.x+(b.x-a.x)*d/length,z:a.z+(b.z-a.z)*d/length};d-=length;}return path.at(-1);};
export const RIDER_SUPPORT_FOOTPRINT=rectangleFootprint(.8,.8,.8);
export const WAGON_SUPPORT_FOOTPRINT=rectangleFootprint(2.1,5.5,1);
export const LURLEEN_SUPPORT_FOOTPRINT=rectangleFootprint(1.4,1.6,1);

export function createLandscapeMoverAdapter(runtime){
  const world=runtime.supportWorld,probe={},proposal={};
  const roadSupport=(x,z)=>{for(const record of runtime.owners.values())if(record.water&&inside(record.candidate.bridge.bounds,{x,z}))return record.candidate.bridge.id;return 'terrain';};
  function supportsPose(x,z,heading,footprint=LURLEEN_SUPPORT_FOOTPRINT,{allowSteepTerrain=false}={}){
    const id=roadSupport(x,z),c=Math.cos(heading),s=Math.sin(heading);
    for(const p of footprint){world.sampleSelected(x+p.x*c+p.z*s,z-p.x*s+p.z*c,id,probe);if(!probe.valid||(!probe.traversable&&!(allowSteepTerrain&&probe.blockedReason==='grade'))||(!allowSteepTerrain&&(Math.abs(-probe.dx*s-probe.dz*c)>.3||Math.abs(probe.dx*c-probe.dz*s)>.25)))return false;}
    return true;
  }
  function binding(x,z,heading,footprint=LURLEEN_SUPPORT_FOOTPRINT,{allowSteepTerrain=false}={}){
    if(!supportsPose(x,z,heading,footprint,{allowSteepTerrain}))return null;
    try{return createSupportBinding(world,{x,z,heading,surfaceId:roadSupport(x,z)},{footprint,allowSteepTerrain});}catch(error){if(error instanceof RangeError)return null;throw error;}
  }
  function move(support,x,z,heading){const p=support.propose(x,z,proposal,heading);if(!p.valid||!p.traversable)return false;support.commit(x,z,p,heading);return true;}
  function findSpawn(x,z,heading,footprint=LURLEEN_SUPPORT_FOOTPRINT,{allowSteepTerrain=false}={}){
    const direct=binding(x,z,heading,footprint,{allowSteepTerrain});if(direct)return {x,z,binding:direct};
    const candidates=[];
    for(const road of runtime.access.roads({minX:x-200,maxX:x+200,minZ:z-200,maxZ:z+200})){const p=project({x,z},road.points);if(p)candidates.push(p);}
    for(const r of [20,40,80,160])for(let i=0;i<8;i++)candidates.push({x:x+Math.cos(i*Math.PI/4)*r,z:z+Math.sin(i*Math.PI/4)*r,dist:r});
    candidates.sort((a,b)=>a.dist-b.dist);
    for(const p of candidates){const support=binding(p.x,p.z,heading,footprint,{allowSteepTerrain});if(support)return {x:p.x,z:p.z,binding:support};}return null;
  }
  function nextTarget(from,target){
    for(const record of runtime.owners.values()){
      const plan=record.state.plan;if(!plan||!inside(record.candidate.bounds,from)&&!inside(record.candidate.bounds,target))continue;
      // A destination on another shelf or in the wooded clearing follows the
      // already admitted side-road/trail sequence. This is a local connector,
      // not a new infinite-world pathfinding or encounter system.
      world.sampleSelected(from.x,from.z,roadSupport(from.x,from.z),probe);const height=probe.height;
      world.sampleSelected(target.x,target.z,roadSupport(target.x,target.z),probe);
      if(probe.valid&&Math.abs(probe.height-height)<1.5)return target;
      const a=project(from,plan.route),b=project(target,plan.route);if(!a||!b)return target;
      if(a.dist>4)return {x:a.x,z:a.z};
      if(Math.abs(a.distance-b.distance)<4)return target;
      return along(plan.route,a.distance+Math.sign(b.distance-a.distance)*Math.min(12,Math.abs(b.distance-a.distance)));
    }return target;
  }
  return Object.freeze({world,supportsPose,binding,move,findSpawn,nextTarget,
    roadHeight:(x,z)=>world.sampleSelected(x,z,roadSupport(x,z),probe).height,
    roadsNear:(position,radius=160)=>runtime.access.roads({minX:position.x-radius,maxX:position.x+radius,minZ:position.z-radius,maxZ:position.z+radius}),
    height:(support,x,z)=>support.sample(x,z,probe).height,
    verticalOverlap(entry,y,height=3){const c=entry.collider;return c?.minY===undefined||c?.maxY===undefined||y<=entry.position.y+c.maxY&&y+height>=entry.position.y+c.minY;}});
}
