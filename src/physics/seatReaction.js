// One temporary activity publishes a supported sitter and its reserved fall
// body. The population owns identity/appearance; the caller owns the claim and
// cleanup. Run after each accepted physics step, never on a separate clock.
const length=v=>Math.hypot(v.x,v.y,v.z);
function vector(value,name) {
  if(!value||!['x','y','z'].every(k=>Number.isFinite(value[k])))throw new TypeError(`${name} must be finite`);
  return {x:value.x,y:value.y,z:value.z};
}
function rotate(v,q,out) {
  const x=2*(q.y*v.z-q.z*v.y),y=2*(q.z*v.x-q.x*v.z),z=2*(q.x*v.y-q.y*v.x);
  out.x=v.x+q.w*x+q.y*z-q.z*y;out.y=v.y+q.w*y+q.z*x-q.x*z;out.z=v.z+q.w*z+q.x*y-q.y*x;
}
export function createSeatReaction({people,claim,lease,releaseSeat,rootOffset={x:0,y:-1,z:0},facing=Math.PI,grounded=()=>false,recovery=null}) {
  if(![people?.isPersonActivityCurrent,people?.writeReactionPose,lease?.read,lease?.fall,lease?.resumeSupportContacts,releaseSeat,grounded].every(f=>typeof f==='function'))throw new TypeError('Seat reaction needs population, claim, reserved body and seat-release capabilities');
  const offset=vector(rootOffset,'rootOffset');
  if(!Number.isFinite(facing))throw new TypeError('Facing must be finite');
  const half=Math.sin(facing/2),cos=Math.cos(facing/2);
  const pose={position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1},seated:true,seatBlend:1};
  let phase='supported',unstableTime=0,stableTime=0,settledTime=0,seatReleased=false,disposed=false,blocked=null;
  function publish(sample,seatBlend=pose.seatBlend) {
    pose.seatBlend=seatBlend;
    const q=sample.rotation,p=sample.position;
    rotate(offset,q,pose.position);
    pose.position.x+=p.x;pose.position.y+=p.y;pose.position.z+=p.z;
    // The collider uses the chair axes; model facing is a local yaw. Root
    // offset is in collider coordinates, so tipping cannot move the pelvis.
    Object.assign(pose.rotation,{x:q.x*cos-q.z*half,y:q.w*half+q.y*cos,z:q.x*half+q.z*cos,w:q.w*cos-q.y*half});
    return people.writeReactionPose(claim,pose);
  }
  return Object.freeze({
    step(dt) {
      if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Seat reaction requires an accepted step from 0 to .05 seconds');
      if(phase==='complete')return {ok:true,phase};
      if(disposed||!people.isPersonActivityCurrent(claim))return {ok:false,reason:'stale-reaction'};
      const state=lease.read();if(!state)return {ok:false,reason:'missing-release'};
      blocked=null;
      if(state.state==='supported'||state.state==='activating') {
        const support=state.support;
        if(support) {
          const q=support.rotation,up=1-2*(q.x*q.x+q.z*q.z),spin=length(support.angularVelocity);
          if(up<.94||spin>1.5){phase='bracing';stableTime=0;}
          else if(phase==='bracing'&&up>.98&&spin<.7){stableTime+=dt;if(stableTime>=.25){phase='supported';stableTime=0;}}
          else stableTime=0;
          unstableTime=up<.65||spin>4?unstableTime+dt:0;
          // A gentle wobble can recover; inversion releases immediately on an
          // accepted step. Zero-delta publication must never cause a handoff.
          if(dt>0&&(up<.25||unstableTime>=.08)) {
            const released=lease.fall();if(!released.ok)blocked=released.reason;
          }
        } else if(state.state==='activating'&&dt>0) {
          const released=lease.fall();if(!released.ok)blocked=released.reason;
        } else return {ok:false,reason:'missing-support'};
      }
      const current=lease.read();if(!current)return {ok:false,reason:'missing-release'};
      if(current.state==='falling') {
        if(!seatReleased){releaseSeat();seatReleased=true;}
        const body=current.body;if(!body)return {ok:false,reason:'missing-fall-body'};
        lease.resumeSupportContacts();
        if(dt>0) {
          if(length(body.linearVelocity)<.25&&length(body.angularVelocity)<.4&&grounded(body)===true)settledTime+=dt;
          else settledTime=0;
        }
        const wasRecovering=phase==='recovering';
        const disturbed=length(body.linearVelocity)>1||length(body.angularVelocity)>1;
        if(wasRecovering&&disturbed){recovery?.cancel();settledTime=0;}
        phase=settledTime>=.4?'settled':wasRecovering&&!disturbed?'recovering':'falling';
        if(recovery&&(phase==='settled'||phase==='recovering')&&dt>0) {
          const next=recovery.step(body,dt,{seatBlend:pose.seatBlend});
          if(next.pose) {
            if(!lease.moveForRecovery(next.pose))return {ok:false,reason:'missing-fall-body'};
            if(!publish(next.pose,next.seatBlend))return {ok:false,reason:'stale-reaction'};
            phase=next.phase;
            if(phase==='complete') {
              // Match the final feet-origin pose and heading before dropping
              // reaction ownership, so normal animation starts at this spot.
              const heading=2*Math.atan2(pose.rotation.y,pose.rotation.w);
              people.writeActivityPose(claim,pose.position.x,pose.position.y,pose.position.z,heading);
              people.endPersonActivity(claim,{reason:'physical-recovered'});
            }
            return {ok:true,phase,blocked};
          }
          blocked=next.reason??'recovery-pending';
          phase='settled';
        }
        if(!publish(body.pose))return {ok:false,reason:'stale-reaction'};
      } else if(current.support) {
        if(!publish(current.support))return {ok:false,reason:'stale-reaction'};
      } else return {ok:false,reason:blocked??'activation-pending'};
      return {ok:true,phase,blocked};
    },
    inspect(){return {phase,seatBlend:pose.seatBlend,unstableTime,stableTime,settledTime,seatReleased,disposed,blocked};},
    dispose(){if(disposed)return false;disposed=true;return true;},
  });
}
