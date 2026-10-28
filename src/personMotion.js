// Shared procedural motion, independent of populations, RNG and rendering owners.
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export function sampleThrowPose(action,amount,out){
  out.x=.03;out.z=.10;out.elbow=0;out.leftZ=-.10;
  if(action==='catch'){const t=smooth(amount);out.x=mix(.03,-.38,t);out.z=mix(.10,1.98,t);out.elbow=-.10*t;}
  else if(action==='throw'){
    const p=Math.max(0,Math.min(1,amount));
    if(p<.52){const t=smooth(p/.52);out.x=mix(.03,1.04,t);out.z=mix(.10,.38,t);out.elbow=-Math.PI/2*t;}
    else {const t=smooth((p-.52)/.48);out.x=mix(1.04,1.24,t);out.z=mix(.38,.05,t);out.elbow=mix(-Math.PI/2,.04,t);}
  }
  return out;
}
// Matches the shader's R_x * R_z shoulder and R_z elbow transforms exactly.
export function sampleArmHand(p,out){
  const x=.29*Math.sin(p.elbow),y=-.29*Math.cos(p.elbow)-.29;
  const rx=Math.cos(p.z)*x-Math.sin(p.z)*y,ry=Math.sin(p.z)*x+Math.cos(p.z)*y;
  return out.set(.30+rx,1.35+Math.cos(p.x)*ry,Math.sin(p.x)*ry);
}
export function sampleHulaMotion(phase,spin,out){
  out.leanX=Math.cos(phase)*.20;out.leanZ=Math.sin(phase)*.20;out.bob=Math.sin(phase*2)*.03;
  out.hoopX=Math.sin(phase)*.08;out.hoopY=phase*spin;out.hoopZ=Math.cos(phase)*.06;return out;
}
// One instanced draw for all articulated arms. Rest-space position remains
// available to the appearance shader so tie-dye and skin never swim at joints.
export const armShader=`
attribute vec4 armPose;
attribute float armLower;
vec3 armRZ(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x-s*v.y,s*v.x+c*v.y,v.z);}
vec3 armRX(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x,c*v.y-s*v.z,s*v.y+c*v.z);}
vec3 articulateArm(vec3 v,bool normalOnly){
 if(all(equal(armPose,vec4(0.0))))return v;
 bool right=position.x>0.0;
 vec3 shoulder=vec3(right?.30:-.30,1.35,0.0);
 vec3 elbow=shoulder+vec3(0.0,-.29,0.0);
 if(armLower>.5){if(!normalOnly)v-=elbow;v=armRZ(v,right?armPose.z:0.0);if(!normalOnly)v+=elbow;}
 if(!normalOnly)v-=shoulder;
 v=armRX(armRZ(v,right?armPose.y:armPose.w),right?armPose.x:0.0);
 if(!normalOnly)v+=shoulder;
 return v;
}
`;
