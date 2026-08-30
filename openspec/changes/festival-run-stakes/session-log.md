---
change: festival-run-stakes
status: complete
current_task: "done"
blocked_by: null
open_questions: 5
started: 2026-08-28
last_updated: 2026-08-29
ref: "ROADMAP 'Name entry on the title card' + parked 'costs smiles economy' bullet; brainstorm 2026-08-28 (auto-memory festival-run-stakes-design.md); Locke's issue #1 triage"
---

# Session Log: festival-run-stakes

> **AGENT DIRECTIVE:** This log is the "why" trail — it is **event-driven**, not a
> per-task diary. Write an entry only when a decision is made, something unexpected is
> discovered, a blocker is hit, or a question is raised for the human. Per-task progress
> lives in `tasks.md` checkboxes; the human-readable summary lives in `README.md`. To
> recover context, read `README.md`, then this file's frontmatter + Key Decisions + the
> latest Work Log entry, then `tasks.md`.

## Key Decisions
<!-- APPEND-ONLY. -->
- D1: Endless-until-death (Gary's call, over timed-weekend runs); day-ramp makes death statistically inevitable so the leaderboard measures skill, not patience.
- D2: All stakes tuning mode-scoped (`runMode.js` config gate); Just Cruisin' behaviorally invariant; `JUICE_STACK_MAX = Infinity` untouched (was Gary's explicit call).
- D3: Jug scarcity = deterministic runtime filter with fresh salt over realized pickups; seeded worldgen streams untouched (determinism tripwire).
- D4: Score routed through one `scoring.js` module; leaderboard records the HIGH-WATER mark; vendor refills spend current smiles (per ROADMAP's parked "costs smiles" idea) — Gary gut-check pending (-> Q2).
- D5: Chain combo counts smiles however earned; Locke's variety-weighted combo TABLED by Gary (illegible without call-out UI). Lurleen following = flat ×2 stacking on top; hit scares her off (Gary approved both).
- D6: Smile SFX = pentatonic pitch ladder keyed to combo chain (audible combo feedback); voice-capped, same-frame chord coalescing.
- D7: Global board = Cloudflare Worker, heartbeat protocol (token → ~60s beats → final/beacon); honest ceiling: mitigations not prevention. Worker code in-repo; DEPLOY IS GARY-ONLY (-> Q4).
- D8: Frowns change jobs: dry-tank tax → vibe-system feedback; flavor-only during sputter (no pile-on).
- D9: Council deliberation 001-initial (5 personas + mediator, all "Proceed with mitigations") adopted in full — design D3 pinned (filter gates only the final build/add triplet after all ctx.rng draws; ambient scatter only; day-state via poll-pattern setter, unfiltered sandbox default), D13 (Cruisin' first-visit default), D14 (rescue no-jug fallback), D15 (persistent vibe HUD widget), D16 (hit.damaging + !isGod gate in main.js), recalibrated Worker ceiling formula (×8 multiplied max, never raw GA4 baseline), saveBest mode-gate (Task 3.4), invariance check run twice (3.5 + after 4.2), dry-death checkpoint before vibe work, four bin/test-* scripts alongside their modules. Full record: deliberations/001-initial/results.md.

## Assumptions
| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | High-water scoring + vendor smile-pricing matches Gary's intent (he never gut-checked; ROADMAP parked the idea approvingly) | High | Open | -> Q2 |
| A2 | Lurleen tow rescue (once/run, only while following) is wanted — Gary responded warmly to the framing, never confirmed | Medium | Open | -> Q3 |
| A3 | D6 day-ramp numbers are placeholders; expect retuning after Gary plays | High | Open | -> Q1 |
| A4 | Score screen/board UI in Cruisin' is fully hidden (not just empty) — inferred from "Cruisin' invariant" | High | Open | — |

## Dangling Threads
- ROADMAP juice bullet says stockpile "up to 4 meters" but code is `Infinity` — reconcile the stale text when consuming the bullet (Task 7.1).
- Daily-seed challenge mode: parked; add to ROADMAP in Task 7.1.
- Passenger quests must plug into `scoring.award` + `bubbles.addJuice` (spec'd forward-compat only).

## Work Log

### 2026-08-28 -- Change created from brainstorm; artifacts fast-forwarded
**Event:** phase-change
**What:** Full-day brainstorm (Gary + agent) produced the design; Gary left ("get as much done as you can, don't wait on my input") after approving: endless mode, multi-mode split, Cloudflare Worker path, chain combo + Lurleen ×2 + scare-off, juice-tip quests (future), smile SFX. Proposal, 11 delta specs, design, tasks written in one pass. Open calls proceeding on stated assumptions rather than blocking (-> Q1..Q4).
**Refs:** -> D1..D8, auto-memory `festival-run-stakes-design.md`, Locke's GaryReckard/zerble-at-the-festival#1

### 2026-08-28 -- Deliberation gate satisfied; council amendments folded in
**Event:** phase-change
**What:** Tier 3 deliberation ran (Architect, Adversary, Anthropologist, Pragmatist, Auditor + Mediator; synthesis mode). Unanimous Proceed-with-mitigations; 15-risk register with 2 Critical (jug-filter rng desync, `zerble-best-smiles` cross-mode overwrite — both silent-in-production classes no existing check would catch). All Change Group 1 pin-downs applied to design.md (D3 expanded; D13–D16 added; D8 ceiling formula reworked), tasks.md (rewritten with amendments: saveBest gate as 3.4, invariance ×2, dry-death checkpoint, __dbg runDay/vibe hooks, bin/test-* alongside modules), and the hud/festival-run/carts/crowd-ai/leaderboard delta specs. New Q5 (first-visit mode default) queued. Apply phase now unblocked.
**Refs:** -> D9, deliberations/001-initial/results.md, -> Q3, -> Q5

### 2026-08-28 -- Invariance drill: raw dumpRegistry is NOT stable run-to-run
**Event:** discovery
**What:** The naive invariance check (hash the whole `__dbg.dumpRegistry()`) differs even between two identical Cruisin' boots — the registry contains roaming/runtime entries whose positions drift per frame. The stable form of the drill: filter to `chunkKey`-tagged entries (kind + position rounded to 0.1 + footprint, sorted) PLUS `__dbg.dumpDrawCounts()` (the rng draw-count canary — exactly the metric the jug filter must preserve). With that form: cruisin×2 and festival hash identically on seed=123 (350 chunk-keyed entries, 14 clusters). This exact drill re-runs after Task 4.2 and in the 9.1 smoke. Note for 6.2: lakes deliberately lack chunkKey, so the chunk-keyed filter also sidesteps them; jug parity is covered because scattered jugs ARE chunk-keyed.
**Refs:** -> Task 3.5, -> Task 4.2, -> Task 9.1

### 2026-08-28 -- P1 shipped; group 3 (modes) done minus resume plumbing
**Event:** phase-change
**What:** P1 committed (23dc1a4: name entry + toasts + local board shell; CHANGELOG entries written, ROADMAP "Name entry" consumed). Group 3: runMode.js + bin/test-run-mode green, mode selector on the title card (Cruisin' default-highlighted per D13), saveBest/personalBest mode-gated at all three sites, invariance check #1 green. Task 3.3 (resume snapshot run state) deliberately left open — the run-state fields it must carry don't exist until 6.1 builds runState.js.
**Refs:** -> Task 3.3, -> Task 6.1, commit 23dc1a4

### 2026-08-28 -- Groups 4 + 5 shipped (backfilled after a VM crash ate the session)
**Event:** phase-change
**What:** Group 4 committed (37e5861: scoring.js single-writer + bin/test-scoring, all score writes rerouted, combo badge chip, Lurleen isFollowing/scareOff + doubler, invariance re-run #2 green post-reroute). Group 5 committed (b9326c8: pentatonic smile ladder, frown down-note, sputter loop + marshal whistle + run-end stings staged in sound.js). The session died (VM display issue) mid-Group-6 before these entries were written — backfilled from git + the recovered transcript.
**Refs:** commits 37e5861, b9326c8, -> Task 4.6 (code shipped in 37e5861; checkbox pending its 6.8 drill)

### 2026-08-29 -- Recovery: the "JSON-parse-shaped SyntaxError" was a class-body comma
**Event:** discovery
**What:** The uncommitted Group 6 tree wouldn't boot: `SyntaxError: Unexpected token ','` that the dead session was chasing as a runtime JSON.parse throw. A pre-load error hook pinned it to crowd.js:2198 — the new `frownAt()` method had been pasted into the Crowd class with object-literal syntax (trailing comma). One-char fix; node --check now passes on every touched module. Lesson: `node --check` each edited file when a session hands off mid-edit; Node's ESM import in bin/test-* doesn't cover files only the browser imports.
**Refs:** crowd.js frownAt, -> Task 6.5

### 2026-08-29 -- Group 6 drill battery: game time crawls under SwiftShader; drills must poll, not sleep
**Event:** discovery
**What:** First battery run "failed" dry-death expiry, vendor refill, and vibe decay — all false alarms. Root cause: main.js clamps dt at 0.05/frame and SwiftShader renders ~2-4 fps, so game time advances at a few percent of wall time; wall-clock sleeps in drills time out before game seconds elapse. The stable drill form: `page.waitForFunction` polling `__dbg.runInfo()` predicates (+ generous timeouts), `sputterLeft(0.1)` not (1), and toast asserts must wait a beat after the trigger (MutationObserver records are microtask-deferred past a same-evaluate read). Also: spawn-hub drills that need score pinned at 0 or NPCs stationary must `__dbg.freezeNPCs()` first — the ambient crowd feeds smiles otherwise. Battery after fixes: dry death, vibe warn/eject death, rescue-once-per-run, vendor pay/refusal, invariance re-diff (350 chunk-keyed entries + draw counts, cruisin×2 = festival day-1), all green headless.
**Refs:** -> Task 6.8, scratchpad group6-drills.mjs / group6-retest.mjs

### 2026-08-29 -- Group 6 verified end-to-end; the drills caught a real toast-slot bug
**Event:** phase-change
**What:** Full battery green headless: dry death (sputter arm → countdown → expiry → score screen), vibe warn at the exact crossing + eject death, rescue-once-per-run with juice tip, damaging-hit gate (strike + Lurleen heartbreak; god-mode and grazes rack nothing), broke-cart refusal + paid refill deducting smiles, resume round-trip (day 3 + vibe + score 77 + jugKeep 0.55 all restored), invariance re-diff green, live jugKeep/frownMult reaching their consumers, both modes booting clean. The battery exposed a REAL bug drills exist for: the single HUD toast slot got written twice in one frame on stakes beats, so "Lurleen saw that 💔" was instantly overwritten by the generic collision quip and the vendor refusal by the ambient price line — the player would never have seen either. Fixed by priority (stakes beat suppresses the quip; refusal holds back the price toast; whistle/ejection deliberately outranks heartbreak). Also closed while here: `frownMult` was defined in the ramp but consumed nowhere — added `crowd.frownRateMult` (mode-unaware field, fed from the run layer); wrote the missing `bin/test-jug-filter`; wired all four stakes tests into `npm run check`; nowrap on the Day chip. Two follow-ups from D8 worth remembering: the frown vibe-strike weight is currently unreachable (organic frowns only fire while dry ⇒ sputtering ⇒ suppressed — consistent with the council's "no pile-on", kept as future-proofing), and drills MUST poll game-time predicates (see previous entry).
**Refs:** -> Tasks 3.3, 4.6, 6.1–6.8 all ticked, scratchpad group6-retest.mjs, screenshots shot-day3-noon-hud/sputter-dusk/scorescreen-midnight

### 2026-08-29 -- Group 8 shipped: Worker + global client, e2e'd without wrangler
**Event:** phase-change
**What:** `workers/leaderboard/worker.js` (plain JS, KV, D8 protocol + guardrails), `bin/test-leaderboard-worker` (node-driven fetch handler, mock KV — sig binding, ceiling worked example 40×8×1.5×1.5, monotonic HW, killed-tab persistence, sanitation, quarantine, admin delete), the fire-and-forget client in leaderboard.js (token → 60s+milestone beats → final + pagehide beacon), and Local/Today/All-time score-screen tabs with silent local fallback. wrangler can't install on this VM (no npm network), so 8.5's e2e ran the REAL game against the REAL Worker code through a thin node HTTP bridge (`workers/leaderboard/dev-server.mjs`, kept in-repo as the wrangler-less dev path): killed-tab entry stands, final submit lands, tabs render Worker rows, Cruisin' provably makes zero requests. Two decisions worth recording: (a) heartbeats AND finals both upsert the board entry — that's what makes "a closed tab still records" true, not the beacon alone; (b) `GLOBAL_BOARD_URL` gained a localStorage dev override (`zerble-board-url`) so drills and Gary's future wrangler-dev testing exercise the shipped client verbatim; production stays hard-disabled until Gary deploys and sets the const. The e2e also caught globalRunStart missing from `__dbg.start()`'s arming block — the same bypass trap as the stakes arming, now both covered. DEPLOY REMAINS GARY-ONLY (-> Q4): wrangler.toml documents the KV + secrets one-time setup.
**Refs:** -> Tasks 8.1–8.6 ticked, -> Q4, scratchpad global-e2e.mjs

### 2026-08-29 -- Change complete: 41/41. Deploy + playtest are the human half
**Event:** phase-change
**What:** Group 9 wrap: final named invariance re-diff after every edit in the change is byte-identical (chunk-keyed registry + rng draw counts, cruisin×2 = festival day-1, hash 705944195 / 350 entries — the same hash every run since the drill stabilized), both modes boot clean at ?perf=low, full npm run check green (15 gates), README front door synced. Everything an agent can verify is verified. What ONLY Gary can do: (1) deploy the Worker + set GLOBAL_BOARD_URL (-> Q4, wrangler.toml has the runbook); (2) play a real Festival Run and gut-check the D6 ramp numbers + scoring economy (-> Q1, Q2 — placeholders by design); (3) confirm the Lurleen rescue feel (-> Q3) and the first-visit mode default (-> Q5); (4) merge vm-main and push main to actually ship it. Archive via /opsx:archive after the playtest settles the open questions.
**Refs:** -> Tasks 9.1, 9.2, questions-for-human.md Q1–Q5

### 2026-08-29 -- Smart-review 001 (4 Opus specialists): Block → fix pass → Approve
**Event:** discovery
**What:** Gary asked for a /smart-review of groups 6–9. Four specialists (gameplay, performance, sandbox, docs; rendering + audio skipped — no owned files in scope) found what the drills missed: TWO P0s on the cross-mode-resume seam (the snapshot's score/run payload applied at page load, before the player re-picks a mode — Festival stakes leaked into Cruisin' incl. an actual death; Cruisin' scores laundered onto the Festival boards), a mobile-killer P1 (pagehide beacon posted /run/end, so an iOS app-switch froze the run server-side forever), a pixel-confirmed P1 (the hidden Day label crushed the Cruisin' cycle dial to 3.4px — this codebase's `.hidden` keeps layout), a P1 token-mint bug (resumed runs tripped the Worker's own plausibility guards), and ~20 P2/P3s. Everything fixed same-day except one accepted KV-consistency note; Gary answered Q6 with option (a) — sputtering frowns now land the half-weight vibe strike (no smile tax), making frownMult load-bearing. Two structural lessons: (1) the resume payload now applies at START, mode-matched, with a RunMode belt-and-suspenders on the frame gate; (2) stakes-only HUD chips hide with display:none (the .lurleen-status precedent), never the fade-`.hidden`. New permanent regression drill `bin/drill-stakes` (17/17) covers exactly the two blind spots — cross-mode resume via the REAL mode-button flip (pre-seeding localStorage doesn't work: the snapshot's RunMode.set overwrites it) and Cruisin' HUD geometry. Re-verified: global e2e 12/12 (new E4: resumed run reuses its token, one board row), invariance byte-identical, npm run check 16 gates, both modes re-screenshot. Full record: reviews/001-groups-6-9/.
**Refs:** -> Q6 (answered), reviews/001-groups-6-9/review-summary.md, bin/drill-stakes
