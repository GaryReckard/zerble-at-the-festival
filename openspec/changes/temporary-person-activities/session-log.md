---
change: temporary-person-activities
status: complete
current_task: Complete; implementation and verification recorded
blocked_by: null
open_questions: 0
started: 2026-10-27
last_updated: 2026-10-27
ref: null
---

# Session log

## Key decisions

- Revoked activity claims never become writable again. Pending sessions retain separately owned reservations or reacquire them, and may resume only with a fresh claim after validating identity, resources and safety. See [deliberation](deliberations/001-activity-contract/results.md).

## Assumptions

| Assumption | Confidence | Status | Resolution |
| --- | --- | --- | --- |

## Dangling threads

## Work log

### 2026-10-27 -- Initial source inspection

**Event:** discovery

**What:** Hoopers and frisbee pairs own separate lifetimes and only receive cart position, while externally claimed adults return before trajectory detection and honks revoke claims. The requested cycle requires a deliberate authority handoff, not just new callbacks.

**Refs:** `src/people/hoopers.js`, `src/people/frisbees.js`, `src/crowd.js`, `src/people/activityClaims.js`.

### 2026-10-27 -- Existing ownership characterization

**Event:** discovery

**What:** The existing hooper, frisbee, activity-claim and Healing Arts ownership tests pass. Hidden bindings suppress adult collider publication and honk handling, and Healing Arts copies shirt and skin into a rig with fixed hair, so the new appearance and reaction requirements need explicit coverage.

**Refs:** `bin/test-hoopers-ownership`, `bin/test-frisbees-ownership`, `bin/test-activity-claims`, `bin/test-healing-arts-ownership`, `src/crowd.js`, `src/models/healingArts.js`.

### 2026-10-27 -- Hula fixture and first authority handoff

**Event:** phase-change

**What:** The native fixture exercises an existing Crowd person through hula, charging-cart interruption, honk, validated reacquisition and exit with unchanged identity and appearance. The separate session retains the reservation while revoked claims stay unwritable. The real game boots after a mode gesture with a clean captured console; live-world cycle, edge cases and the paired and dance work remain.

**Refs:** `verification/people/hula-cycle.html`, `bin/test-hula-session`, `bin/test-hula-activity`, `src/people/hulaSession.js`, `src/people/hulaActivity.js`.

### 2026-10-27 -- Live cycle and paired participation

**Event:** discovery

**What:** The native hula and paired fixtures pass; the controlled real game passes hula interruption and return after waiting for an initialized cart heading. The embedded browser reported an unattributed MutationObserver error, while direct game boot and native fixture logs were clean. The old independent frisbee arm rig is not used for the Crowd-backed pair. Matched whole-game and device evidence remains open.

**Refs:** `verification/people/temporary-activities.md`, `verification/people/hula-live-game.html`, `verification/people/frisbee-cycle.html`.

### 2026-10-27 -- Real-game and browser isolation checks

**Event:** discovery

**What:** Controlled live-game hula, paired frisbee and Healing Arts dance cycles pass. A static iframe with no application JavaScript reproduces the same in-app browser MutationObserver error seen on each embedded game fixture; direct game and native activity fixture logs remain clean. Single-prop render deltas are measured; matched whole-game and physical-device comparisons are not.

**Refs:** `verification/people/temporary-activities.md`, `verification/people/browser-iframe-probe.html`.

### 2026-10-27 -- Implementation verification complete

**Event:** phase-change

**What:** The final full suite and strict OpenSpec validation pass. Controlled real-game hula, frisbee and dance cycles and native rendering fixtures pass; iframe observer noise is independently reproduced by a static probe. Physical-device and matched whole-game performance measurements remain explicitly recorded limits.

**Refs:** `verification/people/temporary-activities.md`, `/private/tmp/zerble-temporary-activities-final-check-7.log`.
