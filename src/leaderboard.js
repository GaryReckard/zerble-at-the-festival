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
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); return true; } catch (err) { return false; }
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

const DIAGNOSTIC_KEY = 'zerble-board-diagnostics';
const DIAGNOSTIC_CAP = 100;
const OUTCOMES = new Set(['started', 'skipped_cadence', 'skipped_no_change', 'run_persisted',
  'boards_written', 'quarantined', 'rejected', 'storage_error', 'internal_error', 'misconfigured']);
const REASONS = new Set(['bad_body', 'bad_sig', 'unknown_run', 'finished_run', 'implausible_rate',
  'implausible_day', 'beat_cap', 'rate', 'turnstile', 'misconfigured', 'storage_error', 'internal_error']);
let _diagnosticEvents = [];
let _diagnosticStorage = true;
try {
  const saved = JSON.parse(localStorage.getItem(DIAGNOSTIC_KEY) || '[]');
  if (Array.isArray(saved)) _diagnosticEvents = saved.slice(-DIAGNOSTIC_CAP);
} catch { _diagnosticStorage = false; }

// Only pass explicit scalar fields here, never request bodies or run tokens.
function diagnose(event, detail = {}) {
  _diagnosticEvents.push({ at: new Date().toISOString(), event, ...detail });
  if (_diagnosticEvents.length > DIAGNOSTIC_CAP) _diagnosticEvents.shift();
  try {
    localStorage.setItem(DIAGNOSTIC_KEY, JSON.stringify(_diagnosticEvents));
    _diagnosticStorage = true;
  } catch { _diagnosticStorage = false; }
}

diagnose('page_loaded', { globalEnabled: !!GLOBAL_BOARD_URL });

async function post(path, body, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  diagnose('request_started', { path, ...(body.score == null ? {} : { score: body.score, day: body.day }) });
  try {
    const res = await fetch(GLOBAL_BOARD_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const outcome = res.headers.get('X-Leaderboard-Outcome');
    const requestId = res.headers.get('X-Leaderboard-Request-Id');
    let reason;
    if (!res.ok) {
      try {
        const data = await res.clone().json();
        reason = REASONS.has(data.error) ? data.error : 'unspecified';
      } catch { reason = 'unreadable_response'; }
    }
    diagnose('request_finished', {
      path, status: res.status, elapsedMs: Date.now() - started,
      outcome: OUTCOMES.has(outcome) ? outcome : (res.ok ? 'acknowledged_unverified' : 'rejected'),
      ...(reason ? { reason } : {}),
      ...(/^[\da-f-]{36}$/i.test(requestId || '') ? { requestId } : {}),
    });
    let data = null;
    if (path === '/run/start' && res.ok) {
      try { data = await res.json(); }
      catch (err) {
        if (ctrl.signal.aborted) throw err;
      }
    }
    return { ok: res.ok, data };
  } catch (err) {
    diagnose('request_failed', { path, elapsedMs: Date.now() - started,
      reason: ctrl.signal.aborted ? 'timeout' : 'network_or_cors' });
    return null;
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
  try {
    const queued = navigator.sendBeacon(GLOBAL_BOARD_URL + '/run/beat',
      JSON.stringify({ ..._run, ..._latest }));
    diagnose('beacon', { outcome: queued ? 'queued_unacknowledged' : 'not_queued',
      score: _latest.score, day: _latest.day });
  } catch { diagnose('beacon', { outcome: 'not_queued' }); }
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
  noteGameStart(mode, resumed = false) {
    diagnose('game_started', { mode: mode === 'festival' ? 'festival' : 'cruising', resumed,
      submitsScores: mode === 'festival' && this.globalEnabled() });
  },
  diagnostics() {
    return {
      version: 1, endpoint: GLOBAL_BOARD_URL, globalEnabled: this.globalEnabled(),
      tokenPresent: !!_run, finalAttempted: _runDone, finalWaitingForToken: !!_pendingFinal,
      historyPersisted: _diagnosticStorage,
      events: _diagnosticEvents.map((e) => ({ ...e })),
    };
  },
  clearDiagnostics() {
    _diagnosticEvents = [];
    diagnose('history_cleared');
  },

  // ---- Global board client (all no-ops while GLOBAL_BOARD_URL is empty) ----
  globalEnabled() { return !!GLOBAL_BOARD_URL; },

  // Fire at Festival Run start. Async and unawaited by design: until (unless)
  // the token lands, heartbeats no-op and the run is local-only. A final that
  // arrives while the token is still in flight (fast death + slow network —
  // seen for real under load, and exactly the cellular case) is QUEUED and
  // flushed the moment the token resolves, so the run's score isn't lost to
  // the race.
  globalRunStart() {
    if (!this.globalEnabled()) { diagnose('run_disabled'); return; }
    _run = null; _runDone = false; _latest = null; _pendingFinal = null;
    _lastBeat = { at: 0, hw: 0, day: 0 };
    hookBeacon();
    post('/run/start', {}).then((res) => {
      if (!res || !res.ok) return;
      try {
        const tok = res.data;
        if (tok && tok.runId && tok.sig) {
          _run = tok;
          diagnose('token_received');
          if (_pendingFinal) {
            const f = _pendingFinal;
            _pendingFinal = null;
            this.globalFinal(f);
          }
        }
        if (!_run) diagnose('token_invalid');
      } catch (err) { diagnose('token_invalid'); }
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
    if (!_run) {
      _pendingFinal = { score, day, name, cause };
      diagnose('final_waiting_for_token', { score: Math.floor(score), day });
      return;
    }
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
    diagnose('token_restored');
    return true;
  },

  // Timeboxed board read for the score-screen tabs. Resolves to an entry array
  // or null (caller falls back to the local board, silently).
  async fetchGlobal(range = 'all') {
    if (!this.globalEnabled()) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const boardRange = range === 'daily' ? 'daily' : 'all';
    diagnose('board_read_started', { range: boardRange });
    try {
      const res = await fetch(`${GLOBAL_BOARD_URL}/board?range=${range === 'daily' ? 'daily' : 'all'}`,
        { signal: ctrl.signal });
      if (!res.ok) {
        diagnose('board_read_failed', { range: boardRange, status: res.status });
        return null;
      }
      const data = await res.json();
      diagnose(Array.isArray(data.entries) ? 'board_read_finished' : 'board_read_invalid',
        { range: boardRange, status: res.status, entries: Array.isArray(data.entries) ? data.entries.length : 0 });
      return Array.isArray(data.entries) ? data.entries.map(sanitize) : null;
    } catch (err) {
      diagnose('board_read_failed', { range: boardRange, reason: ctrl.signal.aborted ? 'timeout' : 'network_or_invalid_response' });
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
    const persisted = save(trimmed);
    const rank = trimmed.indexOf(entry);
    diagnose('local_result', { score: entry.score, day: entry.days, rank: rank + 1, persisted });
    return rank === -1 ? 0 : rank + 1;
  },
};
