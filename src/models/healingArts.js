import * as THREE from 'three';
import { register } from '../contextLights.js';

// The open tensile roof and the participant rig are shared by the game and sandbox.
const shared = value => { value.userData.shared = true; return value; };
const BOX = shared(new THREE.BoxGeometry(1, 1, 1));
const TUBE = shared(new THREE.CylinderGeometry(1, 1, 1, 7));
const BALL = shared(new THREE.SphereGeometry(1, 8, 6));
const UP = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D(), direction = new THREE.Vector3();
const color = new THREE.Color();
const materials = new Map();
function mat(hex, extra = {}) {
  const key = `${hex}:${JSON.stringify(extra)}`;
  if (!materials.has(key)) materials.set(key, shared(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, ...extra })));
  return materials.get(key);
}
const PEAKS = [[0, 0], [-5, -4], [5, -4], [-5, 4], [5, 4]];
function roofHeight(x, z) {
  let y = 3.9 + 5.6 * Math.exp(-Math.hypot(x, z) / 2.1);
  for (let i = 1; i < PEAKS.length; i++) y += 4 * Math.exp(-Math.hypot(x - PEAKS[i][0], z - PEAKS[i][1]) / 1.35);
  return y;
}
let roofGeometry, signMaterial;
function healingSignMaterial() {
  if (signMaterial) return signMaterial;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#294d4a'; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#deb977'; ctx.lineWidth = 5; ctx.strokeRect(9, 9, 494, 110);
  ctx.fillStyle = '#fff0c9'; ctx.textAlign = 'center';
  ctx.font = 'bold 47px Georgia'; ctx.fillText('Healing Arts', 256, 65);
  ctx.font = '20px sans-serif'; ctx.fillText('BREATHE • MOVE • CONNECT', 256, 99);
  const texture = shared(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  signMaterial = shared(new THREE.MeshStandardMaterial({ map: texture, roughness: 1, emissive: 0x38554b, emissiveIntensity: .2 }));
  return signMaterial;
}
function canopyGeometry() {
  if (roofGeometry) return roofGeometry;
  const positions = [], indices = [], rings = 32, sides = 96;
  for (let r = 0; r <= rings; r++) {
    for (let s = 0; s <= sides; s++) {
      const a = s / sides * Math.PI * 2, f = r / rings;
      // Each guy-out ends in a sharp fabric tip; the unsupported edge pulls
      // inward and upward between anchors instead of forming a round skirt.
      const arch = Math.abs(Math.sin(a * 3));
      const radius = f * (12 - 3.2 * arch ** .7);
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      const edge = 1.7 + 2.3 * arch ** .8;
      const y = roofHeight(x, z) * (1 - f ** 5) + edge * f ** 5;
      positions.push(x, y, z);
      if (r && s) {
        const b = r * (sides + 1) + s;
        indices.push(b, b - 1, b - sides - 2, b, b - sides - 2, b - sides - 1);
      }
    }
  }
  roofGeometry = new THREE.BufferGeometry();
  roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roofGeometry.setIndex(indices);
  roofGeometry.computeVertexNormals();
  return shared(roofGeometry);
}
function mesh(parent, geo, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const node = new THREE.Mesh(geo, material);
  node.position.set(x, y, z); node.scale.set(sx, sy, sz); parent.add(node);
  return node;
}
function instanceAt(batch, index, x, y, z, sx, sy, sz, rotation = 0) {
  dummy.position.set(x, y, z); dummy.rotation.set(0, rotation, 0); dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix(); batch.setMatrixAt(index, dummy.matrix);
}
function segment(batch, index, ax, ay, az, bx, by, bz, radius) {
  direction.set(bx - ax, by - ay, bz - az);
  dummy.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  dummy.scale.set(radius, direction.length(), radius);
  dummy.quaternion.setFromUnitVectors(UP, direction.normalize());
  dummy.updateMatrix(); batch.setMatrixAt(index, dummy.matrix);
}
// Hip, neck, head, left elbow/hand, right elbow/hand, left knee/foot, right knee/foot.
const POSES = [
  [0,1,0, 0,1.65,0, 0,1.95,0, -.4,1.35,0, -.34,1.03,0, .4,1.35,0, .34,1.03,0, -.19,.52,0, -.2,.09,0, .19,.52,0, .2,.09,0],
  [0,.88,0, 0,1.54,0, 0,1.85,0, -.62,1.48,0, -1.03,1.5,0, .62,1.48,0, 1.03,1.5,0, -.65,.5,0, -.68,.09,0, .46,.48,0, .82,.09,0],
  [0,1.04,0, 0,1.7,0, 0,2.01,0, -.36,2.02,0, -.05,2.35,0, .36,2.02,0, .05,2.35,0, -.19,.54,0, -.2,.09,0, .57,.78,0, .09,.53,0],
  [0,1.02,0, 0,.78,.57, 0,.61,.83, -.3,.43,.61, -.29,.1,.42, .3,.43,.61, .29,.1,.42, -.19,.53,0, -.2,.09,0, .19,.53,0, .2,.09,0],
];
const LIMBS = [[0,1,.23], [1,3,.085], [3,4,.07], [1,5,.085], [5,6,.07], [0,7,.115], [7,8,.095], [0,9,.115], [9,10,.095]];
const SHIRTS = [0xd16c4c, 0x428d89, 0x8e659c, 0xd7aa4d, 0x487b69, 0xb85980];
const SKIN = [0xe5ba94, 0xa16c49, 0x694536, 0xd59a73];

/** Returns an origin-anchored Group. Collider coordinates are local to the group. */
export function buildHealingArts({ rng = () => 0.5 } = {}) {
  const group = new THREE.Group(); group.name = 'Healing Arts';
  const roof = mesh(group, canopyGeometry(), mat(0xf1d8a4, { side: THREE.DoubleSide }), 0, 0, 0);
  roof.castShadow = true; roof.receiveShadow = true;
  const poleColliders = [];
  for (const [x, z] of PEAKS) {
    const height = roofHeight(x, z);
    mesh(group, TUBE, mat(0x6b4930), x, height / 2, z, .075, height, .075);
    mesh(group, TUBE, mat(0x27958c), x, height - .3, z, .22, .58, .22);
    mesh(group, BALL, mat(0xc18a42), x, height + .09, z, .2, .12, .2);
    poleColliders.push({ x, z, radius: .22 });
  }
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, x = Math.cos(a) * 12, z = Math.sin(a) * 12;
    mesh(group, TUBE, mat(0x6b4930), x, .85, z, .055, 1.7, .055);
    poleColliders.push({ x, z, radius: .16 });
  }
  const pennants = new THREE.InstancedMesh(BOX, mat(0xffffff, { side: THREE.DoubleSide }), 48);
  const bulbs = new THREE.InstancedMesh(BALL, mat(0xffdc96, { emissive: 0xffa846, emissiveIntensity: 1.4 }), 48);
  const cables = new THREE.InstancedMesh(TUBE, mat(0x5d4938), 48);
  const palette = [0xd26d4b, 0x2f9b94, 0xe6b85c, 0x806096];
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2, b = (i + 1) / 48 * Math.PI * 2;
    const y = 3.25 - .3 * Math.sin(a * 6) ** 2;
    instanceAt(pennants, i, 6.8 * Math.cos(a), y - .25, 6.8 * Math.sin(a), .28, .42, .025, -a);
    pennants.setColorAt(i, color.setHex(palette[i % 4]));
    instanceAt(bulbs, i, 6.8 * Math.cos(a), y, 6.8 * Math.sin(a), .065, .09, .065);
    segment(cables, i, 6.8 * Math.cos(a), y, 6.8 * Math.sin(a), 6.8 * Math.cos(b), 3.25 - .3 * Math.sin(b * 6) ** 2, 6.8 * Math.sin(b), .012);
  }
  for (const batch of [pennants, bulbs, cables]) { batch.instanceMatrix.needsUpdate = true; group.add(batch); }
  pennants.instanceColor.needsUpdate = true;
  // A readable sign hangs on the open entrance, with enough clearance to drive under.
  mesh(group, BOX, healingSignMaterial(), 0, 3.0, 8.8, 3.6, .9, .075);
  for (const x of [-1.4, 1.4]) mesh(group, TUBE, mat(0x6b4930), x, 3.7, 8.8, .018, .5, .018);
  const participants = [];
  const participantCount = 7 + Math.floor(rng() * 14);
  const spots = [];
  // Offset rows retain the feel of a class, while the outer rows spill into sun.
  for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) {
    const x = (col - 3) * 2.55 + (row % 2) * .5 + (rng() - .5) * .35;
    const z = -3.3 + row * 2.5 + (rng() - .5) * .35;
    if (Math.hypot(x, z) > 11.5 || poleColliders.some(pole => Math.hypot(x-pole.x,z-pole.z) < 1.45)) continue;
    spots.push({x,z});
  }
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  for (let i = 0; i < participantCount; i++) {
    const spot = spots[i];
    participants.push({ x: spot.x, z: spot.z, yaw: (rng()-.5)*.2,
      activity: 'yoga', phase: rng() * .9, orbitPhase: rng()*Math.PI*2,
      orbitSpeed: (.085+rng()*.045)*(i%2 ? 1 : -1), lane: 2.1+(i%3)*1.85,
      shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)], skin: SKIN[Math.floor(rng() * SKIN.length)] });
  }
  const mats = new THREE.InstancedMesh(BOX, mat(0xffffff), participants.length);
  participants.forEach((p, i) => { instanceAt(mats, i, p.x, .035, p.z, 1.35, .055, 2.1, p.yaw); mats.setColorAt(i, color.setHex(palette[i % 4])); });
  mats.instanceMatrix.needsUpdate = true; mats.instanceColor.needsUpdate = true; group.add(mats);
  // One extra participant is the DJ, behind the booth at the back of the canopy.
  participants.push({ x: 0, z: -6.6, phase: 1.7, yaw: 0, shirt: 0x36546e, skin: 0xa16c49, dj: true });
  const bodies = new THREE.InstancedMesh(TUBE, mat(0xffffff), participants.length * LIMBS.length);
  const heads = new THREE.InstancedMesh(BALL, mat(0xffffff), participants.length);
  const hair = new THREE.InstancedMesh(BALL, mat(0x302820), participants.length);
  const glowsticks = new THREE.InstancedMesh(TUBE, mat(0x8effbb, {emissive:0x35ff83,emissiveIntensity:2}), participantCount);
  glowsticks.frustumCulled = false; group.add(glowsticks);
  participants.forEach((p, i) => {
    heads.setColorAt(i, color.setHex(p.skin));
    LIMBS.forEach((_, limb) => bodies.setColorAt(i * LIMBS.length + limb, color.setHex(limb === 0 ? p.shirt : limb > 4 ? 0x36434c : p.skin)));
  });
  bodies.instanceColor.needsUpdate = true; heads.instanceColor.needsUpdate = true;
  // Participants can stretch onto the lawn; avoid stale animated instance bounds.
  for (const batch of [bodies, heads, hair]) { batch.frustumCulled = false; group.add(batch); }
  const booth = new THREE.Group(); group.add(booth);
  mesh(booth, BOX, mat(0x41334c), 0, .65, -5.75, 2.6, 1.3, .8);
  mesh(booth, BOX, mat(0x1d2731), 0, 1.34, -5.75, 2.8, .12, 1);
  for (const x of [-.75, .75]) mesh(booth, TUBE, mat(0x72b9b2), x, 1.42, -5.75, .3, .03, .3);
  for (const x of [-3.2, 3.2]) {
    mesh(booth, BOX, mat(0x292837), x, .85, -5.7, .75, 1.7, .65);
    for (const y of [.5, 1.18]) { const speaker = mesh(booth, TUBE, mat(0x171923), x, y, -5.34, .25, .045, .25); speaker.rotation.x = Math.PI / 2; }
  }
  const glow = mesh(booth, BOX, mat(0xa369bc, { emissive: 0x9a3cb4, emissiveIntensity: 1 }), 0, .75, -5.335, 2.25, .16, .015);
  const light = new THREE.PointLight(0xffc48b, 2, 20, 2);
  light.position.set(0, 3.1, .5); light.castShadow = false; group.add(light); register(light);
  group.userData.healingArts = { footprintRadius: 14, participantCount, light, glowsticks,
    positions: new Float32Array(participantCount*2), poleColliders, participants, mats, bodies, heads, hair, bulbs, booth, glow, nightMix: 0, pose: new Float32Array(33) };
  updateHealingArts(group, 0, 0, 0);
  return group;
}

/** Absolute time keeps poses deterministic through stream unload/reload; dt is reserved. */
export function updateHealingArts(group, dt, time, nightness) {
  const u = group.userData.healingArts;
  if (!u) return;
  const n = THREE.MathUtils.smoothstep(Number.isFinite(nightness) ? nightness : 0, .2, .75);
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  u.nightMix = n; u.mats.visible = true; u.booth.visible = n > .35; u.bulbs.visible = n > .05;
  u.light.intensity = 2 + n * 33;
  const positions = u.positions, count = u.participantCount;
  for (let i = 0; i < count; i++) {
    const p = u.participants[i], angle = p.orbitPhase + t*p.orbitSpeed;
    const mix = u.managed ? (p.activity === 'dance' ? 1 : 0) : n;
    p.mix = mix;
    const radius = p.lane + .32*Math.sin(t*.19+p.phase*7);
    positions[i*2] = p.x + (Math.cos(angle)*radius-p.x)*mix;
    positions[i*2+1] = p.z + (.5+Math.sin(angle)*radius-p.z)*mix;
    if (u.managed && p.activity === 'dance' && Number.isFinite(p.entryTime) && Number.isFinite(p.entryX) && Number.isFinite(p.entryZ)) {
      const arrival = THREE.MathUtils.smoothstep(t-p.entryTime,0,4);
      positions[i*2] = p.entryX+(positions[i*2]-p.entryX)*arrival;
      positions[i*2+1] = p.entryZ+(positions[i*2+1]-p.entryZ)*arrival;
    }
  }
  // Resolve close approaches against neighbours and poles without storing history:
  // seeking, reloading and live playback therefore agree at the same absolute time.
  if (u.managed || n > .01) for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < count; i++) for (let j = i+1; j < count; j++) {
      const pi = u.participants[i], pj = u.participants[j];
      if (u.managed && (pi.activity === 'hidden' || pj.activity === 'hidden' || (!pi.mix && !pj.mix))) continue;
      let dx = positions[j*2]-positions[i*2], dz = positions[j*2+1]-positions[i*2+1];
      let distance = Math.hypot(dx,dz);
      if (distance >= 1.3) continue;
      if (distance < .0001) { dx = .0001; dz = 0; distance = .0001; }
      const push = (1.3-Math.min(distance,1.3))*.5;
      const wi = u.managed && !pi.mix ? 0 : u.managed && !pj.mix ? 2 : 1;
      const wj = u.managed && !pj.mix ? 0 : u.managed && !pi.mix ? 2 : 1;
      positions[i*2] -= dx/distance*push*wi; positions[i*2+1] -= dz/distance*push*wi;
      positions[j*2] += dx/distance*push*wj; positions[j*2+1] += dz/distance*push*wj;
    }
    for (let i = 0; i < count; i++) {
      const p = u.participants[i];
      if (u.managed && p.activity !== 'dance') continue;
      let x = positions[i*2], z = positions[i*2+1];
      for (const pole of u.poleColliders) {
        let dx = x-pole.x, dz = z-pole.z, distance = Math.hypot(dx,dz);
        if (distance >= 1.05) continue;
        if (distance < .0001) { dx = .0001; dz = 0; distance = .0001; }
        x = pole.x+dx/distance*1.05; z = pole.z+dz/distance*1.05;
      }
      // The final night dancefloor is in front of the booth, inside the canopy.
      const limit = 12+(7.2-12)*p.mix;
      const radius = Math.hypot(x,z);
      if (radius > limit) { x *= limit/radius; z *= limit/radius; }
      z = Math.max(z, -4.25);
      positions[i*2] = x; positions[i*2+1] = z;
    }
  }
  for (let i = 0; i < u.participants.length; i++) {
    const p = u.participants[i], cycle = (t / 9 + p.phase) % POSES.length;
    if (p.renderShirt !== p.shirt || p.renderSkin !== p.skin) {
      u.heads.setColorAt(i,color.setHex(p.skin));
      for (let limb=0; limb<LIMBS.length; limb++) u.bodies.setColorAt(i*LIMBS.length+limb,color.setHex(limb===0?p.shirt:limb>4?0x36434c:p.skin));
      u.heads.instanceColor.needsUpdate = true; u.bodies.instanceColor.needsUpdate = true;
      p.renderShirt = p.shirt; p.renderSkin = p.skin;
    }
    const a = POSES[Math.floor(cycle)], b = POSES[(Math.floor(cycle) + 1) % POSES.length];
    const blend = THREE.MathUtils.smoothstep(cycle % 1, .65, 1), pose = u.pose;
    for (let j = 0; j < 33; j++) pose[j] = a[j] + (b[j] - a[j]) * blend;
    const dance = p.dj ? 1 : p.mix, beat = t * 3.8 + p.phase * 6;
    for (let j = 0; j < 11; j++) {
      let x = POSES[0][j * 3], y = POSES[0][j * 3 + 1], z = POSES[0][j * 3 + 2];
      x += Math.sin(beat) * (j < 7 ? .13 : .04); y += Math.max(0, Math.sin(beat * 2)) * .12;
      if (j === 3 || j === 5) { y += .3 + Math.sin(beat + j) * .2; x *= 1.5; }
      if (j === 4 || j === 6) { y += .75 + Math.sin(beat + j) * .25; z += p.dj ? .55 : .12; }
      if (p.dj && (j === 3 || j === 5)) { y = 1.4; z = .25; }
      if (p.dj && (j === 4 || j === 6)) { y = 1.45 + .04 * Math.sin(beat + j); z = .65; x = j === 4 ? -.7 : .7; }
      pose[j * 3] += (x - pose[j * 3]) * dance;
      pose[j * 3 + 1] += (y - pose[j * 3 + 1]) * dance;
      pose[j * 3 + 2] += (z - pose[j * 3 + 2]) * dance;
    }
    const px = p.dj ? p.x : positions[i*2], pz = p.dj ? p.z : positions[i*2+1];
    const angle = p.orbitPhase + t*p.orbitSpeed;
    const targetHeading = p.dj ? 0 : Math.atan2(-Math.sin(angle)*p.orbitSpeed, Math.cos(angle)*p.orbitSpeed);
    const heading = p.yaw + Math.atan2(Math.sin(targetHeading-p.yaw),Math.cos(targetHeading-p.yaw))*(p.dj ? n : p.mix);
    const c = Math.cos(heading), s = Math.sin(heading);
    p.currentX = px; p.currentZ = pz; p.heading = heading;
    // Rotate the complete articulated pose, including the folded head and hair.
    for (let j = 0; j < 11; j++) {
      const x = pose[j*3], z = pose[j*3+2];
      pose[j*3] = x*c+z*s; pose[j*3+2] = -x*s+z*c;
    }
    const hide = p.dj ? n <= .35 : u.managed && p.activity === 'hidden';
    for (let l = 0; l < LIMBS.length; l++) {
      const [start, end, radius] = LIMBS[l], ia = start * 3, ib = end * 3;
      segment(u.bodies, i * LIMBS.length + l, px + pose[ia], pose[ia + 1], pz + pose[ia + 2], px + pose[ib], pose[ib + 1], pz + pose[ib + 2], hide ? 0 : radius);
    }
    if (!p.dj) {
      const matScale = !hide && p.mix < .65 ? 1 : 0;
      instanceAt(u.mats, i, p.x, .035, p.z, 1.35*matScale, .055*matScale, 2.1*matScale, p.yaw);
      const visible = !hide && p.mix > .65 && i%3 === 0;
      const hand = 18, elbow = 15;
      const gx = pose[hand]+(pose[hand]-pose[elbow])*.7;
      const gy = pose[hand+1]+(pose[hand+1]-pose[elbow+1])*.7;
      const gz = pose[hand+2]+(pose[hand+2]-pose[elbow+2])*.7;
      segment(u.glowsticks,i,px+pose[hand],pose[hand+1],pz+pose[hand+2],px+gx,gy,pz+gz,visible?.027:0);
    }
    const size = hide ? 0 : 1;
    instanceAt(u.heads, i, px + pose[6], pose[7], pz + pose[8], .21 * size, .25 * size, .21 * size);
    instanceAt(u.hair, i, px + pose[6], pose[7] + .15, pz + pose[8] - .025, .215 * size, .13 * size, .21 * size);
  }
  for (const batch of [u.bodies, u.heads, u.hair, u.mats, u.glowsticks]) batch.instanceMatrix.needsUpdate = true;
}
