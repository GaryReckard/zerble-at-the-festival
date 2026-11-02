// The same pure task runs in the browser worker and the Node survey/harness.
import { setSessionSeed } from '../rng.js';
import { CONFIG,bumpWorldgen } from './constants.js';
import { FESTIVAL_TUNING } from './tuning.js';
import { setTerrainEnabled } from './terrain.js';
import { setLandscapeVersion,landscapeCandidateInCell } from './landscapeCandidates.js';
import { landscapeContextFor } from './landscapeContext.js';
import { createLandscapeAdmission,districtAdmissionRecord } from './landscape.js';
import { buildLandscapeRenderData } from './landscapeRender.js';
let settingsKey='';
export function computeLandscapeTask(data) {
  if(data.version!==2||!Number.isSafeInteger(data.seed)||!Number.isSafeInteger(data.cx)||!Number.isSafeInteger(data.cz)||typeof data.key!=='string')throw new TypeError('Invalid landscape task identity');
  const settings=JSON.stringify([data.config,data.tuning]);
  if(settings!==settingsKey){Object.assign(CONFIG,data.config);Object.assign(FESTIVAL_TUNING,data.tuning);bumpWorldgen();settingsKey=settings;}
  setSessionSeed(data.seed);setLandscapeVersion(2);setTerrainEnabled(true);
  const candidate=landscapeCandidateInCell(data.cx,data.cz);
  if(!candidate||candidate.id!==data.candidateId||JSON.stringify(candidate)!==data.fingerprint)throw new Error('Landscape worker candidate/configuration mismatch');
  const started=performance.now(),context=landscapeContextFor(candidate),contextMs=performance.now()-started,job=createLandscapeAdmission(candidate,context);
  let steps=0;
  while(!job.done){job.step({maxSteps:128,deadline:Infinity});if(++steps>10000)throw new Error('Landscape admission exceeded its declared work');}
  const result=job.result,record=result.valid?districtAdmissionRecord(result.receipt,result.plan,context.surface):null;
  const render=data.renderGeometry?buildLandscapeRenderData(candidate,result.plan,context.surface):null;
  return {type:'result',id:data.id,key:data.key,candidateId:candidate.id,fingerprint:data.fingerprint,valid:result.valid,reason:result.reason,
    plan:result.plan,route:record?.route||null,rejected:result.rejected,render,contextMs,workerMs:performance.now()-started};
}
