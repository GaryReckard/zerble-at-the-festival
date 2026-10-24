// A small, timer-free acoustic ensemble. The caller supplies Sound's unlocked
// context and spatial music destination, and drives tick from its own updater.
export const CAMP_INSTRUMENTS = Object.freeze(['guitar', 'banjo', 'bass', 'fiddle', 'mandolin']);
const CHORDS = [0, 5, 0, 7, 0, 5, 7, 0];
const SCALE = [0, 2, 4, 7, 9];
const MAX_VOICES = 32;
function hash(seed, index) {
  let n = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 0x21f0aaad);
  n = Math.imul(n ^ n >>> 15, 0x735a2d97);
  return (n ^ n >>> 15) >>> 0;
}
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

// Stateless score generation means skipping an overdue beat cannot consume a
// different RNG stream or throw the returning ensemble out of harmony.
export function campJamNotes(seed, instruments, step) {
  const bar = Math.floor(step / 8), eighth = step % 8;
  const key = [48, 50, 55, 57][hash(seed, 0) % 4];
  const root = key + CHORDS[(bar + (hash(seed, 1) % 4)) % CHORDS.length];
  const notes = [];
  for (const kind of instruments) {
    if (!CAMP_INSTRUMENTS.includes(kind)) continue;
    const variation = hash(seed ^ (CAMP_INSTRUMENTS.indexOf(kind) * 907), Math.floor(step / 16));
    if (kind === 'bass') {
      if (eighth % 4 === 0) notes.push({ kind, midi: root - 12 + (eighth === 4 ? 7 : 0), duration: 1.35, gain: .17 });
    } else if (kind === 'guitar') {
      if (eighth % 2 === 0) {
        for (const interval of [0, 4, 7]) notes.push({ kind, midi: root + interval, duration: .72, gain: .055, delay: interval * .004 });
      }
    } else if (kind === 'banjo') {
      const roll = [0, 7, 12, 4, 7, 12, 7, 4];
      if (!(eighth === 7 && variation % 3 === 0)) notes.push({ kind, midi: root + 12 + roll[(eighth + variation % 3) % 8], duration: .32, gain: .065 });
    } else if (kind === 'mandolin') {
      if (eighth % 4 === 2) {
        for (const interval of [4, 7]) notes.push({ kind, midi: root + 12 + interval, duration: .25, gain: .06, delay: interval * .002 });
      }
    } else if (eighth % 2 === 0 && !(eighth === 6 && bar % 4 === 3)) {
      // Pentatonic phrases use the shared key, with chord-root landings at bar
      // boundaries and breathing room before the next phrase.
      const midi = eighth === 0 ? root + 12 : key + 12 + SCALE[(Math.floor(step / 2) + variation % 5) % SCALE.length];
      notes.push({ kind, midi, duration: .68, gain: .045 });
    }
  }
  return notes;
}

export function createCampJam(ctx, output, { seed = 1, instruments = ['guitar', 'bass'] } = {}) {
  if (!ctx || !output) throw new TypeError('Camp music requires Sound’s initialized context and destination');
  const ensemble = [...new Set(instruments.filter(kind => CAMP_INSTRUMENTS.includes(kind)))].slice(0, 4);
  const bpm = 80 + hash(seed, 2) % 23, eighthSeconds = 30 / bpm;
  const bus = ctx.createGain(); bus.gain.value = .65; bus.connect(output);
  const active = new Set();
  let stopped = false, nextStep = 0, origin = null;
  const stats = { scheduled: 0, skippedSteps: 0, peakVoices: 0, get activeVoices() { return active.size; } };
  function voice(note, time) {
    if (active.size >= MAX_VOICES) return;
    const oscillator = ctx.createOscillator(), envelope = ctx.createGain(), filter = ctx.createBiquadFilter();
    const bow = note.kind === 'fiddle', bass = note.kind === 'bass';
    oscillator.type = bow ? 'sawtooth' : bass || note.kind === 'guitar' ? 'triangle' : 'sawtooth';
    oscillator.frequency.setValueAtTime(hz(note.midi), time);
    filter.type = 'lowpass'; filter.Q.value = bow ? .7 : 1.1;
    filter.frequency.setValueAtTime(bow ? 2100 : bass ? 650 : note.kind === 'banjo' ? 4800 : 3300, time);
    if (!bow) filter.frequency.exponentialRampToValueAtTime(bass ? 160 : 700, time + note.duration);
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.exponentialRampToValueAtTime(note.gain, time + (bow ? .09 : .006));
    if (bow) envelope.gain.setValueAtTime(note.gain * .78, time + note.duration * .65);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + note.duration);
    oscillator.connect(filter); filter.connect(envelope); envelope.connect(bus);
    const record = { oscillator, envelope, filter };
    active.add(record); stats.peakVoices = Math.max(stats.peakVoices, active.size); stats.scheduled++;
    oscillator.onended = () => {
      active.delete(record);
      oscillator.disconnect(); filter.disconnect(); envelope.disconnect();
    };
    oscillator.start(time); oscillator.stop(time + note.duration + .02);
  }
  return {
    bpm, instruments: ensemble, stats,
    tick(now = ctx.currentTime) {
      if (stopped || ctx.state === 'suspended') return;
      if (origin === null) origin = now + .025;
      const currentStep = Math.max(0, Math.floor((now - origin) / eighthSeconds));
      if (nextStep < currentStep) { stats.skippedSteps += currentStep - nextStep; nextStep = currentStep; }
      // Never replay elapsed music after tab sleep. At most two future eighths
      // are admitted in one update, regardless of elapsed wall-clock time.
      for (let emitted = 0; emitted < 2 && origin + nextStep * eighthSeconds <= now + .12; emitted++, nextStep++) {
        const time = Math.max(now + .005, origin + nextStep * eighthSeconds);
        for (const note of campJamNotes(seed, ensemble, nextStep)) voice(note, time + (note.delay || 0));
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      for (const { oscillator, envelope, filter } of active) {
        try { oscillator.stop(); } catch { /* A naturally ended voice is already silent. */ }
        oscillator.onended = null;
        oscillator.disconnect(); filter.disconnect(); envelope.disconnect();
      }
      active.clear(); bus.disconnect();
    },
  };
}
