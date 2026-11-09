// Independent processes isolate module caches; the parent declares ABBA order.
import {setSessionSeed} from '../../../src/rng.js';
import {setLandscapeVersion} from '../../../src/worldgen/landscapeCandidates.js';
const variant=process.argv[2];
if(!['legacy','current'].includes(variant))throw Error('Choose legacy or current');
const sampler=await import(variant==='legacy'?'./legacy-terrain.js':'../../../src/worldgen/terrain.js');
setSessionSeed(1977);setLandscapeVersion(2);sampler.setTerrainEnabled(true);
const out={},points=Array.from({length:1024},(_,i)=>[-1400+(i%32)*3.17,-1500+Math.floor(i/32)*3.29]);
const rounds=120000,results={};
for(const method of ['sampleTerrainGround','sampleTerrain']){
  let checksum=0;
  const cold=performance.now();for(const [x,z]of points)checksum+=sampler[method](x,z,out).height;
  const coldMs=performance.now()-cold;
  for(let i=0;i<10000;i++){const p=points[i%points.length];sampler[method](p[0],p[1],out);}
  const times=[];
  for(let repeat=0;repeat<3;repeat++){
    const start=performance.now();
    for(let i=0;i<rounds;i++){const p=points[i%points.length];sampler[method](p[0],p[1],out);checksum+=out.height+out.nx+out.nz;}
    times.push(performance.now()-start);
  }
  results[method]={coldMs,times,checksum};
}
console.log(JSON.stringify({variant,rounds,pointCount:points.length,results,cache:sampler.terrainCacheStats(),scope:'Node sampler operation cost; not game FPS or iPad evidence'}));
