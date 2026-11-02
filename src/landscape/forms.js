// Pure, finite terrain grammar. The authored photo course remains a separate
// regression specimen; generated forms change elevations, shelves and routes.
import { mulberry32 } from '../rng.js';
import { createTriangleSampler } from './geometry.js';
import { createSupportWorld } from './support.js';
import { validateRoute } from './routes.js';
import { createFiniteStream,cutStreamBed,createStreamSampler } from './stream.js';
export const LANDSCAPE_FORM_IDS=Object.freeze(['paired-meadows','long-ridge','three-shelves']);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const freezePoints=values=>Object.freeze(values.map(Object.freeze));
const templates=Object.freeze({
  'paired-meadows':{steps:[[80,170,8,80,170],[250,270,11,220,350]],shelves:[[190,230],[370,440]],turn:460,road:[[80,12],[80,-460]],lefts:[-120,-145]},
  'long-ridge':{steps:[[80,200,12,80,200],[300,325,16,260,440]],shelves:[[220,280],[460,540]],turn:560,road:[[100,12],[100,-220],[80,-250],[80,-560]],lefts:[-155,-120]},
  'three-shelves':{steps:[[70,160,7,70,160],[240,260,9,200,320],[370,390,11,330,480]],shelves:[[180,220],[300,350],[500,570]],turn:590,road:[[90,12],[90,-180],[70,-220],[70,-320],[90,-350],[90,-590]],lefts:[-115,-155,-135]},
});
export function createLandscapeForm(seed=1977,form='paired-meadows') {
  if(!Number.isSafeInteger(seed)||!LANDSCAPE_FORM_IDS.includes(form))throw new TypeError('Invalid landscape form identity');
  const rng=mulberry32(seed^0x464F524D),t=templates[form],shift=(Math.floor(rng()*3)-1)*10;
  let height=0;
  const steps=t.steps.map(([start,end,rise,roadStart,roadEnd])=>Object.freeze({start,end,rise:rise+Math.floor(rng()*3)-1,roadStart,roadEnd}));
  const shelves=t.shelves.map(([front,back],i)=>{
    height+=steps[i].rise;
    return Object.freeze({id:`shelf:${i}`,minX:t.lefts[i]+Math.floor(rng()*3)*10,maxX:35+shift,minZ:-back,maxZ:-front,height,
      density:i===t.shelves.length-1?'sparse':'compact'});
  });
  const road= t.road.map(([x,z])=>({x:x+shift,z}));
  const topSide=road.at(-1).x,turn=t.turn,drop=6+Math.floor(rng()*5),woodStart=turn+6,woodLength=Math.ceil(drop/.22)+4,woodEnd=woodStart+woodLength;
  const clearingX=Math.round(shelves.at(-1).minX/20)*10,clearingZ=-(woodEnd+24);
  const mainRoad=freezePoints([...road,{x:shelves.at(-1).minX+14,z:-turn}]);
  const narrowPath=freezePoints([{x:clearingX+36,z:-turn},{x:clearingX+32,z:-(woodStart+10)},
    {x:clearingX+22,z:-woodEnd},{x:clearingX+20,z:clearingZ}]);
  const route=freezePoints([...road,...narrowPath]);
  const bounds=Object.freeze({minX:Math.min(...shelves.map(s=>s.minX))-120,maxX:Math.max(...road.map(p=>p.x))+230,minZ:Math.floor((clearingZ-150)/10)*10,maxZ:120});
  const result={id:`form:${form}:${seed}`,seed,form,steps:Object.freeze(steps),shelves:Object.freeze(shelves),road:freezePoints(road),mainRoad,narrowPath,route,
    turn,woodStart,woodEnd,drop,topHeight:height,bounds,
    clearing:Object.freeze({x:clearingX,z:clearingZ,height:height-drop,radius:18,facing:0}),
    ports:freezePoints([{id:'entry',...road[0],width:12,surfaceId:'terrain'}]),
    hasMeadowFire:rng()<.7,hasDrumClearing:rng()<.8};
  const roadX=road[0].x,source={x:shelves[0].minX+28,z:-120},bend={x:roadX-40,z:-30},mouth={x:roadX+85,z:-30},points=[];
  let level=Infinity;
  for(const [a,b] of [[source,bend],[bend,mouth]]) {
    const count=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/10);
    for(let i=points.length?1:0;i<=count;i++){
      const x=a.x+(b.x-a.x)*i/count,z=a.z+(b.z-a.z)*i/count;
      // The complete lowland stream stays below the surrounding zero datum.
      // A high source-center sample alone would allow water to float above a
      // lower neighboring bank on this coarse grid.
      level=Math.min(level-.006,-.5,baseFormVertexHeight(result,x,z)-.5);points.push({x,z,height:level});
    }
  }
  // On the 10m grid, banks must end before the endpoint's adjoining triangle.
  // Both whole-cart approaches then remain exactly level beneath the deck.
  result.stream=createFiniteStream({id:`${result.id}:stream`,points,bankWidth:18,receiver:{...mouth,height:level,radius:18}});
  result.bridge=Object.freeze({id:`${result.id}:bridge`,height:0,bounds:Object.freeze({minX:roadX-12,maxX:roadX+12,minZ:-60,maxZ:0}),
    approaches:Object.freeze([{minX:roadX-12,maxX:roadX+12,minZ:-8,maxZ:10},{minX:roadX-12,maxX:roadX+12,minZ:-70,maxZ:-52}].map(Object.freeze))});
  return Object.freeze(result);
}
function interpolate(points,d,coordinate) {
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],ad=-a.z,bd=-b.z;
    if(d<=bd)return a[coordinate]+(b[coordinate]-a[coordinate])*Math.max(0,Math.min(1,(d-ad)/(bd-ad)));
  }
  return points.at(-1)[coordinate];
}
export function baseFormVertexHeight(plan,x,z) {
  const d=-z;
  let direct=0,road=0;
  for(const s of plan.steps){direct+=s.rise*smooth((d-s.start)/(s.end-s.start));road+=s.rise*smooth((d-s.roadStart)/(s.roadEnd-s.roadStart));}
  const roadX=interpolate(plan.road,d,'x'),roadWeight=1-smooth((Math.abs(x-roadX)-20)/30);
  let height=direct*(1-roadWeight)+road*roadWeight;
  const length=plan.woodEnd-plan.woodStart,t=Math.max(0,Math.min(length,d-plan.woodStart));
  const ramp=t<3?t*t/6:t>length-3?length-3-(length-t)*(length-t)/6:t-1.5;
  height-=plan.drop*ramp/(length-3);
  // A finite apron returns to the existing terrain datum; only wilderness uses
  // the shoulders. Occupied shelves and the complete clearing stay in the core.
  const left=Math.min(...plan.shelves.map(s=>s.minX));
  const lateral=(1-smooth((left-x)/100))*(1-smooth((x-roadX-30)/100));
  const back=1-smooth((d+plan.clearing.z-55)/90);
  return height*lateral*back;
}
export function formVertexHeight(plan,x,z,includeWater=true) {
  const ground=baseFormVertexHeight(plan,x,z);return includeWater&&plan.stream?cutStreamBed(plan.stream,x,z,ground):ground;
}
export function createFormSurface(plan,{step=10,cacheLimit=8192}={}) {
  const sampler=createTriangleSampler((x,z)=>formVertexHeight(plan,x,z),{stepX:step,stepZ:step,bounds:plan.bounds,cacheLimit});
  const water=createStreamSampler(plan.stream,{step}),wet={};
  const sampleTerrain=(x,z,out={})=>{sampler.sample(x,z,out);water(x,z,wet);if(wet.coverage>=0&&wet.height>out.height+.001){out.traversable=false;out.blockedReason='water';out.surfaceClass='riverbed';}return out;};
  const supportWorld=createSupportWorld({sampleTerrain,decks:[plan.bridge]});
  return Object.freeze({sampleTerrain,supportWorld,geometry:sampler,plan});
}
export function validateLandscapeForm(plan) {
  const surface=createFormSurface(plan),main=validateRoute(surface.supportWorld,plan.mainRoad),
    trail=validateRoute(surface.supportWorld,plan.narrowPath,{halfWidth:2.8,maxGrade:.3});
  return {valid:main.valid&&trail.valid,reason:!main.valid?`main:${main.reason}`:!trail.valid?`trail:${trail.reason}`:null,main,trail,cachedVertices:surface.geometry.cachedVertices};
}
