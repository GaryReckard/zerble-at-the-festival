// Offline Node CPU probe. Not a browser, GPU, device or frame-rate measurement.
// Usage: node <this file> [args]   (ZERBLE_ROOT=<dir> points it at another source tree)
const ROOT=process.env.ZERBLE_ROOT?new URL(process.env.ZERBLE_ROOT.replace(/\/?$/,"/"),"file://").href:new URL("../../../",import.meta.url).href;
// Byte-exact fingerprint of committed far-field output along a route.
import {register} from 'node:module';
import {createHash} from 'node:crypto';
register(new URL(ROOT+'bin/node-three-shim.mjs'));
globalThis.window={innerWidth:1024,innerHeight:768};
const info=console.info;console.info=()=>{};
const {FarField}=await import(ROOT+'src/farField.js');
const {FAR_FIELD_TIERS}=await import(ROOT+'src/perf.js');
const {setSeed}=await import(ROOT+'src/worldgen/index.js');
const T=await import(ROOT+'src/worldgen/terrain.js');
console.info=info;
const budget=process.argv.includes('--sliced')?0.5:60000;
const F=['x','y','z','yaw','sx','sy','sz','color','ownerCx','ownerCz','vendor'];
const f64=new Float64Array(1),u8=new Uint8Array(f64.buffer);
function fp(ff){
 const h=createHash('sha256');
 for(const [name,kept] of Object.entries(ff._active)){h.update(name+kept.length);for(const p of kept)for(const k of F){const v=p[k];if(typeof v==='number'){f64[0]=v;h.update(u8);}else h.update(String(v));}
  const m=ff._pools[name].mesh;h.update(JSON.stringify([m.count,m.visible,m.boundingSphere.center.x,m.boundingSphere.center.y,m.boundingSphere.center.z,m.boundingSphere.radius]));h.update(Buffer.from(ff._pools[name].fade.array.buffer));}
 const r=ff._road,v=ff.stats.roadVertsUsed,ix=r.geo.drawRange.count;
 h.update(Buffer.from(r.posAttr.array.buffer,0,v*12));h.update(Buffer.from(r.colorAttr.array.buffer,0,v*12));h.update(Buffer.from(r.idxAttr.array.buffer,0,ix*2));
 const b=r.geo.boundingSphere;h.update(JSON.stringify([v,ix,r.mesh.visible,b.center.x,b.center.y,b.center.z,b.radius]));
 const s=ff.stats;h.update(JSON.stringify([s.active,s.overflow,s.demandByPool,s.overflowByPool,s.roadVertsUsed,s.roadsClipped,s.rebuilds]));
 h.update(JSON.stringify(ff.planner.committed.records.map(r=>r.kind==='__road'?['road',Array.from(r.flat),r.width,r.surface]:r)));
 return h.digest('hex').slice(0,16);
}
const out={};
for(const terrain of [true,false])for(const seed of [2404796662,1234])for(const tier of ['low','mid','high']){
 setSeed(seed);T.setTerrainEnabled(terrain);
 const ff=new FarField({enabled:true,tier:FAR_FIELD_TIERS[tier]});
 const hs=[];let x=-230.3,z=-691.8,frames=0;
 const go=(x,z)=>{const r=ff.stats.rebuilds;for(let n=0;n<200000;n++){ff.update(x,z,{budgetMs:budget,dt:1/30,nightness:0});frames++;if(ff.stats.rebuilds>r)break;}hs.push(fp(ff));};
 go(x,z);for(let i=0;i<6;i++){x-=57;z+=57;go(x,z);}go(2400,2400);go(2400+90,2400);go(x,z);
 out[[terrain?'terrain':'flat',seed,tier].join(':')]=hs.join(' ');ff.dispose();
}
console.log(JSON.stringify(out,null,1));
