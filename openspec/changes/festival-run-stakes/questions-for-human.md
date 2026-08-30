---
change: festival-run-stakes
open: 4
answered: 0
last_question: Q6
last_answer: Q6
---

# Questions for Human: festival-run-stakes

> **AGENT DIRECTIVE:** Check this file when resuming work. If `open > 0`, present
> each unanswered question to the user before starting new work.

## Open Questions

### Q5: First-visit mode default — quiet default or louder choice screen?
**Date:** 2026-08-28
**Context:** The council flagged that the plan never said what a first-time (or returning, no-saved-preference) player sees. Decision D13: **Just Cruisin' is the default-highlighted mode**, so a habitual Start tap can never land someone in a mode that kills their cart unwarned; Festival Run is one tap away.
**Question:** Happy with the quiet Cruisin' default, or do you want a louder one-time "pick your mode" moment for first-timers?
**Impact:** Task 3.2 ships the quiet default; a choice screen would be a small title-card addition later.

### Q4: Worker deployment (Gary-only steps)
**Date:** 2026-08-28
**Context:** The global leaderboard Worker ships in-repo (`workers/leaderboard/`) fully coded and locally testable, but deployment needs your Cloudflare account.
**Question:** When P3 lands: run `wrangler deploy`, set the two secrets (HMAC signing key, admin key), optionally create a Turnstile site, and drop the endpoint URL into the client config. Want the README in `workers/leaderboard/` to walk you through it, or should I also prep a one-shot script?
**Impact:** Global board stays feature-flagged off (local board carries everything) until this happens. Nothing else blocks.

### Q3: Lurleen tow rescue — keep or cut?
**Date:** 2026-08-28
**Context:** Once per run, if the sputter grace expires while Lurleen is *following*, she tows you to juice instead of the run ending. You liked the adjacent ideas (×2, scare-off) but never confirmed this one.
**Question:** Keep the rescue as designed, or cut it for v1?
**Impact:** Task 6.6. Proceeding with KEEP (it makes keeping Lurleen matter twice and softens new-player death spirals). Cheap to remove if you veto. Council notes: it's the designated first cut under time pressure (nothing depends on it), and if built, the no-resident-jug fallback is decided (D14: minimal refill in place, no tow animation).

### Q2: High-water scoring + vendor refills costing smiles — gut check
**Date:** 2026-08-28
**Context:** Leaderboard records your PEAK smiles; vendor refills (Day 2+) spend CURRENT smiles, so refueling digs a hole below your peak instead of erasing score. ROADMAP had already parked "costs smiles" as an alternate score sink.
**Question:** Does that resolution sit right, or do you want spending to hit the recorded score too (harsher), or refills to stay free with only jug scarcity as pressure (softer)?
**Impact:** Tasks 4.1/6.3. Proceeding with high-water + smile-priced vendors per the design.

### Q1: Day-ramp numbers — draft acceptable as a starting point?
**Date:** 2026-08-28
**Context:** design.md D6 has a drafted Day 1–5 table (vendor price 0→50+, jug keep 1.0→0.30, frown mult 1.0→1.6, vibe warn/eject 4/8→2/5, strike decay 15s). You said you might want to feel these out in-game.
**Question:** Fine to ship the draft table behind the mode config and tune from play, or do you want a `FESTIVAL_TUNING`-style live slider panel for these before first playtest?
**Impact:** Only tuning ergonomics — the table is one edit either way. Proceeding with the draft table + `__dbg` overrides.

## Answered Questions

### Q6: Frown vibe-strike during sputter — dead knobs or live strike?
**Date:** 2026-08-29
**Context:** Review 001 (gameplay/Opus) proved the frown vibe-strike, the `frownMult` ramp column, and `crowd.frownRateMult` were all mechanically unreachable: frowns only fire while the tank is dry, dryness always means sputter in Festival Run, and sputter suppressed every frown consequence per the council's "no pile-on."
**Question:** (a) land the half-weight vibe strike even during sputter (knobs become real; softens "no pile-on"), or (b) delete the three dead knobs and keep frowns pure flavor?
**Answer (Gary, 2026-08-29):** Option (a). Implemented: sputtering frowns land `VIBE.frownStrike` with no smile tax — the "no pile-on" protection stays on the wallet, the marshals watch the crowd. Gives the 45s grace window a route choice (limping through a crowd is risky, open ground is safe).
**Addendum (2026-08-30, adversarial audit A1):** the ungoverned version made ejection near-certain near hubs (frown throughput vs collision-tuned limits — 10 frowns at Day 5 was the expected case, not a risk). Refined while keeping (a)'s intent: sputter frown strikes are cooldown-spaced (4s) and their total is capped at 40% of the ejection limit, so the crowd pressures a dry cart but can never eject it alone (a cart that ALSO hit people still can go out by marshal), and the sputter whistle got honest copy ("the marshals eye your sputtering cart") instead of accusing a player who hit nobody. Both knobs live in `VIBE` (`runMode.js`) for playtest tuning; `bin/test-run-state` locks the cap/cooldown/reset invariants.
