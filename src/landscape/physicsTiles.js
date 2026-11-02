import {terrainGenerationKey,sampleTerrain} from '../worldgen/terrain.js';

// Share the live engine's existing bounded tiles and ownership leases.
export function landscapeTileSupport(runtime,bounds,origin){
    if(runtime.disposed||terrainGenerationKey()!==runtime.key)return {ready:false};
    const intersects=b=>b.minX<bounds.maxX&&b.maxX>bounds.minX&&b.minZ<bounds.maxZ&&b.maxZ>bounds.minZ;
    const records=runtime.access.query(bounds,{request:false}),colliders=[],owners=new Set();
    for(const {candidate,state}of records){
      if(!['ready','rejected'].includes(state.status))return {ready:false};
      const record=runtime.owners.get(candidate.id),bridge=candidate.bridge;
      if(bridge&&intersects(bridge.bounds)){
        if(!record?.water)return {ready:false};
        const b=bridge.bounds,minX=Math.max(b.minX,bounds.minX),maxX=Math.min(b.maxX,bounds.maxX),minZ=Math.max(b.minZ,bounds.minZ),maxZ=Math.min(b.maxZ,bounds.maxZ);
        colliders.push({shape:'cuboid',position:{x:(minX+maxX)/2-origin.x,y:bridge.height-.14-origin.y,z:(minZ+maxZ)/2-origin.z},
          halfExtents:{x:(maxX-minX)/2,y:.14,z:(maxZ-minZ)/2},friction:.7,collisionEvents:false});
        owners.add(record.water);
      }
      if(record?.district&&intersects(candidate.bounds))owners.add(record.district);
    }
    if(colliders.length>1)throw new RangeError('Overlapping landscape bridge owners');
    const releases=[...owners].map(owner=>owner.pin('live-physics-tile'));let released=false;
    return {colliders,release(){if(!released){released=true;for(const release of releases)release();}}};
}

// A physical body above a deck recovers on that deck, while a body below it
// continues to use the cut bed. Water does not supply a recovery floor.
export function landscapePhysicsGround(runtime,x,z,referenceY,out={}){
  sampleTerrain(x,z,out);
  for(const record of runtime.owners.values()){
    const bridge=record.water&&record.candidate.bridge,b=bridge?.bounds;
    if(b&&x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&referenceY>=bridge.height-.05){
      return runtime.supportWorld.sampleSelected(x,z,bridge.id,out);
    }
  }
  return out;
}
