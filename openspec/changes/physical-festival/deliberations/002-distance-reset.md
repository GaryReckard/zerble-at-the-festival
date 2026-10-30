# Approved amendment: distance reset and deferred implementation

## Decision and provenance

On 2026-10-29 Gary accepted the recommendation to reset arrangements after the player leaves them sufficiently far behind. He subsequently approved documenting the model split, explicitly chose **finish the delegation plan only**, and said to finish the hula-hoop work before starting physics on a clean branch.

This is a direct human decision and planning amendment, not another council run or runtime validation. The [original synthesis](001-plan/results.md) and independent positions remain unchanged historical evidence. Where they refer to saved visit records, pose restoration or history eviction, this amendment supersedes that part of the recommendation.

## What changes

- Retain physical changes only in the live neighborhood and in currently adopted objects that remain relevant to the player.
- After distance, hysteresis, observation and live-dependency checks permit coherent teardown, discard the arrangement's transient state. Regenerate the original deterministic placement on a later visit.
- Do not build a displaced-pose serialization layer, visited-arrangement history store or eviction/restoration policy for that history.
- Keep a followed chair or carried cup alive even when its original camp resets. Temporary origin suppression prevents a duplicate; it ends with the adopted object's lifetime.
- Reset local furniture/attachments coherently and release or transfer seat, holder and aftermath claims first. Do not reset NPC identities, progression, discoveries or reward eligibility as a side effect.
- Nearby signs can remain fallen/flattened without a repair behavior; safe distant regeneration is a separate lifecycle operation.

## What still matters

The original council's frame ordering, canonical generation clearance, exact claim guards, forced-release reserves, render adoption, bounded per-frame work, sign-route truth and real-device verification all remain applicable. Distance reset reduces historical state management; it does not remove nearby simulation cost or permit invisible-but-nearby resets.

## Updated artifacts

The current [design](../design.md), [tasks](../tasks.md), [ideas](../ideas.md), [physical-prop requirements](../specs/physical-props/spec.md), [wayfinding requirements](../specs/festival-wayfinding/spec.md) and [verification matrix](../verification.md) implement this policy at the planning level. Task 3.6 (Distance reset and frontier) replaces the earlier visit-history task without renumbering the checklist. Task 9.5 (Damage recipe and local retention) now distinguishes local damage from post-reset regeneration.

The [delegation plan](../delegation.md) assigns all 66 tasks and specifies file ownership, handoffs, review and escalation. Model choices are recommendations for later execution; no worker or runtime implementation is started now. The clean-branch prerequisite is part of Task 1.1 (Baseline and compatibility).
