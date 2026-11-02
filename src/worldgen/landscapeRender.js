import {triangleAttributes} from '../landscape/renderBuffers.js';
// Worker-side render buffers use the same canonical paths and native terrain
// triangles. They contain no Three.js objects or runtime registry state.
import { ribbonTriangles,trimRoadTriangles } from '../roadGeometry.js';
import { drapeTerrainTriangles } from './terrain.js';
import { landscapeToWorld,landscapeToLocal } from './landscapeCandidates.js';
import { buildStreamWater } from '../landscape/stream.js';
export function landscapeRoadPaths(candidate,plan=null) {
  const path=points=>points.map(p=>landscapeToWorld(candidate,p.x,p.z));
  const paths=plan?[{points:plan.mainRoad,width:12},{points:plan.narrowPath,width:5.6},{points:plan.connection.points,width:plan.connection.width},
    ...plan.accessPaths.filter(p=>landscapeToLocal(candidate,p[0].x,p[0].z).z>candidate.plan.shelves.at(-1).maxZ+15).map(points=>({points,width:7}))]:[{points:path(candidate.plan.mainRoad),width:12},{points:path(candidate.plan.narrowPath),width:5.6}];
  return paths;
}
export function buildLandscapeRenderData(candidate,plan,surface) {
  if(!candidate.bridge||!candidate.stream)return {ownerId:candidate.id,roadPositions:new Float32Array(),waterPositions:new Float32Array(),roadNormals:new Float32Array(),waterNormals:new Float32Array(),roadUvs:new Float32Array()};
  const bridge=candidate.bridge,b=bridge.bounds,cutter={bounds:b,points:[{x:b.minX,z:b.minZ},{x:b.maxX,z:b.minZ},{x:b.maxX,z:b.maxZ},{x:b.minX,z:b.maxZ}]},triangles=[];
  for(const road of landscapeRoadPaths(candidate,plan)) {
    if(road.points.length>1024)throw new RangeError('Landscape road vertex limit');
    triangles.push(...trimRoadTriangles(ribbonTriangles(road.points,road.width,5),[cutter]));
    if(triangles.length>10000)throw new RangeError('Landscape road triangle limit');
  }
  const vertices=[],indices=[];
  for(const triangle of triangles)for(const p of triangle){indices.push(indices.length);vertices.push(p.x,0,p.z);}
  const draped=drapeTerrainTriangles(vertices,indices);
  if(draped.vertices.length>20000*9)throw new RangeError('Draped landscape road limit');
  const water=buildStreamWater(candidate.stream,(x,z)=>surface.sampleTerrain(x,z,{}).height);
  const roadPositions=new Float32Array(draped.vertices),road=triangleAttributes(roadPositions,{uv:true}),wet=triangleAttributes(water.positions);
  return {ownerId:candidate.id,roadPositions,waterPositions:water.positions,roadNormals:road.normals,roadUvs:road.uvs,waterNormals:wet.normals};
}
