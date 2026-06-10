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
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import { Input } from './input.js';
import { Touch } from './touch.js';
import { HUD } from './hud.js';
import { buildWorld, updateWorld, getTimeOfDay } from './world.js';
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
import { setSpawnPoint, buildSpawnArch } from './chunks.js';
import { nearestHeart, nearestMajorHeart } from './worldgen/hearts.js';
import { festivalPlan, computeFrontAxis } from './worldgen/festival.js';
import { nearestRoad } from './worldgen/roads.js';
import { lakeAt } from './worldgen/water.js';
import { CONFIG } from './worldgen/constants.js';
import { Trip } from './trip.js';
import { Analytics } from './analytics.js';
import * as ContextLights from './contextLights.js';
import * as AdaptiveQuality from './adaptiveQuality.js';
import { setSessionSeed, getSessionSeed } from './rng.js';

// ---------- Session seed ----------
// `?seed=<thing>` pins the world to a specific layout — pass a string
// ("bananas") and it's FNV-hashed to a 32-bit int; pass a number and it's
// used as-is. No param → fresh random seed per load. The (0,0) chunk's
// main stage + entrance arch stay identical across seeds (see chunks.js
// pickTheme + ChunkManager._generate) so spawn always feels the same;
// everything else (lake placements, forest contents, neighbouring chunk
// themes, music + drum seeds, Lurleen's starting position) re-rolls.
(function initSessionSeed() {
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

// ---------- Scene & Camera ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 1500);

// ---------- Post-processing ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
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
Trip.onNarrate = () => {
  const msg = TRIP_NARRATIVE_TEXTS[Math.floor(Math.random() * TRIP_NARRATIVE_TEXTS.length)];
  HUD.toast(msg, 3200);
};

// ---------- Zerble + Smiles + Bubbles ----------
const zerble = new Zerble();
zerble.position.set(0, 0, 65);
zerble.heading = 0;
scene.add(zerble.root);

// v2 worldgen: spawn at the nearest HUB (ANY rank — at dense configs there may be
// no MAJOR near origin, D3 finding), so the player opens straight INTO a festival,
// out on the stage's open dancefloor (+F) facing the stage. Runs at module-eval (the
// session seed is already resolved above; this is NOT inside the title-tap handler,
// so it never pushes Sound.init off the synchronous gesture — iOS audio tripwire /
// R31). The stage + clusters come free from the hub's festivalPlan (built when its
// chunk loads). Falls back to the pinned (0,65) spawn if no hub/stage resolves.
// (The single entrance ARCH on the approach road — A1, Gary's pick — is deferred to
// the arch build; this is the interim "spawn at the festival, see the stage" arrival.)
if (USE_WORLDGEN_V2) {
  // Spawn at the nearest MAJOR hub so the player opens facing a MAIN STAGE (the
  // wood-roof one) across its cleared dancefloor — the festival's front door (A1 /
  // round-2 A). `nearestMajorHeart(0,0)` is never null in practice (verified over
  // 2000 seeds — D9, correcting the round-2 handoff); fall back to any heart, then
  // the pinned (0,65) spawn. The stage faces +F (the bisector of the widest road
  // GAP), so the dancefloor opens along +F — we spawn out on that dancefloor front,
  // facing back across it at the stage. "The space in front of the stage determines
  // where Zerble + the arch go" (Gary). The arch sits at the front edge so you look
  // THROUGH it at the stage. Runs at module-eval (seed already resolved) — NOT inside
  // the title tap, so it never pushes Sound.init off the synchronous gesture (R31).
  const heart = nearestMajorHeart(0, 0) || nearestHeart(0, 0).heart;
  const plan = heart ? festivalPlan(heart) : [];
  const stage = plan.find((p) => p.kind === 'main_stage' || p.kind === 'side_stage' || p.kind === 'tent_stage');
  if (heart && stage) {
    const fa = computeFrontAxis(heart);
    const fx = Math.cos(fa.bearing), fz = Math.sin(fa.bearing);   // +F: stage front / dancefloor
    const scale = stage.scale || 1;
    // Keep arch + spawn INSIDE the cleared dancefloor (its depth ≈ 38·scale in
    // festival.js dancefloorRect), so Zerble opens in clear ground looking back at the
    // stage — not at the tree line where the clearing ends. Arch ~mid, spawn ~70% out.
    const archDist = 15 * scale;
    const spawnDist = 26 * scale;
    let sx = Math.round(stage.x + fx * spawnDist);
    let sz = Math.round(stage.z + fz * spawnDist);
    let ax = Math.round(stage.x + fx * archDist);
    let az = Math.round(stage.z + fz * archDist);

    // On-a-road bonus (Gary likes spawning on a road): if a road clips the dancefloor
    // front, slide arch + spawn onto it by the SAME lateral offset so they stay aligned.
    // F is the road GAP, so this only fires when a road actually borders the front; most
    // hubs spawn on the open dancefloor. The heading still faces the stage either way.
    const nr = nearestRoad(sx, sz);
    if (nr.dist > 1 && nr.dist <= CONFIG.ROAD_WIDTH + 4) {
      const ox = Math.cos(nr.dirAngle) * nr.dist, oz = Math.sin(nr.dirAngle) * nr.dist;
      sx = Math.round(sx + ox); sz = Math.round(sz + oz);
      ax = Math.round(ax + ox); az = Math.round(az + oz);
    }

    // Keep the spawn dry — walk toward the (dry) stage if a lakeshore clips it.
    if (lakeAt(sx, sz)) {
      const tox = stage.x - sx, toz = stage.z - sz, tol = Math.hypot(tox, toz) || 1;
      for (let d = 6; d <= 66; d += 6) {
        const nx = Math.round(sx + (tox / tol) * d), nz = Math.round(sz + (toz / tol) * d);
        if (!lakeAt(nx, nz)) { sx = nx; sz = nz; break; }
      }
    }

    // No vendor booths clipping the spawn (round-2 A). Vendors straddle ROADS (off the
    // +F gap), so this is belt-and-suspenders: push the spawn out along +F if a
    // vendor_row cluster center sits within its footprint, then re-check it stays dry.
    for (const p of plan) {
      if (p.kind !== 'vendor_row') continue;
      const clear = (p.footprint || 12) + 5;
      const ddx = sx - p.x, ddz = sz - p.z;
      if (ddx * ddx + ddz * ddz < clear * clear) {
        const px = Math.round(sx + fx * clear), pz = Math.round(sz + fz * clear);
        if (!lakeAt(px, pz)) { sx = px; sz = pz; }
      }
    }

    buildSpawnArch(scene, ax, az, Math.PI / 2 - fa.bearing);      // arch passage aligned to +F
    zerble.heading = Math.atan2(-(stage.x - sx), -(stage.z - sz));  // face the stage across the dancefloor
    zerble.position.set(sx, 0, sz);
    setSpawnPoint(sx, sz);   // ring the guaranteed intro jugs around the arrival
  }
}

const bubbles = new Bubbles();
scene.add(bubbles.mesh);

// MIDI player — Tone.js loads lazily on the first M press so startup stays
// fast. Trip._envelope drives the warp chain each frame (see tick body).
const midi = new MidiPlayer();

const smiles = new Smiles();
scene.add(smiles.group);

// ---------- Crowd (before world so chunks can spawn into it) ----------
const crowd = new Crowd(smiles);
scene.add(crowd.group);

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

// ---------- World (sky/lights/ground/mountains + chunk manager) ----------
buildWorld(scene, crowd);

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
let score = 0;
HUD.loadBest();
let running = false;

// A bubble-less Zerble makes nearby NPCs frown — each frown costs a smile.
crowd.onFrown = () => {
  if (score <= 0) return;
  score = Math.max(0, score - 1);
  HUD.setSmiles(score);
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
let _vendorWasFilling = false;   // were we actively drawing juice last frame?
let _wasEmpty = false;           // edge-detect the bubble tank running dry
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
    bubbles.setCheapMaterial?.(lvl.bubbles === 'cheap');
    // Only the DOWN steps are the interesting field-perf signal (the budget
    // slipped on real hardware); recoveries back up are expected.
    if (level > _lastQualityLevel) Analytics.qualityDowngrade(level, avgMs ? 1000 / avgMs : 0);
    _lastQualityLevel = level;
  },
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
HUD.onStart(() => {
  HUD.hideTitle();
  running = true;
  // Context segments every later event by device/tier/returning-ness.
  Analytics.gameStart({
    perf_tier: PERF.name,
    touch: Touch.isTouchDevice(),
    seeded: window.__seedInput != null,
    returning: HUD.loadBest() > 0,
  });
  _sessionEndReported = false;
  // Sound.init() MUST run synchronously inside the tap handler on iOS — any
  // await/setTimeout boundary loses the "user gesture" status and the
  // AudioContext starts suspended (silent).
  Sound.init();
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
  HUD.toast('Drive around — make people smile, dodge the parade.', 2800);
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
  Analytics.sessionEnd({ smiles: score, best: HUD.loadBest(), maxJuice: _maxJuiceReached, honks: _honkCount });
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
    if (nightness > 0.5) Analytics.sawNight();   // once: played into nightfall
    // During the opening reveal the player can't steer — feed Zerble a neutral
    // input so it idles while the camera does its thing.
    zerble.update(dt, controlsLocked ? NEUTRAL_INPUT : Input, nightness);
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
      crowd.applyHonk(zerble);
      // Other collidable people in front of a parked Zerble also scatter.
      // crowd.applyHonk handles its own NPC pool; the obstacles module owns
      // kids, wooks, puppets, and the brass band — each has its own
      // scatter() that respects its own motion (path-following, formation,
      // free wander). All of them dodge perpendicular-away from Zerble.
      if (Math.abs(zerble.speed || 0) < 0.5) {
        kids.scatter(zerble);
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
    HUD.setJuice(bubbles.juice);
    if (bubbles.juice > _maxJuiceReached) _maxJuiceReached = bubbles.juice;   // peak → session_end
    // Dry tank → no bubbles → NPCs frown (crowd.js reads this). One-time toast
    // on running out so the player connects the empty meter to the frowns.
    const bubblesEmpty = bubbles.juice <= 0.02;
    crowd.bubblesEmpty = bubblesEmpty;
    if (bubblesEmpty && !_wasEmpty) {
      HUD.toast('Out of bubble juice — grab a jug!', 2200);
      Analytics.bubbleRanDry();
    }
    _wasEmpty = bubblesEmpty;
    // Rebuild the registry broadphase once per frame, before every consumer
    // (crowd steering, kid push-out, Zerble collision). Cheap O(entries) pass;
    // the per-NPC queries it enables replace the old O(npcs × entries) scans.
    registry.rebuildSpatialIndex();
    if (!npcsFrozen()) crowd.update(dt, zerble, bubbles);
    smiles.update(dt, zerble, (n) => {
      score += n;
      HUD.setSmiles(score);
      HUD.saveBest(score);
      Analytics.smileScore(score);
      Analytics.personalBest(score);
    });

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
    // Her motor — spatialized to her position, pitch/volume track her real
    // speed whether she's wandering on her own or chasing Zerble.
    Sound.setLurleenEngine(lurleen.speed, lurleen.position.x, lurleen.position.z);
    if (!lurleenMet && lurleen.state === 'aware') {
      lurleenMet = true;
      HUD.toast('You found Lurleen! 💗', 3500);
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
          if (bubbles.juice < 1) {                 // vendor tops the current meter only
            const before = bubbles.juice;
            bubbles.addJuice((e.refuel || 0.4) * dt, 1.0);
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
        HUD.toast('Free bubble-juice refill!', 1600);
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

    // Collisions: deduct smiles only when Zerble is actively driving into the obstacle.
    // If something brushes a stationary Zerble, just resolve the overlap silently.
    if (zerble.invulnLeft <= 0) {
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
        // Fleeing NPCs overlap-resolve silently (damage 0) — see _npcColWrap.
        _collScratch.push(_npcColWrap(n));
      }
      const hit = resolveCollision(zerble, _collScratch);
      if (hit && hit.damaging && !isGod()) {
        score = Math.max(0, score - hit.damage);
        HUD.setSmiles(score);
        HUD.flashHit();
        // Ramming an OCCUPIED porta-potty ejects the flustered occupant +
        // gets its own mortified toast bank; otherwise the normal per-kind line.
        if (hit.kind === 'porta_potty' && hit.entry?.potty?.occupied) {
          crowd.onPottyHit(hit.entry);
          HUD.toast(PORTA_POTTY_OCCUPIED_TOASTS[Math.floor(Math.random() * PORTA_POTTY_OCCUPIED_TOASTS.length)], 1700);
        } else {
          HUD.toast(toastForKind(hit.kind), 1400);
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
  ContextLights.update(zerble.position);

  // Adaptive quality watches frame time and drops bloom / shadows /
  // pixel ratio if the budget slips, ramps back if it recovers.
  AdaptiveQuality.tick(dt);

  composer.render();
}

// RAF is throttled to ~0 fps when the tab is backgrounded (e.g. the Claude
// Preview MCP runs the page document.hidden). Fall back to setTimeout in that
// case so the game keeps ticking and the preview tools see real motion.
function scheduleNext() {
  if (document.hidden) setTimeout(tick, 16);
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
  w.damage = (n.state === 'fleeing') ? 0 : 1;
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
      return { damaging, damage: c.damage, kind: c.kind, notify, entry: c.entry || null };
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
  getTimeOfDay, Trip, midi, birds, bubbles,
  sound: Sound,
};

// ---- Local-dev debug backdoor (window.__dbg) ----
// Hooks for verifying the *running* game programmatically, because the real
// UX actively resists automation: the title card needs a trusted gesture to
// dismiss (iOS audio gating), the chase cam overrides any camera you set, and
// driving zerble with a stub input corrupts its physics. These bypass all of
// that. Local dev ONLY — never present on the deployed site.
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.__dbg = {
    // Start the game without a trusted gesture — mirrors HUD.onStart (line ~369)
    // minus the iOS audio-gesture dependency, and drops straight into gameplay
    // (no intro reveal). Audio is best-effort; it can stay silent in headless dev.
    start() {
      if (running) return 'already running';
      HUD.hideTitle();
      running = true;
      document.body.classList.add('game-started');
      const tc = document.getElementById('touch-controls');
      if (tc) tc.setAttribute('aria-hidden', 'false');
      try { Sound.init(); } catch (_) { /* silent audio is fine for dev */ }
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

    // Bubble-juice level in meters — drives the machine liquid, reserve jugs,
    // and the HUD meter (all poll bubbles.juice each frame).
    setJuice(meters = 1) {
      bubbles.juice = Math.max(0, meters);
      return `juice = ${bubbles.juice}`;
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

    // Move the cart to world (x, z), zeroing speed.
    teleport(x = 0, z = 0) {
      zerble.position.set(x, zerble.position.y, z);
      zerble.speed = 0;
      return `teleported to (${x}, ${z})`;
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

    // ---- One door: __dbg also reaches the other two surfaces ----
    // Getters (not captured at definition time) because installDebug() runs
    // after this block, so window.__debug doesn't exist yet right here.
    // `__dbg.game`  → live object refs (same object as window.__game).
    // `__dbg.debug` → the interactive overlay API (window.__debug):
    //   freezeNPCs / pause / step / god / showColliders / dropSmile / spawnNPC.
    get game() { return window.__game; },
    get debug() { return window.__debug; },

    // Self-documenting map of the whole agent debug surface. Start here.
    help() {
      const out = [
        'window.__dbg — agent control surface (localhost only). The one door.',
        '  drive:   start() · teleport(x,z) · tod(t 0..1) · setJuice(m) · fillSeats(kind?) · rider(kind)',
        '  camera:  camLock(px,py,pz, tx,ty,tz) · camUnlock()   (pins a pose; overrides chase cam)',
        '  layout:  dumpRegistry(bounds?) · dumpDrawCounts(bounds?)   (read-only built-truth + canary → bin/layout-snapshot)',
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
  Trip,
  midi,
});

tick();
