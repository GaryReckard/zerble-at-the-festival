// Upstream reservations only. Hearts/water/roads may read these without calling
// final terrain or occupied-district admission, so the planning graph is acyclic.
import { cellRng,getSessionSeed } from '../rng.js';
import { bumpWorldgen,worldgenEpoch } from './constants.js';
import { LANDSCAPE_FORM_IDS,createLandscapeForm,formVertexHeight } from '../landscape/forms.js';
import { createFiniteStream,createStreamSampler } from '../landscape/stream.js';
export const LANDSCAPE_CELL=1600;
export const LANDSCAPE_CANDIDATE_LIMIT=128;
export const LANDSCAPE_QUERY_CELL_LIMIT=64;
const HALF_LIMIT=560,SALT=0x4C4E4453,cache=new Map();
let version=1,gateKey='';
export function landscapeVersion(){return version;}
export function setLandscapeVersion(value){
  if(value!==1&&value!==2)throw new RangeError('Unsupported landscape version');
  if(value!==version){version=value;bumpWorldgen();cache.clear();gateKey='';}
  return version;
}
function gate(){const key=`${getSessionSeed()}:${worldgenEpoch()}:${version}`;if(key!==gateKey){cache.clear();gateKey=key;}}
const inside=(b,x,z)=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ;
const intersects=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
const waterSamplers=new WeakMap(),NO_DECKS=Object.freeze([]);
export function landscapeToWorld(candidate,x,z,out={}) {
  const {turns,origin}=candidate;
  if(turns===1){out.x=origin.x-z;out.z=origin.z+x;}
  else if(turns===2){out.x=origin.x-x;out.z=origin.z-z;}
  else if(turns===3){out.x=origin.x+z;out.z=origin.z-x;}
  else {out.x=origin.x+x;out.z=origin.z+z;}
  return out;
}
export function landscapeToLocal(candidate,x,z,out={}) {
  const dx=x-candidate.origin.x,dz=z-candidate.origin.z;
  if(candidate.turns===1){out.x=dz;out.z=-dx;}
  else if(candidate.turns===2){out.x=-dx;out.z=-dz;}
  else if(candidate.turns===3){out.x=-dz;out.z=dx;}
  else {out.x=dx;out.z=dz;}return out;
}
export function landscapeCandidateInCell(cx,cz) {
  if(!Number.isSafeInteger(cx)||!Number.isSafeInteger(cz)||!Number.isSafeInteger(cx*LANDSCAPE_CELL)||!Number.isSafeInteger(cz*LANDSCAPE_CELL))throw new RangeError('Invalid landscape cell');
  if(version===1)return null;gate();
  const key=`${cx},${cz}`;
  if(cache.has(key))return cache.get(key);
  const rng=cellRng(cx,cz,SALT);let result=null;
  if(rng()<.55) {
    const seed=Math.floor(rng()*4294967296)>>>0,form=LANDSCAPE_FORM_IDS[Math.floor(rng()*LANDSCAPE_FORM_IDS.length)],plan=createLandscapeForm(seed,form);
    const turns=Math.floor(rng()*4),centerX=(cx+.5)*LANDSCAPE_CELL+(Math.floor(rng()*17)-8)*10,
      centerZ=(cz+.5)*LANDSCAPE_CELL+(Math.floor(rng()*17)-8)*10;
    const midX=Math.round((plan.bounds.minX+plan.bounds.maxX)/20)*10,midZ=Math.round((plan.bounds.minZ+plan.bounds.maxZ)/20)*10;
    const origin={x:0,z:0},stub={turns,origin},offset=landscapeToWorld(stub,midX,midZ);
    origin.x=centerX-offset.x;origin.z=centerZ-offset.z;
    const corners=[[plan.bounds.minX,plan.bounds.minZ],[plan.bounds.maxX,plan.bounds.minZ],[plan.bounds.minX,plan.bounds.maxZ],[plan.bounds.maxX,plan.bounds.maxZ]].map(([x,z])=>landscapeToWorld(stub,x,z));
    const bounds=Object.freeze({minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minZ:Math.min(...corners.map(p=>p.z)),maxZ:Math.max(...corners.map(p=>p.z))});
    // Every complete terrain influence fits inside its own macrocell. Disjoint terrain cells
    // therefore need neither recursive winner selection nor query-order state.
    // Occupied admission separately owns its bounded external access spur.
    if(bounds.minX<centerX-HALF_LIMIT||bounds.maxX>centerX+HALF_LIMIT||bounds.minZ<centerZ-HALF_LIMIT||bounds.maxZ>centerZ+HALF_LIMIT)throw new RangeError('Landscape form exceeds declared influence');
    const kind=rng()<.7?'mountain-top':'wooded-ridge',heightScale=kind==='mountain-top'?1:1.5+rng();
    const ports=Object.freeze(plan.ports.map(p=>Object.freeze({...p,...landscapeToWorld(stub,p.x,p.z),id:`landscape:2:${getSessionSeed()}:${cx},${cz}:${p.id}`})));
    const id=`landscape:2:${getSessionSeed()}:${cx},${cz}`;
    const rectangle=b=>{
      const p=[[b.minX,b.minZ],[b.maxX,b.minZ],[b.minX,b.maxZ],[b.maxX,b.maxZ]].map(([x,z])=>landscapeToWorld(stub,x,z));
      return Object.freeze({minX:Math.min(...p.map(v=>v.x)),maxX:Math.max(...p.map(v=>v.x)),minZ:Math.min(...p.map(v=>v.z)),maxZ:Math.max(...p.map(v=>v.z))});
    };
    const bridge=kind==='mountain-top'?Object.freeze({...plan.bridge,id:`${id}:bridge:0`,bounds:rectangle(plan.bridge.bounds),approaches:Object.freeze(plan.bridge.approaches.map(rectangle))}):null;
    const stream=kind==='mountain-top'?createFiniteStream({...plan.stream,id:`${id}:stream:0`,points:plan.stream.points.map(p=>({...p,...landscapeToWorld(stub,p.x,p.z)})),receiver:{...plan.stream.receiver,...landscapeToWorld(stub,plan.stream.receiver.x,plan.stream.receiver.z)}}):null;
    result=Object.freeze({id,version:2,worldSeed:getSessionSeed(),cx,cz,seed,kind,heightScale,turns,origin:Object.freeze(origin),bounds,ports,plan,bridge,stream});
  }
  if(cache.size>=LANDSCAPE_CANDIDATE_LIMIT)cache.delete(cache.keys().next().value);
  cache.set(key,result);return result;
}
export function landscapeCandidatesInBounds(bounds) {
  if(!bounds||![bounds.minX,bounds.maxX,bounds.minZ,bounds.maxZ].every(Number.isFinite)||bounds.minX>bounds.maxX||bounds.minZ>bounds.maxZ)throw new RangeError('Landscape bounds must be finite and ordered');
  if(version===1)return [];
  const x0=Math.floor(bounds.minX/LANDSCAPE_CELL),x1=Math.floor(bounds.maxX/LANDSCAPE_CELL),z0=Math.floor(bounds.minZ/LANDSCAPE_CELL),z1=Math.floor(bounds.maxZ/LANDSCAPE_CELL);
  if((x1-x0+1)*(z1-z0+1)>LANDSCAPE_QUERY_CELL_LIMIT)throw new RangeError('Landscape query exceeds its declared cell limit');
  const result=[];
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
    const candidate=landscapeCandidateInCell(x,z);if(candidate&&intersects(candidate.bounds,bounds))result.push(candidate);
  }
  return result;
}
export function landscapeCandidateAt(x,z) {
  if(!Number.isFinite(x)||!Number.isFinite(z))throw new TypeError('Landscape point must be finite');
  const candidate=landscapeCandidateInCell(Math.floor(x/LANDSCAPE_CELL),Math.floor(z/LANDSCAPE_CELL));
  return candidate&&inside(candidate.bounds,x,z)?candidate:null;
}
export function landscapeReservationIntersects(bounds,padding=0) {
  if(version===1)return false;
  if(!Number.isFinite(padding)||padding<0)throw new RangeError('Invalid landscape reservation margin');
  return landscapeCandidatesInBounds({minX:bounds.minX-padding,maxX:bounds.maxX+padding,minZ:bounds.minZ-padding,maxZ:bounds.maxZ+padding}).length>0;
}
const local={};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function landscapeInfluence(x,z,out={}) {
  const candidate=landscapeCandidateAt(x,z);
  if(!candidate){out.weight=0;out.height=0;return out;}
  landscapeToLocal(candidate,x,z,local);
  const b=candidate.plan.bounds,margin=Math.min(local.x-b.minX,b.maxX-local.x,local.z-b.minZ,b.maxZ-local.z);
  out.weight=smooth(margin/80);out.height=formVertexHeight(candidate.plan,local.x,local.z,candidate.kind==='mountain-top')*candidate.heightScale;return out;
}
const influence={};
export function landscapeVertexHeight(x,z,baseHeight=0) {
  landscapeInfluence(x,z,influence);return baseHeight*(1-influence.weight)+influence.height*influence.weight;
}

export function clearLandscapeCandidates(){cache.clear();}
export function landscapeCandidateStats(){gate();return {version,cached:cache.size,limit:LANDSCAPE_CANDIDATE_LIMIT};}

export const landscapeDeckSource=Object.freeze({
  near(x,z){const c=landscapeCandidateAt(x,z);return c?.bridge?[c.bridge]:NO_DECKS;},
  resolve(id){
    const match=/^landscape:2:(-?\d+):(-?\d+),(-?\d+):bridge:0$/.exec(id);
    if(!match||version!==2||Number(match[1])!==getSessionSeed())return null;
    const candidate=landscapeCandidateInCell(Number(match[2]),Number(match[3]));return candidate?.bridge?.id===id?candidate.bridge:null;
  }
});
export function landscapeWaterAt(x,z,out={}) {
  const candidate=landscapeCandidateAt(x,z);
  if(!candidate?.stream){out.height=0;out.coverage=-1;return out;}
  let sample=waterSamplers.get(candidate);if(!sample){sample=createStreamSampler(candidate.stream);waterSamplers.set(candidate,sample);}
  return sample(x,z,out);
}
