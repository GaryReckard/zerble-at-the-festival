---
change: focused-touch-controls
status: complete
current_task: null
blocked_by: null
open_questions: 0
started: 2026-11-17
last_updated: 2026-11-17
ref: docs/backlog/ordinary-visit.md
---

## Key Decisions

- D1 (touch parent menu): retain the paused parent below child sheets, preserving
  desktop overlay behavior and avoiding pause-token transfer.
- D2 (camera ownership): only touch orbit arms return; stopped, parked, reverse,
  active gestures and other camera modes preserve the selected angle.

## Assumptions

| Assumption | Status |
| --- | --- |
| Runtime clock is sampled before paused rendering | Verified in main.js; no physics catch-up reset needed |

## Dangling Threads

Physical-phone acceptance remains separate from desktop verification.

## Work Log

### 2026-11-17 -- Bounded Astra review

**Event:** decision

**What:** User requested Astra review before implementation. Read-only review
recommended paused parent navigation, modality-aware return and independent touch
identifier handling, and found map CSS overriding the earlier button layout.
Adopt these constraints and verify actual combined CSS.

**Refs:** reviews/astra-plan.md; design.md.

### 2026-11-17 -- Combined stylesheet ownership

**Event:** discovery

**What:** Astra identified map CSS overriding all touch buttons; combined browser
inspection also found a Lantern Night compact-map top override. Consolidated
control sizing in styles.css and touch map positioning in festival-map.css, with
a stable top-anchored touch transition instead of a viewport-height bottom
calculation that briefly escaped the viewport on resize.

**Refs:** festival-map.css; lantern-ui.css; verification/touch-controls.

### 2026-11-17 -- Local implementation verified

**Event:** completion

**What:** Focused regressions, full check, production build and strict validation
passed. In-app browser checks covered short landscape, child-sheet handoffs,
pause, actual Low/Mid game boots and day/night rendering. Updated controls,
architecture, changelog, roadmap and verification documentation. Physical-phone
comfort remains a hands-on acceptance item. No implementation commit or deployment
was made; the owned browser tab and server were closed.

**Refs:** verification/touch-controls/README.md.
