import { terrainGenerationKey, terrainEnabled, terrainHeight, lakeContains, lakeSurfaceHeight, LAKE_WATER_OFFSET } from './worldgen/terrain.js';
import { roadsInBounds } from './worldgen/roads.js';
import { lakesInBounds } from './worldgen/water.js';
import { landscapeCandidatesInBounds } from './worldgen/landscapeCandidates.js';
import { createStreamSampler } from './landscape/stream.js';
import { ribbonTriangles, footprintBounds } from './roadGeometry.js';

export const DRIVING_SURFACE_RADIUS = 80;
export const MAX_DRIVING_ROAD_TRIANGLES = 1024;
export const MAX_DRIVING_LAKES = 32;
const overlaps=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
const inside=(b,x,z)=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ;
function triangleContains(t,x,z) {
  let positive=false,negative=false;
  for(let i=0;i<3;i++){
    const a=t[i],b=t[(i+1)%3],d=(b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x);
    if(d>1e-8)positive=true;else if(d<-1e-8)negative=true;
  }
  return !(positive&&negative);
}

/** Prepare once per rendered update, then sample only the bounded local cache
 * from wheel contacts. A failed preparation keeps the previous cache intact. */
export function createDrivingSurface({landscape=null,registry=null}={}) {
  let current=null,disposed=false,queries=0,preparations=0,blockedReason=null;
  const waterScratch={};
  function prepare(position,deadline=Infinity) {
    if(disposed)return false;
    const {x,z}=position||{};
    if(!Number.isFinite(x)||!Number.isFinite(z))throw new RangeError('Driving position must be finite');
    const key=terrainGenerationKey();
    // Leave enough room for the complete wheel footprint before refreshing.
    if(current?.key===key&&Math.abs(x-current.x)<=40&&Math.abs(z-current.z)<=40){
      current.bridges.length=0;
      for(const {candidate}of current.records)if(candidate.bridge&&landscape?.owners?.get(candidate.id)?.water&&overlaps(current.bounds,candidate.bridge.bounds))current.bridges.push(candidate.bridge);
      blockedReason=null;return true;
    }
    if(performance.now()>=deadline){blockedReason='deadline';return false;}
    const r=DRIVING_SURFACE_RADIUS,bounds={minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r};
    const records=landscape?.access?.query(bounds)||[];
    if(records.some(({state})=>!['ready','rejected'].includes(state.status))){blockedReason='landscape-pending';return false;}
    queries++;
    const roads=roadsInBounds(bounds.minX,bounds.minZ,bounds.maxX,bounds.maxZ);
    for(const {candidate,state}of records)roads.push(...landscape.access.roadsFor(candidate,state));
    const triangles=[];let pointCount=0;
    for(const road of roads){
      pointCount+=road.points.length;
      if(pointCount>16384){blockedReason='road-work-capacity';return false;}
      const half=(road.width||7)/2,b=footprintBounds(road.points);
      if(!overlaps(bounds,{minX:b.minX-half,maxX:b.maxX+half,minZ:b.minZ-half,maxZ:b.maxZ+half}))continue;
      for(const triangle of ribbonTriangles(road.points,road.width||7,terrainEnabled()?5:Infinity)){
        const boundsOfTriangle=footprintBounds(triangle);
        if(!overlaps(bounds,boundsOfTriangle))continue;
        triangles.push({points:triangle,bounds:boundsOfTriangle,surface:road.surface==='asphalt'?'asphalt':'dirt'});
        if(triangles.length>MAX_DRIVING_ROAD_TRIANGLES){blockedReason='road-capacity';return false;}
      }
    }
    const lakes=lakesInBounds(bounds.minX,bounds.minZ,bounds.maxX,bounds.maxZ).filter(l=>overlaps(bounds,{minX:l.x-l.maxR,maxX:l.x+l.maxR,minZ:l.z-l.maxR,maxZ:l.z+l.maxR}));
    if(lakes.length>MAX_DRIVING_LAKES){blockedReason='lake-capacity';return false;}
    const legacy=[];let legacyOverflow=false;
    registry?.footprintsNear?.(x,z,r*Math.SQRT2,entry=>{
      if(entry.kind!=='lake'||lakes.some(l=>Math.hypot(l.x-entry.position.x,l.z-entry.position.z)<1))return;
      if(legacy.length+lakes.length>=MAX_DRIVING_LAKES){legacyOverflow=true;return;}
      legacy.push({x:entry.position.x,z:entry.position.z,maxR:entry.footprint,
        outline:entry.outline?.map(p=>({x:p.x+entry.position.x,z:p.z+entry.position.z})),
        surfaceY:entry.waterSurfaceY??lakeSurfaceHeight(entry)+LAKE_WATER_OFFSET});
    });
    if(legacyOverflow){blockedReason='lake-capacity';return false;}
    const streams=terrainEnabled()?landscapeCandidatesInBounds(bounds).filter(c=>c.stream).map(c=>({bounds:c.stream.bounds,sample:createStreamSampler(c.stream)})):[];
    const bridges=[];
    for(const {candidate}of records){
      const bridge=candidate.bridge;
      if(bridge&&landscape.owners?.get(candidate.id)?.water&&overlaps(bounds,bridge.bounds))bridges.push(bridge);
    }
    current={key,x,z,bounds,triangles,lakes,legacy,streams,bridges,records};
    preparations++;blockedReason=null;return true;
  }
  function available(x,z){return !disposed&&current?.key===terrainGenerationKey()&&inside(current.bounds,x,z);}
  function sampleWaterAtBed(x,z,out,bedY) {
    out.wet=false;out.surfaceY=bedY;out.bedY=bedY;out.depth=0;out.kind=null;
    if(!available(x,z))return out;
    let surfaceY=-Infinity,kind=null;
    for(const lake of current.lakes)if(lakeContains(lake,x,z)){surfaceY=lakeSurfaceHeight(lake)+LAKE_WATER_OFFSET;kind='lake';break;}
    for(const lake of current.legacy){
      if(Math.hypot(x-lake.x,z-lake.z)>lake.maxR||lake.outline&&!lakeContains(lake,x,z))continue;
      if(lake.surfaceY>surfaceY){surfaceY=lake.surfaceY;kind='lake';}
    }
    for(const stream of current.streams){
      if(!inside(stream.bounds,x,z))continue;
      stream.sample(x,z,waterScratch);
      if(waterScratch.coverage>=0&&waterScratch.height>bedY+.001&&waterScratch.height>surfaceY){surfaceY=waterScratch.height;kind='stream';}
    }
    if(kind&&surfaceY>bedY+.001){out.wet=true;out.surfaceY=surfaceY;out.depth=surfaceY-bedY;out.kind=kind;}
    return out;
  }
  function sampleWater(x,z,out={}) {
    return sampleWaterAtBed(x,z,out,terrainHeight(x,z));
  }
  function sampleSurface(x,z,out={},referenceY) {
    out.height=terrainHeight(x,z);out.surfaceClass='grass';out.surfaceId='terrain';
    if(!available(x,z))return out;
    // Reference height comes from the actual ray contact, not cart X/Z, so a
    // bridge slab and its submerged bed retain separate physical identities.
    for(const bridge of current.bridges)if(inside(bridge.bounds,x,z)&&Number.isFinite(referenceY)&&referenceY>=bridge.height-.05){
      out.height=bridge.height;out.surfaceClass='bridge';out.surfaceId=bridge.id;return out;
    }
    sampleWaterAtBed(x,z,waterScratch,out.height);
    if(waterScratch.wet&&waterScratch.depth>.15){out.surfaceClass='riverbed';return out;}
    for(const triangle of current.triangles){
      if(inside(triangle.bounds,x,z)&&triangleContains(triangle.points,x,z)){
        out.surfaceClass=triangle.surface;
        // Paved surfaces trim dirt ribbons in the renderer, including junctions.
        if(triangle.surface==='asphalt')break;
      }
    }
    return out;
  }
  return {prepare,sampleSurface,sampleWater,
    stats:()=>({disposed,preparations,queries,blockedReason,roadTriangles:current?.triangles.length||0,lakes:(current?.lakes.length||0)+(current?.legacy.length||0),streams:current?.streams.length||0}),
    dispose(){disposed=true;current=null;}};
}
