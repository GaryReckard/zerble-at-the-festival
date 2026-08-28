## Adversary's Order of Operations

Council charter loaded (`openspec/council/charter.md`): Non-Negotiables 1–9 and the
`council-adversary` Persona Notes subsection. Change artifacts read: `proposal.md`,
`design.md` (D1–D12 + D6 ramp table), `tasks.md` (groups 1–9), delta specs under
`specs/{festival-run,game-modes,leaderboard,player-identity,scoring}/spec.md`, and
`questions-for-human.md`. Grounding also pulled from the live code the plan will touch:
`src/main.js`, `src/crowd.js`, `src/lurleen.js`, `src/bubbles.js`, `src/timeOfDay.js`.

Working in isolation per the council protocol — no guesses about other personas' findings,
no Anticipated Tensions section.

### Priority Sequence

1. **Pin the "damaging" gate for the vibe meter / combo-break / Lurleen scare-off
   explicitly to `hit.damaging` in `main.js`, not to `crowd.onZerbleHit()`.** This is a
   one-line task-wording fix (Task 6.5) but it's foundational — every subsequent stakes
   wire (vibe strike weights, combo break, Lurleen doubler loss) inherits whichever hook
   point group 6 lands on, and the wrong one ships a meaningfully harsher game than
   designed. Fix the task wording before any of group 6 is coded.
2. **Recalibrate the Worker's plausibility ceiling (D8) against the new combo/doubler
   math (D5 + scoring spec) before writing the Worker guardrail code (group 8).** The
   ceiling is foundational to every `/run/beat` and `/run/end` validation; if it's wrong,
   every downstream endpoint inherits a wrong assumption and the fix becomes a
   production hotfix on a deployed Worker instead of a design-time decision.
3. **Thread `!isGod()` (and the `__dbg` scripted-hit drills) through the same gate as
   #1**, so debug/QA driving through a crowd doesn't silently rack vibe strikes outside
   of a deliberate ejection test.
4. **Confirm the sputter frown-suppression (D7) and the vibe-meter frown-strike (D6,
   0.5 weight) share one trigger condition**, not two independently-firing paths.
5. Only after 1–4 are settled should the group 6.8 full-loop `__dbg` playtest drill
   (`setJuice(0)` → sputter → death; scripted hits → ejection) be built — otherwise it
   validates the wrong gate and gives false confidence.

### Vulnerabilities Found

- **Vibe strike / combo break / Lurleen scare-off wired at the wrong layer, contradicting
  the plan's own "damaging" gate.** Task 6.5 reads: *"crowd.onZerbleHit → runState strike
  + combo break + Lurleen scare + struck-NPC frown."* But `crowd.onZerbleHit(victim,
  pushX, pushZ)` (`src/crowd.js:2217`) is called unconditionally from
  `resolveCollision()` (`src/main.js:1394-1397`) for **every** person-kind collision
  above `APPROACH_DAMAGE_THRESHOLD` — including `damage: 0` hits on already-fleeing NPCs
  (`_npcColWrap`, `src/main.js:1356`: `w.damage = (n.state === 'fleeing') ? 0 : 1;`). The
  `damaging` boolean that actually distinguishes "costs a smile" from "harmless bump" is
  computed one call frame later, in the caller (`src/main.js:1401`, gated again at
  `src/main.js:1201: if (hit && hit.damaging && !isGod())`) — `onZerbleHit` itself has no
  access to it. Driving through a scattering crowd and clipping already-fleeing NPCs is
  today's normal, consequence-free play (todaythe game's own panic-cascade mechanic
  *creates* fleeing NPCs for you to graze). If the strike/combo-break/scare-off logic is
  literally wired at the hook the task names, that ordinary play becomes: a full-weight
  vibe strike toward ejection, an instant combo reset to x1, and Lurleen scared off
  (losing ♥×2) — none of which the `festival-run` spec's own language authorizes
  ("Damaging NPC hits ... feed the vibe meter", `specs/festival-run/spec.md:70`) or the
  `scoring` spec's combo-break clause implies (`specs/scoring/spec.md:33`: "Any frown or
  damaging NPC hit" — non-damaging hits are conspicuously excluded from that list). This
  is exactly the class of bug the charter's Persona Notes calls out for this project: a
  hook name in the task doesn't match the semantic gate the spec promises, and no
  existing test (sandbox-pass or otherwise) would catch it, because the sandbox doesn't
  exercise `crowd.js`'s integration with `main.js`'s collision resolver at all (that's
  chunk/game-only per `.claude/rules/sandbox-and-testing.md`). -- Severity: High
  (ships a materially harsher/more frustrating stakes system than designed, silently,
  and only surfaces from real play once Festival Run ships).
- **`isGod()` doesn't shield the vibe/combo/scare-off path if it's wired inside
  `onZerbleHit`.** Today, god mode (`__dbg.debug.god`) still lets the physical
  knockback/panic-cascade fire (`src/main.js:1394-1397` runs before the `isGod()` check
  at `src/main.js:1201`); only the smile deduction and toast are skipped. If the new
  stakes hooks land at the same unconditional call, a QA/agent session driving around in
  god mode (the documented debugging pattern in `.claude/rules/sandbox-and-testing.md`
  and DEBUGGING.md) would silently accumulate vibe strikes and eventually get ejected
  mid-verification of an unrelated system, producing a confusing false failure during
  the mandatory "boot the main game" smoke test this project requires before declaring
  any task done. -- Severity: Medium.
- **The Worker's plausibility ceiling (D8) is seeded from data that predates the very
  multiplier system this change introduces.** `design.md` D8: *"Plausibility ceiling
  seeded from GA4 smile-rate data"* — that GA4 data reflects the shipping game's raw,
  uncombo'd smile-collection rate (`src/main.js:901-906`, a flat `score += n`, no
  multiplier exists today). This same change adds a combo multiplier that caps at x4
  (`design.md` D5; `specs/scoring/spec.md:19`) stacking multiplicatively with a Lurleen
  ×2 doubler (`specs/scoring/spec.md:36-46`, explicit worked example: "combo x3 with
  Lurleen = x6"), so a skilled top-of-leaderboard run can legitimately score at up to
  8x the rate the ceiling was calibrated against. Unless the ceiling formula is
  explicitly reworked to account for combo/doubler state (not just re-measured from
  stale data), the Worker's own guardrail (`specs/leaderboard/spec.md:47-50`:
  "implausible submission is rejected... quarantined") will flag exactly the players the
  leaderboard exists to reward — the best, fastest chainers — as cheaters. That's a
  silent, self-inflicted failure of the feature's entire premise ("the tension that makes
  'one more run' a thing"), and it will only be discovered post-deploy when a real
  top player's score vanishes into quarantine with no player-facing error (D9: client
  networking is fire-and-forget and errors are swallowed) — so even Gary won't get a
  signal that it happened without checking the admin/quarantine queue. -- Severity: High
  (silent, undermines the shipped feature's core value proposition, and the failure mode
  is specifically invisible by design per D9/leaderboard spec's "Worker being down is
  invisible" pattern, which was designed for outages, not false-positive rejection of
  valid high scores).
- **Day-counter derivation vs. resume-snapshot ramp values — a narrower footgun worth a
  named check, not a blocker.** `timeOfDay.js` tracks only a normalized `t` that wraps
  modulo 1 (`src/timeOfDay.js:119`); there is no existing day counter. Task 6.1 derives
  one "from ToD cycle crossings" and `game-modes` spec (`specs/game-modes/spec.md:44-47`)
  correctly requires the day number to ride the resume snapshot. The risk isn't the
  requirement (it's written correctly) — it's the implementation detail nobody has named
  yet: whatever wrap-detection compares `prevT` vs `currT` each frame must initialize
  `prevT` from the *restored* `t` on a resume, not from a fresh-boot default (e.g. `0`),
  or a settings-reload immediately after a natural in-game day-boundary could double
  count (or, less likely, undercount) a day and desync the ramp row (D6 table) from
  what the player experienced pre-reload. Not currently addressed by any task in group
  3 or 6 — worth an explicit line in task 3.3 or 6.1's "done =" criteria. -- Severity:
  Low/Medium (narrow window, but silent and player-visible as a ramp-difficulty jump the
  moment it fires).
- **Existing power-ups aren't stakes-aware and become score-farming vectors under the new
  economy.** `crowd.applyStarLove()` (`src/crowd.js:2253-2276`) already auto-farms
  continuous smiles from every nearby NPC for the buff's duration, with no combo/skill
  gate. Once combo (`x4` cap) + Lurleen (`x2`) stack on top of an *automatic*,
  no-skill-required smile faucet, Star Power becomes the dominant leaderboard strategy
  (camp for the buff, stand in a crowd, watch score climb) rather than active chaining —
  which is a balance/intent question, not a tripwire violation, but it directly feeds
  the plausibility-ceiling problem above (organic Star Power farming will also read as
  "implausible" against a pre-combo GA4 baseline) and nobody on the design/session-log
  record appears to have evaluated Star Power against the new scoring pipeline
  specifically (design.md's Context section lists the pre-existing facts it accounted
  for and Star Power/`applyStarLove` isn't among them). -- Severity: Medium.

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: Task 6.5 names `crowd.onZerbleHit` as the wiring point for vibe
  strikes, combo breaks, and Lurleen scare-off, but that function fires on every
  person-kind collision above the approach-speed threshold regardless of `damage`
  (`src/main.js:1356`, `1394-1397`) — including today's consequence-free bumps into
  already-fleeing NPCs. The spec's own language ("damaging NPC hits" feed the vibe
  meter; combo breaks on "damaging" hits) requires gating on the `hit.damaging` boolean
  computed one layer up in `main.js` (`src/main.js:1201`, `1401`), not on the raw
  collision callback. Left as written, the task will most likely ship a Festival Run
  that punishes ordinary crowd-driving far more than the design intends, silently,
  because nothing in the sandbox harness exercises this integration path.
- **The "Killer" Finding**: The plausibility-ceiling calibration (D8) and the
  damaging-hit wiring ambiguity (Task 6.5) are the two places where the plan's stated
  intent and the actual code/data it will run against diverge — one makes the stakes
  system unfairly harsh (wrong hook), the other makes the leaderboard unfairly reject
  its best players (stale calibration data). Both are silent by design (D9's
  fire-and-forget networking, and the sandbox's inability to exercise
  `main.js`↔`crowd.js` collision integration), so neither will surface in normal
  verification — they need to be caught here, before code.
- **Risk Level**: High
- **Recommendation**: Fix Task 6.5's wording to route off `hit.damaging` (mirroring the
  existing `src/main.js:1201` gate) before group 6 is coded; add an explicit D8
  recalibration step (or a documented worked-example ceiling formula accounting for
  combo x4 × Lurleen x2 = x8) to group 8 before the Worker guardrail code is written.
  Both are cheap now (a task-wording edit and a formula, not a redesign) and expensive
  later (a live-deploy bug affecting real leaderboard fairness). Neither is a tripwire
  violation per the charter's Non-Negotiables, so this doesn't block the plan outright —
  it blocks shipping groups 6 and 8 as currently worded.
