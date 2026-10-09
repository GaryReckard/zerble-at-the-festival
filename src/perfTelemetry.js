// Capture-only frame measurements. Kept separate from AdaptiveQuality because
// its 90-frame window resets on tier changes and cannot attribute one hitch.
const round = (n) => Math.round(n * 10) / 10;

export const PLAYTEST_SCENARIOS = Object.freeze({
  parked: [
    { id: 'settle', seconds: 20, instruction: 'Controls paused while the world settles.' },
    { id: 'parked', seconds: 40, instruction: 'Controls paused. Compare clarity and smoothness; tap FELT LAG if needed.' },
  ],
  drive: [
    { id: 'settle', seconds: 20, instruction: 'Controls paused while the world settles.' },
    { id: 'parked', seconds: 25, instruction: 'Controls paused for the baseline.' },
    { id: 'drive', seconds: 90, instruction: 'Drive normally. Tap FELT LAG whenever it stutters.' },
    { id: 'parked-after', seconds: 20, instruction: 'Controls paused for the recovery check.' },
  ],
  trip: [
    { id: 'settle', seconds: 20, instruction: 'Controls paused while the world settles.' },
    { id: 'baseline', seconds: 25, instruction: 'Controls paused. The trip will start automatically.' },
    { id: 'fade-in', seconds: 12, instruction: 'Controls paused while the trip fades in.' },
    { id: 'active', seconds: 20, instruction: 'Controls paused while the trip runs.' },
    { id: 'peak', seconds: 20, instruction: 'Controls paused while the peak is held.' },
    { id: 'after', seconds: 20, instruction: 'Controls paused for the after comparison.' },
  ],
});

export function resolveCaptureQualityPolicy(search, tier) {
  const params = new URLSearchParams(search);
  const guidedLow = params.get('perfCapture') === '1' &&
    Object.hasOwn(PLAYTEST_SCENARIOS, params.get('perfScenario')) && tier === 'low';
  const requested = params.get('perfQuality');
  return guidedLow && (requested === 'auto' || requested === 'baseline') ? requested : null;
}

export function phaseForElapsed(scenario, elapsedSeconds) {
  const phases = PLAYTEST_SCENARIOS[scenario];
  if (!phases) return null;
  let start = 0;
  for (let index = 0; index < phases.length; index++) {
    const phase = phases[index];
    if (elapsedSeconds < start + phase.seconds) {
      return { ...phase, index, remaining: Math.ceil(start + phase.seconds - elapsedSeconds) };
    }
    start += phase.seconds;
  }
  return null;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return round(sorted[Math.ceil(sorted.length * fraction) - 1]);
}

export class FrameTelemetry {
  constructor({ hitchMs = 50, maxEvents = 240 } = {}) {
    this.hitchMs = hitchMs;
    this.maxEvents = maxEvents;
    this.reset();
  }

  reset() {
    this.window = [];
    this.events = [];
    this.droppedEvents = 0;
  }

  record(frame) {
    if (frame.hidden) return;
    const { wallMs, workMs, worldMs, renderMs } = frame;
    if (![wallMs, workMs, worldMs, renderMs].every(Number.isFinite)) return;
    this.window.push({ wallMs, workMs, worldMs, renderMs });
    if (wallMs < this.hitchMs && workMs < this.hitchMs) return;
    if (this.events.length === this.maxEvents) {
      this.events.shift();
      this.droppedEvents++;
    }
    this.events.push({
      ts: frame.ts,
      phase: frame.phase || null,
      wallMs: round(wallMs),
      workMs: round(workMs),
      previousWorkMs: round(frame.previousWorkMs || 0),
      worldMs: round(worldMs),
      renderMs: round(renderMs),
      x: frame.x,
      z: frame.z,
      chunkCount: frame.chunkCount,
      programCount: frame.programCount,
    });
  }

  takeWindow() {
    const frames = this.window;
    this.window = [];
    if (!frames.length) return null;
    const walls = frames.map((f) => f.wallMs);
    const works = frames.map((f) => f.workMs);
    return {
      frames: frames.length,
      wallP50: percentile(walls, 0.5),
      wallP95: percentile(walls, 0.95),
      wallP99: percentile(walls, 0.99),
      wallMax: round(Math.max(...walls)),
      workP95: percentile(works, 0.95),
      workMax: round(Math.max(...works)),
      worldMax: round(Math.max(...frames.map((f) => f.worldMs))),
      renderMax: round(Math.max(...frames.map((f) => f.renderMs))),
      over33: walls.filter((n) => n > 33).length,
      over50: walls.filter((n) => n > 50).length,
      over100: walls.filter((n) => n > 100).length,
    };
  }
}
