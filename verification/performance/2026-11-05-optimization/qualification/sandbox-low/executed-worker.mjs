// Task-scoped attribution controller. The accepted Python supervisor owns all
// browser/control processes, deadlines, heartbeat expiry and exact-PID cleanup.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const directory=process.argv[2],config=JSON.parse(await readFile(path.join(directory,'config.json'),'utf8')),
  diagnostic=JSON.parse(await readFile(path.join(directory,'diagnostic-input.json'),'utf8'));
const heartbeat=setInterval(()=>process.stdout.write('heartbeat\n'),1000),pending=new Map(),errors=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let socket,session,id=0;
try{
  let active;
  for(let n=0;n<100;n++){try{active=(await readFile(path.join(directory,'profile/DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{await delay(100);}}
  if(!active)throw Error('No owned debugging endpoint');
  socket=new WebSocket(`ws://127.0.0.1:${active[0]}${active[1]}`);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  socket.onmessage=e=>{
    const m=JSON.parse(e.data);
    if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(p.method+': '+m.error.message)):p.resolve(m.result);}}
    else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);
    else if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params.entry.text);
  };
  const send=(method,params={},sid=session)=>new Promise((resolve,reject)=>{
    const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error('CDP deadline: '+method));},10000);
    pending.set(request,{resolve,reject,timer,method});socket.send(JSON.stringify({id:request,method,params,...(sid?{sessionId:sid}:{})}));
  });
  const evaluate=async expression=>{
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;
  };
  const until=async(expression,seconds=45)=>{
    const deadline=Date.now()+seconds*1000;
    while(Date.now()<deadline){const value=await evaluate(expression);if(value)return value;await delay(250);}
    throw Error('Condition deadline: '+expression);
  };
  const created=await send('Target.createTarget',{url:'about:blank'},null);
  ({sessionId:session}=await send('Target.attachToTarget',{targetId:created.targetId,flatten:true},null));
  await send('Runtime.enable');await send('Log.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  if(diagnostic.task==='cpu')await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const original=window.fetch;window.fetch=function(url,options){if(typeof url==='string'&&url.startsWith('/__capture/people-baseline-')){window.__savedBaseline=JSON.parse(options.body);return Promise.resolve(new Response('{}',{status:200}));}return original.apply(this,arguments);};})();`});
  const extra=diagnostic.task==='subtract'?'&performanceLab=1&sceneProbe=subtract':diagnostic.task==='cpu'?'&performanceLab=1&peopleBaseline=1':'&performanceLab=1';
  const url=new URL(config.url+extra+(diagnostic.kidBatch===true?'&kidBatch=1':diagnostic.kidBatch===false?'&kidBatch=0':''));
  if(diagnostic.task==='sandbox'){url.pathname='/sandbox.html';url.searchParams.set('entity','kid_gaggle');}
  await send('Page.navigate',{url:String(url)});await send('Page.bringToFront');
  console.log(JSON.stringify({stage:'navigated',task:diagnostic.task}));
  const click=async expression=>{
    const point=await evaluate(`(()=>{const r=(${expression}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  };
  if(diagnostic.task==='sandbox'){
    await until("!!window.__sandbox?.entityRoot&&document.querySelector('#entity').value==='kid_gaggle'");
    const scenes=[];
    for(const [label,text]of [['noon','Noon'],['midnight','Midnight']]){
      await click(`[...document.querySelectorAll('button.tod-preset')].find(b=>b.textContent.trim()===${JSON.stringify(text)})`);await delay(600);
      scenes.push(await evaluate("(()=>{const s=__sandbox,r=s.renderer;return {children:s.entityRoot.children.filter(n=>n.userData.locomotion).length,draws:r.info.render.calls,triangles:r.info.render.triangles,programs:r.info.programs.length};})()"));
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(directory,label+'.png'),Buffer.from(shot.data,'base64'));
    }
    await evaluate("__sandbox.loadEntity('kid');__sandbox.loadEntity('kid_gaggle')");await delay(500);
    if(errors.length)throw Error(errors.join('\n'));
    await writeFile(path.join(directory,'diagnostic-result.json'),JSON.stringify({ok:true,task:'sandbox',scenes,errors}));
  }else{
  await until("document.querySelector('#mode-cruisin')&&!document.querySelector('#mode-cruisin').disabled");
  await click("document.querySelector('#mode-cruisin')");
  console.log(JSON.stringify({stage:'title gesture'}));
  await until("!!(document.body.classList.contains('game-started')&&window.__dbg&&window.__game)");
  const hardware=await evaluate(`(()=>{const g=__game,r=g.renderer,gl=r.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,visible:!document.hidden,focused:document.hasFocus(),childBatch:!!g.kids.presentation&&!g.kids.presentation.disposed,width:r.domElement.width,height:r.domElement.height,targetWidth:g.composer.readBuffer.width,targetHeight:g.composer.readBuffer.height};})()`);
  if(!hardware.gpu||/swiftshader|software|llvmpipe/i.test(hardware.gpu)||!hardware.visible||!hardware.focused)throw Error('Hardware/focus gate failed');
  if(diagnostic.kidBatch!==null&&hardware.childBatch!==diagnostic.kidBatch)throw Error('Child presentation did not match the requested variant');
  console.log(JSON.stringify({stage:'settling',hardware}));await delay(20000);
  await evaluate('__dbg.camLock(__game.zerble.position.x-12,__game.zerble.position.y+12,__game.zerble.position.z+16,__game.zerble.position.x,__game.zerble.position.y+2,__game.zerble.position.z)');
  await delay(1000);
  if(diagnostic.task==='subtract'){
    await until("document.querySelector('#scene-probe-run')");await click("document.querySelector('#scene-probe-run')");
    await until("!document.querySelector('#scene-probe-run').disabled",60);
    const result=await evaluate("JSON.parse(document.querySelector('#scene-probe-result').textContent)");
    result.hardware=hardware;await writeFile(path.join(directory,'subtraction.json'),JSON.stringify(result,null,2));
    await evaluate("document.querySelector('#scene-probe-result').hidden=true;document.querySelector('#scene-probe-run').hidden=true");
  }else if(diagnostic.task==='cpu'){
    const expression="[...document.querySelectorAll('button')].find(b=>b.textContent==='Measure people baseline')";
    await until(expression);await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:1000});await send('Profiler.start');
    await click(expression);
    await until("[...document.querySelectorAll('button')].some(b=>b.textContent==='Save people baseline')",60);
    const {profile}=await send('Profiler.stop');await send('Profiler.disable');
    await writeFile(path.join(directory,'sampled-cpu.json'),JSON.stringify(profile));
    await click("[...document.querySelectorAll('button')].find(b=>b.textContent==='Save people baseline')");
    const result=await until('window.__savedBaseline');result.hardware=hardware;
    await writeFile(path.join(directory,'cpu.json'),JSON.stringify(result,null,2));
  }else if(diagnostic.task==='cameras'){
    const comparisons=[];
    const key=async(key,code,virtual)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual});await delay(80);await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual});};
    await evaluate('__dbg.camUnlock()');
    for(const mode of ['third','first','top']){
      if(mode!=='third')await key('v','KeyV',86);
      await until(`__game.chaseCam.mode===${JSON.stringify(mode)}`);await delay(800);
      for(const time of [.3,.75]){
        await evaluate(`__dbg.tod(${time})`);await delay(500);await evaluate('__debug.pause(true)');
        const pair=[];
        for(const enabled of [true,false]){
          const result=await evaluate(`(()=>{const enabled=__dbg.childRendering(${enabled});if(enabled.enabled!==${enabled})throw Error('Presentation toggle failed');for(let n=0;n<3;n++)__game.composer.render();const g=__game;return {enabled:${enabled},fingerprint:JSON.stringify({registry:[...g.registry.entries.keys()],actors:g.kids.kids.map(k=>[...k.position.toArray(),...k.quaternion.toArray(),k.visible]),camera:[...g.camera.position.toArray(),...g.camera.quaternion.toArray(),...g.camera.projectionMatrix.toArray()]}),draws:g.renderer.__sceneInfo.calls,triangles:g.renderer.__sceneInfo.triangles,geometryObjects:g.renderer.info.memory.geometries,programs:g.renderer.info.programs.length,shadows:g.renderer.shadowMap.enabled,lights:g.scene.children.filter(n=>n.isDirectionalLight).map(n=>({castShadow:n.castShadow})),width:g.renderer.domElement.width,height:g.renderer.domElement.height};})()`);
          const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
          result.image=`${mode}-${time}-${enabled?'instanced':'individual'}.png`;await writeFile(path.join(directory,result.image),Buffer.from(screenshot.data,'base64'));pair.push(result);
        }
        if(pair[0].fingerprint!==pair[1].fingerprint)throw Error('Scene/camera changed during the frozen comparison');
        comparisons.push({mode,time,pair});await evaluate('__debug.pause(false)');
      }
    }
    await key('ArrowLeft','ArrowLeft',37);await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:640,y:360,deltaY:-240,deltaX:0});await delay(300);
    await evaluate('__dbg.childRendering(true)');
    await writeFile(path.join(directory,'cameras.json'),JSON.stringify({hardware,comparisons,manualCamera:await evaluate('({mode:__game.chaseCam.mode,topYaw:__game.chaseCam.topYawOffset,height:__game.chaseCam.topHeight})')},null,2));
  }
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(directory,'scene.png'),Buffer.from(shot.data,'base64'));
  const restored=await evaluate('({paused:__debug.isPaused(),focused:document.hasFocus(),visible:!document.hidden,adults:__game.crowd.populationSize,children:__game.kids.populationSize})');
  if(restored.paused||!restored.visible||!restored.focused)throw Error('Diagnostic did not restore live foreground game');
  if(errors.length)throw Error(errors.join('\n'));
  await writeFile(path.join(directory,'diagnostic-result.json'),JSON.stringify({ok:true,task:diagnostic.task,hardware,restored,errors}));
  }
  await send('Target.closeTarget',{targetId:created.targetId},null);
  await writeFile(path.join(directory,'worker-result.json'),JSON.stringify({ok:true,errors}));
}catch(error){await writeFile(path.join(directory,'worker-result.json'),JSON.stringify({ok:false,error:String(error),errors}));process.exitCode=1;}
finally{clearInterval(heartbeat);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('worker closed'));}socket?.close();}
