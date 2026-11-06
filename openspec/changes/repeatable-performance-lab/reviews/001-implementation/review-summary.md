# Code Review Summary

## Review Metadata

- Diff Scope: custom, the named repeatable-performance-lab source/test/doc paths and lab-specific hunks, including untracked files; unrelated dirty driving/scene-probe/wake changes are excluded.
- Reviewed Files: 49 named paths across the three specialist scopes.
- OpenSpec Change: `openspec/changes/repeatable-performance-lab`.
- Specialists Used: review-gameplay, review-performance, review-docs, dispatched in one parallel batch. The main agent synthesized the results.

## Intent Match

The change provides actual-game parked and controller-driven streaming captures, hardware-backed execution with surviving ownership, bounded acknowledged exact-frame evidence, deterministic offline comparisons and an operating skill. The completed 48-run frozen-source trial supports both scenarios’ repeatability and injected-cost sensitivity; its source/build/harness identities are retained. No player-facing speedup, mobile/Auto acceptance or subjective driving-feel result is claimed.

## Findings

No actionable issues remain in the reviewed correction scope.

Two code findings were corrected and independently rechecked by the gameplay reviewer:

- **Resolved P1/high, host provenance.** `snapshot.verify` previously checked only copied source/build bytes while the host executed live CLI/tooling. It now binds every inventoried live host script to the declared snapshot before and after launch. Integrity tests mutate an independent live host, and the CLI regression proves rejection before lease/browser creation even with accepted probe receipts. See [gameplay review](review-gameplay.md).
- **Resolved P2/high, held-key restoration.** A key first pressed during diagnostic ownership could leak auto-repeat after release. Diagnostic keydowns now enter `untilRelease`, while keyup clears suppression even during ownership. Tests reproduce the previously leaking W sequence and verify a genuine later press. See [gameplay post-fix addendum](review-gameplay.md).

The docs reviewer found missing promoted ordinary-boot `smoke.json` receipts and stale acceptance wording. The receipts were copied from the actual run directories and wording corrected/rechecked. See [documentation review](review-docs.md).

The performance reviewer found no actionable measurement/statistics issue, independently reran its lightweight regressions, and confirmed that the two post-trial guard fixes do not change the measured execution path. All 301 live inventoried files matched the measured snapshot before the fixes. The original statistical conclusions remain valid for that frozen source, and future measurements require a current snapshot and matching fresh calibration. See [performance review and scope note](review-performance.md).

## Verification Gap

The measured source passed ordinary and diagnostic Low/Mid/High native ready-title boots, successful/partial captures, actual worker-death/page-hang cleanup, and the full two-scenario overhead/calibration/fresh-holdout/injected-cost sequence. Six actual CLI analyses reproduced exact canonical outputs. The post-review source passed focused regressions and the full project check/build; its fresh nine-check browser integration matrix passed and is recorded separately in the dated evidence. No new-model sandbox, material or geometry wiring changed. Phone/Auto/feel/iOS audio-unlock checks are outside this change’s acceptance scope.

## Suggested Commit/PR Description + CHANGELOG Entry

Add a repeatable local performance lab that drives the actual game, retains immutable source and exact acknowledged frame data, and compares declared workloads with calibrated independent runs. Both scenarios passed a 48-run M4 Pro Chrome trial; independent review also closed stale host-fingerprint and diagnostic key-repeat leaks.

Validation: full project check/build, ordinary/diagnostic tier integration, real ownership fault proofs, exact offline/CLI regeneration and preserved failed attempts. Record the timing trial’s original source identities separately from the post-trial guard-fix smoke evidence.

## Verdict

Approve. No unresolved code findings; the change’s final status records completion of its remaining integration/documentation verification.
