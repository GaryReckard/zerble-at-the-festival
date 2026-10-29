import { CELL, VERSION, finitePoint, projectPin, tileView } from './model.js';
import { Discovery } from './discovery.js';
import { createMapStorage } from './storage.js';
import { Geography } from './geography.js';
import { KINDS } from './markers.js';
import '../../festival-map.css';
export const MAP_VISIBLE_KEY='zerble.map.visible';
const canvas=()=>document.createElement('canvas');
const textDistance=n=>n>=1000?`${(n/1000).toFixed(1)} km`:`${Math.round(n)} m`;
export class FestivalMap {
  constructor({seed,mode='v2',config={},tier='mid',storage=createMapStorage(),namespace,preview=false}={}) {
    this.namespace=namespace||`${VERSION}:${mode}:${seed}`;this.options={seed,mode,config};this.tier=tier;
    this.discovery=new Discovery(this.namespace,storage);this.rasters=new Map();this.objectives=new Map();this.live=[];
    this.player={x:0,z:0};this.heading=0;this.expanded=false;this.compact=true;this.preview=preview;
    this.samples=[];this.sampleIndex=0;this.zoom=1;this.scale=.55;this.stats={drawMs:0,rasterMs:0};this.scope=new AbortController();this.pointers=new Map();
    try{this.compact=localStorage.getItem(MAP_VISIBLE_KEY)!=='0';}catch{}
    this.backdrop=document.createElement('div');this.backdrop.className='festival-map-backdrop';
    this.backdrop.hidden=true;this.backdrop.setAttribute('aria-hidden','true');
    this.host=document.createElement('section');this.host.className='festival-map';this.host.hidden=true;this.host.id='festival-map';
    this.host.setAttribute('aria-label','Festival map');
    this.host.innerHTML=`<canvas class="map-geography" aria-hidden="true"></canvas><canvas class="map-markers" aria-hidden="true"></canvas>
      <button class="map-expand" aria-label="Expand festival map" aria-expanded="false"><span>MAP</span><span>↗</span></button>
      <div class="map-pin-options" role="group" aria-label="Map destinations"></div>
      <div class="map-footer"><span class="map-selection"></span><span class="map-status" role="status"></span></div>`;
    document.body.append(this.backdrop,this.host);this.background=this.host.querySelector('.map-geography');this.overlay=this.host.querySelector('.map-markers');
    this.pinOptions=this.host.querySelector('.map-pin-options');this.selectionText=this.host.querySelector('.map-selection');this.statusText=this.host.querySelector('.map-status');
    const listen=(target,event,fn,opts={})=>target.addEventListener(event,fn,{...opts,signal:this.scope.signal});
    listen(this.host.querySelector('.map-expand'),'click',()=>this.setExpanded(true));
    listen(this.pinOptions,'click',event=>{const id=event.target.closest('[data-map-pin]')?.dataset.mapPin;if(id)this.togglePin(id);});
    listen(this.pinOptions,'focusin',event=>{this.focusedPin=event.target.dataset.mapPin||null;});
    listen(this.pinOptions,'focusout',event=>{if(!this.pinOptions.contains(event.relatedTarget))this.focusedPin=null;});
    listen(this.host,'wheel',e=>{e.preventDefault();e.stopPropagation();if(this.expanded)this.changeZoom(e.deltaY<0?1.15:1/1.15);},{passive:false});
    listen(this.host,'keydown',e=>{
      if(e.key===' '&&e.target.closest('button'))e.stopPropagation();
      if(e.key==='Escape'&&this.expanded){e.preventDefault();e.stopPropagation();this.setExpanded(false);}
    });
    // Only touches starting on this canvas belong to map zoom. Driving controls
    // live above the panel and retain their existing identifier ownership.
    listen(this.overlay,'pointerdown',e=>{
      if(!this.expanded)return;
      this.overlay.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.pointers.size===1){this.tapStart={x:e.clientX,y:e.clientY};this.dragged=false;this.pinched=false;}
      else this.pinched=true;
    });
    listen(this.overlay,'pointermove',e=>{
      if(!this.pointers.has(e.pointerId))return;
      const distance=()=>{const p=[...this.pointers.values()];return p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;};
      if(this.tapStart&&Math.hypot(e.clientX-this.tapStart.x,e.clientY-this.tapStart.y)>8)this.dragged=true;
      const before=distance();this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const after=distance();
      if(before>0&&after>0){this.changeZoom(after/before);this.pinched=true;}
    });
    listen(this.overlay,'pointerup',e=>{const owned=this.pointers.delete(e.pointerId);if(owned&&!this.pinched&&!this.dragged)this.pick(e.clientX,e.clientY);});
    listen(this.overlay,'pointercancel',e=>this.pointers.delete(e.pointerId));
    listen(window,'keydown',e=>{
      if(e.key==='Escape'&&this.expanded&&!e.target.closest?.('[role="dialog"]')){e.preventDefault();this.setExpanded(false);}
    });
    listen(window,'resize',()=>{this.pointers.clear();this.measure();});
    listen(window,'pagehide',e=>{void this.discovery.flush();if(e.persisted)this.suspend(true);else this.dispose();});
    listen(window,'pageshow',()=>{this.suspend(false);this.measure();});
    listen(document,'visibilitychange',()=>{this.suspend(document.hidden);if(document.hidden)void this.discovery.flush();});
    listen(this.host,'transitionend',event=>{
      if(event.target===this.host&&['width','height'].includes(event.propertyName))this.finishTransition();
    });
    this.measure();
  }
  measure(){
    if(this.closed)return;
    const touch=document.body.classList.contains('is-touch');this.touchLayout=touch;
    this.compactDiameter=touch?Math.min(100,innerWidth*.30,innerHeight*.24):Math.min(190,innerWidth*.36,innerHeight*.28);
    const w=this.expanded||this.transitioning?innerWidth:this.compactDiameter;
    const h=this.expanded||this.transitioning?innerHeight:this.compactDiameter;
    const cap=this.tier==='low'?.8:this.tier==='high'?1.5:1;
    const ratio=Math.min(devicePixelRatio||1,cap,1024/Math.max(w,h));this.ratio=ratio;
    // Keep one full-size backing throughout the morph. Resizing to the compact
    // backing at its start stretched that small image across the shrinking panel.
    for(const c of [this.background,this.overlay]){
      const width=Math.round(w*ratio),height=Math.round(h*ratio);
      if(c.width!==width)c.width=width;
      if(c.height!==height)c.height=height;
    }
    this.readViewport();this.lastBackground=0;
  }
  readViewport(){
    const rect=this.host.getBoundingClientRect();
    this.width=rect.width||(this.expanded?innerWidth:this.compactDiameter);
    this.height=rect.height||(this.expanded?innerHeight:this.compactDiameter);
    const travel=innerWidth-this.compactDiameter;
    this.roundness=travel>0?Math.max(0,Math.min(1,(innerWidth-this.width)/travel)):(this.expanded?0:1);
  }
  finishTransition(){
    if(!this.transitioning)return;
    this.transitioning=false;this.host.classList.remove('is-morphing');this.measure();
    this.host.hidden=!this.expanded&&!this.compact;
  }
  setExpanded(on){
    if(this.closed||this.expanded===!!on)return;
    this.expanded=!!on;this.pointers.clear();this.listSignature=null;
    const reduced=document.body.classList.contains('reduced-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.transitioning=!reduced;this.transitionUntil=performance.now()+340;
    this.backdrop.hidden=false;this.backdrop.classList.toggle('is-visible',this.expanded);
    this.host.classList.toggle('is-morphing',this.transitioning);
    this.host.classList.toggle('is-expanded',this.expanded);
    document.body.classList.toggle('festival-map-expanded',this.expanded);
    this.host.querySelector('.map-expand').setAttribute('aria-expanded',String(this.expanded));
    this.host.hidden=false;this.measure();
    if(!this.transitioning)this.host.hidden=!this.expanded&&!this.compact;
    if(!on&&this.compact&&this.host.contains(document.activeElement))this.host.querySelector('.map-expand').focus({preventScroll:true});
  }
  toggle(){this.setExpanded(!this.expanded);}
  setCompact(on){this.compact=!!on;try{localStorage.setItem(MAP_VISIBLE_KEY,on?'1':'0');}catch{}this.host.hidden=!this.expanded&&!this.compact&&!this.transitioning;}
  changeZoom(factor){if(!Number.isFinite(factor)||factor<=0)return;this.zoom=Math.max(.4,Math.min(3,this.zoom*factor));this.lastBackground=0;}
  setObjectives(markers){this.objectives.clear();for(const m of markers.slice(0,32))if(m.id&&finitePoint(m))this.objectives.set(m.id,{...m,kind:'objective',objective:true});}
  track(id){this.selected=id;}
  togglePin(id){
    const marker=this.markers?.find(m=>m.id===id);
    if(!marker)return;
    this.selected=this.selected===id?null:id;
    this.selectedMarker=this.selected?marker:null;
  }
  pick(x,y){
    const r=this.overlay.getBoundingClientRect();let best=null,dist=25;
    for(const m of this.markers||[]){const p=projectPin(this.player,m,this.width,this.height,this.scale,20,this.roundness);if(p.edge&&m.id!==this.selected)continue;const d=Math.hypot(p.x-(x-r.left),p.y-(y-r.top));if(d<dist){dist=d;best=m;}}
    if(best)this.togglePin(best.id);
    else this.setExpanded(false);
  }
  suspend(on){this.suspended=on;this.geography?.suspend(on||this.host.hidden);if(on)this.pointers.clear();}
  tick({player,heading=0,live=[],active=true,dt=0}={}){
    if(this.closed||!active||!finitePoint(player))return;
    const tickBegin=performance.now();
    if(this.backdrop.hidden)this.backdrop.hidden=false;
    if(this.touchLayout!==document.body.classList.contains('is-touch'))this.measure();
    this.player={x:player.x,z:player.z};this.heading=heading;this.live=live;this.active=true;
    this.revealElapsed=(this.revealElapsed||0)+dt;this.saveElapsed=(this.saveElapsed||0)+dt;
    if(this.revealElapsed>=.1||!this.discovery.previous){this.discovery.reveal(this.player);this.revealElapsed=0;}
    if(this.saveElapsed>=2){void this.discovery.flush();this.saveElapsed=0;}
    if(this.transitioning){
      if(tickBegin>=this.transitionUntil)this.finishTransition();
      else this.readViewport();
    }
    this.host.hidden=!this.expanded&&!this.compact&&!this.transitioning;
    if(this.suspended||this.host.hidden){this.geography?.suspend(true);return;}
    if(!this.geography)this.geography=new Geography(this.options,()=>{this.lastBackground=0;});
    this.geography.suspend(false);
    const now=performance.now(),begin=now;
    // Geographic coverage follows viewport size while respecting the maximum
    // world span. Quality settings never change useful navigable coverage.
    this.scale=Math.max(.55*this.zoom,Math.max(this.width,this.height)/2400);
    const bounds={minX:player.x-this.width/this.scale/2,maxX:player.x+this.width/this.scale/2,minZ:player.z-this.height/this.scale/2,maxZ:player.z+this.height/this.scale/2};
    if(!this.lastModel||now-this.lastModel>200){
      this.discovery.loadBounds(bounds);this.geography.request(tileView(player,this.width,this.height,this.scale));
      this.markers=[...this.discovery.landmarks(bounds),...live,...this.objectives.values()];
      if(this.selected&&!this.markers.some(m=>m.id===this.selected)){
        // Fixed known landmarks can be off-screen; live targets may not leave
        // a stale directional marker after disappearing.
        if(!this.selectedMarker||this.selectedMarker.live||this.selectedMarker.objective)this.selected=null;
        else this.markers.push(this.selectedMarker);
      }
      this.selectedMarker=this.markers.find(m=>m.id===this.selected)||null;
      this.updatePinOptions();this.lastModel=now;
    }else{
      // Availability is authoritative each game tick, even between list refreshes.
      this.markers=(this.markers||[]).filter(m=>!m.live).concat(live);
      if(this.selectedMarker?.live&&!live.some(m=>m.id===this.selected)){this.selected=null;this.selectedMarker=null;}
    }
    if(this.resetToken!==this.discovery.token){this.rasters.clear();this.resetToken=this.discovery.token;}
    if(this.transitioning||!this.lastBackground||now-this.lastBackground>100){this.drawBackground();this.lastBackground=now;}
    if(this.backgroundPlayer){
      const dx=(this.backgroundPlayer.x-player.x)*this.scale,dz=(this.backgroundPlayer.z-player.z)*this.scale;
      this.background.style.transform=`translate(${dx}px,${dz}px)`;
    }
    this.drawMarkers();
    const selected=this.markers.find(m=>m.id===(this.focusedPin||this.selected));
    const selectionLabel=selected?`${selected.label} · ${textDistance(Math.hypot(selected.x-player.x,selected.z-player.z))}`:'';
    if(this.selectionText.textContent!==selectionLabel)this.selectionText.textContent=selectionLabel;
    const status=!this.discovery.storageOK?'Saving unavailable · only recent session exploration retained':this.geography.status==='legacy'?'Legacy festival · geography unavailable':!['ready','loading'].includes(this.geography.status)?'Geography unavailable · markers still work':this.geography.status==='loading'?'Drawing the festival…':'';
    if(this.statusText.textContent!==status)this.statusText.textContent=status;
    this.stats.drawMs=performance.now()-begin;
    this.stats.totalMs=performance.now()-tickBegin;
    this.samples[this.sampleIndex++%240]=this.stats.totalMs;
  }
  updatePinOptions(){
    // Keep direct pins available to keyboard and screen-reader users without
    // adding a visible menu. Focus highlights the corresponding drawn pin.
    if(!this.expanded||this.pinOptions.contains(document.activeElement))return;
    const shown=(this.markers||[]).filter(m=>!projectPin(this.player,m,this.width,this.height,this.scale,20,this.roundness).edge||m.id===this.selected).slice(0,80);
    const signature=shown.map(m=>m.id).join('|');if(signature===this.listSignature)return;this.listSignature=signature;
    this.pinOptions.replaceChildren();
    for(const m of shown){
      const button=document.createElement('button');button.type='button';button.dataset.mapPin=m.id;
      button.textContent=m.label;button.setAttribute('aria-label',`${m.label}, ${textDistance(Math.hypot(m.x-this.player.x,m.z-this.player.z))} away`);
      this.pinOptions.append(button);
    }
  }
  raster(data,previous){
    const start=performance.now(),{tile}=data,s=192/tile.size;
    // Geography is immutable within a tile. Exploring another cell changes
    // only its mask, so road paths are not repainted on every reveal.
    const base=previous?.base||canvas();
    if(!previous?.base){
      base.width=base.height=192;const g=base.getContext('2d');
      g.fillStyle='#d7cca9';g.fillRect(0,0,192,192);
      for(let j=0;j<12;j++)for(let i=0;i<12;i++){const density=data.woods[j*12+i];if(density>.06){g.fillStyle=`rgba(54,102,68,${Math.min(.8,density*2)})`;g.fillRect(i*16,j*16,17,17);}}
      const path=points=>{g.beginPath();points.forEach((p,i)=>{const x=(p.x-tile.x)*s,y=(p.z-tile.z)*s;i?g.lineTo(x,y):g.moveTo(x,y);});};
      g.fillStyle='#72afba';for(const l of data.lakes){path(l.outline);g.closePath();g.fill();}
      g.lineJoin='round';g.lineCap='round';for(const road of data.roads){path(road.points);g.strokeStyle=road.surface==='asphalt'?'#626869':'#ab8259';g.lineWidth=Math.max(1.4,road.width*s);g.stroke();}
    }
    const c=previous?.canvas||canvas();if(!previous)c.width=c.height=192;
    const g=c.getContext('2d');g.clearRect(0,0,192,192);g.save();g.beginPath();
    for(let z=tile.z;z<tile.z+tile.size;z+=CELL){let run=null;
      for(let x=tile.x;x<=tile.x+tile.size;x+=CELL){const known=x<tile.x+tile.size&&this.discovery.has(x,z);if(known&&run===null)run=x;if(!known&&run!==null){g.rect((run-tile.x)*s,(z-tile.z)*s,(x-run)*s,CELL*s);run=null;}}
    }
    g.clip();g.drawImage(base,0,0);g.restore();
    this.stats.rasterMs=performance.now()-start;
    return {canvas:c,base,signature:this.discovery.signature(tile),data};
  }
  drawBackground(){
    const ctx=this.background.getContext('2d');ctx.setTransform(this.background.width/this.width,0,0,this.background.height/this.height,0,0);ctx.clearRect(0,0,this.width,this.height);
    // Geographic canvases stay transparent: the independent full-screen
    // backdrop fades, while only revealed terrain moves with this viewport.
    let built=false;
    for(const tile of this.geography.desired){const data=this.geography.tiles.get(tile.key);if(!data)continue;
      let r=this.rasters.get(tile.key);
      if((!r||r.signature!==this.discovery.signature(tile))&&!built){r=this.raster(data,r);this.rasters.set(tile.key,r);built=true;}
      if(!r)continue;
      const x=this.width/2+(tile.x-this.player.x)*this.scale,y=this.height/2+(tile.z-this.player.z)*this.scale;
      ctx.drawImage(r.canvas,x,y,tile.size*this.scale+.2,tile.size*this.scale+.2);
    }
    this.backgroundPlayer={...this.player};
    while(this.rasters.size>64)this.rasters.delete(this.rasters.keys().next().value);
  }
  drawMarkers(){
    const ctx=this.overlay.getContext('2d');ctx.setTransform(this.overlay.width/this.width,0,0,this.overlay.height/this.height,0,0);ctx.clearRect(0,0,this.width,this.height);
    for(const m of this.markers||[]){
      const selected=m.id===this.selected,p=projectPin(this.player,m,this.width,this.height,this.scale,20,this.roundness),style=KINDS[m.kind]||KINDS.objective;
      if(p.edge&&!selected)continue;
      ctx.save();ctx.translate(p.x,p.y);
      if(selected){ctx.fillStyle='#fff4b4';ctx.strokeStyle='#172e2b';ctx.lineWidth=2;
        if(p.edge){ctx.rotate(p.angle);ctx.beginPath();ctx.moveTo(p.size,0);ctx.lineTo(-p.size*.7,-p.size*.7);ctx.lineTo(-p.size*.7,p.size*.7);ctx.closePath();ctx.fill();ctx.stroke();ctx.rotate(-p.angle);}
        else {ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.strokeStyle='#fff4b4';ctx.stroke();}
      }
      if(m.id===this.focusedPin){ctx.strokeStyle='#fff4b4';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.stroke();}
      if(!p.edge){ctx.fillStyle='#19322e';ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.fillStyle=style.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 15px system-ui';ctx.fillText(style.glyph,0,0);}
      ctx.restore();
    }
    ctx.save();ctx.translate(this.width/2,this.height/2);ctx.rotate(-this.heading);ctx.fillStyle='#fff7da';ctx.strokeStyle='#253e37';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(7,8);ctx.lineTo(0,4);ctx.lineTo(-7,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  snapshot(){const sorted=[...this.samples].sort((a,b)=>a-b);return {mainP95:sorted[Math.floor(sorted.length*.95)]||0,mainMax:sorted.at(-1)||0,expanded:this.expanded,compact:this.compact,selected:this.selected,markers:this.markers?.length||0,discovery:this.discovery.snapshot(),geography:this.geography?.snapshot(),rasters:this.rasters.size,pixels:this.background.width*this.background.height*2,...this.stats};}
  async reset(){await this.discovery.reset();this.rasters.clear();this.selected=null;this.selectedMarker=null;this.lastModel=0;this.lastBackground=0;}
  dispose(){if(this.closed)return;this.closed=true;this.scope.abort();this.geography?.dispose();this.discovery.dispose();this.rasters.clear();this.backdrop.remove();this.host.remove();document.body.classList.remove('festival-map-expanded');}
}
