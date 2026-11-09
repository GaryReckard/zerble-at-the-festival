// Instrumented Node attribution only; do not use as a frame-time comparison.
import {PerformanceObserver} from 'node:perf_hooks';
import {setSessionSeed} from '../../../src/rng.js';
import {setLandscapeVersion} from '../../../src/worldgen/landscapeCandidates.js';
import {createGroundFixture,recordedScenarioCenters,productionSourceSha256} from './ground-fixture.mjs';
const variant=process.argv[2],file={legacy:'./legacy-terrain.js',rejected:'./rejected-terrain.js',current:'../../../src/worldgen/terrain.js'}[variant];
if(!file)throw Error('Choose legacy, rejected or current');
const terrain=await import(file),gc=[];
const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())gc.push({start:e.startTime,ms:e.duration,detail:e.detail});});
observer.observe({entryTypes:['gc']});
setSessionSeed(2404796662);setLandscapeVersion(2);terrain.setTerrainEnabled(true);
const fixture=createGroundFixture(terrain),centers=recordedScenarioCenters(fixture.snap);
try{
  for(const p of centers)fixture.update(...p);
  await new Promise(setImmediate);
  const heapBefore=process.memoryUsage().heapUsed,cpuBefore=process.cpuUsage(),start=performance.now(),rows=[];
  for(const center of centers){
    const begin=performance.now(),cpu=process.cpuUsage();fixture.update(...center);const end=performance.now(),used=process.cpuUsage(cpu);
    rows.push({center,start:begin,end,wallMs:end-begin,userMs:used.user/1000,systemMs:used.system/1000});
  }
  const end=performance.now(),used=process.cpuUsage(cpuBefore),heapAfter=process.memoryUsage().heapUsed;
  // GC entries are delivered asynchronously after the synchronous CPU work.
  await new Promise(setImmediate);await new Promise(setImmediate);
  const relevant=gc.filter(e=>e.start<end&&e.start+e.ms>start);
  console.log(JSON.stringify({variant,productionSourceSha256,scope:'One instrumented Node attribution run; uncontrolled foreground CPU activity; not browser acceptance or a repeatable timing verdict',
    wallMs:end-start,userMs:used.user/1000,systemMs:used.system/1000,heapBefore,heapAfter,cache:terrain.terrainCacheStats(),
    gcEvents:relevant,gcMs:relevant.reduce((n,e)=>n+e.ms,0),rows}));
}finally{observer.disconnect();fixture.dispose();}
