// Offline CPU attribution, not a browser/device or calibrated frame comparison.
import {register} from 'node:module';
import {createHash} from 'node:crypto';
const terrain=!process.argv.includes('--flat');
register(new URL('../../../bin/node-three-shim.mjs',import.meta.url));
globalThis.window={innerWidth:1024,innerHeight:768};
const info=console.info;console.info=()=>{};
const {FarField}=await import('../../../src/farField.js');
const {FAR_FIELD_TIERS}=await import('../../../src/perf.js');
const {setSeed}=await import('../../../src/worldgen/index.js');
const {setTerrainEnabled}=await import('../../../src/worldgen/terrain.js');
console.info=info;
setSeed(2404796662);setTerrainEnabled(terrain);
const ff=new FarField({enabled:true,tier:FAR_FIELD_TIERS.low});
const calls=[];
for(const name of ['_planCellRecords','_applySnapshot','_writeRoads','_updateHandoffs']){
 const original=ff[name];ff[name]=function(...args){const before=performance.now();try{return original.apply(this,args);}finally{calls.push({name,ms:performance.now()-before});}};
}
const anchors=[];
try{
 for(const [x,z]of [[-230.3,-691.8],[-378,-628],[-429,-585]]){
  const start=calls.length,before=performance.now(),rebuild=ff.stats.rebuilds;
  for(let n=0;n<10000;n++){
   ff.update(x,z,{budgetMs:3,dt:1/30,nightness:0});
   if(ff.stats.rebuilds>rebuild)break;
   if(n===9999)throw Error('Bounded planner failed to commit');
  }
  anchors.push({x,z,totalMs:performance.now()-before,rebuilds:ff.stats.rebuilds,roadVerts:ff.stats.roadVertsUsed,active:ff.stats.active,descriptorSha256:createHash('sha256').update(JSON.stringify(ff.planner.committed.records)).digest('hex'),calls:calls.slice(start)});
 }
}finally{ff.dispose();}
console.log(JSON.stringify({scope:'Offline Node CPU-only attribution at selected route anchors. Nested calls are not additive; no GPU, frame, iPad or equal-work comparison claim.',seed:2404796662,tier:'low',terrain,landscapePolicyInstalled:false,anchors},null,2));
