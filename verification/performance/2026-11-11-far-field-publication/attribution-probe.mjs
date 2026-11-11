// Offline Node CPU probe. Not a browser, GPU, device or frame-rate measurement.
// Usage: node <this file> [args]   (ZERBLE_ROOT=<dir> points it at another source tree)
const ROOT=process.env.ZERBLE_ROOT?new URL(process.env.ZERBLE_ROOT.replace(/\/?$/,"/"),"file://").href:new URL("../../../",import.meta.url).href;
import {register} from 'node:module';
import inspector from 'node:inspector';
register(new URL(ROOT+'bin/node-three-shim.mjs'));
globalThis.window={innerWidth:1024,innerHeight:768};
const info=console.info;console.info=()=>{};
const {FarField}=await import(ROOT+'src/farField.js');
const {FAR_FIELD_TIERS}=await import(ROOT+'src/perf.js');
const {setSeed}=await import(ROOT+'src/worldgen/index.js');
const T=await import(ROOT+'src/worldgen/terrain.js');
console.info=info;
setSeed(2404796662);T.setTerrainEnabled(true);
const ff=new FarField({enabled:true,tier:FAR_FIELD_TIERS.low});
const timed={};
for(const name of ['_applySnapshot','_writeRoads','_writePool']){const o=ff[name];ff[name]=function(...a){const b=performance.now();try{return o.apply(this,a);}finally{(timed[name]??=[]).push(+(performance.now()-b).toFixed(1));}};}
function go(x,z){const r=ff.stats.rebuilds,b=performance.now();for(let n=0;n<10000;n++){ff.update(x,z,{budgetMs:3,dt:1/30,nightness:0});if(ff.stats.rebuilds>r)break;}return +(performance.now()-b).toFixed(1);}
const out=[];
out.push(['cold',go(-230.3,-691.8),T.terrainCacheStats()]);
const s=new inspector.Session();s.connect();
const post=(m,p)=>new Promise((res,rej)=>s.post(m,p,(e,r)=>e?rej(e):res(r)));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});await post('Profiler.start');
// drive a straight route in 80 m steps, as a player would
let x=-230.3,z=-691.8;
for(let i=0;i<8;i++){x-=57;z+=57;out.push([i,go(x,z),T.terrainCacheStats()]);}
const {profile}=await post('Profiler.stop');
const dt=profile.timeDeltas;const byId=new Map(profile.nodes.map(n=>[n.id,n]));const parent=new Map();for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);
const nm=id=>byId.get(id).callFrame.functionName||'(anon)';
const incl=new Map(),chains=new Map();let total=0;
profile.samples.forEach((id,i)=>{const t=dt[i]/1000;const st=[];for(let c=id;c!=null;c=parent.get(c))st.push(nm(c));if(!st.includes('_applySnapshot'))return;total+=t;
 for(const f of new Set(st))incl.set(f,(incl.get(f)||0)+t);
 for(const leaf of ['nearestRoad','gate','terrainVertexHeight','heartInCell']){const k=st.indexOf(leaf);if(k<0)continue;const key=leaf+' <- '+st.slice(k+1,k+7).join(' <- ');chains.set(key,(chains.get(key)||0)+t);}});
console.log(JSON.stringify(timed._applySnapshot),'applyTotalSampled',total.toFixed(0));
console.log([...incl].sort((a,b)=>b[1]-a[1]).slice(0,40).map(([k,v])=>v.toFixed(0)+' '+k).join(' | '));
console.log([...chains].sort((a,b)=>b[1]-a[1]).slice(0,14).map(([k,v])=>v.toFixed(0)+'ms '+k).join(String.fromCharCode(10)));
ff.dispose();
