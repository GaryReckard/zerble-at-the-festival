import * as THREE from 'three';
import {mulberry32} from '../rng.js';

let serial=0;
const scenes=new WeakMap();
function observeRender(scene,sync){
  let state=scenes.get(scene);
  if(!state){
    const descriptor=Object.getOwnPropertyDescriptor(scene,'onBeforeRender'),previous=scene.onBeforeRender;
    state={callbacks:new Set(),descriptor,previous};
    state.hook=function(...args){const result=previous.apply(this,args);for(const update of state.callbacks)update(...args);return result;};
    scene.onBeforeRender=state.hook;scenes.set(scene,state);
  }
  state.callbacks.add(sync);
  return ()=>{
    state.callbacks.delete(sync);
    if(!state.callbacks.size){
      if(scene.onBeforeRender===state.hook){if(state.descriptor)Object.defineProperty(scene,'onBeforeRender',state.descriptor);else delete scene.onBeforeRender;}
      scenes.delete(scene);
    }
  };
}
// Child rigs retain their complete hierarchy and gameplay ownership. Only
// their ordinary draw submissions are replaced; transforms still update once
// through the scene, and every active camera uses the same current instances.
export function createChildPresentation({scene,source,seed=0}){
  const records=[],buckets=new Map(),matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4(),projection=new THREE.Matrix4(),frustum=new THREE.Frustum(),cullSphere=new THREE.Sphere();
  let group,disposed=false,unobserve=null,fallbackReason=null;
  const originalRandom=Math.random;
  Math.random=mulberry32((seed^0x4b494442^Math.imul(++serial,0x9e3779b1))>>>0);
  try{
    group=new THREE.Group();group.name='ChildInstances';
    source.traverse(node=>{
      if(!node.isMesh)return;
      if(node.isInstancedMesh||node.isSkinnedMesh||node.customDepthMaterial||node.customDistanceMaterial||Array.isArray(node.material)||node.material.transparent||
        Object.values(node.geometry.morphAttributes).some(attributes=>attributes.length))throw new Error('Unsupported child presentation mesh');
      const key=[node.geometry.id,node.material.id,node.castShadow,node.receiveShadow,node.renderOrder,node.layers.mask].join('/');
      let bucket=buckets.get(key);
      if(!bucket){bucket={geometry:node.geometry,material:node.material,castShadow:node.castShadow,
        receiveShadow:node.receiveShadow,renderOrder:node.renderOrder,layers:node.layers.mask,records:[]};buckets.set(key,bucket);}
      const record={node,layers:node.layers.mask,bucket};bucket.records.push(record);records.push(record);
    });
    for(const bucket of buckets.values()){
      const mesh=new THREE.InstancedMesh(bucket.geometry,bucket.material,bucket.records.length);
      mesh.name='ChildParts';mesh.castShadow=bucket.castShadow;mesh.receiveShadow=bucket.receiveShadow;
      mesh.renderOrder=bucket.renderOrder;mesh.layers.mask=bucket.layers;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);bucket.mesh=mesh;group.add(mesh);
    }
    for(const {node}of records)node.layers.disableAll();
    source.add(group);
    // Renderer updates the scene's world transforms before this hook, then
    // projects/culls/uploads objects afterward. This also covers render-only
    // paths, without a second source-rig matrix traversal in the game tick.
    unobserve=observeRender(scene,sync);
    source.updateWorldMatrix(true,true);sync();
  }catch(error){dispose();throw error;}
  finally{Math.random=originalRandom;}

  function visible(node){
    for(let parent=node;parent;parent=parent.parent){if(!parent.visible)return false;if(parent===source)return true;}
    return false;
  }
  function sheared(m){
    const a=m.elements,x=a[0]*a[0]+a[1]*a[1]+a[2]*a[2],y=a[4]*a[4]+a[5]*a[5]+a[6]*a[6],z=a[8]*a[8]+a[9]*a[9]+a[10]*a[10];
    return Math.abs(a[0]*a[4]+a[1]*a[5]+a[2]*a[6])>Math.sqrt(x*y)*1e-8||
      Math.abs(a[0]*a[8]+a[1]*a[9]+a[2]*a[10])>Math.sqrt(x*z)*1e-8||
      Math.abs(a[4]*a[8]+a[5]*a[9]+a[6]*a[10])>Math.sqrt(y*z)*1e-8;
  }
  function sync(renderer,renderedScene,camera){
    if(disposed)return;
    inverse.copy(group.matrixWorld).invert();
    const cameraCull=!!camera?.isCamera,retainCasters=renderer?.shadowMap?.enabled!==false;
    if(cameraCull)frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem);
    // Three transforms culling spheres by the longest matrix column, which
    // assumes orthogonal axes. Rotated/nonuniform ancestors can add shear;
    // use a conservative norm there, without inflating ordinary game bounds.
    const e=group.matrixWorld.elements,x=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],y=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],z=e[8]*e[8]+e[9]*e[9]+e[10]*e[10],longest=Math.max(x,y,z);
    const cross=Math.abs(e[0]*e[4]+e[1]*e[5]+e[2]*e[6])+Math.abs(e[0]*e[8]+e[1]*e[9]+e[2]*e[10])+Math.abs(e[4]*e[8]+e[5]*e[9]+e[6]*e[10]);
    const inflation=cross>longest*1e-10?Math.sqrt((x+y+z)/longest):1;
    for(const bucket of buckets.values()){
      let count=0;
      for(const record of bucket.records){
        const {node}=record;
        if(!visible(node))continue;
        if(node.geometry!==bucket.geometry||node.material!==bucket.material||node.castShadow!==bucket.castShadow||node.receiveShadow!==bucket.receiveShadow||node.renderOrder!==bucket.renderOrder){fallbackReason='changed-render-state';dispose();return;}
        if(node.layers.mask!==0){record.layers=node.layers.mask;fallbackReason='changed-render-layer';dispose();return;}
        if(cameraCull){
          if(!(bucket.layers&camera.layers.mask))continue;
          // Match ordinary per-mesh culling before filling the batch. Keep
          // offscreen casters for the later shadow pass, which uses this same
          // instance buffer but a different light-space frustum.
          if(node.frustumCulled&&!(retainCasters&&bucket.castShadow)){
            if(node.geometry.boundingSphere===null)node.geometry.computeBoundingSphere();
            cullSphere.copy(node.geometry.boundingSphere).applyMatrix4(node.matrixWorld);cullSphere.radius+=.002;
            if(!frustum.intersectsSphere(cullSphere))continue;
          }
        }
        matrix.multiplyMatrices(inverse,node.matrixWorld);
        // Current rigs use rotations and axis scales. If a future rig adds
        // local shear, preserve its ordinary normal/culling path immediately.
        if(sheared(matrix)){fallbackReason='sheared-instance';dispose();return;}
        bucket.mesh.setMatrixAt(count++,matrix);
      }
      bucket.mesh.count=count;bucket.mesh.instanceMatrix.needsUpdate=true;
      bucket.mesh.computeBoundingSphere();
      if(count)bucket.mesh.boundingSphere.radius*=inflation;
    }
  }
  function dispose(){
    if(disposed)return;disposed=true;
    unobserve?.();unobserve=null;
    for(const {node,layers}of records)node.layers.mask=layers;
    for(const bucket of buckets.values())bucket.mesh?.dispose();
    group?.removeFromParent();records.length=0;buckets.clear();
  }
  return {group,sync,dispose,get disposed(){return disposed;},get fallbackReason(){return fallbackReason;}};
}
