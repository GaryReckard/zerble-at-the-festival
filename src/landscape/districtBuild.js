import { buildMountainDistrictSteps } from './district.js';
import { districtAdmissionRecord } from '../worldgen/landscape.js';

// Streaming never re-runs cold route admission on the render thread. The
// worker's current receipt is required before any model/registry allocation.
export function createMountainDistrictBuild(scene,surface,options) {
  const {plan,admission}=options||{};
  if(!districtAdmissionRecord(admission,plan,surface))throw new TypeError('A current district admission is required');
  const iterator=buildMountainDistrictSteps(scene,surface,options);
  let done=false,result=null,cpuMs=0,largestStepMs=0,largestPhase=null,steps=0,phase='queued';
  function cancel(reason='cancelled'){
    if(done)return;
    try {iterator.return();}finally{done=true;result={valid:false,reason,owner:null};}
  }
  return Object.freeze({
    get done(){return done;},get result(){return result;},
    stats(){return {done,cpuMs,largestStepMs,largestPhase,steps,phase};},
    step({maxSteps=64,deadline=performance.now()+1.5}={}){
      if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>128||typeof deadline!=='number'||Number.isNaN(deadline))throw new RangeError('Invalid district construction work limit');
      if(!done&&!districtAdmissionRecord(admission,plan,surface))cancel('world-changed');
      let count=0;
      while(!done&&count<maxSteps&&performance.now()<deadline) {
        const start=performance.now();let step;
        try {step=iterator.next();}
        catch(error){cancel('build-rejected');result={...result,message:error.message};break;}
        finally{const elapsed=performance.now()-start;cpuMs+=elapsed;if(elapsed>largestStepMs){largestStepMs=elapsed;largestPhase=step?.done?'publication':step?.value?.phase||phase;}steps++;count++;}
        if(step.done){done=true;phase='ready';result={valid:true,reason:null,owner:step.value};}
        else phase=step.value?.phase||'building';
      }
      return {done,result,steps:count,phase};
    },cancel
  });
}
