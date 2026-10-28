# Road surfaces

<!--STATUS:LINE-->
<!--/STATUS:LINE-->

## TL;DR

Festival access roads leading to major hubs gain a slightly wider asphalt surface, while smaller routes stay dirt. Both have subtle grain that stays aligned as the world loads. Existing road routes and the venue planner remain unchanged.

## The Problem

Plain brown strips beside textured grass made roads look unfinished, and every route looked equally important. Random paving would make the map harder to understand.

## Proposed Fix

Each existing road receives a surface from its endpoints. A major hub makes it eligible for nine-metre asphalt, provided its entire ribbon clears nearby lakes; otherwise the whole road remains seven-metre dirt. Shared repeating textures add detail without adding road draws, and the distant road layer and map retain the same classification.

## Progress

<!--STATUS:AUTO-->
**complete** — 10/10 tasks complete (100%)

_Last updated: 2026-10-28_

| Group | Progress |
|---|---|
| 1. Characterization and planning | 2/2 ✅ |
| 2. Semantic road data | 2/2 ✅ |
| 3. Road rendering | 3/3 ✅ |
| 4. Verification and documentation | 3/3 ✅ |
<!--/STATUS:AUTO-->

## Key Decisions

- Use the planner's existing nine-metre reserved envelope: dirt retains one-metre shoulders, while asphalt occupies the envelope.
- Preserve all route points and planner random decisions. Surface classification consumes no random numbers.
- Test full segments against enclosing lake circles, including the ribbon width. This deliberately leaves some dry shore routes unpaved.
- Keep two shared texture/material pairs and the existing one-draw distant-road buffer.
- Physical prop checks conservatively clear the widest ribbon, even when another narrower centerline is closer.

## Risks & Watch-outs

Conservative shore rejection and physical prop clearance can leave fewer paved roads or omit a nearby prop. The broader no-build corridor and original planner remain unchanged. Desktop browser verification does not establish phone performance or iOS audio behavior; the synchronous audio gesture path is untouched.

## Where Things Live

[Proposal](proposal.md), [design](design.md), [requirements](specs/road-surfaces/spec.md), [tasks](tasks.md), [council outcome](deliberations/001-road-surfaces/results.md), [decision history](session-log.md), and [verification report](../../../verification/roads/2026-10-28/README.md).
