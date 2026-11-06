// Frozen pre-atomic-move adapter. Only relative imports were relocated.
import {createSupportBinding} from '../../../src/landscape/support.js';
import {landscapeCandidateAt,landscapeWaterAt} from '../../../src/worldgen/landscapeCandidates.js';
import {registry} from '../../../src/registry.js';
const inside=(b,x,z,r=0)=>x-r>=b.minX&&x+r<=b.maxX&&z-r>=b.minZ&&z+r<=b.maxZ;
const offsets=Object.freeze([{x:0,z:0},...Array.from({length:12},(_,i)=>({x:Math.cos(i*Math.PI/6)*(i<6?4:8),z:Math.sin(i*Math.PI/6)*(i<6?4:8)}))]);
const footprint=radius=>[{x:0,z:0},{x:radius,z:0},{x:-radius,z:0},{x:0,z:radius},{x:0,z:-radius}];

// Population owners call this at their existing final grounding/publication
// boundary. This service owns support state, never person identity or behavior.
export function createLandscapePeopleAdapter(runtime){
  const world=runtime.supportWorld,probe={};
  function placementAllowed(x,z,radius=.45){
    const candidate=landscapeCandidateAt(x,z);if(!candidate)return true;
    const record=runtime.owners.get(candidate.id),plan=record?.district?.plan;if(!plan)return false;
    return plan.shelves.some(b=>inside(b,x,z,radius))||Math.hypot(x-plan.clearing.x,z-plan.clearing.z)<plan.clearing.radius-radius;
  }
  function clear(x,z,radius){let result=true;registry.collidersNear(x,z,radius,e=>{if(Math.hypot(x-e.position.x,z-e.position.z)<radius+e.collider.radius)result=false;});return result;}
  function relocate(actor,{radius=.45}={}){
    const x=actor.position.x,z=actor.position.z;
    for(const offset of offsets){const px=x+offset.x,pz=z+offset.z;if(!placementAllowed(px,pz,radius)||!clear(px,pz,radius))continue;
      try{const binding=createSupportBinding(world,{x:px,z:pz,heading:actor.rotation?.y||0},{footprint:footprint(radius)});actor.surfaceBinding=binding;actor.position.set(px,binding.snapshot().height,pz);if(actor.userData.landscapeHidden){actor.visible=true;actor.userData.landscapeHidden=false;}return true;}catch(error){if(!(error instanceof RangeError))throw error;}
    }
    return false;
  }
  function ground(actor,{radius=.45,relocate:reset=false}={}){
    if(reset||!actor.surfaceBinding){
      if(relocate(actor,{radius})){actor.userData.landscapeUnsupported=false;return true;}
      if(!actor.surfaceBinding){actor.userData.landscapeUnsupported=true;actor.userData.landscapeHidden=true;actor.visible=false;return false;}
    }
    const binding=actor.surfaceBinding,p=binding.propose(actor.position.x,actor.position.z,probe,actor.rotation?.y||0);
    if(p.valid&&p.traversable){binding.commit(actor.position.x,actor.position.z,p);actor.position.y=p.height;actor.userData.landscapeUnsupported=false;return true;}
    const accepted=binding.snapshot();actor.position.set(accepted.x,accepted.height,accepted.z);actor.userData.landscapeUnsupported=false;return false;
  }
  function collider(c,actor,height=2.5){c.minY=actor.position.y;c.maxY=actor.position.y+height;return !actor.userData.landscapeUnsupported;}
  function loopAllowed(path,margin=8){
    if(!Array.isArray(path)||path.length<3||path.length>32)return false;
    const xs=path.map(p=>p.x),zs=path.map(p=>p.z),bounds={minX:Math.min(...xs)-margin,maxX:Math.max(...xs)+margin,minZ:Math.min(...zs)-margin,maxZ:Math.max(...zs)+margin};
    // Keep broad formations out of reserved mountain/water systems. Their
    // existing looping behavior belongs on the surrounding festival grounds.
    if(runtime.access.query(bounds).some(({candidate})=>candidate.bounds.minX<=bounds.maxX&&candidate.bounds.maxX>=bounds.minX&&candidate.bounds.minZ<=bounds.maxZ&&candidate.bounds.maxZ>=bounds.minZ))return false;
    let samples=0;
    for(let z=bounds.minZ;z<=bounds.maxZ;z+=5)for(let x=bounds.minX;x<=bounds.maxX;x+=5){if(++samples>4096)return false;world.sampleSelected(x,z,'terrain',probe);if(!probe.valid||!probe.traversable||probe.grade>.15)return false;}
    return true;
  }
  function prepareLoop(path,base,anchor,player){
    if(loopAllowed(path))return anchor;
    const center=player||anchor;
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,r=i<4?180:280,next={x:center.x+Math.cos(a)*r,z:center.z+Math.sin(a)*r};
      for(let j=0;j<path.length;j++)path[j].set(base[j].x+next.x,0,base[j].z+next.z);
      if(loopAllowed(path))return next;
    }return null;
  }
  const wet={};
  function airFloor(x,z){
    world.sampleSelected(x,z,'terrain',probe);let height=probe.height;
    landscapeWaterAt(x,z,wet);if(wet.coverage>=0)height=Math.max(height,wet.height);
    const candidate=landscapeCandidateAt(x,z),b=candidate?.bridge;
    if(b&&inside(b.bounds,x,z))height=Math.max(height,b.height);
    return height;
  }
  return Object.freeze({world,placementAllowed,ground,relocate,collider,loopAllowed,prepareLoop,airFloor});
}
