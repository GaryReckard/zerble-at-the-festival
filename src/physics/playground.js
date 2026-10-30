import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCampChair } from '../models/campChair.js';
import { buildCampCooler } from '../models/campsite.js';
import { mulberry32, setSessionSeed } from '../rng.js';
import { buildTerrainPatch } from './terrainProxy.js';
import { setTerrainEnabled, sampleTerrain } from '../worldgen/terrain.js';
import { PERF } from '../perf.js';
import { createPhysicalFixture } from './runtime.js';
import { createFixtureCartDriver } from './cartDriver.js';

const $ = id => document.getElementById(id);
const inputs = ['fixture', 'style', 'seed', 'speed', 'angle', 'physics'];
const params = new URLSearchParams(location.search);
const fixtures = ['chair', 'pair', 'slope', 'solid', 'cooler', 'terrain'];
const styles = ['sling', 'director', 'low', 'loveseat'];
if (fixtures.includes(params.get('fixture'))) $('fixture').value = params.get('fixture');
if (styles.includes(params.get('style'))) $('style').value = params.get('style');
for (const key of ['seed', 'speed', 'angle']) {
  const input = $(key), value = Number(params.get(key));
  if (params.has(key) && Number.isFinite(value)) input.value = Math.min(Number(input.max), Math.max(Number(input.min), value));
}
$('physics').checked = params.get('physics') !== '0';
$('ghost').checked = params.get('ghost') === '1';

let renderer, orbit, fixture, frameHandle = 0, disposed = false, paused = true;
let encounterStarted = false, cartDriver;
const cleanupErrors = [];
let generation = 0, last = 0, latest, allocationMs = 0, uploadMs = 0, lastReadout = 0;
let night = params.get('tod') === 'midnight';
const listeners = new AbortController();
const scene = new THREE.Scene();
const models = new THREE.Group(), surfaces = new THREE.Group(), bounds = new THREE.Group();
scene.add(models, surfaces, bounds);
const camera = new THREE.PerspectiveCamera(45, 1, .05, 160);
camera.position.set(12, 10, 14);
const hemisphere = new THREE.HemisphereLight(0xcfe6e5, 0x6a6942, 2.2);
const sun = new THREE.DirectionalLight(0xffedc5, 2.5);
sun.position.set(-5, 10, 7);
scene.add(hemisphere, sun);
const collisionMaterial = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: .8 });
const collisionLines = new THREE.LineSegments(new THREE.BufferGeometry(), collisionMaterial);
collisionLines.frustumCulled = false;
collisionLines.renderOrder = 10;
scene.add(collisionLines);
const visuals = new Map();
const viewBox = new THREE.Box3();

function listen(target, type, callback) {
  target.addEventListener(type, callback, { signal: listeners.signal });
}

// Model pools belong to the production builders. Only this page's unshared
// resources are released when an encounter or the page ends.
function disposeTree(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry && !object.geometry.userData.shared) geometries.add(object.geometry);
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of mats) if (material && !material.userData.shared) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture && !value.userData.shared) textures.add(value);
    }
  });
  for (const resource of [...textures, ...materials, ...geometries]) resource.dispose();
  root.clear();
}

function readSettings() {
  return { fixture: $('fixture').value, style: $('style').value, seed: Number($('seed').value) >>> 0,
    speed: Number($('speed').value), angle: Number($('angle').value), physics: $('physics').checked, ghost: $('ghost').checked };
}

function saveInputs() {
  const settings = readSettings();
  for (const [key, value] of Object.entries(settings)) params.set(key, typeof value === 'boolean' ? Number(value) : value);
  params.set('mute', '1');
  params.set('tod', night ? 'midnight' : 'noon');
  history.replaceState(null, '', `${location.pathname}?${params}`);
  $('speed-label').textContent = `${settings.speed} m/s`;
  $('angle-label').textContent = `${settings.angle}°`;
  $('scene-label').textContent = $('fixture').selectedOptions[0].textContent;
}

function setPaused(value) {
  if (disposed) return;
  paused = value;
  last = 0;
  $('pause').textContent = paused ? 'Resume' : 'Pause';
  $('pause').setAttribute('aria-pressed', String(paused));
  $('step').disabled = !fixture || !paused;
  updateStatus();
}

function updateStatus() {
  if (!fixture || disposed) return;
  $('status').textContent = !latest?.physics ? 'Static reference. Physical simulation is disabled.'
    : paused ? encounterStarted ? 'The encounter is paused. Single step advances one physical tick.'
      : 'Ready. Run the encounter to coast Zerble through.'
      : encounterStarted ? 'The encounter is running. Reset restores the same seed and recipe.'
        : 'The simulation is running. Run the encounter to coast Zerble through.';
}

function setLighting(value) {
  night = value;
  scene.background = new THREE.Color(night ? 0x152b36 : 0xc3d6c1);
  scene.fog = new THREE.Fog(night ? 0x152b36 : 0xc3d6c1, 24, 65);
  hemisphere.intensity = night ? .65 : 2.2;
  sun.intensity = night ? .4 : 2.5;
  sun.color.set(night ? 0xb2c6ec : 0xffedc5);
  $('time').textContent = night ? 'Midnight' : 'Noon';
  $('noon').setAttribute('aria-pressed', String(!night));
  $('midnight').setAttribute('aria-pressed', String(night));
  saveInputs();
}

function buildSurface(ground, patch) {
  const width = ground.width, depth = ground.depth, slope = Math.tan(ground.slope);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(patch ? patch.vertices : [
    -width / 2, -width / 2 * slope, -depth / 2,
    width / 2, width / 2 * slope, -depth / 2,
    -width / 2, -width / 2 * slope, depth / 2,
    width / 2, width / 2 * slope, depth / 2,
  ], 3));
  geometry.setIndex(patch ? Array.from(patch.indices) : [0, 2, 1, 1, 2, 3]);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0x8d9d70, roughness: 1, side: THREE.DoubleSide });
  const groundMesh = new THREE.Mesh(geometry, material);
  surfaces.add(groundMesh);
  if (patch) return;
  const grid = new THREE.GridHelper(width, width, 0x657954, 0x7f9168);
  // Scale compensates for the rotation's horizontal shortening, so the grid
  // lies on the same sampled plane as both rendering and collision.
  grid.rotation.z = ground.slope;
  grid.scale.x = 1 / Math.cos(ground.slope);
  grid.position.y = .003;
  surfaces.add(grid);
}

function buildVisual(prop) {
  let group, chair;
  if (prop.kind === 'chair') {
    chair = buildCampChair(mulberry32(prop.colorSeed), { style: prop.style });
    group = chair.group;
  } else if (prop.kind === 'cart' && cartDriver) {
    group = cartDriver.root;
  } else if (prop.kind === 'cooler') {
    group = buildCampCooler(prop.variant).group;
  } else {
    group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: prop.kind === 'cart' ? 0xd89c42 : 0x69766b,
      roughness: .85, transparent: prop.kind === 'cart', opacity: prop.kind === 'cart' ? .65 : 1 });
    group.add(new THREE.Mesh(new THREE.BoxGeometry(...prop.size), material));
  }
  group.name = `${prop.kind}:${prop.key}`;
  group.traverse(object => { object.castShadow = false; });
  const anchors = new THREE.Group();
  if (chair) {
    const geometry = new THREE.SphereGeometry(.035, 8, 6);
    const material = new THREE.MeshBasicMaterial({ color: 0xffcf61, depthTest: false });
    for (const x of chair.seatOffsets) {
      const dot = new THREE.Mesh(geometry, material);
      dot.position.set(x, chair.seatY, 0);
      dot.renderOrder = 11;
      anchors.add(dot);
    }
    group.add(anchors);
  }
  const helper = new THREE.Box3Helper(new THREE.Box3(), 0xd7a943);
  helper.visible = $('bounds').checked;
  bounds.add(helper);
  models.add(group);
  visuals.set(prop.key, { group, helper, anchors });
}

function updateCollisionGeometry() {
  collisionLines.visible = $('colliders').checked;
  if (!collisionLines.visible || !fixture) return;
  const data = fixture.debugGeometry();
  const sizes = { position: 3, color: data.colors.length === data.vertices.length / 3 * 4 ? 4 : 3 };
  const valuesByAttribute = { position: data.vertices, color: data.colors };
  const mustResize = Object.entries(valuesByAttribute).some(([name, values]) => {
    const attribute = collisionLines.geometry.getAttribute(name);
    return attribute && (attribute.array.length !== values.length || attribute.itemSize !== sizes[name]);
  });
  if (mustResize) {
    // Retire the geometry before changing attribute capacity. The renderer
    // cannot free a replaced BufferAttribute on its own.
    collisionLines.geometry.dispose();
    collisionLines.geometry = new THREE.BufferGeometry();
  }
  for (const [attribute, values] of [['position', data.vertices], ['color', data.colors]]) {
    let buffer = collisionLines.geometry.getAttribute(attribute);
    if (!buffer) {
      buffer = new THREE.Float32BufferAttribute(values, sizes[attribute]);
      buffer.setUsage(THREE.DynamicDrawUsage);
      collisionLines.geometry.setAttribute(attribute, buffer);
    } else {
      buffer.array.set(values);
      buffer.needsUpdate = true;
    }
  }
  collisionLines.geometry.setDrawRange(0, data.vertices.length / 3);
}

function publish(state) {
  latest = state;
  const started = performance.now();
  for (const prop of state.props) {
    const visual = visuals.get(prop.key);
    if (!visual) continue;
    visual.group.position.copy(prop.position);
    visual.group.quaternion.copy(prop.rotation);
    visual.anchors.visible = $('sockets').checked;
    visual.helper.visible = $('bounds').checked;
    if (visual.helper.visible) {
      // Exclude inspection dots from the measured production silhouette.
      const visible = visual.anchors.visible;
      visual.group.remove(visual.anchors);
      viewBox.setFromObject(visual.group);
      visual.group.add(visual.anchors);
      visual.anchors.visible = visible;
      visual.helper.box.copy(viewBox);
    }
  }
  updateCollisionGeometry();
  uploadMs = performance.now() - started;
}

function report() {
  return { settings: readSettings(), timeOfDay: night ? 'midnight' : 'noon', paused,
    playback: Number($('playback').value), allocationMs, publicationMs: uploadMs,
    lifecycle: { disposed, cleanupErrors:cleanupErrors.slice(), fixtureActive: !!fixture, rafActive: !disposed && frameHandle !== 0,
      listenersActive: !listeners.signal.aborted, renderObjects: visuals.size, sceneChildren: scene.children.length },
    rendering: renderer && !disposed ? { tier: PERF.name, pixelRatio: renderer.getPixelRatio(),
      width: renderer.domElement.width, height: renderer.domElement.height,
      draws: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures } : null,
    state: latest, limitations: ['Production Zerble controller with a conservative kinematic contact hull; live-game frame integration pending.',
      'No people or production campsite ownership in this fixture.',
      'Publication time measures CPU transform writes, not GPU upload time.',
      'This fixture does not establish production or physical-device acceptance.'] };
}

function updateReadouts() {
  if (!latest) return;
  const stats = latest.stats;
  const values = [
    ['Bodies', stats.bodies ?? 'n/a'], ['Colliders', stats.colliders ?? 'n/a'],
    ['Joints', stats.joints ?? 'n/a'], ['Render objects', visuals.size],
    ['Sim time', `${latest.time.toFixed(2)} s`], ['Allocation', `${allocationMs.toFixed(1)} ms`],
    ['Step CPU', `${(stats.stepMs ?? 0).toFixed(2)} ms`], ['Pose writes', `${uploadMs.toFixed(2)} ms`],
    ['Draws / tris', disposed ? 'Stopped' : `${renderer.info.render.calls} / ${renderer.info.render.triangles.toLocaleString()}`],
    ['GPU geometry / textures', disposed ? 'Context released' : `${renderer.info.memory.geometries} / ${renderer.info.memory.textures}`],
    ['Steps / discarded time', `${stats.steps ?? 0} / ${(stats.droppedSeconds ?? 0).toFixed(2)} s`],
    ['Event overflow', stats.eventOverflow ?? 'n/a'],
  ];
  $('counters').replaceChildren(...values.flatMap(([label, value]) => {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label; dd.textContent = String(value);
    return [dt, dd];
  }));
  if ($('inspection').parentElement.open) $('inspection').textContent = JSON.stringify(report(), null, 2);
}

async function reset() {
  if (disposed) return report();
  const token = ++generation;
  setPaused(true);
  encounterStarted = false;
  fixture?.dispose(); fixture = null;
  latest = null;
  disposeTree(models); disposeTree(surfaces); disposeTree(bounds); visuals.clear();
  collisionLines.geometry.dispose(); collisionLines.geometry = new THREE.BufferGeometry();
  $('error').hidden = true;
  for (const id of ['run', 'reset', 'pause', 'step']) $(id).disabled = true;
  $('status').textContent = 'Preparing the encounter…';
  saveInputs();
  const started = performance.now();
  let candidate, candidateDriver;
  try {
    const settings = readSettings();
    setSessionSeed(settings.seed);
    setTerrainEnabled(settings.fixture === 'terrain');
    let terrainPatch, surfaceSampler;
    if (settings.fixture === 'terrain') {
      const x=650,z=210,y=sampleTerrain(x,z).height;
      terrainPatch=buildTerrainPatch({minX:x-20,minZ:z-20,maxX:x+20,maxZ:z+20});
      for(let i=0;i<terrainPatch.vertices.length;i+=3) {
        terrainPatch.vertices[i]+=terrainPatch.origin.x-x;
        terrainPatch.vertices[i+1]-=y;
        terrainPatch.vertices[i+2]+=terrainPatch.origin.z-z;
      }
      surfaceSampler=(lx,lz,out={})=>{sampleTerrain(x+lx,z+lz,out);out.height-=y;return out;};
    }
    candidateDriver = createFixtureCartDriver({...settings, surfaceSampler, slope:settings.fixture === 'slope' ? .12 : 0});
    candidate = await createPhysicalFixture({...settings,cartDriver:candidateDriver,terrainPatch,surfaceSampler});
    if (disposed || token !== generation) { candidate.dispose(); disposeTree(candidateDriver.root); return; }
    cartDriver = candidateDriver;
    fixture = candidate;
    fixture.setCartGhost(settings.ghost);
    const state = fixture.getState();
    buildSurface(state.ground,terrainPatch);
    for (const prop of state.props) buildVisual(prop);
    allocationMs = performance.now() - started;
    publish(state);
    for (const id of ['run', 'reset', 'pause', 'step']) $(id).disabled = false;
    updateStatus();
    $('run').disabled = !state.physics;
    $('pause').disabled = !state.physics;
    $('step').disabled = !state.physics;
    updateReadouts();
  } catch (error) {
    candidate?.dispose();
    if (candidateDriver && !candidateDriver.root.parent) disposeTree(candidateDriver.root);
    if (token !== generation || disposed) return;
    fixture = null;
    disposeTree(models); disposeTree(surfaces); disposeTree(bounds); visuals.clear();
    $('error').textContent = `The physical encounter could not start: ${error.message}`;
    $('error').hidden = false;
    $('status').textContent = 'The simulation is unavailable. Reset to retry.';
    $('reset').disabled = false;
    console.error('[physical playground]', error);
  }
}

function dispose() {
  if (disposed) return;
  disposed = true;
  paused = true;
  generation++;
  cancelAnimationFrame(frameHandle);
  frameHandle = 0;
  listeners.abort();
  const cleanup = (name, run) => { try { run(); } catch(error) { cleanupErrors.push(`${name}: ${error.message}`); } };
  if (fixture) {
    cleanup('physics',()=>fixture.dispose());
    cleanup('final physics report',()=>{latest=fixture.getState();});
    fixture=null;
  }
  cleanup('orbit controls',()=>orbit?.dispose());
  cleanup('scene resources',()=>disposeTree(scene));
  visuals.clear();
  cleanup('renderer',()=>renderer?.dispose());
  cleanup('graphics context',()=>renderer?.forceContextLoss());
  for (const control of document.querySelectorAll('aside input, aside select, aside button')) control.disabled = true;
  $('status').textContent = cleanupErrors.length ? 'The scene stopped, but resource cleanup failed. Reload this page.' : 'The scene is disposed and its resources are released. Reload this page to restart.';
  $('inspection').parentElement.open = true;
  $('inspection').textContent = JSON.stringify(report(), null, 2);
  updateReadouts();
}

function fail(error) {
  dispose();
  $('error').hidden = false;
  $('error').textContent = `The physical playground stopped: ${error.message}`;
  $('status').textContent = cleanupErrors.length ? 'The simulation stopped. Cleanup also failed; inspect the report and reload.' : 'The simulation was stopped and its resources were released. Reload to retry.';
  for (const id of ['run', 'reset', 'pause', 'step']) $(id).disabled = true;
  console.error('[physical playground]', error);
}

const debug = { reset, dispose, report, get scene() { return scene; }, get camera() { return camera; },
  get fixture() { return fixture; }, pause: setPaused,
  step() { setPaused(true); if (fixture) { publish(fixture.step()); updateReadouts(); } return report(); },
  run() { const accepted = fixture?.strike() ?? false; if (accepted) { encounterStarted = true; setPaused(false); } return accepted; } };
window.__physicalSandbox = debug;

try {
  renderer = new THREE.WebGLRenderer({ canvas: $('playground'), antialias: PERF.antialias });
  renderer.setPixelRatio(Math.min(devicePixelRatio, PERF.pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  orbit = new OrbitControls(camera, renderer.domElement);
  // The fixed view covers the approach at z=4 and the end of its sweep at
  // z=-6 while keeping native-size chairs readable, without camera motion.
  orbit.target.set(0, .3, -1.5);
  orbit.minDistance = 2;
  orbit.maxDistance = 32;
  orbit.maxPolarAngle = Math.PI * .49;
  orbit.update();
  const resize = () => {
    const { width, height } = $('viewport').getBoundingClientRect();
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  listen(window, 'resize', resize);
  resize();
  listen(window, 'pagehide', dispose);
  listen(document, 'visibilitychange', () => { last = 0; });
  for (const id of inputs) listen($(id), 'change', reset);
  for (const id of ['speed', 'angle']) listen($(id), 'input', () => {
    $(id + '-label').textContent = `${$(id).value}${id === 'angle' ? '°' : ' m/s'}`;
  });
  listen($('reset'), 'click', reset);
  listen($('run'), 'click', () => debug.run());
  listen($('dispose'), 'click', dispose);
  listen($('pause'), 'click', () => setPaused(!paused));
  listen($('ghost'), 'change', () => {
    if (fixture) { fixture.setCartGhost($('ghost').checked); publish(fixture.getState()); }
    saveInputs();
  });
  listen($('step'), 'click', () => debug.step());
  listen($('noon'), 'click', () => setLighting(false));
  listen($('midnight'), 'click', () => setLighting(true));
  for (const id of ['colliders', 'bounds', 'sockets']) listen($(id), 'change', () => { if (latest) publish(latest); });
  listen($('copy'), 'click', async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(report(), null, 2)); $('copy').textContent = 'Report copied'; }
    catch { $('inspection').textContent = JSON.stringify(report(), null, 2); $('copy').textContent = 'Select report to copy'; }
  });
  listen(window, 'keydown', event => {
    if (event.target.closest('input,select,button,textarea') || event.repeat) return;
    if (event.code === 'Space') { event.preventDefault(); if (fixture) setPaused(!paused); }
    else if (event.code === 'KeyR') reset();
    else if (event.key === '.') { event.preventDefault(); debug.step(); }
  });
  setLighting(night);
  const frame = now => {
    if (disposed) return;
    try {
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      // Hidden pages never accumulate physical time. The runtime owns fixed
      // steps and catch-up limits; the page supplies only accepted elapsed time.
      if (!document.hidden) {
        if (fixture && !paused) publish(fixture.advance(dt * Number($('playback').value)));
        renderer.render(scene, camera);
        if (now - lastReadout > 200) { updateReadouts(); lastReadout = now; }
      }
      frameHandle = requestAnimationFrame(frame);
    } catch (error) {
      fail(error);
    }
  };
  frameHandle = requestAnimationFrame(frame);
  reset();
} catch (error) {
  fail(error);
}

if (import.meta.hot) import.meta.hot.dispose(dispose);
