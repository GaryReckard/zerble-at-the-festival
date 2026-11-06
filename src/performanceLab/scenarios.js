export const SCENARIOS = Object.freeze({
  'dense-festival-v1':Object.freeze({settle:20,seconds:30,corridor:2,routePolicy:'parked-v1',waypoints:[]}),
  // Fixed seed's actual road centerlines. A failed earlier cross-country
  // candidate remains evidence, rather than being rescued with invulnerability.
  'streaming-drive-v1':Object.freeze({settle:20,seconds:60,corridor:10,routePolicy:'road-follow-v2',
    waypoints:[[-326,-658],[-461,-545],[-362,-548],[-230.3,-691.8]],
    paths:[
      [[-230.3,-691.8],[-258,-664],[-291,-656],[-326,-658]],
      [[-326,-658],[-343,-633],[-378,-628],[-406,-617],[-426,-595],[-435,-559],[-461,-545]],
      [[-461,-545],[-445,-546],[-428,-543],[-411,-535],[-395,-556],[-379,-551],[-362,-548]],
      [[-362,-548],[-350,-564],[-347,-584],[-341,-602],[-329,-618],[-337,-641],[-326,-658],[-291,-656],[-258,-664],[-230.3,-691.8]],
    ]}),
});
export class FrameBuffer {
  constructor(capacity=32768){this.capacity=capacity;this.values=new Float64Array(capacity*5);this.length=0;this.overflow=false;}
  push(wall,work,segment,lost,injected){
    if(this.length===this.capacity){this.overflow=true;return false;}
    if(![wall,work,segment,lost,injected].every(n=>Number.isFinite(n)&&n>=0))throw Error('Invalid frame');
    const i=this.length++*5;this.values[i]=wall;this.values[i+1]=work;this.values[i+2]=segment;this.values[i+3]=lost;this.values[i+4]=injected;return true;
  }
  export(){return Array.from({length:this.length},(_,i)=>Array.from(this.values.subarray(i*5,i*5+5)));}
}
export function routeControl(position,heading,point,speed){
  const dx=point[0]-position.x,dz=point[1]-position.z;
  const angle=Math.atan2(-dx,-dz)-heading,error=Math.atan2(Math.sin(angle),Math.cos(angle));
  return {throttle:Math.abs(error)>1&&Math.abs(speed)>8?0:1,steer:Math.max(-1,Math.min(1,error*1.6)),boost:Math.abs(error)<.2,brake:false,distance:Math.hypot(dx,dz)};
}

export function segmentDistance(position,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((position.x-a[0])*dx+(position.z-a[1])*dz)/length)):0;
  return Math.hypot(position.x-a[0]-dx*t,position.z-a[1]-dz*t);
}
export function roadGuidance(position,heading,path,index,speed){
  let a=path[index],b=path[index+1];
  while(index<path.length-2){
    const dx=b[0]-a[0],dz=b[1]-a[1],projection=((position.x-a[0])*dx+(position.z-a[1])*dz)/(dx*dx+dz*dz);
    if(Math.hypot(position.x-b[0],position.z-b[1])>=4&&!(projection>=1&&segmentDistance(position,a,b)<8))break;
    index++;a=path[index];b=path[index+1];
  }
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const t=Math.max(0,Math.min(1,((position.x-a[0])*dx+(position.z-a[1])*dz)/(length*length)));
  const remaining=(1-t)*length,lookahead=Math.max(4,Math.min(10,Math.abs(speed)*.45+3));
  let target=[a[0]+dx*t,a[1]+dz*t],left=lookahead,j=index;
  while(left>0){const end=path[j+1],d=Math.hypot(end[0]-target[0],end[1]-target[1]);
    if(d>=left){target=[target[0]+(end[0]-target[0])*left/d,target[1]+(end[1]-target[1])*left/d];break;}
    target=end;left-=d;if(j>=path.length-2)break;j++;
  }
  const next=routeControl(position,heading,target,speed),angle=Math.abs(Math.atan2(Math.sin(Math.atan2(-dx,-dz)-heading),Math.cos(Math.atan2(-dx,-dz)-heading)));
  const c=path[index+2],turn=c?Math.acos(Math.max(-1,Math.min(1,(dx*(c[0]-b[0])+dz*(c[1]-b[1]))/(length*Math.hypot(c[0]-b[0],c[1]-b[1]))))):Math.PI/2;
  const desired=angle>.8?6:remaining<20&&turn>.7?12:20;
  next.throttle=Math.abs(speed)<desired-.5?1:0;next.brake=Math.abs(speed)>desired+1;
  next.boost=desired===20&&angle<.12&&(turn<.25||remaining>35);
  return {control:next,index,distance:Math.hypot(position.x-path.at(-1)[0],position.z-path.at(-1)[1]),corridor:Math.min(...path.slice(1).map((p,i)=>segmentDistance(position,path[i],p)))};
}
// Observe actual publication operations rather than infer events from samples.
export function observeLoaded(map,onChange){
  const oldSet=map.set,oldDelete=map.delete,setDescriptor=Object.getOwnPropertyDescriptor(map,'set'),deleteDescriptor=Object.getOwnPropertyDescriptor(map,'delete');
  function set(key,value){const existed=this.has(key);const result=oldSet.call(this,key,value);if(!existed)onChange('load',key);return result;}
  function remove(key){const result=oldDelete.call(this,key);if(result)onChange('unload',key);return result;}
  map.set=set;map.delete=remove;
  return ()=>{if(map.set===set){if(setDescriptor)Object.defineProperty(map,'set',setDescriptor);else delete map.set;}if(map.delete===remove){if(deleteDescriptor)Object.defineProperty(map,'delete',deleteDescriptor);else delete map.delete;}};
}
