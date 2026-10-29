import * as THREE from 'three';
import {sampleLocomotion,locomotionHipOffset} from '../personMotion.js';

// Pivot existing meshes without changing their rest positions or allocating
// geometry. Shoes belong to the same hip as their leg.
export function stridePivot(body,hipX,hipY,...parts) {
  const pivot=new THREE.Group();pivot.position.set(hipX,hipY,0);body.add(pivot);
  for(const part of parts){body.remove(part);part.position.x-=hipX;part.position.y-=hipY;pivot.add(part);}
  return pivot;
}
export function bindLocomotion(model,{body,legs=[],bodies=[],arms=[],morphs=[],height=1,phase=0,pace=1.4,hip=.65*height,toe=.18*height,ground=0}) {
  model.userData.locomotion={body,legs,bodies,arms,morphs,height,pace,phase,hip,toe,ground,pose:{stride:0,arm:0,bob:0,active:false},
    gaitX:model.position.x,gaitZ:model.position.z};
}
// Accepted delta only; zero-delta renders preserve the last accepted pose. A
// displacement over half a metre is a placement/recycle, never a sprint.
export function tickLocomotion(model,dt) {
  const u=model.userData.locomotion;if(!u)return null;
  if(!(dt>0))return applyLocomotionPose(model,u.pose);
  const x=model.position.x,z=model.position.z,distance=Math.hypot(x-u.gaitX,z-u.gaitZ);
  const pose=sampleLocomotion(u,x,z,distance<.5?distance/dt:0,u.height,model.visible,u.pose,u.phase,u.pace);
  return applyLocomotionPose(model,pose);
}
export function applyLocomotionPose(model,pose) {
  const u=model.userData.locomotion;
  pose.bob=u.ground+locomotionHipOffset(pose.stride,u.hip,u.toe);
  for(let i=0;i<u.legs.length;i++)u.legs[i].rotation.x=(i%2?-1:1)*pose.stride;
  for(let i=0;i<u.arms.length;i++)if(u.arms[i])u.arms[i].rotation.x=(i%2?-1:1)*pose.arm;
  for(const mesh of u.morphs){mesh.morphTargetInfluences[0]=Math.sin(pose.stride);mesh.morphTargetInfluences[1]=Math.cos(pose.stride)-1;}
  if(u.body)u.body.position.y=pose.bob;
  for(const body of u.bodies)body.position.y=pose.bob;
  return pose;
}

// Exact rigid hip rotation expressed as sin(angle) and cos(angle)-1 morphs.
// Three applies these to Standard/Lambert normals and depth/shadow passes,
// retaining one merged mesh, its pooled material and the existing draw count.
// The builder tags only leg/shoe vertices, so hoodie hems and belts stay rigid.
export function addStrideMorphs(geometry,hipY) {
  const p=geometry.attributes.position,n=geometry.attributes.normal,side=geometry.attributes.strideSide;
  const positions=[new Float32Array(p.count*3),new Float32Array(p.count*3)];
  const normals=[new Float32Array(p.count*3),new Float32Array(p.count*3)];
  for(let i=0;i<p.count;i++)if(side.getX(i)){
    const sign=side.getX(i),j=i*3,y=p.getY(i)-hipY,z=p.getZ(i);
    positions[0][j+1]=-z*sign;positions[0][j+2]=y*sign;
    positions[1][j+1]=y;positions[1][j+2]=z;
    normals[0][j+1]=-n.getZ(i)*sign;normals[0][j+2]=n.getY(i)*sign;
    normals[1][j+1]=n.getY(i);normals[1][j+2]=n.getZ(i);
  }
  geometry.morphTargetsRelative=true;
  geometry.morphAttributes.position=positions.map(a=>new THREE.BufferAttribute(a,3));
  geometry.morphAttributes.normal=normals.map(a=>new THREE.BufferAttribute(a,3));
  geometry.deleteAttribute('strideSide');
  // The static bounds need to include the furthest rotating toe.
  geometry.computeBoundingBox();geometry.boundingBox.expandByScalar(.5);geometry.computeBoundingSphere();geometry.boundingSphere.radius+=.5;
  return geometry;
}
