// Camp envelopes reserve ground for builders, while child props supply walkable collisions.
export function registerCampsite(registry, camp, options = {}) {
  const root = camp.group;
  const yaw = root.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
  const sx = root.scale.x, sz = root.scale.z;
  const point = (x, z) => ({ x: root.position.x + c * x * sx + s * z * sz,
    z: root.position.z - s * x * sx + c * z * sz });
  const position = (p) => root.position.clone().set(p.x, 0, p.z);
  const campSeats = (camp.seats || []).map(seat => {
    const p = point(seat.x, seat.z), facing = yaw + seat.yaw;
    return { ...p, y: (seat.y || 0.45) * root.scale.y, yaw: facing + Math.PI,
      approachX: p.x + Math.sin(facing) * 1.2, approachZ: p.z + Math.cos(facing) * 1.2,
      occupied: false };
  });
  const campBeds = (camp.tents || []).flatMap(tent => {
    const p = point(tent.x, tent.z), door = point(tent.entry.x, tent.entry.z);
    // The shelter's modeled capacity supplies independent sleeping claims;
    // occupants share its doorway and remain hidden inside the fabric.
    const capacity=Math.max(1,Math.min(6,Math.floor(tent.capacity || 1)));
    return Array.from({length:capacity},()=>({...p,doorX:door.x,doorZ:door.z,occupied:false}));
  });
  const ids = [registry.add({ kind: 'campsite', position: root.position.clone(),
    footprint: camp.footprint, campSeats, campBeds, campGroup: root, ...options })];
  for (const prop of camp.childColliders || camp.colliders || []) {
    const p = point(prop.x, prop.z), radius = prop.radius * Math.max(sx, sz);
    const child = { kind: prop.kind, position: position(p), footprint: radius,
      collider: { radius, damage: prop.kind === 'camp_tent' ? 3 : 1 }, ...(options.chunkKey !== undefined ? { chunkKey: options.chunkKey } : {}),
      ...(options.campNeighborhood ? {campNeighborhood:options.campNeighborhood} : {}) };
    ids.push(registry.add(child));
    // A loveseat shares one furniture collider across two independent claims.
    (camp.seats || []).forEach((seat, index) => {
      if (seat.group && seat.group === prop.group) {
        const slot = campSeats[index], facing = slot.yaw - Math.PI;
        slot.collider = child;
        const reach = Math.max(1.2, radius + 0.45);
        slot.approachX = slot.x + Math.sin(facing) * reach;
        slot.approachZ = slot.z + Math.cos(facing) * reach;
      }
    });
  }
  return ids;
}

// Reservations may share empty ground within a neighborhood, but furniture and
// entrances remain authoritative. This runs before registration, so rejection
// leaves no partial registry state behind.
export function canPlaceCampsite(registry, camp, neighborhood) {
  const root = camp.group, yaw = root.rotation.y;
  const c = Math.cos(yaw), s = Math.sin(yaw), scale = Math.max(root.scale.x, root.scale.z);
  const point = (x,z) => ({x:root.position.x+c*x*root.scale.x+s*z*root.scale.z,
    z:root.position.z-s*x*root.scale.x+c*z*root.scale.z});
  let clear = true;
  registry.footprintsNear(root.position.x,root.position.z,camp.footprint+1.5,entry=>{
    if (entry.kind==='tree' || (neighborhood && entry.campNeighborhood===neighborhood)) return;
    if (Math.hypot(root.position.x-entry.position.x,root.position.z-entry.position.z)<camp.footprint+(entry.footprint||0)+1.5) clear=false;
  });
  if (!clear) return false;
  const solids = (camp.childColliders || []).map(prop=>({...point(prop.x,prop.z),radius:prop.radius*scale}));
  const access = camp.tents.map(tent=>({...point(tent.entry.x,tent.entry.z),radius:.45}));
  for (const seat of camp.seats) {
    const p=point(seat.x,seat.z), facing=yaw+seat.yaw;
    const prop=camp.childColliders.find(part=>part.group===seat.group);
    const reach=Math.max(1.2,(prop?.radius||.36)*scale+.45);
    access.push({x:p.x+Math.sin(facing)*reach,z:p.z+Math.cos(facing)*reach,radius:.4});
  }
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
    const previousAccess=[...(entry.campBeds||[]).map(b=>({x:b.doorX,z:b.doorZ})),
      ...(entry.campSeats||[]).map(seat=>({x:seat.approachX,z:seat.approachZ}))];
    for(const door of previousAccess)for(const solid of solids) {
      if(Math.hypot(door.x-solid.x,door.z-solid.z)<solid.radius+.45)return false;
    }
  }
  return true;
}
