// runMode — the single mode-config gate for festival-run-stakes.
//
// Two modes: "Just Cruisin'" (the pre-stakes sandbox, behaviorally invariant —
// its config encodes today's constants so the invariance is auditable in one
// file) and "Festival Run" (endless-until-death, day-ramped stakes). EVERY
// stakes behavior reads this module — vendor pricing, jug availability, frown
// thresholds, vibe limits, combo tuning, leaderboard reporting. No stakes
// conditionals anywhere else, mirroring how PERF gates tier features.
//
// Deliberately DOM-free and three-free so bin/test-run-mode can import it
// straight into node.

export const MODE_CRUISIN = 'cruisin';
export const MODE_FESTIVAL = 'festival';
export const MODE_KEY = 'zerble-mode';

// Day-ramp table (design.md D6 — draft numbers, expected to move in playtests;
// tune here and nowhere else). Day 1 = index 0. Beyond day 5 the last row
// holds, except vendorPrice which climbs +10/day to a 100 cap.
const RAMP = [
  { vendorPrice: 0,  jugKeep: 1.0,  frownMult: 1.0,  vibeWarn: 4, vibeEject: 8 },
  { vendorPrice: 10, jugKeep: 0.75, frownMult: 1.1,  vibeWarn: 4, vibeEject: 8 },
  { vendorPrice: 20, jugKeep: 0.55, frownMult: 1.25, vibeWarn: 3, vibeEject: 7 },
  { vendorPrice: 35, jugKeep: 0.40, frownMult: 1.4,  vibeWarn: 3, vibeEject: 6 },
  { vendorPrice: 50, jugKeep: 0.30, frownMult: 1.6,  vibeWarn: 2, vibeEject: 5 },
];

export function rampRow(day) {
  const d = Number.isFinite(day) ? Math.max(1, Math.floor(day)) : 1;
  if (d <= RAMP.length) return RAMP[d - 1];
  const last = RAMP[RAMP.length - 1];
  return { ...last, vendorPrice: Math.min(100, last.vendorPrice + (d - RAMP.length) * 10) };
}

// Combo tuning (design.md D5): chain window refreshes on each collect; the
// multiplier level is the count of thresholds the running chain has crossed.
export const COMBO = Object.freeze({
  chainWindowSec: 4,
  levels: Object.freeze([0, 5, 12, 22]),   // chain counts for x1/x2/x3/x4
  maxMult: 4,
  lurleenMult: 2,                          // flat doubler while she follows
});

// Vibe meter (design.md D6): strikes decay one per 15s.
export const VIBE = Object.freeze({ hitStrike: 1, frownStrike: 0.5, decayPerSec: 1 / 15 });

export const SPUTTER_GRACE_SEC = 45;

const CRUISIN = Object.freeze({
  name: MODE_CRUISIN,
  stakes: false,
  vendorPrice: () => 0,        // refills stay free
  jugKeep: () => 1.0,          // every generated jug spawns
  frownMult: () => 1.0,
  vibeLimits: () => null,      // no vibe meter
  savesPersonalBest: true,     // zerble-best-smiles belongs to Cruisin' ONLY
  leaderboard: false,
});

const FESTIVAL = Object.freeze({
  name: MODE_FESTIVAL,
  stakes: true,
  vendorPrice: (day) => rampRow(day).vendorPrice,
  jugKeep: (day) => rampRow(day).jugKeep,
  frownMult: (day) => rampRow(day).frownMult,
  vibeLimits: (day) => { const r = rampRow(day); return { warn: r.vibeWarn, eject: r.vibeEject }; },
  savesPersonalBest: false,
  leaderboard: true,
});

let _mode = CRUISIN;

export const RunMode = {
  get config() { return _mode; },
  get name() { return _mode.name; },
  isFestival() { return _mode.stakes; },

  // D13: with no persisted preference, Cruisin' is the default — a returning
  // player's habitual Start tap must never land in a mode that can kill the cart.
  set(name) {
    _mode = name === MODE_FESTIVAL ? FESTIVAL : CRUISIN;
    try { localStorage.setItem(MODE_KEY, _mode.name); } catch (e) { /* session-only */ }
    return _mode.name;
  },

  loadSaved() {
    let saved = null;
    try { saved = localStorage.getItem(MODE_KEY); } catch (e) { /* default */ }
    _mode = saved === MODE_FESTIVAL ? FESTIVAL : CRUISIN;
    return _mode.name;
  },
};
