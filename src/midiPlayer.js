// MIDI playback module. Tone.js + @tonejs/midi are loaded lazily from a CDN
// on the first M press so they don't bloat startup (combined ~250KB gzip).
// Reads assets/music/manifest.json to pick a random track; if no manifest
// or it's empty, falls back to a small procedural test loop so the M key
// always produces *something* audible.
//
// Trip integration: the master effect chain's wet/depth params are driven
// each frame by Trip._envelope (0..1), so MIDI playback warps into a
// psychedelic soup as the trip ramps up — pitch wobble, deepening vibrato,
// swelling reverb, ping-pong delay runaway, tempo drift.
//
// Architecture:
//   Per-category synths (drums/bass/lead/pad) → Vibrato → AutoFilter →
//     PingPongDelay → Reverb(short) ──┬── midiOut
//                                  Reverb(long, wet=0 at idle) ─┘
//   At trip peak: long reverb wet ramps up, short reverb wet eases back.
//   Granular AudioWorklet spliced between reverb output and midiOut (if
//   AudioWorklet API is available); transparent passthrough at mix=0.

import { Sound } from './sound.js';

const TONE_CDN = 'https://esm.sh/tone@14.7.77';
const MIDI_CDN = 'https://esm.sh/@tonejs/midi@2.0.28';
// In-world stage music ducks to this level while the foreground MIDI is
// playing. 0.18 = ~80% attenuation; still audible far from a stage so the
// festival doesn't go totally silent, but the MIDI clearly dominates.
const DUCK_LEVEL = 0.18;

// GM program number → synthesis category.
// Percussion channel (isPercussion=true from @tonejs/midi) always → 'drums'.
// Program ranges follow General MIDI 1 spec groupings.
function GM_CATEGORY(program, isPercussion) {
  if (isPercussion) return 'drums';
  const p = program ?? 0;
  if (p <= 7)   return 'lead';   // Piano family
  if (p <= 15)  return 'pad';    // Chromatic percussion (vibes, marimba)
  if (p <= 23)  return 'pad';    // Organ
  if (p <= 31)  return 'lead';   // Guitar
  if (p <= 39)  return 'bass';   // Bass
  if (p <= 47)  return 'pad';    // Strings
  if (p <= 55)  return 'pad';    // Ensemble (choir, string ensemble)
  if (p <= 63)  return 'lead';   // Brass
  if (p <= 71)  return 'lead';   // Reed (sax, oboe, clarinet)
  if (p <= 79)  return 'lead';   // Pipe (flute, recorder)
  if (p <= 87)  return 'lead';   // Synth lead
  if (p <= 95)  return 'pad';    // Synth pad
  if (p <= 103) return 'pad';    // Synth effects
  if (p <= 111) return 'pad';    // Ethnic (sitar, banjo, shamisen)
  if (p <= 119) return 'lead';   // Percussive (melodic: tinkle bell, agogo, steel drums)
  return 'lead';                 // Sound effects (0 and above edge case)
}

// General MIDI percussion key map (channel 10, notes 35–81) → a voice
// descriptor: { v, note?, dur?, vel? }.
//   v    — which kit voice plays it (see _triggerDrum / _buildSynths)
//   note — pitch for the pitched voices (tom-pool membrane, bell FM); ignored
//          by the noise voices
//   dur  — note length (ring time); defaults per-voice in _triggerDrum
//   vel  — velocity multiplier (some percussion sits quieter in the mix)
// The point: instead of dumping 30+ notes into one white-noise snare, every
// GM family gets a sensible timbre — pitched membrane toms/congas/bongos, an
// FM bell for cowbell/agogô/triangle/ride, filtered noise for hats/snare/
// cymbal/shaker, and woody "toks" for claves/woodblocks.
function GM_DRUM(n) {
  switch (n) {
    // --- Kick ---
    case 35: case 36: return { v: 'kick' };
    // --- Snare family (noise crack) ---
    case 38: case 40: return { v: 'snare' };           // acoustic / electric snare
    case 37: return { v: 'tom', note: 'C4', dur: '32n', vel: 0.7 }; // side stick → woody tok
    case 39: return { v: 'snare', vel: 0.85 };          // hand clap ≈ snare-ish
    // --- Toms (low → high) ---
    case 41: return { v: 'tom', note: 'A1' };
    case 43: return { v: 'tom', note: 'D2' };
    case 45: return { v: 'tom', note: 'A2' };
    case 47: return { v: 'tom', note: 'C3' };
    case 48: return { v: 'tom', note: 'E3' };
    case 50: return { v: 'tom', note: 'G3' };
    // --- Hi-hats ---
    case 42: case 44: return { v: 'hatClosed' };        // closed / pedal
    case 46: return { v: 'hatOpen' };
    // --- Cymbals (noise wash) ---
    case 49: case 57: return { v: 'cymbal' };           // crash 1 / 2
    case 52: case 55: return { v: 'cymbal', vel: 0.9 }; // china / splash
    // --- Ride (metallic ping → bell) ---
    case 51: case 59: return { v: 'bell', note: 'C4', dur: '4n', vel: 0.7 };
    case 53: return { v: 'bell', note: 'C5', dur: '8n' }; // ride bell
    // --- Congas / bongos / timbales (pitched membrane) ---
    case 64: return { v: 'tom', note: 'A2' };           // low conga
    case 63: return { v: 'tom', note: 'E3' };           // open hi conga
    case 62: return { v: 'tom', note: 'A3', dur: '32n' }; // mute hi conga (short)
    case 61: return { v: 'tom', note: 'E3' };           // low bongo
    case 60: return { v: 'tom', note: 'A3' };           // hi bongo
    case 66: return { v: 'tom', note: 'E3', vel: 0.9 }; // low timbale
    case 65: return { v: 'tom', note: 'A3', vel: 0.9 }; // hi timbale
    // --- Metallic / tonal bells ---
    case 56: return { v: 'bell', note: 'E4', dur: '16n' };  // cowbell
    case 68: return { v: 'bell', note: 'E4' };              // low agogô
    case 67: return { v: 'bell', note: 'A4' };              // hi agogô
    case 80: return { v: 'bell', note: 'A5', dur: '16n' };  // mute triangle
    case 81: return { v: 'bell', note: 'A5', dur: '1n' };   // open triangle (rings)
    // --- Woody clicks ---
    case 75: return { v: 'tom', note: 'D4', dur: '32n', vel: 0.75 }; // claves
    case 76: return { v: 'tom', note: 'C4', dur: '32n', vel: 0.75 }; // hi woodblock
    case 77: return { v: 'tom', note: 'A3', dur: '32n', vel: 0.75 }; // lo woodblock
    // --- Shakers / scrapers (short noise) ---
    case 69: case 70: case 73: case 74: case 58: return { v: 'shaker' }; // cabasa/maracas/guiro/vibraslap
    case 54: return { v: 'shaker', vel: 0.85 };          // tambourine
    // --- Whistles / cuíca (rare) ---
    case 71: case 72: return { v: 'bell', note: 'E6', dur: '8n', vel: 0.5 };
    case 78: case 79: return { v: 'tom', note: 'A2', vel: 0.5 }; // cuíca → conga-ish
    default: return { v: 'tom', note: 'A2', vel: 0.6 };  // unknown pitched perc fallback
  }
}

// Guard against double-registering the granular worklet module URL (one
// registration per AudioContext is all the spec allows).
let _granularModuleAdded = false;

// Inline AudioWorklet source — a ring-buffer grain stutter. Captures
// recent input samples into a circular buffer, then at mix>0 replays
// randomised short grains (random offset within the buffer, random
// playback rate 0.8–1.25, random grain size 512–2048 samples). At mix=0
// the node is a transparent passthrough (output = input, zero latency).
// The `mix` AudioParam (k-rate, range 0..1) is the only control surface;
// everything else is hardwired for the "galaxy-brain" trip effect.
const GRANULAR_PROCESSOR_SRC = `
class GranularProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'mix', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }];
  }
  constructor() {
    super();
    // Ring buffer: 2s at 48kHz ≈ 96000 samples per channel. We allocate
    // for a nominal 48kHz; actual rate comes from globalThis.sampleRate.
    const bufLen = Math.ceil(sampleRate * 2);
    this._buf = [new Float32Array(bufLen), new Float32Array(bufLen)];
    this._writePos = 0;
    this._bufLen = bufLen;
    // Active grains: each is { readPos, remaining, rate }
    this._grains = [];
    this._spawnCounter = 0;
  }
  process(inputs, outputs, parameters) {
    const input  = inputs[0];
    const output = outputs[0];
    const mix = parameters.mix[0];
    const channels = Math.min(input.length, output.length, 2);
    if (channels === 0) return true;
    const blockSize = input[0].length;
    const bufLen = this._bufLen;

    // Write input into the ring buffer (both channels).
    for (let c = 0; c < channels; c++) {
      const inp = input[c];
      const buf = this._buf[c];
      for (let i = 0; i < blockSize; i++) {
        buf[(this._writePos + i) % bufLen] = inp[i];
      }
    }

    if (mix <= 0.001) {
      // Transparent passthrough — copy input to output unchanged.
      for (let c = 0; c < channels; c++) {
        output[c].set(input[c]);
      }
      this._writePos = (this._writePos + blockSize) % bufLen;
      return true;
    }

    // Spawn new grains every ~512 samples (rate proportional to mix).
    this._spawnCounter += blockSize;
    const spawnInterval = Math.max(128, Math.floor(512 * (1 - mix * 0.7)));
    while (this._spawnCounter >= spawnInterval) {
      this._spawnCounter -= spawnInterval;
      // Only add a grain if we have enough buffered history.
      const available = Math.min(bufLen - 1, this._writePos > 512 ? this._writePos : bufLen);
      if (available > 512) {
        const grainSize = 512 + Math.floor(Math.random() * 1536); // 512–2048 samples
        const offset    = Math.floor(Math.random() * Math.max(1, available - grainSize));
        const rate      = 0.8 + Math.random() * 0.45; // 0.80–1.25
        const startPos  = (this._writePos - offset - grainSize + bufLen * 2) % bufLen;
        this._grains.push({ readPos: startPos, remaining: grainSize, rate, frac: 0 });
      }
    }

    // Mix passthrough + grain output.
    for (let c = 0; c < channels; c++) {
      const inp = input[c];
      const buf = this._buf[c];
      const out = output[c];
      for (let i = 0; i < blockSize; i++) {
        out[i] = inp[i] * (1 - mix);
      }
    }
    // Add grain contributions (sum across all active grains, divided later).
    const grainGain = mix / Math.max(1, this._grains.length);
    for (let g = this._grains.length - 1; g >= 0; g--) {
      const grain = this._grains[g];
      for (let c = 0; c < channels; c++) {
        const buf = this._buf[c];
        const out = output[c];
        let { readPos, frac, rate } = grain;
        const rem = grain.remaining;
        const toWrite = Math.min(blockSize, rem);
        for (let i = 0; i < toWrite; i++) {
          // Linear interpolation between adjacent ring-buffer samples.
          const i0 = Math.floor(readPos) % bufLen;
          const i1 = (i0 + 1) % bufLen;
          out[i] += (buf[i0] * (1 - frac) + buf[i1] * frac) * grainGain;
          frac += rate;
          const step = Math.floor(frac);
          readPos = (readPos + step) % bufLen;
          frac -= step;
        }
        if (c === 0) {
          // Advance grain state only once (channel 0 drives position).
          grain.readPos = readPos;
          grain.frac = frac;
          grain.remaining -= toWrite;
        }
      }
      if (grain.remaining <= 0) this._grains.splice(g, 1);
    }

    this._writePos = (this._writePos + blockSize) % bufLen;
    return true;
  }
}
registerProcessor('granular-processor', GranularProcessor);
`;

export class MidiPlayer {
  constructor() {
    this.Tone = null;
    this.Midi = null;
    this.transport = null;           // the CURRENT context's transport (see _ensureLoaded)
    // Per-category synth pool. Built in _buildSynths().
    this._synths = null;             // { lead, bass, pad, drums }
    this.synth = null;               // backward-compat alias → this._synths.lead
    this.effects = null;
    this.parts = [];                 // Tone.Part / Tone.Sequence — disposed on stop
    this.trackMeta = [];             // { i, name, category, muted } aligned to parts[]
    this.manifest = null;
    this.isPlaying = false;
    this.currentTrack = null;
    this._loadingPromise = null;     // shared promise so concurrent toggles don't double-load
    this._tripEnvelope = 0;
    this._baseBpm = 120;
    this._tomRR = 0;                  // round-robin index for the tom/conga pool
    this._drumLast = {};             // per-voice last trigger time (collision guard)
    this._granularNode = null;       // AudioWorkletNode or null if unsupported/failed
  }

  // First call lazy-loads Tone.js + @tonejs/midi + the manifest. Subsequent
  // calls resolve immediately. Returns true on success, false on failure.
  async _ensureLoaded() {
    // All three must be set — transport is built after Tone.start() so it's the
    // reliable sentinel that full initialization completed.
    if (this.Tone && this.Midi && this.transport) return true;
    if (this._loadingPromise) return this._loadingPromise;
    this._loadingPromise = (async () => {
      try {
        const [tone, midiMod] = await Promise.all([
          import(/* @vite-ignore */ TONE_CDN),
          import(/* @vite-ignore */ MIDI_CDN),
        ]);
        this.Tone = tone;
        this.Midi = midiMod.Midi;
        // Share Sound.js's AudioContext so Tone.js output can route into
        // masterGain / midiGain. Without this, Tone creates its own context
        // and no slider in the debug HUD (or future player-facing UI) can
        // touch MIDI volume. Must be called BEFORE Tone.start().
        const rawCtx = Sound.getContext();
        if (rawCtx) {
          this.Tone.setContext(new this.Tone.Context({ context: rawCtx }));
        }
        // Tone.start() is REQUIRED on a user gesture (first M press) —
        // browsers suspend the AudioContext until user interaction.
        await this.Tone.start();
        // CRITICAL: bind to the CURRENT context's transport. `Tone.Transport`
        // is a legacy singleton created on Tone's default context at module
        // load — setContext() above does NOT migrate it. Scheduling/starting
        // that stale transport runs a clock separate from the synth (which is
        // on the shared game context), so notes land in the wrong clock and
        // never sound while playback "looks" started. getTransport() follows
        // setContext and returns the same context's transport as the synth.
        this.transport = this.Tone.getTransport();
        this._buildEffectChain();
        this._buildSynths();
        // Register granular AudioWorklet via Blob URL. Must happen after
        // Tone.start() since we need the shared AudioContext to exist. Wrapped
        // in try/catch — if AudioWorklet API is absent (old Safari) or the
        // module registration throws, we skip the splice entirely and the
        // chain remains fully functional without granular.
        await this._initGranular();
        // Best-effort manifest load. No file == empty manifest, procedural
        // fallback kicks in. Don't noisy-warn on 404.
        // Cache-bust the URL: the Claude Preview proxy (and some browsers)
        // ignore `cache: 'no-store'`, so without a unique query string a STALE
        // manifest can be served — e.g. an older empty `tracks: []` snapshot,
        // which silently drops playback into the procedural test loop even
        // though real tracks are listed. A fresh URL each load avoids that.
        try {
          const res = await fetch('assets/music/manifest.json?v=' + Date.now(), { cache: 'no-store' });
          if (res.ok) this.manifest = await res.json();
        } catch (e) {
          this.manifest = null;
        }
        return true;
      } catch (e) {
        console.warn('[midi] failed to load Tone.js / @tonejs/midi', e);
        this._loadingPromise = null;  // allow retry on next toggle press
        return false;
      }
    })();
    return this._loadingPromise;
  }

  // Register the granular worklet and splice it into the effect chain.
  // Silent no-op if AudioWorklet API is unavailable or registration fails.
  async _initGranular() {
    const rawCtx = Sound.getContext();
    if (!rawCtx || !rawCtx.audioWorklet) return;
    try {
      if (!_granularModuleAdded) {
        const blob = new Blob([GRANULAR_PROCESSOR_SRC], { type: 'application/javascript' });
        const url  = URL.createObjectURL(blob);
        await rawCtx.audioWorklet.addModule(url);
        _granularModuleAdded = true;
      }
      this._granularNode = new AudioWorkletNode(rawCtx, 'granular-processor', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
      });
      // Resplice: reverb → granularNode → midiOut (instead of reverb → midiOut).
      // Tone nodes expose .output (a native AudioNode) for .connect().
      const midiOut = Sound.getMidiInputNode();
      const dest = midiOut ?? this.Tone.Destination.input;
      // Disconnect reverb from its current destination, route through granular.
      this.effects.reverb.disconnect();
      this.effects.reverb.connect(this._granularNode);
      this._granularNode.connect(dest);
      // Also connect long reverb through granular.
      this.effects.reverbLong.disconnect();
      this.effects.reverbLong.connect(this._granularNode);
    } catch (e) {
      // Granular unavailable — leave chain intact (already wired in _buildEffectChain).
      console.info('[midi] granular worklet unavailable, skipping splice:', e.message);
      this._granularNode = null;
    }
  }

  // Build the master effect chain. Order is signal-flow: synths → effects →
  // Destination. All effects ship with subtle defaults so playback is clean
  // until setTripState() ramps them up.
  _buildEffectChain() {
    const T = this.Tone;

    // Vibrato — pitch modulation. Subtle by default; goes "drunk theremin"
    // at peak trip.
    const vibrato = new T.Vibrato({ frequency: 5, depth: 0.04 });

    // AutoFilter — LFO-driven low-pass that pulses the timbre open and
    // shut. Wet=0 at idle (no audible effect); ramped in during trip for
    // the breathing-filter feel.
    const filter = new T.AutoFilter({
      frequency: 0.3, depth: 0.5, baseFrequency: 1200, octaves: 2.5, wet: 0,
    }).start();

    // PingPongDelay — stereo bouncing echo. Subtle by default; feedback
    // ramps toward runaway during trip so single notes cascade into clouds.
    const delay = new T.PingPongDelay({
      delayTime: '8n', feedback: 0.22, wet: 0.10,
    });

    // Short reverb — hall by default; wet swells massively during trip.
    const reverb = new T.Reverb({ decay: 4.5, wet: 0.18 });

    // Long reverb — cathedral parallel path. wet=0 at idle (completely
    // silent); crossfades up via peakBell at the trip climax while the
    // short reverb eases back a touch. Pre-generate the impulse response
    // immediately (it's async internally — generate() kicks it off and the
    // node is safe to connect before it resolves; silence until ready).
    const reverbLong = new T.Reverb({ decay: 12, wet: 0 });
    reverbLong.generate();

    // Route the output into Sound.js's midiGain node (→ masterGain) so Master
    // and the MIDI fader both affect playback. Falls back to T.Destination if
    // Sound hasn't initialized yet (shouldn't happen in normal flow).
    const midiOut = Sound.getMidiInputNode();
    vibrato.chain(filter, delay, reverb);
    // Both reverbs connect in parallel from the delay output.
    // reverbLong needs its own feed from delay, then merges at midiOut.
    delay.connect(reverbLong);
    reverb.connect(midiOut ?? T.Destination);
    reverbLong.connect(midiOut ?? T.Destination);

    this.effects = { vibrato, filter, delay, reverb, reverbLong };
    this._inputNode = vibrato;       // synths.connect(this._inputNode)
  }

  // Build the per-category synth pool. All synths feed into this._inputNode
  // (the vibrato/filter/delay/reverb effect chain).
  _buildSynths() {
    const T = this.Tone;

    // Lead — bright FM synth for melody, keys, brass, reed, guitar lines.
    const lead = new T.PolySynth(T.FMSynth, {
      envelope: { attack: 0.02, decay: 0.12, sustain: 0.5, release: 0.4 },
    });
    lead.maxPolyphony = 128;
    lead.volume.value = -8;
    lead.connect(this._inputNode);

    // Pad — softer, slower attack for strings, ensembles, choir voices.
    const pad = new T.PolySynth(T.AMSynth, {
      envelope: { attack: 0.18, decay: 0.3, sustain: 0.8, release: 1.2 },
      harmonicity: 2.0,
    });
    pad.maxPolyphony = 64;
    pad.volume.value = -10;
    pad.connect(this._inputNode);

    // Bass — monophonic FM for bass lines (32–39 GM range). MonoSynth
    // with punchy envelope and a low-pass-filtered FM character.
    const bass = new T.PolySynth(T.FMSynth, {
      envelope: { attack: 0.01, decay: 0.18, sustain: 0.7, release: 0.25 },
      modulationEnvelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.2 },
      harmonicity: 0.5,
    });
    bass.maxPolyphony = 16;
    bass.volume.value = -5;
    bass.connect(this._inputNode);

    // --- Drum kit (routed per GM note by GM_DRUM / _triggerDrum) ---
    // Kick: pitched-membrane "boom".
    const kick = new T.MembraneSynth({
      pitchDecay: 0.05, octaves: 8,
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
    });
    kick.volume.value = -4;
    kick.connect(this._inputNode);

    // Pitched-membrane pool (round-robin ×3) for toms, congas, bongos,
    // timbales, and woody woodblock/clave "toks". MembraneSynth is
    // monophonic, so round-robin keeps a fast conga roll / tom fill from
    // cutting off its own tail. Pitch is set per hit from the GM map.
    const tomPool = [];
    for (let i = 0; i < 3; i++) {
      const tom = new T.MembraneSynth({
        pitchDecay: 0.03, octaves: 4,
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
      });
      tom.volume.value = -7;
      tom.connect(this._inputNode);
      tomPool.push(tom);
    }

    // Bell: inharmonic FM ping for cowbell, agogô, triangle, ride + ride
    // bell. Polyphonic so a steady ride pattern overlaps cleanly.
    const bell = new T.PolySynth(T.FMSynth, {
      harmonicity: 3.01, modulationIndex: 12,
      oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 },
      modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
    });
    bell.maxPolyphony = 12;
    bell.volume.value = -13;
    bell.connect(this._inputNode);

    // Noise voices, each FILTERED for character (the old kit was flat white
    // noise — "shh" hats, bodyless snare). Snare = band-passed crack; hats +
    // cymbal + shaker = high-passed metallic. Decay length separates a closed
    // tick from an open hat from a long crash.
    const mkNoise = (decay, release, filterType, freq, q, vol) => {
      const n = new T.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay, sustain: 0, release },
      });
      const f = new T.Filter({ type: filterType, frequency: freq, Q: q });
      n.connect(f); f.connect(this._inputNode);
      n.volume.value = vol;
      return { n, f };
    };
    const snare     = mkNoise(0.14, 0.05, 'bandpass', 1900, 0.7, -9);
    const hatClosed = mkNoise(0.03, 0.02, 'highpass', 8000, 1.0, -15);
    const hatOpen   = mkNoise(0.30, 0.10, 'highpass', 7000, 1.0, -14);
    const cymbal    = mkNoise(0.80, 0.20, 'highpass', 5000, 0.8, -13);
    const shaker    = mkNoise(0.05, 0.03, 'highpass', 6000, 1.0, -17);

    this._synths = {
      lead, pad, bass, kick, tomPool, bell,
      snare: snare.n, hatClosed: hatClosed.n, hatOpen: hatOpen.n,
      cymbal: cymbal.n, shaker: shaker.n,
    };
    // Keep the noise-voice filters referenced so they aren't GC'd.
    this._drumFilters = [snare.f, hatClosed.f, hatOpen.f, cymbal.f, shaker.f];
    // backward-compat alias used by _playProceduralLoop
    this.synth = lead;
  }

  // Strictly-increasing time per voice key. The monophonic drum voices
  // (kick / snare / hats / cymbal / shaker / each tom-pool member) throw if
  // two hits share a timestamp; nudge a coincident second hit forward 1.5ms
  // (inaudible) so a dense pattern never violates Tone's constraint.
  _safe(key, time) {
    const min = (this._drumLast[key] || 0) + 0.0015;
    const t = time > min ? time : min;
    this._drumLast[key] = t;
    return t;
  }

  // Route one GM percussion note to its kit voice. Pitched voices (tom pool,
  // bell) take a note from the GM map; noise voices take only a duration.
  _triggerDrum(midiNote, time, velocity) {
    const d = GM_DRUM(midiNote);
    const s = this._synths;
    if (!s) return;
    const vel = Math.max(0.01, Math.min(1, velocity * (d.vel ?? 1)));
    switch (d.v) {
      case 'kick':
        s.kick.triggerAttackRelease('C1', d.dur || '8n', this._safe('kick', time), vel);
        break;
      case 'tom': {
        const i = this._tomRR++ % s.tomPool.length;
        s.tomPool[i].triggerAttackRelease(d.note, d.dur || '8n', this._safe('tom' + i, time), vel);
        break;
      }
      case 'bell':   // PolySynth — polyphonic, no collision guard needed
        s.bell.triggerAttackRelease(d.note, d.dur || '8n', time, vel);
        break;
      case 'snare':
        s.snare.triggerAttackRelease(d.dur || '16n', this._safe('snare', time), vel);
        break;
      case 'hatClosed':
        s.hatClosed.triggerAttackRelease(d.dur || '32n', this._safe('hatClosed', time), vel);
        break;
      case 'hatOpen':
        s.hatOpen.triggerAttackRelease(d.dur || '8n', this._safe('hatOpen', time), vel);
        break;
      case 'cymbal':
        s.cymbal.triggerAttackRelease(d.dur || '2n', this._safe('cymbal', time), vel);
        break;
      case 'shaker':
        s.shaker.triggerAttackRelease(d.dur || '32n', this._safe('shaker', time), vel);
        break;
    }
  }

  // M key entry point. Toggles playback. `hud` is the HUD module (for toast).
  async toggle(hud) {
    if (this.isPlaying) {
      this.stop();
      Sound.setMusicDuck(1.0);          // restore in-world stage music
      if (hud) hud.toast('Music off', 1200);
      return;
    }
    // First press: show a quick "loading…" toast since CDN fetch can take
    // 200-800ms on a cold cache.
    const firstLoad = !this.Tone;
    if (firstLoad && hud) hud.toast('Loading music engine…', 1500);
    const ok = await this._ensureLoaded();
    if (!ok) {
      if (hud) hud.toast('Music load failed', 1800);
      return;
    }
    Sound.setMusicDuck(DUCK_LEVEL);     // duck in-world stage music
    await this._playRandom(hud);
  }

  async _playRandom(hud) {
    const tracks = this.manifest && this.manifest.tracks ? this.manifest.tracks : [];
    if (tracks.length === 0) {
      // No manifest / empty manifest — procedural fallback so the M key
      // always produces something. User drops MIDIs in assets/music/ and
      // lists them in manifest.json to replace this.
      this._playProceduralLoop();
      this.isPlaying = true;
      this.currentTrack = '(test loop)';
      if (hud) hud.toast('♪ Test loop — add MIDIs to assets/music/', 2800);
      return;
    }
    const pick = tracks[Math.floor(Math.random() * tracks.length)];
    // Manifest entries can be either a bare filename string OR an object
    // like { file: 'x.mid', name: 'Song Title' }. Normalize both forms.
    const file = (typeof pick === 'string') ? pick : pick.file;
    const trackUrl = `assets/music/${file}`;
    const trackName = (typeof pick === 'string')
      ? file.replace(/\.[^.]+$/, '')              // strip extension for display
      : (pick.name || pick.file);
    try {
      const buf = await fetch(trackUrl).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      });
      const midi = new this.Midi(buf);
      this._schedule(midi);
      this.isPlaying = true;
      this.currentTrack = trackName;
      if (hud) hud.toast(`♪ ${trackName}`, 2200);
    } catch (e) {
      console.warn('[midi] failed to load', trackUrl, e);
      if (hud) hud.toast(`Could not load ${trackName}`, 1800);
      // Failed to start — restore in-world music so the duck doesn't linger.
      Sound.setMusicDuck(1.0);
    }
  }

  // Wire MIDI notes from the parsed file into Tone.Transport-scheduled parts.
  // Each MIDI track becomes a Tone.Part routed to a synth chosen by GM category.
  // trackMeta[] stays aligned to parts[] for getTracks()/setTrackMute().
  _schedule(midi) {
    const T = this.Tone;
    const tr = this.transport;
    tr.stop();
    tr.cancel();
    tr.position = 0;
    const tempo = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120;
    this._baseBpm = tempo;
    tr.bpm.value = tempo;

    this.parts = [];
    this.trackMeta = [];

    let partIndex = 0;
    for (const track of midi.tracks) {
      const events = track.notes.map(n => ({
        time: n.time,
        name: n.name,
        midi: n.midi,                  // raw MIDI note number (needed for drum mapping)
        duration: n.duration,
        velocity: n.velocity,
      }));
      if (events.length === 0) continue;

      // Determine category via GM program map.
      const isPerc = !!(track.instrument && track.instrument.percussion);
      const program = track.instrument ? (track.instrument.number ?? 0) : 0;
      const category = GM_CATEGORY(program, isPerc);
      const trackName = track.name || `Track ${partIndex + 1}`;

      // Capture synths for the closure — category was captured in the loop above.
      const synths  = this._synths;

      const part = new T.Part((time, ev) => {
        switch (category) {
          case 'drums':
            this._triggerDrum(ev.midi, time, ev.velocity);
            break;
          case 'bass':
            synths.bass.triggerAttackRelease(ev.name, ev.duration, time, ev.velocity);
            break;
          case 'pad':
            synths.pad.triggerAttackRelease(ev.name, ev.duration, time, ev.velocity);
            break;
          default: // 'lead'
            synths.lead.triggerAttackRelease(ev.name, ev.duration, time, ev.velocity);
        }
      }, events);
      part.loop = true;
      part.loopEnd = midi.duration;
      part.start(0);
      this.parts.push(part);
      this.trackMeta.push({ i: partIndex, name: trackName, category, muted: false });
      partIndex++;
    }
    tr.start('+0.05');
  }

  // Tiny festive arpeggio so the M key does *something* before the user
  // adds their own MIDIs.
  _playProceduralLoop() {
    const T = this.Tone;
    const tr = this.transport;
    tr.stop();
    tr.cancel();
    this._baseBpm = 120;
    tr.bpm.value = 120;
    const seq = new T.Sequence((time, note) => {
      this.synth.triggerAttackRelease(note, '8n', time, 0.7);
    }, ['C4', 'E4', 'G4', 'B4', 'C5', 'B4', 'G4', 'E4'], '8n');
    seq.loop = true;
    seq.start(0);
    this.parts = [seq];
    this.trackMeta = [{ i: 0, name: 'Procedural loop', category: 'lead', muted: false }];
    tr.start('+0.05');
  }

  // Introspection: returns a snapshot of each scheduled track's metadata.
  // The debug overlay polls this to render the per-track mute panel.
  getTracks() {
    return this.trackMeta.map(m => ({ ...m }));
  }

  // Mute or unmute a track by its index in parts[].
  // Tone.Part.mute = true silences all events without stopping the Part clock.
  setTrackMute(i, muted) {
    if (i < 0 || i >= this.parts.length) return;
    this.parts[i].mute = !!muted;
    if (this.trackMeta[i]) this.trackMeta[i].muted = !!muted;
  }

  stop() {
    if (!this.Tone || !this.transport) return;
    this.transport.stop();
    this.transport.cancel();
    for (const p of this.parts) {
      try { p.dispose(); } catch (e) { /* ignore */ }
    }
    this.parts = [];
    this.trackMeta = [];
    if (this._synths) {
      try { this._synths.lead.releaseAll(); }    catch (e) {}
      try { this._synths.pad.releaseAll(); }     catch (e) {}
      try { this._synths.bass.releaseAll(); }    catch (e) {}
    }
    this.isPlaying = false;
    this.currentTrack = null;
  }

  // Called every frame from main.js with the trip's master envelope
  // (0..1, fade-in/sustain/fade-out gate) AND its progress (0..1, position
  // across the full trip including fades). Mirrors how Trip._writeDynamicCurves
  // shapes the visuals: each audio effect has its OWN personality curve
  // over `progress`, and the whole thing is gated by `envelope` so it
  // ramps in and out cleanly alongside the visual fades.
  //
  // The peak moment is engineered at progress ≈ 1/3, matching the visual
  // posterize spike — that's where vibrato is widest, tempo bottoms out,
  // delay feedback is most aggressive, and a Gaussian bell on top of
  // everything makes the climax clearly audible.
  setTripState(envelope, progress) {
    if (!this.effects) return;
    this._tripEnvelope = envelope;
    const e = this.effects;
    const env = envelope;
    const p = progress;

    // Per-effect curves over `p` — these define each effect's "personality"
    // across the trip, independent of the master envelope gate. Each curve
    // returns 0..1 and is then mapped to its effect's parameter range.
    //
    // peakBell: Gaussian centered at p=1/3 — same "peak moment" as the
    //   visual posterize spike. Width ~0.18 = climax spans ~36s of a 180s
    //   trip. Several effects layer this on top of their baseline to
    //   crescendo at the same moment.
    const peakBell = env > 0
      ? Math.exp(-Math.pow((p - 1 / 3) / 0.18, 2))
      : 0;

    // 1. Vibrato — pitch wobble. Baseline ramps from subtle (0.04) to
    //    moderate (0.30) across the trip, PLUS the bell adds another 0.25
    //    at peak. Frequency slows monotonically toward peak (faster
    //    shimmer at edges, slow seasick wow at climax).
    const vibBase = 0.04 + p * 0.26;
    const vibDepth = vibBase + peakBell * 0.25;
    e.vibrato.depth.rampTo(env * vibDepth + (1 - env) * 0.04, 0.1);
    const vibFreq = 5 - p * 4 + peakBell * (-0.5);
    e.vibrato.frequency.rampTo(env * vibFreq + (1 - env) * 5, 0.1);

    // 2. Short reverb wet — sigmoid up to ~0.55 by p=0.5, holds, gentle
    //    taper after p=0.85. Cathedral opens early, stays through the meat,
    //    then eases slightly at peak as the long reverb dominates.
    const revRamp = this._smoothstep(p, 0.0, 0.5) - this._smoothstep(p, 0.85, 1.0) * 0.4;
    const revWetBase = 0.18 + env * (revRamp * 0.45 + peakBell * 0.15);
    // Ease the short reverb back slightly at the peak so long reverb can shine.
    const revWet = revWetBase - env * peakBell * 0.10;
    e.reverb.wet.rampTo(Math.max(0.12, revWet), 0.2);

    // 3. Long reverb — crossfades IN at the peak via peakBell, then fades
    //    out as the bell passes. "Cathedral opens" is the sensation.
    const longWet = env * peakBell * 0.55;
    e.reverbLong.wet.rampTo(longWet, 0.4);

    // 4. Delay feedback — sum-of-sines oscillation (like the visual
    //    vignettePulse) so echo clouds wax and wane through the trip.
    //    Baseline range 0.30..0.55; peak bell pushes it to ~0.78 (the
    //    runaway zone) at climax.
    const fbOsc =
      0.4
      + 0.20 * Math.sin(p * Math.PI * 2 * 1.5 + 0.8)
      + 0.10 * Math.sin(p * Math.PI * 2 * 3.1 + 1.7);
    const fb = 0.22 + env * (fbOsc * 0.35 + peakBell * 0.20);
    e.delay.feedback.rampTo(Math.min(0.85, fb), 0.15);
    const delayWet = 0.10 + env * (0.25 + peakBell * 0.35);
    e.delay.wet.rampTo(delayWet, 0.15);

    // 5. AutoFilter wet — smooth pseudo-random sum-of-sines (mirrors the
    //    visual brightness pulse). Ramps in over the first quarter, breathes
    //    through middle half, ramps out over last quarter.
    const filterShape =
      0.5
      + 0.30 * Math.sin(p * Math.PI * 2 * 1.7 + 2.4)
      + 0.20 * Math.sin(p * Math.PI * 2 * 2.5 + 3.1);
    let filterGate;
    if (p < 0.25)      filterGate = this._easeInOut(p * 4);
    else if (p > 0.75) filterGate = this._easeInOut((1 - p) * 4);
    else               filterGate = 1.0;
    e.filter.wet.rampTo(env * filterGate * Math.max(0, Math.min(1, filterShape * 0.85)), 0.2);

    // 6. Tempo — bottoms out at the climax (slowest), recovers toward
    //    fadeOut. The world stops at the peak.
    if (this.transport && this._baseBpm > 0) {
      const tempoDrop = env * peakBell * 0.18 + env * p * 0.05;
      this.transport.bpm.rampTo(this._baseBpm * (1 - tempoDrop), 0.5);
    }

    // 7. Granular mix — ramp up ONLY at peak via peakBell; transparent at
    //    mix=0. Capped at 0.65 so the source material stays intelligible.
    if (this._granularNode) {
      const granularMix = env * peakBell * 0.65;
      const mixParam = this._granularNode.parameters.get('mix');
      if (mixParam) mixParam.linearRampToValueAtTime(granularMix, (Sound.getContext()?.currentTime ?? 0) + 0.3);
    }
  }

  // Cubic smoothstep — same shape as Trip._smoothstep but inlined here.
  _smoothstep(x, a, b) {
    if (b <= a) return x >= b ? 1 : 0;
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // Cubic ease-in-out 0..1
  _easeInOut(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
