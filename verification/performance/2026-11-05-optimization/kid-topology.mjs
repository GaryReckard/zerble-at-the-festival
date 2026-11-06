// Reproduce from the repository root with:
// node verification/performance/2026-11-05-optimization/kid-topology.mjs
// Topology only; no WebGL context, frame timing, visibility or device claim.
import {createHash} from 'node:crypto';
import {buildKid} from './legacy-kid-model.js';

let state=0x504c4348;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
const geometries=new Set(),materials=new Set(),shapes=new Set(),perKid=[];
function geometryHash(g){
  const h=createHash('sha256');
  for(const [name,a] of Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b))){
    h.update(name+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name);
    h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
  }
  if(g.index)h.update(new Uint8Array(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength));
  return h.digest('hex');
}
for(let i=0;i<50;i++){
  const kid=buildKid(random);let meshes=0,triangles=0,casters=0,nodes=0;
  kid.traverse(node=>{
    nodes++;if(!node.isMesh)return;
    meshes++;if(node.castShadow)casters++;
    const g=node.geometry;geometries.add(g);shapes.add(geometryHash(g));
    triangles+=(g.index?.count??g.attributes.position.count)/3;
    for(const m of Array.isArray(node.material)?node.material:[node.material])materials.add(m);
  });
  perKid.push({meshes,triangles,casters,nodes});
}
const sum=key=>perKid.reduce((s,k)=>s+k[key],0);
console.log(JSON.stringify({recipe:'50-kid-topology-v1',seed:0x504c4348,
  scope:'Unculled detailed model topology in Node with real Three.js. Not actual submissions, GPU memory, allocation timing or FPS. Visual gait phase uses the ordinary random draw but does not change topology.',
  children:perKid.length,meshes:sum('meshes'),triangles:sum('triangles'),shadowCasters:sum('casters'),sceneNodes:sum('nodes'),
  geometryObjects:geometries.size,distinctGeometryContents:shapes.size,materialObjects:materials.size,perKid},null,2));
