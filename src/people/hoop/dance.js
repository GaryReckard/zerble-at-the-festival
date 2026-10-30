// Bounded absolute-time foot plans and rigid-frame math for the hoop score.
// Stance targets live in the session frame, so seek/order cannot move a plant.
const WIDTH=.13,LEG_LIMIT=.635,SOFTNESS=.02;
const smooth=t=>t*t*t*(t*(t*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
const MAJOR=new Set(['hand-orbit','answer-orbit','motif-return','body-orbit','overhead-orbit']);
function position(body,left,id){
  const side=left?-WIDTH:WIDTH,c=Math.cos(body.turn),s=Math.sin(body.turn);
  return {x:body.travelX+c*side,z:body.travelZ-s*side,yaw:body.turn,id};
}
export function compileDance(segments,sampleBody,gain){
  const body={};let nextId=2,left={x:-WIDTH,z:0,yaw:0,id:0},right={x:WIDTH,z:0,yaw:0,id:1},count=0;
  for(let index=0;index<segments.length;index++){
    const segment=segments[index],kind=segment.kind,steps=[];
    segment.feetFrom={left,right};
    const major=MAJOR.has(kind),tap=kind==='isolation'||kind==='toss-prepare'||kind==='toss-recover';
    const changed=segment.bodyFrom.travelX!==segment.bodyTo.travelX||segment.bodyFrom.travelZ!==segment.bodyTo.travelZ||segment.bodyFrom.turn!==segment.bodyTo.turn;
    const n=major?4:tap?(kind==='isolation'?2:1):changed?2:0;
    for(let i=0;i<n;i++){
      const isLeft=(index+i)%2===0,from=isLeft?left:right;
      const start=major?[.04,.30,.55,.80][i]:n===1?.10:i===0?.08:.55;
      const end=major?[.28,.53,.78,.98][i]:n===1?.90:i===0?.43:.90;
      const targetTime=major?(i===0?.36:i===1?.65:1):1;
      sampleBody(segment,targetTime,body);
      const to=tap?{x:from.x,z:from.z,yaw:from.yaw,id:nextId++}:position(body,isLeft,nextId++);
      steps.push({left:isLeft,start,end,from,to,lift:(major?.075:.045)*gain,tap:tap?.025*gain:0});
      if(isLeft)left=to;else right=to;
    }
    segment.steps=steps;segment.feetTo={left,right};count+=steps.length;
  }
  if(count>128)throw new RangeError('Hoop step capacity exceeded');
  return count;
}

export function createFoot(){return {x:0,y:0,z:0,qx:0,qy:0,qz:0,qw:1,plantId:0,planted:true};}
export function createDanceFrame(){return {r00:1,r01:0,r02:0,r10:0,r11:1,r12:0,r20:0,r21:0,r22:1,qx:0,qy:0,qz:0,qw:1};}
export function writeDanceFrame(out){
  const f=out.frame,x=out.leanX,z=out.leanZ,y=out.turn;
  const cx=Math.cos(x),sx=Math.sin(x),cz=Math.cos(z),sz=Math.sin(z),cy=Math.cos(y),sy=Math.sin(y);
  f.r00=cy*cz+sy*sx*sz;f.r01=-cy*sz+sy*sx*cz;f.r02=sy*cx;
  f.r10=cx*sz;f.r11=cx*cz;f.r12=-sx;
  f.r20=-sy*cz+cy*sx*sz;f.r21=sy*sz+cy*sx*cz;f.r22=cy*cx;
  const hx=Math.sin(x/2),wx=Math.cos(x/2),hy=Math.sin(y/2),wy=Math.cos(y/2),hz=Math.sin(z/2),wz=Math.cos(z/2);
  f.qx=wy*hx*wz+hy*wx*hz;f.qy=hy*wx*wz-wy*hx*hz;
  f.qz=wy*wx*hz-hy*hx*wz;f.qw=wy*wx*wz+hy*hx*hz;
  return f;
}
export function inversePoint(p,out){
  const f=out.frame,x=p.x-out.travelX,y=p.y-out.rootY,z=p.z-out.travelZ;
  p.x=f.r00*x+f.r10*y+f.r20*z;p.y=f.r01*x+f.r11*y+f.r21*z;p.z=f.r02*x+f.r12*y+f.r22*z;
  return p;
}
export function inverseOrientation(p,out){
  const f=out.frame,x=p.qx,y=p.qy,z=p.qz,w=p.qw;
  p.qx=f.qw*x-f.qx*w-f.qy*z+f.qz*y;
  p.qy=f.qw*y-f.qy*w-f.qz*x+f.qx*z;
  p.qz=f.qw*z-f.qz*w-f.qx*y+f.qy*x;
  p.qw=f.qw*w+f.qx*x+f.qy*y+f.qz*z;
}
function sessionFoot(segment,u,left,out){
  let p=left?segment.feetFrom.left:segment.feetFrom.right;
  out.x=p.x;out.y=0;out.z=p.z;let yaw=p.yaw;
  out.plantId=p.id;out.planted=true;
  for(let i=0;i<segment.steps.length;i++){
    const step=segment.steps[i];if(step.left!==left||u<step.start)continue;
    if(u>=step.end){p=step.to;out.x=p.x;out.z=p.z;yaw=p.yaw;out.y=0;out.plantId=p.id;out.planted=true;}
    else{
      const s=smooth((u-step.start)/(step.end-step.start)),lift=Math.sin(Math.PI*s)**2;
      out.x=mix(step.from.x,step.to.x,s)-Math.sin(step.from.yaw)*step.tap*lift;
      out.z=mix(step.from.z,step.to.z,s)-Math.cos(step.from.yaw)*step.tap*lift;
      out.y=step.lift*lift;yaw=mix(step.from.yaw,step.to.yaw,s);
      out.plantId=-1;out.planted=false;break;
    }
  }
  out.qx=0;out.qy=Math.sin(yaw/2);out.qz=0;out.qw=Math.cos(yaw/2);
}
function rootLimit(out,foot,left){
  const f=out.frame,hx=left?-.12:.12;
  const x=out.travelX+f.r00*hx+f.r01*.65-foot.x,z=out.travelZ+f.r20*hx+f.r21*.65-foot.z;
  const horizontal=x*x+z*z;
  if(horizontal>=LEG_LIMIT*LEG_LIMIT)throw new RangeError('Unreachable hoop step');
  return foot.y+.07-(f.r10*hx+f.r11*.65)+Math.sqrt(LEG_LIMIT*LEG_LIMIT-horizontal);
}
function smoothMin(a,b){
  const d=Math.abs(a-b),m=Math.min(a,b);
  return d>=SOFTNESS?m:m-(SOFTNESS-d)**2/(4*SOFTNESS);
}
export const HOOP_REST_ROOT_Y=-.012;
export function sampleDance(segment,u,out){
  const left=out.feet.left,right=out.feet.right;
  sessionFoot(segment,u,true,left);sessionFoot(segment,u,false,right);writeDanceFrame(out);
  // Smooth minimum preserves C1 motion when the limiting support leg changes.
  // No limb is clamped or stretched to repair an unreachable trajectory.
  const entrance=segment.kind==='entrance'?smooth(u):segment.kind==='resolution'?1-smooth(u):1;
  const base=(-.012-(out.compression||0))*entrance;
  out.rootY=smoothMin(smoothMin(base,rootLimit(out,left,true)),rootLimit(out,right,false))||0;
  inversePoint(left,out);inversePoint(right,out);inverseOrientation(left,out);inverseOrientation(right,out);
}

export function verticalOffset(p,amount,out){
  p.x+=out.frame.r10*amount;p.y+=out.frame.r11*amount;p.z+=out.frame.r12*amount;
}
export function feetReachable(out){
  for(let i=0;i<2;i++){
    const p=i===0?out.feet.left:out.feet.right;
    // The renderer ends the lower leg at the shoe's top, .07 above its sole.
    const x=p.x+.14*(p.qx*p.qy-p.qw*p.qz),y=p.y+.07*(1-2*(p.qx*p.qx+p.qz*p.qz)),z=p.z+.14*(p.qy*p.qz+p.qw*p.qx);
    const reach=Math.hypot(x-(i===0?-.12:.12),y-.65,z);
    if(!Number.isFinite(reach)||reach>.650001||reach<.001||Math.hypot(x-(i===0?-.12:.12),y-.65)<1e-6)return false;
  }
  return true;
}
