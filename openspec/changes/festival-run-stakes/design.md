# Design: festival-run-stakes

## Context

Full brainstorm record: 2026-08-28 conversation (Gary + agent), summarized in auto-memory
`festival-run-stakes-design.md`. Current facts that shape the design: juice already drains
while bubbling (`bubbles.js:193`) and is a single unbounded meter-in-meters; frowns already
deduct smiles but only when dry (`main.js:538`); score is a flat `score += n` in `main.js`;
NPCs physically collide (`crowd.onZerbleHit`); day cycle is 6 min (`timeOfDay.js:19`);
Lurleen has a wander/aware/follow state machine; smile collection is silent; personal best
persists as `zerble-best-smiles`; a sessionStorage resume snapshot exists; GA4 is wired
fail-safe. Locke's issue #1 was triaged 2026-08-28: only session-rhythm framing folded in;
variety-weighted combo explicitly tabled by Gary.

## Goals / Non-Goals

**Goals:** name entry + toast weaving; a Festival Run mode with real stakes (two deaths,
day ramp, smile economy) that records a name + high-water score on local and global
leaderboards; legible combo feedback (HUD badge + pitch ladder); Just Cruisin' untouched;
Worker code ready to deploy.

**Non-Goals:** passenger quests (interface honored only), bubble varieties, daily-seed
mode (parked to ROADMAP), Festival Passport, arch greeting (cut), any change to worldgen
seeding, any bundler/dependency in the game, Worker *deployment* (Gary's account/secrets).

## Decisions

- **D1. New modules over `main.js` growth.** `src/runMode.js` (mode config + day-ramp
  table), `src/runState.js` (run clock, day counter, sputter, vibe meter, deaths, rescue
  flag, resume serialization), `src/scoring.js` (score/high-water/combo/doubler),
  `src/leaderboard.js` (local board + Worker client). Each is a plain ES module added to
  all four importmaps. `main.js` wires callbacks, as it does for existing systems.
  *Alt considered:* growing `main.js` — rejected, it's already the largest file and the
  scoring choke point demands a module boundary.
- **D2. Mode config as the single gate.** One frozen config object per mode; stakes call
  sites read `MODE.vendorPrice(day)`, `MODE.jugKeepFraction(day)`, etc. Cruisin's config
  encodes today's constants so "invariant" is auditable in one file. Mirrors the `PERF`
  tier pattern.
- **D3. Jug scarcity = deterministic runtime filter.** Festival Run keeps a jug iff
  `worldHash(x, z, JUG_FILTER_SALT) / 2^32 < keepFraction(day)`. Fresh salt constant;
  zero contact with existing seeded streams; same jug set every run at a given day
  level on the same world. Cruisin' skips the filter entirely. *Alt considered:*
  tuning spawn counts in worldgen — rejected (determinism tripwire; regenerates
  existing worlds). Council pin-downs (001-initial):
  - **Injection point:** the mode/day check gates ONLY the final
    `buildBubbleJug()`/`group.add`/`registry.add` triplet, strictly AFTER all
    `ctx.rng()` draws for that jug complete — never short-circuiting the candidate
    search, because `scatterWorldgenCampsites` depends on `ctx.rng()` draw-count
    parity with the jug scatter (`chunks.js:2156`). Done wrong this is a silent
    Non-Negotiable-#1 violation; `bin/test-jug-filter` is its regression gate.
  - **Scope:** applies ONLY to the ambient `scatterBubbleJugs` scatter
    (`chunks.js:2130`). `_placeSpawnJugs` (the guaranteed intro ring,
    `chunks.js:559-593`) is exempt — Day 1 stays tutorial-soft.
  - **Live day-state into chunks:** a documented module-level setter
    (`setJugKeepFraction(f)` or equivalent) polled at `_generate` time, à la the
    `nightness` poll pattern — the first run-mutable input chunks have (PERF is
    session-immutable). Default is UNFILTERED (1.0) so `hub-sandbox.html`
    (`buildHubPreview`) and `map-sandbox.html` are untouched. Accepted, stated side
    effect: chunks re-generated late in a run read thinner on backtrack ("the well's
    drying up" — flavor, not accident).
- **D4. Scoring pipeline.** `scoring.js` owns `{current, highWater, comboLevel,
  chainWindow}`. Inputs: `collect(n)` (from the smile collect event), `award(n, {kind})`
  (future quests, `__dbg.addSmiles`), `deduct(n, {kind})` (frowns, vendor spend),
  `breakCombo(reason)`, `setDoubler(on)`, `pinCombo(on)` (star power). HUD subscribes;
  audio derives ladder step from `comboChainCount`. High-water only ever ratchets up.
- **D5. Combo tuning (initial).** Chain window 4s, refresh on collect; levels at chain
  counts 0/5/12/22 → x1/x2/x3/x4. Numbers live in `runMode.js`, expected to move in
  playtesting.
- **D6. Day-ramp table (initial draft — Gary to feel out; -> Q1).**

  | Day | Vendor price (smiles/full refill) | Jug keep | Frown mult | Vibe: warn/eject (strikes in 60s) |
  |-----|------|------|------|------|
  | 1 | 0 (free) | 1.0 | 1.0 | 4 / 8 |
  | 2 | 10 | 0.75 | 1.1 | 4 / 8 |
  | 3 | 20 | 0.55 | 1.25 | 3 / 7 |
  | 4 | 35 | 0.40 | 1.4 | 3 / 6 |
  | 5+ | 50 (+10/day, cap 100) | 0.30 | 1.6 | 2 / 5 |

  A "strike" = one damaging NPC hit (weight 1) or one frown-caused smile loss
  (weight 0.5); the meter decays one strike per 15s.
- **D7. Sputter.** Entered at `juice <= 0` in Festival Run: `maxSpeed` clamped (~35%),
  boost disabled, 45s HUD countdown, sputter audio loop, frown deductions suppressed.
  Any `addJuice` > 0 exits. Expiry → rescue check → death `ran_dry`.
- **D8. Worker: Hono-less plain JS on Cloudflare, KV storage.** Endpoints:
  `POST /run/start` (Turnstile-verified when configured; returns `{runId, sig}` where
  `sig = HMAC-SHA256(secret, runId|startTs)`), `POST /run/beat` (validates sig,
  monotonic high-water, smiles/min ceiling, day-vs-elapsed), `POST /run/end`,
  `GET /board?range=daily|all`, `DELETE /admin/entry` (admin bearer). KV layout:
  `run:<id>` (state, TTL 48h), `board:all` + `board:daily:<date>` (top-100 arrays,
  read-modify-write; contention is negligible at this scale — *alt:* D1/Durable
  Objects rejected as overkill). Profanity filter: small in-Worker denylist +
  length/charset clamp + blank → "ZERBLER". **Plausibility ceiling (recalibrated per
  council — the raw pre-combo GA4 baseline is forbidden; it would invisibly
  quarantine exactly the legit top players):**
  `ceiling(elapsedMin) = BASE_SMILES_PER_MIN × MAX_MULTIPLIER × STAR_ALLOWANCE ×
  SAFETY`, where `BASE_SMILES_PER_MIN` is the observed p99 organic un-multiplied
  collect rate (from GA4 `session_end`, ~pre-change data is valid for THIS factor
  only), `MAX_MULTIPLIER = 8` (combo ×4 × Lurleen ×2), `STAR_ALLOWANCE ≈ 1.5`
  (Star Power's pinned-cap + `applyStarLove` auto-farm windows), `SAFETY = 1.5`.
  All four factors live in Worker env for tuning without redeploy; the 8.2 unit
  test asserts the worked example (a legit ×8 max-rate run passes; a
  beyond-formula run is rejected).
- **D9. Client networking is fire-and-forget.** All fetches wrapped, timeboxed, and
  swallowed; a failed `/run/start` puts the run in local-only state; `pagehide` uses
  `navigator.sendBeacon`. No retry queues in v1.
- **D10. Name/mode UI on the title card, not a new screen.** Input + two mode buttons
  slot into the existing card markup; start handler reads `input.value` synchronously
  before `Sound.init()`. The disclosure line ("name appears on the public leaderboard
  in Festival Run") sits under the input in small print.
- **D11. Phasing (independently shippable).** P1 name+toasts+local board (records
  score-at-title-return in Cruisin'-like play? NO — local board only records Festival
  Runs; P1 ships the board UI reading an empty/seeded list) → P2 Festival Run core
  (modes, ramp, deaths, combo, SFX, score screen, local board live) → P3 Worker +
  global client. CHANGELOG entry per shipped phase.
- **D12. Smile SFX.** Triangle-ish bell voice, pentatonic ladder over two octaves
  rooted near the existing SFX palette, ±8 cent detune, 6-voice cap with same-frame
  coalescing into a chord, ladder index = combo chain count clamped to ladder length;
  reset on chain break. Frown down-note reuses the voice at low gain, minor-third fall.
- **D13. First-visit mode default = Just Cruisin'** (council, 001-initial). With no
  persisted preference, Cruisin' is the default-highlighted choice — a returning
  sandbox player's habitual Start tap must never land them in a mode that can kill
  their cart unwarned. Festival Run stays one tap away. Gary may upgrade to a louder
  first-run choice screen (-> Q5).
- **D14. Lurleen rescue no-jug fallback** (council, 001-initial). If the rescue fires
  with zero `bubble_jug` entries registry-resident (plausible at Day 5+ keep=0.30
  with a 2–3 chunk load radius), grant the minimal refill with no tow animation and
  consume the rescue. No undefined path ships.
- **D15. Vibe meter is always visible in Festival Run** (council, 001-initial). A
  persistent ambient HUD widget, parity with the always-on juice meter — threshold
  toasts alone would make ejection feel arbitrary. One dirty-flagged DOM element.
- **D16. Stakes hit-gating lives in `main.js`** (council, 001-initial). Vibe strike,
  combo break, Lurleen scare, struck-NPC frown all fire on `hit.damaging && !isGod()`
  (mirroring `main.js:1201`) — never on raw `crowd.onZerbleHit`, which also fires for
  `damage: 0` grazes of fleeing NPCs (`main.js:1356`). One shared trigger condition
  with the sputter frown-suppression.

## Risks / Trade-offs

- [Determinism] Jug filter mis-implemented against chunk streams → world regen for
  existing players. → Mitigation: filter operates on realized pickup entries only
  (D3), fresh salt, verified by comparing `dumpRegistry` across modes on one seed.
- [iOS audio] Name input or mode select introduces an async hop before `Sound.init()`.
  → Mitigation: spec scenario + manual check of the tap handler; no `await` allowed in
  the start path (existing tripwire doc).
- [Cruisin' drift] Stakes code leaks into the shared path. → Mitigation: D2 single
  config gate + a verify-phase A/B pass (same seed, both modes, diff `dumpRegistry`
  and HUD surfaces).
- [Perf] New HUD DOM + Web Audio voices on low tier. → Mitigation: DOM updates are
  dirty-flagged like existing HUD code; audio voice cap; no new geometry/draws —
  budget panel glance required before done.
- [Leaderboard integrity] It's a client game; forgery is bounded, not prevented.
  → Mitigation: D8 guardrails + quarantine + admin delete + daily reset. Accepted
  ceiling, documented in the leaderboard spec.
- [Worker deploy gap] Code ships undeployed; global board dark until Gary runs
  `wrangler deploy` + sets secrets. → Mitigation: client feature-flags the global
  board off until a configured endpoint responds; local board carries P1–P2.
- [Save-scumming] Resume snapshot could be abused to retry deaths. → Accepted for v1
  (sessionStorage only survives a same-tab reload; the run token's server clock keeps
  the global board honest-enough).

## Migration Plan

No seeded stream changes; existing worlds regenerate identically (D3). New
localStorage keys are additive; absence of `zerble-player-name` or mode key falls back
to today's behavior. `zerble-best-smiles` remains the Cruisin' personal best and is
untouched.

## Open Questions

Tracked in `questions-for-human.md`: Q1 ramp numbers (D6 table is a draft to feel out),
Q2 high-water + vendor-pricing gut check (proceeding per ROADMAP's parked "costs
smiles" idea), Q3 Lurleen rescue keep/cut (proceeding: keep), Q4 Worker deployment
(account, Turnstile, secrets — Gary-only).
