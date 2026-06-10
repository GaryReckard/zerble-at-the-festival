# Deliberation — worldgen-layout-harness

## Deliberation Index

- `001-initial/` — apply-readiness review of the full artifact set (Adversary +
  Architect + Pragmatist + Anthropologist + Mediator, synthesis mode,
  2026-06-10). **Headline outcome: proceed with modifications — the PIVOT.**
  The dry-run layout extraction (old design D-C) was proven unimplementable at
  this change's scope (cosmetic draws inside ~8 model builders; `crowd.spawn`
  tier-pool draws make built layouts tier-dependent today; registry guards
  inside draw loops) and is **deferred to `festival-zone-grammar`**;
  built-truth capture (`dumpRegistry` + `bin/layout-snapshot`, pinned tier,
  draw-count canary) becomes the linter's primary substrate. Also: cross-change
  sequencing corrections (v2 H.2 golden-mover = commit zero;
  `DEFAULT_WORLDGEN_V2` flip re-sequenced to after the grammar change — Gary
  sign-off pending), the importmap rule corrected to FOUR html files +
  consistency checker, hub-viewer fidelity/teardown requirements, and the
  Gary-legible baseline format. Synthesis: `001-initial/results.md` (CG1–CG8 +
  Risk Register R1–R14, all folded into proposal/design/specs/tasks on
  2026-06-10). Six decisions queued for Gary in `questions-for-human.md`
  (Q1–Q6); apply starts after Q1–Q3 are confirmed.

**Risk signatures that triggered the round:** determinism / rng-call ordering
(the refactors), importmap maintenance (new modules + a new page), disposal
safety (decals, hub-viewer rebuild), chunks.js exercised outside the game
(`buildHubPreview`).
