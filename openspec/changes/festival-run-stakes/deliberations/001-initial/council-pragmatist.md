# Council-Pragmatist's Order of Operations

Reviewed: `openspec/council/charter.md` (Non-Negotiables + Persona Notes →
`### council-pragmatist`), `proposal.md`, `design.md` (D1–D12), `tasks.md` (9
groups / 3 phases), `questions-for-human.md` (Q1–Q4, all open, not blocking),
`specs/feedback-systems/spec.md`, and `ROADMAP.md` (the "costs smiles" +
"Name entry on the title card" parked items this change consumes).

### Critical Path

The plan's own phasing (D11: P1 → P2 → P3, `tasks.md` groups 1–9) already
gets the sequencing right at the phase level. My read of what's *actually*
load-bearing inside that sequence:

1. **`runMode.js` (Task 3.1, D2) is the true force multiplier.** Every
   downstream system — economy (6), vibe/death (6), combo (4), HUD (2, 4) —
   reads mode config rather than branching on `mode === 'festival'`
   ad hoc. This mirrors the existing `PERF` tier pattern (already proven at
   scale in this codebase), so it's not a new idea, it's reuse of a pattern
   Gary already trusts. Get this right first; it's cheap to get right
   because it's one object, and expensive to get wrong because everything
   else reads it.
2. **`scoring.js` as the single score-write choke point (Task 4.1–4.2) is
   the second force multiplier.** The plan already does the pragmatic thing
   here: an `rg 'score'` sweep as a *mechanical* completeness check instead
   of a manual code-review pass. That's the right instinct — a grep sweep is
   cheap, reliable, and doesn't rely on anyone remembering every call site.
3. **Task 3.4's A/B invariance check (same seed, both modes, `dumpRegistry`
   diff) reuses existing harness tooling** (`dumpRegistry` shipped with
   `worldgen-layout-harness`) rather than inventing new verification
   infrastructure. Good — no new harness needed here, the existing one
   already answers "did Cruisin' drift?"
4. **Groups 1–2 (name entry, local board shell) are correctly first and
   correctly cheap** — no mode-gating risk, ships standalone, and is the
   right size for a first shippable slice.
5. **Group 8 (Worker) is correctly isolated last and off the critical path**
   — nothing in P1/P2 depends on it, and it's already gated behind Gary's
   own deploy step (Q4), so its schedule slipping costs nothing else.

The one sequencing gap I'd flag under Critical Path (elaborated below): the
Cruisin'-invariance check (3.4) fires **before** the scoring-pipeline reroute
(4.2) lands, but 4.2 is the change most likely to leak stakes behavior into
Cruisin' (it rewrites the shared score-write call sites `main.js` currently
uses for both modes). The check that proves the Non-Negotiable holds should
re-run after the code most likely to break it, not before.

### Priority Sequence

1. **Land `runMode.js` + wire mode selection (Group 3) before anything else
   game-facing.** It's the gate every other system reads from.
2. **Land `scoring.js` and reroute all score writes through it (Group 4.1–4.2)
   immediately after, then re-run the A/B invariance check** (see Key
   Concern) before building combo/HUD on top of a score pipeline that hasn't
   been re-proven invariant.
3. **Inside Group 6, ship the dry-death path end-to-end as an internal
   checkpoint before adding vibe-out.** `runState.js` bundles two
   genuinely different state machines (sputter/dry-death: linear, one meter,
   one grace timer; vibe-out: strike weights + decay + warn/eject thresholds
   + crowd.js coupling + Lurleen scare-off + combo break) plus a rescue
   exception on top. Debugging two novel interacting death paths at once is
   where a "simple task list" turns into a multi-day slog. Get 6.1–6.4 +
   the `ran_dry` half of 6.7 fully verified via `__dbg` (`setJuice(0)` →
   sputter → death, per 6.8) before touching 6.5 (vibe meter) or 6.6
   (rescue).
4. **Combo (Group 4.3–4.7) and SFX (Group 5) can run in parallel with Group
   6's stakes wiring** — they depend on the collect-event contract
   (feedback-systems spec) and the scoring module, not on the day-ramp
   economy. No reason to serialize them behind Group 6 if Gary wants to
   playtest combo feel sooner.
5. **Group 8 (Worker) starts only after P2 ships and only if Gary wants it
   before the next check-in** — it's real backend work (HMAC signing,
   monotonic validation, KV read-modify-write boards, rate limiting,
   quarantine, admin delete) gated behind his own Cloudflare account anyway,
   so there's no cost to letting it slip a milestone.

### Deferred / Cut

- **Lurleen tow rescue (Task 6.6, Q3 unresolved).** It's a genuine "nice to
  have" — it doesn't block the dry-death or vibe-out paths, doesn't block
  run-end, and doesn't block the leaderboard. If Group 6 runs long, this is
  the first thing to push to a fast-follow. The design doc already frames it
  as "cheap to remove if you veto" (D-list, Risks section) — I'd go further:
  don't wait for a veto, treat it as the first thing cut under time pressure
  by default, not something requiring Gary's explicit no.
- **Worker guardrail depth (Turnstile, quarantine, admin-delete tooling) is
  the right layer to descope first if P3 needs to ship faster** — not the
  HMAC signature validation or monotonic high-water check, which are the
  integrity-critical 20%. D8 already makes Turnstile conditional
  ("Turnstile-verified when configured"), which is the correct default;
  I'm flagging that quarantine + admin delete are the next things to trim
  for a v1 deploy, not core signature validation.
- **A `FESTIVAL_TUNING`-style live slider panel for the day-ramp table was
  already correctly rejected** (Q1 resolution: ship the draft table +
  `__dbg` overrides). This is the right call — building a tuning UI for
  numbers that are explicitly "feel it out in-game, expect them to move" is
  effort spent before the shape of the need is known. Nothing to add here;
  flagging it as validation that the plan is already avoiding this
  over-engineering trap, not as a new cut.
- **Daily-seed challenge mode, passenger quests, Festival Passport, bubble
  varieties** — already correctly excluded (proposal's "Scope Check" /
  design's "Non-Goals"). No changes recommended.

### Incremental Delivery Plan

The plan's own D11 phasing is sound; I'd tighten one seam inside it.

- **Slice 1 (P1 — Groups 1–2, ship first):** Name entry + toast weaving +
  local leaderboard shell. Zero contact with Cruisin's gameplay path
  (name/board are additive UI + `localStorage`), zero stakes logic yet. Ships
  standalone, no dependency on anything below. This is the safest possible
  first slice and the plan already treats it that way.
- **Slice 2a (inside P2 — Groups 3–4, mode + scoring plumbing):** Mode
  config + scoring reroute, gated by the A/B invariance check run **twice**
  — once after Group 3 (mode plumbing), once after Group 4 (score-write
  reroute). This is the seam I'd add that isn't explicit in `tasks.md`
  today. Nothing here is player-facing yet (combo UI/SFX come next), so it's
  an internal checkpoint, not a ship point — but it's the point where the
  Non-Negotiable ("Cruisin' remains byte-for-byte") gets its real proof.
- **Slice 2b (Groups 4.3–4.7, 5, 6, 7 — the actual Festival Run payoff):**
  Combo, SFX, day-ramp economy, both death paths, run-end, local board going
  live. This is the slice players actually feel the change; ship as one
  phase per D11, but internally checkpoint the dry-death path (see Priority
  Sequence #3) before layering vibe-out.
- **Slice 3 (P3 — Group 8, ship whenever):** Worker + global client,
  feature-flagged off until Gary deploys (already correct in the design).
  Genuinely optional relative to the rest — nothing in Slice 1/2a/2b needs
  it, and the global board's absence degrades gracefully to "local board
  only," which the design already specs.

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: The Cruisin'-invariance check (Task 3.4, `dumpRegistry`
  diff) is currently wired to run once, right after mode plumbing (Group 3)
  — but the code most likely to leak stakes behavior into Cruisin' is the
  shared score-write reroute (Task 4.2, D4), which lands *after* that check.
  "Just Cruisin' must remain byte-for-byte today's gameplay" is a hard
  constraint (charter Non-Negotiable #10 in this briefing), and its proof
  mechanism needs to run after the highest-risk refactor, not before it. Add
  an explicit re-run of the A/B invariance check after Group 4, and fold it
  into Group 9's final smoke test as a named step (not just "boot main game
  both modes" — specifically re-diff `dumpRegistry` and re-screenshot the
  no-stakes-HUD state) so it isn't an easy checkbox to skim past under
  schedule pressure.
- **Recommendation**: The plan is well-sliced already — three independently
  shippable phases, each phase itself decomposed into a sane task order, and
  it correctly avoids over-building (no tuning UI, no Worker-before-core-loop,
  no bespoke sandbox surface where `__dbg` + the existing HUD suffice since
  this change is DOM/state work, not new 3D models). Proceed once the
  invariance-check re-run is added to Group 4/9 and Group 6 is internally
  checkpointed at the dry-death path before layering vibe-out + rescue.
