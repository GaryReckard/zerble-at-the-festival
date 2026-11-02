// Downstream context construction, suitable for a worker. Raw candidates and
// final terrain never import this module or occupied admission.
import { getSessionSeed } from '../rng.js';
import { roadsInBounds } from './roads.js';
import { heartsInBounds } from './hearts.js';
import { lakesInBounds } from './water.js';
import { festivalPlan,campVillagesNear,MAX_POI_REACH } from './festival.js';
import { clusterExtent,clusterShapes } from './tuning.js';
import { woodlandCampsNear } from '../woodlandCamping.js';
import { sampleTerrain,terrainEnabled,terrainGenerationKey } from './terrain.js';
import { landscapeVersion,landscapeCandidatesInBounds,landscapeDeckSource } from './landscapeCandidates.js';
import { createSupportWorld } from '../landscape/support.js';
let surfaceKey='',surface=null;
export function landscapeTerrainSurface() {
  const key=terrainGenerationKey();
  if(key!==surfaceKey){surfaceKey=key;surface=Object.freeze({id:`terrain:${key}`,sampleTerrain,supportWorld:createSupportWorld({sampleTerrain,deckSource:landscapeDeckSource,isCurrent:()=>terrainGenerationKey()===key})});}
  return surface;
}
export function landscapeContextFor(candidate) {
  if(!terrainEnabled()||candidate.worldSeed!==getSessionSeed()||candidate.version!==landscapeVersion())throw new RangeError('Landscape context does not match the active terrain');
  const p=candidate.ports[0],reach=610,b={minX:p.x-reach,maxX:p.x+reach,minZ:p.z-reach,maxZ:p.z+reach},roads=roadsInBounds(b.minX,b.minZ,b.maxX,b.maxZ),obstacles=[],shapes=[],seen=new Set();
  const add=d=>{
    const id=`${d.kind}:${d.clusterSeed}:${d.x},${d.z}`;if(seen.has(id))return;seen.add(id);
    const radius=Math.max(d.footprint||0,clusterExtent(d.kind,d.scale||1));
    if(d.x+radius<b.minX||d.x-radius>b.maxX||d.z+radius<b.minZ||d.z-radius>b.maxZ)return;
    shapes.push(...clusterShapes(d.kind,d.scale||1,d.x,d.z,d.yaw||0));
  };
  for(const h of heartsInBounds(b.minX-MAX_POI_REACH,b.minZ-MAX_POI_REACH,b.maxX+MAX_POI_REACH,b.maxZ+MAX_POI_REACH))for(const d of festivalPlan(h))add(d);
  for(const d of campVillagesNear(b))add(d);
  for(const owner of woodlandCampsNear(b))for(const pitch of owner.pitches)obstacles.push({position:{x:pitch.worldx,z:pitch.worldz},radius:pitch.footprint});
  for(const lake of lakesInBounds(b.minX-400,b.minZ-400,b.maxX+400,b.maxZ+400)){
    if(lake.x+lake.maxR+49<b.minX||lake.x-lake.maxR-49>b.maxX||lake.z+lake.maxR+49<b.minZ||lake.z-lake.maxR-49>b.maxZ)continue;
    obstacles.push({position:{x:lake.x,z:lake.z},radius:lake.maxR+49});
  }
  const reservations=landscapeCandidatesInBounds(b).filter(c=>c.id!==candidate.id).map(c=>c.bounds);
  return {surface:landscapeTerrainSurface(),roads,obstacles,shapes,reservations,getKey:terrainGenerationKey};
}
