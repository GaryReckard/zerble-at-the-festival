# Festival Run acceptance and operations

[Documentation index](../README.md) · [Roadmap](../../ROADMAP.md)

This is a retained design and operating record. Dated measurements and source
anchors require rechecking before use; the roadmap indexes pending work.

## Festival Run acceptance and operations

The `festival-run-stakes` change is code-complete (see
`openspec/changes/festival-run-stakes/`, especially `questions-for-human.md`),
but the acceptance and operating tasks below still need evidence. Remind Gary
when the current task touches them; preserve unanswered decisions until resolved.

- ~~**Deploy the leaderboard Worker (Q4).**~~ DONE 2026-09-01 — deployed to
  `zerble-leaderboard.garbonzo-net.workers.dev`, `PROD_BOARD_URL` set, board
  verified live (200 + browser CORS) and the full protocol drilled against the
  node bridge. **Two follow-ups are still Gary-only:**
  * **`BASE_SMILES_PER_MIN` is still the placeholder 40.** It feeds the
    plausibility ceiling that rejects impossible scores, and it wants the observed
    p99 *organic, un-multiplied* collect rate (never with the ×8 multiplier folded
    in — that's `MAX_MULTIPLIER`, applied separately). Too low rejects honest runs;
    too high lets nonsense stand. **Now measurable** (2026-09-01): `Scoring.rawSmiles`
    counts pre-multiplier pickups and ships as `organic_smiles` / `organic_per_min`
    on GA4 `run_end` + `session_end`, and on every `recordPerf` sample. Two ways to
    get the number: a LOCAL drill (`__dbg.recordPerf(true)` → play → `perfLog()`)
    gives Gary's own rate immediately; GA4 gives the cross-player p99 once the site
    redeploys. **GA4 gotcha:** custom event params need registering as custom
    dimensions/metrics before they appear in standard reports — until then they're
    visible only in DebugView or the BigQuery export. Then change the value in
    `wrangler.toml` `[vars]` + `npx wrangler deploy`.
  * **The free KV tier is ~20 completed runs/day** at the current fold settings
    (measured from the write path: 1 write per accepted beat, +2 more whenever it
    folds to the boards, and at `FOLD_HW_STEP` 25 vs the client's 50-point
    milestone beats essentially every beat folds). Raising `FOLD_HW_STEP` to ~200
    roughly triples capacity at the cost of a slightly staler *live* board; finals
    always fold exactly, so no finished score is ever wrong. `FOLD_HW_STEP`,
    `FOLD_MAX_MIN`, `BEAT_MIN_S` and `MAX_RUN_WRITES` are read by the Worker but
    are NOT in `wrangler.toml` `[vars]` yet, so they sit on code defaults.
- **Confirm leaderboard submissions end to end.** On 2026-10-11, the live
  all-time board returned HTTP 200 with entries and the diagnostic outcome and
  request-ID headers, so the Worker update is deployed and public reads work.
  A read-only board response does not verify every new submission or persisted
  Cloudflare logs. If a Festival Run fails to appear, use the localhost
  `__dbg.leaderboardInfo()` report and matching Worker request ID to trace it.
  See [the logging guide](../../workers/leaderboard/README.md#tail-and-deployment).
- **Playtest gut-checks (Q1–Q3, Q5)** — the tuning numbers are placeholders by
  design: the D6 day-ramp (vendor prices / jug scarcity / vibe limits per day),
  the scoring economy, the Lurleen-rescue feel, and whether first-time visitors
  should default to Cruisin' or Festival. Details in the change's
  `questions-for-human.md`.
- **Playtest the 2026-08-31 crowd ruling.** "A hit is a hit" removed the
  fleeing-damage exemption and speed-scaled the lane dodges
  (`laneDodgeUrgency`, honks reach 2×). Gut-check: can you drive a clean line
  through a crowd at speed? Does a fleeing hit costing smiles in Just Cruisin'
  feel right, or should Cruisin' stay softer? Tunables: `DODGE.URGENCY_MAX`,
  `REACT_K` (steering.js) + the `VIBE` governor knobs
  (`sputterStrikeCooldown`, `sputterVibeCapFrac` in runMode.js).
- **Real-device iOS audio check** — the one thing emulation can't confirm
  (AudioContext unlock on a physical iPhone).
- **Archive the change** — `/opsx:archive festival-run-stakes` once the open
  questions are answered.
