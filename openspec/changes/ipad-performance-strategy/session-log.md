---
change: ipad-performance-strategy
status: in_progress
current_task: "1.10 (semantic draw owners and final device-build freeze)"
blocked_by: null
open_questions: 0
started: 2026-11-15
last_updated: 2026-11-15
ref: "November 15 council; ROADMAP Performance"
---

## Key Decisions

- **D1 (production freeze):** Follow the existing five-persona [council result](deliberations/001-next-levers/results.md). Only capture instrumentation, harness controls, and factual documentation corrections proceed before the device session.
- **D2 (matched Low controls):** All four runs use explicit Low tier, fixed seed 2404796662, autopilot, and world detail. Auto denotes quality policy; physics-off is optional and uses legacy driving.
- **D3 (existing traversal timing):** Instrument the renderer's existing scene matrix update rather than call it again. Instance hooks must retain original behavior and teardown.
- **D4 (historical evidence):** Correct older device-validation wording without retroactively accepting optimization gains. The November 8 baseline already contained the older changes.
- **D5 (toolchain authority):** Charter edits synchronize Vite and threeShim facts with the explicit October 29 approval in `.claude/rules/no-build.md`; no performance-budget policy is changed.

## Assumptions

| ID | Assumption | Confidence | Status | Resolution |
| --- | --- | --- | --- | --- |
| A1 (Low equivalence) | Forced and detected tablet Low have identical scene policy. | High | Verified | VM compared complete PERF objects from current `src/perf.js`. |
| A2 (timer overhead) | Detailed instrumentation is cheap enough for device attribution. | Unknown | Open | Task 1.9 (matched desktop overhead) requires real route evidence. |
| A3 (publication threshold) | A useful numeric freshness limit can be calibrated before device testing. | Unknown | Open | Task 1.11 (pre-registration) requires desktop route data. |

## Dangling Threads

- The reserved four-run descriptive overhead criterion passed and sampled publication thresholds were frozen. A 72.9 ms far-field preparation interval exceeds the unchanged 50 ms target; physical-iPad acceptance remains open. Three stationary and four post-route composition censuses are retained, with semantic owner attribution and the final clean device-build freeze still open.
- Physical iPad evidence remains future work after the foundation gates.
- Budget recalibration and production levers are conditional decisions, not requests for premature approval.

## Work Log

### 2026-11-15 -- Capture preparation separated from optimization

**Event:** phase-change

**What:** Implementation began under the existing council decision. Harness and metadata propagation tests pass without processes or sockets, while frame/report integration and real-game verification remain ongoing. The OpenSpec CLI still injects stale no-build context and warns about obsolete implementation/verification artifact rules; current AGENTS and the approved toolchain rule take precedence. Referenced session templates are absent, so these memory files follow the exact schema in `.claude/rules/openspec.md`.

**Refs:** [Tasks](tasks.md), [design](design.md), [device procedure](../../../docs/performance-playtests.md#four-run-ipad-attribution-session).


### 2026-11-15 -- Functional evidence collected; timed qualification requires reservation

**Event:** verification-boundary

**What:** Exclusive timing, scalar physics diagnostics, previous-callback residuals, title/environment metadata and horizon publication health passed integration tests and a saved real Low capture. Native ready-title Low/Mid boots, day/night screenshots, console checks and three Low stationary censuses are retained in the [verification report](../../../verification/performance/2026-11-15-ipad-attribution/README.md). The census exposed a debug-overlay teleport that omitted physics reset; successful relocation now notifies the owner and progression, while support rejection stays non-mutating. The final full check/build passed. Immutable snapshot preparation initially exposed a preview entry outside the source inventory; moving it to `src/menuPreview.js` fixed the snapshot build, with focused and browser preview checks passing. The failed attempt and successful content-addressed dirty snapshot are retained. No performance gain or cheap-observer claim follows from functional checks. A quiet reservation is required before timing qualification, and clean-build/device acceptance remains pending. The user-requested dev server is left running; task browser tabs are closed.


### 2026-11-15 -- Reserved desktop window completed; one duration miss retained

**Event:** measurement-result

**What:** Gary granted 20 minutes starting at 17:59:13 UTC. Hardware and injected-failure cleanup probes, ordinary Low/Mid/High boots and four basic/detail/detail/basic guided routes completed within the window, each with verified process teardown. The declared descriptive incremental-overhead criterion passed at +0.20 ms against 2 ms. Publication limits were frozen from the first detailed run before the second began, and the second passed them; the first retained a 72.9 ms preparation call above the fixed 50 ms target. Window summaries, adult-count variation and lack of iPad qualification remain explicit in the [follow-up](../../../verification/performance/2026-11-15-ipad-attribution/desktop-window/README.md). After these captures, Gary's separate landing-forgiveness request and offline runner safeguards changed the live source, so future captures need a new snapshot; the measured snapshot is unchanged.
