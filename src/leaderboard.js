// Leaderboard — arcade boards for Festival Run results. Two halves:
//
// LOCAL: `zerble-leaderboard-local` = JSON array of {name, score, days, date}
// sorted score-desc, capped at 10. Everything tolerates corrupt JSON and
// unavailable storage (private mode) by degrading to an empty board. Blank
// names display as FALLBACK_NAME — the same promise the Worker makes
// server-side, so local and global rows never render blank.
//
// GLOBAL: the client half of workers/leaderboard/ (design D8/D9). Protocol:
// signed token from /run/start, ~60s heartbeats + milestone triggers (new day,
// high-water jumps), final submit at run end, and a pagehide sendBeacon so a
// killed tab's last state still stands. EVERY network path is fire-and-forget:
// timeboxed, error-swallowed, degrading silently to the local board — gameplay
// never blocks on leaderboard traffic, and Cruisin' generates zero requests
// (only the Festival Run layer in main.js calls into this half). Disabled
// entirely until GLOBAL_BOARD_URL below is set post-deploy (Gary-only).

const LOCAL_KEY = 'zerble-leaderboard-local';
const CAP = 10;

export const FALLBACK_NAME = 'ZERBLER';

function sanitize(e) {
  return {
    name: String(e?.name || '').trim().slice(0, 20),
    score: Math.max(0, Math.floor(Number(e?.score) || 0)),
    days: Math.max(1, Math.floor(Number(e?.days) || 1)),
    date: String(e?.date || '').slice(0, 10),
  };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((e) => e && Number.isFinite(Number(e.score))).map(sanitize);
  } catch (err) {
    return [];
  }
}

function save(list) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch (err) { /* session-only */ }
}

// Set to the deployed Worker origin (e.g. 'https://zerble-leaderboard.<acct>.workers.dev')
// to switch the global board on. Empty string = fully disabled: no fetches, no
// beacon hook, no tabs on the score screen. GARY FLIPS THIS after deploying
// workers/leaderboard/ — see wrangler.toml there. Dev override (not
// player-facing): `localStorage['zerble-board-url']` points a LOCAL game at
// `wrangler dev` / the node bridge for end-to-end drills. Localhost-gated
// like `__dbg`, so on the production origin the const alone decides —
// "disabled until deployed" is a hard guarantee, not a default. Evaluated
// once at module load: changing the key needs a reload.
const PROD_BOARD_URL = 'https://zerble-leaderboard.garbonzo-net.workers.dev';

// Strip trailing slashes. Every call site is `GLOBAL_BOARD_URL + '/board'` (and
// friends), so one stray slash on the origin builds `//board`, whose pathname
// matches none of the Worker's exact `path === '/board'` routes — it answers 404
// and the board silently does nothing, with no error a player or a dev would
// notice. Verified against the live Worker: `/board` 200, `//board` 404. The
// localStorage dev override gets the same treatment, since a pasted URL is even
// likelier to carry one.
const trimOrigin = (u) => (u || '').replace(/\/+$/, '');
export const GLOBAL_BOARD_URL = (() => {
  try {
    const h = location.hostname;
    const isLocal = h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0'
      || h.endsWith('.local') || /^10\./.test(h) || /^192\.168\./.test(h)
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) || h.includes('claude-preview');
    if (isLocal) return trimOrigin(localStorage.getItem('zerble-board-url') || PROD_BOARD_URL);
  } catch (err) { /* node import / storage unavailable */ }
  return trimOrigin(PROD_BOARD_URL);
})();

const BEAT_INTERVAL_MS = 60000;      // baseline heartbeat cadence
const MILESTONE_MIN_MS = 10000;      // floor between milestone-triggered beats
const MILESTONE_SCORE_STEP = 50;     // high-water jump that earns an early beat

let _run = null;                     // {runId, startTs, sig} from /run/start
let _runDone = false;
let _lastBeat = { at: 0, hw: 0, day: 0 };
let _latest = null;                  // freshest state, for the pagehide beacon
let _pendingFinal = null;            // a death that beat the /run/start token
let _beaconHooked = false;

async function post(path, body, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(GLOBAL_BOARD_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    return null;                     // fire-and-forget: failure is silence
  } finally {
    clearTimeout(t);
  }
}

let _lastBeaconAt = 0;

function sendStateBeacon() {
  if (!_run || _runDone || !_latest || !navigator.sendBeacon) return;
  // visibilitychange + pagehide can fire back-to-back — one beacon per burst.
  const now = Date.now();
  if (now - _lastBeaconAt < 10000) return;
  _lastBeaconAt = now;
  // Beacon a BEAT, never an end: these events also fire on mobile app-switch /
  // bfcache entry, and /run/end would close the run server-side forever —
  // freezing the score of a player who merely backgrounded the tab (review
  // 001). Beats upsert the board entry, which is the whole "a killed tab
  // still records" guarantee, while leaving the run open for a return.
  // sendBeacon can't set JSON headers — the Worker parses text/plain bodies.
  navigator.sendBeacon(GLOBAL_BOARD_URL + '/run/beat',
    JSON.stringify({ ..._run, ..._latest }));
}

function hookBeacon() {
  if (_beaconHooked || typeof window === 'undefined') return;
  _beaconHooked = true;
  // BOTH events, mirroring main.js's session_end pattern: iOS Safari does not
  // reliably fire pagehide on app-switch, but does fire visibilitychange →
  // hidden (adversary A3 — pagehide-only was the one event the target
  // platform skips).
  window.addEventListener('pagehide', sendStateBeacon);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendStateBeacon();
  });
}

export const Leaderboard = {
  localTop() { return load(); },

  // ---- Global board client (all no-ops while GLOBAL_BOARD_URL is empty) ----
  globalEnabled() { return !!GLOBAL_BOARD_URL; },

  // Fire at Festival Run start. Async and unawaited by design: until (unless)
  // the token lands, heartbeats no-op and the run is local-only. A final that
  // arrives while the token is still in flight (fast death + slow network —
  // seen for real under load, and exactly the cellular case) is QUEUED and
  // flushed the moment the token resolves, so the run's score isn't lost to
  // the race.
  globalRunStart() {
    if (!this.globalEnabled()) return;
    _run = null; _runDone = false; _latest = null; _pendingFinal = null;
    _lastBeat = { at: 0, hw: 0, day: 0 };
    hookBeacon();
    post('/run/start', {}).then(async (res) => {
      if (!res || !res.ok) return;
      try {
        const tok = await res.json();
        if (tok && tok.runId && tok.sig) {
          _run = tok;
          if (_pendingFinal) {
            const f = _pendingFinal;
            _pendingFinal = null;
            this.globalFinal(f);
          }
        }
      } catch (err) { /* local-only run */ }
    });
  },

  // Call freely (the run layer calls every frame) — throttles itself to the
  // 60s cadence plus milestone triggers (new day; high-water jumps, floored).
  globalHeartbeat({ score = 0, day = 1, name = '' } = {}) {
    if (!_run || _runDone) return;
    _latest = { score: Math.floor(score), day, name };
    const now = Date.now();
    const since = now - _lastBeat.at;
    const milestone = day > _lastBeat.day
      || (score - _lastBeat.hw >= MILESTONE_SCORE_STEP && since > MILESTONE_MIN_MS);
    if (since < BEAT_INTERVAL_MS && !milestone) return;
    _lastBeat = { at: now, hw: Math.floor(score), day };
    post('/run/beat', { ..._run, ..._latest });
  },

  // Final submit at run end. The run token is spent either way; with no token
  // yet, the final parks until globalRunStart's fetch resolves.
  globalFinal({ score = 0, day = 1, name = '', cause = '' } = {}) {
    if (_runDone) return;
    if (!_run) { _pendingFinal = { score, day, name, cause }; return; }
    _runDone = true;
    post('/run/end', { ..._run, score: Math.floor(score), day, name, cause });
  },

  // Resume plumbing: the Worker token rides the settings resume snapshot so a
  // resumed run keeps its original startTs — a fresh /run/start would reset
  // elapsed time and trip the Worker's own day/rate plausibility guards
  // (and split one logical run across two board rows).
  serializeGlobal() {
    return _run && !_runDone ? { run: _run } : null;
  },
  globalRestore(o) {
    if (!this.globalEnabled() || !o || !o.run || !o.run.runId || !o.run.sig) return false;
    _run = o.run;
    _runDone = false;
    _latest = null;
    _lastBeat = { at: 0, hw: 0, day: 0 };   // beat again shortly after resume
    hookBeacon();
    return true;
  },

  // Timeboxed board read for the score-screen tabs. Resolves to an entry array
  // or null (caller falls back to the local board, silently).
  async fetchGlobal(range = 'all') {
    if (!this.globalEnabled()) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(`${GLOBAL_BOARD_URL}/board?range=${range === 'daily' ? 'daily' : 'all'}`,
        { signal: ctrl.signal });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data.entries) ? data.entries.map(sanitize) : null;
    } catch (err) {
      return null;
    } finally {
      clearTimeout(t);
    }
  },

  displayName(entry) { return (entry && entry.name) || FALLBACK_NAME; },

  // Record a finished Festival Run. Returns the 1-based rank it landed at,
  // or 0 if it didn't crack the top 10.
  recordLocal(run) {
    const entry = sanitize(run);
    if (!entry.date) entry.date = new Date().toISOString().slice(0, 10);
    const list = load();
    list.push(entry);
    list.sort((a, b) => (b.score - a.score) || (b.days - a.days));
    const trimmed = list.slice(0, CAP);
    save(trimmed);
    const rank = trimmed.indexOf(entry);
    return rank === -1 ? 0 : rank + 1;
  },
};
