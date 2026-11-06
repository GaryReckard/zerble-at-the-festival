// Local, opt-in render-cost comparison. No scheduler remains after a run;
// every temporary method/material/quality change restores in finally/pagehide.
import {renderSubtractionTargets,withoutRendering} from './renderSubtraction.js';

export function installSceneProbe({game,quality,debug,subtract=false}) {
  const button=document.createElement('button'),output=document.createElement('pre');
  button.textContent=subtract?'Isolate rendering costs':'Measure scene rendering';button.id='scene-probe-run';
  button.style.cssText='position:fixed;top:12px;left:40%;z-index:5000;padding:10px';
  output.id='scene-probe-result';output.hidden=true;
  output.style.cssText='position:fixed;inset:80px 12px 12px;z-index:5000;overflow:auto;background:#102319ef;color:white;padding:12px';
  document.body.append(button,output);
  let disposed=false,restore=null,abort=null;
  const quantile=(values,p)=>values.slice().sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]??null;
  const phase=name=>new Promise((resolve,reject)=>{
    if(disposed){reject(new Error('Render probe interrupted'));return;}
    const original=game.renderer.render,renderDescriptor=Object.getOwnPropertyDescriptor(game.renderer,'render'),frames=[],groups=new Map(),cleanups=[];let current=null,seen=0,handle=0;
    const gl=game.renderer.getContext?.(),extension=gl?.getExtension('EXT_disjoint_timer_query_webgl2'),queries=[],gpuTimes=[];
    let disjoint=false;
    game.scene.traverse(node=>{
      if(!node.isMesh)return;
      const path=[];for(let p=node;p&&p!==game.scene;p=p.parent)if(p.name)path.unshift(p.name);
      const label=path.slice(0,3).join('/')||node.material?.type||'unnamed';
      const previous=node.onBeforeRender,descriptor=Object.getOwnPropertyDescriptor(node,'onBeforeRender');
      function before(...args){if(current)current[label]=(current[label]??0)+1;return previous.apply(this,args);}
      node.onBeforeRender=before;cleanups.push(()=>{if(node.onBeforeRender===before){if(descriptor)Object.defineProperty(node,'onBeforeRender',descriptor);else delete node.onBeforeRender;}});
    });
    function cleanup(){clearTimeout(timeout);cancelAnimationFrame(handle);for(const query of queries)gl.deleteQuery(query);queries.length=0;if(game.renderer.render===render){if(renderDescriptor)Object.defineProperty(game.renderer,'render',renderDescriptor);else delete game.renderer.render;}for(const clean of cleanups)clean();abort=null;}
    function render(scene,...args){
      if(scene!==game.scene)return original.call(this,scene,...args);
      current={};const start=performance.now();let result;
      result=original.call(this,scene,...args);
      const ms=performance.now()-start;
      if(++seen>10&&frames.length<30){frames.push(ms);for(const [key,count]of Object.entries(current))groups.set(key,(groups.get(key)??0)+count);}
      current=null;
      return result;
    }
    const timeout=setTimeout(()=>{cleanup();reject(new Error('Render probe exceeded its 15-second phase deadline'));},15000);
    abort=()=>{cleanup();reject(new Error('Render probe interrupted'));};game.renderer.render=render;
    function draw(){
      handle=requestAnimationFrame(draw);
      const query=extension&&!disjoint&&seen>=10&&frames.length<30?gl.createQuery():null;
      try{
        if(query){queries.push(query);gl.beginQuery(extension.TIME_ELAPSED_EXT,query);}
        try{game.composer.render();}finally{if(query)gl.endQuery(extension.TIME_ELAPSED_EXT);}
        if(extension){
          if(gl.getParameter(extension.GPU_DISJOINT_EXT)){disjoint=true;gpuTimes.length=0;for(const q of queries)gl.deleteQuery(q);queries.length=0;}
          for(let i=queries.length-1;i>=0;i--)if(gl.getQueryParameter(queries[i],gl.QUERY_RESULT_AVAILABLE)){
            gpuTimes.push(gl.getQueryParameter(queries[i],gl.QUERY_RESULT)/1e6);gl.deleteQuery(queries[i]);queries.splice(i,1);
          }
        }
        if(frames.length===30&&!queries.length){cleanup();resolve({name,renderCpuMs:{p50:quantile(frames,.5),p95:quantile(frames,.95)},
          renderGpuMs:extension?{samples:gpuTimes.length,disjoint,p50:quantile(gpuTimes,.5),p95:quantile(gpuTimes,.95)}:null,
          counts:game.renderer.__sceneInfo?{...game.renderer.__sceneInfo}:null,
          drawFamilies:[...groups].map(([name,total])=>({name,callsPerFrame:total/frames.length})).sort((a,b)=>b.callsPerFrame-a.callsPerFrame).slice(0,20)});}
      }catch(error){cleanup();reject(error);}
    }
    handle=requestAnimationFrame(draw);
  });
  button.onclick=async()=>{
    if(disposed||button.disabled)return;
    button.disabled=true;output.hidden=false;output.textContent='Measuring the same parked scene…';
    const old={enabled:quality.isEnabled(),level:quality.getLevel(),material:game.bubbles.mesh.material,shadows:game.renderer.shadowMap.enabled,paused:debug.isPaused()};
    restore=()=>{game.bubbles.mesh.material=old.material;game.renderer.shadowMap.enabled=old.shadows;quality.applyLevel(old.level);quality.setEnabled(old.enabled);debug.pause(old.paused);restore=null;};
    try{
      debug.pause(true);quality.setEnabled(false);quality.applyLevel(0);
      const phases=[await phase('baseline')];
      if(subtract){
        const targets=renderSubtractionTargets(game);
        for(const family of ['children','adults','other-people','world']){
          const nodes=targets.get(family)??[];
          if(!nodes.length)continue;
          output.textContent=`Measuring without ${family} rendering…`;
          phases.push({...await withoutRendering(nodes,()=>phase(`without-${family}`)),hiddenMeshes:nodes.length});
          phases.push(await phase(`restored-after-${family}`));
        }
      }else{
        output.textContent='Measuring detailed bubbles…';
        game.bubbles.setCheapMaterial(true);phases.push(await phase('cheap-bubbles'));
        output.textContent='Measuring shadows…';game.renderer.shadowMap.enabled=false;phases.push(await phase('cheap-bubbles-no-shadows'));
      }
      output.textContent=JSON.stringify({protocol:subtract?'render-subtraction-v1':'render-materials-v1',scope:'Parked scene: main-scene renderer CPU, composer GPU time where supported, and submissions. Excludes gameplay CPU; not a device FPS claim. Subtraction removes visible meshes and their shadows; reduced content is diagnostic, not an optimization result.',
        viewport:[innerWidth,innerHeight,devicePixelRatio],seed:window.__seed,position:game.zerble.position.toArray(),
        camera:game.camera?{mode:game.chaseCam?.mode,position:game.camera.position.toArray(),quaternion:game.camera.quaternion.toArray(),
          fov:game.camera.fov,zoom:game.camera.zoom,projection:game.camera.projectionMatrix.toArray()}:null,
        renderSize:game.renderer.domElement?{width:game.renderer.domElement.width,height:game.renderer.domElement.height,
          targetWidth:game.composer.readBuffer?.width,targetHeight:game.composer.readBuffer?.height}:null,phases},null,2);
    }catch(error){output.textContent=error.message;}
    finally{restore?.();button.disabled=false;button.textContent='Measure scene rendering again';}
  };
  window.addEventListener('pagehide',()=>{disposed=true;abort?.();restore?.();button.remove();output.remove();},{once:true});
}
