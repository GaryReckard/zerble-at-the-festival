import '../../styles.css';
import { checkMapStorage, checkMapInput, checkMapTransitions } from './workshopChecks.js';
import { FestivalMap } from './view.js';
import { CONFIG } from '../worldgen/constants.js';
import { KINDS } from './markers.js';
const layout=new URLSearchParams(location.search).get('viewport');
if(layout){
  document.body.classList.remove('game-started');document.body.style.overflow='auto';
  const frame=document.createElement('iframe');frame.title='Touch map viewport';frame.src='./festival-map-preview.html?mute=1&touch=1';
  frame.style.cssText=`display:block;border:2px solid #fff8;width:${layout==='landscape'?844:390}px;height:${layout==='landscape'?390:844}px;max-width:none;margin:10px`;
  document.body.replaceChildren(frame);
}else{
const map=new FestivalMap({seed:1977,config:CONFIG,preview:true,namespace:'festival-map-workshop-1977'});
const player={x:0,z:0};let driving=false,heading=0,last=performance.now();const held=new Set();
const landmarks=[{id:'fixture:stage',kind:'stage_front',x:80,z:0,label:'Workshop stage'},{id:'fixture:juice',kind:'bubble_vendor',x:-30,z:45,label:'Workshop juice stand'}];
const result=document.getElementById('check-result');
document.getElementById('storage-checks').onclick=async()=>{try{result.textContent=await checkMapStorage();}catch(e){result.textContent=`FAIL: ${e.message}`;}};
document.getElementById('transition-checks').onclick=async()=>{try{result.textContent=await checkMapTransitions(map);}catch(e){result.textContent=`FAIL: ${e.message}`;}};
document.getElementById('input-checks').onclick=()=>{try{result.textContent=checkMapInput(map);}catch(e){result.textContent=`FAIL: ${e.message}`;}};
if(new URLSearchParams(location.search).has('touch')){document.body.classList.add('is-touch');map.measure();}
document.getElementById('drive').onclick=()=>driving=!driving;
document.getElementById('jump').onclick=()=>{player.x+=1200;};
document.getElementById('objective').onclick=()=>{map.setObjectives([{id:'fixture:objective',x:player.x+900,z:player.z-800,label:'Passenger destination'}]);map.track('fixture:objective');};
document.getElementById('reset').onclick=()=>void map.reset();
window.addEventListener('keydown',e=>{if(e.target.closest('select,button'))return;held.add(e.key.toLowerCase());if(e.key.toLowerCase()==='m'&&!e.repeat)map.toggle();});
window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>held.clear());
let proofAt=0,raf;
function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;heading+=(held.has('a')?1:0)*dt-(held.has('d')?1:0)*dt;const speed=driving||held.has('w')?25:held.has('s')?-15:0;player.x-=Math.sin(heading)*speed*dt;player.z-=Math.cos(heading)*speed*dt;
 for(const marker of landmarks)map.discovery.remember(marker);
 const live=[{id:'fixture:lurleen',kind:'lurleen',x:player.x+40,z:player.z+35,label:KINDS.lurleen.label,live:true}];
 map.tick({player,heading,live,dt});
 if(now-proofAt>500){document.getElementById('map-proof').textContent=JSON.stringify({...map.snapshot(),position:player},null,2);proofAt=now;}
 raf=requestAnimationFrame(tick);
}
raf=requestAnimationFrame(tick);
window.addEventListener('pagehide',e=>{if(!e.persisted)cancelAnimationFrame(raf);});

}
