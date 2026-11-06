// One bounded control worker. The independent Python supervisor owns Chrome.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const [directory]=process.argv.slice(2), config=JSON.parse(await readFile(path.join(directory,'config.json'),'utf8'));
const heartbeat=setInterval(()=>process.stdout.write('heartbeat\n'),1000);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const stage=name=>process.stdout.write(JSON.stringify({stage:name})+'\n');
let socket,session,id=0;const pending=new Map(),errors=[];
try {
 stage('debugging endpoint');let active;
 for(let n=0;n<100;n++){try{active=(await readFile(path.join(directory,'profile/DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{await delay(100);}}
 if(!active)throw Error('Chrome did not expose its task-owned debugging endpoint');
 stage('websocket');socket=new WebSocket(`ws://127.0.0.1:${active[0]}${active[1]}`);
 await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(p.method+': '+m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.bindingCalled'&&m.params.name==='__labFaultEntered'&&m.sessionId===session){writeFile(path.join(directory,'fault-entered.json'),JSON.stringify({kind:'page-hang',entered:true,targetId:created.targetId,runId:path.basename(directory)})).catch(error=>errors.push(String(error)));}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+(m.params.exceptionDetails.exception?.description||''));else if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params.entry.text);};
 const send=(method,params={},sid=session)=>new Promise((resolve,reject)=>{const request=++id;const timer=setTimeout(()=>{pending.delete(request);reject(Error('CDP deadline: '+method));},10000);pending.set(request,{resolve,reject,timer,method});socket.send(JSON.stringify({id:request,method,params,...(sid?{sessionId:sid}:{})}));});
 stage('create target');const created=await send('Target.createTarget',{url:'about:blank'},null);
 stage('attach target');({sessionId:session}=await send('Target.attachToTarget',{targetId:created.targetId,flatten:true},null));
 stage('enable protocol');await send('Runtime.enable');await send('Log.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 stage('navigate');await send('Page.navigate',{url:config.url});await send('Page.bringToFront');
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const until=async(expression,seconds=45)=>{const deadline=Date.now()+seconds*1000;while(Date.now()<deadline){const value=await evaluate(expression);if(value)return value;await delay(250);}throw Error('Page condition deadline: '+expression);};
 stage('title ready');await until("document.querySelector('#mode-cruisin') && !document.querySelector('#mode-cruisin').disabled");
 if(!config.probe&&!config.smoke)await until('window.__performanceLab?.ready');
 stage('title gesture');const box=await evaluate("(()=>{const r=document.querySelector('#mode-cruisin').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
 const hit=await evaluate(`({x:${box.x},y:${box.y},hit:document.elementFromPoint(${box.x},${box.y})?.id,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport.scale})`);stage('hit test '+JSON.stringify(hit));
 const before=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(directory,'before-click.png'),Buffer.from(before.data,'base64'));
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...box});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});
 const gesture=await evaluate("({focused:document.hasFocus(),hidden:document.hidden,active:document.activeElement?.id,clicked:window.__probeClicked,gpu:window.__probeGpu,button:document.querySelector('#mode-cruisin')?.outerHTML})");
 await writeFile(path.join(directory,'gesture.json'),JSON.stringify(gesture));stage('gesture observed '+JSON.stringify(gesture));
 if(config.fault==='worker-death'){await writeFile(path.join(directory,'fault-entered.json'),JSON.stringify({kind:'worker-death',entered:true,targetId:created.targetId,runId:path.basename(directory)}));process.kill(process.pid,'SIGKILL');}
 if(config.fault==='page-hang'){await send('Runtime.addBinding',{name:'__labFaultEntered'});evaluate('__labFaultEntered("entered");while(true){}').catch(error=>writeFile(path.join(directory,'fault-error.json'),JSON.stringify({error:String(error)}))); await new Promise(()=>{});}
 stage('started');if(config.probe){
  const gpu=await until('window.__probeGpu');
  if(/swiftshader|software|llvmpipe/i.test(gpu))throw Error('Software rendering refused: '+gpu);
  const verified=await evaluate('window.__probeGpuVerified===true');
  const visible=await evaluate('!document.hidden'),focused=await evaluate('document.hasFocus()');
  if(!verified||!visible||!focused)throw Error('Hardware GPU probe must be verified, visible and focused');
  await writeFile(path.join(directory,'probe.json'),JSON.stringify({gpu,gpuVerified:verified,visible,focused,titleGesture:true}));
 }else if(config.smoke){
  await until("document.body.classList.contains('game-started') && window.__game?.renderer");
  await delay(5000);
  const result=await evaluate(`(()=>{const g=window.__game,r=g.renderer,gl=r.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {started:document.body.classList.contains('game-started'),labAbsent:!window.__performanceLab,gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,width:r.domElement.width,height:r.domElement.height,targetWidth:g.composer.readBuffer.width,targetHeight:g.composer.readBuffer.height,dpr:r.getPixelRatio(),focused:document.hasFocus(),visible:!document.hidden};})()`);
  if(!result.started||!result.labAbsent||!result.gpu||/software|swiftshader|llvmpipe/i.test(result.gpu)||!result.visible||!result.focused)throw Error('Ordinary game smoke failed: '+JSON.stringify(result));
  await writeFile(path.join(directory,'smoke.json'),JSON.stringify(result));
 }else{
  await until('window.__performanceLab?.ready');
  await evaluate(`window.__performanceLab.start(${JSON.stringify(config.run)})`);
  let last=null;
  while(true){
   const status=await evaluate('window.__performanceLab.status()');
   if(status.state!==last){last=status.state;process.stdout.write(JSON.stringify(status)+'\n');}
   if(status.state==='completed'||status.state==='failed')break;
   await delay(1000);
  }
  if(errors.length)throw Error(errors.join('\n'));
  await until('window.__performanceLab.status().saved',15);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(path.join(directory,'scene.png'),Buffer.from(shot.data,'base64'));
 }
 if(errors.length)throw Error(errors.join('\n'));
 await send('Target.closeTarget',{targetId:created.targetId},null);
 await writeFile(path.join(directory,'worker-result.json'),JSON.stringify({ok:true,errors}));
}catch(error){await writeFile(path.join(directory,'worker-result.json'),JSON.stringify({ok:false,error:String(error),errors}));process.exitCode=1;}
finally{clearInterval(heartbeat);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('worker closed'));}socket?.close();}
