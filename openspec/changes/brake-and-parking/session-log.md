---
change: brake-and-parking
status: complete
current_task: null
blocked_by: null
open_questions: 0
started: 2026-11-17
last_updated: 2026-11-17
ref: 65f1b0c
---

## Key Decisions

- D1 (approved controls): Space brake, E honk, R parking, Shift boost, Ctrl
  precision; touch Brake replaces Slow. Fresh throttle releases parking after
  neutral, never from input held when parking engaged.

## Assumptions

| Assumption | Status |
| --- | --- |
| Current source and AGENTS override stale OpenSpec toolchain context | Confirmed: Vite, no HTML module inventories |

## Dangling Threads

None.

## Work Log

### 2026-11-17 -- Suspension drift

**Event:** discovery

**What:** Velocity/gravity cancellation alone retained step-size-dependent native
suspension creep (0.176 m over five seconds at 30 Hz on a 30% grade). A compliant
stop target corrects drift through the same bounded contact-force budget, releases
when braking ends or support is lost, and is discarded by significant motion.
No pose or body-axis lock is introduced.

**Refs:** bin/test-vehicle-braking; src/physics/playerVehicle.js.

### 2026-11-17 -- Implementation verified locally

**Event:** phase-change

**What:** Full checks/build and native braking/parking tests passed. In-app
browser verified real Low/Mid boots, parking release, menu persistence, moving
rejection and day/night feedback. Touch fixture fits six buttons at 844×390.
Phone feel remains explicit acceptance, not a claimed result. Test tab and
owned Vite server were closed. Implementation is not committed or deployed.

**Refs:** verification/braking/README.md.
