# Find your way around the festival

> **Status:** <!--STATUS:LINE-->in progress · 9/10 tasks (90%)<!--/STATUS:LINE-->

## TL;DR

A small map follows your cart and expands into a translucent view while you keep driving. Discover places as you explore, remember them in the same festival, and select a destination to follow its directional pin.

## The Problem

An infinite festival needs recognizable places and a way to return to them. Future missions also need to point to destinations without giving away unexplored terrain.

## Proposed Fix

The implementation adds a simple 2D map with persisted exploration, known stages and juice stands, nearby friends and pickups, and player-centered zoom. Run geographic generation separately from gameplay so map queries cannot interrupt steering.

## Progress

<!--STATUS:AUTO-->
**in progress** — 9/10 tasks complete (90%) · current: 4.4 (device and extended lifecycle acceptance)

_Last updated: 2026-10-29_

| Group | Progress |
|---|---|
| 1. Verification surface and pure contracts | 2/2 ✅ |
| 2. Geography and rendering | 2/2 ✅ |
| 3. Live game integration | 2/2 ✅ |
| 4. Verification and documentation | 3/4 |
<!--/STATUS:AUTO-->

## Key Decisions

Live gameplay continues while expanded; there is zoom but no panning. Friends appear only nearby. M controls the map, J controls music, and the touch music button retains its function. Pins toggle directly, wheel/pinch zoom and Escape/empty-space tap close; no heading, menu, scale, north indicator or zoom/close buttons clutter the map. All quality tiers retain equal navigation information. Existing-marker selection and nearby pickups are the initial scope defaults.

## Verification and acceptance

The playable implementation is complete and [verified on desktop](../../../verification/festival-map/README.md), including all quality-tier boots and production subpath worker loading. Representative-phone and prolonged lifecycle/performance acceptance remain open in Task 4.4 (device and extended lifecycle acceptance); the change is not archived.

## Risks & Watch-outs

Storage and worker failures must remain isolated from game startup. Persisted discovery restores only in the same seed; a fresh random festival has its own history. Cached imagery and active storage blocks have bounded residency. The map does not change 3D generation, RNG streams, materials or audio initialization. Device performance remains an acceptance measurement, not an architectural promise.

## Where Things Live

- [Proposal](proposal.md), [design](design.md), [requirements](specs/festival-map/spec.md) and [tasks](tasks.md).
- [Council synthesis](deliberations/001-initial/results.md) and [original plan](../../../docs/backlog/festival-map.md).
- [Session log](session-log.md) and [questions](questions-for-human.md).
