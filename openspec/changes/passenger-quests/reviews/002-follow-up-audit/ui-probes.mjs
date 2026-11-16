// Run from the repository root: node openspec/changes/passenger-quests/reviews/002-follow-up-audit/ui-probes.mjs
// Optional first argument: audited source directory. No browser, network or production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
const base=path.resolve(process.argv[2] || '.claude/worktrees/passenger-quests-audit-2');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const sourceImport=p=>import(pathToFileURL(path.join(base,p)).href);
const el=()=>({dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},style:{setProperty(){}},append(){},setAttribute(k,v){this[k]=v},remove(){},addEventListener(){}});

// Evaluate the complete unmodified class bodies, avoiding CSS/Three.js imports.
// The constructors are bypassed; only DOM, drawing, discovery and geography
// boundaries are supplied. Selection and lifecycle logic are the real methods.
const model=await sourceImport('src/festivalMap/model.js');
let now=1000;
const env={...model,Math,Map,performance:{now:()=>now},document:{body:el()},textDistance:n=>`${Math.round(n)} m`};
const mapSource=read('src/festivalMap/view.js');
const FestivalMap=vm.runInNewContext('('+mapSource.slice(mapSource.indexOf('export class FestivalMap')).replace('export class','class')+')',env);
const presentationSource=read('src/quests/presentation.js');
const QuestPresentation=vm.runInNewContext('('+presentationSource.slice(presentationSource.indexOf('export class QuestPresentation')).replace('export class','class')+')',{Math});
const map=Object.assign(Object.create(FestivalMap.prototype),{
  objectives:new Map(),compact:false,expanded:false,touchLayout:false,
  backdrop:{hidden:true},host:{hidden:true},player:{x:0,z:0},width:190,height:190,zoom:1,
  discovery:{previous:true,token:1,storageOK:true,reveal(){},flush(){},loadBounds(){},landmarks(){return []}},
  geography:{status:'ready',suspend(){},request(){}},rasters:new Map(),stats:{},samples:[],sampleIndex:0,
  selectionText:{textContent:''},statusText:{textContent:''},drawBackground(){},drawMarkers(){},updatePinOptions(){},
});
const tick=()=>{now+=250;map.tick({player:{x:0,z:0},dt:.016});};
map.setObjectives([{id:'quest:1',x:100,z:0,label:'Old ride'}]);
map.track('quest:1');
map.selectedMarker={...map.objectives.get('quest:1')};
map.setObjectives([]); // Completion emits dirty pins, which presentation removes.
tick();
assert.equal(map.selected,'quest:1','hidden real map tick retains the removed objective');
const view=Object.assign(Object.create(QuestPresentation.prototype),{
  time:0,runtime:{active:[{id:2,type:'summit',riderId:'rider',x:900,z:0,short:'Mountaintop'}],hails:[]},
  reducedMotion:()=>false,crowd:{riderInfo:()=>false},compass:null,festivalMap:map,
  _pinsDirty:true,_track:'quest:2',_rider:{},
});
view.update(.016);
assert.equal(map.selected,'quest:1');
assert.equal(view._track,null);
assert.equal(map.objectives.has('quest:2'),true);
tick();
assert.equal(map.selected,'quest:1');
map.compact=true; // Reopen the compact map and run its entire real tick method.
tick();
assert.equal(map.selected,null,'visible real tick removes expired objective');
view.update(.016);tick();
assert.equal(map.selected,null,'summit auto-track is permanently lost');
console.log('REPRODUCED: real setObjectives/track/tick + presentation.update lose summit auto-track after hidden-map stale selection.');

const {QuestCompass}=await sourceImport('src/questHud.js');
globalThis.document={createElement:el};
const compass=new QuestCompass(el(),{onPick(){}});
const q={id:1,x:0,z:100,dist:100,radius:25,short:'Main stage',warmth:0,type:'ride'};
const sync=heading=>{compass.sync([q],{x:0,z:0,heading,speed:0});return compass.chips.get(1).shown;};
let last=sync(.1),max=0;
for(let i=1;i<=4000;i++){const next=sync(.1+i*.05);max=Math.max(max,Math.abs(next-last));last=next;}
assert(max<=6);
assert.equal(compass.chips.get(1).el['aria-label'],'Main stage: 75 m');
compass.sync([],{x:0,z:0});assert.equal(compass.chips.size,0);
console.log(`PASS: actual QuestCompass, 4000 bearings, maximum turn ${max} degrees, label and cleanup.`);

const hudSource=read('src/hud.js');
const method=hudSource.slice(hudSource.indexOf('  toast(msg,'),hudSource.indexOf('\n  flashHit()'));
let time=0,id=0;const pending=new Map(),toast=el();
const context={performance:{now:()=>time},toastUntil:0,toastLow:false,toastTimer:0,toastTapHandler:null,$toast:toast,clearToastTap(){},setTimeout(fn){pending.set(++id,fn);return id},clearTimeout(i){pending.delete(i)}};
const hud=vm.runInNewContext('({'+method+'})',context);
hud.toast('warning',1000);time=100;hud.toast('chatter',3000,{low:true});
assert.equal(toast.textContent,'warning');assert.equal(pending.size,1);
time=1000;hud.toast('chatter',3000,{low:true});assert.equal(toast.textContent,'chatter');assert.equal(pending.size,1);
hud.toast('new warning',1000);assert.equal(toast.textContent,'new warning');assert.equal(pending.size,1);
console.log('PASS: actual HUD.toast priority, expiry boundary, and replacement timer.');
