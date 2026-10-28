// Opt-in rolling festival country. Layout remains unchanged, and every gathering
// footprint and lake shares datum zero so overlapping constraints agree exactly.
// The only randomness is an independent hash stream, never a layout RNG draw.
import { getSessionSeed, worldHash } from '../rng.js';
import { CONFIG, worldgenEpoch } from './constants.js';
import { heartsInBounds } from './hearts.js';
import { lakesInBounds } from './water.js';
import { festivalPlan, campVillagesNear, MAX_POI_REACH } from './festival.js';
import { clusterExtent } from './tuning.js';
import { woodlandCampsNear } from '../woodlandCamping.js';

export const TERRAIN_VERSION = 1;
export const TERRAIN_STEP = 10;
const TILE = 200, SHOULDER = 90, SALT = 0x54455252;
// lakes.js places a medium host 6 + 18 m beyond shore, then campClearing.js
// accepts sleeping pitches within 18 m with a 7 m footprint. Grade the full
// occupied ring, rather than flattening only the water and the host's centre.
const LAKE_CAMP_REACH = 6 + 18 + 18 + 7;
const vertexCache = new Map(), tileCache = new Map(), ownerCache = new Map();
let enabled = false, gateKey = '', planning = false;
export function terrainEnabled() { return enabled; }
export function setTerrainEnabled(value) { enabled = !!value; return enabled; }
function gate() {
  const key = `${getSessionSeed()}:${worldgenEpoch()}:${TERRAIN_VERSION}`;
  if (key !== gateKey) {
    gateKey = key; vertexCache.clear(); tileCache.clear(); ownerCache.clear();
  }
}
function boundedSet(cache, key, value, limit) {
  if (cache.size >= limit) cache.delete(cache.keys().next().value);
  cache.set(key, value); return value;
}
const smooth = t => t * t * (3 - 2 * t);
function baseHeight(x, z) {
  const size = 800, ix = Math.floor(x / size), iz = Math.floor(z / size);
  const u = smooth(x / size - ix), v = smooth(z / size - iz);
  const n = (a,b) => (worldHash(a,b,SALT) / 4294967295 * 2 - 1) * 15;
  return (n(ix,iz)*(1-u)+n(ix+1,iz)*u)*(1-v)
    +(n(ix,iz+1)*(1-u)+n(ix+1,iz+1)*u)*v;
}
function descriptor(id, kind, source, x, z, radius) {
  // A triangle whose interior touches the footprint may have vertices just
  // outside it. The diagonal margin keeps those triangles on the same plateau.
  return Object.freeze({ id, kind, source, x, z,
    radius: radius + TERRAIN_STEP * Math.SQRT2, shoulder:SHOULDER, height:0, graded:true });
}
function ownerPads(heart) {
  const key = `${heart.cx},${heart.cz}`;
  if (ownerCache.has(key)) return ownerCache.get(key);
  const pads = festivalPlan(heart).map(p => descriptor(`venue:${heart.cx},${heart.cz}:${p.clusterSeed}:${p.kind}`,
    'venue', p, p.x, p.z, Math.max(p.footprint || 0, clusterExtent(p.kind,p.scale || 1))));
  return boundedSet(ownerCache,key,pads,2048);
}
function intersects(p,b,pad=0) {
  const r = p.radius + pad;
  return p.x+r>=b.minX && p.x-r<=b.maxX && p.z+r>=b.minZ && p.z-r<=b.maxZ;
}
function tileDescriptors(tx,tz) {
  const key = `${tx},${tz}`;
  if(tileCache.has(key)) return tileCache.get(key);
  const b={minX:tx*TILE,minZ:tz*TILE,maxX:(tx+1)*TILE,maxZ:(tz+1)*TILE};
  // Bound from the actual tunable envelope sizes, rather than assuming the
  // default food court or stage scale survives live tuning.
  const maxExtent = Math.max(100, ...['food_court','vendor_row','main_stage','side_stage','tent_stage','camp_village','welfare_post','healing_arts']
    .map(kind=>clusterExtent(kind,2)));
  const reach = MAX_POI_REACH + maxExtent + SHOULDER + TERRAIN_STEP * 2;
  const out=[];
  planning = true;
  try {
    for(const h of heartsInBounds(b.minX-reach,b.minZ-reach,b.maxX+reach,b.maxZ+reach))
      for(const p of ownerPads(h)) if(intersects(p,b,SHOULDER))out.push(p);
    const expanded={minX:b.minX-maxExtent-SHOULDER-20,minZ:b.minZ-maxExtent-SHOULDER-20,
      maxX:b.maxX+maxExtent+SHOULDER+20,maxZ:b.maxZ+maxExtent+SHOULDER+20};
    for(const p of campVillagesNear(expanded)) {
      const d=descriptor(`village:${p.clusterSeed}:${p.x},${p.z}`, 'camp',p,p.x,p.z,
        Math.max(p.footprint||0,clusterExtent(p.kind,p.scale||1)));
      if(intersects(d,b,SHOULDER))out.push(d);
    }
    for(const district of woodlandCampsNear(expanded))for(const p of district.pitches) {
      const d=descriptor(`woodland:${p.seed}:${p.worldx},${p.worldz}`,'camp',p,p.worldx,p.worldz,p.footprint);
      if(intersects(d,b,SHOULDER))out.push(d);
    }
    // lakesInBounds has a one-cell search pad. Explicit extra maximum shore
    // radius keeps even tuned elongated lakes discoverable from another tile.
    const lakeReach=CONFIG.LAKE_RADIUS.max*Math.sqrt(CONFIG.LAKE_ELONGATE)*1.6+SHOULDER+LAKE_CAMP_REACH+1;
    for(const l of lakesInBounds(b.minX-lakeReach,b.minZ-lakeReach,b.maxX+lakeReach,b.maxZ+lakeReach)) {
      const d=descriptor(`lake:${l.cx},${l.cz}`,'lake',l,l.x,l.z,l.maxR+LAKE_CAMP_REACH);
      if(intersects(d,b,SHOULDER))out.push(d);
    }
  } finally { planning=false; }
  return boundedSet(tileCache,key,Object.freeze(out),512);
}
export function terrainDescriptors(bounds) {
  gate();
  const {minX,minZ,maxX,maxZ}=bounds;
  if(![minX,minZ,maxX,maxZ].every(Number.isFinite)||minX>maxX||minZ>maxZ)
    throw new RangeError('Terrain bounds must be finite and ordered');
  const x0=Math.floor(minX/TILE),x1=Math.floor(maxX/TILE),z0=Math.floor(minZ/TILE),z1=Math.floor(maxZ/TILE);
  // Map overviews must use the cheap relief sampling layer, never force plans
  // for thousands of off-screen festival hubs.
  if((x1-x0+1)*(z1-z0+1)>256)return [];
  const found=new Map();
  for(let tz=z0;tz<=z1;tz++)for(let tx=x0;tx<=x1;tx++)
    for(const d of tileDescriptors(tx,tz))if(intersects(d,bounds))found.set(d.id,d);
  return [...found.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
export function terrainVertexHeight(x,z) {
  if(!Number.isFinite(x)||!Number.isFinite(z))throw new RangeError('Terrain coordinates must be finite');
  if(!enabled)return 0;
  // A layout query may expose a groundY field in future. Descriptor planning
  // must never feed final terrain back into the X/Z plan or poison vertex caches.
  if(planning)return 0;
  gate();
  const key=`${x},${z}`;
  if(vertexCache.has(key))return vertexCache.get(key);
  const pads=tileDescriptors(Math.floor(x/TILE),Math.floor(z/TILE));
  let mask=1;
  for(const p of pads) {
    const distance=Math.hypot(x-p.x,z-p.z)-p.radius;
    if(distance<=0){mask=0;break;}
    if(distance<SHOULDER)mask=Math.min(mask,smooth(distance/SHOULDER));
  }
  return boundedSet(vertexCache,key,baseHeight(x,z)*mask,65536);
}
export function sampleTerrain(x,z,out={}) {
  if(!Number.isFinite(x)||!Number.isFinite(z))throw new RangeError('Terrain coordinates must be finite');
  let height=0,dx=0,dz=0;
  if(enabled && !planning) {
    const ix=Math.floor(x/TERRAIN_STEP)*TERRAIN_STEP,iz=Math.floor(z/TERRAIN_STEP)*TERRAIN_STEP;
    const u=(x-ix)/TERRAIN_STEP,v=(z-iz)/TERRAIN_STEP;
    const a=terrainVertexHeight(ix,iz),b=terrainVertexHeight(ix+TERRAIN_STEP,iz);
    const c=terrainVertexHeight(ix,iz+TERRAIN_STEP),d=terrainVertexHeight(ix+TERRAIN_STEP,iz+TERRAIN_STEP);
    // PlaneGeometry rotated -PI/2 joins (x+step,z) to (x,z+step).
    if(u+v<=1){dx=(b-a)/TERRAIN_STEP;dz=(c-a)/TERRAIN_STEP;height=a+u*(b-a)+v*(c-a);}
    else {dx=(d-c)/TERRAIN_STEP;dz=(d-b)/TERRAIN_STEP;height=d+(1-v)*(b-d)+(1-u)*(c-d);}
  }
  const length=Math.hypot(dx,1,dz);
  out.height=height;out.dx=dx;out.dz=dz;out.nx=-dx/length;out.ny=1/length;out.nz=-dz/length;
  out.grade=Math.hypot(dx,dz);out.traversable=out.grade<=.45;out.surfaceClass='grass';
  return out;
}
const heightSample={};
export function terrainHeight(x,z) { return sampleTerrain(x,z,heightSample).height; }
// Shared initial datum. Accept a descriptor or coordinates so water consumers
// need no point lookup and overlapping bounding disks stay exactly coplanar.
export function lakeSurfaceHeight(_lakeOrX,_z) { return 0; }
export function terrainCacheStats() {
  gate();return {version:TERRAIN_VERSION,vertices:vertexCache.size,tiles:tileCache.size,owners:ownerCache.size};
}

// Split surfaces on the same lattice and diagonal used by terrainHeight.
// Sampling endpoints alone lets a triangle bridge a crease and poke through
// another surface, even when every endpoint has the correct height.
export function drapeTerrainTriangles(vertices, indices) {
  if (terrainEnabled()) {
    const result = [], triangles = [];
    const clip = (polygon, nx, nz, offset) => {
      const out = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        const da = a.x * nx + a.z * nz - offset, db = b.x * nx + b.z * nz - offset;
        if (da <= 0) out.push(a);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
          const t = da / (da - db);
          out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        }
      }
      return out;
    };
    const emit = polygon => {
      for (let i = 1; i + 1 < polygon.length; i++) {
        const a = polygon[0], b = polygon[i], c = polygon[i + 1];
        if (Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)) < 1e-10) continue;
        for (const p of [a,b,c]) {
          triangles.push(result.length / 3);
          result.push(p.x, terrainHeight(p.x,p.z), p.z);
        }
      }
    };
    for (let i = 0; i < indices.length; i += 3) {
      const polygon = indices.slice(i,i+3).map(index => ({ x: vertices[index*3], z: vertices[index*3+2] }));
      const x0 = Math.floor(Math.min(...polygon.map(p=>p.x))/TERRAIN_STEP)*TERRAIN_STEP;
      const x1 = Math.floor(Math.max(...polygon.map(p=>p.x))/TERRAIN_STEP)*TERRAIN_STEP;
      const z0 = Math.floor(Math.min(...polygon.map(p=>p.z))/TERRAIN_STEP)*TERRAIN_STEP;
      const z1 = Math.floor(Math.max(...polygon.map(p=>p.z))/TERRAIN_STEP)*TERRAIN_STEP;
      for (let z = z0; z <= z1; z += TERRAIN_STEP) for (let x = x0; x <= x1; x += TERRAIN_STEP) {
        let cell = clip(polygon,-1,0,-x);
        cell = clip(cell,1,0,x+TERRAIN_STEP);
        cell = clip(cell,0,-1,-z);
        cell = clip(cell,0,1,z+TERRAIN_STEP);
        emit(clip(cell,1,1,x+z+TERRAIN_STEP));
        emit(clip(cell,-1,-1,-x-z-TERRAIN_STEP));
      }
    }
    vertices = result; indices = triangles;
  }
  return {vertices,indices};
}
