// Activity-owned trajectory/cache data. No scene, renderer, audio or scheduling.
const smoothstep=(x,min,max)=>{if(x<=min)return 0;if(x>=max)return 1;const t=(x-min)/(max-min);return t*t*(3-2*t);};

export function createHealingArtsMotion(layout,managed=false) {
  const count=layout.participantCount??layout.participants.filter(p=>!p.dj).length;
  const positions=new Float32Array(count*2);
  const participants=layout.participants.map((p,i)=>{
    if(!p.dj){positions[i*2]=p.x;positions[i*2+1]=p.z;}
    return {...p,mix:0,currentX:p.dj?p.x:positions[i*2],currentZ:p.dj?p.z:positions[i*2+1],heading:p.yaw};
  });
  return {participants,participantCount:count,positions,poleColliders:(layout.poleColliders??[]).map(p=>({...p})),managed,nightMix:0};
}

export function sampleHealingArtsMotion(u,time,nightness) {
  const n=smoothstep(Number.isFinite(nightness)?nightness:0,.2,.75);
  const t=Number.isFinite(time)?Math.max(0,time):0;
  u.nightMix=n;
  const positions = u.positions, count = u.participantCount;
  for (let i = 0; i < count; i++) {
    const p = u.participants[i], angle = p.orbitPhase + t*p.orbitSpeed;
    const mix = u.managed ? (p.activity === 'dance' ? 1 : 0) : n;
    p.mix = mix;
    const radius = p.lane + .32*Math.sin(t*.19+p.phase*7);
    positions[i*2] = p.x + (Math.cos(angle)*radius-p.x)*mix;
    positions[i*2+1] = p.z + (.5+Math.sin(angle)*radius-p.z)*mix;
    if (u.managed && p.activity === 'dance' && Number.isFinite(p.entryTime) && Number.isFinite(p.entryX) && Number.isFinite(p.entryZ)) {
      const arrival = smoothstep(t-p.entryTime,0,4);
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
  for(let i=0;i<u.participants.length;i++) {
    const p=u.participants[i];
    const px = p.dj ? p.x : positions[i*2], pz = p.dj ? p.z : positions[i*2+1];
    const angle = p.orbitPhase + t*p.orbitSpeed;
    const targetHeading = p.dj ? 0 : Math.atan2(-Math.sin(angle)*p.orbitSpeed, Math.cos(angle)*p.orbitSpeed);
    const heading = p.yaw + Math.atan2(Math.sin(targetHeading-p.yaw),Math.cos(targetHeading-p.yaw))*(p.dj ? n : p.mix);
    const c = Math.cos(heading), s = Math.sin(heading);
    p.currentX = px; p.currentZ = pz; p.heading = heading;
  }
  return u;
}

// Standalone previews own this cache outside the model, just as activities do.
export function sampleHealingArtsPreview(group,time,nightness) {
  const display=group.userData.healingArts;
  if(!display)return;
  display.motion??=createHealingArtsMotion(display);
  return sampleHealingArtsMotion(display.motion,time,nightness);
}
