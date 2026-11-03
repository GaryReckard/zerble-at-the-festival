---
change: physical-zerble-driving
status: complete
current_task: complete; Gary accepted handling and requested a branch commit
blocked_by: null
open_questions: 0
started: 2026-11-02
last_updated: 2026-11-02
ref: user-authorized physical driving and water gameplay
---
## Key Decisions
- D1 (continuous chassis): Evaluate built-in Rapier vehicle controller; one simulation authority for ground and air.
- D2 (water consequences): Shallow water slows the cart; sustained engine-depth submersion ends play through the existing score screen. Both modes may end from submersion; Cruisin does not submit a festival leaderboard result.
- D3 (grounded handling): Use bounded contact-plane propulsion, lateral grip and yaw torque rather than competing wheel-angle and yaw controllers. Restore the specified road boost target; fade assistance with steepness, contact loss and water. Preserve physical pose authority.
## Assumptions
The user authorizes complete implementation and practical tuning, including recovery and water thresholds.
## Dangling Threads
None. Physical-device and performance follow-ups remain on the project roadmap.
## Work Log
- 2026-11-02: Implemented the physical cart, surfaces/water, damage/endings, engine demand and visible course; project checks and production build passed. Fixed camera aim bob, airborne contact shadow and fixed-step presentation stepping after Gary's reports.
- 2026-11-02: A combined boosted-turn replay reproduced reduced steering. The latest candidate increases boost and uses bounded speed-sensitive tire grip plus grounded chassis-centred extra thrust, with passing left/right/countersteer and uphill tests. Gary still reports poor feel, so tuning is paused and the focused Astra packet records evidence and alternatives without claiming acceptance.

- 2026-11-02: Focused handling replay measured more than twice the flat yaw response on asphalt versus grass in the previous candidate. Native lateral tire friction also opposed a yaw assist, so the final candidate gives one force controller lateral/yaw ownership while keeping native suspension. Recovery coverage now starts explicitly overturned on ample support instead of depending on the coasting tune to land within a finite ledge fixture. See the handling-pass verification report.

- 2026-11-02: Gary confirmed “Astra did it!” and requested committing everything on a branch off main. Recorded handling acceptance and completed the feature checklist; device and rendering-baseline follow-ups remain on ROADMAP.
