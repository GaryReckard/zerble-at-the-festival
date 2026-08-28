---
change: festival-run-stakes
status: in_progress
current_task: "4.1"
blocked_by: null
open_questions: 5
started: 2026-08-28
last_updated: 2026-08-28
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
