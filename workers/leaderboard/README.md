# Zerble global leaderboard Worker

The server half of Festival Run's global board. Plain-JS Cloudflare Worker on
KV — no framework, no dependencies, unit-testable in bare node. The game ships
with the client **disabled**; nothing here matters to players until the two
steps at the bottom are done.

## What it enforces

Signed run tokens (`/run/start` → HMAC over `runId|startTs`), monotonic
high-water scores, a plausibility ceiling derived from the *multiplied* max
rate (`BASE_SMILES_PER_MIN × MAX_MULTIPLIER × STAR_ALLOWANCE × SAFETY` — all
env-tunable), day-vs-elapsed consistency, per-IP rate limits, name sanitation
(20-char clamp, charset strip, profanity denylist, blanks → ZERBLER), outlier
quarantine above `OUTLIER_SCORE`, and an admin delete. Both heartbeats and
finals upsert the board entry, so a tab killed mid-run stands at its last
heartbeat. Boards are top-100 KV arrays (daily keys expire after 90 days;
all-time never does), read-modify-write with a verify-and-repair pass on
finals. The Worker fails closed (HTTP 500) if `SIGNING_SECRET` was never set.

## Local dev — no wrangler needed

```
bin/test-leaderboard-worker          # node unit/protocol gate (in npm run check)
node workers/leaderboard/dev-server.mjs 8787   # localhost bridge, in-memory KV
```

Point a locally served game at the bridge with
`localStorage['zerble-board-url'] = 'http://127.0.0.1:8787'` (localhost-gated,
read once at page load — set it before load or reload after). Details in
DEBUGGING.md "Global leaderboard without wrangler".

## Deploy (GARY-ONLY — needs the Cloudflare account)

```
cd workers/leaderboard
npx wrangler kv namespace create BOARD_KV    # paste the id into wrangler.toml
npx wrangler secret put SIGNING_SECRET       # long random string (e.g. openssl rand -hex 32)
npx wrangler secret put ADMIN_KEY            # bearer key for DELETE /admin/entry
npx wrangler secret put TURNSTILE_SECRET     # OPTIONAL — absent = no captcha gate
npx wrangler deploy
```

Then flip the client on: set `PROD_BOARD_URL` in
[src/leaderboard.js](../../src/leaderboard.js) to the deployed origin (e.g.
`https://zerble-leaderboard.<account>.workers.dev`). That one constant is the
feature flag — the score-screen tabs, heartbeats, and beacon all key off it.

Tuning lives in `wrangler.toml` `[vars]` (ceiling factors, `OUTLIER_SCORE`).
`BASE_SMILES_PER_MIN` should be the observed p99 *organic un-multiplied*
collect rate from GA4 — never fold the ×8 multiplier back into it.

Cleanup: `DELETE /admin/entry` with `Authorization: Bearer <ADMIN_KEY>` and
`{"runId": "<id>"}` removes an entry from both boards and kills its token.
