import * as THREE from 'three';
import {Crowd} from './crowd.js';
import {registry} from './registry.js';
import {mulberry32} from './rng.js';
import {buildCornholeAt} from './cornholePlacement.js';
import {CornholeSession} from './people/cornholeSession.js';
import {terrainHeight} from './worldgen/terrain.js';

// The sandbox uses real Crowd claims and the production session. Fast-forward
// advances bounded simulation steps; it never changes points or winning score.
export function createCornholePreview(){
  const group=new THREE.Group(),people=new Crowd({spawn(){},spawnLost(){}});
  group.name='CornholePreview';group.add(people.group);
  const key='sandbox-cornhole';
  const court=buildCornholeAt({group,key},{x:0,z:0,yaw:0,seed:73,sourceKind:'preview',sourceKey:key});
  const entries=[...registry.entries.values()].filter(e=>e.chunkKey===key);
  let live=true,disposed=false,clock=0,fast=null,lastResult='',paused=false;
  const persons=[-1,1].map((x,i)=>people.spawnPerson({pos:new THREE.Vector3(x,terrainHeight(x,-5.4),-5.4),rng:mulberry32(73+i),allowPhotographer:false}));
  const observer={position:new THREE.Vector3(0,0,40),speed:0,heading:0,forwardWorld:new THREE.Vector3(0,0,-1),seatSlots:[]};
  const session=new CornholeSession({people,court,rng:mulberry32(73),now:()=>clock,isLive:()=>live,
    onFinish:reason=>{lastResult=reason;fast=null;}});
  const start=()=>{if(!live||session.phase!=='idle')return;lastResult='';paused=false;session.start(...persons);};
  const step=dt=>{clock+=dt;registry.rebuildSpatialIndex();people.update(dt,observer,null);session.update(dt);};
  start();
  return {group,session,people,
    start,
    interrupt(){fast=null;session.finish('honk');},
    advanceRound(){if(session.phase!=='idle')fast={round:session.round};},
    finishGame(){paused=false;if(session.phase!=='idle')fast={finish:true};},
    showPhase(phase){if(session.phase==='idle')start();paused=false;fast={until:phase};},
    resume(){paused=false;fast=null;},
    unload(){if(!live)return;session.finish('court-unloaded');for(const e of entries)registry.remove(e.id);court.group.visible=false;live=false;},
    revisit(){if(live)return;for(const e of entries)registry.add(e);court.group.visible=true;live=true;court.cornhole.resetBags();},
    update(dt){
      if(disposed||paused)return;
      const steps=fast?32:1;
      for(let i=0;i<steps;i++){
        step(Math.min(.033,dt));
        if(fast?.until===session.phase){for(let settle=0;settle<8;settle++)step(.025);fast=null;paused=true;break;}
        if(fast&&!fast.finish&&session.round>fast.round){fast=null;break;}
      }
    },
    status(){return `${session.phase} · score ${session.score.join(' : ')} · round ${session.round} · ${live?'court live':'court unloaded'}${fast?' · fast-forward':''}${paused?' · paused for inspection':''}${lastResult?' · '+lastResult:''}`;},
    dispose(){if(disposed)return;disposed=true;fast=null;try{session.dispose();}finally{try{people.dispose();}finally{for(const e of entries)registry.remove(e.id);}}},
  };
}
