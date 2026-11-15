# Measure the iPad before choosing the next performance change

> **Status:** <!--STATUS:LINE-->in progress · 16/24 tasks (66%)<!--/STATUS:LINE-->

## TL;DR

Build a capture that shows where the frame time goes, then run four comparable iPad tests on one frozen build. Keep the shipping game unchanged until that evidence identifies the next useful change.

## The Problem

The existing iPad reports show stalls but leave much of a typical frame unexplained. A horizon update can also look fast because it stopped publishing, so timing alone cannot prove that the November 11 fix works on the device. The [council evidence and decision](deliberations/001-next-levers/results.md) distinguish these gaps from measured results.

## Proposed Fix

Record the major sections of game work, elapsed time outside that work, horizon freshness, and the device's power/heat context. After desktop validation, run Auto quality, locked baseline quality, Auto again, and horizon off with the same Low tier and route. The repeated Auto run shows how much variation to expect before choosing any optimization.

## Progress

<!--STATUS:AUTO-->
**in progress** — 16/24 tasks complete (66%) · current: 1.10 (semantic draw owners and final device-build freeze)

_Last updated: 2026-11-15_

| Group | Progress |
|---|---|
| 1. Capture foundation before the device session | 12/14 |
| 2. One batched physical-iPad session, after foundation gates | 0/4 |
| 3. Choose a lever only from device evidence | 0/2 |
| 4. Correct documentation drift without claiming device acceptance | 4/4 ✅ |
<!--/STATUS:AUTO-->

## Key Decisions

The production freeze includes quality, physics, population, and horizon defaults. Capture controls are explicit and bounded, and the optional physics-off run uses legacy driving so it cannot serve as a clean comparison. Scene matrix timing observes an existing traversal without adding work; see the [design](design.md).

## Risks & Watch-outs

Desktop unit tests cannot establish timer overhead, route draw ownership, or iPad improvement. Complete the actual desktop overhead check, census, and pre-registered duration/publication rules before the device session. Preserve the real start gesture, Low/Mid integration checks, and browser cleanup. Older optimizations have no device before/after control and are not retroactively accepted by this session.

## Where Things Live

- [Proposal](proposal.md), [design](design.md), and [capture contract](specs/capture-attribution/spec.md) define the scope.
- [Tasks](tasks.md) record completed work and pending gates.
- [Session log](session-log.md) records decisions and unresolved evidence; [human questions](questions-for-human.md) records requests when needed.
- [Council results](deliberations/001-next-levers/results.md) preserve the review and conditional decision table.
- [Four-run procedure](../../../docs/performance-playtests.md#four-run-ipad-attribution-session) provides commands and environment recording instructions.
