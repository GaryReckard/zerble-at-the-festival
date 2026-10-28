// Shared procedural motion, independent of populations, RNG and rendering owners.
export const ARM_SHOULDER_Y=1.35;
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
  return out.set(.30+rx,ARM_SHOULDER_Y+Math.cos(p.x)*ry,Math.sin(p.x)*ry);
}
export function sampleHulaMotion(phase,spin,out){
  out.leanX=Math.cos(phase)*.20;out.leanZ=Math.sin(phase)*.20;out.bob=Math.sin(phase*2)*.03;
  out.hoopX=Math.sin(phase)*.08;out.hoopY=phase*spin;out.hoopZ=Math.cos(phase)*.06;return out;
}
// Proximity alone does not give walking or reacting people a dance pose.
export function isStageDancing(state,nearStage,dance){return !!nearStage&&(state==='idle'||state==='watching')&&dance>.35;}
// Authored Healing Arts choreography, shared by its display rig and Crowd.
export const HEALING_DANCE_REST=Object.freeze([0,1,0, 0,1.65,0, 0,1.95,0, -.4,1.35,0, -.34,1.03,0, .4,1.35,0, .34,1.03,0, -.19,.52,0, -.2,.09,0, .19,.52,0, .2,.09,0]);
export function sampleHealingDancePoint(j,time,phase,dj,out){
  const beat=time*3.8+phase*6;
  let x=HEALING_DANCE_REST[j*3],y=HEALING_DANCE_REST[j*3+1],z=HEALING_DANCE_REST[j*3+2];
  x+=Math.sin(beat)*(j<7?.13:.04);y+=Math.max(0,Math.sin(beat*2))*.12;
  if(j===3||j===5){y+=.3+Math.sin(beat+j)*.2;x*=1.5;}
  if(j===4||j===6){y+=.75+Math.sin(beat+j)*.25;z+=dj?.55:.12;}
  if(dj&&(j===3||j===5)){y=1.4;z=.25;}
  if(dj&&(j===4||j===6)){y=1.45+.04*Math.sin(beat+j);z=.65;x=j===4?-.7:.7;}
  out.x=x;out.y=y;out.z=z;return out;
}
const danceElbow={},danceHand={};
export function sampleDanceArmPose(time,dance,out){
  for(const right of [false,true]){
    sampleHealingDancePoint(right?5:3,time,dance,false,danceElbow);
    sampleHealingDancePoint(right?6:4,time,dance,false,danceHand);
    // Retarget directions to the person's fixed shoulders and limb lengths.
    // The authored bounce belongs to the body and must not lift the shoulders.
    const bounce=Math.max(0,Math.sin((time*3.8+dance*6)*2))*.12;
    const upper=Math.atan2(danceElbow.x-(right?.30:-.30),-(danceElbow.y-bounce-ARM_SHOULDER_Y));
    let lower=Math.atan2(danceHand.x-danceElbow.x,-(danceHand.y-danceElbow.y))-upper;
    lower=Math.atan2(Math.sin(lower),Math.cos(lower));
    if(right){out.x=.15;out.z=upper;out.elbow=lower;}
    else{out.leftX=.15;out.leftZ=upper;out.leftElbow=lower;}
  }
  return out;
}
// One instanced draw for all articulated arms. Rest-space position remains
// available to the appearance shader so tie-dye and skin never swim at joints.
export const armShader=`
attribute vec4 armPose;
attribute vec2 armLeftPose;
attribute float armLower;
vec3 armRZ(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x-s*v.y,s*v.x+c*v.y,v.z);}
vec3 armRX(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x,c*v.y-s*v.z,s*v.y+c*v.z);}
vec3 articulateArm(vec3 v,bool normalOnly){
 if(all(equal(armPose,vec4(0.0)))&&all(equal(armLeftPose,vec2(0.0))))return v;
 bool right=position.x>0.0;
 vec3 shoulder=vec3(right?.30:-.30,${ARM_SHOULDER_Y},0.0);
 vec3 elbow=shoulder+vec3(0.0,-.29,0.0);
 if(armLower>.5){if(!normalOnly)v-=elbow;v=armRZ(v,right?armPose.z:armLeftPose.y);if(!normalOnly)v+=elbow;}
 if(!normalOnly)v-=shoulder;
 v=armRX(armRZ(v,right?armPose.y:armPose.w),right?armPose.x:armLeftPose.x);
 if(!normalOnly)v+=shoulder;
 return v;
}
`;

// Fold each leg at the knee while retaining the existing instanced body and
// pants color. Rest-space x identifies the leg even after the feet cross.
export const crossLegShader=`
attribute float crossLegged;
vec3 foldPicnicLeg(vec3 v,bool normalOnly){
 if(crossLegged<.5)return v;
 float side=position.x>0.0?1.0:-1.0;
 bool upper=position.y>.325;
 vec3 origin=vec3(side*.12,upper?.65:.325,0.0);
 vec3 hip=vec3(side*.12,.65,0.0),knee=vec3(side*.34,.54,-.16),foot=vec3(-side*.08,.50,-.24);
 vec3 a=upper?hip:knee,b=upper?knee:foot;
 vec3 axisY=normalize(a-b),axisX=normalize(cross(axisY,vec3(0.0,0.0,1.0))),axisZ=cross(axisX,axisY);
 if(normalOnly)return mat3(axisX,axisY,axisZ)*v;
 vec3 local=v-origin;
 return a+axisX*local.x+(a-b)*(local.y/.325)+axisZ*local.z;
}
`;
