// Frozen characterization oracle from 9eaf2e5d73419f7c926c11ab06882f007b2bf1e4:src/models/healingArts.js.
// Verification only; never imported by the game. Rendering boundaries are stubbed in tests.
const POSES = [
  [0,1,0, 0,1.65,0, 0,1.95,0, -.4,1.35,0, -.34,1.03,0, .4,1.35,0, .34,1.03,0, -.19,.52,0, -.2,.09,0, .19,.52,0, .2,.09,0],
  [0,.88,0, 0,1.54,0, 0,1.85,0, -.62,1.48,0, -1.03,1.5,0, .62,1.48,0, 1.03,1.5,0, -.65,.5,0, -.68,.09,0, .46,.48,0, .82,.09,0],
  [0,1.04,0, 0,1.7,0, 0,2.01,0, -.36,2.02,0, -.05,2.35,0, .36,2.02,0, .05,2.35,0, -.19,.54,0, -.2,.09,0, .57,.78,0, .09,.53,0],
  [0,1.02,0, 0,.78,.57, 0,.61,.83, -.3,.43,.61, -.29,.1,.42, .3,.43,.61, .29,.1,.42, -.19,.53,0, -.2,.09,0, .19,.53,0, .2,.09,0],
];
const LIMBS = [[0,1,.23], [1,3,.085], [3,4,.07], [1,5,.085], [5,6,.07], [0,7,.115], [7,8,.095], [0,9,.115], [9,10,.095]];
const SHIRTS = [0xd16c4c, 0x428d89, 0x8e659c, 0xd7aa4d, 0x487b69, 0xb85980];
const SKIN = [0xe5ba94, 0xa16c49, 0x694536, 0xd59a73];

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
