---
change: worldgen-layout-harness
open: 0
answered: 6
last_question: Q6
last_answer: "2026-06-10 — Q1–Q6 all answered interactively (every council recommendation confirmed)"
---

# Questions for Human: worldgen-layout-harness

> **AGENT DIRECTIVE:** Check this file when resuming work. If `open > 0`, present
> each unanswered question to the user before starting new work.

## Open Questions
<!-- Newest first. Move to Answered section when resolved. -->

(none — apply is unblocked)

## Answered Questions
<!-- Answered questions moved here with response. Newest first. -->

### Q6: Parked — dedupe the four inline importmap injectors?
**Date:** 2026-06-10 · **Answered:** 2026-06-10
**Question:** Park the shared-bootstrap dedupe on ROADMAP, or drop it (the
consistency-checker script covers the drift risk)?
**Answer:** **Park it on ROADMAP.**
**Action:** -> ROADMAP bullet added under the worldgen section ("Importmap
bootstrap dedupe", parked, Gary call, must not ride a golden-frozen change).

### Q5: Tuning freeze during the hoist window
**Date:** 2026-06-10 · **Answered:** 2026-06-10
**Question:** OK to freeze experimental `constants.js`/worldgen tuning during
group 2's ~1–2-commit hoist window (live tuning invalidates the gate snapshots)?
**Answer:** **Freeze is fine.** We ping when the window opens and closes.
**Action:** Already encoded in tasks group-2 preamble; no further edit.

### Q4: Marker hotkey — what's the mobile story?
**Date:** 2026-06-10 · **Answered:** 2026-06-10
**Question:** Desktop-only v1, or add a touch affordance so phone playtests of
the live deploy also produce coordinate markers?
**Answer:** **Add the touch affordance** — deliberately awkward gesture (e.g.
triple-tap a HUD corner) + keyboard-free copy.
**Action:** -> Task 7.1 updated; specs/layout-debug-tools marker requirement +
new "Phone playtest produces coordinates too" scenario; design D-G updated.

### Q3: Pin which perf tier for snapshots + the baseline?
**Date:** 2026-06-10 · **Answered:** 2026-06-10
**Question:** Built layouts are tier-dependent today (crowd pool draws); which
tier do all captures + the baseline pin? Council recommended high.
**Answer:** **`?perf=high`, crowd on.**
**Action:** Design D-A capture protocol pinned to high; bin/layout-snapshot
will hard-code it.

### Q2: Re-sequence the DEFAULT_WORLDGEN_V2 flip to AFTER festival-zone-grammar?
**Date:** 2026-06-10 · **Answered:** 2026-06-10
**Question:** Corrected order H.2 → harness → festival-zone-grammar → H.3/F.5 +
I landing (flip), instead of the v2 HANDOFF's stale "flip next" — confirm?
**Answer:** **Confirmed — flip after the fix.** Players keep the current world
until the festival layout is actually fixed.
**Action:** -> Task 0.2 DONE same day: re-sequencing warning block written into
`openspec/changes/v2-worldgen-3d-integration/HANDOFF.md` above its NEXT list.

### Q1: Confirm the pivot — dry-run extraction moves to festival-zone-grammar
**Date:** 2026-06-10 · **Answered:** 2026-06-10
**Question:** Confirm deliberation 001's re-scope (built-truth capture here;
the risky builder split deferred into the grammar change under its
already-moving golden, gated by this harness)?
**Answer:** **Confirmed.**
**Action:** Artifacts were already revised to match (design D-C′, tasks group 3
retired, specs/layout-dry-run removed); -> D6 stands; the grammar change's
artifacts must inherit the extraction tasks when drafted.
