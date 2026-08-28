# Deliberation Summary

## Context

-   **Task**: `festival-run-stakes` — Festival Run mode (day-ramp, two deaths, combo scoring, Lurleen ×2, smile SFX, local + Cloudflare-Worker leaderboards) layered alongside an invariant Just Cruisin' mode. Full plan under deliberation: `proposal.md`, `design.md` (D1–D12), `tasks.md` (groups 1–9, phases P1–P3).
-   **Personas Consulted**: Architect, Adversary, Anthropologist, Pragmatist, Auditor + Mediator (synthesis mode — no Round 2; tensions surfaced here)
-   **Date**: 2026-08-28

All five personas returned **Proceed with mitigations**. No persona found a charter tripwire violation *in the plan as designed* — but three found places where the plan as *worded* would let an implementing agent commit one (jug-filter injection point), silently corrupt player data (`zerble-best-smiles`), or ship a materially harsher game than specced (vibe wiring at the wrong hook). Every mitigation below is a task-wording or design-paragraph edit, not a redesign. The plan's architecture (mode-config choke point mirroring `PERF`, scoring single-writer, phased P1→P2→P3, Worker isolated last) was independently endorsed by all five.

## Synthesized Plan

The groups below refine the existing `tasks.md` groups 1–9; they do not replace the phasing (D11 stands). Group 1 must complete **before any P2 code lands** — it is almost entirely design/task edits plus harness work, per the charter's "build the harness, then the feature."

### Change Group 1: Design pin-downs + harness prerequisites (pre-code)

-   **Scope**: Close every ambiguity a code-writing agent could resolve wrong, and land the `__dbg` surfaces the tuning loop depends on. All are edits to `design.md`/`tasks.md`/specs plus small harness hooks — no gameplay code.
-   **Estimated Effort**: ~half a day
-   **Tasks**:
    1.  **Pin the jug-filter injection point** (Architect). Add a paragraph to design D3 and an acceptance line to task 6.2: the mode/day filter check runs **strictly after all `ctx.rng()` draws for that jug complete**, gating only the final `buildBubbleJug()` / `ctx.group.add` / `registry.add` triplet — never short-circuiting the candidate search. Rationale in the doc: `scatterWorldgenCampsites` (`chunks.js:2156-2158`) depends on `ctx.rng()` draw-count parity with the jug scatter. This is the one item that, done wrong, violates Non-Negotiable #1 with no test catching it.
    2.  **Scope the filter to `scatterBubbleJugs` only** (Architect + the `festival-run` spec's own Day-1 language). One line in design D3: `_placeSpawnJugs` (`chunks.js:559-593`, the guaranteed intro ring) is **exempt**; only the ambient ~1-in-9-chunk scatter (`chunks.js:2130`) thins with the ramp. Preserves "Day 1 plays tutorial-soft" and gives the ramp's jug-keep column real bite on mid-drive pickups.
    3.  **Document how live day-state reaches `ChunkManager._generate`** (Architect). Chunks today read only session-immutable `PERF`; a run-mutable day value is architecturally new. Decide and write it down (recommended: a documented module-level setter read at `_generate` time, à la the `nightness` poll pattern), with an explicit **unfiltered default** so `hub-sandbox.html` (`buildHubPreview`, `chunks.js:1415`) and `map-sandbox.html` stay stable. Also note in design.md the accepted emergent effect: re-generated chunks late in a run read thinner on backtrack ("the well's drying up" — flavor, but stated, not accidental).
    4.  **Rewrite task 6.5's wiring point** (Adversary). Vibe strike, combo break, Lurleen scare-off, and struck-NPC frown gate on **`hit.damaging` in `main.js`** (mirroring the existing `main.js:1201` `if (hit && hit.damaging && !isGod())` gate) — NOT on `crowd.onZerbleHit`, which fires on every person collision including `damage: 0` grazes of already-fleeing NPCs (`main.js:1356`). Include `!isGod()` in the same gate so QA/agent god-mode driving can't rack ejections mid-verification. Add task 6.5's acceptance line: sputter frown-suppression (D7) and the vibe frown-strike (D6) share **one** trigger condition, not two independent paths.
    5.  **Gate `HUD.saveBest()` / `Analytics.personalBest()` to Just Cruisin'** (Auditor — Critical). New explicit task in Group 3/4: the unconditional calls at `main.js:904`, `main.js:1580`, and `__dbg.addSmiles` must be mode-gated before the scoring module goes live, or the first Festival Run playtest permanently overwrites the player's Cruisin' personal best (`zerble-best-smiles`, `hud.js:195-201`) with an inflated ×2–×8 number — contradicting design.md's own Migration Plan.
    6.  **Decide the first-visit mode default** (Anthropologist). Recommended: **Just Cruisin' is the default-highlighted choice** for any player with no persisted preference — a returning sandbox player's habitual Start tap must not land them in a mode that can kill their cart unwarned. Record as a design decision (D-numbered); confirm with Gary via `questions-for-human.md` if he wants a louder first-run choice screen instead.
    7.  **Rework the D8 plausibility-ceiling formula before any Worker code** (Adversary). The ceiling seeded from pre-combo GA4 smile-rate data will quarantine exactly the players the leaderboard exists to reward: legit combo ×4 × Lurleen ×2 = ×8 rates read as "implausible," and D9's fire-and-forget networking makes the rejection invisible to both player and Gary. Replace with a worked formula that derives the ceiling from theoretical max multiplied rate (include Star Power's `applyStarLove` auto-farm window in the worked example). Blocks task 8.1 as currently worded.
    8.  **Task the `__dbg` run-state hooks explicitly** (Anthropologist): day-jump/ramp-override and vibe-meter nudge, alongside the already-tasked `showScoreScreen(mock)`. The 6-minute day cycle makes Day-5 tuning cost 15–30 real minutes per iteration without them — a direct harness-doctrine violation, and the Q1 answer already assumes these hooks exist.
    9.  **Add the day-counter resume acceptance line** (Adversary) to tasks 3.3/6.1: the ToD wrap-detection's `prevT` initializes from the **restored** `t` on resume, not a fresh-boot default, or a reload near a day boundary double-counts a day and jumps the ramp row.
    10. **Decide the Lurleen-rescue no-jug fallback** (Architect) before task 6.6 is built: at Day 5+ (`keepFraction = 0.30`) with a 2–3 chunk load radius, zero `bubble_jug` entries may be registry-resident when the rescue fires. Pick one (recommended: grant the minimal refill sans tow animation) and write it into `carts`/`festival-run` specs — tie to open Q3.
    11. **Fix importmap task wording** (Auditor): the four new modules go in the **three full pages** (`index.html`, `sandbox.html`, `hub-sandbox.html`) — `map-sandbox.html` is worldgen-only per `bin/check-importmaps`' own header and Non-Negotiable #4. Replace "×4"/"ALL FOUR" in tasks 2.1, 3.1, 4.1, 6.1 and proposal.md.
    12. **Mirror the KV read-modify-write race into the `leaderboard` delta spec** (Auditor) as an explicitly accepted trade-off (eventually consistent board arrays, authoritative `run:<id>` entries unaffected) — currently only in design.md's Risks.

### Change Group 2: Core implementation (existing groups 1–6, amended)

-   **Scope**: P1 (name + local board shell) then P2 (modes, scoring, SFX, stakes), in the plan's own order with the seams below tightened.
-   **Estimated Effort**: the bulk of the change; P1 ~1 session, P2 several
-   **Tasks**:
    1.  Groups 1–2 (P1) as written, **plus** a local-board blank-name fallback (Anthropologist): the local top-10 renders a fallback display name for nameless runs, matching the promise the Worker spec already makes — task 2.1/2.2 amendment.
    2.  Group 3 (mode plumbing) as written, plus the `saveBest` mode-gate (Group 1 item 5) and **invariance check run #1** (task 3.4 as written: same seed, both modes, `dumpRegistry` diff empty, no stakes HUD in Cruisin').
    3.  Group 4 (scoring reroute + combo) as written, then **re-run the A/B invariance check immediately after task 4.2** (Pragmatist): the score-write reroute is the single change most likely to leak stakes behavior into Cruisin', and it lands *after* the only currently-scheduled check. Proof must follow the riskiest refactor.
    4.  Task 4.4 amendment (Anthropologist): verify the combo badge (multiplier + chain ring + ♥×2 slot) **at driving speed**, not only via static `__dbg` screenshots — charter resolution rule 3 is explicit about driving speed and camera distance.
    5.  Group 5 (SFX) as written; can run parallel to Group 6 (Pragmatist — combo/SFX depend on the collect-event contract, not the day-ramp).
    6.  Group 6 **internally checkpointed** (Pragmatist): ship dry-death end-to-end first (6.1–6.4 + the `ran_dry` half of 6.7, verified via the 6.8 `setJuice(0)` → sputter → death drill) **before** touching vibe-out (6.5, as reworded in Group 1) or rescue (6.6). Two novel interacting death machines debugged at once is where the schedule dies.
    7.  **Persistent vibe-meter HUD widget** (Anthropologist) added to the `hud` spec and task 6.5: an always-visible ambient meter alongside the sputter countdown — threshold-crossing toasts alone (transient, `hud.js:221` ~1600ms) make ejection feel arbitrary, not tense. The juice meter is always on screen; the other death path must be too.
    8.  Task 6.6 (Lurleen tow rescue) stays in-plan but is the **designated first cut** under time pressure (Pragmatist) — it blocks nothing (not dry-death, not vibe-out, not run-end, not the board). If built, the Group 1 fallback decision is its precondition.
    9.  A code comment at the frown dispatch point (Anthropologist) explaining the mode-dependent dual role (dry-tank tax vs. vibe feedback) — clears CLAUDE.md's "why is non-obvious" bar.

### Change Group 3: Quality gates

-   **Scope**: Automated regression for the new pure logic + the full verification ladder. The `bin/test-*` scripts are written **alongside** their modules in Group 2 (Auditor: "alongside the tasks that create them, not after"); they're listed here because this group is where they gate.
-   **Estimated Effort**: ~1 session, mostly amortized into Group 2
-   **Tasks**:
    1.  `bin/test-scoring` (chain thresholds, high-water ratchet, ×2 doubler stacking), `bin/test-run-state` (sputter/vibe machine, strike decay, day-counter resume init), `bin/test-run-mode` (day-ramp lookups) — plain-node scripts per the `bin/test-game-juice` / `bin/test-registry-grid` precedent. `__dbg` drills + screenshots stay for HUD/visual, but arithmetic gets an arithmetic gate.
    2.  `bin/test-jug-filter` — a scripted determinism check for the D3 filter (same-seed registry parity across modes and days), per the `bin/test-forest-determinism` pattern; the manual `dumpRegistry` diff alone is not regression coverage for a Non-Negotiable.
    3.  Group 9's final smoke names the invariance re-diff as an **explicit step** (Pragmatist): re-run the `dumpRegistry` A/B diff and re-screenshot the no-stakes-HUD state — not just "boot both modes."
    4.  Existing 6.8/9.1 gates stand: full-loop `__dbg` drills (now validating the *corrected* damaging-gated hook), backtick budget panel unchanged, `?perf=low` + `?perf=mid` boots, `bin/check-importmaps`, score screen at two ToD presets.
    5.  Worker unit checks (task 8.2) extended to assert the **recalibrated** ceiling formula passes the ×8 worked example (legit max-rate run accepted, implausible-beyond-formula run rejected).

### Change Group 4: Polish, Worker, docs

-   **Scope**: P2 docs + ship, then P3 Worker + global client, then wrap — per existing groups 7–9 with the descope ladder made explicit.
-   **Estimated Effort**: docs ~half a session; Worker ~1–2 sessions, schedule-free (deploy gated on Gary)
-   **Tasks**:
    1.  Group 7 as written (CHANGELOG per phase same-commit, ROADMAP consume "Name entry" + "costs smiles", park daily-seed follow-up; README/title-card tone check — no Easter-egg leakage), plus DEBUGGING.md documents the new `__dbg` hooks **including the day-jump/vibe nudges** from Group 1.
    2.  Group 8 as written, with the recalibrated D8 ceiling (Group 1 item 7) as its precondition and Pragmatist's descope ladder recorded: HMAC token + monotonic high-water validation are the integrity-critical core and never descope; Turnstile stays conditional; quarantine + admin-delete tooling are the first trims for a v1 deploy — and quarantine ships **only** with the recalibrated ceiling, never against the stale GA4 baseline.
    3.  Group 9 as written plus the named invariance re-diff (Group 3 item 3); `bin/readme-sync` + session-log final pass.

## Final Recommendation

Proceed. The plan's architecture was unanimously endorsed; every persona's concern resolves to a design-paragraph or task-wording edit plus harness/test additions, all cheap now and expensive later. Complete Change Group 1 (about half a day of edits — the jug-filter pin, the `hit.damaging` rewiring of 6.5, the `saveBest` mode-gate, and the D8 ceiling formula are the four that prevent silent production damage) before any P2 code lands, then execute the amended groups in order with the dry-death checkpoint and the twice-run invariance check as the internal proof points.

---

## Convergence Points

-   **All five: Proceed with mitigations.** No one found a tripwire violation in the plan as designed; the architecture (runMode/scoring choke points mirroring `PERF`, phased P1→P2→P3, Worker isolated last and deploy-gated on Gary) was independently endorsed by every persona.
-   **The D3 jug-filter shape is right** (fresh-salted `worldHash` runtime filter over realized entries, seeded streams untouched) — Architect, Auditor, and Pragmatist each verified it against Non-Negotiable #1 independently; the concerns are about pinning its injection point and testing it, not the design.
-   **Silent determinism/data regressions are the top failure class** — Architect (rng draw-count desync), Auditor (`zerble-best-smiles` overwrite), Adversary (invisible quarantine) all found failure modes that no current verification would surface; hence the Group 1 pin-downs and Group 3 scripted checks.
-   **The invariance check is the load-bearing proof** that Cruisin' stays byte-for-byte — Architect wants it early, Pragmatist wants it after the riskiest refactor; both agree it's the mechanism that matters (resolved: run it at both points).
-   **The `__dbg` harness is the right verification surface and needs extending, not bypassing** — Anthropologist (day-jump hook), Pragmatist (no bespoke sandbox surface needed for DOM/state work), and the existing 6.8 drills all converge on the harness doctrine.
-   **Scope discipline is already good** — Pragmatist and Auditor independently validated the exclusion list (quests, daily-seed, tuning UI, Durable Objects) and the score-write Scope Check (`rg 'score'` sweep confirmed accurate: exactly the 4 named write sites).

## Tensions Resolved

| Conflict | Position A | Position B | Resolution | Rationale |
| -------- | ---------- | ---------- | ---------- | --------- |
| When the Cruisin'-invariance check runs | Architect: immediately after `runMode.js` exists (cheap now, expensive later) | Pragmatist: re-run *after* task 4.2's score-write reroute, the change most likely to break it | Run it **twice** (after Group 3 and after 4.2) and name the re-diff in Group 9's final smoke | Complementary, not contradictory: a proof mechanism for a hard constraint runs early for fast feedback AND after the highest-risk refactor. Verifiability-over-speed (charter rule 2). |
| Jug-filter scope: which `bubble_jug` call site | Plan's generic "jug entries" implies both, thinning the guaranteed intro ring on Day 2+/resume | `festival-run` spec: "Day 1 SHALL play tutorial-soft" | Filter the ambient scatter (`scatterBubbleJugs`) only; `_placeSpawnJugs` intro jugs exempt | Spec compliance over ambiguity (generic rule 2); Architect showed either uniform reading breaks something — the spec's own tutorial-soft clause decides it. |
| Vibe/combo/scare wiring layer | tasks.md 6.5 as written: hook `crowd.onZerbleHit` | Adversary: gate on `hit.damaging` + `!isGod()` in `main.js` (`main.js:1201`, `1356`) | Rewire per Adversary before any Group 6 code | The specs' own language ("damaging NPC hits") authorizes only the gated version; the raw hook punishes today's consequence-free crowd grazing. Spec compliance + safety, and no sandbox path would ever catch it. |
| Lurleen tow rescue (task 6.6, Q3 open) | Architect: decide the no-resident-jug fallback *before* building it | Pragmatist: designated first cut under time pressure, don't wait for a veto | Keep it in-plan as the last Group 6 item, explicitly deferrable to a fast-follow; the fallback decision is its precondition if built | Both satisfied: nothing depends on 6.6, so deferral is free; if it ships, an undecided code path an agent will hit in the 6.8 drill is not acceptable. |
| Worker guardrail depth vs. leaderboard fairness | Pragmatist: trim Turnstile/quarantine/admin-delete first for a v1 deploy; HMAC + monotonic are the critical 20% | Adversary: the D8 ceiling calibrated on pre-combo GA4 data invisibly quarantines legit ×8 players | Recalibrate the ceiling formula (design-time, cheap) before task 8.1 regardless; the descope ladder stands, with the rule that quarantine ships only against the recalibrated formula | Adversary's finding isn't about guardrail *depth* but guardrail *correctness* — a wrong ceiling is worse than no quarantine. Safety trumps; Pragmatist's trim order is untouched. |
| Vibe-death feedback | Plan/`hud` spec: threshold-crossing toasts + whistle only | Anthropologist: persistent ambient meter, parity with the always-visible juice meter | Persistent vibe widget added to the `hud` spec + task 6.5 | Charter rule 3 (perceivable player impact): an invisible-until-it-fires death path reads as unfair, undermining the change's stated purpose. No persona opposed; cost is one dirty-flagged DOM element. |
| First-visit mode default | Plan: unspecified ("persisted preselect" only) | Anthropologist: an unwarned returning player must not die in a game that has never had death | Just Cruisin' defaults for no-preference players; recorded as a design decision, flagged to Gary for the louder-choice-screen alternative | Tone continuity is a charter identity concern ("warm festival evening"); defaulting toward the mode that preserves every existing expectation is the safe choice, and Festival Run remains one tap away. |

## Risk Register

| Risk | Severity | Mitigation | Owner |
| ---- | -------- | ---------- | ----- |
| Jug filter short-circuits `ctx.rng()` draws → campsite/downstream chunk-content desync between modes (Non-Negotiable #1, no test catches it) | Critical | Group 1 item 1: injection point pinned as an acceptance line (filter gates only the final build/add triplet); Group 3 `bin/test-jug-filter` | Architect |
| `zerble-best-smiles` silently overwritten by multiplied Festival Run scores in production `localStorage` | Critical | Group 1 item 5: mode-gate `HUD.saveBest()`/`personalBest` (`main.js:904`, `:1580`, `__dbg.addSmiles`) before Group 4 ships | Auditor |
| Vibe/combo/scare-off wired at `crowd.onZerbleHit` → ordinary crowd-driving (fleeing-NPC grazes, `damage: 0`) racks strikes, breaks combos, scares Lurleen | High | Group 1 item 4: task 6.5 reworded to gate on `hit.damaging` + `!isGod()` in `main.js`; 6.8 drill validates the corrected gate | Adversary |
| Plausibility ceiling calibrated on pre-combo GA4 data quarantines legit ×8 (combo ×4 × Lurleen ×2) top players, invisibly (fire-and-forget D9) | High | Group 1 item 7: reworked ceiling formula with the ×8 + Star Power worked example, before task 8.1; Group 3 item 5 asserts it in Worker unit tests | Adversary |
| No automated regression for the new pure-logic modules (only 1 test task in ~50, Worker-scoped) | Medium-High | Group 3 items 1–2: `bin/test-scoring` / `bin/test-run-state` / `bin/test-run-mode` / `bin/test-jug-filter` per in-repo precedent, written alongside the modules | Auditor |
| Vibe meter invisible between thresholds → ejection feels arbitrary, not tense | Medium-High | Group 2 item 7: persistent ambient vibe widget alongside the sputter countdown | Anthropologist |
| First-visit/habitual Start tap lands a sandbox player in stakes mode unwarned | Medium | Group 1 item 6: Cruisin' default for no-preference players; Gary confirms via questions-for-human | Anthropologist |
| Star Power `applyStarLove` auto-farm × combo × doubler becomes the dominant no-skill leaderboard strategy, and feeds the false-quarantine problem | Medium | Fold into the D8 ceiling worked example (Group 1 item 7); flag the balance question to Gary during Group 6 tuning (a Q, not a blocker) | Adversary |
| God-mode QA driving accumulates vibe strikes → confusing mid-verification ejections | Medium | `!isGod()` inside the same Group 1 item 4 gate | Adversary |
| Lurleen rescue fires with zero registry-resident jugs (Day 5+, 2–3 chunk load radius) → undefined path, possibly a wasted once-per-run rescue | Medium | Group 1 item 10: decide the fallback (recommended: minimal refill sans tow) before 6.6; 6.6 is also the designated first cut | Architect |
| Day counter double-counts a day on resume near a ToD wrap boundary (`prevT` from fresh-boot default) | Low-Medium | Group 1 item 9: `prevT` initializes from restored `t`; covered in `bin/test-run-state` | Adversary |
| Live day-state into `ChunkManager` lands as an undocumented accident (first run-mutable input to chunks; sandbox defaults unstated) | Low-Medium | Group 1 item 3: documented setter + unfiltered sandbox default + stated backtrack-thinning side effect | Architect |
| Blank-name runs render as broken-looking empty rows on the local board | Low | Group 2 item 1: client-side fallback display name matching the Worker's | Anthropologist |
| KV board read-modify-write race (accepted trade-off, but recorded only in design.md Risks) | Low | Group 1 item 12: mirror into the `leaderboard` delta spec | Auditor |
| "Importmap ×4" wording over-scopes to worldgen-only `map-sandbox.html` (wasted effort, wrong mental model; not a functional break) | Low | Group 1 item 11: reword to the three full pages | Auditor |

## Verdicts Summary

| Persona | Key Concern | Verdict |
| ------- | ----------- | ------- |
| Architect | Jug-filter injection point vs. `ctx.rng()` draw-count parity, and no documented path for live day-state into `ChunkManager` — both silent determinism regressions if left to implementation accident | Proceed with mitigations |
| Adversary | Task 6.5 wires stakes at `crowd.onZerbleHit` instead of the `hit.damaging` gate (`main.js:1201`), and the D8 plausibility ceiling is calibrated on pre-multiplier data — both silent by design | Proceed with mitigations |
| Anthropologist | The vibe meter (one of two death paths) has no persistent ambient HUD state — ejection will feel arbitrary rather than tense | Proceed with mitigations |
| Pragmatist | The Cruisin'-invariance check runs once, *before* the score-write reroute most likely to break it — the proof must re-run after the riskiest refactor | Proceed with mitigations |
| Auditor | `HUD.saveBest()`/`zerble-best-smiles` is not mode-gated anywhere in the task list — the first Festival Run playtest permanently overwrites the Cruisin' personal best, contradicting design.md's own Migration Plan | Proceed with mitigations |
