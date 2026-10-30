// Keep a stable request while it contains the predicted path. The extra margin
// gives deadline-budgeted preparation a head start without unbounded sweeps.
export function containsSupport(bounds, position, radius) {
  return !!bounds && position.x-radius>=bounds.minX && position.x+radius<=bounds.maxX
    && position.z-radius>=bounds.minZ && position.z+radius<=bounds.maxZ;
}

export function supportWindow(position, velocity, footprint, previous=null) {
  const radius=Math.max(2,footprint)+2;
  const dx=velocity?.x??0,dz=velocity?.z??0;
  const scale=Math.min(.5,16/(Math.hypot(dx,dz)||1));
  const ahead={x:position.x+dx*scale,z:position.z+dz*scale};
  if(containsSupport(previous,position,radius)&&containsSupport(previous,ahead,radius))return previous;
  const margin=Math.max(8,footprint+5);
  return {minX:Math.min(position.x,ahead.x)-margin,maxX:Math.max(position.x,ahead.x)+margin,
    minZ:Math.min(position.z,ahead.z)-margin,maxZ:Math.max(position.z,ahead.z)+margin};
}
