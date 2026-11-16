// The stage scheduler works ahead of the speakers. Retain its actual notes and
// sample them at AudioContext.currentTime, without creating per-frame objects.
export function silentPerformance(out, state, style, time = 0) {
  out.state = state;
  out.playing = false;
  out.time = time;
  out.style = style;
  out.beat = out.beatPhase = out.intensity = 0;
  out.section = '';
  out.leadPitch = out.bassPitch = 0;
  out.lead = out.bass = out.chord = out.kick = out.snare = out.hat = 0;
  return out;
}

export function createStagePerformanceClock(ctx, style) {
  // Eight beats cover the 0.6s lookahead plus the longest 1.8-beat note.
  // The busiest current beat uses eight attacks. Reuse all slots on rollover.
  const slots = Array.from({ length: 8 }, () => ({
    start: -Infinity, duration: 0, beat: 0, section: '', intensity: 0, count: 0,
    lanes: new Array(16), times: new Float64Array(16), lengths: new Float64Array(16),
    pitches: new Float64Array(16),
  }));
  let index = 0, stopped = false, gapAt = Infinity;
  return {
    beat(at, duration, beat, section, intensity) {
      index = (index + 1) % slots.length;
      const s = slots[index];
      s.start = at; s.duration = duration; s.beat = beat;
      s.section = section; s.intensity = intensity; s.count = 0;
      if (at >= gapAt) gapAt = Infinity;
    },
    note(lane, at, length, pitch = 0) {
      const s = slots[index], i = s.count++;
      if (i >= s.times.length) throw new Error('Stage beat exceeded its cue capacity');
      s.lanes[i] = lane; s.times[i] = at; s.lengths[i] = length; s.pitches[i] = pitch;
    },
    gap(at) { gapAt = at; },
    stop() { stopped = true; },
    sample(out) {
      const now = ctx.currentTime;
      let state = 'pending';
      if (stopped) state = 'stopped';
      else if (ctx.state !== 'running') state = 'suspended';
      else if (now >= gapAt) state = 'gap';
      silentPerformance(out, state, style, now);
      if (state !== 'pending') return out;
      let active, leadSeen = false, bassSeen = false;
      for (let back = 0; back < slots.length; back++) {
        const s = slots[(index + slots.length - back) % slots.length];
        if (s.start > now) continue;
        if (!active) {
          if (now >= s.start + s.duration) {
            if (s.duration) out.state = 'gap'; // the scheduler has not supplied another beat
            break;
          }
          active = s;
          out.playing = true; out.state = 'playing';
          out.beat = s.beat; out.beatPhase = (now - s.start) / s.duration;
          out.section = s.section; out.intensity = s.intensity;
        }
        // Notes never extend beyond two beats. Ignore older slots, including
        // slots from a previous song across its 4.5-second cheer gap.
        if (now >= s.start + s.duration * 2) break;
        for (let i = s.count - 1; i >= 0; i--) {
          const age = now - s.times[i];
          if (age < 0) continue;
          const lane = s.lanes[i];
          // A new monophonic note replaces its predecessor even if the old
          // envelope would have extended beyond the new note's release.
          if (lane === 'lead') {
            if (leadSeen) continue;
            leadSeen = true;
            if (age < s.lengths[i]) out.leadPitch = s.pitches[i];
          } else if (lane === 'bass') {
            if (bassSeen) continue;
            bassSeen = true;
            if (age < s.lengths[i]) out.bassPitch = s.pitches[i];
          }
          if (age >= s.lengths[i]) continue;
          out[lane] = Math.max(out[lane], 1 - age / s.lengths[i]);
        }
      }
      return out;
    },
  };
}
