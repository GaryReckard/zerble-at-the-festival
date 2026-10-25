import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Zerble } from './zerble.js';
import { terrainReplayInput, TERRAIN_REPLAY_SECONDS } from './terrainDriving.js';
import { Sound } from './sound.js';
import { PERF } from './perf.js';
import { sampleTerrain as sampleFixture, terrainVertexHeight as fixtureVertex, TERRAIN_BOUNDS, TERRAIN_STOPS as FIXTURE_STOPS } from './terrainSurface.js';
import { sampleTerrain as sampleWorld, setTerrainEnabled } from './worldgen/terrain.js';
import { setSessionSeed } from './rng.js';
const params = new URLSearchParams(location.search);
const worldMode = params.get('surface') === 'world';
const finiteParam = (key, fallback) => params.has(key) && Number.isFinite(Number(params.get(key))) ? Number(params.get(key)) : fallback;
const worldX = Math.round(finiteParam('x', 620) / 10) * 10, worldZ = Math.round(finiteParam('z', 180) / 10) * 10;
if (worldMode) { setSessionSeed(finiteParam('seed', 1977)); setTerrainEnabled(true); }
function sampleTerrain(x,z,out={}) {
  if (!worldMode) return sampleFixture(x,z,out);
  sampleWorld(x+worldX,z+worldZ,out);
  out.traversable = out.traversable && x >= -57 && x <= 57 && z >= -417 && z <= 32;
  return out;
}
const terrainVertexHeight = worldMode ? (x,z)=>sampleWorld(x+worldX,z+worldZ).height : fixtureVertex;
const TERRAIN_STOPS = worldMode ? FIXTURE_STOPS.map((p,i)=>({z:p.z,name:`World sample ${i+1} · ${worldX}, ${worldZ+p.z}`})) : FIXTURE_STOPS;

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas: $('course'), antialias: PERF.antialias });
renderer.setPixelRatio(Math.min(devicePixelRatio, PERF.pixelRatioCap));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enabled = false; orbit.maxDistance = 400; orbit.maxPolarAngle = Math.PI * 0.47;
const ambient = new THREE.HemisphereLight(0xd8f3ff, 0x56442d, 2.4);
const sun = new THREE.DirectionalLight(0xffead0, 2.8);
sun.position.set(-70, 100, 30); scene.add(ambient, sun);
const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
const meshes = [];
const allocationStart = performance.now();
// Independently built strips share world-space vertices at every 80m seam.
for (let z0 = TERRAIN_BOUNDS.minZ; z0 < TERRAIN_BOUNDS.maxZ; z0 += 80) {
  const z1 = Math.min(z0 + 80, TERRAIN_BOUNDS.maxZ);
  const positions = [], colors = [], indices = [], width = 121;
  for (let z = z0; z <= z1; z++) for (let x = -60; x <= 60; x++) {
    const y = terrainVertexHeight(x, z);
    positions.push(x, y, z);
    const route = Math.abs(x) < 6;
    const color = new THREE.Color(route ? 0xb6b27d : 0x6d9757);
    color.multiplyScalar(0.92 + 0.08 * Math.cos(x * 0.33) * Math.cos(z * 0.17));
    colors.push(color.r, color.g, color.b);
  }
  for (let row = 0; row < z1 - z0; row++) for (let col = 0; col < 120; col++) {
    const a = row * width + col, b = a + 1, c = a + width, d = c + 1;
    if (worldMode) indices.push(a, c, b, b, c, d);
    else indices.push(a, d, b, a, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, terrainMaterial); scene.add(mesh); meshes.push(mesh);
}
const cart = new Zerble(); cart.surfaceSampler = sampleTerrain; scene.add(cart.root);
// Physics remains fixed-step; presentation interpolates the last two solved
// poses so an uneven display cadence cannot expose whole simulation steps.
function makePose() {
  return { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), heading: 0,
    wheels: cart.wheels.map(() => ({ y: 0, spin: 0, steer: 0 })) };
}
const previousPose = makePose(), currentPose = makePose();
let cameraHeading = 0;
function capturePose(out) {
  out.position.copy(cart.position); out.quaternion.copy(cart.root.quaternion); out.heading = cart.heading;
  cart.wheels.forEach((wheel, i) => {
    out.wheels[i].y = wheel.group.position.y;
    out.wheels[i].spin = wheel.spin.rotation.x;
    out.wheels[i].steer = wheel.group.rotation.y;
  });
}
function presentPose(alpha) {
  cart.position.lerpVectors(previousPose.position, currentPose.position, alpha);
  cart.root.quaternion.slerpQuaternions(previousPose.quaternion, currentPose.quaternion, alpha);
  cameraHeading = THREE.MathUtils.lerp(previousPose.heading, currentPose.heading, alpha);
  cart.wheels.forEach((wheel, i) => {
    const a = previousPose.wheels[i], b = currentPose.wheels[i];
    wheel.group.position.y = THREE.MathUtils.lerp(a.y, b.y, alpha);
    wheel.spin.rotation.x = THREE.MathUtils.lerp(a.spin, b.spin, alpha);
    wheel.group.rotation.y = THREE.MathUtils.lerp(a.steer, b.steer, alpha);
  });
}
function restorePhysicsPose() {
  cart.position.copy(currentPose.position); cart.root.quaternion.copy(currentPose.quaternion);
  cart.wheels.forEach((wheel, i) => {
    const pose = currentPose.wheels[i];
    wheel.group.position.y = pose.y; wheel.spin.rotation.x = pose.spin; wheel.group.rotation.y = pose.steer;
  });
}
// Shadows are deliberately off in this bounded proof, including the cart.
cart.root.traverse(n => { n.castShadow = false; });
const allocationMs = performance.now() - allocationStart;
const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 5);
const poleMat = new THREE.MeshStandardMaterial({ color: 0xf4dca1 });
const flagGeo = new THREE.ConeGeometry(0.48, 1.1, 3);
const flagMat = new THREE.MeshStandardMaterial({ color: 0xf6b855, emissive: 0x79511a, emissiveIntensity: 0.35 });
const markers = new THREE.InstancedMesh(poleGeo, poleMat, 86);
const flags = new THREE.InstancedMesh(flagGeo, flagMat, 86);
const dummy = new THREE.Object3D(); let marker = 0;
for (let z = 10; z >= -410; z -= 10) for (const x of [-7, 7]) {
  dummy.position.set(x, sampleTerrain(x, z).height + 1.2, z); dummy.updateMatrix(); markers.setMatrixAt(marker, dummy.matrix);
  dummy.position.y += 1.4; dummy.updateMatrix(); flags.setMatrixAt(marker++, dummy.matrix);
}
markers.instanceMatrix.needsUpdate = true; flags.instanceMatrix.needsUpdate = true; scene.add(markers, flags);
const labelTextures = [];
for (const [i, stop] of TERRAIN_STOPS.entries()) {
  const option = document.createElement('option'); option.value = i; option.textContent = stop.name; $('section').append(option);
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#233e37'; ctx.fillRect(0, 0, 768, 128);
  ctx.strokeStyle = '#f5c66d'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 760, 120);
  ctx.fillStyle = '#fff4da'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(stop.name.split(' · ')[0].toUpperCase(), 384, 80);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; labelTextures.push(map);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map }));
  sign.position.set(-12, sampleTerrain(-12, stop.z).height + 5, stop.z); sign.scale.set(12, 2, 1); scene.add(sign);
}
let frameHandle = 0, disposed = false, audioEnabled = false;
let night = false, paused = false, replay = false, replayTime = 0, last = 0, accumulator = 0, elapsed = 0;
const keys = new Set(), held = new Set();
const target = new THREE.Vector3(), desired = new THREE.Vector3(), point = new THREE.Vector3();
const probe = {}; let snapCamera = true;
function reset(index = 0) {
  const stop = TERRAIN_STOPS[index] || TERRAIN_STOPS[0];
  cart.position.set(0, 0, stop.z); cart.heading = 0; cart.speed = 0; cart.groundOnSurface();
  capturePose(previousPose); capturePose(currentPose); cameraHeading = cart.heading; accumulator = 0;
  replay = false; replayTime = 0; keys.clear(); held.clear(); snapCamera = true;
  $('section').value = index; $('replay').textContent = 'Run repeatable drive';
}
function setNight(value) {
  night = value; scene.background = new THREE.Color(night ? 0x101e35 : 0xa8d8e2);
  scene.fog = new THREE.Fog(scene.background, 170, 600);
  ambient.intensity = night ? 0.75 : 2.4; sun.intensity = night ? 0.5 : 2.8;
  sun.color.setHex(night ? 0x8ab9ff : 0xffead0);
  $('night').textContent = night ? 'Midnight → Noon' : 'Noon → Midnight';
}
function setPaused(value) { paused = value; $('pause').textContent = paused ? 'Resume driving' : 'Pause'; }
$('section').onchange = () => { reset(Number($('section').value)); $('section').blur(); };
$('reset').onclick = () => reset(Number($('section').value));
$('night').onclick = () => setNight(!night);
$('pause').onclick = () => setPaused(!paused);
$('audio').onclick = () => {
  // Keep the existing iOS unlock chain synchronously inside this tap.
  Sound.init();
  audioEnabled = !audioEnabled;
  Sound.setMuted(!audioEnabled);
  $('audio').textContent = audioEnabled ? 'Engine sound: on' : 'Enable engine sound';
  $('audio').setAttribute('aria-pressed', String(audioEnabled));
};
$('wire').onchange = () => { terrainMaterial.wireframe = $('wire').checked; $('wire').blur(); };
$('view').onchange = () => {
  orbit.enabled = $('view').value === 'orbit'; snapCamera = true; $('view').blur();
  if (orbit.enabled) { orbit.target.copy(cart.position); camera.position.copy(cart.position).add(new THREE.Vector3(32, 28, 35)); orbit.update(); }
};
$('replay').onclick = () => { reset(); replay = true; setPaused(false); $('replay').textContent = 'Repeatable drive running…'; };
const accepted = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyR']);
addEventListener('keydown', e => {
  if (/INPUT|SELECT|BUTTON/.test(e.target.tagName) || !accepted.has(e.code)) return;
  e.preventDefault(); if (audioEnabled) Sound.resume(); keys.add(e.code); if (e.code === 'KeyR') reset(Number($('section').value));
  replay = false; $('replay').textContent = 'Run repeatable drive';
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); held.clear(); });
document.addEventListener('visibilitychange', () => { keys.clear(); held.clear(); last = 0; Sound.setMuted(!audioEnabled || document.hidden); if (!document.hidden && audioEnabled) Sound.resume(); });
for (const button of document.querySelectorAll('button')) button.addEventListener('click', () => button.blur());
for (const button of document.querySelectorAll('[data-drive]')) {
  button.onpointerdown = e => { e.preventDefault(); if (audioEnabled) Sound.resume(); button.setPointerCapture(e.pointerId); held.add(button.dataset.drive); replay = false; };
  button.onpointerup = button.onpointercancel = button.onlostpointercapture = () => held.delete(button.dataset.drive);
}
const down = (...codes) => codes.some(code => keys.has(code) || held.has(code));
function clearCameraSegment(eye, aim) {
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i <= 24; i++) {
    const t = i / 24; point.lerpVectors(aim, eye, t);
    const clearance = sampleTerrain(point.x, point.z, probe).height + 0.8 - point.y;
    if (clearance > 0) eye.y += clearance / t;
  }
}
function updateCamera(dt) {
  target.copy(cart.position); target.y += 1.6;
  if (orbit.enabled) { orbit.update(); clearCameraSegment(camera.position, orbit.target); camera.lookAt(orbit.target); return; }
  if ($('view').value === 'overview') desired.copy(cart.position).add(point.set(50, 80, 70));
  else desired.copy(cart.position).add(point.set(Math.sin(cameraHeading) * 15, 7, Math.cos(cameraHeading) * 15));
  // Clear the desired segment, then the actual smoothed segment as well.
  clearCameraSegment(desired, target);
  camera.position.lerp(desired, snapCamera ? 1 : 1 - Math.exp(-6 * dt)); snapCamera = false;
  clearCameraSegment(camera.position, target);
  camera.lookAt(target);
}
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize(); setNight(false); reset();
// A visible verification control tests the actual Three.js meshes and cart.
$('verify').onclick = () => {
  const saved = { position: cart.position.clone(), heading: cart.heading, speed: cart.speed };
  const ray = new THREE.Raycaster();
  let meshError = 0, contactError = 0, samples = 0, misses = 0, poses = 0;
  const down = new THREE.Vector3(0, -1, 0), origin = new THREE.Vector3();
  try {
    scene.updateMatrixWorld(true);
    for (const stop of TERRAIN_STOPS) for (const heading of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
      cart.position.set(0, 0, stop.z); cart.heading = heading; cart.groundOnSurface();
      contactError = Math.max(contactError, cart.contactError);
      for (const wheel of cart.wheels) {
        origin.copy(wheel.group.position).applyMatrix4(cart.root.matrixWorld);
        const expected = sampleTerrain(origin.x, origin.z).height;
        origin.y = 100; ray.set(origin, down);
        const hit = ray.intersectObjects(meshes, false)[0];
        if (!hit) misses++; else meshError = Math.max(meshError, Math.abs(hit.point.y - expected));
        samples++;
      }
    }
    // Include off-route transitions and strip boundaries, where a centered
    // demonstration alone could conceal a suspension limit.
    for (const x of [-40, 0, 40]) for (let z = -410; z <= 20; z += 10) {
      if (!sampleTerrain(x, z).traversable) continue;
      for (const heading of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
        cart.position.set(x, 0, z); cart.heading = heading; cart.groundOnSurface();
        contactError = Math.max(contactError, cart.contactError); poses++;
      }
    }
    const pass = !misses && meshError < 0.02 && contactError < 0.02;
    $('verification').textContent = `${pass ? 'PASS' : 'FAIL'} · ${samples} wheel rays + ${poses} support poses · mesh error ${(meshError * 100).toFixed(4)} cm · contact residual ${(contactError * 100).toFixed(4)} cm · ${misses} misses`;
  } finally {
    cart.position.copy(saved.position); cart.heading = saved.heading; cart.speed = saved.speed; cart.groundOnSurface();
  }
};
const input = { throttle: 0, steer: 0, boost: false, brake: false };
function frame(now) {
  if (disposed) return;
  frameHandle = requestAnimationFrame(frame);
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0; last = now;
  if (document.hidden) return;
  if (!paused) {
    restorePhysicsPose();
    accumulator += dt;
    while (accumulator >= 1 / 120) {
      input.throttle = +down('KeyW','ArrowUp','BoostDrive') - +down('KeyS','ArrowDown');
      input.steer = +down('KeyA','ArrowLeft') - +down('KeyD','ArrowRight');
      input.boost = down('ShiftLeft','ShiftRight','BoostDrive'); input.brake = down('Space');
      if (replay) {
        replayTime += 1 / 120;
        terrainReplayInput(replayTime, input);
        if (replayTime >= TERRAIN_REPLAY_SECONDS) { replay = false; $('replay').textContent = 'Replay complete · run again'; }
      }
      capturePose(previousPose);
      cart.update(1 / 120, input, night ? 1 : 0); accumulator -= 1 / 120;
      capturePose(currentPose);
    }
    presentPose(accumulator * 120);
  }
  Sound.setEngineSpeed(paused ? 0 : cart.speed, !paused && cart.isBoosting ? 1 : 0);
  updateCamera(dt); renderer.render(scene, camera); elapsed += dt;
  if (elapsed > 0.1) {
    elapsed = 0;
    const d = -cart.position.z;
    const section = d < 30 ? 'Level run-up' : d < 125 ? 'Ascent' : d < 150 ? 'Crest' : d < 230 ? 'Descent' : d < 300 ? 'Sideways slope' : d < 350 ? 'Plateau approach' : 'Level plateau';
    $('location').textContent = section;
    $('speed').textContent = (cart.speed * 3.6).toFixed(1);
    $('boost-state').textContent = !paused && cart.isBoosting ? 'BOOST ACTIVE' : 'Hold Shift + forward to boost';
    $('grade').textContent = ((cart.terrainGrade || 0) * 100).toFixed(1) + '%';
    const surface = sampleTerrain(cart.position.x, cart.position.z, probe);
    $('cross').textContent = ((surface.dx * Math.cos(cart.heading) - surface.dz * Math.sin(cart.heading)) * 100).toFixed(1) + '%';
    $('height').textContent = cart.position.y.toFixed(1) + ' m';
    $('contact').textContent = (cart.contactError * 100).toFixed(2) + ' cm';
    $('stats').textContent = `${renderer.info.render.calls} draws · ${renderer.info.render.triangles.toLocaleString()} triangles · ${PERF.name || 'auto'} · built in ${allocationMs.toFixed(0)} ms`;
    $('progress').style.width = Math.max(0, Math.min(100, (d + 12) / 422 * 100)) + '%';
  }
}
frameHandle = requestAnimationFrame(frame);
// Read-only evidence for manual/devtools inspection. Replay is a visible control.
window.__terrain = { cart, scene, camera, renderer, sampleTerrain, meshes, allocationMs };
addEventListener('pagehide', () => {
  disposed = true; cancelAnimationFrame(frameHandle); Sound.setMuted(true);
  orbit.dispose(); renderer.dispose();
  const geometries = new Set(), materials = new Set(), textures = new Set(labelTextures);
  scene.traverse(n => { if (n.geometry) geometries.add(n.geometry); for (const m of (Array.isArray(n.material) ? n.material : n.material ? [n.material] : [])) materials.add(m); });
  for (const m of materials) { for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); if (!m.userData.shared) m.dispose(); }
  for (const g of geometries) if (!g.userData.shared) g.dispose();
  for (const t of textures) if (!t.userData.shared) t.dispose();
}, { once: true });

// A cached document cannot reuse the resources released on pagehide.
addEventListener('pageshow', event => { if (event.persisted && disposed) location.reload(); });
