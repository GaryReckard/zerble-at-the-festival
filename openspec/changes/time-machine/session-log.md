---
change: time-machine
status: complete
current_task: null
blocked_by: null
open_questions: 0
started: 2026-11-16
last_updated: 2026-11-17
ref: 380cf22
---

# Session Log: Time Machine

## Key Decisions

- D1 (separate archive origin): Gary selected game.zerble.net and game-archive.zerble.net, with all snapshots in one archive repository.
- D2 (fresh archive sessions): Gary explicitly waived persistent archived progress and migration of existing saves when moving the live domain.
- D3 (archive front door): Put the timeline at the archive root and link from live play. Gary supplied zerble.net as the timeline UI reference.
- D4 (trusted builder): Build only extracted public game files with the current pinned toolchain; never execute historical package scripts or workflows.
- D5 (version-labeled analytics): Gary requested analytics across versions after implementation began. Retain existing gameplay instrumentation, attach game_version/game_channel globally, and add archive_play for real title-button starts; archive cookies remain memory-only and leaderboard writes stay blocked.

## Assumptions

| Assumption | Status | Resolution |
| --- | --- | --- |
| GitHub access is available | Verified | gh Pages API read succeeds with network access. |
| DNS has not been configured | Pending external action | Provide exact CNAME records after preparing Pages settings. |

## Dangling Threads

- ~~Gary must create DNS records; browser HTTPS and real-iOS acceptance depend on public routing.~~ DNS and HTTPS resolved November 17; physical-iOS audio remains an explicit device-verification limit.
- ~~Gary must create DNS records~~: Gary confirmed both records and configured the live Pages hostname. Both public deployments and HTTPS were verified November 17. Physical-iOS acceptance remains an explicit device-verification limit.

## Work Log

### 2026-11-16 -- Storage scope simplified
**Event:** decision
**What:** Earlier Astra light review recommended a separate origin and native-compatible storage. Gary subsequently chose fresh archive sessions, allowing a new per-page in-memory IndexedDB factory and Web Storage rather than persistence bridges or per-version hostnames.
**Refs:** D1 (separate archive origin), D2 (fresh archive sessions).

### 2026-11-16 -- Analytics and DNS clarified
**Event:** decision
**What:** Gary requested version dimensions and GA4 setup. Registered event-scoped Game version/game_version and Game channel/game_channel in the existing property and changed its stream URL to game.zerble.net. Gary confirmed both CNAME records and the live Pages hostname. Archive analytics uses page-local cookies while preserving fresh game sessions.
**Refs:** D5 (version-labeled analytics), docs/time-machine.md.

### 2026-11-17 -- Public release verified
**Event:** phase-change
**What:** The live deployment and both archive workflow runs passed. Public gameplay starts and HTTPS passed. The manual June 2 publication added a thirteenth unlisted package while retaining twelve curated chapters. GA4 Realtime showed archive_play with the expected archive channel and source commit. Only physical iOS audio and extended device play remain unclaimed acceptance limits.
**Refs:** verification/time-machine/README.md; source commit c68f7ef; archive runs 44021153915 and 44021715783.
