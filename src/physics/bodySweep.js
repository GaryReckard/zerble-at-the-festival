// Interpolate a supplied step, without changing the engine or its broadphase.
// Endpoints describe linear translation and the shortest quaternion arc, not
// an arbitrary path or multiple complete revolutions hidden between samples.
export function bodyMotion(from, to) {
 const p=from.position,q=from.rotation,r={...to.rotation};
 let dot=q.x*r.x+q.y*r.y+q.z*r.z+q.w*r.w;
 if(dot<0){for(const axis of ['x','y','z','w'])r[axis]*=-1;dot=-dot;}
 const half=Math.acos(Math.min(1,dot)),sin=Math.sin(half);
 const delta={x:to.position.x-p.x,y:to.position.y-p.y,z:to.position.z-p.z};
 const factor=sin>1e-8?2*half/sin:2;
 const angular={x:(-r.w*q.x+r.x*q.w-r.y*q.z+r.z*q.y)*factor,
  y:(-r.w*q.y+r.x*q.z+r.y*q.w-r.z*q.x)*factor,z:(-r.w*q.z-r.x*q.y+r.y*q.x+r.z*q.w)*factor};
 return {delta,angle:half*2,travelAt(point,t){
  const x=point.x-p.x-delta.x*t,y=point.y-p.y-delta.y*t,z=point.z-p.z-delta.z*t;
  return {x:delta.x+angular.y*z-angular.z*y,y:delta.y+angular.z*x-angular.x*z,z:delta.z+angular.x*y-angular.y*x};
 },at(t){
  const a=sin>1e-8?Math.sin((1-t)*half)/sin:1-t,b=sin>1e-8?Math.sin(t*half)/sin:t;
  return {position:{x:p.x+delta.x*t,y:p.y+delta.y*t,z:p.z+delta.z*t},
   rotation:{x:q.x*a+r.x*b,y:q.y*a+r.y*b,z:q.z*a+r.z*b,w:q.w*a+r.w*b}};
 }};
}

// A separation cannot close faster than relative translation plus each
// body's angular travel times its radius. Advance less than that safe bound;
// exhausted work is an explicit unknown, never a reported miss or fake hit.
export function sweepSeparation({motionA,motionB,radiusA,radiusB,query,margin,maxIterations=64,minClosingTravel=0}) {
 const a=motionA.delta,b=motionB.delta;
 const travel=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)+motionA.angle*radiusA+motionB.angle*radiusB;
 if(minClosingTravel>0&&travel<=minClosingTravel)return {ok:true,hit:null};
 let fraction=0;
 for(let iteration=0;iteration<maxIterations;iteration++) {
  const result=query(motionA.at(fraction),motionB.at(fraction),travel*(1-fraction)+margin+1e-5);
  if(!result.ok)return result;
  if(!result.contact)return {ok:true,hit:null};
  if(result.contact.distance<=margin+1e-5)return {ok:true,hit:{...result.contact,fraction}};
  if(travel===0)return {ok:true,hit:null};
  const next=fraction+.9*(result.contact.distance-margin)/travel;
  if(next>1)return {ok:true,hit:null};
  if(next<=fraction)return {ok:false,reason:'sweep-stalled',hit:null};
  fraction=next;
 }
 return {ok:false,reason:'sweep-capacity',hit:null};
}
