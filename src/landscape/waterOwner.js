import {validLandscapeRenderBuffers,finiteRenderBuffer} from './renderBuffers.js';
import * as THREE from 'three';
import { buildStreamWater } from './stream.js';
import { disposeSceneResources } from '../sceneResources.js';
import { roadMaterial } from '../roadMaterials.js';
const box=new THREE.BoxGeometry(1,1,1),wood=new THREE.MeshStandardMaterial({color:0x98734e,roughness:1}),waterMaterial=new THREE.MeshStandardMaterial({color:0x477f9c,roughness:.52});
for(const resource of [box,wood,waterMaterial])resource.userData.shared=true;
const active=new WeakMap();
export function warmLandscapeResources(){roadMaterial('dirt');}
export function buildLandscapeWaterOwner(scene,{stream,bridge,vertexHeight,registry=null,waterPositions=null,roadPositions=null,waterNormals=null,roadNormals=null,roadUvs=null}) {
  const allocation={},start=performance.now();let phaseStart=start;const measured=name=>{allocation[name]=performance.now()-phaseStart;phaseStart=performance.now();};
  if(!stream||!bridge||typeof vertexHeight!=='function')throw new TypeError('Complete water, crossing and ground are required');
  let owners=active.get(scene);if(!owners){owners=new Set();active.set(scene,owners);}if(owners.has(stream.id))throw new Error('Water owner already active');
  if(waterNormals||roadNormals||roadUvs){
    if(!validLandscapeRenderBuffers({roadPositions,waterPositions,roadNormals,waterNormals,roadUvs}))throw new TypeError('Invalid prepared landscape attributes');
  }else for(const values of [waterPositions,roadPositions])if(values!==null&&(!finiteRenderBuffer(values)||values.length%9))throw new TypeError('Invalid bounded landscape render buffer');
  const data=waterPositions?{positions:waterPositions,triangles:waterPositions.length/9}:buildStreamWater(stream,vertexHeight);
  if(!data.triangles)throw new RangeError('Stream has no exposed cut channel');
  const root=new THREE.Group(),pins=new Set(),ownerId=`${stream.id}:water`,b=bridge.bounds;
  let disposed=false,published=false;
  root.name=ownerId;
  const dispose=()=>{if(disposed)return true;if(pins.size)return false;disposed=true;owners.delete(stream.id);registry?.removeChunk(ownerId);root.removeFromParent();disposeSceneResources(root);return true;};
  try {
    measured('validation');
    const wetGeometry=new THREE.BufferGeometry();wetGeometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));if(waterNormals)wetGeometry.setAttribute('normal',new THREE.BufferAttribute(waterNormals,3));else wetGeometry.computeVertexNormals();
    const wetMesh=new THREE.Mesh(wetGeometry,waterMaterial);root.add(wetMesh);
    measured('water-geometry');
    let roadMesh=null;
    if(roadPositions?.length){
      const roadGeometry=new THREE.BufferGeometry(),uvs=roadUvs||new Float32Array(roadPositions.length/3*2);
      if(!roadUvs)for(let i=0,j=0;i<roadPositions.length;i+=3){uvs[j++]=roadPositions[i]/4;uvs[j++]=roadPositions[i+2]/4;}
      roadGeometry.setAttribute('position',new THREE.BufferAttribute(roadPositions,3));roadGeometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));if(roadNormals)roadGeometry.setAttribute('normal',new THREE.BufferAttribute(roadNormals,3));else roadGeometry.computeVertexNormals();
      roadMesh=new THREE.Mesh(roadGeometry,roadMaterial('dirt'));roadMesh.position.y=.04;roadMesh.receiveShadow=true;root.add(roadMesh);
    }
    measured('road-geometry');
    const geometry=new THREE.BufferGeometry(),height=bridge.height;
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([b.minX,height,b.minZ,b.maxX,height,b.minZ,b.minX,height,b.maxZ,b.maxX,height,b.maxZ],3));geometry.setIndex([0,2,1,1,2,3]);geometry.computeVertexNormals();
    const deckMaterial=wood.clone();deckMaterial.userData.shared=false;deckMaterial.polygonOffset=true;deckMaterial.polygonOffsetFactor=-1;deckMaterial.polygonOffsetUnits=-1;
    const deckMesh=new THREE.Mesh(geometry,deckMaterial);root.add(deckMesh);
    measured('deck-geometry');
    const alongZ=b.maxZ-b.minZ>=b.maxX-b.minX,width=alongZ?b.maxX-b.minX:b.maxZ-b.minZ,length=alongZ?b.maxZ-b.minZ:b.maxX-b.minX;
    const count=Math.ceil(length/6)+1,parts=new THREE.InstancedMesh(box,wood,3+count*2),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();let index=0;
    root.add(parts);
    function part(x,y,z,sx,sy,sz){position.set(x,y,z);scale.set(sx,sy,sz);matrix.compose(position,rotation,scale);parts.setMatrixAt(index++,matrix);}
    const cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;
    part(cx,height-.14,cz,b.maxX-b.minX,.28,b.maxZ-b.minZ);
    for(const side of [-1,1]) {
      const across=side*(width/2-.35),x=alongZ?cx+across:cx,z=alongZ?cz:cz+across;
      part(x,height+1.05,z,alongZ?.18:length,.18,alongZ?length:.18);
      for(let i=0;i<count;i++) {
        const along=-length/2+i*length/(count-1),px=alongZ?x:cx+along,pz=alongZ?cz+along:z;
        part(px,height+.5,pz,.25,1.25,.25);
      }
      // The existing broadphase uses circles; overlapping samples cover each
      // continuous rail while exact vertical bounds leave the cut bed separate.
      if(registry)for(let i=0;i<=Math.ceil(length/2.5);i++){
        const along=-length/2+i*length/Math.ceil(length/2.5);
        registry.add({kind:'bridge_rail',position:new THREE.Vector3(alongZ?x:cx+along,height,alongZ?cz+along:z),footprint:.4,
          collider:{radius:1.3,minY:-.28,maxY:1.2,damage:0},chunkKey:ownerId});
      }
    }
    parts.instanceMatrix.needsUpdate=true;
    measured('bridge-parts-and-rails');
    scene.add(root);owners.add(stream.id);published=true;measured('publication');allocation.total=performance.now()-start;
    return Object.freeze({id:ownerId,allocation:Object.freeze(allocation),root,deckMesh,waterMesh:wetMesh,roadMesh,bridge,stream,waterTriangles:data.triangles,
      get disposed(){return disposed;},get pinCount(){return pins.size;},
      pin(mover){if(disposed)throw new Error('Water owner disposed');const token={mover};pins.add(token);let released=false;return()=>{if(!released){pins.delete(token);released=true;}};},dispose});
  } catch(error){if(!published)dispose();throw error;}
}
