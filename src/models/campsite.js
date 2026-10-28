// Campsite props — small, low-poly camping gear used in two places:
//   1. Forest clearings whose interior content is 'campsite' (most forests)
//   2. Lakeside spots picked by the lake manager
//
// Each builder returns a THREE.Group anchored at (0,0,0) so the caller sets
// position + rotation. Builders take a deterministic `rng` so layouts are
// stable across chunk reloads.
//
// Animated bits (firepit flicker, tiki torch flame, tapestry sway) expose
// their state via the returned object so a central updater can advance them
// each frame. To keep this file allocation-cheap on chunk load, all
// "lookup palette" arrays and shared materials are pre-built at module load.
//
// Builders here are intentionally lower-poly than the festival's main props.
// A campsite is a vignette, not a focus — we want the player to immediately
// recognise the silhouette ("oh, a campsite") without burning draw calls.

import * as THREE from 'three';
import { PERF } from '../perf.js';
import { register as registerContextLight } from '../contextLights.js';
import { planCampRecipe } from '../campPlanning.js';
import { buildCampChair } from './campChair.js';
export { buildCampChair } from './campChair.js';

// ---------- Shared palettes ----------

// Campsite shells stay earthy, but give each shelter a clear fabric color so
// clearings read as lived-in camps instead of a row of gray-green tents.
const TENT_COLORS = [0xb76f5c, 0x568f83, 0xc09d4e, 0x6483a6, 0x8c6f99, 0x718957];
const CHAIR_COLORS = [0xc44a4a, 0x3b7fbe, 0x4f9c4f, 0xd4c177, 0xb86bc7, 0x444b55];
const EZUP_COLORS = [0xd86b3a, 0x3a82c0, 0x4ea15a, 0xc7385c];
const TAPESTRY_COLORS = [
  // (primary, secondary) pairs that read as "patterned fabric" even with
  // only flat shading — pick high-saturation pairs so they pop in the woods.
  [0xc23a4a, 0xf2c97a],
  [0x4a5fc7, 0xf28a3a],
  [0x6c3a8a, 0xf5e0a8],
  [0x357a3a, 0xd9a04a],
  [0xc04875, 0x3a7095],
];

// ---------- Shared materials ----------
// Materials pool by hex so building 50 tents doesn't allocate 50 materials
// for the same green. Local cache keyed on hex.
const _matCache = new Map();
function matFor(hex, opts = {}) {
  const key = `${hex.toString(16)}|${opts.emissive || 0}|${opts.roughness || 0.95}`;
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: opts.roughness ?? 0.95,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      flatShading: true,
      side: opts.side ?? THREE.FrontSide,
    });
    // Mark shared so chunk-unload disposal walks skip these — the cache
    // outlives any single chunk and re-uses materials across forests / lakes.
    m.userData.shared = true;
    _matCache.set(key, m);
  }
  return m;
}

const WOOD_MAT = matFor(0x6a4a2a);
const DARK_WOOD_MAT = matFor(0x4a2f1c);
const POLE_MAT = matFor(0x5a3f24);
const FABRIC_NEUTRAL_MAT = matFor(0xe6dfc8);

// ---------- Camp tent (A-frame) ----------
//
// Triangular-prism sleeping tent. Two triangles for the gable ends + two
// rectangles for the sloped sides + one floor rectangle. Total: 5 quads
// (10 triangles) plus an optional "vestibule" flap at the front.
//
// Size: 2.2m wide × 1.7m tall × 2.5m deep — fits two campers.

const _TENT_POLE_GEOMETRY=new THREE.CylinderGeometry(1,1,1,6);
_TENT_POLE_GEOMETRY.userData.shared=true;
function addTentPoles(group,segments) {
  const poles=new THREE.InstancedMesh(_TENT_POLE_GEOMETRY,matFor(0xc8c9b7,{roughness:.55}),segments.length);
  const up=new THREE.Vector3(0,1,0),matrix=new THREE.Matrix4();
  segments.forEach(([a,b],i)=>{
    const direction=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),length=direction.length();
    const rotation=new THREE.Quaternion().setFromUnitVectors(up,direction.normalize());
    matrix.compose(new THREE.Vector3((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2),rotation,new THREE.Vector3(.016,length,.016));
    poles.setMatrixAt(i,matrix);
  });
  poles.instanceMatrix.needsUpdate=true;group.add(poles);
}

export function buildCampTent(rng = Math.random, options = {}) {
  const group = new THREE.Group();
  const color = TENT_COLORS[Math.floor(rng() * TENT_COLORS.length)];
  const fabric = matFor(color);
  const family=options.family||'ridge';
  if(family!=='ridge') {
    // Every shelter consumes the historical colour + vestibule pair, while
    // family topology and dimensions use only the independent variation value.
    const vestibule=rng()<.55;
    return buildTentFamily(group,color,fabric,family,options.variation??.5,vestibule);
  }

  const w = 2.2, h = 1.7, d = 2.5;

  // Build geometry from explicit vertices so we get the A-frame shape exactly.
  // Local frame: x = side-to-side, y = up, z = front-to-back (door at +z).
  const verts = [];
  const indices = [];

  // 6 corner-ish points:
  // 0: ridge front, 1: ridge back
  // 2: front-left base, 3: front-right base
  // 4: back-left base,  5: back-right base
  verts.push(0,  h,  d/2);   // 0
  verts.push(0,  h, -d/2);   // 1
  verts.push(-w/2, 0,  d/2); // 2
  verts.push( w/2, 0,  d/2); // 3
  verts.push(-w/2, 0, -d/2); // 4
  verts.push( w/2, 0, -d/2); // 5

  // Sloped sides
  indices.push(0, 1, 4, 0, 4, 2);  // left slope
  indices.push(0, 3, 1, 1, 3, 5);  // right slope
  // Gable ends
  indices.push(0, 2, 3);            // front gable
  indices.push(1, 5, 4);            // back gable
  // Floor (so the dark interior doesn't show through at low angles)
  indices.push(2, 4, 3, 3, 4, 5);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const tent = new THREE.Mesh(geo, fabric);
  tent.castShadow = true;
  tent.receiveShadow = true;
  group.add(tent);

  // Optional small vestibule flap — a triangle sticking out from the front
  // gable. Picks 50% of the time per rng.
  const vestibule=rng()<.55;
  if (vestibule) {
    const flapVerts = [
      0,  h,  d/2,
      -w/3, 0, d/2 + 0.7,
       w/3, 0, d/2 + 0.7,
    ];
    const flapGeo = new THREE.BufferGeometry();
    flapGeo.setAttribute('position', new THREE.Float32BufferAttribute(flapVerts, 3));
    flapGeo.setIndex([0, 1, 2, 0, 2, 1]); // double-sided
    flapGeo.computeVertexNormals();
    const flap = new THREE.Mesh(flapGeo, fabric);
    // Tent flap is small; the parent tent already casts a clean shadow.
    group.add(flap);
  }

  addTentPoles(group,[[[-w/2,.02,d/2],[0,h+.01,d/2]],[[0,h+.01,d/2],[w/2,.02,d/2]],[[0,h+.01,d/2],[0,h+.01,-d/2]]]);
  const door=buildTentDoor(group,{family:'ridge',width:.9,height:1.18,bottom:.04,surfaceZ:()=>d/2+.004});
  const shelter={radius:(vestibule?Math.hypot(w/3,d/2+.7):Math.hypot(w/2,d/2))+.02,doorReach:vestibule?2.6:2.25,width:w,depth:d+(vestibule?.7:0),height:h,capacity:2,
    doorZ:d/2+.015,bounds:[{x:0,z:0,halfWidth:w/2,halfDepth:d/2},...(vestibule?[{x:0,z:d/2+.35,halfWidth:w/3,halfDepth:.35}]:[])]};
  return { group,color,family:'ridge',footprint:shelter.radius,shelter,door,entrance:{x:0,z:shelter.doorReach} };
}

// Door cloth and zipper strips share the shelter surface. The dome sampler
// intersects its actual faceted mesh, avoiding a flat sign floating in front.
function tentMeshFrontZ(mesh,x,y,fallback) {
  const position=mesh.geometry.attributes?.position?.array,index=mesh.geometry.index?.array;
  if(!position||!index)return fallback(x,y);
  let front=-Infinity;
  const sx=mesh.scale.x,sy=mesh.scale.y,sz=mesh.scale.z;
  for(let i=0;i<index.length;i+=3) {
    const ids=[index[i]*3,index[i+1]*3,index[i+2]*3];
    const ax=position[ids[0]]*sx,ay=position[ids[0]+1]*sy,bx=position[ids[1]]*sx,by=position[ids[1]+1]*sy,cx=position[ids[2]]*sx,cy=position[ids[2]+1]*sy;
    const determinant=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
    if(Math.abs(determinant)<1e-10)continue;
    const a=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/determinant,b=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/determinant,c=1-a-b;
    if(a< -1e-6||b< -1e-6||c< -1e-6)continue;
    front=Math.max(front,(a*position[ids[0]+2]+b*position[ids[1]+2]+c*position[ids[2]+2])*sz);
  }
  return Number.isFinite(front)?front:fallback(x,y);
}
function clipDoorToShell(mesh,outline,offset=.004) {
  const positions=mesh.geometry.attributes?.position?.array,index=mesh.geometry.index?.array;
  if(!positions||!index)return null;
  const winding=outline.reduce((sum,p,i)=>{const next=outline[(i+1)%outline.length];return sum+p[0]*next[1]-next[0]*p[1];},0)>=0?1:-1;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const [x,y] of outline){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  const vertices=[],sx=mesh.scale.x,sy=mesh.scale.y,sz=mesh.scale.z;
  for(let i=0;i<index.length;i+=3) {
    const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3;
    const ax=positions[a]*sx,bx=positions[b]*sx,cx=positions[c]*sx;
    if(Math.max(ax,bx,cx)<minX-1e-6||Math.min(ax,bx,cx)>maxX+1e-6)continue;
    const ay=positions[a+1]*sy,by=positions[b+1]*sy,cy=positions[c+1]*sy;
    if(Math.max(ay,by,cy)<minY-1e-6||Math.min(ay,by,cy)>maxY+1e-6)continue;
    const az=positions[a+2]*sz,bz=positions[b+2]*sz,cz=positions[c+2]*sz;
    if(az<=0&&bz<=0&&cz<=0)continue;
    // Reject disjoint facets before allocating polygon vertices and clipping
    // buffers, especially for the narrow zipper strips and silhouette poses.
    let polygon=[{x:ax,y:ay,z:az},{x:bx,y:by,z:bz},{x:cx,y:cy,z:cz}];
    for(let edge=0;edge<outline.length&&polygon.length;edge++) {
      const a=outline[edge],b=outline[(edge+1)%outline.length],cross=p=>winding*((b[0]-a[0])*(p.y-a[1])-(b[1]-a[1])*(p.x-a[0]));
      const clipped=[];
      for(let j=0;j<polygon.length;j++) {
        const p=polygon[j],q=polygon[(j+1)%polygon.length],cp=cross(p),cq=cross(q),insideP=cp>=-1e-8,insideQ=cq>=-1e-8;
        if(insideP)clipped.push(p);
        if(insideP!==insideQ){const t=cp/(cp-cq);clipped.push({x:p.x+t*(q.x-p.x),y:p.y+t*(q.y-p.y),z:p.z+t*(q.z-p.z)});}
      }
      polygon=clipped;
    }
    for(let j=1;j+1<polygon.length;j++)for(const point of [polygon[0],polygon[j],polygon[j+1]])vertices.push(point.x,point.y,point.z+offset);
  }
  return vertices;
}
function buildTentDoor(group,{family,width,height,bottom,surfaceZ,surfaceMesh}) {
  const outline=[];
  if(family==='ridge')outline.push([-width/2,bottom],[0,bottom+height],[width/2,bottom]);
  else {
    // The straight left side is the hinge; two quadratic curves form the D zip.
    outline.push([-width/2,bottom],[-width/2,bottom+height]);
    const curve=(a,b,c)=>{for(let i=1;i<=12;i++){const t=i/12,u=1-t;outline.push([u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]);}};
    curve([-width/2,bottom+height],[width/2,bottom+height],[width/2,bottom+height/2]);
    curve([width/2,bottom+height/2],[width/2,bottom],[-width/2,bottom]);
    outline.pop();
  }
  const vertices=[],indices=[],zipVertices=[],zipIndices=[];
  const centre=[-width*.06,bottom+height*.48];
  vertices.push(centre[0],centre[1],surfaceZ(...centre));
  outline.forEach(([x,y])=>vertices.push(x,y,surfaceZ(x,y)));
  for(let i=0;i<outline.length;i++)indices.push(0,1+(i+1)%outline.length,i+1);
  outline.forEach(([x,y],i)=>{
    const dx=x-centre[0],dy=y-centre[1],length=Math.hypot(dx,dy),inset=.012;
    for(const direction of [-1,1]) {const px=x+direction*dx/length*inset,py=y+direction*dy/length*inset;zipVertices.push(px,py,surfaceZ(px,py)+.003);}
    const j=(i+1)%outline.length;zipIndices.push(i*2,j*2,i*2+1,i*2+1,j*2,j*2+1);
  });
  const clipped=surfaceMesh?clipDoorToShell(surfaceMesh,outline):null;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(clipped||vertices,3));geometry.setIndex(clipped?Array.from({length:clipped.length/3},(_,i)=>i):indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,matFor(0xb1b49c));mesh.name='tent-fabric-door';group.add(mesh);
  let clippedZip=null;
  if(surfaceMesh&&clipped){clippedZip=[];for(let i=0;i<outline.length;i++){
    const j=(i+1)%outline.length,point=k=>[zipVertices[k*3],zipVertices[k*3+1]];
    clippedZip.push(...clipDoorToShell(surfaceMesh,[point(i*2),point(j*2),point(j*2+1),point(i*2+1)],.007));
  }}
  const zipperGeometry=new THREE.BufferGeometry();zipperGeometry.setAttribute('position',new THREE.Float32BufferAttribute(clippedZip||zipVertices,3));zipperGeometry.setIndex(clippedZip?Array.from({length:clippedZip.length/3},(_,i)=>i):zipIndices);zipperGeometry.computeVertexNormals();
  const zipper=new THREE.Mesh(zipperGeometry,matFor(0x586255));zipper.name='tent-door-zipper';group.add(zipper);
  if(family==='ridge') {
    // Split triangular fabric flaps meet along a visible central zip.
    const split=new THREE.BufferGeometry();split.setAttribute('position',new THREE.Float32BufferAttribute([-.008,bottom,surfaceZ(0,bottom)+.003,.008,bottom,surfaceZ(0,bottom)+.003,0,bottom+height,surfaceZ(0,bottom+height)+.003],3));split.setIndex([0,1,2]);split.computeVertexNormals();group.add(new THREE.Mesh(split,matFor(0x586255)));
  }
  return {kind:family==='ridge'?'split-triangle':'curved-d',hinge:family==='ridge'?'centre':'left',mesh,zipper,outline,width,height,bottom,surfaceZ,surfaceMesh,surfaceConforming:!!clipped};
}

// Family shells have different load-bearing silhouettes: dome ribs, a high
// octagonal lodge, upright cabin walls, or a connected side sleeping room.
function buildTentFamily(group,color,fabric,family,variation,vestibule) {
  const v=THREE.MathUtils.clamp(variation,0,1), scale=.94+v*.12;
  const add=(geometry,material,x,y,z,shadow=true)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const roofMaterial=matFor([0xd39a61,0x78986f,0x7488b0][Math.min(2,Math.floor(v*3))]);
  let radius,width,depth,height,doorZ,capacity,bounds,doorSurface,doorSurfaceMesh;
  const poles=[];
  const shell=(w,d,eave,x=0,z=0)=>{
    const hx=w/2,hz=d/2,cut=.18*scale;
    const outline=[[-hx+cut,hz],[hx-cut,hz],[hx,hz-cut],[hx,-hz+cut],[hx-cut,-hz],[-hx+cut,-hz],[-hx,-hz+cut],[-hx,hz-cut]];
    const vertices=[],indices=[];
    outline.forEach(([px,pz])=>vertices.push(px,0,pz));outline.forEach(([px,pz])=>vertices.push(px*.93,eave,pz*.93));
    for(let i=0;i<8;i++){const j=(i+1)%8;indices.push(i,j,i+8,j,j+8,i+8);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
    return add(g,fabric,x,0,z);
  };

  const roof=(w,d,base,peak,x=0,z=0)=>{
    const section=[[-w/2,base],[-w*.28,base+(peak-base)*.72],[0,peak],[w*.28,base+(peak-base)*.72],[w/2,base]];
    const vertices=[],indices=[];
    for(const zz of [d/2,-d/2])for(const [xx,yy]of section)vertices.push(xx,yy,zz);
    for(let i=0;i<4;i++)indices.push(i,i+1,i+5,i+1,i+6,i+5);
    // Softly faceted end fabric closes the fly without a house-like gable wall.
    for(let i=1;i<4;i++){indices.push(0,i+1,i,5,5+i,5+i+1);}
    // Rainfly valances overlap the tapered wall tops instead of leaving a
    // daylight slit below an otherwise closed front/back gable.
    vertices.push(-w/2,Math.max(.02,base-.16),d/2,w/2,Math.max(.02,base-.16),d/2,-w/2,Math.max(.02,base-.16),-d/2,w/2,Math.max(.02,base-.16),-d/2);
    indices.push(10,11,0,11,4,0,12,5,13,13,5,9);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
    for(const zz of [d/2,-d/2])for(let i=0;i<4;i++)poles.push([[x+section[i][0],section[i][1]+.015,z+zz],[x+section[i+1][0],section[i+1][1]+.015,z+zz]]);
    return add(g,roofMaterial,x,0,z);
  };
  if(family==='octagon') {
    radius=1.78*scale;width=depth=radius*2;height=2.35*scale;capacity=5;
    const wall=add(new THREE.CylinderGeometry(1.7*scale,1.7*scale,1.45*scale,8),fabric,0,.725*scale,0);
    wall.rotation.y=Math.PI/8;
    const peak=add(new THREE.ConeGeometry(radius,.9*scale,8),roofMaterial,0,1.9*scale,0);peak.rotation.y=Math.PI/8;
    doorZ=1.7*scale*Math.cos(Math.PI/8)+.004;
    doorSurface=()=>doorZ;
    add(new THREE.CylinderGeometry(1.707*scale,1.707*scale,.17*scale,8),matFor(0x343e37),0,.085*scale,0,false).rotation.y=Math.PI/8;
    for(let i=0;i<8;i++) {
      const a=Math.PI/8+i*Math.PI/4,px=Math.sin(a)*1.69*scale,pz=Math.cos(a)*1.69*scale;
      poles.push([[px,.04,pz],[px,1.45*scale,pz]],[[px,1.45*scale,pz],[0,2.34*scale,0]]);
    }
    bounds=[{x:0,z:0,radius}];
  } else if(family==='dome') {
    radius=1.58*scale;width=depth=radius*2;height=1.65*scale;capacity=2;
    const dome=add(new THREE.SphereGeometry(radius,12,6,0,Math.PI*2,0,Math.PI/2),fabric,0,0,0);
    dome.scale.y=height/radius;doorSurfaceMesh=dome;
    add(new THREE.CylinderGeometry(radius*.998+.006,radius+.006,.14*scale,12),matFor(0x333f38),0,.07*scale,0,false);
    for(const axis of [Math.PI/4,-Math.PI/4])for(let i=0;i<10;i++){
      const point=t=>[Math.cos(t)*radius*.99*Math.cos(axis),Math.sin(t)*height+.012,Math.cos(t)*radius*.99*Math.sin(axis)];
      poles.push([point(i*Math.PI/10),point((i+1)*Math.PI/10)]);
    }
    // A real vestibule projects from the curved dome instead of recolouring it.
    add(new THREE.BoxGeometry(1.15*scale,.025,.65*scale),matFor(0x626c59),0,.0125,radius*.85,false);
    doorZ=radius*.94;
    const domeRadius=radius,domeHeight=height;
    doorSurface=(x,y)=>tentMeshFrontZ(dome,x,y,(px,py)=>domeRadius*Math.sqrt(Math.max(0,1-(px/domeRadius)**2-(py/domeHeight)**2)))+.004;
    bounds=[{x:0,z:0,radius}];
  } else {
    family=family==='multiroom'?'multiroom':'cabin';
    width=2.5*scale;depth=2.5*scale;height=2.08*scale;capacity=family==='multiroom'?6:4;
    shell(width,depth,1.62*scale);
    add(new THREE.BoxGeometry(width,.16*scale,depth),matFor(0x343c35),0,.08*scale,0,false);
    roof(width+.08,depth+.12,1.62*scale,height);
    bounds=[{x:0,z:0,halfWidth:width/2+.04,halfDepth:depth/2+.06}];
    if(family==='multiroom') {
      const wx=1.25*scale,ww=1.3*scale,wd=1.9*scale;
      shell(ww,wd,1.28*scale,wx,-.08*scale);
      add(new THREE.BoxGeometry(ww,.16*scale,wd),matFor(0x343c35),wx,.08*scale,-.08*scale,false);
      roof(ww+.08,wd+.1,1.28*scale,1.78*scale,wx,-.08*scale);
      bounds.push({x:wx,z:-.08*scale,halfWidth:ww/2+.04,halfDepth:wd/2+.05});
    }
    radius=Math.max(...bounds.map(b=>Math.hypot(Math.abs(b.x)+b.halfWidth,Math.abs(b.z)+b.halfDepth)));
    doorZ=depth/2+.004;
    const frontDepth=depth;
    doorSurface=(x,y)=>frontDepth/2*(1-.07*y/(1.62*scale))+.004;
    for(const side of [-1,1])poles.push([[side*width/2,.02,depth/2],[side*width*.465,1.62*scale,depth*.465]],[[side*width/2,.02,-depth/2],[side*width*.465,1.62*scale,-depth*.465]]);

  }
  if(family==='dome') {
    radius=Math.max(radius,Math.hypot(.575*scale,1.58*scale*.85+.325*scale));
    bounds.push({x:0,z:1.58*scale*.85,halfWidth:.575*scale,halfDepth:.325*scale});
  }
  radius+=.02;
  const minX=Math.min(...bounds.map(b=>(b.x||0)-(b.radius??b.halfWidth))),maxX=Math.max(...bounds.map(b=>(b.x||0)+(b.radius??b.halfWidth)));
  const minZ=Math.min(...bounds.map(b=>(b.z||0)-(b.radius??b.halfDepth))),maxZ=Math.max(...bounds.map(b=>(b.z||0)+(b.radius??b.halfDepth)));
  width=maxX-minX;depth=maxZ-minZ;
  const door=buildTentDoor(group,{family,width:.8*scale,height:Math.min(1.28*scale,height*.72),bottom:.05*scale,surfaceZ:doorSurface,surfaceMesh:doorSurfaceMesh});
  if(poles.length)addTentPoles(group,poles);
  const shelter={radius,doorReach:Math.max(radius+.65,doorZ+.65),width,depth,height,capacity,doorZ,bounds};
  return {group,color,family,variation:v,footprint:radius,shelter,door,entrance:{x:0,z:shelter.doorReach}};
}

// ---------- Camp chair (folding) ----------
// Shared chair styles live in campChair.js and are re-exported above.

// ---------- Chiminea (or ring firepit) ----------
//
// Two variants picked deterministically: a teardrop chiminea (clay bulb +
// chimney) or a low ring firepit (stones + embers). Both expose an
// `emissive` material so a central updater can pulse them with nightness.

export function buildChiminea(rng = Math.random) {
  const group = new THREE.Group();

  // Per-instance emissive material (NOT pooled — each chiminea pulses on
  // its own rng offset so they don't sync up).
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff7733,
    emissive: 0xff5511,
    emissiveIntensity: 1.5,
    roughness: 0.7,
    flatShading: true,
  });
  const phase = rng() * Math.PI * 2;

  if (rng() < 0.5) {
    // ----- Teardrop chiminea -----
    const clay = matFor(0x6a3a26);

    // Base bulb (sphere flattened slightly)
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 12, 10),
      clay,
    );
    bulb.scale.set(1, 0.85, 1);
    bulb.position.y = 0.38;
    // Chiminea body — emissive interior is the main visual; skip shadow
    // map render (curved shape doesn't read distinctly in shadow anyway).
    group.add(bulb);

    // Chimney stack — narrowing cone
    const stack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.22, 0.55, 8),
      clay,
    );
    stack.position.y = 0.85;
    group.add(stack);

    // Glowing opening — small disk facing forward
    const opening = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 12),
      emberMat,
    );
    opening.position.set(0, 0.36, 0.36);
    group.add(opening);
    // Tiny stand legs (3 short feet)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.15, 6),
        DARK_WOOD_MAT,
      );
      foot.position.set(Math.cos(a) * 0.18, 0.075, Math.sin(a) * 0.18);
      group.add(foot);
    }

    return { group, kind: 'chiminea', emberMat, phase, footprint: 0.7 };
  }

  // ----- Ring firepit -----
  const stoneMat = matFor(0x7a7785, { roughness: 1.0 });
  const ringR = 0.55;
  const stoneCount = 8;
  for (let i = 0; i < stoneCount; i++) {
    const a = (i / stoneCount) * Math.PI * 2;
    const stone = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18 + rng() * 0.08, 0),
      stoneMat,
    );
    stone.position.set(Math.cos(a) * ringR, 0.13, Math.sin(a) * ringR);
    stone.rotation.y = rng() * Math.PI * 2;
    // Firepit stones — tiny, irregular; shadow contribution is invisible.
    group.add(stone);
  }

  // Inner ember cluster — a few flat-shaded log nubs glowing
  const logMat = matFor(0x2a1a10, { roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.3;
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.45, 6),
      logMat,
    );
    log.position.set(Math.cos(a) * 0.15, 0.07, Math.sin(a) * 0.15);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = a;
    group.add(log);
  }

  const embers = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.20, 1),
    emberMat,
  );
  embers.position.y = 0.10;
  group.add(embers);

  const fireFlame = new THREE.Mesh(_TORCH_FLAME_GEO, emberMat);
  fireFlame.position.y=.38;
  fireFlame.scale.set(1.8,1.4,1.8);
  group.add(fireFlame);
  return { group, kind: 'firepit', emberMat, fireFlame, phase, footprint: 0.7 };
}

// ---------- Tiki torch ----------
//
// Bamboo pole + flame tuft. Flame is emissive and animated separately
// (caller bobs the scale or material on a timer).

// Torch component geometries — every tiki torch in the world shares the
// same buffer for poles / joints / cups. Was creating 5 fresh
// CylinderGeometry buffers per torch (4 torches × 10+ visible campsites
// = ~200 redundant geos).
const _TORCH_POLE_GEO  = new THREE.CylinderGeometry(0.04, 0.04, 1.7, 6);
const _TORCH_JOINT_GEO = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 6);
const _TORCH_CUP_GEO   = new THREE.CylinderGeometry(0.10, 0.08, 0.12, 8);
const _TORCH_FLAME_GEO = new THREE.ConeGeometry(0.10, 0.32, 8);
for (const g of [_TORCH_POLE_GEO, _TORCH_JOINT_GEO, _TORCH_CUP_GEO, _TORCH_FLAME_GEO]) {
  g.userData.shared = true;
}

export function buildTikiTorch(rng = Math.random, scale = TIKI_TORCH_SCALE) {
  const group = new THREE.Group();

  const pole = new THREE.Mesh(_TORCH_POLE_GEO, matFor(0xa37a3a));
  pole.position.y = 0.85;
  // Tiki torch pole — 4cm thin bamboo, shadow contribution invisible.
  group.add(pole);

  // Two thin "joint" rings on the bamboo for visual interest
  for (const y of [0.50, 1.10]) {
    const joint = new THREE.Mesh(_TORCH_JOINT_GEO, matFor(0x6a4a1a));
    joint.position.y = y;
    group.add(joint);
  }

  // Reservoir cup at the top
  const cup = new THREE.Mesh(_TORCH_CUP_GEO, matFor(0x4a3018));
  cup.position.y = 1.78;
  group.add(cup);

  // Flame — emissive teardrop. Phase + flame material are per-torch (each
  // flame flickers independently via emissive/opacity animation in the
  // central updater); geometry is shared.
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffb04a,
    emissive: 0xff5a1a,
    emissiveIntensity: 2.0,
    roughness: 0.4,
    transparent: true,
    opacity: 0.95,
  });
  const flame = new THREE.Mesh(_TORCH_FLAME_GEO, flameMat);
  flame.position.y = 2.0;
  group.add(flame);
  const phase = rng() * Math.PI * 2;

  // Fancy-lights opt-in: real PointLight at the flame. Stays off if the
  // user hasn't opted in via the backtick menu. Animatable so the
  // central updater can dim it during the day.
  let flameLight = null;
  if (PERF.fancyLights) {
    flameLight = new THREE.PointLight(0xff8830, 0, 3.5, 1.5);
    flameLight.position.y = 2.0;
    flameLight.castShadow = false;
    group.add(flameLight);
    registerContextLight(flameLight);
  }

  group.scale.setScalar(scale);

  return { group, flame, flameMat, flameLight, phase, footprint: 0.25 * scale };
}

// Build a cluster of tiki torches as ONE group, collapsing the static parts
// (pole + 2 joints + cup) of every torch into 3 InstancedMesh — so a campsite
// with 4 torches draws 3 calls for the woodwork instead of 16. The flames stay
// per-torch Meshes because each one animates its own emissive / opacity / scale
// (an instanced flame would need a per-instance shader patch for that). Per the
// threejs-geometry skill's "InstancedMesh for many identical objects."
//
// `positions` is an array of { x, z } in the parent group's local space, and
// optionally a `phase` per entry. If `phase` is supplied (forest path lanterns,
// which interleave their own rng draws), it's used verbatim and NO rng is
// consumed here; if omitted (campsites), a phase is drawn from `rng` per torch
// in array order. Either way the draw order matches the old per-torch loop, so
// existing worlds regenerate identically.
export function buildTorchField(positions, rng = Math.random, scale = TIKI_TORCH_SCALE) {
  const group = new THREE.Group();
  const animatables = [];
  const n = positions.length;
  if (n === 0) return { group, animatables };

  // Static woodwork → one InstancedMesh per part. Poles + cups are 1 per
  // torch; the bamboo gets 2 joint rings each.
  const poleInst  = new THREE.InstancedMesh(_TORCH_POLE_GEO,  matFor(0xa37a3a), n);
  const jointInst = new THREE.InstancedMesh(_TORCH_JOINT_GEO, matFor(0x6a4a1a), n * 2);
  const cupInst   = new THREE.InstancedMesh(_TORCH_CUP_GEO,   matFor(0x4a3018), n);
  // Thin bamboo detail — shadow contribution is invisible (matches the
  // per-mesh torch, which skipped castShadow too).
  poleInst.castShadow = jointInst.castShadow = cupInst.castShadow = false;

  // The torch positions are baked into the instance matrices in the parent's
  // coordinate space (often world space for stage/court/forest fields), so the
  // size scale must ride in the matrix itself — scaling the GROUP would also
  // scale the positions and fling the torches away from origin. makeScale then
  // setPosition gives translate(pos) · scale(s), so each torch grows in place;
  // the per-torch heights scale with it.
  const m = new THREE.Matrix4();
  const s = scale;
  for (let i = 0; i < n; i++) {
    const { x, y = 0, z } = positions[i];
    m.makeScale(s, s, s); m.setPosition(x, y + 0.85 * s, z); poleInst.setMatrixAt(i, m);
    m.setPosition(x, y + 0.50 * s, z); jointInst.setMatrixAt(i * 2, m);
    m.setPosition(x, y + 1.10 * s, z); jointInst.setMatrixAt(i * 2 + 1, m);
    m.setPosition(x, y + 1.78 * s, z); cupInst.setMatrixAt(i, m);
  }
  poleInst.instanceMatrix.needsUpdate = true;
  jointInst.instanceMatrix.needsUpdate = true;
  cupInst.instanceMatrix.needsUpdate = true;
  group.add(poleInst, jointInst, cupInst);

  // Per-torch flame (+ optional fancy-light), animated independently.
  for (let i = 0; i < n; i++) {
    const { x, y = 0, z } = positions[i];
    const phase = positions[i].phase ?? (rng() * Math.PI * 2);
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffb04a,
      emissive: 0xff5a1a,
      emissiveIntensity: 2.0,
      roughness: 0.4,
      transparent: true,
      opacity: 0.95,
    });
    const flame = new THREE.Mesh(_TORCH_FLAME_GEO, flameMat);
    flame.position.set(x, y + 2.0 * s, z);
    flame.scale.setScalar(s);
    group.add(flame);

    let flameLight = null;
    if (PERF.fancyLights) {
      flameLight = new THREE.PointLight(0xff8830, 0, 3.5, 1.5);
      flameLight.position.set(x, y + 2.0 * s, z);
      flameLight.castShadow = false;
      group.add(flameLight);
      registerContextLight(flameLight);
    }
    // baseScale lets the central updater's flame bob scale relative to the
    // torch size instead of snapping scale.y back to native.
    animatables.push({ flame, flameMat, flameLight, phase, baseScale: s });
  }

  return { group, animatables };
}

// ---------- EZ-up canopy ----------
//
// Square fabric roof on 4 corner poles, slight peak in the middle. 3m × 3m
// × 2.4m tall.

export function buildEzUp(rng = Math.random) {
  const group = new THREE.Group();
  const color = EZUP_COLORS[Math.floor(rng() * EZUP_COLORS.length)];
  const fabric = matFor(color);
  const post = matFor(0x222626, { roughness: 0.4 });

  const size = 3.0;
  const height = 2.4;
  const half = size / 2;

  // 4 corner posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, height, 6),
        post,
      );
      p.position.set(sx * half, height / 2, sz * half);
      group.add(p);
    }
  }

  // Roof — a square pyramid: 4 triangles meeting at a center apex
  const apexY = height + 0.35;
  const verts = [
    // 4 corners at the post tops
    -half, height, -half,   // 0  NW
     half, height, -half,   // 1  NE
     half, height,  half,   // 2  SE
    -half, height,  half,   // 3  SW
     0,    apexY,   0,      // 4  apex
  ];
  const indices = [
    0, 4, 1,   // back
    1, 4, 2,   // right
    2, 4, 3,   // front
    3, 4, 0,   // left
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const roof = new THREE.Mesh(geo, fabric);
  roof.castShadow = true;
  group.add(roof);

  // Add a small fabric skirt drop along one edge for character — picks 60% of the time
  if (rng() < 0.6) {
    const skirt = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 0.95, 0.3),
      fabric,
    );
    skirt.material = new THREE.MeshStandardMaterial({
      color, roughness: 0.95, flatShading: true, side: THREE.DoubleSide,
    });
    skirt.position.set(0, height - 0.15, -half);
    group.add(skirt);
  }

  return { group, color, footprint: 2.0 };
}

// ---------- Tapestry ----------
//
// A square of patterned fabric strung between two short posts. Uses a
// canvas-baked texture so the pattern reads even at low light.

export function buildTapestry(rng = Math.random) {
  const group = new THREE.Group();

  const w = 1.8 + rng() * 0.8;       // 1.8-2.6m wide
  const h = 1.3 + rng() * 0.3;       // 1.3-1.6m tall
  const postH = h + 0.4;

  // Two posts on either side
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, postH, 6);
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(postGeo, POLE_MAT);
    p.position.set(sx * w / 2, postH / 2, 0);
    // Tapestry posts — slim, skip shadow casting.
    group.add(p);
  }

  // Fabric — slight droop along the top edge (cosine curve)
  const [c1Hex, c2Hex] = TAPESTRY_COLORS[Math.floor(rng() * TAPESTRY_COLORS.length)];
  const tex = tapestryTexture(c1Hex, c2Hex, rng);
  const fabric = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.95,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  // This texture belongs only to this tapestry. Material.dispose() does not
  // dispose texture maps in three.js, so connect their lifetimes explicitly;
  // every chunk, lake, and sandbox teardown already disposes the material.
  fabric.addEventListener('dispose', () => tex.dispose());

  const segs = 8;
  const verts = [];
  const uvs = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = (t - 0.5) * w;
    // Cosine droop — middle hangs 12cm below the post tops
    const sag = -Math.cos((t - 0.5) * Math.PI) * 0.12;
    verts.push(x, postH * 0.9 + sag, 0);
    verts.push(x, postH * 0.9 + sag - h, 0);
    uvs.push(t, 0);
    uvs.push(t, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const cloth = new THREE.Mesh(geo, fabric);
  cloth.castShadow = true;
  cloth.receiveShadow = true;
  group.add(cloth);

  return { group, width: w, footprint: 0.6 };
}

// Tiny procedural tapestry pattern: stripes / bands / diamonds. Drawn to a
// 64x64 canvas — cheap, doesn't depend on external assets, and gives enough
// detail that "tapestry" reads clearly at any zoom level.
function tapestryTexture(c1, c2, rng) {
  // CanvasTexture retains its source until upload, so each screen must own
  // its pixels even when several camps build before the first render.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const c1Str = '#' + c1.toString(16).padStart(6, '0');
  const c2Str = '#' + c2.toString(16).padStart(6, '0');
  ctx.fillStyle = c1Str;
  ctx.fillRect(0, 0, 64, 64);

  const pattern = Math.floor(rng() * 3);
  ctx.fillStyle = c2Str;
  if (pattern === 0) {
    // Horizontal bands
    for (let y = 4; y < 64; y += 12) ctx.fillRect(0, y, 64, 4);
  } else if (pattern === 1) {
    // Diamond grid
    for (let y = 0; y < 64; y += 16) {
      for (let x = 0; x < 64; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + 16, y + 8);
        ctx.lineTo(x + 8, y + 16);
        ctx.lineTo(x, y + 8);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else {
    // Vertical stripes
    for (let x = 4; x < 64; x += 10) ctx.fillRect(x, 0, 3, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  // SRGB tagging matches the canvas's native color space — without this
  // three.js does an extra linear → sRGB conversion in the shader for
  // colored textures, which is wrong AND slower.
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ---------- Campsite assembler ----------
//
// Composes a camp recipe around an open frontage: family-specific sleeping
// shelters behind it, a shared hearth/kitchen for hosts, and smaller sleeping
// pitches for merged satellites. Privacy screens follow the back boundary or
// canopy rear; torches stay on the open social side. Caller sets root pose.
//
// `size` controls the radius and prop count:
//   'small'  → 4m radius, 1 tent, 0-1 EZ-up, 2 torches, 1 tapestry, 1-2 chairs
//   'medium' → 6m radius, 2 tents, 1 EZ-up, 3 torches, 1-2 tapestries, 2-3 chairs
//   'large'  → 8m radius, 3 tents, 1-2 EZ-ups, 4 torches, 2 tapestries, 3-4 chairs
//
// Returns root, animation hooks, fixed recipe footprint, shelter/seat records
// and granular child colliders. Metadata stays in native root-local units;
// the registration helper applies root scale and world rotation exactly once.

const SIZE_CONFIG = {
  small:  { radius: 4, tents: 1, ezUps: [0, 1], torches: 2, tapestries: 1, chairs: [1, 2] },
  medium: { radius: 6, tents: 2, ezUps: [1, 1], torches: 3, tapestries: [1, 2], chairs: [2, 3] },
  large:  { radius: 8, tents: 3, ezUps: [1, 2], torches: 4, tapestries: 2, chairs: [3, 4] },
};

// Scattered campsites read dollhouse-small because the props (tent/tapestry/tiki
// torch/EZ-up) are built at a fixed native size — only the LAYOUT radius scaled
// per size. This scales the WHOLE assembled vignette (props AND spread) uniformly.
// The footprint scales with it (below); the two hardcoded clump/village spacings
// (chunks.js placeCampsiteClump + camp_village) import this so bigger campsites
// don't overlap, and the footprint-driven sites (lakes/forests) auto-follow.
// One knob — dial it if 2× reads too big or spreads forests too sparse. (Gary)
export const CAMPSITE_SCALE = 2;

export function campsiteFootprint(size) {
  return ((SIZE_CONFIG[size] || SIZE_CONFIG.medium).radius + 3) * CAMPSITE_SCALE;
}

// Tiki torches built OUTSIDE a campsite (stage rings, food-court rings, forest
// path lanterns, vendor backstage camps, the sandbox) used to render at native
// size — half the size of the torches inside a campsite, which ride the
// campsite root's CAMPSITE_SCALE. buildTikiTorch / buildTorchField now default
// to this scale so every torch in the world matches the campsite ones (Gary
// 2026-06-21). The campsite itself passes scale=1 to buildTorchField because
// its root already applies CAMPSITE_SCALE — keep the two equal so they match.
export const TIKI_TORCH_SCALE = CAMPSITE_SCALE;

function pickCount(spec, rng) {
  if (typeof spec === 'number') return spec;
  // [min, max] inclusive
  const [a, b] = spec;
  return a + Math.floor(rng() * (b - a + 1));
}

// Shared unit geometry keeps kitchen detail allocation bounded; each kitchen
// batches its folding table, shelves and legs into one instanced draw.
const _CAMP_BOX = new THREE.BoxGeometry(1, 1, 1);
_CAMP_BOX.userData.shared = true;
function addCampKitchen(parent) {
  const parts = [[0,.77,-.85,2.05,.09,.65],[-.88,.38,-.85,.07,.76,.52],
    [.88,.38,-.85,.07,.76,.52],[0,.2,-.85,1.85,.06,.5]];
  const table = new THREE.InstancedMesh(_CAMP_BOX, matFor(0xbcb5a2), parts.length);
  const m = new THREE.Matrix4();
  parts.forEach(([x,y,z,w,h,d],i)=>{m.makeScale(w,h,d);m.setPosition(x,y,z);table.setMatrixAt(i,m);});
  table.instanceMatrix.needsUpdate = true;
  parent.add(table);
  // Stove, water jug and cooler remain recognizable at the enlarged camp scale.
  const gear = new THREE.InstancedMesh(_CAMP_BOX, matFor(0x386b72), 3);
  [[-.5,.9,-.85,.65,.17,.4],[.65,1.02,-.85,.3,.45,.32],[1.9,.24,-.7,.65,.48,.48]]
    .forEach(([x,y,z,w,h,d],i)=>{m.makeScale(w,h,d);m.setPosition(x,y,z);gear.setMatrixAt(i,m);});
  gear.instanceMatrix.needsUpdate = true;
  parent.add(gear);
}

const _CAMP_BULB = new THREE.IcosahedronGeometry(.055, 0);
_CAMP_BULB.userData.shared = true;
const _CAMP_WIRE_MAT = new THREE.LineBasicMaterial({color:0x343c32});
_CAMP_WIRE_MAT.userData.shared = true;
function addCanopyTwinkles(parent, animatables, variant) {
  const bulbMat = new THREE.MeshStandardMaterial({color:variant>.5?0xffdf9a:0xffbd83,emissive:0xffb75b,emissiveIntensity:0});
  const bulbs = new THREE.InstancedMesh(_CAMP_BULB,bulbMat,7);
  const m = new THREE.Matrix4(), points=[];
  for(let i=0;i<=8;i++) {
    const x=-1.5+i*3/8,y=2.4-.24*Math.sin(i*Math.PI/8);
    points.push(new THREE.Vector3(x,y,1.5));
    if(i>0&&i<8){m.makeTranslation(x,y-.055,1.5);bulbs.setMatrixAt(i-1,m);}
  }
  bulbs.instanceMatrix.needsUpdate=true;
  const wire=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),_CAMP_WIRE_MAT);
  parent.add(wire,bulbs);
  animatables.push({kind:'campTwinkle',bulbMat,bulbs});
}

function addCampLanterns(parent, animatables, hasTable=true) {
  const material=new THREE.MeshStandardMaterial({color:0xffdda0,emissive:0xffbd65,emissiveIntensity:0});
  const positions=hasTable?[[0,1.01,-.85],[0,2.05,0]]:[[0,2.05,0]];
  const bulbs=new THREE.InstancedMesh(_CAMP_BULB,material,positions.length);
  const frames=new THREE.InstancedMesh(_CAMP_BOX,matFor(0x454941),positions.length*2+1);
  const m=new THREE.Matrix4();
  positions.forEach(([x,y,z],i)=>{
    m.makeScale(2.3,2.8,2.3);m.setPosition(x,y,z);bulbs.setMatrixAt(i,m);
    for(let j=0;j<2;j++) {m.makeScale(.23,.04,.23);m.setPosition(x,y+(j===0?-.13:.13),z);frames.setMatrixAt(i*2+j,m);}
  });
  m.makeScale(.018,.55,.018);m.setPosition(0,2.455,0);frames.setMatrixAt(positions.length*2,m);
  bulbs.instanceMatrix.needsUpdate=frames.instanceMatrix.needsUpdate=true;
  parent.add(bulbs,frames);
  animatables.push({kind:'campLantern',material});
}
const _TENT_SILHOUETTE_MATERIAL=new THREE.MeshBasicMaterial({color:0x737a65});
_TENT_SILHOUETTE_MATERIAL.userData.shared=true;
function addTentEveningGlow(tent,animatables,phase) {
  const panel=tent.door.mesh,material=panel.material.clone();
  material.userData.shared=false;material.emissive.setHex(0xffad4f);material.emissiveIntensity=0;
  panel.material=material;
  // The actual zippered cloth glows, rather than a separate triangular sign.
  const silhouetteGeometry=new THREE.BufferGeometry();
  const buffer=new Float32Array(512*3),position=new THREE.Float32BufferAttribute(buffer,3);
  silhouetteGeometry.setAttribute('position',position);silhouetteGeometry.setDrawRange(0,0);
  const silhouette=new THREE.Mesh(silhouetteGeometry,_TENT_SILHOUETTE_MATERIAL);silhouette.visible=false;
  // Thirteen finite poses are clipped once during construction. Animation
  // only copies a prepared pose into the owned fixed-size vertex buffer.
  const frames=[];
  for(let step=-6;step<=6;step++) {
    const shift=step*.0125,vertices=[];
    for(const [halfWidth,low,high] of [[.11,.2,.56],[.075,.59,.76]]) {
      const outline=[[shift-halfWidth,low],[shift+halfWidth,low],[shift+halfWidth,high],[shift-halfWidth,high]];
      const clipped=tent.door.surfaceMesh?clipDoorToShell(tent.door.surfaceMesh,outline,.009):null;
      if(clipped)vertices.push(...clipped);
      else for(const i of [0,1,2,0,2,3]){const [x,y]=outline[i];vertices.push(x,y,tent.door.surfaceZ(x,y)+.005);}
    }
    frames.push(new Float32Array(vertices));
  }
  let previousStep=Infinity;
  const updateSilhouette=offset=>{
    const step=Math.max(-6,Math.min(6,Math.round(offset/.0125)));if(step===previousStep)return;previousStep=step;
    const vertices=frames[step+6];position.array.set(vertices);position.needsUpdate=true;
    silhouetteGeometry.setDrawRange(0,vertices.length/3);
  };
  const fabric=tent.group.children[0].material.clone();
  fabric.userData.shared=false;fabric.emissive.setHex(0xffaa55);fabric.emissiveIntensity=0;
  tent.group.children[0].material=fabric;
  tent.group.add(silhouette);
  animatables.push({kind:'tentGlow',panel,panelAlwaysVisible:true,material,fabric,silhouette,updateSilhouette,phase,bedtime:.79+phase*.065});
}

// Retain each chair's empty transform group for seat metadata, but batch its
// static metal/fabric parts so a social ring does not cost nine draws per seat.
export function batchCampChairs(root, chairs) {
  const buckets=new Map();
  for(const {group} of chairs) {
    group.updateMatrix();
    for(const mesh of [...group.children]) {
      mesh.updateMatrix();
      let materials=buckets.get(mesh.geometry);
      if(!materials){materials=new Map();buckets.set(mesh.geometry,materials);}
      let bucket=materials.get(mesh.material);
      if(!bucket){bucket=[];materials.set(mesh.material,bucket);}
      bucket.push(new THREE.Matrix4().multiplyMatrices(group.matrix,mesh.matrix));
      group.remove(mesh);
    }
  }
  for(const [geometry,materials] of buckets) for(const [material,matrices] of materials) {
    const instances=new THREE.InstancedMesh(geometry,material,matrices.length);
    matrices.forEach((matrix,i)=>instances.setMatrixAt(i,matrix));
    instances.instanceMatrix.needsUpdate=true;
    root.add(instances);
  }
}

function discardCampProp(root,group) {
  root.remove(group);
  group.traverse(node=>{
    if(node.geometry&&!node.geometry.userData.shared)node.geometry.dispose();
    const materials=Array.isArray(node.material)?node.material:[node.material];
    for(const material of materials)if(material&&!material.userData.shared)material.dispose();
  });
}

export function buildCampsite(rng = Math.random, size = 'medium', options = {}) {
  const cfg = SIZE_CONFIG[size] || SIZE_CONFIG.medium;
  const root = new THREE.Group();
  const animatables = [];
  const tentProps = [], canopyProps = [], fireChairs = [], canopyChairs = [], tapestries = [];

  // Preserve the historical fire RNG draws even when a satellite shares its host hearth.
  const fire = buildChiminea(rng);
  root.add(fire.group);
  animatables.push(fire);

  // Helper: place a prop at polar (r, theta) and face it toward the centre.
  function placeAt(propGroup, r, theta, faceCenter = true) {
    propGroup.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
    if (faceCenter) {
      propGroup.rotation.y = -theta + Math.PI / 2 + Math.PI;
    }
    root.add(propGroup);
  }

  // Historical tent slots consume identical RNG; recipe families may replace two smaller slots.
  const tentCount = pickCount(cfg.tents, rng);
  const tentArcStart = rng() * Math.PI * 2;
  const recipe=options.plan||planCampRecipe(size,{...options,seed:options.seed??((tentArcStart*0x10000000)>>>0)});
  // Proxy PointLight — one per campsite, sitting at the firepit. Stands in
  // for the cumulative glow of the firepit + every tiki torch on the
  // perimeter. Intensity ramps with nightness (handled in
  // updateCampsiteProps) so the light is dim at noon and roaring at
  // midnight. PERF-gated so low-tier devices skip it and lean on emissive
  // + bloom to carry the visual.
  if (PERF.contextLights && recipe.fire) {
    const proxy = new THREE.PointLight(0xffb060, 0, 14, 1.2);
    proxy.position.set(0, 1.2, 0);                  // just above the firepit
    proxy.castShadow = false;                       // shadow-casting is too expensive at scale
    root.add(proxy);
    // Tag this animatable so updateCampsiteProps knows to modulate the
    // intensity by nightness.
    animatables.push({ kind: 'contextLight', light: proxy, base: 1.6 });
    // Register with the global culler so the light only ticks the
    // fragment shader when the player is nearby.
    registerContextLight(proxy);
  }

  const tentArcSpread = Math.PI * 0.6;
  for (let i = 0; i < tentCount; i++) {
    const family=recipe.tentFamilies[i];
    if(!family) {
      // An omitted historical slot still owns its colour/vestibule draws,
      // but needs no temporary tent geometry or clipped doorway.
      rng();rng();continue;
    }
    const tent = buildCampTent(rng,{family,variation:((Math.imul((tentArcStart*1e8)|0,i+17)>>>0)%1000)/1000});
    tentProps.push(tent);
    const t = tentCount === 1 ? 0.5 : i / (tentCount - 1);
    const theta = tentArcStart + (t - 0.5) * tentArcSpread;
    placeAt(tent.group, cfg.radius * 0.75, theta);
  }

  // EZ-ups — usually opposite the tents
  const ezCount = pickCount(cfg.ezUps, rng);
  const ezArcStart = tentArcStart + Math.PI + (rng() - 0.5) * 0.5;
  for (let i = 0; i < ezCount; i++) {
    if(i>=recipe.canopyLimit) {
      // Omitted canopies retain their colour/skirt draws and each historical
      // chair's colour/placement draws without constructing those props.
      rng();rng();
      const chairsHere=2+Math.floor(rng()*2);
      for(let draw=0;draw<chairsHere*4;draw++)rng();
      continue;
    }
    const ez = buildEzUp(rng);
    canopyProps.push(ez);
    const theta = ezArcStart + (i - (ezCount - 1) / 2) * 0.55;
    placeAt(ez.group, cfg.radius * 0.7, theta, false);
    // Plant a few chairs under each EZ-up
    const chairsHere = 2 + Math.floor(rng() * 2);
    for (let j = 0; j < chairsHere; j++) {
      const chair = buildCampChair(rng);
      canopyChairs.push({ chair, canopy: i, index: j });
      const localR = 0.8 + rng() * 0.4;
      const localA = rng() * Math.PI * 2;
      chair.group.position.set(
        Math.cos(theta) * cfg.radius * 0.7 + Math.cos(localA) * localR,
        0,
        Math.sin(theta) * cfg.radius * 0.7 + Math.sin(localA) * localR,
      );
      chair.group.rotation.y = rng() * Math.PI * 2;
      root.add(chair.group);
    }
  }

  // Standalone chairs around the firepit
  const standaloneChairs = pickCount(cfg.chairs, rng);
  for (let i = 0; i < standaloneChairs; i++) {
    if(recipe.chairLimit===0){rng();rng();rng();continue;}
    const chair = buildCampChair(rng);
    fireChairs.push(chair);
    // Place on a ring just outside the firepit (~1.8m)
    const theta = rng() * Math.PI * 2;
    const r = 1.6 + rng() * 0.6;
    chair.group.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
    // Face the fire
    chair.group.rotation.y = -theta + Math.PI / 2 + Math.PI;
    root.add(chair.group);
  }

  // Reserve the historical torch angle and phase draws, then reproject poles
  // onto the open social edge below. Static woodwork remains instanced.
  const torchCount = pickCount(cfg.torches, rng);
  const torchOffset = rng() * Math.PI * 2;
  const torchPositions = [];
  for (let i = 0; i < torchCount; i++) {
    const theta = torchOffset + (i / torchCount) * Math.PI * 2;
    const r = cfg.radius * 1.05;
    torchPositions.push({ x: Math.cos(theta) * r, z: Math.sin(theta) * r });
  }
  // Reserve each historical phase draw here; final placement below consumes
  // no external randomness and can keep torches out of every shelter.
  for(const position of torchPositions)position.phase=rng()*Math.PI*2;

  // Reserve historical tapestry draws before the privacy-border layout pass.
  const tapCount = pickCount(cfg.tapestries, rng);
  for (let i = 0; i < tapCount; i++) {
    if(i>=recipe.screenLimit) {
      // Width, height, palette, pattern and placement angle retain their
      // historical draws without allocating a canvas for an absent screen.
      for(let draw=0;draw<5;draw++)rng();
      continue;
    }
    const tap = buildTapestry(rng);
    tapestries.push(tap);
    const theta = rng() * Math.PI * 2;
    placeAt(tap.group, cfg.radius * 0.95, theta, false);
  }

  // Layout variation uses a separate stream derived from an already drawn
  // camp angle. The caller's RNG consumption remains byte-for-byte unchanged.
  let layoutState = (tentArcStart * 0x10000000) >>> 0;
  const localRandom = () => { layoutState = (Math.imul(layoutState, 1664525) + 1013904223) >>> 0; return layoutState / 4294967296; };
  // Merged satellite camps retain sleeping quarters while the host owns the
  // fire and kitchen. Historical props were built first to preserve RNG draws.
  if(!recipe.fire){discardCampProp(root,fire.group);animatables.splice(0,1);}
  for(let i=canopyProps.length-1;i>=recipe.canopyLimit;i--) {
    discardCampProp(root,canopyProps[i].group);
    canopyChairs.filter(v=>v.canopy===i).forEach(v=>{v.chair.skip=true;root.remove(v.chair.group);});
    canopyProps.splice(i,1);
  }
  if(recipe.kitchen&&recipe.canopyLimit>0&&canopyProps.length===0) {
    // Small historical camps may draw no canopy; a declared kitchen still
    // needs shelter, supplied solely from the camp's independent stream.
    const ez=buildEzUp(localRandom);canopyProps.push(ez);root.add(ez.group);
    for(let j=0;j<2;j++) {const chair=buildCampChair(localRandom);canopyChairs.push({chair,canopy:0,index:j});root.add(chair.group);}
  }
  for(let i=tapestries.length-1;i>=recipe.screenLimit;i--){discardCampProp(root,tapestries[i].group);tapestries.splice(i,1);}
  torchPositions.length=Math.min(torchPositions.length,recipe.torchLimit);
  const childColliders = [], seats = [], tents = [];
  const collider = (kind, group, radius, x=group.position.x, z=group.position.z) => {
    childColliders.push({kind, group, x, z, radius});
  };
  if(recipe.fire)collider('campfire', fire.group, .8);
  const face = (group,x,z) => { group.rotation.y = Math.atan2(x-group.position.x,z-group.position.z); };
  const pose = (group,r,a) => { group.position.set(Math.cos(a)*r,0,Math.sin(a)*r); face(group,0,0); };
  const largestShelter=Math.max(...tentProps.map(t=>t.shelter?.radius||1.8));
  const bayStep=Math.max(recipe.tentArcStep,2*Math.asin(Math.min(.99,(largestShelter*2+.25)/(2*(recipe.tentRadius-.07)) ))+.1);
  tentProps.forEach((tent,i)=>{
    const a = tentArcStart + (i-(tentProps.length-1)/2)*bayStep + (localRandom()-.5)*.09;
    pose(tent.group,recipe.tentRadius+(localRandom()-.5)*.14,a);
    const {x,z} = tent.group.position, yaw = tent.group.rotation.y;
    const shelter=tent.shelter||{radius:1.8,doorReach:2.25,bounds:[{x:0,z:0,halfWidth:1.1,halfDepth:1.25}]};
    tents.push({x,z,yaw,group:tent.group,family:tent.family,capacity:shelter.capacity||2,shelter,entry:{x:x+Math.sin(yaw)*shelter.doorReach,z:z+Math.cos(yaw)*shelter.doorReach}});
    collider('camp_tent',tent.group,shelter.radius);
    if(localRandom()>.25)addTentEveningGlow(tent,animatables,localRandom());
  });
  const rearScreen=canopyProps.length&&localRandom()>.5?tapestries[0]:null;
  const placeScreen=(tap,yaw,x,z)=>{
    tap.group.rotation.y=yaw;tap.group.position.set(x,0,z);
    const c=Math.cos(yaw),sn=Math.sin(yaw),width=tap.width||2.6;
    for(let j=0;j<=4;j++) {
      const offset=(j/4-.5)*width;
      collider('camp_tapestry',tap.group,j===0||j===4?.1:.3,x+offset*c,z-offset*sn);
    }
  };
  tapestries.forEach((tap,i)=>{
    if(tap===rearScreen)return;
    // Broken outer screens mark the sleeping boundary, leaving wide entry
    // gaps and the social half open; some camps use a canopy rear screen.
    const angle=tentArcStart+(i-(tapestries.length-1)/2)*.9;
    const radius=cfg.radius+2.45;
    placeScreen(tap,Math.atan2(-Math.cos(angle),-Math.sin(angle)),Math.cos(angle)*radius,Math.sin(angle)*radius);
  });
  torchPositions.forEach((position,i)=>{
    const angle=tentArcStart+Math.PI/2+(i+.5)*Math.PI/torchPositions.length;
    position.x=Math.cos(angle)*(recipe.role==='satellite'?recipe.footprint/2-.25:cfg.radius+1.6);
    position.z=Math.sin(angle)*(recipe.role==='satellite'?recipe.footprint/2-.25:cfg.radius+1.6);
    childColliders.push({kind:'camp_torch',x:position.x,z:position.z,radius:.1});
  });
  const torchField=buildTorchField(torchPositions,rng,1);
  root.add(torchField.group);
  animatables.push(...torchField.animatables);
  canopyProps.forEach((ez,i)=>{
    const a=tentArcStart+Math.PI+(i-(canopyProps.length-1)/2)*1.05;
    // Small camps need a real passing gap between the hearth chairs and the
    // middle canopy seat; otherwise its neighbors seal the only walking fan.
    const livingClearance=size==='small'?.45:0;
    pose(ez.group,cfg.radius*.85+.35+livingClearance,a);
    const hasKitchen=recipe.kitchen&&i===0;
    if(hasKitchen)addCampKitchen(ez.group);
    addCanopyTwinkles(ez.group,animatables,localRandom());
    addCampLanterns(ez.group,animatables,hasKitchen);
    const yaw=ez.group.rotation.y, c=Math.cos(yaw), sn=Math.sin(yaw);
    const transformed=(x,z)=>({x:ez.group.position.x+x*c+z*sn,z:ez.group.position.z-x*sn+z*c});
    for(const x of [-1.5,1.5]) for(const z of [-1.5,1.5]) {
      const p=transformed(x,z); collider('camp_post',ez.group,.12,p.x,p.z);
    }
    if(i===0&&rearScreen) {const p=transformed(0,-1.5);placeScreen(rearScreen,yaw,p.x,p.z);}
    if(hasKitchen) {
      const kitchen=transformed(0,-.85); collider('camp_kitchen',ez.group,1.08,kitchen.x,kitchen.z);
      const cooler=transformed(1.9,-.7); collider('camp_cooler',ez.group,.42,cooler.x,cooler.z);
    }
    const row=canopyChairs.filter(v=>v.canopy===i);
    const loveseat=localRandom()>.35;
    if(loveseat) {
      const original=row[0].chair;
      row[0].chair=buildCampChair(()=>Math.max(0,CHAIR_COLORS.indexOf(original.color)+.1)/CHAIR_COLORS.length,{style:'loveseat'});
      row[0].chair.loveseat=true;
      discardCampProp(root,original.group);
      root.add(row[0].chair.group);
      row[1].chair.skip=true;
      root.remove(row[1].chair.group);
    }
    row.forEach(({chair},j)=>{
      if(chair.skip)return;
      // The double chair replaces two singles, preserving capacity and the
      // open counter aisle while giving larger camps a shared lounge seat.
      const x=loveseat?(j===0?-.6:.9):(j-(row.length-1)/2)*1.1;
      const p=transformed(x,.85);
      chair.group.position.set(p.x,0,p.z); chair.group.rotation.y=yaw;
    });
  });
  fireChairs.forEach((chair,i)=>{
    // Even spacing with bounded jitter avoids stacked chairs and leaves an
    // open approach on the tent side instead of sealing the fire in a ring.
    const a=tentArcStart+Math.PI/2+(i+.5)*Math.PI/fireChairs.length+(localRandom()-.5)*.12;
    pose(chair.group,1.85+localRandom()*.15,a);
    if(recipe.sharedFront)face(chair.group,-Math.cos(tentArcStart)*recipe.footprint,-Math.sin(tentArcStart)*recipe.footprint);
  });
  for(const chair of [...fireChairs,...canopyChairs.map(v=>v.chair)]) {
    if(chair.skip)continue;
    const {x,z}=chair.group.position, yaw=chair.group.rotation.y;
    for(const [seatIndex,offset] of (chair.seatOffsets||(chair.loveseat?[-.27,.27]:[0])).entries()) {
      seats.push({x:x+Math.cos(yaw)*offset,z:z-Math.sin(yaw)*offset,y:chair.seatY??.45,yaw,group:chair.group,seatIndex,furniture:chair.loveseat?'loveseat':'chair'});
    }
    collider(chair.loveseat?'camp_loveseat':'camp_chair',chair.group,chair.footprint||(chair.loveseat?.7:.53));
  }

  batchCampChairs(root,[...fireChairs,...canopyChairs.map(v=>v.chair)].filter(c=>!c.skip));

  // Scale the whole vignette (props + their polar layout) uniformly. Props sit
  // at y=0 so they stay grounded under scale; the footprint grows to match so
  // collision/placement guards space the bigger campsites correctly.
  root.scale.setScalar(CAMPSITE_SCALE);

  return {
    group: root,
    animatables,
    footprint: recipe.footprint, archetype:recipe.archetype, role:recipe.role,
    childColliders, colliders: childColliders, seats, tents, entranceYaw: Math.atan2(-Math.cos(tentArcStart),-Math.sin(tentArcStart)),
  };
}

// ---------- Vendor backstage camp ----------
//
// The elaborated version of the lone tent that used to sit behind ~40% of
// market stalls. Smaller than a full buildCampsite — it has to tuck into the
// ~6 m band behind the booth line without poking into the road or a
// neighbouring cluster — but richer than a bare tent: a tent scaled up to match
// the enlarged campsite tents, a chair or two, and (by chance) a small fire and
// a single tiki torch. Vendors camp behind their stalls.
//
// Local frame: +z is the FRONT of the camp (toward the booth / aisle); the tent
// backs the camp at -z (the outer edge). The caller rotates the whole group so
// +z faces the aisle, the same way the booths do, so the seating reads as
// "vendors relaxing right behind their stall."
//
// `tier` lets the caller thin out adjacent camps so a run of backstages blends
// into a continuous, varied strip instead of a wall of identical full camps:
//   'full' — fire (80%), 2–3 chairs, a torch (55%)
//   'lean' — no fire, 1–2 chairs, a torch (25%)
const VENDOR_CAMP_TENT_SCALE = 1.45;   // bigger than the old lone booth-tent, but small enough that the chairs/fire still read

export function buildVendorCamp(rng = Math.random, tier = 'full') {
  const root = new THREE.Group();
  const animatables = [];
  const childColliders = [], seats = [], tents = [];
  const full = tier === 'full';

  // Tent at the back/outer edge, scaled up toward the enlarged campsite tents.
  // buildCampTent's door is native +z, so the unrotated tent already opens
  // toward the fire/booth — just nudge it back and add a touch of yaw jitter.
  const tent = buildCampTent(rng);
  tent.group.scale.setScalar(VENDOR_CAMP_TENT_SCALE);
  tent.group.position.set((rng() - 0.5) * 0.8, 0, -1.7);
  tent.group.rotation.y = (rng() - 0.5) * 0.3;
  root.add(tent.group);
  const tentYaw=tent.group.rotation.y, tx=tent.group.position.x, tz=tent.group.position.z;
  const doorReach=tent.shelter.doorReach*VENDOR_CAMP_TENT_SCALE;
  tents.push({x:tx,z:tz,yaw:tentYaw,group:tent.group,family:tent.family,capacity:tent.shelter.capacity,shelter:tent.shelter,entry:{x:tx+Math.sin(tentYaw)*doorReach,z:tz+Math.cos(tentYaw)*doorReach}});
  childColliders.push({kind:'camp_tent',x:tx,z:tz,radius:tent.shelter.radius*VENDOR_CAMP_TENT_SCALE,group:tent.group});

  // The living area sits OUT in front of the tent (toward the booth/aisle) so
  // the big tent doesn't swallow it. Fire is the anchor; lean camps skip it.
  const fireCenter = { x: -2.3 + (rng() - 0.5) * 0.5, z: 1.3 };
  if (full && rng() < 0.85) {
    const fire = buildChiminea(rng);
    fire.group.position.set(fireCenter.x, 0, fireCenter.z);
    root.add(fire.group);
    animatables.push(fire);
    childColliders.push({kind:'campfire',x:fireCenter.x,z:fireCenter.z,radius:.7,group:fire.group});
  }

  // Chairs ringed around the fire on the aisle side (+z), facing back into it,
  // so the player driving past sees the seating, not the tent's backside. Full
  // camps seat 2–3, lean 1–2.
  const chairCount = full ? 2 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2);
  for (let i = 0; i < chairCount; i++) {
    const chair = buildCampChair(rng);
    const theta = (Math.PI / 2) + (i - (chairCount - 1) / 2) * 0.9 + (rng() - 0.5) * 0.4;
    const r = 1.0 + rng() * 0.5;
    chair.group.position.set(
      fireCenter.x + Math.cos(theta) * r,
      0,
      fireCenter.z + Math.sin(theta) * r,
    );
    chair.group.rotation.y = -theta + Math.PI / 2 + Math.PI;   // face the fire
    root.add(chair.group);
    seats.push({x:chair.group.position.x,z:chair.group.position.z,y:chair.seatY??.45,yaw:chair.group.rotation.y,group:chair.group});
    childColliders.push({kind:'camp_chair',x:chair.group.position.x,z:chair.group.position.z,radius:chair.footprint||.53,group:chair.group});
  }

  // A single tiki torch off to one front corner, near the stall.
  if (rng() < (full ? 0.6 : 0.3)) {
    const torch = buildTikiTorch(rng);
    torch.group.position.set(
      (rng() < 0.5 ? -1 : 1) * (1.6 + rng() * 0.4),
      0,
      1.4 + (rng() - 0.5) * 0.5,
    );
    root.add(torch.group);
    animatables.push(torch);
  }

  return { group: root, animatables, footprint: Math.max(...childColliders.map(p=>Math.hypot(p.x,p.z)+p.radius)), childColliders, colliders:childColliders, seats, tents };
}

// ---------- Central animator ----------
//
// Each campsite returns its prop objects, and the campsite assembler keeps
// a list of "animatable" props (chimineas, torches). One global updater walks
// the list each frame and pulses the emissives / bobs the flames.

export function updateCampsiteProps(t, nightness, props, dayT) {
  // nightness 0..1: by day chimineas/torches are dim, by night they roar.
  const baseIntensity = 4.0 * nightness;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if(p.kind==='campLantern')p.material.emissiveIntensity=nightness*1.8;
    if(p.kind==='tentGlow') {
      const evening=Number.isFinite(dayT)?THREE.MathUtils.smoothstep(dayT,.51,.56)*(1-THREE.MathUtils.smoothstep(dayT,p.bedtime,p.bedtime+.025)):nightness;
      p.panel.visible=p.panelAlwaysVisible||evening>.01;
      p.silhouette.visible=evening>.01;
      p.material.emissiveIntensity=evening*.35;
      if(p.fabric)p.fabric.emissiveIntensity=evening*.24;
      const offset=Math.sin(t*.55+p.phase*6)*.075;
      if(p.updateSilhouette){if(evening>.01)p.updateSilhouette(offset);}
      else p.silhouette.position.x=offset;
    }
    if (p.kind === 'campTwinkle') { p.bulbMat.emissiveIntensity=nightness*2.2; }
    if (p.emberMat) {
      // Chiminea / firepit — gentle flicker
      const flick = 0.85 + 0.15 * Math.sin(t * 6 + p.phase);
      const ignition = .51 + ((p.phase || 0) / (Math.PI * 2)) * .045;
      const lit = Number.isFinite(dayT)
        ? THREE.MathUtils.smoothstep(dayT, ignition, ignition+.025) * (1-THREE.MathUtils.smoothstep(dayT,.82,.91))
        : THREE.MathUtils.smoothstep(nightness,.12,.45);
      p.emberMat.emissiveIntensity = baseIntensity * flick * lit;
      p.emberMat.color.setHex(lit>.05 ? 0xff7733 : 0x30251e);
      if (p.fireFlame) { p.fireFlame.visible=lit>.01; p.fireFlame.scale.y=1.4*(.8+.2*Math.sin(t*8+p.phase)); }
    }
    if (p.flameMat) {
      // Tiki torch flame — sharper, faster flicker, plus a small scale bob
      const flick = 0.7 + 0.3 * Math.sin(t * 9 + p.phase);
      p.flameMat.emissiveIntensity = baseIntensity * 1.5 * flick;
      // Tiki flame goes invisible during full day so it doesn't read as
      // "always lit." Fade in over the dusk band.
      p.flameMat.opacity = THREE.MathUtils.clamp(nightness * 1.2, 0, 0.95);
      // Mild vertical wobble on the flame mesh itself, relative to the torch's
      // base size (instanced torch fields scale the flame mesh directly; a
      // campsite/buildTikiTorch flame rides its parent group's scale, baseScale 1).
      if (p.flame) {
        p.flame.scale.y = (p.baseScale || 1) * (1 + 0.15 * Math.sin(t * 12 + p.phase));
      }
      // Fancy-lights opt-in: dim the per-torch PointLight by nightness² so
      // it's invisible at noon and flickers warmly at midnight.
      if (p.flameLight) {
        p.flameLight.intensity = 0.7 * (nightness * nightness) * flick;
      }
    }
    if (p.kind === 'contextLight' && p.light) {
      // Proxy campsite light: dark by day, warm by night, with a slow
      // breathing flicker so it doesn't feel mathematically static. The
      // ^2 on nightness keeps the light off until dusk really sets in.
      const flick = 0.85 + 0.15 * Math.sin(t * 4 + (p.phase || 0));
      p.light.intensity = (p.base || 1.6) * (nightness * nightness) * flick;
    }
  }
}
