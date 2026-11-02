// Pure local occupancy for a generated terrain form. Actual builders still
// validate transformed furniture and entrances before publishing an owner.
import { mulberry32 } from '../rng.js';
import { planCampRecipe } from '../campPlanning.js';
const freezePoints=points=>Object.freeze(points.map(Object.freeze));
export function freezeLandscapePlan(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freezeLandscapePlan(child);Object.freeze(value);}return value;
}
const distanceToPath=(x,z,path)=>{
  let distance=Infinity;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
    distance=Math.min(distance,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
  }return distance;
};
export function createFormCamping(form,{attempt=0}={}) {
  if(!Number.isInteger(attempt)||attempt<0||attempt>2)throw new RangeError('At most three complete camp arrangements');
  const seed=(form.seed^Math.imul(attempt+1,0x43414D50))>>>0,rng=mulberry32(seed),camps=[],accessPaths=[];
  const top=form.shelves.at(-1),commons={x:(top.minX+top.maxX)/2,z:(top.minZ+top.maxZ)/2,radius:Math.min(26,(top.maxZ-top.minZ)/3)};
  for(let shelfIndex=0;shelfIndex<form.shelves.length;shelfIndex++) {
    const shelf=form.shelves[shelfIndex],sparse=shelf.density==='sparse',width=shelf.maxX-shelf.minX,depth=shelf.maxZ-shelf.minZ;
    const front=shelf.maxZ+10;
    let roadX=form.road.at(-1).x;
    for(let i=1;i<form.road.length;i++)if(front>=form.road[i].z){
      const a=form.road[i-1],b=form.road[i],t=(front-a.z)/(b.z-a.z);roadX=a.x+(b.x-a.x)*Math.max(0,Math.min(1,t));break;
    }
    const paths=[freezePoints([{x:roadX,z:front},{x:shelf.minX+8,z:front}])];
    if(!sparse)for(const f of [1/3,2/3]){
      const x=shelf.minX+width*f;paths.push(freezePoints([{x,z:front},{x,z:shelf.minZ+4}]));
    }
    accessPaths.push(...paths);
    function eligible(x,z,radius) {
      if(x-radius<shelf.minX||x+radius>shelf.maxX||z-radius<shelf.minZ||z+radius>shelf.maxZ)return false;
      if(paths.some(path=>distanceToPath(x,z,path)<radius+5))return false;
      if(sparse&&Math.hypot(x-commons.x,z-commons.z)<commons.radius+radius)return false;
      return !camps.some(p=>{
        // Sleeping pitches can share empty reservation ground, but host hearths
        // retain their larger clearance. Real furniture/doors are checked later.
        const separation=!sparse&&radius===6.5&&p.role==='satellite'?10.5:p.clearance+radius+1;
        return Math.hypot(x-p.x,z-p.z)<separation;
      });
    }
    function add(x,z,role) {
      const index=camps.length,recipe=planCampRecipe('small',{role,tightSleeping:true,archetype:role==='satellite'?'light-travelers':undefined,seed:seed^index});
      camps.push({id:`${form.id}:camp:${attempt}:${index}`,x,z,size:'small',shelf:shelf.id,role,recipe,clearance:role==='host'?14:6.5,facing:role==='host'?(rng()-.5)*.8:sparse?rng()*Math.PI*2:(x<shelf.minX+width*2/3?Math.PI/2:-Math.PI/2)+(rng()-.5)*.5});
    }
    let hosts=0;
    for(const fraction of sparse?[.1,.9]:width*depth>9000?[.15,.85]:[.5]) {
      const x=shelf.minX+14+(width-28)*fraction,z=(shelf.minZ+shelf.maxZ)/2+(rng()-.5)*Math.max(0,depth-32);
      if(eligible(x,z,14)){add(x,z,'host');hosts++;}
    }
    if(!hosts)return {valid:false,reason:`host-capacity:${shelf.id}`};
    const target=sparse?5:Math.min(40,Math.max(12,Math.floor(width*depth/180))),minimum=sparse?2:3;
    let admitted=0;
    for(let i=0;i<512&&admitted<target;i++){
      const x=shelf.minX+8+rng()*(width-16),z=shelf.minZ+8+rng()*(depth-16);
      if(!eligible(x,z,6.5))continue;add(x,z,'satellite');admitted++;
    }
    if(admitted<minimum)return {valid:false,reason:`sleeping-capacity:${shelf.id}`};
  }
  return freezeLandscapePlan({valid:true,reason:null,id:form.id,seed:form.seed,camps,accessPaths,commons,
    meadowFire:form.hasMeadowFire?{x:commons.x,z:top.maxZ-12,radius:2}:null,
    clearing:{...form.clearing,drum:form.hasDrumClearing},mainRoad:form.mainRoad,narrowPath:form.narrowPath,route:form.route,
    visitorRoute:[...form.road.slice(0,-1),{x:form.road.at(-1).x,z:top.maxZ+10},{x:commons.x,z:top.maxZ+10},{x:commons.x,z:commons.z}],
    shelves:form.shelves,ports:form.ports,bounds:form.bounds,
    woodland:{bounds:{minX:Math.min(...form.shelves.map(s=>s.minX))-16,maxX:form.road.at(-1).x+36,minZ:form.clearing.z-42,maxZ:-form.turn-18},step:12},
    frame:{origin:{x:0,z:0},turns:0}});
}
