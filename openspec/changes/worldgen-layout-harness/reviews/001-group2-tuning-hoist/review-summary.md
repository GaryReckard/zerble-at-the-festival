# Code Review Summary

Group-2 milestone review (APPLY-GUARDRAILS: "after group 2 (the hoist)"), run by a
Fable session via /smart-review on 2026-06-12.

## Review Metadata
- Diff Scope: custom (`2ded863..26a540d` — commits 4419cb3 group 2A, c2e5ddd group 2B, 26a540d readme-sync)
- Reviewed Files: 10
- OpenSpec Change: openspec/changes/worldgen-layout-harness
- Specialists Used: review-gameplay, review-performance, review-sandbox, review-docs
  (review-rendering and review-audio skipped — no models/materials/audio in the diff)

## Intent Match

Yes. The diff does exactly what the commit subjects, CHANGELOG bullets, and tasks
2.1–2.3 claim: a value-identical hoist of festival arrangement constants into the new
import-nothing `src/worldgen/tuning.js` (mutable `FESTIVAL_TUNING` + `setFestivalTuning`
+ `MODEL_DIMS` + `clusterExtent`), planner (`festival.js`) and worldgen builders
(`chunks.js` `buildFoodCourtAt` / `buildVendorRowAt` / `buildCampVillageAt`) rewired to
read it, a one-shot localhost drift guard in `buildWorldgenKind`, and importmap entries
in all three live html files. review-gameplay spot-checked every hoisted constant
against its old literal — all value-identical; zero rng() calls added, removed, or
reordered; no salt/hash2 changes. Legacy do-not-merge twins (`buildVendorRow`,
`buildFoodPlaza`, `buildCampVillage`) verified untouched, each shared literal surviving
exactly once at its legacy site. The claimed gates (goldens `eddf8e50` / `01532955`
unchanged, snapshot diff EMPTY × 5 windows / 3 seeds incl. draw canary, both flag
states boot clean) are consistent with what the diff actually does.

**One scoped exception, which is the headline finding:** the stage-scale constants were
hoisted on the planner side only, but the new comments claim both halves read tuning.

## Findings

- [P1][high][review-gameplay] src/worldgen/festival.js:105-109 - Comments falsely claim `buildStage` reads `FESTIVAL_TUNING.STAGE_SCALE_*`; the builder twin was NOT rewired
  - Why: `chunks.js:2309-2311` still draws stage scale from literals
    (`1.15 + ctx.rng() * 0.25` / `1.0 + ctx.rng() * 0.5`) while the planner's
    `stageScaleOf` reads `FESTIVAL_TUNING.STAGE_SCALE_*`. Values are identical today so
    the goldens legitimately pass — no current bug. But the diff *replaced* the old
    "keep these two formulas in sync" warning with "the hoist makes them one source,"
    and tuning.js:121 repeats the claim ("planner stageScaleOf == builder buildStage;
    MUST stay equal"). The whole point of this surface is the group-6.4 live sliders:
    the first agent who tunes `STAGE_SCALE_MAJOR_BASE` desyncs the planner's dancefloor
    rect / tree-clearing / `dancefloorRectsNear` suppression from the built stage model
    — exactly the plan-vs-build agreement D3.3 protects — and the comments now actively
    say it's safe. Verified directly by the orchestrator (high confidence).
  - Fix: rewire `buildStage`'s scale draw to read `FESTIVAL_TUNING.STAGE_SCALE_*`
    (value-identical; the draw stays the FIRST `ctx.rng()` call so rng order is
    untouched; same gate ritual as the rest of group 2). Falling back to correcting the
    comments is acceptable only if the rewire is deferred deliberately. Must land
    before group 6.4. **Folded back into tasks.md as task 2.4.**
  - Duplicate-of: none

- [P2][medium][review-docs] ROADMAP.md:86 - Partially-shipped roadmap item not trimmed
  - Why: the "Festival layout — the plan/build contract refactor" section still lists
    step "(1) hoist the ~34 scattered layout constants into one `FESTIVAL_TUNING`
    object" as queued — that step shipped in this diff. The changelog-and-roadmap rule
    wants partial multi-part bullets trimmed in the same commit.
  - Fix: trim step (1) to a "shipped 2026-06-11 (worldgen-layout-harness group 2)"
    note in a follow-up docs commit; sweep finding 5 in the same pass.
  - Duplicate-of: none

- [P3][low][review-gameplay] src/chunks.js:1181 - Drift-guard hostname gate narrower than the repo's own dev-host detection
  - Why: `/^(localhost|127\.0\.0\.1)$/` skips the hosts map-sandbox.html's `isLocal`
    accepts (172.16–31.x, `claude-preview`, `happycog`). The canonical verify loop uses
    127.0.0.1:8765 so the main path is covered, but a session under a forwarded/preview
    hostname silently disables the guard — and "no drift warning" is part of the gate
    evidence.
  - Fix: reuse the map-sandbox `isLocal` predicate shape so the guard fires in every
    environment the project treats as dev.
  - Duplicate-of: none

- [P3][low][review-docs] openspec/changes/worldgen-layout-harness/tasks.md:153 - Task 2.3 ticked but the recorded gate outputs omit the HUD-budget observation
  - Why: 2.3's done-line includes "HUD budgets unchanged"; both session-log gate
    entries record goldens/snapshots/boots but not the HUD readout. A value-identical
    hoist shouldn't move budgets, but the gate asks for the observation, not the
    inference.
  - Fix: append one line to the commit-B Work Log entry (or this review's session-log
    entry) recording that the HUD budget panel was checked, or that it wasn't and why
    the inference suffices.
  - Duplicate-of: none

- [P3][low][review-docs] ROADMAP.md:123 - Pre-existing: the `__dbg` additions bullet (gotoHub/topDown/showFootprints/dumpRegistry) shipped with group 1 but still reads as queued
  - Why: not introduced by this diff; flagged so the same trim pass as the P2 sweeps it.
  - Fix: trim/strike in the follow-up docs commit.
  - Duplicate-of: none

**Resolved during synthesis (no action):** review-docs raised a same-commit-discipline
ambiguity on the commit-A CHANGELOG bullet (it names `buildFoodPlaza`, which was only
discovered in commit B). Verified with git: commit A's bullet did NOT mention
buildFoodPlaza; commit B amended it when the third twin surfaced. Discipline held —
finding dropped.

## Verification Gap

- The change's own gate evidence is strong and recorded: goldens unchanged
  (node + browser), registry snapshot diff EMPTY × 5 windows / 3 seeds incl. draw
  canary, node selftest 23/24 (pre-existing known miss), both `?worldgen=` flag states
  booted clean, no drift warning.
- review-performance confirmed no per-frame exposure (all rewired reads sit behind the
  festival plan memo or chunk-spawn paths) and the drift guard is one-shot.
- Gaps: the HUD-budget observation wasn't recorded (P3 above); per-tier
  (`?perf=low|mid`) was not re-checked, acceptable for a value-identical hoist with an
  empty draw-canary diff.

## Suggested Commit/PR Description + CHANGELOG entry

Already shipped (commits + CHANGELOG bullets landed with the work and were verified
accurate — see Intent Match). For the follow-up fix commit (task 2.4), suggested
CHANGELOG entry:

> ### Changed
> - **Stage-scale hoist completed on the builder side.** `buildStage`'s per-stage
>   scale draw now reads `FESTIVAL_TUNING.STAGE_SCALE_*` like the planner's
>   `stageScaleOf` already does — the group-2 hoist had rewired only the planner half
>   while the new comments claimed both. Value-identical (the draw stays the stage's
>   first rng call): both goldens unchanged, registry snapshot diff empty. Closes the
>   plan-vs-build desync trap ahead of the group-6.4 live tuning sliders.

## Verdict

**Approve with changes.** No blockers: determinism, lifecycle, perf, importmap wiring,
and CHANGELOG discipline are all clean, and the hoist is provably value-identical. The
P1 is a latent trap (false comments + an un-hoisted twin on the exact surface the
sliders will tune), not a current defect — fix it as task 2.4 before group 6.4,
ideally before group 4 while the gate harness context is warm. P2/P3s are docs-pass
material.
