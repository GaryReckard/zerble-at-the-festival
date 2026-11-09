// Disposable controller; accepted supervisor owns browser/server and exact-PID teardown.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const directory=process.argv[2],config=JSON.parse(await readFile(path.join(directory,'config.json'),'utf8'));
const heartbeat=setInterval(()=>process.stdout.write('heartbeat\n'),1000),pending=new Map(),errors=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket,session,id=0,targetId,send,evaluate,installed=false,startedAt,diagnostic={ok:false,scope:'Frozen rendering attribution only; no live FPS or ordinary frame acceptance',cases:[],errors};
async function persist(){await writeFile(path.join(directory,'diagnostic-result.json'),JSON.stringify(diagnostic,null,2));}
try{
  if(config.smoke!==true)throw Error('Rendering diagnostic requires accepted supervisor smoke=true configuration');
  let active;
  for(let n=0;n<100;n++){try{active=(await readFile(path.join(directory,'profile/DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{await delay(100);}}
  if(!active)throw Error('No owned debugging endpoint');
  socket=new WebSocket(`ws://127.0.0.1:${active[0]}${active[1]}`);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(p){pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(p.method+': '+message.error.message)):p.resolve(message.result);}}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);else if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')errors.push(message.params.entry.text);};
  send=(method,params={},sid=session)=>new Promise((resolve,reject)=>{const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error('CDP deadline: '+method));},10000);pending.set(request,{resolve,reject,timer,method});socket.send(JSON.stringify({id:request,method,params,...(sid?{sessionId:sid}:{})}));});
  evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value;};
  const until=async(expression,seconds=45)=>{const deadline=Date.now()+seconds*1000;while(Date.now()<deadline){const value=await evaluate(expression);if(value)return value;await delay(250);}throw Error('Condition deadline: '+expression);};
  ({targetId}=await send('Target.createTarget',{url:'about:blank'},null));
  ({sessionId:session}=await send('Target.attachToTarget',{targetId,flatten:true},null));
  await send('Runtime.enable');await send('Log.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  const url=new URL(config.url);url.searchParams.set('structuralProbe','1');url.searchParams.set('mute','1');
  // kidBatch intentionally remains unspecified unless already requested by the supervisor URL.
  await send('Page.navigate',{url:String(url)});await send('Page.bringToFront');
  console.log(JSON.stringify({stage:'ready title',url:String(url)}));
  await until("document.querySelector('#mode-cruisin')&&!document.querySelector('#mode-cruisin').disabled");
  const point=await evaluate("(()=>{const r=document.querySelector('#mode-cruisin').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  await until("!!(document.body.classList.contains('game-started')&&window.__dbg&&window.__game&&window.__structuralPresentation)");
  const hardware=await evaluate("(()=>{const g=__game,r=g.renderer,gl=r.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,visible:!document.hidden,focused:document.hasFocus(),width:r.domElement.width,height:r.domElement.height,targetWidth:g.composer.readBuffer.width,targetHeight:g.composer.readBuffer.height,childBatch:!!g.kids.presentation&&!g.kids.presentation.disposed,userAgent:navigator.userAgent};})()");
  if(!hardware.gpu||/swiftshader|software|llvmpipe/i.test(hardware.gpu)||!hardware.visible||!hardware.focused)throw Error('Hardware/focus gate failed: '+JSON.stringify(hardware));
  diagnostic.hardware=hardware;diagnostic.url=String(url);diagnostic.browser=await send('Browser.getVersion',{},null);
  console.log(JSON.stringify({stage:'settling',hardware}));await delay(20000);
  diagnostic.install=await evaluate(await readFile(path.join(directory,'render-install.js'),'utf8'));installed=true;
  startedAt=Date.now();
  const deadline=()=>{if(Date.now()-startedAt>150000)throw Error('Rendering diagnostic exceeded bounded 150s capture window');};
  const screenshot=async name=>{const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(directory,name),Buffer.from(result.data,'base64'));return name;};
  const sequence=['baseline','candidate','candidate','baseline','baseline','candidate','candidate','baseline'];
  for(const mode of ['third','first','top'])for(const [label,time]of [['noon',.3],['midnight',.75]]){
    deadline();
    // Only case setup runs live. Each subsequent A/B block stays on this exact frozen world.
    await evaluate('(()=>{__renderProbe.endCase();__debug.pause(false);__dbg.camUnlock();})()');
    for(let hop=0;hop<3;hop++){
      const current=await evaluate('__game.chaseCam.mode');if(current===mode)break;
      const next={third:'first',first:'top',top:'third'}[current];if(!next)throw Error('Unknown native camera mode: '+current);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'v',code:'KeyV',windowsVirtualKeyCode:86});await delay(80);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'v',code:'KeyV',windowsVirtualKeyCode:86});
      await until(`__game.chaseCam.mode===${JSON.stringify(next)}`,3);
    }
    await until(`__game.chaseCam.mode===${JSON.stringify(mode)}`,3);
    await evaluate(`__dbg.tod(${time})`);await delay(350);await evaluate('__debug.pause(true)');
    const sceneCase={mode,label,time,mechanisms:[]};diagnostic.cases.push(sceneCase);
    for(const mechanism of ['static-flags','vendor-instances']){
      deadline();const record={mechanism,blocks:[],screenshots:[]};sceneCase.mechanisms.push(record);
      record.inventory=await evaluate(`__renderProbe.beginCase(${JSON.stringify(mechanism)})`);
      if(mechanism==='static-flags')record.matrixAudit=await evaluate('__renderProbe.matrixAudit()');
      for(let block=0;block<sequence.length;block++){
        deadline();const variant=sequence[block];
        // One Runtime call lasts roughly 0.4 seconds at 60Hz, below the 10s CDP deadline.
        const result=await evaluate(`__renderProbe.block(${JSON.stringify(variant)},24)`);record.blocks.push({...result,block});
        if(block<2){const name=`${mode}-${label}-${mechanism}-${variant}.png`;record.screenshots.push({variant,path:await screenshot(name)});}
        await persist();
      }
      const baseline=record.blocks.filter(b=>b.variant==='baseline').flatMap(b=>b.samples),candidate=record.blocks.filter(b=>b.variant==='candidate').flatMap(b=>b.samples);
      const maximum=(samples,key)=>Math.max(...samples.map(s=>s[key]));
      record.submissionComparison={baselineMaxCalls:maximum(baseline,'calls'),candidateMaxCalls:maximum(candidate,'calls'),baselineMaxTriangles:maximum(baseline,'triangles'),candidateMaxTriangles:maximum(candidate,'triangles')};
      record.submissionComparison.callsRegressed=record.submissionComparison.candidateMaxCalls>record.submissionComparison.baselineMaxCalls;
      record.submissionComparison.trianglesRegressed=record.submissionComparison.candidateMaxTriangles>record.submissionComparison.baselineMaxTriangles;
      record.restored=await evaluate('(()=>{__renderProbe.restoreVariant();return __renderProbe.verify();})()');
      console.log(JSON.stringify({stage:'case mechanism complete',mode,label,mechanism,submissionComparison:record.submissionComparison}));
      await persist();
    }
  }
  diagnostic.captureElapsedMs=Date.now()-startedAt;
  diagnostic.restored=await evaluate('__renderProbe.finish()');installed=false;
  if(errors.length)throw Error(errors.join('\n'));
  diagnostic.ok=true;await persist();
}catch(error){diagnostic.error=String(error);diagnostic.ok=false;process.exitCode=1;}
finally{
  if(installed&&evaluate){try{diagnostic.finallyRestored=await evaluate('__renderProbe.finish()');installed=false;}catch(error){diagnostic.cleanupError=String(error);diagnostic.ok=false;process.exitCode=1;}}
  // Owned-target closure also runs on assertion, evaluate deadline and partial-result failures.
  if(targetId&&send){try{diagnostic.targetClosed=await send('Target.closeTarget',{targetId},null);}catch(error){diagnostic.targetCloseError=String(error);diagnostic.ok=false;process.exitCode=1;}}
  await persist().catch(error=>{process.stderr.write(String(error)+'\n');process.exitCode=1;});
  await writeFile(path.join(directory,'worker-result.json'),JSON.stringify({ok:diagnostic.ok,error:diagnostic.error,cleanupError:diagnostic.cleanupError,targetCloseError:diagnostic.targetCloseError,errors})).catch(()=>{process.exitCode=1;});
  clearInterval(heartbeat);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('worker closed'));}socket?.close();
}
