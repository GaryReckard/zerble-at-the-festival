#!/usr/bin/env node
// Offline orthographic rasterizer: actual game meshes, no browser/GPU required.
// Rebuild after changing tree geometry: node bin/bake-tree-impostors.mjs
// Verify checked-in assets: node bin/bake-tree-impostors.mjs --check
import * as THREE from 'three';
import {buildTallPine,buildOak,buildBirch} from '../src/models/tree.js';
import {mulberry32} from '../src/rng.js';
import {deflateSync} from 'node:zlib';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const SIZE=1024,CELL=128,COLS=8,SS=2,N=CELL*SS;
const builders=[buildTallPine,buildOak,buildBirch],names=['pine','oak','birch'];
const rgba=new Uint8Array(SIZE*SIZE*4),species=[];
const v=new THREE.Vector3(),normal=new THREE.Vector3(),normalMat=new THREE.Matrix3();
const toSRGB=x=>Math.round(255*(x<=.0031308?x*12.92:1.055*Math.pow(Math.max(0,x),1/2.4)-.055));
const sourceHash=createHash('sha256').update(readFileSync(new URL('../src/models/tree.js',import.meta.url))).digest('hex');
for(let s=0;s<builders.length;s++){
 const model=builders[s](mulberry32(0x54524545+s*131));model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model),center=new THREE.Vector3(0,(bounds.min.y+bounds.max.y)/2,0);
 let radius=0;const triangles=[];
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.color,index=mesh.geometry.index;
  normalMat.getNormalMatrix(mesh.matrixWorld);
  for(let t=0;t<(index?.count??p.count);t+=3){
   const points=[],colors=[];
   for(let j=0;j<3;j++){
    const i=index?index.getX(t+j):t+j;
    v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).sub(center);
    points.push(v.clone());radius=Math.max(radius,v.length());
    const color=mesh.material.color.clone();
    if(c)color.multiply(new THREE.Color(c.getX(i),c.getY(i),c.getZ(i)));
    colors.push(color);
   }
   normal.subVectors(points[1],points[0]).cross(v.subVectors(points[2],points[0])).normalize();
   // Broad hemisphere-like fill. No moving sunlight is baked into the atlas.
   const shade=.76+.24*Math.max(0,normal.y);
   triangles.push({points,colors:colors.map(c=>c.multiplyScalar(shade))});
  }
 });
 const frameSize=radius*2*1.08;
 species.push({name:names[s],centerY:center.y,frameSize,height:bounds.max.y,sourceTriangles:triangles.length});
 for(let e=0;e<4;e++)for(let a=0;a<4;a++){
  const azimuth=a*Math.PI/2,elevation=e*Math.PI/6;
  const direction=new THREE.Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation));
  const right=new THREE.Vector3(Math.cos(azimuth),0,-Math.sin(azimuth));
  const up=new THREE.Vector3().crossVectors(direction,right);
  const color=new Float32Array(N*N*3),depth=new Float32Array(N*N).fill(-Infinity),alpha=new Uint8Array(N*N);
  for(const tri of triangles){
   const q=tri.points.map(p=>[(p.dot(right)/frameSize+.5)*N,(.5-p.dot(up)/frameSize)*N,p.dot(direction)]);
   const [p0,p1,p2]=q;
   const denom=(p1[1]-p2[1])*(p0[0]-p2[0])+(p2[0]-p1[0])*(p0[1]-p2[1]);
   if(Math.abs(denom)<1e-10)continue;
   const minX=Math.max(0,Math.floor(Math.min(...q.map(p=>p[0])))),maxX=Math.min(N-1,Math.ceil(Math.max(...q.map(p=>p[0]))));
   const minY=Math.max(0,Math.floor(Math.min(...q.map(p=>p[1])))),maxY=Math.min(N-1,Math.ceil(Math.max(...q.map(p=>p[1]))));
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const u=((p1[1]-p2[1])*(x+.5-p2[0])+(p2[0]-p1[0])*(y+.5-p2[1]))/denom;
    const w=((p2[1]-p0[1])*(x+.5-p2[0])+(p0[0]-p2[0])*(y+.5-p2[1]))/denom,z=1-u-w;
    if(u<0||w<0||z<0)continue;
    const d=u*p0[2]+w*p1[2]+z*p2[2],k=y*N+x;if(d<=depth[k])continue;
    depth[k]=d;alpha[k]=1;
    for(let ch=0;ch<3;ch++){const key=['r','g','b'][ch];color[k*3+ch]=u*tri.colors[0][key]+w*tri.colors[1][key]+z*tri.colors[2][key];}
   }
  }
  const frame=s*16+e*4+a,ox=frame%COLS*CELL,oy=Math.floor(frame/COLS)*CELL;
  let visible=0,minY=CELL,maxY=-1;
  for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++){
   let count=0;const rgb=[0,0,0];
   for(let dy=0;dy<SS;dy++)for(let dx=0;dx<SS;dx++){
    const k=(y*SS+dy)*N+x*SS+dx;if(!alpha[k])continue;
    count++;for(let ch=0;ch<3;ch++)rgb[ch]+=color[k*3+ch];
   }
   const k=((oy+y)*SIZE+ox+x)*4;
   if(count){visible++;minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(let ch=0;ch<3;ch++)rgba[k+ch]=toSRGB(rgb[ch]/count);rgba[k+3]=Math.round(count/(SS*SS)*255);}
  }
  assert(visible>100,`${names[s]} view ${e}/${a} is empty`);
  assert(minY>1&&maxY<CELL-2,'silhouette must retain transparent tile gutters');
  if(e===0)assert(maxY-minY>75,'ground-level captures retain the tall trunk-to-crown silhouette');
 }
}
// Extend RGB under zero-alpha edge texels for clean bilinear/mip cutouts.
// Alpha remains unchanged, and tile boundaries never sample another species.
for(let frame=0;frame<48;frame++){
 const ox=frame%COLS*CELL,oy=Math.floor(frame/COLS)*CELL;
 for(let pass=0;pass<3;pass++){
  const old=rgba.slice();
  for(let y=1;y<CELL-1;y++)for(let x=1;x<CELL-1;x++){
   const k=((oy+y)*SIZE+ox+x)*4;if(old[k+3]||old[k]||old[k+1]||old[k+2])continue;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const j=((oy+y+dy)*SIZE+ox+x+dx)*4;
    if(old[j]||old[j+1]||old[j+2]){rgba[k]=old[j];rgba[k+1]=old[j+1];rgba[k+2]=old[j+2];break;}
   }
  }
 }
}
function crc32(buf){let crc=0xffffffff;for(const b of buf){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([t,data])),data.length+8);return out;}
const header=Buffer.alloc(13);header.writeUInt32BE(SIZE);header.writeUInt32BE(SIZE,4);header[8]=8;header[9]=6;
const scanlines=Buffer.alloc(SIZE*(SIZE*4+1));
for(let y=0;y<SIZE;y++)Buffer.from(rgba.buffer,y*SIZE*4,SIZE*4).copy(scanlines,y*(SIZE*4+1)+1);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scanlines,{level:9})),chunk('IEND',Buffer.alloc(0))]);
const manifest=`// Generated by node bin/bake-tree-impostors.mjs; do not edit by hand.\n// Actual game tree models, isolated deterministic samples. Capture directions:\n// viewer=(sin(azimuth)*cos(elevation),sin(elevation),cos(azimuth)*cos(elevation)).\n// Image rows run top-down; texture flipY=true makes row0 the upper UV row.\nexport const TREE_ATLAS_SIZE=${SIZE};\nexport const TREE_ATLAS_CELL=${CELL};\nexport const TREE_ATLAS_COLUMNS=${COLS};\nexport const TREE_ATLAS_AZIMUTHS=4;\nexport const TREE_ATLAS_ELEVATIONS=Object.freeze([0,Math.PI/6,Math.PI/3,Math.PI/2]);\nexport const TREE_ATLAS_SOURCE_SHA256='${sourceHash}';\nexport const TREE_ATLAS_SPECIES=Object.freeze(${JSON.stringify(species,null,2)}.map(Object.freeze));\n// frame = species*16 + elevationIndex*4 + azimuthIndex; indices wrap at4.\nexport function treeImpostorFrame(species,elevationIndex,azimuthIndex){return species*16+elevationIndex*4+((azimuthIndex%4)+4)%4;}\n`;
const outputs=[['../assets/textures/tree-impostors.png',png],['../src/treeImpostorViews.js',Buffer.from(manifest)]];
for(const [path,content] of outputs){const url=new URL(path,import.meta.url);if(process.argv.includes('--check'))assert.deepEqual(readFileSync(url),content,`${path} is stale; run node bin/bake-tree-impostors.mjs`);else writeFileSync(url,content);}
console.log(`${process.argv.includes('--check')?'PASS':'Baked'} tree impostors: ${SIZE}², 48 views, ${png.length} PNG bytes; actual pine/oak/birch meshes, all silhouettes padded and nonempty.`);
