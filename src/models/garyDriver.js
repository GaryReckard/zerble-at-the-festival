import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const templates = new Map();
function bake(parts) {
  const flat=parts.map(g=>g.index?g.toNonIndexed():g.clone());
  for(const g of flat)g.deleteAttribute('uv');
  const geo=mergeGeometries(flat);
  for(const g of [...parts,...flat])g.dispose();
  geo.userData.shared=true;
  return geo;
}
function oval(radii,center) {
  const g=new THREE.SphereGeometry(1,10,6);g.scale(...radii);g.translate(...center);return g;
}
function segment(a,b,r1,r2) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const g=new THREE.CylinderGeometry(r2,r1,delta.length(),8);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
  g.translate(...start.add(end).multiplyScalar(.5).toArray());return g;
}
function box(size,center,angle=0) {
  const g=new THREE.BoxGeometry(...size);g.rotateX(angle);g.translate(...center);return g;
}
function material(color,extra={}) {
  const m=new THREE.MeshStandardMaterial({color,roughness:.92,...extra});m.userData.shared=true;return m;
}
const pantsMaterial=material(0x354555),shoeMaterial=material(0x665345),rubberMaterial=material(0x202427);
const denimDetailMaterial=material(0x607384);
const hairMaterial=material(0xffffff,{vertexColors:true});

// Coordinates are relative to Gary's existing seat anchor, 1.75m above cart
// origin. The seat top is -0.025 and the recessed footwell deck is -0.90 here.
export const GARY_SEATED_CONTACT = Object.freeze({
  seatY:-.025,deckY:-.90,
  rightShoe:Object.freeze([.17,-.72,-1.00]),pedal:Object.freeze([.17,-.72+Math.tan(.8)*.07-.073/Math.cos(.8),-1.07]),pedalAngle:.8,
});
export function buildGaryLowerBody() {
  if(!templates.has('pants')){
    // Two rounded seat volumes blend into a narrower waist and the thighs.
    const pants=[oval([.225,.10,.16],[0,.17,-.025])];
    for(const side of [-1,1])pants.push(oval([.145,.13,.215],[side*.112,.105,.065]));
    for(const side of [-1,1]){
      const hip=[side*.145,.08,-.025],knee=[side*.16,-.02,side===1?-.65:-.60];
      const ankle=[side*.17,side===1?-.66:-.78,side===1?-.94:-.72];
      pants.push(segment(hip,knee,.115,.095),oval([.098,.095,.098],knee),segment(knee,ankle,.095,.07));
    }
    templates.set('pants',bake(pants));
    const seams=[];
    for(const side of [-1,1]){
      const x=side*.112;
      // Pocket stitching follows the curved rear seat rather than floating on a box.
      const points=[[x-.05,.155,.258],[x+.05,.155,.258],[x+.047,.075,.270],[x,.045,.255],[x-.047,.075,.270],[x-.05,.155,.258]];
      for(let i=0;i<points.length-1;i++)seams.push(segment(points[i],points[i+1],.004,.004));
    }
    templates.set('denim seams',bake(seams));
    const shoes=[],rubber=[];
    for(const side of [-1,1]){
      const center=side===1?GARY_SEATED_CONTACT.rightShoe:[-.17,-.835,-.79],angle=side===1?GARY_SEATED_CONTACT.pedalAngle:0;
      const upper=oval([.098,.07,.18],[0,0,0]);upper.rotateX(angle);upper.translate(...center);shoes.push(upper);
      const sole=box([.195,.025,.35],[0,-.043,0]);sole.rotateX(angle);sole.translate(...center);rubber.push(sole);
    }
    rubber.push(box([.14,.035,.23],GARY_SEATED_CONTACT.pedal,GARY_SEATED_CONTACT.pedalAngle));
    // Suspended accelerator and wider brake face toward the driver, below the dash.
    rubber.push(box([.28,.035,.22],[-.17,-.68,-1.07],.8));
    for(const x of [-.17,.17])rubber.push(segment([x,-.39,-1.15],[x,x>0?-.75:-.68,-1.08],.018,.018));
    templates.set('shoes',bake(shoes));templates.set('rubber',bake(rubber));
  }
  const group=new THREE.Group();group.name='Gary seated hips, bent legs and gas pedal';
  for(const [key,mat] of [['pants',pantsMaterial],['shoes',shoeMaterial],['rubber',rubberMaterial],['denim seams',denimDetailMaterial]]){
    const mesh=new THREE.Mesh(templates.get(key),mat);mesh.name=`Gary ${key}`;group.add(mesh);
  }
  return group;
}

export function buildGaryHair() {
  if(!templates.has('hair')){
    const vertices=[],indices=[],rows=6,cols=20;
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const v=row/rows,a=col/cols*Math.PI*2,front=Math.max(0,Math.cos(a)),side=Math.abs(Math.sin(a));
      const edge=.64+.30*front**3+.15*side**3+.16*side**2*front;
      const theta=v*Math.acos((edge-.75)/.315),ridge=1+.012*Math.cos(a*8+v*3);
      vertices.push(Math.sin(a)*Math.sin(theta)*.305*ridge,
        .75+Math.cos(theta)*.315,-Math.cos(a)*Math.sin(theta)*.305*ridge+.018*(1-v));
    }
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);
    }
    const crown=new THREE.BufferGeometry();crown.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));crown.setIndex(indices);crown.computeVertexNormals();
    const parts=[crown,oval([.145,.115,.13],[0,.94,.32]),oval([.075,.065,.065],[.015,.915,.425])];
    const color=new THREE.Color(),brown=new THREE.Color(0x514235),gray=new THREE.Color(0xaaa69b);
    for(const g of parts){
      const p=g.attributes.position,colors=new Float32Array(p.count*3);
      for(let i=0;i<p.count;i++){
        const temple=Math.max(0,Math.min(1,(Math.abs(p.getX(i))-.19)/.09))*Math.max(0,Math.min(1,(.98-p.getY(i))/.13));
        color.copy(brown).lerp(gray,temple*.5);colors.set([color.r,color.g,color.b],i*3);
      }
      g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    }
    templates.set('hair',bake(parts));
  }
  const mesh=new THREE.Mesh(templates.get('hair'),hairMaterial);mesh.name='Gary swept-back hair and rear bun';return mesh;
}


const sleeveMaterial=material(0xa84a3b),skinMaterial=material(0xd9a26e);
export function buildGaryArms() {
  if(!templates.has('sleeves')){
    const sleeves=[],skin=[];
    for(const side of [-1,1]){
      const shoulder=[side*.225,.65,-.015],elbow=[side*.30,.40,-.29],hand=[side*.18,.32,-.58];
      sleeves.push(segment(shoulder,elbow,.105,.085),oval([.105,.105,.105],shoulder));
      skin.push(oval([.08,.08,.08],elbow),segment(elbow,hand,.078,.06));
      skin.push(oval([.038,.06,.034],[side*.235,1.008,.013]));
    }
    templates.set('sleeves',bake(sleeves));templates.set('forearms',bake(skin));
  }
  const group=new THREE.Group();group.name='Gary sleeves, forearms and ears';
  group.add(new THREE.Mesh(templates.get('sleeves'),sleeveMaterial),new THREE.Mesh(templates.get('forearms'),skinMaterial));return group;
}


// Keep the existing outer chassis envelope but open the space beneath the
// dashboard. A solid 1.30m-high slab cannot accommodate adult lower legs.
export function buildGaryFootwellGeometry() {
  if(!templates.has('footwell')) {
    const pieces=[box([2.6,.45,2.6],[0,.625,-.8]),
      box([2.6,.45,1.05],[0,1.075,-.025]),box([2.6,.45,.35],[0,1.075,-1.925])];
    for(const side of [-1,1])pieces.push(box([.10,.45,1.2],[side*1.25,1.075,-1.15]));
    const g=bake(pieces);g.translate(0,-.85,.8);templates.set('footwell',g);
  }
  return templates.get('footwell');
}


const floorMaterial=material(0x30363b);
export function buildGaryFootwellLiner() {
  if(!templates.has('floor liner'))templates.set('floor liner',bake([box([2.38,.004,1.20],[0,.852,-1.15])]));
  const mesh=new THREE.Mesh(templates.get('floor liner'),floorMaterial);mesh.name='Dark gray footwell floor';return mesh;
}
