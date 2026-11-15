// Capture-only frame measurements. Kept separate from AdaptiveQuality because
// its 90-frame window resets on tier changes and cannot attribute one hitch.
import {WORLD_SECTIONS,GROUND_SECTIONS} from './worldTimings.js';
import {FRAME_SECTIONS} from './frameAttribution.js';
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
  return guidedLow && ['auto', 'baseline', 'sustained'].includes(requested) ? requested : null;
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
    this.worldEvents = [];
    this.worldWindowMax = {};
    this.detailGroups = new Map();
    this.droppedGroupFrames = 0;
    this.previousDetail = null;
  }

  record(frame) {
    if (frame.hidden) { this.previousDetail = null; return; }
    const { wallMs, workMs, worldMs, renderMs } = frame;
    if (![wallMs, workMs, worldMs, renderMs].every(Number.isFinite)) { this.previousDetail = null; return; }
    this.window.push({ wallMs, workMs, worldMs, renderMs });
    const previousDetail = this.previousDetail;
    if (frame.frameParts) this.recordDetail(frame);
    else this.previousDetail = null;
    if(frame.worldParts)for(const key of WORLD_SECTIONS){
      const value=frame.worldParts[key];
      if(Number.isFinite(value))this.worldWindowMax[key]=Math.max(this.worldWindowMax[key]||0,value);
    }
    if (wallMs < this.hitchMs && workMs < this.hitchMs) return;
    if (this.events.length === this.maxEvents) {
      this.events.shift();
      this.droppedEvents++;
    }
    const event={
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
    };
    if (frame.frameParts) {
      event.frameParts = Object.fromEntries(FRAME_SECTIONS.map(key => [key, frame.frameParts[key] ?? null]));
      event.frameCalls = Object.fromEntries(FRAME_SECTIONS.map(key => [key, frame.frameCalls?.[key] ?? 0]));
      event.frameClockReads = frame.frameClockReads;
      event.physicsStats = frame.physicsStats ? {...frame.physicsStats} : null;
      event.quality = frame.quality ?? null;
      event.qualityLevel = frame.qualityLevel ?? null;
      const aligned = previousDetail && Number.isFinite(frame.previousCallbackMs);
      event.previousCallbackMs = aligned ? frame.previousCallbackMs : null;
      event.previousPhase = aligned ? previousDetail.phase ?? null : null;
      event.previousQuality = aligned ? previousDetail.quality ?? null : null;
      event.previousQualityLevel = aligned ? previousDetail.qualityLevel ?? null : null;
      event.outsideCallbackMs = aligned ? wallMs - frame.previousCallbackMs : null;
      event.outsideBodyMs = aligned && Number.isFinite(frame.previousWorkMs) ? wallMs - frame.previousWorkMs : null;
    }
    if(frame.worldParts){
      event.worldParts=Object.fromEntries(WORLD_SECTIONS.map(k=>[k,round(frame.worldParts[k]||0)]));
      event.worldGround=Object.fromEntries(GROUND_SECTIONS.map(k=>[k,round(frame.worldGround?.[k]||0)]));
      event.worldClockReads=frame.worldClockReads;
      // Retain early large world stalls even after the chronological ring wraps.
      if(worldMs>=this.hitchMs){
        this.worldEvents.push(event);this.worldEvents.sort((a,b)=>b.worldMs-a.worldMs||a.ts-b.ts);
        if(this.worldEvents.length>24)this.worldEvents.pop();
      }
    }
    this.events.push(event);
  }

  detailGroup(meta) {
    const key = JSON.stringify([meta.phase ?? null, meta.quality ?? null, meta.qualityLevel ?? null]);
    if (this.detailGroups.has(key)) return this.detailGroups.get(key);
    // A corrupt/free-form label cannot grow capture memory without a bound.
    if (this.detailGroups.size >= 64) { this.droppedGroupFrames++; return null; }
    const group = {phase: meta.phase ?? null, quality: meta.quality ?? null,
      qualityLevel: meta.qualityLevel ?? null, frames: 0, sectionMs: {}, sectionFrames: {}, sectionCalls: {},
      clockReads: 0, walls: [], works: [],
      outsideBody: {count: 0, sumMs: 0, maxMs: null}, outsideCallback: {count: 0, sumMs: 0, maxMs: null},
      physics: {frames: 0, steps: 0, maxSteps: 0, meanStepMsSum: 0, meanStepMsFrames: 0, maxStepMs: 0},
      programs: {count: 0, first: null, last: null, min: null, max: null, changes: 0}};
    this.detailGroups.set(key, group);
    return group;
  }

  recordDetail(frame) {
    const previous = this.previousDetail;
    // Start-to-start wall belongs to the preceding callback, including across
    // phase/rung/window boundaries. Null callback duration marks discontinuity.
    if (previous && Number.isFinite(frame.previousCallbackMs)) {
      const owner = this.detailGroup(previous);
      if (owner) owner.walls.push(frame.wallMs);
      if (owner) for (const [name, duration] of [['outsideBody', frame.previousWorkMs], ['outsideCallback', frame.previousCallbackMs]]) {
        if (!Number.isFinite(duration)) continue;
        const gap = frame.wallMs - duration, totals = owner[name];
        totals.count++; totals.sumMs += gap;
        totals.maxMs = totals.maxMs === null ? gap : Math.max(totals.maxMs, gap);
      }
    }
    const group = this.detailGroup(frame);
    if (group) {
      group.frames++;
      group.works.push(frame.workMs);
      for (const key of FRAME_SECTIONS) {
        const value = frame.frameParts[key];
        if (Number.isFinite(value)) {
          group.sectionMs[key] = (group.sectionMs[key] || 0) + value;
          group.sectionFrames[key] = (group.sectionFrames[key] || 0) + 1;
        }
        if (Number.isFinite(frame.frameCalls?.[key])) group.sectionCalls[key] = (group.sectionCalls[key] || 0) + frame.frameCalls[key];
      }
      group.clockReads += frame.frameClockReads || 0;
      const physics = frame.physicsStats;
      if (Number.isFinite(physics?.frameSteps)) {
        group.physics.frames++; group.physics.steps += physics.frameSteps;
        group.physics.maxSteps = Math.max(group.physics.maxSteps, physics.frameSteps);
      }
      if (Number.isFinite(physics?.meanStepMs)) {
        group.physics.meanStepMsSum += physics.meanStepMs; group.physics.meanStepMsFrames++;
      }
      if (Number.isFinite(physics?.maxStepMs)) group.physics.maxStepMs = Math.max(group.physics.maxStepMs, physics.maxStepMs);
      if (Number.isFinite(frame.programCount)) {
        const programs = group.programs;
        if (!programs.count) programs.first = programs.min = programs.max = frame.programCount;
        programs.count++; programs.last = frame.programCount;
        programs.min = Math.min(programs.min, frame.programCount); programs.max = Math.max(programs.max, frame.programCount);
        if (previous && Number.isFinite(previous.programCount) && previous.programCount !== frame.programCount) programs.changes++;
      }
    }
    this.previousDetail = {phase: frame.phase, quality: frame.quality, qualityLevel: frame.qualityLevel, programCount: frame.programCount};
  }

  takeWindow() {
    const frames = this.window;
    this.window = [];
    if (!frames.length) return null;
    const walls = frames.map((f) => f.wallMs);
    const works = frames.map((f) => f.workMs);
    const worldPartsMax=this.worldWindowMax;this.worldWindowMax={};
    const detail = this.detailGroups.size ? {
      groups: Array.from(this.detailGroups.values(), ({walls, works, ...group}) => ({...group,
        wallFrames: walls.length, wallP50: percentile(walls, 0.5), wallP95: percentile(walls, 0.95),
        workSumMs: works.reduce((sum, value) => sum + value, 0),
        workP95: percentile(works, 0.95), workMax: works.length ? Math.max(...works) : null})),
      droppedGroupFrames: this.droppedGroupFrames,
    } : null;
    this.detailGroups = new Map(); this.droppedGroupFrames = 0;
    return {
      ...(detail ? {detail} : {}),
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
      ...(Object.keys(worldPartsMax).length?{worldPartsMax:Object.fromEntries(Object.entries(worldPartsMax).map(([k,v])=>[k,round(v)]))}:{}),
    };
  }
}
