# Deliberation Briefing: festival-run-stakes (pre-apply plan review)

## Task

Deliberate on the just-authored plan for the `festival-run-stakes` OpenSpec change
BEFORE implementation begins. The change adds: name entry on the title card (with
toast weaving); a mode split (endless **Festival Run** with stakes vs **Just
Cruisin'** = today's game, invariant); a per-day difficulty ramp on the existing
6-minute cycle; two death paths (run fully dry → sputter grace → conk out; vibe-out
via a hit/frown strike meter with a marshal warning ladder); a smile economy (vendor
refills priced in smiles from Day 2, high-water-mark recorded score); a chain combo
multiplier with Lurleen-following as a stacking ×2 (hit an NPC → she's scared off);
smile-collection SFX as a pentatonic pitch ladder doubling as combo feedback; a local
top-10 leaderboard in localStorage; and a global leaderboard via an in-repo Cloudflare
Worker (token → ~60s heartbeats → final submit/sendBeacon; plausibility guardrails;
deployment is Gary-only and feature-flagged off until configured).

Assess: is this plan sound, correctly sequenced, and safe against the project's
tripwires? What would you change before code is written?

## Context

- **Project Charter**: openspec/council/charter.md (read your Persona Notes subsection and the Non-Negotiables)
- **OpenSpec Change**: openspec/changes/festival-run-stakes/ — READ `proposal.md`, `design.md` (decisions D1–D12 + drafted day-ramp table), `tasks.md` (9 groups, 3 phases), and the delta specs under `specs/` (11 capabilities)
- **Decision record so far**: Gary personally decided (2026-08-28, recorded in session-log.md Key Decisions): endless-until-death over timed runs; multi-mode incl. no-stakes; Cloudflare Worker path; chain combo + Lurleen ×2 + scare-off; quests (future) tipping juice; smile SFX. Gary explicitly TABLED action-variety combo weighting. Open items are in `questions-for-human.md` (Q1 ramp numbers, Q2 economy gut-check, Q3 Lurleen rescue, Q4 deploy) — Gary is away; do NOT block on him; add to those questions rather than stalling.
- **Files Affected**: index.html (title card, importmaps ×4), src/hud.js, src/main.js, src/bubbles.js, src/smiles.js, src/crowd.js, src/lurleen.js, src/zerble.js, src/sound.js, src/analytics.js; NEW: src/runMode.js, src/runState.js, src/scoring.js, src/leaderboard.js; NEW out-of-game: workers/leaderboard/
- **Specs Relevant**: openspec/specs/ — feedback-systems, crowd-ai, carts, hud, audio-synthesis, analytics, determinism, sandbox-harness, perf-tiers

## Constraints

Hard constraints from the charter's Non-Negotiables (read the charter for full text):

1. Determinism is load-bearing: no reordering/re-salting existing rng streams; fresh salts only; the plan's jug scarcity MUST stay a runtime filter over realized pickups.
2. Frozen ES module namespaces: overrides only via threeShim (not expected to be touched here — verify the plan keeps it that way).
3. iOS audio: no async hop between the title-card tap and `Sound.init()` — the new name input and mode selector sit on that card.
4. No build step; every new `src/` module lands in the importmap lists of all consuming HTML pages; `bin/check-importmaps` must pass. The Worker lives outside the game (`workers/`), not in any importmap.
5. Lifecycle disposal safety (lakes/chunkKey/userData.shared) — plan claims zero contact; verify.
6. Per-tier perf budgets hold; changes here are DOM/Web Audio/state only — verify no hidden geometry/draw additions.
7. Sandbox-pass ≠ game-pass: every phase must end with a clean full-game boot; harness surfaces (`__dbg` drills) are part of the work, not extras.
8. InstancedMesh needsUpdate (not expected here).
9. Player-facing copy holds the warm tone and never reveals Easter eggs; the title card copy is calibrated.
10. Just Cruisin' must remain byte-for-byte today's gameplay (`JUICE_STACK_MAX = Infinity` untouched; mode config is the single gate).

### Your Output

Write your full deliberation to: `[OUTPUT_PATH]`
Return a brief summary to the orchestrator containing: your Verdict, Key Concern, and 3 bullet points.

### Your Task

You are working in isolation. You cannot see the other positions, so any tension you name would be a guess — do NOT speculate about other personas, and do NOT write an Anticipated Tensions section.

1. Propose your prioritized order of operations for this task.
2. Identify risks/concerns from YOUR perspective.
3. Give a verdict (Proceed | Proceed with mitigations | Block) with your single Key Concern.
4. Write your full output to the file path specified above.
