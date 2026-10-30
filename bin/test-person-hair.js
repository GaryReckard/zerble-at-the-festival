#!/usr/bin/env node
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {getPersonHairGeometry,copyPersonHairGeometry,makePersonHair} from '../src/crowdHair.js';
import {disposeSceneResources} from '../src/people/sceneResources.js';
// These modules consult the tier on import; the geometry assertions use real Three.js.
globalThis.window={innerWidth:1200,innerHeight:800,__perfProfile:'low',addEventListener(){}};
const gradient={addColorStop(){}};
const context=new Proxy({}, {get:(_t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>gradient:k==='measureText'?()=>({width:50}):()=>{},set:()=>true});
globalThis.document={createElement:()=>({getContext:()=>context})};
const {buildKid}=await import('../src/models/kid.js');
const {buildFrisbeePlayer}=await import('../src/models/frisbeePlayer.js');
const {buildHulaHooper}=await import('../src/models/hulaHooper.js');
const {buildWook}=await import('../src/models/wook.js');
const {buildBo}=await import('../src/models/bo.js');
const {buildMonk}=await import('../src/models/monk.js');
const {buildPerformer}=await import('../src/models/performer.js');
const {buildBandMember}=await import('../src/models/bandMember.js');
const {buildParasolMarshal}=await import('../src/models/parasolMarshal.js');
const {buildSimpleNPC,buildPuppet}=await import('../src/models/puppet.js');
const {buildApronCook,buildTom}=await import('../src/models/sugarShack.js');
const {buildFireDancer,buildHandDrummer,buildFirekeeper,buildSpotter}=await import('../src/models/tribalFigures.js');
const {buildOneWheelRider}=await import('../src/models/oneWheelRider.js');
const {buildCanoe}=await import('../src/models/canoe.js');
const {buildHealingArts,updateHealingArts}=await import('../src/models/healingArts.js');
const {Zerble}=await import('../src/zerble.js');
const families=[
 ['children',r=>buildKid(r)],['frisbee',r=>buildFrisbeePlayer(r)],['hoopers',r=>buildHulaHooper(r)],
 ['wooks',r=>buildWook(r)],['Bo',()=>buildBo()],['monks',()=>buildMonk()],
 ['performers',r=>buildPerformer('guitar',r)],['band',()=>buildBandMember('trumpet',37)],
 ['marshal',()=>buildParasolMarshal()],['shopkeepers',()=>buildSimpleNPC(0x558877,0xc98e68)],
 ['parade carriers',()=>buildPuppet('heron',37)],['cooks',r=>buildApronCook(r)],['Tom',()=>buildTom()],
 ['fire dancers',r=>buildFireDancer(r).group],['hand drummers',r=>buildHandDrummer(r).group],
 ['firekeepers',r=>buildFirekeeper(r).group],['spotters',r=>buildSpotter(r).group],
 ['one-wheel riders',r=>buildOneWheelRider({rng:r})],
 ['canoe paddlers',r=>{const g=new THREE.Group();buildCanoe(g,r);return g;}],
 ['yoga and DJ',r=>{const g=buildHealingArts({rng:r});updateHealingArts(g,0,0,1);return g;}],
 ['cart driver',()=>{const owner={root:new THREE.Group()};Zerble.prototype._buildDriver.call(owner);return owner.root;}],
];
let models=0;
for(const [name,build] of families)for(const roll of [.1,.4,.8]){
 const model=build(()=>roll);model.updateMatrixWorld(true);
 let vertices=0;
 model.traverse(o=>{
  if(!o.geometry)return;
  const p=o.geometry.attributes.position;vertices+=p.count;
  assert(p.array.every(Number.isFinite),`${name} invalid vertices`);
  assert(o.matrixWorld.elements.every(Number.isFinite),`${name} invalid transform`);
  if(o.name.startsWith('Hair:')){
   assert(o.geometry.userData.shared&&o.material.userData.shared,`${name} hair must share resources`);
   assert.equal(o.castShadow,false,`${name} adds a hair shadow caster`);
  }
 });
 assert(vertices>0,name);disposeSceneResources(model);models++;
}
// One child's teardown must not invalidate another family using the same style.
const a=makePersonHair(),b=makePersonHair();let disposed=0;
a.geometry.addEventListener('dispose',()=>disposed++);a.material.addEventListener('dispose',()=>disposed++);
disposeSceneResources(a);assert.equal(disposed,0);assert.equal(a.geometry,b.geometry);assert.equal(a.material,b.material);
for(const style of ['cropped','curls','long','ponytail','bun','braids','close']){
 const shared=getPersonHairGeometry(style),copy=copyPersonHairGeometry(style,[.18,.22,.16],[0,1,0],Math.PI);
 assert.equal(shared.userData.shared,true);assert(!copy.userData.shared);assert.notEqual(copy.attributes.position.array,shared.attributes.position.array);copy.dispose();
}
// Check front/back adaptation independently: Bo faces +Z and the rider faces +X.
for(const yaw of [0,Math.PI,-Math.PI/2]){
 const g=copyPersonHairGeometry('ponytail',[.26,.26,.26],[0,0,0],yaw);g.computeBoundingBox();
 const back=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),yaw),p=g.attributes.position;
 let extent=-Infinity;for(let i=0;i<p.count;i++)extent=Math.max(extent,p.getX(i)*back.x+p.getZ(i)*back.z);
 assert(extent>.38,'tail must follow the local rear direction');g.dispose();
}
// The specialized renderers that bake vertex colors must retain their adapter.
for(const file of ['bo','wook','performer','monk','oneWheelRider'])assert(readFileSync(new URL(`../src/models/${file}.js`,import.meta.url),'utf8').includes('copyPersonHairGeometry'),`${file} missed the shared hair builder`);
console.log(`PASS ${models} real models across ${families.length} person families; finite geometry/transforms, shared disposal, adapted orientations and all seven styles.`);

// Sample crown/nape rays against smooth skulls too, not only faceted crowd heads.
const ray=new THREE.Raycaster(),direction=new THREE.Vector3();
for(const style of ['cropped','close','ponytail','long','bun','braids']){
 const mesh=makePersonHair({style,radii:[1,1,1],center:[0,0,0]});mesh.updateMatrixWorld();
 for(let ring=0;ring<5;ring++)for(let i=0;i<24;i++){
  const theta=.15+ring*.32,a=i*Math.PI/12;
  direction.set(Math.sin(a)*Math.sin(theta),Math.cos(theta),-Math.cos(a)*Math.sin(theta));
  if(direction.y<.7&&direction.z<.4)continue;
  ray.set(direction.clone().multiplyScalar(3),direction.clone().negate());
  const hit=ray.intersectObject(mesh,false)[0];
  assert(hit&&hit.point.length()>1.005,`${style} exposes the smooth scalp at ${direction.toArray()}`);
 }
}
const rngExpected=JSON.parse(readFileSync(new URL('../verification/hair/rng-baseline.json',import.meta.url)));
for(const [fn,name] of [[buildKid,'buildKid'],[buildFrisbeePlayer,'buildFrisbeePlayer'],[buildHulaHooper,'buildHulaHooper'],[buildWook,'buildWook'],[buildFireDancer,'buildFireDancer'],[buildApronCook,'buildApronCook'],[buildCanoe,'buildCanoe']]){
 for(const [i,roll] of [.1,.4,.8].entries()){let count=0;const rng=()=>{count++;return roll};const model=name==='buildCanoe'?new THREE.Group():fn(rng);if(name==='buildCanoe')fn(model,rng);assert.equal(count,rngExpected[name][i],`${name} changed downstream random draws`);disposeSceneResources(model.group||model);}
}
console.log('PASS crown/nape raycasts against smooth skulls and 21 historical RNG consumption comparisons.');

const {buildGaryLowerBody,buildGaryHair,GARY_SEATED_CONTACT:contact}=await import('../src/models/garyDriver.js');
const lower=buildGaryLowerBody(),garyHair=buildGaryHair();
const pants=lower.children.find(m=>m.name==='Gary pants');pants.geometry.computeBoundingBox();
assert(pants.geometry.boundingBox.min.z<-.65,'Gary has knees and shins forward of his seat');
assert(pants.geometry.boundingBox.min.y<-.28,'Gary has a lower body below the cushion');
const normal=new THREE.Vector3(0,Math.cos(contact.pedalAngle),Math.sin(contact.pedalAngle));
const solePlane=new THREE.Vector3(...contact.rightShoe).dot(normal)-.0555;
const pedalPlane=new THREE.Vector3(...contact.pedal).dot(normal)+.0175;
assert(Math.abs(solePlane-pedalPlane)<1e-9,'right sole rests on the pedal plane');
assert(Math.abs(.105-.13-contact.seatY)<1e-9,'hips rest on the cushion');
garyHair.geometry.computeBoundingBox();assert(garyHair.geometry.boundingBox.max.z>.45,'Gary has a rear bun');
assert(garyHair.geometry.attributes.color,'Gary retains gray temples');
assert.equal(garyHair.castShadow,false);assert(lower.children.every(m=>!m.castShadow));
console.log('PASS Gary: seated hips, bent legs, exact pedal/sole contact, rear bun, gray temples, and no added shadow casters.');
// Validate the actual cart deck under each foot, rather than only nominal offsets.
const cart=new Zerble();cart.root.updateMatrixWorld(true);
const deck=cart.root.getObjectByName('Front chassis deck');
const floorRay=new THREE.Raycaster(new THREE.Vector3(-.38,1.4,-1.35),new THREE.Vector3(0,-1,0));
const floor=floorRay.intersectObject(deck,false)[0];assert(floor&&Math.abs(floor.point.y-.85)<1e-6,'adult footwell must be recessed below the old solid chassis');
const headRig=cart.driver.getObjectByName('Gary head');assert.equal(headRig.scale.x,.85);assert(Math.abs(headRig.position.y+.75*headRig.scale.y-1)<1e-9,'adult torso carries the head higher');
assert(contact.pedal[2]<-1,'accelerator is forward under the dashboard');assert(contact.pedalAngle>.7,'pedal faces the extended foot');
assert(contact.pedal[1]>contact.deckY+.10,'accelerator is suspended above the deck');
assert(pants.geometry.boundingBox.min.y<-.75,'calves extend into the lowered footwell');
disposeSceneResources(cart.root);
console.log('PASS adult driver proportions, actual recessed deck raycast, and forward suspended accelerator.');
