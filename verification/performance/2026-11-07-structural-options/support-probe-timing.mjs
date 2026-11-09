// Bounded Node mechanism timing; no browser/frame-time inference is permitted.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createProbeBinding} from './support-probe.mjs';
import {createSupportBinding,createSupportWorld} from '../../../src/landscape/support.js';
import {sampleTerrain,setTerrainEnabled} from '../../../src/worldgen/terrain.js';
import {setSessionSeed} from '../../../src/rng.js';
import {setLandscapeVersion} from '../../../src/worldgen/landscapeCandidates.js';
const base=new URL('./',import.meta.url),bytes=readFileSync(new URL('support-request-trace.json',base));
const trace=JSON.parse(bytes);setSessionSeed(2404796662);setLandscapeVersion(2);setTerrainEnabled(true);
const rosterBytes=readFileSync(new URL('support-probe-timing-roster.json',base)),roster=JSON.parse(rosterBytes);
assert.equal(roster.traceSha256,createHash('sha256').update(bytes).digest('hex'));
const rows=roster.traceRowIndexes.map(i=>trace.rows[i]).map(raw=>{
 const r=structuredClone(raw);for(const path of r.negativeZeros??[]){const [section,key]=path.split('.');r[section][key]=-0;}return r;
});
const options=r=>({footprint:[...(r.family==='adult'?[]:[{x:0,z:0}]),{x:r.radius,z:0},{x:-r.radius,z:0},{x:0,z:r.radius},{x:0,z:-r.radius}]});
const make=kind=>rows.map(r=>{const result=kind==='oracle'?{binding:createSupportBinding(createSupportWorld({sampleTerrain}),r.before,options(r))}:createProbeBinding(r.before,options(r));return {...result,out:{...r.result}};});
function batch(cohort,repeats){for(let n=0;n<repeats;n++)for(let i=0;i<rows.length;i++){const {target}=rows[i],entry=cohort[i];entry.binding.propose(target.x,target.z,entry.out,target.heading);}}
function summary(cohort){const totals={};for(const entry of cohort)if(entry.stats)for(const [k,v]of Object.entries(entry.stats)){if(typeof v==='number')totals[k]=(totals[k]||0)+v;else{totals[k]??={};for(const [r,n]of Object.entries(v))totals[k][r]=(totals[k][r]||0)+n;}}return totals;}
// Prewarm the real lattice and both JS paths before collecting any clock data.
const warmA=make('oracle'),warmB=make('candidate');batch(warmA,3);batch(warmB,3);
for(let i=0;i<rows.length;i++)assert.deepEqual(warmB[i].out,warmA[i].out);
const trials=[];
for(let trial=0;trial<8;trial++){
 const order=trial%2?['candidate','oracle']:['oracle','candidate'],record={trial,order};
 const cohorts={};
 for(const kind of order){const start=performance.now();cohorts[kind]=make(kind);record[kind]={constructionMs:performance.now()-start};}
 for(const kind of order){const start=performance.now();batch(cohorts[kind],1);record[kind].firstProposalMs=performance.now()-start;}
 for(let i=0;i<rows.length;i++)assert.deepEqual(cohorts.candidate[i].out,cohorts.oracle[i].out);
 for(const kind of order){const start=performance.now();batch(cohorts[kind],12);record[kind].warmProposalsMs=performance.now()-start;}
 for(let i=0;i<rows.length;i++)assert.deepEqual(cohorts.candidate[i].out,cohorts.oracle[i].out);
 record.candidate.stats=summary(cohorts.candidate);trials.push(record);
}
const output={kind:'isolated-node-mechanism-timing',traceSha256:createHash('sha256').update(bytes).digest('hex'),rosterSha256:createHash('sha256').update(rosterBytes).digest('hex'),probeSha256:createHash('sha256').update(readFileSync(new URL('support-probe.mjs',base))).digest('hex'),node:process.version,platform:process.platform,arch:process.arch,rows:rows.length,selection:'Every eighth measuring-phase sampled row, preserving source order',trials,warmRepeats:12,limitations:['Native terrain caches and JIT prewarmed; this is cold-certificate, not cold-world generation.','All methods replay through propose to retain exact before/target inputs across warm repetitions; acceptance/actor publication is not timed.','Contexts are reconstructed, so production acquisition/churn and unsampled histories are not reproduced.','No browser, renderer, dynamic runtime deck source, ordinary frame timing, physical device or thermal acceptance.','Trial batches include prototype generation/containment checks, exclusions and repeated failed-certificate maintenance.','Prototype stats instrumentation is included. No confidence interval or production speedup is inferred.']};
writeFileSync(new URL('support-probe-timing-results.json',base),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output));
