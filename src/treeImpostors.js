// View-dependent forest cards. The checked-in atlas comes from the real tree
// meshes, so no models, temporary renderer or baking work enter the game boot.
import * as THREE from 'three';
import {TREE_ATLAS_SPECIES,TREE_ATLAS_COLUMNS,TREE_ATLAS_CELL,TREE_ATLAS_SIZE,treeImpostorFrame} from './treeImpostorViews.js';
export {TREE_ATLAS_SPECIES as TREE_IMPOSTOR_SPECIES} from './treeImpostorViews.js';
const TAU=Math.PI*2;

// Pure counterpart of the GPU selection, useful for camera/atlas regressions.
export function treeImpostorView(direction,yaw=0,species=0,rightFallback={x:1,z:0}){
  const horizontal=Math.hypot(direction.x,direction.z);
  const azimuth=horizontal>1e-5?Math.atan2(direction.x,direction.z):Math.atan2(-rightFallback.z,rightFallback.x);
  const local=((azimuth-yaw)%TAU+TAU)%TAU;
  const az=Math.floor(local/(Math.PI/2)+.5)%4;
  const elevation=Math.atan2(Math.max(0,direction.y),horizontal),level=Math.min(3,elevation/(Math.PI/6));
  const lower=Math.min(2,Math.floor(level)),upper=lower+1;
  return {azimuth,elevation,azimuthIndex:az,lower,upper,blend:level-lower,
    frame0:treeImpostorFrame(species,lower,az),frame1:treeImpostorFrame(species,upper,az),
    // Correct the capture's in-plane rotation overhead, where all four top
    // views represent the same crown with differently oriented capture axes.
    topRotation:Math.atan2(Math.sin(local-az*Math.PI/2),Math.cos(local-az*Math.PI/2))};
}

// Reference for the two-sample cutout policy. Interpolating opaque interior
// colors ghosts a lower-view birch trunk over a top-view green crown, so only
// coverage blends there; the nearer view supplies the interior color.
export function treeImpostorPixel(lower,upper,blend){
  const alpha=lower[3]*(1-blend)+upper[3]*blend;
  const interior=Math.min(lower[3],upper[3])>=.42;
  const dominant=blend<.5?lower:upper;
  const color=interior?dominant.slice(0,3):[0,1,2].map(i=>(lower[i]*lower[3]*(1-blend)+upper[i]*upper[3]*blend)/Math.max(.0001,alpha));
  return {color,alpha,visible:alpha>=.42};
}

export function treeImpostorBasis(direction,rightFallback={x:1,y:0,z:0}){
  const d=new THREE.Vector3(direction.x,direction.y,direction.z).normalize();
  const right=Math.hypot(d.x,d.z)>1e-5?new THREE.Vector3(d.z,0,-d.x).normalize():new THREE.Vector3(rightFallback.x,0,rightFallback.z).normalize();
  if(right.lengthSq()<.01)right.set(1,0,0);
  const up=new THREE.Vector3().crossVectors(d,right).normalize();
  return {right,up,direction:d};
}

export function createTreeImpostorGeometry(cap){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-.5,-.5,0,.5,-.5,0,-.5,.5,0,.5,.5,0]),3));
  geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]),3));
  geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array([0,0,1,0,0,1,1,1]),2));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2,2,1,3]),1));
  for(const name of ['iTreeView','iTreeShape']){
    const attr=new THREE.InstancedBufferAttribute(new Float32Array(cap*2),2);
    attr.setUsage(THREE.DynamicDrawUsage);geo.setAttribute(name,attr);
  }
  return geo;
}

export function writeTreeImpostor(poolOrGeometry,i,record){
  const geo=poolOrGeometry.mesh?.geometry??poolOrGeometry;
  let species=typeof record.species==='string'?TREE_ATLAS_SPECIES.findIndex(s=>s.name===record.species):record.species;
  species=Math.max(0,Math.min(TREE_ATLAS_SPECIES.length-1,species??0));
  const spec=TREE_ATLAS_SPECIES[species],view=geo.attributes.iTreeView.array,shape=geo.attributes.iTreeShape.array;
  view[i*2]=species;view[i*2+1]=record.yaw??0;
  shape[i*2]=spec.centerY;shape[i*2+1]=spec.frameSize;
}
export function finishTreeImpostorWrites(geometry){
  geometry.attributes.iTreeView.needsUpdate=true;geometry.attributes.iTreeShape.needsUpdate=true;
}

const VERTEX=/* glsl */`
attribute vec2 iTreeView;
attribute vec2 iTreeShape;
varying vec2 vTreeUv;
varying vec3 vTreeFrames;
varying vec4 vTreeRotation;
const float TREE_PI=3.141592653589793;
`;
const PROJECT=/* glsl */`
mat4 treeMatrix=modelMatrix*instanceMatrix;
vec3 treeCenter=(treeMatrix*vec4(0.0,iTreeShape.x,0.0,1.0)).xyz;
float treeScale=length(treeMatrix[0].xyz);
vec3 treeDir=normalize(cameraPosition-treeCenter);
float treeHorizontal=length(treeDir.xz);
vec3 treeRight;
if(treeHorizontal>0.00001){
  treeRight=vec3(treeDir.z,0.0,-treeDir.x)/treeHorizontal;
}else{
  treeRight=normalize(vec3(viewMatrix[0][0],0.0,viewMatrix[2][0]));
}
vec3 treeUp=normalize(cross(treeDir,treeRight));
vec3 treeWorld=treeCenter+(treeRight*position.x+treeUp*position.y)*iTreeShape.y*treeScale;
vec4 mvPosition=viewMatrix*vec4(treeWorld,1.0);
gl_Position=projectionMatrix*mvPosition;
float treeAzimuth=atan(-treeRight.z,treeRight.x)-iTreeView.y;
float treeAzIndex=mod(floor(treeAzimuth/(TREE_PI*.5)+.5)+4.0,4.0);
float treeElevation=atan(max(0.0,treeDir.y),treeHorizontal);
float treeLevel=min(3.0,treeElevation/(TREE_PI/6.0));
float treeLower=min(2.0,floor(treeLevel));
vTreeFrames=vec3(iTreeView.x*16.0+treeLower*4.0+treeAzIndex,iTreeView.x*16.0+(treeLower+1.0)*4.0+treeAzIndex,treeLevel-treeLower);
vTreeUv=uv;
float treeRotation=atan(sin(treeAzimuth-treeAzIndex*TREE_PI*.5),cos(treeAzimuth-treeAzIndex*TREE_PI*.5));
float treeCorrection0=treeRotation*smoothstep(1.0,3.0,treeLower);
float treeCorrection1=treeRotation*smoothstep(1.0,3.0,treeLower+1.0);
vTreeRotation=vec4(cos(treeCorrection0),sin(treeCorrection0),cos(treeCorrection1),sin(treeCorrection1));
`;
const FRAGMENT=/* glsl */`
varying vec2 vTreeUv;
varying vec3 vTreeFrames;
varying vec4 vTreeRotation;
vec2 treeAtlasUv(float frame,vec2 localUv,vec2 rotation){
  // At the pole this is an exact change of basis, keeping a crown stable
  // during camera yaw/roll rather than spinning the image with the camera.
  float c=rotation.x,s=rotation.y;
  vec2 q=localUv-.5;
  q=vec2(c*q.x-s*q.y,s*q.x+c*q.y)+.5;
  q=clamp(q,vec2(.5/${TREE_ATLAS_CELL}.0),vec2(1.0-.5/${TREE_ATLAS_CELL}.0));
  return (vec2(mod(frame,${TREE_ATLAS_COLUMNS}.0),${TREE_ATLAS_COLUMNS-1}.0-floor(frame/${TREE_ATLAS_COLUMNS}.0))+q)/${TREE_ATLAS_COLUMNS}.0;
}
`;
const MAP=/* glsl */`
#ifdef USE_MAP
  vec4 treeA=texture2D(map,treeAtlasUv(vTreeFrames.x,vTreeUv,vTreeRotation.xy));
  vec4 treeB=texture2D(map,treeAtlasUv(vTreeFrames.y,vTreeUv,vTreeRotation.zw));
  float treeAlpha=mix(treeA.a,treeB.a,vTreeFrames.z);
  if(treeAlpha<.42)discard;
  vec3 treeColor=mix(treeA.rgb*treeA.a,treeB.rgb*treeB.a,vTreeFrames.z)/max(.0001,treeAlpha);
  // Coverage can morph, but opaque colors must not double-expose a lower
  // trunk across an upper-view crown. Retain weighted color only at edges.
  vec3 treeInterior=mix(treeA.rgb,treeB.rgb,step(.5,vTreeFrames.z));
  treeColor=mix(treeColor,treeInterior,step(.42,min(treeA.a,treeB.a)));
  diffuseColor.rgb*=treeColor;
#endif
`;

export function createTreeImpostorMaterial({map=null,loadTexture=typeof document!=='undefined',color=0xffffff}={}){
  const material=new THREE.MeshBasicMaterial({color,map,alphaTest:.42,transparent:false,depthWrite:true,side:THREE.DoubleSide});
  material.name='View-dependent tree impostors';
  material.customProgramCacheKey=()=>`zerble:treeImpostor:2:${TREE_ATLAS_SIZE}`;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=VERTEX+shader.vertexShader.replace('#include <project_vertex>',PROJECT);
    shader.fragmentShader=FRAGMENT+shader.fragmentShader.replace('#include <map_fragment>',MAP);
  };
  let disposed=false,ownedTexture=null;
  material.addEventListener?.('dispose',()=>{
    if(disposed)return;disposed=true;ownedTexture?.dispose();
  });
  if(!map&&loadTexture){
    material.visible=false;material.userData.treeAtlasState='loading';
    ownedTexture=new THREE.TextureLoader().load(new URL('../assets/textures/tree-impostors.png',import.meta.url).href,()=>{
      if(disposed)return;
      material.userData.treeAtlasState='ready';material.visible=true;
    },undefined,()=>{
      if(disposed)return;
      material.userData.treeAtlasState='error';
      console.error('Tree impostor atlas could not be loaded.');
    });
    ownedTexture.name='Actual tree views';ownedTexture.colorSpace=THREE.SRGBColorSpace;
    ownedTexture.flipY=true;ownedTexture.minFilter=THREE.LinearMipmapLinearFilter;
    ownedTexture.magFilter=THREE.LinearFilter;ownedTexture.generateMipmaps=true;
    ownedTexture.wrapS=ownedTexture.wrapT=THREE.ClampToEdgeWrapping;
    material.map=ownedTexture;
  }
  return material;
}
