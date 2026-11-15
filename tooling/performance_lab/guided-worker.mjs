// One bounded control worker. The independent Python supervisor owns Chrome.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const [directory]=process.argv.slice(2), config=JSON.parse(await readFile(path.join(directory,'guided-config.json'),'utf8'));
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
 
 stage('title gesture');const box=await evaluate("(()=>{const r=document.querySelector('#mode-cruisin').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
 const hit=await evaluate(`({x:${box.x},y:${box.y},hit:document.elementFromPoint(${box.x},${box.y})?.id,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport.scale})`);stage('hit test '+JSON.stringify(hit));
 const before=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(directory,'before-click.png'),Buffer.from(before.data,'base64'));
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...box});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});
 const gesture=await evaluate("({focused:document.hasFocus(),hidden:document.hidden,active:document.activeElement?.id,clicked:window.__probeClicked,gpu:window.__probeGpu,button:document.querySelector('#mode-cruisin')?.outerHTML})");
 await writeFile(path.join(directory,'gesture.json'),JSON.stringify(gesture));stage('gesture observed '+JSON.stringify(gesture));
 stage('guided capture started');
 await until("document.body.classList.contains('game-started') && window.__game?.renderer");
 const gpu=await evaluate(`(()=>{const gl=window.__game.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,visible:!document.hidden,focused:document.hasFocus(),labAbsent:!window.__performanceLab};})()`);
 if(!gpu.gpu||/software|swiftshader|llvmpipe/i.test(gpu.gpu)||!gpu.visible||!gpu.focused||!gpu.labAbsent)throw Error('Guided GPU/foreground check failed: '+JSON.stringify(gpu));
 await writeFile(path.join(directory,'gpu.json'),JSON.stringify(gpu));
 let previous='';
 const finish=Date.now()+config.deadline*1000;
 while(true){
  const state=await evaluate("({text:document.querySelector('#device-perf-capture [role=status]')?.textContent,visible:!document.hidden,focused:document.hasFocus()})");
  if(!state.visible||!state.focused)throw Error('Guided capture lost foreground');
  if(state.text!==previous){previous=state.text;stage(state.text||'awaiting capture status');}
  if(state.text?.includes('SAVED')){if(state.text.includes('INTERRUPTED'))throw Error(state.text);break;}
  if(state.text?.includes('SEND FAILED'))throw Error(state.text);
  if(Date.now()>finish)throw Error('Guided completion deadline');
  await delay(1000);
 }
 const report=JSON.parse(await readFile(path.join(directory,'device-report.json'),'utf8'));
 if(report.schema!=='zerble-device-perf-v2'||report.reason!=='complete'||report.valid!==true||report.session?.autopilot?.complete!==true||report.errors?.length||report.visibilityEvents?.length)throw Error('Invalid guided final report');
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 await writeFile(path.join(directory,'scene.png'),Buffer.from(shot.data,'base64'));
 const census=await evaluate("typeof window.__dbg?.drawCensus==='function' ? window.__dbg.drawCensus({top:40}) : null");
 await writeFile(path.join(directory,'draw-census.json'),JSON.stringify(census));
 if(errors.length)throw Error(errors.join('\n'));
 await send('Target.closeTarget',{targetId:created.targetId},null);
 await writeFile(path.join(directory,'worker-result.json'),JSON.stringify({ok:true,errors}));
}catch(error){await writeFile(path.join(directory,'worker-result.json'),JSON.stringify({ok:false,error:String(error),errors}));process.exitCode=1;}
finally{clearInterval(heartbeat);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('worker closed'));}socket?.close();}
