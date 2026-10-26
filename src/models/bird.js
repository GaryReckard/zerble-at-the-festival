// Shared low-poly anatomy and poses for both the entity viewer and live flock.
// Local +Z is the bill, +Y is up. All cached buffers survive chunk disposal.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BIRD_SPECIES = {
  sparrow: { label: 'Sparrow', size: 0.50, body: 0x7a5a3a, wing: 0x5e4327, beak: 0x33260f, altitude: [5, 15],  speed: 7.0, flock: 0.95, song: 'sparrow' },
  finch:   { label: 'Finch',   size: 0.46, body: 0xd8c23a, wing: 0x25282b, beak: 0xd4a274, altitude: [6, 17],  speed: 7.5, flock: 0.85, song: 'finch'   },
  jay:     { label: 'Jay',     size: 0.72, body: 0x3f6fd0, wing: 0x2a4f9c, beak: 0x161616, altitude: [8, 22],  speed: 8.0, flock: 0.40, song: 'jay'     },
  crow:    { label: 'Crow',    size: 1.00, body: 0x171b23, wing: 0x0d1016, beak: 0x0a0a0a, altitude: [14, 40], speed: 9.0, flock: 0.60, song: 'crow'    },
  dove:    { label: 'Dove',    size: 0.82, body: 0xb9b2a8, wing: 0x968e84, beak: 0x3a3a3a, altitude: [7, 19],  speed: 6.5, flock: 0.50, song: 'dove'    },
};

export const BIRD_KEYS = Object.keys(BIRD_SPECIES);
const SHAPES = {
  sparrow: { belly: 0xc7b59a, span: .86, tail: .48, bill: .16, hz: 8, glide: .12 },
  finch: { belly: 0xe7d65b, span: .88, tail: .43, bill: .15, hz: 9, glide: .32 },
  jay: { belly: 0xcbd6dd, span: 1.02, tail: .72, bill: .26, hz: 5.5, glide: .24 },
  crow: { belly: 0x252a32, span: 1.12, tail: .58, bill: .31, hz: 4, glide: .42 },
  dove: { belly: 0xd4c5b5, span: .98, tail: .86, bill: .18, hz: 6.5, glide: .18 },
};
for (const key of BIRD_KEYS) Object.assign(BIRD_SPECIES[key], SHAPES[key]);

function paint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}
function merged(parts) {
  const flat = parts.map(g => g.index ? g.toNonIndexed() : g);
  const out = mergeGeometries(flat, false);
  for (const g of new Set([...parts, ...flat])) g.dispose();
  out.userData.shared = true;
  return out;
}
// A feather fan with thickness, a swept leading edge and separated primary tips.
function fan(points, s, hex) {
  const shape = new THREE.Shape();
  points.forEach(([x,z], i) => i ? shape.lineTo(x*s,z*s) : shape.moveTo(x*s,z*s));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {depth:.025*s, bevelEnabled:false, steps:1});
  g.rotateX(Math.PI/2);
  return paint(g,hex);
}
const cache = new Map();
export function birdInstanceGeo(key = 'sparrow') {
  if (!BIRD_SPECIES[key]) key = 'sparrow';
  if (cache.has(key)) return cache.get(key);
  const sp = BIRD_SPECIES[key], s = sp.size, parts = [];
  const ellipsoid = (radius, scale, position, color, detail=1) => {
    const g = new THREE.IcosahedronGeometry(radius*s,detail);
    g.scale(...scale); g.translate(...position.map(v=>v*s)); parts.push(paint(g,color));
  };
  ellipsoid(.30,[1,.88,1.6],[0,0,0],sp.body);
  ellipsoid(.25,[.96,.66,1.42],[0,-.13,.10],sp.belly);
  ellipsoid(.195,[.92,1,1.03],[0,.18,.40],sp.body);
  const bill = new THREE.ConeGeometry((key==='finch'||key==='sparrow'?.075:.055)*s,sp.bill*s,4);
  bill.rotateX(Math.PI/2); bill.translate(0,.16*s,(.55+sp.bill/2)*s); parts.push(paint(bill,sp.beak));
  for (const side of [-1,1]) {
    ellipsoid(.028,[.5,1,1],[side*.171,.22,.46],0x111318,0);
    // Feet sit below the belly; compact toes also read as tucked feet in flight.
    const leg = new THREE.CylinderGeometry(.017*s,.013*s,.15*s,4);
    leg.translate(side*.10*s,-.31*s,.04*s); parts.push(paint(leg,0x685446));
    const toes = fan([[-.04,0],[0,.12],[.04,0],[0,-.04]],s,0x685446);
    toes.translate(side*.10*s,-.385*s,.04*s); parts.push(toes);
  }
  if (key === 'finch') ellipsoid(.15,[1,.35,1],[0,.345,.40],sp.wing,0);
  if (key==='jay') {
    const crest = new THREE.ConeGeometry(.13*s,.30*s,4);
    crest.rotateX(-.35); crest.translate(0,.40*s,.34*s); parts.push(paint(crest,sp.body));
  }
  const tailOutline = key === 'dove'
    ? [[-.12,-.30],[-.19,-.50],[0,-.45-sp.tail],[.19,-.50],[.12,-.30]]
    : [[-.12,-.30],[-.20,-.48],[-.18,-.45-sp.tail],[.18,-.45-sp.tail],[.20,-.48],[.12,-.30]];
  const tail = fan(tailOutline,s,sp.wing);
  parts.push(tail);
  const span=sp.span;
  const wingParts=[fan([[0,.17],[.30,.22],[span*.72,.08],[span,-.13],
    [span*.82,-.18],[span*.96,-.27],[span*.72,-.26],[span*.83,-.38],
    [span*.57,-.34],[span*.61,-.45],[.28,-.36],[0,-.22]],s,sp.wing)];
  if (key==='jay'||key==='finch'||key==='sparrow') {
    const bar = fan([[.25,.12],[.31,.12],[.52,-.31],[.45,-.32]],s,key==='sparrow'?0xcbb89a:0xe5e5d8);
    bar.translate(0,.007*s,0); wingParts.push(bar);
  }
  const wing=merged(wingParts);
  // Bake the reflection into the geometry, retaining positive instance scales.
  // Reverse winding after reflection so normals and face orientation agree.
  const wingR=wing.clone(); wingR.scale(-1,1,1);
  for (const attr of Object.values(wingR.attributes)) {
    for (let i=0;i<attr.count;i+=3) for(let k=0;k<attr.itemSize;k++) {
      const a=(i+1)*attr.itemSize+k, b=(i+2)*attr.itemSize+k;
      const v=attr.array[a]; attr.array[a]=attr.array[b]; attr.array[b]=v;
    }
  }
  wingR.computeVertexNormals(); wingR.userData.shared=true;
  const result={body:merged(parts),wing,wingR,s,wingX:.16*s,wingY:.10*s};
  cache.set(key,result); return result;
}
export const birdGeometries = birdInstanceGeo;
let material;
export function birdInstanceMaterial() {
  if (!material) {
    material=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.85,side:THREE.DoubleSide});
    material.userData.shared=true;
  }
  return material;
}

// Shared motion makes preview and instanced flock use the same wing mechanics.
export function birdWingAngle(phase, fold, glide=0) {
  return (Math.sin(phase)*.85+.18)*(1-fold)*(1-glide) - .30*fold + .10*glide*(1-fold);
}
export function birdGlide(species, time) {
  const sp=BIRD_SPECIES[species];
  const cycle=(time*.32)%1;
  return THREE.MathUtils.smoothstep(cycle,1-sp.glide-.10,1-sp.glide)*
    (1-THREE.MathUtils.smoothstep(cycle,.92,1));
}
export function buildBird(speciesKey='sparrow',{perched=false}={}) {
  if (!BIRD_SPECIES[speciesKey]) speciesKey='sparrow';
  const sp=BIRD_SPECIES[speciesKey], g=birdInstanceGeo(speciesKey);
  const group=new THREE.Group(), bodyPivot=new THREE.Group(); group.add(bodyPivot);
  const body=new THREE.Mesh(g.body,birdInstanceMaterial()); bodyPivot.add(body);
  const wingL=new THREE.Mesh(g.wing,birdInstanceMaterial());
  const wingR=new THREE.Mesh(g.wingR,birdInstanceMaterial());
  wingL.position.set(g.wingX,g.wingY,0); wingR.position.set(-g.wingX,g.wingY,0);
  bodyPivot.add(wingL,wingR);
  let t=Math.random()*10, resting=perched, fold=perched?1:0;
  group.userData.species=speciesKey;
  group.userData.parts={bodyPivot,wingL,wingR};
  group.userData.setPerched=v=>{resting=v;};
  group.userData.anim=dt=>{
    t+=dt; fold+=((resting?1:0)-fold)*(1-Math.exp(-dt*9));
    const glide=resting?0:birdGlide(speciesKey,t);
    const angle=birdWingAngle(t*Math.PI*2*sp.hz,fold,glide);
    for (const [wing,side] of [[wingL,1],[wingR,-1]]) {
      wing.rotation.set(0,side*fold*1.12,side*angle,'YXZ');
      wing.scale.set(1-fold*.65,1,1);
    }
    bodyPivot.position.y=Math.sin(t*2.2)*.012*g.s;
  };
  group.userData.anim(0); return group;
}
export function buildBirdFlock(speciesKey='sparrow',count=7) {
  const flock=new THREE.Group();
  for(let i=0;i<count;i++) {
    const b=buildBird(speciesKey), ang=i/count*Math.PI*2,r=1.5+(i%3)*.9;
    b.position.set(Math.cos(ang)*r,(i%4)*.6,Math.sin(ang)*r);
    b.rotation.y=ang+Math.PI/2; flock.add(b);
  }
  flock.userData.anim=dt=>flock.children.forEach(b=>b.userData.anim(dt));
  return flock;
}
