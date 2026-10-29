---
change: festival-map
status: in_progress
current_task: 4.4 (device and extended lifecycle acceptance)
blocked_by: null
open_questions: 0
started: 2026-10-29
last_updated: 2026-10-29
ref: ROADMAP.md world generation / in-game map view
---

## Key Decisions

- D1 (confirmed player behavior): Gary approved persistent exploration, live expanded driving, nearby-only friends, player-centered zoom without panning, mission fog exceptions, and distance-scaled boundary pins. See docs/backlog/festival-map.md.
- D2 (initial scope defaults): Proceed with nearby-only pickups and existing-marker selection. These defaults resolve the previously open implementation choices without adding arbitrary waypoints.

## Assumptions

| Assumption | Status | Resolution |
| --- | --- | --- |
| Current Vite instructions override old OpenSpec tooling context | Verified | AGENTS.md |

## Dangling Threads

## Work Log

### 2026-10-29 -- Change authorized

**Event:** decision
**What:** Gary requested an OpenSpec change and proceeding toward a playable map. The standalone Astra Light review is input evidence; this change will satisfy its own deliberation gate.
**Refs:** docs/backlog/festival-map.md; docs/backlog/festival-map-review.md

### 2026-10-29 -- Minimap placement

**Event:** decision
**What:** Gary specified bottom-right placement during the playable check. The touch button layout reserves that corner while retaining the existing stick.
**Refs:** festival-map.css; docs/backlog/festival-map.md

### 2026-10-29 -- Functional implementation and verification

**Event:** phase-change
**What:** The playable map and production subpath worker are implemented and pass map/storage/input regressions plus full project checks and Low/Medium/High game boot. Geometry and fog caches are separated after the fixture exposed repeated raster work during exploration. Real-device/extended lifecycle acceptance remains explicit, rather than inferred from desktop evidence.
**Refs:** verification/festival-map/README.md; tasks.md Task 4.4 (device and extended lifecycle acceptance)

### 2026-10-29 -- Circular compact map

**Event:** decision
**What:** Gary requested a circular compact map. CSS and backing measurements share a square diameter, and selected edge pins clamp radially while expanded view retains rectangular bounds.
**Refs:** src/festivalMap/model.js; festival-map.css; bin/test-festival-map

### 2026-10-29 -- Forward arrow correction

**Event:** discovery
**What:** Gary reported the player arrow pointing backward. The renderer had an extra half-turn despite the cart moving along local negative Z. An actual-renderer regression failed at heading zero before removing the offset; the workshop movement convention now also matches the cart.
**Refs:** src/zerble.js forward movement; src/festivalMap/view.js drawMarkers; bin/test-festival-map

### 2026-10-29 -- Coordinated transition and transparency

**Event:** decision
**What:** Gary requested a cleaner collapse, no minimap border, and about 30% more transparency for expanded geography. The previous canvas switched to its compact backing before the CSS panel finished shrinking. Logical rendering now follows the actual animated viewport with stable full-size backings until settlement, and boundary pins interpolate shape. Permanent border/shadow are removed; keyboard-only focus inherits the circle. Expanded geography opacity changes from 0.92 to 0.644, leaving markers and labels at full opacity. A browser fixture passed 73 animation frames, reversal, backing retention, border/focus and opacity checks, and held-driving input still passes.
**Refs:** festival-map.css; src/festivalMap/view.js; src/festivalMap/workshopChecks.js; bin/test-festival-map

### 2026-10-29 -- Independent backdrop fade

**Event:** decision
**What:** Gary requested moving the map into the corner while full-screen dimming fades separately, followed by another 30% reduction in expanded-map opacity. Dimming now belongs to a fixed noninteractive sibling rather than the moving Canvas/panel; the compact disc appears only at its settled size. Expanded geography opacity is 0.92 × 0.7 × 0.7 = 0.4508, with full-strength markers and text. Regression checks enforce transparent geographic drawing and full-screen backdrop bounds throughout motion.
**Refs:** festival-map.css; src/festivalMap/view.js; src/festivalMap/workshopChecks.js; bin/test-festival-map

### 2026-10-29 -- Minimal direct-pin interface

**Event:** decision
**What:** Gary removed the heading/destination menu, decorative idle caption, scale, north indicator and visible zoom/close controls, then authorized commit and push. Direct pin clicks toggle selection; mouse wheel/pinch zoom and Escape/empty-space tap close. Keyboard/screen-reader pin controls remain visually hidden with a drawn focus highlight. Pre-commit inspection also narrowed the map/music modifier guard so Ctrl slow driving remains intact.
**Refs:** src/festivalMap/view.js; src/festivalMap/workshopChecks.js; src/input.js; README.md
