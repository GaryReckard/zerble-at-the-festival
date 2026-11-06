// Exploratory Node construction measurements, not calibrated browser timings.
// Run: node verification/performance/2026-11-05-optimization/kid-construction.mjs
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const variant=process.argv[2];
if(variant){
  if(!['legacy','pooled'].includes(variant))throw Error('Unknown variant');
  const {buildKid}=await import(variant==='legacy'?'./legacy-kid-model.js':'../../../src/models/kid.js');
  function cohort(){
    let state=0x504c4348;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
    const start=performance.now(),models=Array.from({length:50},()=>buildKid(random));
    return {ms:performance.now()-start,models};
  }
  const cold=cohort(),warm=cohort(),geometries=new Set(),materials=new Set(),buffers=new Set();
  let meshes=0,triangles=0;
  for(const model of warm.models)model.traverse(node=>{
    if(!node.isMesh)return;
    meshes++;geometries.add(node.geometry);materials.add(node.material);
    triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;
  });
  for(const geometry of geometries){
    for(const a of Object.values(geometry.attributes))buffers.add(a.array.buffer);
    if(geometry.index)buffers.add(geometry.index.array.buffer);
  }
  console.log(JSON.stringify({variant,coldMs:cold.ms,warmMs:warm.ms,children:warm.models.length,
    meshes,triangles,geometryObjects:geometries.size,materialObjects:materials.size,
    uniqueGeometryBufferBytes:[...buffers].reduce((sum,b)=>sum+b.byteLength,0)}));
}else{
  const samples=[];
  for(const variant of Array.from({length:4},()=>['legacy','pooled','pooled','legacy']).flat()){
    const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),variant],{encoding:'utf8',timeout:15000});
    if(result.error||result.status!==0)throw Error(result.error?.message??result.stderr);
    samples.push(JSON.parse(result.stdout));
  }
  const summaries={};
  for(const variant of ['legacy','pooled']){
    const entries=samples.filter(s=>s.variant===variant),quantile=(key,p)=>{
      const values=entries.map(s=>s[key]).sort((a,b)=>a-b);return values[Math.ceil(values.length*p)-1];
    };
    summaries[variant]={n:entries.length,coldP50Ms:quantile('coldMs',.5),coldP95Ms:quantile('coldMs',.95),
      warmP50Ms:quantile('warmMs',.5),warmP95Ms:quantile('warmMs',.95)};
  }
  console.log(JSON.stringify({scope:'Exploratory model-construction CPU timings in independent Node processes while Mac is in use. ABBA order, identical model recipe, no WebGL or browser-frame improvement claim. Geometry bytes are CPU buffer storage, not GPU memory.',
    node:process.version,platform:process.platform,arch:process.arch,summaries,samples},null,2));
}
