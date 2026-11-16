## Scope
- Reviewed: `2277934..dd1516c` in `.claude/worktrees/passenger-quests-audit-2`, limited to ARCHITECTURE.md, CHANGELOG.md, the passenger-quests change README, HANDOFF, audit, deliberation skip record, design, questions, session log and tasks, the capability spec, and verification README. Source was read only to validate documentation claims.
- Notes: Read AGENTS.md, local override, documentation index and relevant process rules. `bin/readme-sync passenger-quests --check` reports fresh status; `git diff --check 2277934..dd1516c` passes. No browser was run and no source or documentation was edited. The test-only follow-up commit does not require a player-facing changelog entry. The historical audit explicitly targets 2277934, so its original findings are not treated as current-code claims.

## Findings
- [P2][high] CHANGELOG.md:9 - Capture exclusion is overstated as carrying no quest work
  - Why: The new entry says measurement runs carry “no quest work,” and deliberations/000-skipped.md:11 says quests are switched off entirely. `src/main.js:919-928` constructs QuestPresentation before calling stop, and `src/main.js:1514` still calls its update every frame. Construction allocates five sprites and materials (`src/quests/presentation.js:18`, `src/models/questBubble.js:129-137`); the empty update still advances time and reads reduced motion (`src/quests/presentation.js:48-52`). Stopping offers/searches is supported, but equivalence to a baseline without quest work is not.
  - Fix: Describe the actual guarantee as disabling offers, hails and destination searches, while acknowledging retained presentation construction and empty updates; require measured evidence before claiming no performance difference. Alternatively gate construction and updates if complete exclusion is the intended contract.
  - Duplicate-of: none; coordinate with the performance reviewer if they report the underlying capture path.
- [P2][high] CHANGELOG.md:9 - The new universal 60 m minimum excludes urgent requests
  - Why: “The shortest trip is now 60 m to the edge of the stop” applies only to ordinary/party destination selection. This diff sets `QUEST.URGENT_MIN` to 45 m (`src/quests/catalog.js:28`), and `src/quests/pick.js:43` passes that minimum to the edge-based filter at lines 7-14. A normal potty has a 16 m radius (`src/quests/catalog.js:77`), so a centre 61 m away is eligible with only 45 m to the arrival edge. This is a documentation mismatch, not a request to change the intended balance.
  - Fix: Qualify the changelog and design distance row as ordinary trips. Update the capability distance contract (`openspec/specs/passenger-quests/spec.md:41-45`) alongside this changed behavior: it still says MIN_DIST is 80 m, which becomes newly false in this range. Specify edge minima of 60/45/160 m and centre maxima of 300/220/900 m for ordinary/urgent/summit requests.
  - Duplicate-of: none.
- [P3][high] openspec/changes/passenger-quests/HANDOFF.md:12 - The unresolved economy issue points to the wrong audit finding
  - Why: The new handoff calls finding 4 “economy,” but audit finding 4 concerns boardable hail candidates (`adversarial-audit-001.md:57`), while economy is finding 5 (`:67`). The new task 12.8 also repeats “audit finding 4” (`tasks.md:73`). This sends the next person to a fixed candidate-filter issue instead of the remaining reward review.
  - Fix: Use finding 5 (hailing economy) for the open item and task reference, and include finding 4 (candidate eligibility) among the fixed items.
  - Duplicate-of: none.

## Integration notes
- The first-boarder guarantee in design.md:51 and the stale toast warning in HANDOFF.md were already present at 2277934; they are not introduced findings in this review. The newer main documentation sweep and Passport completion were not merged into this branch, so their absent updates are also not attributed to these two commits.
- The new verification addendum clearly retains the real-GPU hailer approach, audio/pose and run-end/capture checks as unverified. The audit-fix entry therefore must not be read as browser acceptance.
