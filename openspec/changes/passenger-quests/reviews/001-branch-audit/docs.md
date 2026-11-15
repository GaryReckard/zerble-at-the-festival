## Scope
- Reviewed: changed documentation in `558c9f3...2277934`, including ARCHITECTURE, CHANGELOG, DEBUGGING, ROADMAP, gameplay backlog, the passenger-quests change record, capability spec and verification report; consulted owning quest/crowd sources for factual checks.
- Notes: documentation review only; no runtime tests or browser launched. The active change has its README and deliberation skip, and the generated progress totals match the task checkboxes. Changelog coverage and retained acceptance follow-ups are present. No new player-facing Easter-egg leak was found. No source files were edited.

## Findings
- [P2][high] openspec/specs/passenger-quests/spec.md:22 - The capability contract still requires the removed first-boarder guarantee and 30% offer rate
  - Why: `src/quests/catalog.js:5` sets 8%, and `src/quests/engine.js:32` applies the chance roll without a first-rider exception. The same spec's hailing requirement at line 230 states 8%, so the normative requirements contradict one another. `ARCHITECTURE.md:546` and `openspec/changes/passenger-quests/design.md:48` repeat the obsolete behavior despite the later hailing addendum.
  - Fix: replace the old offer requirement and first-boarder scenario with the current hailing/walk-up behavior, and reconcile the architecture and design constants rather than appending another addendum.
  - Duplicate-of: none
- [P2][high] openspec/changes/passenger-quests/tasks.md:12 - A checked task and the design document claim an exit callback that does not exist
  - Why: the completed task promises `onRideEnd` on every exit path, and `design.md:42` exposes it as a crowd API, but current runtime detects departures by polling `riderInfo` (`src/quests/runtime.js:158-167`); no `onRideEnd` is defined in crowd.js. `deliberations/000-skipped.md:13` additionally claims tests/smoke coverage for scatter, dry tank and restart that the feature verification report does not record, and `bin/test-passenger-quests` has no such named integration cases. This misdirects future integrations and overstates the evidence supporting the skip.
  - Fix: describe the implemented polling contract in the completed task and design, and correct the deliberation mitigation to distinguish planned checks from recorded evidence.
  - Duplicate-of: none
- [P2][high] openspec/changes/passenger-quests/HANDOFF.md:39 - The quick-start fallback bypasses the current browser lifecycle procedure
  - Why: the handoff recommends a standalone multi-step Playwright script with waits and retries and only mentions closing in `finally`. The owning guide requires a recorded PID inventory, a deadline of at most 60 seconds, exact-PID cleanup verification and stopping stalled work (`docs/browser-verification.md:15-21`), and restricts software fallback to failure of a normal browser's WebGL context (`:30-32`). The handoff is explicitly the first document a new agent should read, so its self-contained alternate procedure invites repetition of the known runaway-worker failure.
  - Fix: replace the duplicated fallback recipe with a link to the owning browser guide and retain only feature-specific debug commands; make the prerequisite and bounded cleanup requirements explicit if any recipe remains.
  - Duplicate-of: none
- [P3][high] openspec/specs/passenger-quests/spec.md:207 - The sprite allocation limit no longer matches the live presentation
  - Why: the spec limits the pool to four sprites, but `src/quests/presentation.js:18` constructs a five-slot pool and `src/models/questBubble.js:129-137` eagerly allocates every slot. The deliberation skip also incorrectly claims shared-texture tagging at `deliberations/000-skipped.md:10`; the model explicitly documents instance ownership without shared tags at `src/models/questBubble.js:1-5`.
  - Fix: document allocated capacity separately from the active-request cap and correct the ownership statement to the instance-owned disposal contract.
  - Duplicate-of: none
- [P3][high] openspec/changes/passenger-quests/HANDOFF.md:9 - Current handoff state and acceptance pointers are stale
  - Why: it says the branch is local-only and unpushed, whereas `git branch -r --contains 2277934` reports `origin/passenger-quests`. Its open Mid/High boot item at line 17 points to completed Task 9.3 (final checks), although `tasks.md:50` explicitly moves that acceptance to Task 10.3 (Mid/High boots). These instructions can send the next agent back through completed work.
  - Fix: update the remote-state statement as a dated observation or omit transient checkout state, and point Mid/High acceptance to Task 10.3 (Mid/High boots).
  - Duplicate-of: none
