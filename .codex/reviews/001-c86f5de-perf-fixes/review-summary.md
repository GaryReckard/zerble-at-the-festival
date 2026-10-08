# Code Review Summary

## Review Metadata

- Diff scope: custom, `843a693..c86f5de` (latest commit only).
- Commit: `c86f5deacdfafb0c533ae7f1c7fbe14eb1cd6e7f`, `perf: add guided playtests and audit fixes`.
- Reviewed files: 38 changed files, with focused specialist review of rendering, gameplay/streaming, and capture tooling.
- OpenSpec change: none loaded.
- Specialists used: three general subagents covering rendering/performance, gameplay/determinism, and capture tooling/server; specialized review agent types were unavailable. Main reviewer covered documentation and integration.
- Initial worktree: clean. No application files were changed during review.

## Intent Match

The renderer/composer sizing, empty-bubble visibility, indexed lake queries, bounded road-neighbor cache, and sun-owned shadow policy match the audit recommendations. The shared streaming admission deadline is directionally correct but introduces the empty-residency case below. The guided captures are useful, but lifecycle and timing defects currently compromise their reliability.

## Findings

### 1. P1: Upload completion can be acknowledged before the final report is saved

Sources: `src/debug.js:2201-2214`, `src/debug.js:2224-2225`.

Multiple callers waiting on one fetch all resume together and start concurrent requests; they do not form a serial queue. With a pending periodic request, a manual SEND, and scenario completion, resolving the periodic request releases both manual and completion uploads. The earlier manual snapshot can finish writing last and replace the complete report. The periodic response also sets `deviceCaptureResult = 'sent'` solely because the scenario has since finished, allowing the UI to say the capture is saved before the completion request succeeds.

Reproduced with the actual extracted upload function and controlled fetch promises: one pending request became simultaneous `manual` and `complete` requests; the result was `sent` while the completion request remained unresolved; resolving `complete` before `manual` left the older manual report last.

Fix: one serialized upload queue with stale snapshots coalesced, and completion acknowledgement tied specifically to the immutable final report. Test several SEND clicks, periodic/complete overlap, delayed responses, and failures.

### 2. P2: Phase changes assign previous-phase frames to the next phase

Sources: `src/debug.js:2078-2089`, `src/debug.js:1847`, `src/debug.js:1862`.

The scenario changes `perfPhase` and Trip state without draining the accumulated frame window. The next sample labels that undrained window with the new phase, mixing old timings with new metadata. An isolated reproduction recorded a peak frame with 170 ms render work, advanced to `after`, and emitted an `after` sample with that peak render maximum.

Fix: flush the outgoing phase before changing its label or effect state, and explicitly attribute the boundary-crossing wall interval. Test baseline/fade-in and peak/after transitions at different sample/timer offsets.

### 3. P2: Empty residency reactivates the unbudgeted boot preload

Sources: `src/chunks.js:349`, `src/chunks.js:370-374`, `src/chunks.js:388-395`, `src/world.js:109-112`.

An expired world deadline can now admit zero chunks. If a distant move also unloads all previous chunks, the next update treats `loaded.size === 0` as initial boot and bypasses the deadline for the entire load ring. This is separate from the acknowledged single-chunk overrun.

The production `ChunkManager.update` was called in the browser with only generation/unload stubbed. Starting with one distant resident chunk and an expired deadline produced zero generated/zero resident chunks. The next update, also given an expired deadline, generated all 25 high-tier chunks. Independent parent-versus-commit tests showed the parent admitted one chunk and retained residency instead; the new low-tier case generates nine chunks on its second update.

Fix: track whether initial preload has completed separately from current residency. Add expired deadline -> unload all -> next expired deadline coverage, preserving intentional eager initial boot.

### 4. P2: Guided Trip phases and the effect use different clocks

Sources: `src/debug.js:2041-2054`, `src/debug.js:2074-2089`, `src/perfTelemetry.js:15-18`; interaction with `src/main.js:877`, `src/main.js:1090`, `src/main.js:1487-1489`.

Scenario phases use foreground wall time, while Trip advances through the simulation delta capped at 50 ms. At 10 FPS, twelve wall seconds put the report in `active`, but the actual Trip is still `fading_in`, with envelope approximately 0.648. When hidden, the scenario clock pauses but the game's timer loop can continue advancing Trip, creating the reverse mismatch.

Reproduced using the real Trip state machine with controlled deltas. Actual Trip state is present in raw samples, but the report groups the mismatched windows by the scenario label.

Fix: derive transitions from actual effect state or explicitly synchronize a capture-owned effect timeline. Do not change normal gameplay time globally for the test. Handle background interruptions explicitly and test low FPS as well as hidden/resume.

### 5. P2: A free capture completes when its tab resumes

Sources: `src/debug.js:2051-2054`, `src/debug.js:2072-2075`; documented free-capture contract at `DEBUGGING.md:383-389`.

The visibility handler unconditionally calls `advanceDeviceScenario()`. A supported `?perfCapture=1` session without `perfScenario` has no phase, so the resume path invokes completion and stops recording.

Reproduced in isolated handlers and in the actual browser by delivering a hidden/visible lifecycle transition: the UI changed from `REC 00:23` to `SAVED ... You can close this tab` without a guided scenario. The browser reproduction simulated visibility properties/events; it was not a physical phone app switch.

Fix: guard scenario advancement with `DEVICE_SCENARIO`, retaining free capture on resume.

### 6. P2: Retrying a finished capture rebuilds its metadata from ongoing play

Sources: `src/debug.js:2144-2168`, `src/debug.js:2194-2196`.

Recording ends, but the completed report is not frozen. A later SEND rebuilds duration, chunk totals, position, quality, and other live metadata while reusing the stopped samples. In the reproduction, a 155-second/five-chunk completed capture became 215 seconds/fifteen chunks on retry with unchanged samples.

Fix: freeze the final report and end timestamp once, then resend the same snapshot. Test retry after continued gameplay and after a failed initial completion upload. This is separate from the upload concurrency issue: it occurs with no overlapping requests.

### 7. P3: Report validation misses cross-phase quality changes

Source: `bin/report-perf-playtest:85-88`.

Quality and DPR are validated within each phase, not across the comparison. A fixture with baseline DPR 2 and all Trip/after phases at DPR 1 produces no contamination warning. A quality-lock flag records requested behavior, not proof that manual settings stayed fixed.

Fix: validate invariants across the whole comparison window, excluding settling, including actual render dimensions and relevant effect settings. Add a cross-phase-only change fixture.

## Verification

- Full `npm run check`: passed, including all new regression checks.
- Additional HTTP server tests with `ZERBLE_TEST_HTTP=1`: passed in specialist review. These HTTP cases are opt-in and are not exercised by the default check command.
- Worldgen self-test: all 24 checks passed; hashes `eddf8e50` and `7327fc42`.
- Additional lake-query equivalence and road-cache eviction/invalidation tests passed in specialist review.
- Browser: title card and real Start click succeeded on high; low booted through `__dbg.start()`.
- High: canvas/target stayed aligned at renderer DPR 0.5 and 1; bloom dimensions followed. Shadow Off remained false after travel to `(1500,-640)` and On restored the sun.
- Low: canvas and target both 518x317 after the manual downgrade; FXAA reciprocal dimensions matched; sun shadows remained disabled.
- Browser error log was empty after high-tier checks.
- Capture reproductions: `/var/folders/87/21271msd0sd1z2063kqknpbh0000gp/T/opencode/zerble-capture-review.mjs` and `zerble-capture-report-review.py`.

## Verification Gaps

No physical iPhone test, clean before/after GPU benchmark of this commit, long-duration memory soak, or full three-tier screenshot comparison was performed. The shadow regression test uses mock lights and an unattached caster object; it proves policy logic rather than rendered shadow pixels. Mid-tier runtime was not rerun in this review. The chunk deadline reproduction exercises the real admission method with stubbed builders, not a measured teleport hitch.

## Suggested Follow-up Description

`fix: preserve capture lifecycle and chunk admission limits`

Suggested changelog: Fix guided capture phase attribution, upload serialization and final-report retries; keep free captures recording after tab resume; prevent an emptied streaming neighborhood from re-entering the unbudgeted boot preload; validate quality across the complete comparison.

## Verdict

Request changes before treating guided reports as trustworthy evidence. Retain the core performance fixes; no actionable issue was found in their render-sizing, bubble-visibility, lake-index, road-cache, or light-level shadow implementations.
