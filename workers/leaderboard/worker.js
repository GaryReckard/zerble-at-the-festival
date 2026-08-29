// Zerble global leaderboard — plain-JS Cloudflare Worker + KV (design D8 of the
// festival-run-stakes change). Deliberately Hono-less and dependency-free so it
// reads top to bottom and unit-tests in plain node (bin/test-leaderboard-worker
// imports this file and drives fetch() with a mock KV).
//
// DEPLOYED BY GARY ONLY — secrets (SIGNING_SECRET, ADMIN_KEY, optional
// TURNSTILE_SECRET) live in Worker env, never in client code. The client is
// fire-and-forget (design D9): every response here is advisory; the game never
// blocks on us.
//
// Protocol:
//   POST /run/start            → {runId, startTs, sig}   sig = HMAC(secret, runId|startTs)
//   POST /run/beat             {runId, startTs, sig, score, day, name} → 204
//   POST /run/end              same body (+cause) → 204   (also sendBeacon target)
//   GET  /board?range=daily|all → {range, entries: [{name, score, days, date}]}
//   DELETE /admin/entry        Bearer ADMIN_KEY, {runId, range?} → 204
//
// Board persistence: BOTH beat and end upsert the run's board entry (keyed by
// runId), so a tab killed mid-run stands at its last heartbeat — the spec's
// "a closed tab still records." Boards are top-100 arrays in KV under
// read-modify-write; eventual consistency under concurrent run-ends is an
// accepted trade at this scale (the per-run `run:<id>` records stay authoritative).
//
// Plausibility ceiling (recalibrated per council — NEVER the raw un-multiplied
// GA4 baseline, which would quarantine exactly the legit top players):
//   ceiling(min) = BASE_SMILES_PER_MIN × MAX_MULTIPLIER × STAR_ALLOWANCE × SAFETY
// All four factors are env vars so tuning needs no redeploy.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const BOARD_CAP = 100;
const RUN_TTL_S = 48 * 3600;
const NAME_MAX = 20;
const FALLBACK_NAME = 'ZERBLER';
// Small denylist — substring match on the lowercased, de-spaced name. The goal
// is "a hostile name never renders", not a linguistics project; admin delete
// covers the tail.
const NAME_DENY = ['fuck', 'shit', 'cunt', 'nigg', 'fagg', 'rape', 'hitler', 'penis', 'vagin'];
// A day is 6 real minutes (main.js CYCLE_SECONDS 360). Allow generous slack —
// resume snapshots and clock drift make exact matching hostile to legit players.
const DAY_MINUTES = 6;
const DAY_SLACK = 2.5;

const num = (v, dflt) => (Number.isFinite(Number(v)) ? Number(v) : dflt);

function ceilingFor(env, elapsedMin) {
  const base = num(env.BASE_SMILES_PER_MIN, 40);
  const mult = num(env.MAX_MULTIPLIER, 8);
  const star = num(env.STAR_ALLOWANCE, 1.5);
  const safety = num(env.SAFETY, 1.5);
  // A short run still gets a minute's allowance — sub-minute deaths are real.
  return Math.max(1, elapsedMin) * base * mult * star * safety;
}

function sanitizeName(raw) {
  let name = String(raw || '')
    .replace(/[^\p{L}\p{N}\p{Zs}'!._-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
  if (!name) return FALLBACK_NAME;
  const flat = name.toLowerCase().replace(/[\s._-]/g, '');
  for (const bad of NAME_DENY) if (flat.includes(bad)) return FALLBACK_NAME;
  return name;
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time-ish compare; both sides are hex of fixed length.
function sigEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });
const empty = (status = 204) => new Response(null, { status, headers: CORS });

async function readBody(request) {
  // sendBeacon may arrive as text/plain (or no content type) — parse leniently.
  try { return JSON.parse(await request.text()); } catch { return null; }
}

const utcDate = (now) => new Date(now).toISOString().slice(0, 10);
const boardKey = (range, now) => (range === 'daily' ? `board:daily:${utcDate(now)}` : 'board:all');

async function loadBoard(env, key) {
  try {
    const raw = await env.BOARD_KV.get(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

// Upsert one run's entry (keyed by runId) into a board array, sort, cap.
function foldEntry(list, entry) {
  const out = list.filter((e) => e && e.runId !== entry.runId);
  out.push(entry);
  out.sort((a, b) => (b.score - a.score) || (b.days - a.days));
  return out.slice(0, BOARD_CAP);
}

async function rateLimit(env, bucket, cap) {
  // Per-minute KV counter. Best-effort — KV isn't atomic, but a racer gains a
  // couple of extra requests, not a bypass worth engineering against here.
  const key = `rl:${bucket}:${Math.floor(Date.now() / 60000)}`;
  const n = num(await env.BOARD_KV.get(key), 0) + 1;
  await env.BOARD_KV.put(key, String(n), { expirationTtl: 120 });
  return n <= cap;
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;   // not configured → open (pre-launch)
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token || '', remoteip: ip }),
    });
    return (await r.json()).success === true;
  } catch { return false; }
}

// Validate a beat/end body against its token + the plausibility rules.
// Returns {run, score, day, reason}; a null run means reject (reason says why).
async function validateSubmission(env, body, now) {
  if (!body || typeof body.runId !== 'string' || !body.runId) return { reason: 'bad_body' };
  const startTs = num(body.startTs, NaN);
  if (!Number.isFinite(startTs)) return { reason: 'bad_body' };
  const expect = await hmac(env.SIGNING_SECRET, `${body.runId}|${startTs}`);
  if (!sigEqual(expect, body.sig)) return { reason: 'bad_sig' };

  const raw = await env.BOARD_KV.get(`run:${body.runId}`);
  if (!raw) return { reason: 'unknown_run' };
  let run;
  try { run = JSON.parse(raw); } catch { return { reason: 'unknown_run' }; }
  if (run.done) return { reason: 'finished_run' };

  const elapsedMin = Math.max(0, (now - startTs) / 60000);
  const score = Math.max(0, Math.floor(num(body.score, 0)));
  const day = Math.max(1, Math.floor(num(body.day, 1)));

  // Monotonic high-water: a submission below what we've seen keeps the stored max.
  const hw = Math.max(score, num(run.hw, 0));
  if (hw > ceilingFor(env, elapsedMin)) return { reason: 'implausible_rate' };
  if (day > 1 + (elapsedMin / DAY_MINUTES) * DAY_SLACK) return { reason: 'implausible_day' };

  return { run, score: hw, day: Math.max(day, num(run.day, 1)) };
}

async function applySubmission(env, body, now, { final = false } = {}) {
  const v = await validateSubmission(env, body, now);
  if (!v.run) return v.reason;

  const run = v.run;
  run.hw = v.score;
  run.day = v.day;
  run.name = sanitizeName(body.name ?? run.name);
  run.seen = now;
  if (final) { run.done = true; run.cause = String(body.cause || '').slice(0, 24); }
  await env.BOARD_KV.put(`run:${body.runId}`, JSON.stringify(run), { expirationTtl: RUN_TTL_S });

  const entry = {
    runId: body.runId,
    name: run.name,
    score: run.hw,
    days: run.day,
    date: utcDate(run.startTs ?? now),
    quarantined: run.hw >= num(env.OUTLIER_SCORE, 100000) ? true : undefined,
  };
  for (const range of ['all', 'daily']) {
    const key = boardKey(range, now);
    const list = await loadBoard(env, key);
    await env.BOARD_KV.put(key, JSON.stringify(foldEntry(list, entry)));
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const ip = request.headers.get('CF-Connecting-IP') || 'noip';
    const now = Date.now();

    if (request.method === 'OPTIONS') return empty(204);

    if (request.method === 'POST' && path === '/run/start') {
      if (!(await rateLimit(env, `start:${ip}`, 10))) return json({ error: 'rate' }, 429);
      const body = (await readBody(request)) || {};
      if (!(await verifyTurnstile(env, body.turnstile, ip))) return json({ error: 'turnstile' }, 403);
      const runId = crypto.randomUUID();
      const startTs = now;
      const sig = await hmac(env.SIGNING_SECRET, `${runId}|${startTs}`);
      await env.BOARD_KV.put(`run:${runId}`, JSON.stringify({ startTs, hw: 0, day: 1 }),
        { expirationTtl: RUN_TTL_S });
      return json({ runId, startTs, sig });
    }

    if (request.method === 'POST' && (path === '/run/beat' || path === '/run/end')) {
      if (!(await rateLimit(env, `beat:${ip}`, 60))) return json({ error: 'rate' }, 429);
      const reason = await applySubmission(env, await readBody(request), now,
        { final: path === '/run/end' });
      // Fire-and-forget client: a rejection is a 4xx it will ignore; the
      // reason is for wrangler-tail debugging, not the player.
      return reason ? json({ error: reason }, 400) : empty(204);
    }

    if (request.method === 'GET' && path === '/board') {
      const range = url.searchParams.get('range') === 'daily' ? 'daily' : 'all';
      const list = await loadBoard(env, boardKey(range, now));
      return json({
        range,
        entries: list.filter((e) => !e.quarantined)
          .map(({ name, score, days, date }) => ({ name, score, days, date })),
      }, 200, { 'Cache-Control': 'public, max-age=30' });
    }

    if (request.method === 'DELETE' && path === '/admin/entry') {
      const auth = request.headers.get('Authorization') || '';
      if (!env.ADMIN_KEY || auth !== `Bearer ${env.ADMIN_KEY}`) return json({ error: 'auth' }, 401);
      const body = (await readBody(request)) || {};
      if (!body.runId) return json({ error: 'bad_body' }, 400);
      const ranges = body.range ? [body.range] : ['all', 'daily'];
      for (const range of ranges) {
        const key = boardKey(range, now);
        const list = await loadBoard(env, key);
        await env.BOARD_KV.put(key, JSON.stringify(list.filter((e) => e.runId !== body.runId)));
      }
      await env.BOARD_KV.delete(`run:${body.runId}`);
      return empty(204);
    }

    return json({ error: 'not_found' }, 404);
  },
};

// Exported for bin/test-leaderboard-worker only.
export { sanitizeName, ceilingFor, foldEntry, FALLBACK_NAME };
