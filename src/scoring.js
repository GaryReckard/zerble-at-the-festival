// scoring — the single writer for smiles (festival-run-stakes design D4).
// Every gain (pickup collect, future quest awards, __dbg.addSmiles), every
// loss (frown, hit damage, vendor spend), and all combo state flow through
// here; main.js keeps no score variable of its own.
//
// Stakes off (Just Cruisin'): multiplier is locked to 1 and no chain state
// accumulates — the module is a plain counter, byte-for-byte today's scoring.
// Stakes on (Festival Run): rapid collects build a chain (window refreshes on
// each collect); the multiplier is the count of COMBO.levels thresholds the
// chain has crossed, star power pins it at cap, and Lurleen following doubles
// the whole thing multiplicatively (x4 · ♥x2 = x8).
//
// The leaderboard records `highWater` — the run's peak — so spending smiles
// (vendor refills) digs a hole below the peak but never erases it.
//
// DOM-free and three-free so bin/test-scoring runs it straight in node.

import { COMBO } from './runMode.js';

const S = {
  stakes: false,
  current: 0,
  highWater: 0,
  chain: 0,        // smiles collected inside the rolling window
  chainTimer: 0,   // seconds left before the chain fizzles
  doubler: false,  // Lurleen following
  pinned: false,   // star power
  bestMult: 1,     // best multiplier reached this run (score-screen stat)
};

function chainLevel() {
  for (let i = COMBO.levels.length - 1; i >= 0; i--) {
    if (S.chain >= COMBO.levels[i]) return i + 1;
  }
  return 1;
}

export const Scoring = {
  // Called once at boot (and on mode switch in drills). Stakes off resets
  // combo state so nothing leaks across modes.
  configure({ stakes = false } = {}) {
    S.stakes = !!stakes;
    if (!S.stakes) { S.chain = 0; S.chainTimer = 0; S.doubler = false; S.pinned = false; }
  },

  reset({ current = 0, highWater = 0, bestMult = 1 } = {}) {
    S.current = Math.max(0, Math.floor(current));
    S.highWater = Math.max(S.current, Math.floor(highWater));
    S.chain = 0; S.chainTimer = 0; S.doubler = false; S.pinned = false;
    S.bestMult = Math.max(1, Math.floor(bestMult));
  },

  get current() { return S.current; },
  get highWater() { return S.highWater; },
  get bestCombo() { return S.bestMult; },
  get stakes() { return S.stakes; },

  multiplier() {
    if (!S.stakes) return 1;
    return (S.pinned ? COMBO.maxMult : chainLevel()) * (S.doubler ? COMBO.lurleenMult : 1);
  },

  // 0..1 fraction of the chain window remaining — the HUD ring reads this.
  chainFraction() {
    return S.stakes && S.chainTimer > 0 ? S.chainTimer / COMBO.chainWindowSec : 0;
  },

  // n smiles arrived (already coalesced per-frame by the caller). Returns the
  // score gained after multipliers.
  collect(n = 1) {
    const count = Math.max(0, Math.floor(n));
    if (!count) return 0;
    const mult = this.multiplier();
    const gained = count * mult;
    S.current += gained;
    if (S.current > S.highWater) S.highWater = S.current;
    if (S.stakes) {
      S.chain += count;
      S.chainTimer = COMBO.chainWindowSec;
      const after = this.multiplier();
      if (after > S.bestMult) S.bestMult = after;
    }
    return gained;
  },

  // External systems (passenger quests, future) award through the same door —
  // per the festival-run spec, awards behave exactly like organic collects.
  award(n = 1) { return this.collect(n); },

  deduct(n = 1) {
    S.current = Math.max(0, S.current - Math.max(0, Math.floor(n)));
    return S.current;
  },

  breakCombo() { S.chain = 0; S.chainTimer = 0; },

  setDoubler(on) { S.doubler = S.stakes && !!on; },

  pinCombo(on) { S.pinned = S.stakes && !!on; },
  get doubler() { return S.doubler; },

  tick(dt) {
    if (!S.stakes || S.chainTimer <= 0) return;
    S.chainTimer -= dt;
    if (S.chainTimer <= 0) { S.chainTimer = 0; S.chain = 0; }   // fizzle, not a break
  },

  // Resume-snapshot plumbing (sessionStorage survives a settings reload).
  serialize() {
    return { current: S.current, highWater: S.highWater, bestMult: S.bestMult,
             chain: S.chain, chainTimer: S.chainTimer };
  },
  restore(o) {
    if (!o) return;
    this.reset({ current: o.current, highWater: o.highWater, bestMult: o.bestMult });
    S.chain = Math.max(0, Math.floor(o.chain || 0));
    S.chainTimer = Math.max(0, Number(o.chainTimer) || 0);
  },
};
