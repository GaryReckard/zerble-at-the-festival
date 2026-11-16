import {silentPerformance} from './stagePerformanceClock.js';

// Each stage samples its own audio transport once per accepted display frame,
// then lends that same snapshot to every musician. No global beat or timers.
export function createStageBand(performers, music = null, style = 'jam') {
  return {performers, music, style, cue: {}, sampledAt: NaN, sampledHandle: null};
}

export function sampleStageBand(band, seconds) {
  const handle = typeof band.music === 'function' ? band.music() : band.music;
  if (band.sampledAt === seconds && band.sampledHandle === handle) return band.cue;
  band.sampledAt = seconds;
  band.sampledHandle = handle;
  if (handle?.samplePerformance) handle.samplePerformance(band.cue);
  else silentPerformance(band.cue, 'pending', band.style, seconds);
  return band.cue;
}

export function animateStageBand(band, seconds, heldCue = null) {
  const cue = heldCue ?? sampleStageBand(band, seconds);
  for (let i = 0; i < band.performers.length; i++) {
    band.performers[i].userData.animate?.(seconds + i * 1.7, cue);
  }
  return cue;
}
