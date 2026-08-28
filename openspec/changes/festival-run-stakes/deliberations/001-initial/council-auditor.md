## Auditor's Order of Operations

### Priority Sequence

1. **Gate `HUD.saveBest()` / `Analytics.personalBest()` to Just Cruisin' before any
   Festival Run score-write lands.** Every existing score-increase call site
   (`src/main.js:904`, `src/main.js:1580`, `__dbg.addSmiles`) unconditionally calls
   `HUD.saveBest(score)`, which persists to `zerble-best-smiles`
   (`src/hud.js:195-201`). `design.md`'s own Migration Plan promises this key
   "remains the Cruisin' personal best and is untouched" — but no task in
   `tasks.md` names this call site or requires mode-gating it. Fix this in Group 3
   or 4, before the scoring module goes live, not as a post-hoc bugfix.
2. **Add automated regression coverage for the new pure-logic modules** (`scoring.js`
   chain/high-water math, `runState.js` sputter/vibe state machine, `runMode.js`
   day-ramp lookups, the D3 jug-filter hash) alongside the tasks that create them
   (Groups 4 and 6), following the project's own `bin/test-game-juice` /
   `bin/test-forest-determinism` / `bin/test-registry-grid` precedent — not relying
   solely on `__dbg` drills + screenshots, which are the right tool for HUD/visual
   verification but not for arithmetic regression.
3. **Extend the D3 jug-filter verification beyond a manual `dumpRegistry` diff**
   into a scripted determinism check, since determinism is a charter
   Non-Negotiable and this repo already has the exact pattern
   (`bin/test-forest-determinism`) for "does a runtime filter over seeded output
   stay stable/order-independent across days and modes."
4. **Run `bin/check-importmaps` literally, not by the plan's "×4"/"ALL FOUR"
   shorthand** — `map-sandbox.html` is worldgen-only per the script's own header
   comment; none of the four new modules (`runMode`, `runState`, `scoring`,
   `leaderboard`) are worldgen modules, so they belong only in `index.html`,
   `sandbox.html`, `hub-sandbox.html`.
5. **Confirm CHANGELOG/ROADMAP discipline lands same-commit per phase** as already
   scoped in tasks 7.1 and 8.6 — no change needed, just flagging it as the gate
   that closes each phase.
6. **Document the Worker KV board write race explicitly as an accepted trade-off**
   in the leaderboard spec (it's currently only in `design.md`'s Risks section),
   since it's a genuine unmitigated read-modify-write race, even if low-severity
   at this scale.

### Quality Deficiencies Found

- **Cross-mode data contamination of `zerble-best-smiles`**: `src/hud.js:195-201`
  (`saveBest`) is called unconditionally from every score-write site in
  `src/main.js` (904, 1580) and `__dbg.addSmiles`. Festival Run's combo (×1-×4)
  stacked with Lurleen's ×2 means a single Festival Run session can score 2-8x a
  normal collect, and nothing in `tasks.md` (Groups 3, 4, or 6) requires gating
  `saveBest`/`Analytics.personalBest` to Just Cruisin' only. This directly
  contradicts `design.md`'s Migration Plan line: "`zerble-best-smiles` remains the
  Cruisin' personal best and is untouched." Left as-is, the very first Festival
  Run playtest silently overwrites the player's Cruisin' personal best with an
  inflated, wrong-mode number, permanently, in production `localStorage`. --
  **Severity: Critical**
- **No automated regression test for the new deterministic client logic**:
  across the entire plan (Groups 1-9, ~50 subtasks), the only automated test task
  is 8.2 ("Worker unit checks runnable without deploy... plain node test file for
  validation logic: ceilings, monotonicity, name sanitizer") — scoped to the
  Worker only. `scoring.js` (chain thresholds, high-water ratchet, doubler
  stacking), `runState.js` (sputter/vibe state machine, strike decay), and
  `runMode.js` (day-ramp table lookups) are exactly the class of pure,
  deterministic, no-DOM logic this codebase already covers with plain-node
  `bin/test-*` scripts (`test-game-juice` for juice mechanics, `test-forest-determinism`
  for seeded-output stability, `test-registry-grid`, `test-adaptive-quality`).
  Every verification task for these systems (4.7, 6.8) is `__dbg` drills +
  screenshots — good for HUD/visual confirmation, not a substitute for an
  arithmetic regression gate. -- **Severity: Medium-High**
- **KV board read-modify-write race, unmitigated**: D8's `board:all` /
  `board:daily:<date>` top-100 arrays are read-modify-write on Cloudflare KV with
  no CAS/ETag/retry-on-conflict documented. Design.md calls the contention risk
  "negligible at this scale" and explicitly rejects Durable Objects as overkill —
  a reasoned trade-off, not an oversight, but it's currently only recorded in
  `design.md`'s Risks section, not in the `leaderboard` delta spec itself, so a
  future reader of the spec alone wouldn't know the guarantee is "eventually
  consistent, occasional lost update" rather than atomic. Low practical impact
  (a dropped board write is cosmetic — the authoritative `run:<id>` KV entry is
  unaffected — and self-heals on the next successful write). -- **Severity: Low-Medium**
- **Importmap task language imprecision**: tasks 2.1, 3.1, 4.1, 6.1 and
  `proposal.md`'s Impact section say "importmap ×4" / "ALL FOUR html pages" for
  the four new `src/` modules. `bin/check-importmaps`'s own header comment
  (and Non-Negotiable #4) scope `map-sandbox.html` to worldgen-only (`wg` array);
  none of `runMode.js`/`runState.js`/`scoring.js`/`leaderboard.js` are worldgen
  modules. `bin/check-importmaps` won't hard-fail if an implementing agent adds
  them to `map-sandbox.html` anyway (the script only flags *missing* entries and
  mismatched `worldgen/`-prefixed tokens, not harmless extras), so this won't
  break the gate — it's wasted effort and a slightly wrong mental model, not a
  functional bug. -- **Severity: Low**

### Mechanical Assertions

| Check | Status | Notes |
| --- | --- | --- |
| Data integrity (localStorage) | **FAIL as planned** | `zerble-best-smiles` cross-mode contamination — no task gates `HUD.saveBest()` to Just Cruisin'; contradicts design.md's own Migration Plan promise. See Critical finding above. |
| Transaction safety (Worker KV) | Partial / documented trade-off | Board read-modify-write race accepted in design.md, not yet mirrored into the `leaderboard` spec; low practical severity (self-healing, non-authoritative array). |
| Test plan coverage | **FAIL** | 1 automated regression task (8.2) across ~50 subtasks, scoped to the Worker only; the client's pure deterministic logic (scoring/runState/runMode/jug-filter) has no `bin/test-*` despite strong in-repo precedent for exactly this class of module. |
| Migration rollback (localStorage keys) | PASS | New keys additive; absence falls back to today's behavior (design.md Migration Plan); no seeded-stream reorder/re-salt (D3). |
| Deployment safety (Worker) | PASS | Deployment explicitly gated on Gary (account/secrets); client feature-flags the global board off until a configured endpoint responds (D9, task 8.3); local board carries P1-P2 fully. |
| Naming conventions | PASS | `runMode.js`/`runState.js`/`scoring.js`/`leaderboard.js` match the existing lowerCamelCase `src/` convention; `workers/leaderboard/` correctly sits outside `src/` and outside all importmaps per Non-Negotiable #4. |
| Importmap coverage | PASS, with a note | Tasks correctly require adding new modules to the importmap lists and running `bin/check-importmaps`; the plan's "×4"/"ALL FOUR" phrasing over-scopes to `map-sandbox.html`, which is worldgen-only. Non-blocking (see Low finding). |
| Determinism (D3 jug filter) | PASS, with a note | Correctly specified as a fresh-salted runtime filter over realized entries, never touching seeded worldgen streams (Non-Negotiable #1 honored); verification task (6.2) is manual `dumpRegistry` diffing only, no automated regression — see Medium-High test-coverage finding. |
| Scope completeness (score write paths) | **PASS, independently verified** | `rg 'score'` sweep against `src/main.js` confirms exactly the 4 write sites proposal.md's Scope Check names (lines 541, 902, 1202, 1580) — the Scope Check claim is accurate, not cursory. |
| Security hygiene (Worker) | PASS, depth deferred | No hardcoded credentials (secrets stay in Worker env per D8/leaderboard spec); admin-delete endpoint requires bearer auth; no raw-SQL/file-upload surface (KV only). Deeper abuse-case/forgery analysis (token replay, rate-limit bypass) belongs to the Adversary lens, not duplicated here. |

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: `HUD.saveBest()`/`zerble-best-smiles` is not mode-gated anywhere
  in the task list, so the first Festival Run session with any combo multiplier
  will silently overwrite the player's Just Cruisin' personal best with a
  wrong-mode, inflated number in production `localStorage` — directly
  contradicting design.md's own stated migration guarantee.
- **Recommendation**: The plan is mechanically sound everywhere else — the
  Scope Check for score-write paths is accurate and verified independently, the
  determinism approach (D3) correctly avoids the seeded-stream tripwire, naming
  and importmap discipline follow project convention, and the Worker's
  deployment gating is safe. Add one task in Group 3 or 4 to gate
  `saveBest`/`personalBest` to Just Cruisin' before Group 4 ships, and add
  lightweight `bin/test-*` regression coverage for `scoring.js`/`runState.js`/the
  jug-filter alongside their creation tasks (Groups 4 and 6) rather than after
  the fact. Neither is a redesign — both are additions to an already
  well-sequenced plan.
