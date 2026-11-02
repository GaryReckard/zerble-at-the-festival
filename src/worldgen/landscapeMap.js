// Worker-side geography uses the same finite district admission as the live
// planner. It owns a bounded cache, with no scene or main-thread authority.
import {terrainGenerationKey} from './terrain.js';
import {landscapeVersion} from './landscapeCandidates.js';
import {landscapeContextFor} from './landscapeContext.js';
import {createLandscapeAdmission} from './landscape.js';
import {LandscapeAccessIndex} from '../landscape/accessIndex.js';
const states=new Map();let generation='';
function state(candidate){
  if(states.has(candidate.id))return states.get(candidate.id);
  const context=landscapeContextFor(candidate),job=createLandscapeAdmission(candidate,context);
  let steps=0;while(!job.done){job.step({maxSteps:128,deadline:Infinity});if(++steps>10000)throw new Error('Map landscape admission limit');}
  const result={...job.result,status:job.result.valid?'ready':'rejected'};
  if(states.size>=64)states.delete(states.keys().next().value);states.set(candidate.id,result);return result;
}
const access=new LandscapeAccessIndex({request:state,read:c=>states.get(c.id)});
export function landscapeMapFeatures(bounds){
  if(landscapeVersion()!==2)return {roads:[],lakes:[],clearance:()=>false};
  const key=terrainGenerationKey();if(key!==generation){states.clear();generation=key;}
  const records=access.query(bounds),roads=[],lakes=[];
  for(const {candidate,state}of records){
    if(candidate.kind!=='mountain-top')continue;
    roads.push(...access.roadsFor(candidate,state));
    const stream=candidate.stream,left=[],right=[];
    for(let i=0;i<stream.points.length;i++){
      const p=stream.points[i],a=stream.points[Math.max(0,i-1)],b=stream.points[Math.min(stream.points.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1,width=stream.halfWidth;
      left.push({x:p.x-dz/length*width,z:p.z+dx/length*width});right.push({x:p.x+dz/length*width,z:p.z-dx/length*width});
    }
    lakes.push({outline:[...left,...right.reverse()]});
    const receiver=stream.receiver;lakes.push({outline:Array.from({length:24},(_,i)=>({x:receiver.x+Math.cos(i*Math.PI/12)*receiver.radius,z:receiver.z+Math.sin(i*Math.PI/12)*receiver.radius}))});
  }
  return {roads,lakes,clearance:(x,z,r=0)=>access.clearance(x,z,r)};
}
