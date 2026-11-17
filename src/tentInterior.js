// A lamp-to-fabric projection, evaluated on the existing cloth fragments. The
// six soft capsules are an implied camper inside, not another visible person
// or a shadow-map light. Shared source materials are never modified.
import * as THREE from 'three';
export const TENT_INTERIOR_CAPSULES=6;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

// Reference geometry for verification and the exact closest-segment policy in
// GLSL. Both source-to-wall and body segments are finite, so an object beyond
// the fabric cannot cast back onto a nearer wall.
export function tentRayCapsuleDistance(light,wall,a,b){
  const dx=wall.x-light.x,dy=wall.y-light.y,dz=wall.z-light.z;
  const ex=b.x-a.x,ey=b.y-a.y,ez=b.z-a.z;
  const wx=light.x-a.x,wy=light.y-a.y,wz=light.z-a.z;
  const aa=dx*dx+dy*dy+dz*dz,bb=dx*ex+dy*ey+dz*ez,cc=ex*ex+ey*ey+ez*ez;
  const dd=dx*wx+dy*wy+dz*wz,ee=ex*wx+ey*wy+ez*wz,den=Math.max(aa*cc-bb*bb,1e-8);
  const clamp=x=>Math.max(0,Math.min(1,x));
  let s=clamp((bb*ee-cc*dd)/den),t=clamp((aa*ee-bb*dd)/den);
  s=clamp((bb*t-dd)/Math.max(aa,1e-8));t=clamp((bb*s+ee)/Math.max(cc,1e-8));
  s=clamp((bb*t-dd)/Math.max(aa,1e-8));
  return {distance:Math.hypot(wx+dx*s-ex*t,wy+dy*s-ey*t,wz+dz*s-ez*t),rayFraction:s};
}
export function tentInteriorShadow(light,wall,capsules){
  let shadow=0;
  for(const capsule of capsules){const hit=tentRayCapsuleDistance(light,wall,capsule.a,capsule.b);
    const softness=.018+.045*(1-hit.rayFraction);
    shadow=Math.max(shadow,1-smooth(capsule.radius-softness,capsule.radius+softness,hit.distance));
  }
  return shadow;
}

const VERTEX=/* glsl */`
uniform mat4 tentMeshToLocal;
varying vec3 vTentFabric;
`;
const FRAGMENT=/* glsl */`
uniform float tentInteriorStrength;
uniform vec3 tentInteriorLamp;
uniform vec4 tentBodyA[6];
uniform vec3 tentBodyB[6];
varying vec3 vTentFabric;
float tentCapsuleOcclusion(vec3 wall,vec4 bodyA,vec3 bodyB){
  vec3 d=wall-tentInteriorLamp;
  vec3 e=bodyB-bodyA.xyz;
  vec3 w=tentInteriorLamp-bodyA.xyz;
  float aa=dot(d,d),bb=dot(d,e),cc=dot(e,e),dd=dot(d,w),ee=dot(e,w);
  float den=max(aa*cc-bb*bb,.00000001);
  float s=clamp((bb*ee-cc*dd)/den,0.0,1.0);
  float t=clamp((aa*ee-bb*dd)/den,0.0,1.0);
  s=clamp((bb*t-dd)/max(aa,.00000001),0.0,1.0);
  t=clamp((bb*s+ee)/max(cc,.00000001),0.0,1.0);
  s=clamp((bb*t-dd)/max(aa,.00000001),0.0,1.0);
  float distanceToBody=length(w+d*s-e*t);
  // A nearby wall gets a firmer edge; the same body farther from the cloth
  // spreads into a soft penumbra. No screen-space noise or texture uploads.
  float softness=.018+.045*(1.0-s);
  return 1.0-smoothstep(bodyA.w-softness,bodyA.w+softness,distanceToBody);
}
`;
const APPLY=/* glsl */`
if(tentInteriorStrength>.001){
  float tentShadow=0.0;
  for(int tentPart=0;tentPart<6;tentPart++){
    tentShadow=max(tentShadow,tentCapsuleOcclusion(vTentFabric,tentBodyA[tentPart],tentBodyB[tentPart]));
  }
  vec3 tentRay=vTentFabric-tentInteriorLamp;
  float tentLampFalloff=min(1.35,.85/(.45+dot(tentRay,tentRay)));
  totalEmissiveRadiance*=tentLampFalloff*(1.0-.96*tentShadow);
  diffuseColor.rgb*=1.0-.42*tentInteriorStrength*tentShadow;
}
`;

export function attachTentInterior(tent,phase=0){
  const height=tent.shelter?.height??1.7,width=tent.shelter?.width??2.2,depth=tent.shelter?.depth??2.5;
  const size=Math.min(1,height/1.9),bodyA=Array.from({length:6},()=>new THREE.Vector4()),bodyB=Array.from({length:6},()=>new THREE.Vector3());
  // An existing deterministic phase chooses a back-left or side lantern, so
  // camps do not all project toward their doors. Both stay inside the shell
  // and clear of the camper; no additional world RNG draw is consumed.
  const sideLit=phase>.5;
  const lamp=new THREE.Vector3(
    sideLit?-Math.min(.65,width*.29):-Math.min(.25,width*.10),
    .48*size,
    sideLit?Math.min(.55,depth*.20):-Math.min(.62,depth*.23));
  const strengthUniform={value:0};
  const materials=[],uniforms={strength:strengthUniform,lamp:{value:lamp},bodyA:{value:bodyA},bodyB:{value:bodyB}};
  tent.group.updateWorldMatrix(true,true);
  const inverseRoot=tent.group.matrixWorld.clone().invert();
  for(const mesh of tent.fabricMeshes??[]){
    const original=mesh.material;
    if(!original?.clone||!original.emissive)continue;
    const material=original.clone();material.userData.shared=false;
    material.name='Internally lit tent fabric';
    material.emissive.setHex(0xffb45f);material.emissiveIntensity=0;
    const toLocal=new THREE.Matrix4().multiplyMatrices(inverseRoot,mesh.matrixWorld);
    const previousCompile=original.onBeforeCompile?.bind(original);
    const previousKey=original.customProgramCacheKey?.call(original)??'';
    material.customProgramCacheKey=()=>`${previousKey}:zerble:tent-interior:1`;
    material.onBeforeCompile=(shader,renderer)=>{
      previousCompile?.(shader,renderer);shader.uniforms??={};
      Object.assign(shader.uniforms,{tentMeshToLocal:{value:toLocal},tentInteriorStrength:strengthUniform,
        tentInteriorLamp:uniforms.lamp,tentBodyA:uniforms.bodyA,tentBodyB:uniforms.bodyB});
      shader.vertexShader=VERTEX+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvTentFabric=(tentMeshToLocal*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader=FRAGMENT+shader.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n'+APPLY);
    };
    mesh.material=material;materials.push(material);
  }
  let lastTime=NaN,lastStrength=NaN;
  const set=(i,ax,ay,az,bx,by,bz,radius)=>{bodyA[i].set(ax,ay,az,radius);bodyB[i].set(bx,by,bz);};
  const setSegment=(i,ax,ay,az,bx,by,bz,r,c,s,cx,cz)=>set(i,
    (ax*c+az*s)*size+cx,ay*size,(az*c-ax*s)*size+cz,
    (bx*c+bz*s)*size+cx,by*size,(bz*c-bx*s)*size+cz,r*size);
  const update=(time,strength,reducedMotion=false)=>{
    const lit=Math.max(0,Math.min(1,strength));strengthUniform.value=lit;
    if(lit!==lastStrength){for(const material of materials)material.emissiveIntensity=lit*.62;lastStrength=lit;}
    if(lit<.001)return;
    const t=reducedMotion?phase*31:time+phase*31;
    if(t===lastTime)return;lastTime=t;
    const angle=Math.sin(t*.16)*.22+Math.sin(t*.061)*.12;
    const reach=(.5+.5*Math.sin(t*.39+phase*4))**4;
    const breath=Math.sin(t*1.35)*.009;
    const lean=Math.sin(t*.27)*.045+reach*.06;
    const cx=.06+Math.sin(t*.13)*.08,cz=Math.min(.42,depth*.17)+Math.cos(t*.11)*.05;
    const c=Math.cos(angle),s=Math.sin(angle);
    // The six preallocated uniforms are the only animated storage. Work in
    // scalars here rather than allocating joint arrays for every lit tent.
    const headX=lean*.9,headY=.94+breath;
    setSegment(0,headX,headY,.015,headX,headY+.025,.015,.105,c,s,cx,cz);
    setSegment(1,0,.36,0,lean,.76+breath,.015,.145,c,s,cx,cz);
    setSegment(2,-.14+lean,.69+breath,0,-.25,.35,.20,.052,c,s,cx,cz);
    const elbowX=.24+reach*.11,elbowY=.50+reach*.23,elbowZ=.08+reach*.08;
    setSegment(3,.14+lean,.70+breath,0,elbowX,elbowY,elbowZ,.054,c,s,cx,cz);
    setSegment(4,elbowX,elbowY,elbowZ,.16+reach*.28,.33+reach*.57,.26+reach*.10,.047,c,s,cx,cz);
    setSegment(5,-.04,.30,.05,.08,.19,.36,.14,c,s,cx,cz);
  };
  update(0,0);
  return {materials,uniforms,lamp,update,setLamp(x,y,z){lamp.set(x,y,z);}};
}
