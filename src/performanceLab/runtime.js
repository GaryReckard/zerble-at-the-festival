import {PERF} from '../perf.js';
import {Input} from '../input.js';
import {childConstructionSeed} from './config.js';
import {SCENARIOS,FrameBuffer,routeControl,roadGuidance,segmentDistance,observeLoaded} from './scenarios.js';

export function installPerformanceLab({game,quality,clockState,owners,isRunning}){
  const control={throttle:0,steer:0,boost:false,brake:true};
  let state='ready',run=null,scenario=null,elapsed=0,lastSample=-1,segment=0,guideIndex=0,startWall=0,saved=false;
  let buffer,release=null,initialClock=null,oldQuality=null,oldTime=null,measuring=false;
  let removeObserver=null,loads=0,unloads=0,injected=0,frameLost=0;
  const startPosition={x:0,z:0},samples=[],checkpoints=[],streamingEvents=[],reasons=[];
  function restore(){
    release?.();release=null;removeObserver?.();removeObserver=null;
    if(oldQuality){quality.applyLevel(oldQuality.level);quality.setEnabled(oldQuality.enabled);oldQuality=null;}
    if(oldTime!==null){game.getTimeOfDay().setT(oldTime);oldTime=null;}
    game.chaseCam.dbgCamUnlock();
  }
  function abort(reason){if(!run||['completed','failed','exporting'].includes(state))return;reasons.push(reason);finish(false);}
  function mutation(e){if(!run||!['settling','measuring'].includes(state))return;if(e.target.closest?.('button,input,select,[role="button"]')){e.preventDefault();e.stopImmediatePropagation();abort('settings-or-hud-input');}}
  function visibility(){if(document.hidden)abort('foreground-lost');}
  const focusLost=()=>abort('window-focus-lost');
  window.addEventListener('blur',focusLost);
  document.addEventListener('click',mutation,true);
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',()=>{restore();window.removeEventListener?.('blur',focusLost);document.removeEventListener('click',mutation,true);document.removeEventListener('visibilitychange',visibility);},{once:true});
  function observation(){
    const size=game.renderer.getSize({set(x,y){this.x=x;this.y=y;return this;}}),pr=game.renderer.getPixelRatio();
    const c=clockState();
    return {t:Math.max(0,elapsed-scenario.settle),x:game.zerble.position.x,z:game.zerble.position.z,
      speed:game.zerble.speed,heading:game.zerble.heading,damage:game.zerble.condition.damage,
      throttle:control.throttle,steer:control.steer,requestedBoost:control.boost,boosting:!!game.zerble.isBoosting,
      adults:game.crowd.populationSize,children:game.kids.populationSize,bubbles:game.bubbles?.activeCount??0,registry:game.registry.entries.size,
      draws:game.renderer.__sceneInfo?.calls??game.renderer.info.render.calls,
      triangles:game.renderer.__sceneInfo?.triangles??game.renderer.info.render.triangles,
      programs:game.renderer.info.programs.length,resources:game.renderer.info.memory.geometries,
      width:Math.round(size.x*pr),height:Math.round(size.y*pr),targetWidth:game.composer.readBuffer.width,targetHeight:game.composer.readBuffer.height,
      quality:quality.getLevel(),steps:c.steps,dropped:c.dropped,blocked:c.blockedSeconds,segment};
  }
  async function finish(ok){
    state='exporting';measuring=false;control.throttle=control.steer=0;control.brake=true;
    const c=clockState(),driving=scenario.waypoints.length>0;
    run.state=ok?'exporting':'failed';run.errors=reasons.slice();run.overflow=buffer.overflow;run.frames=buffer.export();run.samples=samples;
    run.progress={acceptedSeconds:Math.max(0,elapsed-scenario.settle),wallSeconds:(performance.now()-startWall)/1000,outerLost:run.outerLost,
      physicsDropped:Math.max(0,c.dropped-initialClock.dropped),physicsSteps:c.steps-initialClock.steps,supportWait:Math.max(0,c.blockedSeconds-initialClock.blockedSeconds),
      ...(driving&&checkpoints.length?{routeWallSeconds:checkpoints.at(-1).wallSeconds}:{}),
      complete:ok&&(!driving||segment===scenario.waypoints.length)&&(!driving||(loads>0&&unloads>0)),checkpoints,loads,unloads,streamingEvents};
    if(!run.progress.complete&&!reasons.length)run.errors.push('scenario-work-incomplete');
    run.semantic={contentPolicy:JSON.stringify({version:'live-festival-v2',childConstruction:'private-seeded-v1',childConstructionSeed:childConstructionSeed(run.conditions.seed),tier:PERF.name,crowdMax:PERF.crowdMax,chunkLoadRadius:PERF.chunkLoadRadius}),routePolicy:scenario.routePolicy,
      populationMin:Math.min(...samples.map(s=>s.adults)),populationMax:Math.max(...samples.map(s=>s.adults)),childrenMin:Math.min(...samples.map(s=>s.children)),childrenMax:Math.max(...samples.map(s=>s.children))};
    run.cost={drawsMin:Math.min(...samples.map(s=>s.draws)),drawsMax:Math.max(...samples.map(s=>s.draws))};
    run.conditions.configurationDrift=samples.some(s=>s.width!==run.conditions.width||s.height!==run.conditions.height||s.targetWidth!==run.conditions.width||s.targetHeight!==run.conditions.height||s.quality!==0);
    run.gpuTiming={available:false,reason:'not-requested-primary-lightweight-mode'};
    const destination=run.exportUrl;delete run.exportUrl;delete run.outerLost;
    // Freeze exact export bytes for idempotent retries; never serialize in-frame.
    restore();const body=JSON.stringify(run);
    for(let n=0;n<3;n++){
      try{const response=await fetch(destination,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(5000)});
        if(!response.ok)throw Error('Export HTTP '+response.status);
        const receipt=await response.json();if(!receipt.saved||!receipt.hash)throw Error('Missing durable receipt');
        saved=true;state=run.progress.complete&&!run.errors.length?'completed':'failed';return;
      }catch(error){if(n===2){reasons.push(String(error));state='failed';}}
    }
  }
  const api={ready:true,status:()=>({state,saved,elapsed,segment,errors:reasons.slice()}),abort,
    start(envelope){
      if(state!=='ready'||!isRunning())throw Error('Lab requires a fresh started game');
      scenario=SCENARIOS[envelope.identity.scenario];if(!scenario)throw Error('Unknown scenario');
      if(envelope.identity.injectionMs<0||envelope.identity.injectionMs>80)throw Error('Injection bounds');
      if(envelope.interruptAfter!==undefined&&(!Number.isFinite(envelope.interruptAfter)||envelope.interruptAfter<=0||envelope.interruptAfter>80))throw Error('Interruption bounds');
      run=structuredClone(envelope);buffer=new FrameBuffer();
      oldQuality={level:quality.getLevel(),enabled:quality.isEnabled()};oldTime=game.getTimeOfDay().t;
      quality.setEnabled(false);quality.applyLevel(0);
      release=Input.acquireDiagnostic(control,()=>abort('emergency-abort'));
      removeObserver=observeLoaded(owners.chunkManager.loaded,(kind,key)=>{
        if(state!=='measuring')return;
        if(streamingEvents.length===4096){abort('stream-event-cap');return;}
        streamingEvents.push([elapsed-scenario.settle,kind,key]);if(kind==='load')loads++;else unloads++;
      });
      const gl=game.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
      const gpu=gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER);
      run.conditions={...run.conditions,gpu,gpuVerified:!!ext,browser:navigator.userAgent,width:game.renderer.domElement.width,height:game.renderer.domElement.height,dpr:game.renderer.getPixelRatio(),hiddenFrames:0,configurationDrift:false,refreshHz:null,powerState:null};
      if(!ext||/swiftshader|software|llvmpipe/i.test(gpu)){restore();run=null;throw Error('software-gpu');}
      startPosition.x=game.zerble.position.x;startPosition.z=game.zerble.position.z;
      initialClock=clockState();run.outerLost=0;
      state='settling';game.getTimeOfDay().setT(.3);
    },
    begin(raw,dt){
      if(!['settling','measuring'].includes(state))return;
      if(document.hidden||document.hasFocus?.()===false){run.conditions.hiddenFrames++;abort('foreground-lost');return;}
      elapsed+=dt;game.getTimeOfDay().setT(.3);frameLost=Math.max(0,raw-dt);injected=0;
      if(run.interruptAfter!==undefined&&elapsed>=run.interruptAfter){abort('declared-interruption');return;}
      if(state==='settling'&&elapsed>=scenario.settle){
        state='measuring';startWall=performance.now();initialClock=clockState();loads=unloads=0;
        if(!scenario.waypoints.length)game.chaseCam.dbgCamLock(startPosition.x-12,game.zerble.position.y+12,startPosition.z+16,startPosition.x,game.zerble.position.y+2,startPosition.z);
      }
      measuring=state==='measuring';
      if(measuring){
        run.outerLost+=frameLost;
        const position=game.zerble.position;
        const previous=segment>0?scenario.waypoints[segment-1]:[startPosition.x,startPosition.z];
        const target=scenario.waypoints[segment]||previous;
        const guidance=scenario.paths&&segment<scenario.waypoints.length?roadGuidance(position,game.zerble.heading,scenario.paths[segment],guideIndex,game.zerble.speed):null;
        const distance=guidance?guidance.corridor:scenario.waypoints.length?segmentDistance(position,previous,target):Math.hypot(position.x-startPosition.x,position.z-startPosition.z);
        if(distance>scenario.corridor){abort('route-corridor');return;}
        if(scenario.waypoints.length&&segment<scenario.waypoints.length){
          const next=guidance?.control||routeControl(game.zerble.position,game.zerble.heading,scenario.waypoints[segment],game.zerble.speed);
          if(guidance)guideIndex=guidance.index;
          if((guidance?.distance??next.distance)<4){checkpoints.push({segment,t:elapsed-scenario.settle,wallSeconds:(performance.now()-startWall)/1000,x:game.zerble.position.x,z:game.zerble.position.z});segment++;guideIndex=0;}
          Object.assign(control,next);
        }else{control.throttle=control.steer=0;control.boost=false;control.brake=true;}
        const dose=run.identity.injectionMs||0,start=performance.now();
        while(performance.now()-start<dose){}injected=performance.now()-start;
      }
    },
    end(wall,work){
      if(!measuring)return;
      if(!buffer.push(wall,work,segment,frameLost,injected)){abort('frame-cap');return;}
      if((run.collector!=='sentinel'||lastSample<0||elapsed-scenario.settle>=scenario.seconds)&&Math.floor(elapsed-scenario.settle)!==lastSample){lastSample=Math.floor(elapsed-scenario.settle);samples.push(observation());}
      if(game.zerble.condition.cause){abort('vehicle-'+game.zerble.condition.cause);return;}
      if(elapsed-scenario.settle>=scenario.seconds)finish(true);
    },
  };
  window.__performanceLab=api;return api;
}
