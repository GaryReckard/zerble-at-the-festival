// Social courts belong to completed communal parents, never arbitrary terrain.
import { registry } from './registry.js';
import { worldHash, mulberry32 } from './rng.js';
import { sampleTerrain, terrainHeight } from './worldgen/terrain.js';
import { queryPoint } from './worldgen/index.js';
import { nearestRoad } from './worldgen/roads.js';
import { landscapeClearance, landscapeNearestRoad } from './worldgen/landscapePolicy.js';
import { clusterShapes } from './worldgen/tuning.js';
import { buildCornholeGame } from './models/cornhole.js';

export const CORNHOLE_COURT = Object.freeze({ halfWidth: 1.6, halfLength: 6, radius: 6.21, attempts: 24, chance: .55 });
const toWorld = (p,x,z) => ({x:p.x+Math.cos(p.yaw)*x+Math.sin(p.yaw)*z,z:p.z-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z});
function overlaps(p, entry, radius) {
  // Registry consumers see a circle. Admission must test that same circle so
  // later neighboring builders never encounter an untested reserved shoulder.
  return Math.hypot(entry.position.x-p.x,entry.position.z-p.z)<CORNHOLE_COURT.radius+radius+.45;
}
export function courtInsideParent(p,parent) {
  const shape=parent.kind==='camp_village'?{t:'circle',x:parent.x,z:parent.z,r:parent.envelope??60}:clusterShapes('vendor_row',1,parent.x,parent.z,parent.yaw)[0];
  const dx=p.x-shape.x,dz=p.z-shape.z,r=CORNHOLE_COURT.radius+.5;
  if(shape.t==='circle') { if(Math.hypot(dx,dz)+r>shape.r)return false; }
  else if(Math.abs(dx*shape.ux+dz*shape.uz)+r>shape.hl||Math.abs(dx*shape.uz-dz*shape.ux)+r>shape.hw)return false;
  for(const x of [-1.6,1.6])for(const z of [-6,6]) {
    const q=toWorld(p,x,z),dx=q.x-shape.x,dz=q.z-shape.z;
    if(shape.t==='circle') { if(Math.hypot(dx,dz)>shape.r-.5)return false; }
    else if(Math.abs(dx*shape.ux+dz*shape.uz)>shape.hl-.5||Math.abs(dx*shape.uz-dz*shape.ux)>shape.hw-.5)return false;
  }
  return true;
}
export function cornholeSiteClear(p, world=registry, environment={}) {
  let clear=true;
  // Canonical generation geometry keeps displaced physical chairs from changing
  // future procedural layout when a neighboring chunk streams in again.
  const footprints=world.generationFootprintsNear||world.footprintsNear;
  footprints.call(world,p.x,p.z,CORNHOLE_COURT.radius+.5,e=>{
    if(e.kind==='lake'&&!e.collider)return; // exact water samples below
    if(overlaps(p,e,e.footprint||0))clear=false;
  });
  const colliders=world.generationCollidersNear||world.collidersNear;
  colliders.call(world,p.x,p.z,CORNHOLE_COURT.radius+.5,e=>{if(overlaps(p,e,e.collider?.radius||0))clear=false;});
  if(!clear)return false;
  const sample=environment.sample??sampleTerrain, point=environment.point??queryPoint;
  const road=environment.road??((x,z)=>landscapeNearestRoad(x,z,nearestRoad(x,z)));
  const clearance=environment.clearance??landscapeClearance;
  let low=Infinity,high=-Infinity;
  // Includes both sidelines, end access, board positions and the throwing lane.
  for(let ix=0;ix<=4;ix++)for(let iz=0;iz<=12;iz++) {
    const q=toWorld(p,-1.6+ix*.8,-6+iz),ground=sample(q.x,q.z),info=point(q.x,q.z),r=road(q.x,q.z);
    if(!ground.traversable||ground.surfaceClass!=='grass'||ground.grade>.055||info.noBuild||clearance(q.x,q.z,.6)||r.onRoad||r.dist<(r.width??8)/2+.8)return false;
    low=Math.min(low,ground.height);high=Math.max(high,ground.height);
  }
  return high-low<=.22;
}

// Shared by the game and sandbox. The caller owns the enclosing chunk group.
export function buildCornholeAt(ctx,p) {
  const world=ctx.registry??registry, group=buildCornholeGame({seed:p.seed});
  group.position.set(p.x,terrainHeight(p.x,p.z),p.z);group.rotation.y=p.yaw??0;
  ctx.group.add(group);
  const cornhole=group.userData.cornhole;
  const resetBags=cornhole.resetBags;
  cornhole.resetBags=()=>{
    resetBags();
    for(const bag of cornhole.bags) {
      const q=toWorld({...p,yaw:p.yaw??0},bag.position.x,bag.position.z);
      bag.position.y+=terrainHeight(q.x,q.z)-group.position.y;
    }
  };
  cornhole.resetBags();
  for(const board of cornhole.boards) {
    const q=toWorld({...p,yaw:p.yaw??0},board.group.position.x,board.group.position.z);
    board.group.position.y=terrainHeight(q.x,q.z)-group.position.y;
    const position=group.position.clone().set(q.x,terrainHeight(q.x,q.z),q.z);
    world.add({kind:'cornhole_board',position,group:board.group,footprint:.75,collider:{radius:.75,damage:1},
      cornholeBoard:{width:board.width,length:board.length,frontHeight:board.frontHeight,backHeight:board.backHeight,
        thickness:board.thickness,holeRadius:board.holeRadius,holeZ:board.holeZ,yaw:(p.yaw??0)+board.yaw},chunkKey:ctx.key});
  }
  const entry={kind:'cornhole_game',position:group.position.clone(),group,cornhole,footprint:CORNHOLE_COURT.radius,courtBounds:{halfWidth:CORNHOLE_COURT.halfWidth,halfLength:CORNHOLE_COURT.halfLength,yaw:p.yaw??0},
    chunkKey:ctx.key,sourceKind:p.sourceKind,sourceKey:p.sourceKey};
  world.add(entry);return entry;
}

export function tryPlaceCornhole(ctx,parent) {
  if(!['camp_village','vendor_row'].includes(parent.kind)||(parent.communitySize??0)<3)return null;
  const sourceKey=`${parent.kind}:${parent.x},${parent.z}`;
  const world=ctx.registry??registry;
  for(const id of world.byKind.get('cornhole_game')||[])if(world.entries.get(id)?.sourceKey===sourceKey)return null;
  const seed=worldHash(Math.round(parent.x*256),Math.round(parent.z*256),parent.kind==='camp_village'?0x434f524e:0x42414753),rng=mulberry32(seed);
  if(rng()>CORNHOLE_COURT.chance)return null;
  for(let i=0;i<CORNHOLE_COURT.attempts;i++) {
    let q,yaw;
    if(parent.kind==='camp_village') {
      const angle=rng()*Math.PI*2,radius=(parent.envelope??60)*(.35+rng()*.5);
      q={x:parent.x+Math.cos(angle)*radius,z:parent.z+Math.sin(angle)*radius};yaw=rng()*Math.PI*2;
    } else {
      // The full circular reservation must fit behind the stalls, too. Most
      // rows have no room; declining is safer than widening their parent plan.
      q=toWorld(parent,(rng()<.5?-1:1)*12.8,(rng()-.5)*20);yaw=parent.yaw;
    }
    const p={...q,yaw,seed,sourceKind:parent.kind,sourceKey};
    if(courtInsideParent(p,parent)&&cornholeSiteClear(p,world))return buildCornholeAt(ctx,p);
  }
  return null;
}
