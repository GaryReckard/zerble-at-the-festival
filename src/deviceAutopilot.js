import {SCENARIOS,roadGuidance} from './performanceLab/scenarios.js';

export const DEVICE_ROUTE = Object.freeze({version:'device-road-follow-v1',seed:2404796662,
  start:Object.freeze({x:-230.3,z:-691.8,heading:2.3580}),maxDriveSeconds:90,
  scenario:SCENARIOS['streaming-drive-v1']});

// The controller publishes normal throttle/steer/brake inputs. It never moves
// the cart directly, removes obstacles, changes damage or bypasses support.
export function createDeviceAutopilot({cart,acquire,stopCart,ready=()=>true,now=()=>performance.now()}) {
  const control={throttle:0,steer:0,boost:false,brake:true};
  const checkpoints=[];let state='parked',reason=null,segment=0,index=0,driveStarted=null,travel=0,maxCorridor=0,frames=0;
  let previous={x:cart.position.x,z:cart.position.z},release=null;
  function neutral(){control.throttle=control.steer=0;control.boost=false;control.brake=true;}
  function fail(message){if(state==='completed'||state==='failed')return;reason=message;state='failed';neutral();}
  const origin=DEVICE_ROUTE.start;
  if(Math.hypot(cart.position.x-origin.x,cart.position.z-origin.z)>2)fail('wrong-start-position');
  else release=acquire(control,()=>fail('emergency-stop'));
  return {control,
    get state(){return state;},get reason(){return reason;},get complete(){return state==='completed';},
    update(phase){
      if(state==='completed'||state==='failed')return;
      if(cart.condition?.cause){fail('vehicle-'+cart.condition.cause);return;}
      if(phase!=='drive'){neutral();return;}
      if(!ready()){fail('physical-driving-not-ready');return;}
      if(driveStarted===null)driveStarted=now();
      if((now()-driveStarted)/1000>DEVICE_ROUTE.maxDriveSeconds){fail('route-timeout');return;}
      state='driving';frames++;
      const p=cart.position;
      travel+=Math.hypot(p.x-previous.x,p.z-previous.z);previous={x:p.x,z:p.z};
      const guidance=roadGuidance(p,cart.heading,DEVICE_ROUTE.scenario.paths[segment],index,cart.speed);
      maxCorridor=Math.max(maxCorridor,guidance.corridor);
      if(guidance.corridor>DEVICE_ROUTE.scenario.corridor){fail('route-corridor');return;}
      if(guidance.distance<4){
        checkpoints.push({segment,x:p.x,z:p.z,seconds:(now()-driveStarted)/1000});segment++;index=0;
        if(segment===DEVICE_ROUTE.scenario.waypoints.length){state='completed';neutral();return;}
      }else index=guidance.index;
      Object.assign(control,guidance.control);
    },
    fail,
    stop(){neutral();release?.();release=null;stopCart();},
    snapshot(){return {version:DEVICE_ROUTE.version,routePolicy:DEVICE_ROUTE.scenario.routePolicy,seed:DEVICE_ROUTE.seed,
      start:DEVICE_ROUTE.start,state,reason,segment,checkpointCount:checkpoints.length,checkpoints:checkpoints.map(p=>({...p})),
      frames,travelMetres:travel,maxCorridorMetres:maxCorridor,complete:state==='completed',control:{...control}};},
  };
}
