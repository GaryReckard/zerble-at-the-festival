// Finite local drainage: every source ends in its own compatible receiver.
// Cross-owner rivers need shared boundary ports before they can use this plan.
import { createTriangleSampler } from './geometry.js';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function createFiniteStream({id,points,receiver,halfWidth=5,bankWidth=24,depth=1.4}) {
  if(typeof id!=='string'||!id||!Array.isArray(points)||points.length<2||points.length>128||points.some(p=>![p.x,p.z,p.height].every(Number.isFinite))||
    !receiver||![receiver.x,receiver.z,receiver.height,receiver.radius,halfWidth,bankWidth,depth].every(Number.isFinite)||halfWidth<=0||bankWidth<=halfWidth||bankWidth>80||depth<=0||receiver.radius<halfWidth||receiver.radius>80)throw new TypeError('Invalid bounded stream');
  for(let i=1;i<points.length;i++)if(Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z)<.01||points[i].height>points[i-1].height-1e-6)throw new RangeError('Stream stations must descend');
  const end=points.at(-1);
  if(Math.hypot(end.x-receiver.x,end.z-receiver.z)>receiver.radius||Math.abs(end.height-receiver.height)>1e-8)throw new RangeError('Stream must end at its receiver level');
  const b={minX:Math.min(...points.map(p=>p.x-bankWidth),receiver.x-receiver.radius-bankWidth),maxX:Math.max(...points.map(p=>p.x+bankWidth),receiver.x+receiver.radius+bankWidth),
    minZ:Math.min(...points.map(p=>p.z-bankWidth),receiver.z-receiver.radius-bankWidth),maxZ:Math.max(...points.map(p=>p.z+bankWidth),receiver.z+receiver.radius+bankWidth)};
  return Object.freeze({id,points:Object.freeze(points.map(p=>Object.freeze({...p}))),receiver:Object.freeze({...receiver}),halfWidth,bankWidth,depth,bounds:Object.freeze(b)});
}
export function sampleStream(stream,x,z,out={}) {
  if(!Number.isFinite(x)||!Number.isFinite(z))throw new TypeError('Stream coordinates must be finite');
  let distance=Infinity,height=0;
  for(let i=1;i<stream.points.length;i++) {
    const a=stream.points[i-1],b=stream.points[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz))),d=Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
    if(d<distance){distance=d;height=a.height+(b.height-a.height)*t;}
  }
  const r=stream.receiver,pondDistance=Math.hypot(x-r.x,z-r.z)-r.radius;
  const channelWeight=1-smooth((distance-stream.halfWidth)/(stream.bankWidth-stream.halfWidth)),pondWeight=1-smooth(Math.max(0,pondDistance)/stream.bankWidth);
  if(pondWeight>channelWeight){out.weight=pondWeight;out.height=r.height;}
  else {out.weight=channelWeight;out.height=height;}
  // Positive vertex weights interpolate across the complete cut triangle.
  // Clipping to an analytic bank circle would truncate that triangle early.
  out.coverage=out.weight;
  return out;
}
const probe={};
export function cutStreamBed(stream,x,z,groundHeight) {
  const b=stream.bounds;if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)return groundHeight;
  sampleStream(stream,x,z,probe);
  return groundHeight+Math.min(0,probe.height-stream.depth-groundHeight)*probe.weight;
}
export function createStreamSampler(stream,{step=10}={}) {
  const height=createTriangleSampler((x,z)=>sampleStream(stream,x,z,{}).height,{stepX:step,stepZ:step,cacheLimit:1024});
  const coverage=createTriangleSampler((x,z)=>sampleStream(stream,x,z,{}).coverage,{stepX:step,stepZ:step,cacheLimit:1024}),scratch={};
  return (x,z,out={})=>{const b=stream.bounds;if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ){out.height=0;out.coverage=-1;return out;}height.sample(x,z,out);coverage.sample(x,z,scratch);out.coverage=scratch.height;return out;};
}
function clip(poly,key) {
  const output=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],va=a[key],vb=b[key];
    if(va>=0)output.push(a);
    if((va<0)!==(vb<0)){const t=va/(va-vb),p={};for(const k of ['x','z','height','wet','coverage'])p[k]=a[k]+t*(b[k]-a[k]);output.push(p);}
  }return output;
}
export function buildStreamWater(stream,terrainVertexHeight,{step=10,maxTriangles=10000}={}) {
  if(typeof terrainVertexHeight!=='function'||!Number.isFinite(step)||step<=0||!Number.isInteger(maxTriangles)||maxTriangles<1||maxTriangles>20000)throw new TypeError('Invalid water geometry limits');
  const b=stream.bounds,minX=Math.floor(b.minX/step)*step,maxX=Math.ceil(b.maxX/step)*step,minZ=Math.floor(b.minZ/step)*step,maxZ=Math.ceil(b.maxZ/step)*step;
  if((maxX-minX)*(maxZ-minZ)/(step*step)>8192)throw new RangeError('Water grid exceeds work limit');
  const positions=[],vertex=(x,z)=>{const s=sampleStream(stream,x,z,{}),ground=terrainVertexHeight(x,z);if(!Number.isFinite(ground))throw new TypeError('Invalid water bed');return {x,z,height:s.height,wet:s.height-ground-.001,coverage:s.coverage};};
  for(let z=minZ;z<maxZ;z+=step)for(let x=minX;x<maxX;x+=step) {
    const a=vertex(x,z),b=vertex(x+step,z),c=vertex(x,z+step),d=vertex(x+step,z+step);
    // Clip on the same fixed diagonal as the rendered/contact terrain. Water
    // never covers an uncut triangle above its level, even at bends and banks.
    for(const tri of [[a,c,b],[b,c,d]]) {
      const poly=clip(clip(tri,'coverage'),'wet');
      if(poly.some(p=>p.coverage<1e-7&&p.wet>.003))throw new RangeError('Water is not contained by its banks');
      for(let i=1;i<poly.length-1;i++)for(const p of [poly[0],poly[i],poly[i+1]])positions.push(p.x,p.height,p.z);
      if(positions.length/9>maxTriangles)throw new RangeError('Water triangle limit');
    }
  }
  return {positions:new Float32Array(positions),triangles:positions.length/9,step};
}
