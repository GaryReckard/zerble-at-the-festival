import {HULA_HOOP_STYLES,buildHulaHoopGeometry,buildHulaHoopMaterial} from '../people/hoop/appearance.js';
import {makePersonHair} from '../crowdHair.js';
import {bindLocomotion,stridePivot,tickLocomotion} from './personLocomotion.js';
import {sampleClassicHoopMotion} from '../people/hoop/classic.js';
import {createHoopSample} from '../people/hoop/score.js';
import {sampleHoopKnee,sampleHoopAnkle} from '../people/hoop/leg.js';
// Hula-hooper — festival-goer gyrating with a glowing hoop.
//
// Structure:
//   group
//     children[0] = body (Group containing legs/torso/head/arms) — caller tilts this for gyration
//     children[1] = hoopPivot (Group) — caller rotates this for hoop spin; hoop is its child
//   userData.hoopMat — emissive ring material, intensity bumped at night
//   userData.armBands — the two MeshStandardMaterials used for the arms so the
//     caller can keep them roughly synced with the body when desired
//   userData.bodyHeight — feet→shoulder distance (≈1.25); used for arm pose math
//
// The waist mode shares its joint angles and planted-foot targets with the
// ordinary Crowd performer. This preview retains its own smaller proportions.
//
// Tie-dye / festival palette chosen to match the wook/crowd vibe.

import * as THREE from 'three';

const TIE_DYE_PALETTE = [
  0xff4d8d, 0xffd23f, 0x6fcf6a, 0x66d9ff, 0xc77dff,
  0xff7b3c, 0x39d6c4, 0xff5577, 0xb7ff5b, 0xffaef7,
];

export {HULA_HOOP_STYLES,buildHulaHoopGeometry,buildHulaHoopMaterial} from '../people/hoop/appearance.js';

export function buildHulaHooper(rng = Math.random) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);

  const shirtColor = TIE_DYE_PALETTE[Math.floor(rng() * TIE_DYE_PALETTE.length)];
  const accentColor = TIE_DYE_PALETTE[Math.floor(rng() * TIE_DYE_PALETTE.length)];
  const pantsColor = 0x2a2a3a + Math.floor(rng() * 0x101020);
  const skinColor = [0xe6c098, 0xd1a070, 0xb37e5a, 0x8a5a3a][Math.floor(rng() * 4)];

  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColor, roughness: 0.9, flatShading: true,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtColor, roughness: 0.85, flatShading: true,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor, roughness: 0.9, flatShading: true,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor, roughness: 0.85, flatShading: true,
  });

  // ----- Two-segment legs and shoes, at the preview's original height -----
  const walkLegs=[],legRigs=[];
  const scale=.85,length=.325*scale;
  const legGeo=new THREE.CylinderGeometry(.09,.09,length,8);
  const shoeGeo=new THREE.BoxGeometry(.16*scale,.07*scale,.24*scale);
  const shoeMat=new THREE.MeshStandardMaterial({color:0x111,roughness:.8});
  for(const side of ['left','right']){
    const sx=side==='left'?-1:1,upper=new THREE.Mesh(legGeo,pantsMat),lower=new THREE.Mesh(legGeo,pantsMat),shoe=new THREE.Mesh(shoeGeo,shoeMat);
    upper.castShadow=true;
    body.add(upper,lower,shoe);
    const pivot=stridePivot(body,sx*.12*scale,.65*scale,upper,lower,shoe);
    walkLegs.push(pivot);legRigs.push({side,upper,lower,shoe,pivot});
  }

  // ----- Torso (crop top vibe — short capsule above bare midriff implied) -----
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.45, 4, 8),
    shirtMat,
  );
  torso.position.y = 0.95;
  torso.castShadow = true;
  body.add(torso);

  // ----- Articulated raised arms -----
  const armRigs={};
  const armLength=.29*scale,armGeo=new THREE.CapsuleGeometry(.055,armLength-.11,3,6),handGeo=new THREE.IcosahedronGeometry(.075,0);
  for(const side of ['left','right']){
    const sx=side==='left'?-1:1,shoulder=new THREE.Group(),elbow=new THREE.Group();
    shoulder.position.set(sx*.30*scale,1.35*scale,0);elbow.position.y=-armLength;
    const upper=new THREE.Mesh(armGeo,shirtMat),lower=new THREE.Mesh(armGeo,shirtMat),hand=new THREE.Mesh(handGeo,skinMat);
    upper.position.y=lower.position.y=-armLength/2;hand.position.y=-armLength;
    shoulder.add(upper,elbow);elbow.add(lower,hand);body.add(shoulder);armRigs[side]={shoulder,elbow};
  }

  // ----- Head -----
  const headRig=new THREE.Group();headRig.position.y=1.43;body.add(headRig);
  const head = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.24, 1),
    skinMat,
  );
  head.position.y = 1.55-1.43;
  head.castShadow = true;
  headRig.add(head);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111, roughness: 0.8 });
  for (const ex of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeMat);
    eye.position.set(ex, 1.58-1.43, -0.20);
    headRig.add(eye);
  }

  const hairColor = [0x3a2a1a, 0x6a4a2a, 0xc97a3b, 0xd9a26e, 0x222, 0xff5577][Math.floor(rng() * 6)];
  const hair=makePersonHair({style:'ponytail',color:hairColor,radii:[.24,.24,.24],center:[0,1.55,0]});
  hair.position.y=-1.43;headRig.add(hair);

  // Headband (matches accent)
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.025, 4, 16),
    accentMat,
  );
  band.position.y = 1.65-1.43;
  band.rotation.x = Math.PI / 2;
  headRig.add(band);

  // ----- Hoop -----
  // The hoop sits around the hips/waist. hoopPivot is a child of the
  // top-level group (NOT a child of body) so the caller can tilt body for hip
  // gyration without dragging the hoop with it — the hoop stays roughly
  // horizontal and rotates on its own.
  //
  // Hooping geometry: a real hula hoop doesn't spin centered on the body —
  // its inner edge is in continuous contact with the body at one point, and
  // *that contact rotates around the body* as the hoop revolves. We model
  // that by offsetting the hoop's center from hoopPivot's Y axis by
  // HOOP_OFFSET; hoopPivot.rotation.y then traces the hoop's center on a
  // circle of radius HOOP_OFFSET around the body axis, so the contact point
  // sweeps around the body the way real hooping reads.
  //
  // Math: body torso radius B=0.22 (CapsuleGeometry first arg above), hoop
  // outer R=0.58, tube r=0.035, hoop inner = R-r = 0.545. Max body slack
  // inside the hoop's inner ring before contact is (R-r) - B = 0.325. Body
  // hip can sway up to ~0.17m laterally (bodyGroup rotates around its
  // origin at the feet at ±0.20rad → 0.85*sin(0.20) ≈ 0.169). Choosing
  // HOOP_OFFSET = 0.27 leaves ~5cm nominal clearance and brings the hoop
  // into authentic contact-grazing range when body leans away from the
  // hoop's current angular position. Reads as real hooping, not a halo.
  const hoopPivot = new THREE.Group();
  hoopPivot.position.y = 0.85;       // hip height
  g.add(hoopPivot);

  // Reuse the existing single appearance draw; no extra random consumption.
  const hoopStyle=Math.floor(rng()*HULA_HOOP_STYLES.length);
  const hoopMat=buildHulaHoopMaterial();
  const HOOP_RADIUS = 0.58;
  const HOOP_OFFSET = 0.27;          // hoop center offset from body axis — see comment above
  const hoop = new THREE.Mesh(
    buildHulaHoopGeometry(hoopStyle),
    hoopMat,
  );
  hoop.rotation.x = Math.PI / 2;     // lay flat in the XZ plane
  hoop.position.x = HOOP_OFFSET;     // displace from hoopPivot axis — see comment above
  hoopPivot.add(hoop);

  g.userData.hoopMat = hoopMat;
  g.userData.hoopRadius = HOOP_RADIUS;
  g.userData.hoopPivot = hoopPivot;
  g.userData.bodyGroup = body;
  g.userData.armRigs=armRigs;g.userData.legRigs=legRigs;g.userData.headRig=headRig;
  g.userData.motion=createHoopSample();g.userData.hoopMotionQuat=new THREE.Quaternion();g.userData.hoopMotionEuler=new THREE.Euler();
  g.userData.walkFeet={left:{x:-.13,y:0,z:0,qx:0,qy:0,qz:0,qw:1},right:{x:.13,y:0,z:0,qx:0,qy:0,qz:0,qw:1}};
  // Per-hooper animation params. Picked once per build so every hooper has
  // a slightly different feel (some chill, some going harder). Range tuned
  // to real hooping tempo — hips at ~0.6-1.0 Hz, hoop at ~1.0-1.7 Hz.
  // (We use phase = rad/s. Body sway period = 2π / gyrSpeed.)
  g.userData.gyrSpeed     = 4 + Math.random() * 2.5;   // 4-6.5 rad/s → 0.64-1.03 Hz
  g.userData.hoopSpinMult = 1.3 + Math.random() * 0.7; // hoop is 1.3-2.0× hip rate
  g.userData.phase        = Math.random() * Math.PI * 2;

  bindLocomotion(g,{legs:walkLegs,height:.85,phase:g.userData.phase,pace:.4});
  tickHulaHooper(g,0);
  return g;
}

// Per-frame animation tick. Pure function over the model + a phase value.
// Game (people/hoopers.js) and sandbox (sandbox.html) both call this so the
// motion definition lives in ONE place — no more drift between the two.
// `nightness` (0..1) drives the hoop's emissive bump.
//
// Body motion is a clean elliptical hip orbit (sin/cos at the same rate,
// 90° out of phase) rather than the prior irrational frequency ratio —
// the old math read as chaotic rather than as smooth hooping. The hoop
// spins independently at hoopSpinMult × the hip rate.
export function tickHulaHooper(model, dt, nightness = 0) {
  const u = model.userData;
  if (u.gyrSpeed === undefined) return;       // not a built hooper

  tickLocomotion(model,dt);
  u.phase += dt * u.gyrSpeed;
  const p = u.phase;

  const motion=sampleClassicHoopMotion(p,u.hoopSpinMult,u.motion);
  u.bodyGroup.rotation.set(motion.leanX,0,motion.leanZ);
  const stride=u.locomotion.pose.stride,walking=u.locomotion.pose.active;
  if(walking){
    u.bodyGroup.position.y=u.locomotion.pose.bob+Math.abs(Math.sin(motion.leanZ))*.18
      +Math.abs(Math.sin(motion.leanX))*(.15+.555*Math.abs(Math.sin(stride)));
  }else{
    u.bodyGroup.position.y=motion.rootY*.85;
    for(const rig of u.legRigs)rig.pivot.rotation.set(0,0,0);
  }
  poseClassicLegs(u,walking?u.walkFeet:motion.feet);
  for(const side of ['left','right']){
    const a=motion.arms,rig=u.armRigs[side],left=side==='left';
    rig.shoulder.rotation.set(left?a.leftX:a.x,0,left?a.leftZ:a.z);rig.elbow.rotation.z=left?a.leftElbow:a.elbow;
  }
  u.headRig.rotation.set(motion.headTilt,motion.headYaw,0);
  // Keep the waist orbit in the same presented body frame as the live mode.
  u.hoopPivot.position.set(0,.85,0).applyQuaternion(u.bodyGroup.quaternion).add(u.bodyGroup.position);
  u.hoopMotionQuat.setFromEuler(u.hoopMotionEuler.set(motion.hoopX,motion.hoopY,motion.hoopZ));
  u.hoopPivot.quaternion.copy(u.bodyGroup.quaternion).multiply(u.hoopMotionQuat);

  // Glow — dim by day, bright at night. Caller passes nightness 0..1.
  u.hoopMat.emissiveIntensity = 0.05 + nightness * 3.0;
}

const legStart=new THREE.Vector3(),legEnd=new THREE.Vector3(),legDirection=new THREE.Vector3(),legMidpoint=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
const kneePoint={x:0,y:0,z:0},anklePoint={x:0,y:0,z:0},shoeOffset=new THREE.Vector3();
function placeLegSegment(mesh,start,end,pivot){
  legDirection.subVectors(end,start).normalize();legMidpoint.addVectors(start,end).multiplyScalar(.5).sub(pivot.position);
  mesh.position.copy(legMidpoint);mesh.quaternion.setFromUnitVectors(up,legDirection);
}
function poseClassicLegs(u,feet){
  const scale=.85;
  for(const rig of u.legRigs){
    const foot=feet[rig.side],left=rig.side==='left';sampleHoopKnee(foot,rig.side,kneePoint);sampleHoopAnkle(foot,anklePoint);
    legStart.set(left?-.12*scale:.12*scale,.65*scale,0);legEnd.set(kneePoint.x*scale,kneePoint.y*scale,kneePoint.z*scale);
    placeLegSegment(rig.upper,legStart,legEnd,rig.pivot);
    legStart.copy(legEnd);legEnd.set(anklePoint.x*scale,anklePoint.y*scale,anklePoint.z*scale);placeLegSegment(rig.lower,legStart,legEnd,rig.pivot);
    rig.shoe.quaternion.set(foot.qx,foot.qy,foot.qz,foot.qw);
    shoeOffset.set(0,.035*scale,-.06*scale).applyQuaternion(rig.shoe.quaternion);
    rig.shoe.position.set(foot.x*scale,foot.y*scale,foot.z*scale).add(shoeOffset).sub(rig.pivot.position);
  }
}
