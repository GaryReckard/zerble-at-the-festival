# Temporary activities for festival people

> **Status:** <!--STATUS:LINE-->complete · 12/12 tasks (100%)<!--/STATUS:LINE-->

## TL;DR

Existing people should be able to hoop, play frisbee and dance, react to an approaching cart, and resume or leave without losing their identity or appearance. The first proof is the complete hula cycle.

## The problem

Hoopers and frisbee players currently have separate population owners, while an adult borrowed by an external activity does not run the normal trajectory test and loses its claim on a honk.

## Implemented behavior

Hula and frisbee borrow eligible Crowd people and keep their original bodies and colliders. A cart reaction invalidates the current activity claim before movement; the session validates its people and place before acquiring fresh authority, or cancels after a bounded wait. Frisbee settles its disc and pauses both players together. Healing Arts dancers retain their Crowd appearance and use the same cart interruption while yoga and physically constrained occupants keep their protected handling.

## Key decisions and risks

The hula cycle comes first. Preserve the existing frame and scoring order, appearance, one body and collider, independent nightness, random streams, shared resource lifetimes and synchronous audio startup. Selection remains explicit. See the [design](design.md) and [deliberation](deliberations/001-activity-contract/briefing.md).

## Open questions

No questions for Gary are currently open. Matched whole-game performance and physical-device checks remain open in the [verification record](../../../verification/people/temporary-activities.md).

## Progress

<!--STATUS:AUTO-->
**complete** — 12/12 tasks complete (100%) · current: Complete; implementation and verification recorded

_Last updated: 2026-10-27_

| Group | Progress |
|---|---|
| 1. Characterization and design | 3/3 ✅ |
| 2. Hula first | 3/3 ✅ |
| 3. Paired frisbee and dancing | 3/3 ✅ |
| 4. Acceptance | 3/3 ✅ |
<!--/STATUS:AUTO-->

## Where things live

[Proposal](proposal.md), [design](design.md), [tasks](tasks.md), [session log](session-log.md), and [questions](questions-for-human.md).
