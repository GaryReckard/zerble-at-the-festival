# Code Review Summary

## Review Metadata
- Diff Scope: custom — `b9326c8..84422b9` on `vm-main` (festival-run-stakes groups 6–9: stakes machinery, P2 docs, global leaderboard, wrap)
- Reviewed Files: 28 (+1,587 / −57)
- OpenSpec Change: openspec/changes/festival-run-stakes/
- Specialists Used: review-gameplay, review-performance, review-sandbox, review-docs (all Opus). review-rendering and review-audio deliberately skipped: the diff contains no three.js material/geometry/scene-graph code and no `sound.js` change (the audio work was group 5, outside this scope).
- Verified by orchestrator: the sandbox P1 (cycle-dial squash) was confirmed with live geometry — in Just Cruisin' the dial measures **3.4px wide** (should be 31px); screenshot evidence in the session scratchpad. The two P0 code paths were re-read and confirmed in current sources.

## Intent Match
The change does what the four commit subjects, CHANGELOG entries, and the OpenSpec change promise: an endless Festival Run stakes layer (day ramp, sputter + vibe deaths, rescue, live score screen), mode-gated behind `runMode.js`, plus the in-repo Cloudflare Worker and fire-and-forget client. Determinism holds under adversarial review: `JUG_FILTER_SALT` collides with no existing salt, the `return`-not-`continue` filter gate is genuinely draw-count-neutral, no new `Math.random()` reaches a seeded path, and no lifecycle/`chunkKey` rules changed. The iOS start path remains synchronous to `Sound.init()`. Importmaps carry `runState` in all three game pages; `workers/` correctly stays outside them; no runtime deps added. **However, the headline invariant — "Just Cruisin' is byte-for-byte today's game" — is breached on two paths the drills never exercised: cross-mode resume, and CSS layout of hidden stakes chips.**

## Findings

### Blockers
- [P0][high][review-gameplay] src/main.js:679 — Resume + mode flip leaks the whole stakes machine into Just Cruisin'
  - Why: `RunState.restore(__resume.run)` runs at module load regardless of the mode picked at the post-resume title card; the per-frame stakes block gates on `RunState.active` alone. Festival → Settings-Apply → pick Cruisin' → Start yields sputter limp, vibe/day chips, and a `ran_dry` DEATH in the mode whose contract is "can never end your run."
  - Fix: apply the resume payload mode-conditionally at Start (only when the started mode matches the snapshot's mode); hard-clear RunState otherwise; belt-and-suspenders `RunMode.isFestival()` on the frame gate.
- [P0][high][review-gameplay] src/main.js:555 — Cruisin' score launders into the Festival Run leaderboard across a resume
  - Why: same root, other direction: `Scoring.restore` at load + mode flip to Festival ships a Cruisin'-accumulated `highWater` (e.g. 5,000) to the local and global boards from a seconds-old run; the Worker ceiling (7,200 at 1 min) doesn't catch it.
  - Fix: covered by the same mode-conditional resume gate (or `Scoring.reset()` on mode mismatch).
  - Duplicate-of: shares root with the P0 above — one fix resolves both.

### Must fix before merge
- [P1][high][review-gameplay] src/leaderboard.js:88 — pagehide beacon posts `/run/end`, so one mobile backgrounding permanently closes the run server-side
  - Why: `pagehide` fires on iOS/Android app-switch/bfcache, `run.done = true` then rejects every later beat and the real final; the player's global score silently freezes. This is the project's most-cared-about platform.
  - Fix: beacon `/run/beat` instead (beats already upsert the board, which is the whole "killed tab still records" guarantee, and leave the run open).
- [P1][high][review-sandbox] index.html:177 — the hidden "Day" label squashes the day/night dial in Just Cruisin'
  - Why: `.hidden` here is visibility-based, so the nowrap label keeps its 31.6px box inside the fixed 42px cycle chip; the dial (no `flex-shrink: 0`) collapses to a measured 3.4px sliver in the DEFAULT mode. Orchestrator-confirmed with pixels.
  - Fix: `display: none` hiding for `.day-n` (and let the chip auto-size when the label shows), `flex: 0 0 auto` on the dial; re-screenshot both modes.
- [P1][medium][review-gameplay] src/main.js:683 — a resumed Festival Run mints a fresh Worker token, so the Worker's own plausibility guards reject it (and one logical run occupies two board rows)
  - Fix: carry the run token (`runId`/`startTs`/`sig`) through the resume snapshot and re-adopt it instead of calling `globalRunStart()`.
- [P1][high][review-gameplay] src/main.js:568 — the frown vibe strike, the dry-tank smile tax, AND the `frownMult` ramp column are all unreachable in Festival Run — **design decision needed (→ new Q6)**
  - Why: frowns only fire when the tank is dry; dryness always implies sputter in an active run; the sputter suppression therefore swallows 100% of frown consequences. Three shipped knobs (`VIBE.frownStrike`, `frownMult`, `crowd.frownRateMult`) are mechanically inert, and the red "lost smile" particle lies (nothing was deducted). The council's "flavor-only during sputter (no pile-on)" and "frowns become the vibe system's feedback face" turn out to be mutually exclusive as implemented.
  - Fix options for Gary: (a) land the reduced `frownStrike` even during sputter (makes the knobs real; softens "no pile-on"), or (b) delete the three dead knobs and the spawnLost call on this path. Not applied unilaterally.

### Should fix soon
- [P2][medium][review-sandbox] index.html:145,160,163,179 — new stakes chips use fade-`.hidden` instead of the codebase's `display:none` convention, so Cruisin' carries invisible-but-space-reserving chips (vibe chip + gap, sputter span, board-tabs band on every score screen while global is off; pre-existing combo chip shares the pattern)
  - Duplicate-of: review-performance styles.css:684 (the always-running `vibePulse` box-shadow animation on the hidden sputter span — same root, perf facet).
- [P2][medium][review-gameplay] src/crowd.js:2203 — `frownAt` clobbers the same-frame `fleeing` state, removing the damage-0 anti-double-hit grace (~1.4 vibe strikes/sec against one pinned victim).
  - Fix: skip the mouth flip for fleeing NPCs, or evaluate the frown branch after the fleeing lock.
- [P2][medium][review-gameplay] src/main.js:557 — a resumed mid-sputter run restores the death clock but not the limp or the sputter audio (death armed, every cue gone).
  - Fix: re-sync `zerble.sputtering` + `Sound.startSputterLoop()` from restored state at Start.
- [P2][medium][review-docs] ARCHITECTURE.md:361 — the group-7 "Festival Run layer" section was outgrown by group 8 (still calls the global board "the change's P3"; nothing documents `workers/`).
- [P2][medium][review-docs] DEBUGGING.md:40 — the wrangler-less dev loop (`dev-server.mjs` bridge + `zerble-board-url` override + reload-required caveat) isn't in the harness doc. (Sandbox cross-flagged the same gap.)
- [P2][medium][review-docs] src/main.js:2436 — `__dbg.help()` never learned the five Festival Run drills (sandbox duplicate: same).
- [P2][medium][review-docs] CHANGELOG.md — the three new GA4 events (`run_start`, `run_end`, `leaderboard_submit`) shipped without the changelog's usual name-free-contract line.
- [P2][medium][review-docs] tasks.md 8.1 — ticked, but its named `workers/leaderboard/README.md` deliverable doesn't exist (runbook lives in wrangler.toml; Q4 still open).
- [P2][low][review-docs] index.html:235 — title-card hint still promises "free refill," contradicting Festival Run's Day-2 vendor pricing.

### Notes / follow-ups
- [P3][review-performance] hud.js:279 — `vibe-warn` class never cleared on chip deactivate (pulse keeps running under the score screen).
- [P3][review-performance] main.js:984 — heartbeat argument object built every frame even when the global board is disabled; wrap in `globalEnabled()`.
- [P3][review-gameplay] zerble.js:1252 — sputter limp scales forward speed only; reverse stays 100%.
- [P3][review-gameplay] worker.js:145 — missing `SIGNING_SECRET` fails open (HMAC keyed on the literal string "undefined"); admin bearer compare isn't constant-time.
- [P3][review-gameplay] worker.js:177 — `board:all` is a hot KV key (1 write/sec cap, last-write-wins; a racing FINAL can be lost permanently); daily board keys have no TTL and accumulate forever.
- [P3][review-gameplay] runState.js restore accepts an `{active:true, over:true}` zombie snapshot.
- [P3][review-gameplay] crowd.js:2197 — porta-potty comment now orphaned onto `frownAt`.
- [P3][review-docs] DEBUGGING.md:42 — "answers 'no active Festival Run'" over-claims (true for 4 of 7 drills); main.js:1853 stale "real wiring lands with runState" comment; CHANGELOG "disabled in production" slightly stronger than code (the `zerble-board-url` override isn't localhost-gated — code-side decision); CLAUDE.md never names `npm run check` as the node-side gate.
- [P3][review-sandbox] package.json — five new test gates lack individual `test:*` aliases.

## Verification Gap
The shipped drills were genuinely strong (dry/vibe/rescue deaths, vendor economy, resume round-trip, invariance byte-identical, Worker protocol e2e via the node bridge, both-mode boots at `?perf=low`) — but they had two blind spots this review exposed: **cross-mode resume** (no drill flips the mode across a Settings-Apply reload; both P0s live exactly there) and **CSS-layout invariance** (the registry/rng invariance drill can't see a squashed DOM chip; only a Cruisin' HUD screenshot could, and all HUD screenshots were taken in Festival mode). Tier coverage was `?perf=low` only, acceptable for a DOM/state change. Recommended additions: a cross-mode-resume drill and a Cruisin' HUD-geometry assert alongside the invariance re-diff.

## Suggested Commit/PR Description + CHANGELOG entry
Fix commit (suggested): "festival-run-stakes review fixes: mode-gate the resume payload (Cruisin' invariance), beacon to /run/beat, resume token carry, display:none stakes chips (un-squash the Cruisin' cycle dial), fleeing-frown guard, sputter resume re-arm, worker fail-closed secret + daily-board TTL, doc drift." CHANGELOG: one `### Fixed` block under 2026-08-29 naming the Cruisin' cycle-dial regression + the cross-mode resume leak as the player-visible items, with the mobile beacon fix under the leaderboard bullet.

## Verdict
**Block** (for merge to main) until the two P0s and the four P1s are resolved — the P0 pair is one fix, the beacon and dial fixes are small, the token carry is moderate, and the frown-strike P1 needs Gary's design call (recorded as Q6). Everything else is non-blocking cleanup. The underlying feature work is sound: determinism, the iOS path, the Worker's guardrails, and the no-build stance all survived adversarial review.

---

## Outcome (2026-08-29, post-review fix pass)

All findings addressed except one accepted note. Fixed: both P0s (resume payload
now applies at Start, mode-matched only; belt-and-suspenders RunMode check on
the frame gate), beacon → /run/beat, Worker token rides the resume snapshot
(globalRestore), day-label/dial layout + display:none convention for all stakes
chips, fleeing-frown guard, mid-sputter resume re-arm (limp + chug loop),
vibe-warn clear on deactivate, heartbeat wrapped in globalEnabled, reverse limp,
Worker fail-closed secret + constant-time admin compare + daily-board TTL +
final verify-and-repair, zombie-snapshot restore guard, localhost-gated
zerble-board-url override, and the full docs batch (ARCHITECTURE leaderboard
bullet + workers/ pointer, DEBUGGING dev-loop + drill wording, __dbg.help() run
line, CHANGELOG GA4 events line + Fixed block, title-card refill hint,
CLAUDE.md npm-run-check line, workers/leaderboard/README.md, package.json
test:* aliases, stale comments). Q6 resolved by Gary: option (a) — sputtering
frowns land the half-weight vibe strike, no smile tax; frownMult is now
load-bearing.

Accepted as-is: KV read-modify-write eventual consistency on board arrays
(documented trade; finals now verify-and-repair).

Re-verification: new `bin/drill-stakes` 17/17 (cross-mode resume both
directions via the real mode-button flip, Cruisin' HUD geometry, matched
resume, both deaths); global e2e 12/12 (incl. new E4: resumed run reuses its
token — one board row, high-water carried); invariance re-diff byte-identical
(705944195, n=350); `npm run check` 16 gates green (new fail-closed Worker
assert); both modes re-screenshot — Cruisin' dial 31×31.

**Verdict after fixes: Approve.** Merge-blocking items cleared.
