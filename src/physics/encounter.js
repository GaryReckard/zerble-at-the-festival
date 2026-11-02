// Bounded staging helper for the opt-in live encounter controls. It changes no
// world state and rejects a route obstructed by another registered collider.
export function findChairApproach({registry,entries,radius,isWet}) {
  for(const entry of entries.slice(0,64))for(const distance of [7,5])for(let index=0;index<16;index++) {
    const angle=index*Math.PI/8,x=entry.position.x+Math.sin(angle)*distance,z=entry.position.z+Math.cos(angle)*distance;
    // Validate the approach up to first contact, not a route through the prop's
    // centre. A cooler beside a kitchen can be hit from outside the canopy.
    const travel=Math.max(0,distance-radius-(entry.collider?.radius??0));
    let clear=true;
    for(let sample=0;sample<6&&clear;sample++) {
      const fraction=sample/5*travel/distance,sx=x+(entry.position.x-x)*fraction,sz=z+(entry.position.z-z)*fraction;
      if(isWet(sx,sz)){clear=false;break;}
      registry.collidersNear(sx,sz,radius,other=>{
        if(other.id!==entry.id&&Math.hypot(other.position.x-sx,other.position.z-sz)<(other.collider?.radius??0)+radius)clear=false;
      });
    }
    if(clear)return {entryId:entry.id,x,z,heading:angle};
  }
  return null;
}
