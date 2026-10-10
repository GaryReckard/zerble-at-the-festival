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

## Safe request diagnostics

Every handled request emits one JSON console line with
`event: "leaderboard_request"`. HTTP 500 responses use `console.error`; other
responses use `console.log`. The localhost bridge emits the same diagnostics.
The Worker never logs names, IP addresses, request bodies, signatures, secrets,
run IDs, KV keys, raw URLs, or exception messages/stacks. Operation, outcome,
reason, phase, and range are fixed labels, not copied from untrusted input.

Every response includes these headers, both listed in
`Access-Control-Expose-Headers` so a cross-origin fetch can read them:

| Header | Meaning |
|---|---|
| `X-Leaderboard-Request-Id` | Server-generated random UUID, also `requestId` in the log. It identifies one invocation, not a player or run; incoming IDs are ignored. |
| `X-Leaderboard-Outcome` | The log's `outcome` value. A submission's 204 alone does not mean its boards changed. |

The JSON line includes `operation` (`start`, `beat`, `end`, `read`, `delete`,
`preflight`, or `unknown`), HTTP `status`, `runPersisted`, and `boardsWritten`
(an array containing only `all` and/or `daily`). Optional fields are `reason`,
`phase`, `range` on reads, and `quarantined` when a submission attempts a fold.

| Outcome | Meaning |
|---|---|
| `started` | The new run record was persisted; the existing token JSON is returned with HTTP 200. |
| `skipped_cadence` | A beat arrived inside the cadence window; no writes, HTTP 204. |
| `skipped_no_change` | A beat changed no high-water, day, or name; no writes, HTTP 204. |
| `run_persisted` | Only the run record was persisted; the board-fold threshold was not reached, HTTP 204. |
| `boards_written` | Both board writes completed, including the existing verify-and-repair pass for finals, HTTP 204. This is not a guarantee of top-100 inclusion or concurrent-write durability. |
| `quarantined` | Both boards were written with a quarantined entry, which public reads hide, HTTP 204. |
| `read` | The board was read successfully, including a genuinely missing key returning an empty board, HTTP 200. |
| `rejected` | Existing HTTP 400/401/403/429 behavior, with a fixed `reason`. |
| `storage_error` | A KV operation or stored JSON decoding/shape check failed; HTTP 500 with only `{"error":"storage_error"}` and `Cache-Control: no-store`. |
| `internal_error` | An unexpected non-storage exception; HTTP 500 with only `{"error":"internal_error"}`. |
| `misconfigured` | Missing signing secret; the existing HTTP 500 response is preserved. |
| `deleted`, `preflight`, `not_found` | Existing admin-delete 204, OPTIONS 204, and unknown-route 404 behavior. |

Rejection reasons are `bad_body`, `bad_sig`, `unknown_run`, `finished_run`,
`implausible_rate`, `implausible_day`, `beat_cap`, `rate`, `turnstile`, and
`auth`. Storage failure phases are `rate_read`, `rate_write`, `run_read`,
`run_write`, `run_delete`, and `board_all_*` / `board_daily_*` with suffix
`read`, `write`, `verify`, or `repair`.

`runPersisted` becomes true only after the run's put resolves, and each board
enters `boardsWritten` only after its put resolves. These fields survive a
later failure, so a `storage_error` can report a saved run and only the all-time
board written. A failed put has an unknown persistence result; the fields
report acknowledged operations, not a transaction. A final may already be
marked done when a board operation fails, so another final can be rejected as
`finished_run`. There are no new retries, rollback, or storage changes; the
existing final verify-and-repair pass and KV consistency tradeoffs remain.

Board read failures no longer masquerade as empty successful boards, and a
fold cannot overwrite a board it failed to read. Malformed stored run JSON
is also a storage error rather than an `unknown_run` rejection. A genuinely
absent run remains `unknown_run`.

### Tail and deployment

These diagnostics and the observability settings require a **Worker redeploy
by Gary**; deploying the GitHub Pages game does not update the Worker. No
client update is required for the headers to appear in Network tools.
`sendBeacon` cannot inspect response headers; ordinary fetch can. Board reads
retain their 30-second public cache policy, so a cached response can carry the
original invocation's request ID rather than produce a new Worker log.

`wrangler.toml` enables persisted logs at sampling rate 1 and disables automatic
invocation logs, which include raw request URLs. Use a current Wrangler version
that supports `observability.logs.invocation_logs`; see Cloudflare's
[Workers Logs configuration](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).
Log retention and volume limits still apply, and neither this setting nor the
custom logger redacts metadata independently collected by other platform tools.

After that deployment, run from the repository root:

```sh
npx wrangler tail --config workers/leaderboard/wrangler.toml --format json
```

Wrangler wraps console lines in a tail envelope that can include platform
request metadata. To display only the safe custom events rather than share or
save that envelope:

```sh
npx wrangler tail --config workers/leaderboard/wrangler.toml --format json \
  | jq --unbuffered '.logs[]?.message[]? | fromjson? | select(.event == "leaderboard_request")'
```

Match a response's `X-Leaderboard-Request-Id` to `requestId`, then inspect
`outcome`, `reason`/`phase`, and the acknowledged writes. Do not filter tail
only by invocation failure: the Worker catches errors and returns HTTP 500,
so the platform invocation itself can complete normally. Historical custom
logs are available in the Worker's **Observability** dashboard after deployment.

`bin/test-leaderboard-worker` runs entirely against mock KV, intercepts console
output, and checks the original protocol alongside outcomes, correlation/CORS,
all storage failure phases, corrupt stored data, partial writes, and secret
leakage. It requires neither production requests nor a deployment.

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
