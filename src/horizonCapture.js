// Installed only by explicit capture mode. No renderer or worldgen imports.
// A planner commit is not a publication: only _commitApply changes the horizon.
export function attachHorizonCapture(ff, options) {
  if (!ff?.enabled || ff.disposed) return null;
  if (ff.captureProbe) return ff.captureProbe;
  const sourceNow = options?.now || (() => performance.now());
  let clockReadsTotal = 0;
  const now = () => { clockReadsTotal++; return sourceNow(); };
  const started = now();
  const restore = [];
  let disposed = false;
  let publishedAt = null, firstPublicationMs = null, publishedCell = null;
  let firstRequestedAt = null, firstRequestToPublicationMs = null;
  let requestedCell = ff._playerCell ?? null, requestedCells = 0, cellsSincePublication = 0;
  let applySuperseded = ff.stats.applySuperseded || 0;
  let planSuperseded = ff.planner.superseded || 0;
  let streak = 0, streakMax = 0, publications = 0;
  let unitMs = 0, unitKind = null, preparationMs = 0, roadSliceMs = 0;

  function replace(target, key, value) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    restore.push(() => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else delete target[key];
    });
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
  }
  function counters() {
    const apply = ff.stats.applySuperseded || 0;
    const plan = ff.planner?.superseded ?? planSuperseded;
    streak += Math.max(0, apply - applySuperseded) + Math.max(0, plan - planSuperseded);
    streakMax = Math.max(streakMax, streak);
    applySuperseded = apply;
    planSuperseded = plan;
  }
  function recordUnit(kind, start) {
    const ms = now() - start;
    if (ms > unitMs) { unitMs = ms; unitKind = kind; }
  }
  function wrap(target, name, body) {
    const original = target[name];
    replace(target, name, function (...args) { return body(original, this, args); });
  }
  const probe = {
    now,
    recordPreparation(start) { preparationMs = Math.max(preparationMs, now() - start); },
    recordGrounding(start) { recordUnit('ground-instance', start); },
    snapshot() {
      counters();
      return {
        ffPublishedAgeMs: publishedAt === null ? null : now() - publishedAt,
        ffFirstPublicationMs: firstPublicationMs,
        ffAwaitingFirstPublicationMs: publishedAt === null ? now() - started : null,
        ffFirstRequestToPublicationMs: firstRequestToPublicationMs,
        ffAwaitingFirstRequestPublicationMs: firstRequestedAt !== null && publishedAt === null ? now() - firstRequestedAt : null,
        ffPublishedCell: publishedCell, ffRequestedCell: requestedCell,
        ffRequestedCells: requestedCells, ffCellsSincePublication: cellsSincePublication,
        ffPublications: publications,
        ffApplySuperseded: applySuperseded, ffPlanSuperseded: planSuperseded,
        ffSupersededStreak: streak, ffSupersededStreakMax: streakMax,
        ffUnitMs: unitMs, ffUnitKind: unitKind,
        // These routines can yield or contain multiple units. They are call
        // durations, never evidence of the largest indivisible terrain unit.
        ffPreparationCallMs: preparationMs, ffRoadSliceMs: roadSliceMs,
        ffClockReadsTotal: clockReadsTotal,
      };
    },
    dispose() {
      if (disposed) return;
      counters();
      disposed = true;
      for (let i = restore.length - 1; i >= 0; i--) restore[i]();
    },
  };
  replace(ff, 'captureProbe', probe);
  wrap(ff.planner, 'begin', (original, receiver, args) => {
    if (firstRequestedAt === null) firstRequestedAt = now();
    const result = original.apply(receiver, args);
    if (args[0] !== requestedCell) {
      requestedCell = args[0]; requestedCells++; cellsSincePublication++;
    }
    counters();
    return result;
  });
  wrap(ff, '_beginApply', (original, receiver, args) => {
    const start = now();
    try { return original.apply(receiver, args); }
    finally { recordUnit('begin-publication', start); }
  });
  wrap(ff, '_commitApply', (original, receiver, args) => {
    counters();
    const start = now();
    const result = original.apply(receiver, args);
    recordUnit('publish', start);
    publishedAt = now();
    if (firstPublicationMs === null) {
      firstPublicationMs = publishedAt - started;
      firstRequestToPublicationMs = firstRequestedAt === null ? null : publishedAt - firstRequestedAt;
    }
    publishedCell = ff.planner.committed?.version ?? requestedCell;
    publications++; cellsSincePublication = 0; streak = 0;
    return result;
  });
  wrap(ff, '_planRoads', (original, receiver, args) => {
    const start = now();
    try { return original.apply(receiver, args); }
    finally { roadSliceMs = Math.max(roadSliceMs, now() - start); }
  });
  wrap(ff, 'dispose', (original, receiver, args) => {
    probe.dispose();
    return original.apply(receiver, args);
  });
  return probe;
}
