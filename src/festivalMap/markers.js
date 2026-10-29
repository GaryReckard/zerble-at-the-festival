import { NEARBY, REVEAL, landmarkId } from './model.js';
export const KINDS = {
  stage_front:{label:'Stage',glyph:'♫',color:'#edb070'},
  bubble_vendor:{label:'Bubble juice stand',glyph:'◒',color:'#a2dedb'},
  food_plaza:{label:'Food court',glyph:'♨',color:'#edb070'},
  drum_circle:{label:'Drum circle',glyph:'◎',color:'#dcc69d'},
  campsite:{label:'Camp',glyph:'⌂',color:'#b7c99a'},
  beach:{label:'Beach',glyph:'≈',color:'#a2dedb'},
  lurleen:{label:'Lurleen',glyph:'♥',color:'#f7a9be'},
  nut_wagon:{label:'Nutwagon',glyph:'▰',color:'#e9bd82'},
  bubble_jug:{label:'Juice jug',glyph:'▱',color:'#a2dedb'},
  star:{label:'Star',glyph:'★',color:'#ffe59b'},
  objective:{label:'Destination',glyph:'⚑',color:'#fff0ad'},
};
const STATIC=['stage_front','bubble_vendor','food_plaza','drum_circle','campsite','beach'];
export function observeMapWorld({registry,player,lurleen,nutWagon,star,discovery,namespace}) {
  for(const kind of STATIC)for(const id of registry.byKind.get(kind)||[]) {
    const e=registry.entries.get(id);if(!e)continue;
    const {x,z}=e.position;
    if(Math.hypot(x-player.x,z-player.z)<=REVEAL&&discovery.has(x,z))
      discovery.remember({id:landmarkId(namespace,kind,x,z),kind,x,z,label:KINDS[kind].label});
  }
  const live=[];
  const add=(id,kind,p,on=true)=>{if(on&&p&&Math.hypot(p.x-player.x,p.z-player.z)<=NEARBY)live.push({id,kind,x:p.x,z:p.z,label:KINDS[kind].label,live:true});};
  add('friend:lurleen','lurleen',lurleen?.position,!!lurleen);
  add('friend:nutwagon','nut_wagon',nutWagon?.position,!!nutWagon?.active);
  for(const id of registry.byKind.get('bubble_jug')||[]) {const e=registry.entries.get(id);if(e)add(`pickup:${id}`,'bubble_jug',e.position);if(live.at(-1)?.id===`pickup:${id}`)live.at(-1).registryId=id;}
  add('pickup:star','star',star?{x:star.x,z:star.z}:null,!!star);
  return live;
}

// Refresh only the handful of active markers each frame. Membership polling
// remains capped, but a collected item cannot survive until the next poll.
export function refreshMapLive(markers,{registry,player,lurleen,nutWagon,star}) {
  const out=[];
  for(const m of markers){
    let p;
    if(m.kind==='bubble_jug')p=registry.entries.get(m.registryId)?.position;
    else if(m.kind==='lurleen')p=lurleen?.position;
    else if(m.kind==='nut_wagon')p=nutWagon?.active?nutWagon.position:null;
    else if(m.kind==='star')p=star;
    if(p&&Math.hypot(p.x-player.x,p.z-player.z)<=NEARBY)out.push({...m,x:p.x,z:p.z});
  }
  return out;
}
