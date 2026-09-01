// Thin wrapper around gtag.js. No-ops gracefully if the GA tag failed to load
// (ad blockers, offline dev, local hosts) so analytics never breaks gameplay.
//
// Conventions worth keeping as this grows:
//   - One event name, a param for the variant (collision{kind}, refuel{source},
//     feature_used{feature}) — keeps us well under GA4's 500-event-name cap and
//     far easier to explore than a name per variant.
//   - Never per-frame. High-frequency things are either edge-detected by the
//     caller, reported once per session (see `firsts`/`features`), or rolled up
//     into session_end. `time_in_run_s` rides along on most events.

const SMILE_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500];
const MAX_EXCEPTIONS = 8;        // cap field-error spam per page load

const state = {
  reachedSmileMilestones: new Set(),
  lastBestReported: 0,
  honked: false,
  sessionStartMs: performance.now(),
  // Discovery / once-per-run flags (reset each gameStart).
  firsts: new Set(),
  features: new Set(),
  // Per-run rollup, read by sessionEnd. Reset each gameStart.
  run: emptyRun(),
  context: {},
  exceptionsSent: 0,    // NOT reset per run — errors happen before/after a run too
};

function emptyRun() {
  return { jugs: 0, vendorRefuels: 0, ranDry: 0, trips: 0, passengers: 0, blastUsed: false };
}

function send(name, params) {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, params || {});
  } catch (_) {
    // never let analytics throw into game code
  }
}

function secondsIn() {
  return Math.round((performance.now() - state.sessionStartMs) / 1000);
}

export const Analytics = {
  // `context` segments the whole session: { perf_tier, touch, seeded, returning }.
  gameStart(context = {}) {
    state.sessionStartMs = performance.now();
    state.run = emptyRun();
    state.firsts = new Set();
    state.features = new Set();
    state.context = context;
    send('game_start', context);
  },

  // Festival Run lifecycle (festival-run-stakes). Name-free by contract —
  // only run metrics ever ship.
  runStart(params = {}) {
    send('run_start', { day: params.day || 1, resumed: !!params.resumed, time_in_run_s: secondsIn() });
  },

  runEnd({ cause, score, days, duration, best_combo, rescue_used, rawSmiles } = {}) {
    const dur = Math.floor(duration || 0);
    send('run_end', {
      cause: cause || 'unknown',
      score: Math.floor(score || 0),
      days: Math.floor(days || 1),
      duration_s: dur,
      best_combo: Math.floor(best_combo || 1),
      rescue_used: !!rescue_used,
      // Organic (pre-multiplier) pick-up rate — see sessionEnd for why `score`
      // can't answer this. A COMPLETED run is the cleaner sample of the two.
      organic_smiles: Math.floor(rawSmiles || 0),
      organic_per_min: dur > 0 ? Math.round((rawSmiles || 0) / (dur / 60) * 10) / 10 : 0,
    });
  },

  // Global-board final submit attempted (fire-and-forget — this logs the
  // attempt, not server acceptance). Metrics only, never the name.
  leaderboardSubmit({ score, days } = {}) {
    send('leaderboard_submit', { score: Math.floor(score || 0), days: Math.floor(days || 1) });
  },

  debugMenuToggle(open) {
    if (open) send('debug_menu_open', { time_in_run_s: secondsIn() });
  },

  tripMenuToggle(open) {
    if (open) send('trip_menu_open', { time_in_run_s: secondsIn() });
  },

  smileScore(score) {
    for (const m of SMILE_MILESTONES) {
      if (score >= m && !state.reachedSmileMilestones.has(m)) {
        state.reachedSmileMilestones.add(m);
        send('smile_milestone', {
          milestone: m,
          time_in_run_s: secondsIn(),
        });
      }
    }
  },

  personalBest(score) {
    // Only report when we actually clear a previous best by a notable jump,
    // to avoid spamming on every +1.
    if (score > state.lastBestReported + 9) {
      state.lastBestReported = score;
      send('personal_best', {
        value: Math.floor(score),
        time_in_run_s: secondsIn(),
      });
    }
  },

  lurleenFound() {
    send('lurleen_found', { time_in_run_s: secondsIn() });
  },

  tripStart(source) {
    // source: 'wook_accept' | 'manual_static' | 'manual_dynamic'
    state.run.trips++;
    send('trip_start', { source, time_in_run_s: secondsIn() });
  },

  tripEnd(source, durationS) {
    send('trip_end', { source, duration_s: Math.round(durationS || 0), time_in_run_s: secondsIn() });
  },

  collision(kind) {
    send('collision', { kind, time_in_run_s: secondsIn() });
  },

  firstHonk() {
    if (state.honked) return;
    state.honked = true;
    send('first_honk', { time_in_run_s: secondsIn() });
  },

  viewToggle(mode) {
    send('view_toggle', { mode, time_in_run_s: secondsIn() });
  },

  // ----- Bubble-juice economy -----

  // Tank hit empty. Can fire more than once per run (run dry → refuel → dry
  // again); each is a friction signal, and `count` shows how many times.
  bubbleRanDry() {
    state.run.ranDry++;
    send('bubble_ran_dry', { count: state.run.ranDry, time_in_run_s: secondsIn() });
  },

  // source: 'jug' (drove over a floating jug) | 'vendor' (lingered at a stand).
  // Caller edge-detects the vendor case so this isn't a per-frame stream.
  refuel(source) {
    if (source === 'vendor') state.run.vendorRefuels++;
    else state.run.jugs++;
    send('refuel', { source, time_in_run_s: secondsIn() });
  },

  // The marquee "bring the bubbles" verb (G held). Event once per run; the
  // rollup just notes it was used.
  bubbleBlast() {
    state.run.blastUsed = true;
    if (state.firsts.has('blast')) return;
    state.firsts.add('blast');
    send('bubble_blast', { time_in_run_s: secondsIn() });
  },

  // ----- Passengers -----

  // An NPC climbed aboard. Event on the first board per run (engagement
  // signal); every board feeds the session_end passenger count.
  passengerBoard() {
    state.run.passengers++;
    if (state.firsts.has('passenger')) return;
    state.firsts.add('passenger');
    send('passenger_board', { time_in_run_s: secondsIn() });
  },

  // ----- Lightweight feature discovery (one event per feature per run) -----
  // feature: 'honk_bell' | 'honk_clown' | 'music_toggle' | 'camera_zoom' | 'boost'
  featureUsed(feature) {
    if (state.features.has(feature)) return;
    state.features.add(feature);
    send('feature_used', { feature, time_in_run_s: secondsIn() });
  },

  // Player kept playing into nightfall — a clean proxy for "stuck around".
  sawNight() {
    if (state.firsts.has('night')) return;
    state.firsts.add('night');
    send('saw_night', { time_in_run_s: secondsIn() });
  },

  // ----- Field health -----

  // The adaptive-quality monitor stepped DOWN a level under load — tells us
  // whether the perf budget holds up on real hardware.
  qualityDowngrade(level, fps) {
    send('quality_downgrade', {
      level,
      avg_fps: Math.round(fps || 0),
      perf_tier: state.context?.perf_tier,
      time_in_run_s: secondsIn(),
    });
  },

  // Uncaught errors → GA4's recommended `exception` event. The only way we see
  // field crashes on devices we can't repro (e.g. the Safari frozen-module
  // class — see threeShim.js). Capped so a render-loop error can't flood GA.
  installErrorTracking() {
    if (typeof window === 'undefined') return;
    const report = (description, fatal) => {
      if (state.exceptionsSent >= MAX_EXCEPTIONS) return;
      state.exceptionsSent++;
      send('exception', { description: String(description).slice(0, 220), fatal: !!fatal });
    };
    window.addEventListener('error', (e) => {
      const file = e.filename ? String(e.filename).split('/').pop() : '';
      const where = file ? ` @ ${file}:${e.lineno || 0}` : '';
      report((e.message || 'error') + where, true);
    });
    window.addEventListener('unhandledrejection', (e) => {
      const r = e.reason;
      report('unhandledrejection: ' + (r && r.message ? r.message : r), false);
    });
  },

  // ----- Session summary -----

  // Fire on tab-hide with beacon transport (survives the page going away;
  // beforeunload is unreliable on mobile). `summary` carries the live values
  // the caller owns; the rest comes from this run's rollup. Caller dedupes
  // (resets its guard when the tab returns) so a long session that briefly
  // backgrounded gets a fuller snapshot on the real exit.
  sessionEnd(summary = {}) {
    const dur = secondsIn();
    send('session_end', {
      duration_s: dur,
      smiles: Math.floor(summary.smiles || 0),
      // `smiles` above is the POST-multiplier score. These two are the organic
      // pick-up rate — the only thing that can legitimately set the leaderboard
      // Worker's BASE_SMILES_PER_MIN ceiling (the ×1..8 multiplier is applied
      // separately there as MAX_MULTIPLIER, and must never be folded back in).
      organic_smiles: Math.floor(summary.rawSmiles || 0),
      organic_per_min: dur > 0 ? Math.round((summary.rawSmiles || 0) / (dur / 60) * 10) / 10 : 0,
      best: Math.floor(summary.best || 0),
      max_juice: Math.round((summary.maxJuice || 0) * 10) / 10,
      honks: summary.honks || 0,
      jugs: state.run.jugs,
      vendor_refuels: state.run.vendorRefuels,
      ran_dry: state.run.ranDry,
      trips: state.run.trips,
      passengers: state.run.passengers,
      blast_used: state.run.blastUsed,
      perf_tier: state.context?.perf_tier,
      transport_type: 'beacon',
    });
  },
};
