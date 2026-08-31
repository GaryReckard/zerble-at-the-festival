// Bootstraps three.js, runs the game loop, owns scene/postprocessing/collision/scoring.

import * as THREE from 'three';
// Low-tier material downgrade (Standard → Lambert). Must run before any
// model module imports so the constructor swap is in place when the first
// `new THREE.MeshStandardMaterial(...)` fires at module-evaluation time.
// Tier-aware Three.js material swap now happens transparently via the
// 'three' importmap entry pointing at src/threeShim.js — no explicit
// import needed.
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import { Input } from './input.js';
import { Touch } from './touch.js';
import { HUD } from './hud.js';
import { Leaderboard } from './leaderboard.js';
import { RunMode, VIBE, setJugKeepFraction } from './runMode.js';
import { Scoring } from './scoring.js';
import { RunState } from './runState.js';
import { buildWorld, updateWorld, getTimeOfDay, getFarField } from './world.js';
import { forestAnimatables, forestDrumCircles, forestDrumMusic } from './forests.js';
import { lakeAnimatables, setLakeNightness } from './lakes.js';
import { updateCampsiteProps } from './models/campsite.js';
import { updatePortaPotty } from './models/portaPotty.js';
import { updateLeafDrumCircle } from './models/leafDrumCircle.js';
import { updateTribalFigures } from './models/tribalFigures.js';
import { updateStagePerformers, updateStageLightShow, stageLightLenses, worldgenDrawCounts } from './chunks.js';
import { updateSugarShackCooks } from './models/sugarShack.js';
import { Zerble } from './zerble.js';
import { Bubbles } from './bubbles.js';
import { MidiPlayer } from './midiPlayer.js';
import { Smiles } from './smiles.js';
import { Fireworks } from './fireworks.js';
import { Crowd } from './crowd.js';
import { Lurleen } from './lurleen.js';
import { Birds } from './birds.js';
import { ChaseCamera } from './camera.js';
import { registry } from './registry.js';
import { Sound } from './sound.js';
import {
  PuppetParade,
  BrassBand,
  KidGaggle,
  Wooks,
  HulaHoopers,
  Frisbees,
} from './obstacles.js';
import { installDebug, shouldRunFrame, isGod, npcsFrozen } from './debug.js';
import { PERF, USE_WORLDGEN_V2 } from './perf.js';
import { setSpawnPoint } from './chunks.js';
import { nearestHeart, heartsInBounds } from './worldgen/hearts.js';
import { festivalPlan, computeFrontAxis, dancefloorRectsNear, spawnHeart, MAX_POI_REACH } from './worldgen/festival.js';
import { lakeAt } from './worldgen/water.js';
import { runLint } from './worldgen/lint.js';
import { Trip } from './trip.js';
import { StarPower } from './starPower.js';
import { Analytics } from './analytics.js';
import * as ContextLights from './contextLights.js';
import * as AdaptiveQuality from './adaptiveQuality.js';
import { Settings } from './settings.js';
import { A11y } from './a11y.js';
import { setSessionSeed, getSessionSeed } from './rng.js';
import { MODEL_DECOR_MERGE_ENABLED, getMergeDecorStats } from './mergeDecor.js';
import { BoostStreaks } from './boostStreaks.js';

// ---------- Session seed ----------
// `?seed=<thing>` pins the world to a specific layout — pass a string
// ("bananas") and it's FNV-hashed to a 32-bit int; pass a number and it's
// used as-is. No param → fresh random seed per load. The (0,0) chunk's
// main stage + entrance arch stay identical across seeds (see chunks.js
// pickTheme + ChunkManager._generate) so spawn always feels the same;
// everything else (lake placements, forest contents, neighbouring chunk
// themes, music + drum seeds, Lurleen's starting position) re-rolls.
// Resume snapshot — written by Settings' "Apply & restart" so a settings reload
// drops the player back where they were (same seed/world, position, score,
// juice) instead of a fresh spawn. sessionStorage so it survives the reload but
// not a tab close; consumed (cleared) on read so a later manual reload is fresh.
const __resume = (() => {
  try {
    const raw = sessionStorage.getItem('zerble.resume');
    if (!raw) return null;
    sessionStorage.removeItem('zerble.resume');
    return JSON.parse(raw);
  } catch (e) { return null; }
})();

(function initSessionSeed() {
  // Resumed session: re-seed to the exact same world before anything generates.
  if (__resume && __resume.seed != null) {
    window.__seed = setSessionSeed(__resume.seed);
    window.__seedInput = String(__resume.seed);
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('seed');
  let resolved;
  if (raw !== null && raw !== '') {
    // Try as integer first ("?seed=12345"); fall back to string hash.
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && /^-?\d+$/.test(raw)) {
      resolved = setSessionSeed(asNum);
    } else {
      resolved = setSessionSeed(raw);
    }
    window.__seedInput = raw;
  } else {
    resolved = setSessionSeed((Math.random() * 0xFFFFFFFF) >>> 0);
    window.__seedInput = null;
  }
  window.__seed = resolved;
})();

// Surface uncaught errors as GA4 `exception` events — installed early so it
// catches anything thrown during scene/world build, not just steady-state.
// No-ops off production (gtag absent) and is capped against flooding.
Analytics.installErrorTracking();

const canvas = document.getElementById('game');

// Built-truth layout capture needs the real update/streaming path, but it does
// not need pixels. Skipping the composer keeps Playwright's SwiftShader GPU
// worker from saturating the CPU while agent-browser waits on registry data.
// Localhost-only so a player cannot accidentally disable rendering on the live
// deploy; the yielding timer below also keeps CDP commands responsive.
const LAYOUT_CAPTURE_MODE =
  ['localhost', '127.0.0.1'].includes(location.hostname) &&
  new URLSearchParams(location.search).get('layoutCapture') === '1';

// ---------- Renderer ----------
// MSAA (renderer-level antialias) is expensive on integrated / mobile GPUs,
// especially at pixelRatio 2. Per the threejs-postprocessing skill's "FXAA
// over MSAA" guidance: on mid/low tiers we turn MSAA off here and add an
// FXAAPass below to do anti-aliasing in screen space — much cheaper. High
// tier keeps MSAA since its hardware can handle it and the result is sharper.
const useMSAA = PERF.name === 'high';
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: useMSAA,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERF.pixelRatioCap));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = PERF.shadows;
renderer.shadowMap.type = PERF.shadowType === 'soft' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// `renderer.debug.checkShaderErrors` defaults to true, which makes three.js call
// getProgramInfoLog/getShaderInfoLog SYNCHRONOUSLY after every program link — a
// GPU sync-stall per link. The procedural world mints many programs as it
// streams, so those stalls pile into the multi-hundred-ms main-thread freezes
// that fired the browser "page unresponsive" alerts (see
// .claude/perf-unresponsive-diagnosis.md). Disable it for players; keep it ON
// under ?debug / localStorage so shader-compile errors still surface in dev.
// Set at module load, before the first (title-card) render. WARNING: with this
// off a broken shader fails SILENTLY (black / no draw) instead of logging —
// verify shader-touching changes by LOOKING at ?perf=low/mid/high (low swaps to
// the threeShim Lambert path = a different program set), not a clean console.
renderer.debug.checkShaderErrors = (() => {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.has('debug') || !!localStorage.getItem('zerble.debug');
  } catch (e) { return false; }
})();

// ---------- Scene & Camera ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, PERF.cameraFar);

// ---------- Post-processing ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// B0 (perf-pass-4): true scene draw/tri measurement under post-processing.
// `renderer.info.render.calls` is reset+repopulated by EVERY render, so by the
// time the backtick HUD / perf log read it (after composer.render()), the last
// fullscreen pass (OutputPass) has overwritten it with `1`. This pass taps the
// counts immediately after the scene RenderPass — when info.render still holds
// the real scene totals — and stashes them on `renderer.__sceneInfo` for
// debug.js. It draws nothing and forces no buffer swap (needsSwap=false → the
// next pass reads the same buffer the RenderPass wrote).
const sceneInfo = { calls: 0, triangles: 0 };
class InfoCapturePass extends Pass {
  constructor() { super(); this.needsSwap = false; }
  render(r) {
    sceneInfo.calls = r.info.render.calls;
    sceneInfo.triangles = r.info.render.triangles;
  }
}
composer.addPass(new InfoCapturePass());
renderer.__sceneInfo = sceneInfo;

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5),
  PERF.bloomStrength, PERF.bloomRadius, PERF.bloomThreshold
);
// On the low profile we keep bloom but pass-through if it ever needs to be killed:
// set `bloomPass.enabled = false` to fall back to the plain render.
if (!PERF.bloom) bloomPass.enabled = false;
composer.addPass(bloomPass);
// Trip ShaderPass sits between bloom and output. At intensity=0 it's a no-op.
Trip.init();
composer.addPass(Trip.pass);

// FXAA fallback when we don't have MSAA (mid/low tier). FXAA is a single
// screen-space pass — way cheaper than MSAA at pixelRatio 2. Resolution is
// passed in pixel units, kept in sync with renderer size on resize().
let fxaaPass = null;
if (!useMSAA) {
  fxaaPass = new ShaderPass(FXAAShader);
  const pixelRatio = renderer.getPixelRatio();
  fxaaPass.material.uniforms.resolution.value.set(
    1 / (window.innerWidth * pixelRatio),
    1 / (window.innerHeight * pixelRatio),
  );
  composer.addPass(fxaaPass);
}

composer.addPass(new OutputPass());

// ---------- Wook offer prompt + trip narration wiring ----------
//
// The trip system fires onOffer/onAccept/onDecline around the wook offer
// flow, and onNarrate periodically during an active trip. We hook those to
// HUD toasts here. Keeping the copy in main.js means the trip module stays
// game-agnostic (no HUD imports inside it).
const WOOK_OFFER_TEXTS = [
  "🌿 the wook smiles and extends a hand... tap to accept",
  "🌿 the wook offers you something. tap to take it",
  "🌿 the wook is sharing the vibe. tap to receive",
  "🌿 the wook nods knowingly. tap to partake",
];
const WOOK_DECLINE_TEXTS = {
  moved:     "the wook watches you drive away",
  wook_gone: "the wook wanders off",
  timeout:   "the wook shrugs and drifts back to the circle",
};
const TRIP_NARRATIVE_TEXTS = [
  "the trees seem to be breathing",
  "you can taste the bass",
  "everything is connected, somehow",
  "is the sky usually that color?",
  "you forgot what you were doing",
  "a wook is watching from the trees",
  "the path is humming",
  "your hands feel like ideas",
  "the festival is alive",
  "time is doing that thing again",
  "you remember a song from before you were born",
  "the bubbles know your name",
  "the mountains are nodding along",
];
Trip.onOffer = () => {
  const msg = WOOK_OFFER_TEXTS[Math.floor(Math.random() * WOOK_OFFER_TEXTS.length)];
  // Toast is tappable so touch devices can accept. Desktop players can still
  // hit Y — both paths route through Trip.acceptOffer() and the toast clears
  // either way (a Y press replaces the toast via Trip.onAccept).
  HUD.toast(msg, 9000, {
    onTap: () => {
      if (Trip.state === 'awaiting_confirm') Trip.acceptOffer();
    },
  });
};
Trip.onAccept = () => {
  HUD.toast("...", 1500);
};
Trip.onDecline = (reason) => {
  const msg = WOOK_DECLINE_TEXTS[reason] || "the moment passes";
  HUD.toast(msg, 2000);
};
const TRIP_NARRATIVE_NAMED = [
  "the bubbles are calling, {name}...",
  "{name}... the mountains see you",
  "even the fireflies whisper {name}",
];
Trip.onNarrate = () => {
  const msg = TRIP_NARRATIVE_TEXTS[Math.floor(Math.random() * TRIP_NARRATIVE_TEXTS.length)];
  HUD.toast(HUD.withName(msg,
    TRIP_NARRATIVE_NAMED[Math.floor(Math.random() * TRIP_NARRATIVE_NAMED.length)]), 3200);
};

// ---------- Zerble + Smiles + Bubbles ----------
const zerble = new Zerble();
zerble.position.set(0, 0, 65);
zerble.heading = 0;
scene.add(zerble.root);
const boostStreaks = new BoostStreaks();
scene.add(boostStreaks.mesh);

// v2 worldgen: spawn at the nearest HUB (ANY rank — at dense configs there may be
// no MAJOR near origin, D3 finding), so the player opens straight INTO a festival,
// out on the stage's open dancefloor (+F) facing the stage. Runs at module-eval (the
// session seed is already resolved above; this is NOT inside the title-tap handler,
// so it never pushes Sound.init off the synchronous gesture — iOS audio tripwire /
// R31). The stage + clusters come free from the hub's festivalPlan (built when its
// chunk loads). Falls back to the pinned (0,65) spawn if no hub/stage resolves.
// The entrance ARCH is now a planner-owned 'arch' descriptor (on a road that leads to
// the stage, ≥ 2 dancefloor-lengths out) — and on the spawn hub Zerble opens the game
// just OUTSIDE that arch, facing through it at the stage (Gary 2026-06-14), built when
// its chunk loads. Not pinned here — the planner owns it (group 4 / D14 / D15).
const SPAWN_PAST_ARCH = 7;   // m beyond the gate (the approach side) Zerble opens at
if (USE_WORLDGEN_V2) {
  // Spawn at the nearest MAJOR hub so the player opens facing a MAIN STAGE (the
  // wood-roof one) through the festival's front gate (A1 / round-2 A).
  // `nearestMajorHeart(0,0)` is never null in practice (verified over 2000 seeds — D9,
  // correcting the round-2 handoff); fall back to any heart, then the pinned (0,65)
  // spawn. Zerble opens just outside the entrance arch (which sits down a road from the
  // stage), facing through it at the stage; if no arch fit this hub, fall back to the
  // dancefloor front. Runs at module-eval (seed already resolved) — NOT inside the
  // title tap, so it never pushes Sound.init off the synchronous gesture (R31).
  const heart = spawnHeart() || nearestHeart(0, 0).heart;
  const plan = heart ? festivalPlan(heart) : [];
  const stage = plan.find((p) => p.kind === 'main_stage' || p.kind === 'side_stage' || p.kind === 'tent_stage');
  const arch = plan.find((p) => p.kind === 'arch');
  if (heart && stage && arch) {
    // Spawn just OUTSIDE the entrance arch, facing STRAIGHT THROUGH it (Gary 2026-06-14:
    // "facing straight through the arch, not necessarily through the arch AT the stage").
    // The planner sets the arch on a road that leads to the stage, ≥ 2 dancefloor-lengths
    // out; Zerble opens the game on that road axis, looking through the "FESTIVAL" gateway
    // into the hub. We align to the ARCH's passage axis (its road tangent), not the
    // straight line to the stage — so on a curved approach Zerble drives THROUGH the gate
    // rather than aiming off-axis. The arch tangent = π/2 − arch.yaw; orient it toward the
    // hub interior. Module-eval only (positions player + spawn point); the planner owns the arch.
    const bearing = Math.PI / 2 - arch.yaw;                      // road tangent at the arch
    let tx = Math.cos(bearing), tz = Math.sin(bearing);
    if (tx * (stage.x - arch.x) + tz * (stage.z - arch.z) < 0) { tx = -tx; tz = -tz; }   // point INTO the hub
    let sx = Math.round(arch.x - tx * SPAWN_PAST_ARCH);          // just outside the gate, on the road axis
    let sz = Math.round(arch.z - tz * SPAWN_PAST_ARCH);
    // Keep the spawn dry — step forward through the gate (toward the dry hub) if a lakeshore clips it.
    if (lakeAt(sx, sz)) {
      for (let d = 4; d <= 48; d += 4) {
        const nx = Math.round(sx + tx * d), nz = Math.round(sz + tz * d);
        if (!lakeAt(nx, nz)) { sx = nx; sz = nz; break; }
      }
    }
    zerble.heading = Math.atan2(-tx, -tz);                       // face straight through the arch's passage
    zerble.position.set(sx, 0, sz);
    setSpawnPoint(sx, sz);   // ring the guaranteed intro jugs at the gate
  } else if (heart && stage) {
    // Fallback (no arch fit this hub): open on the dancefloor front facing the stage,
    // ~70% out toward the cleared front (its depth ≈ 38·scale, festival.js dancefloorRect).
    const fa = computeFrontAxis(heart);
    const fx = Math.cos(fa.bearing), fz = Math.sin(fa.bearing);   // +F: stage front / dancefloor
    const scale = stage.scale || 1;
    let sx = Math.round(stage.x + fx * 26 * scale);
    let sz = Math.round(stage.z + fz * 26 * scale);
    if (lakeAt(sx, sz)) {
      const tox = stage.x - sx, toz = stage.z - sz, tol = Math.hypot(tox, toz) || 1;
      for (let d = 6; d <= 66; d += 6) {
        const nx = Math.round(sx + (tox / tol) * d), nz = Math.round(sz + (toz / tol) * d);
        if (!lakeAt(nx, nz)) { sx = nx; sz = nz; break; }
      }
    }
    zerble.heading = Math.atan2(-(stage.x - sx), -(stage.z - sz));  // face the stage across the dancefloor
    zerble.position.set(sx, 0, sz);
    setSpawnPoint(sx, sz);
  }
}

const bubbles = new Bubbles();
if (__resume && Number.isFinite(__resume.juice)) bubbles.juice = __resume.juice;
scene.add(bubbles.mesh);

// MIDI player — Tone.js loads lazily on the first M press so startup stays
// fast. Trip._envelope drives the warp chain each frame (see tick body).
const midi = new MidiPlayer();

const smiles = new Smiles();
scene.add(smiles.group);

// ---------- Crowd (before world so chunks can spawn into it) ----------
const crowd = new Crowd(smiles);
scene.add(crowd.group);

// ---------- Fireworks (night-gated; director schedules its own shows) ------
const fireworks = new Fireworks();
scene.add(fireworks.group);
// On a burst, the nearby crowd looks over and cheers — throttled so a finale
// barrage doesn't re-trigger the 5s cheer pose every shell.
let _lastFireworkCheer = -99;
fireworks.onBurst = (bx, bz) => {
  const now = performance.now() / 1000;
  if (npcsFrozen() || now - _lastFireworkCheer < 4) return;
  _lastFireworkCheer = now;
  crowd.cheerNear(zerble.position.x, zerble.position.z);
};

// When a stage song ends, nearby crowd cheers. First fire also logs a GA4 event
// so we know the end-to-end path is working in the wild.
let _cheerAnalyticsFired = false;
Sound.onSongEnd((x, z) => {
  if (!npcsFrozen()) crowd.cheerNear(x, z);
  if (!_cheerAnalyticsFired) {
    _cheerAnalyticsFired = true;
    Analytics.featureUsed('song_cheer');
  }
});

// ---------- Star power (rare floating star + 15s rainbow buff) ----------
StarPower.init({ scene });
StarPower.onTrigger = () => {
  // Star power + a trip STACK by design — the trip's post-process warp over the
  // rainbow cart (and its audio warp on the chiptune, routed through the trip
  // wet chain in sound.js) is part of the fun. Don't cancel the trip.
  Sound.startStarPower();
  bubbles.setStarPower(true);
  Scoring.pinCombo(true);   // star power pins the combo at cap for its 15s
  HUD.setStarPower(true);
  HUD.toast('⭐ STAR POWER! ⭐', 2600);
  Analytics.featureUsed('star_power');
};
StarPower.onEnd = () => {
  Sound.stopStarPower();
  bubbles.setStarPower(false);
  Scoring.pinCombo(false);
  HUD.setStarPower(false);
};

// ---------- World (sky/lights/ground/mountains + chunk manager) ----------
// Zerble was already relocated to the spawn hub above, so preload around it (not
// origin) — the title-card backdrop + __dbg.start() then open on a loaded spawn.
// Resumed session: override the fresh-spawn placement with the saved spot so the
// world preloads around where the player left off.
if (__resume && Number.isFinite(__resume.x) && Number.isFinite(__resume.z)) {
  zerble.position.set(__resume.x, 0, __resume.z);
  if (Number.isFinite(__resume.heading)) zerble.heading = __resume.heading;
}
buildWorld(scene, crowd, zerble.position);
// Resumed session: restore the time of day so the sky matches where you left off
// (the ToD instance is created inside buildWorld, so this must come after it).
if (__resume && Number.isFinite(__resume.tod)) getTimeOfDay()?.setT(__resume.tod);

// ---------- Lurleen (love interest, persistent across the world) ----------
// v2 (H1): start Lurleen a distance away from the player's actual hub spawn (random
// direction), not the origin ring — so she's never right next to a hub-relocated Zerble.
const lurleen = new Lurleen(scene, USE_WORLDGEN_V2 ? zerble.position.clone() : null);
let lurleenMet = false;     // first-contact toast latch

// ---------- Moving obstacles (global — not chunk-bound) ----------
const puppets = new PuppetParade();
scene.add(puppets.group);
const band = new BrassBand();
scene.add(band.group);
const kids = new KidGaggle();
scene.add(kids.group);
const wooks = new Wooks();
scene.add(wooks.group);
// Hula-hoopers attach to attractor POIs (stages, drum circles, fire pits).
// Built lazily after buildWorld() runs so the first registry scan has data.
const hoopers = HulaHoopers.create();
scene.add(hoopers.group);
const frisbees = new Frisbees();
scene.add(frisbees.group);
// Birds — global flock that circles the festival + perches in trees. Built
// after buildWorld so the registry already has trees to perch in.
const birds = new Birds();
scene.add(birds.group);

// Refuel bubble-stream — a pool of glowing bubbles that arc from the bubble
// vendor to the cart while it's topping off the tank. One InstancedMesh
// (1 draw); count goes to 0 when not refueling.
const REFUEL_STREAM_N = 12;
// Show the refuel stream only while filling a deficit at least this deep. The
// bubble machine drains the tank a hair every frame (bubbles.js — it's always
// on), so a full tank parked at a vendor gets topped off every frame; without
// this gate the meter is technically "rising" forever and the stream never
// stops. EPS comfortably exceeds one frame's drain, so a topped-off tank reads
// as full (no stream) with no flicker.
const REFUEL_STREAM_EPS = 0.02;
const _refuelStreamGeo = new THREE.SphereGeometry(0.13, 8, 6);
const _refuelStreamMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.1,
  emissive: 0x9fe4ff, emissiveIntensity: 0.8, depthWrite: false,
});
const _refuelStream = new THREE.InstancedMesh(_refuelStreamGeo, _refuelStreamMat, REFUEL_STREAM_N);
_refuelStream.frustumCulled = false;
_refuelStream.count = 0;
scene.add(_refuelStream);
const _refuelParticles = Array.from({ length: REFUEL_STREAM_N }, (_, i) => ({ t: i / REFUEL_STREAM_N }));
const _refuelMat = new THREE.Matrix4();

function updateRefuelStream(fromPos, toPos, dt) {
  if (!fromPos) { _refuelStream.count = 0; return; }
  const sx = fromPos.x, sy = 1.3, sz = fromPos.z;   // up off the vendor counter
  const tx = toPos.x, ty = 1.0, tz = toPos.z;        // toward the cart
  for (let i = 0; i < REFUEL_STREAM_N; i++) {
    const p = _refuelParticles[i];
    p.t += dt * 0.85;
    if (p.t > 1) p.t -= 1;
    const tt = p.t;
    const x = sx + (tx - sx) * tt + Math.sin(tt * 11 + i) * 0.12;
    const z = sz + (tz - sz) * tt + Math.cos(tt * 11 + i) * 0.12;
    const y = sy + (ty - sy) * tt + Math.sin(tt * Math.PI) * 0.6;   // gentle arc
    const s = 0.45 + 0.55 * Math.sin(tt * Math.PI);                 // grow then shrink
    _refuelMat.makeScale(s, s, s);
    _refuelMat.setPosition(x, y, z);
    _refuelStream.setMatrixAt(i, _refuelMat);
  }
  _refuelStream.count = REFUEL_STREAM_N;
  _refuelStream.instanceMatrix.needsUpdate = true;
}

// ---------- Camera ----------
const chaseCam = new ChaseCamera(camera, zerble);
// Hold the hero 3/4 "PNG-match" framing while the title card is up, so the
// blurred background behind it is a deliberate glamour shot of Zerble at its
// festival spawn — not a chase-cam view of whatever terrain is behind the cart.
// startIntroReveal() re-poses + orbits from here on Start; __dbg.start() and a
// skip tap settle straight to chase. Cheap: it just pins the camera each frame
// until the intro/skip clears the 'match' phase.
chaseCam.poseIntroMatch();

// Touch + mouse cam toggle button — same as pressing V. Cycles through
// chase → first-person → top-down → chase.
const btnCam = document.getElementById('btn-cam');
if (btnCam) {
  const toggle = (e) => {
    e.preventDefault();
    chaseCam.toggleMode();
    HUD.toast(chaseCam.modeLabel, 1500);
  };
  btnCam.addEventListener('click', toggle);
  btnCam.addEventListener('touchstart', toggle, { passive: false });
}

// ---------- Honk ring ----------
const honkRing = new THREE.Mesh(
  new THREE.RingGeometry(0.5, 0.55, 48),
  new THREE.MeshBasicMaterial({
    color: 0xffd28a, transparent: true, opacity: 0,
    side: THREE.DoubleSide, depthWrite: false,
  })
);
honkRing.rotation.x = -Math.PI / 2;
scene.add(honkRing);
let honkAge = 999;

// ---------- HUD ----------
// All score reads/writes go through Scoring (the single writer — see
// scoring.js). A resumed session restores mode BEFORE stakes config so combo
// state survives a settings reload; a fresh boot configures at Start instead
// (the player can flip the mode selector right up to the tap).
if (__resume && __resume.mode) {
  RunMode.set(__resume.mode);
  HUD.refreshMode();
}
Scoring.configure({ stakes: RunMode.isFestival() });
// The score/run payload of the snapshot is deliberately NOT applied here. The
// resumed title card still shows the live mode selector, so the mode chosen at
// Start can differ from the mode the snapshot was taken in — and applying the
// payload across that boundary leaks state both ways (a Festival run's stakes
// machine into Cruisin', or a Cruisin' score onto the Festival board; review
// 001-groups-6-9, both P0s). It applies at Start, only on a mode match.
function applyResumeGameState() {
  if (!__resume || RunMode.name !== __resume.mode) return false;
  if (__resume.scoring) Scoring.restore(__resume.scoring);
  else if (Number.isFinite(__resume.score)) Scoring.reset({ current: __resume.score });
  if (__resume.run) RunState.restore(__resume.run);   // day/clock/vibe/prevT/rescue
  HUD.setSmiles(Scoring.current);
  return true;
}
HUD.loadBest();
let running = false;

// A bubble-less Zerble makes nearby NPCs frown — each frown costs a smile
// (and, in Festival Run, snaps the combo chain).
crowd.onFrown = () => {
  // Sputtering cart: no smile tax while the player is already limping to
  // juice (council "no pile-on" on the wallet) — but the half-weight vibe
  // strike still lands (Q6, Gary 2026-08-29): the marshals notice a dry cart
  // souring the crowd, which also makes the frownMult ramp column
  // load-bearing and gives the grace window a route choice (limp through
  // the crowd = risky, limp through open ground = safe).
  if (RunState.active && RunState.sputter) {
    // Governed (cooldown + capped — see runState.addSputterStrike / adversary
    // A1): the crowd pressures a dry cart but can never eject it alone, and
    // the whistle copy stops accusing a player who hit nobody.
    const ev = RunState.addSputterStrike(VIBE.frownStrike, RunMode.config.vibeLimits(RunState.day));
    if (ev === 'warn') {
      Sound.playMarshalWhistle();
      HUD.toast('The marshals eye your sputtering cart — the crowd is souring…', 2800);
    }
    return;
  }
  if (Scoring.current <= 0) return;
  Scoring.deduct(1);
  Scoring.breakCombo();
  Sound.playFrownDown();
  HUD.setSmiles(Scoring.current);
  applyVibeStrike(VIBE.frownStrike);
};
// An NPC climbed aboard — feed the passenger analytics (first board fires an
// event; every board feeds the session_end count).
crowd.onBoard = () => Analytics.passengerBoard();

// Nature-ambience proximity, recomputed every ~0.1s (see tick body).
let _natureScanTimer = 0;
let _treeness = 0;
let _lakeness = 0;
let _cricketPanVal = 0;   // listener-relative pan toward nearest forest (-1..1)
let _frogPanVal = 0;      // listener-relative pan toward nearest lake (-1..1)
// Debounce for the bubble-vendor "free refill" toast.
let _vendorToastCd = 0;
let _vendorRefusalCd = 0;      // "can't afford" toast cooldown (Festival Run)
let _vendorCostAccum = 0;      // fractional smile cost accrual while drawing
let _vendorWasFilling = false;   // were we actively drawing juice last frame?
let _wasEmpty = bubbles.juice <= 0.02; // edge-detect the bubble tank running dry
let _collectedThisFrame = 0;     // per-frame smile-collect coalescing buffer
// Analytics edge-detect / rollup state (see src/analytics.js).
let _wasBlasting = false;        // edge-detect the bubble blast (G) starting
let _maxJuiceReached = 1;        // peak stockpile this run → session_end
let _honkCount = 0;              // honks this run → session_end
let _lastQualityLevel = 0;       // adaptive-quality level, to spot downgrades
let _sessionEndReported = false; // session_end fires once per leave; resets on return

// Opening intro: while true, the world simulates but the player can't drive
// (the camera is mid-reveal). Zerble gets a neutral input so it idles in place.
let controlsLocked = false;
const NEUTRAL_INPUT = { throttle: 0, steer: 0, boost: false };

// Intro timing (ms): hold the opaque PNG, then cross-dissolve, then the camera
// orbits to chase over INTRO_ORBIT_SEC.
const INTRO_HOLD_MS = 450;
const INTRO_FADE_MS = 1000;
const INTRO_ORBIT_SEC = 2.0;

// Touch overlay (no-op on desktop; reveals thumbstick/buttons on touch devices).
Touch.install();

// Adaptive quality monitor — drops bloom / shadows / pixel ratio when the
// frame budget slips, ramps back up if it recovers. Hooks installed once;
// per-frame `tick(dt)` lives at the bottom of tickBody().
AdaptiveQuality.install({
  renderer,
  scene,
  composer,
  bloomPass,
  hud: HUD,
  // Phase 3 will add bubbles.setCheapMaterial(); the hook is wired now so
  // the quality-level ladder encodes the 'bubbles' property correctly from
  // day one. The optional-chain guard means Phase 3 just needs to add the
  // method — no change needed here.
  onLevelChange: (level, lvl, avgMs) => {
    bubbles.setCheapMaterial?.(AdaptiveQuality.effectiveCheap(lvl));
    // Only the DOWN steps are the interesting field-perf signal (the budget
    // slipped on real hardware); recoveries back up are expected.
    if (level > _lastQualityLevel) Analytics.qualityDowngrade(level, avgMs ? 1000 / avgMs : 0);
    _lastQualityLevel = level;
  },
});
// Apply the tier's Auto baseline before the first rendered frame. On low this
// avoids the MeshPhysical transmission pre-pass immediately; a persisted
// Detailed bubbles On/Off choice below still wins through Settings.
bubbles.setCheapMaterial(AdaptiveQuality.currentCheap());

// Player Settings panel — graphics quality / effect overrides / volume. Runs
// AFTER AdaptiveQuality.install so applyBootOverrides can turn the governor off
// and apply persisted Custom-mode effects (the reload-required tier/shadow/light
// flags are already baked by perf.js reading localStorage at module load).
// Accessibility prefs (reduced motion / colorblind cues) — resolve + apply body
// classes before Settings reads them and before gameplay systems poll the flags.
A11y.init();
Settings.init({
  bubbles,
  // "Apply & restart" calls this to preserve a live session across the reload.
  // Returns null on the title card (nothing to resume) → a fresh boot.
  captureState: () => running
    ? { seed: window.__seed, x: zerble.position.x, z: zerble.position.z,
        // A dead run's score must not ride a snapshot into the next run
        // (adversary A11) — null BOTH scoring fields, matching `run` below.
        heading: zerble.heading,
        score: RunState.over ? null : Scoring.current,
        scoring: RunState.over ? null : Scoring.serialize(),
        mode: RunMode.name, run: RunState.over ? null : RunState.serialize(),
        board: Leaderboard.serializeGlobal(),   // Worker token rides the resume (review 001)
        juice: bubbles.juice, tod: getTimeOfDay()?.t }
    : null,
});

// iOS Safari still fires deprecated GestureEvents for pinch — those can zoom
// the page even with user-scalable=no. Swallow them so the canvas stays
// locked to 1.0 scale.
['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
});
// Block the iOS double-tap-to-zoom on the canvas + HUD.
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

HUD.showTitle();
// Resumed session: the title card still shows (iOS needs the tap to start audio),
// but the button reads "Resume" — one tap drops the player back where they were.
if (__resume) {
  HUD.setStartLabel('Resume');
}
HUD.onStart(() => {
  HUD.hideTitle();
  running = true;
  // The player can flip the mode selector right up to the Start tap —
  // (re)configure stakes from the final choice. Synchronous, pre-Sound.init.
  Scoring.configure({ stakes: RunMode.isFestival() });
  const resumedMatch = applyResumeGameState();
  if (RunMode.isFestival()) {
    if (!RunState.active) RunState.begin();   // active = restored (mode-matched) resume run
    setJugKeepFraction(RunMode.config.jugKeep(RunState.day));
    if (RunState.sputter) zerble.sputtering = true;   // audio loop re-arms after Sound.init below
    Analytics.runStart({ day: RunState.day, resumed: resumedMatch });
    // A resumed run re-adopts its Worker token — a fresh /run/start would reset
    // elapsed time and trip the Worker's own day/rate plausibility guards.
    if (!(resumedMatch && Leaderboard.globalRestore(__resume.board))) {
      Leaderboard.globalRunStart();   // no-op until the Worker URL is set (P3 deploy)
    }
  }
  // Context segments every later event by device/tier/returning-ness.
  Analytics.gameStart({
    perf_tier: PERF.name,
    touch: Touch.isTouchDevice(),
    seeded: window.__seedInput != null,
    returning: HUD.loadBest() > 0,
    mode: RunMode.name,
    // Name privacy line (ROADMAP): only the boolean + length ever reach GA4 —
    // never the string itself (free-text names are PII under the GA4 ToS).
    name_entered: HUD.getPlayerName().length > 0,
    name_length: HUD.getPlayerName().length,
  });
  _sessionEndReported = false;
  // Sound.init() MUST run synchronously inside the tap handler on iOS — any
  // await/setTimeout boundary loses the "user gesture" status and the
  // AudioContext starts suspended (silent).
  Sound.init();
  // A run resumed mid-sputter restores the death clock — restore its cues too
  // (the limp flag is set above; the chug loop needs the fresh AudioContext).
  if (RunState.active && RunState.sputter) Sound.startSputterLoop();
  // Explicit local-device perf captures arm from the URL, but recording begins
  // only after this real gesture and after synchronous iOS audio initialization.
  window.__debug?.startDeviceCapture?.();
  // Reveal the touch overlay only now (avoids ghost controls behind the
  // title-card's backdrop-filter) and mark it as the active control surface
  // for assistive tech.
  document.body.classList.add('game-started');
  const tc = document.getElementById('touch-controls');
  if (tc) tc.setAttribute('aria-hidden', 'false');

  startIntroReveal();

  // Audio debug surfaced on-screen: ?sounddebug=1 in the URL pops a compact
  // toast a beat after Start with the unlock state, so we can diagnose iOS
  // audio without Safari Web Inspector. The promise resolutions land on the
  // next microtask, hence the short delay.
  const _params = new URLSearchParams(location.search);
  const _soundDebugEnabled = _params.get('sounddebug') === '1' ||
    _params.has('debug') ||
    (() => { try { return !!localStorage.getItem('zerble.debug'); } catch (e) { return false; } })();
  if (_soundDebugEnabled) {
    setTimeout(() => {
      const d = Sound.diagnostics();
      const ms = d.restoredFromLocalStorage.master;
      const msg =
        `ctx ${d.live.ctxState} ` +
        `m${(d.live.masterGain ?? 0).toFixed(2)} ` +
        `html ${d.htmlUnlockPlayResolved ? '✓' : (d.htmlUnlockPlayRejected ? '✗' : '?')} ` +
        `buf ${d.webAudioBufferUnlocked ? '✓' : '✗'} ` +
        `rate ${d.live.ctxSampleRate}` +
        (ms ? ` LS:${ms.raw}→${ms.applied}` : '');
      HUD.toast(msg, 9000);
    }, 250);
  }
});

// ---------- Opening reveal ----------
// 1. Snap the camera to the PNG-match pose and show the 2D Zerble cutout over
//    the lined-up 3D model. 2. Hold, then cross-dissolve the cutout out to
//    reveal the real model. 3. Orbit the camera around to chase, then hand
//    control back. A tap/key during the sequence skips straight to chase.
let _introHoldT = 0;
let _introFadeT = 0;
function startIntroReveal() {
  controlsLocked = true;
  chaseCam.poseIntroMatch();

  const img = document.getElementById('intro-zerble');
  const beginOrbit = () => chaseCam.beginIntroOrbit(INTRO_ORBIT_SEC, finishIntroReveal);

  if (img) {
    img.style.setProperty('--intro-fade', INTRO_FADE_MS / 1000 + 's');
    img.classList.remove('is-fading');
    img.classList.add('is-shown');
    _introHoldT = setTimeout(() => {
      img.classList.add('is-fading');          // cross-dissolve to the 3D model
      _introFadeT = setTimeout(() => {
        img.classList.remove('is-shown', 'is-fading');
        beginOrbit();
      }, INTRO_FADE_MS);
    }, INTRO_HOLD_MS);
  } else {
    beginOrbit();
  }

  // Skip on the next tap/key — settles straight to chase.
  window.addEventListener('keydown', skipIntroReveal, { once: true });
  window.addEventListener('pointerdown', skipIntroReveal, { once: true });
}

function skipIntroReveal() {
  if (!controlsLocked) return;
  clearTimeout(_introHoldT);
  clearTimeout(_introFadeT);
  const img = document.getElementById('intro-zerble');
  if (img) img.classList.remove('is-shown', 'is-fading');
  chaseCam.skipIntro();      // snaps camera to chase (no-op if not in intro)
  finishIntroReveal();
}

function finishIntroReveal() {
  if (!controlsLocked) return;
  controlsLocked = false;
  window.removeEventListener('keydown', skipIntroReveal);
  window.removeEventListener('pointerdown', skipIntroReveal);
  HUD.toast(HUD.withName(
    'Drive around — make people smile, dodge the parade.',
    'Drive around, {name} — make people smile, dodge the parade.', 0.5), 2800);
}

// Session summary: fire once when the player leaves (tab hidden / page going
// away) with the live run snapshot. Beacon transport (in Analytics.sessionEnd)
// is the mobile-reliable way to get a request out as the page disappears —
// `beforeunload` is flaky on mobile. The guard resets when the tab returns, so
// a session that briefly backgrounded still logs a fuller snapshot on the real
// exit (the run rollup keeps accumulating across the gap).
function reportSessionEnd() {
  if (!running || _sessionEndReported) return;
  _sessionEndReported = true;
  Analytics.sessionEnd({ smiles: Scoring.current, best: HUD.loadBest(), maxJuice: _maxJuiceReached, honks: _honkCount });
}

// iOS suspends the AudioContext on tab switch / device lock. Resume on return.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) reportSessionEnd();
  else { _sessionEndReported = false; Sound.resume(); }
});
window.addEventListener('pagehide', reportSessionEnd);
window.addEventListener('pageshow', () => Sound.resume());
// Belt-and-suspenders: any touch/click after we're running revives audio if
// iOS dropped it for a reason we didn't see (route changes, headset unplug).
function audioRecover() { if (running) Sound.resume(); }
window.addEventListener('pointerdown', audioRecover);
window.addEventListener('touchstart', audioRecover, { passive: true });

// ---------- Game loop ----------
const clock = new THREE.Clock();
const _camFwd = new THREE.Vector3();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (shouldRunFrame(dt)) tickBody(dt);
  scheduleNext();
}

function tickBody(dt) {
  if (running) {
    const tod = getTimeOfDay();
    const nightness = tod ? tod.nightness : 0;
    HUD.setTimeOfDay(tod?.t, nightness);
    if (nightness > 0.5) Analytics.sawNight();   // once: played into nightfall
    // During the opening reveal the player can't steer — feed Zerble a neutral
    // input so it idles while the camera does its thing.
    zerble.update(dt, controlsLocked ? NEUTRAL_INPUT : Input, nightness);
    boostStreaks.update(dt, zerble, {
      reducedMotion: A11y.reducedMotion,
      effectsEnabled: AdaptiveQuality.bloomAllowed(),
    });
    Sound.setEngineSpeed(zerble.speed, zerble.isBoosting ? 1 : 0);
    if (zerble.isBoosting) Analytics.featureUsed('boost');   // once per run
    // Push nightness into the audio module so the forest drum engine can
    // gate voices + the crackling-fire bed against the day/night cycle.
    Sound.setNightness(nightness);
    // Drive the shared lake water material's nightness + time uniforms so
    // the procedural star shimmer twinkles correctly at night. Zero impact
    // by day (the shader's nightness² gate short-circuits).
    setLakeNightness(nightness, performance.now() * 0.001);

    // SPACE = random honk (bell or clown). B = always bell. H = always clown.
    // All three share the honk ring + crowd reaction + cooldown.
    const spaceHonk = Input.consumePressed('SPACE');
    const bellHonk  = Input.consumePressed('B');
    const hornHonk  = Input.consumePressed('H');
    if (!controlsLocked && (spaceHonk || bellHonk || hornHonk) && zerble.canHonk()) {
      zerble.honk();
      honkAge = 0;
      // No honk-scatter while the love buff is on — nobody flees a smitten Zerble.
      // crowd + kids share the speed-scaled honk (steering.js): they scatter at
      // ANY speed, harder the faster you're going.
      if (!StarPower.isActive()) {
        crowd.applyHonk(zerble);
        kids.scatter(zerble);
      }
      // Puppets, brass band, and wooks still scatter on a PARKED honk only —
      // they're on fixed parade loops / formations and aren't speed-aware yet.
      if (Math.abs(zerble.speed || 0) < 0.5) {
        wooks.scatter(zerble);
        puppets.scatter(zerble);
        band.scatter(zerble);
      }
      if (bellHonk)      { Sound.playBicycleBell(); Analytics.featureUsed('honk_bell'); }
      else if (hornHonk) { Sound.playClownHorn();   Analytics.featureUsed('honk_clown'); }
      else               Sound.playHonk();   // SPACE → random
      Analytics.firstHonk();
      _honkCount++;
    }

    // V cycles camera modes: chase → first-person → top-down → chase.
    if (Input.consumePressed('V')) {
      chaseCam.toggleMode();
      HUD.toast(chaseCam.modeLabel + ' (V to cycle)', 1500);
      Analytics.viewToggle(chaseCam.mode);
    }
    // Arrow keys = manual camera control (pan/tilt in chase/FPV, zoom/rotate in
    // top-down). Tracked once per run as a discovery signal.
    if (!controlsLocked && (Input.camYaw !== 0 || Input.camPitch !== 0)) Analytics.featureUsed('camera_arrows');

    // Y accepts a pending wook trip offer. Outside of awaiting_confirm the
    // press is consumed silently — Y has no other binding so this is fine.
    if (Input.consumePressed('Y')) {
      if (Trip.state === 'awaiting_confirm') Trip.acceptOffer();
    }

    // M toggles the MIDI music player. First press lazy-loads Tone.js
    // from the CDN (~250KB) and starts the AudioContext; the M press
    // itself counts as the user gesture browsers require.
    if (Input.consumePressed('M')) {
      midi.toggle(HUD);
      Analytics.featureUsed('music_toggle');
    }
    // Feed both the trip's envelope (fade-in/out gate) AND its progress
    // (0..1 position across the full trip) into the MIDI player each frame.
    // The two-layer design mirrors Trip._writeDynamicCurves for visuals: the
    // envelope gates the warp in/out, the progress shapes each effect's own
    // personality curve. Peak audio climax lands at progress ≈ 1/3, same
    // as the visual posterize spike.
    midi.setTripState(Trip._envelope || 0, Trip.progress());
    // Same warp applied to the procedural music bus (jam/brass/drum/forest_drum
    // engines that aren't going through Tone.js). Lowpass sweep + feedback
    // delay on the music bus, gated by the same envelope. Sound.setMusicTrip
    // is a no-op until Sound.init() has wired the nodes.
    Sound.setMusicTrip(Trip._envelope || 0, Trip.progress());
    // ...and the SFX bus (engine drone + collision one-shots). SFX-tuned
    // sibling — gentler lowpass + more dry signal so the cart stays
    // driveable, plus a pitch-detune wobble on the engine so it sounds
    // seasick mid-trip. Same two scalars drive all three warp paths.
    Sound.setSfxTrip(Trip._envelope || 0, Trip.progress());
    // ...and the nature bus (birdsong + crickets + frogs). Lushest of the
    // three warps — the calls smear and pitch-bend into a psychedelic wash.
    Sound.setNatureTrip(Trip._envelope || 0, Trip.progress());

    // G key (held) cranks the bubble machine to ~2.8× output AND switches
    // the disco light into a fast, bright-white strobe so the effect reads
    // even in bright sunlight. Per-frame: hold for blast, release for normal.
    const blasting = Input.isDown('G');
    if (blasting && !_wasBlasting) Analytics.bubbleBlast();   // marquee verb, once per run
    _wasBlasting = blasting;
    bubbles.setBlast(blasting);
    zerble.setBubbleBlast(blasting);
    zerble.setJuiceLevel(bubbles.juice);   // drives the bubble-machine liquid level + reserve jugs
    bubbles.update(dt, zerble, nightness);
    fireworks.update(dt, nightness, zerble.position, zerble.heading);
    HUD.setJuice(bubbles.juice);
    if (bubbles.juice > _maxJuiceReached) _maxJuiceReached = bubbles.juice;   // peak → session_end
    // Dry tank → no bubbles → NPCs frown (crowd.js reads this). One-time toast
    // on running out so the player connects the empty meter to the frowns.
    const bubblesEmpty = bubbles.juice <= 0.02;
    crowd.bubblesEmpty = bubblesEmpty;
    // Suppress the proximity flee while the love buff is active (read in crowd.update).
    crowd.starActive = StarPower.isActive();
    if (bubblesEmpty && !_wasEmpty) {
      HUD.toast(HUD.withName(
        'Out of bubble juice — grab a jug!',
        'Out of bubble juice, {name} — grab a jug!'), 2200);
      Sound.playJuiceSputter();
      Analytics.bubbleRanDry();
    }
    _wasEmpty = bubblesEmpty;

    // ---- Festival Run layer: day ramp, sputter grace, vibe decay ----
    // The RunMode check is belt-and-suspenders (review 001: RunState can only
    // be active in Festival, but a leak here means stakes in Cruisin').
    if (RunMode.isFestival() && RunState.active && !RunState.over) {
      if (RunState.tickDay(dt, getTimeOfDay()?.t)) {
        const d = RunState.day;
        const line = DAY_UP_TOASTS[Math.floor(Math.random() * DAY_UP_TOASTS.length)];
        HUD.toast(line.replace('{d}', String(d)), 3200);
        setJugKeepFraction(RunMode.config.jugKeep(d));
      }
      const limits = RunMode.config.vibeLimits(RunState.day);
      crowd.frownRateMult = RunMode.config.frownMult(RunState.day);
      RunState.tickVibe(dt, limits);
      const sput = RunState.tickSputter(dt, bubbles.juice);
      if (sput === 'start') {
        zerble.sputtering = true;
        Sound.startSputterLoop();
        HUD.toast(HUD.withName(
          'Zerble is running on fumes — find juice, fast!',
          '{name}! Zerble is running on fumes — find juice, fast!', 0.5), 3200);
      } else if (sput === 'end') {
        zerble.sputtering = false;
        Sound.stopSputterLoop();
      } else if (sput === 'expired') {
        if (!RunState.rescueUsed && lurleen.isFollowing) {
          performLurleenRescue();
        } else {
          endFestivalRun('ran_dry');
        }
      }
      HUD.setDay(RunState.day);
      HUD.setSputter(RunState.sputter ? RunState.sputterLeft : null);
      HUD.setVibe(RunState.vibeFraction(limits), true, limits ? RunState.vibe >= limits.warn : false);
      // Global board heartbeat — self-throttled (60s + milestones). The
      // enabled check keeps the per-frame argument object from being built
      // at all in the (shipping-default) disabled state.
      if (Leaderboard.globalEnabled()) {
        Leaderboard.globalHeartbeat({
          score: Scoring.highWater, day: RunState.day, name: HUD.getPlayerName(),
        });
      }
    }
    // Rebuild the registry broadphase once per frame, before every consumer
    // (crowd steering, kid push-out, Zerble collision). Cheap O(entries) pass;
    // the per-NPC queries it enables replace the old O(npcs × entries) scans.
    registry.rebuildSpatialIndex();
    if (!npcsFrozen()) crowd.update(dt, zerble, bubbles);
    // Same-frame collects coalesce into ONE scoring event (and, in group 5,
    // one audio chord) — a mega-burst never machine-guns the pipeline.
    _collectedThisFrame = 0;
    smiles.update(dt, zerble, (n) => { _collectedThisFrame += n; });
    if (_collectedThisFrame > 0) {
      Scoring.collect(_collectedThisFrame);
      Sound.playSmileCollect(_collectedThisFrame, Scoring.chain);
      HUD.setSmiles(Scoring.current);
      // zerble-best-smiles is the Just Cruisin' personal best ONLY — Festival
      // Run's multiplied scores must never overwrite it (council Critical).
      if (RunMode.config.savesPersonalBest) {
        HUD.saveBest(Scoring.current);
        Analytics.personalBest(Scoring.current);
      }
      Analytics.smileScore(Scoring.current);
    }
    Scoring.tick(dt);
    Scoring.setDoubler(lurleen.state === 'following');
    HUD.setCombo(Scoring.multiplier(), Scoring.chainFraction(), Scoring.doubler, Scoring.stakes);

    puppets.update(dt, zerble.position);
    band.update(dt, zerble.position);
    kids.update(dt, bubbles, zerble, smiles);
    wooks.update(dt, zerble.position, Math.abs(zerble.speed));
    hoopers.update(dt, zerble.position, nightness);
    frisbees.update(dt, zerble.position, nightness);
    birds.update(dt, zerble.position, tod, Math.abs(zerble.speed));
    // Collect wook world positions for proximity detection
    const _wookPositions = wooks.wooks.map(w => w.position);
    Trip.update(dt, zerble.position, Math.abs(zerble.speed), _wookPositions);
    lurleen.update(dt, zerble.position, zerble.heading);
    HUD.setLurleenFollowing(lurleen.state === 'aware' || lurleen.state === 'following');
    // Her motor — spatialized to her position, pitch/volume track her real
    // speed whether she's wandering on her own or chasing Zerble.
    Sound.setLurleenEngine(lurleen.speed, lurleen.position.x, lurleen.position.z);
    if (!lurleenMet && lurleen.state === 'aware') {
      lurleenMet = true;
      HUD.toast(HUD.withName('You found Lurleen! 💗', '{name} found Lurleen! 💗', 0.5), 3500);
      Analytics.lurleenFound();
    }
    const nowS = performance.now() * 0.001;
    updateStagePerformers(nowS);
    updateStageLightShow(nowS, nightness, zerble.position);
    updateSugarShackCooks(dt);

    // Distance-gate per-frame animatable updates. A campsite ember pulse /
    // tiki-flame flicker / drum-circle figure animation 80m behind the
    // player isn't visible, so don't pay the per-mesh material write +
    // intensity math. Threshold tuned to comfortably cover the visible
    // area at any FOV without ticking distant chunks.
    const SKIP_DIST_SQ = 75 * 75;
    const _px = zerble.position.x;
    const _pz = zerble.position.z;
    function _farFromPlayer(centerX, centerZ) {
      if (centerX == null) return false;        // safety: keep ticking older entries
      const dx = centerX - _px;
      const dz = centerZ - _pz;
      return dx * dx + dz * dz > SKIP_DIST_SQ;
    }

    // Campsite props (firepit ember pulse + tiki torch flicker) for both
    // forest-clearing campsites and lakeside ones. Two separate lists owned
    // by their respective systems (chunk vs lake lifecycle); single update fn.
    for (let i = 0; i < forestAnimatables.length; i++) {
      const e = forestAnimatables[i];
      if (_farFromPlayer(e.centerX, e.centerZ)) continue;
      updateCampsiteProps(nowS, nightness, e.animatables);
    }
    for (let i = 0; i < lakeAnimatables.length; i++) {
      const e = lakeAnimatables[i];
      if (_farFromPlayer(e.centerX, e.centerZ)) continue;
      updateCampsiteProps(nowS, nightness, e.animatables);
    }
    // LEAF drum-circle fire pulse + PointLight flicker + tribal figures
    // (drummers bobbing, dancers orbiting, firekeeper poking the fire).
    // One updater call set per visible drum circle.
    for (let i = 0; i < forestDrumCircles.length; i++) {
      const entry = forestDrumCircles[i];
      const fc = entry.fireCenter;
      if (fc && _farFromPlayer(fc.x, fc.z)) continue;
      updateLeafDrumCircle(nowS, nightness, entry.dc);
      if (entry.figures && entry.figures.length > 0) {
        updateTribalFigures(nowS, nightness, entry.figures);
      }
    }
    // Forest drum-circle audio lowpass — woods absorb the highs as the
    // player drives away from the fire. Inside body = 14kHz (wide open).
    // Past the perimeter, cutoff ramps down to ~2.5kHz over the next 250m.
    for (let i = 0; i < forestDrumMusic.length; i++) {
      const entry = forestDrumMusic[i];
      if (!entry.handle?.setLowpassCutoff) continue;
      const dx = zerble.position.x - entry.centerX;
      const dz = zerble.position.z - entry.centerZ;
      const dist = Math.hypot(dx, dz);
      // outsideness in [0, 1] over 250m past the body perimeter.
      const r = entry.bodyRadius || 100;
      const outsideness = Math.max(0, Math.min(1, (dist - r) / 250));
      const cutoff = 14000 * (1 - outsideness) + 2500 * outsideness;
      entry.handle.setLowpassCutoff(cutoff);
    }

    // Stage music cross-fade. Each active stage has a master GainNode; ramp
    // it by distance so moving between stages fades over ~1.5s. Uses
    // setTargetAtTime(τ=0.6) on the gain AudioParam — that's the same smooth-
    // follow pattern as the forest-drum lowpass loop above.
    // Distance threshold: within 90m = full gain, past 180m = 0. Linear blend.
    const stageRegistry = Sound.getStageHandleRegistry();
    if (stageRegistry.length > 0) {
      const _spx = zerble.position.x, _spz = zerble.position.z;
      for (let i = 0; i < stageRegistry.length; i++) {
        const entry = stageRegistry[i];
        if (!entry.handle?.setAudibility) continue;
        const sdx = entry.x - _spx, sdz = entry.z - _spz;
        const sdist = Math.sqrt(sdx * sdx + sdz * sdz);
        const audibility = Math.max(0, Math.min(1, 1 - (sdist - 90) / 90));
        entry.handle.setAudibility(audibility);
      }
    }

    // Nature ambience proximity. Crickets ramp up near trees/forests (and only
    // at night — sound.js gates on nightness); frogs ramp near a lake edge.
    // Scanning the registry every frame for nearest-tree / nearest-edge is
    // wasteful, so throttle to every 6th frame and reuse the last value.
    _natureScanTimer -= dt;
    if (_natureScanTimer <= 0) {
      _natureScanTimer = 0.1;
      let dForest = Infinity, dTree = Infinity, dLake = Infinity;
      let forestNearX = 0, forestNearZ = 0, lakeNearX = 0, lakeNearZ = 0;
      const px = zerble.position.x, pz = zerble.position.z;
      // Returns the squared distance to the nearest entity of `kind`; also
      // writes the world position of that nearest entity into `posOut`.
      const nearestPos = (kind, cur, posOut) => {
        const ids = registry.byKind.get(kind);
        if (!ids) return cur;
        for (const id of ids) {
          const e = registry.entries.get(id);
          if (!e) continue;
          const ddx = e.position.x - px, ddz = e.position.z - pz;
          const d = ddx * ddx + ddz * ddz;
          if (d < cur) { cur = d; posOut[0] = e.position.x; posOut[1] = e.position.z; }
        }
        return cur;
      };
      const fp = [0, 0], tp = [0, 0], lp = [0, 0];
      dForest = nearestPos('forest_tree', dForest, fp);
      dTree   = nearestPos('tree',        dTree,   tp);
      dLake   = nearestPos('lake_edge',   dLake,   lp);
      const treenessForest = Math.max(0, 1 - Math.sqrt(dForest) / 35);
      const treenessGrove  = Math.max(0, 1 - Math.sqrt(dTree)   / 15) * 0.5;
      _treeness = Math.max(treenessForest, treenessGrove);
      _lakeness = Math.max(0, 1 - Math.sqrt(dLake) / 30);
      // Listener-relative stereo pan: dot the direction-to-target against the
      // camera right vector (heading + 90°). Result in [-1, 1].
      const heading = zerble.heading || 0;
      const rightX = Math.cos(heading), rightZ = -Math.sin(heading);
      // Tree pan — weight by which was closer (forest vs grove).
      if (treenessForest >= treenessGrove) {
        forestNearX = fp[0]; forestNearZ = fp[1];
      } else {
        forestNearX = tp[0]; forestNearZ = tp[1];
      }
      const ftDx = forestNearX - px, ftDz = forestNearZ - pz;
      const ftDist = Math.sqrt(ftDx * ftDx + ftDz * ftDz) || 1;
      _cricketPanVal = Math.max(-1, Math.min(1, (ftDx * rightX + ftDz * rightZ) / ftDist));
      lakeNearX = lp[0]; lakeNearZ = lp[1];
      const lkDx = lakeNearX - px, lkDz = lakeNearZ - pz;
      const lkDist = Math.sqrt(lkDx * lkDx + lkDz * lkDz) || 1;
      _frogPanVal = Math.max(-1, Math.min(1, (lkDx * rightX + lkDz * rightZ) / lkDist));
    }
    Sound.setCricketBed(_treeness, _cricketPanVal);
    Sound.setFrogBed(_lakeness, _frogPanVal);
    Sound.setBirdSongCandidates(birds.songCandidates(zerble.position), birds.activityLevel);

    // Bubble-juice pickups + vendor refuel. Both are registry entries carrying
    // their group in `obj`; tick the float anim, then proximity-check Zerble.
    const jugIds = registry.byKind.get('bubble_jug');
    if (jugIds && jugIds.size > 0) {
      for (const id of [...jugIds]) {       // copy — we may remove mid-iteration
        const e = registry.entries.get(id);
        if (!e) continue;
        e.obj?.userData.anim?.(dt);
        const dx = e.position.x - zerble.position.x;
        const dz = e.position.z - zerble.position.z;
        if (dx * dx + dz * dz < 2.2 * 2.2) {
          bubbles.addJuice(e.juice || 0.45);
          if (e.obj?.parent) e.obj.parent.remove(e.obj);
          registry.remove(id);
          Sound.playJuicePickup();
          HUD.toast('Bubble juice topped up!', 1400);
          Analytics.refuel('jug');
        }
      }
    }
    const vendorIds = registry.byKind.get('bubble_vendor');
    let refuelFromPos = null;     // vendor we're actively drawing juice from this frame
    if (vendorIds && vendorIds.size > 0) {
      let nearVendor = false;
      const REFUEL_RANGE = 7;     // refill from a bit further out than the booth (was 5)
      for (const id of vendorIds) {
        const e = registry.entries.get(id);
        if (!e) continue;
        e.obj?.userData.anim?.(dt);
        const dx = e.position.x - zerble.position.x;
        const dz = e.position.z - zerble.position.z;
        if (dx * dx + dz * dz < REFUEL_RANGE * REFUEL_RANGE) {
          nearVendor = true;
          // Festival Run economy: from Day 2 vendors charge smiles per meter
          // drawn (D6 ramp; Day 1 free). Fractional cost accrues and deducts
          // in whole smiles; a broke cart gets a refusal, not juice.
          const vendorPrice = RunState.active && !RunState.over
            ? RunMode.config.vendorPrice(RunState.day) : 0;
          const canAfford = vendorPrice === 0 || Scoring.current > 0;
          if (bubbles.juice < 1 && !canAfford) {
            if (_vendorRefusalCd <= 0) {
              HUD.toast(`The vendor shrugs — refills are ${vendorPrice} smiles a jug…`, 2400);
              _vendorRefusalCd = 8;
              // The ambient price toast below shares the one toast slot — hold
              // it back so it can't overwrite the shrug in the same frame.
              _vendorToastCd = Math.max(_vendorToastCd, 8);
            }
          } else if (bubbles.juice < 1) {          // vendor tops the current meter only
            const before = bubbles.juice;
            bubbles.addJuice((e.refuel || 0.4) * dt, 1.0);
            if (vendorPrice > 0 && bubbles.juice > before) {
              _vendorCostAccum += (bubbles.juice - before) * vendorPrice;
              const whole = Math.floor(_vendorCostAccum);
              if (whole > 0) {
                _vendorCostAccum -= whole;
                Scoring.deduct(whole);
                HUD.setSmiles(Scoring.current);
              }
            }
            // Flow the stream only while filling a MEANINGFUL deficit, not while
            // the vendor is just countering the always-on drain at a full tank
            // (that read as "rising" every frame and never stopped). The tank
            // still gets topped off invisibly; we just don't draw the stream for
            // it. See REFUEL_STREAM_EPS.
            if (bubbles.juice > before && before < 1 - REFUEL_STREAM_EPS) refuelFromPos = e.position;
          }
        }
      }
      if (nearVendor && _vendorToastCd <= 0) {
        const p = RunState.active && !RunState.over ? RunMode.config.vendorPrice(RunState.day) : 0;
        HUD.toast(p > 0
          ? `Bubble-juice refills: ${p} smiles a jug today.`
          : HUD.withName('Free bubble-juice refill!', 'Free bubble-juice refill, {name}!'), 1600);
        _vendorToastCd = 10;
      }
      // "Full" cue — the moment the stream tops the meter off.
      if (_vendorWasFilling && !refuelFromPos && nearVendor) {
        HUD.toast('Bubble juice full!', 1400);
        Sound.playJuicePickup();
      }
      // One refuel event per fill session — the rising edge of the stream.
      if (refuelFromPos && !_vendorWasFilling) Analytics.refuel('vendor');
      _vendorWasFilling = !!refuelFromPos;
    } else {
      _vendorWasFilling = false;
    }
    if (_vendorToastCd > 0) _vendorToastCd -= dt;
    if (_vendorRefusalCd > 0) _vendorRefusalCd -= dt;
    // Animate the vendor→cart refuel stream (no-op / hidden when not refueling).
    updateRefuelStream(refuelFromPos, zerble.position, dt);

    // Porta-potties — door swing, night vent glow, occupied indicator + wobble,
    // and stink puff on exit. The door target + occupied state are driven by the
    // crowd AI; this just renders them. A fully-idle unit far from the player is
    // skipped. Occupied units near the player emit an occasional comedic noise.
    const pottyIds = registry.byKind.get('porta_potty');
    if (pottyIds && pottyIds.size > 0) {
      const ppx = zerble.position.x, ppz = zerble.position.z;
      for (const id of pottyIds) {
        const e = registry.entries.get(id);
        if (!e || !e.potty) continue;
        const p = e.potty;
        const dx = e.position.x - ppx, dz = e.position.z - ppz;
        const d2 = dx * dx + dz * dz;
        // Skip far units that are fully at rest (door shut, vacant, no stink).
        if (d2 > 75 * 75 && p.doorOpen < 0.01 && !p.occupied && p.stinkTimer <= 0) continue;
        updatePortaPotty(p, dt, nowS, nightness);
        // Comedic noise from an occupied (shut) unit within earshot, throttled.
        if (p.occupied && p.doorOpen < 0.5 && d2 < 40 * 40) {
          p.noiseCd -= dt;
          if (p.noiseCd <= 0) {
            p.noiseCd = 2.2 + Math.random() * 3.0;
            Sound.playPottyNoise(e.position.x, e.position.z);
          }
        }
      }
    }

    // Procedural world expands around Zerble.
    updateWorld(zerble.position, dt);

    // Star power: spawn director + buff state + rainbow/wave/trail visuals.
    // Runs before collision so a pickup this frame engages ghost mode the same
    // frame. The love-magnet smile torrent runs while active.
    StarPower.update(dt, zerble, nightness, nowS);
    bubbles.setStarPower(StarPower.isActive());
    if (StarPower.isActive() && !npcsFrozen()) crowd.applyStarLove(zerble, dt);

    // Collisions: deduct smiles only when Zerble is actively driving into the obstacle.
    // If something brushes a stationary Zerble, just resolve the overlap silently.
    // Star power = pure ghost mode: the whole resolver short-circuits, so Zerble
    // phases through every collider untouched.
    if (zerble.invulnLeft <= 0 && !StarPower.isActive()) {
      // Build a per-frame collider list for nearby crowd NPCs so Zerble can actually
      // bump them. Skip riders + anyone more than 5m away (cheap broad-phase reject).
      // Disembarking NPCs are also skipped entirely for the ~5s disembark window —
      // they're trying to clear Zerble's space, so colliding with them as they
      // hop off (or Zerble starting to roll forward into them) was unfair damage.
      // Reusable scratch — no per-frame array/object-literal allocation. Pools
      // reset, then refilled: nearby registry colliders (localized query, not a
      // spread of all ~4k), the moving-obstacle groups (persistent objects,
      // pushed by reference), and nearby crowd NPCs (6m broadphase, riders +
      // disembarkers skipped). Order matches the old spread so resolveCollision's
      // first-hit semantics are preserved.
      _collScratch.length = 0;
      _regColPoolN = 0;
      _npcColPoolN = 0;
      registry.collidersNear(zerble.position.x, zerble.position.z, zerble.radius + 1, (e) => {
        _collScratch.push(_regColWrap(e));
      });
      for (let i = 0; i < puppets.colliders.length; i++) _collScratch.push(puppets.colliders[i]);
      for (let i = 0; i < band.colliders.length; i++) _collScratch.push(band.colliders[i]);
      for (let i = 0; i < kids.colliders.length; i++) _collScratch.push(kids.colliders[i]);
      for (let i = 0; i < wooks.colliders.length; i++) _collScratch.push(wooks.colliders[i]);
      for (let i = 0; i < hoopers.colliders.length; i++) _collScratch.push(hoopers.colliders[i]);
      for (let i = 0; i < frisbees.colliders.length; i++) _collScratch.push(frisbees.colliders[i]);
      const broadphaseR2 = 36; // 6m broadphase
      for (const n of crowd.npcs) {
        if (n.state === 'riding' || n.state === 'boarding' || n.state === 'disembarking') continue;
        const dx = n.pos.x - zerble.position.x;
        const dz = n.pos.z - zerble.position.z;
        if (dx * dx + dz * dz > broadphaseR2) continue;
        _collScratch.push(_npcColWrap(n));
      }
      const hit = resolveCollision(zerble, _collScratch);
      if (hit && hit.damaging && !isGod()) {
        Scoring.deduct(hit.damage);
        // Damaging PEOPLE hits snap the combo chain (scoring spec) and, in
        // Festival Run, land a vibe strike + scare Lurleen + frown the struck
        // NPC. Prop bonks just cost the smiles, same as always. There is ONE
        // toast slot — a stakes beat (heartbreak/whistle) outranks the generic
        // quip, or a same-frame overwrite makes the beat invisible.
        let stakesToasted = false;
        if (SOFT_PEOPLE_KINDS.has(hit.kind)) {
          Scoring.breakCombo();
          stakesToasted = registerPeopleHit(hit);
        }
        HUD.setSmiles(Scoring.current);
        HUD.flashHit();
        // Ramming an OCCUPIED porta-potty ejects the flustered occupant +
        // gets its own mortified toast bank; otherwise the normal per-kind line.
        if (hit.kind === 'porta_potty' && hit.entry?.potty?.occupied) {
          crowd.onPottyHit(hit.entry);
          HUD.toast(PORTA_POTTY_OCCUPIED_TOASTS[Math.floor(Math.random() * PORTA_POTTY_OCCUPIED_TOASTS.length)], 1700);
        } else if (!stakesToasted) {
          HUD.toast(HUD.withName(
            toastForKind(hit.kind),
            NAMED_HIT_TOASTS[Math.floor(Math.random() * NAMED_HIT_TOASTS.length)]), 1400);
        }
        Sound.playCollision(hit.kind);
        Analytics.collision(hit.kind);
      } else if (hit && hit.notify) {
        // Non-damaging but worth surfacing — e.g. Zerble bumps into Lurleen.
        HUD.toast(toastForKind(hit.kind), 1400);
        Sound.playSoftBump();
      }
    }

    // Honk ring expansion
    if (honkAge < 1.2) {
      honkAge += dt;
      const t = honkAge / 1.2;
      honkRing.position.set(zerble.position.x, 0.1, zerble.position.z);
      const r = 1 + t * 14;
      honkRing.scale.set(r, r, r);
      honkRing.material.opacity = (1 - t) * 0.65;
    } else {
      honkRing.material.opacity = 0;
    }
  }

  chaseCam.update(dt, Input);

  // Keep spatial audio in sync with the camera
  camera.getWorldDirection(_camFwd);
  Sound.updateAudioListener(
    camera.position.x, camera.position.y, camera.position.z,
    _camFwd.x, _camFwd.y, _camFwd.z
  );

  // Distance-cull proxy lights (campsite firepits, drum circles, Sugar
  // Shack spots, etc). Anything past ~40m from the player is turned off
  // so it doesn't pay the per-fragment lighting cost in the shader. Per
  // threejs-lighting skill's "limit light count" guidance.
  ContextLights.update(zerble.position, scene);

  // Adaptive quality watches frame time and drops bloom / shadows /
  // pixel ratio if the budget slips, ramps back if it recovers.
  AdaptiveQuality.tick(dt);

  // F1 (perf-pass-4): gate the bloom pass — skip its full-screen multi-tap cost
  // on frames with nothing bright to bloom. This is the SINGLE owner of
  // `bloomPass.enabled` (the boot init + AdaptiveQuality now only feed it):
  // effective = (tier ∧ adaptive-quality allow) ∧ (something bright in frame).
  // Brightness is gated on `nightness` — emissive bloom here is a dusk/night
  // effect (stage lights, fire, string bulbs, glow) and nightness is a glacial
  // ramp, so there's no flicker — plus star power, whose daytime rainbow glow
  // wants bloom regardless of time of day.
  const bloomNeeded = getTimeOfDay().nightness > 0.08 || StarPower.isActive();
  bloomPass.enabled = AdaptiveQuality.bloomAllowed() && bloomNeeded;

  if (!LAYOUT_CAPTURE_MODE) composer.render();
}

// RAF is throttled to ~0 fps when the tab is backgrounded (e.g. the Claude
// Preview MCP runs the page document.hidden). Fall back to setTimeout in that
// case so the game keeps ticking and the preview tools see real motion.
function scheduleNext() {
  if (document.hidden || LAYOUT_CAPTURE_MODE) setTimeout(tick, 16);
  else requestAnimationFrame(tick);
}

// Threshold: Zerble must be closing on the obstacle at least this fast (m/s) for it
// to count as "driving into" — anything below this is a glancing/passive touch.
const APPROACH_DAMAGE_THRESHOLD = 1.2;

// Soft "people" collider kinds — when Zerble is parked, these never push him
// around. Otherwise a curious NPC walking up to the cart would shove it
// across the grass. Hard kinds (truck, tent, stage, arch, puppet, lurleen)
// always block.
const SOFT_PEOPLE_KINDS = new Set(['person', 'kid', 'wook', 'brass', 'hula_hoop']);

// Witty per-hit toasts for hula-hoopers — random pick keeps it from getting
// stale if Zerble bumps into a few in a row.
const HULA_HOOP_TOASTS = [
  "You broke her flow, man!",
  "Hoop dreams interrupted...",
  "Easy! She's in the zone!",
  "You crashed her hoop trance!",
  "Bonked a hooper — bad karma!",
  "That hoop was somebody's chakra!",
];

// Day-crossing toasts — the ramp speaks so the tightening never feels random.
const DAY_UP_TOASTS = [
  'Day {d} — the vendors raise their prices…',
  'Day {d} — jugs are getting scarce out there.',
  'Day {d} — the crowd expects more of you now.',
  'Day {d} — the marshals are less amused today.',
];

// ---- Festival Run vibe strikes ----
// D16: every stakes consequence of hitting a PERSON hangs off the ONE gate in
// resolveCollision's caller — `hit.damaging && !isGod()` — never the raw
// crowd.onZerbleHit.
// Both return true when they showed a player-facing beat (toast/death), so the
// hit path can hold back its generic quip instead of overwriting it same-frame.
function applyVibeStrike(weight) {
  if (!RunState.active || RunState.over) return false;
  const limits = RunMode.config.vibeLimits(RunState.day);
  const ev = RunState.addStrike(weight, limits);
  if (ev === 'warn') {
    Sound.playMarshalWhistle();
    HUD.toast(HUD.withName(
      'A marshal blows the whistle — ease up on the crowd!',
      'A marshal blows the whistle at {name} — ease up on the crowd!', 0.4), 2800);
    return true;
  } else if (ev === 'eject') {
    endFestivalRun('vibed_out');
    return true;
  }
  return false;
}

function registerPeopleHit(hit) {
  if (!RunState.active || RunState.over) return false;
  let toasted = false;
  if (lurleen.isFollowing || lurleen.state === 'aware') {
    if (lurleen.scareOff()) {
      HUD.toast(HUD.withName('Lurleen saw that. 💔', '{name}! Lurleen saw that. 💔', 0.5), 2400);
      toasted = true;
    }
  }
  if (hit.npc) crowd.frownAt(hit.npc);
  // Ordering: the whistle/ejection (rarer, more urgent) may overwrite the
  // heartbreak — that priority is intentional.
  return applyVibeStrike(VIBE.hitStrike) || toasted;
}

// ---- Festival Run death + rescue ----
function endFestivalRun(cause) {
  if (!RunState.endRun(cause)) return;
  zerble.sputtering = false;
  Sound.stopSputterLoop();
  Sound.playRunEndSting(cause);
  controlsLocked = true;
  const days = RunState.day;
  const rank = Leaderboard.recordLocal({
    name: HUD.getPlayerName(), score: Scoring.highWater, days,
  });
  Analytics.runEnd({
    cause, score: Scoring.highWater, days,
    duration: Math.round(RunState.clock),
    best_combo: Scoring.bestCombo, rescue_used: RunState.rescueUsed,
  });
  if (Leaderboard.globalEnabled()) {
    Leaderboard.globalFinal({
      score: Scoring.highWater, day: days, name: HUD.getPlayerName(), cause,
    });
    Analytics.leaderboardSubmit({ score: Scoring.highWater, days });
  }
  HUD.setSputter(null);
  HUD.setVibe(0, false);
  HUD.showScoreScreen({
    cause: cause === 'vibed_out'
      ? `The marshals walked you out on Day ${days}…`
      : `Zerble ran dry on Day ${days}…`,
    score: Scoring.highWater, days, bestCombo: Scoring.bestCombo,
    board: Leaderboard.localTop(), highlightRank: rank,
  });
}
// Both score-screen actions restart via a plain reload — the mode + name
// persist, so "Run it again!" is one Start tap away (iOS needs the gesture
// for audio anyway; there is no silent mid-session restart path).
HUD.onScoreAgain(() => location.reload());
HUD.onScoreClose(() => { if (RunState.over) location.reload(); });

// Once per run: the sputter grace expired while Lurleen was smitten — she
// stages the pair next to the nearest juice source (teleport-adjacent per the
// carts spec) and tips a minimal refill. No source resident → refill in place
// (design D14; no undefined path, no soft-lock).
function performLurleenRescue() {
  if (!RunState.useRescue()) { endFestivalRun('ran_dry'); return; }
  let nearest = null; let bestD = Infinity;
  for (const e of registry.entries.values()) {
    if (e.kind !== 'bubble_jug' && e.kind !== 'bubble_vendor') continue;
    const dx = e.position.x - zerble.position.x;
    const dz = e.position.z - zerble.position.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD) { bestD = d2; nearest = e; }
  }
  if (nearest) {
    const ang = Math.random() * Math.PI * 2;
    zerble.position.x = nearest.position.x + Math.cos(ang) * 6;
    zerble.position.z = nearest.position.z + Math.sin(ang) * 6;
    zerble.speed = 0;
    lurleen.position.set(zerble.position.x + 3, 0, zerble.position.z + 3);
    lurleen.homePos.copy(lurleen.position);
  }
  bubbles.addJuice(0.35, 1.0);
  zerble.sputtering = false;
  Sound.stopSputterLoop();
  Sound.playJuicePickup();
  HUD.toast(HUD.withName(
    'Lurleen to the rescue! 💗 One tow per festival…',
    'Lurleen hauls {name} to juice! 💗 One tow per festival…', 0.6), 3600);
}

// Named collision quips — HUD.withName swaps one in occasionally when the
// player gave a name (single shared helper; the per-kind banks stay nameless).
const NAMED_HIT_TOASTS = [
  "Easy there, {name}!",
  "Whoa, {name} — watch it!",
  "{name}! The festival has feelings!",
  "Deep breaths, {name}...",
];

const BUBBLE_VENDOR_TOASTS = [
  "Whoa! The juice is for drinking, not crashing!",
  "Careful — you almost spilled the whole batch!",
  "The vendor says: refills are free, dents are not.",
  "Park it, don't plow it!",
  "Easy there — the bubble juice doesn't pour any faster.",
  "You rattled the jugs! No bubbles were harmed.",
  "That's a stand, not a drive-thru!",
  "Tip jar's empty and now so's your patience.",
];

// Porta-potty bonks — empty unit (plain) vs occupied (mortifying).
const PORTA_POTTY_TOASTS = [
  "You bonked a porta-potty. Rude.",
  "Watch the loo!",
  "That's not a ramp — it's a toilet.",
  "Plastic throne, meet bumper.",
  "Easy! Someone's gotta tip those back up.",
  "You rattled the royal flush.",
  "The festival's plumbing thanks you. Not.",
];
const PORTA_POTTY_OCCUPIED_TOASTS = [
  "Someone was IN there!",
  "You tipped an occupied one — yikes!",
  "A flustered camper bolts out. Whoops.",
  "OCCUPIED! ...well, not anymore.",
  "You interrupted someone's quiet time!",
  "That'll be a story they tell for years.",
];

// ---- Per-frame collision scratch ----
// Reused across frames so the collision pass allocates nothing steady-state:
// `_collScratch` is the candidate list handed to resolveCollision; the two
// pools hand out reusable wrapper objects (registry-collider + crowd-NPC
// shapes) refilled each frame. Counters reset at the top of the collision block.
const _collScratch = [];
const _regColPool = [];
let _regColPoolN = 0;
const _npcColPool = [];
let _npcColPoolN = 0;
function _regColWrap(e) {
  let w = _regColPool[_regColPoolN];
  if (!w) { w = {}; _regColPool[_regColPoolN] = w; }
  _regColPoolN++;
  w.position = e.position;
  w.radius = e.collider.radius;
  w.damage = e.collider.damage;
  w.kind = e.kind;
  w.passive = false;
  w.npc = null;
  w.entry = e;          // porta-potty hit handling reads .potty off the entry
  return w;
}
function _npcColWrap(n) {
  let w = _npcColPool[_npcColPoolN];
  if (!w) { w = {}; _npcColPool[_npcColPoolN] = w; }
  _npcColPoolN++;
  w.position = n.pos;          // Vector3; resolveCollision reads .x/.z only
  w.radius = 0.45;
  // A hit is a hit, fleeing or not (Gary, 2026-08-31): the old fleeing→0
  // exemption let a fast cart plow through a scattering crowd for free. The
  // fairness lever moved into the dodge itself — laneDodgeUrgency scales flee
  // speed with cart speed, so people CAN get out of the way of a clean line.
  w.damage = 1;
  w.kind = 'person';
  w.passive = false;
  w.npc = n;
  w.entry = null;       // crowd NPCs carry no registry entry
  return w;
}

function resolveCollision(zerble, colliders) {
  // forward = (-sin(h), 0, -cos(h)); velocity = forward * speed
  const fx = -Math.sin(zerble.heading);
  const fz = -Math.cos(zerble.heading);
  const velX = fx * zerble.speed;
  const velZ = fz * zerble.speed;
  const zerbleParked = Math.abs(zerble.speed) < APPROACH_DAMAGE_THRESHOLD;

  for (const c of colliders) {
    // Passive colliders (e.g. the wook walking up to dose Zerble) are visible
    // but don't push Zerble or deal damage — otherwise their physical radius
    // would prevent Zerble from being inside the proximity trigger range.
    if (c.passive) continue;
    // Parked Zerble can be crowded by people without being pushed around.
    // (Approach-damage already needs Zerble to be moving fast, so this only
    // suppresses the non-damaging position-nudge path below.)
    if (zerbleParked && SOFT_PEOPLE_KINDS.has(c.kind)) continue;
    const tox = c.position.x - zerble.position.x;
    const toz = c.position.z - zerble.position.z;
    const d = Math.hypot(tox, toz);
    const minD = c.radius + zerble.radius;
    if (d >= minD) continue;

    const inv = 1 / (d || 0.0001);
    const approachSpeed = (velX * tox + velZ * toz) * inv;

    if (approachSpeed > APPROACH_DAMAGE_THRESHOLD) {
      // Damaging — Zerble is driving into it
      const pushDir = new THREE.Vector3(-tox * inv, 0, -toz * inv);
      zerble.applyHit(pushDir);
      // NPC-specific reaction: panic, knockback, infect neighbors.
      if (c.kind === 'person' && c.npc) {
        crowd.onZerbleHit(c.npc, tox * inv, toz * inv);
      }
      // Damage > 0 means "deduct smiles". Damage 0 entries (e.g. Lurleen, a
      // fleeing NPC) still need the bounce we just applied, plus a toast/SFX
      // for the named ones — return `notify` so the caller can react.
      const damaging = c.damage > 0;
      const notify = !damaging && (c.kind === 'lurleen');
      return { damaging, damage: c.damage, kind: c.kind, notify, entry: c.entry || null, npc: c.npc || null };
    }

    // Non-damaging contact: nudge Zerble out of overlap, kill any small approach speed.
    const overlap = minD - d;
    zerble.position.x -= tox * inv * overlap;
    zerble.position.z -= toz * inv * overlap;
    if (approachSpeed > 0 && zerble.speed > 0) {
      zerble.speed = Math.max(0, zerble.speed - approachSpeed * 0.6);
    }
    return { damaging: false };
  }
  return null;
}

function toastForKind(kind) {
  switch (kind) {
    case 'puppet': return 'A giant puppet bonked you!';
    case 'brass': return 'You blocked the brass band. Sorry, tuba.';
    case 'truck': return "Don't hit the food trucks!";
    case 'tent': return 'You knocked over a craft tent!';
    case 'kid': return 'Oof — watch the kids!';
    case 'wook': return 'You spooked a wook.';
    case 'person': return 'Watch where you\'re going!';
    case 'stage': return "That's the stage. Drive around it!";
    case 'arch': return 'Mind the arch.';
    case 'lamppost': return 'Bonked a lamppost.';
    case 'drum_circle': return 'You crashed the drum circle!';
    case 'lake_edge': return 'Splash! Carts don\'t float.';
    case 'forest_tree': return 'Ow — that\'s a big tree!';
    case 'firepit': return 'Hot stone, ouch!';
    case 'hula_hoop': return HULA_HOOP_TOASTS[Math.floor(Math.random() * HULA_HOOP_TOASTS.length)];
    case 'bubble_vendor': return BUBBLE_VENDOR_TOASTS[Math.floor(Math.random() * BUBBLE_VENDOR_TOASTS.length)];
    case 'bench_ring': return 'Easy on the benches!';
    case 'picnic_table': return 'Mind the picnic tables!';
    case 'porta_potty': return PORTA_POTTY_TOASTS[Math.floor(Math.random() * PORTA_POTTY_TOASTS.length)];
    case 'island': return 'Tiny island, busy day.';
    case 'lurleen': return 'Easy, lover — that\'s Lurleen.';
    default: return 'Ouch.';
  }
}

function handleResize() {
  // visualViewport reports the *actual visible area* on iOS Safari, which
  // shrinks/grows as the URL bar appears/disappears. Fall back to innerWidth.
  const vv = window.visualViewport;
  const w = Math.round((vv && vv.width) || window.innerWidth);
  const h = Math.round((vv && vv.height) || window.innerHeight);
  // Use default updateStyle=true so the canvas's inline width/height tracks
  // the viewport. Mixing default-true at boot with false here used to leave
  // the canvas displayed at boot dimensions after the URL bar collapsed.
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  bloomPass.setSize(w * 0.5, h * 0.5);
  if (fxaaPass) {
    const pr = renderer.getPixelRatio();
    fxaaPass.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
  }
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
  // iOS often reports the wrong dimensions on the synchronous event; defer.
  setTimeout(handleResize, 250);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', handleResize);
}

window.__game = {
  camera, zerble, scene, renderer, crowd, registry, chaseCam, lurleen,
  getTimeOfDay, Trip, StarPower, midi, birds, bubbles, fireworks,
  kids, wooks, puppets, band, hoopers, frisbees, smiles,
  sound: Sound, layoutCaptureMode: LAYOUT_CAPTURE_MODE,
};

// ---- Local-dev debug backdoor (window.__dbg) ----
// Hooks for verifying the *running* game programmatically, because the real
// UX actively resists automation: the title card needs a trusted gesture to
// dismiss (iOS audio gating), the chase cam overrides any camera you set, and
// driving zerble with a stub input corrupts its physics. These bypass all of
// that. Local dev ONLY — never present on the deployed site.
if (['localhost', '127.0.0.1'].includes(location.hostname) || location.hostname.endsWith('.github.dev')) {
  const waitForStreamStable = async (minimumMs = 4500) => {
    const startedAt = performance.now();
    let lastState = '', lastFrame = -1, stableChecks = 0;
    while (performance.now() - startedAt < 20000) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const snapshot = window.__debug.perfSnapshot();
      const state = `${snapshot.cgN}:${snapshot.reg}`;
      const frame = renderer.info.render.frame;
      stableChecks = state === lastState && frame > lastFrame ? stableChecks + 1 : 0;
      lastState = state;
      lastFrame = frame;
      if (performance.now() - startedAt >= minimumMs && stableChecks >= 4) return;
    }
    throw new Error('World streaming did not settle while rendered frames were advancing.');
  };

  const frameFoodCourt = (dbg, dest) => {
    const heading = Number.isFinite(dest.heading) ? dest.heading : 0;
    const fx = Math.sin(heading), fz = -Math.cos(heading);
    const sx = -fz, sz = fx;
    dbg.camLock(
      dest.x + fx * 5 + sx * 8, 11, dest.z + fz * 5 + sz * 8,
      dest.x + fx * 25, 2.5, dest.z + fz * 25,
    );
  };

  window.__dbg = {
    // Start the game without a trusted gesture — mirrors HUD.onStart (line ~369)
    // minus the iOS audio-gesture dependency, and drops straight into gameplay
    // (no intro reveal). Audio is best-effort; it can stay silent in headless dev.
    start() {
      if (running) return 'already running';
      HUD.hideTitle();
      running = true;
      // Same stakes arming the real Start tap does — a drill that picked
      // Festival Run on the title card must get Festival Run scoring, and the
      // mode-matched resume payload applies here exactly like the real tap.
      Scoring.configure({ stakes: RunMode.isFestival() });
      const dbgResumed = applyResumeGameState();
      if (RunMode.isFestival()) {
        if (!RunState.active) RunState.begin();
        setJugKeepFraction(RunMode.config.jugKeep(RunState.day));
        if (RunState.sputter) zerble.sputtering = true;
        if (!(dbgResumed && Leaderboard.globalRestore(__resume.board))) {
          Leaderboard.globalRunStart();
        }
      }
      document.body.classList.add('game-started');
      const tc = document.getElementById('touch-controls');
      if (tc) tc.setAttribute('aria-hidden', 'false');
      try {
        Sound.init();
        if (RunState.active && RunState.sputter) Sound.startSputterLoop();
      } catch (_) { /* silent audio is fine for dev */ }
      // Skip the opening reveal entirely: controls live immediately.
      controlsLocked = false;
      chaseCam.skipIntro();   // no-op if no intro armed; settles to chase
      return 'started';
    },

    // Pin the camera to a fixed world pose for close-up screenshots; the chase
    // loop is overridden until camUnlock(). Look target defaults to the cart's
    // roughly-torso height at the origin.
    camLock(px, py, pz, tx = 0, ty = 1.8, tz = 0) {
      chaseCam.dbgCamLock(px, py, pz, tx, ty, tz);
      return `cam locked @ (${px}, ${py}, ${pz}) → look (${tx}, ${ty}, ${tz})`;
    },
    camUnlock() {
      chaseCam.dbgCamUnlock();
      return 'cam unlocked';
    },

    // Far-field horizon debug surface (festival-horizon change; inert when
    // ?farField=0 or ?worldgen=0 resolves it off). No arg: read-only live counters + planner
    // state. With a mode, deterministic forcing for fixed-seed A/B and
    // lifecycle captures: 'proxy' snaps every proxy visible, 'real' snaps
    // every proxy dissolved, 'live' returns to predicate-driven handoff,
    // 'replan' drops the snapshot so the next frame replans from scratch.
    horizon(mode) {
      const ff = getFarField();
      if (!ff || !ff.enabled) return { enabled: false };
      if (mode === 'replan') ff.forceReplan();
      else if (mode === 'proxy' || mode === 'real' || mode === 'live') ff.setOwnershipOverride(mode === 'live' ? null : mode);
      else if (mode != null) return `unknown mode '${mode}' — use 'proxy' | 'real' | 'live' | 'replan' or no arg for stats`;
      return {
        enabled: true,
        disposed: ff.disposed,
        stats: { ...ff.stats },
        playerCell: ff._playerCell,
        pendingCells: ff.planner && ff.planner.pending
          ? ff.planner.pending.cells.length - ff.planner.pending.next : 0,
        committed: !!(ff.planner && ff.planner.committed),
        counts: Object.fromEntries(
          ['canopy', 'truss', 'peak', 'warm', 'beacon', 'forest'].map((n) => [n, ff._pools[n].mesh.count]),
        ),
        activeHandoffs: ff._handoffs.length,
        override: ff._ownershipOverride,
      };
    },

    // Bubble-juice level in meters — drives the machine liquid, reserve jugs,
    // and the HUD meter (all poll bubbles.juice each frame).
    setJuice(meters = 1) {
      bubbles.juice = Math.max(0, meters);
      return `juice = ${bubbles.juice}`;
    },

    // Score-screen drills (festival-run-stakes). showScoreScreen renders the
    // overlay with mock data only — the real screen is raised from the death
    // dispatch (endFestivalRun); seedBoard fills the local top-10 with fake
    // legends for layout checks.
    showScoreScreen(mock = {}) {
      HUD.showScoreScreen({
        cause: mock.cause || 'Zerble ran dry on Day 3…',
        score: mock.score ?? 245,
        days: mock.days ?? 3,
        bestCombo: mock.bestCombo ?? 4,
        board: mock.board || Leaderboard.localTop(),
        highlightRank: mock.highlightRank ?? 0,
        viewOnly: !!mock.viewOnly,
      });
      return 'score screen shown';
    },
    // Festival Run drills: jump the day ramp / nudge the vibe meter without
    // real-time driving (runState debug setters; ramp re-applied like a dawn).
    runInfo() {
      return { mode: RunMode.name, run: RunState.serialize(),
               score: Scoring.current, highWater: Scoring.highWater,
               mult: Scoring.multiplier(), chain: Scoring.chain,
               sputteringFlag: zerble.sputtering };
    },
    runDay(n = 2) {
      if (!RunState.active) return 'no active Festival Run — pick Festival Run on the title card first';
      const d = RunState.debugSetDay(n);
      setJugKeepFraction(RunMode.config.jugKeep(d));
      HUD.setDay(d);
      const r = RunMode.config;
      return `day = ${d} · vendor ${r.vendorPrice(d)} smiles · jugKeep ${r.jugKeep(d)} · frown x${r.frownMult(d)} · vibe ${JSON.stringify(r.vibeLimits(d))}`;
    },
    vibe(v = 0) {
      if (!RunState.active) return 'no active Festival Run';
      return `vibe = ${RunState.debugSetVibe(v)}`;
    },
    strike(n = 1) {
      if (!RunState.active) return 'no active Festival Run';
      for (let i = 0; i < Math.max(1, Math.floor(n)); i++) applyVibeStrike(VIBE.hitStrike);
      return `vibe = ${RunState.vibe} (over: ${RunState.over})`;
    },
    sputterLeft(s = 1) {
      if (!RunState.active) return 'no active Festival Run';
      return `sputterLeft = ${RunState.debugSetSputterLeft(s)} (only while sputtering)`;
    },

    seedBoard(n = 6) {
      const names = ['Moonbeam', 'Dusty', '', 'Peaches', 'Ranger Rick', 'Twirl', 'Bo', 'Juniper', 'Sky', 'Gud Vibes'];
      for (let i = 0; i < Math.min(n, 10); i++) {
        Leaderboard.recordLocal({ name: names[i % names.length], score: 400 - i * 37, days: 1 + (i % 5) });
      }
      return `seeded ${Math.min(n, 10)} board entries`;
    },

    addSmiles(n = 1) {
      const add = Math.max(0, Math.floor(n));
      Scoring.collect(add);   // routes through the combo like organic smiles
      HUD.setSmiles(Scoring.current);
      if (RunMode.config.savesPersonalBest) HUD.saveBest(Scoring.current);
      return `smiles = ${Scoring.current} (x${Scoring.multiplier()})`;
    },

    boostStreak() {
      boostStreaks.trigger(zerble);
      return 'boost streak emitted';
    },

    photographer() {
      const npc = crowd.forcePhotographer();
      return npc ? `photographer #${npc.idx} taking picture` : 'no crowd NPC available';
    },

    // Force idle crowd NPC(s) into riding state in seats of the given kind.
    // No arg → one of each seated kind (bench / driver_seat / roof). Great for
    // pose-testing the seated-rider lean without waiting for organic boarding.
    fillSeats(kind) {
      const kinds = kind ? [kind] : ['driver_seat', 'bench', 'roof'];
      const seated = [];
      for (const k of kinds) {
        const name = this.rider(k);
        if (name) seated.push(name);
      }
      return `seated: ${seated.join(', ') || 'none (no free seat/NPC)'}`;
    },

    // Seat one free NPC in the first open slot of `kind`. Replicates the
    // boarding hand-off: claim slot → riding state → snap to worldSeatPosition
    // → write matrices → flag every crowd InstancedMesh dirty.
    rider(kind = 'bench') {
      const slot = zerble.seatSlots?.find((s) => s.kind === kind && !s.occupied);
      if (!slot) return null;
      const npc = crowd.npcs.find((p) =>
        !p.seatSlot && p.state !== 'riding' && p.state !== 'boarding' && p.state !== 'hammock_riding'
      );
      if (!npc) return null;
      slot.occupied = true;
      npc.seatSlot = slot;
      npc.state = 'riding';
      npc.rideTimer = 99999;   // stay put — don't time out mid-screenshot
      const out = new THREE.Vector3();
      zerble.worldSeatPosition(slot, out);
      npc.pos.set(out.x, 0, out.z);
      npc.seatY = out.y;
      npc.yaw = zerble.heading + slot.yaw;
      crowd._writeMatrices(npc);
      for (const m of [crowd.legsMesh, crowd.shoesMesh, crowd.bodyMesh,
                       crowd.armsMesh, crowd.headMesh, crowd.eyesMesh, crowd.mouthMesh]) {
        m.instanceMatrix.needsUpdate = true;
      }
      return slot.name;
    },

    // Time of day, 0..1 (0 dawn · .25 noon · .5 dusk · .75 midnight).
    tod(t = 0.25) {
      getTimeOfDay()?.setT(t);
      return `tod = ${t}`;
    },

    // Fire a firework shell over the cart now (bypasses the night gate). Pass a
    // type from fireworks.SHELL_TYPES, or omit for random. `__dbg.firework('willow')`.
    firework(type) {
      fireworks.launch(zerble.position, type, zerble.heading);
      return `launched ${type || 'random'} shell`;
    },

    // Move the cart to world (x, z), zeroing speed.
    teleport(x = 0, z = 0) {
      zerble.position.set(x, zerble.position.y, z);
      zerble.speed = 0;
      return `teleported to (${x}, ${z})`;
    },

    // Star power test surface. `__dbg.starPower()` triggers the 15s buff
    // immediately; `__dbg.starPower('spawn')` drops a catchable star ~10m
    // ahead so you can drive into it; `__dbg.starPower('end')` cuts it short.
    starPower(mode) {
      if (mode === 'spawn') {
        StarPower._cooldown = 0;
        const f = zerble.forwardWorld;   // (-sin h, 0, -cos h) — authoritative forward
        StarPower._buildStar(zerble.position.x + f.x * 10, zerble.position.z + f.z * 10);
        return 'star spawned 10m ahead';
      }
      if (mode === 'end') { StarPower.state = 'fading'; StarPower._phase = 0; return 'fading out'; }
      StarPower.trigger();
      return 'STAR POWER engaged';
    },

    // READ-ONLY dump of the world registry as a JSON-able array — the captured
    // "built truth" the layout linter checks and bin/layout-snapshot freezes
    // against (guardrail #7: this never mutates the registry or touches
    // chunkKey semantics). Faithful raw read in registry insertion (= build)
    // order; bin/layout-snapshot is what sorts/rounds/excludes the two moving
    // kinds (lurleen, hula_hoop). Two synchronous calls are identical because
    // no frame ticks between them. Optional bounds {minX,minZ,maxX,maxZ} clips
    // to a window (e.g. one hub). Per-cluster draw counts arrive in task 1.4.
    dumpRegistry(bounds) {
      const inBounds = bounds
        ? (p) => p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ
        : () => true;
      const out = [];
      for (const e of registry.entries.values()) {
        const p = e.position;
        if (!inBounds(p)) continue;
        out.push({
          kind: e.kind,
          x: p.x,
          z: p.z,
          footprint: e.footprint || 0,
          colliderR: e.collider ? e.collider.radius : null,
          damage: e.collider ? e.collider.damage : null,
          attractorR: e.attractor ? e.attractor.radius : null,
          attractorW: e.attractor ? e.attractor.weight : null,
          chunkKey: e.chunkKey || null,
        });
      }
      return out;
    },

    // Per-cluster rng draw counts (task 1.4 canary) — a plain {`kind@x,z`: n}
    // map of how many times each worldgen cluster drew from its local rng.
    // Pairs with dumpRegistry: positions match but a count moved = an
    // invisible draw add/drop/reorder. Optional bounds {minX,minZ,maxX,maxZ}
    // clips by the cluster's rounded position parsed from the key.
    dumpDrawCounts(bounds) {
      const out = {};
      for (const [key, n] of worldgenDrawCounts) {
        if (bounds) {
          const m = /@(-?\d+),(-?\d+)$/.exec(key);
          if (m) {
            const x = +m[1], z = +m[2];
            if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) continue;
          }
        }
        out[key] = n;
      }
      return out;
    },

    // Draw-call census of the LIVE scene graph — names WHAT to instance/merge.
    // B0 (the backtick HUD / perf log) reports the true per-frame draw COUNT;
    // this reports the COMPOSITION: it walks every visible rendered mesh and
    // buckets it by geometry fingerprint and by material, so the dominant draw
    // sources name themselves. A shared geometry drawn hundreds of times is an
    // InstancedMesh candidate; a pile of unique (drawn-once) geometries sharing a
    // material is a geometry-merge candidate. Scene-graph census = PRE-frustum,
    // so it over-counts vs renderer.info (which is post-cull) — read it for the
    // RATIO between kinds, not as the exact frame number. READ-ONLY.
    // Drive to a dense hub, park, then call. Pass {top} to widen the lists.
    drawCensus({ top = 20 } = {}) {
      let meshes = 0, instanced = 0, instancedInstances = 0;
      const geo = new Map();   // fingerprint -> { draws, instances, shared, type, verts, mat }
      const mat = new Map();   // matName    -> { draws, shared, transparent, type }
      scene.traverse((o) => {
        if (!o.visible) return;
        const isI = o.isInstancedMesh, isM = o.isMesh && !isI;
        if (!isI && !isM) return;
        if (isI) { instanced++; instancedInstances += o.count || 0; } else meshes++;
        const g = o.geometry, m = Array.isArray(o.material) ? o.material[0] : o.material;
        const verts = g?.attributes?.position?.count ?? 0;
        const gShared = !!g?.userData?.shared;
        const mName = (m && (m.name || m.type)) || 'none';
        const fp = `${g?.type || 'Geo'}·${verts}v·${gShared ? 'shared' : 'uniq'}·${mName}${isI ? '·INST' : ''}`;
        const ge = geo.get(fp) || { draws: 0, instances: 0, shared: gShared, type: g?.type, verts, mat: mName };
        ge.draws++; if (isI) ge.instances += o.count || 0; geo.set(fp, ge);
        const me = mat.get(mName) || { draws: 0, shared: !!m?.userData?.shared, transparent: !!m?.transparent, type: m?.type };
        me.draws++; mat.set(mName, me);
      });
      const byDraws = (a, b) => b[1].draws - a[1].draws;
      const topGeo = [...geo.entries()].sort(byDraws).slice(0, top)
        .map(([fp, v]) => ({ what: fp, draws: v.draws, instances: v.instances || undefined, shared: v.shared }));
      const topMat = [...mat.entries()].sort(byDraws).slice(0, top)
        .map(([name, v]) => ({ material: name, draws: v.draws, shared: v.shared, transparent: v.transparent }));
      // Merge candidates: unique (non-shared, drawn-once) geos grouped by material.
      const mergeByMat = {};
      for (const [, v] of geo) if (!v.shared && v.draws === 1) mergeByMat[v.mat] = (mergeByMat[v.mat] || 0) + 1;
      const result = {
        sceneDraws: meshes + instanced, meshes, instancedMeshes: instanced, instancedInstances,
        note: 'scene-graph census, PRE-frustum (over-counts vs renderer.info). Ratios, not exact.',
        topGeometriesByDraws: topGeo,
        topMaterialsByDraws: topMat,
        mergeCandidateUniqueGeosByMaterial: Object.fromEntries(
          Object.entries(mergeByMat).sort((a, b) => b[1] - a[1]).slice(0, top)),
      };
      console.log('[drawCensus]', result.sceneDraws, 'scene draws —',
        meshes, 'meshes +', instanced, 'instanced(', instancedInstances, 'instances). Top geo:');
      console.table(topGeo);
      return result;
    },

    // Shader-program leak finder. `renderer.info.programs` is three.js's live
    // program cache; each entry's `.cacheKey` is the comma-joined list of every
    // parameter that forces a DISTINCT program (shaderID, defines, light counts,
    // map presence, the material's customProgramCacheKey, …). A monotonically
    // climbing program count (the perf-log `prog` field) means something mints a
    // new cacheKey as you explore and never releases it. This groups the live
    // cache by material family (shaderID + token-count, so columns align within a
    // family) and, per family, reports which token POSITION varies and its sample
    // values — so the proliferating parameter names itself instead of being
    // guessed. Call it, drive/teleport across a few hubs, call it again, and the
    // family whose `programs` count exploded is the leak host. Pass {raw:true} to
    // also get every cacheKey for offline diffing. READ-ONLY.
    dumpPrograms(opts = {}) {
      const progs = [...(renderer.info.programs || [])];
      const rows = progs.map((p) => ({
        used: p.usedTimes,
        tok: String(p.cacheKey).split(','),
      }));
      const fam = new Map();
      for (const r of rows) {
        const fk = r.tok[0] + ' #' + r.tok.length;   // shaderID + token count
        let arr = fam.get(fk);
        if (!arr) { arr = []; fam.set(fk, arr); }
        arr.push(r);
      }
      const families = [...fam.entries()].map(([family, members]) => {
        const ncol = members[0].tok.length;
        const cols = [];
        for (let i = 0; i < ncol; i++) {
          const vals = new Set();
          for (const m of members) vals.add(m.tok[i]);
          if (vals.size > 1) cols.push({ col: i, distinct: vals.size, sample: [...vals].slice(0, 12) });
        }
        cols.sort((a, b) => b.distinct - a.distinct);
        return { family, programs: members.length, varying: cols.slice(0, 6) };
      }).sort((a, b) => b.programs - a.programs);
      const out = { total: progs.length, families: families.slice(0, 14) };
      if (opts.raw) out.keys = progs.map((p) => String(p.cacheKey));
      console.log(`[programs] ${progs.length} total · ${families.length} families · top: ` +
        families.slice(0, 4).map((f) => `${f.family}×${f.programs}`).join('  '));
      return out;
    },

    // nth-nearest festival hub: teleport there + a canonical 3/4 camLock
    // looking at the stage front. `n` ranks hubs by distance from the SPAWN
    // hub (so gotoHub(0) is always the spawn hub, seed-stable). Prints the
    // planned hub-sandbox URL (?at=x,z — the form the group-6 hub viewer will
    // accept) so the same hub is re-openable there.
    gotoHub(n = 0) {
      // Anchor on the SPAWN hub (the major the game relocates to), not the
      // cart's live position — spawn-relocation offsets the cart onto the
      // dancefloor, which can leave it nearer the next hub over. Ranking from
      // the spawn hub makes gotoHub(0) the spawn hub itself (it's at distance 0)
      // and is seed-stable regardless of where the cart currently sits.
      const anchor = spawnHeart() || nearestHeart(0, 0).heart;
      if (!anchor) return 'no hubs found near origin';
      const ax = anchor.x, az = anchor.z, R = 600;
      const hearts = heartsInBounds(ax - R, az - R, ax + R, az + R)
        .sort((a, b) => Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az));
      const heart = hearts[n];
      if (!heart) return `no hub #${n} within ${R}m of the spawn hub (found ${hearts.length})`;
      const plan = festivalPlan(heart);
      const stage = plan[0] || { x: heart.x, z: heart.z, yaw: 0, kind: '?' };
      // Stage model-front is +Z; rotating it by stage.yaw about Y gives the world
      // facing F = (sin yaw, cos yaw). View from out front (the dancefloor side),
      // offset to one side, elevated — looking back at the stage.
      const fx = Math.sin(stage.yaw), fz = Math.cos(stage.yaw);
      const D = 34, side = 12, H = 20;
      const camX = stage.x + fx * D - fz * side;
      const camZ = stage.z + fz * D + fx * side;
      this.teleport(heart.x, heart.z);   // load the hub's chunks around the cart
      chaseCam.dbgCamLock(camX, H, camZ, stage.x, 4, stage.z);
      // Plan-mode lint for THIS hub, printed inline so a tour surfaces findings
      // (4.6). Read-only: runLint sets the session seed to the one passed (the
      // current one) and restores it — no world regen. RECORD-not-fix; see
      // DEBUGGING.md "Layout linter".
      let lintLine = '';
      try {
        const R = MAX_POI_REACH;
        const lr = runLint({ seeds: [getSessionSeed()], bounds: { minX: heart.x - R, minZ: heart.z - R, maxX: heart.x + R, maxZ: heart.z + R } });
        const mine = lr.violations.filter((v) => v.hub && v.hub.cx === heart.cx && v.hub.cz === heart.cz);
        if (mine.length) {
          const byRule = {};
          for (const v of mine) byRule[v.rule] = (byRule[v.rule] || 0) + 1;
          console.warn(`[lint] hub (${heart.cx},${heart.cz}): ` + Object.entries(byRule).map(([k, c]) => `${k}×${c}`).join(', '));
          for (const v of mine.slice(0, 5)) console.warn(`  ! ${v.detail}  → ${v.links.teleport}`);
          lintLine = ` · lint: ${mine.length} (${Object.keys(byRule).join('/')})`;
        } else {
          lintLine = ' · lint: clean';
        }
      } catch (e) { lintLine = ' · lint: err ' + e.message; }
      const url = `hub-sandbox.html?seed=${getSessionSeed()}&at=${Math.round(heart.x)},${Math.round(heart.z)}`;
      return `hub #${n} ${heart.rank} @ (${heart.x}, ${heart.z}) · stage ${stage.kind} · ${url}${lintLine}`;
    },

    // Top-down plan view centered on (x, z) (default: the cart), framing a
    // `span`-metre square. Camera height solves span = 2·H·tan(fov/2). North-up
    // (the straight-down up-vector singularity is handled in camera.js).
    topDown(x = zerble.position.x, z = zerble.position.z, span = 240) {
      const fovRad = camera.fov * Math.PI / 180;
      const H = span / (2 * Math.tan(fovRad / 2));
      chaseCam.dbgCamTopDown(x, z, H);
      return `top-down over (${Math.round(x)}, ${Math.round(z)}) · span ${span}m · height ${H.toFixed(1)}m`;
    },

    // Toggle a footprint overlay: a ring at each registered cluster's clear-
    // radius + the dancefloor rects in front of every nearby stage. Plain line
    // geometry, NOT registered, NOT `userData.shared`, NO castShadow — disposes
    // fully on toggle-off so renderer.info returns to pre-toggle counts
    // (guardrails #5/#6). Idempotent: re-tears-down before rebuilding.
    showFootprints(on = true) {
      if (this._fpGroup) {
        scene.remove(this._fpGroup);
        this._fpGroup.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
        this._fpGroup = null;
      }
      if (!on) return 'footprints off';
      // Skip scenery: the overlay is for festival-cluster composition (the
      // overlaps the linter cares about), not the thousands of forest trees /
      // shoreline edges / path nodes that dodge everything anyway.
      const SKIP = new Set(['forest_tree', 'tree', 'lake', 'lake_edge', 'shore', 'beach', 'path_node', 'bubble_jug']);
      const SEGS = 28;
      const fpVerts = [];
      for (const e of registry.entries.values()) {
        if (SKIP.has(e.kind)) continue;
        const r = e.footprint || 0;
        if (r <= 0) continue;
        const p = e.position;
        for (let i = 0; i < SEGS; i++) {
          const a0 = (i / SEGS) * Math.PI * 2, a1 = ((i + 1) / SEGS) * Math.PI * 2;
          fpVerts.push(p.x + Math.cos(a0) * r, 0.12, p.z + Math.sin(a0) * r,
                       p.x + Math.cos(a1) * r, 0.12, p.z + Math.sin(a1) * r);
        }
      }
      const px = zerble.position.x, pz = zerble.position.z, B = 320;
      const dfVerts = [];
      for (const rect of dancefloorRectsNear(px - B, pz - B, px + B, pz + B)) {
        const { cx, cz, dirx, dirz, depth, halfWidth } = rect;
        const rx = -dirz, rz = dirx;   // right = perpendicular to the facing
        const c = [
          [cx + rx * halfWidth, cz + rz * halfWidth],
          [cx + dirx * depth + rx * halfWidth, cz + dirz * depth + rz * halfWidth],
          [cx + dirx * depth - rx * halfWidth, cz + dirz * depth - rz * halfWidth],
          [cx - rx * halfWidth, cz - rz * halfWidth],
        ];
        for (let i = 0; i < 4; i++) {
          const a = c[i], b = c[(i + 1) % 4];
          dfVerts.push(a[0], 0.14, a[1], b[0], 0.14, b[1]);
        }
      }
      const group = new THREE.Group();
      const mkLines = (verts, color) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color }));
        ls.castShadow = false;
        return ls;
      };
      if (fpVerts.length) group.add(mkLines(fpVerts, 0x33ff88));
      if (dfVerts.length) group.add(mkLines(dfVerts, 0xffcc33));
      scene.add(group);
      this._fpGroup = group;
      return `footprints on — ${fpVerts.length / 6} rings, ${dfVerts.length / 8} dancefloor rects`;
    },

    // ---- One door: __dbg also reaches the other two surfaces ----
    // Getters (not captured at definition time) because installDebug() runs
    // after this block, so window.__debug doesn't exist yet right here.
    // `__dbg.game`  → live object refs (same object as window.__game).
    // `__dbg.debug` → the interactive overlay API (window.__debug):
    //   freezeNPCs / pause / step / god / showColliders / dropSmile / spawnNPC.
    get game() { return window.__game; },
    get debug() { return window.__debug; },

    // ---- Perf log recorder (delegates to the overlay's API) ----
    // recordPerf(true) starts sampling engine stats (FPS/draws/tris/geo/tex/
    // shader-programs/heap/counts) into a localStorage-backed ring buffer that
    // survives the page going unresponsive + a reload; perfLog() reads it back.
    // Also a panel surface: backtick → "Perf log" section (Record / copy JSON).
    recordPerf(on = true) { return window.__debug.recordPerf(on); },
    perfLog() { return window.__debug.perfLog(); },
    chunkStages(reset = false) { return window.__debug.chunkStages(reset); },

    async foodCourtVisual({ settleMs = 4500 } = {}) {
      this.start();
      window.__debug.freezeNPCs(true);
      AdaptiveQuality.setEnabled(false);
      AdaptiveQuality.applyLevel(0);
      this.tod(0.75);
      const dest = window.__debug.locate('food_court');
      if (!dest) throw new Error('No food court found within the debug locator search window.');
      frameFoodCourt(this, dest);
      await waitForStreamStable(settleMs);
      frameFoodCourt(this, dest);
      return dest;
    },

    // Repeatable real-GPU gate for perf-pass-4's food-truck + Sugar Shack
    // model merges. The paired ?modelMerge=0/1 URLs keep the world, tier, and
    // camera identical while changing only those two post-build merges.
    // Captures are written through the dev-server bridge for agent analysis.
    async foodCourtCapture({ settleMs = 4500, samples = 6, intervalMs = 500 } = {}) {
      this.start();
      window.__debug.freezeNPCs(true);
      AdaptiveQuality.setEnabled(false);
      AdaptiveQuality.applyLevel(0);
      this.tod(0.75);
      const dest = window.__debug.locate('food_court');
      if (!dest) throw new Error('No food court found within the debug locator search window.');
      frameFoodCourt(this, dest);
      await waitForStreamStable(settleMs);
      const readings = [];
      for (let i = 0; i < samples; i++) {
        readings.push(window.__debug.perfSnapshot());
        if (i + 1 < samples) await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      const mode = MODEL_DECOR_MERGE_ENABLED ? 'merged' : 'unmerged';
      const median = (key) => {
        const values = readings.map((row) => row[key]).sort((a, b) => a - b);
        const mid = Math.floor(values.length / 2);
        return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
      };
      const data = {
        kind: 'food-court-draw-capture',
        seed: getSessionSeed(),
        tier: PERF.name,
        modelMerge: MODEL_DECOR_MERGE_ENABLED,
        quality: AdaptiveQuality.getLevelName(),
        tod: getTimeOfDay()?.t ?? null,
        destination: dest,
        summary: {
          draws: median('draws'),
          tris: median('tris'),
          fps: median('fps'),
          frameP95: median('fP95'),
          geometries: readings.at(-1)?.geo ?? null,
          programs: readings.at(-1)?.prog ?? null,
        },
        readings,
        census: this.drawCensus({ top: 20 }),
      };
      const saved = await this.capture(`foodcourt-${PERF.name}-${mode}`, data);
      if (!saved) throw new Error('The food-court capture could not be written by the dev server.');
      console.log(`[foodCourtCapture] ${PERF.name}/${mode}`, data);
      return data;
    },

    // Alternates between the same deterministic food-court position and a
    // distant position. Repeated samples at the distant position expose merged
    // geometries that escaped chunk disposal because the surrounding content is
    // identical on every revisit.
    async foodCourtLifecycle({ settleMs = 4500, cycles = 5 } = {}) {
      this.start();
      window.__debug.freezeNPCs(true);
      AdaptiveQuality.setEnabled(false);
      AdaptiveQuality.applyLevel(0);
      this.tod(0.75);
      const court = window.__debug.locate('food_court');
      if (!court) throw new Error('No food court found within the debug locator search window.');
      const away = { x: court.x + 960, z: court.z + 960 };
      const timeline = [];
      const settleAt = async (label, x, z) => {
        this.teleport(x, z);
        if (label.startsWith('court-')) frameFoodCourt(this, court);
        else this.camLock(x + 28, 18, z + 28, x, 2, z);
        await waitForStreamStable(settleMs);
        const mergedGeometryIds = new Set();
        scene.traverse((object) => {
          if (object.geometry?.userData?.mergeDecor) mergedGeometryIds.add(object.geometry.uuid);
        });
        timeline.push({
          label,
          ...window.__debug.perfSnapshot(),
          mergedGeometriesInScene: mergedGeometryIds.size,
          mergeDecor: getMergeDecorStats(),
        });
      };
      for (let i = 1; i <= cycles; i++) {
        await settleAt(`court-${i}`, court.x, court.z);
        await settleAt(`away-${i}`, away.x, away.z);
      }
      const awayGeometries = timeline.filter((row) => row.label.startsWith('away-')).map((row) => row.geo);
      const plateauRows = timeline.filter((row) => row.label.startsWith('away-')).slice(2);
      const plateau = plateauRows.map((row) => row.geo);
      const plateauSpread = plateau.length ? Math.max(...plateau) - Math.min(...plateau) : Infinity;
      const plateauTolerance = plateau.length ? Math.max(2, Math.round(plateau.at(-1) * 0.01)) : 0;
      const mergedLive = plateauRows.map((row) => row.mergeDecor.live);
      const mergeDisposalStable = !MODEL_DECOR_MERGE_ENABLED ||
        (mergedLive.length > 1 && mergedLive.every((n) => n === mergedLive[0]));
      const data = {
        kind: 'food-court-lifecycle-capture',
        seed: getSessionSeed(),
        tier: PERF.name,
        modelMerge: MODEL_DECOR_MERGE_ENABLED,
        court,
        away,
        awayGeometries,
        plateauSpread,
        plateauTolerance,
        mergeDisposalStable,
        returnsToBaseline: plateau.length > 1 && plateauSpread <= plateauTolerance && mergeDisposalStable,
        timeline,
      };
      const mode = MODEL_DECOR_MERGE_ENABLED ? 'merged' : 'unmerged';
      const saved = await this.capture(`foodcourt-lifecycle-${PERF.name}-${mode}`, data);
      if (!saved) throw new Error('The food-court lifecycle capture could not be written by the dev server.');
      this.teleport(court.x, court.z);
      this.tod(0.75);
      frameFoodCourt(this, court);
      await waitForStreamStable(settleMs);
      frameFoodCourt(this, court);
      console.log(`[foodCourtLifecycle] ${PERF.name}/${mode}`, data);
      return data;
    },

    // capture(name?, data?) POSTs data to the dev server, which writes it to
    // .claude/captures/<name>.json — the browser->repo bridge for handing data
    // to an agent that can't see this tab (no copy/paste needed). Default name
    // 'perflog', default data the perf log. Keep names to [A-Za-z0-9_-].
    // e.g. __dbg.capture()  ·  __dbg.capture('programs', __dbg.dumpPrograms())
    capture(name = 'perflog', data) {
      const payload = data !== undefined ? data : window.__debug.perfLog();
      return fetch('/__capture/' + name, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.text().then((t) => {
          console.log(`[capture] ${r.ok ? 'OK' : 'FAIL ' + r.status} — ${t}`);
          return r.ok;
        }))
        .catch((e) => { console.log('[capture] error — is the dev server running?', e); return false; });
    },

    // Self-documenting map of the whole agent debug surface. Start here.
    help() {
      const out = [
        'window.__dbg — agent control surface (localhost only). The one door.',
        '  drive:   start() · teleport(x,z) · tod(t 0..1) · setJuice(m) · addSmiles(n) · boostStreak() · photographer() · fillSeats(kind?) · rider(kind)',
        '  board:   showScoreScreen(mock?) · seedBoard(n?)   (festival-run score screen + local top-10 drills)',
        '  run:     runInfo() · runDay(n) · vibe(v) · strike(n) · sputterLeft(s)   (stakes drills — need localStorage["zerble-mode"]="festival" before start())',
        '  camera:  camLock(px,py,pz, tx,ty,tz) · camUnlock() · topDown(x?,z?,span)   (pins a pose; overrides chase cam)',
        '  layout:  dumpRegistry(bounds?) · dumpDrawCounts(bounds?)   (read-only built-truth + canary → bin/layout-snapshot)',
        '  draws:   drawCensus({top?})   (scene draw-call composition by geometry/material → names instance/merge targets)',
        '  hubs:    gotoHub(n) · showFootprints(on)   (teleport+frame nth-nearest hub; footprint/dancefloor overlay)',
        '  perf:    recordPerf(true|false) · perfLog() · chunkStages(reset?) · foodCourtVisual() · foodCourtCapture() · foodCourtLifecycle()',
        '           dumpPrograms({raw?})   (shader-program leak finder: groups renderer.info.programs by family + varying token)',
        '           capture(name?, data?)   (POST data to dev server -> .claude/captures/<name>.json; the browser->repo bridge, no copy/paste)',
        '  horizon: horizon() stats · horizon(\'proxy\'|\'real\'|\'live\') force ownership · horizon(\'replan\')   (off with ?farField=0)',
        '  reach:   __dbg.game  (live refs: camera, zerble, scene, crowd, bubbles, …)',
        '           __dbg.debug (interactive API: freezeNPCs, pause, step, god, showColliders, dropSmile, spawnNPC)',
        '  verify:  __dbg.start() → __dbg.fillSeats() → __dbg.camLock(...) → screenshot → console-logs',
        '  full reference: DEBUGGING.md',
      ].join('\n');
      console.log(out);
      return out;
    },
  };
}

installDebug({
  scene, camera, renderer, bloomPass,
  zerble, crowd, bubbles, smiles, registry,
  puppets, band, kids, wooks,
  hoopers, frisbees,
  lurleen,                              // teleport menu uses .position
  getRunning: () => running,
  getTimeOfDay,
  getFarField,                          // perf samples record horizon counters
  Trip, StarPower,
  midi,
});

// One-URL real-GPU suite. Each step reloads with one deliberate variable
// change, tier or modelMerge, then writes the capture through the local server.
// It is local-dev only because __dbg itself is local-dev only.
if (window.__dbg) {
  const gateParams = new URLSearchParams(location.search);
  if (gateParams.get('perfGate') === 'suite' && gateParams.get('perfGateDone') !== '1') {
    const steps = [
      { perf: 'low',  modelMerge: '0', run: 'draw' },
      { perf: 'low',  modelMerge: '1', run: 'draw' },
      { perf: 'mid',  modelMerge: '0', run: 'draw' },
      { perf: 'mid',  modelMerge: '1', run: 'draw' },
      { perf: 'high', modelMerge: '0', run: 'draw' },
      { perf: 'high', modelMerge: '1', run: 'draw' },
      { perf: 'high', modelMerge: '0', run: 'lifecycle' },
      { perf: 'high', modelMerge: '1', run: 'lifecycle' },
    ];
    const stepIndex = Math.max(0, parseInt(gateParams.get('perfGateStep') || '0', 10) || 0);
    const step = steps[stepIndex];
    if (step) {
      const currentPerf = gateParams.get('perf');
      const currentMerge = gateParams.get('modelMerge') || '1';
      if (currentPerf !== step.perf || currentMerge !== step.modelMerge) {
        gateParams.set('perf', step.perf);
        gateParams.set('modelMerge', step.modelMerge);
        gateParams.set('perfGateStep', String(stepIndex));
        location.replace(`${location.pathname}?${gateParams}`);
      } else {
        setTimeout(async () => {
          try {
            if (step.run === 'lifecycle') await window.__dbg.foodCourtLifecycle();
            else await window.__dbg.foodCourtCapture();
            const next = stepIndex + 1;
            if (next < steps.length) {
              gateParams.set('perfGateStep', String(next));
              location.replace(`${location.pathname}?${gateParams}`);
            } else {
              gateParams.set('perfGateDone', '1');
              history.replaceState(null, '', `${location.pathname}?${gateParams}`);
              HUD.toast('Perf capture complete · nighttime food court ready', 300000);
              console.log('[perfGate] suite complete — captures are in .claude/captures/');
            }
          } catch (error) {
            gateParams.set('perfGateDone', 'error');
            history.replaceState(null, '', `${location.pathname}?${gateParams}`);
            HUD.toast(`Perf capture stopped: ${error.message}`, 8000);
            console.error('[perfGate] suite stopped', error);
          }
        }, 100);
      }
    }
  } else if (gateParams.get('perfGate') === 'visual' && gateParams.get('perfGateDone') !== '1') {
    setTimeout(async () => {
      try {
        await window.__dbg.foodCourtVisual();
        gateParams.set('perfGateDone', '1');
        history.replaceState(null, '', `${location.pathname}?${gateParams}`);
        HUD.toast('Nighttime food court ready', 300000);
      } catch (error) {
        gateParams.set('perfGateDone', 'error');
        history.replaceState(null, '', `${location.pathname}?${gateParams}`);
        HUD.toast(`Food-court view stopped: ${error.message}`, 8000);
        console.error('[perfGate] visual stopped', error);
      }
    }, 100);
  }
}

tick();
