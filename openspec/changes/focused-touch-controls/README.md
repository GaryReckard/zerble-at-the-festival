# More comfortable touch driving

> **Status:** <!--STATUS:LINE-->complete · 8/8 tasks (100%)<!--/STATUS:LINE-->

## TL;DR

Give the thumbs fewer, clearer jobs: a forgiving floating stick, prominent Brake
and Honk, quieter Boost, and a compact paused menu. Touch camera inspection stays
put while parked, then gently returns during forward driving after a grace.

## The Problem

Secondary controls compete with driving, and persistent camera orbit adds work.
The map stylesheet also overrides the isolated control layout.

## Proposed Fix

Use explicit gesture ownership and one paused parent menu beneath existing sheets.
Keep desktop orbit behavior and all non-chase views. See [design](design.md).

## Progress

<!--STATUS:AUTO-->
**complete** — 8/8 tasks complete (100%)

_Last updated: 2026-11-17_

| Group | Progress |
|---|---|
| 1. Verification and input | 2/2 ✅ |
| 2. Menu and camera | 3/3 ✅ |
| 3. Acceptance and docs | 3/3 ✅ |
<!--/STATUS:AUTO-->

## Key Decisions

The [bounded Astra review](reviews/astra-plan.md) preceded implementation and
informed menu stacking, map separation and touch-only return. The
[risk gate](deliberations/000-skipped.md) records the scope decision.

## Risks & Watch-outs

Verify combined map/control styling, held and simultaneous fingers, child-sheet
pause and focus, and hybrid desktop overrides. Phone comfort remains separate.

## Where Things Live

- [Proposal](proposal.md), [specs](specs/), [tasks](tasks.md).
- [Session log](session-log.md), [human questions](questions-for-human.md).
