// Leaderboard — arcade top-10 for Festival Run results. Local half only for
// now: the global (Cloudflare Worker) client lands with P3 of the
// festival-run-stakes change and slots in beside this without touching it.
//
// Storage: `zerble-leaderboard-local` = JSON array of {name, score, days, date}
// sorted score-desc, capped at 10. Everything tolerates corrupt JSON and
// unavailable storage (private mode) by degrading to an empty board. Blank
// names display as FALLBACK_NAME — the same promise the Worker makes
// server-side, so local and global rows never render blank.

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

export const Leaderboard = {
  localTop() { return load(); },

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
