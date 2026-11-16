import {hash2} from '../rng.js';

function findAudience(registry,x,z) {
  let nearest=null,best=9;
  const ids=registry.byKind.get('stage_front');
  if(!ids)return null;
  for(const id of ids){
    const entry=registry.entries.get(id),area=entry?.stageAudience;
    if(!area)continue;
    const distance=(x-area.sourceX)**2+(z-area.sourceZ)**2;
    if(distance<=best){nearest=entry;best=distance;}
  }
  return nearest;
}

function listening(crowd,npc,area) {
  if(npc.party || npc.seatSlot || npc.isPhotographer || npc.hailing || npc.corridorRoute ||
    npc.cheerTimer>0 || npc.frownTimer>0 || npc.campInstrument || npc.campMusic ||
    npc.campJamHidden || npc._activityBinding?.hidden || npc._removing)return false;
  const owner=crowd.activityClaims.current.get(npc.personHandle)?.claim.owner;
  const seated=npc.state==='camp_seated'||npc.state==='table_seated';
  if(owner && !(npc.state==='camp_seated' && owner===crowd.camps) &&
    !(npc.state==='table_seated' && owner===crowd.picnics))return false;
  if(npc._activityArmPose || npc._reactionPose)return false;
  if(!seated && (npc.state!=='idle' && npc.state!=='watching' || npc.vel.x**2+npc.vel.z**2>.25))return false;
  const dx=npc.pos.x-area.sourceX,dz=npc.pos.z-area.sourceZ;
  const forward=dx*area.sin+dz*area.cos,across=dx*area.cos-dz*area.sin;
  if(forward<area.near || forward>area.far || Math.abs(across)>area.halfWidth)return false;
  // People face local -Z. A watcher facing Zerble across the aisle is attending
  // to the cart; dancers on this floor can turn sideways mid-step.
  return (!seated && npc.onDancefloor && npc.dance>.35) ||
    dx*Math.sin(npc.yaw)+dz*Math.cos(npc.yaw)>.45*Math.hypot(dx,dz);
}

export function applaudStage(crowd,registry,x,z) {
  const result={count:0,intensity:0,duration:0,x,z};
  const entry=findAudience(registry,x,z);
  if(!entry||crowd._disposed)return result;
  const now=crowd.actorTime;
  const recent=crowd._stageApplauseEnds??=new WeakMap();
  if((recent.get(entry)??-Infinity)>now)return result;
  const metadata=entry.stageAudience;
  const area={...metadata,sin:Math.sin(metadata.yaw),cos:Math.cos(metadata.yaw)};
  const listeners=[];
  for(const npc of crowd.npcs){
    if(npc._stageAudience?.end>now || !listening(crowd,npc,area))continue;
    listeners.push(npc);
  }
  const count=listeners.length;
  if(!count)return result;
  result.count=count;result.x=0;result.z=0;
  result.intensity=Math.min(1,.11+.89*(1-Math.exp(-count/13)));
  const salt=hash2(Math.round(area.sourceX*10),Math.round(area.sourceZ*10)^Math.floor(now)*31);
  for(const npc of listeners){
    const handle=npc.personHandle;
    const seed=hash2(hash2(npc.behaviorSeed,handle.generation),salt^0x636c6170);
    const variation=seed/4294967296;
    const style=npc.shoppingBagTime>0?'nod':npc.drinkSlot>=0?'wave':
      variation<.68?'clap':variation<.83?'wave':variation<.94?'nod':'cheer';
    const delay=.04+((seed>>>8)&255)/255*.49;
    const length=.50+result.intensity*1.95+((seed>>>16)&255)/255*.55;
    npc._stageAudience={entry,area,handle,start:now+delay,end:now+delay+length,
      style,frequency:2.3+((seed>>>2)&63)/63*1.3};
    result.x+=npc.pos.x;result.z+=npc.pos.z;
    result.duration=Math.max(result.duration,delay+length);
  }
  result.x/=count;result.z/=count;
  recent.set(entry,now+result.duration+.5);
  crowd.lastStageApplause=result;
  return result;
}

// The reaction record doubles as scratch. Seat ownership, velocities and
// state timers continue normally. Invalidating the owner or the stage ends it.
export function sampleStageApplause(crowd,registry,npc) {
  const pose=npc._stageAudience,now=crowd.actorTime;
  if(now>=pose.end || pose.handle!==npc.personHandle || registry.entries.get(pose.entry.id)!==pose.entry ||
    !listening(crowd,npc,pose.area)){
    npc._stageAudience=null;return null;
  }
  if(now<pose.start)return null;
  const elapsed=now-pose.start;
  const fade=Math.min(1,elapsed/.15,(pose.end-now)/.23);
  const close=(1-Math.cos(elapsed*pose.frequency*2*Math.PI))*.5;
  pose.x=0;pose.z=0;pose.elbow=0;pose.leftX=0;pose.leftZ=0;pose.leftElbow=0;
  pose.nod=-fade*(.04+.10*close);
  if(pose.style==='clap'){
    pose.x=pose.leftX=1.24*fade;
    pose.z=(.48-.42*close)*fade;pose.leftZ=-pose.z;
    pose.elbow=-1.32*fade;pose.leftElbow=-pose.elbow;
  }else if(pose.style==='wave'||pose.style==='cheer'){
    pose.leftZ=-(1.30+.32*close)*fade;pose.leftX=.72*fade;pose.leftElbow=.9*fade;
    if(pose.style==='cheer'){
      pose.z=(2.05+.20*close)*fade;pose.x=.22*fade;pose.elbow=-.32*fade;
    }
  }
  return pose;
}
