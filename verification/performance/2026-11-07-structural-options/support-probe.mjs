// Disposable feasibility discriminator. Never imported by the game.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createSupportBinding,createSupportWorld} from '../../../src/landscape/support.js';
import {headingDelta} from '../../../src/landscape/routes.js';
import * as terrain from '../../../src/worldgen/terrain.js';
import {landscapeCandidatesInBounds,setLandscapeVersion,landscapeCandidateInCell} from '../../../src/worldgen/landscapeCandidates.js';
import {setSessionSeed} from '../../../src/rng.js';
import {bumpWorldgen} from '../../../src/worldgen/constants.js';
import {lakesInBounds} from '../../../src/worldgen/water.js';

const root=new URL('../../../',import.meta.url),base=new URL('./',import.meta.url);
const hash=s=>createHash('sha256').update(s).digest('hex');
const source=readFileSync(new URL('src/landscape/support.js',root),'utf8');
const manifest=JSON.parse(readFileSync(new URL('source-manifest.json',base)));
const provenance={app:manifest.app,build:manifest.build,files:{}};
for(const path of ['src/landscape/support.js','src/landscape/routes.js','src/worldgen/terrain.js','src/worldgen/landscapeCandidates.js','src/landscape/peopleAdapter.js','src/landscape/runtime.js','src/landscape/forms.js']){
  const actual=hash(readFileSync(new URL(path,root)));assert.equal(actual,manifest.files[path],`frozen source mismatch: ${path}`);provenance.files[path]=actual;
}
// Keep the entire real binding, including its arithmetic and validation. The
// sole injected call chooses a certified provider before its existing sweep.
const needle='    copyState(trial, state);';assert.equal(source.split(needle).length,2);
const bindingBody=source.slice(source.indexOf('export function createSupportBinding')).replace('export function','function')
  .replace(needle,'    world.begin?.(state,x,z,contacts);\n'+needle);
const injectedBinding=new Function('headingDelta','TERRAIN_SUPPORT','finite',`${bindingBody};return createSupportBinding;`)(headingDelta,'terrain',(v,n)=>{if(!Number.isFinite(v))throw new TypeError(`${n} must be finite`);return v;});
provenance.extractedBindingSha256=hash(bindingBody);provenance.injection='One optional world.begin call immediately before copyState(trial,state); all existing arithmetic and loop bodies unchanged.';

export function createProbeBinding(initial,options={}, {knownTerrainProvider=true,world=null,isCurrent=null}={}){
  const generation=terrain.terrainGenerationKey();
  const current=isCurrent??(()=>terrain.terrainGenerationKey()===generation);
  const stats={attempts:0,hits:0,cold:0,reused:0,rejected:{},oracleTerrainQueries:0,fastTerrainQueries:0,certificateVertexQueries:0,exclusionQueries:0};
  const sample=(x,z,out)=>{stats.oracleTerrainQueries++;return terrain.sampleTerrain(x,z,out);};
  const oracle=world??createSupportWorld({sampleTerrain:sample,isCurrent:current});
  let record=null,active=null;
  const reject=reason=>{stats.rejected[reason]=(stats.rejected[reason]||0)+1;return null;};
  function begin(state,x,z,contacts){
    active=null;stats.attempts++;
    if(!knownTerrainProvider||world)return reject('unknown-provider');
    if(!current()||terrain.terrainGenerationKey()!==generation){record=null;return reject('generation');}
    if(!terrain.terrainEnabled())return reject('disabled');
    if(state.surfaceId!=='terrain')return reject('selected-deck');
    const step=terrain.TERRAIN_STEP,ix=Math.floor(state.x/step)*step,iz=Math.floor(state.z/step)*step;
    const lower=(state.x-ix)/step+(state.z-iz)/step<=1;
    const radius=Math.max(0,...contacts.map(p=>Math.hypot(p.x,p.z)));
    // The complete continuous swept disk contains every footprint rotation,
    // including intermediate headings. Its box is conservative at every turn.
    const minX=Math.min(state.x,x)-radius,maxX=Math.max(state.x,x)+radius;
    const minZ=Math.min(state.z,z)-radius,maxZ=Math.max(state.z,z)+radius;
    const epsilon=1e-9*Math.max(1,Math.abs(ix),Math.abs(iz));
    if(minX<=ix+epsilon||minZ<=iz+epsilon||maxX>=ix+step-epsilon||maxZ>=iz+step-epsilon)return reject('cell-edge');
    if(lower?(maxX-ix)+(maxZ-iz)>=step-epsilon:(minX-ix)+(minZ-iz)<=step+epsilon)return reject('triangle-edge');
    if(record&&record.ix===ix&&record.iz===iz&&record.lower===lower){active=record;stats.reused++;stats.hits++;return;}
    stats.cold++;
    const bounds={minX:ix,maxX:ix+step,minZ:iz,maxZ:iz+step};stats.exclusionQueries+=2;
    // Exclude whole known owner envelopes, never infer dry ground from endpoints.
    if(landscapeCandidatesInBounds(bounds).length)return reject('landscape-owner');
    if(terrain.terrainDescriptors(bounds).some(d=>d.kind==='lake'))return reject('lake-envelope');
    stats.certificateVertexQueries+=4;
    const a=terrain.terrainVertexHeight(ix,iz),b=terrain.terrainVertexHeight(ix+step,iz),c=terrain.terrainVertexHeight(ix,iz+step),d=terrain.terrainVertexHeight(ix+step,iz+step);
    const dx=lower?(b-a)/step:(d-c)/step,dz=lower?(c-a)/step:(d-b)/step;
    record=Object.freeze({ix,iz,lower,a,b,c,d,dx,dz});active=record;stats.hits++;
  }
  const certified=createSupportWorld({isCurrent:current,sampleTerrain:(x,z,out)=>{
    stats.fastTerrainQueries++;const {ix,iz,a,b,c,d,dx,dz}=active,u=(x-ix)/terrain.TERRAIN_STEP,v=(z-iz)/terrain.TERRAIN_STEP;
    // Identical original final interpolation. No h0+dx*offset plane shortcut.
    out.height=u+v<=1?a+u*(b-a)+v*(c-a):d+(1-v)*(b-d)+(1-u)*(c-d);
    const length=Math.hypot(dx,1,dz);out.dx=dx;out.dz=dz;out.nx=-dx/length;out.ny=1/length;out.nz=-dz/length;out.grade=Math.hypot(dx,dz);
    out.blockedReason=out.grade>.45?'grade':null;out.traversable=!out.blockedReason;out.surfaceClass='grass';return out;
  }});
  const usable=(x,z,id)=>{
    if(!active||id!=='terrain')return false;
    if(!current()||terrain.terrainGenerationKey()!==generation){active=null;record=null;return false;}
    const u=(x-active.ix)/terrain.TERRAIN_STEP,v=(z-active.iz)/terrain.TERRAIN_STEP;
    return u>0&&v>0&&u<1&&v<1&&(active.lower?u+v<1:u+v>1);
  };
  const wrapped={begin,propose:(x,z,state,out)=>(usable(x,z,state.surfaceId)?certified:oracle).propose(x,z,state,out),sampleSelected:(x,z,id,out)=>(usable(x,z,id)?certified:oracle).sampleSelected(x,z,id,out)};
  const binding=injectedBinding(wrapped,initial,options);stats.acquisitionTerrainQueries=stats.oracleTerrainQueries;
  return {binding,stats,clear:()=>{active=null;record=null;},oracle};
}

const footprint=r=>[{x:0,z:0},{x:r,z:0},{x:-r,z:0},{x:0,z:r},{x:0,z:-r}];
export function runSynthetic(){
  const result={cases:0,operations:0,mismatches:0,stats:{},coverage:[],failures:[]};
  function scenario(name,initial,requests,options={},config={}){
    let oracle,candidate;const key=terrain.terrainGenerationKey(),guard=config.isCurrent??(()=>terrain.terrainGenerationKey()===key);
    try{oracle=createSupportBinding(config.world??createSupportWorld({sampleTerrain:terrain.sampleTerrain,isCurrent:guard}),initial,options);candidate=createProbeBinding(initial,options,{...config,isCurrent:guard});}
    catch(e){if(e instanceof RangeError)return false;throw e;}
    result.cases++;result.coverage.push(name);const left={sentinel:7},right={sentinel:7};
    for(const request of requests){
      if(request.mutate)request.mutate();
      const {x,z,heading=0,method='move'}=request;
      try{
        const a=oracle[method](x,z,left,heading),b=candidate.binding[method](x,z,right,heading);
        assert.deepEqual(b,a,`${name} result`);assert.deepEqual(candidate.binding.snapshot(),oracle.snapshot(),`${name} pose`);result.operations++;
      }catch(error){result.mismatches++;result.failures.push({name,message:error.message});throw error;}
    }
    for(const [k,v] of Object.entries(candidate.stats)){if(typeof v==='number')result.stats[k]=(result.stats[k]||0)+v;else{result.stats[k]??={};for(const [r,n]of Object.entries(v))result.stats[k][r]=(result.stats[k][r]||0)+n;}}
    return true;
  }
  for(const version of [1,2])for(const seed of [0,1977,2404796662]){
    setLandscapeVersion(version);setSessionSeed(seed);terrain.setTerrainEnabled(true);
    for(let i=0;i<100;i++){
      const x=-1000+(i*137%2000)+2,z=-1200+(i*193%2200)+2;
      scenario(`grid-${version}-${seed}-${i}`,{x,z},[
        {x:x+.01,z:z+.02,heading:.01},{x:x+.03,z:z+.04,heading:.1},
        {x:x+9,z:z+1,heading:Math.PI},{x:x-15,z:z-12,heading:-Math.PI+.01},
        {x:x+1000,z:z+1000,heading:100},{x:x-.1,z:z+.1,heading:-.1,method:'propose'},
        {x:x+35,z:z-27,method:'sample'},
      ],{footprint:footprint(.45)});
    }
    for(const [x,z]of [[-0,0],[-10,-10],[5,5],[200,200],[-200,-200]])scenario(`ties-${version}-${seed}-${x}-${z}`,{x,z},[{x:x+1e-10,z:z-1e-10},{x:x-.1,z:z+.1,heading:2}],{footprint:footprint(.45)});
  }
  setSessionSeed(1977);setLandscapeVersion(2);
  const deck={id:'deck',height:0,bounds:{minX:0,maxX:20,minZ:0,maxZ:20},approaches:[{minX:-2,maxX:2,minZ:0,maxZ:20}]};
  const deckWorld=createSupportWorld({sampleTerrain:(x,z,out)=>Object.assign(out,{height:0,dx:0,dz:0,traversable:true}),decks:[deck]});
  scenario('custom-overlapping-deck-approach',{x:-1,z:5},[{x:1,z:5},{x:5,z:5},{x:25,z:5}],{footprint:footprint(.45)},{world:deckWorld,knownTerrainProvider:false});
  let deckPresent=true;
  const removable=createSupportWorld({sampleTerrain:(x,z,out)=>Object.assign(out,{height:0,dx:0,dz:0,traversable:true}),deckSource:{near:()=>deckPresent?[deck]:[],resolve:()=>deckPresent?deck:null}});
  scenario('missing-deck-owner',{x:5,z:5,surfaceId:'deck'},[{x:5.01,z:5.01},{x:5.02,z:5.02,mutate:()=>{deckPresent=false;}}],{footprint:footprint(.45)},{world:removable,knownTerrainProvider:false});
  const steep=createSupportWorld({sampleTerrain:(x,z,out)=>Object.assign(out,{height:x,dx:1,dz:0,traversable:false,blockedReason:'grade'})});
  scenario('allow-steep-provider',{x:2,z:2},[{x:2.1,z:2.1,heading:2}],{footprint:footprint(.45),allowSteepTerrain:true},{world:steep,knownTerrainProvider:false});
  for(const lake of lakesInBounds(-600,-600,600,600).slice(0,3)){
    for(const sign of [-1,1]){
      const x=lake.x+sign*(lake.maxR+12),z=lake.z;
      scenario(`actual-lake-crossing-${lake.cx}-${lake.cz}-${sign}`,{x,z},[{x:lake.x,z:lake.z}],{footprint:footprint(.45),maxSweepSteps:1024});
    }
  }
  for(let cz=-2;cz<=2;cz++)for(let cx=-2;cx<=2;cx++){
    const candidate=landscapeCandidateInCell(cx,cz);if(!candidate?.stream)continue;
    const p=candidate.stream.points[0];
    scenario(`stream-owner-${cx}-${cz}`,{x:candidate.bounds.minX-2,z:p.z},[{x:p.x,z:p.z}],{footprint:footprint(.4),maxSweepSteps:1024});
  }
  let alive=true;
  scenario('world-generation-disposal',{x:2,z:2},[{x:2.01,z:2.01},{x:2.02,z:2.02,mutate:()=>{alive=false;}},{x:2.03,z:2.03}],{footprint:footprint(.45)},{isCurrent:()=>alive});
  scenario('actual-generation-invalidation',{x:2,z:2},[{x:2.01,z:2.01},{x:2.02,z:2.02,method:'sample',mutate:()=>bumpWorldgen()},{x:2.03,z:2.03}],{footprint:footprint(.35)});
  return result;
}

export function replayTrace(trace,{seed=1977,version=2}={}){
  setSessionSeed(seed);setLandscapeVersion(version);terrain.setTerrainEnabled(true);
  const result={seed,version,sampledRows:trace.rows.length,allCallCounters:trace.counts,bindingCount:trace.bindings,replayed:0,certificateHits:0,truthMismatches:0,traceMismatches:0,skipped:{},stats:{},firstMismatches:[],phases:{},allCallPhaseCounters:trace.phases,scope:trace.scope};
  const skip=reason=>result.skipped[reason]=(result.skipped[reason]||0)+1;
  for(const raw of trace.rows){
    const row=structuredClone(raw);
    const phase=result.phases[row.phase??'unknown']??={sampledRows:0,replayed:0,certificateHits:0,truthMismatches:0,traceMismatches:0,skipped:{},stats:{}};phase.sampledRows++;
    for(const path of row.negativeZeros??[]){const [section,key]=path.split('.');row[section][key]=-0;}
    if(row.before.surfaceId!=='terrain'){skip('selected-deck-owner-unavailable');phase.skipped.selectedDeck=(phase.skipped.selectedDeck||0)+1;continue;}
    const r=row.radius,contacts=footprint(r);if(row.family==='adult')contacts.shift();
    const options={footprint:contacts};
    let a,b;
    try{a=createSupportBinding(createSupportWorld({sampleTerrain:terrain.sampleTerrain}),row.before,options);b=createProbeBinding(row.before,options);}
    catch(error){if(error instanceof RangeError){skip('acquisition-not-reconstructible');phase.skipped.acquisition=(phase.skipped.acquisition||0)+1;continue;}throw error;}
    // Capture copies a fixed field list, not the entire caller output object.
    // Seed outputs with those fields to preserve observable stale-field values.
    const left={...row.result},right={...row.result};
    const actual=a[row.method](row.target.x,row.target.z,left,row.target.heading);
    const candidate=b.binding[row.method](row.target.x,row.target.z,right,row.target.heading);
    result.replayed++;phase.replayed++;
    try{assert.deepEqual(candidate,actual);assert.deepEqual(b.binding.snapshot(),a.snapshot());}
    catch(error){result.truthMismatches++;phase.truthMismatches++;if(result.firstMismatches.length<8)result.firstMismatches.push({bindingId:row.bindingId,before:row.before,target:row.target,kind:'oracle-candidate',message:error.message});}
    try{for(const key of Object.keys(row.result))assert.deepEqual(actual[key],row.result[key],key);assert.deepEqual(a.snapshot(),row.after);}
    catch(error){result.traceMismatches++;phase.traceMismatches++;if(result.firstMismatches.length<8)result.firstMismatches.push({bindingId:row.bindingId,before:row.before,target:row.target,kind:'captured-truth',message:error.message});}
    if(b.stats.hits){result.certificateHits++;phase.certificateHits++;}
    for(const target of [result.stats,phase.stats])for(const [k,v]of Object.entries(b.stats)){if(typeof v==='number')target[k]=(target[k]||0)+v;else{target[k]??={};for(const [reason,n]of Object.entries(v))target[k][reason]=(target[k][reason]||0)+n;}}
  }
  return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const arg=name=>{const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];};
  const tracePath=arg('--trace'),results=runSynthetic();
  const output={kind:'correctness-only',provenance,synthetic:results,limitations:['No timing collected.','No browser or delivered-frame evidence.','Sparse requests reconstruct sampled before-states, not complete binding histories.','New-binding acquisition and unsampled calls are not covered.','Known-provider certificate only; generic/custom providers always fallback.']};
  if(tracePath){const bytes=readFileSync(tracePath);output.traceProvenance={path:tracePath,sha256:hash(bytes)};output.trace=replayTrace(JSON.parse(bytes),{seed:Number(arg('--seed')??1977),version:Number(arg('--version')??2)});}
  writeFileSync(new URL('support-probe-results.json',base),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({cases:results.cases,operations:results.operations,mismatches:results.mismatches,stats:results.stats,trace:output.trace}));
}
