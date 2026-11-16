import {Vector3} from 'three';
import {outdoorAudienceHalfWidth} from './festivalShapes.js';
import {Crowd} from './crowd.js';
import {registry} from './registry.js';
import {mulberry32} from './rng.js';
import {createSupportWorld} from './landscape/support.js';

const sizes={empty:0,small:4,full:24};
const silentSmiles={spawn(){},spawnLost(){}};
const flatGround=(_x,_z,out)=>Object.assign(out,{height:0,dx:0,dz:0,traversable:true});

export function createStageAudiencePreview({stage,controls,playApplause}){
  const tent=!!stage.stagePos;
  const sourceX=stage.stagePos?.x??0,sourceZ=stage.stagePos?.z??0;
  const depth=tent?stage.stageDepth:stage.deckDepth,scale=stage.stageScale??stage.scale;
  const area={sourceX,sourceZ,yaw:0,
    halfWidth:tent?stage.width/2-1.5:outdoorAudienceHalfWidth(stage.deckWidth,scale),
    near:depth/2+(tent?1:scale),
    far:tent?stage.mixerPos.z-sourceZ-1.5:depth/2+30*scale};
  const floorZ=sourceZ+depth/2+(tent?4:6*scale);
  const observer={position:new Vector3(0,0,sourceZ+65),forwardWorld:new Vector3(0,0,-1),speed:0,seatSlots:[]};
  const choose=document.createElement('select');
  choose.setAttribute('aria-label','Stage audience');
  for(const [value,label] of [['empty','Empty audience'],['small','Small audience'],['full','Full audience']]){
    const option=document.createElement('option');option.value=value;option.textContent=label;choose.append(option);
  }
  const button=document.createElement('button');button.textContent='Applaud audience';
  const status=document.createElement('div');status.setAttribute('aria-label','Audience response');
  controls.append(choose,button,status);

  let people=null,entryId=null,size='empty',last=null,stopManual=null;
  function release(){
    stopManual?.();stopManual=null;
    try{people?.dispose();}finally{people=null;if(entryId!==null)registry.remove(entryId);entryId=null;}
  }
  function setSize(value){
    if(!Object.hasOwn(sizes,value))throw new RangeError('Unknown audience size');
    release();size=value;choose.value=value;last=null;button.disabled=!sizes[value];
    status.textContent='';
    if(!sizes[value])return;
    try{
      people=new Crowd(silentSmiles);
      people.surfaceWorld=createSupportWorld({sampleTerrain:flatGround});
      stage.group.add(people.group);
      entryId=registry.add({kind:'stage_front',position:new Vector3(sourceX,0,floorZ),
        stageAudience:area,footprint:0,attractor:{radius:tent?10:14*scale,weight:2.5},chunkKey:'sandbox-stage-audience'});
      const rng=mulberry32(0x73746167),count=sizes[value],cols=count===4?4:8;
      for(let i=0;i<count;i++){
        const x=sourceX+(i%cols-(cols-1)/2)*Math.min(1.43,area.halfWidth*1.55/cols)+(rng()-.5)*.32;
        const z=sourceZ+area.near+1.55+Math.floor(i/cols)*1.6+rng()*.55;
        const npc=people.spawn({pos:new Vector3(x,0,z),rng,chunkKey:'sandbox-stage-audience',allowPhotographer:false});
        // Keep the comparison population attending while the real Crowd runs
        // dance detection, social separation, animation and reaction publication.
        npc.yaw=Math.atan2(x-sourceX,z-sourceZ);npc.stateTimer=86400;
      }
      people.update(0,observer,null);
    }catch(error){release();throw error;}
  }
  function applaud(x=sourceX,z=sourceZ){
    last=people?.applaudStage(x,z)??{count:0,intensity:0,duration:0,x,z};
    status.textContent=last.count?
      `${last.count} applauding · ${last.duration.toFixed(1)} s · ${Math.round(last.intensity*100)}% intensity`:'No new applause';
    return last;
  }
  choose.onchange=()=>setSize(choose.value);
  button.onclick=()=>{
    const summary=applaud();
    if(summary.count){stopManual?.();stopManual=playApplause(summary);}
  };
  setSize('empty');
  return {
    sourceX,sourceZ,setSize,applaud,
    update(dt){people?.update(dt,observer,null);},
    inspect(){return {size,count:people?.populationSize??0,last,sourceX,sourceZ};},
    dispose(){release();choose.remove();button.remove();status.remove();}
  };
}
