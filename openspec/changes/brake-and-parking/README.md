# Stop and park Zerble

> **Status:** <!--STATUS:LINE-->complete · 8/8 tasks (100%)<!--/STATUS:LINE-->

## TL;DR

Space brakes, E honks and R parks. Touch Brake replaces Slow. Parking stays set
without held input and releases when the player deliberately applies fresh
throttle. The cart remains physical, so inadequate grip can still let it slide.

## The Problem

Reverse both stops and reverses; it is awkward for passengers and hill stops.

## Proposed Fix

Adapt controls before motion, latch parking independently of held buttons and
use bounded ground forces to hold supported hills. See [design](design.md).

## Progress

<!--STATUS:AUTO-->
**complete** — 8/8 tasks complete (100%)

_Last updated: 2026-11-17_

| Group | Progress |
|---|---|
| 1. Controls and parking | 3/3 ✅ |
| 2. Physical braking | 2/2 ✅ |
| 3. Verification and documentation | 3/3 ✅ |
<!--/STATUS:AUTO-->

## Key Decisions

Keep keyboard precision; move honk off Space. Require neutral before held
throttle can become a fresh parking release. Reject moving parking requests.
The [risk gate](deliberations/000-skipped.md) records the bounded scope.

## Risks & Watch-outs

Test actual hill displacement, air/low-grip limits and input interruptions.
No world generation, audio unlock, geometry or rendering policy changes.
Physical phone feel requires separate acceptance.

## Where Things Live

- [Proposal](proposal.md), [design](design.md), [tasks](tasks.md) and [specs](specs/).
- [Session log](session-log.md) and [human questions](questions-for-human.md).
