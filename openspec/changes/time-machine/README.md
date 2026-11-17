# Zerble Time Machine

> **Status:** <!--STATUS:LINE-->in progress · 9/11 tasks (81%)<!--/STATUS:LINE-->

## TL;DR

The Time Machine turns meaningful stages of the game's history into dated, playable chapters. The current game lives at game.zerble.net; the timeline and every historical version live at game-archive.zerble.net. Archived sessions start fresh every time.

## The Problem

Git history contains the old games, but players cannot launch a commit directly. Old save formats and live score submissions also need to stay away from the current game.

## Proposed Fix

A trusted builder prepares old public game files, adds memory-only storage before historical code executes, and publishes complete immutable snapshots to a separate archive repository. The timeline borrows zerble.net's dashed road, alternating cards and animated cart. Tags select milestones and a manual workflow accepts any supported source commit.

## Progress

<!--STATUS:AUTO-->
**in progress** — 9/11 tasks complete (81%) · current: 3.3

_Last updated: 2026-11-16_

| Group | Progress |
|---|---|
| 1. Archive compatibility and verification surface | 3/3 ✅ |
| 2. Timeline and publishing | 4/4 ✅ |
| 3. Release and operations | 2/4 |
<!--/STATUS:AUTO-->

## Key Decisions

- The timeline is the archive homepage, linked from the current game.
- Gary selected both hostnames and waived live-save migration and persistent archive progress.
- Storage policy runs as a synchronous classic script before historical code. Native IndexedDB is replaced with a fresh in-memory factory.
- Package URLs include source and adapter identity; previous published URLs are never overwritten.
- [Council synthesis](deliberations/001-archive/results.md) requires early/recent real-game boot and real-map transaction checks before bulk publishing.

## Risks & Watch-outs

Historical compatibility requires verification; building alone does not establish playability. Reload-dependent archive settings are disabled because reloading intentionally starts fresh. Public HTTPS and physical iOS audio require separate acceptance after DNS is connected. World generation and historical gesture/audio code are not rewritten.

## Where Things Live

- [Proposal](proposal.md), [design](design.md), [requirements](specs/time-machine/spec.md) and [tasks](tasks.md).
- [Decisions and discoveries](session-log.md), [human questions](questions-for-human.md).
- Implementation: tooling/time-machine and bin/time-machine.mjs.
