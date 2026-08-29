# Give Zerble real stakes: names, an endless Festival Run, and a leaderboard

> **Status:** <!--STATUS:LINE-->in progress · 31/41 tasks (75%)<!--/STATUS:LINE-->
>
> _Plain-language summary of this change. A non-engineer should understand it; a junior dev should grasp it; a senior dev should be able to build an accurate mental model from this file alone._

## TL;DR

Right now Zerble is a lovely toy: you drive around forever, smiles go up, and nothing
is ever at stake. This change asks for your name on the title card, then adds a new
**Festival Run** mode where you can actually lose (run out of bubble juice, or annoy
enough people that the marshals walk you out), a combo system that makes skilled play
score higher, and arcade leaderboards (one private on your device, one global on the
internet) that record your name and best score. The existing chill game survives
untouched as **Just Cruisin'**.

## The Problem

The game has no goal, no way to win or lose, and no reason to come back tomorrow. The
score (smiles) is a number that only ever goes up, refueling is free and everywhere,
and hitting people has no consequence. Gary wants arcade-style stakes and a
name-on-the-board payoff, without losing the warm, no-pressure sandbox that existing
players already enjoy.

## Proposed Fix

- **Name entry** on the title card ("What's your name?"), remembered between visits,
  sprinkled into the game's little toast messages. Never sent to Google Analytics.
- **Two modes**: Festival Run (everything below) and Just Cruisin' (today's game,
  bit-for-bit — enforced by routing every stakes knob through one config object).
- **A day counter that turns the screws.** Each in-game day (6 real minutes) makes
  juice scarcer, vendor refills pricier (they charge smiles from Day 2), crowds
  touchier, and marshals stricter — so every run eventually ends, and "I survived to
  Day 6" means something.
- **Two ways to lose**: run completely dry (a limp-mode grace period, then Zerble
  conks out) or kill the vibe (hitting people fills a meter: whistle warning first,
  then you're escorted out). Knocking over chairs stays slapstick — only people count.
- **Skill scoring**: chaining smiles quickly builds a ×2/×3/×4 multiplier shown on a
  HUD badge; any hit or frown resets it. Lurleen (the cart Zerble is sweet on)
  doubles everything while she's following — and bolts if you hit someone. The
  leaderboard records your *peak* score, so spending smiles on fuel digs a hole but
  never erases your best.
- **You can finally hear smiles**: each one plays a soft musical blip that climbs a
  scale as your chain grows — the combo is audible, not just visible.
- **Leaderboards**: a local top-10 stored in your browser, plus a global board run by
  a tiny free Cloudflare server (code ships in this repo; Gary flips it on). The game
  reports scores as you play, so even closing the tab mid-run records your best.
  Cheating a client-side game can't be fully prevented — the server enforces
  "plausible growth over real time" checks, rate limits, name filtering, and easy
  cleanup instead.

Technical how: [design.md](design.md). Decision record: [deliberations/](deliberations/).

## Progress

<!--STATUS:AUTO-->
**in progress** — 31/41 tasks complete (75%) · current: 7.1

_Last updated: 2026-08-29_

| Group | Progress |
|---|---|
| 1. Name entry + toast weaving (P1) | 5/5 ✅ |
| 2. Local leaderboard storage + score screen shell (P1) | 3/3 ✅ |
| 3. Modes + mode config (P2) | 5/5 ✅ |
| 4. Scoring pipeline + combo (P2) | 7/7 ✅ |
| 5. Smile SFX pitch ladder + stakes cues (P2) | 3/3 ✅ |
| 6. Festival Run stakes: economy, sputter, vibe, deaths (P2) | 8/8 ✅ |
| 7. P2 docs + ship | 0/2 |
| 8. Global leaderboard: Worker + client (P3) | 0/6 |
| 9. Verify + wrap | 0/2 |
<!--/STATUS:AUTO-->

## Key Decisions

- Endless-until-death, not a timed run — the day ramp makes death inevitable so the
  board measures skill, not patience (Gary's call).
- Just Cruisin' is sacred: one mode-config gate, zero behavior drift, the unlimited
  jug stockpile stays.
- Jug scarcity is a runtime *filter* with a fresh salt — the seeded world generation
  is never touched, so nobody's existing world reshuffles.
- Score flows through one module; the recorded score is the run's high-water mark.
- Combo counts smiles however they're earned — no hidden "variety" rules (Gary
  vetoed those as illegible).
- The global board is honor-system-with-guardrails, by design; heartbeat reporting
  doubles as both the "never-dies" recorder and the anti-cheat signal.
- Worker code ships in-repo but deployment (account, secrets) is Gary-only; the
  global board stays dark until then, with the local board carrying everything.

## Risks & Watch-outs

- **Determinism**: the one genuinely scary tripwire — jug filtering must never touch
  seeded generation. Mitigated by design (filter over realized pickups) and a
  same-seed A/B registry diff in the tasks.
- **iOS audio**: the name field and mode buttons live on the title card, where the
  start tap must synchronously initialize audio. No `await` allowed in that path.
- **Cruisin' drift**: stakes code leaking into the shared path. Mitigated by the
  single config gate + an invariance check task.
- **Leaderboard integrity**: forgery is bounded, not prevented — accepted ceiling for
  a client-side game, documented in the spec.
- **Deliberately NOT doing**: passenger quests (future change; payment interfaces
  honored), bubble varieties, daily-seed mode (parked to ROADMAP), the arch greeting
  (cut), any bundler or new game dependency.

## Open Questions

Mirrored from [questions-for-human.md](questions-for-human.md): Q1 day-ramp numbers
(draft table ships, tune from play?), Q2 economy gut-check (high-water + smile-priced
vendors), Q3 Lurleen tow rescue keep/cut (proceeding: keep), Q4 Worker deployment
steps (Gary-only).

## Where Things Live

- `proposal.md` — why this change exists and what it touches
- `design.md` — the technical how (decisions D1–D12, drafted ramp table)
- `tasks.md` — the implementation checklist (source of the Progress block)
- `specs/` — 11 capability deltas (what the system must do)
- `deliberations/001-initial/` — council review of the plan (briefing, personas, synthesis)
- `session-log.md` / `questions-for-human.md` — the "why" trail and the async question queue
- `workers/leaderboard/` (repo root, once built) — the global-board server code
