import { register } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
register(new URL('../../../../bin/node-three-shim.mjs',import.meta.url));
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const baseRef=process.argv[2]||'674ed90';
// Inspect the checkout before reading the baseline ref; this script never mutates Git.
process.stderr.write(execFileSync('git',['-C',root,'status','--short'],{encoding:'utf8'}));
const read=path=>execFileSync('git',['-C',root,'show',`${baseRef}:${path}`],{encoding:'utf8'});
const data=source=>'data:text/javascript,'+encodeURIComponent(source);
const grid=data(read('src/spatialGrid.js'));
const before=data(read('src/registry.js').replace("'./spatialGrid.js'",JSON.stringify(grid)));
const {Registry:Before}=await import(before);
const {Registry:After}=await import(new URL('../../../../src/registry.js',import.meta.url));
const rows=[];
for(let trial=0;trial<5;trial++)for(const [label,R]of trial%2?[['after',After],['before',Before]]:[['before',Before],['after',After]]){
 const r=new R();const make=i=>({kind:'tree',chunkKey:'fixed',position:{x:i%90*3,z:Math.floor(i/90)*3},footprint:1,collider:{radius:1}});
 for(let i=0;i<4500;i++)r.add(make(i));const movers=[];
 for(let i=0;i<12;i++){const e=make(i);r.add(e);movers.push(e);}
 const update=()=>{for(const e of movers){e.position.x+=.04;e.position.z+=.02;}r.rebuildSpatialIndex();};
 for(let i=0;i<100;i++)update();let t=performance.now();for(let i=0;i<2000;i++)update();const sync=performance.now()-t;
 t=performance.now();for(let i=0;i<10000;i++){const id=r.add(make(i));r.remove(id);}const addRemove=performance.now()-t;
 t=performance.now();for(let i=0;i<1000;i++){for(let j=0;j<24;j++){const e=make(j);e.chunkKey='temp';r.add(e);}r.removeChunk('temp');}const unloadReload=performance.now()-t;
 rows.push({label,trial,syncMs:sync,addRemoveMs:addRemove,unloadReloadMs:unloadReload});
}
const median=a=>a.sort((a,b)=>a-b)[2];
const medians=Object.fromEntries(['before','after'].map(label=>[label,Object.fromEntries(['syncMs','addRemoveMs','unloadReloadMs'].map(key=>[key,median(rows.filter(r=>r.label===label).map(r=>r[key]))]))]));
console.log(JSON.stringify({baseRef,entries:4512,syncIterations:2000,addRemoveIterations:10000,unloadReloadIterations:1000,chunkEntries:24,medians,rows},null,2));
