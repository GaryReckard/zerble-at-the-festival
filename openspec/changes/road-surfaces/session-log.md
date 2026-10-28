---
change: road-surfaces
status: complete
current_task: null
blocked_by: null
open_questions: 0
started: 2026-10-28
last_updated: 2026-10-28
ref: 3e6d4af
---

# Session Log: Road Surfaces

## Key Decisions

### D1: Preserve planner execution

Keep the original 4.5m full-shape half-envelope and all planner RNG gates.
Asphalt spends the dirt shoulder rather than enlarging the planned corridor.
Surface classification uses enclosing lake circles for a continuous full-width
proof, with whole-edge dirt fallback. Physical builder props conservatively
clear the widest ribbon. See the council Decision Amendment and design.md.

### D2: Validate the complete vendor canopy

The existing +1m booth center guard represented neither the 4.5m trim nor its
slightly rotated roof. Keep straight seven-metre-offset vendor avenues, but
check a conservative 4.7m oriented square against every road at the widest
ribbon half-width before building. Registry lint now includes each captured
collider radius. Focused cases retain straight avenues and reject curved and
mixed-width neighboring-road intersections without changing plan descriptors.

## Assumptions

The original routes and planner descriptors must remain unchanged. Four-seed
route, queryPoint/nearest-field and full nearby POI hashes establish this;
verification/roads/2026-10-28/README.md records provenance and limits.

## Dangling Threads

None requiring Gary's input. Physical-device performance and audio are outside
this desktop verification; the synchronous audio gesture code is unchanged.

## Work Log

### 2026-10-28 -- Surface and seating implementation

**Event:** decision
**What:** The shoreline counterexample requires whole-edge dirt fallback, now
checked with segment-to-enclosing-circle distance rather than sparse probes.
The original four-seed sorted route hashes still match. Stage groups retain
original draw counts, and each stage blanket publishes four independent
stage-facing reservations.
**Refs:** D1; tasks.md; verification/people/stage-followups.md.

### 2026-10-28 -- Physical footprint and verification closure

**Event:** discovery
**What:** The final physical-placement audit found that the existing booth
center guard could allow a canopy over a curved road even after widening the
center tolerance. Full oriented canopy checks retain straight avenues and
reject that failure. The final full suite, native Low/Mid fixtures, ten actual
unload/rebuild cycles, and direct game ready-click/honk checks pass. An iframe
repeats the previously recorded unattributed MutationObserver error; direct
games and native fixtures are clean. Final cleanup is recorded in the
[verification report](../../../verification/roads/2026-10-28/README.md).
**Refs:** D2; tasks.md; verification/people/stage-audience.md.

### 2026-10-28 -- Completion

**Event:** phase-change
**What:** All ten tasks are complete. Full checks, source compatibility, native
Low/Mid day/night and resource reuse, real-game ready clicks and honks, and
document links pass. Owned tabs are closed, server PID16080 is confirmed gone,
and the completed wakeup was deleted. Changes remain uncommitted.
**Refs:** tasks.md; the verification report.
