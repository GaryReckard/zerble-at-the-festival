import {setSessionSeed} from '../../../src/rng.js';
import {setLandscapeVersion} from '../../../src/worldgen/landscapeCandidates.js';
const variant=process.argv[2];
if(!['legacy','rejected','current'].includes(variant))throw Error('Choose legacy, rejected or current');
const terrain=await import(variant==='legacy'?'./legacy-terrain.js':variant==='rejected'?'./rejected-terrain.js':'../../../src/worldgen/terrain.js');
setSessionSeed(1977);setLandscapeVersion(2);terrain.setTerrainEnabled(true);
// Ground-mesh recentering queries a grid larger than the cell-cache capacity.
// Prewarm the underlying vertex field so descriptor planning is not timed.
const side=100,startX=-1500,startZ=-1500,out={};
for(let z=0;z<=side;z++)for(let x=0;x<=side;x++)terrain.terrainVertexHeight(startX+x*10,startZ+z*10);
const times=[];let checksum=0;
for(let pass=0;pass<6;pass++){
 const start=performance.now();
 for(let z=0;z<side;z++)for(let x=0;x<side;x++){
  terrain.sampleTerrainGround(startX+x*10+.23,startZ+z*10+.71,out);checksum+=out.height+out.nx+out.nz;
 }
 times.push(performance.now()-start);
}
console.log(JSON.stringify({variant,cells:side*side,passes:times,checksum,cache:terrain.terrainCacheStats(),scope:'Offline cache-capacity churn with prewarmed vertices; not game FPS'}));
