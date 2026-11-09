// Offline CPU experiment, not browser frame delivery. Each process owns all
// sampler caches and real Three.js geometry; no renderer is constructed.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {setSessionSeed} from '../../../src/rng.js';
import {setLandscapeVersion} from '../../../src/worldgen/landscapeCandidates.js';
import {createGroundFixture,recordedScenarioCenters,productionSourceSha256} from './ground-fixture.mjs';

const variant=process.argv[2];
const file={pooled:'./pooled-terrain.js',lattice:'../../../src/worldgen/terrain.js'}[variant];
if(!file)throw Error('Choose pooled or lattice');
const terrain=await import(file);
setSessionSeed(2404796662);setLandscapeVersion(2);terrain.setTerrainEnabled(true);
const fixture=createGroundFixture(terrain),centers=recordedScenarioCenters(fixture.snap);
try{
  const first=performance.now();fixture.update(...centers[0]);const coldMs=performance.now()-first;
  // Warm the complete route, including color and normal work. Subsequent
  // sweeps exceed the rejected cell cache while underlying vertices stay warm.
  const startWarm=performance.now();for(const center of centers)fixture.update(...center);
  const warmupMs=performance.now()-startWarm,rows=[];
  for(const center of centers){const start=performance.now();fixture.update(...center);rows.push({center,ms:performance.now()-start});}
  const hash=createHash('sha256'),geometry=fixture.mesh.geometry;
  for(const name of ['position','normal','color','uv']){
    const a=geometry.attributes[name].array;hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
  }
  hash.update(JSON.stringify({bounds:geometry.boundingSphere,offset:fixture.mesh.material.map.offset}));
  console.log(JSON.stringify({variant,vertices:geometry.attributes.position.count,centerCount:centers.length,coldMs,warmupMs,rows,
    totalMeasuredMs:rows.reduce((n,r)=>n+r.ms,0),finalGeometrySha256:hash.digest('hex'),cache:terrain.terrainCacheStats(),
    productionSourceSha256,samplerFileSha256:createHash('sha256').update(readFileSync(new URL(file,import.meta.url))).digest('hex'),
    scope:'Node production resampling/color/normal/bounds CPU work on real Three geometry; no renderer, browser, GPU or FPS measurement; Reserved Mac, separate Node processes; no simultaneous browser capture'}));
}finally{fixture.dispose();}
