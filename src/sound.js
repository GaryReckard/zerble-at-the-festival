// All audio is synthesized at runtime via Web Audio — no audio files to ship.
//
// Engine: a continuously running pair of sawtooth oscillators (the "gas-engine"
// buzz) mixed with low-pass-filtered noise (the rumble). Speed scales master
// volume + pitch + a putt-putt LFO. At zero speed the engine fades to silence
// in ~80ms.
//
// Collision sounds: each obstacle kind has a one-shot synthesized "hit" with
// its own timbre — drums for stages, metallic clangs for trucks/lampposts,
// nasal boops for kids/puppets, brass for the band, wood knocks for the
// arch, a "duuude" drone for the wooks, etc.

import { mulberry32 } from './rng.js';

let ctx = null;
let masterGain = null;
let muteGain = null;     // dedicated downstream mute node — toggled 0/1 by setMuted so muting never clobbers the user's saved master level
let musicBus = null;     // shared bus for stage music sources (so we can balance vs. SFX)
let musicDuckGain = null; // downstream attenuator — ducks when an external player (MIDI) is active
let midiGain = null;     // MIDI player output node — connects into masterGain so Master + MIDI sliders both work
// Star power — a non-spatial 160bpm loop that takes over the mix during the
// buff (ducking everything else via setMusicDuck). Its own gain straight into
// masterGain. A lookahead scheduler (setInterval) drives a tiny chiptune synth.
let _starGain = null;
let _starSched = null;   // setInterval id while running
let _starNextTime = 0;   // next 16th-note time (ctx clock)
let _starStep = 0;       // step index into the 64-step / 4-bar pattern
let _starNoiseBuf = null;

// Bright pentatonic-ish lead scale (G4..C6) — 1-based indices in STAR_LEAD,
// 0 = rest. Four 16-step bars: a jaunty climbing motif with a turnaround.
const STAR_SCALE = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
const STAR_LEAD = [
  [3, 0, 5, 6, 0, 7, 6, 5, 0, 3, 4, 0, 5, 0, 4, 3],
  [5, 0, 7, 8, 0, 7, 6, 5, 0, 4, 3, 0, 4, 0, 3, 1],
  [3, 0, 5, 6, 0, 7, 6, 5, 0, 3, 4, 0, 5, 0, 7, 8],
  [7, 0, 6, 5, 0, 4, 3, 1, 0, 3, 4, 5, 0, 4, 3, 0],
];
const STAR_BASS = [98.0, 130.81, 110.0, 146.83];   // root per bar (G2/C3/A2/D3)

function _spVoice(type, freq, t, dur, vel) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(_starGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function _spKick(t, vel) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(_starGain);
  o.start(t);
  o.stop(t + 0.18);
}
function _spNoise(t, vel, hp) {
  if (!_starNoiseBuf) {
    const n = Math.floor(ctx.sampleRate * 0.2);
    _starNoiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = _starNoiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = _starNoiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(f).connect(g).connect(_starGain);
  src.start(t);
  src.stop(t + 0.06);
}
// Lookahead step sequencer — schedules every 16th note up to ~0.12s ahead.
function _scheduleStarPower() {
  if (!ctx || !_starGain) return;
  const horizon = ctx.currentTime + 0.12;
  const stepDur = 60 / 160 / 4;   // 160 BPM 16th = 0.09375s
  while (_starNextTime < horizon) {
    const t = _starNextTime;
    const bar = Math.floor((_starStep % 64) / 16);
    const s16 = _starStep % 16;
    const li = STAR_LEAD[bar][s16];
    if (li > 0) _spVoice('triangle', STAR_SCALE[li - 1], t, stepDur * 1.6, 0.22);
    if (s16 % 4 === 0) {
      const fifth = (s16 === 4 || s16 === 12);
      _spVoice('square', STAR_BASS[bar] * (fifth ? 1.5 : 1), t, stepDur * 1.8, 0.16);
      _spKick(t, 0.5);
    }
    if (s16 % 2 === 1) _spNoise(t, s16 % 4 === 3 ? 0.18 : 0.1, 7000);
    _starNextTime += stepDur;
    _starStep++;
  }
}
// Trip effect chain — sits between musicDuckGain and masterGain. Always
// wired in; only audibly active when `setMusicTrip(env, p)` ramps the
// wet gain above zero. Drives a lowpass sweep + a feedback delay in
// lockstep with the visual trip envelope. See `setMusicTrip` below.
let _tripDryGain = null;
let _tripWetGain = null;
let _tripLowpass = null;
let _tripDelay = null;
let _tripFeedback = null;
let sfxBus = null;       // shared bus for all SFX (engine, collisions, honks, bumps)
let _smileVoices = 0;    // live smile-ladder blips (6-voice cap)
let _sputterLoop = null; // Festival Run sputter chug ({osc, lfo, g} or null)
// SFX trip chain — the SFX-tuned sibling of the music trip chain above. Sits
// between sfxBus and masterGain, same wet/dry topology. Tuned to keep the
// engine drone legible (gentler lowpass, more dry signal) while smearing
// collision transients into stuttering echoes. Driven by `setSfxTrip(env, p)`;
// idle (gain 0) when no trip is active. The engine ALSO reads
// `_sfxTripEnv`/`_sfxTripProgress` directly for a pitch-detune wobble — see
// createEngine.
let _sfxTripDryGain = null;
let _sfxTripWetGain = null;
let _sfxTripLowpass = null;
let _sfxTripDelay = null;
let _sfxTripFeedback = null;
let _sfxTripEnv = 0;
let _sfxTripProgress = 0;
let engineNodes = null;
let lurleenEngineNodes = null;   // Lurleen's spatialized motor (see createEngine)
let initialized = false;
let silentUnlockEl = null;   // HTMLAudioElement kept alive to hold the iOS "Playback" audio session
let silentUnlockUrl = null;  // Blob URL — revoked on tear-down (not currently torn down, but for hygiene)
let _muted = false;          // global mute state — session-only, never persisted (always boots unmuted)

// Diagnostics state — populated by init() so we can surface what unlocked
// (and what didn't) from window.__game.sound.diagnostics() on the iPhone.
const _diag = {
  initCalled: false,
  ctxConstructed: false,
  ctxStateAfterConstruct: null,
  resumeCalled: false,
  resumeError: null,
  ctxStateAfterResume: null,
  htmlUnlockTried: false,
  htmlUnlockPlayResolved: false,
  htmlUnlockPlayRejected: null,
  webAudioBufferUnlocked: false,
  restoredFromLocalStorage: { master: null, music: null, sfx: null },
};

// Build a valid 100ms silent 16-bit PCM WAV in memory. We use a real (non-zero)
// audio body because some iOS Safari versions silently refuse to mark
// zero-sample media as "played", which means the audio session never promotes
// to Playback and the hardware silent switch keeps muting WebAudio.
function buildSilentWavBlobUrl() {
  const sampleRate = 8000;
  const numSamples = sampleRate / 10;          // 100ms
  const dataBytes = numSamples * 2;            // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  let p = 0;
  const wU32 = (v) => { view.setUint32(p, v, true); p += 4; };
  const wU16 = (v) => { view.setUint16(p, v, true); p += 2; };
  const wStr = (s) => { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); };
  wStr('RIFF'); wU32(36 + dataBytes);
  wStr('WAVE'); wStr('fmt '); wU32(16);
  wU16(1);                                     // PCM
  wU16(1);                                     // 1 channel
  wU32(sampleRate);                            // sample rate
  wU32(sampleRate * 2);                        // byte rate (1ch * 16bit)
  wU16(2);                                     // block align
  wU16(16);                                    // bits per sample
  wStr('data'); wU32(dataBytes);
  // 16-bit signed PCM silence is 0 — ArrayBuffer is already zeroed.
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

// Global nightness (0..1) — set each frame by main.js via Sound.setNightness.
// The forest drum engine reads this every scheduler tick to gate voices in,
// shape velocities, and decide whether the crackling-fire bed plays.
let currentNightness = 0;

// ---- Nature ambience (birds, crickets, frogs) ----
// All nature sound routes through `natureBus`, which has its OWN trip wet/dry
// chain (mirrors the music + sfx chains) so a Zerble trip warps birdsong /
// crickets / frogs into a lush, pitch-bent wash. `setNatureTrip` ramps it.
let natureBus = null;
let _natTripDry = null, _natTripWet = null, _natTripLowpass = null, _natTripDelay = null, _natTripFeedback = null;
let _natTripEnv = 0;        // polled by the synth fns to pitch-bend the calls
let _natTripProgress = 0;
// Proximity-driven ambient levels, set every frame from main.js.
let _cricketLevel = 0;      // 0..1 "treeness" — crickets near trees/forest at night
let _frogLevel = 0;         // 0..1 "lakeness" — frogs near a shoreline
let _cricketPan = 0;        // listener-relative stereo pan toward nearest forest (-1..1)
let _frogPan = 0;           // listener-relative stereo pan toward nearest lake (-1..1)
// Bird-song scheduler state.
let _birdCandidates = [];   // [{species,x,y,z,priority}] fed from birds.js
let _birdActivity = 0;      // time-of-day activity 0..1 (gates song rate)
let _birdPanners = [];      // pool of positional PannerNodes → natureBus
let _natureStereoPanners = []; // fixed-pan stereo nodes for cricket/frog spread
let _natureSchedulers = [];    // setInterval ids, cleared on teardown (hygiene)

// Registry of active stage handles with world positions, for cross-fade.
// Each entry: { handle, x, z } — handle has setAudibility(g).
const _stageHandleRegistry = [];

// Pending nature volume — stashed during init restore so we can apply it after
// initNatureAudio() builds the natureBus node. Defaults to null (use built-in 0.9).
let _pendingNatureVol = null;

// Stage music attachment is sometimes requested BEFORE Sound.init() runs —
// the initial chunks (including the main stage at 0,0) generate during world
// boot, but Sound.init must wait for a user gesture (Start tap on iOS). We
// queue those requests here and drain them once the AudioContext exists.
const _pendingStages = [];

export const Sound = {
  // Must be called from a user gesture (Start button click). Safe to call again.
  init() {
    _diag.initCalled = true;
    if (initialized) {
      // Resume in case the browser auto-suspended
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    _diag.ctxConstructed = true;
    _diag.ctxStateAfterConstruct = ctx.state;

    // iOS unlock A: resume FIRST, before we touch any other node. On iOS the
    // AudioContext is constructed in 'suspended' state and resume() needs the
    // active user gesture. Doing it before the rest of the graph setup keeps
    // the gesture privilege as fresh as possible.
    //
    // Called unconditionally (not just when state === 'suspended') because
    // some desktop-Chrome versions report the new context as 'running' even
    // though the audio thread hasn't actually started processing samples.
    // resume() on an already-running context is a no-op, so the belt is free.
    _diag.resumeCalled = true;
    try {
      const p = ctx.resume();
      if (p && typeof p.then === 'function') {
        p.then(() => { _diag.ctxStateAfterResume = ctx.state; })
         .catch((e) => { _diag.resumeError = String(e); });
      } else {
        _diag.ctxStateAfterResume = ctx.state;
      }
    } catch (e) {
      _diag.resumeError = String(e);
    }

    // iOS unlock B: play a 1-sample silent WebAudio buffer source. On some
    // older iOS versions this is what actually flips the WebAudio scheduler
    // from "scheduled but silent" to "audible". Cheap, harmless on every
    // other browser.
    try {
      const unlockBuf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = unlockBuf;
      src.connect(ctx.destination);
      src.start(0);
      _diag.webAudioBufferUnlocked = true;
    } catch (e) { /* old iOS may throw on createBuffer(1,1,22050); we tried */ }

    // iOS unlock C: play a real HTMLAudioElement so the page is promoted to
    // the "Playback" audio session and WebAudio stops respecting the silent
    // switch. Must be a non-zero-duration media file with a valid header — a
    // 0-sample WAV will look "played" to us but iOS sometimes doesn't count
    // it. Build a real 100ms silent WAV in memory and play it from a Blob URL,
    // appended to the DOM so iOS treats it as a first-class media element.
    try {
      _diag.htmlUnlockTried = true;
      silentUnlockUrl = buildSilentWavBlobUrl();
      const el = document.createElement('audio');
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.preload = 'auto';
      el.loop = true;
      el.muted = false;
      el.volume = 0.001;            // audible to iOS, inaudible to humans
      el.src = silentUnlockUrl;
      // Off-screen but in the tree — appending to <body> matters on iOS.
      el.style.position = 'fixed';
      el.style.top = '-9999px';
      el.style.width = '1px';
      el.style.height = '1px';
      el.style.opacity = '0';
      document.body.appendChild(el);
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { _diag.htmlUnlockPlayResolved = true; })
         .catch((e) => { _diag.htmlUnlockPlayRejected = String(e); });
      } else {
        _diag.htmlUnlockPlayResolved = true;
      }
      silentUnlockEl = el;
    } catch (e) { _diag.htmlUnlockPlayRejected = String(e); }

    // Now build the actual mix graph.
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.55;
    // Dedicated mute node downstream of masterGain (mirrors musicDuckGain).
    // setMuted toggles THIS 0/1; masterGain always holds the user's real
    // level, so muting can never persist a 0 into zerble.vol.master.
    muteGain = ctx.createGain();
    muteGain.gain.value = 1;
    masterGain.connect(muteGain);
    muteGain.connect(ctx.destination);

    // Star power loop output — straight into masterGain (foreground, not on the
    // music bus, so it isn't ducked by its own duck node). Silent until
    // startStarPower() ramps it up.
    _starGain = ctx.createGain();
    _starGain.gain.value = 0;
    _starGain.connect(masterGain);

    musicBus = ctx.createGain();
    // Was 1.6 when the music was a wall-of-sound four-loop pattern at boot.
    // The generators now breathe + rotate variants so they don't need the
    // headroom boost to "carry" — dropping to 1.2 cuts the in-your-face
    // feel near the main stage without making distant stages disappear.
    musicBus.gain.value = 1.2;

    // Downstream duck node — MIDI player ramps this to ~0.2 while it's
    // playing so the in-world stage music doesn't fight the foreground
    // music. User's saved volume preference still lives on musicBus.gain;
    // the duck node is purely a runtime multiplier on top.
    musicDuckGain = ctx.createGain();
    musicDuckGain.gain.value = 1.0;
    musicBus.connect(musicDuckGain);

    // Trip effects chain (wet/dry) on the music path. Dry is the bypass — always
    // 1.0. Wet routes through a lowpass + feedback delay, summed back at
    // masterGain. `setMusicTrip(env, p)` ramps the wet gain and modulates the
    // lowpass cutoff + delay feedback in lockstep with the visual trip. When
    // env=0 the wet branch is silent, so the only steady-state cost is two
    // Gain nodes + a BiquadFilter + a DelayNode all running at idle gain 0
    // (still very cheap).
    _tripDryGain = ctx.createGain();
    _tripDryGain.gain.value = 1.0;
    _tripWetGain = ctx.createGain();
    _tripWetGain.gain.value = 0.0;
    _tripLowpass = ctx.createBiquadFilter();
    _tripLowpass.type = 'lowpass';
    _tripLowpass.frequency.value = 18000;   // wide open at idle
    _tripLowpass.Q.value = 1.0;
    _tripDelay = ctx.createDelay(1.0);       // up to 1s of delay
    _tripDelay.delayTime.value = 0.28;
    _tripFeedback = ctx.createGain();
    _tripFeedback.gain.value = 0.0;          // ramps with envelope (0..0.78)

    // Wiring:
    //   musicDuckGain ─┬─→ _tripDryGain ──→ masterGain        (dry path)
    //                  └─→ _tripLowpass ──┬─→ _tripWetGain ──→ masterGain
    //                                     └─→ _tripDelay ────→ _tripFeedback ──→ _tripLowpass  (delay loop)
    musicDuckGain.connect(_tripDryGain);
    _tripDryGain.connect(masterGain);
    musicDuckGain.connect(_tripLowpass);
    _tripLowpass.connect(_tripWetGain);
    _tripWetGain.connect(masterGain);
    _tripLowpass.connect(_tripDelay);
    _tripDelay.connect(_tripFeedback);
    _tripFeedback.connect(_tripLowpass);
    // Star-power chiptune also feeds the trip WET path so a trip warps it too
    // (the rainbow buff layered under a trip is part of the fun). Its dry path
    // (→ masterGain, above) keeps it audible when no trip is running; the wet
    // gain is 0 unless setMusicTrip ramps it up, so this adds nothing at idle.
    _starGain.connect(_tripLowpass);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1.0;

    // SFX trip chain (wet/dry) — mirrors the music chain's topology but the
    // constants in setSfxTrip are SFX-tuned. Dry is the bypass; wet routes
    // through a lowpass + feedback delay, summed back at masterGain. Idle
    // gains keep it silent until setSfxTrip ramps the wet branch, so the
    // steady-state cost is two Gain nodes + a BiquadFilter + a DelayNode all
    // running at gain 0 (cheap).
    _sfxTripDryGain = ctx.createGain();
    _sfxTripDryGain.gain.value = 1.0;
    _sfxTripWetGain = ctx.createGain();
    _sfxTripWetGain.gain.value = 0.0;
    _sfxTripLowpass = ctx.createBiquadFilter();
    _sfxTripLowpass.type = 'lowpass';
    _sfxTripLowpass.frequency.value = 18000;   // wide open at idle
    _sfxTripLowpass.Q.value = 1.0;
    _sfxTripDelay = ctx.createDelay(1.0);
    _sfxTripDelay.delayTime.value = 0.16;       // snappier slapback than music's 0.28
    _sfxTripFeedback = ctx.createGain();
    _sfxTripFeedback.gain.value = 0.0;

    // Wiring (same shape as the music chain above):
    //   sfxBus ─┬─→ _sfxTripDryGain ──→ masterGain                       (dry path)
    //           └─→ _sfxTripLowpass ──┬─→ _sfxTripWetGain ──→ masterGain
    //                                 └─→ _sfxTripDelay ──→ _sfxTripFeedback ──→ _sfxTripLowpass  (delay loop)
    sfxBus.connect(_sfxTripDryGain);
    _sfxTripDryGain.connect(masterGain);
    sfxBus.connect(_sfxTripLowpass);
    _sfxTripLowpass.connect(_sfxTripWetGain);
    _sfxTripWetGain.connect(masterGain);
    _sfxTripLowpass.connect(_sfxTripDelay);
    _sfxTripDelay.connect(_sfxTripFeedback);
    _sfxTripFeedback.connect(_sfxTripLowpass);

    // MIDI output node — midiPlayer.js routes Tone.js's output here so Master
    // and the dedicated MIDI fader both affect playback. Kept separate from
    // musicBus so MIDI and stage music have independent volume controls.
    midiGain = ctx.createGain();
    midiGain.gain.value = 1.0;
    midiGain.connect(masterGain);

    // Restore persisted volume levels (zerble.vol.*). Clamp anything < 0.05
    // up to 0.05 — a stuck-at-zero slider from a previous session is the
    // sneakiest "no sound" footgun, and 0.05 is still close enough to silent
    // that an intentionally-muted player won't notice. Use Sound.setVolume()
    // to explicitly go all the way to zero.
    try {
      const restore = (key, gain) => {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        const v = parseFloat(raw);
        if (!Number.isFinite(v)) return null;
        // A stored value below the audible floor is treated as corruption / an
        // accidental zero (an earlier mute bug could persist 0 into
        // zerble.vol.master) — fall back to the node's default rather than
        // booting effectively silent. Use the mute toggle for real silence.
        const applied = v < 0.05 ? gain.gain.value : v;
        gain.gain.value = applied;
        return { raw, applied };
      };
      _diag.restoredFromLocalStorage.master  = restore('zerble.vol.master',  masterGain);
      _diag.restoredFromLocalStorage.music   = restore('zerble.vol.music',   musicBus);
      _diag.restoredFromLocalStorage.sfx     = restore('zerble.vol.sfx',     sfxBus);
      _diag.restoredFromLocalStorage.midi    = restore('zerble.vol.midi',    midiGain);
      // natureBus is built in initNatureAudio (called below), so we stash the
      // raw value and apply it there after the bus node exists.
      const rawNature = localStorage.getItem('zerble.vol.nature');
      _diag.restoredFromLocalStorage.nature  = rawNature;
      if (rawNature !== null) {
        const v = parseFloat(rawNature);
        if (Number.isFinite(v)) _pendingNatureVol = v < 0.05 ? 0.05 : v;
      }
      // Mute — if previously muted, force masterGain to zero AFTER the clamp
      // restore above (which kept it ≥0.05). The clamp is intentional for
      // normal sessions; mute is an explicit override on top.
      // Mute is session-only: always boot unmuted, regardless of any stored
      // flag. A persisted mute that boots the game silent (with an out-of-sync
      // checkbox) is a worse footgun than just starting with sound. Clear any
      // legacy value older builds may have left so it can't linger.
      localStorage.removeItem('zerble.muted');
    } catch (e) { /* localStorage unavailable */ }

    engineNodes = createEngine(ctx, sfxBus);
    // Lurleen's motor — a lighter, brighter, peppier sibling of Zerble's wheezy
    // gas-engine. Higher fundamental (pitchMul 1.5), gentler soft-clip (drive 4)
    // and less rumble (noiseLevel) read as "her"; spatialized so it pans +
    // attenuates from her position, and accelBoost makes it rev when she speeds
    // up to catch the player (she has no throttle of her own). Tune by ear here.
    lurleenEngineNodes = createEngine(ctx, sfxBus, {
      pitchMul: 1.5, harmonic: 1.5, drive: 4, noiseLevel: 0.32,
      chugBase: 5, chugSpan: 16, lpfBase: 520, lpfSpan: 900,
      volScale: 0.2, speedRef: 16, spatial: true, accelBoost: 1,
    });
    initialized = true;

    // Prime the music chain. The 1-sample buffer above (unlock B) wakes the
    // ctx.destination path, but the music chain (musicBus → musicDuckGain →
    // _tripDryGain → masterGain → destination) is multi-stage and on some
    // desktop-Chrome builds it doesn't actually start emitting samples until
    // a non-trivial signal flows through it. Symptom: brass-band music
    // scheduled at currentTime+0.15s gets dropped on the floor; the first
    // honk (sfxBus → masterGain, a simpler path) flushes the engine, and
    // subsequent setInterval-scheduled music ticks then play correctly. Fix:
    // route a 60ms near-silent noise pulse (peak amplitude 0.003 — well below
    // perceptual threshold even on headphones) through musicBus so the
    // entire music chain warms up before the queued stages start ticking.
    try {
      const primeLen = Math.max(1, Math.floor(ctx.sampleRate * 0.06));
      const primeBuf = ctx.createBuffer(1, primeLen, ctx.sampleRate);
      const primeData = primeBuf.getChannelData(0);
      for (let i = 0; i < primeLen; i++) primeData[i] = (Math.random() * 2 - 1) * 0.003;
      const primeSrc = ctx.createBufferSource();
      primeSrc.buffer = primeBuf;
      primeSrc.connect(musicBus);
      primeSrc.start(ctx.currentTime);
      _diag.musicChainPrimed = true;
    } catch (e) { _diag.musicChainPrimed = String(e); }

    // Drain any stage music attachments that were queued during world boot.
    // Schedule the createStageMusic calls a beat after now so the prime
    // pulse above has time to actually start hitting the audio thread before
    // the brass band's first notes (scheduled at currentTime+0.15s) need to
    // fire. createStageMusic itself is synchronous — we just delay invoking
    // it. The deferred-handle pattern means callers already cope with
    // adoption arriving slightly late.
    const queued = _pendingStages.splice(0);
    const drainQueue = () => {
      for (const q of queued) {
        if (q.handle.cancelled) continue;
        const real = createStageMusic(ctx, musicBus, q.x, q.y, q.z, q.seed, q.style, q.opts);
        q.handle._adopt(real);
      }
    };
    // 80ms is enough for the priming pulse to start moving samples on every
    // browser we've tested. Below ~50ms desktop Chrome still misses the
    // first notes; above ~150ms the player perceives a gap. 80ms threads it.
    setTimeout(drainQueue, 80);

    initNatureAudio();
  },

  // Returns a snapshot of the audio init state. Wired through
  // window.__game.sound.diagnostics() so we can probe an iPhone via Safari
  // Web Inspector without ad-hoc instrumentation. Also includes the LIVE
  // ctx state + gain values so we can spot a stuck-suspended context or a
  // dropped-to-zero master after the fact.
  diagnostics() {
    // Output-routing: destination channel info + best-effort device enumeration.
    // enumerateDevices requires a secure context and may be unavailable; wrap
    // in try/catch so a thrown PermissionDeniedError never crashes diagnostics.
    const outputRouting = {
      maxChannelCount: ctx && ctx.destination ? ctx.destination.maxChannelCount : null,
      sampleRate: ctx ? ctx.sampleRate : null,
      outputLabels: null,
      likelyBluetooth: false,
    };
    if (ctx && typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        // Fire-and-forget; result populates asynchronously but is useful on
        // second call (e.g. after user has granted permission). Synchronous
        // callers get whatever was cached from the last fulfillment.
        navigator.mediaDevices.enumerateDevices().then((devs) => {
          const labels = devs.filter(d => d.kind === 'audiooutput').map(d => d.label).filter(Boolean);
          outputRouting.outputLabels = labels;
          outputRouting.likelyBluetooth = labels.some(l => /bluetooth|airpods|wireless|bt\b/i.test(l));
        }).catch(() => {});
      } catch (e) { /* secure-context or permission denied */ }
    }
    return {
      ...JSON.parse(JSON.stringify(_diag)),
      live: {
        initialized,
        ctxState: ctx ? ctx.state : 'no-ctx',
        ctxSampleRate: ctx ? ctx.sampleRate : null,
        ctxBaseLatency: ctx ? ctx.baseLatency : null,
        masterGain: masterGain ? masterGain.gain.value : null,
        musicBus: musicBus ? musicBus.gain.value : null,
        sfxBus: sfxBus ? sfxBus.gain.value : null,
        natureBus: natureBus ? natureBus.gain.value : null,
        muted: _muted,
        silentUnlockPaused: silentUnlockEl ? silentUnlockEl.paused : null,
        silentUnlockCurrentTime: silentUnlockEl ? silentUnlockEl.currentTime : null,
        silentUnlockReadyState: silentUnlockEl ? silentUnlockEl.readyState : null,
      },
      outputRouting,
    };
  },

  // iOS Safari auto-suspends the AudioContext when the tab is hidden / the
  // device is locked. Call this on visibilitychange (and on any other "we're
  // back" signal) to resume. Safe no-op if init() hasn't run yet.
  resume() {
    if (!initialized || !ctx) return;
    if (ctx.state === 'suspended') {
      // Some iOS versions reject resume() outside a user gesture; the call is
      // best-effort and harmless if it throws.
      ctx.resume().catch(() => {});
    }
    // iOS may also pause the silent-unlock element when the tab backgrounds,
    // which can drop the page back to the Ambient audio session and re-mute
    // WebAudio behind the silent switch. Nudge it back to playing.
    if (silentUnlockEl && silentUnlockEl.paused) {
      const p = silentUnlockEl.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  },

  isReady() {
    return initialized;
  },

  // Push the current world nightness (0..1) into module state. The forest
  // drum engine reads this each scheduler tick to gate voices/velocity, and
  // the crackling-fire bed gates on it too. Cheap call — bare variable set.
  setNightness(n) {
    currentNightness = Math.max(0, Math.min(1, n));
  },

  // Drive the music-bus trip effect chain from the global Trip envelope.
  // env (0..1)     — overall wet intensity. 0 = bypass, 1 = full effect.
  // progress (0..1) — phase across the full trip. Used to layer a slow
  //                   lowpass sweep and a feedback bell on top of the gate.
  //
  // The chain warps procedural music (bands, drums, drum circles) the same
  // way the MIDI player's effects chain warps Tone.js playback — closing
  // off the high end and pushing the feedback delay toward runaway near
  // the climax (around p=1/3), then easing out.
  //
  // No-op until `Sound.init()` has wired the nodes.
  setMusicTrip(env, progress) {
    if (!_tripWetGain || !_tripLowpass || !_tripFeedback || !_tripDelay) return;
    const e = Math.max(0, Math.min(1, env || 0));
    const p = Math.max(0, Math.min(1, progress || 0));
    const t = ctx.currentTime;

    // Wet/dry crossfade. Dry never fully drops out — even at peak we keep
    // some clean signal so the music remains recognizable.
    const wet = e;
    const dry = 1.0 - e * 0.55;
    _tripWetGain.gain.setTargetAtTime(wet, t, 0.05);
    _tripDryGain.gain.setTargetAtTime(dry, t, 0.05);

    // Lowpass sweeps from open (18kHz) to muddy (~700Hz) on the wet branch
    // proportionally to envelope. A slow extra wobble on `progress` adds
    // life so the sweep doesn't sit at one cutoff for the whole trip.
    const wobble = 0.5 + 0.5 * Math.sin(p * Math.PI * 2 * 1.5);
    const cutoff = 18000 + (700 - 18000) * e * (0.55 + 0.45 * wobble);
    _tripLowpass.frequency.setTargetAtTime(cutoff, t, 0.1);

    // Feedback delay — runaway-ish near the climax (p≈1/3), tamer at the
    // edges. Caps at 0.78 to keep the signal from blowing up entirely.
    const peakBell = Math.exp(-Math.pow((p - 1 / 3) / 0.18, 2));
    const fb = e * (0.35 + 0.43 * peakBell);
    _tripFeedback.gain.setTargetAtTime(Math.min(0.78, fb), t, 0.1);

    // Delay time drifts a hair so the echo isn't perfectly metronomic.
    const dt = 0.28 + 0.08 * Math.sin(p * Math.PI * 2 * 0.7);
    _tripDelay.delayTime.setTargetAtTime(dt, t, 0.1);
  },

  // SFX-tuned sibling of setMusicTrip — warps the engine drone + collision
  // one-shots during a trip. Two jobs:
  //   1. Ramp the SFX trip wet/dry chain (lowpass + feedback delay): muffles
  //      the high end and turns each bonk into a stuttering echo.
  //   2. Stash env/progress in module state so the engine's per-frame update
  //      can layer a slow pitch-detune wobble on top (poll pattern, like
  //      nightness — see createEngine).
  // Kept deliberately gentler than the music chain: the engine has to stay
  // legible enough that the cart still feels driveable mid-trip.
  //
  // No-op on the node chain until Sound.init() has wired it, but the scalar
  // stash still runs so the engine wobble works the instant audio comes up.
  setSfxTrip(env, progress) {
    const e = Math.max(0, Math.min(1, env || 0));
    const p = Math.max(0, Math.min(1, progress || 0));
    _sfxTripEnv = e;
    _sfxTripProgress = p;
    if (!_sfxTripWetGain || !_sfxTripLowpass || !_sfxTripFeedback || !_sfxTripDelay) return;
    const t = ctx.currentTime;

    // Wet/dry — keep more dry than music (0.4 vs 0.55 cut) so the engine
    // doesn't vanish into the wet wash.
    _sfxTripWetGain.gain.setTargetAtTime(e * 0.85, t, 0.05);
    _sfxTripDryGain.gain.setTargetAtTime(1.0 - e * 0.4, t, 0.05);

    // Lowpass closes to ~1000Hz (vs music's 700) — collision bite + engine
    // grind harmonics survive as "muffled", not "gone".
    const wobble = 0.5 + 0.5 * Math.sin(p * Math.PI * 2 * 1.7);
    const cutoff = 18000 + (1000 - 18000) * e * (0.5 + 0.5 * wobble);
    _sfxTripLowpass.frequency.setTargetAtTime(cutoff, t, 0.1);

    // Feedback delay — shorter than music (snappier slapback that stutters
    // each bonk) and capped lower (0.55) so the *continuous* engine drone
    // feeding the loop can't build into a runaway howl.
    const peakBell = Math.exp(-Math.pow((p - 1 / 3) / 0.18, 2));
    const fb = e * (0.28 + 0.32 * peakBell);
    _sfxTripFeedback.gain.setTargetAtTime(Math.min(0.55, fb), t, 0.1);

    const dly = 0.16 + 0.05 * Math.sin(p * Math.PI * 2 * 0.9);
    _sfxTripDelay.delayTime.setTargetAtTime(dly, t, 0.1);
  },

  // Drive the nature-bus trip chain — warps birdsong / crickets / frogs during
  // a trip. Lusher than the sfx chain: the lowpass closes further and the
  // feedback runs longer, so calls smear into a shimmering, pitch-bent wash.
  // The pitch-bend itself is applied inside the synth fns via `_natTripEnv`.
  setNatureTrip(env, progress) {
    const e = Math.max(0, Math.min(1, env || 0));
    const p = Math.max(0, Math.min(1, progress || 0));
    _natTripEnv = e;
    _natTripProgress = p;
    if (!_natTripWet || !_natTripLowpass || !_natTripFeedback || !_natTripDelay) return;
    const t = ctx.currentTime;
    _natTripWet.gain.setTargetAtTime(e * 0.95, t, 0.06);
    _natTripDry.gain.setTargetAtTime(1.0 - e * 0.5, t, 0.06);
    const wobble = 0.5 + 0.5 * Math.sin(p * Math.PI * 2 * 1.3);
    const cutoff = 18000 + (520 - 18000) * e * (0.55 + 0.45 * wobble);
    _natTripLowpass.frequency.setTargetAtTime(cutoff, t, 0.12);
    const peakBell = Math.exp(-Math.pow((p - 1 / 3) / 0.18, 2));
    const fb = e * (0.4 + 0.45 * peakBell);
    _natTripFeedback.gain.setTargetAtTime(Math.min(0.82, fb), t, 0.12);
    const dt2 = 0.34 + 0.1 * Math.sin(p * Math.PI * 2 * 0.6);
    _natTripDelay.delayTime.setTargetAtTime(dt2, t, 0.12);
  },

  // Per-frame ambient levels from main.js. `level` 0..1. `panX` -1..1 biases
  // chirp/croak placement toward the direction of the nearest forest/lake.
  setCricketBed(level, panX = 0) {
    _cricketLevel = Math.max(0, Math.min(1, level || 0));
    _cricketPan = Math.max(-1, Math.min(1, panX || 0));
  },
  setFrogBed(level, panX = 0) {
    _frogLevel = Math.max(0, Math.min(1, level || 0));
    _frogPan = Math.max(-1, Math.min(1, panX || 0));
  },

  // Live snapshot of the nature layer — for verifying gating from the console
  // (window.__game.sound.natureDiagnostics()).
  natureDiagnostics() {
    return {
      built: !!natureBus,
      schedulers: _natureSchedulers.length,
      natureVolume: natureBus ? +natureBus.gain.value.toFixed(2) : null,
      cricketLevel: +_cricketLevel.toFixed(2),
      cricketPan: +_cricketPan.toFixed(2),
      frogLevel: +_frogLevel.toFixed(2),
      frogPan: +_frogPan.toFixed(2),
      nightness: +currentNightness.toFixed(2),
      birdActivity: +_birdActivity.toFixed(2),
      birdCandidates: _birdCandidates.length,
      natTripEnv: +_natTripEnv.toFixed(2),
      panners: _birdPanners.length,
    };
  },

  // birds.js hands the scheduler a fresh list of audible singing candidates +
  // the current time-of-day activity each frame. The setInterval scheduler
  // (initNatureAudio) fires songs from this list, rate-gated by activity.
  setBirdSongCandidates(list, activity) {
    _birdCandidates = list || [];
    _birdActivity = Math.max(0, Math.min(1, activity || 0));
  },

  // ---- Spatial stage music ----
  // `style` picks the synth + pattern personality: 'jam' (main stage),
  // 'brass' (side stage), 'drum' (drum circle). Unknown styles default to jam.
  attachStageMusic(x, y, z, seed, style = 'jam', opts = {}) {
    if (!ctx) {
      // Deferred handle — Sound.init will adopt a real music instance into
      // this same object once the AudioContext exists. Position updates that
      // arrive before adoption (e.g. a moving brass band) are remembered so
      // the adopted panner starts in the right spot.
      const handle = {
        _real: null,
        cancelled: false,
        _pendingX: x, _pendingY: y, _pendingZ: z,
        _adopt(real) {
          this._real = real;
          if (real && real.setPosition) {
            real.setPosition(this._pendingX, this._pendingY, this._pendingZ);
          }
        },
        setPosition(nx, ny, nz) {
          if (this._real && this._real.setPosition) {
            this._real.setPosition(nx, ny, nz);
          } else {
            this._pendingX = nx; this._pendingY = ny; this._pendingZ = nz;
          }
        },
        // Forward lowpass cutoff to the real handle once adoption finishes.
        // Pre-adoption calls are silently dropped — the engine sets its own
        // initial cutoff at construction time, so the first call lands within
        // a frame or two of the audio coming up anyway.
        setLowpassCutoff(freq) {
          if (this._real && this._real.setLowpassCutoff) {
            this._real.setLowpassCutoff(freq);
          }
        },
        // Forward setAudibility to the real handle once adopted; silently drop
        // pre-adoption calls (distance cross-fade hasn't started yet).
        setAudibility(g) {
          if (this._real && this._real.setAudibility) this._real.setAudibility(g);
        },
        stop() {
          if (this._real) this._real.stop();
          else this.cancelled = true;
          // Remove from registry.
          const idx = _stageHandleRegistry.findIndex(e => e.handle === this);
          if (idx !== -1) _stageHandleRegistry.splice(idx, 1);
        },
      };
      _pendingStages.push({ x, y, z, seed, style, opts, handle });
      _stageHandleRegistry.push({ handle, x, z });
      return handle;
    }
    const real = createStageMusic(ctx, musicBus, x, y, z, seed, style, opts);
    _stageHandleRegistry.push({ handle: real, x, z });
    return real;
  },

  detachStageMusic(handle) {
    if (!handle) return;
    handle.stop();
    const idx = _stageHandleRegistry.findIndex(e => e.handle === handle);
    if (idx !== -1) _stageHandleRegistry.splice(idx, 1);
  },

  updateAudioListener(px, py, pz, fx, fy, fz) {
    if (!ctx) return;
    const lis = ctx.listener;
    if (lis.positionX) {
      lis.positionX.value = px;
      lis.positionY.value = py;
      lis.positionZ.value = pz;
      lis.forwardX.value = fx;
      lis.forwardY.value = fy;
      lis.forwardZ.value = fz;
      lis.upX.value = 0;
      lis.upY.value = 1;
      lis.upZ.value = 0;
    } else if (lis.setPosition) {
      // Older browsers
      lis.setPosition(px, py, pz);
      lis.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  },

  // boost: 0..1 — when > 0, the engine revs higher and growls louder, like
  // the driver dropped a gear. Wired from Zerble's `wantBoost` state.
  setEngineSpeed(speed, boost = 0) {
    if (!engineNodes) return;
    engineNodes.update(Math.abs(speed), boost);
  },

  // Lurleen's motor. Position drives the panner (so it comes from where she is)
  // and speed drives pitch/volume; the engine derives its own rev from how fast
  // her speed is changing (she has no throttle input). Call once per frame
  // after lurleen.update().
  setLurleenEngine(speed, x, z) {
    if (!lurleenEngineNodes) return;
    lurleenEngineNodes.setPosition(x, z);
    lurleenEngineNodes.update(Math.abs(speed));
  },

  playCollision(kind) {
    if (!ctx) return;
    (COLLISION_SOUNDS[kind] || COLLISION_SOUNDS.default)(ctx, sfxBus);
  },

  playHonk() {
    if (!ctx) return;
    playHonk(ctx, sfxBus);
  },

  // Specific-sound variants (bound to B and H keys for direct triggering).
  playBicycleBell() {
    if (!ctx) return;
    playBicycleBell(ctx, sfxBus);
  },

  playClownHorn() {
    if (!ctx) return;
    playClownBulb(ctx, sfxBus);
  },

  // Optional: lower-volume bump when Zerble brushes something without damage.
  playSoftBump() {
    if (!ctx) return;
    thump(ctx, sfxBus, 110, 0.12, 0.18);
  },

  // Bright ascending sparkle for grabbing a bubble-juice jug / refilling.
  // ---- Smile pitch ladder (festival-run-stakes D12) ----
  // Each collected smile plays a soft bell blip; consecutive collects inside
  // the combo chain step UP a major-pentatonic ladder (two octaves over C5),
  // so the chain is audible without looking at the HUD — and the reset to the
  // root after a lull/break is the audible "chain over". A same-frame burst
  // arrives as ONE call (main.js coalesces) and plays one small chord instead
  // of overlapping copies; a 6-voice cap guards pathological bursts. Per-hit
  // ±8-cent detune keeps repeats from sounding stamped out.
  playSmileCollect(count = 1, chainStep = 0) {
    if (!ctx || !sfxBus) return;
    const SEMIS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const ROOT = 523.25;   // C5
    const idx = Math.max(0, Math.min(SEMIS.length - 1, Math.floor(chainStep)));
    const blip = (semi, gainMul = 1, delay = 0) => {
      if (_smileVoices >= 6) return;
      _smileVoices++;
      const t = ctx.currentTime + delay;
      const detune = Math.pow(2, ((Math.random() * 16) - 8) / 1200);
      const f = ROOT * Math.pow(2, semi / 12) * detune;
      const osc = ctx.createOscillator(); osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.13 * gainMul, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
      osc.connect(g).connect(sfxBus);
      osc.start(t); osc.stop(t + 0.26);
      osc.onended = () => { _smileVoices = Math.max(0, _smileVoices - 1); };
    };
    if (count <= 1) {
      blip(SEMIS[idx]);
    } else {
      // Burst → one bright chord on the ladder step (root + two above).
      blip(SEMIS[idx], 0.9);
      blip(SEMIS[Math.min(SEMIS.length - 1, idx + 2)], 0.7, 0.012);
      blip(SEMIS[Math.min(SEMIS.length - 1, idx + 4)], 0.55, 0.024);
    }
  },

  // Soft minor-third fall for a frown-caused smile loss. Deliberately quiet —
  // it registers, it doesn't scold.
  playFrownDown() {
    if (!ctx || !sfxBus) return;
    boop(ctx, sfxBus, 392, 330, 0.22, 0.09, 'sine');
  },

  // ---- Festival Run stakes cues ----
  // Sputter loop: a low chugging put-put while the grace timer runs. Handle
  // kept so runState can stop it the moment juice arrives.
  startSputterLoop() {
    if (!ctx || !sfxBus || _sputterLoop) return;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
    const g = ctx.createGain(); g.gain.value = 0.0;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 5;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.05;
    lfo.connect(lfoG).connect(g.gain);
    osc.connect(lp).connect(g).connect(sfxBus);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.3);
    osc.start(t); lfo.start(t);
    _sputterLoop = { osc, lfo, g };
  },
  stopSputterLoop() {
    if (!ctx || !_sputterLoop) return;
    const { osc, lfo, g } = _sputterLoop;
    _sputterLoop = null;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.2);
    osc.stop(t + 0.25); lfo.stop(t + 0.25);
  },

  // Marshal whistle — two sharp warbles; the vibe meter's warning voice.
  playMarshalWhistle() {
    if (!ctx || !sfxBus) return;
    for (let i = 0; i < 2; i++) {
      const t = ctx.currentTime + i * 0.28;
      const osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(2200, t);
      osc.frequency.linearRampToValueAtTime(2650, t + 0.1);
      osc.frequency.linearRampToValueAtTime(2350, t + 0.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.1, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.24);
      osc.connect(g).connect(sfxBus);
      osc.start(t); osc.stop(t + 0.26);
    }
  },

  // Run-end stings: ran_dry = a weary engine wind-down; vibed_out = whistle
  // into a descending "you're outta here" figure.
  playRunEndSting(cause) {
    if (!ctx || !sfxBus) return;
    if (cause === 'vibed_out') {
      this.playMarshalWhistle();
      boop(ctx, sfxBus, 440, 392, 0.3, 0.12, 'triangle');
      boop(ctx, sfxBus, 392, 294, 0.4, 0.12, 'triangle');
    } else {
      boop(ctx, sfxBus, 220, 180, 0.35, 0.12, 'sawtooth');
      boop(ctx, sfxBus, 180, 110, 0.5, 0.1, 'sawtooth');
      boop(ctx, sfxBus, 660, 494, 0.5, 0.07, 'sine');
    }
  },

  playJuicePickup() {
    if (!ctx) return;
    const t = ctx.currentTime;
    boop(ctx, sfxBus, 660, 990, 0.1, 0.22, 'triangle');
    boop(ctx, sfxBus, 990, 1480, 0.12, 0.18, 'sine');
    // a little glassy top note
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(1980, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + 0.06);
    g.gain.linearRampToValueAtTime(0.12, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.26);
    osc.connect(g).connect(sfxBus);
    osc.start(t + 0.06); osc.stop(t + 0.3);
  },

  // One short mechanical cough when the working bubble-juice meter runs dry.
  // main.js owns the nonempty→empty edge, so this one-shot never polls or
  // repeats while the tank remains empty.
  playJuiceSputter() {
    if (!ctx || !sfxBus) return;
    juiceSputter(ctx, sfxBus);
  },

  // Comedic positional "blat" from an occupied porta-potty at (x, z). Routed
  // through a temporary PannerNode (like playCrowdCheer) so it pans + attenuates
  // with distance. Kept quiet — it's a background gag, not a feature.
  playPottyNoise(x, z) {
    if (!ctx || !sfxBus) return;
    pottyNoise(ctx, sfxBus, x, z);
  },

  // Firework rocket whistle — a rising, vibrato'd tone from (x, z) on the
  // ground as the shell climbs. Positional like playCrowdCheer.
  playFireworkLaunch(x, z) {
    if (!ctx || !sfxBus) return;
    fireworkLaunch(ctx, sfxBus, x, z);
  },

  // Firework burst at (x, z): a low body thump + a noise "crack", optionally a
  // 1s crackle/glitter train. `opts.delay` defers the whole thing (sound lags
  // the flash over distance — the system passes dist/340).
  playFireworkBurst(x, z, opts = {}) {
    if (!ctx || !sfxBus) return;
    fireworkBurst(ctx, sfxBus, x, z, opts);
  },

  // Returns the raw AudioContext so midiPlayer can share it with Tone.js via
  // Tone.setContext(). Sharing the context lets Tone route into masterGain/midiGain
  // instead of creating its own parallel audio graph that no slider can touch.
  getContext() { return ctx; },

  // Returns the raw Web Audio GainNode for midiPlayer to connect its Tone.js
  // output chain to. Tone.js ToneAudioNode.connect() accepts native AudioNodes.
  getMidiInputNode() { return midiGain; },

  // ---- Volume controls ----
  setMasterVolume(v) { if (masterGain) masterGain.gain.value = v; this._saveVolumes(); },
  setMusicVolume(v)  { if (musicBus)   musicBus.gain.value   = v; this._saveVolumes(); },
  setSfxVolume(v)    { if (sfxBus)     sfxBus.gain.value     = v; this._saveVolumes(); },
  setMidiVolume(v)   { if (midiGain)   midiGain.gain.value   = v; this._saveVolumes(); },
  setNatureVolume(v) { if (natureBus)  natureBus.gain.value  = v; this._saveVolumes(); },

  // Global mute. `setMuted(true)` silences masterGain regardless of its saved
  // level. `setMuted(false)` restores the saved master volume. Persisted so
  // a page reload respects the last mute state.
  // Session-only mute — deliberately NOT persisted, so the game always boots
  // with sound. Toggles the dedicated mute node; masterGain keeps the user's
  // real level, so unmuting restores it for free.
  setMuted(on) {
    _muted = !!on;
    if (muteGain) muteGain.gain.value = _muted ? 0 : 1;
  },
  isMuted() { return _muted; },

  // Runtime music attenuator — independent of the user's saved volume.
  // The MIDI player calls this with ~0.18 on start and 1.0 on stop so the
  // in-world stage music ducks under the foreground MIDI instead of
  // fighting it. Ramped to avoid pops.
  setMusicDuck(factor) {
    if (!musicDuckGain || !ctx) return;
    const now = ctx.currentTime;
    musicDuckGain.gain.cancelScheduledValues(now);
    musicDuckGain.gain.setValueAtTime(musicDuckGain.gain.value, now);
    musicDuckGain.gain.linearRampToValueAtTime(factor, now + 0.4);
  },

  // Star power: duck the stage music and bring up the fast 160bpm loop. No-op
  // before init() (iOS-safe — never created outside the unlock gesture).
  startStarPower() {
    if (!ctx || !_starGain) return;
    this.setMusicDuck(0.15);
    const now = ctx.currentTime;
    _starGain.gain.cancelScheduledValues(now);
    _starGain.gain.setValueAtTime(Math.max(0.0001, _starGain.gain.value), now);
    _starGain.gain.linearRampToValueAtTime(0.9, now + 0.2);
    _starStep = 0;
    _starNextTime = now + 0.06;
    if (_starSched) clearInterval(_starSched);
    _starSched = setInterval(_scheduleStarPower, 25);
  },
  stopStarPower() {
    if (!ctx || !_starGain) return;
    this.setMusicDuck(1.0);
    const now = ctx.currentTime;
    _starGain.gain.cancelScheduledValues(now);
    _starGain.gain.setValueAtTime(Math.max(0.0001, _starGain.gain.value), now);
    _starGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    if (_starSched) { clearInterval(_starSched); _starSched = null; }
  },
  getMasterVolume()  { return masterGain ? masterGain.gain.value  : 0.55; },
  getMusicVolume()   { return musicBus   ? musicBus.gain.value    : 1.6; },
  getSfxVolume()     { return sfxBus     ? sfxBus.gain.value      : 1.0; },
  getMidiVolume()    { return midiGain   ? midiGain.gain.value    : 1.0; },
  getNatureVolume()  { return natureBus  ? natureBus.gain.value   : 0.9; },

  _saveVolumes() {
    try {
      localStorage.setItem('zerble.vol.master',  String(masterGain ? masterGain.gain.value  : 0.55));
      localStorage.setItem('zerble.vol.music',   String(musicBus   ? musicBus.gain.value    : 1.6));
      localStorage.setItem('zerble.vol.sfx',     String(sfxBus     ? sfxBus.gain.value      : 1.0));
      localStorage.setItem('zerble.vol.midi',    String(midiGain   ? midiGain.gain.value    : 1.0));
      localStorage.setItem('zerble.vol.nature',  String(natureBus  ? natureBus.gain.value   : 0.9));
    } catch (e) { /* localStorage unavailable */ }
  },

  // Direct access to the stage handle registry for main.js cross-fade loop.
  // Returns the live array — each entry { handle, x, z }.
  getStageHandleRegistry() { return _stageHandleRegistry; },

  // Register a callback that fires at the end of each song (all songform styles).
  // `cb(x, z, style)` receives the live panner position + genre name so callers
  // (e.g. crowd.cheerNear) can react to the nearest stage.
  onSongEnd(cb) { _songEndCb = cb; },

  // Live introspection for each active songform stage — used by the sandbox
  // readout and `preview_eval Sound.songStates()` to verify correctness without audio.
  songStates() {
    return _activeStageSongs.map(s => ({ ...s }));
  },

  // Crowd applause at (x, z) → sfxBus. Distance-attenuated via a temporary
  // PannerNode. The sound is a dense cluster of individual clap events rendered
  // into one buffer (see buildApplauseBuffer), played through a single source,
  // with a few voiced "woo!" cheers (playWhoop) layered live on top — far
  // cheaper than the previous ~25-node bed, and it sounds like a crowd, not rain.
  playCrowdCheer(x, z) {
    if (!ctx || !sfxBus) return;
    const now = ctx.currentTime;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 14;
    panner.maxDistance = 160;
    panner.rolloffFactor = 1.0;
    if (panner.positionX) {
      panner.positionX.value = x;
      panner.positionY.value = 4;
      panner.positionZ.value = z;
    } else if (panner.setPosition) {
      panner.setPosition(x, 4, z);
    }
    panner.connect(sfxBus);

    const dur = 5.2;
    const src = ctx.createBufferSource();
    src.buffer = getApplauseBuffer(ctx, dur);
    const rate = 0.97 + Math.random() * 0.06;   // ±3% so reused buffers vary
    src.playbackRate.value = rate;
    const pd = dur / rate;                       // actual playback duration
    // Buffer already carries the swell→thin loudness arc; the gain node just
    // adds a click-safe attack and a clean tail-out.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.9, now + 0.12);
    gain.gain.setValueAtTime(0.9, now + pd - 0.2);
    gain.gain.linearRampToValueAtTime(0.0001, now + pd);
    src.connect(gain).connect(panner);
    src.start(now);
    src.stop(now + pd);

    // A few voiced "woo!" cheers poke through the claps, staggered over the
    // first ~3s — a mix of lower and higher voices, kept low under the bed.
    const nWhoops = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < nWhoops; i++) {
      const wt = now + 0.15 + Math.random() * 2.8;
      const f0 = Math.random() < 0.5 ? 150 + Math.random() * 90 : 270 + Math.random() * 150;
      playWhoop(ctx, panner, wt, f0, 0.6 + Math.random() * 0.6, 0.09 + Math.random() * 0.06);
    }

    setTimeout(() => { try { panner.disconnect(); } catch (e) {} }, pd * 1000 + 300);
  },

  // Force all active songform stages into their cheer gap immediately — for
  // verification without waiting out a full song length. Each runStageSong
  // scheduler reads `snap._forceEnd` on the next tick (within ~180ms).
  _debugEndSong() {
    for (const snap of _activeStageSongs) {
      snap._forceEnd = true;
    }
  },

  // Render one applause buffer and return numeric stats — for verifying the
  // clap synthesis without ears: peak, the loudness arc in 8 windows, a coarse
  // transient (clap) count, zero-crossings/sec as a spectral-centroid proxy,
  // and synthesis time. ZCR ~2–4k/s ⇒ energy centered ~1–2 kHz (clappy); a
  // bright hiss would read ~8k+. Arc should swell then decay.
  _debugApplauseStats() {
    if (!ctx) return { error: 'no ctx' };
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    const dur = 5.2;
    const buf = buildApplauseBuffer(ctx, dur);
    const synthMs = t0 ? +((performance.now() - t0).toFixed(1)) : null;
    const d = buf.getChannelData(0), sr = buf.sampleRate, N = d.length;
    let peak = 0, zc = 0;
    for (let i = 0; i < N; i++) {
      const a = d[i] < 0 ? -d[i] : d[i];
      if (a > peak) peak = a;
      if (i && (d[i] >= 0) !== (d[i - 1] >= 0)) zc++;
    }
    const W = 8, win = Math.floor(N / W), rmsArc = [];
    for (let w = 0; w < W; w++) {
      let s = 0;
      for (let i = w * win; i < (w + 1) * win; i++) s += d[i] * d[i];
      rmsArc.push(+Math.sqrt(s / win).toFixed(4));
    }
    let transientCount = 0, above = false;
    const th = peak * 0.18;
    for (let i = 0; i < N; i++) {
      const a = d[i] < 0 ? -d[i] : d[i];
      if (!above && a > th) { transientCount++; above = true; }
      else if (above && a < th * 0.4) above = false;
    }
    return { durationS: dur, sampleRate: sr, peak: +peak.toFixed(3), synthMs,
             zeroCrossPerSec: Math.round(zc / dur), transientCount, rmsArc };
  },
};

// ---------- Applause synthesis ----------

// Real applause is a Poisson process of discrete claps, not a wash of noise.
// Each clap is a short burst of exponentially-decaying noise colored by a broad
// resonance (~0.9–2.4 kHz — the spectral range of palm/finger claps per Repp
// 1987); a sizeable crowd is hundreds of these superimposed, sparse at first and
// blurring toward a roar as more people join in. The previous implementation
// used one continuous band-passed noise buffer, which reads as rain/static —
// it's the transient density that makes it sound like clapping. We render the
// whole cluster into a single buffer so playback is one source node regardless
// of clap count. Approach follows the clap/applause synthesis literature
// (Peltola/Välimäki; Lee & Reiss, "Real-Time Sound Synthesis of Audience
// Applause", AES).
function buildApplauseBuffer(ctx, dur = 5.2) {
  const sr = ctx.sampleRate;
  const N = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, N, sr);
  const data = buf.getChannelData(0);

  // Clap-density arc (0..1): quick swell as the crowd catches on, a sustain,
  // then a thinning tail as it dies down. Drives both clap rate and the roar.
  const arc = (t) => {
    const swell = Math.min(1, t / 0.3);
    const fade = t < 2.4 ? 1 : Math.max(0, 1 - (t - 2.4) / 2.8);
    return swell * fade;
  };
  const peakRate = 80;                       // claps/sec at the height of the crowd
  const rateAt = (t) => 5 + peakRate * arc(t);

  // Poisson onsets (exponential inter-arrival gaps). Each clap = white noise
  // through a 2-pole RBJ bandpass (broad Q so it stays noisy, not pitched) with
  // an exponential-decay envelope. ~10% are louder "standout" claps that poke
  // through the texture the way nearby claps do in a real crowd.
  let t = 0;
  while (t < dur) {
    t += -Math.log(1 - Math.random()) / rateAt(t);
    if (t >= dur) break;
    const start = Math.floor(t * sr);
    const fc = 700 + Math.random() * 1300;              // 0.7–2.0 kHz center
    const Q = 1.0 + Math.random() * 1.6;
    const decay = 0.012 + Math.random() * 0.026;        // 12–38 ms
    const amp = (0.45 + Math.random() * 0.5) * (Math.random() < 0.1 ? 1.7 : 1.0);
    const w0 = 2 * Math.PI * fc / sr, cw = Math.cos(w0), alpha = Math.sin(w0) / (2 * Q);
    const a0 = 1 + alpha, b0 = alpha / a0, b2 = -alpha / a0, a1 = -2 * cw / a0, a2 = (1 - alpha) / a0;
    const decaySamp = decay * sr;
    const len = Math.min(Math.floor(decaySamp * 4), N - start);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < len; i++) {
      const xn = Math.random() * 2 - 1;
      const yn = b0 * xn + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = xn; y2 = y1; y1 = yn;
      data[start + i] += amp * yn * Math.exp(-i / decaySamp);
    }
  }

  // Faint lowpassed roar underneath — the blur of distant claps. Lowpassed so
  // it's a soft body rather than a bright hiss, and scaled by the same arc.
  const roarA = 1 - Math.exp(-2 * Math.PI * 850 / sr);
  let roar = 0;
  for (let i = 0; i < N; i++) {
    roar += roarA * ((Math.random() * 2 - 1) - roar);
    data[i] += roar * 0.35 * arc(i / sr);
  }

  // Roll the harsh top off (one-pole lowpass ~2.8 kHz, in place) so the cluster
  // reads as a warm crowd centered ~1.5–2 kHz rather than a bright hiss, then
  // normalize to a headroom-safe peak (final level is set by the playback gain).
  const lpA = 1 - Math.exp(-2 * Math.PI * 2800 / sr);
  let lp = 0, peak = 0;
  for (let i = 0; i < N; i++) {
    lp += lpA * (data[i] - lp);
    data[i] = lp;
    const a = lp < 0 ? -lp : lp;
    if (a > peak) peak = a;
  }
  if (peak > 0) { const g = 0.7 / peak; for (let i = 0; i < N; i++) data[i] *= g; }

  return buf;
}

// Lazily-grown pool of pre-rendered applause buffers. Rendering the cluster is
// ~30 ms of JS; building a few once and reusing them (with slight playback-rate
// variety per cheer) keeps song-ends from hitching on lower-end devices, while
// staying varied enough — applause fires at most every minute or two per stage.
const _applausePool = [];
const APPLAUSE_POOL_MAX = 3;
function getApplauseBuffer(ctx, dur) {
  if (_applausePool.length < APPLAUSE_POOL_MAX) {
    const b = buildApplauseBuffer(ctx, dur);
    _applausePool.push(b);
    return b;
  }
  return _applausePool[(Math.random() * _applausePool.length) | 0];
}

// A single voiced crowd "woo!" — two slightly-detuned sawtooths shaped by vowel
// formant bandpasses (an /oo/ with a faint upper formant) with a rise-then-sag
// pitch contour and a vibrato that fades in. The previous cheer voices were one
// sawtooth through a single sweeping bandpass, which buzzed like a kazoo; real
// vowels need parallel formants + a pitch gesture to read as a shout. Connected
// to the stage panner by the caller so it shares the applause's distance falloff.
function playWhoop(ctx, dest, t0, f0, dur, level) {
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
  const o2 = ctx.createOscillator(); o2.type = 'sawtooth';
  o2.detune.value = 8 + Math.random() * 12;             // cents — slight chorus
  for (const o of [o1, o2]) {
    o.frequency.setValueAtTime(f0 * 0.88, t0);
    o.frequency.linearRampToValueAtTime(f0 * 1.08, t0 + dur * 0.22);
    o.frequency.linearRampToValueAtTime(f0 * 0.82, t0 + dur);
  }
  // Vibrato, fading in after the attack so the onset is clean.
  const vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5 + Math.random() * 1.6;
  const vibAmt = ctx.createGain();
  vibAmt.gain.setValueAtTime(0, t0);
  vibAmt.gain.linearRampToValueAtTime(f0 * 0.028, t0 + dur * 0.4);
  vib.connect(vibAmt); vibAmt.connect(o1.frequency); vibAmt.connect(o2.frequency);

  const mix = ctx.createGain(); mix.gain.value = 0.5;
  o1.connect(mix); o2.connect(mix);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.linearRampToValueAtTime(level, t0 + 0.08);
  amp.gain.setValueAtTime(level, t0 + dur * 0.65);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  // Vowel formants, gliding up from the /w/ onset into the /oo/.
  for (const [fStart, fEnd, Q, g] of [[250, 330, 5, 1.0], [620, 850, 8, 0.7], [2300, 2500, 10, 0.2]]) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = Q;
    bp.frequency.setValueAtTime(fStart, t0);
    bp.frequency.linearRampToValueAtTime(fEnd, t0 + dur * 0.3);
    const fg = ctx.createGain(); fg.gain.value = g;
    mix.connect(bp).connect(fg).connect(amp);
  }

  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
  amp.connect(lp).connect(dest);

  o1.start(t0); o2.start(t0); vib.start(t0);
  const tEnd = t0 + dur + 0.06;
  o1.stop(tEnd); o2.stop(tEnd); vib.stop(tEnd);
}

// ---------- Engine ----------

function createEngine(ctx, dest, opts = {}) {
  // Tunable timbre profile. The defaults reproduce Zerble's original wheezy
  // gas-engine exactly; Lurleen passes a higher/brighter/cleaner profile (see
  // init) so her motor reads as a distinct, lighter sibling. `spatial` wraps the
  // output in a PannerNode that tracks her world position; `accelBoost` derives
  // a rev signal from positive acceleration for carts that have no throttle
  // input of their own.
  const {
    pitchMul = 1, harmonic = 1.5, drive = 8, noiseLevel = 0.65,
    chugBase = 4, chugSpan = 14, lpfBase = 320, lpfSpan = 700,
    volScale = 0.24, speedRef = 18, spatial = false, accelBoost = 0,
  } = opts;

  // Two sawtooth oscillators give the gas-engine timbre. The harmonic at 1.5x
  // adds bite without sounding electronic.
  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = 55;

  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = 82;

  // Warm low-pass filter so it doesn't get harsh at high revs
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 420;
  lpf.Q.value = 1.5;

  osc1.connect(lpf);
  osc2.connect(lpf);

  // Soft-clip WaveShaper — this is the "old wheezy" crunch.
  // A steeper tanh = more distortion. Run the sawtooth-through-LPF signal
  // through the shaper, then through a band-pass to focus the grit.
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeTanhCurve(drive, 2048);
  shaper.oversample = '2x';
  lpf.connect(shaper);

  const grindBpf = ctx.createBiquadFilter();
  grindBpf.type = 'bandpass';
  grindBpf.frequency.value = 280;
  grindBpf.Q.value = 1.4;
  shaper.connect(grindBpf);

  // Noise rumble — louder + grainier now. Mid-range filter so it sounds dirty.
  const bufSize = 2 * ctx.sampleRate;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) ch[i] = (Math.random() * 2 - 1) * 0.9;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const noiseBpf = ctx.createBiquadFilter();
  noiseBpf.type = 'bandpass';
  noiseBpf.frequency.value = 200;
  noiseBpf.Q.value = 0.8;
  noise.connect(noiseBpf);
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = noiseLevel;
  noiseBpf.connect(noiseGain);

  // Master engine volume — driven by speed each frame
  const engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  grindBpf.connect(engineGain);
  noiseGain.connect(engineGain);

  // Spatial carts (Lurleen) pan + attenuate from their world position so the
  // motor comes from where she actually is. equalpower, not HRTF — a constant
  // drone sounds phasey through HRTF; equalpower gives clean pan + distance.
  let panner = null;
  if (spatial) {
    panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 10;
    panner.maxDistance = 130;
    panner.rolloffFactor = 1.2;
    if (panner.positionY) panner.positionY.value = 0.6;
    else if (panner.setPosition) panner.setPosition(0, 0.6, 0);
    engineGain.connect(panner);
    panner.connect(dest);
  } else {
    engineGain.connect(dest);
  }

  osc1.start();
  osc2.start();
  noise.start();

  // Hand-driven state for putt-putt LFO, warble, and misfires
  let lfoPhase = 0;
  let lastUpdate = ctx.currentTime;
  let misfireUntil = 0;       // engine "stutter" silence ends at this time
  let nextMisfireCheck = ctx.currentTime + 2 + Math.random() * 2;
  let warblePhase = 0;
  let tripWobblePhase = 0;    // advances only while a trip is active (see below)

  // Boost smoothing — sudden 0→1 jumps in input.boost would make the engine
  // pitch jump audibly. Glide between current and target boost.
  let boostSmoothed = 0;
  let lastAbsSpeed = 0;       // for the accel-derived boost (autonomous carts)

  return {
    update(absSpeed, boost = 0) {
      const now = ctx.currentTime;
      const dt = Math.min(0.1, now - lastUpdate);
      lastUpdate = now;

      // Carts without a throttle (Lurleen) derive a rev "boost" from positive
      // acceleration — engine revs as she speeds up to catch the player, eases
      // off when she coasts. Zerble passes boost explicitly (accelBoost === 0).
      if (accelBoost > 0) {
        const accel = (absSpeed - lastAbsSpeed) / Math.max(dt, 1e-3);
        boost = Math.max(0, Math.min(1, (accel / (speedRef * 2)) * accelBoost));
      }
      lastAbsSpeed = absSpeed;

      // Glide boost toward target so engagement/disengagement isn't a step.
      boostSmoothed += (boost - boostSmoothed) * Math.min(1, dt * 6);

      // Boost raises the effective "throttle" so the engine reads as revving
      // harder even when at the max speed cap. Adds up to +30% to t.
      const baseT = Math.min(1, absSpeed / speedRef);
      const t = Math.min(1, baseT + boostSmoothed * 0.3);

      // Chug speeds up with throttle. Irregular rhythm: slight noise on the rate.
      const lfoHz = chugBase + t * chugSpan + Math.sin(lfoPhase * 0.31) * 1.2;
      lfoPhase += lfoHz * dt;
      // Chug envelope shape: peaky, not smooth sine (more "putt-putt")
      const chugSin = Math.sin(lfoPhase);
      const chug = (chugSin > 0 ? Math.pow(chugSin, 2) : chugSin * 0.15) * 0.4 + 0.55;

      // Random misfires: every couple seconds, kill the chug briefly
      if (now > nextMisfireCheck) {
        nextMisfireCheck = now + 1.5 + Math.random() * 3.5;
        if (t > 0.1 && Math.random() < 0.6) {
          misfireUntil = now + 0.07 + Math.random() * 0.12;
        }
      }
      const misfireMul = now < misfireUntil ? 0.2 : 1;

      // Volume ramps with speed * chug * misfire. At 0 speed → 0 volume → silent.
      // Boost also adds a flat +20% gain so the engine sounds "louder", not just
      // higher-pitched, when the player floors it.
      const targetVol = t * volScale * chug * misfireMul * (1 + boostSmoothed * 0.2);
      engineGain.gain.setTargetAtTime(targetVol, now, 0.04);

      // Pitch climbs with speed + slow warble for the wheezy old-cart wobble.
      // Boost shifts the whole pitch range up so the engine wails when revving.
      warblePhase += dt * (1.8 + t * 1.5);
      const warble = Math.sin(warblePhase) * (0.04 + t * 0.05); // ±5-9 % at high revs

      // Trip seasickness — a slow wandering detune layered on top of the
      // warble while a trip is active. Reads module-level _sfxTripEnv /
      // _sfxTripProgress (poll pattern, same as nightness). Two summed sines
      // (like the trip's dynamic visual curves) so the wobble doesn't sit at
      // one rate; the rate itself creeps up with progress. ±~16% at full
      // trip ≈ a couple of seasick semitones.
      tripWobblePhase += dt * (0.5 + _sfxTripProgress * 1.3);
      const tripDetune = _sfxTripEnv > 0
        ? 1 + _sfxTripEnv * (0.11 * Math.sin(tripWobblePhase) + 0.05 * Math.sin(tripWobblePhase * 2.3 + 0.7))
        : 1;

      const baseFreq = 48 + boostSmoothed * 10;
      const maxFreq = 145 + boostSmoothed * 40;
      const f = (baseFreq + (maxFreq - baseFreq) * t) * (1 + warble) * tripDetune * pitchMul;
      osc1.frequency.setTargetAtTime(f, now, 0.07);
      osc2.frequency.setTargetAtTime(f * harmonic, now, 0.07);

      // Open the filter at high revs (brighter), tighten at low (muddier)
      const filterFreq = lpfBase + t * lpfSpan;
      lpf.frequency.setTargetAtTime(filterFreq, now, 0.1);

      // Drive the grind band-pass slightly with speed so the crunch peaks shift
      grindBpf.frequency.setTargetAtTime(230 + t * 280, now, 0.1);
    },
    // No-op unless spatial. Drives the PannerNode to the cart's world position.
    setPosition(x, z) {
      if (!panner) return;
      if (panner.positionX) { panner.positionX.value = x; panner.positionZ.value = z; }
      else if (panner.setPosition) panner.setPosition(x, 0.6, z);
    },
  };
}

// Tanh-shaped soft-clip curve for the engine WaveShaper.
function makeTanhCurve(drive, samples) {
  const c = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    c[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return c;
}

// ---------- Collision sound primitives ----------

function makeEnv(ctx, dest, attack, decay, peak) {
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(dest);
  return g;
}

function thump(ctx, dest, freq, duration, volume = 0.5) {
  const env = makeEnv(ctx, dest, 0.005, duration, volume);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const t = ctx.currentTime;
  osc.frequency.setValueAtTime(freq * 2.2, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq), t + duration);
  osc.connect(env);
  osc.start();
  osc.stop(t + duration + 0.05);
}

function boop(ctx, dest, freqStart, freqEnd, duration, volume = 0.4, type = 'sine') {
  const env = makeEnv(ctx, dest, 0.005, duration, volume);
  const osc = ctx.createOscillator();
  osc.type = type;
  const t = ctx.currentTime;
  osc.frequency.setValueAtTime(freqStart, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
  osc.connect(env);
  osc.start();
  osc.stop(t + duration + 0.05);
}

function juiceSputter(ctx, dest) {
  const t = ctx.currentTime;
  const body = ctx.createOscillator();
  body.type = 'sawtooth';
  body.frequency.setValueAtTime(118, t);
  body.frequency.exponentialRampToValueAtTime(54, t + 0.32);

  const flutter = ctx.createOscillator();
  flutter.type = 'square';
  flutter.frequency.setValueAtTime(19, t);
  flutter.frequency.linearRampToValueAtTime(8, t + 0.32);
  const flutterDepth = ctx.createGain();
  flutterDepth.gain.setValueAtTime(42, t);
  flutterDepth.gain.linearRampToValueAtTime(12, t + 0.32);
  flutter.connect(flutterDepth).connect(body.frequency);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.exponentialRampToValueAtTime(240, t + 0.34);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.16, t + 0.012);
  env.gain.exponentialRampToValueAtTime(0.035, t + 0.09);
  env.gain.exponentialRampToValueAtTime(0.12, t + 0.14);
  env.gain.exponentialRampToValueAtTime(0.018, t + 0.22);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);

  body.connect(filter).connect(env).connect(dest);
  body.start(t);
  flutter.start(t);
  body.stop(t + 0.4);
  flutter.stop(t + 0.4);
}

function clang(ctx, dest) {
  const t = ctx.currentTime;
  // High square sweep down — metallic bite
  const env1 = makeEnv(ctx, dest, 0.001, 0.25, 0.35);
  const o1 = ctx.createOscillator();
  o1.type = 'square';
  o1.frequency.setValueAtTime(1900, t);
  o1.frequency.exponentialRampToValueAtTime(900, t + 0.25);
  o1.connect(env1);
  o1.start();
  o1.stop(t + 0.3);

  // Triangle layer for body
  const env2 = makeEnv(ctx, dest, 0.001, 0.32, 0.18);
  const o2 = ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(1200, t);
  o2.frequency.exponentialRampToValueAtTime(500, t + 0.3);
  o2.connect(env2);
  o2.start();
  o2.stop(t + 0.35);
}

function brassHit(ctx, dest) {
  const t = ctx.currentTime;
  const env = makeEnv(ctx, dest, 0.02, 0.45, 0.4);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.linearRampToValueAtTime(170, t + 0.45);
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(2000, t);
  lpf.frequency.linearRampToValueAtTime(700, t + 0.3);
  osc.connect(lpf).connect(env);
  osc.start();
  osc.stop(t + 0.5);
}

function woodKnock(ctx, dest) {
  const t = ctx.currentTime;
  const env = makeEnv(ctx, dest, 0.001, 0.12, 0.45);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(450, t);
  osc.frequency.exponentialRampToValueAtTime(170, t + 0.12);
  osc.connect(env);
  osc.start();
  osc.stop(t + 0.15);
}

function duudeSound(ctx, dest) {
  const t = ctx.currentTime;
  // Low slow "duuude" — sine carrier + filtered saw harmonic
  const env = makeEnv(ctx, dest, 0.06, 0.75, 0.4);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.linearRampToValueAtTime(120, t + 0.4);
  osc.frequency.linearRampToValueAtTime(135, t + 0.75);
  osc.connect(env);
  osc.start();
  osc.stop(t + 0.85);

  const env2 = makeEnv(ctx, dest, 0.06, 0.75, 0.18);
  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(320, t);
  osc2.frequency.linearRampToValueAtTime(240, t + 0.4);
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 520;
  osc2.connect(lpf).connect(env2);
  osc2.start();
  osc2.stop(t + 0.85);
}

// Comedic porta-potty "blat" — a buzzy sawtooth with a fast descending pitch and
// a square-wave flutter ("pbbbt"), pushed through a closing lowpass so it reads
// muffled (it's behind a plastic door). Positional via a temporary PannerNode.
// ---- Fireworks --------------------------------------------------------------

function _fwPanner(ctx, dest, x, y, z, ref, max) {
  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = ref;
  panner.maxDistance = max;
  panner.rolloffFactor = 0.9;
  if (panner.positionX) {
    panner.positionX.value = x; panner.positionY.value = y; panner.positionZ.value = z;
  } else if (panner.setPosition) {
    panner.setPosition(x, y, z);
  }
  panner.connect(dest);
  return panner;
}

// Airy lift "whoosh" as the rocket climbs — band-passed noise sweeping up, no
// strong tone. Deliberately quiet: a finale barrage shouldn't become a chorus
// of whistles (the earlier tonal version read as musical + distracting).
function fireworkLaunch(ctx, dest, x, z) {
  const t = ctx.currentTime;
  const panner = _fwPanner(ctx, dest, x, 6, z, 30, 320);
  const dur = 0.7;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1);
  const noise = ctx.createBufferSource(); noise.buffer = buf;
  const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass';
  bpf.frequency.setValueAtTime(330, t);
  bpf.frequency.exponentialRampToValueAtTime(1250, t + dur);   // pitch rises with the climb
  bpf.Q.value = 0.8;                                            // wide → airy, not a whistle
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.012, t + dur * 0.75);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  noise.connect(bpf).connect(g).connect(panner);
  noise.start(t); noise.stop(t + dur + 0.05);
  setTimeout(() => { try { panner.disconnect(); } catch (e) {} }, (dur + 0.3) * 1000);
}

// Burst: low body thump + a band-passed noise crack, optional crackle train.
// `opts.delay` defers everything so the report lags the flash over distance.
function fireworkBurst(ctx, dest, x, z, opts) {
  const start = ctx.currentTime + (opts.delay || 0);
  const panner = _fwPanner(ctx, dest, x, 60, z, 40, 400);

  if (opts.boom !== false) {
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, start);
    bg.gain.exponentialRampToValueAtTime(0.6, start + 0.008);
    bg.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    const bo = ctx.createOscillator(); bo.type = 'sine';
    bo.frequency.setValueAtTime(150, start);
    bo.frequency.exponentialRampToValueAtTime(46, start + 0.4);
    bo.connect(bg).connect(panner);
    bo.start(start); bo.stop(start + 0.55);
  }

  // Noise crack — short band-passed burst that sweeps down.
  const dur = 0.5;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const chd = buf.getChannelData(0);
  for (let i = 0; i < chd.length; i++) chd[i] = (Math.random() * 2 - 1);
  const noise = ctx.createBufferSource(); noise.buffer = buf;
  const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass';
  bpf.frequency.setValueAtTime(900, start);
  bpf.frequency.exponentialRampToValueAtTime(250, start + dur);
  bpf.Q.value = 0.7;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, start);
  ng.gain.exponentialRampToValueAtTime(0.5, start + 0.006);
  ng.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  noise.connect(bpf).connect(ng).connect(panner);
  noise.start(start); noise.stop(start + dur + 0.05);

  // Crackle/glitter train — short high-passed grains over ~1.2s, sharing one
  // tiny noise buffer.
  if (opts.crackle) {
    const grain = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
    const gd = grain.getChannelData(0);
    for (let i = 0; i < gd.length; i++) gd[i] = (Math.random() * 2 - 1);
    for (let tt = start + 0.15; tt < start + 1.2; tt += 0.02 + Math.random() * 0.05) {
      const lvl = 0.12 * (1 - (tt - start) / 1.2);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, tt);
      cg.gain.exponentialRampToValueAtTime(Math.max(0.001, lvl), tt + 0.003);
      cg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.04);
      const cn = ctx.createBufferSource(); cn.buffer = grain;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
      cn.connect(hp).connect(cg).connect(panner);
      cn.start(tt); cn.stop(tt + 0.05);
    }
  }

  setTimeout(() => { try { panner.disconnect(); } catch (e) {} }, ((opts.delay || 0) + 2.0) * 1000);
}

function pottyNoise(ctx, dest, x, z) {
  const t = ctx.currentTime;
  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 6;
  panner.maxDistance = 45;
  panner.rolloffFactor = 1.4;
  if (panner.positionX) {
    panner.positionX.value = x;
    panner.positionY.value = 1;
    panner.positionZ.value = z;
  } else if (panner.setPosition) {
    panner.setPosition(x, 1, z);
  }
  panner.connect(dest);

  const dur = 0.45 + Math.random() * 0.4;
  const f0 = 130 + Math.random() * 60;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(45, f0 * 0.5), t + dur);

  // Flutter LFO modulates the pitch — the squelchy "pbbbt" character.
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.setValueAtTime(18 + Math.random() * 16, t);
  lfo.frequency.linearRampToValueAtTime(7, t + dur);
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = f0 * 0.4;
  lfo.connect(lfoGain).connect(osc.frequency);

  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(900, t);
  lpf.frequency.linearRampToValueAtTime(420, t + dur);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.03);
  g.gain.setValueAtTime(0.16, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);

  osc.connect(lpf).connect(g).connect(panner);
  osc.start(t); osc.stop(t + dur + 0.05);
  lfo.start(t); lfo.stop(t + dur + 0.05);
}

// Two horn variants picked at random — clown squeeze-bulb or bicycle bell.
function playHonk(ctx, dest) {
  if (Math.random() < 0.5) playClownBulb(ctx, dest);
  else playBicycleBell(ctx, dest);
}

// Squeeze-bulb / "ooga" clown horn — TWO sounds in sequence:
//   1) HONK (squeeze): one steady low tone with a sharp click transient up
//      front. Lasts ~0.22s. Frequency does NOT slide — a real rubber bulb
//      makes a steady note while you squeeze it.
//   2) INHALE (release): a quieter, shorter, HIGHER tone as air rushes back
//      into the bulb. Pitched a perfect fifth (1.5×) above the honk.
function playClownBulb(ctx, dest) {
  const t = ctx.currentTime;

  // Tone frequencies (steady — no glide).
  const HONK_SAW = 260, HONK_TRI = 130;
  const INHALE_SAW = HONK_SAW * 1.5, INHALE_TRI = HONK_TRI * 1.5;  // a 5th above

  // Phase timings.
  const HONK_DUR    = 0.22;   // squeeze hold
  const GAP         = 0.05;   // tiny silence between squeeze and release
  const INHALE_DUR  = 0.16;   // shorter, breathier
  const TOTAL       = HONK_DUR + GAP + INHALE_DUR + 0.05;

  // ---- 1) Squeeze CLICK: ~5ms high-passed white-noise burst at t=0 ------
  function emitClick(at, gain, hpfHz) {
    const dur = 0.005;
    const n = Math.max(1, Math.floor(ctx.sampleRate * (dur + 0.02)));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = hpfHz;
    hpf.Q.value = 0.8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(hpf).connect(env).connect(dest);
    src.start(at);
    src.stop(at + dur + 0.01);
  }
  emitClick(t, 0.45, 2200);                          // sharp squeeze click
  emitClick(t + HONK_DUR + GAP, 0.18, 3000);         // softer intake "puff"

  // ---- 2) Body — saw + tri through reed WaveShaper, two phases ---------
  // Single envelope handles both honk and inhale with a gap in the middle.
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  // HONK: ramp up, sustain, drop to silence at the gap.
  env.gain.exponentialRampToValueAtTime(0.32, t + 0.025);
  env.gain.setValueAtTime(0.32, t + HONK_DUR - 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, t + HONK_DUR);
  // INHALE: ramp up at lower peak, hold, fade.
  const tInhaleStart = t + HONK_DUR + GAP;
  env.gain.exponentialRampToValueAtTime(0.20, tInhaleStart + 0.02);
  env.gain.setValueAtTime(0.20, tInhaleStart + INHALE_DUR - 0.04);
  env.gain.exponentialRampToValueAtTime(0.0001, tInhaleStart + INHALE_DUR);
  env.connect(dest);

  const sawOsc = ctx.createOscillator();
  sawOsc.type = 'sawtooth';
  sawOsc.frequency.setValueAtTime(HONK_SAW, t);
  sawOsc.frequency.setValueAtTime(INHALE_SAW, tInhaleStart);

  const triOsc = ctx.createOscillator();
  triOsc.type = 'triangle';
  triOsc.frequency.setValueAtTime(HONK_TRI, t);
  triOsc.frequency.setValueAtTime(INHALE_TRI, tInhaleStart);

  // Bandpass — "horn body" formant.
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 750;
  bpf.Q.value = 1.2;

  // Soft-saturation reed shaper.
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeReedCurve(2.4, 1024);
  shaper.oversample = '2x';

  sawOsc.connect(shaper);
  triOsc.connect(shaper);
  shaper.connect(bpf);
  bpf.connect(env);

  sawOsc.start();
  triOsc.start();
  sawOsc.stop(t + TOTAL);
  triOsc.stop(t + TOTAL);
}

// Subtle distortion curve — a softer cousin of the engine's tanh curve,
// tuned to round off peaks just enough to add reedy harmonics without
// turning into buzzy fuzz.
function makeReedCurve(drive, samples) {
  const c = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    // Soft asymmetric clip — produces the nasal bias of a real horn reed.
    c[i] = Math.tanh(x * drive + 0.18 * x * x) / Math.tanh(drive + 0.18);
  }
  return c;
}

// Bicycle bell — a real bell's thumb-lever bounces against the dome multiple
// times in rapid succession, so we render each "brrring" as 6 closely-spaced
// strikes (~30Hz strike rate) whose ring tails overlap into a rolling buzz
// instead of a clean single ding. Two brrrings = classic double-trill.
function playBicycleBell(ctx, dest) {
  const t0 = ctx.currentTime;
  brrring(ctx, dest, t0,         /*loud=*/0.55);
  brrring(ctx, dest, t0 + 0.32,  /*loud=*/0.42);  // quieter second trill
}

// One "brrring": 6 inharmonic FM strikes, ~32ms apart (~31Hz strike rate),
// each strike progressively softer so the trill rolls off rather than
// sustaining as a wall of clang.
function brrring(ctx, dest, tStart, loud) {
  const STRIKES = 6;
  const SPACING = 0.032;        // 32ms between strikes → ~31Hz buzz
  for (let i = 0; i < STRIKES; i++) {
    // Each subsequent strike is a bit quieter (the lever loses energy with
    // each bounce). Last few strikes have short release so the brrring doesn't
    // smear into the next trill.
    const tap = i === 0 ? loud : loud * (1 - i * 0.13);
    const release = 0.10 - i * 0.012;  // first strikes ring longer
    ringOnce(ctx, dest, tStart + i * SPACING, 2400, tap, Math.max(0.04, release));
  }
}

function ringOnce(ctx, dest, t, carrierHz, strikeGain, releaseGain) {
  // ---- Carrier + modulator (FM synthesis, inharmonic ratio) ----------
  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = carrierHz;

  const modulator = ctx.createOscillator();
  modulator.type = 'sine';
  // √2 ≈ 1.4142 — a deliberately non-integer ratio produces inharmonic
  // sidebands that read as "metal struck" rather than a clean musical note.
  modulator.frequency.value = carrierHz * 1.4142;
  const modGain = ctx.createGain();
  // Modulation index falls off slightly across the ring so the partials
  // settle into a purer sine as the bell rings out.
  modGain.gain.setValueAtTime(carrierHz * 0.28, t);
  modGain.gain.exponentialRampToValueAtTime(carrierHz * 0.10, t + 0.4);
  modulator.connect(modGain).connect(carrier.frequency);

  // ---- High-pass filter: cut the muddy low fundamental ----------------
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 1200;
  hpf.Q.value = 0.6;

  // ---- Two-stage envelope: sharp strike → long release ----------------
  // The strike is a 2ms high-amplitude transient that gives the "tink"
  // impact; the release tail rings for ~0.65s.
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(strikeGain, t + 0.002);   // strike
  env.gain.exponentialRampToValueAtTime(releaseGain, t + 0.025);  // settle
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);        // ringout

  carrier.connect(hpf).connect(env).connect(dest);
  carrier.start(t);
  modulator.start(t);
  carrier.stop(t + 0.7);
  modulator.stop(t + 0.7);
}

// ---------- Spatial stage music ----------

// Picks a key + tempo + pattern from the seed and runs a self-scheduling loop
// on a PannerNode placed at the stage. `style` picks the synth personality —
// jam-band, brass-led, or drum-only.
//
// Each style returns the same handle shape ({ panner, stop }) so callers don't
// care which engine is running underneath.
function createStageMusic(ctx, dest, x, y, z, seed, style = 'jam', opts = {}) {
  // Per-stage master GainNode for cross-fade. Inserted between music and
  // panner so moving between stages fades them independently without touching
  // the user's music-bus volume level. Starts at full gain (1.0); main.js
  // ramps it by distance via setAudibility.
  const master = ctx.createGain();
  master.gain.value = 1.0;
  master.connect(dest);

  // Stages are all-on, distance-attenuated by PannerNode inverse model.
  // The master gain is an extra layer on top so nearby stages are clear
  // and farther ones are cross-faded smoothly as you move between them.
  const panner = createStagePanner(ctx, master, x, y, z);
  // Helper so onSongEnd can read the LIVE panner position at the moment the
  // song ends (the brass band moves; we want its current location, not boot-time).
  const curX = () => panner.positionX ? panner.positionX.value : x;
  const curZ = () => panner.positionZ ? panner.positionZ.value : z;

  // Per-instance genre overrides merged onto the shared genre def. onSongEnd is
  // always present; introFinaleSeconds is only set for the pinned origin stage
  // so its first song opens at the closing section (see runStageSong.newSong).
  const extra = { onSongEnd: () => _emitSongEnd(curX(), curZ(), style) };
  if (opts.introFinaleSeconds) extra.introFinaleSeconds = opts.introFinaleSeconds;

  let handle;
  switch (style) {
    case 'brass': {
      const def = Object.assign({}, BRASS, extra);
      handle = runStageSong(ctx, panner, seed, def);
      break;
    }
    case 'dance': {
      const def = Object.assign({}, DANCE, extra);
      handle = runStageSong(ctx, panner, seed, def);
      break;
    }
    case 'world': {
      const def = Object.assign({}, WORLD, extra);
      handle = runStageSong(ctx, panner, seed, def);
      break;
    }
    case 'dub': {
      const def = Object.assign({}, DUB, extra);
      handle = runStageSong(ctx, panner, seed, def);
      break;
    }
    case 'drum':        handle = drumStage(ctx, panner, seed); break;
    case 'forest_drum': handle = forestDrumStage(ctx, panner, seed); break;
    case 'second_line': handle = secondLineStage(ctx, panner, seed); break;
    case 'jam':
    default: {
      const def = Object.assign({}, JAM, extra);
      handle = runStageSong(ctx, panner, seed, def);
      break;
    }
  }
  // Universal position setter so callers (e.g. the marching brass band) can
  // move the source around the world each frame.
  handle.setPosition = (nx, ny, nz) => {
    if (panner.positionX) {
      panner.positionX.setTargetAtTime(nx, ctx.currentTime, 0.02);
      panner.positionY.setTargetAtTime(ny, ctx.currentTime, 0.02);
      panner.positionZ.setTargetAtTime(nz, ctx.currentTime, 0.02);
    } else if (panner.setPosition) {
      panner.setPosition(nx, ny, nz);
    }
  };
  // setLowpassCutoff is only defined on the forest-drum engine — leave a
  // no-op shim on other styles so callers can call it uniformly.
  if (typeof handle.setLowpassCutoff !== 'function') {
    handle.setLowpassCutoff = () => {};
  }
  // Smooth cross-fade gain control. Called each frame by main.js with a
  // 0..1 value based on listener distance so stages blend as you move between them.
  handle.setAudibility = (g) => {
    if (!ctx) return;
    master.gain.setTargetAtTime(Math.max(0, Math.min(1, g)), ctx.currentTime, 0.6);
  };
  // Wrap the upstream stop to also disconnect the master gain node.
  const _upstreamStop = handle.stop;
  handle.stop = () => {
    _upstreamStop();
    try { master.disconnect(); } catch (e) {}
    const idx = _stageHandleRegistry.findIndex(e => e.handle === handle);
    if (idx !== -1) _stageHandleRegistry.splice(idx, 1);
  };
  return handle;
}

function createStagePanner(ctx, dest, x, y, z) {
  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 14;
  panner.maxDistance = 140;
  // Slightly gentler than the original 1.1 so nearby and mid-distance stages
  // blend more naturally; the master gain cross-fade handles close-vs-far.
  panner.rolloffFactor = 0.9;
  if (panner.positionX) {
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  } else if (panner.setPosition) {
    panner.setPosition(x, y, z);
  }
  panner.connect(dest);
  return panner;
}

// Major pentatonic — pleasant in any key, won't clash with neighboring stages.
const SCALE_PENT = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4];
// Mixolydian-ish — flat-seventh adds a slightly hornier feel.
const SCALE_MIXO = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 16 / 9, 2];
// Minor-ish scale (natural minor / Aeolian) for dub.
const SCALE_MINOR = [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 16 / 9, 2];

// Euclidean rhythm: distribute `hits` evenly across `steps` ticks. Returns
// a length-`steps` boolean array. Optional `shift` rotates the pattern.
// Hoisted to module scope so dance / world genre defs can reuse it; also
// used by forestDrumStage's local copy (left intact there for clarity).
function E(hits, steps, shift = 0) {
  const pattern = new Array(steps).fill(false);
  for (let i = 0; i < hits; i++) pattern[Math.floor((i * steps) / hits)] = true;
  if (!shift) return pattern;
  const out = new Array(steps);
  for (let i = 0; i < steps; i++) out[i] = pattern[((i - shift) % steps + steps) % steps];
  return out;
}

// ---- Song-end / cheer API ----

let _songEndCb = null;
// Module-level list of live song-state snapshots for Sound.songStates() introspection.
const _activeStageSongs = [];

// Called at the end of each song. Gates applause on listener proximity (~140m)
// then fires the registered callback so crowd behavior can respond.
function _emitSongEnd(x, z, style) {
  if (ctx) {
    const lis = ctx.listener;
    const lx = lis.positionX ? lis.positionX.value : 0;
    const lz = lis.positionZ ? lis.positionZ.value : 0;
    const dist = Math.sqrt((lx - x) * (lx - x) + (lz - z) * (lz - z));
    if (dist < 140) Sound.playCrowdCheer(x, z);
  }
  if (_songEndCb) _songEndCb(x, z, style);
}

// ---- Shared songform engine ----

// Key-shift options for per-song key changes. Picked with pickNext so the
// same ratio doesn't repeat back-to-back.
const KEY_SHIFTS = [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2];
// Section-ordering helpers — avoid immediate index repeats.
function pickNext(prev, n, rng) {
  if (n <= 1) return 0;
  let idx;
  do { idx = Math.floor(rng() * n); } while (idx === prev);
  return idx;
}

// runStageSong — shared songform engine for melodic stage styles.
// `genreDef` describes the genre personality (see JAM / BRASS / DANCE / WORLD / DUB below).
// Returns the same { panner, stop } handle shape as the legacy generators.
function runStageSong(ctx, panner, seed, genreDef) {
  const rng = mulberry32(seed >>> 0);

  // Song-level state — re-rolled at the start of each song.
  let song = null;
  let songIdx = -1;
  let beatInSong = 0;
  let nextBeatTime = ctx.currentTime + 0.15;
  let barInSection = 0;
  let sectionIdx = 0;
  let prevKeyShift = -1;
  let prevLeadType = -1;
  let leadType = 0;
  let phase = 'playing';    // 'playing' | 'cheerGap'
  let cheerGapEnd = 0;
  let voices = null;
  let teardown = [];

  // Introspection snapshot — updated each beat, read by Sound.songStates().
  const snap = {
    genre: genreDef.name,
    songIdx: 0,
    tempo: 0,
    keyShift: 1,
    tonicHz: genreDef.baseHz,
    section: 'intro',
    barInSection: 0,
    beatInSong: 0,
    totalBeats: 0,
    phase: 'playing',
  };
  _activeStageSongs.push(snap);

  function newSong() {
    songIdx++;
    snap.songIdx = songIdx;

    // Tear down previous song's voices if any.
    for (const fn of teardown) { try { fn(); } catch (e) {} }
    teardown = [];

    // Re-roll tempo within the genre's range.
    const [tMin, tMax] = genreDef.tempoRange;
    const tempo = tMin + Math.floor(rng() * (tMax - tMin + 1));

    // Key shift — pick a ratio that's different from last song's.
    const ksIdx = pickNext(prevKeyShift, KEY_SHIFTS.length, rng);
    prevKeyShift = ksIdx;
    const keyShift = KEY_SHIFTS[ksIdx];
    const tonicHz = genreDef.baseHz * keyShift;

    // Lead timbre — pick one from the genre's leadTypes list.
    if (genreDef.leadTypes && genreDef.leadTypes.length > 1) {
      leadType = pickNext(prevLeadType, genreDef.leadTypes.length, rng);
      prevLeadType = leadType;
    } else {
      leadType = 0;
    }

    // Build sections from the genre's template.
    const sections = genreDef.sectionTemplate(rng);
    let totalBeats = 0;
    for (const s of sections) totalBeats += s.bars * 4;

    song = { tempo, keyShift, tonicHz, sections, totalBeats };
    beatInSong = 0;
    barInSection = 0;
    sectionIdx = 0;
    phase = 'playing';
    // Restart cleanly on the next tick. The cheer gap freezes nextBeatTime, so
    // without this a post-gap song would "catch up" the frozen beats in one
    // scheduler tick and start several beats into its intro.
    nextBeatTime = ctx.currentTime + 0.15;

    // Intro finale: the pinned origin main stage starts its FIRST song already
    // at its closing section, so a player who just spawned hears the band wrap
    // up and the crowd applaud within ~introFinaleSeconds — instead of waiting
    // out a full ~2-minute song before any applause ever happens. Later songs
    // play full length. Snaps to a section downbeat so it begins cleanly.
    if (genreDef.introFinaleSeconds && songIdx === 0) {
      const beatDur = 60 / tempo;
      const target = totalBeats - Math.round(genreDef.introFinaleSeconds / beatDur);
      let acc = 0, si = 0;
      while (si < sections.length - 1 && acc + sections[si].bars * 4 <= target) {
        acc += sections[si].bars * 4;
        si++;
      }
      sectionIdx = si;
      beatInSong = acc;
    }

    snap.tempo = tempo;
    snap.keyShift = +keyShift.toFixed(4);
    snap.tonicHz = +tonicHz.toFixed(2);
    snap.totalBeats = totalBeats;
    snap.beatInSong = beatInSong;
    snap.phase = 'playing';

    // Build genre voices.
    const v = genreDef.makeVoices(ctx, panner, rng, tonicHz);
    voices = v.voices;
    teardown = v.teardown || [];
  }

  newSong();

  function currentSection() {
    // Return null once we run past the last section — that's the signal the
    // schedule loop uses to end the song and enter the cheer gap. (A previous
    // version fell back to the last section here, which made the end branch
    // dead code: songs never finished and the crowd never applauded.)
    if (!song) return null;
    return song.sections[sectionIdx] || null;
  }

  function schedule() {
    if (!song) return;
    const now = ctx.currentTime;
    const horizon = now + 0.6;

    // External force-end (e.g. Sound._debugEndSong()).
    if (snap._forceEnd && phase !== 'cheerGap') {
      snap._forceEnd = false;
      phase = 'cheerGap';
      snap.phase = 'cheerGap';
      cheerGapEnd = now + 4.5;
      setTimeout(() => { if (genreDef.onSongEnd) genreDef.onSongEnd(); }, 200);
    }

    // In cheerGap: don't schedule notes. When the gap ends, start a new song.
    if (phase === 'cheerGap') {
      if (now >= cheerGapEnd) {
        newSong();
      }
      return;
    }

    while (nextBeatTime < horizon) {
      const t = nextBeatTime;
      const sec = currentSection();
      if (!sec) {
        // Outro finished — enter cheer gap.
        phase = 'cheerGap';
        snap.phase = 'cheerGap';
        const gapDur = 4.5;
        cheerGapEnd = t + gapDur;
        // Crowd reacts the instant the song ends: applause + cheer swell ~0.2s
        // after the last note, then the next song fades in under the tail.
        const delay = Math.max(0, (t - now + 0.2) * 1000);
        setTimeout(() => {
          if (genreDef.onSongEnd) genreDef.onSongEnd();
        }, delay);
        return;
      }

      // Tempo wobble — slight sinusoidal drift across the song.
      const beat = 60 / (song.tempo * (1 + 0.018 * Math.sin((beatInSong / 32) * 2 * Math.PI)));

      // Dynamics breath — rest probability coupled to section intensity.
      const intensity = sec.intensity;
      const baseRest = genreDef.baseRestProb || 0.12;
      const restProb = Math.max(0, Math.min(0.6, baseRest * (1.35 - intensity)));
      const gainMod = 1 + 0.25 * Math.sin((t / 28) * 2 * Math.PI);

      // Beat-in-bar (0..3)
      const beatInBar = (beatInSong - beatsBeforeSection(sectionIdx)) % 4;

      // Lead timbre drift at section boundary.
      if (beatInBar === 0 && barInSection === 0 && sectionIdx > 0 && genreDef.leadTypes && genreDef.leadTypes.length > 1) {
        if (rng() < 0.5) {
          leadType = pickNext(leadType, genreDef.leadTypes.length, rng);
        }
      }

      // Call the genre's per-beat synthesizer.
      genreDef.playBeat({
        t, beatInBar, barInSection, section: sec, intensity,
        beat, tonicHz: song.tonicHz, scale: genreDef.scale,
        rng, voices, leadType: genreDef.leadTypes ? genreDef.leadTypes[leadType] : 'default',
        dest: panner, gainMod, restProb, ctx,
      });

      // Update snap.
      snap.section = sec.name;
      snap.barInSection = barInSection;
      snap.beatInSong = beatInSong;
      snap.phase = 'playing';

      // Advance time + counters.
      nextBeatTime += beat;
      beatInSong++;
      const beatsThisBar = 4;
      const beatsIntoSection = beatInSong - beatsBeforeSection(sectionIdx);
      barInSection = Math.floor(beatsIntoSection / beatsThisBar);
      if (barInSection >= sec.bars) {
        sectionIdx++;
        barInSection = 0;
        // Re-pick lead type at section boundaries.
        if (genreDef.leadTypes && genreDef.leadTypes.length > 1 && rng() < 0.4) {
          leadType = pickNext(leadType, genreDef.leadTypes.length, rng);
        }
      }
    }
  }

  // Helper: beats before a given section index.
  function beatsBeforeSection(idx) {
    let b = 0;
    if (!song) return 0;
    for (let i = 0; i < idx && i < song.sections.length; i++) b += song.sections[i].bars * 4;
    return b;
  }

  schedule();
  const intervalId = setInterval(schedule, 180);

  return {
    panner,
    snap,
    stop() {
      clearInterval(intervalId);
      for (const fn of teardown) { try { fn(); } catch (e) {} }
      teardown = [];
      try { panner.disconnect(); } catch (e) {}
      const i = _activeStageSongs.indexOf(snap);
      if (i !== -1) _activeStageSongs.splice(i, 1);
    },
  };
}

// ---- Genre definitions ----

// Shared section builder helpers.
function makeSections(template) {
  return template.map(([name, bars, intensity]) => ({ name, bars, intensity }));
}

// JAM genre def — wraps the existing jam-band timbre/scale.
const JAM = {
  name: 'jam',
  baseHz: 174,
  tempoRange: [84, 104],
  scale: SCALE_PENT,
  leadTypes: ['triangle', 'sine'],
  baseRestProb: 0.10,
  sectionTemplate(rng) {
    return makeSections([
      ['intro',  4, 0.45],
      ['verse',  8, 0.65],
      ['chorus', 8, 0.90],
      ['verse',  8, 0.65],
      ['bridge', 4, 0.75],
      ['chorus', 8, 0.90],
      ['outro',  4, 0.40],
    ]);
  },
  makeVoices(ctx, dest, rng, tonicHz) {
    const baseFreq = tonicHz;
    const lead = ctx.createOscillator(); lead.type = 'triangle';
    const leadGain = ctx.createGain(); leadGain.gain.value = 0;
    lead.connect(leadGain).connect(dest); lead.start();

    const harm = ctx.createOscillator(); harm.type = 'sine';
    const harmGain = ctx.createGain(); harmGain.gain.value = 0;
    harm.connect(harmGain).connect(dest); harm.start();

    const bassOsc = ctx.createOscillator(); bassOsc.type = 'sawtooth';
    const bassLpf = ctx.createBiquadFilter(); bassLpf.type = 'lowpass'; bassLpf.frequency.value = 380;
    const bassGain = ctx.createGain(); bassGain.gain.value = 0;
    bassOsc.connect(bassLpf).connect(bassGain).connect(dest); bassOsc.start();

    const kick = ctx.createOscillator(); kick.type = 'sine';
    const kickGain = ctx.createGain(); kickGain.gain.value = 0;
    kick.connect(kickGain).connect(dest); kick.start();

    // Sustained chord pad for chorus/bridge — two detuned sines through a gentle lowpass.
    const padA = ctx.createOscillator(); padA.type = 'sine';
    const padB = ctx.createOscillator(); padB.type = 'sine';
    const padGain = ctx.createGain(); padGain.gain.value = 0;
    const padLpf = ctx.createBiquadFilter(); padLpf.type = 'lowpass'; padLpf.frequency.value = 900;
    padA.connect(padLpf); padB.connect(padLpf);
    padLpf.connect(padGain).connect(dest);
    padA.start(); padB.start();

    // Build melody variants (seeded, stable across a song).
    const melodies = Array.from({ length: 3 }, () =>
      new Array(16).fill(0).map(() => baseFreq * SCALE_PENT[Math.floor(rng() * SCALE_PENT.length)])
    );
    const basses = Array.from({ length: 2 }, () =>
      new Array(8).fill(0).map(() => baseFreq * 0.5 * SCALE_PENT[Math.floor(rng() * 4)])
    );
    const padNotes = SCALE_PENT.slice(0, 4).map(r => baseFreq * r * 0.75);

    const voices = { lead, leadGain, harm, harmGain, bassOsc, bassGain, kick, kickGain,
                     padA, padB, padGain, melodies, basses, padNotes };
    const teardown = [
      () => { try { lead.stop(); } catch (e) {} },
      () => { try { harm.stop(); } catch (e) {} },
      () => { try { bassOsc.stop(); } catch (e) {} },
      () => { try { kick.stop(); } catch (e) {} },
      () => { try { padA.stop(); } catch (e) {} },
      () => { try { padB.stop(); } catch (e) {} },
    ];
    return { voices, teardown };
  },
  playBeat({ t, beatInBar, barInSection, section, beat, tonicHz, rng, voices, gainMod, restProb, ctx }) {
    const { lead, leadGain, harm, harmGain, bassOsc, bassGain, kick, kickGain,
            padA, padB, padGain, melodies, basses, padNotes } = voices;
    const rotIdx = (barInSection >> 1) % melodies.length;
    const melody = melodies[rotIdx];
    const bass   = basses[rotIdx % basses.length];
    const noteIdx = (barInSection * 4 + beatInBar) % melody.length;
    const m = melody[noteIdx];
    const breath = gainMod;
    const inChorus = section.name === 'chorus' || section.name === 'bridge';

    if (rng() >= restProb) {
      lead.frequency.setValueAtTime(m, t);
      leadGain.gain.cancelScheduledValues(t);
      leadGain.gain.setValueAtTime(0.0001, t);
      leadGain.gain.exponentialRampToValueAtTime(0.24 * breath, t + 0.015);
      leadGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.85);
    }
    if (beatInBar === 0) {
      harm.frequency.setValueAtTime(m * 2, t);
      harmGain.gain.cancelScheduledValues(t);
      harmGain.gain.setValueAtTime(0.0001, t);
      harmGain.gain.exponentialRampToValueAtTime(0.08 * breath, t + 0.02);
      harmGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.7);
    }
    if (beatInBar % 2 === 0) {
      const b = bass[Math.floor(beatInBar / 2 + barInSection * 2) % bass.length];
      bassOsc.frequency.setValueAtTime(b, t);
      bassGain.gain.cancelScheduledValues(t);
      bassGain.gain.setValueAtTime(0.0001, t);
      bassGain.gain.exponentialRampToValueAtTime(0.30 * breath, t + 0.02);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.8);
    }
    kick.frequency.setValueAtTime(110, t);
    kick.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    kickGain.gain.cancelScheduledValues(t);
    kickGain.gain.setValueAtTime(0.0001, t);
    kickGain.gain.exponentialRampToValueAtTime(0.5 * breath, t + 0.005);
    kickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    // Chord pad — active in chorus + bridge sections for fullness.
    if (inChorus) {
      const pn = padNotes[beatInBar % padNotes.length];
      padA.frequency.setValueAtTime(pn * 1.003, t);
      padB.frequency.setValueAtTime(pn * 0.997, t);
      padGain.gain.cancelScheduledValues(t);
      padGain.gain.setValueAtTime(padGain.gain.value > 0.001 ? padGain.gain.value : 0.0001, t);
      padGain.gain.linearRampToValueAtTime(0.10 * breath, t + 0.08);
      padGain.gain.setTargetAtTime(0.06 * breath, t + 0.12, 0.5);
    } else {
      padGain.gain.cancelScheduledValues(t);
      padGain.gain.setTargetAtTime(0.0001, t, 0.3);
    }
  },
  onSongEnd: null,   // set per-instance by createStageMusic
};

// BRASS genre def — side-stage horn-led groove.
const BRASS = {
  name: 'brass',
  baseHz: 233,
  tempoRange: [112, 140],
  scale: SCALE_MIXO,
  leadTypes: ['horn', 'muted'],
  baseRestProb: 0.12,
  sectionTemplate(rng) {
    return makeSections([
      ['intro',  2, 0.50],
      ['verse',  8, 0.70],
      ['chorus', 8, 0.95],
      ['bridge', 4, 0.75],
      ['chorus', 8, 0.95],
      ['outro',  2, 0.45],
    ]);
  },
  makeVoices(ctx, dest, rng, tonicHz) {
    const baseFreq = tonicHz;
    const sawOsc = ctx.createOscillator(); sawOsc.type = 'sawtooth';
    const sqrOsc = ctx.createOscillator(); sqrOsc.type = 'square';
    const hornMix = ctx.createGain(); hornMix.gain.value = 0;
    const hornBpf = ctx.createBiquadFilter();
    hornBpf.type = 'bandpass'; hornBpf.frequency.value = 1400; hornBpf.Q.value = 1.6;
    sawOsc.connect(hornMix); sqrOsc.connect(hornMix);
    hornMix.connect(hornBpf).connect(dest);
    sawOsc.start(); sqrOsc.start();

    const tuba = ctx.createOscillator(); tuba.type = 'square';
    const tubaLpf = ctx.createBiquadFilter(); tubaLpf.type = 'lowpass'; tubaLpf.frequency.value = 320;
    const tubaGain = ctx.createGain(); tubaGain.gain.value = 0;
    tuba.connect(tubaLpf).connect(tubaGain).connect(dest); tuba.start();

    const melodies = Array.from({ length: 3 }, () =>
      new Array(8).fill(0).map(() => baseFreq * SCALE_MIXO[Math.floor(rng() * SCALE_MIXO.length)])
    );
    const basses = Array.from({ length: 2 }, () =>
      new Array(4).fill(0).map(() => baseFreq * 0.5 * SCALE_MIXO[Math.floor(rng() * 4)])
    );

    const voices = { sawOsc, sqrOsc, hornMix, tuba, tubaGain, melodies, basses };
    const teardown = [
      () => { try { sawOsc.stop(); } catch (e) {} },
      () => { try { sqrOsc.stop(); } catch (e) {} },
      () => { try { tuba.stop(); } catch (e) {} },
    ];
    return { voices, teardown };
  },
  playBeat({ t, beatInBar, barInSection, beat, rng, voices, gainMod, restProb }) {
    const { sawOsc, sqrOsc, hornMix, tuba, tubaGain, melodies, basses } = voices;
    const rotIdx = (barInSection >> 1) % melodies.length;
    const melody = melodies[rotIdx];
    const bass   = basses[rotIdx % basses.length];
    const m = melody[(barInSection * 4 + beatInBar) % melody.length];
    const breath = gainMod;

    if (rng() >= restProb) {
      sawOsc.frequency.setValueAtTime(m * 1.004, t);
      sqrOsc.frequency.setValueAtTime(m * 0.996, t);
      hornMix.gain.cancelScheduledValues(t);
      hornMix.gain.setValueAtTime(0.0001, t);
      hornMix.gain.exponentialRampToValueAtTime(0.20 * breath, t + 0.012);
      hornMix.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.55);
    }
    if (beatInBar % 2 === 0) {
      const b = bass[Math.floor(beatInBar / 2 + barInSection * 2) % bass.length];
      tuba.frequency.setValueAtTime(b, t);
      tubaGain.gain.cancelScheduledValues(t);
      tubaGain.gain.setValueAtTime(0.0001, t);
      tubaGain.gain.exponentialRampToValueAtTime(0.32 * breath, t + 0.025);
      tubaGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.4);
    }
  },
  onSongEnd: null,
};

// DANCE genre def — four-on-floor kick, acid bass, 16th arp pluck, supersaw stab.
const DANCE = {
  name: 'dance',
  baseHz: 220,
  tempoRange: [122, 130],
  scale: SCALE_PENT,
  leadTypes: ['square', 'sawtooth'],
  baseRestProb: 0.08,
  sectionTemplate(rng) {
    return makeSections([
      ['intro',  4, 0.45],
      ['build',  8, 0.70],
      ['drop',  16, 0.95],
      ['break',  8, 0.55],
      ['build',  8, 0.80],
      ['drop',  16, 0.95],
      ['outro',  4, 0.40],
    ]);
  },
  makeVoices(ctx, dest, rng, tonicHz) {
    // 4-on-floor kick.
    const kick = ctx.createOscillator(); kick.type = 'sine';
    const kickGain = ctx.createGain(); kickGain.gain.value = 0;
    kick.connect(kickGain).connect(dest); kick.start();

    // Closed hi-hat (short HP noise).
    const hatBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.04), ctx.sampleRate);
    const hatData = hatBuf.getChannelData(0);
    for (let i = 0; i < hatData.length; i++) hatData[i] = Math.random() * 2 - 1;
    const hatSrc = ctx.createBufferSource(); hatSrc.buffer = hatBuf; hatSrc.loop = true;
    const hatHpf = ctx.createBiquadFilter(); hatHpf.type = 'highpass'; hatHpf.frequency.value = 7000;
    const hatGain = ctx.createGain(); hatGain.gain.value = 0;
    hatSrc.connect(hatHpf).connect(hatGain).connect(dest); hatSrc.start();

    // Clap/snare on 2 and 4.
    const clapBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.06), ctx.sampleRate);
    const clapData = clapBuf.getChannelData(0);
    for (let i = 0; i < clapData.length; i++) clapData[i] = Math.random() * 2 - 1;
    const clapSrc = ctx.createBufferSource(); clapSrc.buffer = clapBuf; clapSrc.loop = true;
    const clapBpf = ctx.createBiquadFilter(); clapBpf.type = 'bandpass'; clapBpf.frequency.value = 1800; clapBpf.Q.value = 1.8;
    const clapGain = ctx.createGain(); clapGain.gain.value = 0;
    clapSrc.connect(clapBpf).connect(clapGain).connect(dest); clapSrc.start();

    // Acid bass (saw → resonant lowpass with env mod).
    const acidOsc = ctx.createOscillator(); acidOsc.type = 'sawtooth';
    const acidLpf = ctx.createBiquadFilter(); acidLpf.type = 'lowpass'; acidLpf.frequency.value = 400; acidLpf.Q.value = 8;
    const acidGain = ctx.createGain(); acidGain.gain.value = 0;
    acidOsc.connect(acidLpf).connect(acidGain).connect(dest); acidOsc.start();

    // 16th arp pluck (square).
    const arpOsc = ctx.createOscillator(); arpOsc.type = 'square';
    const arpLpf = ctx.createBiquadFilter(); arpLpf.type = 'lowpass'; arpLpf.frequency.value = 2200;
    const arpGain = ctx.createGain(); arpGain.gain.value = 0;
    arpOsc.connect(arpLpf).connect(arpGain).connect(dest); arpOsc.start();

    // Supersaw stab (two detuned saws, for drop only).
    const stabA = ctx.createOscillator(); stabA.type = 'sawtooth';
    const stabB = ctx.createOscillator(); stabB.type = 'sawtooth';
    const stabGain = ctx.createGain(); stabGain.gain.value = 0;
    const stabLpf = ctx.createBiquadFilter(); stabLpf.type = 'lowpass'; stabLpf.frequency.value = 3000;
    stabA.connect(stabGain); stabB.connect(stabGain);
    stabGain.connect(stabLpf).connect(dest);
    stabA.start(); stabB.start();

    // Build noise riser — white noise through rising HP filter.
    const riserBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.5), ctx.sampleRate);
    const riserData = riserBuf.getChannelData(0);
    for (let i = 0; i < riserData.length; i++) riserData[i] = Math.random() * 2 - 1;
    const riserSrc = ctx.createBufferSource(); riserSrc.buffer = riserBuf; riserSrc.loop = true;
    const riserHpf = ctx.createBiquadFilter(); riserHpf.type = 'highpass'; riserHpf.frequency.value = 8000;
    const riserGain = ctx.createGain(); riserGain.gain.value = 0;
    riserSrc.connect(riserHpf).connect(riserGain).connect(dest); riserSrc.start();

    // Build bass note grid for the acid line.
    const bassNotes = new Array(8).fill(0).map(() =>
      tonicHz * 0.5 * SCALE_PENT[Math.floor(rng() * 4)]
    );
    const arpNotes = SCALE_PENT.map(r => tonicHz * r);

    const voices = { kick, kickGain, hatGain, clapGain, acidOsc, acidLpf, acidGain,
                     arpOsc, arpGain, arpNotes, stabA, stabB, stabGain, stabLpf,
                     riserHpf, riserGain, bassNotes };
    const teardown = [
      () => { try { kick.stop(); } catch (e) {} },
      () => { try { hatSrc.stop(); } catch (e) {} },
      () => { try { clapSrc.stop(); } catch (e) {} },
      () => { try { acidOsc.stop(); } catch (e) {} },
      () => { try { arpOsc.stop(); } catch (e) {} },
      () => { try { stabA.stop(); stabB.stop(); } catch (e) {} },
      () => { try { riserSrc.stop(); } catch (e) {} },
    ];
    return { voices, teardown };
  },
  playBeat({ t, beatInBar, barInSection, section, beat, tonicHz, rng, voices, gainMod, restProb, ctx }) {
    const { kick, kickGain, hatGain, clapGain, acidOsc, acidLpf, acidGain,
            arpOsc, arpGain, arpNotes, stabA, stabB, stabGain, stabLpf,
            riserHpf, riserGain, bassNotes } = voices;
    const isDrop = section.name === 'drop';
    const isBuild = section.name === 'build';
    const isBreak = section.name === 'break';
    const inDrop = isDrop || isBuild;
    const breath = gainMod;
    const tick = beat / 4;  // 16th note

    // 4-on-floor kick (every beat).
    if (!isBreak) {
      kick.frequency.setValueAtTime(140, t);
      kick.frequency.exponentialRampToValueAtTime(42, t + 0.10);
      kickGain.gain.cancelScheduledValues(t);
      kickGain.gain.setValueAtTime(0.0001, t);
      kickGain.gain.exponentialRampToValueAtTime(0.55 * breath, t + 0.005);
      kickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
    }
    // Closed hi-hat off-beats (8th note grid = every 2 sixteenths → every half beat).
    if (inDrop && beatInBar % 1 === 0) {
      hatGain.gain.cancelScheduledValues(t + tick);
      hatGain.gain.setValueAtTime(0.0001, t + tick);
      hatGain.gain.exponentialRampToValueAtTime(0.10 * breath, t + tick + 0.003);
      hatGain.gain.exponentialRampToValueAtTime(0.0001, t + tick + 0.025);
    }
    // Clap on 2 and 4.
    if (beatInBar === 1 || beatInBar === 3) {
      clapGain.gain.cancelScheduledValues(t);
      clapGain.gain.setValueAtTime(0.0001, t);
      clapGain.gain.exponentialRampToValueAtTime(0.28 * breath, t + 0.004);
      clapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    }
    // Acid bass.
    if (!isBreak || rng() < 0.25) {
      const bn = bassNotes[(barInSection * 4 + beatInBar) % bassNotes.length];
      acidOsc.frequency.setValueAtTime(bn, t);
      // Envelope mod on the filter cutoff for the acid squelch.
      acidLpf.frequency.cancelScheduledValues(t);
      acidLpf.frequency.setValueAtTime(200, t);
      acidLpf.frequency.exponentialRampToValueAtTime(isDrop ? 2400 : 800, t + beat * 0.3);
      acidLpf.frequency.exponentialRampToValueAtTime(300, t + beat * 0.9);
      acidGain.gain.cancelScheduledValues(t);
      acidGain.gain.setValueAtTime(0.0001, t);
      acidGain.gain.exponentialRampToValueAtTime((isBreak ? 0.12 : 0.22) * breath, t + 0.01);
      acidGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.9);
    }
    // 16th arp pluck in drop.
    if (isDrop && rng() >= restProb * 0.5) {
      const an = arpNotes[(barInSection * 16 + beatInBar * 4) % arpNotes.length];
      arpOsc.frequency.setValueAtTime(an * 2, t);
      arpGain.gain.cancelScheduledValues(t);
      arpGain.gain.setValueAtTime(0.0001, t);
      arpGain.gain.exponentialRampToValueAtTime(0.13 * breath, t + 0.004);
      arpGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.3);
    }
    // Supersaw stab — on every 2 beats in the drop.
    if (isDrop && beatInBar === 0) {
      const sn = tonicHz * SCALE_PENT[barInSection % SCALE_PENT.length];
      stabA.frequency.setValueAtTime(sn * 1.012, t);
      stabB.frequency.setValueAtTime(sn * 0.988, t);
      stabGain.gain.cancelScheduledValues(t);
      stabGain.gain.setValueAtTime(0.0001, t);
      stabGain.gain.exponentialRampToValueAtTime(0.16 * breath, t + 0.01);
      stabGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.8);
      stabLpf.frequency.setValueAtTime(3000, t);
      stabLpf.frequency.exponentialRampToValueAtTime(800, t + beat * 1.5);
    }
    // Noise riser in build sections.
    if (isBuild) {
      const riseProgress = barInSection / 8;
      riserHpf.frequency.setValueAtTime(Math.max(200, 8000 * (1 - riseProgress)), t);
      riserGain.gain.cancelScheduledValues(t);
      riserGain.gain.setTargetAtTime(0.05 * riseProgress * breath, t, 0.1);
    } else {
      riserGain.gain.setTargetAtTime(0.0001, t, 0.05);
    }
  },
  onSongEnd: null,
};

// WORLD genre def — polyrhythmic clave/conga/marimba groove.
const WORLD = {
  name: 'world',
  baseHz: 293.66,  // D4
  tempoRange: [96, 116],
  scale: SCALE_PENT,
  leadTypes: ['triangle', 'sine'],
  baseRestProb: 0.15,
  sectionTemplate(rng) {
    return makeSections([
      ['intro',  4, 0.45],
      ['verse',  8, 0.65],
      ['chorus', 8, 0.85],
      ['break',  4, 0.50],
      ['verse',  8, 0.70],
      ['chorus', 8, 0.85],
      ['outro',  4, 0.40],
    ]);
  },
  makeVoices(ctx, dest, rng, tonicHz) {
    // Son-clave woodblock (triangle oscillator, very short).
    const claveOsc = ctx.createOscillator(); claveOsc.type = 'triangle';
    const claveGain = ctx.createGain(); claveGain.gain.value = 0;
    claveOsc.connect(claveGain).connect(dest); claveOsc.start();

    // Conga/djembe — sine sweep + HP noise.
    const congaOsc = ctx.createOscillator(); congaOsc.type = 'sine';
    const congaGain = ctx.createGain(); congaGain.gain.value = 0;
    congaOsc.connect(congaGain).connect(dest); congaOsc.start();

    // Agogô bell — two-pitch triangle.
    const agogo1 = ctx.createOscillator(); agogo1.type = 'triangle'; agogo1.frequency.value = 880;
    const agogo2 = ctx.createOscillator(); agogo2.type = 'triangle'; agogo2.frequency.value = 1100;
    const agogoGain = ctx.createGain(); agogoGain.gain.value = 0;
    agogo1.connect(agogoGain); agogo2.connect(agogoGain);
    agogoGain.connect(dest); agogo1.start(); agogo2.start();

    // Marimba/kalimba — triangle oscillator, pentatonic ostinato.
    const marimbaOsc = ctx.createOscillator(); marimbaOsc.type = 'triangle';
    const marimbaGain = ctx.createGain(); marimbaGain.gain.value = 0;
    marimbaOsc.connect(marimbaGain).connect(dest); marimbaOsc.start();

    // Walking bass — sawtooth through lowpass.
    const bassOsc = ctx.createOscillator(); bassOsc.type = 'sawtooth';
    const bassLpf = ctx.createBiquadFilter(); bassLpf.type = 'lowpass'; bassLpf.frequency.value = 350;
    const bassGain = ctx.createGain(); bassGain.gain.value = 0;
    bassOsc.connect(bassLpf).connect(bassGain).connect(dest); bassOsc.start();

    // Euclidean patterns for the clave (son clave: 3-2).
    const clavePattern = E(5, 12, 0);
    const shakerPattern = E(8, 12);
    const marimbaPattern = SCALE_PENT.map(r => tonicHz * r);
    const bassNotes = [tonicHz * 0.5, tonicHz * 0.5 * (4 / 3), tonicHz * 0.5 * (3 / 2), tonicHz * 0.5 * (2)];

    const voices = { claveOsc, claveGain, congaOsc, congaGain, agogo1, agogo2, agogoGain,
                     marimbaOsc, marimbaGain, bassOsc, bassGain, bassLpf,
                     clavePattern, shakerPattern, marimbaPattern, bassNotes };
    const teardown = [
      () => { try { claveOsc.stop(); } catch (e) {} },
      () => { try { congaOsc.stop(); } catch (e) {} },
      () => { try { agogo1.stop(); agogo2.stop(); } catch (e) {} },
      () => { try { marimbaOsc.stop(); } catch (e) {} },
      () => { try { bassOsc.stop(); } catch (e) {} },
    ];
    return { voices, teardown };
  },
  playBeat({ t, beatInBar, barInSection, section, beat, tonicHz, rng, voices, gainMod, restProb, ctx }) {
    const { claveOsc, claveGain, congaOsc, congaGain, agogoGain,
            marimbaOsc, marimbaGain, bassOsc, bassGain, bassLpf,
            clavePattern, marimbaPattern, bassNotes } = voices;
    const tick = beat / 3;   // 12-tick Euclidean grid uses triplet subdivision
    const ti = (barInSection * 12 + beatInBar * 3) % 12;
    const breath = gainMod;
    const intensity = section.intensity;

    // Clave (woodblock feel on the Euclidean pattern).
    if (clavePattern[ti]) {
      claveOsc.frequency.setValueAtTime(1200 + (rng() * 200), t);
      claveGain.gain.cancelScheduledValues(t);
      claveGain.gain.setValueAtTime(0.0001, t);
      claveGain.gain.exponentialRampToValueAtTime(0.18 * breath, t + 0.002);
      claveGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    }
    // Conga on beats 1 and 3 (tick 0 and 6).
    if (ti === 0 || ti === 6) {
      congaOsc.frequency.setValueAtTime(ti === 0 ? 230 : 180, t);
      congaOsc.frequency.exponentialRampToValueAtTime(ti === 0 ? 140 : 110, t + 0.08);
      congaGain.gain.cancelScheduledValues(t);
      congaGain.gain.setValueAtTime(0.0001, t);
      congaGain.gain.exponentialRampToValueAtTime(0.30 * breath, t + 0.005);
      congaGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    }
    // Agogô bell on accented ticks in verse/chorus.
    if (intensity > 0.6 && (ti === 2 || ti === 9) && rng() >= restProb) {
      const isHigh = ti === 2;
      agogoGain.gain.cancelScheduledValues(t);
      agogoGain.gain.setValueAtTime(0.0001, t);
      agogoGain.gain.exponentialRampToValueAtTime(0.12 * breath, t + 0.002);
      agogoGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
    }
    // Marimba/kalimba ostinato — denser in chorus.
    if (intensity > 0.5 && rng() >= restProb) {
      const mn = marimbaPattern[(barInSection * 4 + beatInBar) % marimbaPattern.length];
      marimbaOsc.frequency.setValueAtTime(mn * 2, t);
      marimbaGain.gain.cancelScheduledValues(t);
      marimbaGain.gain.setValueAtTime(0.0001, t);
      marimbaGain.gain.exponentialRampToValueAtTime(0.16 * breath, t + 0.004);
      marimbaGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    }
    // Walking bass — every beat.
    const bn = bassNotes[(barInSection * 4 + beatInBar) % bassNotes.length];
    bassOsc.frequency.setValueAtTime(bn, t);
    bassGain.gain.cancelScheduledValues(t);
    bassGain.gain.setValueAtTime(0.0001, t);
    bassGain.gain.exponentialRampToValueAtTime(0.25 * breath, t + 0.015);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.8);
  },
  onSongEnd: null,
};

// DUB genre def — off-beat skank, deep sub-bass, echo effects, sparse melodica.
const DUB = {
  name: 'dub',
  baseHz: 116.54,  // Bb2 — deep and rootsy
  tempoRange: [68, 84],
  scale: SCALE_MINOR,
  leadTypes: ['square', 'sawtooth'],
  baseRestProb: 0.18,
  sectionTemplate(rng) {
    return makeSections([
      ['intro',  4, 0.40],
      ['verse',  8, 0.65],
      ['chorus', 8, 0.80],
      ['break',  4, 0.35],   // iconic dub break — bass + echo only
      ['verse',  8, 0.65],
      ['chorus', 8, 0.80],
      ['outro',  4, 0.35],
    ]);
  },
  makeVoices(ctx, dest, rng, tonicHz) {
    // Off-beat skank chord stabs — square/saw through lowpass + feedback delay for echo.
    const skankOsc = ctx.createOscillator(); skankOsc.type = 'sawtooth';
    const skankLpf = ctx.createBiquadFilter(); skankLpf.type = 'lowpass'; skankLpf.frequency.value = 1400;
    const skankGain = ctx.createGain(); skankGain.gain.value = 0;
    const skankDelay = ctx.createDelay(1.0); skankDelay.delayTime.value = 0.32;
    const skankFeedback = ctx.createGain(); skankFeedback.gain.value = 0.45;
    skankOsc.connect(skankLpf).connect(skankGain).connect(dest);
    skankGain.connect(skankDelay).connect(skankFeedback).connect(skankDelay);
    skankDelay.connect(dest);
    skankOsc.start();

    // Deep sine sub-bass.
    const subOsc = ctx.createOscillator(); subOsc.type = 'sine';
    const subGain = ctx.createGain(); subGain.gain.value = 0;
    subOsc.connect(subGain).connect(dest); subOsc.start();

    // Cross-stick rim — short noise burst.
    const rimBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
    const rimData = rimBuf.getChannelData(0);
    for (let i = 0; i < rimData.length; i++) rimData[i] = Math.random() * 2 - 1;
    const rimSrc = ctx.createBufferSource(); rimSrc.buffer = rimBuf; rimSrc.loop = true;
    const rimBpf = ctx.createBiquadFilter(); rimBpf.type = 'bandpass'; rimBpf.frequency.value = 2400; rimBpf.Q.value = 2;
    const rimGain = ctx.createGain(); rimGain.gain.value = 0;
    rimSrc.connect(rimBpf).connect(rimGain).connect(dest); rimSrc.start();

    // Sparse melodica lead — square through bandpass.
    const melodicaOsc = ctx.createOscillator(); melodicaOsc.type = 'square';
    const melodicaBpf = ctx.createBiquadFilter(); melodicaBpf.type = 'bandpass'; melodicaBpf.frequency.value = 800; melodicaBpf.Q.value = 1.4;
    const melodicaGain = ctx.createGain(); melodicaGain.gain.value = 0;
    melodicaOsc.connect(melodicaBpf).connect(melodicaGain).connect(dest); melodicaOsc.start();

    const bassNotes = SCALE_MINOR.slice(0, 4).map(r => tonicHz * r * 0.5);
    const skankNotes = SCALE_MINOR.map(r => tonicHz * r);
    const melodicaNotes = SCALE_MINOR.map(r => tonicHz * r * 2);

    const voices = { skankOsc, skankLpf, skankGain, subOsc, subGain,
                     rimGain, melodicaOsc, melodicaGain,
                     bassNotes, skankNotes, melodicaNotes };
    const teardown = [
      () => { try { skankOsc.stop(); } catch (e) {} },
      () => { try { subOsc.stop(); } catch (e) {} },
      () => { try { rimSrc.stop(); } catch (e) {} },
      () => { try { melodicaOsc.stop(); } catch (e) {} },
    ];
    return { voices, teardown };
  },
  playBeat({ t, beatInBar, barInSection, section, beat, tonicHz, rng, voices, gainMod, restProb, ctx }) {
    const { skankOsc, skankGain, subOsc, subGain, rimGain,
            melodicaOsc, melodicaGain, bassNotes, skankNotes, melodicaNotes } = voices;
    const breath = gainMod;
    const isBreak = section.name === 'break';
    const inChorus = section.name === 'chorus';

    // Off-beat skank — plays on the "&" of each beat (half-beat offset).
    // In a break section, the skank drops out (just bass + echo).
    if (!isBreak && beatInBar % 1 === 0) {
      const sn = skankNotes[(barInSection * 4 + beatInBar) % skankNotes.length];
      skankOsc.frequency.setValueAtTime(sn, t + beat * 0.5);
      skankGain.gain.cancelScheduledValues(t + beat * 0.5);
      skankGain.gain.setValueAtTime(0.0001, t + beat * 0.5);
      skankGain.gain.exponentialRampToValueAtTime(0.14 * breath, t + beat * 0.5 + 0.01);
      skankGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.5 + 0.14);
    }
    // Deep sub-bass — plays every beat or half-beat in chorus.
    const bn = bassNotes[(barInSection * 4 + beatInBar) % bassNotes.length];
    subOsc.frequency.setValueAtTime(bn, t);
    subGain.gain.cancelScheduledValues(t);
    subGain.gain.setValueAtTime(0.0001, t);
    subGain.gain.exponentialRampToValueAtTime(0.40 * breath, t + 0.015);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * (isBreak ? 1.8 : 0.9));
    // Cross-stick rim on beat 3 (and 2 in chorus).
    if (beatInBar === 2 || (inChorus && beatInBar === 1)) {
      rimGain.gain.cancelScheduledValues(t);
      rimGain.gain.setValueAtTime(0.0001, t);
      rimGain.gain.exponentialRampToValueAtTime(0.18 * breath, t + 0.003);
      rimGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    }
    // Melodica lead — sparse, only in verse/chorus.
    if (!isBreak && rng() >= (restProb + 0.15) && (beatInBar === 0 || beatInBar === 2)) {
      const mn = melodicaNotes[(barInSection * 2 + Math.floor(beatInBar / 2)) % melodicaNotes.length];
      melodicaOsc.frequency.setValueAtTime(mn, t);
      melodicaGain.gain.cancelScheduledValues(t);
      melodicaGain.gain.setValueAtTime(0.0001, t);
      melodicaGain.gain.exponentialRampToValueAtTime(0.12 * breath, t + 0.012);
      melodicaGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.2);
    }
  },
  onSongEnd: null,
};

// ----- SECOND-LINE BRASS BAND ----------------------------------------------
// Marching New Orleans groove that follows the band around the world. Built
// from a tuba walking bass + a snare-driven second-line pattern + two horn
// voices doing simple call-and-response phrases in mixolydian. The schedule
// runs on 16th-note ticks so the snare can land its trademark off-beat
// rolls between the kicks.
function secondLineStage(ctx, panner, seed) {
  const rng = mulberry32(seed >>> 0);
  const baseFreq = 220 * Math.pow(2, Math.floor(rng() * 7 - 3) / 12);   // A3 ± ~quarter octave
  const tempo = 102 + Math.floor(rng() * 14);
  const beat = 60 / tempo;
  const tick = beat / 4;          // 16th-note grid

  // ---- Voices ----
  // Two brass voices: a lead horn (trumpet) + a counter horn (trombone).
  const leadOsc = ctx.createOscillator(); leadOsc.type = 'sawtooth';
  const leadSqr = ctx.createOscillator(); leadSqr.type = 'square';
  const leadMix = ctx.createGain(); leadMix.gain.value = 0;
  const leadBpf = ctx.createBiquadFilter();
  leadBpf.type = 'bandpass'; leadBpf.frequency.value = 1500; leadBpf.Q.value = 1.5;
  leadOsc.connect(leadMix); leadSqr.connect(leadMix);
  leadMix.connect(leadBpf).connect(panner);
  leadOsc.start(); leadSqr.start();

  const counterOsc = ctx.createOscillator(); counterOsc.type = 'sawtooth';
  const counterMix = ctx.createGain(); counterMix.gain.value = 0;
  const counterBpf = ctx.createBiquadFilter();
  counterBpf.type = 'bandpass'; counterBpf.frequency.value = 900; counterBpf.Q.value = 1.2;
  counterOsc.connect(counterMix).connect(counterBpf).connect(panner);
  counterOsc.start();

  // Tuba walking bass — square through low-pass.
  const tubaOsc = ctx.createOscillator(); tubaOsc.type = 'square';
  const tubaLpf = ctx.createBiquadFilter();
  tubaLpf.type = 'lowpass'; tubaLpf.frequency.value = 280;
  const tubaGain = ctx.createGain(); tubaGain.gain.value = 0;
  tubaOsc.connect(tubaLpf).connect(tubaGain).connect(panner);
  tubaOsc.start();

  // Kick drum — short sine sweep.
  const kickOsc = ctx.createOscillator(); kickOsc.type = 'sine';
  const kickGain = ctx.createGain(); kickGain.gain.value = 0;
  kickOsc.connect(kickGain).connect(panner);
  kickOsc.start();

  // Snare — short noise burst through a band-pass with envelope. To keep
  // GC churn down, we build one looping noise buffer and gate it with a
  // gain node each hit.
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const nch = noiseBuf.getChannelData(0);
  for (let i = 0; i < nch.length; i++) nch[i] = Math.random() * 2 - 1;
  const snareSrc = ctx.createBufferSource();
  snareSrc.buffer = noiseBuf;
  snareSrc.loop = true;
  const snareBpf = ctx.createBiquadFilter();
  snareBpf.type = 'bandpass'; snareBpf.frequency.value = 1800; snareBpf.Q.value = 1.6;
  const snareGain = ctx.createGain(); snareGain.gain.value = 0;
  snareSrc.connect(snareBpf).connect(snareGain).connect(panner);
  snareSrc.start();

  // ---- Patterns ----
  // 16 ticks per bar (4 beats × 4 sixteenths). Numbers are tick positions.
  const KICK_TICKS = [0, 8];                              // kick on 1 and 3
  const SNARE_TICKS = [
    { tick: 4,  vol: 0.30 },   // backbeat 2
    { tick: 6,  vol: 0.10 },   // ghost
    { tick: 7,  vol: 0.20 },   // pickup to 3
    { tick: 12, vol: 0.30 },   // backbeat 4
    { tick: 13, vol: 0.12 },   // grace
    { tick: 14, vol: 0.18 },   // roll
    { tick: 15, vol: 0.22 },   // pickup to 1
  ];
  const SCALE = SCALE_MIXO;

  // Variation pass: 3 tuba walks, 3 lead riffs, 3 counter-horn variants.
  // Rotate every 32 ticks (= 2 bars) so each variant gets two cycles before
  // it swaps out. Lead horn drops 18% of phrases (a brass player breathes
  // when there's nothing to say). Slow ±20% gain breath over 20s.
  const TUBA_VARIANTS = [
    [1.0, 1.0, 1.5, 1.5, 16/9, 16/9, 4/3, 4/3],   // I → V → bVII → IV
    [1.0, 1.0, 4/3, 4/3, 3/2,  3/2,  1.0,  1.0],   // I → IV → V → I
    [1.0, 5/4, 3/2, 5/4, 1.0,  4/3,  3/2,  4/3],   // walking arpeggio
  ];
  const LEAD_VARIANTS = [
    [4, -1, 5, 4, -1, 2, -1, 1,  4,  5, 6, 5, 4, 2, 1, -1],
    [6, -1, 5, -1, 4, -1, 5,  4,  2,  1, -1, 2, 4, -1, 5, -1],
    [1, 2, 4, 5, -1, 6, 5, 4,  -1, 5, 4, 2, 1, -1, -1, -1],
  ];
  const COUNTER_VARIANTS = [
    [-1, -1, 1, -1, -1, 2, -1, -1, -1, -1, 4, -1, 2,  1, -1, -1],
    [-1, -1, -1, 4, -1, -1, 2, -1, -1, -1, -1, 5, -1, -1, 4, -1],
    [-1,  1, -1, -1, 4, -1, -1, 2, -1,  1, -1, -1, 5, -1, -1, 4],
  ];

  const TICKS_PER_ROTATION = 32;
  const REST_PROB_LEAD = 0.08;
  const LFO_PERIOD_S = 20;
  const LFO_DEPTH = 0.20;

  let nextTick = ctx.currentTime + 0.15;
  let tickIdx = 0;
  function schedule() {
    const horizon = ctx.currentTime + 0.6;
    while (nextTick < horizon) {
      const t = nextTick;
      const bt = tickIdx % 16;
      const rot = Math.floor(tickIdx / TICKS_PER_ROTATION);
      const TUBA_RATIOS = TUBA_VARIANTS[rot % TUBA_VARIANTS.length];
      const LEAD = LEAD_VARIANTS[rot % LEAD_VARIANTS.length];
      const COUNTER = COUNTER_VARIANTS[rot % COUNTER_VARIANTS.length];
      const breath = 1 + LFO_DEPTH * Math.sin((t / LFO_PERIOD_S) * 2 * Math.PI);

      // Kick
      if (KICK_TICKS.includes(bt)) {
        kickOsc.frequency.setValueAtTime(105, t);
        kickOsc.frequency.exponentialRampToValueAtTime(45, t + 0.10);
        kickGain.gain.cancelScheduledValues(t);
        kickGain.gain.setValueAtTime(0.0001, t);
        kickGain.gain.exponentialRampToValueAtTime(0.42 * breath, t + 0.005);
        kickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
      }
      // Snare
      for (const s of SNARE_TICKS) {
        if (s.tick === bt) {
          snareGain.gain.cancelScheduledValues(t);
          snareGain.gain.setValueAtTime(0.0001, t);
          snareGain.gain.exponentialRampToValueAtTime(s.vol * breath, t + 0.002);
          snareGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        }
      }
      // Tuba on every other tick (8th notes)
      if (bt % 2 === 0) {
        const ratio = TUBA_RATIOS[(bt / 2) % TUBA_RATIOS.length];
        tubaOsc.frequency.setValueAtTime(baseFreq * 0.5 * ratio, t);
        tubaGain.gain.cancelScheduledValues(t);
        tubaGain.gain.setValueAtTime(0.0001, t);
        tubaGain.gain.exponentialRampToValueAtTime(0.30 * breath, t + 0.02);
        tubaGain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.55);
      }
      // Lead horn riff
      const leadIdx = LEAD[bt];
      if (leadIdx >= 0 && Math.random() >= REST_PROB_LEAD) {
        const f = baseFreq * SCALE[leadIdx % SCALE.length];
        leadOsc.frequency.setValueAtTime(f * 1.004, t);
        leadSqr.frequency.setValueAtTime(f * 0.996, t);
        leadMix.gain.cancelScheduledValues(t);
        leadMix.gain.setValueAtTime(0.0001, t);
        leadMix.gain.exponentialRampToValueAtTime(0.18 * breath, t + 0.015);
        leadMix.gain.exponentialRampToValueAtTime(0.0001, t + tick * 2.6);
      }
      // Counter horn (lower)
      const counterIdx = COUNTER[bt];
      if (counterIdx >= 0) {
        const f = baseFreq * 0.5 * SCALE[counterIdx % SCALE.length];
        counterOsc.frequency.setValueAtTime(f, t);
        counterMix.gain.cancelScheduledValues(t);
        counterMix.gain.setValueAtTime(0.0001, t);
        counterMix.gain.exponentialRampToValueAtTime(0.14 * breath, t + 0.02);
        counterMix.gain.exponentialRampToValueAtTime(0.0001, t + tick * 3);
      }

      nextTick += tick;
      tickIdx++;
    }
  }
  schedule();
  const intervalId = setInterval(schedule, 160);
  return {
    panner,
    stop() {
      clearInterval(intervalId);
      try { leadOsc.stop(); } catch (e) {}
      try { leadSqr.stop(); } catch (e) {}
      try { counterOsc.stop(); } catch (e) {}
      try { tubaOsc.stop(); } catch (e) {}
      try { kickOsc.stop(); } catch (e) {}
      try { snareSrc.stop(); } catch (e) {}
      try { panner.disconnect(); } catch (e) {}
    },
  };
}

// ----- DRUM CIRCLE (polyrhythmic drums, no melody) -------------------------
// Two toms in a 3:4 cross-rhythm, plus a heartbeat-like kick. The seed picks
// tempo + which tom plays the 3-pattern vs the 4-pattern.
//
// Variation pass: rotate through 3 tom-pattern pairs every 4 measures, add
// 12% miss chance per tom hit (drummers fluff strokes), and a slow ±20%
// gain breath over 26s. Kick stays metronomic — it's the heartbeat.
function drumStage(ctx, panner, seed) {
  const rng = mulberry32(seed >>> 0);
  const tempo = 70 + Math.floor(rng() * 22);
  const beat = 60 / tempo;
  // Tick = 1/12th of a measure (LCM of 3 and 4).
  const tick = beat / 3;
  const tom1Freq = 150 + Math.floor(rng() * 40);   // higher tom
  const tom2Freq = 88 + Math.floor(rng() * 22);    // lower tom

  // 12-tick patterns. true = hit. Pattern A is the original 3:4 cross-rhythm.
  // B and C are gentle reshuffles so each rotation still grooves but the
  // accents land differently.
  const TOM1_PATTERNS = [
    [true, false, false, false, true, false, false, false, true, false, false, false],
    [true, false, false, true, false, false, true, false, false, false, true, false],
    [false, false, true, false, true, false, false, true, false, true, false, false],
  ];
  const TOM2_PATTERNS = [
    [true, false, false, true, false, false, true, false, false, true, false, false],
    [true, false, true, false, false, true, false, true, false, false, true, false],
    [true, true, false, false, true, false, true, false, true, false, false, true],
  ];
  const TICKS_PER_ROTATION = 48;          // 4 measures
  const MISS_PROB = 0.06;
  const LFO_PERIOD_S = 26;
  const LFO_DEPTH = 0.20;

  // Drums are pitch-swept sine oscillators that we re-pluck per hit.
  const kick = ctx.createOscillator(); kick.type = 'sine';
  const kickGain = ctx.createGain(); kickGain.gain.value = 0;
  kick.connect(kickGain).connect(panner); kick.start();

  const tom1 = ctx.createOscillator(); tom1.type = 'sine';
  const tom1Gain = ctx.createGain(); tom1Gain.gain.value = 0;
  tom1.connect(tom1Gain).connect(panner); tom1.start();

  const tom2 = ctx.createOscillator(); tom2.type = 'sine';
  const tom2Gain = ctx.createGain(); tom2Gain.gain.value = 0;
  tom2.connect(tom2Gain).connect(panner); tom2.start();

  let nextTick = ctx.currentTime + 0.15;
  let tickIdx = 0;
  function schedule() {
    const horizon = ctx.currentTime + 0.6;
    while (nextTick < horizon) {
      const t = nextTick;
      const measureTick = tickIdx % 12;
      const rot = Math.floor(tickIdx / TICKS_PER_ROTATION);
      const tom1Pat = TOM1_PATTERNS[rot % TOM1_PATTERNS.length];
      const tom2Pat = TOM2_PATTERNS[rot % TOM2_PATTERNS.length];
      const breath = 1 + LFO_DEPTH * Math.sin((t / LFO_PERIOD_S) * 2 * Math.PI);

      // Kick: 1 and 7 (every half measure). No miss — kick is the heartbeat.
      if (measureTick === 0 || measureTick === 6) {
        kick.frequency.setValueAtTime(95, t);
        kick.frequency.exponentialRampToValueAtTime(45, t + 0.10);
        kickGain.gain.cancelScheduledValues(t);
        kickGain.gain.setValueAtTime(0.0001, t);
        kickGain.gain.exponentialRampToValueAtTime(0.48 * breath, t + 0.005);
        kickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
      }
      if (tom1Pat[measureTick] && Math.random() >= MISS_PROB) {
        tom1.frequency.setValueAtTime(tom1Freq * 1.2, t);
        tom1.frequency.exponentialRampToValueAtTime(tom1Freq, t + 0.06);
        tom1Gain.gain.cancelScheduledValues(t);
        tom1Gain.gain.setValueAtTime(0.0001, t);
        tom1Gain.gain.exponentialRampToValueAtTime(0.34 * breath, t + 0.005);
        tom1Gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      }
      if (tom2Pat[measureTick] && Math.random() >= MISS_PROB) {
        tom2.frequency.setValueAtTime(tom2Freq * 1.2, t);
        tom2.frequency.exponentialRampToValueAtTime(tom2Freq, t + 0.07);
        tom2Gain.gain.cancelScheduledValues(t);
        tom2Gain.gain.setValueAtTime(0.0001, t);
        tom2Gain.gain.exponentialRampToValueAtTime(0.30 * breath, t + 0.005);
        tom2Gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      }
      nextTick += tick;
      tickIdx++;
    }
  }
  schedule();
  const intervalId = setInterval(schedule, 180);
  return {
    panner,
    stop() {
      clearInterval(intervalId);
      try { kick.stop(); } catch (e) {}
      try { tom1.stop(); } catch (e) {}
      try { tom2.stop(); } catch (e) {}
      try { panner.disconnect(); } catch (e) {}
    },
  };
}

// ----- FOREST DRUM CIRCLE (rich Euclidean polyrhythm) ----------------------
//
// Phase 4 — the LEAF-true engine. Built on coprime Euclidean rhythms over
// the same 12-tick LCM that drumStage uses, but with:
//
//   * 7 voices instead of 3: kick + 2 toms + djembe slap + djembe tone +
//     bell + shaker. Each is a different Euclidean pattern, shifted by
//     coprime offsets so the combined groove never lines up the same way
//     across measures.
//   * Voice gating by nightness — kick/toms are always on, the brighter
//     voices fade in as the sun goes down. At full night all 7 are firing.
//   * Probabilistic misses + ghost-note velocity variance + ±5ms timing
//     jitter — what the reviewer pushed back on the original spec for. The
//     human-feel comes from those three together, not from any one of them.
//   * A crackling-fire pink-noise bed gated on nightness > 0.3, panned with
//     the drum mix so it only hisses up close.
//
// Per-circle CPU cost: ~8 oscillators always running + a few transient
// BufferSource allocs per hit. With 3 visible drum circles that's ~24
// oscillators total — well under what Web Audio can chew through.
function forestDrumStage(ctx, panner, seed) {
  const rng = mulberry32(seed >>> 0);
  const tempo = 72 + Math.floor(rng() * 16);     // 72-88 bpm
  const beat = 60 / tempo;
  const measureDur = beat * 4;                   // 4 beats per measure
  const tickDur = measureDur / 12;

  // Lowpass filter — sits between every voice and the spatial panner so the
  // engine can muffle the highs when the player is outside the forest body.
  // Cutoff starts wide open; main.js drives it down via setLowpassCutoff as
  // the player drives away from the fire (reviewer's "woods absorb the
  // sound" idea). Q stays low so we don't ring on the resonance.
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 14000;
  lowpass.Q.value = 0.5;
  lowpass.connect(panner);
  // All internal voice connections point here so they're filtered before
  // reaching the panner. Trigger functions still reference `panner` for
  // their parameter names (kept to minimise diff churn) but pass `dest`.
  const dest = lowpass;

  // Euclidean rhythm: distribute `hits` evenly across `steps` ticks. Returns
  // a length-`steps` boolean array. Optional `shift` rotates the pattern.
  function E(hits, steps, shift = 0) {
    const pattern = new Array(steps).fill(false);
    for (let i = 0; i < hits; i++) pattern[Math.floor((i * steps) / hits)] = true;
    if (!shift) return pattern;
    const out = new Array(steps);
    for (let i = 0; i < steps; i++) out[i] = pattern[((i - shift) % steps + steps) % steps];
    return out;
  }

  // Voice definitions. Order matters — we trigger in this order so kick
  // attacks fire ahead of higher voices when they share a tick.
  //   pattern    : 12-tick rhythm
  //   kind       : timbre generator
  //   baseGain   : peak gain at velocity 1.0
  //   miss       : 0..1 chance to skip any scheduled hit
  //   ghost      : 0..1 chance a hit becomes a ghost note (velocity ≈0.18)
  //   threshold  : nightness below which the voice is silent
  const voices = [
    { name: 'kick', pattern: E(2, 12),    kind: 'kick', baseGain: 0.50, miss: 0,    ghost: 0,    threshold: 0    },
    { name: 'tom1', pattern: E(3, 12),    kind: 'tom1', baseGain: 0.36, miss: 0,    ghost: 0,    threshold: 0    },
    { name: 'tom2', pattern: E(4, 12),    kind: 'tom2', baseGain: 0.30, miss: 0,    ghost: 0,    threshold: 0    },
    { name: 'slap', pattern: E(5, 12, 1), kind: 'slap', baseGain: 0.30, miss: 0.10, ghost: 0.15, threshold: 0.20 },
    { name: 'tone', pattern: E(7, 12, 2), kind: 'tone', baseGain: 0.22, miss: 0.15, ghost: 0.20, threshold: 0.30 },
    { name: 'bell', pattern: E(3, 12, 5), kind: 'bell', baseGain: 0.18, miss: 0.20, ghost: 0.10, threshold: 0.40 },
    { name: 'shak', pattern: E(8, 12),    kind: 'shak', baseGain: 0.14, miss: 0.15, ghost: 0,    threshold: 0.50 },
  ];

  // Tonal voices get a persistent oscillator+gain we re-pluck per hit (cheaper
  // than allocating a new osc each time). Noise voices allocate per-hit since
  // they need fresh buffer data anyway.
  const persistent = {};
  function ensureOsc(name, freq, type = 'sine') {
    if (persistent[name]) return persistent[name];
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(dest);
    osc.start();
    persistent[name] = { osc, gain };
    return persistent[name];
  }
  ensureOsc('kick', 95);
  ensureOsc('tom1', 150 + Math.floor(rng() * 40));
  ensureOsc('tom2', 88 + Math.floor(rng() * 22));
  ensureOsc('tone', 200 + Math.floor(rng() * 30));

  function triggerKick(t, vel, p) {
    p.osc.frequency.setValueAtTime(95, t);
    p.osc.frequency.exponentialRampToValueAtTime(45, t + 0.10);
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setValueAtTime(0.0001, t);
    p.gain.gain.exponentialRampToValueAtTime(vel, t + 0.005);
    p.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
  }
  function triggerSineHit(t, vel, p, peakFreq, restFreq, sweepDur, decayDur) {
    p.osc.frequency.setValueAtTime(peakFreq, t);
    p.osc.frequency.exponentialRampToValueAtTime(restFreq, t + sweepDur);
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setValueAtTime(0.0001, t);
    p.gain.gain.exponentialRampToValueAtTime(vel, t + 0.005);
    p.gain.gain.exponentialRampToValueAtTime(0.0001, t + decayDur);
  }
  function triggerNoise(t, vel, freq, qish, dur, type = 'highpass') {
    const bufSize = Math.max(64, Math.ceil(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    if (qish != null) filter.Q.value = qish;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vel, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
  function triggerTri(t, vel, freq, dur) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vel * 0.45, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Scheduler with lookahead. Per-tick we walk every voice and decide whether
  // it fires. Nightness is read fresh each tick from the module-level
  // currentNightness so daytime→night transitions are reflected in real time.
  let nextTickTime = ctx.currentTime + 0.2;
  let tickIdx = 0;
  function schedule() {
    const horizon = ctx.currentTime + 0.6;
    while (nextTickTime < horizon) {
      const ti = tickIdx % 12;
      const n = currentNightness;
      for (let v = 0; v < voices.length; v++) {
        const voice = voices[v];
        if (!voice.pattern[ti]) continue;
        if (n < voice.threshold) continue;
        if (voice.miss > 0 && Math.random() < voice.miss) continue;
        // Velocity — ghost note vs accent. baseVel ranges 0.55..1.0.
        const baseVel = (Math.random() < voice.ghost) ? 0.18 : (0.55 + Math.random() * 0.45);
        // Gate gain — voice fades in over a 0.15 nightness window starting at threshold.
        const gateN = Math.max(0, Math.min(1, (n - voice.threshold) / 0.15));
        // Overall mix gain rises slightly with nightness so the whole thing
        // is more present at night.
        const overall = 0.45 + 0.55 * n;
        const gain = voice.baseGain * gateN * baseVel * overall;
        // Guard against effectively-silent triggers — exponentialRampToValueAtTime
        // rejects targets exactly at zero, and even very tiny values waste an
        // oscillator pulse for no audible result.
        if (gain < 0.001) continue;
        // Timing jitter ±5ms — humanises the groove.
        const t = nextTickTime + (Math.random() - 0.5) * 0.010;
        switch (voice.kind) {
          case 'kick': triggerKick(t, gain, persistent.kick); break;
          case 'tom1': triggerSineHit(t, gain, persistent.tom1, persistent.tom1.osc.frequency.value * 1.2, 150, 0.06, 0.16); break;
          case 'tom2': triggerSineHit(t, gain, persistent.tom2, persistent.tom2.osc.frequency.value * 1.2, 90, 0.07, 0.18); break;
          case 'tone': triggerSineHit(t, gain, persistent.tone, 230, 200, 0.05, 0.13); break;
          case 'slap': triggerNoise(t, gain, 2400, null, 0.07, 'highpass'); break;
          case 'bell': triggerTri(t, gain, 600 + (rng() * 80), 0.18); break;
          case 'shak': triggerNoise(t, gain * 0.6, 5200, null, 0.04, 'highpass'); break;
        }
      }
      nextTickTime += tickDur;
      tickIdx++;
    }
  }
  schedule();
  const intervalId = setInterval(schedule, 180);

  // ---- Crackling fire ----
  // Pink-noise bursts every 0.4-1.2s, gated on nightness > 0.3. Quiet — the
  // fire is supposed to be in the background, not competing with the drums.
  // Each burst is a short bandpassed noise blip at a random centre frequency
  // so successive cracks sound different (crackle, pop, hiss).
  let nextCrackleTime = ctx.currentTime + 0.8;
  function crackleSchedule() {
    const n = currentNightness;
    if (n < 0.3) {
      // Push forward so we don't try to catch up when night arrives.
      nextCrackleTime = ctx.currentTime + 0.4;
      return;
    }
    while (nextCrackleTime < ctx.currentTime + 0.6) {
      const dur = 0.04 + Math.random() * 0.08;
      const vel = (0.08 + (n - 0.3) * 0.10) * (0.6 + Math.random() * 0.4);
      triggerNoise(
        nextCrackleTime, vel,
        600 + Math.random() * 1400,
        1.5, dur, 'bandpass',
      );
      nextCrackleTime += 0.4 + Math.random() * 0.8;
    }
  }
  const crackleId = setInterval(crackleSchedule, 220);

  return {
    panner,
    // Move the lowpass cutoff exponentially to the target so changes never
    // pop. `freq` should be in Hz; we expect a range of ~2500..14000.
    setLowpassCutoff(freq) {
      const clamped = Math.max(120, Math.min(20000, freq));
      lowpass.frequency.setTargetAtTime(clamped, ctx.currentTime, 0.20);
    },
    stop() {
      clearInterval(intervalId);
      clearInterval(crackleId);
      for (const key in persistent) {
        try { persistent[key].osc.stop(); } catch (e) {}
      }
      try { lowpass.disconnect(); } catch (e) {}
      try { panner.disconnect(); } catch (e) {}
    },
  };
}

// ---------- Nature ambience (birds / crickets / frogs) ----------
//
// Built once from Sound.init(). Everything routes through `natureBus` →
// nature trip chain → masterGain, so a trip warps the whole soundscape. Three
// schedulers tick on setInterval (the same pattern the crackling-fire bed
// uses): bird songs (positional, gated by time-of-day activity + nearby
// candidates), crickets (gated by nightness + treeness), frogs (gated by
// lakeness). When all gates are closed the schedulers early-out, so the
// steady-state cost in open daytime festival is ~nil.

function initNatureAudio() {
  natureBus = ctx.createGain();
  // Apply any persisted nature volume from the restore block; fall back to 0.9.
  natureBus.gain.value = (_pendingNatureVol !== null) ? _pendingNatureVol : 0.9;
  _pendingNatureVol = null;

  // Trip wet/dry chain — same topology as the music/sfx chains.
  _natTripDry = ctx.createGain(); _natTripDry.gain.value = 1.0;
  _natTripWet = ctx.createGain(); _natTripWet.gain.value = 0.0;
  _natTripLowpass = ctx.createBiquadFilter();
  _natTripLowpass.type = 'lowpass';
  _natTripLowpass.frequency.value = 18000;
  _natTripLowpass.Q.value = 1.0;
  _natTripDelay = ctx.createDelay(1.0);
  _natTripDelay.delayTime.value = 0.34;
  _natTripFeedback = ctx.createGain();
  _natTripFeedback.gain.value = 0.0;

  natureBus.connect(_natTripDry);
  _natTripDry.connect(masterGain);
  natureBus.connect(_natTripLowpass);
  _natTripLowpass.connect(_natTripWet);
  _natTripWet.connect(masterGain);
  _natTripLowpass.connect(_natTripDelay);
  _natTripDelay.connect(_natTripFeedback);
  _natTripFeedback.connect(_natTripLowpass);

  // Positional panner pool for bird songs (birds live at world coordinates;
  // the AudioListener is updated every frame so these pan + attenuate).
  _birdPanners = [];
  for (let i = 0; i < 4; i++) {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 8;
    p.maxDistance = 80;
    p.rolloffFactor = 1.3;
    p.connect(natureBus);
    _birdPanners.push({ node: p, busyUntil: 0 });
  }

  // Fixed-pan stereo spread for the cricket + frog beds (cheaper than 3D
  // panners; these are "all around you" ambient, not point sources).
  _natureStereoPanners = [];
  const StereoP = ctx.createStereoPanner ? true : false;
  for (const pan of [-0.85, -0.4, 0, 0.4, 0.85]) {
    let node;
    if (StereoP) { node = ctx.createStereoPanner(); node.pan.value = pan; }
    else { node = ctx.createGain(); }      // very old browsers: mono fallback
    node.connect(natureBus);
    _natureStereoPanners.push(node);
  }

  // Schedulers.
  _natureSchedulers.push(setInterval(birdSongTick, 260));
  _natureSchedulers.push(setInterval(cricketTick, 230));
  _natureSchedulers.push(setInterval(frogTick, 300));
  _natureSchedulers.push(setInterval(owlTick, 400));
}

// Randomly pick a stereo panner slot, biased toward `panX` (-1..1).
// panX=0 → uniform pick. panX=±1 → strongly weighted toward the matching side.
// Each slot has a fixed pan value; we weight by proximity to the target pan.
const _STEREO_PANS = [-0.85, -0.4, 0, 0.4, 0.85];
function randStereo(panX = 0) {
  if (!_natureStereoPanners.length) return null;
  if (panX === 0) return _natureStereoPanners[(Math.random() * _natureStereoPanners.length) | 0];
  // Compute a weight for each slot: inverse-square distance from panX.
  const weights = _STEREO_PANS.map(p => 1 / (0.01 + Math.abs(p - panX) * Math.abs(p - panX)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return _natureStereoPanners[i];
  }
  return _natureStereoPanners[_natureStereoPanners.length - 1];
}

// ---- Bird songs ----

// One bird note: a pitched whistle with a quick envelope, optional pitch glide
// and vibrato. During a trip, `_natTripEnv` bends the pitch so the calls go
// woozy on top of the bus-level filter/delay smear.
function birdNote(dest, t, freq, dur, vol, { type = 'sine', glideTo = null, vibrato = 0 } = {}) {
  const bend = 1 - 0.35 * _natTripEnv * Math.sin(_natTripProgress * Math.PI * 2 + t);
  freq *= bend;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(60, glideTo * bend), t + dur);
  if (vibrato > 0) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = vibrato;
    const lg = ctx.createGain();
    lg.gain.value = freq * 0.03;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t); osc.stop(t + dur + 0.06);
}

// A short bandpassed-noise burst for the harsh corvid calls (jay / crow).
function birdNoise(dest, t, centerHz, q, dur, vol) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = centerHz * (1 - 0.3 * _natTripEnv);
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  src.connect(bp).connect(g).connect(dest);
  src.start(t); src.stop(t + dur + 0.02);
}

function scheduleBirdSong(dest, species, t0) {
  const stretch = 1 + _natTripEnv * 0.8;      // a trip slows the phrasing
  let t = t0;
  switch (species) {
    case 'sparrow': {                          // chip-chip-chirrup
      const n = 3 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const f = 2600 + Math.random() * 1200;
        birdNote(dest, t, f, 0.06, 0.16, { type: 'triangle', glideTo: f * 1.12 });
        t += (0.09 + Math.random() * 0.05) * stretch;
      }
      birdNote(dest, t, 3000, 0.12, 0.15, { type: 'triangle', glideTo: 3500, vibrato: 35 });
      break;
    }
    case 'finch': {                            // fast trill into a sweet note
      for (let i = 0; i < 8; i++) {
        birdNote(dest, t, 3800 + (i % 2 ? 420 : 0), 0.03, 0.11, { type: 'sine' });
        t += 0.045 * stretch;
      }
      birdNote(dest, t, 3200, 0.18, 0.15, { type: 'sine', glideTo: 4200, vibrato: 42 });
      break;
    }
    case 'jay': {                              // harsh jay! jay!
      for (let i = 0; i < 2; i++) {
        birdNoise(dest, t, 1700, 6, 0.18, 0.2);
        birdNote(dest, t, 1500, 0.18, 0.09, { type: 'sawtooth', glideTo: 1050 });
        t += 0.28 * stretch;
      }
      break;
    }
    case 'crow': {                             // caw caw caw
      const n = 2 + ((Math.random() * 2) | 0);
      for (let i = 0; i < n; i++) {
        birdNoise(dest, t, 820, 4, 0.26, 0.2);
        birdNote(dest, t, 720, 0.26, 0.13, { type: 'sawtooth', glideTo: 560 });
        t += 0.42 * stretch;
      }
      break;
    }
    case 'owl': {                              // deep low "hoo… hoo-hoo" — night only
      // Primary hoo: slow-onset sine, slight pitch glide downward.
      birdNote(dest, t, 360 + Math.random() * 40, 0.55, 0.13, { type: 'sine', glideTo: 310, vibrato: 5 });
      t += (1.2 + Math.random() * 0.4) * stretch;
      // Double hoo (two shorter notes close together).
      for (let i = 0; i < 2; i++) {
        birdNote(dest, t, 330 + Math.random() * 30, 0.32, 0.11, { type: 'sine', glideTo: 290 });
        t += (0.38 + Math.random() * 0.1) * stretch;
      }
      break;
    }
    case 'dove':                               // soft mournful coo, coo-coo
    default: {
      birdNote(dest, t, 560, 0.34, 0.15, { type: 'sine', glideTo: 500, vibrato: 8 });
      t += 0.5 * stretch;
      for (let i = 0; i < 2; i++) {
        birdNote(dest, t, 600, 0.28, 0.13, { type: 'sine', glideTo: 520, vibrato: 8 });
        t += 0.34 * stretch;
      }
      break;
    }
  }
}

function birdSongTick() {
  if (!natureBus || _birdCandidates.length === 0) return;
  // Fire rate scales with time-of-day activity: dawn chorus busy, midday/
  // night sparse. ~0 at activity 0 (handed off to crickets/frogs).
  const fireChance = 0.12 + _birdActivity * 0.6;
  if (Math.random() > fireChance) return;
  const now = ctx.currentTime;
  // Weighted pick toward the front (priority-sorted) candidates.
  const pick = _birdCandidates[(Math.pow(Math.random(), 1.8) * _birdCandidates.length) | 0]
            || _birdCandidates[0];
  // Grab a free panner.
  let slot = null;
  for (const s of _birdPanners) if (now >= s.busyUntil) { slot = s; break; }
  if (!slot) return;
  const p = slot.node;
  if (p.positionX) { p.positionX.value = pick.x; p.positionY.value = pick.y; p.positionZ.value = pick.z; }
  else if (p.setPosition) p.setPosition(pick.x, pick.y, pick.z);
  scheduleBirdSong(p, pick.species, now + 0.02);
  slot.busyUntil = now + 1.4;
}

// ---- Owl / nightjar ----
// Gated on nightness > 0.85 (deep night only). Fires very sparsely — every
// 18–40s — through a free _birdPanners slot at a far ambient position.
let _nextOwl = 0;
function owlTick() {
  if (!natureBus) return;
  if (currentNightness <= 0.85) return;
  const now = ctx.currentTime;
  if (now < _nextOwl) return;
  // Next hoot in 18–40s.
  _nextOwl = now + 18 + Math.random() * 22;
  owlHoot(now + 0.05);
}

function owlHoot(t0) {
  // Grab a free panner slot for a far-off ambient position.
  const now = ctx.currentTime;
  let slot = null;
  for (const s of _birdPanners) if (now >= s.busyUntil) { slot = s; break; }
  if (!slot) return;
  // Place the owl at an ambient 40–70m out, random compass direction.
  const angle = Math.random() * Math.PI * 2;
  const dist = 40 + Math.random() * 30;
  const p = slot.node;
  const ox = Math.cos(angle) * dist, oz = Math.sin(angle) * dist;
  if (p.positionX) { p.positionX.value = ox; p.positionY.value = 5; p.positionZ.value = oz; }
  else if (p.setPosition) p.setPosition(ox, 5, oz);
  scheduleBirdSong(p, 'owl', t0);
  slot.busyUntil = now + 2.5;
}

// ---- Crickets ----
// Gated on nightness (>~0.45) AND treeness (_cricketLevel). Each chirp is a
// short ~4.6kHz sine pair pulsed a few times (the cricket "trill"), panned
// across the fixed stereo spread.
let _nextCricket = 0;
function cricketTick() {
  if (!natureBus) return;
  const nightGate = Math.max(0, (currentNightness - 0.45) / 0.55);
  const lvl = _cricketLevel * nightGate;
  if (lvl < 0.03) { _nextCricket = ctx.currentTime + 0.2; return; }
  const now = ctx.currentTime;
  while (_nextCricket < now + 0.5) {
    cricketChirp(_nextCricket, lvl);
    // Denser when nearer trees / deeper night.
    _nextCricket += (0.14 + Math.random() * 0.5) * (1.2 - lvl * 0.6);
  }
}
function cricketChirp(t, lvl) {
  const dest = randStereo(_cricketPan);
  const base = 4500 + Math.random() * 600;
  const bend = 1 - 0.4 * _natTripEnv;
  const pulses = 3 + ((Math.random() * 3) | 0);
  const vol = 0.05 + lvl * 0.06;
  for (let i = 0; i < 2; i++) {                // two detuned sines = shimmer
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = (base + i * 18) * bend;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    for (let k = 0; k < pulses; k++) {         // amplitude-pulsed trill
      const pt = t + k * 0.028;
      g.gain.linearRampToValueAtTime(vol, pt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0008, pt + 0.022);
    }
    osc.connect(g).connect(dest);
    osc.start(t); osc.stop(t + pulses * 0.028 + 0.05);
  }
}

// ---- Frogs ----
// Gated on lakeness (_frogLevel). A croak is a low ~180Hz pulse with a quick
// formant wobble; present day + night with a small dusk/night bump. Sparser
// and lower than crickets.
let _nextFrog = 0;
function frogTick() {
  if (!natureBus) return;
  const lvl = _frogLevel * (0.7 + 0.3 * currentNightness);
  if (lvl < 0.04) { _nextFrog = ctx.currentTime + 0.3; return; }
  const now = ctx.currentTime;
  while (_nextFrog < now + 0.6) {
    if (Math.random() < 0.7) frogCroak(_nextFrog, lvl);
    _nextFrog += 0.5 + Math.random() * 1.6;
  }
}
function frogCroak(t, lvl) {
  const dest = randStereo(_frogPan);
  const bend = 1 - 0.45 * _natTripEnv;
  const base = (150 + Math.random() * 80) * bend;
  const vol = 0.10 + lvl * 0.10;
  // A short "ribbit": a couple of rapid low pulses with a formant lowpass.
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900 * bend, t);
  lp.frequency.exponentialRampToValueAtTime(400 * bend, t + 0.18);
  lp.Q.value = 6;
  const pulses = 1 + ((Math.random() * 2) | 0);
  for (let k = 0; k < pulses; k++) {
    const pt = t + k * 0.12;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, pt);
    osc.frequency.linearRampToValueAtTime(base * 1.25, pt + 0.05);
    osc.frequency.linearRampToValueAtTime(base, pt + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, pt);
    g.gain.linearRampToValueAtTime(vol, pt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, pt + 0.13);
    osc.connect(g).connect(lp);
    osc.start(pt); osc.stop(pt + 0.16);
  }
  lp.connect(dest);
}

// ---------- Per-obstacle dispatch ----------

const COLLISION_SOUNDS = {
  puppet:      (c, d) => boop(c, d, 240, 540, 0.2, 0.4, 'sine'),
  brass:       (c, d) => brassHit(c, d),
  truck:       (c, d) => { thump(c, d, 55, 0.4, 0.6); clang(c, d); },
  tent:        (c, d) => thump(c, d, 95, 0.22, 0.35),
  kid:         (c, d) => boop(c, d, 720, 1150, 0.13, 0.35, 'sine'),
  wook:        (c, d) => duudeSound(c, d),
  stage:       (c, d) => { thump(c, d, 52, 0.55, 0.62); woodKnock(c, d); },
  stage_front: (c, d) => thump(c, d, 75, 0.4, 0.45),
  arch:        (c, d) => woodKnock(c, d),
  lamppost:    (c, d) => clang(c, d),
  drum_circle: (c, d) => { thump(c, d, 70, 0.4, 0.55); thump(c, d, 110, 0.25, 0.3); },
  // Forest collisions: forest_tree = a louder woody thud (you ran into an
  // 8-metre oak). Firepit = thumpy stone wall. Bench = soft wood bonk.
  forest_tree: (c, d) => { thump(c, d, 65, 0.45, 0.55); woodKnock(c, d); },
  firepit:     (c, d) => { thump(c, d, 50, 0.5, 0.55); thump(c, d, 75, 0.3, 0.4); },
  bench_ring:  (c, d) => woodKnock(c, d),
  // Porta-potty — hollow plastic knock + a sloshy descending squawk. Reads as
  // "you bonked a plastic box with liquid in it," not a solid clang.
  porta_potty: (c, d) => { thump(c, d, 90, 0.18, 0.4); boop(c, d, 300, 130, 0.2, 0.22, 'square'); },
  default:     (c, d) => thump(c, d, 180, 0.2, 0.3),
};
