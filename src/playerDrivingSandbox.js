import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Zerble } from './zerble.js';
import { Input } from './input.js';
import { Sound } from './sound.js';
import { PERF } from './perf.js';
import { FixedStepClock } from './physics/fixedStep.js';
import { createRapierAdapter } from './physics/rapierAdapter.js';
import { createPlayerVehicle } from './physics/playerVehicle.js';
import { engineDemand } from './engineDemand.js';
import { VehicleCondition } from './vehicleCondition.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),listeners=new AbortController();
const names=['surfaces','ridge','creek','lake','obstacle'];
let adapter,vehicle,clock=new FixedStepClock(),last=0,frameHandle=0,disposed=false,paused=false,replaying=false,night=false,audio=false,readoutAt=0;
let condition=new VehicleCondition(),stepMs=0,maxStepMs=0,totalStepMs=0,stepCount=0;const envelope={};
let fixtureName=names.includes(params.get('fixture'))?params.get('fixture'):'surfaces';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,250),cart=new Zerble();
cart.physicsDriven=true;scene.add(cart.root);
const renderer=new THREE.WebGLRenderer({canvas:$('course'),antialias:PERF.antialias});
renderer.setPixelRatio(Math.min(devicePixelRatio,PERF.pixelRatioCap));renderer.outputColorSpace=THREE.SRGBColorSpace;
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enabled=false;
const sky=new THREE.HemisphereLight(0xd6f0ff,0x6c6640,2.1),sun=new THREE.DirectionalLight(0xffe2ad,2.5);sun.position.set(-30,70,20);scene.add(sky,sun);
const course=new THREE.Group();scene.add(course);const bodyIds=[],supportIds=new Set(),held=new Set(),controls={throttle:0,steer:0,boost:false,slow:false,brake:false};
const desired=new THREE.Vector3(),look=new THREE.Vector3(),currentLook=new THREE.Vector3(),resources={geometry:new Set(),material:new Set(),texture:new Set()};
function listen(target,type,callback){target.addEventListener(type,callback,{signal:listeners.signal});}
function heightAt(_x,z){
  if(fixtureName==='ridge')return z< -50?-6:z< -35?4.5:z< -20?(-20-z)*.3:0;
  if(fixtureName==='creek')return z> -5||z< -20?0:z> -8?-( -5-z)/3*.7:z< -17?-(z+20)/3*.7:-.7;
  if(fixtureName==='lake')return -Math.min(6,Math.max(0,(-8-z)*.2));
  return 0;
}
function surfaceAt(x,z,out={}){return Object.assign(out,{surfaceClass:(fixtureName==='creek'&&heightAt(x,z)<0)||fixtureName==='lake'&&z< -8?'riverbed':x< -8?'asphalt':x>8?'grass':'dirt',height:heightAt(x,z),nx:0,ny:1,nz:0});}
function waterAt(x,z,out={}){
  const wet=Math.abs(x)<25&&(fixtureName==='creek'&&z< -5&&z> -20||fixtureName==='lake'&&z< -8&&z> -90),bedY=heightAt(x,z);
  return Object.assign(out,{wet,depth:wet?.02-bedY:0,surfaceY:.02,bedY,kind:fixtureName==='creek'?'creek':'lake'});
}
function track(root){root.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)resources.geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&!m.userData.shared){resources.material.add(m);for(const v of Object.values(m))if(v?.isTexture&&!v.userData.shared)resources.texture.add(v);}});}
function clearCourse(){vehicle?.dispose();vehicle=null;for(const id of bodyIds)adapter.removeBody(id);bodyIds.length=0;supportIds.clear();track(course);course.clear();for(const group of Object.values(resources)){for(const resource of group)resource.dispose();group.clear();}}
function addSupport(id,vertices,indices){const result=adapter.addBody({id,type:'fixed',pose:{position:{x:0,y:0,z:0}},colliders:[{shape:'trimesh',vertices,indices,friction:.6}]});if(!result.ok)throw new Error(`Course support ${result.reason}`);bodyIds.push(id);supportIds.add(id);}
function groundStrip(z0,z1,id){
  const vertices=[],colors=[],indices=[],width=51;
  for(let z=z0;z<=z1;z++)for(let x=-25;x<=25;x++){
    vertices.push(x,fixtureName==='ridge'&&z1===-50?-6:heightAt(x,z),z);
    const surface=surfaceAt(x,z).surfaceClass,color=new THREE.Color(surface==='asphalt'?0x555b5b:surface==='grass'?0x7ca558:surface==='riverbed'?0x89765a:0xbb9c6e);
    colors.push(color.r,color.g,color.b);
  }
  for(let row=0;row<z1-z0;row++)for(let col=0;col<50;col++){const a=row*width+col,b=a+1,c=a+width,d=c+1;indices.push(a,c,b,b,c,d);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  course.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true})));addSupport(id,new Float32Array(vertices),new Uint32Array(indices));
}
function reset(){
  Input.clear();held.clear();clock.reset();condition=new VehicleCondition();replaying=false;last=0;paused=false;orbit.enabled=false;$('pause').textContent='Pause';
  cart.position.set(0,heightAt(0,20)+.12,20);cart.root.quaternion.identity();cart.heading=0;cart.speed=0;vehicle.reset('restart');$('replay').textContent='Drive replay';$('status').textContent='WASD to drive · Space to brake';
  currentLook.set(cart.position.x,cart.position.y+1.5,cart.position.z);
}
function setFixture(name){
  if(!adapter||disposed)throw new Error('Driving course is not ready');
  if(!names.includes(name))throw new RangeError('Unknown driving fixture');
  clearCourse();fixtureName=name;$('fixture').value=name;
  if(name==='ridge'){groundStrip(-90,-50,'lower');groundStrip(-50,30,'upper');}else groundStrip(-90,30,'ground');
  if(name==='creek'||name==='lake'){
    const minZ=name==='creek'?-20:-90,maxZ=name==='creek'?-5:-8;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(50,maxZ-minZ),new THREE.MeshStandardMaterial({color:0x488d9f,transparent:true,opacity:.68,roughness:.35,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(0,.02,(minZ+maxZ)/2);course.add(mesh);
  }
  if(name==='obstacle'){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1.3,10,9),new THREE.MeshStandardMaterial({color:0x77543d,roughness:1}));mesh.position.set(0,5,-20);course.add(mesh);
    const admitted=adapter.addBody({id:'tree',type:'fixed',vehicleSupport:false,pose:{position:{x:0,y:5,z:-20}},colliders:[{shape:'cylinder',radius:1.25,halfHeight:5,friction:.6}]});if(!admitted.ok)throw new Error(admitted.reason);bodyIds.push('tree');
  }
  cart.position.set(0,.12,20);cart.root.quaternion.identity();cart.speed=0;
  vehicle=createPlayerVehicle({adapter,cart,sampleSurface:surfaceAt,sampleWater:waterAt,canRecover:pose=>{
    const body=adapter.readBody('live-cart'),query=adapter.queryBodyContacts('live-cart',body.generation,pose);
    return query.ok&&query.contacts.every(c=>supportIds.has(c.id));
  }});reset();
  params.set('fixture',name);params.set('mute','1');history.replaceState(null,'',`${location.pathname}?${params}`);
}
function step(dt){
  controls.throttle=replaying?clock.time<8?1:0:(held.has('forward')?1:0)-(held.has('reverse')?1:0)||Input.throttle;
  controls.steer=replaying?0:(held.has('left')?1:0)-(held.has('right')?1:0)||Input.steer;
  controls.boost=held.has('boost')||Input.boost;controls.slow=Input.slow;controls.brake=held.has('brake')||Input.isDown('SPACE')||replaying&&clock.time>=8;
  const before=adapter.readBody('live-cart'),started=performance.now();
  vehicle.beforeStep(dt,controls);adapter.step(dt);const solved=vehicle.afterStep(dt);cart.update(dt,controls,night?1:0);
  stepMs=performance.now()-started;maxStepMs=Math.max(maxStepMs,stepMs);totalStepMs+=stepMs;stepCount++;
  const drained=adapter.drainEvents();let severity=solved.landingSpeed;
  for(const event of drained.events){
    if(event.type!=='contact-force'||event.a!=='live-cart'&&event.b!=='live-cart')continue;
    const direction=event.maxForceDirection,v=before.linearVelocity;
    const incoming=Math.abs(v.x*direction.x+v.y*direction.y+v.z*direction.z);
    severity=Math.max(severity,Math.min(incoming,event.totalForceMagnitude*dt/before.mass));
  }
  condition.impact(severity,clock.time,'chassis');condition.step(dt,solved.immersion);
  if(condition.cause){paused=true;replaying=false;orbit.enabled=true;$('pause').textContent='Resume';$('status').textContent=condition.cause==='submerged'?'Zerble is submerged. Reset to try again.':'Zerble needs a repair. Reset to try again.';}
  Sound.setEngineSpeed(cart.speed,cart.isBoosting?1:0,engineDemand({...cart.engineState,speed:Math.hypot(cart.velocity.x,cart.velocity.z),immersion:cart.submersion,stopped:!!condition.cause},envelope));
  if(Math.abs(cart.position.x)>40||cart.position.z< -100||cart.position.z>40||cart.position.y< -20)reset();
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
function setNight(value){night=value;scene.background=new THREE.Color(night?0x101b37:0xbcdde0);sky.intensity=night?.65:2.1;sun.intensity=night?.25:2.5;}
function frame(time){
  if(disposed)return;frameHandle=requestAnimationFrame(frame);
  const dt=last?Math.min(.05,(time-last)/1000):0;last=time;
  if(!paused&&!document.hidden&&vehicle)clock.advance(dt,step,{canStep:()=>!condition.cause});
  vehicle?.beginRender(paused?1:clock.alpha);
  if(!paused){const yaw=cart.heading;desired.set(cart.position.x+Math.sin(yaw)*13,cart.position.y+8,cart.position.z+Math.cos(yaw)*13);look.set(cart.position.x,cart.position.y+1.5,cart.position.z);const ease=1-Math.exp(-5*dt);camera.position.lerp(desired,ease);currentLook.lerp(look,ease);camera.lookAt(currentLook);orbit.target.copy(currentLook);}else{orbit.update();currentLook.copy(orbit.target);}
  renderer.render(scene,camera);
  vehicle?.endRender();
  if(time-readoutAt>120&&vehicle){readoutAt=time;const s=vehicle.state();$('readout').textContent=`${(Math.abs(s.speed)*3.6).toFixed(1)} km/h\n${s.surface} · ${s.contacts}/4 wheels\nHeight ${cart.position.y.toFixed(2)} m\nVertical speed ${s.velocity.y.toFixed(2)} m/s\nWater depth ${s.water.depth.toFixed(2)} m\nImmersion ${s.immersion.toFixed(2)} m\nEngine ${(s.engine.revs*100).toFixed(0)}% · load ${(s.engine.load*100).toFixed(0)}%\nImpact Δv ${s.impactSpeed.toFixed(2)} m/s\nDamage ${condition.damage.toFixed(0)}% · ${condition.cause??'drivable'}\nRecovery ${s.recoveries} · ${paused?'paused':'running'}`;$('budget').textContent=`${renderer.info.render.calls} draws · ${renderer.info.render.triangles.toLocaleString()} triangles · ${PERF.name} · ${adapter.counts().vehicles} vehicle · fixed 60 Hz · physics ${(totalStepMs/(stepCount||1)).toFixed(2)} ms mean / ${maxStepMs.toFixed(2)} max`;}
}
function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frameHandle);listeners.abort();Sound.setMuted(true);clearCourse();adapter?.dispose();orbit.dispose();track(cart.root);for(const group of Object.values(resources))for(const resource of group)resource.dispose();renderer.dispose();}
listen($('fixture'),'change',e=>setFixture(e.target.value));listen($('reset'),'click',reset);
listen($('replay'),'click',()=>{reset();replaying=true;paused=false;orbit.enabled=false;$('pause').textContent='Pause';$('replay').textContent='Replaying';});
listen($('pause'),'click',()=>{if(condition.cause)return;paused=!paused;orbit.enabled=paused;last=0;$('pause').textContent=paused?'Resume':'Pause';});
listen($('noon'),'click',()=>setNight(false));listen($('midnight'),'click',()=>setNight(true));
listen($('audio'),'click',()=>{Sound.init();audio=!audio;Sound.setMuted(!audio);$('audio').textContent=audio?'Mute sound':'Enable sound';});
for(const button of document.querySelectorAll('[data-drive]')){
  listen(button,'pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);held.add(button.dataset.drive);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(button,event,()=>held.delete(button.dataset.drive));
}
listen(window,'blur',()=>{held.clear();Input.clear();});listen(window,'resize',resize);listen(document,'visibilitychange',()=>{last=0;held.clear();});listen(window,'pagehide',dispose);listen(window,'pageshow',e=>{if(e.persisted&&disposed)location.reload();});
for(const id of ['fixture','reset','replay'])$(id).disabled=true;
window.__driving={get ready(){return !!vehicle&&!disposed;},state:()=>({...vehicle?.state(),condition:condition.snapshot(),physics:{stepMs,maxStepMs,meanStepMs:totalStepMs/(stepCount||1),steps:stepCount}}),fixture:setFixture,reset,replay(){reset();replaying=true;paused=false;},pause(value=true){paused=!!value||!!condition.cause;orbit.enabled=paused;last=0;},step(count=1){for(let i=0;i<Math.min(600,Math.max(0,count))&&!condition.cause;i++)step(1/60);},cart,scene,camera,renderer,dispose};
try{
  Sound.setMuted(true);adapter=await createRapierAdapter({capacities:{bodies:12,colliders:24,vehicles:1,events:256,meshVertices:40000,meshTriangles:40000}});
  if(disposed)adapter.dispose();else{setFixture(fixtureName);setNight(params.get('tod')==='midnight');resize();camera.position.set(13,8,33);camera.lookAt(cart.position);for(const id of ['fixture','reset','replay'])$(id).disabled=false;frameHandle=requestAnimationFrame(frame);}
}catch(error){$('error').style.display='block';$('error').textContent=error.stack;console.error(error);}
