import * as THREE from 'three';

// One reserved lid and joint, owned with its cooler. No allocation on unlatch.
export function createCoolerLid({adapter,bodyId,scale,render}) {
  if(Math.abs(scale.x-scale.y)>1e-6||Math.abs(scale.x-scale.z)>1e-6)throw new Error('Cooler articulation requires uniform scale');
  const base=adapter.readBody(bodyId),id=`${bodyId}:lid`,s=scale.x;
  if(!base)throw new Error('Cooler body is missing');
  const hinge=new THREE.Vector3(0,.372*s,-.223*s),position=hinge.clone().applyQuaternion(base.pose.rotation).add(base.pose.position);
  const volume=s*s*s;
  const result=adapter.addBody({id,type:'dynamic',pose:{position,rotation:base.pose.rotation},ccd:true,angularDamping:.5,
    colliders:[{shape:'cuboid',position:{x:0,y:.035*s,z:.223*s},halfExtents:{x:.31*s,y:.035*s,z:.225*s},mass:1.4*volume,
      friction:.6,restitution:.05,collisionEvents:true,forceEvents:true,forceThreshold:2}]});
  if(!result.ok)throw new Error(`Cooler lid: ${result.reason}`);
  let joint;
  try {
    const added=adapter.addJoint({id:`${id}:hinge`,type:'revolute',bodyA:bodyId,bodyB:id,anchorA:hinge,anchorB:{x:0,y:0,z:0},axis:{x:-1,y:0,z:0},limits:[0,0],contactsEnabled:false});
    if(!added.ok)throw new Error(`Cooler hinge: ${added.reason}`);
    joint=added.token;
  }catch(error){adapter.removeBody(id);throw error;}
  let latched=true,disposed=false;
  const previous=new THREE.Vector3().copy(base.linearVelocity),local=new THREE.Matrix4(),baseWorld=new THREE.Matrix4(),lidWorld=new THREE.Matrix4();
  const p=new THREE.Vector3(),q=new THREE.Quaternion(),relative=new THREE.Quaternion();
  const readBase=()=>{const value=adapter.readBody(bodyId);return value?.generation===base.generation?value:null;};
  const readLid=()=>{const value=adapter.readBody(id);return value?.generation===result.generation?value:null;};
  function unlatch(){if(disposed||!readBase()||!readLid())return false;if(!latched)return true;if(!adapter.setJointLimits(joint,[0,1.85]))return false;latched=false;return true;}
  return Object.freeze({
    bodyId:id,
    unlatch,
    step(){
      if(disposed)return;
      const body=readBase();if(!body)return;
      // Gravity changes velocity by ~0.16 m/s per fixed step. A larger sudden
      // change catches secondary collisions and landings as well as cart hits.
      if(previous.distanceTo(body.linearVelocity)>1.2)unlatch();
      previous.copy(body.linearVelocity);
    },
    publish(){
      if(disposed)return false;
      const body=readBase(),lid=readLid();if(!body||!lid)return false;
      baseWorld.compose(p.copy(body.pose.position),q.copy(body.pose.rotation),scale).invert();
      lidWorld.compose(p.copy(lid.pose.position),q.copy(lid.pose.rotation),scale);
      local.multiplyMatrices(baseWorld,lidWorld);
      return render.setPartMatrix('lid',local);
    },
    inspect(){
      const body=readLid(),parent=readBase();let angle=null,anchorError=null;
      if(body&&parent){q.copy(parent.pose.rotation).invert().multiply(relative.copy(body.pose.rotation));angle=-2*Math.atan2(q.x,q.w);if(angle>Math.PI)angle-=2*Math.PI;if(angle< -Math.PI)angle+=2*Math.PI;
        anchorError=p.copy(hinge).applyQuaternion(parent.pose.rotation).add(parent.pose.position).distanceTo(body.pose.position);}
      return {bodyId:id,latched,sleeping:body?.sleeping??false,generation:body?.generation??null,angle,anchorError};
    },
    dispose(){if(disposed)return;adapter.removeJoint(joint);if(readLid()&&!adapter.removeBody(id)&&readLid())throw new Error('Cooler lid removal failed');disposed=true;},
  });
}
