// Camp envelopes reserve ground for builders, while child props supply walkable collisions.
const CAMP_WALK_CLEARANCE = .35;

function segmentDistanceSquared(px,pz,ax,az,bx,bz) {
  const dx=bx-ax,dz=bz-az,lengthSquared=dx*dx+dz*dz;
  const t=lengthSquared?Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/lengthSquared)):0;
  return (px-ax-t*dx)**2+(pz-az-t*dz)**2;
}

// Return one reachable world-space approach per seat, preserving input order.
// A claim is usable only if the complete final walk clears other furniture;
// testing its endpoint alone can put that walk through a neighboring chair.
export function campSeatApproaches(camp, registry = null) {
  const root=camp.group,yaw=root.rotation.y,c=Math.cos(yaw),s=Math.sin(yaw);
  const scale=Math.max(root.scale.x,root.scale.z);
  const point=(x,z)=>({x:root.position.x+c*x*root.scale.x+s*z*root.scale.z,
    z:root.position.z-s*x*root.scale.x+c*z*root.scale.z});
  const solids=(camp.childColliders||camp.colliders||[]).map(prop=>({...point(prop.x,prop.z),radius:prop.radius*scale,group:prop.group}));
  return (camp.seats||[]).map(seat=>{
    const p=point(seat.x,seat.z),facing=yaw+seat.yaw;
    const own=seat.group?solids.find(solid=>solid.group===seat.group):null;
    const base=Math.max(1.2,(own?.radius||.36*scale)+.45);
    const obstacles=solids.filter(solid=>!seat.group||solid.group!==seat.group);
    registry?.collidersNear(p.x,p.z,base+2+CAMP_WALK_CLEARANCE,entry=>{
      obstacles.push({x:entry.position.x,z:entry.position.z,radius:entry.collider?.radius||0});
    });
    for(const offset of [0,Math.PI/8,-Math.PI/8,Math.PI/4,-Math.PI/4,3*Math.PI/8,-3*Math.PI/8,Math.PI/2,-Math.PI/2]) {
      for(const extra of [0,.5,1,1.5,2]) {
        const x=p.x+Math.sin(facing+offset)*(base+extra),z=p.z+Math.cos(facing+offset)*(base+extra);
        if(own&&Math.hypot(x-own.x,z-own.z)<own.radius+CAMP_WALK_CLEARANCE)continue;
        if(obstacles.some(solid=>segmentDistanceSquared(solid.x,solid.z,p.x,p.z,x,z)<(solid.radius+CAMP_WALK_CLEARANCE)**2))continue;
        return {x,z};
      }
    }
    return null;
  });
}

export function registerCampsite(registry, camp, options = {}) {
  const root = camp.group;
  const yaw = root.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
  const sx = root.scale.x, sz = root.scale.z;
  const point = (x, z) => ({ x: root.position.x + c * x * sx + s * z * sz,
    z: root.position.z - s * x * sx + c * z * sz });
  const position = (p) => root.position.clone().set(p.x, 0, p.z);
  const approaches=campSeatApproaches(camp,registry.collidersNear?registry:null);
  const seatClaims = (camp.seats || []).map((seat,index) => {
    if(!approaches[index])return null;
    const p = point(seat.x, seat.z), facing = yaw + seat.yaw;
    return {seat,slot:{ ...p, y: (seat.y || 0.45) * root.scale.y, yaw: facing + Math.PI,
      approachX: approaches[index].x, approachZ: approaches[index].z, occupied: false }};
  }).filter(Boolean);
  const campSeats=seatClaims.map(claim=>claim.slot);
  const campBeds = (camp.tents || []).flatMap(tent => {
    const p = point(tent.x, tent.z), door = point(tent.entry.x, tent.entry.z);
    // The shelter's modeled capacity supplies independent sleeping claims;
    // occupants share its doorway and remain hidden inside the fabric.
    const capacity=Math.max(1,Math.min(6,Math.floor(tent.capacity || 1)));
    return Array.from({length:capacity},()=>({...p,doorX:door.x,doorZ:door.z,occupied:false}));
  });
  const fire = (camp.childColliders || camp.colliders || []).find(prop => prop.kind === 'campfire');
  const ids = [registry.add({ kind: 'campsite', position: root.position.clone(),
    footprint: camp.footprint, campSeats, campBeds, campGroup: root,
    ...(fire ? { campFire: point(fire.x, fire.z) } : {}), ...options })];
  for (const prop of camp.childColliders || camp.colliders || []) {
    const p = point(prop.x, prop.z), radius = prop.radius * Math.max(sx, sz);
    const child = { kind: prop.kind, position: position(p), footprint: radius,
      collider: { radius, damage: prop.kind === 'camp_tent' ? 3 : 1 }, ...(options.chunkKey !== undefined ? { chunkKey: options.chunkKey } : {}),
      ...(options.campNeighborhood ? {campNeighborhood:options.campNeighborhood} : {}) };
    ids.push(registry.add(child));
    // A loveseat shares one furniture collider across two independent claims.
    seatClaims.forEach(({seat,slot}) => {
      if (seat.group && seat.group === prop.group) {
        slot.collider = child;
      }
    });
  }
  return ids;
}

// Reservations may share empty ground within a neighborhood, but furniture and
// entrances remain authoritative. This runs before registration, so rejection
// leaves no partial registry state behind.
export function canPlaceCampsite(registry, camp, neighborhood, options = {}) {
  const root = camp.group, yaw = root.rotation.y;
  const c = Math.cos(yaw), s = Math.sin(yaw), scale = Math.max(root.scale.x, root.scale.z);
  const point = (x,z) => ({x:root.position.x+c*x*root.scale.x+s*z*root.scale.z,
    z:root.position.z-s*x*root.scale.x+c*z*root.scale.z});
  let clear = true;
  registry.footprintsNear(root.position.x,root.position.z,camp.footprint+1.5,entry=>{
    if (entry.kind==='tree' || (neighborhood && entry.campNeighborhood===neighborhood)) return;
    // A dry placement may lie inside an irregular lake's broad circle. Only
    // callers that checked actual water can bypass this non-solid envelope;
    // shoreline colliders and all other reservations still participate below.
    if(options.waterChecked===true && entry.kind==='lake' && !entry.collider)return;
    // The center chunk reserves its whole forest before building the planned
    // interior camps. That containing marker is not a competing structure;
    // other forests and every actual solid still participate in clearance.
    if (options.forestOwnerKey != null && entry.kind==='forest' && !entry.collider
        && entry.chunkKey===options.forestOwnerKey) return;
    if (Math.hypot(root.position.x-entry.position.x,root.position.z-entry.position.z)<camp.footprint+(entry.footprint||0)+1.5) clear=false;
  });
  if (!clear) return false;
  const solids = (camp.childColliders || []).map(prop=>({...point(prop.x,prop.z),radius:prop.radius*scale}));
  const access = camp.tents.map(tent=>({...point(tent.entry.x,tent.entry.z),radius:.45}));
  const approaches=campSeatApproaches(camp,registry);
  if(approaches.some(approach=>!approach))return false;
  access.push(...approaches.map(approach=>({...approach,radius:.4})));
  for (const area of [...solids,...access]) {
    registry.collidersNear(area.x,area.z,area.radius+.35,entry=>{
      const distance=Math.hypot(area.x-entry.position.x,area.z-entry.position.z);
      if(distance<area.radius+(entry.collider?.radius||0)+.3) clear=false;
    });
    if(!clear)return false;
  }
  for(const id of registry.byKind.get('campsite')||[]) {
    const entry=registry.entries.get(id);
    if(!entry || Math.hypot(entry.position.x-root.position.x,entry.position.z-root.position.z)>entry.footprint+camp.footprint+2)continue;
    const previousAccess=(entry.campBeds||[]).map(b=>({x:b.doorX,z:b.doorZ}));
    for(const door of previousAccess)for(const solid of solids) {
      if(Math.hypot(door.x-solid.x,door.z-solid.z)<solid.radius+.45)return false;
    }
    for(const seat of entry.campSeats||[])for(const solid of solids) {
      if(segmentDistanceSquared(solid.x,solid.z,seat.x,seat.z,seat.approachX,seat.approachZ)
          <(solid.radius+CAMP_WALK_CLEARANCE)**2)return false;
    }
  }
  return true;
}
