import { createMapStorage, EpochChanged } from './storage.js';
import { emptyBlock } from './model.js';
import { Input } from '../input.js';
import { Touch } from '../touch.js';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export async function checkMapStorage(){
  const name=`zerble-map-test-${Date.now()}`,a=createMapStorage(indexedDB,name),b=createMapStorage(indexedDB,name),world='fixture';
  try{
    const epoch=await a.epoch(world),one=emptyBlock(),two=emptyBlock();one.bits[0]=1;two.bits[0]=128;
    await Promise.all([a.write(world,'0,0',one,epoch),b.write(world,'0,0',two,epoch)]);
    check((await a.read(world,'0,0',epoch)).bits[0]===129,'Concurrent transaction union');
    check((await a.read('different','0,0',0)).bits[0]===0,'World isolation');
    const next=await a.reset(world);check(next===epoch+1,'Reset increments epoch');
    let fenced=false;try{await b.write(world,'0,0',one,epoch);}catch(e){fenced=e instanceof EpochChanged;}
    check(fenced,'Stale write fenced');check((await a.read(world,'0,0',next)).bits[0]===0,'Reset hides old blocks');
    return 'PASS: real IndexedDB concurrent union, seed isolation, reset epoch and stale-write fencing.';
  }finally{a.close();b.close();indexedDB.deleteDatabase(name);}
}
function touch(element,type,identifier,x,y){
  const event=new Event(type,{bubbles:true,cancelable:true});
  Object.defineProperty(event,'changedTouches',{value:[{identifier,clientX:x,clientY:y,target:element}]});
  Object.defineProperty(event,'touches',{value:type==='touchend'?[]:[{identifier,clientX:x,clientY:y,target:element}]});
  element.dispatchEvent(event);
}
export function checkMapInput(map){
  Touch.install();
  const stick=document.getElementById('stick-base'),r=stick.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
  touch(stick,'touchstart',700,x,y);touch(stick,'touchmove',700,x,y-45);
  check(Input.throttle>0,'Stick starts driving');const throttle=Input.throttle;
  map.setExpanded(true);check(Input.throttle===throttle,'Expansion retains held throttle');
  map.changeZoom(1.25);check(Input.throttle===throttle,'Zoom retains held throttle');
  map.setExpanded(false);check(Input.throttle===throttle,'Closing retains held throttle');
  touch(stick,'touchend',700,x,y-45);check(Input.throttle===0,'Release stops throttle');
  const music=document.getElementById('btn-music');touch(music,'touchstart',701,10,10);touch(music,'touchend',701,10,10);
  check(!Input.consumePressed('M'),'Touch music does not open map');check(Input.consumePressed('J'),'Touch music retains its separate action');
  map.setExpanded(true);map.host.querySelector('.map-expand').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));
  check(!Input.consumePressed('SPACE'),'Map button activation does not honk');
  map.setExpanded(false);
  return 'PASS: real touch stick held across expansion/zoom/close, release, music action separation, Space isolation.';
}

export async function checkMapTransitions(map){
  const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  const frames=[];
  async function settle(){
    const deadline=performance.now()+1000;
    do{
      await nextFrame();
      const rect=map.host.getBoundingClientRect();
      check(Math.abs(rect.width-map.width)<3&&Math.abs(rect.height-map.height)<3,'Canvas logical viewport follows animated panel');
      if(map.transitioning&&!map.expanded)check(map.background.width>map.compactDiameter,'Collapse retains full backing');
      const backdrop=map.backdrop.getBoundingClientRect();
      check(Math.abs(backdrop.width-innerWidth)<1&&Math.abs(backdrop.height-innerHeight)<1,'Backdrop stays full-screen during map motion');
      check(getComputedStyle(map.host).backgroundColor==='rgba(0, 0, 0, 0)','Moving map panel has no dark fill');
      if(map.transitioning)check(Number(getComputedStyle(map.host,'::before').opacity)===0,'Compact disc does not morph through the moving panel');
      frames.push({width:rect.width,height:rect.height,backing:map.background.width,backdropOpacity:Number(getComputedStyle(map.backdrop).opacity)});
      if(performance.now()>deadline)throw Error('Map transition did not settle');
    }while(map.transitioning);
  }
  map.setExpanded(true);await settle();
  const expandedOpacity=Number(getComputedStyle(map.background).opacity);
  check(Math.abs(expandedOpacity-.4508)<.005,'Expanded terrain opacity reduced by another 30 percent');
  check(!map.host.contains(map.backdrop),'Backdrop is independent of map clipping');
  check(getComputedStyle(map.overlay).opacity==='1','Icons retain full opacity');
  map.setExpanded(false);await settle();
  check(Number(getComputedStyle(map.backdrop).opacity)<.01,'Full-screen dimming fades away after closing');
  check(getComputedStyle(map.host).borderTopWidth==='0px','No permanent minimap border');
  check(getComputedStyle(map.host).boxShadow==='none','No rectangular panel shadow');
  check(getComputedStyle(map.host.querySelector('.map-expand')).borderTopLeftRadius==='50%','Keyboard focus follows circle');
  map.setExpanded(true);await nextFrame();await nextFrame();map.setExpanded(false);await nextFrame();map.setExpanded(true);await settle();
  map.setExpanded(false);await settle();
  return `PASS: ${frames.length} live animation frames follow panel bounds, retain backings through collapse, reverse safely, keep dimming full-screen until it fades, remove border/shadow and reduce expanded terrain opacity to 45%.`;
}
