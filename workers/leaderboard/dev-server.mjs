// Thin node HTTP bridge around the Worker's fetch handler — a stand-in for
// `wrangler dev` on boxes that can't install it (the Worker is plain
// Request→Response, so node serves it directly; KV is the same in-memory mock
// the unit tests use). Point the game at it with
// localStorage['zerble-board-url'] = 'http://127.0.0.1:8787'.
//
//   node workers/leaderboard/dev-server.mjs [port]
//
// State lives for the life of the process. NOT part of any deploy.

import http from 'node:http';
import worker from './worker.js';

const port = Number(process.argv[2]) || 8787;
const kv = new Map();
const env = {
  BOARD_KV: {
    async get(k) { return kv.has(k) ? kv.get(k) : null; },
    async put(k, v) { kv.set(k, String(v)); },
    async delete(k) { kv.delete(k); },
  },
  SIGNING_SECRET: 'dev-secret',
  ADMIN_KEY: 'dev-admin',
  BASE_SMILES_PER_MIN: '40',
  MAX_MULTIPLIER: '8',
  STAR_ALLOWANCE: '1.5',
  SAFETY: '1.5',
  OUTLIER_SCORE: '100000',
};

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body,
  });
  try {
    const out = await worker.fetch(request, env);
    res.writeHead(out.status, Object.fromEntries(out.headers.entries()));
    res.end(Buffer.from(await out.arrayBuffer()));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(String(err));
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`zerble leaderboard dev bridge on http://127.0.0.1:${port}\n`);
});
