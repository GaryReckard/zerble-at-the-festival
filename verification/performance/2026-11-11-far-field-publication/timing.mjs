// Offline Node CPU probe. Not a browser, GPU, device or frame-rate measurement.
// Usage: node <this file> [args]   (ZERBLE_ROOT=<dir> points it at another source tree)
const ROOT=process.env.ZERBLE_ROOT?new URL(process.env.ZERBLE_ROOT.replace(/\/?$/,"/"),"file://").href:new URL("../../../",import.meta.url).href;
// Per-call far-field cost along a straight drive, in frames, at a 3 ms budget remainder.
import {register} from 'node:module';
register(new URL(ROOT+'bin/node-three-shim.mjs'));
globalThis.window={innerWidth:1024,innerHeight:768};
const info=console.info;console.info=()=>{};
const {FarField}=await import(ROOT+'src/farField.js');
const {FAR_FIELD_TIERS}=await import(ROOT+'src/perf.js');
const {setSeed}=await import(ROOT+'src/worldgen/index.js');
const T=await import(ROOT+'src/worldgen/terrain.js');
console.info=info;
const budget=+(process.argv[2]??3);
setSeed(2404796662);T.setTerrainEnabled(true);
const ff=new FarField({enabled:true,tier:FAR_FIELD_TIERS.low});
const rows=[];
function go(label,x,z){const r=ff.stats.rebuilds;let worst=0,total=0,frames=0;for(let n=0;n<200000;n++){const b=performance.now();ff.update(x,z,{budgetMs:budget,dt:1/30,nightness:0});const ms=performance.now()-b;frames++;total+=ms;if(ms>worst)worst=ms;if(ff.stats.rebuilds>r)break;}
 rows.push({step:label,worstCallMs:+worst.toFixed(1),totalMs:+total.toFixed(1),frames});}
let x=-230.3,z=-691.8;go('cold',x,z);
for(let i=0;i<8;i++){x-=57;z+=57;go(i,x,z);}
// drive back over the same ground: everything should now be warm
for(let i=0;i<4;i++){x+=57;z-=57;go('back'+i,x,z);}
console.log(JSON.stringify({budgetMs:budget,rows,stats:{maxApplyStepMs:+(ff.stats.maxApplyStepMs??NaN).toFixed(1),maxColdStepMs:+ff.stats.maxColdStepMs.toFixed(1),hits:ff.stats.roadMemoHits,misses:ff.stats.roadMemoMisses}}));
ff.dispose();
