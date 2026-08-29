// runState — the Festival Run lifecycle machine: run clock, day counter,
// sputter (dry-death grace), vibe meter (marshal ladder), death causes, and
// the once-per-run Lurleen rescue flag. Pure logic: main.js feeds it inputs
// (dt, time-of-day t, juice level) and acts on the string events it returns —
// no DOM, no three, so bin/test-run-state drives it straight in node.
//
// Day counting: the ToD cycle's normalized t wraps 1→0 at "midnight-end"; a
// wrap while a run is active increments the day. `prevT` MUST initialize from
// the restored t on resume (never a fresh-boot default) or a reload near the
// boundary double-counts a day — council acceptance line, locked by the test.

import { VIBE, SPUTTER_GRACE_SEC } from './runMode.js';

const R = {
  active: false,
  clock: 0,          // seconds of run time
  day: 1,
  prevT: null,       // last seen ToD t (null until first tick or restore)
  sputter: false,
  sputterLeft: 0,
  vibe: 0,           // decaying strike total
  vibeWarned: false, // warn fired for the current climb
  rescueUsed: false,
  over: false,
  cause: null,       // 'ran_dry' | 'vibed_out'
};

const JUICE_DRY_EPS = 0.02;   // matches main.js's empty-tank edge detect

export const RunState = {
  get active() { return R.active; },
  get day() { return R.day; },
  get clock() { return R.clock; },
  get sputter() { return R.sputter; },
  get sputterLeft() { return R.sputterLeft; },
  get vibe() { return R.vibe; },
  get over() { return R.over; },
  get cause() { return R.cause; },
  get rescueUsed() { return R.rescueUsed; },

  begin() {
    R.active = true; R.clock = 0; R.day = 1; R.prevT = null;
    R.sputter = false; R.sputterLeft = 0;
    R.vibe = 0; R.vibeWarned = false;
    R.rescueUsed = false; R.over = false; R.cause = null;
  },

  end() { R.active = false; },

  // Advance the run clock + detect day wraps. Returns true when a new day
  // just started. First call (prevT null) only latches — never increments.
  tickDay(dt, todT) {
    if (!R.active || R.over) return false;
    R.clock += dt;
    if (!Number.isFinite(todT)) return false;
    let crossed = false;
    if (R.prevT != null && todT < R.prevT - 0.5) {   // wrapped 1 → 0
      R.day += 1;
      crossed = true;
    }
    R.prevT = todT;
    return crossed;
  },

  // Sputter state from the live juice level. Returns 'start' | 'end' |
  // 'expired' | null. 'expired' = the grace ran out with the tank still dry —
  // the caller decides rescue vs `ran_dry`.
  tickSputter(dt, juice) {
    if (!R.active || R.over) return null;
    const dry = juice <= JUICE_DRY_EPS;
    if (!R.sputter) {
      if (!dry) return null;
      R.sputter = true;
      R.sputterLeft = SPUTTER_GRACE_SEC;
      return 'start';
    }
    if (!dry) {
      R.sputter = false;
      R.sputterLeft = 0;
      return 'end';
    }
    R.sputterLeft -= dt;
    if (R.sputterLeft <= 0) {
      R.sputterLeft = 0;
      return 'expired';
    }
    return null;
  },

  // Rescue consumes exactly once. After a rescue the sputter state resets so
  // the refilled tank re-enters cleanly.
  useRescue() {
    if (R.rescueUsed) return false;
    R.rescueUsed = true;
    R.sputter = false;
    R.sputterLeft = 0;
    return true;
  },

  // A vibe strike lands (weight: VIBE.hitStrike for a damaging people-hit,
  // VIBE.frownStrike for a frown loss). `limits` = {warn, eject} from the
  // mode config at the current day. Returns 'warn' | 'eject' | null.
  addStrike(weight, limits) {
    if (!R.active || R.over || !limits) return null;
    R.vibe += weight;
    if (R.vibe >= limits.eject) return 'eject';
    if (!R.vibeWarned && R.vibe >= limits.warn) {
      R.vibeWarned = true;
      return 'warn';
    }
    return null;
  },

  tickVibe(dt, limits) {
    if (!R.active || R.over) return;
    if (R.vibe > 0) R.vibe = Math.max(0, R.vibe - VIBE.decayPerSec * dt * 1);
    // Re-arm the warning once the meter has cooled well below the line.
    if (limits && R.vibeWarned && R.vibe < limits.warn * 0.5) R.vibeWarned = false;
  },

  // 0..1 for the HUD widget (fraction of the ejection limit).
  vibeFraction(limits) {
    if (!limits || limits.eject <= 0) return 0;
    return Math.max(0, Math.min(1, R.vibe / limits.eject));
  },

  endRun(cause) {
    if (!R.active || R.over) return false;
    R.over = true;
    R.cause = cause;
    return true;
  },

  // Harness-only setters (__dbg.runDay / __dbg.vibe) — Day-5 tuning must not
  // cost 30 real minutes of driving (council; harness doctrine).
  debugSetDay(n) { R.day = Math.max(1, Math.floor(n) || 1); return R.day; },
  debugSetVibe(v) { R.vibe = Math.max(0, Number(v) || 0); return R.vibe; },
  debugSetSputterLeft(s) { if (R.sputter) R.sputterLeft = Math.max(0.01, Number(s) || 0.01); return R.sputterLeft; },

  serialize() {
    return { active: R.active, clock: R.clock, day: R.day, prevT: R.prevT,
             sputter: R.sputter, sputterLeft: R.sputterLeft, vibe: R.vibe,
             vibeWarned: R.vibeWarned, rescueUsed: R.rescueUsed,
             over: R.over, cause: R.cause };
  },
  restore(o) {
    if (!o) return;
    R.active = !!o.active;
    R.clock = Number(o.clock) || 0;
    R.day = Math.max(1, Math.floor(o.day) || 1);
    R.prevT = Number.isFinite(o.prevT) ? o.prevT : null;
    R.sputter = !!o.sputter;
    R.sputterLeft = Math.max(0, Number(o.sputterLeft) || 0);
    R.vibe = Math.max(0, Number(o.vibe) || 0);
    R.vibeWarned = !!o.vibeWarned;
    R.rescueUsed = !!o.rescueUsed;
    R.over = !!o.over;
    R.cause = o.cause || null;
  },
};
